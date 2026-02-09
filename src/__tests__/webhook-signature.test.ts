import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";

/**
 * Test the webhook signature verification logic.
 * This mirrors the verification in src/client/index.ts.
 */

function verifyCreemSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const computed = createHmac("sha256", secret).update(payload).digest("hex");
  return computed === signature;
}

function generateSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

describe("Webhook Signature Verification", () => {
  const secret = "whsec_test_secret_key_12345";

  it("should verify a valid signature", () => {
    const payload = JSON.stringify({
      id: "evt_test_123",
      eventType: "checkout.completed",
      created_at: 1728734325927,
      object: { id: "ch_test_123" },
    });
    const signature = generateSignature(payload, secret);

    expect(verifyCreemSignature(payload, signature, secret)).toBe(true);
  });

  it("should reject an invalid signature", () => {
    const payload = '{"id":"evt_test_123"}';
    const invalidSignature = "invalid_signature_hash";

    expect(verifyCreemSignature(payload, invalidSignature, secret)).toBe(false);
  });

  it("should reject a signature from a different secret", () => {
    const payload = '{"id":"evt_test_123"}';
    const wrongSecret = "wrong_secret";
    const signature = generateSignature(payload, wrongSecret);

    expect(verifyCreemSignature(payload, signature, secret)).toBe(false);
  });

  it("should reject a tampered payload", () => {
    const originalPayload = '{"id":"evt_test_123","amount":1000}';
    const tamperedPayload = '{"id":"evt_test_123","amount":0}';
    const signature = generateSignature(originalPayload, secret);

    expect(verifyCreemSignature(tamperedPayload, signature, secret)).toBe(
      false,
    );
  });

  it("should handle empty payload", () => {
    const payload = "";
    const signature = generateSignature(payload, secret);

    expect(verifyCreemSignature(payload, signature, secret)).toBe(true);
  });

  it("should handle special characters in payload", () => {
    const payload = JSON.stringify({
      customer: { name: "Test User", email: "test@example.com" },
      metadata: { note: "Special chars: <>&'\"\n\t" },
    });
    const signature = generateSignature(payload, secret);

    expect(verifyCreemSignature(payload, signature, secret)).toBe(true);
  });

  it("should produce deterministic signatures", () => {
    const payload = '{"test": "data"}';
    const sig1 = generateSignature(payload, secret);
    const sig2 = generateSignature(payload, secret);

    expect(sig1).toBe(sig2);
  });

  it("should produce hex-encoded signatures", () => {
    const payload = '{"test": "data"}';
    const signature = generateSignature(payload, secret);

    // SHA-256 hex output is always 64 characters
    expect(signature).toHaveLength(64);
    expect(signature).toMatch(/^[0-9a-f]+$/);
  });
});
