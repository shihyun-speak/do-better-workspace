#!/usr/bin/env bash
# Deploy to production, point speak-ctr-hojicha.vercel.app at it, and drop the
# auto-created global-contractor-dashboard alias. Run from anywhere:
#   ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
URL=$(vercel --prod --yes 2>/dev/null | grep -Eo 'https://speak-ctr-hojicha-[a-z0-9]+-shihyunl-7107s-projects\.vercel\.app' | tail -1)
if [ -z "$URL" ]; then echo "Deploy failed or URL not found; run 'vercel --prod' to see the error." >&2; exit 1; fi
echo "Deployed: $URL"
vercel alias set "$URL" speak-ctr-hojicha.vercel.app
vercel alias rm global-contractor-dashboard.vercel.app --yes || true
echo "Live at https://speak-ctr-hojicha.vercel.app"
