#!/usr/bin/env node
/**
 * Usage:
 *   node scripts/verify-cli.mjs signed.json
 *
 * Verifies a signed CertifiedData decision record end-to-end:
 *   1. Re-canonicalizes the payload using RFC 8785 (JCS)
 *   2. Re-hashes with SHA-256 and compares to record_hash
 *   3. Fetches the public key registry from /.well-known/signing-keys.json
 *   4. Verifies the Ed25519 signature
 *
 * Exit code 0 on success, 1 on any verification failure.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import canonicalize from "canonicalize";

const REGISTRY_URL =
  process.env.CERTIFIEDDATA_REGISTRY_URL ??
  "https://certifieddata.io/.well-known/signing-keys.json";

const [, , path] = process.argv;
if (!path) {
  console.error("usage: verify-cli.mjs <signed.json>");
  process.exit(2);
}

const record = JSON.parse(fs.readFileSync(path, "utf8"));

if (record.signature_alg !== "Ed25519") {
  console.error(`❌ Unsupported signature_alg: ${record.signature_alg}`);
  process.exit(1);
}

// 1. Re-canonicalize the embedded payload
let payloadObject;
try {
  payloadObject = JSON.parse(record.canonical_payload);
} catch {
  console.error("❌ canonical_payload is not valid JSON");
  process.exit(1);
}
const canonical = canonicalize(payloadObject);
const canonicalBytes = Buffer.from(canonical, "utf8");

// 2. Hash
const hash = crypto.createHash("sha256").update(canonicalBytes).digest("hex");
if (hash !== record.record_hash) {
  console.error("❌ record_hash does not match canonical payload");
  console.error(`   expected: ${record.record_hash}`);
  console.error(`   computed: ${hash}`);
  process.exit(1);
}

// 3. Fetch key registry
const registryRes = await fetch(REGISTRY_URL);
if (!registryRes.ok) {
  console.error(`❌ Could not fetch key registry: ${registryRes.status}`);
  process.exit(1);
}
const registry = await registryRes.json();
const key =
  registry.active_keys?.find((k) => k.key_id === record.key_id) ??
  registry.retired_keys?.find((k) => k.key_id === record.key_id);
if (!key) {
  console.error(`❌ Unknown key_id: ${record.key_id}`);
  process.exit(1);
}

// 4. Verify signature
const publicKey = crypto.createPublicKey(key.public_key_pem);
const signatureBytes = Buffer.from(record.signature, "base64");
const valid = crypto.verify(null, canonicalBytes, publicKey, signatureBytes);

if (!valid) {
  console.error("❌ Signature does not verify against canonical payload");
  process.exit(1);
}

console.log(`✅ Signature verified (key_id: ${key.key_id})`);
console.log(`   alg:  ${record.signature_alg}`);
console.log(`   hash: ${record.record_hash}`);
if (record.decision_id) console.log(`   id:   ${record.decision_id}`);
