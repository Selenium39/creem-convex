import { httpRouter } from "convex/server";
import { creem } from "./creem";

const http = httpRouter();

// Register the Creem webhook handler.
// This will handle all Creem webhook events at /creem/webhook
creem.registerRoutes(http as any, {
  // Optional: custom path (defaults to "/creem/webhook")
  // path: "/creem/webhook",

  // Optional: callbacks for webhook events
  onCheckoutCompleted: async (ctx, event) => {
    console.log("Checkout completed:", event.object);
  },
  onSubscriptionActive: async (ctx, event) => {
    console.log("Subscription active:", event.object);
  },
  onSubscriptionCanceled: async (ctx, event) => {
    console.log("Subscription canceled:", event.object);
  },
  onSubscriptionPaid: async (ctx, event) => {
    console.log("Subscription paid:", event.object);
  },
});

export default http;
