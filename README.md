# SaaS Demo (Chunk 1 to Chunk 8)

Two tiny services (no DB) to demo the later CI/CD + versioning flow.

## Services

- `market-service` (Node.js + Express, port `3000`)
  - `GET /products`
  - `POST /products`
- `web-ui` (static HTML/JS served by Node.js, port `3001`)
  - shows + adds products via `market-service`

## Run locally (step-by-step)

### 1) Start the API

```bash
cd saas-demo/market-service
npm install
npm run dev
```

API should be up at `http://localhost:3000`.

### 2) Start the UI

Open a second terminal:

```bash
cd saas-demo/web-ui
npm install
npm run dev
```

UI should be up at `http://localhost:3001`.

### 3) Verify end-to-end

- Open `http://localhost:3001`
- Add a product
- Refresh and confirm it appears in the list

## Run with Docker (Chunk 2)

### 1) Build and start both services

```bash
cd saas-demo
docker compose up --build
```

This command does 3 things:

1. reads `docker-compose.yml`
2. builds images from `market-service/Dockerfile` and `web-ui/Dockerfile`
3. starts containers with the configured ports/environment

### 2) Verify services

- API: `http://localhost:3000/health`
- UI: `http://localhost:3001`

### 3) Stop services

```bash
docker compose down
```

## Chunk 2 Deep Explanation

### Why each service has its own Dockerfile

- `market-service/Dockerfile` creates a container image that contains only what the API needs: Node runtime, dependencies, and `src/server.js`.
- `web-ui/Dockerfile` creates a separate image for UI server + static assets.
- This keeps each service independently buildable and deployable, which is essential for your later versioned release flow.

### How the Dockerfile works (shared pattern)

1. `FROM node:20-alpine`
   - starts from a lightweight Node base image.
2. `WORKDIR /app`
   - sets container working directory.
3. `COPY package*.json ./` then `npm ci --omit=dev`
   - installs exact production dependencies.
4. `COPY ...`
   - copies only runtime source files into image.
5. `EXPOSE <port>`
   - documents the service port.
6. `CMD ["node", "..."]`
   - starts the service process.

### Why `.dockerignore` matters

- prevents `node_modules`, git metadata, and OS junk from being sent into Docker build context.
- results: faster builds, smaller images, fewer cache invalidations.

### How `docker-compose.yml` wires both services

- `market-service`:
  - built from `./market-service`
  - host port mapping `3000:3000`
- `web-ui`:
  - built from `./web-ui`
  - host port mapping `3001:3001`
  - `depends_on: market-service` to start API first
  - env `MARKET_SERVICE_URL=http://market-service:3000`

### Internal networking (most important concept)

- Compose creates a private network for services in the same file.
- On that network, service name works like DNS:
  - `market-service` resolves to the API container IP.
- So inside `web-ui`, using `http://market-service:3000` is correct.
- From your laptop browser, you use host ports:
  - `http://localhost:3001` (UI)
  - `http://localhost:3000` (API)

### Why this is the right base for upcoming chunks

- Chunk 3 CI can build these exact Dockerfiles.
- Chunk 4 CD can tag resulting images (`market-service:v0.1.X`, `web-ui:v0.1.X`).
- Chunk 8 deploy workflow can pull and run those tagged images unchanged.

## CI (Chunk 3)

`./github/workflows/ci.yml` runs on every push and:

- installs dependencies for both services
- runs a basic Node syntax check
- builds both Docker images

This is build-only validation (no deploy).

## CD Versioned Images (Chunk 4)

`./github/workflows/cd.yml` runs on push to `main` and:

- generates version `v0.1.X` (`X = github.run_number`)
- builds and pushes images to GHCR:
  - `ghcr.io/<owner>/saas-demo-market-service:v0.1.X`
  - `ghcr.io/<owner>/saas-demo-web-ui:v0.1.X`

## Version Store + Admin Approval (Chunks 5, 6, 7)

Added to `market-service`:

- `POST /version`
  - body: `{ "version": "v0.1.10" }`
  - stores version with `pending` status
- `GET /versions`
  - lists versions
- `POST /approve-version`
  - body: `{ "version": "v0.1.10" }`
  - marks version as `approved`
  - triggers deploy bridge:
    - locally: simulated if GitHub env vars are missing
    - real: uses GitHub `repository_dispatch` if env vars are set

Version records are saved in `market-service/versions.json`.

### Env vars for real GitHub dispatch from backend

- `GITHUB_REPO` (example: `your-org/saas-demo`)
- `GITHUB_TOKEN` (token with repo/workflow permission)

## Deploy Workflow (Chunk 8)

`./github/workflows/deploy.yml` triggers on:

- `repository_dispatch` event type `deploy`

It reads `client_payload.version`, SSHes into your server, pulls both versioned images, and restarts containers.

### Required GitHub Secrets for deploy job

- `SSH_HOST`
- `SSH_USER`
- `SSH_KEY`
- `SSH_PORT` (optional; defaults to 22)
- `REGISTRY_USERNAME` (for GHCR login on server)
- `REGISTRY_TOKEN` (for GHCR login on server)

## Quick API checks for new chunks

Run market-service locally, then:

```bash
curl -X POST http://localhost:3000/version \
  -H "content-type: application/json" \
  -d '{"version":"v0.1.1"}'

curl http://localhost:3000/versions

curl -X POST http://localhost:3000/approve-version \
  -H "content-type: application/json" \
  -d '{"version":"v0.1.1"}'
```

## Notes

- Product storage is **in-memory**, so restarting `market-service` resets the list.
- `web-ui` reads the API base URL from `MARKET_SERVICE_URL` (default `http://localhost:3000`).
- Version storage is in `market-service/versions.json` for simple persistence.

