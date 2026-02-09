import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createCheckout,
  getCheckout,
  listAllProducts,
  getProduct,
  createProduct,
  getSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  upgradeSubscription,
  updateSubscription,
  getCustomer,
  listCustomers,
  generateCustomerBillingLink,
  getTransaction,
  listTransactions,
  validateLicense,
  activateLicense,
  deactivateLicense,
  createDiscount,
  getDiscount,
  deleteDiscount,
  type CreemApiConfig,
} from "../client/creem-api.js";

const mockConfig: CreemApiConfig = {
  apiKey: "creem_test_key",
  environment: "test",
};

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

describe("createCheckout", () => {
  it("should create a checkout session", async () => {
    const mockCheckout = {
      id: "ch_test_123",
      mode: "test",
      object: "checkout",
      status: "pending",
      checkout_url: "https://checkout.creem.io/ch_test_123",
    };
    mockFetch.mockResolvedValueOnce(mockResponse(mockCheckout));

    const result = await createCheckout(mockConfig, {
      product_id: "prod_test",
      success_url: "https://example.com/success",
    });

    expect(result).toEqual(mockCheckout);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://test-api.creem.io/v1/checkouts",
      expect.objectContaining({
        method: "POST",
        headers: {
          "x-api-key": "creem_test_key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: "prod_test",
          success_url: "https://example.com/success",
        }),
      }),
    );
  });

  it("should send metadata in checkout request", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ id: "ch_test", checkout_url: "https://checkout.creem.io/ch_test" }),
    );

    await createCheckout(mockConfig, {
      product_id: "prod_test",
      metadata: { userId: "user_123" },
    });

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.metadata).toEqual({ userId: "user_123" });
  });

  it("should throw on API error", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ error: "Not found" }, 404));

    await expect(
      createCheckout(mockConfig, { product_id: "invalid" }),
    ).rejects.toThrow("Creem API error (404)");
  });
});

describe("getCheckout", () => {
  it("should retrieve a checkout session", async () => {
    const mockCheckout = { id: "ch_test_123", status: "completed" };
    mockFetch.mockResolvedValueOnce(mockResponse(mockCheckout));

    const result = await getCheckout(mockConfig, "ch_test_123");
    expect(result).toEqual(mockCheckout);

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("checkout_id=ch_test_123");
  });
});

describe("listAllProducts", () => {
  it("should list products with pagination", async () => {
    const mockProducts = {
      items: [
        { id: "prod_1", name: "Pro Monthly", price: 1000 },
        { id: "prod_2", name: "Pro Yearly", price: 10000 },
      ],
      pagination: { total_records: 2, total_pages: 1, current_page: 1 },
    };
    mockFetch.mockResolvedValueOnce(mockResponse(mockProducts));

    const result = await listAllProducts(mockConfig);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe("Pro Monthly");

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("page_number=1");
    expect(url).toContain("page_size=100");
  });

  it("should accept custom pagination", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ items: [], pagination: {} }),
    );

    await listAllProducts(mockConfig, 2, 50);
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("page_number=2");
    expect(url).toContain("page_size=50");
  });
});

describe("getProduct", () => {
  it("should retrieve a product", async () => {
    const mockProduct = { id: "prod_test", name: "Test Product" };
    mockFetch.mockResolvedValueOnce(mockResponse(mockProduct));

    const result = await getProduct(mockConfig, "prod_test");
    expect(result).toEqual(mockProduct);
  });
});

describe("getSubscription", () => {
  it("should retrieve a subscription", async () => {
    const mockSub = { id: "sub_test", status: "active" };
    mockFetch.mockResolvedValueOnce(mockResponse(mockSub));

    const result = await getSubscription(mockConfig, "sub_test");
    expect(result).toEqual(mockSub);
  });
});

describe("cancelSubscription", () => {
  it("should cancel a subscription immediately", async () => {
    const mockSub = { id: "sub_test", status: "canceled" };
    mockFetch.mockResolvedValueOnce(mockResponse(mockSub));

    const result = await cancelSubscription(mockConfig, "sub_test", {
      mode: "immediate",
    });
    expect(result.status).toBe("canceled");

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toContain("/v1/subscriptions/sub_test/cancel");
    expect(callArgs[1].method).toBe("POST");
  });

  it("should schedule cancellation", async () => {
    const mockSub = { id: "sub_test", status: "scheduled_cancel" };
    mockFetch.mockResolvedValueOnce(mockResponse(mockSub));

    await cancelSubscription(mockConfig, "sub_test", {
      mode: "scheduled",
      onExecute: "cancel",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.mode).toBe("scheduled");
    expect(body.onExecute).toBe("cancel");
  });

  it("should use default cancellation options", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ id: "sub_test" }));

    await cancelSubscription(mockConfig, "sub_test");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.mode).toBe("immediate");
    expect(body.onExecute).toBe("cancel");
  });
});

describe("pauseSubscription", () => {
  it("should pause a subscription", async () => {
    const mockSub = { id: "sub_test", status: "paused" };
    mockFetch.mockResolvedValueOnce(mockResponse(mockSub));

    const result = await pauseSubscription(mockConfig, "sub_test");
    expect(result.status).toBe("paused");
    expect(mockFetch.mock.calls[0][0]).toContain(
      "/v1/subscriptions/sub_test/pause",
    );
  });
});

describe("resumeSubscription", () => {
  it("should resume a subscription", async () => {
    const mockSub = { id: "sub_test", status: "active" };
    mockFetch.mockResolvedValueOnce(mockResponse(mockSub));

    const result = await resumeSubscription(mockConfig, "sub_test");
    expect(result.status).toBe("active");
  });
});

describe("upgradeSubscription", () => {
  it("should upgrade a subscription", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ id: "sub_test", status: "active" }),
    );

    await upgradeSubscription(mockConfig, "sub_test", "prod_new");

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toContain("/v1/subscriptions/sub_test/upgrade");
    const body = JSON.parse(callArgs[1].body);
    expect(body.product_id).toBe("prod_new");
  });
});

describe("generateCustomerBillingLink", () => {
  it("should generate a customer portal link", async () => {
    const mockResponse_ = {
      customer_portal_link: "https://portal.creem.io/cust_test",
    };
    mockFetch.mockResolvedValueOnce(mockResponse(mockResponse_));

    const result = await generateCustomerBillingLink(
      mockConfig,
      "cust_test",
    );
    expect(result.customer_portal_link).toBe(
      "https://portal.creem.io/cust_test",
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.customer_id).toBe("cust_test");
  });
});

describe("createProduct", () => {
  it("should create a product", async () => {
    const mockProduct = { id: "prod_new", name: "New Product", price: 2000 };
    mockFetch.mockResolvedValueOnce(mockResponse(mockProduct));

    const result = await createProduct(mockConfig, {
      name: "New Product",
      price: 2000,
      currency: "USD",
      billing_type: "recurring",
      billing_period: "every-month",
    });

    expect(result).toEqual(mockProduct);
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toContain("/v1/products");
    expect(callArgs[1].method).toBe("POST");
    const body = JSON.parse(callArgs[1].body);
    expect(body.name).toBe("New Product");
    expect(body.billing_type).toBe("recurring");
  });
});

describe("updateSubscription", () => {
  it("should update a subscription", async () => {
    const mockSub = { id: "sub_test", status: "active" };
    mockFetch.mockResolvedValueOnce(mockResponse(mockSub));

    await updateSubscription(mockConfig, "sub_test", { units: 5 });

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toContain("/v1/subscriptions/sub_test");
    expect(callArgs[1].method).toBe("POST");
    const body = JSON.parse(callArgs[1].body);
    expect(body.units).toBe(5);
  });
});

describe("getCustomer", () => {
  it("should retrieve a customer", async () => {
    const mockCust = { id: "cust_test", email: "test@example.com" };
    mockFetch.mockResolvedValueOnce(mockResponse(mockCust));

    const result = await getCustomer(mockConfig, "cust_test");
    expect(result).toEqual(mockCust);

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("id=cust_test");
  });
});

describe("listCustomers", () => {
  it("should list customers with pagination", async () => {
    const mockCustomers = {
      items: [{ id: "cust_1", email: "a@example.com" }],
      pagination: { total_records: 1, total_pages: 1, current_page: 1 },
    };
    mockFetch.mockResolvedValueOnce(mockResponse(mockCustomers));

    const result = await listCustomers(mockConfig);
    expect(result.items).toHaveLength(1);

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("/v1/customers/list");
  });
});

describe("getTransaction", () => {
  it("should retrieve a transaction", async () => {
    const mockTx = { id: "tx_test", amount: 1000, status: "completed" };
    mockFetch.mockResolvedValueOnce(mockResponse(mockTx));

    const result = await getTransaction(mockConfig, "tx_test");
    expect(result).toEqual(mockTx);

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("id=tx_test");
  });
});

describe("listTransactions", () => {
  it("should list transactions with pagination", async () => {
    const mockTxs = {
      items: [{ id: "tx_1" }, { id: "tx_2" }],
      pagination: { total_records: 2, total_pages: 1, current_page: 1 },
    };
    mockFetch.mockResolvedValueOnce(mockResponse(mockTxs));

    const result = await listTransactions(mockConfig);
    expect(result.items).toHaveLength(2);

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("/v1/transactions/search");
  });
});

describe("validateLicense", () => {
  it("should validate a license key", async () => {
    const mockLicense = { id: "lic_test", status: "active", key: "LIC-KEY-123" };
    mockFetch.mockResolvedValueOnce(mockResponse(mockLicense));

    const result = await validateLicense(mockConfig, { key: "LIC-KEY-123" });
    expect(result).toEqual(mockLicense);

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toContain("/v1/licenses/validate");
    expect(callArgs[1].method).toBe("POST");
  });

  it("should validate with instance id", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ id: "lic_test", status: "active" }),
    );

    await validateLicense(mockConfig, {
      key: "LIC-KEY-123",
      instance_id: "inst_abc",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.key).toBe("LIC-KEY-123");
    expect(body.instance_id).toBe("inst_abc");
  });
});

describe("activateLicense", () => {
  it("should activate a license key", async () => {
    const mockLicense = {
      id: "lic_test",
      status: "active",
      key: "LIC-KEY-123",
      instance: { id: "inst_new", name: "My Device", status: "active" },
    };
    mockFetch.mockResolvedValueOnce(mockResponse(mockLicense));

    const result = await activateLicense(mockConfig, {
      key: "LIC-KEY-123",
      instance_name: "My Device",
    });
    expect(result.instance?.id).toBe("inst_new");

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toContain("/v1/licenses/activate");
  });
});

describe("deactivateLicense", () => {
  it("should deactivate a license instance", async () => {
    const mockLicense = { id: "lic_test", status: "active", activation: 0 };
    mockFetch.mockResolvedValueOnce(mockResponse(mockLicense));

    const result = await deactivateLicense(mockConfig, {
      key: "LIC-KEY-123",
      instance_id: "inst_abc",
    });
    expect(result).toEqual(mockLicense);

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toContain("/v1/licenses/deactivate");
    const body = JSON.parse(callArgs[1].body);
    expect(body.key).toBe("LIC-KEY-123");
    expect(body.instance_id).toBe("inst_abc");
  });
});

describe("createDiscount", () => {
  it("should create a percentage discount", async () => {
    const mockDiscount = {
      id: "disc_test",
      code: "SAVE20",
      type: "percentage",
      amount: 20,
    };
    mockFetch.mockResolvedValueOnce(mockResponse(mockDiscount));

    const result = await createDiscount(mockConfig, {
      code: "SAVE20",
      type: "percentage",
      amount: 20,
    });
    expect(result).toEqual(mockDiscount);

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toContain("/v1/discounts");
    expect(callArgs[1].method).toBe("POST");
  });

  it("should create a fixed amount discount", async () => {
    const mockDiscount = {
      id: "disc_test2",
      code: "FLAT10",
      type: "fixed",
      amount: 1000,
      currency: "USD",
    };
    mockFetch.mockResolvedValueOnce(mockResponse(mockDiscount));

    await createDiscount(mockConfig, {
      code: "FLAT10",
      type: "fixed",
      amount: 1000,
      currency: "USD",
      max_redemptions: 100,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.code).toBe("FLAT10");
    expect(body.max_redemptions).toBe(100);
  });
});

describe("getDiscount", () => {
  it("should retrieve a discount", async () => {
    const mockDiscount = { id: "disc_test", code: "SAVE20" };
    mockFetch.mockResolvedValueOnce(mockResponse(mockDiscount));

    const result = await getDiscount(mockConfig, "disc_test");
    expect(result).toEqual(mockDiscount);

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("id=disc_test");
  });
});

describe("deleteDiscount", () => {
  it("should delete a discount", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(undefined));

    await deleteDiscount(mockConfig, "disc_test");

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toContain("/v1/discounts/disc_test/delete");
    expect(callArgs[1].method).toBe("DELETE");
  });
});

describe("API environment handling", () => {
  it("should use test-api for test environment", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ items: [] }));

    await listAllProducts({ apiKey: "key", environment: "test" });
    expect(mockFetch.mock.calls[0][0]).toContain("test-api.creem.io");
  });

  it("should use api for production environment", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ items: [] }));

    await listAllProducts({ apiKey: "key", environment: "production" });
    expect(mockFetch.mock.calls[0][0]).toContain("api.creem.io");
    expect(mockFetch.mock.calls[0][0]).not.toContain("test-api");
  });
});
