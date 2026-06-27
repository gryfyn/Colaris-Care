import crypto from 'crypto';

// Cloudflare R2 (S3-compatible) presigned URLs via AWS SigV4 query auth.
// Implemented with Node crypto so we avoid pulling the full AWS SDK into the
// serverless bundle. Files are PRIVATE in the bucket — access is only ever
// granted through short-lived presigned URLs minted server-side.

function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    accountId, bucket, accessKeyId, secretAccessKey,
    host: `${accountId}.r2.cloudflarestorage.com`,
    region: 'auto', service: 's3',
  };
}

export function r2Configured() {
  return Boolean(r2Config());
}

// RFC3986 percent-encoding per AWS rules (unreserved: A-Za-z0-9-_.~).
function awsEncode(str, encodeSlash = true) {
  let out = encodeURIComponent(String(str)).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  if (!encodeSlash) out = out.replace(/%2F/g, '/');
  return out;
}

function presign(method, key, expiresSec = 300) {
  const cfg = r2Config();
  if (!cfg) throw new Error('R2 storage is not configured');

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${cfg.region}/${cfg.service}/aws4_request`;
  const canonicalUri = `/${awsEncode(cfg.bucket, false)}/${awsEncode(key, false)}`;

  const query = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${cfg.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSec),
    'X-Amz-SignedHeaders': 'host',
  };
  const canonicalQuery = Object.keys(query).sort().map((k) => `${awsEncode(k)}=${awsEncode(query[k])}`).join('&');
  const canonicalRequest = [method, canonicalUri, canonicalQuery, `host:${cfg.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');

  const sha256hex = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256hex(canonicalRequest)].join('\n');

  const hmac = (k, d) => crypto.createHmac('sha256', k).update(d, 'utf8').digest();
  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, cfg.region);
  const kService = hmac(kRegion, cfg.service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return `https://${cfg.host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

// Presigned PUT for a direct browser upload. Sign only `host` so the client may
// set Content-Type freely (R2 accepts it unsigned).
export function presignPut(key, expiresSec = 600) {
  return presign('PUT', key, expiresSec);
}

// Presigned GET so an authorized viewer can fetch a private object briefly.
export function presignGet(key, expiresSec = 300) {
  return presign('GET', key, expiresSec);
}

// Build a tenant-scoped object key. `scope` is e.g. 'residents' | 'staff'.
export function buildObjectKey(organizationId, scope, filename) {
  const safe = String(filename || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
  return `colaris/${organizationId}/${scope}/${crypto.randomUUID()}-${safe}`;
}
