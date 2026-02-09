/**
 * Creem component setup.
 *
 * This file initializes the Creem component and exports the API functions
 * that will be used by the frontend.
 */
import { Creem } from "@creem_io/convex";
import { api, components } from "./_generated/api";

export const creem = new Creem(components.creem, {
  // Required: provides user info for subscription lookups and checkout
  getUserInfo: async (ctx) => {
    // In a real app, you'd use authentication to get the current user.
    // For this example, we just get the first user.
    const user = await ctx.runQuery(api.users.getCurrentUser);
    if (!user) {
      throw new Error("User not found");
    }
    return { userId: user._id, email: user.email };
  },

  // Optional: Map friendly keys to Creem product IDs.
  // Replace these with your actual product IDs from the Creem dashboard.
  products: {
    proMonthly: process.env["CREEM_PRODUCT_PRO_MONTHLY"] ?? "prod_xxx",
    proYearly: process.env["CREEM_PRODUCT_PRO_YEARLY"] ?? "prod_yyy",
  },

  // Optional: Override env vars for configuration
  // apiKey: "creem_xxx",            // Defaults to CREEM_API_KEY env var
  // webhookSecret: "whsec_xxx",     // Defaults to CREEM_WEBHOOK_SECRET env var
  // environment: "test",            // Defaults to CREEM_ENVIRONMENT env var or "test"
});

// Export Convex functions from the Creem client.
// These can be called from the frontend using useAction/useQuery.
export const {
  generateCheckoutLink,
  generateCustomerPortalUrl,
  cancelCurrentSubscription,
  upgradeCurrentSubscription,
  getConfiguredProducts,
  listAllProducts,
  syncProducts,
} = creem.api();
