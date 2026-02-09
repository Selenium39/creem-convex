/**
 * Lightweight CREEM API HTTP client.
 * Used inside Convex actions to call the CREEM REST API.
 */

import type {
  CancelSubscriptionRequest,
  CreateCheckoutRequest,
  CreateDiscountRequest,
  CreateProductRequest,
  UpdateSubscriptionRequest,
  ValidateLicenseRequest,
  ActivateLicenseRequest,
  DeactivateLicenseRequest,
  CreemCheckout,
  CreemCustomer,
  CreemDiscount,
  CreemLicense,
  CreemProduct,
  CreemSubscription,
  CreemTransaction,
  CustomerBillingResponse,
  PaginatedResponse,
} from "../types.js";

export interface CreemApiConfig {
  apiKey: string;
  /** "production" uses api.creem.io; "test" uses test-api.creem.io */
  environment?: "production" | "test";
}

function getBaseUrl(environment: "production" | "test"): string {
  return environment === "production"
    ? "https://api.creem.io"
    : "https://test-api.creem.io";
}

async function request<T>(
  config: CreemApiConfig,
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>,
): Promise<T> {
  const baseUrl = getBaseUrl(config.environment ?? "test");
  const url = new URL(`${baseUrl}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    "x-api-key": config.apiKey,
    "Content-Type": "application/json",
  };

  const response = await fetch(url.toString(), {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Creem API error (${response.status}): ${errorText}`,
    );
  }

  return response.json() as Promise<T>;
}

// ─── Checkout ────────────────────────────────────────────────────────

export async function createCheckout(
  config: CreemApiConfig,
  data: CreateCheckoutRequest,
): Promise<CreemCheckout> {
  return request<CreemCheckout>(config, "POST", "/v1/checkouts", data);
}

export async function getCheckout(
  config: CreemApiConfig,
  checkoutId: string,
): Promise<CreemCheckout> {
  return request<CreemCheckout>(config, "GET", "/v1/checkouts", undefined, {
    checkout_id: checkoutId,
  });
}

// ─── Products ────────────────────────────────────────────────────────

export async function listAllProducts(
  config: CreemApiConfig,
  pageNumber = 1,
  pageSize = 100,
): Promise<PaginatedResponse<CreemProduct>> {
  return request<PaginatedResponse<CreemProduct>>(
    config,
    "GET",
    "/v1/products/search",
    undefined,
    {
      page_number: String(pageNumber),
      page_size: String(pageSize),
    },
  );
}

export async function getProduct(
  config: CreemApiConfig,
  productId: string,
): Promise<CreemProduct> {
  return request<CreemProduct>(config, "GET", "/v1/products", undefined, {
    id: productId,
  });
}

export async function createProduct(
  config: CreemApiConfig,
  data: CreateProductRequest,
): Promise<CreemProduct> {
  return request<CreemProduct>(config, "POST", "/v1/products", data);
}

// ─── Subscriptions ───────────────────────────────────────────────────

export async function getSubscription(
  config: CreemApiConfig,
  subscriptionId: string,
): Promise<CreemSubscription> {
  return request<CreemSubscription>(
    config,
    "GET",
    "/v1/subscriptions",
    undefined,
    { subscription_id: subscriptionId },
  );
}

export async function cancelSubscription(
  config: CreemApiConfig,
  subscriptionId: string,
  data?: CancelSubscriptionRequest,
): Promise<CreemSubscription> {
  return request<CreemSubscription>(
    config,
    "POST",
    `/v1/subscriptions/${subscriptionId}/cancel`,
    data ?? { mode: "immediate", onExecute: "cancel" },
  );
}

export async function pauseSubscription(
  config: CreemApiConfig,
  subscriptionId: string,
): Promise<CreemSubscription> {
  return request<CreemSubscription>(
    config,
    "POST",
    `/v1/subscriptions/${subscriptionId}/pause`,
  );
}

export async function resumeSubscription(
  config: CreemApiConfig,
  subscriptionId: string,
): Promise<CreemSubscription> {
  return request<CreemSubscription>(
    config,
    "POST",
    `/v1/subscriptions/${subscriptionId}/resume`,
  );
}

export async function upgradeSubscription(
  config: CreemApiConfig,
  subscriptionId: string,
  newProductId: string,
): Promise<CreemSubscription> {
  return request<CreemSubscription>(
    config,
    "POST",
    `/v1/subscriptions/${subscriptionId}/upgrade`,
    { product_id: newProductId },
  );
}

export async function updateSubscription(
  config: CreemApiConfig,
  subscriptionId: string,
  data: UpdateSubscriptionRequest,
): Promise<CreemSubscription> {
  return request<CreemSubscription>(
    config,
    "POST",
    `/v1/subscriptions/${subscriptionId}`,
    data,
  );
}

// ─── Customers ───────────────────────────────────────────────────────

export async function getCustomer(
  config: CreemApiConfig,
  customerId: string,
): Promise<CreemCustomer> {
  return request<CreemCustomer>(config, "GET", "/v1/customers", undefined, {
    id: customerId,
  });
}

export async function listCustomers(
  config: CreemApiConfig,
  pageNumber = 1,
  pageSize = 100,
): Promise<PaginatedResponse<CreemCustomer>> {
  return request<PaginatedResponse<CreemCustomer>>(
    config,
    "GET",
    "/v1/customers/list",
    undefined,
    {
      page_number: String(pageNumber),
      page_size: String(pageSize),
    },
  );
}

// ─── Customer Billing ────────────────────────────────────────────────

export async function generateCustomerBillingLink(
  config: CreemApiConfig,
  customerId: string,
): Promise<CustomerBillingResponse> {
  return request<CustomerBillingResponse>(
    config,
    "POST",
    "/v1/customers/billing",
    { customer_id: customerId },
  );
}

// ─── Transactions ────────────────────────────────────────────────────

export async function getTransaction(
  config: CreemApiConfig,
  transactionId: string,
): Promise<CreemTransaction> {
  return request<CreemTransaction>(
    config,
    "GET",
    "/v1/transactions",
    undefined,
    { id: transactionId },
  );
}

export async function listTransactions(
  config: CreemApiConfig,
  pageNumber = 1,
  pageSize = 100,
): Promise<PaginatedResponse<CreemTransaction>> {
  return request<PaginatedResponse<CreemTransaction>>(
    config,
    "GET",
    "/v1/transactions/search",
    undefined,
    {
      page_number: String(pageNumber),
      page_size: String(pageSize),
    },
  );
}

// ─── Licenses ────────────────────────────────────────────────────────

export async function validateLicense(
  config: CreemApiConfig,
  data: ValidateLicenseRequest,
): Promise<CreemLicense> {
  return request<CreemLicense>(config, "POST", "/v1/licenses/validate", data);
}

export async function activateLicense(
  config: CreemApiConfig,
  data: ActivateLicenseRequest,
): Promise<CreemLicense> {
  return request<CreemLicense>(config, "POST", "/v1/licenses/activate", data);
}

export async function deactivateLicense(
  config: CreemApiConfig,
  data: DeactivateLicenseRequest,
): Promise<CreemLicense> {
  return request<CreemLicense>(
    config,
    "POST",
    "/v1/licenses/deactivate",
    data,
  );
}

// ─── Discounts ───────────────────────────────────────────────────────

export async function createDiscount(
  config: CreemApiConfig,
  data: CreateDiscountRequest,
): Promise<CreemDiscount> {
  return request<CreemDiscount>(config, "POST", "/v1/discounts", data);
}

export async function getDiscount(
  config: CreemApiConfig,
  discountId: string,
): Promise<CreemDiscount> {
  return request<CreemDiscount>(config, "GET", "/v1/discounts", undefined, {
    id: discountId,
  });
}

export async function deleteDiscount(
  config: CreemApiConfig,
  discountId: string,
): Promise<void> {
  return request<void>(
    config,
    "DELETE",
    `/v1/discounts/${discountId}/delete`,
  );
}
