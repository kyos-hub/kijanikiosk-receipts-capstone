// kk-logs is invoked via an AWS Lambda "onSuccess" Destination attached to
// kk-processor, not via a direct S3 trigger. This was a deliberate fix:
// S3 does not allow two separate Lambda triggers with the same event type
// on one bucket, and kk-notifier already owns the ObjectCreated:* trigger
// on the processor-output bucket. Using a Destination instead of a second
// S3 subscription avoids the conflict entirely and is a legitimate AWS
// fan-out pattern for async-invoked Lambdas (S3 invokes Lambda async).
// See docs/ai-governance-log.md, entry 3.

exports.main = async (event) => {
  // Destination payload shape: { requestPayload, responsePayload, ... }
  const outcome = event.responsePayload || {};
  const processedKeys = outcome.processed || [];

  for (const key of processedKeys) {
    console.log(JSON.stringify({
      level: 'info',
      fn: 'kk-logs',
      event: 'receipt.chain.checkpoint',
      stage: 'processed',
      outKey: key,
      loggedAt: new Date().toISOString(),
    }));
  }

  return { logged: processedKeys.length };
};
