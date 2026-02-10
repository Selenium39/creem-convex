# Komponent Convex Creem

[![npm version](https://badge.fury.io/js/@creem_io%2Fconvex.svg)](https://badge.fury.io/js/@creem_io/convex)

[English](README.md) | [中文](README.zh-CN.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Nederlands](README.nl.md)

Integruje płatności, subskrypcje i rozliczenia [Creem](https://creem.io) w Twojej aplikacji [Convex](https://convex.dev).

Creem to Merchant of Record obsługujący globalne płatności, zgodność podatkową i zarządzanie subskrypcjami. Ten komponent Convex przenosi pełny stos płatności Creem do Twojego backendu Convex z reaktywnością w czasie rzeczywistym.

**Zobacz [aplikację przykładową](./example) dla pełnej demonstracji.**

```tsx
// Pobierz szczegóły subskrypcji bieżącego użytkownika
const subscription = await creem.getCurrentSubscription(ctx, { userId });

// Pokaż dostępne plany
<CheckoutLink creemApi={api.creem} productId="prod_xxx">
  Przejdź na Pro
</CheckoutLink>

// Zarządzaj istniejącymi subskrypcjami
<CustomerPortalLink creemApi={api.creem}>
  Zarządzaj subskrypcją
</CustomerPortalLink>
```

## Wymagania wstępne

### Aplikacja Convex

Potrzebujesz aplikacji Convex do korzystania z tego komponentu. Wykonaj jeden z [przewodników szybkiego startu Convex](https://docs.convex.dev/home), aby ją skonfigurować.

### Konto Creem

1. [Utwórz konto Creem](https://creem.io)
2. Utwórz produkty w panelu Creem
3. Pobierz klucz API w **Ustawienia > API Keys**
4. Pobierz sekret webhook w **Deweloperzy > Webhooks**

## Instalacja

Zainstaluj pakiet komponentu:

```bash
npm install @creem_io/convex
```

Utwórz plik `convex.config.ts` w folderze `convex/` swojej aplikacji i zainstaluj komponent wywołując `app.use`:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import creem from "@creem_io/convex/convex.config.js";

const app = defineApp();
app.use(creem);
export default app;
```

Ustaw dane uwierzytelniające Creem jako zmienne środowiskowe:

```bash
npx convex env set CREEM_API_KEY creem_xxxxx
npx convex env set CREEM_WEBHOOK_SECRET whsec_xxxxx
# Opcjonalnie: ustaw "production" dla trybu na żywo (domyślnie "test")
npx convex env set CREEM_ENVIRONMENT test
```

## Szybki start

### 1. Zainicjuj klienta Creem

```ts
// convex/creem.ts
import { Creem } from "@creem_io/convex";
import { api, components } from "./_generated/api";

export const creem = new Creem(components.creem, {
  // Wymagane: funkcja pobierająca ID i email bieżącego użytkownika
  getUserInfo: async (ctx) => {
    const user = await ctx.runQuery(api.users.getCurrentUser);
    return { userId: user._id, email: user.email };
  },

  // Opcjonalnie: mapuj przyjazne klucze na ID produktów Creem
  products: {
    proMonthly: "prod_xxxxx",
    proYearly: "prod_yyyyy",
  },
});

// Eksportuj funkcje API
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

### 2. Skonfiguruj webhooki

Zarejestruj handler webhooka w pliku `convex/http.ts`:

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { creem } from "./creem";

const http = httpRouter();

creem.registerRoutes(http as any, {
  // Opcjonalnie: niestandardowa ścieżka (domyślnie "/creem/webhook")
  path: "/creem/webhook",

  // Opcjonalnie: callbacki dla zdarzeń webhook
  onCheckoutCompleted: async (ctx, event) => {
    console.log("Checkout completed:", event.object);
  },
  onSubscriptionCanceled: async (ctx, event) => {
    console.log("Subscription canceled:", event.object);
  },
});

export default http;
```

Następnie zarejestruj URL webhooka w [Panelu Creem](https://creem.io/dashboard/developers):

```
https://<twoja-url-strony-convex>/creem/webhook
```

URL Twojej strony Convex znajdziesz w [panelu Convex](https://dashboard.convex.dev) lub w zmiennej środowiskowej systemowej `CONVEX_SITE_URL`.

### 3. Zsynchronizuj istniejące produkty

Jeśli utworzyłeś produkty przed instalacją tego komponentu, zsynchronizuj je:

```ts
// Uruchom raz z panelu Convex lub poprzez jednorazową akcję
await creem.syncProducts(ctx);
```

### 4. Dodaj komponenty React

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
          Subskrypcja miesięczna - ${(products.proMonthly.price / 100).toFixed(2)}/mies.
        </CheckoutLink>
      )}

      <CustomerPortalLink creemApi={api.creem}>
        Zarządzaj subskrypcją
      </CustomerPortalLink>
    </div>
  );
}
```

## Użycie

### Dostęp do danych subskrypcji

Pobieraj informacje o subskrypcji z aktualizacjami w czasie rzeczywistym:

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
      productKey: subscription?.productKey, // np. "proMonthly"
    };
  },
});
```

### Obsługa zmian subskrypcji

```ts
// Anuluj subskrypcję
const cancel = useAction(api.creem.cancelCurrentSubscription);
await cancel({ mode: "immediate" }); // lub "scheduled"

// Ulepsz subskrypcję
const upgrade = useAction(api.creem.upgradeCurrentSubscription);
await upgrade({ productId: "prod_new_plan_id" });
```

### Uproszczona kontrola dostępu (zalecane)

Użyj callbacków wysokiego poziomu `onGrantAccess` / `onRevokeAccess` dla najczęstszego przypadku użycia — przyznawania i cofania dostępu:

```ts
creem.registerRoutes(http as any, {
  onGrantAccess: async (ctx, { userId, productId, subscriptionId }) => {
    // Wyzwalane przy: checkout.completed, subscription.active, subscription.paid
    if (userId) {
      await ctx.runMutation(api.users.grantPremiumAccess, { userId, productId });
    }
  },
  onRevokeAccess: async (ctx, { userId, subscriptionId, reason }) => {
    // Wyzwalane przy: subscription.canceled, subscription.expired
    if (userId) {
      await ctx.runMutation(api.users.revokePremiumAccess, { userId });
    }
  },
});
```

### Szczegółowe callbacki zdarzeń webhook

Dla większej kontroli użyj specyficznych callbacków na zdarzenie. Można je łączyć z `onGrantAccess`/`onRevokeAccess`:

```ts
creem.registerRoutes(http as any, {
  onCheckoutCompleted: async (ctx, event) => {
    const userId = event.object.metadata?.userId;
    if (userId) {
      await ctx.runMutation(api.users.grantPremiumAccess, { userId });
    }
  },
  onSubscriptionCanceled: async (ctx, event) => {
    // Cofnij dostęp przy anulowaniu
  },
  onSubscriptionPaid: async (ctx, event) => {
    // Obsłuż płatności odnowień
  },
  onRefundCreated: async (ctx, event) => {
    // Obsłuż zwroty
  },
});
```

### Zarządzanie licencjami

Waliduj, aktywuj i dezaktywuj klucze licencji do dystrybucji oprogramowania:

```ts
const { validateLicense, activateLicense, deactivateLicense } = creem.api();

// Waliduj klucz licencji
const result = await validateLicense({ key: "LIC-KEY-123" });

// Aktywuj na urządzeniu
const activated = await activateLicense({
  key: "LIC-KEY-123",
  instanceName: "MacBook użytkownika",
});

// Dezaktywuj urządzenie
await deactivateLicense({
  key: "LIC-KEY-123",
  instanceId: "inst_abc",
});
```

### Kody rabatowe

Twórz i zarządzaj rabatami promocyjnymi:

```ts
const { createDiscount, getDiscount, deleteDiscount } = creem.api();

// Utwórz rabat 20%
await createDiscount({
  code: "SAVE20",
  type: "percentage",
  amount: 20,
  maxRedemptions: 100,
});

// Zastosuj przy checkout
<CheckoutLink
  creemApi={api.creem}
  productId="prod_xxx"
  discountCode="SAVE20"
>
  Otrzymaj 20% rabatu
</CheckoutLink>
```

### Historia transakcji

Pobieraj transakcje płatności bezpośrednio:

```ts
const { getTransaction, listTransactions } = creem.api();

// Pobierz konkretną transakcję
const tx = await getTransaction({ transactionId: "tx_xxx" });

// Lista wszystkich transakcji
const txList = await listTransactions({ pageNumber: 1, pageSize: 20 });
```

## Referencja API

### Klient Creem

Klasa `Creem` przyjmuje obiekt konfiguracji:

| Opcja | Typ | Opis |
|--------|------|-------------|
| `getUserInfo` | `(ctx) => Promise<{userId, email}>` | **Wymagane.** Zwraca info bieżącego użytkownika. |
| `products` | `Record<string, string>` | Mapowanie kluczy na ID produktów Creem. |
| `apiKey` | `string` | Klucz API Creem. Domyślnie: zmienna env `CREEM_API_KEY`. |
| `webhookSecret` | `string` | Sekret webhook. Domyślnie: zmienna env `CREEM_WEBHOOK_SECRET`. |
| `environment` | `"production" \| "test"` | Środowisko API. Domyślnie: `CREEM_ENVIRONMENT` lub `"test"`. |

### Metody Query

| Metoda | Opis |
|--------|-------------|
| `getCurrentSubscription(ctx, { userId })` | Pobierz aktywną subskrypcję użytkownika |
| `listUserSubscriptions(ctx, { userId })` | Lista wszystkich subskrypcji użytkownika |
| `listProducts(ctx, { activeOnly? })` | Lista wszystkich zsynchronizowanych produktów |
| `getProduct(ctx, { productId })` | Pobierz konkretny produkt |
| `listUserOrders(ctx, { userId })` | Lista wszystkich zamówień użytkownika |
| `getCustomerByUserId(ctx, { userId })` | Pobierz rekord klienta |

### Metody Action

| Metoda | Opis |
|--------|-------------|
| `createCheckoutSession(ctx, args)` | Utwórz checkout i zwróć URL |
| `cancelSubscription(ctx, opts?)` | Anuluj subskrypcję bieżącego użytkownika |
| `upgradeSubscription(ctx, { productId })` | Ulepsz na inny produkt |
| `pauseSubscription(ctx)` | Wstrzymaj subskrypcję bieżącego użytkownika |
| `resumeSubscription(ctx)` | Wznów wstrzymaną subskrypcję |
| `generateCustomerPortalUrl(ctx)` | Pobierz URL portalu klienta |
| `syncProducts(ctx)` | Zsynchronizuj wszystkie produkty z Creem |

### Eksportowane funkcje API

| Funkcja | Typ | Opis |
|----------|------|-------------|
| `generateCheckoutLink` | Action | Utwórz link checkout dla produktu |
| `generateCustomerPortalUrl` | Action | Pobierz URL portalu klienta |
| `cancelCurrentSubscription` | Action | Anuluj bieżącą subskrypcję |
| `upgradeCurrentSubscription` | Action | Ulepsz subskrypcję |
| `updateCurrentSubscription` | Action | Zaktualizuj subskrypcję (jednostki, metadata) |
| `pauseCurrentSubscription` | Action | Wstrzymaj bieżącą subskrypcję |
| `resumeCurrentSubscription` | Action | Wznów wstrzymaną subskrypcję |
| `createProduct` | Action | Utwórz nowy produkt przez API Creem |
| `getConfiguredProducts` | Query | Pobierz produkty według skonfigurowanych kluczy |
| `listAllProducts` | Query | Lista wszystkich zsynchronizowanych produktów |
| `getCurrentSubscription` | Query | Pobierz aktywną subskrypcję bieżącego użytkownika |
| `listUserSubscriptions` | Query | Lista wszystkich subskrypcji bieżącego użytkownika |
| `listUserOrders` | Query | Lista wszystkich zamówień bieżącego użytkownika |
| `syncProducts` | Action | Synchronizuj produkty z API Creem |
| `validateLicense` | Action | Waliduj klucz licencji |
| `activateLicense` | Action | Aktywuj licencję na urządzeniu |
| `deactivateLicense` | Action | Dezaktywuj instancję licencji |
| `createDiscount` | Action | Utwórz kod rabatowy promocyjny |
| `getDiscount` | Action | Pobierz szczegóły rabatu |
| `deleteDiscount` | Action | Usuń kod rabatowy |
| `getTransaction` | Action | Pobierz transakcję po ID |
| `listTransactions` | Action | Lista transakcji płatności |
| `getCustomerFromCreem` | Action | Pobierz klienta z API Creem |
| `listCustomersFromCreem` | Action | Lista wszystkich klientów z API Creem |

### Komponenty React

#### `<CheckoutLink>`

| Prop | Typ | Opis |
|------|------|-------------|
| `creemApi` | object | Obiekt z funkcją `generateCheckoutLink` |
| `productId` | `string` | ID produktu Creem |
| `successUrl` | `string?` | URL przekierowania po checkout |
| `metadata` | `object?` | Własna metadata dla checkout |
| `discountCode` | `string?` | Wstępnie wypełniony kod rabatowy |
| `className` | `string?` | Klasa CSS |

#### `<CheckoutButton>`

Te same propsy co `CheckoutLink`, ale pobiera URL checkout przy montowaniu dla natychmiastowego kliknięcia.

#### `<CustomerPortalLink>`

| Prop | Typ | Opis |
|------|------|-------------|
| `creemApi` | object | Obiekt z funkcją `generateCustomerPortalUrl` |
| `className` | `string?` | Klasa CSS |

### Zdarzenia Webhook

Wszystkie zdarzenia są automatycznie synchronizowane. Obsługiwane typy zdarzeń:

| Zdarzenie | Opis |
|-------|-------------|
| `checkout.completed` | Sesja checkout zakończona |
| `subscription.active` | Nowa subskrypcja utworzona |
| `subscription.paid` | Płatność subskrypcji pobrana |
| `subscription.canceled` | Subskrypcja anulowana |
| `subscription.scheduled_cancel` | Anulowanie zaplanowane na koniec okresu |
| `subscription.past_due` | Płatność nieudana, ponawianie |
| `subscription.expired` | Subskrypcja wygasła |
| `subscription.update` | Subskrypcja zaktualizowana |
| `subscription.trialing` | Subskrypcja w okresie próbnym |
| `subscription.paused` | Subskrypcja wstrzymana |
| `refund.created` | Zwrot wystawiony |
| `dispute.created` | Spór płatności utworzony |

## Schemat bazy danych

Komponent przechowuje dane w tych izolowanych tabelach:

- **customers** - Mapuje klientów Creem na ID użytkowników Twojej aplikacji
- **products** - Katalog produktów zsynchronizowany z Creem
- **subscriptions** - Stan subskrypcji z aktualizacjami w czasie rzeczywistym
- **orders** - Rekordy zamówień jednorazowych i cyklicznych
- **webhookEvents** - Dziennik audytu wszystkich zdarzeń webhook (idempotentny)

Wszystkie dane są automatycznie synchronizowane przez webhooki i są do odpytywania dzięki reaktywności Convex w czasie rzeczywistym.

## Tryb testowy

Creem zapewnia środowisko testowe do rozwoju:

1. Ustaw `CREEM_ENVIRONMENT=test` (to wartość domyślna)
2. Użyj kluczy API testowych z panelu Creem
3. Płatności testowe działają z dowolnym numerem karty
4. Zdarzenia webhook są wysyłane na Twój testowy URL webhooka

Gdy będziesz gotowy do produkcji, przełącz na `CREEM_ENVIRONMENT=production` i użyj produkcyjnych kluczy API.

## Licencja

MIT
