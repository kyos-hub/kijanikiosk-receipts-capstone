# KijaniKiosk Capstone — Project Scope Document

**Track**: B — Serverless-First

## Problem Statement
KijaniKiosk's payment receipt pipeline (Week 10) processes and notifies on
each receipt individually, but there is no aggregate view of transaction
volume or value. Operations staff cannot answer "how many receipts and how
much money moved through the system in the last hour" without manually
reading every log line. This is a specific, verifiable operational gap: no
rollup/aggregation layer exists over the receipt event stream.

## In Scope
1. `kk-analytics`, a fourth Lambda function triggered by `kk-notifier`'s
   output bucket, producing a structured count/total/timestamp-range summary.
2. Real deployment of the four-function chain to AWS via Serverless
   Framework, `--stage staging`.
3. Local verification of the full chain via `serverless-offline` and a
   scripted test harness before any cloud deploy.
4. Governance review of the deployed staging stack against the six-point
   Thursday checklist, with documented findings.
5. A Jenkins pipeline stage that deploys the serverless stack to staging as
   part of CI, gated by manual approval before any production deploy stage.

## Out of Scope
- **A staging Kubernetes namespace for kk-payments** — Track A territory;
  this track demonstrates the serverless layer, not parallel K8s
  environments.
- **Production serverless deploy** — the capstone timeline only requires a
  staging deploy to be demonstrated live; a production stage is defined in
  the pipeline but not executed as part of this submission, to keep cloud
  cost and blast radius controlled during a course project.

## Success Criteria (each demonstrable live)
1. `npm test` passes locally, proving the chain logic end-to-end without AWS.
2. `serverless deploy --stage staging` completes and `serverless info` shows
   all four functions deployed.
3. Uploading a raw receipt JSON to the staging raw bucket results in
   objects appearing in the processed, notified, and (via kk-logs /
   kk-analytics) log output within the demo window.
4. The governance log contains at least two real, non-trivial findings
   with named remediations.
5. Jenkins pipeline run shows a staging deploy stage executing automatically,
   with the production stage gated behind a visible manual approval.

## Architecture
See `docs/architecture.png` (exported from the diagram below).

```
kk-payments (K8s, existing)
      │ writes raw receipt JSON
      ▼
[S3: kk-payments-receipts-{stage}-{accountId}]
      │ ObjectCreated event
      ▼
  kk-processor (Lambda) ──writes──▶ [S3: kk-processor-output-{stage}-{accountId}]
                                          │
                              ObjectCreated event (single subscriber)
                                          ▼
                                    kk-logs (Lambda)
                                    structured chain-checkpoint log
                                          
  kk-processor also triggers kk-notifier via the SAME processor-output
  bucket in the original design; see note below on why kk-logs was moved
  off the notifier-output bucket.

  kk-notifier (Lambda) ──writes──▶ [S3: kk-notifier-output-{stage}-{accountId}]
                                          │
                              ObjectCreated event (single subscriber)
                                          ▼
                                    kk-analytics (Lambda, NEW)
                                    rolling aggregate summary
```

**Design note**: the original plan had both `kk-logs` and `kk-analytics`
triggering off the notifier-output bucket. A real `serverless deploy`
against AWS rejected this — S3 does not allow two Lambda triggers with the
same event type on one bucket. `kk-logs` was moved to trigger off the
processor-output bucket instead, so each bucket has exactly one subscriber.
Full detail in `docs/ai-governance-log.md`, entry 2.
