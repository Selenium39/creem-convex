import { useEffect, useState, type PropsWithChildren, useCallback } from "react";
import { useAction, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";

// ─── Types ───────────────────────────────────────────────────────────

type GenerateCheckoutLinkFn = FunctionReference<
  "action",
  "public",
  {
    productId: string;
    successUrl?: string;
    metadata?: Record<string, unknown>;
    discountCode?: string;
  },
  { url: string; checkoutId: string }
>;

type GenerateCustomerPortalUrlFn = FunctionReference<
  "action",
  "public",
  Record<string, never>,
  { url: string }
>;

interface CreemApi {
  generateCheckoutLink: GenerateCheckoutLinkFn;
  generateCustomerPortalUrl: GenerateCustomerPortalUrlFn;
}

// ─── CheckoutLink ────────────────────────────────────────────────────

/**
 * A link that opens a Creem checkout page for the given product.
 *
 * ```tsx
 * <CheckoutLink
 *   creemApi={api.creem}
 *   productId="prod_xxxxx"
 * >
 *   Subscribe Now
 * </CheckoutLink>
 * ```
 */
export function CheckoutLink({
  creemApi,
  productId,
  successUrl,
  metadata,
  discountCode,
  children,
  className,
}: PropsWithChildren<{
  creemApi: Pick<CreemApi, "generateCheckoutLink">;
  productId: string;
  successUrl?: string;
  metadata?: Record<string, unknown>;
  discountCode?: string;
  className?: string;
}>) {
  const generateCheckoutLink = useAction(creemApi.generateCheckoutLink);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (checkoutUrl) {
      window.open(checkoutUrl, "_blank");
      return;
    }

    setLoading(true);
    try {
      const result = await generateCheckoutLink({
        productId,
        successUrl: successUrl ?? window.location.href,
        metadata,
        discountCode,
      });
      setCheckoutUrl(result.url);
      window.open(result.url, "_blank");
    } catch (error) {
      console.error("Failed to generate checkout link:", error);
    } finally {
      setLoading(false);
    }
  }, [
    checkoutUrl,
    generateCheckoutLink,
    productId,
    successUrl,
    metadata,
    discountCode,
  ]);

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={className}
      type="button"
    >
      {loading ? "Loading..." : children}
    </button>
  );
}

// ─── CheckoutButton (eager loading variant) ──────────────────────────

/**
 * A button that eagerly fetches the checkout URL on mount.
 * Better UX for known product selections since the link is ready on click.
 */
export function CheckoutButton({
  creemApi,
  productId,
  successUrl,
  metadata,
  discountCode,
  children,
  className,
}: PropsWithChildren<{
  creemApi: Pick<CreemApi, "generateCheckoutLink">;
  productId: string;
  successUrl?: string;
  metadata?: Record<string, unknown>;
  discountCode?: string;
  className?: string;
}>) {
  const generateCheckoutLink = useAction(creemApi.generateCheckoutLink);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  useEffect(() => {
    void generateCheckoutLink({
      productId,
      successUrl: successUrl ?? window.location.href,
      metadata,
      discountCode,
    }).then(({ url }) => setCheckoutUrl(url));
  }, [generateCheckoutLink, productId, successUrl, metadata, discountCode]);

  if (!checkoutUrl) {
    return null;
  }

  return (
    <a
      href={checkoutUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

// ─── CustomerPortalLink ──────────────────────────────────────────────

/**
 * A link that opens the Creem customer portal for managing subscriptions.
 *
 * ```tsx
 * <CustomerPortalLink creemApi={api.creem}>
 *   Manage Subscription
 * </CustomerPortalLink>
 * ```
 */
export function CustomerPortalLink({
  creemApi,
  children,
  className,
}: PropsWithChildren<{
  creemApi: Pick<CreemApi, "generateCustomerPortalUrl">;
  className?: string;
}>) {
  const generateCustomerPortalUrl = useAction(
    creemApi.generateCustomerPortalUrl,
  );
  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  useEffect(() => {
    void generateCustomerPortalUrl({}).then((result) => {
      if (result) {
        setPortalUrl(result.url);
      }
    });
  }, [generateCustomerPortalUrl]);

  if (!portalUrl) {
    return null;
  }

  return (
    <a
      href={portalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

// ─── useSubscription Hook ────────────────────────────────────────────

/**
 * Hook that returns the current user's subscription status with real-time updates.
 * Uses Convex's reactive queries under the hood.
 *
 * ```tsx
 * const subscription = useSubscription(api.creem.getCurrentSubscription);
 * if (subscription?.status === "active") { ... }
 * ```
 */
export function useSubscription(
  queryFn: FunctionReference<"query", "public", Record<string, never>, unknown>,
) {
  return useQuery(queryFn, {});
}
