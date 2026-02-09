/**
 * Main Creem Convex Component class.
 *
 * Usage:
 * ```ts
 * import { Creem } from "@creem_io/convex";
 * import { components } from "./_generated/api";
 *
 * export const creem = new Creem(components.creem, {
 *   getUserInfo: async (ctx) => {
 *     const user = await getUser(ctx);
 *     return { userId: user._id, email: user.email };
 *   },
 * });
 * ```
 */

import {
  type GenericActionCtx,
  type GenericDataModel,
  type HttpRouter,
  actionGeneric,
  httpActionGeneric,
  queryGeneric,
} from "convex/server";
import { type Infer, v } from "convex/values";
import schema from "../component/schema.js";
import type { ComponentApi } from "../component/_generated/component.js";
import {
  createCheckout,
  cancelSubscription as apiCancelSubscription,
  upgradeSubscription as apiUpgradeSubscription,
  updateSubscription as apiUpdateSubscription,
  generateCustomerBillingLink,
  listAllProducts as apiListAllProducts,
  createProduct as apiCreateProduct,
  getCustomer as apiGetCustomer,
  listCustomers as apiListCustomers,
  getTransaction as apiGetTransaction,
  listTransactions as apiListTransactions,
  validateLicense as apiValidateLicense,
  activateLicense as apiActivateLicense,
  deactivateLicense as apiDeactivateLicense,
  createDiscount as apiCreateDiscount,
  getDiscount as apiGetDiscount,
  deleteDiscount as apiDeleteDiscount,
  type CreemApiConfig,
} from "./creem-api.js";
import type {
  WebhookEventType,
  CheckoutCompletedEvent,
  SubscriptionEvent,
  RefundCreatedEvent,
  DisputeCreatedEvent,
  CreateCheckoutRequest,
  CreateProductRequest,
  UpdateSubscriptionRequest,
  CancelSubscriptionRequest,
  ValidateLicenseRequest,
  ActivateLicenseRequest,
  DeactivateLicenseRequest,
  CreateDiscountRequest,
  CreemProduct,
  CreemCustomer,
} from "../types.js";
import { createHmac } from "crypto";

// ─── Exported Types ──────────────────────────────────────────────────

export const subscriptionValidator = schema.tables.subscriptions.validator;
export type Subscription = Infer<typeof subscriptionValidator>;

export const productValidator = schema.tables.products.validator;
export type Product = Infer<typeof productValidator>;

export const orderValidator = schema.tables.orders.validator;
export type Order = Infer<typeof orderValidator>;

// Re-export types
export type { ComponentApi } from "../component/_generated/component.js";
export * from "../types.js";
export { type CreemApiConfig } from "./creem-api.js";

// ─── Context Types ───────────────────────────────────────────────────

type RunQueryCtx = {
  runQuery: GenericActionCtx<GenericDataModel>["runQuery"];
};

type RunMutationCtx = {
  runQuery: GenericActionCtx<GenericDataModel>["runQuery"];
  runMutation: GenericActionCtx<GenericDataModel>["runMutation"];
};

type RunActionCtx = {
  runQuery: GenericActionCtx<GenericDataModel>["runQuery"];
  runMutation: GenericActionCtx<GenericDataModel>["runMutation"];
  runAction: GenericActionCtx<GenericDataModel>["runAction"];
};

// ─── Webhook Signature Verification ──────────────────────────────────

function verifyCreemSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const computed = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return computed === signature;
}

// ─── Helper to extract IDs from webhook objects ──────────────────────

function extractProductId(product: CreemProduct | string): string {
  return typeof product === "string" ? product : product.id;
}

function extractCustomerId(customer: CreemCustomer | string): string {
  return typeof customer === "string" ? customer : customer.id;
}

// ─── Main Creem Class ────────────────────────────────────────────────

export class Creem<
  Products extends Record<string, string> = Record<string, string>,
> {
  public products: Products;
  private apiKey: string;
  private webhookSecret: string;
  private environment: "production" | "test";

  constructor(
    public component: ComponentApi,
    private config: {
      /**
       * Map of product keys to Creem product IDs.
       * Keys are your own names (e.g. "proMonthly", "proYearly").
       */
      products?: Products;
      /**
       * Function to get the current user's ID and email.
       * Used for creating checkouts and managing subscriptions.
       */
      getUserInfo: (ctx: RunQueryCtx) => Promise<{
        userId: string;
        email: string;
      }>;
      /** Creem API key. Defaults to CREEM_API_KEY env var. */
      apiKey?: string;
      /** Creem webhook secret. Defaults to CREEM_WEBHOOK_SECRET env var. */
      webhookSecret?: string;
      /** "production" or "test". Defaults to CREEM_ENVIRONMENT env var or "test". */
      environment?: "production" | "test";
    },
  ) {
    this.products = config.products ?? ({} as Products);
    this.apiKey = config.apiKey ?? process.env["CREEM_API_KEY"] ?? "";
    this.webhookSecret =
      config.webhookSecret ?? process.env["CREEM_WEBHOOK_SECRET"] ?? "";
    this.environment =
      config.environment ??
      (process.env["CREEM_ENVIRONMENT"] as "production" | "test") ??
      "test";
  }

  private getApiConfig(): CreemApiConfig {
    return {
      apiKey: this.apiKey,
      environment: this.environment,
    };
  }

  // ─── Query Methods ───────────────────────────────────────────────

  /**
   * Get the current subscription for a user.
   * Returns null if no active subscription exists.
   */
  async getCurrentSubscription(ctx: RunQueryCtx, { userId }: { userId: string }) {
    const subscription = await ctx.runQuery(
      this.component.lib.getCurrentSubscription,
      { userId },
    );
    if (!subscription) {
      return null;
    }
    const productKey = (
      Object.keys(this.products) as Array<keyof Products & string>
    ).find((key) => this.products[key] === subscription.creemProductId);
    return {
      ...subscription,
      productKey: productKey ?? null,
    };
  }

  /**
   * List all subscriptions for a user.
   */
  async listUserSubscriptions(ctx: RunQueryCtx, { userId }: { userId: string }) {
    return ctx.runQuery(this.component.lib.listUserSubscriptions, { userId });
  }

  /**
   * List all products synced from Creem.
   */
  async listProducts(ctx: RunQueryCtx, opts?: { activeOnly?: boolean }) {
    return ctx.runQuery(this.component.lib.listProducts, {
      activeOnly: opts?.activeOnly,
    });
  }

  /**
   * Get a specific product by Creem product ID.
   */
  async getProduct(ctx: RunQueryCtx, { productId }: { productId: string }) {
    return ctx.runQuery(this.component.lib.getProduct, {
      creemProductId: productId,
    });
  }

  /**
   * List all orders for a user.
   */
  async listUserOrders(ctx: RunQueryCtx, { userId }: { userId: string }) {
    return ctx.runQuery(this.component.lib.listUserOrders, { userId });
  }

  /**
   * Get the customer record for a user.
   */
  async getCustomerByUserId(ctx: RunQueryCtx, { userId }: { userId: string }) {
    return ctx.runQuery(this.component.lib.getCustomerByUserId, { userId });
  }

  // ─── Action Methods ──────────────────────────────────────────────

  /**
   * Create a checkout session and return the checkout URL.
   */
  async createCheckoutSession(
    ctx: RunMutationCtx,
    args: {
      productId: string;
      userId: string;
      email: string;
      successUrl?: string;
      metadata?: Record<string, unknown>;
      discountCode?: string;
    },
  ) {
    // Ensure customer record exists
    const existingCustomer = await ctx.runQuery(
      this.component.lib.getCustomerByUserId,
      { userId: args.userId },
    );

    const requestData: CreateCheckoutRequest = {
      product_id: args.productId,
      success_url: args.successUrl,
      metadata: {
        ...args.metadata,
        userId: args.userId,
      },
      discount_code: args.discountCode,
    };

    // If we already know the Creem customer, pass it
    if (existingCustomer) {
      requestData.customer = { id: existingCustomer.creemCustomerId };
    } else {
      requestData.customer = { email: args.email };
    }

    const checkout = await createCheckout(this.getApiConfig(), requestData);

    // Store customer mapping if we get it from the checkout response
    if (checkout.customer && !existingCustomer) {
      const customerId =
        typeof checkout.customer === "string"
          ? checkout.customer
          : checkout.customer.id;
      await ctx.runMutation(this.component.lib.insertCustomer, {
        creemCustomerId: customerId,
        userId: args.userId,
        email: args.email,
      });
    }

    return checkout;
  }

  /**
   * Cancel the current user's subscription.
   */
  async cancelSubscription(
    ctx: RunActionCtx,
    opts?: CancelSubscriptionRequest,
  ) {
    const { userId } = await this.config.getUserInfo(ctx);
    const subscription = await this.getCurrentSubscription(ctx, { userId });
    if (!subscription) {
      throw new Error("No active subscription found");
    }
    return apiCancelSubscription(
      this.getApiConfig(),
      subscription.creemSubscriptionId,
      opts,
    );
  }

  /**
   * Upgrade/change the current user's subscription to a different product.
   */
  async upgradeSubscription(
    ctx: RunActionCtx,
    { productId }: { productId: string },
  ) {
    const { userId } = await this.config.getUserInfo(ctx);
    const subscription = await this.getCurrentSubscription(ctx, { userId });
    if (!subscription) {
      throw new Error("No active subscription found");
    }
    if (subscription.creemProductId === productId) {
      throw new Error("Already subscribed to this product");
    }
    return apiUpgradeSubscription(
      this.getApiConfig(),
      subscription.creemSubscriptionId,
      productId,
    );
  }

  /**
   * Pause the current user's subscription.
   */
  async pauseSubscription(ctx: RunActionCtx) {
    const { userId } = await this.config.getUserInfo(ctx);
    const subscription = await this.getCurrentSubscription(ctx, { userId });
    if (!subscription) {
      throw new Error("No active subscription found");
    }
    const { pauseSubscription: apiPause } = await import("./creem-api.js");
    return apiPause(this.getApiConfig(), subscription.creemSubscriptionId);
  }

  /**
   * Resume the current user's paused subscription.
   */
  async resumeSubscription(ctx: RunActionCtx) {
    const { userId } = await this.config.getUserInfo(ctx);
    const subscription = await this.getCurrentSubscription(ctx, { userId });
    if (!subscription) {
      throw new Error("No paused subscription found");
    }
    const { resumeSubscription: apiResume } = await import("./creem-api.js");
    return apiResume(this.getApiConfig(), subscription.creemSubscriptionId);
  }

  /**
   * Generate a customer portal link for the current user.
   */
  async generateCustomerPortalUrl(ctx: RunActionCtx) {
    const { userId } = await this.config.getUserInfo(ctx);
    const customer = await ctx.runQuery(
      this.component.lib.getCustomerByUserId,
      { userId },
    );
    if (!customer) {
      throw new Error("Customer not found. User has not completed a checkout.");
    }
    const result = await generateCustomerBillingLink(
      this.getApiConfig(),
      customer.creemCustomerId,
    );
    return { url: result.customer_portal_link };
  }

  /**
   * Sync all products from Creem into the component database.
   */
  async syncProducts(ctx: RunMutationCtx) {
    let currentPage = 1;
    let totalPages = 1;

    do {
      const response = await apiListAllProducts(
        this.getApiConfig(),
        currentPage,
      );
      for (const product of response.items) {
        await ctx.runMutation(this.component.lib.upsertProduct, {
          creemProductId: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          currency: product.currency,
          billingType: product.billing_type,
          billingPeriod: product.billing_period ?? null,
          status: product.status,
          taxMode: product.tax_mode,
          taxCategory:
            typeof product.tax_category === "string"
              ? product.tax_category
              : undefined,
          imageUrl: product.image_url,
          productUrl: product.product_url,
          defaultSuccessUrl: product.default_success_url,
          features: product.features,
          createdAt: product.created_at,
          updatedAt: product.updated_at,
          mode: product.mode,
        });
      }
      totalPages = response.pagination.total_pages;
      currentPage++;
    } while (currentPage <= totalPages);
  }

  // ─── Exported API Functions ──────────────────────────────────────

  /**
   * Returns Convex functions that you export from your own file.
   *
   * Example:
   * ```ts
   * export const {
   *   generateCheckoutLink,
   *   generateCustomerPortalUrl,
   *   cancelCurrentSubscription,
   *   upgradeCurrentSubscription,
   *   getConfiguredProducts,
   *   listAllProducts,
   * } = creem.api();
   * ```
   */
  api() {
    return {
      generateCheckoutLink: actionGeneric({
        args: {
          productId: v.string(),
          successUrl: v.optional(v.string()),
          metadata: v.optional(v.record(v.string(), v.any())),
          discountCode: v.optional(v.string()),
        },
        returns: v.object({
          url: v.string(),
          checkoutId: v.string(),
        }),
        handler: async (ctx, args) => {
          const { userId, email } = await this.config.getUserInfo(ctx);
          const checkout = await this.createCheckoutSession(ctx, {
            productId: args.productId,
            userId,
            email,
            successUrl: args.successUrl ?? undefined,
            metadata: args.metadata as Record<string, unknown> | undefined,
            discountCode: args.discountCode ?? undefined,
          });
          return {
            url: checkout.checkout_url,
            checkoutId: checkout.id,
          };
        },
      }),

      generateCustomerPortalUrl: actionGeneric({
        args: {},
        returns: v.object({ url: v.string() }),
        handler: async (ctx) => {
          return this.generateCustomerPortalUrl(ctx);
        },
      }),

      cancelCurrentSubscription: actionGeneric({
        args: {
          mode: v.optional(
            v.union(v.literal("immediate"), v.literal("scheduled")),
          ),
        },
        handler: async (ctx, args) => {
          await this.cancelSubscription(ctx, {
            mode: args.mode ?? undefined,
          });
        },
      }),

      upgradeCurrentSubscription: actionGeneric({
        args: {
          productId: v.string(),
        },
        handler: async (ctx, args) => {
          await this.upgradeSubscription(ctx, {
            productId: args.productId,
          });
        },
      }),

      getConfiguredProducts: queryGeneric({
        args: {},
        handler: async (ctx) => {
          const products = await this.listProducts(ctx, { activeOnly: true });
          const result: Record<string, (typeof products)[number] | undefined> =
            {};
          for (const [key, productId] of Object.entries(this.products)) {
            result[key] = products.find((p: { creemProductId: string }) => p.creemProductId === productId);
          }
          return result;
        },
      }),

      listAllProducts: queryGeneric({
        args: {},
        handler: async (ctx) => {
          return this.listProducts(ctx);
        },
      }),

      syncProducts: actionGeneric({
        args: {},
        handler: async (ctx) => {
          await this.syncProducts(ctx);
        },
      }),

      // ── Product Management ──────────────────────────────────────

      createProduct: actionGeneric({
        args: {
          name: v.string(),
          price: v.number(),
          currency: v.string(),
          billingType: v.union(v.literal("recurring"), v.literal("one-time")),
          description: v.optional(v.string()),
          billingPeriod: v.optional(v.string()),
          taxMode: v.optional(
            v.union(v.literal("inclusive"), v.literal("exclusive")),
          ),
          taxCategory: v.optional(v.string()),
          imageUrl: v.optional(v.string()),
          defaultSuccessUrl: v.optional(v.string()),
        },
        handler: async (ctx, args) => {
          const data: CreateProductRequest = {
            name: args.name,
            price: args.price,
            currency: args.currency as "USD" | "EUR" | "GBP",
            billing_type: args.billingType as "recurring" | "one-time",
            description: args.description ?? undefined,
            billing_period: args.billingPeriod ?? undefined,
            tax_mode: args.taxMode
              ? (args.taxMode as "inclusive" | "exclusive")
              : undefined,
            tax_category: args.taxCategory ?? undefined,
            image_url: args.imageUrl ?? undefined,
            default_success_url: args.defaultSuccessUrl ?? undefined,
          };
          const product = await apiCreateProduct(this.getApiConfig(), data);

          // Sync to component DB
          await ctx.runMutation(this.component.lib.upsertProduct, {
            creemProductId: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            currency: product.currency,
            billingType: product.billing_type,
            billingPeriod: product.billing_period ?? null,
            status: product.status,
            taxMode: product.tax_mode,
            taxCategory:
              typeof product.tax_category === "string"
                ? product.tax_category
                : undefined,
            imageUrl: product.image_url,
            createdAt: product.created_at,
            updatedAt: product.updated_at,
            mode: product.mode,
          });

          return { productId: product.id };
        },
      }),

      // ── Subscription Management (extended) ─────────────────────

      updateCurrentSubscription: actionGeneric({
        args: {
          units: v.optional(v.number()),
          metadata: v.optional(v.record(v.string(), v.any())),
        },
        handler: async (ctx, args) => {
          const { userId } = await this.config.getUserInfo(ctx);
          const sub = await ctx.runQuery(
            this.component.lib.getCurrentSubscription,
            { userId },
          );
          if (!sub) {
            throw new Error("No active subscription found");
          }
          const data: UpdateSubscriptionRequest = {
            units: args.units ?? undefined,
            metadata: args.metadata as Record<string, unknown> | undefined,
          };
          await apiUpdateSubscription(
            this.getApiConfig(),
            sub.creemSubscriptionId,
            data,
          );
        },
      }),

      pauseCurrentSubscription: actionGeneric({
        args: {},
        handler: async (ctx) => {
          await this.pauseSubscription(ctx);
        },
      }),

      resumeCurrentSubscription: actionGeneric({
        args: {},
        handler: async (ctx) => {
          await this.resumeSubscription(ctx);
        },
      }),

      // ── Transaction Queries ────────────────────────────────────

      getTransaction: actionGeneric({
        args: { transactionId: v.string() },
        handler: async (_ctx, args) => {
          return apiGetTransaction(this.getApiConfig(), args.transactionId);
        },
      }),

      listTransactions: actionGeneric({
        args: {
          pageNumber: v.optional(v.number()),
          pageSize: v.optional(v.number()),
        },
        handler: async (_ctx, args) => {
          return apiListTransactions(
            this.getApiConfig(),
            args.pageNumber ?? 1,
            args.pageSize ?? 20,
          );
        },
      }),

      // ── License Management ─────────────────────────────────────

      validateLicense: actionGeneric({
        args: {
          key: v.string(),
          instanceId: v.optional(v.string()),
        },
        handler: async (_ctx, args) => {
          const data: ValidateLicenseRequest = {
            key: args.key,
            instance_id: args.instanceId ?? undefined,
          };
          return apiValidateLicense(this.getApiConfig(), data);
        },
      }),

      activateLicense: actionGeneric({
        args: {
          key: v.string(),
          instanceName: v.optional(v.string()),
        },
        handler: async (_ctx, args) => {
          const data: ActivateLicenseRequest = {
            key: args.key,
            instance_name: args.instanceName ?? undefined,
          };
          return apiActivateLicense(this.getApiConfig(), data);
        },
      }),

      deactivateLicense: actionGeneric({
        args: {
          key: v.string(),
          instanceId: v.string(),
        },
        handler: async (_ctx, args) => {
          const data: DeactivateLicenseRequest = {
            key: args.key,
            instance_id: args.instanceId,
          };
          return apiDeactivateLicense(this.getApiConfig(), data);
        },
      }),

      // ── Discount Management ────────────────────────────────────

      createDiscount: actionGeneric({
        args: {
          code: v.string(),
          type: v.union(v.literal("percentage"), v.literal("fixed")),
          amount: v.number(),
          currency: v.optional(v.string()),
          productId: v.optional(v.string()),
          maxRedemptions: v.optional(v.number()),
          expiresAt: v.optional(v.string()),
        },
        handler: async (_ctx, args) => {
          const data: CreateDiscountRequest = {
            code: args.code,
            type: args.type as "percentage" | "fixed",
            amount: args.amount,
            currency: args.currency ?? undefined,
            product_id: args.productId ?? undefined,
            max_redemptions: args.maxRedemptions ?? undefined,
            expires_at: args.expiresAt ?? undefined,
          };
          return apiCreateDiscount(this.getApiConfig(), data);
        },
      }),

      getDiscount: actionGeneric({
        args: { discountId: v.string() },
        handler: async (_ctx, args) => {
          return apiGetDiscount(this.getApiConfig(), args.discountId);
        },
      }),

      deleteDiscount: actionGeneric({
        args: { discountId: v.string() },
        handler: async (_ctx, args) => {
          await apiDeleteDiscount(this.getApiConfig(), args.discountId);
        },
      }),

      // ── Customer Queries ───────────────────────────────────────

      getCustomerFromCreem: actionGeneric({
        args: { customerId: v.string() },
        handler: async (_ctx, args) => {
          return apiGetCustomer(this.getApiConfig(), args.customerId);
        },
      }),

      listCustomersFromCreem: actionGeneric({
        args: {
          pageNumber: v.optional(v.number()),
          pageSize: v.optional(v.number()),
        },
        handler: async (_ctx, args) => {
          return apiListCustomers(
            this.getApiConfig(),
            args.pageNumber ?? 1,
            args.pageSize ?? 100,
          );
        },
      }),

      // ── Subscription Status Queries ────────────────────────────

      getCurrentSubscription: queryGeneric({
        args: {},
        handler: async (ctx) => {
          const { userId } = await this.config.getUserInfo(ctx);
          return ctx.runQuery(this.component.lib.getCurrentSubscription, {
            userId,
          });
        },
      }),

      listUserSubscriptions: queryGeneric({
        args: {},
        handler: async (ctx) => {
          const { userId } = await this.config.getUserInfo(ctx);
          return ctx.runQuery(this.component.lib.listUserSubscriptions, {
            userId,
          });
        },
      }),

      listUserOrders: queryGeneric({
        args: {},
        handler: async (ctx) => {
          const { userId } = await this.config.getUserInfo(ctx);
          return ctx.runQuery(this.component.lib.listUserOrders, { userId });
        },
      }),
    };
  }

  // ─── Webhook Route Registration ─────────────────────────────────

  /**
   * Register the webhook HTTP route for Creem events.
   *
   * Example:
   * ```ts
   * // convex/http.ts
   * import { httpRouter } from "convex/server";
   * import { creem } from "./creem";
   *
   * const http = httpRouter();
   * creem.registerRoutes(http as any);
   * export default http;
   * ```
   */
  registerRoutes(
    http: HttpRouter,
    options?: {
      /** Custom webhook endpoint path. Defaults to "/creem/webhook". */
      path?: string;

      /** Called when a checkout is completed. */
      onCheckoutCompleted?: (
        ctx: RunMutationCtx,
        event: CheckoutCompletedEvent,
      ) => Promise<void>;

      /** Called when a subscription becomes active. */
      onSubscriptionActive?: (
        ctx: RunMutationCtx,
        event: SubscriptionEvent,
      ) => Promise<void>;

      /** Called when a subscription payment is collected. */
      onSubscriptionPaid?: (
        ctx: RunMutationCtx,
        event: SubscriptionEvent,
      ) => Promise<void>;

      /** Called when a subscription is canceled. */
      onSubscriptionCanceled?: (
        ctx: RunMutationCtx,
        event: SubscriptionEvent,
      ) => Promise<void>;

      /** Called when a subscription is scheduled for cancellation. */
      onSubscriptionScheduledCancel?: (
        ctx: RunMutationCtx,
        event: SubscriptionEvent,
      ) => Promise<void>;

      /** Called when a subscription payment is past due. */
      onSubscriptionPastDue?: (
        ctx: RunMutationCtx,
        event: SubscriptionEvent,
      ) => Promise<void>;

      /** Called when a subscription expires. */
      onSubscriptionExpired?: (
        ctx: RunMutationCtx,
        event: SubscriptionEvent,
      ) => Promise<void>;

      /** Called when a subscription is updated. */
      onSubscriptionUpdate?: (
        ctx: RunMutationCtx,
        event: SubscriptionEvent,
      ) => Promise<void>;

      /** Called when a subscription enters trial. */
      onSubscriptionTrialing?: (
        ctx: RunMutationCtx,
        event: SubscriptionEvent,
      ) => Promise<void>;

      /** Called when a subscription is paused. */
      onSubscriptionPaused?: (
        ctx: RunMutationCtx,
        event: SubscriptionEvent,
      ) => Promise<void>;

      /** Called when a refund is created. */
      onRefundCreated?: (
        ctx: RunMutationCtx,
        event: RefundCreatedEvent,
      ) => Promise<void>;

      /** Called when a dispute is created. */
      onDisputeCreated?: (
        ctx: RunMutationCtx,
        event: DisputeCreatedEvent,
      ) => Promise<void>;

      // ── High-Level Simplified Callbacks ──────────────────────

      /**
       * Called when access should be granted to the user.
       * Fires on: checkout.completed, subscription.active, subscription.paid
       *
       * This is a simplified callback for the most common use case:
       * granting the user access to your product.
       */
      onGrantAccess?: (
        ctx: RunMutationCtx,
        data: {
          userId: string | undefined;
          customerId: string;
          productId: string;
          subscriptionId?: string;
          orderId?: string;
          metadata?: Record<string, unknown>;
        },
      ) => Promise<void>;

      /**
       * Called when access should be revoked from the user.
       * Fires on: subscription.canceled, subscription.expired
       *
       * This is a simplified callback for the most common use case:
       * revoking the user's access to your product.
       */
      onRevokeAccess?: (
        ctx: RunMutationCtx,
        data: {
          userId: string | undefined;
          customerId: string;
          productId: string;
          subscriptionId: string;
          reason: "canceled" | "expired";
        },
      ) => Promise<void>;
    },
  ) {
    const path = options?.path ?? "/creem/webhook";

    http.route({
      path,
      method: "POST",
      handler: httpActionGeneric(async (ctx, request) => {
        if (!request.body) {
          return new Response("No body", { status: 400 });
        }

        const body = await request.text();
        const signature = request.headers.get("creem-signature");

        // Verify webhook signature
        if (!signature || !verifyCreemSignature(body, signature, this.webhookSecret)) {
          console.error("Invalid webhook signature");
          return new Response("Forbidden", { status: 403 });
        }

        let event: {
          id: string;
          eventType: WebhookEventType;
          created_at: number;
          object: Record<string, unknown>;
        };
        try {
          event = JSON.parse(body);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        // Log the webhook event (idempotent)
        const inserted = await ctx.runMutation(
          this.component.lib.insertWebhookEvent,
          {
            creemEventId: event.id,
            eventType: event.eventType,
            payload: event.object,
          },
        );

        // If already processed, return 200 (idempotent)
        if (inserted === null) {
          return new Response("Already processed", { status: 200 });
        }

        try {
          await this.processWebhookEvent(ctx, event, options);
        } catch (error) {
          console.error("Error processing webhook event:", error);
          // Still return 200 so Creem doesn't retry for application errors
          // The event is logged and can be reprocessed manually
        }

        return new Response("OK", { status: 200 });
      }),
    });
  }

  private async processWebhookEvent(
    ctx: RunMutationCtx,
    event: {
      id: string;
      eventType: WebhookEventType;
      created_at: number;
      object: Record<string, unknown>;
    },
    options?: Parameters<Creem<Products>["registerRoutes"]>[1],
  ) {
    const obj = event.object;

    switch (event.eventType) {
      case "checkout.completed": {
        // Upsert customer
        const customer = obj.customer as {
          id: string;
          email?: string;
          name?: string;
          country?: string;
        };
        const product = obj.product as CreemProduct;
        const order = obj.order as {
          id: string;
          customer: string;
          product: string;
          amount: number;
          currency: string;
          status: string;
          type: string;
          created_at: string;
          updated_at: string;
        };
        const metadata = obj.metadata as Record<string, unknown> | undefined;
        const userId =
          (metadata?.userId as string) ?? (metadata?.referenceId as string);

        if (customer && userId) {
          await ctx.runMutation(this.component.lib.upsertCustomer, {
            creemCustomerId: customer.id,
            userId,
            email: customer.email,
            name: customer.name,
            country: customer.country,
          });
        }

        // Upsert product
        if (product && typeof product === "object") {
          await ctx.runMutation(this.component.lib.upsertProduct, {
            creemProductId: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            currency: product.currency,
            billingType: product.billing_type,
            billingPeriod: product.billing_period ?? null,
            status: product.status,
            taxMode: product.tax_mode,
            taxCategory:
              typeof product.tax_category === "string"
                ? product.tax_category
                : undefined,
            imageUrl: product.image_url,
            createdAt: product.created_at,
            updatedAt: product.updated_at,
            mode: product.mode,
          });
        }

        // Upsert order
        if (order) {
          await ctx.runMutation(this.component.lib.upsertOrder, {
            creemOrderId: order.id,
            creemCustomerId: customer?.id ?? order.customer,
            creemProductId: product?.id ?? order.product,
            userId,
            amount: order.amount,
            currency: order.currency,
            status: order.status,
            type: order.type,
            metadata,
            createdAt: order.created_at,
            updatedAt: order.updated_at,
            mode: obj.mode as string | undefined,
          });
        }

        // Upsert subscription if present
        const subscription = obj.subscription as
          | {
              id: string;
              product: CreemProduct | string;
              customer: CreemCustomer | string;
              collection_method?: string;
              status: string;
              created_at: string;
              updated_at: string;
              metadata?: Record<string, unknown>;
            }
          | undefined;

        if (subscription && typeof subscription === "object") {
          await ctx.runMutation(this.component.lib.upsertSubscription, {
            creemSubscriptionId: subscription.id,
            creemCustomerId: customer?.id ?? extractCustomerId(subscription.customer),
            creemProductId: product?.id ?? extractProductId(subscription.product),
            userId,
            status: subscription.status,
            collectionMethod: subscription.collection_method,
            metadata: subscription.metadata ?? metadata,
            createdAt: subscription.created_at,
            updatedAt: subscription.updated_at,
            mode: obj.mode as string | undefined,
          });
        }

        await options?.onCheckoutCompleted?.(
          ctx,
          event as unknown as CheckoutCompletedEvent,
        );

        // Fire high-level onGrantAccess callback
        if (options?.onGrantAccess) {
          await options.onGrantAccess(ctx, {
            userId,
            customerId: customer?.id,
            productId: product?.id ?? order?.product,
            subscriptionId: subscription?.id,
            orderId: order?.id,
            metadata,
          });
        }

        break;
      }

      case "subscription.active":
      case "subscription.paid":
      case "subscription.canceled":
      case "subscription.scheduled_cancel":
      case "subscription.past_due":
      case "subscription.expired":
      case "subscription.update":
      case "subscription.trialing":
      case "subscription.paused": {
        const sub = obj as {
          id: string;
          product: CreemProduct | string;
          customer: CreemCustomer | string;
          collection_method?: string;
          status: string;
          last_transaction_id?: string;
          last_transaction_date?: string;
          next_transaction_date?: string;
          current_period_start_date?: string;
          current_period_end_date?: string;
          canceled_at?: string | null;
          created_at: string;
          updated_at: string;
          metadata?: Record<string, unknown>;
          mode?: string;
        };

        const productId = extractProductId(sub.product);
        const customerId = extractCustomerId(sub.customer);

        // Upsert product if full object provided
        if (typeof sub.product === "object") {
          await ctx.runMutation(this.component.lib.upsertProduct, {
            creemProductId: sub.product.id,
            name: sub.product.name,
            description: sub.product.description,
            price: sub.product.price,
            currency: sub.product.currency,
            billingType: sub.product.billing_type,
            billingPeriod: sub.product.billing_period ?? null,
            status: sub.product.status,
            taxMode: sub.product.tax_mode,
            taxCategory:
              typeof sub.product.tax_category === "string"
                ? sub.product.tax_category
                : undefined,
            imageUrl: sub.product.image_url,
            createdAt: sub.product.created_at,
            updatedAt: sub.product.updated_at,
            mode: sub.product.mode,
          });
        }

        // Upsert customer if full object provided
        if (typeof sub.customer === "object") {
          // Look up userId from existing customer record or metadata
          const existingCustomer = await ctx.runQuery(
            this.component.lib.getCustomerByCreemId,
            { creemCustomerId: sub.customer.id },
          );
          const userId =
            existingCustomer?.userId ??
            (sub.metadata?.userId as string) ??
            undefined;

          if (userId) {
            await ctx.runMutation(this.component.lib.upsertCustomer, {
              creemCustomerId: sub.customer.id,
              userId,
              email: sub.customer.email,
              name: sub.customer.name,
              country: sub.customer.country,
            });
          }
        }

        await ctx.runMutation(this.component.lib.upsertSubscription, {
          creemSubscriptionId: sub.id,
          creemCustomerId: customerId,
          creemProductId: productId,
          status: sub.status,
          collectionMethod: sub.collection_method,
          lastTransactionId: sub.last_transaction_id ?? null,
          lastTransactionDate: sub.last_transaction_date ?? null,
          nextTransactionDate: sub.next_transaction_date ?? null,
          currentPeriodStartDate: sub.current_period_start_date ?? null,
          currentPeriodEndDate: sub.current_period_end_date ?? null,
          canceledAt: sub.canceled_at ?? null,
          metadata: sub.metadata,
          createdAt: sub.created_at,
          updatedAt: sub.updated_at,
          mode: sub.mode,
        });

        // Resolve userId from existing customer record
        let resolvedUserId: string | undefined;
        const existingCust = await ctx.runQuery(
          this.component.lib.getCustomerByCreemId,
          { creemCustomerId: customerId },
        );
        resolvedUserId =
          existingCust?.userId ??
          (sub.metadata?.userId as string | undefined) ??
          undefined;

        // Dispatch to the appropriate callback
        const subEvent = event as unknown as SubscriptionEvent;
        switch (event.eventType) {
          case "subscription.active":
            await options?.onSubscriptionActive?.(ctx, subEvent);
            // Fire onGrantAccess
            if (options?.onGrantAccess) {
              await options.onGrantAccess(ctx, {
                userId: resolvedUserId,
                customerId,
                productId,
                subscriptionId: sub.id,
                metadata: sub.metadata,
              });
            }
            break;
          case "subscription.paid":
            await options?.onSubscriptionPaid?.(ctx, subEvent);
            // Fire onGrantAccess (renewal confirms continued access)
            if (options?.onGrantAccess) {
              await options.onGrantAccess(ctx, {
                userId: resolvedUserId,
                customerId,
                productId,
                subscriptionId: sub.id,
                metadata: sub.metadata,
              });
            }
            break;
          case "subscription.canceled":
            await options?.onSubscriptionCanceled?.(ctx, subEvent);
            // Fire onRevokeAccess
            if (options?.onRevokeAccess) {
              await options.onRevokeAccess(ctx, {
                userId: resolvedUserId,
                customerId,
                productId,
                subscriptionId: sub.id,
                reason: "canceled",
              });
            }
            break;
          case "subscription.scheduled_cancel":
            await options?.onSubscriptionScheduledCancel?.(ctx, subEvent);
            break;
          case "subscription.past_due":
            await options?.onSubscriptionPastDue?.(ctx, subEvent);
            break;
          case "subscription.expired":
            await options?.onSubscriptionExpired?.(ctx, subEvent);
            // Fire onRevokeAccess
            if (options?.onRevokeAccess) {
              await options.onRevokeAccess(ctx, {
                userId: resolvedUserId,
                customerId,
                productId,
                subscriptionId: sub.id,
                reason: "expired",
              });
            }
            break;
          case "subscription.update":
            await options?.onSubscriptionUpdate?.(ctx, subEvent);
            break;
          case "subscription.trialing":
            await options?.onSubscriptionTrialing?.(ctx, subEvent);
            break;
          case "subscription.paused":
            await options?.onSubscriptionPaused?.(ctx, subEvent);
            break;
        }
        break;
      }

      case "refund.created": {
        await options?.onRefundCreated?.(
          ctx,
          event as unknown as RefundCreatedEvent,
        );
        break;
      }

      case "dispute.created": {
        await options?.onDisputeCreated?.(
          ctx,
          event as unknown as DisputeCreatedEvent,
        );
        break;
      }
    }
  }
}
