import type { SignedDecisionRecord } from "./verify.js";

export interface DemoSignRequest {
  actor: { id: string; type?: string };
  decision: {
    outcome: string;
    reason?: string;
    [k: string]: unknown;
  };
  explanation?: {
    reasonCodes?: string[];
    rationaleSummary?: string | null;
  };
  entity?: Record<string, unknown>;
}

const DEFAULT_BASE = "https://certifieddata.io";

/**
 * Calls the public demo endpoint and returns a fully signed decision record.
 *
 * No auth required. Anonymous rate limit: 30 requests per minute per IP.
 */
export async function signDemoDecision(
  body: DemoSignRequest,
  opts: { baseUrl?: string } = {},
): Promise<SignedDecisionRecord> {
  const base = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, "");
  const res = await fetch(`${base}/api/decision-log/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Demo sign failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { ok: boolean } & SignedDecisionRecord;
  if (!json.ok) {
    throw new Error(`Demo sign rejected by API: ${JSON.stringify(json)}`);
  }
  return json;
}
