const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({});
const SUMMARY_KEY = '_summary.json';

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

// Fixes GitHub Issue #1: the original version re-listed and re-read EVERY
// object in the bucket on every single trigger (O(n) S3 reads per new
// receipt). This version keeps a running aggregate in one small
// `_summary.json` object and updates it incrementally -- O(1) reads per
// invocation regardless of how many receipts have accumulated.
async function loadSummary(bucket) {
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: SUMMARY_KEY }));
    return JSON.parse(await streamToString(obj.Body));
  } catch (err) {
    // No summary yet (first-ever receipt) -- start fresh.
    return { count: 0, totalAmount: 0, earliest: null, latest: null };
  }
}

exports.main = async (event) => {
  const bucket = process.env.NOTIFIED_BUCKET;
  const summary = await loadSummary(bucket);

  for (const record of event.Records || []) {
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    if (key === SUMMARY_KEY) continue; // don't re-aggregate our own summary object

    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const notification = JSON.parse(await streamToString(obj.Body));

    summary.count += 1;
    summary.totalAmount += Number(notification.amount) || 0;

    const ts = notification.notifiedAt;
    if (ts && (!summary.earliest || ts < summary.earliest)) summary.earliest = ts;
    if (ts && (!summary.latest || ts > summary.latest)) summary.latest = ts;
  }

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: SUMMARY_KEY,
    Body: JSON.stringify(summary),
    ContentType: 'application/json',
  }));

  const result = {
    fn: 'kk-analytics',
    event: 'receipts.aggregate.summary',
    count: summary.count,
    totalAmount: summary.totalAmount,
    timestampRange: { earliest: summary.earliest, latest: summary.latest },
    computedAt: new Date().toISOString(),
    triggerRecordCount: event.Records ? event.Records.length : 0,
  };

  console.log(JSON.stringify(result));
  return result;
};
