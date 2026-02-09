import { useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { CheckoutLink, CustomerPortalLink } from "@creem_io/convex/react";

export default function App() {
  const user = useQuery(api.users.getUserWithSubscription);
  const products = useQuery(api.creem.getConfiguredProducts);
  const createUser = useAction(api.users.createUser as any);

  if (!user) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Creem + Convex Demo</h1>
          <p style={styles.subtitle}>Loading user...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Creem + Convex Demo</h1>
        <p style={styles.subtitle}>
          Full payment integration with real-time subscription updates
        </p>

        {/* User Info */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>User</h2>
          <p>{user.email}</p>
          <p style={styles.badge}>
            {user.isPro ? "Pro" : "Free"}
          </p>
        </div>

        {/* Subscription Status */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Subscription</h2>
          {user.subscription ? (
            <div>
              <p>
                Status:{" "}
                <span style={styles.statusBadge(user.subscription.status)}>
                  {user.subscription.status}
                </span>
              </p>
              {user.subscription.product && (
                <p>Plan: {user.subscription.product.name}</p>
              )}
              {user.subscription.currentPeriodEndDate && (
                <p>
                  Renews:{" "}
                  {new Date(
                    user.subscription.currentPeriodEndDate,
                  ).toLocaleDateString()}
                </p>
              )}

              {/* Customer Portal */}
              <div style={{ marginTop: "1rem" }}>
                <CustomerPortalLink
                  creemApi={api.creem}
                  className="portal-link"
                >
                  <span style={styles.button}>Manage Subscription</span>
                </CustomerPortalLink>
              </div>
            </div>
          ) : (
            <p style={styles.muted}>No active subscription</p>
          )}
        </div>

        {/* Pricing */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Plans</h2>
          <div style={styles.grid}>
            {products?.proMonthly && (
              <div style={styles.planCard}>
                <h3>{products.proMonthly.name}</h3>
                <p style={styles.price}>
                  ${(products.proMonthly.price / 100).toFixed(2)}/mo
                </p>
                <CheckoutLink
                  creemApi={api.creem}
                  productId={products.proMonthly.creemProductId}
                >
                  <span style={styles.button}>Subscribe Monthly</span>
                </CheckoutLink>
              </div>
            )}

            {products?.proYearly && (
              <div style={styles.planCard}>
                <h3>{products.proYearly.name}</h3>
                <p style={styles.price}>
                  ${(products.proYearly.price / 100).toFixed(2)}/yr
                </p>
                <CheckoutLink
                  creemApi={api.creem}
                  productId={products.proYearly.creemProductId}
                >
                  <span style={styles.button}>Subscribe Yearly</span>
                </CheckoutLink>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
  } as React.CSSProperties,
  card: {
    maxWidth: "600px",
    width: "100%",
    background: "#18181b",
    borderRadius: "12px",
    padding: "2rem",
    border: "1px solid #27272a",
  } as React.CSSProperties,
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    marginBottom: "0.25rem",
  } as React.CSSProperties,
  subtitle: {
    color: "#a1a1aa",
    marginBottom: "1.5rem",
  } as React.CSSProperties,
  section: {
    marginBottom: "1.5rem",
    padding: "1rem",
    background: "#09090b",
    borderRadius: "8px",
    border: "1px solid #27272a",
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: "0.875rem",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    color: "#a1a1aa",
    marginBottom: "0.75rem",
  } as React.CSSProperties,
  badge: {
    display: "inline-block",
    padding: "0.25rem 0.75rem",
    borderRadius: "9999px",
    background: "#7c3aed",
    fontSize: "0.75rem",
    fontWeight: 600,
    marginTop: "0.5rem",
  } as React.CSSProperties,
  statusBadge: (status: string) =>
    ({
      display: "inline-block",
      padding: "0.125rem 0.5rem",
      borderRadius: "9999px",
      fontSize: "0.75rem",
      fontWeight: 600,
      background:
        status === "active"
          ? "#166534"
          : status === "canceled"
            ? "#991b1b"
            : status === "trialing"
              ? "#854d0e"
              : "#27272a",
    }) as React.CSSProperties,
  muted: {
    color: "#71717a",
  } as React.CSSProperties,
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1rem",
  } as React.CSSProperties,
  planCard: {
    padding: "1rem",
    background: "#18181b",
    borderRadius: "8px",
    border: "1px solid #27272a",
    textAlign: "center" as const,
  } as React.CSSProperties,
  price: {
    fontSize: "1.25rem",
    fontWeight: 700,
    margin: "0.5rem 0",
  } as React.CSSProperties,
  button: {
    display: "inline-block",
    padding: "0.5rem 1rem",
    background: "#7c3aed",
    color: "#fff",
    borderRadius: "6px",
    fontWeight: 600,
    fontSize: "0.875rem",
    cursor: "pointer",
    border: "none",
    textDecoration: "none",
  } as React.CSSProperties,
};
