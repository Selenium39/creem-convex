# Convex Creem Component

[![npm version](https://badge.fury.io/js/@creem_io%2Fconvex.svg)](https://badge.fury.io/js/@creem_io/convex)

[English](README.md) | [中文](README.zh-CN.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Polski](README.pl.md)

Integreer [Creem](https://creem.io)-betalingen, abonnementen en facturatie in je [Convex](https://convex.dev)-applicatie.

Creem is een Merchant of Record die mondiale betalingen, belastingnaleving en abonnementsbeheer afhandelt. Deze Convex-component brengt Creems volledige betalingsstack naar je Convex-backend met real-time reactiviteit.

**Bekijk de [voorbeeld-app](./example) voor een complete demo.**

```tsx
// Abonnementsgegevens van de huidige gebruiker ophalen
const subscription = await creem.getCurrentSubscription(ctx, { userId });

// Beschikbare plannen tonen
<CheckoutLink creemApi={api.creem} productId="prod_xxx">
  Upgraden naar Pro
</CheckoutLink>

// Bestaande abonnementen beheren
<CustomerPortalLink creemApi={api.creem}>
  Abonnement beheren
</CustomerPortalLink>
```

## Vereisten

### Convex-app

Je hebt een Convex-app nodig om deze component te gebruiken. Volg een van de [Convex quickstarts](https://docs.convex.dev/home) om er een in te richten.

### Creem-account

1. [Creem-account aanmaken](https://creem.io)
2. Producten aanmaken in het Creem-dashboard
3. API-sleutel ophalen bij **Instellingen > API Keys**
4. Webhook-geheim ophalen bij **Ontwikkelaars > Webhooks**

## Installatie

Installeer het componentpakket:

```bash
npm install @creem_io/convex
```

Maak een `convex.config.ts`-bestand in de `convex/`-map van je app en installeer de component door `app.use` aan te roepen:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import creem from "@creem_io/convex/convex.config.js";

const app = defineApp();
app.use(creem);
export default app;
```

Stel je Creem-referenties in als omgevingsvariabelen:

```bash
npx convex env set CREEM_API_KEY creem_xxxxx
npx convex env set CREEM_WEBHOOK_SECRET whsec_xxxxx
# Optioneel: "production" voor livemodus (standaard: "test")
npx convex env set CREEM_ENVIRONMENT test
```

## Snelstart

### 1. Creem-client initialiseren

```ts
// convex/creem.ts
import { Creem } from "@creem_io/convex";
import { api, components } from "./_generated/api";

export const creem = new Creem(components.creem, {
  // Vereist: functie om de ID en e-mail van de huidige gebruiker op te halen
  getUserInfo: async (ctx) => {
    const user = await ctx.runQuery(api.users.getCurrentUser);
    return { userId: user._id, email: user.email };
  },

  // Optioneel: vriendelijke sleutels mappen naar Creem-product-ID's
  products: {
    proMonthly: "prod_xxxxx",
    proYearly: "prod_yyyyy",
  },
});

// API-functies exporteren
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

### 2. Webhooks instellen

Registreer de webhook-handler in je `convex/http.ts`:

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { creem } from "./creem";

const http = httpRouter();

creem.registerRoutes(http as any, {
  // Optioneel: aangepast pad (standaard: "/creem/webhook")
  path: "/creem/webhook",

  // Optioneel: callbacks voor webhook-gebeurtenissen
  onCheckoutCompleted: async (ctx, event) => {
    console.log("Checkout completed:", event.object);
  },
  onSubscriptionCanceled: async (ctx, event) => {
    console.log("Subscription canceled:", event.object);
  },
});

export default http;
```

Registreer vervolgens de webhook-URL in je [Creem-dashboard](https://creem.io/dashboard/developers):

```
https://<jouw-convex-site-url>/creem/webhook
```

Je Convex-site-URL vind je in je [Convex-dashboard](https://dashboard.convex.dev) of via de `CONVEX_SITE_URL` systeemomgevingsvariabele.

### 3. Bestaande producten synchroniseren

Als je producten hebt aangemaakt vóór het installeren van deze component, synchroniseer ze:

```ts
// Eenmalig uitvoeren vanuit je Convex-dashboard of via een eenmalige actie
await creem.syncProducts(ctx);
```

### 4. React-componenten toevoegen

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
          Maandelijks abonneren - ${(products.proMonthly.price / 100).toFixed(2)}/maand
        </CheckoutLink>
      )}

      <CustomerPortalLink creemApi={api.creem}>
        Abonnement beheren
      </CustomerPortalLink>
    </div>
  );
}
```

## Gebruik

### Abonnementsgegevens ophalen

Abonnementsinformatie opvragen met real-time updates:

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
      productKey: subscription?.productKey, // bijv. "proMonthly"
    };
  },
});
```

### Abonnementswijzigingen afhandelen

```ts
// Abonnement opzeggen
const cancel = useAction(api.creem.cancelCurrentSubscription);
await cancel({ mode: "immediate" }); // of "scheduled"

// Abonnement upgraden
const upgrade = useAction(api.creem.upgradeCurrentSubscription);
await upgrade({ productId: "prod_new_plan_id" });
```

### Vereenvoudigde toegangscontrole (aanbevolen)

Gebruik de high-level `onGrantAccess` / `onRevokeAccess` callbacks voor het meest voorkomende gebruik — toegang verlenen en intrekken:

```ts
creem.registerRoutes(http as any, {
  onGrantAccess: async (ctx, { userId, productId, subscriptionId }) => {
    // Wordt getriggerd bij: checkout.completed, subscription.active, subscription.paid
    if (userId) {
      await ctx.runMutation(api.users.grantPremiumAccess, { userId, productId });
    }
  },
  onRevokeAccess: async (ctx, { userId, subscriptionId, reason }) => {
    // Wordt getriggerd bij: subscription.canceled, subscription.expired
    if (userId) {
      await ctx.runMutation(api.users.revokePremiumAccess, { userId });
    }
  },
});
```

### Gedetailleerde webhook-event callbacks

Voor meer controle, gebruik specifieke per-event callbacks. Deze kunnen gecombineerd worden met `onGrantAccess`/`onRevokeAccess`:

```ts
creem.registerRoutes(http as any, {
  onCheckoutCompleted: async (ctx, event) => {
    const userId = event.object.metadata?.userId;
    if (userId) {
      await ctx.runMutation(api.users.grantPremiumAccess, { userId });
    }
  },
  onSubscriptionCanceled: async (ctx, event) => {
    // Toegang intrekken bij opzegging
  },
  onSubscriptionPaid: async (ctx, event) => {
    // Vernieuwingsbetalingen afhandelen
  },
  onRefundCreated: async (ctx, event) => {
    // Terugbetalingen afhandelen
  },
});
```

### Licentiebeheer

Licentiesleutels valideren, activeren en deactiveren voor softwareverspreiding:

```ts
const { validateLicense, activateLicense, deactivateLicense } = creem.api();

// Licentiesleutel valideren
const result = await validateLicense({ key: "LIC-KEY-123" });

// Activeren op een apparaat
const activated = await activateLicense({
  key: "LIC-KEY-123",
  instanceName: "MacBook van gebruiker",
});

// Apparaat deactiveren
await deactivateLicense({
  key: "LIC-KEY-123",
  instanceId: "inst_abc",
});
```

### Kortingscodes

Promotiekortingen aanmaken en beheren:

```ts
const { createDiscount, getDiscount, deleteDiscount } = creem.api();

// 20% korting aanmaken
await createDiscount({
  code: "SAVE20",
  type: "percentage",
  amount: 20,
  maxRedemptions: 100,
});

// Toepassen bij checkout
<CheckoutLink
  creemApi={api.creem}
  productId="prod_xxx"
  discountCode="SAVE20"
>
  20% korting
</CheckoutLink>
```

### Transactiehistorie

Betalingstransacties direct opvragen:

```ts
const { getTransaction, listTransactions } = creem.api();

// Specifieke transactie ophalen
const tx = await getTransaction({ transactionId: "tx_xxx" });

// Alle transacties opvragen
const txList = await listTransactions({ pageNumber: 1, pageSize: 20 });
```

## API-referentie

### Creem-client

De `Creem`-klasse accepteert een configuratie-object:

| Optie | Type | Beschrijving |
|--------|------|-------------|
| `getUserInfo` | `(ctx) => Promise<{userId, email}>` | **Vereist.** Retourneert huidige gebruikersinfo. |
| `products` | `Record<string, string>` | Mapping van sleutels naar Creem-product-ID's. |
| `apiKey` | `string` | Creem API-sleutel. Standaard: `CREEM_API_KEY` env var. |
| `webhookSecret` | `string` | Webhook-geheim. Standaard: `CREEM_WEBHOOK_SECRET` env var. |
| `environment` | `"production" \| "test"` | API-omgeving. Standaard: `CREEM_ENVIRONMENT` of `"test"`. |

### Query-methoden

| Methode | Beschrijving |
|--------|-------------|
| `getCurrentSubscription(ctx, { userId })` | Actief abonnement van een gebruiker ophalen |
| `listUserSubscriptions(ctx, { userId })` | Alle abonnementen van een gebruiker opvragen |
| `listProducts(ctx, { activeOnly? })` | Alle gesynchroniseerde producten opvragen |
| `getProduct(ctx, { productId })` | Specifiek product ophalen |
| `listUserOrders(ctx, { userId })` | Alle bestellingen van een gebruiker opvragen |
| `getCustomerByUserId(ctx, { userId })` | Klantrecord ophalen |

### Action-methoden

| Methode | Beschrijving |
|--------|-------------|
| `createCheckoutSession(ctx, args)` | Checkout aanmaken en URL retourneren |
| `cancelSubscription(ctx, opts?)` | Abonnement van huidige gebruiker opzeggen |
| `upgradeSubscription(ctx, { productId })` | Upgraden naar ander product |
| `pauseSubscription(ctx)` | Abonnement van huidige gebruiker pauzeren |
| `resumeSubscription(ctx)` | Gepauzeerd abonnement hervatten |
| `generateCustomerPortalUrl(ctx)` | Klantenportaal-URL ophalen |
| `syncProducts(ctx)` | Alle producten van Creem synchroniseren |

### Geëxporteerde API-functies

| Functie | Type | Beschrijving |
|----------|------|-------------|
| `generateCheckoutLink` | Action | Checkout-link voor product aanmaken |
| `generateCustomerPortalUrl` | Action | Klantenportaal-URL ophalen |
| `cancelCurrentSubscription` | Action | Huidig abonnement opzeggen |
| `upgradeCurrentSubscription` | Action | Abonnement upgraden |
| `updateCurrentSubscription` | Action | Abonnement bijwerken (eenheden, metadata) |
| `pauseCurrentSubscription` | Action | Huidig abonnement pauzeren |
| `resumeCurrentSubscription` | Action | Gepauzeerd abonnement hervatten |
| `createProduct` | Action | Nieuw product aanmaken via Creem-API |
| `getConfiguredProducts` | Query | Producten ophalen per geconfigureerde sleutels |
| `listAllProducts` | Query | Alle gesynchroniseerde producten opvragen |
| `getCurrentSubscription` | Query | Actief abonnement van huidige gebruiker |
| `listUserSubscriptions` | Query | Alle abonnementen van huidige gebruiker |
| `listUserOrders` | Query | Alle bestellingen van huidige gebruiker |
| `syncProducts` | Action | Producten synchroniseren van Creem-API |
| `validateLicense` | Action | Licentiesleutel valideren |
| `activateLicense` | Action | Licentie activeren op apparaat |
| `deactivateLicense` | Action | Licentie-instantie deactiveren |
| `createDiscount` | Action | Promotiekortingscode aanmaken |
| `getDiscount` | Action | Kortingsdetails ophalen |
| `deleteDiscount` | Action | Kortingscode verwijderen |
| `getTransaction` | Action | Transactie ophalen op ID |
| `listTransactions` | Action | Betalingstransacties opvragen |
| `getCustomerFromCreem` | Action | Klant ophalen van Creem-API |
| `listCustomersFromCreem` | Action | Alle klanten ophalen van Creem-API |

### React-componenten

#### `<CheckoutLink>`

| Prop | Type | Beschrijving |
|------|------|-------------|
| `creemApi` | object | Object met `generateCheckoutLink` functie |
| `productId` | `string` | Creem-product-ID |
| `successUrl` | `string?` | Redirect-URL na checkout |
| `metadata` | `object?` | Aangepaste metadata voor checkout |
| `discountCode` | `string?` | Vooraf ingevulde kortingscode |
| `className` | `string?` | CSS-class |

#### `<CheckoutButton>`

Dezelfde props als `CheckoutLink`, maar haalt de checkout-URL op bij mount voor directe doorklik.

#### `<CustomerPortalLink>`

| Prop | Type | Beschrijving |
|------|------|-------------|
| `creemApi` | object | Object met `generateCustomerPortalUrl` functie |
| `className` | `string?` | CSS-class |

### Webhook-gebeurtenissen

Alle gebeurtenissen worden automatisch gesynchroniseerd. Ondersteunde gebeurtenistypen:

| Gebeurtenis | Beschrijving |
|-------|-------------|
| `checkout.completed` | Checkoutsessie voltooid |
| `subscription.active` | Nieuw abonnement aangemaakt |
| `subscription.paid` | Abonnementsbetaling ontvangen |
| `subscription.canceled` | Abonnement opgezegd |
| `subscription.scheduled_cancel` | Opzegging gepland voor einde periode |
| `subscription.past_due` | Betaling mislukt, opnieuw proberen |
| `subscription.expired` | Abonnement verlopen |
| `subscription.update` | Abonnement bijgewerkt |
| `subscription.trialing` | Abonnement in proefperiode |
| `subscription.paused` | Abonnement gepauzeerd |
| `refund.created` | Terugbetaling uitgevoerd |
| `dispute.created` | Betalingsgeschil aangemaakt |

## Databaseschema

De component slaat gegevens op in deze gesandboxde tabellen:

- **customers** - Mapt Creem-klanten naar gebruikers-ID's van je app
- **products** - Productcatalogus gesynchroniseerd van Creem
- **subscriptions** - Abonnementsstatus met real-time updates
- **orders** - Eenmalige en terugkerende bestelrecords
- **webhookEvents** - Auditlog van alle webhook-gebeurtenissen (idempotent)

Alle gegevens worden automatisch gesynchroniseerd via webhooks en zijn querybaar met Convex' real-time reactiviteit.

## Testmodus

Creem biedt een testomgeving voor ontwikkeling:

1. Stel `CREEM_ENVIRONMENT=test` in (dit is de standaard)
2. Gebruik test-API-sleutels uit je Creem-dashboard
3. Testbetalingen werken met elk kaartnummer
4. Webhook-gebeurtenissen worden naar je test-webhook-URL gestuurd

Voor productie wijzig naar `CREEM_ENVIRONMENT=production` en gebruik je live-API-sleutels.

## Licentie

MIT
