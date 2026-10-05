#!/usr/bin/env bash
# End-to-end check of the packed node in a real n8n (Docker). Run on the test box from the repo root:
#   bash dev/n8n-docker/run-e2e.sh up|install|import|exec|down
# The JOA key is read from JOA_API_KEY in the environment and only ever passed to "docker exec -e";
# the temporary credential file lives in the container's /tmp and is deleted right after import.
set -euo pipefail
cd "$(dirname "$0")"
C=joan8n-n8n
TGZ=../../n8n-nodes-job-opportunities-api-0.1.0.tgz

case "${1:-}" in
  install)
    rm -rf nodes && mkdir -p nodes/node_modules/n8n-nodes-job-opportunities-api
    tar -xzf "$TGZ" -C nodes/node_modules/n8n-nodes-job-opportunities-api --strip-components=1
    printf '{"name":"installed-nodes","private":true,"dependencies":{"n8n-nodes-job-opportunities-api":"0.1.0"}}\n' > nodes/package.json
    ;;
  up) docker compose up -d ;;
  import)
    : "${JOA_API_KEY:?JOA_API_KEY must be set}"
    docker exec -e JOA_API_KEY "$C" sh -c '
      umask 077
      node -e "const fs=require(\"fs\");fs.writeFileSync(\"/tmp/joa-cred.json\",JSON.stringify([{id:\"JoaE2eCred000001\",name:\"JOA e2e\",type:\"jobOpportunitiesApi\",data:{apiKey:process.env.JOA_API_KEY,baseUrl:\"https://api.jobopportunitiesapi.org\"}}]))"
      n8n import:credentials --input=/tmp/joa-cred.json; rc=$?; rm -f /tmp/joa-cred.json; exit $rc'
    docker exec "$C" n8n import:workflow --separate --input=/opt/joa/workflows
    ;;
  exec)
    # the running server already owns the task broker port, so the CLI run gets its own
    docker exec -e N8N_RUNNERS_BROKER_PORT=5690 "$C" n8n execute --id "${2:?workflow id}" --rawOutput
    ;;
  down) docker compose down ;;
  *) echo "usage: $0 install|up|import|exec <id>|down"; exit 2 ;;
esac
