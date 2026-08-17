const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({});

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

exports.main = async (event) => {
  const results = [];
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const processed = JSON.parse(await streamToString(obj.Body));

    // Simulated notification (e.g. would call SES/SNS in production)
    const notification = {
      receiptId: processed.receiptId,
      amount: processed.amount,
      currency: processed.currency,
      notifiedAt: new Date().toISOString(),
      channel: 'email-simulated',
      status: 'notified',
    };

    const outKey = `notified-${processed.receiptId}.json`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.NOTIFIED_BUCKET,
      Key: outKey,
      Body: JSON.stringify(notification),
      ContentType: 'application/json',
    }));

    console.log(JSON.stringify({ level: 'info', fn: 'kk-notifier', receiptId: notification.receiptId, outKey }));
    results.push(outKey);
  }
  return { notified: results };
};
