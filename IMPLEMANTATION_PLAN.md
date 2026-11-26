# Paul – Implementation Plan

Status: **draft for review**. Nothing has been built yet. Open questions are listed at the end.

---

## 1. Architecture overview

```
┌──────────────────────────┐        ┌─────────────────────────────────────┐
│ frontend (React/TS/Vite) │  HTTPS │ backend (Spring Boot, Java 25)      │
│  - Tailwind, responsive  │ ─────► │  - REST API  /api/**                │
│  - CodeMirror 6 editor   │  JSON  │  - Spring Security (session +       │
│  - React Flow (fam tree) │        │    remember-me cookie)              │
│  - Excalidraw (boards)   │        │  - Flyway + JPA → SQLite            │
└──────────────────────────┘        │  - StorageService → filesystem      │
                                    │  - ExportService → pandoc + XeLaTeX │
                                    └──────────┬───────────────┬──────────┘
                                               │               │
                                      ┌────────▼──────┐  ┌─────▼──────────────┐
                                      │ /data volume  │  │ languagetool       │
                                      │  paul.db      │  │ (container, en-GB  │
                                      │  books/…      │  │  default)          │
                                      └───────────────┘  └────────────────────┘
```

- **One deployable image** for the app: the Spring Boot jar serves the built React bundle as static files, so there's one origin and no CORS. Vite's dev server proxies `/api` during development.
- **LanguageTool** runs as a second container. It's open source, self-hosted, does spelling and grammar, supports en-GB and many other languages, and handles long texts well when we send it paragraph chunks.
- **Export tooling** (pandoc, XeLaTeX, Crimson Text) goes into the backend image. That keeps the host clean, so you won't need pandoc or TeX installed on Windows.

### Repository layout (monorepo)

```
paul/
  backend/            Spring Boot (Maven wrapper: ./mvnw)
  frontend/           Vite + React + TS + Tailwind
  e2e/                Playwright tests
  deploy/
    Containerfile     multi-stage: node build → maven build → runtime (JRE + pandoc + texlive-xetex)
    compose.yaml      paul + languagetool, /data volume
  docs/               the current *.md specs move here
  .github/workflows/  CI + release
```

### Key technical decisions

| Area | Choice | Why |
|---|---|---|
| Java / framework | Java 25 LTS, Spring Boot (latest GA), Maven wrapper | Matches TECHSTACK. The wrapper means you don't need Maven installed. |
| DB | SQLite via `sqlite-jdbc` and Hibernate community dialect. **Flyway** for migrations | Standard SQL in the migrations and nothing SQLite-specific in the code, so moving to Postgres/RDS later is a config change. |
| File storage | `StorageService` interface with `FileSystemStorageService` | An S3 implementation can be added later without touching callers. |
| Auth | Server-side sessions plus Spring Security **persistent remember-me tokens** (stored in DB), BCrypt passwords, CSRF via cookie token | Keeps you logged in across devices and lets you revoke tokens. Simpler and safer than JWT for a single-origin app. |
| Editor | **CodeMirror 6** with markdown language, live-preview styling (headings, emphasis rendered inline), outline sidebar | Stays fast on novel-length documents (100k+ words), where ProseMirror/TipTap-style WYSIWYG editors slow down. Markdown stays the source of truth, so nothing is lost converting back and forth. Decorations make character-name highlighting and spell-check underlines straightforward. |
| Spell/grammar | LanguageTool container. Frontend checks **only changed or visible paragraphs**, debounced, results cached by paragraph hash | Makes "works for long documents" practical. Language is per book, overridable, defaulting to `en-GB`. |
| Family tree / relationships | **React Flow (@xyflow/react)** with auto-layout (dagre/elk) | Gives a whiteboard-style relationship graph with typed edges (parent, spouse, sibling, friend, custom). |
| Whiteboards | **Excalidraw** embedded; scene JSON stored as files | Freeform drawing, works with touch and on mobile. |
| Export | pandoc + XeLaTeX with your `chapters.lua` / `book.tex` turned into templates | Reproduces BOOK_PIPELINE.md exactly, with title, author, trim size, etc. as parameters. |
| Multi-device safety | Optimistic concurrency: every save sends `baseVersion`; the server rejects stale writes with 409 and the UI offers "load latest / keep mine as new version" | Stops two devices from silently overwriting each other. |

---

## 2. Data model (initial)

```
users(id, username UNIQUE, password_hash, must_change_password, created_at)
persistent_logins(series PK, username, token, last_used)       -- Spring remember-me
books(id, title, description, language DEFAULT 'en-GB',
      author_name, versions_to_keep DEFAULT -1,
      current_version, created_at, updated_at, deleted_at NULL)
book_tags(book_id, tag)
book_versions(id, book_id, version_no, kind  -- CREATE|AUTOSAVE|MANUAL|METADATA|REVERT
              title, description, tags_json,            -- metadata snapshot
              content_path, content_sha256, word_count,
              created_by, created_at,
              UNIQUE(book_id, version_no))
notes(id, book_id, title, path, created_at, updated_at)
whiteboards(id, book_id, title, path, created_at, updated_at)
characters(id, book_id, name, aliases_json, summary, description_md, colour)
relationships(id, book_id, from_character_id, to_character_id, type, label)
character_layout(book_id, json)   -- node positions for the family tree view
```

Filesystem under `/data`:
```
books/{bookId}/versions/{versionNo}.md
books/{bookId}/notes/{noteId}.md
books/{bookId}/whiteboards/{boardId}.excalidraw.json
books/{bookId}/exports/{timestamp}/…   (temporary, cleaned up)
```

**Versioning rules**
- Creating a book writes version 1 (empty or template manuscript).
- A metadata edit creates a new version that **reuses the content file** when the SHA is unchanged. This saves disk, and a reference-counted delete only removes the file when no version points at it.
- Autosave runs every N seconds (default 30) after the last keystroke, plus on tab blur or unload. It **skips the save when content is unchanged**.
- Retention: after each new version, if `versions_to_keep > 0`, delete the oldest versions beyond the limit. The current version and version 1 are always kept? (open question, see §6).
- Revert creates a *new* version copied from the old one, so history is never rewritten. The UI shows a diff preview and asks for confirmation.

---

## 3. Delivery plan – milestones as PR stacks

Each milestone is a **stack of small PRs** (each roughly 200–400 lines where possible). Every PR is based on the previous one and has its own tests, so you can review and merge from the bottom up. I'll keep each PR description focused: what changed, how to test it, screenshots for UI.

### M0 – Foundations
1. **Repo scaffolding**: monorepo layout, `.gitignore`, `.editorconfig`, README, LICENSE (your choice), move specs into `docs/`.
2. **Backend skeleton**: Spring Boot, `./mvnw`, health endpoint, Flyway + SQLite, Spring Boot test setup, JaCoCo.
3. **Frontend skeleton**: Vite + React + TS + Tailwind, ESLint/Prettier, Jest + React Testing Library, API client, responsive app shell (desktop sidebar / mobile bottom nav).
4. **Containers**: multi-stage `Containerfile`, `compose.yaml` (paul + languagetool + volume), verified with `podman compose up` in WSL.
5. **CI**: GitHub Actions running backend tests, frontend tests, lint, and Playwright against the composed stack. The release workflow publishes the container image to **GHCR** and attaches the jar plus a compose bundle to GitHub Releases ("artifacts published to the git repo").
6. **Playwright harness**: `e2e/` project, fixtures that start from a clean `/data`, and a smoke test.

### M1 – Authentication & users
1. User entity, BCrypt, Flyway migration; **first-start bootstrap** creates `admin` with a default password and `must_change_password=true`. The default is printed to the log once, or set from `PAUL_ADMIN_PASSWORD`.
2. Spring Security config: form/JSON login, logout, CSRF, persistent remember-me (on by default, e.g. 90 days).
3. Forced "set new password" flow: every API except change-password returns 403 until the password is changed.
4. Frontend login page, password change page, auth context, route guards.
5. User management: list and create users, reset password. Any logged-in user can do this, per the spec.
6. E2E: first-run flow, remember-me survives a browser restart, creating a second user.

### M2 – Books: create, list, modify, delete
1. `Book` and `BookVersion` entities, `StorageService` + filesystem impl, create creates v1.
2. REST: `POST/GET/PATCH/DELETE /api/books`, where PATCH on title/description/tags creates a METADATA version.
3. Delete requires `{"confirm":"delete me"}` server-side (not just in the UI). Soft delete first, then file cleanup.
4. Frontend: book library (cards on desktop, list on mobile), create dialog, edit metadata dialog with tags, delete dialog that only enables the button once "delete me" is typed.
5. Tests: unit (version numbering, SHA reuse), integration (REST + filesystem in a temp dir), E2E.

### M3 – Editor, autosave, versions, download
1. `GET/PUT /api/books/{id}/content` with `baseVersion` and 409 conflict handling.
2. CodeMirror 6 editor with markdown live-preview styling, focus/typewriter mode, word count.
3. **Chapter navigation**: outline parsed from `#` / `##` headings, shown as a sidebar on desktop and a drawer on mobile. Click to jump. Current chapter is highlighted while scrolling.
4. Autosave with a status indicator (Saved · Saving… · Offline – will retry). Unsaved edits are kept in IndexedDB so a dropped connection doesn't lose work.
5. Per-book `versions_to_keep` setting (-1 = all) and a retention job.
6. Version history panel: list with timestamp, kind and word count; diff against current; **revert** with a confirmation dialog showing the diff. Revert creates a new version.
7. Download `.md` (current version or any historical version).
8. Conflict UI for multi-device edits.
9. Performance test: a 150k-word manuscript loads and types smoothly (Playwright timing assertions).

### M4 – Spelling & grammar
1. Backend proxy `/api/check` → LanguageTool (keeps LT off the public network and adds caching).
2. Per-book language setting (dropdown from LT's `/v2/languages`), default `en-GB`.
3. CodeMirror lint extension: paragraph-hash cache, checks only visible and changed paragraphs, underlines, quick-fix popover, "ignore" / "add to dictionary" (per-user dictionary stored in DB).
4. Tests with a stub LanguageTool in integration tests, plus one real-container E2E.

### M5 – Characters & relationships
1. Entities and REST for characters (name, aliases, summary, rich description), relationships (typed), and graph layout.
2. "Characters" tab in the editor: list plus detail form.
3. **Relationship graph / family tree** with React Flow: drag to connect, edge type picker, auto-layout button, positions persisted. Pan and pinch-zoom work on mobile.
4. **Mention detection** in the editor: names and aliases get a subtle underline as a CodeMirror decoration. Clicking one opens a side panel with the character (a bottom sheet on mobile).

### M6 – Notes & whiteboards
1. Notes: CRUD, each stored as its own `.md`, edited with the same CodeMirror component (no versioning initially; open question).
2. Whiteboards: CRUD, Excalidraw embedded, scene JSON saved with debounce.

### M7 – Publishing export
1. Port `typo.py` to Java (`TypographyService`) with unit tests built from your rules. These include the quote-balance check from BOOK_PIPELINE.md, reported as warnings per paragraph.
2. Template your `chapters.lua` and `book.tex` with title, author, trim size, margins, `openany`/`openright`, TOC on/off (on by default), and font.
3. Export options UI with common **KDP trim sizes** (5×8, 5.25×8, 5.5×8.5, 6×9, …) and margins scaled by page count per KDP's rules, cream/white paper, and EPUB with an optional cover image upload.
4. Export job: async, with a progress indicator. Runs pandoc → xelatex ×2, runs a `pdffonts` check that every font is embedded, then offers the download. EPUB is built via pandoc with `meta.yaml` and the CSS, then validated with EPUBCheck.
5. Extra: paperback cover **spec calculator** (wrap size and spine width from the page count) shown after the PDF build.
6. Golden-file tests: a small sample manuscript is exported, and the test checks page count, embedded fonts and EPUB validity.

---

## 4. Testing strategy

- **Backend**: JUnit 5 unit tests; `@SpringBootTest` integration tests with SQLite in a temp dir and `@TempDir` storage; MockMvc/RestAssured for the API; Spring Security test support. JaCoCo coverage gate (target ≥ 80%).
- **Frontend**: Jest + React Testing Library for components and hooks; MSW to mock the API.
- **E2E**: Playwright against the composed stack, in desktop and mobile (Pixel/iPhone) projects for every feature flow.
- **CI** runs all of them on every PR. A PR in a stack merges only when green.

## 5. Mobile vs desktop UX

- Breakpoint-driven layouts with Tailwind (`md:`/`lg:`).
- **Desktop**: three panes (outline | editor | side panel for characters, notes and history).
- **Mobile**: full-screen editor, outline and side panels as drawers or bottom sheets, larger touch targets, toolbar above the keyboard.
- Installable **PWA** manifest (cheap to add and nice on phones). Full offline editing is out of scope beyond the IndexedDB draft buffer.

## 6. Open questions for you

1. **Retention**: when `versions_to_keep = N`, should version 1 also be protected, or is it just the newest N?
2. **Notes versioning**: should notes and whiteboards be versioned like the manuscript, or are simple overwrites fine?
3. **Default author name / pen name**: per user, per book, or both? (It's needed for the export headers.)
4. **Licence** for the public repo (MIT, Apache-2.0, AGPL, …)?
5. **Repo name**: `paul` under your GitHub account?
6. **Hosting**: will this run on a home server or VPS, behind a reverse proxy with TLS? This affects the secure-cookie and remember-me settings.

## 7. Tooling needed

| Tool | Where | Status |
|---|---|---|
| git | Windows | ✅ 2.56 |
| Node / npm | Windows | ✅ 26 / 11 |
| Java 25 | Windows | ✅ (Maven via wrapper, no install needed) |
| podman | WSL Debian | ✅ 5.4.2 |
| **podman-compose** | WSL Debian | ❌ needed: `sudo apt install podman-compose` |
| **GitHub CLI (`gh`)** | Windows | ❌ needed to create the repo and open stacked PRs: `winget install GitHub.cli`, then `gh auth login` |
| pandoc / XeLaTeX | — | Not needed on host (inside container image) |
| Playwright browsers | Windows | I'll install them via `npx playwright install` during M0 |
