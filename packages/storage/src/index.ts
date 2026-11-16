import {
  CreateBucketCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  GetObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { ImageMime } from '@omb/shared'

/** S3-compatible object storage (RustFS on the VPS). Private bucket; access only via presigned URLs. */
const bucket = process.env.S3_BUCKET ?? 'omb'

function client(endpoint: string | undefined) {
  return new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
    // Plain presigned PUTs; not every S3-compatible server understands the SDK's default checksums.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
}

/** Server-side calls use the internal endpoint (e.g. http://s3:9000 inside Docker). */
export const s3 = client(process.env.S3_ENDPOINT)
/**
 * Presigned URLs are opened by browsers, so they are signed for the public endpoint
 * (e.g. https://files.example.com). Same as S3_ENDPOINT in development.
 */
const s3Public = process.env.S3_PUBLIC_ENDPOINT ? client(process.env.S3_PUBLIC_ENDPOINT) : s3

const EXTENSIONS: Record<ImageMime, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** Keys are derived, never taken from clients: {userId}/{itemId}/{attachmentId}.{ext} */
export function storageKey(userId: string, itemId: string, attachmentId: string, mime: string) {
  const ext = EXTENSIONS[mime as ImageMime] ?? 'bin'
  return `${userId}/${itemId}/${attachmentId}.${ext}`
}

export function presignPut(key: string, mime: string, sizeBytes: number) {
  return getSignedUrl(
    s3Public,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mime, ContentLength: sizeBytes }),
    { expiresIn: 15 * 60 },
  )
}

export function presignGet(key: string) {
  return getSignedUrl(s3Public, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: 60 * 60,
  })
}

/** Downloads an object (server side only, e.g. images for the AI). */
export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!res.Body) throw new Error(`Empty object: ${key}`)
  return res.Body.transformToByteArray()
}

/** Size and type of an uploaded object, or null if it isn't there. */
export async function headObject(key: string) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return { sizeBytes: head.ContentLength ?? 0, mime: head.ContentType ?? '' }
  } catch {
    return null
  }
}

/** Creates the bucket if needed and lets the web app upload to it from the browser. */
export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }))
  }
  const origin = new URL(process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').origin
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            // The web app, and the browser extension (its uploads also use presigned URLs).
            AllowedOrigins: [origin, 'chrome-extension://*'],
            AllowedMethods: ['PUT', 'GET'],
            AllowedHeaders: ['content-type'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  )
}
