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
