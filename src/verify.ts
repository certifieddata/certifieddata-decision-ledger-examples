import crypto from "node:crypto";
import canonicalize from "canonicalize";

/**
 * A signed decision record as returned by POST /api/decision-log/demo
 * or stored in the public /decision-log feed.
 */
export interface SignedDecisionRecord {
  decision_id?: string;
  timestamp?: string;
  record_hash: string;
  signature: string;
  signature_alg: "Ed25519" | string;
  key_id: string;
  canonical_payload: string;
  public_key_url?: string;
  [k: string]: unknown;
}

export interface PublicKeyEntry {
  key_id: string;
  algorithm: string;
  public_key_pem: string;
  public_key_raw_b64url?: string | null;
  products?: string[];
  created_at?: string | null;
}

export interface SigningKeyRegistry {
  active_keys: PublicKeyEntry[];
  retired_keys?: PublicKeyEntry[];
}

export interface VerificationResult {
  valid: boolean;
  keyId?: string;
  reason?: string;
}

const DEFAULT_REGISTRY_URL = "https://certifieddata.io/.well-known/signing-keys.json";

let cachedRegistry: { fetchedAt: number; registry: SigningKeyRegistry } | null = null;
const REGISTRY_TTL_MS = 60 * 60 * 1000;

/**
 * Fetch the CertifiedData public signing key registry. Cached for one hour.
 * Pass `registryUrl` to verify against a self-hosted mirror or a pinned snapshot.
 */
export async function fetchSigningKeyRegistry(
  registryUrl: string = DEFAULT_REGISTRY_URL,
): Promise<SigningKeyRegistry> {
  const now = Date.now();
  if (cachedRegistry && now - cachedRegistry.fetchedAt < REGISTRY_TTL_MS) {
    return cachedRegistry.registry;
  }
  const res = await fetch(registryUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch signing key registry (${res.status}): ${registryUrl}`);
  }
  const registry = (await res.json()) as SigningKeyRegistry;
  cachedRegistry = { fetchedAt: now, registry };
  return registry;
}

/**
 * Find a key entry by ID across active and retired keys.
 */
export function findKey(registry: SigningKeyRegistry, keyId: string): PublicKeyEntry | undefined {
  return (
    registry.active_keys.find((k) => k.key_id === keyId) ??
    registry.retired_keys?.find((k) => k.key_id === keyId)
  );
}

/**
 * RFC 8785 JCS canonicalization. Produces the exact bytes the CertifiedData
 * signer hashed and signed.
 */
export function canonicalPayloadBytes(payload: unknown): Buffer {
  const s = canonicalize(payload);
  if (typeof s !== "string") {
    throw new Error("canonicalize returned a non-string value");
  }
  return Buffer.from(s, "utf8");
}

export function sha256Hex(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/**
 * Verify a signed decision record end-to-end.
 *
 * Steps:
 *  1. Re-canonicalize the record's canonical_payload (or its parsed form) using RFC 8785.
 *  2. Hash with SHA-256 and compare to record_hash.
 *  3. Look up the signing key by key_id from the registry.
 *  4. Verify the Ed25519 signature against the canonical bytes.
 */
export async function verifyDecisionRecord(
  record: SignedDecisionRecord,
  opts: { registry?: SigningKeyRegistry; registryUrl?: string } = {},
): Promise<VerificationResult> {
  if (record.signature_alg !== "Ed25519") {
    return { valid: false, reason: `Unsupported signature_alg: ${record.signature_alg}` };
  }

  let payloadObject: unknown;
  try {
    payloadObject = JSON.parse(record.canonical_payload);
  } catch {
    return { valid: false, reason: "canonical_payload is not valid JSON" };
  }

  const bytes = canonicalPayloadBytes(payloadObject);
  const hash = sha256Hex(bytes);
  if (hash !== record.record_hash) {
    return { valid: false, reason: "record_hash does not match canonical payload" };
  }

  const registry = opts.registry ?? (await fetchSigningKeyRegistry(opts.registryUrl));
  const key = findKey(registry, record.key_id);
  if (!key) {
    return { valid: false, reason: `Unknown key_id: ${record.key_id}` };
  }

  const publicKey = crypto.createPublicKey(key.public_key_pem);
  const signatureBytes = Buffer.from(record.signature, "base64");

  const valid = crypto.verify(null, bytes, publicKey, signatureBytes);
  if (!valid) return { valid: false, reason: "Signature does not match canonical payload" };

  return { valid: true, keyId: key.key_id };
}
