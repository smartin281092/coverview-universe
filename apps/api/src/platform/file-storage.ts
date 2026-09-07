import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  GetBucketPolicyCommand,
  GetBucketVersioningCommand,
  GetBucketAclCommand,
} from "@aws-sdk/client-s3";

export interface FileStorage {
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  close(): void;
}
export function createS3Storage(config: {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  encryptionKey: Buffer;
  DOCUMENT_BUCKET: string;
  local: boolean;
}): FileStorage {
  const client = new S3Client({
    region: "us-east-1",
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    maxAttempts: 1,
    // MinIO closes conditional-PUT connections; do not reuse that socket for integrity reads.
    requestHandler: {
      httpAgent: new HttpAgent({ keepAlive: false }),
      httpsAgent: new HttpsAgent({ keepAlive: false }),
      connectionTimeout: 5000,
      requestTimeout: 15000,
    },
  });
  const Bucket = config.DOCUMENT_BUCKET;
  let initialized: Promise<void> | undefined;
  async function ensureBucket() {
    try {
      await client.send(new HeadBucketCommand({ Bucket }), {
        abortSignal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      if (
        !config.local ||
        !(error instanceof Error) ||
        !["NotFound", "NoSuchBucket"].includes(error.name)
      )
        throw error;
      try {
        await client.send(new CreateBucketCommand({ Bucket }), {
          abortSignal: AbortSignal.timeout(5000),
        });
      } catch (cause) {
        if (!(cause instanceof Error) || cause.name !== "BucketAlreadyOwnedByYou") throw cause;
      }
    }
    try {
      const policy = await client.send(new GetBucketPolicyCommand({ Bucket }), {
        abortSignal: AbortSignal.timeout(5000),
      });
      // This private application bucket needs no bucket policy; IAM credentials scope its access.
      if (policy.Policy)
        throw new Error("Document bucket must have no public or cross-account policy");
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "NoSuchBucketPolicy") throw error;
    }
    const versioning = await client.send(new GetBucketVersioningCommand({ Bucket }), {
      abortSignal: AbortSignal.timeout(5000),
    });
    if (versioning.Status)
      throw new Error(
        "Document bucket versioning requires version-aware deletion; use a dedicated unversioned bucket",
      );
    const acl = await client.send(new GetBucketAclCommand({ Bucket }), {
      abortSignal: AbortSignal.timeout(5000),
    });
    // MinIO's private-only ACL compatibility response has empty owner and grantee IDs.
    const localMinioAcl =
      config.local &&
      ["localhost", "127.0.0.1", "[::1]"].includes(new URL(config.endpoint).hostname) &&
      acl.Owner?.ID === "" &&
      acl.Grants?.length === 1 &&
      acl.Grants[0]?.Permission === "FULL_CONTROL" &&
      acl.Grants[0].Grantee?.Type === "CanonicalUser" &&
      !acl.Grants[0].Grantee.ID;
    if (
      !localMinioAcl &&
      (!acl.Owner?.ID ||
        acl.Grants?.some(
          (grant) => grant.Grantee?.Type !== "CanonicalUser" || grant.Grantee.ID !== acl.Owner?.ID,
        ))
    )
      throw new Error("Document bucket ACL must grant access to its owner only");
  }
  async function ready() {
    initialized ??= ensureBucket();
    try {
      await initialized;
    } catch (error) {
      initialized = undefined;
      throw error;
    }
  }
  function encrypt(key: string, bytes: Buffer) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", config.encryptionKey, nonce);
    cipher.setAAD(Buffer.from(key));
    const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return Buffer.concat([Buffer.from("CVD1"), nonce, cipher.getAuthTag(), encrypted]);
  }
  return {
    async put(key, bytes) {
      await ready();
      const Body = encrypt(key, bytes);
      try {
        await client.send(
          new PutObjectCommand({
            Bucket,
            Key: key,
            Body,
            ContentType: "application/octet-stream",
            ContentLength: Body.length,
            IfNoneMatch: "*",
            ChecksumSHA256: createHash("sha256").update(Body).digest("base64"),
          }),
          { abortSignal: AbortSignal.timeout(15000) },
        );
      } catch (error) {
        // A conditional PUT may commit or reject before the connection is lost.
        // Resolve that uncertain outcome by checking the immutable original.
        let existing: Buffer;
        try {
          existing = await this.get(key);
        } catch (cause) {
          throw new Error("Unable to verify original after interrupted upload", { cause });
        }
        if (
          !createHash("sha256")
            .update(existing)
            .digest()
            .equals(createHash("sha256").update(bytes).digest())
        )
          throw new Error("Immutable document differs", { cause: error });
      }
    },
    async get(key) {
      await ready();
      const response = await client.send(new GetObjectCommand({ Bucket, Key: key }), {
        abortSignal: AbortSignal.timeout(15000),
      });
      if (!response.Body || !response.ContentLength || response.ContentLength > 20971552)
        throw new Error("Invalid object length");
      const bytes = Buffer.from(await response.Body.transformToByteArray());
      if (bytes.length !== response.ContentLength || bytes.subarray(0, 4).toString() !== "CVD1")
        throw new Error("Invalid encrypted object");
      const decipher = createDecipheriv("aes-256-gcm", config.encryptionKey, bytes.subarray(4, 16));
      decipher.setAAD(Buffer.from(key));
      decipher.setAuthTag(bytes.subarray(16, 32));
      return Buffer.concat([decipher.update(bytes.subarray(32)), decipher.final()]);
    },
    async remove(key) {
      await ready();
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }), {
        abortSignal: AbortSignal.timeout(15000),
      });
    },
    close() {
      client.destroy();
    },
  };
}
