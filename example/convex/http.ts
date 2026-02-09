import { httpRouter } from "convex/server";
import { creem } from "./creem";

const http = httpRouter();

// Register the Creem webhook handler.
// This will handle all Creem webhook events at /creem/webhook
creem.registerRoutes(http as any, {
  // Optional: custom path (defaults to "/creem/webhook")
  // path: "/creem/webhook",

  // ── Simplified access control (recommended) ──────────────────
  // These high-level callbacks cover the most common use cases.

  onGrantAccess: async (ctx, { userId, productId, subscriptionId }) => {
    // Fires on: checkout.completed, subscription.active, subscription.paid
    console.log("Grant access:", { userId, productId, subscriptionId });
    // Example: await ctx.runMutation(api.users.grantPremiumAccess, { userId, productId });
  },

  onRevokeAccess: async (ctx, { userId, subscriptionId, reason }) => {
    // Fires on: subscription.canceled, subscription.expired
    console.log("Revoke access:", { userId, subscriptionId, reason });
    // Example: await ctx.runMutation(api.users.revokePremiumAccess, { userId });
  },

  // ── Granular event callbacks (optional) ──────────────────────
  // Use these for more specific handling. They fire in addition
  // to onGrantAccess/onRevokeAccess.

  onCheckoutCompleted: async (ctx, event) => {
    console.log("Checkout completed:", event.object);
  },
  onSubscriptionPaused: async (ctx, event) => {
    console.log("Subscription paused:", event.object);
  },
  onRefundCreated: async (ctx, event) => {
    console.log("Refund created:", event.object);
  },
  onDisputeCreated: async (ctx, event) => {
    console.log("Dispute created:", event.object);
  },
});

export default http;
