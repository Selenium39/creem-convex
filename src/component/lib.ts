import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import schema from "./schema.js";

// ─── Helpers ─────────────────────────────────────────────────────────

const omitSystemFields = <
  T extends { _id: string; _creationTime: number } | null | undefined,
>(
  doc: T,
) => {
  if (!doc) {
    return doc;
  }
  const { _id, _creationTime, ...rest } = doc;
  return rest;
};

// ─── Customer Operations ─────────────────────────────────────────────

export const getCustomerByUserId = query({
  args: { userId: v.string() },
  returns: v.union(schema.tables.customers.validator, v.null()),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .unique();
    return omitSystemFields(customer);
  },
});

export const getCustomerByCreemId = query({
  args: { creemCustomerId: v.string() },
  returns: v.union(schema.tables.customers.validator, v.null()),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("creemCustomerId", (q) =>
        q.eq("creemCustomerId", args.creemCustomerId),
      )
      .unique();
    return omitSystemFields(customer);
  },
});

export const upsertCustomer = mutation({
  args: {
    creemCustomerId: v.string(),
    userId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customers")
      .withIndex("creemCustomerId", (q) =>
        q.eq("creemCustomerId", args.creemCustomerId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        country: args.country,
        updatedAt: new Date().toISOString(),
      });
      return existing._id;
    }
    return ctx.db.insert("customers", {
      creemCustomerId: args.creemCustomerId,
      userId: args.userId,
      email: args.email,
      name: args.name,
      country: args.country,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },
});

export const insertCustomer = mutation({
  args: {
    creemCustomerId: v.string(),
    userId: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customers")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) {
      return existing._id;
    }
    return ctx.db.insert("customers", {
      creemCustomerId: args.creemCustomerId,
      userId: args.userId,
      email: args.email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },
});

// ─── Product Operations ──────────────────────────────────────────────

export const getProduct = query({
  args: { creemProductId: v.string() },
  returns: v.union(schema.tables.products.validator, v.null()),
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("creemProductId", (q) =>
        q.eq("creemProductId", args.creemProductId),
      )
      .unique();
    return omitSystemFields(product);
  },
});

export const listProducts = query({
  args: {
    activeOnly: v.optional(v.boolean()),
  },
  returns: v.array(schema.tables.products.validator),
  handler: async (ctx, args) => {
    const q = ctx.db.query("products");
    const products = args.activeOnly
      ? await q.withIndex("status", (q) => q.eq("status", "active")).collect()
      : await q.collect();
    return products.map((p) => omitSystemFields(p)!);
  },
});

export const upsertProduct = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("products")
      .withIndex("creemProductId", (q) =>
        q.eq("creemProductId", args.creemProductId),
      )
      .unique();

    if (existing) {
      // Timestamp guard: skip if existing record is newer
      if (existing.updatedAt > args.updatedAt) {
        return;
      }
      await ctx.db.patch(existing._id, args);
      return;
    }
    await ctx.db.insert("products", args);
  },
});

// ─── Subscription Operations ─────────────────────────────────────────

export const getSubscription = query({
  args: { creemSubscriptionId: v.string() },
  returns: v.union(schema.tables.subscriptions.validator, v.null()),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("creemSubscriptionId", (q) =>
        q.eq("creemSubscriptionId", args.creemSubscriptionId),
      )
      .unique();
    return omitSystemFields(subscription);
  },
});

export const getCurrentSubscription = query({
  args: { userId: v.string() },
  returns: v.union(
    v.object({
      ...schema.tables.subscriptions.validator.fields,
      product: v.union(schema.tables.products.validator, v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!customer) {
      return null;
    }

    // Find the most recent active-ish subscription
    const activeStatuses = [
      "active",
      "trialing",
      "past_due",
      "scheduled_cancel",
    ];
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("creemCustomerId", (q) =>
        q.eq("creemCustomerId", customer.creemCustomerId),
      )
      .collect();

    const activeSubscription = subscriptions.find((s) =>
      activeStatuses.includes(s.status),
    );

    if (!activeSubscription) {
      return null;
    }

    const product = await ctx.db
      .query("products")
      .withIndex("creemProductId", (q) =>
        q.eq("creemProductId", activeSubscription.creemProductId),
      )
      .unique();

    return {
      ...omitSystemFields(activeSubscription)!,
      product: product ? omitSystemFields(product)! : null,
    };
  },
});

export const listUserSubscriptions = query({
  args: { userId: v.string() },
  returns: v.array(
    v.object({
      ...schema.tables.subscriptions.validator.fields,
      product: v.union(schema.tables.products.validator, v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!customer) {
      return [];
    }

    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("creemCustomerId", (q) =>
        q.eq("creemCustomerId", customer.creemCustomerId),
      )
      .collect();

    const results = [];
    for (const sub of subscriptions) {
      const product = await ctx.db
        .query("products")
        .withIndex("creemProductId", (q) =>
          q.eq("creemProductId", sub.creemProductId),
        )
        .unique();

      results.push({
        ...omitSystemFields(sub)!,
        product: product ? omitSystemFields(product)! : null,
      });
    }
    return results;
  },
});

export const upsertSubscription = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("creemSubscriptionId", (q) =>
        q.eq("creemSubscriptionId", args.creemSubscriptionId),
      )
      .unique();

    // Try to resolve userId from the customer table
    let userId = args.userId;
    if (!userId) {
      const customer = await ctx.db
        .query("customers")
        .withIndex("creemCustomerId", (q) =>
          q.eq("creemCustomerId", args.creemCustomerId),
        )
        .unique();
      userId = customer?.userId;
    }

    const data = { ...args, userId };

    if (existing) {
      // Timestamp guard: skip if existing record is newer
      if (existing.updatedAt > args.updatedAt) {
        return;
      }
      await ctx.db.patch(existing._id, data);
      return;
    }
    await ctx.db.insert("subscriptions", data);
  },
});

// ─── Order Operations ────────────────────────────────────────────────

export const getOrder = query({
  args: { creemOrderId: v.string() },
  returns: v.union(schema.tables.orders.validator, v.null()),
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("creemOrderId", (q) =>
        q.eq("creemOrderId", args.creemOrderId),
      )
      .unique();
    return omitSystemFields(order);
  },
});

export const listUserOrders = query({
  args: { userId: v.string() },
  returns: v.array(schema.tables.orders.validator),
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();
    return orders.map((o) => omitSystemFields(o)!);
  },
});

export const upsertOrder = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("orders")
      .withIndex("creemOrderId", (q) =>
        q.eq("creemOrderId", args.creemOrderId),
      )
      .unique();

    // Try to resolve userId from the customer table
    let userId = args.userId;
    if (!userId) {
      const customer = await ctx.db
        .query("customers")
        .withIndex("creemCustomerId", (q) =>
          q.eq("creemCustomerId", args.creemCustomerId),
        )
        .unique();
      userId = customer?.userId;
    }

    const data = { ...args, userId };

    if (existing) {
      if (existing.updatedAt > args.updatedAt) {
        return;
      }
      await ctx.db.patch(existing._id, data);
      return;
    }
    await ctx.db.insert("orders", data);
  },
});

// ─── Webhook Event Logging ───────────────────────────────────────────

export const insertWebhookEvent = mutation({
  args: {
    creemEventId: v.string(),
    eventType: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    // Idempotency check: skip if we already processed this event
    const existing = await ctx.db
      .query("webhookEvents")
      .withIndex("creemEventId", (q) =>
        q.eq("creemEventId", args.creemEventId),
      )
      .unique();
    if (existing) {
      return null;
    }

    return ctx.db.insert("webhookEvents", {
      creemEventId: args.creemEventId,
      eventType: args.eventType,
      payload: args.payload,
      processedAt: Date.now(),
    });
  },
});
