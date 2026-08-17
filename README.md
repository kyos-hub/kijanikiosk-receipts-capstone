# KijaniKiosk Capstone — Serverless Receipt Chain (Track B)

## 1. Overview
Extends the Week 10 KijaniKiosk serverless receipt chain with a fourth
function, `kk-analytics`, and deploys the full four-function stack to AWS.
See `docs/scope-document.md` for the full problem statement and success
criteria.

## 2. Architecture
```
kk-payments (K8s) → S3 raw → kk-processor → S3 processed → kk-notifier
    → S3 notified → { kk-logs, kk-analytics }
```
Full diagram in `docs/scope-document.md`.

## 3. Prerequisites
- Node.js 18+
- AWS account with credentials configured (`aws configure`)
- `npm install -g serverless` (or use `npx`, already wired into scripts)

## 4. Setup
```bash
git clone <this-repo-url>
cd kijanikiosk-capstone
npm install
```

## 5. Running Locally
```bash
npm test        # runs the full chain against a stubbed S3 client
npm run offline # runs serverless-offline for local Lambda emulation
```

## 6. Deploying
```bash
npm run deploy:staging   # serverless deploy --stage staging
npm run info:staging     # confirm all 4 functions + buckets deployed
```
Production deploy only runs after the Jenkins approval gate (see
`Jenkinsfile`) — do not deploy `--stage prod` manually outside the pipeline.

## 7. Project Structure
```
functions/         one directory per Lambda (kk-processor, kk-notifier,
                    kk-logs, kk-analytics)
docs/               scope document, architecture, governance log
tests/              local chain test harness (test plan is documented
                    inline at the top of the file)
Jenkinsfile         CI/CD pipeline: install → test → deploy staging →
                    approval gate → deploy prod
serverless.yml      infra-as-code for all 4 functions and their S3 buckets
```

## Governance
All AI-assisted work on this repository is logged in
`docs/ai-governance-log.md` per the Week 10 eight-field format, including
open findings not yet remediated. See that file for details before assuming
any component is production-ready as-is.

## Known Gaps (see Reflection for full discussion)
- `kk-analytics` re-aggregates by re-listing the entire bucket on every
  invocation — not scalable past a small receipt volume (see governance log
  entry 1).
- Production serverless deploy is defined but intentionally not exercised in
  this submission (see scope document, Out of Scope).
