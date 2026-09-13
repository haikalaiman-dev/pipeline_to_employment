# web

The Next.js front end of the dashboard. Runs as the `web` service in [`compose.yaml`](../../compose.yaml) on port 3000 and proxies `/api/*` to the FastAPI service.

Setup, pages, API and troubleshooting are documented in [`dashboard/README.md`](../README.md); the project overview and credits are in the [root README](../../README.md).

```bash
npm install
API_URL=http://localhost:8000 npm run dev   # against a running api container
npx tsc --noEmit && npx eslint .
```
