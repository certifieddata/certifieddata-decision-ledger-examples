# certifieddata-decision-ledger-examples

Public, runnable examples for the **CertifiedData Decision Ledger** — sign real AI decisions with Ed25519, verify them anywhere, and integrate the ledger into your own pipelines.

> The Decision Ledger is one of three CertifiedData pillars. Decisions, agent-commerce receipts, and certified datasets share a single Ed25519 signing root. Verification is independent of CertifiedData's systems — the public key is published at
> [`https://certifieddata.io/.well-known/signing-keys.json`](https://certifieddata.io/.well-known/signing-keys.json).

## What's here

```
.
├── src/
│   ├── verify.ts          # RFC 8785 JCS canonicalization + Ed25519 verify
│   ├── sign-demo.ts       # Calls the public /api/decision-log/demo endpoint
│   └── index.ts
├── scripts/
│   ├── sign-demo-cli.mjs  # CLI: sign a sample payload via the public API
│   └── verify-cli.mjs     # CLI: verify a signed record against the public key
├── examples/
│   ├── loan-approval.json
│   ├── claim-triage.json
│   └── agent-action.json
└── .github/workflows/
    └── verify.yml         # CI: re-verify every committed record on push
```

## Quickstart

```bash
# 1. Install
pnpm install           # or: npm install / yarn install

# 2. Sign a sample decision via the public demo API (no account, no key)
node scripts/sign-demo-cli.mjs examples/loan-approval.json > signed-loan.json

# 3. Verify the signature against the public key — fully offline after the key fetch
node scripts/verify-cli.mjs signed-loan.json
# → ✅ Signature verified (key_id: cd_root_2026)
```

## Verifying in your own code

```ts
import { verifyDecisionRecord } from "certifieddata-decision-ledger-examples";

const signed = JSON.parse(fs.readFileSync("signed-loan.json", "utf8"));
const result = await verifyDecisionRecord(signed);

if (result.valid) {
  console.log(`Verified: signed by ${result.keyId}`);
} else {
  console.error(`Invalid: ${result.reason}`);
}
```

The verifier:
1. Re-canonicalizes the payload using **RFC 8785 (JCS)**
2. Computes a SHA-256 hash and compares it to `record_hash`
3. Fetches the Ed25519 public key from `/.well-known/signing-keys.json` (cached)
4. Verifies the signature against the canonical payload bytes

No trust in CertifiedData's runtime is required. If you pin the public key, no network call is needed.

## Demo endpoint limits

The public demo endpoint accepts **30 signed demos per minute per IP**. Free CertifiedData accounts get **1,000 signed records per month** plus a permanent public verification URL per record. See [certifieddata.io/try](https://certifieddata.io/try).

## GitHub Action — verify on every push

[`.github/workflows/verify.yml`](.github/workflows/verify.yml) re-verifies every signed record in `./records/` on every push. Drop it into any repo that stores decision records alongside code and you'll catch tampering in CI.

## License

MIT — see [LICENSE](./LICENSE).
