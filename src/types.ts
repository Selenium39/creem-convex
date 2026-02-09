/**
 * CREEM API TypeScript types.
 *
 * These types match the CREEM API responses and webhook payloads.
 * @see https://docs.creem.io/api-reference/introduction
 */

// ─── Common ──────────────────────────────────────────────────────────

export type CreemMode = "test" | "prod" | "sandbox";

export type Currency = "USD" | "EUR" | "GBP" | string;

// ─── Product ─────────────────────────────────────────────────────────

export type BillingType = "recurring" | "one-time";

export type BillingPeriod =
  | "every-month"
  | "every-3-months"
  | "every-6-months"
  | "every-year"
  | string;

export type TaxMode = "inclusive" | "exclusive";

export type TaxCategory = "saas" | "digital-goods-service" | "ebooks" | string;

export interface ProductFeature {
  id: string;
  type: string;
  description: string;
}

export interface CreemProduct {
  id: string;
  mode: CreemMode;
  object: string;
  name: string;
  description: string | null;
  price: number;
  currency: Currency;
  billing_type: BillingType;
  billing_period?: BillingPeriod;
  status: string;
  tax_mode: TaxMode;
  tax_category: TaxCategory;
  created_at: string;
  updated_at: string;
  image_url: string | null;
  features?: ProductFeature[];
  product_url?: string;
  default_success_url?: string;
}

// ─── Customer ────────────────────────────────────────────────────────

export interface CreemCustomer {
  id: string;
  mode?: CreemMode;
  object: string;
  email: string;
  name: string;
  country: string;
  created_at: string;
  updated_at: string;
}

// ─── Order ───────────────────────────────────────────────────────────

export type OrderStatus = "pending" | "paid" | "refunded" | "failed";
export type OrderType = "recurring" | "one-time";

export interface CreemOrder {
  id: string;
  mode?: CreemMode;
  object?: string;
  customer: string;
  product: string;
  amount: number;
  currency: Currency;
  status: OrderStatus;
  type: OrderType;
  created_at: string;
  updated_at: string;
  transaction?: string;
  discount?: string;
  sub_total?: number;
  tax_amount?: number;
  discount_amount?: number;
  amount_due?: number;
  amount_paid?: number;
  fx_amount?: number;
  fx_currency?: string;
  fx_rate?: number;
  affiliate?: string;
}

// ─── Subscription ────────────────────────────────────────────────────

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "unpaid"
  | "paused"
  | "trialing"
  | "scheduled_cancel"
  | "past_due"
  | "expired";

export interface CreemSubscription {
  id: string;
  mode?: CreemMode;
  object: string;
  product: CreemProduct | string;
  customer: CreemCustomer | string;
  collection_method: string;
  status: SubscriptionStatus;
  created_at: string;
  updated_at: string;
  items?: SubscriptionItem[];
  last_transaction_id?: string;
  last_transaction?: CreemTransaction;
  last_transaction_date?: string;
  next_transaction_date?: string;
  current_period_start_date?: string;
  current_period_end_date?: string;
  canceled_at?: string | null;
  metadata?: Record<string, unknown>;
  discount?: Record<string, unknown>;
}

export interface SubscriptionItem {
  id: string;
  mode?: CreemMode;
  object?: string;
  product_id: string;
  price_id?: string;
  units: number;
}

// ─── Transaction ─────────────────────────────────────────────────────

export interface CreemTransaction {
  id: string;
  mode?: CreemMode;
  object: string;
  amount: number;
  currency: Currency;
  type: string;
  status: string;
  created_at: number | string;
  amount_paid?: number;
  discount_amount?: number;
  tax_country?: string;
  tax_amount?: number;
  refunded_amount?: number;
  order?: string;
  subscription?: string;
  customer?: string;
  description?: string;
  period_start?: number;
  period_end?: number;
}

// ─── Checkout ────────────────────────────────────────────────────────

export type CheckoutStatus = "pending" | "processing" | "completed" | "expired";

export interface CheckoutCustomField {
  type: "text" | "checkbox";
  key: string;
  label: string;
  optional?: boolean;
  text?: {
    max_length?: number;
    min_length?: number;
    value?: string;
  };
  checkbox?: {
    label?: string;
    value?: boolean;
  };
}

export interface CreateCheckoutRequest {
  product_id: string;
  request_id?: string;
  units?: number;
  discount_code?: string;
  customer?: {
    id?: string;
    email?: string;
  };
  custom_fields?: CheckoutCustomField[];
  success_url?: string;
  metadata?: Record<string, unknown>;
}

export interface CreemCheckout {
  id: string;
  mode: CreemMode;
  object: string;
  status: CheckoutStatus;
  product: CreemProduct | string;
  request_id?: string;
  units?: number;
  order?: CreemOrder;
  subscription?: CreemSubscription | string;
  customer?: CreemCustomer | string;
  custom_fields?: CheckoutCustomField[];
  checkout_url: string;
  success_url?: string | null;
  feature?: unknown[];
  metadata?: Record<string, unknown>;
}

// ─── Refund ──────────────────────────────────────────────────────────

export interface CreemRefund {
  id: string;
  object: string;
  status: string;
  refund_amount: number;
  refund_currency: Currency;
  reason: string;
  transaction: CreemTransaction;
  customer: CreemCustomer;
  product: CreemProduct;
  created_at: string;
  mode: CreemMode;
}

// ─── Dispute ─────────────────────────────────────────────────────────

export interface CreemDispute {
  id: string;
  object: string;
  status: string;
  amount: number;
  currency: Currency;
  reason: string;
  transaction: CreemTransaction;
  customer: CreemCustomer;
  created_at: string;
  mode: CreemMode;
}

// ─── License ─────────────────────────────────────────────────────────

export interface CreemLicense {
  id: string;
  mode: CreemMode;
  object: string;
  status: "active" | "inactive";
  key: string;
  activation: number;
  created_at: string;
  activation_limit: number;
  expires_at?: string;
  instance?: {
    id: string;
    mode: CreemMode;
    object: string;
    name: string;
    status: "active" | "inactive";
    created_at: string;
  };
}

// ─── Webhook Events ──────────────────────────────────────────────────

export type WebhookEventType =
  | "checkout.completed"
  | "subscription.active"
  | "subscription.paid"
  | "subscription.canceled"
  | "subscription.scheduled_cancel"
  | "subscription.past_due"
  | "subscription.expired"
  | "subscription.update"
  | "subscription.trialing"
  | "subscription.paused"
  | "refund.created"
  | "dispute.created";

export interface WebhookEvent<T = unknown> {
  id: string;
  eventType: WebhookEventType;
  created_at: number;
  object: T;
}

export interface CheckoutCompletedEvent
  extends WebhookEvent<{
    id: string;
    object: string;
    request_id?: string;
    order: CreemOrder;
    product: CreemProduct;
    customer: CreemCustomer;
    subscription?: CreemSubscription;
    custom_fields?: CheckoutCustomField[];
    status: string;
    metadata?: Record<string, unknown>;
    mode: CreemMode;
  }> {
  eventType: "checkout.completed";
}

export interface SubscriptionEvent
  extends WebhookEvent<{
    id: string;
    object: string;
    product: CreemProduct;
    customer: CreemCustomer;
    collection_method: string;
    status: SubscriptionStatus;
    last_transaction_id?: string;
    last_transaction_date?: string;
    next_transaction_date?: string;
    current_period_start_date?: string;
    current_period_end_date?: string;
    canceled_at?: string | null;
    created_at: string;
    updated_at: string;
    metadata?: Record<string, unknown>;
    mode: CreemMode;
  }> {
  eventType:
    | "subscription.active"
    | "subscription.paid"
    | "subscription.canceled"
    | "subscription.scheduled_cancel"
    | "subscription.past_due"
    | "subscription.expired"
    | "subscription.update"
    | "subscription.trialing"
    | "subscription.paused";
}

export interface RefundCreatedEvent extends WebhookEvent<CreemRefund> {
  eventType: "refund.created";
}

export interface DisputeCreatedEvent extends WebhookEvent<CreemDispute> {
  eventType: "dispute.created";
}

// ─── API List Responses ──────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total_records: number;
    total_pages: number;
    current_page: number;
    next_page: number | null;
    prev_page: number | null;
  };
}

// ─── Customer Billing ────────────────────────────────────────────────

export interface CustomerBillingResponse {
  customer_portal_link: string;
}

// ─── Cancel Subscription ─────────────────────────────────────────────

export interface CancelSubscriptionRequest {
  mode?: "immediate" | "scheduled";
  onExecute?: "cancel" | "pause";
}
