const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const s3 = new S3Client({});

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

// Triggered by the same bucket kk-notifier writes to. On each new
// notified-receipt object, re-scans the bucket and logs a rolling
// aggregate: count, total amount, and timestamp range.
exports.main = async (event) => {
  const bucket = process.env.NOTIFIED_BUCKET;

  const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'notified-' }));
  const objects = listed.Contents || [];

  let count = 0;
  let totalAmount = 0;
  let earliest = null;
  let latest = null;

  for (const obj of objects) {
    const body = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: obj.Key }));
    const notification = JSON.parse(await streamToString(body.Body));

    count += 1;
    totalAmount += Number(notification.amount) || 0;

    const ts = notification.notifiedAt;
    if (ts && (!earliest || ts < earliest)) earliest = ts;
    if (ts && (!latest || ts > latest)) latest = ts;
  }

  const summary = {
    fn: 'kk-analytics',
    event: 'receipts.aggregate.summary',
    count,
    totalAmount,
    timestampRange: { earliest, latest },
    computedAt: new Date().toISOString(),
    triggerRecordCount: event.Records ? event.Records.length : 0,
  };

  console.log(JSON.stringify(summary));
  return summary;
};
