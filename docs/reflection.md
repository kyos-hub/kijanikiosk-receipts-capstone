# Capstone Reflection

**Project**: KijaniKiosk Capstone — Track B (Serverless-First)
**Author**: Abel Kigen

## What did you get wrong?

The clearest mistake was in fixing the S3 trigger-overlap bug the first time. Both
`kk-logs` and `kk-analytics` were originally wired to trigger off the same S3
bucket with the same event type (`s3:ObjectCreated:*`). When a real
`serverless deploy --stage staging` rejected this with `Configurations overlap`,
my first fix was to move `kk-logs`'s trigger to a different bucket —
`kk-processor-output` instead of `kk-notifier-output`. That looked like a fix
because the error message changed banks, but it was the same underlying
mistake in a new location: `kk-notifier` was already the sole subscriber on
that exact bucket and event type, so I had just relocated the identical
conflict instead of resolving it. A second real deploy failure, with the exact
same error text pointing at a different bucket, is what actually exposed this.

The better approach — which is what I ended up shipping — was to stop treating
"which bucket" as the variable to change and instead question whether a second
S3 trigger was the right mechanism at all. Replacing `kk-logs`'s S3 trigger
with an AWS Lambda `onSuccess` Destination attached to `kk-processor` sidesteps
the constraint entirely rather than working around it. I should have reached
for that after the *first* failure, not the second — the error message
("configurations... cannot share a common event type") was specific enough to
point at the mechanism, not just the location, the first time.

## What was the most important thing you learned?

The most important shift in thinking happened while debugging the AWS
deployment itself, not while writing any of the function code. Every design
decision I made on paper — the S3 trigger topology, the `serverless-offline`
plugin choice, even the bucket naming — looked completely reasonable until it
hit a real AWS account. S3's global bucket-name uniqueness, the
trigger-overlap constraint, and `serverless-offline`'s HTTP-only emulation
model are all things I could have looked up in advance, but I only actually
internalized them once a real `serverless deploy` failed and gave me the exact
error text. That connects back to a pattern I'd already half-learned during
the Week 5 Jenkins/Nexus work, where a live 403 from a real Nexus instance
taught me more in five minutes than reading the EULA requirement ever would
have. This capstone made that pattern explicit for me: for infrastructure
work, "verify against the real service early" isn't just good practice, it's
often the *only* way the actual constraint becomes visible at all. A local
mock or a written spec will happily let you build something that a real
cloud provider rejects on contact.

## What would you do differently on a second pass?

Three concrete things, not general improvements:

1. **Test the S3 trigger topology against a throwaway AWS deploy before
   writing any function code.** A five-minute `serverless deploy` with dummy
   handlers would have caught the bucket-overlap conflict before I'd written
   real logic for `kk-logs`, saving the two-step correction documented in the
   governance log.
2. **Drop `serverless-offline` from the dependency tree entirely** instead of
   spending three version-pin attempts (13.x, 12.0.4, 11.6.0) trying to make
   it install cleanly. It emulates API Gateway/HTTP triggers, not S3 object
   events, so it was never going to validate this service's actual trigger
   path — `tests/local-chain-test.js` already does that correctly. I'd remove
   the plugin and the `offline` npm script, and say so plainly in the README
   instead of leaving a version pin that looks like unfinished business.
3. **Set up the Jenkins AWS credentials with typed (not pasted) IDs from the
   start.** The credential-ID whitespace bug cost real debugging time and
   required building an isolated throwaway test pipeline just to prove the
   credential store itself was the problem, not the Jenkinsfile. I'd write
   IDs manually into Jenkins credential fields as a default habit going
   forward, not just as a fix after something breaks.
