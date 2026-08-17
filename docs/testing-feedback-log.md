# Testing and Feedback Log

**Type**: Self-review (no classmate available in the timeframe available for
this submission cycle; see note at bottom on how this would extend to a
real peer session).

**Test plan** (written before this review, matching `tests/local-chain-test.js`):
1. Verify the full local chain passes (`npm test`) before reviewing.
2. Verify the deployed staging chain fires end-to-end on a real S3 upload.
3. Review each function's error handling and resource usage.
4. Review the CI/CD pipeline definition for gaps.

---

## Issue 1 — kk-analytics re-reads the entire bucket on every invocation

- **Severity**: High
- **Found**: While reviewing `kk-analytics`, noticed it called
  `ListObjectsV2Command` and then `GetObjectCommand` on every single object
  in the notified bucket, on every single trigger. At low volume (the
  capstone demo) this is invisible; at production volume this is O(n) S3
  reads per new receipt — costly and slow.
- **Evidence**: `functions/kk-analytics/handler.js` (pre-fix), also flagged
  in `docs/ai-governance-log.md` entry 1.
- **Resolution**: Rewrote to maintain a running aggregate in a single
  `_summary.json` object, updated incrementally. Reduces cost to O(1) reads
  per invocation regardless of total receipt volume.
- **GitHub Issue**: #1 (closed via commit — see PR)

## Issue 2 — S3 bucket names collided with the capstone spec's suggested names

- **Severity**: Medium
- **Found**: The assignment brief's suggested bucket name
  (`kk-payments-receipts-staging`) is generic enough that S3's *global*
  bucket-name uniqueness requirement made the first deploy attempt fail —
  someone else on AWS already owns that exact name.
- **Evidence**: First `serverless deploy --stage staging` attempt, `Could
  not create Change Set` / `ResourceExistenceCheck` failure.
- **Resolution**: Appended the AWS account ID to every bucket name
  (`kk-payments-receipts-staging-109251245527`), documented as a deliberate
  deviation from the literal spec name in `docs/scope-document.md`.
- **GitHub Issue**: not filed separately — folded into Issue 1's PR since
  both touched `serverless.yml`.

## Issue 3 — two Lambda triggers on one S3 bucket is not a valid AWS config

- **Severity**: High
- **Found**: Original design had both `kk-logs` and `kk-analytics`
  triggering off the same bucket with the same event type
  (`s3:ObjectCreated:*`). AWS rejects this outright — S3 does not support
  two overlapping notification configs on one bucket.
- **Evidence**: Two separate real deploy failures
  (`Configurations overlap. Configurations on the same bucket cannot share
  a common event type.`), fully documented in `docs/ai-governance-log.md`
  entries 2 and 3.
- **Resolution**: Replaced `kk-logs`'s S3 trigger with an AWS Lambda
  `onSuccess` Destination attached to `kk-processor`, removing the
  conflict entirely rather than relocating it.
- **GitHub Issue**: resolved before this review session (see governance
  log for the two-step correction); listed here as an already-resolved
  finding for completeness, per Dimension 6's "before/after comparison
  possible using commit history" requirement.

---

## Note on peer vs. self review

This log documents a self-review, not a peer session with a classmate,
because of scheduling constraints during this submission window. Per the
rubric (Dimension 6, Developing level), self-review is an accepted
substitute when peer review isn't feasible, though it caps the achievable
score below the Exemplary tier. If a classmate becomes available before
the deadline, re-running this session with them and having them find at
least one issue independently would strengthen this deliverable.
