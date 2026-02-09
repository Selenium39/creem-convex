import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema(
  {
    /**
     * Maps Creem customers to application user IDs.
     */
    customers: defineTable({
      creemCustomerId: v.string(),
      userId: v.string(),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      country: v.optional(v.string()),
      metadata: v.optional(v.record(v.string(), v.any())),
      createdAt: v.optional(v.string()),
      updatedAt: v.optional(v.string()),
    })
      .index("userId", ["userId"])
      .index("creemCustomerId", ["creemCustomerId"]),

    /**
     * Products synced from Creem.
     */
    products: defineTable({
      creemProductId: v.string(),
      name: v.string(),
      description: v.optional(v.union(v.string(), v.null())),
      price: v.number(),
      currency: v.string(),
      billingType: v.string(),
      billingPeriod: v.optional(v.union(v.string(), v.null())),
      status: v.string(),
      taxMode: v.optional(v.string()),
      taxCategory: v.optional(v.string()),
      imageUrl: v.optional(v.union(v.string(), v.null())),
      productUrl: v.optional(v.string()),
      defaultSuccessUrl: v.optional(v.string()),
      features: v.optional(
        v.array(
          v.object({
            id: v.string(),
            type: v.string(),
            description: v.string(),
          }),
        ),
      ),
      createdAt: v.string(),
      updatedAt: v.string(),
      mode: v.optional(v.string()),
    })
      .index("creemProductId", ["creemProductId"])
      .index("status", ["status"]),

    /**
     * Subscriptions synced from Creem via webhooks.
     */
    subscriptions: defineTable({
      creemSubscriptionId: v.string(),
      creemCustomerId: v.string(),
      creemProductId: v.string(),
      userId: v.optional(v.string()),
      status: v.string(),
      collectionMethod: v.optional(v.string()),
      lastTransactionId: v.optional(v.union(v.string(), v.null())),
      lastTransactionDate: v.optional(v.union(v.string(), v.null())),
      nextTransactionDate: v.optional(v.union(v.string(), v.null())),
      currentPeriodStartDate: v.optional(v.union(v.string(), v.null())),
      currentPeriodEndDate: v.optional(v.union(v.string(), v.null())),
      canceledAt: v.optional(v.union(v.string(), v.null())),
      metadata: v.optional(v.record(v.string(), v.any())),
      createdAt: v.string(),
      updatedAt: v.string(),
      mode: v.optional(v.string()),
    })
      .index("creemSubscriptionId", ["creemSubscriptionId"])
      .index("creemCustomerId", ["creemCustomerId"])
      .index("userId", ["userId"])
      .index("userId_status", ["userId", "status"]),

    /**
     * Orders from checkout completions.
     */
    orders: defineTable({
      creemOrderId: v.string(),
      creemCustomerId: v.string(),
      creemProductId: v.string(),
      userId: v.optional(v.string()),
      amount: v.number(),
      currency: v.string(),
      status: v.string(),
      type: v.string(),
      metadata: v.optional(v.record(v.string(), v.any())),
      createdAt: v.string(),
      updatedAt: v.string(),
      mode: v.optional(v.string()),
    })
      .index("creemOrderId", ["creemOrderId"])
      .index("userId", ["userId"])
      .index("creemCustomerId", ["creemCustomerId"]),

    /**
     * Raw webhook events for auditing and debugging.
     */
    webhookEvents: defineTable({
      creemEventId: v.string(),
      eventType: v.string(),
      payload: v.any(),
      processedAt: v.number(),
    }).index("creemEventId", ["creemEventId"]),
  },
  {
    schemaValidation: true,
  },
);
