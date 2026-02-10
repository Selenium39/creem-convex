# Composant Convex Creem

[![npm version](https://badge.fury.io/js/@creem_io%2Fconvex.svg)](https://badge.fury.io/js/@creem_io/convex)

[English](README.md) | [中文](README.zh-CN.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md)

Intègre les paiements, abonnements et facturation [Creem](https://creem.io) dans votre application [Convex](https://convex.dev).

Creem est un Merchant of Record qui gère les paiements mondiaux, la conformité fiscale et la gestion des abonnements. Ce composant Convex apporte l'intégralité de la stack de paiement Creem dans votre backend Convex avec une réactivité en temps réel.

**Consultez l'[application exemple](./example) pour une démonstration complète.**

```tsx
// Obtenir les détails d'abonnement de l'utilisateur actuel
const subscription = await creem.getCurrentSubscription(ctx, { userId });

// Afficher les formules disponibles
<CheckoutLink creemApi={api.creem} productId="prod_xxx">
  Passer à Pro
</CheckoutLink>

// Gérer les abonnements existants
<CustomerPortalLink creemApi={api.creem}>
  Gérer l'abonnement
</CustomerPortalLink>
```

## Prérequis

### Application Convex

Vous aurez besoin d'une application Convex pour utiliser ce composant. Suivez l'un des [guides de démarrage Convex](https://docs.convex.dev/home) pour en configurer une.

### Compte Creem

1. [Créer un compte Creem](https://creem.io)
2. Créer des produits dans le tableau de bord Creem
3. Obtenir votre clé API dans **Paramètres > API Keys**
4. Obtenir votre secret webhook dans **Développeurs > Webhooks**

## Installation

Installez le paquet du composant :

```bash
npm install @creem_io/convex
```

Créez un fichier `convex.config.ts` dans le dossier `convex/` de votre application et installez le composant en appelant `app.use` :

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import creem from "@creem_io/convex/convex.config.js";

const app = defineApp();
app.use(creem);
export default app;
```

Configurez vos identifiants Creem comme variables d'environnement :

```bash
npx convex env set CREEM_API_KEY creem_xxxxx
npx convex env set CREEM_WEBHOOK_SECRET whsec_xxxxx
# Optionnel : définir "production" pour le mode live (par défaut "test")
npx convex env set CREEM_ENVIRONMENT test
```

## Démarrage rapide

### 1. Initialiser le client Creem

```ts
// convex/creem.ts
import { Creem } from "@creem_io/convex";
import { api, components } from "./_generated/api";

export const creem = new Creem(components.creem, {
  // Requis : fournir une fonction pour obtenir l'ID et l'email de l'utilisateur actuel
  getUserInfo: async (ctx) => {
    const user = await ctx.runQuery(api.users.getCurrentUser);
    return { userId: user._id, email: user.email };
  },

  // Optionnel : mapper des clés conviviales aux IDs de produit Creem
  products: {
    proMonthly: "prod_xxxxx",
    proYearly: "prod_yyyyy",
  },
});

// Exporter les fonctions API
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

### 2. Configurer les webhooks

Enregistrez le gestionnaire de webhook dans votre `convex/http.ts` :

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { creem } from "./creem";

const http = httpRouter();

creem.registerRoutes(http as any, {
  // Optionnel : chemin personnalisé (par défaut "/creem/webhook")
  path: "/creem/webhook",

  // Optionnel : callbacks pour les événements webhook
  onCheckoutCompleted: async (ctx, event) => {
    console.log("Checkout completed:", event.object);
  },
  onSubscriptionCanceled: async (ctx, event) => {
    console.log("Subscription canceled:", event.object);
  },
});

export default http;
```

Puis enregistrez l'URL du webhook dans votre [Tableau de bord Creem](https://creem.io/dashboard/developers) :

```
https://<votre-url-site-convex>/creem/webhook
```

L'URL de votre site Convex se trouve dans votre [tableau de bord Convex](https://dashboard.convex.dev) ou via la variable d'environnement système `CONVEX_SITE_URL`.

### 3. Synchroniser les produits existants

Si vous avez créé des produits avant d'installer ce composant, synchronisez-les :

```ts
// Exécuter une fois depuis le tableau de bord Convex ou via une action unique
await creem.syncProducts(ctx);
```

### 4. Ajouter les composants React

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
          Abonnement mensuel - ${(products.proMonthly.price / 100).toFixed(2)}/mois
        </CheckoutLink>
      )}

      <CustomerPortalLink creemApi={api.creem}>
        Gérer l'abonnement
      </CustomerPortalLink>
    </div>
  );
}
```

## Utilisation

### Accéder aux données d'abonnement

Interrogez les informations d'abonnement avec des mises à jour en temps réel :

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
      productKey: subscription?.productKey, // ex. "proMonthly"
    };
  },
});
```

### Gérer les changements d'abonnement

```ts
// Annuler l'abonnement
const cancel = useAction(api.creem.cancelCurrentSubscription);
await cancel({ mode: "immediate" }); // ou "scheduled"

// Mettre à niveau l'abonnement
const upgrade = useAction(api.creem.upgradeCurrentSubscription);
await upgrade({ productId: "prod_new_plan_id" });
```

### Contrôle d'accès simplifié (recommandé)

Utilisez les callbacks de haut niveau `onGrantAccess` / `onRevokeAccess` pour le cas d'usage le plus courant — accorder et révoquer l'accès :

```ts
creem.registerRoutes(http as any, {
  onGrantAccess: async (ctx, { userId, productId, subscriptionId }) => {
    // Déclenché sur : checkout.completed, subscription.active, subscription.paid
    if (userId) {
      await ctx.runMutation(api.users.grantPremiumAccess, { userId, productId });
    }
  },
  onRevokeAccess: async (ctx, { userId, subscriptionId, reason }) => {
    // Déclenché sur : subscription.canceled, subscription.expired
    if (userId) {
      await ctx.runMutation(api.users.revokePremiumAccess, { userId });
    }
  },
});
```

### Callbacks granulaires par événement webhook

Pour plus de contrôle, utilisez des callbacks spécifiques par événement. Ils peuvent être combinés avec `onGrantAccess`/`onRevokeAccess` :

```ts
creem.registerRoutes(http as any, {
  onCheckoutCompleted: async (ctx, event) => {
    const userId = event.object.metadata?.userId;
    if (userId) {
      await ctx.runMutation(api.users.grantPremiumAccess, { userId });
    }
  },
  onSubscriptionCanceled: async (ctx, event) => {
    // Révoquer l'accès à l'annulation
  },
  onSubscriptionPaid: async (ctx, event) => {
    // Gérer les paiements de renouvellement
  },
  onRefundCreated: async (ctx, event) => {
    // Gérer les remboursements
  },
});
```

### Gestion des licences

Validez, activez et désactivez les clés de licence pour la distribution de logiciels :

```ts
const { validateLicense, activateLicense, deactivateLicense } = creem.api();

// Valider une clé de licence
const result = await validateLicense({ key: "LIC-KEY-123" });

// Activer sur un appareil
const activated = await activateLicense({
  key: "LIC-KEY-123",
  instanceName: "MacBook de l'utilisateur",
});

// Désactiver un appareil
await deactivateLicense({
  key: "LIC-KEY-123",
  instanceId: "inst_abc",
});
```

### Codes de réduction

Créez et gérez des réductions promotionnelles :

```ts
const { createDiscount, getDiscount, deleteDiscount } = creem.api();

// Créer une réduction de 20 %
await createDiscount({
  code: "SAVE20",
  type: "percentage",
  amount: 20,
  maxRedemptions: 100,
});

// Appliquer au checkout
<CheckoutLink
  creemApi={api.creem}
  productId="prod_xxx"
  discountCode="SAVE20"
>
  Obtenir 20 % de réduction
</CheckoutLink>
```

### Historique des transactions

Interrogez directement les transactions de paiement :

```ts
const { getTransaction, listTransactions } = creem.api();

// Obtenir une transaction spécifique
const tx = await getTransaction({ transactionId: "tx_xxx" });

// Lister toutes les transactions
const txList = await listTransactions({ pageNumber: 1, pageSize: 20 });
```

## Référence API

### Client Creem

La classe `Creem` accepte un objet de configuration :

| Option | Type | Description |
|--------|------|-------------|
| `getUserInfo` | `(ctx) => Promise<{userId, email}>` | **Requis.** Retourne les infos de l'utilisateur actuel. |
| `products` | `Record<string, string>` | Carte des clés vers les IDs de produit Creem. |
| `apiKey` | `string` | Clé API Creem. Par défaut : variable d'env `CREEM_API_KEY`. |
| `webhookSecret` | `string` | Secret webhook. Par défaut : variable d'env `CREEM_WEBHOOK_SECRET`. |
| `environment` | `"production" \| "test"` | Environnement API. Par défaut : `CREEM_ENVIRONMENT` ou `"test"`. |

### Méthodes Query

| Méthode | Description |
|--------|-------------|
| `getCurrentSubscription(ctx, { userId })` | Obtenir l'abonnement actif d'un utilisateur |
| `listUserSubscriptions(ctx, { userId })` | Lister tous les abonnements d'un utilisateur |
| `listProducts(ctx, { activeOnly? })` | Lister tous les produits synchronisés |
| `getProduct(ctx, { productId })` | Obtenir un produit spécifique |
| `listUserOrders(ctx, { userId })` | Lister toutes les commandes d'un utilisateur |
| `getCustomerByUserId(ctx, { userId })` | Obtenir l'enregistrement client |

### Méthodes Action

| Méthode | Description |
|--------|-------------|
| `createCheckoutSession(ctx, args)` | Créer un checkout et retourner l'URL |
| `cancelSubscription(ctx, opts?)` | Annuler l'abonnement de l'utilisateur actuel |
| `upgradeSubscription(ctx, { productId })` | Mettre à niveau vers un produit différent |
| `pauseSubscription(ctx)` | Mettre en pause l'abonnement de l'utilisateur actuel |
| `resumeSubscription(ctx)` | Reprendre un abonnement en pause |
| `generateCustomerPortalUrl(ctx)` | Obtenir l'URL du portail client |
| `syncProducts(ctx)` | Synchroniser tous les produits depuis Creem |

### Fonctions API exportées

| Fonction | Type | Description |
|----------|------|-------------|
| `generateCheckoutLink` | Action | Créer un lien de checkout pour un produit |
| `generateCustomerPortalUrl` | Action | Obtenir l'URL du portail client |
| `cancelCurrentSubscription` | Action | Annuler l'abonnement actuel |
| `upgradeCurrentSubscription` | Action | Mettre à niveau l'abonnement |
| `updateCurrentSubscription` | Action | Mettre à jour l'abonnement (unités, metadata) |
| `pauseCurrentSubscription` | Action | Mettre en pause l'abonnement actuel |
| `resumeCurrentSubscription` | Action | Reprendre l'abonnement en pause |
| `createProduct` | Action | Créer un nouveau produit via l'API Creem |
| `getConfiguredProducts` | Query | Obtenir les produits par clés configurées |
| `listAllProducts` | Query | Lister tous les produits synchronisés |
| `getCurrentSubscription` | Query | Obtenir l'abonnement actif de l'utilisateur actuel |
| `listUserSubscriptions` | Query | Lister tous les abonnements de l'utilisateur actuel |
| `listUserOrders` | Query | Lister toutes les commandes de l'utilisateur actuel |
| `syncProducts` | Action | Synchroniser les produits depuis l'API Creem |
| `validateLicense` | Action | Valider une clé de licence |
| `activateLicense` | Action | Activer une licence sur un appareil |
| `deactivateLicense` | Action | Désactiver une instance de licence |
| `createDiscount` | Action | Créer un code de réduction promotionnelle |
| `getDiscount` | Action | Récupérer les détails de la réduction |
| `deleteDiscount` | Action | Supprimer un code de réduction |
| `getTransaction` | Action | Obtenir une transaction par ID |
| `listTransactions` | Action | Lister les transactions de paiement |
| `getCustomerFromCreem` | Action | Récupérer le client depuis l'API Creem |
| `listCustomersFromCreem` | Action | Lister tous les clients depuis l'API Creem |

### Composants React

#### `<CheckoutLink>`

| Prop | Type | Description |
|------|------|-------------|
| `creemApi` | object | Objet avec la fonction `generateCheckoutLink` |
| `productId` | `string` | ID de produit Creem |
| `successUrl` | `string?` | URL de redirection après le checkout |
| `metadata` | `object?` | Metadata personnalisée pour le checkout |
| `discountCode` | `string?` | Code de réduction pré-rempli |
| `className` | `string?` | Classe CSS |

#### `<CheckoutButton>`

Mêmes props que `CheckoutLink`, mais récupère l'URL de checkout au montage pour un clic instantané.

#### `<CustomerPortalLink>`

| Prop | Type | Description |
|------|------|-------------|
| `creemApi` | object | Objet avec la fonction `generateCustomerPortalUrl` |
| `className` | `string?` | Classe CSS |

### Événements Webhook

Tous les événements sont synchronisés automatiquement. Types d'événements supportés :

| Événement | Description |
|-------|-------------|
| `checkout.completed` | Session de checkout terminée |
| `subscription.active` | Nouvel abonnement créé |
| `subscription.paid` | Paiement d'abonnement collecté |
| `subscription.canceled` | Abonnement annulé |
| `subscription.scheduled_cancel` | Annulation programmée pour fin de période |
| `subscription.past_due` | Paiement échoué, nouvelle tentative |
| `subscription.expired` | Abonnement expiré |
| `subscription.update` | Abonnement mis à jour |
| `subscription.trialing` | Abonnement en période d'essai |
| `subscription.paused` | Abonnement en pause |
| `refund.created` | Remboursement émis |
| `dispute.created` | Litige de paiement créé |

## Schéma de base de données

Le composant stocke les données dans ces tables isolées :

- **customers** - Mappe les clients Creem aux IDs utilisateur de votre app
- **products** - Catalogue de produits synchronisé depuis Creem
- **subscriptions** - État des abonnements avec mises à jour en temps réel
- **orders** - Enregistrements de commandes uniques et récurrentes
- **webhookEvents** - Journal d'audit de tous les événements webhook (idempotent)

Toutes les données sont automatiquement synchronisées via les webhooks et sont interrogeables avec la réactivité en temps réel de Convex.

## Mode test

Creem fournit un environnement de test pour le développement :

1. Définissez `CREEM_ENVIRONMENT=test` (c'est la valeur par défaut)
2. Utilisez les clés API de test de votre tableau de bord Creem
3. Les paiements de test fonctionnent avec n'importe quel numéro de carte
4. Les événements webhook sont envoyés à votre URL de webhook de test

Lorsque vous êtes prêt pour la production, passez à `CREEM_ENVIRONMENT=production` et utilisez vos clés API de production.

## Licence

MIT
