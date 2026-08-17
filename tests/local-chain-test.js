// Test plan (written before the peer review session):
// 1. A raw receipt object triggers kk-processor -> writes a processed object.
// 2. The processed object triggers kk-notifier -> writes a notified object.
// 3. kk-processor also fans out to kk-logs via an AWS Lambda "onSuccess"
//    Destination (not a second S3 trigger) -- logs a chain checkpoint.
//    (This replaced an earlier S3-trigger design; see
//    docs/ai-governance-log.md, entries 2 and 3, for why.)
// 4. The notified object triggers kk-analytics -> logs a rolling aggregate
//    (count, totalAmount, timestamp range) across all notified receipts so far.
//
// This harness stubs the S3 SDK client in-memory so the full chain can be
// exercised with `npm test`, without any AWS credentials, before a real
// `serverless deploy --stage staging`.

const assert = require('assert');

const store = {}; // bucket -> { key: body }

function fakeS3() {
  return {
    send: async (cmd) => {
      const name = cmd.constructor.name;
      if (name === 'PutObjectCommand') {
        const { Bucket, Key, Body } = cmd.input;
        store[Bucket] = store[Bucket] || {};
        store[Bucket][Key] = Body;
        return {};
      }
      if (name === 'GetObjectCommand') {
        const { Bucket, Key } = cmd.input;
        const body = store[Bucket][Key];
        return { Body: (async function* () { yield Buffer.from(body); })() };
      }
      if (name === 'ListObjectsV2Command') {
        const { Bucket, Prefix } = cmd.input;
        const keys = Object.keys(store[Bucket] || {}).filter((k) => k.startsWith(Prefix || ''));
        return { Contents: keys.map((Key) => ({ Key })) };
      }
      throw new Error(`Unhandled command in test stub: ${name}`);
    },
  };
}

// Monkey-patch @aws-sdk/client-s3 before requiring handlers
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === '@aws-sdk/client-s3') {
    return {
      S3Client: function () { return fakeS3(); },
      GetObjectCommand: function (input) { this.input = input; },
      PutObjectCommand: function (input) { this.input = input; },
      ListObjectsV2Command: function (input) { this.input = input; },
    };
  }
  return originalRequire.apply(this, arguments);
};

process.env.PROCESSED_BUCKET = 'kk-processor-output-test';
process.env.NOTIFIED_BUCKET = 'kk-notifier-output-test';

const processor = require('../functions/kk-processor/handler');
const notifier = require('../functions/kk-notifier/handler');
const logs = require('../functions/kk-logs/handler');
const analytics = require('../functions/kk-analytics/handler');

async function run() {
  store['kk-payments-receipts-test'] = {
    'raw-001.json': JSON.stringify({ receiptId: '001', amount: 500, currency: 'KES', customer: 'Abel' }),
  };

  await processor.main({ Records: [{ s3: { bucket: { name: 'kk-payments-receipts-test' }, object: { key: 'raw-001.json' } } }] });
  assert.ok(store['kk-processor-output-test']['processed-001.json'], 'kk-processor should write a processed object');

  await notifier.main({ Records: [{ s3: { bucket: { name: 'kk-processor-output-test' }, object: { key: 'processed-001.json' } } }] });
  assert.ok(store['kk-notifier-output-test']['notified-001.json'], 'kk-notifier should write a notified object');

  await logs.main({ responsePayload: { processed: ['processed-001.json'] } });

  const summary = await analytics.main({ Records: [{ s3: { bucket: { name: 'kk-notifier-output-test' }, object: { key: 'notified-001.json' } } }] });
  assert.strictEqual(summary.count, 1, 'kk-analytics should count 1 receipt');
  assert.strictEqual(summary.totalAmount, 500, 'kk-analytics should sum amount to 500');

  console.log('PASS: full receipt chain (kk-processor -> kk-notifier -> kk-logs / kk-analytics) verified locally.');
}

run().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
