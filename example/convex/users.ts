import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get the current user. In a real app, this would use authentication.
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("users").first();
  },
});

/**
 * Get user with subscription details.
 */
export const getUserWithSubscription = query({
  args: {},
  handler: async (ctx) => {
    const { creem } = await import("./creem");
    const user = await ctx.db.query("users").first();
    if (!user) return null;

    const subscription = await creem.getCurrentSubscription(ctx, {
      userId: user._id,
    });

    return {
      ...user,
      subscription,
      isPro:
        subscription?.status === "active" ||
        subscription?.status === "trialing",
    };
  },
});

/**
 * Create a demo user.
 */
export const createUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
    if (existing) return existing._id;
    return ctx.db.insert("users", args);
  },
});
