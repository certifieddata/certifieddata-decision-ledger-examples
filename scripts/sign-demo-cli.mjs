#!/usr/bin/env node
/**
 * Usage:
 *   node scripts/sign-demo-cli.mjs examples/loan-approval.json > signed.json
 *
 * Reads a DemoSignRequest JSON body from disk, submits it to the public
 * CertifiedData demo endpoint, and prints the signed record to stdout.
 *
 * Anonymous rate limit: 30 requests per minute per IP.
 * No account, no API key required.
 */
import fs from "node:fs";

const BASE = process.env.CERTIFIEDDATA_BASE_URL ?? "https://certifieddata.io";

const [, , path] = process.argv;
if (!path) {
  console.error("usage: sign-demo-cli.mjs <request.json>");
  process.exit(2);
}

const body = JSON.parse(fs.readFileSync(path, "utf8"));

const res = await fetch(`${BASE.replace(/\/$/, "")}/api/decision-log/demo`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

if (!res.ok) {
  console.error(`HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const signed = await res.json();
console.log(JSON.stringify(signed, null, 2));
