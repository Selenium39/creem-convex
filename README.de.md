# Convex Creem Komponente

[![npm version](https://badge.fury.io/js/@creem_io%2Fconvex.svg)](https://badge.fury.io/js/@creem_io/convex)

[English](README.md) | [中文](README.zh-CN.md) | [Español](README.es.md) | [Français](README.fr.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md)

Integriert [Creem](https://creem.io)-Zahlungen, Abonnements und Abrechnung in deine [Convex](https://convex.dev)-Anwendung.

Creem ist ein Merchant of Record, der globale Zahlungen, Steuer-Compliance und Abonnementverwaltung übernimmt. Diese Convex-Komponente bringt Creems kompletten Zahlungsstack in dein Convex-Backend mit Echtzeit-Reaktivität.

**Sieh dir die [Beispiel-App](./example) für eine vollständige Demo an.**

```tsx
// Abonnementdetails des aktuellen Benutzers abrufen
const subscription = await creem.getCurrentSubscription(ctx, { userId });

// Verfügbare Pläne anzeigen
<CheckoutLink creemApi={api.creem} productId="prod_xxx">
  Auf Pro upgraden
</CheckoutLink>

// Bestehende Abonnements verwalten
<CustomerPortalLink creemApi={api.creem}>
  Abonnement verwalten
</CustomerPortalLink>
```

## Voraussetzungen

### Convex-App

Du benötigst eine Convex-App, um diese Komponente zu nutzen. Folge einem der [Convex Quickstarts](https://docs.convex.dev/home), um eine einzurichten.

### Creem-Konto

1. [Creem-Konto erstellen](https://creem.io)
2. Produkte im Creem-Dashboard anlegen
3. API-Schlüssel unter **Einstellungen > API Keys** abrufen
4. Webhook-Geheimnis unter **Entwickler > Webhooks** abrufen

## Installation

Komponentenpaket installieren:

```bash
npm install @creem_io/convex
```

Erstelle eine `convex.config.ts`-Datei im `convex/`-Ordner deiner App und installiere die Komponente über `app.use`:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import creem from "@creem_io/convex/convex.config.js";

const app = defineApp();
app.use(creem);
export default app;
```

Creem-Zugangsdaten als Umgebungsvariablen setzen:

```bash
npx convex env set CREEM_API_KEY creem_xxxxx
npx convex env set CREEM_WEBHOOK_SECRET whsec_xxxxx
# Optional: "production" für Live-Modus setzen (Standard: "test")
npx convex env set CREEM_ENVIRONMENT test
```

## Schnellstart

### 1. Creem-Client initialisieren

```ts
// convex/creem.ts
import { Creem } from "@creem_io/convex";
import { api, components } from "./_generated/api";

export const creem = new Creem(components.creem, {
  // Erforderlich: Funktion zur Abruf von Benutzer-ID und E-Mail
  getUserInfo: async (ctx) => {
    const user = await ctx.runQuery(api.users.getCurrentUser);
    return { userId: user._id, email: user.email };
  },

  // Optional: freundliche Schlüssel auf Creem-Produkt-IDs mappen
  products: {
    proMonthly: "prod_xxxxx",
    proYearly: "prod_yyyyy",
  },
});

// API-Funktionen exportieren
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

### 2. Webhooks einrichten

Registriere den Webhook-Handler in deiner `convex/http.ts`:

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { creem } from "./creem";

const http = httpRouter();

creem.registerRoutes(http as any, {
  // Optional: benutzerdefinierter Pfad (Standard: "/creem/webhook")
  path: "/creem/webhook",

  // Optional: Callbacks für Webhook-Ereignisse
  onCheckoutCompleted: async (ctx, event) => {
    console.log("Checkout completed:", event.object);
  },
  onSubscriptionCanceled: async (ctx, event) => {
    console.log("Subscription canceled:", event.object);
  },
});

export default http;
```

Dann die Webhook-URL in deinem [Creem-Dashboard](https://creem.io/dashboard/developers) registrieren:

```
https://<deine-convex-site-url>/creem/webhook
```

Deine Convex-Site-URL findest du im [Convex-Dashboard](https://dashboard.convex.dev) oder über die Systemumgebungsvariable `CONVEX_SITE_URL`.

### 3. Bestehende Produkte synchronisieren

Wenn du Produkte vor der Installation dieser Komponente erstellt hast, synchronisiere sie:

```ts
// Einmal aus dem Convex-Dashboard oder via einmaliger Aktion ausführen
await creem.syncProducts(ctx);
```

### 4. React-Komponenten hinzufügen

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
          Monatlich abonnieren - ${(products.proMonthly.price / 100).toFixed(2)}/Monat
        </CheckoutLink>
      )}

      <CustomerPortalLink creemApi={api.creem}>
        Abonnement verwalten
      </CustomerPortalLink>
    </div>
  );
}
```

## Verwendung

### Abonnementdaten abfragen

Abonnementinformationen mit Echtzeit-Updates abfragen:

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
      productKey: subscription?.productKey, // z.B. "proMonthly"
    };
  },
});
```

### Abonnementänderungen behandeln

```ts
// Abonnement kündigen
const cancel = useAction(api.creem.cancelCurrentSubscription);
await cancel({ mode: "immediate" }); // oder "scheduled"

// Abonnement upgraden
const upgrade = useAction(api.creem.upgradeCurrentSubscription);
await upgrade({ productId: "prod_new_plan_id" });
```

### Vereinfachte Zugriffskontrolle (empfohlen)

Nutze die High-Level-Callbacks `onGrantAccess` / `onRevokeAccess` für den häufigsten Anwendungsfall — Zugriff gewähren und entziehen:

```ts
creem.registerRoutes(http as any, {
  onGrantAccess: async (ctx, { userId, productId, subscriptionId }) => {
    // Wird ausgelöst bei: checkout.completed, subscription.active, subscription.paid
    if (userId) {
      await ctx.runMutation(api.users.grantPremiumAccess, { userId, productId });
    }
  },
  onRevokeAccess: async (ctx, { userId, subscriptionId, reason }) => {
    // Wird ausgelöst bei: subscription.canceled, subscription.expired
    if (userId) {
      await ctx.runMutation(api.users.revokePremiumAccess, { userId });
    }
  },
});
```

### Granulare Webhook-Event-Callbacks

Für mehr Kontrolle nutze spezifische Per-Event-Callbacks. Diese können mit `onGrantAccess`/`onRevokeAccess` kombiniert werden:

```ts
creem.registerRoutes(http as any, {
  onCheckoutCompleted: async (ctx, event) => {
    const userId = event.object.metadata?.userId;
    if (userId) {
      await ctx.runMutation(api.users.grantPremiumAccess, { userId });
    }
  },
  onSubscriptionCanceled: async (ctx, event) => {
    // Zugriff bei Kündigung entziehen
  },
  onSubscriptionPaid: async (ctx, event) => {
    // Verlängerungszahlungen behandeln
  },
  onRefundCreated: async (ctx, event) => {
    // Erstattungen behandeln
  },
});
```

### Lizenzverwaltung

Lizenzschlüssel für Softwareverteilung validieren, aktivieren und deaktivieren:

```ts
const { validateLicense, activateLicense, deactivateLicense } = creem.api();

// Lizenzschlüssel validieren
const result = await validateLicense({ key: "LIC-KEY-123" });

// Auf einem Gerät aktivieren
const activated = await activateLicense({
  key: "LIC-KEY-123",
  instanceName: "MacBook des Benutzers",
});

// Gerät deaktivieren
await deactivateLicense({
  key: "LIC-KEY-123",
  instanceId: "inst_abc",
});
```

### Rabattcodes

Promotions-Rabatte erstellen und verwalten:

```ts
const { createDiscount, getDiscount, deleteDiscount } = creem.api();

// 20 % Rabatt erstellen
await createDiscount({
  code: "SAVE20",
  type: "percentage",
  amount: 20,
  maxRedemptions: 100,
});

// Beim Checkout anwenden
<CheckoutLink
  creemApi={api.creem}
  productId="prod_xxx"
  discountCode="SAVE20"
>
  20 % sparen
</CheckoutLink>
```

### Transaktionshistorie

Zahlungstransaktionen direkt abfragen:

```ts
const { getTransaction, listTransactions } = creem.api();

// Bestimmte Transaktion abrufen
const tx = await getTransaction({ transactionId: "tx_xxx" });

// Alle Transaktionen auflisten
const txList = await listTransactions({ pageNumber: 1, pageSize: 20 });
```

## API-Referenz

### Creem-Client

Die `Creem`-Klasse akzeptiert ein Konfigurationsobjekt:

| Option | Typ | Beschreibung |
|--------|------|-------------|
| `getUserInfo` | `(ctx) => Promise<{userId, email}>` | **Erforderlich.** Gibt aktuelle Benutzerinfos zurück. |
| `products` | `Record<string, string>` | Zuordnung von Schlüsseln zu Creem-Produkt-IDs. |
| `apiKey` | `string` | Creem-API-Schlüssel. Standard: Env-Var `CREEM_API_KEY`. |
| `webhookSecret` | `string` | Webhook-Geheimnis. Standard: Env-Var `CREEM_WEBHOOK_SECRET`. |
| `environment` | `"production" \| "test"` | API-Umgebung. Standard: `CREEM_ENVIRONMENT` oder `"test"`. |

### Query-Methoden

| Methode | Beschreibung |
|--------|-------------|
| `getCurrentSubscription(ctx, { userId })` | Aktives Abonnement eines Benutzers abrufen |
| `listUserSubscriptions(ctx, { userId })` | Alle Abonnements eines Benutzers auflisten |
| `listProducts(ctx, { activeOnly? })` | Alle synchronisierten Produkte auflisten |
| `getProduct(ctx, { productId })` | Bestimmtes Produkt abrufen |
| `listUserOrders(ctx, { userId })` | Alle Bestellungen eines Benutzers auflisten |
| `getCustomerByUserId(ctx, { userId })` | Kundendatensatz abrufen |

### Action-Methoden

| Methode | Beschreibung |
|--------|-------------|
| `createCheckoutSession(ctx, args)` | Checkout erstellen und URL zurückgeben |
| `cancelSubscription(ctx, opts?)` | Abonnement des aktuellen Benutzers kündigen |
| `upgradeSubscription(ctx, { productId })` | Auf anderes Produkt upgraden |
| `pauseSubscription(ctx)` | Abonnement des aktuellen Benutzers pausieren |
| `resumeSubscription(ctx)` | Pausiertes Abonnement fortsetzen |
| `generateCustomerPortalUrl(ctx)` | Kundenportal-URL abrufen |
| `syncProducts(ctx)` | Alle Produkte von Creem synchronisieren |

### Exportierte API-Funktionen

| Funktion | Typ | Beschreibung |
|----------|------|-------------|
| `generateCheckoutLink` | Action | Checkout-Link für Produkt erstellen |
| `generateCustomerPortalUrl` | Action | Kundenportal-URL abrufen |
| `cancelCurrentSubscription` | Action | Aktuelles Abonnement kündigen |
| `upgradeCurrentSubscription` | Action | Abonnement upgraden |
| `updateCurrentSubscription` | Action | Abonnement aktualisieren (Einheiten, Metadata) |
| `pauseCurrentSubscription` | Action | Aktuelles Abonnement pausieren |
| `resumeCurrentSubscription` | Action | Pausiertes Abonnement fortsetzen |
| `createProduct` | Action | Neues Produkt über Creem-API erstellen |
| `getConfiguredProducts` | Query | Produkte nach konfigurierten Schlüsseln abrufen |
| `listAllProducts` | Query | Alle synchronisierten Produkte auflisten |
| `getCurrentSubscription` | Query | Aktives Abonnement des aktuellen Benutzers |
| `listUserSubscriptions` | Query | Alle Abonnements des aktuellen Benutzers |
| `listUserOrders` | Query | Alle Bestellungen des aktuellen Benutzers |
| `syncProducts` | Action | Produkte von Creem-API synchronisieren |
| `validateLicense` | Action | Lizenzschlüssel validieren |
| `activateLicense` | Action | Lizenz auf Gerät aktivieren |
| `deactivateLicense` | Action | Lizenzinstanz deaktivieren |
| `createDiscount` | Action | Promo-Rabattcode erstellen |
| `getDiscount` | Action | Rabattdetails abrufen |
| `deleteDiscount` | Action | Rabattcode löschen |
| `getTransaction` | Action | Transaktion nach ID abrufen |
| `listTransactions` | Action | Zahlungstransaktionen auflisten |
| `getCustomerFromCreem` | Action | Kunde von Creem-API abrufen |
| `listCustomersFromCreem` | Action | Alle Kunden von Creem-API auflisten |

### React-Komponenten

#### `<CheckoutLink>`

| Prop | Typ | Beschreibung |
|------|------|-------------|
| `creemApi` | object | Objekt mit `generateCheckoutLink`-Funktion |
| `productId` | `string` | Creem-Produkt-ID |
| `successUrl` | `string?` | Redirect-URL nach Checkout |
| `metadata` | `object?` | Benutzerdefinierte Metadata für Checkout |
| `discountCode` | `string?` | Vorausgefüllter Rabattcode |
| `className` | `string?` | CSS-Klasse |

#### `<CheckoutButton>`

Gleiche Props wie `CheckoutLink`, holt aber die Checkout-URL beim Mount für sofortigen Klick-Durchgang.

#### `<CustomerPortalLink>`

| Prop | Typ | Beschreibung |
|------|------|-------------|
| `creemApi` | object | Objekt mit `generateCustomerPortalUrl`-Funktion |
| `className` | `string?` | CSS-Klasse |

### Webhook-Ereignisse

Alle Ereignisse werden automatisch synchronisiert. Unterstützte Ereignistypen:

| Ereignis | Beschreibung |
|-------|-------------|
| `checkout.completed` | Checkout-Sitzung abgeschlossen |
| `subscription.active` | Neues Abonnement erstellt |
| `subscription.paid` | Abonnementzahlung eingezogen |
| `subscription.canceled` | Abonnement gekündigt |
| `subscription.scheduled_cancel` | Kündigung für Periodenende geplant |
| `subscription.past_due` | Zahlung fehlgeschlagen, wird erneut versucht |
| `subscription.expired` | Abonnement abgelaufen |
| `subscription.update` | Abonnement aktualisiert |
| `subscription.trialing` | Abonnement in Testphase |
| `subscription.paused` | Abonnement pausiert |
| `refund.created` | Erstattung ausgestellt |
| `dispute.created` | Zahlungsstreit erstellt |

## Datenbankschema

Die Komponente speichert Daten in diesen sandboxed Tabellen:

- **customers** - Mappt Creem-Kunden auf Benutzer-IDs deiner App
- **products** - Von Creem synchronisierter Produktkatalog
- **subscriptions** - Abonnementstatus mit Echtzeit-Updates
- **orders** - Einmalige und wiederkehrende Bestellungen
- **webhookEvents** - Audit-Log aller Webhook-Ereignisse (idempotent)

Alle Daten werden automatisch per Webhooks synchron gehalten und sind mit Convex' Echtzeit-Reaktivität abfragbar.

## Testmodus

Creem bietet eine Testumgebung für die Entwicklung:

1. Setze `CREEM_ENVIRONMENT=test` (Standard)
2. Nutze Test-API-Schlüssel aus dem Creem-Dashboard
3. Testzahlungen funktionieren mit beliebiger Kartennummer
4. Webhook-Ereignisse werden an deine Test-Webhook-URL gesendet

Für die Produktion wechsle zu `CREEM_ENVIRONMENT=production` und nutze deine Live-API-Schlüssel.

## Lizenz

MIT
