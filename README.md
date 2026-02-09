# Convex Creem Component

[![npm version](https://badge.fury.io/js/@creem_io%2Fconvex.svg)](https://badge.fury.io/js/@creem_io/convex)

Integrates [Creem](https://creem.io) payments, subscriptions, and billing into your [Convex](https://convex.dev) application.

Creem is a Merchant of Record that handles global payments, tax compliance, and subscription management. This Convex component brings Creem's full payment stack into your Convex backend with real-time reactivity.

**Check out the [example app](./example) for a complete demo.**

```tsx
// Get subscription details for the current user
const subscription = await creem.getCurrentSubscription(ctx, { userId });

// Show available plans
<CheckoutLink creemApi={api.creem} productId="prod_xxx">
  Upgrade to Pro
</CheckoutLink>

// Manage existing subscriptions
<CustomerPortalLink creemApi={api.creem}>
  Manage Subscription
</CustomerPortalLink>
```

## Prerequisites

### Convex App

You'll need a Convex app to use this component. Follow any of the [Convex quickstarts](https://docs.convex.dev/home) to set one up.

### Creem Account

1. [Create a Creem account](https://creem.io)
2. Create products in the Creem dashboard
3. Get your API key from **Settings > API Keys**
4. Get your webhook secret from **Developers > Webhooks**

## Installation

Install the component package:

```bash
npm install @creem_io/convex
```

Create a `convex.config.ts` file in your app's `convex/` folder and install the component by calling `app.use`:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import creem from "@creem_io/convex/convex.config.js";

const app = defineApp();
app.use(creem);
export default app;
```

Set your Creem credentials as environment variables:

```bash
npx convex env set CREEM_API_KEY creem_xxxxx
npx convex env set CREEM_WEBHOOK_SECRET whsec_xxxxx
# Optional: set to "production" for live mode (defaults to "test")
npx convex env set CREEM_ENVIRONMENT test
```

## Quick Start

### 1. Initialize the Creem client

```ts
// convex/creem.ts
import { Creem } from "@creem_io/convex";
import { api, components } from "./_generated/api";

export const creem = new Creem(components.creem, {
  // Required: provide a function to get the current user's ID and email
  getUserInfo: async (ctx) => {
    const user = await ctx.runQuery(api.users.getCurrentUser);
    return { userId: user._id, email: user.email };
  },

  // Optional: map friendly keys to Creem product IDs
  products: {
    proMonthly: "prod_xxxxx",
    proYearly: "prod_yyyyy",
  },
});

// Export API functions
export const {
  generateCheckoutLink,
  generateCustomerPortalUrl,
  cancelCurrentSubscription,
  upgradeCurrentSubscription,
  getConfiguredProducts,
  listAllProducts,
  syncProducts,
} = creem.api();
```

### 2. Set up webhooks

Register the webhook handler in your `convex/http.ts`:

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { creem } from "./creem";

const http = httpRouter();

creem.registerRoutes(http as any, {
  // Optional: custom path (defaults to "/creem/webhook")
  path: "/creem/webhook",

  // Optional: callbacks for webhook events
  onCheckoutCompleted: async (ctx, event) => {
    console.log("Checkout completed:", event.object);
  },
  onSubscriptionCanceled: async (ctx, event) => {
    console.log("Subscription canceled:", event.object);
  },
});

export default http;
```

Then register the webhook URL in your [Creem Dashboard](https://creem.io/dashboard/developers):

```
https://<your-convex-site-url>/creem/webhook
```

Your Convex site URL can be found in your [Convex dashboard](https://dashboard.convex.dev) or via the `CONVEX_SITE_URL` system environment variable.

### 3. Sync existing products

If you created products before installing this component, sync them:

```ts
// Run once from your Convex dashboard or via a one-off action
await creem.syncProducts(ctx);
```

Or export the action and call it:

```ts
// The syncProducts function is already exported from creem.api()
// Call it from the Convex dashboard or your app
```

### 4. Add React components

```tsx
import { CheckoutLink, CustomerPortalLink } from "@creem_io/convex/react";
import { api } from "../convex/_generated/api";

function PricingPage() {
  const products = useQuery(api.creem.getConfiguredProducts);

  return (
    <div>
      {products?.proMonthly && (
        <CheckoutLink
          creemApi={api.creem}
          productId={products.proMonthly.creemProductId}
        >
          Subscribe Monthly - ${(products.proMonthly.price / 100).toFixed(2)}/mo
        </CheckoutLink>
      )}

      <CustomerPortalLink creemApi={api.creem}>
        Manage Subscription
      </CustomerPortalLink>
    </div>
  );
}
```

## Usage

### Access subscription data

Query subscription information with real-time updates:

```ts
// convex/users.ts
import { query } from "./_generated/server";
import { creem } from "./creem";

export const getCurrentUserWithSubscription = query({
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    const subscription = await creem.getCurrentSubscription(ctx, {
      userId: user._id,
    });

    return {
      ...user,
      subscription,
      isPro: subscription?.status === "active",
      productKey: subscription?.productKey, // e.g. "proMonthly"
    };
  },
});
```

### Handle subscription changes

```ts
// Cancel subscription
const cancel = useAction(api.creem.cancelCurrentSubscription);
await cancel({ mode: "immediate" }); // or "scheduled"

// Upgrade subscription
const upgrade = useAction(api.creem.upgradeCurrentSubscription);
await upgrade({ productId: "prod_new_plan_id" });
```

### Simplified access control (recommended)

Use the high-level `onGrantAccess` / `onRevokeAccess` callbacks for the most common use case — granting and revoking access:

```ts
creem.registerRoutes(http as any, {
  onGrantAccess: async (ctx, { userId, productId, subscriptionId }) => {
    // Fires on: checkout.completed, subscription.active, subscription.paid
    if (userId) {
      await ctx.runMutation(api.users.grantPremiumAccess, { userId, productId });
    }
  },
  onRevokeAccess: async (ctx, { userId, subscriptionId, reason }) => {
    // Fires on: subscription.canceled, subscription.expired
    if (userId) {
      await ctx.runMutation(api.users.revokePremiumAccess, { userId });
    }
  },
});
```

### Granular webhook event callbacks

For more control, use specific per-event callbacks. These can be combined with `onGrantAccess`/`onRevokeAccess`:

```ts
creem.registerRoutes(http as any, {
  onCheckoutCompleted: async (ctx, event) => {
    // Grant access after purchase
    const userId = event.object.metadata?.userId;
    if (userId) {
      await ctx.runMutation(api.users.grantPremiumAccess, { userId });
    }
  },
  onSubscriptionCanceled: async (ctx, event) => {
    // Revoke access on cancellation
  },
  onSubscriptionPaid: async (ctx, event) => {
    // Handle renewal payments
  },
  onRefundCreated: async (ctx, event) => {
    // Handle refunds
  },
});
```

### License management

Validate, activate, and deactivate license keys for software distribution:

```ts
const { validateLicense, activateLicense, deactivateLicense } = creem.api();

// Validate a license key
const result = await validateLicense({ key: "LIC-KEY-123" });

// Activate on a device
const activated = await activateLicense({
  key: "LIC-KEY-123",
  instanceName: "User's MacBook",
});

// Deactivate a device
await deactivateLicense({
  key: "LIC-KEY-123",
  instanceId: "inst_abc",
});
```

### Discount codes

Create and manage promotional discounts:

```ts
const { createDiscount, getDiscount, deleteDiscount } = creem.api();

// Create a 20% off discount
await createDiscount({
  code: "SAVE20",
  type: "percentage",
  amount: 20,
  maxRedemptions: 100,
});

// Apply at checkout
<CheckoutLink
  creemApi={api.creem}
  productId="prod_xxx"
  discountCode="SAVE20"
>
  Get 20% Off
</CheckoutLink>
```

### Transaction history

Query payment transactions directly:

```ts
const { getTransaction, listTransactions } = creem.api();

// Get a specific transaction
const tx = await getTransaction({ transactionId: "tx_xxx" });

// List all transactions
const txList = await listTransactions({ pageNumber: 1, pageSize: 20 });
```

## API Reference

### Creem Client

The `Creem` class accepts a configuration object:

| Option | Type | Description |
|--------|------|-------------|
| `getUserInfo` | `(ctx) => Promise<{userId, email}>` | **Required.** Returns current user info. |
| `products` | `Record<string, string>` | Map of keys to Creem product IDs. |
| `apiKey` | `string` | Creem API key. Defaults to `CREEM_API_KEY` env var. |
| `webhookSecret` | `string` | Webhook secret. Defaults to `CREEM_WEBHOOK_SECRET` env var. |
| `environment` | `"production" \| "test"` | API environment. Defaults to `CREEM_ENVIRONMENT` env var or `"test"`. |

### Query Methods

| Method | Description |
|--------|-------------|
| `getCurrentSubscription(ctx, { userId })` | Get active subscription for a user |
| `listUserSubscriptions(ctx, { userId })` | List all subscriptions for a user |
| `listProducts(ctx, { activeOnly? })` | List all synced products |
| `getProduct(ctx, { productId })` | Get a specific product |
| `listUserOrders(ctx, { userId })` | List all orders for a user |
| `getCustomerByUserId(ctx, { userId })` | Get customer record |

### Action Methods

| Method | Description |
|--------|-------------|
| `createCheckoutSession(ctx, args)` | Create a checkout and return the URL |
| `cancelSubscription(ctx, opts?)` | Cancel the current user's subscription |
| `upgradeSubscription(ctx, { productId })` | Upgrade to a different product |
| `pauseSubscription(ctx)` | Pause the current user's subscription |
| `resumeSubscription(ctx)` | Resume a paused subscription |
| `generateCustomerPortalUrl(ctx)` | Get the customer portal URL |
| `syncProducts(ctx)` | Sync all products from Creem |

### Exported API Functions

| Function | Type | Description |
|----------|------|-------------|
| `generateCheckoutLink` | Action | Create checkout link for a product |
| `generateCustomerPortalUrl` | Action | Get customer portal URL |
| `cancelCurrentSubscription` | Action | Cancel current subscription |
| `upgradeCurrentSubscription` | Action | Upgrade subscription |
| `updateCurrentSubscription` | Action | Update subscription (units, metadata) |
| `pauseCurrentSubscription` | Action | Pause current subscription |
| `resumeCurrentSubscription` | Action | Resume paused subscription |
| `createProduct` | Action | Create a new product via Creem API |
| `getConfiguredProducts` | Query | Get products by configured keys |
| `listAllProducts` | Query | List all synced products |
| `getCurrentSubscription` | Query | Get active subscription for current user |
| `listUserSubscriptions` | Query | List all subscriptions for current user |
| `listUserOrders` | Query | List all orders for current user |
| `syncProducts` | Action | Sync products from Creem API |
| `validateLicense` | Action | Validate a license key |
| `activateLicense` | Action | Activate a license on a device |
| `deactivateLicense` | Action | Deactivate a license instance |
| `createDiscount` | Action | Create a promotional discount code |
| `getDiscount` | Action | Retrieve discount details |
| `deleteDiscount` | Action | Delete a discount code |
| `getTransaction` | Action | Get a transaction by ID |
| `listTransactions` | Action | List payment transactions |
| `getCustomerFromCreem` | Action | Retrieve customer from Creem API |
| `listCustomersFromCreem` | Action | List all customers from Creem API |

### React Components

#### `<CheckoutLink>`

| Prop | Type | Description |
|------|------|-------------|
| `creemApi` | object | Object with `generateCheckoutLink` function |
| `productId` | `string` | Creem product ID |
| `successUrl` | `string?` | Redirect URL after checkout |
| `metadata` | `object?` | Custom metadata for the checkout |
| `discountCode` | `string?` | Pre-fill discount code |
| `className` | `string?` | CSS class |

#### `<CheckoutButton>`

Same props as `CheckoutLink`, but eagerly fetches the checkout URL on mount for instant click-through.

#### `<CustomerPortalLink>`

| Prop | Type | Description |
|------|------|-------------|
| `creemApi` | object | Object with `generateCustomerPortalUrl` function |
| `className` | `string?` | CSS class |

### Webhook Events

All events are automatically synced. Supported event types:

| Event | Description |
|-------|-------------|
| `checkout.completed` | Checkout session completed |
| `subscription.active` | New subscription created |
| `subscription.paid` | Subscription payment collected |
| `subscription.canceled` | Subscription canceled |
| `subscription.scheduled_cancel` | Cancellation scheduled for period end |
| `subscription.past_due` | Payment failed, retrying |
| `subscription.expired` | Subscription expired |
| `subscription.update` | Subscription updated |
| `subscription.trialing` | Subscription in trial |
| `subscription.paused` | Subscription paused |
| `refund.created` | Refund issued |
| `dispute.created` | Payment dispute created |

## Database Schema

The component stores data in these sandboxed tables:

- **customers** - Maps Creem customers to your app's user IDs
- **products** - Product catalog synced from Creem
- **subscriptions** - Subscription state with real-time updates
- **orders** - One-time and recurring order records
- **webhookEvents** - Audit log of all webhook events (idempotent)

All data is automatically kept in sync via webhooks and is queryable with Convex's real-time reactivity.

## Test Mode

Creem provides a test environment for development:

1. Set `CREEM_ENVIRONMENT=test` (this is the default)
2. Use test API keys from your Creem dashboard
3. Test payments work with any card number
4. Webhook events are sent to your test webhook URL

When ready for production, change to `CREEM_ENVIRONMENT=production` and use your live API keys.

## License

Apache-2.0
