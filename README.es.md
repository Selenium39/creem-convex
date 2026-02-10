# Componente Convex Creem

[![npm version](https://badge.fury.io/js/@creem_io%2Fconvex.svg)](https://badge.fury.io/js/@creem_io/convex)

[English](README.md) | [中文](README.zh-CN.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md)

Integra pagos, suscripciones y facturación de [Creem](https://creem.io) en tu aplicación [Convex](https://convex.dev).

Creem es un Merchant of Record que gestiona pagos globales, cumplimiento fiscal y gestión de suscripciones. Este componente de Convex lleva toda la infraestructura de pagos de Creem a tu backend Convex con reactividad en tiempo real.

**Consulta la [aplicación de ejemplo](./example) para una demostración completa.**

```tsx
// Obtener detalles de suscripción del usuario actual
const subscription = await creem.getCurrentSubscription(ctx, { userId });

// Mostrar planes disponibles
<CheckoutLink creemApi={api.creem} productId="prod_xxx">
  Actualizar a Pro
</CheckoutLink>

// Gestionar suscripciones existentes
<CustomerPortalLink creemApi={api.creem}>
  Gestionar suscripción
</CustomerPortalLink>
```

## Requisitos previos

### Aplicación Convex

Necesitas una aplicación Convex para usar este componente. Sigue cualquiera de las [guías de inicio rápido de Convex](https://docs.convex.dev/home) para configurarla.

### Cuenta Creem

1. [Crear una cuenta Creem](https://creem.io)
2. Crear productos en el panel de Creem
3. Obtener tu clave API en **Configuración > API Keys**
4. Obtener tu secreto de webhook en **Desarrolladores > Webhooks**

## Instalación

Instala el paquete del componente:

```bash
npm install @creem_io/convex
```

Crea un archivo `convex.config.ts` en la carpeta `convex/` de tu aplicación e instala el componente llamando a `app.use`:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import creem from "@creem_io/convex/convex.config.js";

const app = defineApp();
app.use(creem);
export default app;
```

Configura tus credenciales de Creem como variables de entorno:

```bash
npx convex env set CREEM_API_KEY creem_xxxxx
npx convex env set CREEM_WEBHOOK_SECRET whsec_xxxxx
# Opcional: establecer "production" para modo producción (por defecto "test")
npx convex env set CREEM_ENVIRONMENT test
```

## Inicio rápido

### 1. Inicializar el cliente Creem

```ts
// convex/creem.ts
import { Creem } from "@creem_io/convex";
import { api, components } from "./_generated/api";

export const creem = new Creem(components.creem, {
  // Requerido: función para obtener el ID y email del usuario actual
  getUserInfo: async (ctx) => {
    const user = await ctx.runQuery(api.users.getCurrentUser);
    return { userId: user._id, email: user.email };
  },

  // Opcional: mapear claves amigables a IDs de producto de Creem
  products: {
    proMonthly: "prod_xxxxx",
    proYearly: "prod_yyyyy",
  },
});

// Exportar funciones API
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

### 2. Configurar webhooks

Registra el manejador de webhook en tu `convex/http.ts`:

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { creem } from "./creem";

const http = httpRouter();

creem.registerRoutes(http as any, {
  // Opcional: ruta personalizada (por defecto "/creem/webhook")
  path: "/creem/webhook",

  // Opcional: callbacks para eventos de webhook
  onCheckoutCompleted: async (ctx, event) => {
    console.log("Checkout completed:", event.object);
  },
  onSubscriptionCanceled: async (ctx, event) => {
    console.log("Subscription canceled:", event.object);
  },
});

export default http;
```

Luego registra la URL del webhook en tu [Panel de Creem](https://creem.io/dashboard/developers):

```
https://<tu-url-sitio-convex>/creem/webhook
```

Tu URL del sitio Convex se puede encontrar en tu [panel de Convex](https://dashboard.convex.dev) o a través de la variable de entorno del sistema `CONVEX_SITE_URL`.

### 3. Sincronizar productos existentes

Si creaste productos antes de instalar este componente, sincronízalos:

```ts
// Ejecutar una vez desde el panel de Convex o mediante una acción única
await creem.syncProducts(ctx);
```

### 4. Añadir componentes React

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
          Suscripción mensual - ${(products.proMonthly.price / 100).toFixed(2)}/mes
        </CheckoutLink>
      )}

      <CustomerPortalLink creemApi={api.creem}>
        Gestionar suscripción
      </CustomerPortalLink>
    </div>
  );
}
```

## Uso

### Acceder a datos de suscripción

Consulta información de suscripción con actualizaciones en tiempo real:

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
      productKey: subscription?.productKey, // ej. "proMonthly"
    };
  },
});
```

### Gestionar cambios de suscripción

```ts
// Cancelar suscripción
const cancel = useAction(api.creem.cancelCurrentSubscription);
await cancel({ mode: "immediate" }); // o "scheduled"

// Actualizar suscripción
const upgrade = useAction(api.creem.upgradeCurrentSubscription);
await upgrade({ productId: "prod_new_plan_id" });
```

### Control de acceso simplificado (recomendado)

Usa los callbacks de alto nivel `onGrantAccess` / `onRevokeAccess` para el caso de uso más común: conceder y revocar acceso:

```ts
creem.registerRoutes(http as any, {
  onGrantAccess: async (ctx, { userId, productId, subscriptionId }) => {
    // Se dispara en: checkout.completed, subscription.active, subscription.paid
    if (userId) {
      await ctx.runMutation(api.users.grantPremiumAccess, { userId, productId });
    }
  },
  onRevokeAccess: async (ctx, { userId, subscriptionId, reason }) => {
    // Se dispara en: subscription.canceled, subscription.expired
    if (userId) {
      await ctx.runMutation(api.users.revokePremiumAccess, { userId });
    }
  },
});
```

### Callbacks detallados por evento de webhook

Para más control, usa callbacks específicos por evento. Pueden combinarse con `onGrantAccess`/`onRevokeAccess`:

```ts
creem.registerRoutes(http as any, {
  onCheckoutCompleted: async (ctx, event) => {
    const userId = event.object.metadata?.userId;
    if (userId) {
      await ctx.runMutation(api.users.grantPremiumAccess, { userId });
    }
  },
  onSubscriptionCanceled: async (ctx, event) => {
    // Revocar acceso al cancelar
  },
  onSubscriptionPaid: async (ctx, event) => {
    // Gestionar pagos de renovación
  },
  onRefundCreated: async (ctx, event) => {
    // Gestionar reembolsos
  },
});
```

### Gestión de licencias

Valida, activa y desactiva claves de licencia para distribución de software:

```ts
const { validateLicense, activateLicense, deactivateLicense } = creem.api();

// Validar una clave de licencia
const result = await validateLicense({ key: "LIC-KEY-123" });

// Activar en un dispositivo
const activated = await activateLicense({
  key: "LIC-KEY-123",
  instanceName: "MacBook del usuario",
});

// Desactivar un dispositivo
await deactivateLicense({
  key: "LIC-KEY-123",
  instanceId: "inst_abc",
});
```

### Códigos de descuento

Crea y gestiona descuentos promocionales:

```ts
const { createDiscount, getDiscount, deleteDiscount } = creem.api();

// Crear descuento del 20%
await createDiscount({
  code: "SAVE20",
  type: "percentage",
  amount: 20,
  maxRedemptions: 100,
});

// Aplicar en el checkout
<CheckoutLink
  creemApi={api.creem}
  productId="prod_xxx"
  discountCode="SAVE20"
>
  Obtener 20% de descuento
</CheckoutLink>
```

### Historial de transacciones

Consulta transacciones de pago directamente:

```ts
const { getTransaction, listTransactions } = creem.api();

// Obtener una transacción específica
const tx = await getTransaction({ transactionId: "tx_xxx" });

// Listar todas las transacciones
const txList = await listTransactions({ pageNumber: 1, pageSize: 20 });
```

## Referencia API

### Cliente Creem

La clase `Creem` acepta un objeto de configuración:

| Opción | Tipo | Descripción |
|--------|------|-------------|
| `getUserInfo` | `(ctx) => Promise<{userId, email}>` | **Requerido.** Retorna la información del usuario actual. |
| `products` | `Record<string, string>` | Mapa de claves a IDs de producto de Creem. |
| `apiKey` | `string` | Clave API de Creem. Por defecto usa la variable de entorno `CREEM_API_KEY`. |
| `webhookSecret` | `string` | Secreto del webhook. Por defecto usa la variable de entorno `CREEM_WEBHOOK_SECRET`. |
| `environment` | `"production" \| "test"` | Entorno de la API. Por defecto usa `CREEM_ENVIRONMENT` o `"test"`. |

### Métodos Query

| Método | Descripción |
|--------|-------------|
| `getCurrentSubscription(ctx, { userId })` | Obtener suscripción activa de un usuario |
| `listUserSubscriptions(ctx, { userId })` | Listar todas las suscripciones de un usuario |
| `listProducts(ctx, { activeOnly? })` | Listar todos los productos sincronizados |
| `getProduct(ctx, { productId })` | Obtener un producto específico |
| `listUserOrders(ctx, { userId })` | Listar todos los pedidos de un usuario |
| `getCustomerByUserId(ctx, { userId })` | Obtener registro de cliente |

### Métodos Action

| Método | Descripción |
|--------|-------------|
| `createCheckoutSession(ctx, args)` | Crear sesión de checkout y retornar la URL |
| `cancelSubscription(ctx, opts?)` | Cancelar la suscripción del usuario actual |
| `upgradeSubscription(ctx, { productId })` | Actualizar a un producto diferente |
| `pauseSubscription(ctx)` | Pausar la suscripción del usuario actual |
| `resumeSubscription(ctx)` | Reanudar una suscripción pausada |
| `generateCustomerPortalUrl(ctx)` | Obtener la URL del portal del cliente |
| `syncProducts(ctx)` | Sincronizar todos los productos desde Creem |

### Funciones API exportadas

| Función | Tipo | Descripción |
|----------|------|-------------|
| `generateCheckoutLink` | Action | Crear enlace de checkout para un producto |
| `generateCustomerPortalUrl` | Action | Obtener URL del portal del cliente |
| `cancelCurrentSubscription` | Action | Cancelar suscripción actual |
| `upgradeCurrentSubscription` | Action | Actualizar suscripción |
| `updateCurrentSubscription` | Action | Actualizar suscripción (unidades, metadata) |
| `pauseCurrentSubscription` | Action | Pausar suscripción actual |
| `resumeCurrentSubscription` | Action | Reanudar suscripción pausada |
| `createProduct` | Action | Crear un nuevo producto vía API de Creem |
| `getConfiguredProducts` | Query | Obtener productos por claves configuradas |
| `listAllProducts` | Query | Listar todos los productos sincronizados |
| `getCurrentSubscription` | Query | Obtener suscripción activa del usuario actual |
| `listUserSubscriptions` | Query | Listar todas las suscripciones del usuario actual |
| `listUserOrders` | Query | Listar todos los pedidos del usuario actual |
| `syncProducts` | Action | Sincronizar productos desde la API de Creem |
| `validateLicense` | Action | Validar una clave de licencia |
| `activateLicense` | Action | Activar licencia en un dispositivo |
| `deactivateLicense` | Action | Desactivar instancia de licencia |
| `createDiscount` | Action | Crear código de descuento promocional |
| `getDiscount` | Action | Obtener detalles del descuento |
| `deleteDiscount` | Action | Eliminar código de descuento |
| `getTransaction` | Action | Obtener transacción por ID |
| `listTransactions` | Action | Listar transacciones de pago |
| `getCustomerFromCreem` | Action | Obtener cliente desde la API de Creem |
| `listCustomersFromCreem` | Action | Listar todos los clientes desde la API de Creem |

### Componentes React

#### `<CheckoutLink>`

| Prop | Tipo | Descripción |
|------|------|-------------|
| `creemApi` | object | Objeto con la función `generateCheckoutLink` |
| `productId` | `string` | ID de producto de Creem |
| `successUrl` | `string?` | URL de redirección después del checkout |
| `metadata` | `object?` | Metadata personalizada para el checkout |
| `discountCode` | `string?` | Código de descuento prellenado |
| `className` | `string?` | Clase CSS |

#### `<CheckoutButton>`

Mismas props que `CheckoutLink`, pero obtiene la URL de checkout al montar para una transición instantánea al hacer clic.

#### `<CustomerPortalLink>`

| Prop | Tipo | Descripción |
|------|------|-------------|
| `creemApi` | object | Objeto con la función `generateCustomerPortalUrl` |
| `className` | `string?` | Clase CSS |

### Eventos de Webhook

Todos los eventos se sincronizan automáticamente. Tipos de evento soportados:

| Evento | Descripción |
|-------|-------------|
| `checkout.completed` | Sesión de checkout completada |
| `subscription.active` | Nueva suscripción creada |
| `subscription.paid` | Pago de suscripción cobrado |
| `subscription.canceled` | Suscripción cancelada |
| `subscription.scheduled_cancel` | Cancelación programada para fin del período |
| `subscription.past_due` | Pago fallido, reintentando |
| `subscription.expired` | Suscripción expirada |
| `subscription.update` | Suscripción actualizada |
| `subscription.trialing` | Suscripción en periodo de prueba |
| `subscription.paused` | Suscripción pausada |
| `refund.created` | Reembolso emitido |
| `dispute.created` | Disputa de pago creada |

## Esquema de base de datos

El componente almacena datos en estas tablas aisladas:

- **customers** - Mapea clientes de Creem a los IDs de usuario de tu app
- **products** - Catálogo de productos sincronizado desde Creem
- **subscriptions** - Estado de suscripción con actualizaciones en tiempo real
- **orders** - Registros de pedidos únicos y recurrentes
- **webhookEvents** - Registro de auditoría de todos los eventos de webhook (idempotente)

Todos los datos se mantienen sincronizados automáticamente mediante webhooks y son consultables con la reactividad en tiempo real de Convex.

## Modo de prueba

Creem proporciona un entorno de prueba para desarrollo:

1. Establece `CREEM_ENVIRONMENT=test` (este es el valor por defecto)
2. Usa claves API de prueba desde tu panel de Creem
3. Los pagos de prueba funcionan con cualquier número de tarjeta
4. Los eventos de webhook se envían a tu URL de webhook de prueba

Cuando estés listo para producción, cambia a `CREEM_ENVIRONMENT=production` y usa tus claves API de producción.

## Licencia

MIT
