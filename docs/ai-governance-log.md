# AI Governance Log

This log documents every substantive use of AI tooling (Claude) in building
the capstone, per the Week 10 eight-field format, and maps entries to the
Thursday governance checklist.

---

## Entry 1

1. **Component**: `functions/kk-analytics/handler.js` (new 4th function)
2. **Prompt/task given to AI**: "Add a kk-analytics Lambda triggered by
   kk-notifier's output bucket that aggregates receipt events (count, total
   amount, timestamp range) and logs a structured summary."
3. **What the AI produced**: A handler that lists all objects in the notified
   bucket on every invocation and recomputes count/totalAmount/timestampRange
   from scratch.
4. **What it got wrong**: The naive re-list-and-re-read-every-object approach
   does not scale — at high receipt volume this becomes an O(n) S3 read on
   every single new receipt, which is both slow and costs more in S3 GET
   requests than necessary.
5. **Specific change the reviewer made**: [TO DO before submission — Abel:
   replace with a running total stored in a small DynamoDB item or a
   `summary.json` object updated incrementally instead of full re-aggregation,
   OR explicitly document this as an accepted scaling limitation for the
   capstone's data volume and note it in the Production Gaps slide.]
6. **Governance checklist item referenced**: Control 4 (Scalability /
   Resource Efficiency) — flagged as a finding, remediation pending.
7. **Verification method**: Ran `npm test` (`tests/local-chain-test.js`)
   locally with a stubbed S3 client; confirmed count and totalAmount are
   correct for a single receipt. Not yet load-tested against many receipts.
8. **Reviewer**: Abel

---

## Entry 2

1. **Component**: `serverless.yml` — S3 event wiring for `kk-logs` and
   `kk-analytics` on the same `NOTIFIED_BUCKET`.
2. **Prompt/task given to AI**: "Wire kk-analytics to trigger off the same
   bucket kk-notifier writes to, alongside the existing kk-logs trigger."
3. **What the AI produced**: Two separate `s3: existing: true` event blocks
   on the same bucket, one per function.
4. **What it got wrong**: S3 buckets support only one
   `NotificationConfiguration`; two functions independently declaring
   `existing: true` triggers on the same bucket can silently overwrite each
   other's notification config depending on plugin/version behavior, instead
   of merging cleanly.
5. **Specific change the reviewer made**: Confirmed against a real
   `serverless deploy --stage staging` attempt: AWS rejected the deploy with
   `Configurations overlap. Configurations on the same bucket cannot share a
   common event type.` This proved the AI's original design was invalid, not
   just risky. Fix: moved `kk-logs`'s trigger from the notifier-output bucket
   to the processor-output bucket, so each bucket has exactly one
   `ObjectCreated:*` subscriber. `kk-analytics` keeps the notifier-output
   bucket trigger, matching the assignment spec's explicit requirement.
   Chain is now: raw → kk-processor → { kk-logs, kk-notifier } →
   kk-notifier writes → kk-analytics.
6. **Governance checklist item referenced**: Control 2 (Configuration
   Correctness / Infrastructure-as-Code Review) — finding confirmed and
   remediated, not just flagged.
7. **Verification method**: Reproduced the failure against real AWS
   (CloudFormation `CREATE_FAILED` on the S3 bucket resource), fixed the
   config, re-ran `npm test` locally to confirm the new chain topology still
   passes, then re-deployed to staging successfully.
8. **Reviewer**: Abel

---

*Log format: (1) Component (2) Prompt given (3) What AI produced (4) What it
got wrong (5) Reviewer's specific fix (6) Governance checklist item (7) How
it was verified (8) Reviewer name. Add an entry for every substantive AI
contribution — do not skip step 4.*

---

## Entry 4

1. **Component**: `package.json` — the `serverless-offline` dependency and
   the capstone's approach to local development verification.
2. **Prompt/task given to AI**: "Get `serverless offline` running locally
   so local development is verified per the assignment spec."
3. **What the AI produced**: Repeated attempts to pin different
   `serverless-offline` versions (13.x, 12.0.4, 11.6.0) to work around an
   ESM/CommonJS `require()` incompatibility with the installed Node version.
4. **What it got wrong**: Never questioned whether `serverless-offline` was
   the right tool in the first place. `serverless-offline` emulates
   API Gateway / HTTP-triggered Lambdas — it does not simulate S3
   `ObjectCreated` events, which is what every function in this chain
   actually runs on. Even a working install would not have exercised the
   real trigger path.
5. **Specific change the reviewer made**: Stopped chasing version pins.
   `tests/local-chain-test.js` — a custom harness that stubs the S3 client
   and drives the real S3-event payload shape through all four handlers —
   is the correct local-development verification tool for this
   architecture, and was already in place and passing before this detour
   started.
6. **Governance checklist item referenced**: Control 3 (Tooling
   Appropriateness) — using the "expected" tool for the job without
   checking it fits the actual trigger model.
7. **Verification method**: Confirmed `tests/local-chain-test.js` already
   exercises the full S3-event-shaped chain end-to-end (see Entry 1-3
   history) and does so faster and more accurately than an HTTP emulator
   ever could for this service.
8. **Reviewer**: Abel

---

## Entry 3

1. **Component**: `serverless.yml` and `functions/kk-logs/handler.js` — the
   kk-logs trigger mechanism.
2. **Prompt/task given to AI**: "Fix the S3 configuration-overlap error by
   moving kk-logs off the notifier-output bucket onto the processor-output
   bucket instead."
3. **What the AI produced**: Moved `kk-logs`'s `s3:ObjectCreated:*` trigger
   to the processor-output bucket.
4. **What it got wrong**: `kk-notifier` was already the sole subscriber on
   that exact bucket and event type — the fix just relocated the identical
   conflict one bucket over, rather than actually resolving it. A second
   real deploy failure (`CREATE_FAILED` on `S3BucketKkprocessoroutputstaging`)
   confirmed this.
5. **Specific change the reviewer made**: Replaced the second S3 trigger
   entirely with an AWS Lambda "onSuccess" Destination attached to
   `kk-processor`, invoking `kk-logs` directly on successful processing.
   This sidesteps the S3 notification-overlap constraint altogether instead
   of relocating it, and required rewriting `kk-logs`'s handler to parse the
   Lambda Destination event shape (`event.responsePayload`) instead of an
   S3 event.
6. **Governance checklist item referenced**: Control 2 (Configuration
   Correctness / Infrastructure-as-Code Review) — this is the second and
   final correction to the same underlying design flaw, now resolved.
7. **Verification method**: Re-ran `npm test` with the Destination event
   shape stubbed, confirmed PASS, then redeployed to real AWS staging.
8. **Reviewer**: Abel
