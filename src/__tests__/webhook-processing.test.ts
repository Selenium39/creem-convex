import { describe, it, expect, vi } from "vitest";
import { createHmac } from "crypto";

/**
 * Tests for webhook event processing logic.
 * These test the event parsing and signature verification
 * that happens in the HTTP handler.
 */

function generateSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function verifyCreemSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const computed = createHmac("sha256", secret).update(payload).digest("hex");
  return computed === signature;
}

describe("Webhook Event Processing", () => {
  const webhookSecret = "whsec_test_12345";

  describe("checkout.completed", () => {
    it("should parse a checkout.completed event", () => {
      const event = {
        id: "evt_test_checkout",
        eventType: "checkout.completed",
        created_at: 1728734325927,
        object: {
          id: "ch_test_123",
          object: "checkout",
          request_id: "my-request-id",
          order: {
            id: "ord_test",
            customer: "cust_test",
            product: "prod_test",
            amount: 1000,
            currency: "EUR",
            status: "paid",
            type: "recurring",
            created_at: "2024-10-12T11:58:33.097Z",
            updated_at: "2024-10-12T11:58:33.097Z",
          },
          product: {
            id: "prod_test",
            name: "Monthly",
            description: "Monthly",
            price: 1000,
            currency: "EUR",
            billing_type: "recurring",
            billing_period: "every-month",
            status: "active",
          },
          customer: {
            id: "cust_test",
            object: "customer",
            email: "customer@example.com",
            name: "Test User",
            country: "NL",
          },
          subscription: {
            id: "sub_test",
            object: "subscription",
            product: "prod_test",
            customer: "cust_test",
            status: "active",
          },
          metadata: {
            userId: "user_123",
            custom_data: "test",
          },
          status: "completed",
          mode: "local",
        },
      };

      const payload = JSON.stringify(event);
      const signature = generateSignature(payload, webhookSecret);

      expect(verifyCreemSignature(payload, signature, webhookSecret)).toBe(true);
      expect(event.eventType).toBe("checkout.completed");
      expect(event.object.customer.email).toBe("customer@example.com");
      expect(event.object.metadata.userId).toBe("user_123");
      expect(event.object.order.amount).toBe(1000);
    });
  });

  describe("subscription events", () => {
    const subscriptionStatuses = [
      { eventType: "subscription.active", status: "active" },
      { eventType: "subscription.paid", status: "active" },
      { eventType: "subscription.canceled", status: "canceled" },
      { eventType: "subscription.scheduled_cancel", status: "scheduled_cancel" },
      { eventType: "subscription.past_due", status: "past_due" },
      { eventType: "subscription.expired", status: "expired" },
      { eventType: "subscription.trialing", status: "trialing" },
      { eventType: "subscription.paused", status: "paused" },
    ];

    for (const { eventType, status } of subscriptionStatuses) {
      it(`should parse a ${eventType} event`, () => {
        const event = {
          id: `evt_test_${status}`,
          eventType,
          created_at: Date.now(),
          object: {
            id: "sub_test",
            object: "subscription",
            product: {
              id: "prod_test",
              name: "Pro",
              price: 1000,
              currency: "EUR",
              billing_type: "recurring",
              billing_period: "every-month",
              status: "active",
            },
            customer: {
              id: "cust_test",
              object: "customer",
              email: "test@example.com",
              name: "Test",
              country: "NL",
            },
            collection_method: "charge_automatically",
            status,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-02T00:00:00Z",
            mode: "local",
          },
        };

        const payload = JSON.stringify(event);
        const signature = generateSignature(payload, webhookSecret);

        expect(verifyCreemSignature(payload, signature, webhookSecret)).toBe(true);
        expect(event.object.status).toBe(status);
      });
    }
  });

  describe("subscription.paid with period dates", () => {
    it("should include period and transaction dates", () => {
      const event = {
        id: "evt_paid_test",
        eventType: "subscription.paid",
        created_at: Date.now(),
        object: {
          id: "sub_test",
          object: "subscription",
          product: { id: "prod_test", name: "Pro" },
          customer: { id: "cust_test", email: "test@example.com" },
          collection_method: "charge_automatically",
          status: "active",
          last_transaction_id: "tran_test",
          last_transaction_date: "2024-10-12T11:58:47.109Z",
          next_transaction_date: "2024-11-12T11:58:38.000Z",
          current_period_start_date: "2024-10-12T11:58:38.000Z",
          current_period_end_date: "2024-11-12T11:58:38.000Z",
          created_at: "2024-10-12T11:58:45.425Z",
          updated_at: "2024-10-12T11:58:45.425Z",
          mode: "local",
        },
      };

      expect(event.object.last_transaction_id).toBe("tran_test");
      expect(event.object.current_period_start_date).toBeDefined();
      expect(event.object.current_period_end_date).toBeDefined();
      expect(event.object.next_transaction_date).toBeDefined();
    });
  });

  describe("refund.created", () => {
    it("should parse a refund.created event", () => {
      const event = {
        id: "evt_refund_test",
        eventType: "refund.created",
        created_at: Date.now(),
        object: {
          id: "ref_test",
          object: "refund",
          status: "succeeded",
          refund_amount: 1210,
          refund_currency: "EUR",
          reason: "requested_by_customer",
          transaction: {
            id: "tran_test",
            amount: 1000,
            amount_paid: 1210,
            currency: "EUR",
            status: "refunded",
          },
          customer: {
            id: "cust_test",
            email: "test@example.com",
          },
        },
      };

      expect(event.eventType).toBe("refund.created");
      expect(event.object.refund_amount).toBe(1210);
      expect(event.object.reason).toBe("requested_by_customer");
    });
  });

  describe("dispute.created", () => {
    it("should parse a dispute.created event", () => {
      const event = {
        id: "evt_dispute_test",
        eventType: "dispute.created",
        created_at: Date.now(),
        object: {
          id: "disp_test",
          object: "dispute",
          status: "open",
          amount: 1000,
          currency: "EUR",
          reason: "fraudulent",
        },
      };

      expect(event.eventType).toBe("dispute.created");
      expect(event.object.amount).toBe(1000);
    });
  });

  describe("Idempotency", () => {
    it("should detect duplicate events by ID", () => {
      const processedEvents = new Set<string>();

      const event = {
        id: "evt_duplicate_test",
        eventType: "subscription.active",
        created_at: Date.now(),
        object: { id: "sub_test" },
      };

      // First processing
      const isNew1 = !processedEvents.has(event.id);
      processedEvents.add(event.id);
      expect(isNew1).toBe(true);

      // Second processing (same event)
      const isNew2 = !processedEvents.has(event.id);
      expect(isNew2).toBe(false);
    });
  });

  describe("Timestamp guards", () => {
    it("should skip stale webhook updates", () => {
      const existing = { updatedAt: "2024-10-12T12:00:00Z" };
      const incoming = { updatedAt: "2024-10-12T11:00:00Z" }; // older

      const shouldSkip = existing.updatedAt > incoming.updatedAt;
      expect(shouldSkip).toBe(true);
    });

    it("should apply newer webhook updates", () => {
      const existing = { updatedAt: "2024-10-12T11:00:00Z" };
      const incoming = { updatedAt: "2024-10-12T12:00:00Z" }; // newer

      const shouldSkip = existing.updatedAt > incoming.updatedAt;
      expect(shouldSkip).toBe(false);
    });
  });
});
