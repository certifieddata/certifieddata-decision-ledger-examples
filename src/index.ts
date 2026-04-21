export {
  verifyDecisionRecord,
  fetchSigningKeyRegistry,
  findKey,
  canonicalPayloadBytes,
  sha256Hex,
  type SignedDecisionRecord,
  type SigningKeyRegistry,
  type PublicKeyEntry,
  type VerificationResult,
} from "./verify.js";

export { signDemoDecision, type DemoSignRequest } from "./sign-demo.js";
