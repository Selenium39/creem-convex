import { describe, it, expect } from "vitest";
import type {
  CreemProduct,
  CreemCustomer,
  CreemSubscription,
  CreemCheckout,
  CreemOrder,
  CreemRefund,
  WebhookEvent,
  WebhookEventType,
  CheckoutCompletedEvent,
  SubscriptionEvent,
  CreateCheckoutRequest,
  CancelSubscriptionRequest,
  PaginatedResponse,
  BillingType,
  BillingPeriod,
  SubscriptionStatus,
  CheckoutStatus,
} from "../types.js";

describe("Type Definitions", () => {
  it("should type-check a CreemProduct", () => {
    const product: CreemProduct = {
      id: "prod_test",
      mode: "test",
      object: "product",
      name: "Pro Monthly",
      description: "Monthly pro subscription",
      price: 1000,
      currency: "USD",
      billing_type: "recurring",
      billing_period: "every-month",
      status: "active",
      tax_mode: "exclusive",
      tax_category: "saas",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      image_url: null,
    };
    expect(product.id).toBe("prod_test");
    expect(product.price).toBe(1000);
  });

  it("should type-check a CreemCustomer", () => {
    const customer: CreemCustomer = {
      id: "cust_test",
      object: "customer",
      email: "test@example.com",
      name: "Test User",
      country: "US",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };
    expect(customer.email).toBe("test@example.com");
  });

  it("should type-check a CreemSubscription with embedded objects", () => {
    const subscription: CreemSubscription = {
      id: "sub_test",
      object: "subscription",
      product: {
        id: "prod_test",
        mode: "test",
        object: "product",
        name: "Pro",
        description: null,
        price: 1000,
        currency: "USD",
        billing_type: "recurring",
        status: "active",
        tax_mode: "exclusive",
        tax_category: "saas",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        image_url: null,
      },
      customer: {
        id: "cust_test",
        object: "customer",
        email: "test@example.com",
        name: "Test",
        country: "US",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
      collection_method: "charge_automatically",
      status: "active",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };
    expect(subscription.status).toBe("active");
  });

  it("should type-check a CreemSubscription with string references", () => {
    const subscription: CreemSubscription = {
      id: "sub_test",
      object: "subscription",
      product: "prod_test",
      customer: "cust_test",
      collection_method: "charge_automatically",
      status: "active",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };
    expect(typeof subscription.product).toBe("string");
  });

  it("should type-check subscription statuses", () => {
    const statuses: SubscriptionStatus[] = [
      "active",
      "canceled",
      "unpaid",
      "paused",
      "trialing",
      "scheduled_cancel",
      "past_due",
      "expired",
    ];
    expect(statuses).toHaveLength(8);
  });

  it("should type-check checkout statuses", () => {
    const statuses: CheckoutStatus[] = [
      "pending",
      "processing",
      "completed",
      "expired",
    ];
    expect(statuses).toHaveLength(4);
  });

  it("should type-check billing types", () => {
    const types: BillingType[] = ["recurring", "one-time"];
    expect(types).toHaveLength(2);
  });

  it("should type-check billing periods", () => {
    const periods: BillingPeriod[] = [
      "every-month",
      "every-3-months",
      "every-6-months",
      "every-year",
    ];
    expect(periods).toHaveLength(4);
  });

  it("should type-check a CreateCheckoutRequest", () => {
    const request: CreateCheckoutRequest = {
      product_id: "prod_test",
      success_url: "https://example.com/success",
      metadata: { userId: "user_123" },
      customer: { email: "test@example.com" },
      discount_code: "SUMMER2024",
    };
    expect(request.product_id).toBe("prod_test");
  });

  it("should type-check CancelSubscriptionRequest", () => {
    const request: CancelSubscriptionRequest = {
      mode: "scheduled",
      onExecute: "cancel",
    };
    expect(request.mode).toBe("scheduled");
  });

  it("should type-check webhook event types", () => {
    const eventTypes: WebhookEventType[] = [
      "checkout.completed",
      "subscription.active",
      "subscription.paid",
      "subscription.canceled",
      "subscription.scheduled_cancel",
      "subscription.past_due",
      "subscription.expired",
      "subscription.update",
      "subscription.trialing",
      "subscription.paused",
      "refund.created",
      "dispute.created",
    ];
    expect(eventTypes).toHaveLength(12);
  });

  it("should type-check a PaginatedResponse", () => {
    const response: PaginatedResponse<CreemProduct> = {
      items: [],
      pagination: {
        total_records: 0,
        total_pages: 0,
        current_page: 1,
        next_page: null,
        prev_page: null,
      },
    };
    expect(response.items).toHaveLength(0);
    expect(response.pagination.current_page).toBe(1);
  });

  it("should type-check a checkout.completed webhook event", () => {
    const event: CheckoutCompletedEvent = {
      id: "evt_test",
      eventType: "checkout.completed",
      created_at: Date.now(),
      object: {
        id: "ch_test",
        object: "checkout",
        order: {
          id: "ord_test",
          customer: "cust_test",
          product: "prod_test",
          amount: 1000,
          currency: "USD",
          status: "paid",
          type: "recurring",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        product: {
          id: "prod_test",
          mode: "test",
          object: "product",
          name: "Pro",
          description: null,
          price: 1000,
          currency: "USD",
          billing_type: "recurring",
          status: "active",
          tax_mode: "exclusive",
          tax_category: "saas",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          image_url: null,
        },
        customer: {
          id: "cust_test",
          object: "customer",
          email: "test@example.com",
          name: "Test",
          country: "US",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        status: "completed",
        mode: "test",
      },
    };
    expect(event.eventType).toBe("checkout.completed");
  });

  it("should type-check a subscription webhook event", () => {
    const event: SubscriptionEvent = {
      id: "evt_test",
      eventType: "subscription.paid",
      created_at: Date.now(),
      object: {
        id: "sub_test",
        object: "subscription",
        product: {
          id: "prod_test",
          mode: "test",
          object: "product",
          name: "Pro",
          description: null,
          price: 1000,
          currency: "USD",
          billing_type: "recurring",
          status: "active",
          tax_mode: "exclusive",
          tax_category: "saas",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          image_url: null,
        },
        customer: {
          id: "cust_test",
          object: "customer",
          email: "test@example.com",
          name: "Test",
          country: "US",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        collection_method: "charge_automatically",
        status: "active",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        mode: "test",
      },
    };
    expect(event.eventType).toBe("subscription.paid");
  });

  it("should type-check an order", () => {
    const order: CreemOrder = {
      id: "ord_test",
      customer: "cust_test",
      product: "prod_test",
      amount: 1000,
      currency: "USD",
      status: "paid",
      type: "one-time",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      sub_total: 900,
      tax_amount: 100,
      discount_amount: 0,
      amount_due: 1000,
      amount_paid: 1000,
    };
    expect(order.type).toBe("one-time");
  });
});
