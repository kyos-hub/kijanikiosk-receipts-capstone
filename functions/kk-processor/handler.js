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
    const raw = JSON.parse(await streamToString(obj.Body));

    const processed = {
      receiptId: raw.receiptId || key,
      amount: raw.amount,
      currency: raw.currency || 'KES',
      customer: raw.customer || 'unknown',
      status: 'processed',
      processedAt: new Date().toISOString(),
      sourceKey: key,
    };

    const outKey = `processed-${processed.receiptId}.json`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.PROCESSED_BUCKET,
      Key: outKey,
      Body: JSON.stringify(processed),
      ContentType: 'application/json',
    }));

    console.log(JSON.stringify({ level: 'info', fn: 'kk-processor', receiptId: processed.receiptId, outKey }));
    results.push(outKey);
  }
  return { processed: results };
};
