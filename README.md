# Paul

Paul is a writer's toolbox for writing fiction across multiple devices: a web app with
layouts tuned for desktop and mobile, versioned manuscripts, characters and relationships,
notes, whiteboards, spell/grammar checking and KDP-ready export.

- Product spec: [docs/SUMMARY.md](docs/SUMMARY.md), [docs/FEATURES.md](docs/FEATURES.md)
- Tech stack: [docs/TECHSTACK.md](docs/TECHSTACK.md)
- Implementation plan: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- Publishing pipeline: [docs/BOOK_PIPELINE.md](docs/BOOK_PIPELINE.md)

## Repository layout

| Path        | Contents                                              |
|-------------|-------------------------------------------------------|
| `backend/`  | Spring Boot API (Java 25, Maven wrapper)              |
| `frontend/` | React + TypeScript + Tailwind (Vite)                  |
| `e2e/`      | Playwright end-to-end tests                           |
| `deploy/`   | Containerfile and compose file (podman / docker)      |
| `docs/`     | Specifications and plans                              |

## Development

Prerequisites: Java 25, Node 22+, and podman (with podman-compose) or docker.

```bash
# backend (http://localhost:8080)
cd backend && ./mvnw spring-boot:run

# frontend dev server (http://localhost:5173, proxies /api to :8080)
cd frontend && npm install && npm run dev

# full stack in containers (http://localhost:8080)
podman-compose -f deploy/compose.yaml up --build
```

### Tests

```bash
cd backend && ./mvnw verify          # unit + integration, JaCoCo gate (80% lines)
cd frontend && npm run test:coverage # Jest + Testing Library
cd e2e && npm ci && npx playwright install chromium && npx playwright test
                                     # against a running stack (PAUL_BASE_URL, default :8080)
```

On Windows, use `mvnw.cmd` from PowerShell; the POSIX `mvnw` script does not work under Git Bash.

### Podman on WSL

Rootless podman in WSL has no systemd user session, so builds fail with
`sd-bus call: Permission denied`. Switch podman to the cgroupfs manager once:

```bash
mkdir -p ~/.config/containers
printf '[engine]\ncgroup_manager = "cgroupfs"\nevents_logger = "file"\n' >> ~/.config/containers/containers.conf
```

### Releases

Pushing a `v*` tag publishes the image to `ghcr.io/theburntcrumpet/paul` and creates a GitHub
Release with the runnable jar and `compose.yaml` attached.
