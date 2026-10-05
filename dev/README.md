# Development notes

These files are for maintainers; they are not part of the npm package.

- `scan-local.mjs`: runs the analyser of `@n8n/scan-community-package` against a local source tree and an extracted `npm pack` tarball, before the package exists on npm. The published-package scan (`npx @n8n/scan-community-package n8n-nodes-job-opportunities-api`) additionally checks npm provenance and must be run after the first GitHub Actions release.
- `n8n-docker/`: a throwaway n8n (`docker compose`, project name `joan8n`, bound to 127.0.0.1:5679) for end-to-end checks of the packed tarball.
  - `run-e2e.sh install|up|import|exec <workflowId>|down`: extract the tarball as an installed community package, start n8n, import the credential (API key taken from the `JOA_API_KEY` environment variable) and the test workflows, run a workflow with `n8n execute`.
  - `manual-run.mjs`: run a workflow in the editor's manual mode through the REST API (used to check the trigger's Fetch Test Event behaviour).
  - `credential-test.mjs`: run the credential test (GET /v1/me) through the REST API.
  - `screenshots.mjs`: README screenshots with headless Chromium (Playwright).
  - `summarize.sh`: print item counts and ids from `n8n execute --rawOutput`.
