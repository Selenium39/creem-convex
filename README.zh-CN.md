# Convex Creem 组件

[![npm version](https://badge.fury.io/js/@creem_io%2Fconvex.svg)](https://badge.fury.io/js/@creem_io/convex)

[English](README.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md)

将 [Creem](https://creem.io) 的支付、订阅和计费功能集成到你的 [Convex](https://convex.dev) 应用中。

Creem 是一家商户服务商（Merchant of Record），负责全球支付、税务合规和订阅管理。本 Convex 组件将 Creem 的完整支付能力引入到你的 Convex 后端，并支持实时响应式更新。

**查看 [示例应用](./example) 获取完整演示。**

```tsx
// 获取当前用户的订阅详情
const subscription = await creem.getCurrentSubscription(ctx, { userId });

// 展示可用套餐
<CheckoutLink creemApi={api.creem} productId="prod_xxx">
  升级到 Pro
</CheckoutLink>

// 管理现有订阅
<CustomerPortalLink creemApi={api.creem}>
  管理订阅
</CustomerPortalLink>
```

## 前置要求

### Convex 应用

你需要一个 Convex 应用才能使用此组件。请按照 [Convex 快速入门](https://docs.convex.dev/home) 进行配置。

### Creem 账户

1. [注册 Creem 账户](https://creem.io)
2. 在 Creem 控制台创建产品
3. 在 **设置 > API 密钥** 获取 API 密钥
4. 在 **开发者 > Webhooks** 获取 Webhook 密钥

## 安装

安装组件包：

```bash
npm install @creem_io/convex
```

在应用的 `convex/` 文件夹中创建 `convex.config.ts`，并通过 `app.use` 安装组件：

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import creem from "@creem_io/convex/convex.config.js";

const app = defineApp();
app.use(creem);
export default app;
```

将 Creem 凭证设置为环境变量：

```bash
npx convex env set CREEM_API_KEY creem_xxxxx
npx convex env set CREEM_WEBHOOK_SECRET whsec_xxxxx
# 可选：设置为 "production" 使用生产模式（默认为 "test"）
npx convex env set CREEM_ENVIRONMENT test
```

## 快速开始

### 1. 初始化 Creem 客户端

```ts
// convex/creem.ts
import { Creem } from "@creem_io/convex";
import { api, components } from "./_generated/api";

export const creem = new Creem(components.creem, {
  // 必填：提供获取当前用户 ID 和邮箱的函数
  getUserInfo: async (ctx) => {
    const user = await ctx.runQuery(api.users.getCurrentUser);
    return { userId: user._id, email: user.email };
  },

  // 可选：将友好键名映射到 Creem 产品 ID
  products: {
    proMonthly: "prod_xxxxx",
    proYearly: "prod_yyyyy",
  },
});

// 导出 API 函数
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

### 2. 配置 Webhook

在 `convex/http.ts` 中注册 Webhook 处理程序：

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { creem } from "./creem";

const http = httpRouter();

creem.registerRoutes(http as any, {
  // 可选：自定义路径（默认为 "/creem/webhook"）
  path: "/creem/webhook",

  // 可选：Webhook 事件回调
  onCheckoutCompleted: async (ctx, event) => {
    console.log("Checkout completed:", event.object);
  },
  onSubscriptionCanceled: async (ctx, event) => {
    console.log("Subscription canceled:", event.object);
  },
});

export default http;
```

然后在 [Creem 控制台](https://creem.io/dashboard/developers) 注册 Webhook URL：

```
https://<your-convex-site-url>/creem/webhook
```

你的 Convex 站点 URL 可在 [Convex 控制台](https://dashboard.convex.dev) 或通过 `CONVEX_SITE_URL` 系统环境变量获取。

### 3. 同步现有产品

如果在安装本组件之前已创建产品，需同步它们：

```ts
// 在 Convex 控制台或一次性 action 中运行
await creem.syncProducts(ctx);
```

### 4. 添加 React 组件

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
          Subscribe Monthly - ${(products.proMonthly.price / 100).toFixed(2)}/mo
        </CheckoutLink>
      )}

      <CustomerPortalLink creemApi={api.creem}>
        管理订阅
      </CustomerPortalLink>
    </div>
  );
}
```

## 使用方法

### 获取订阅数据

可实时查询订阅信息：

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
      productKey: subscription?.productKey, // 例如 "proMonthly"
    };
  },
});
```

### 处理订阅变更

```ts
// 取消订阅
const cancel = useAction(api.creem.cancelCurrentSubscription);
await cancel({ mode: "immediate" }); // 或 "scheduled"

// 升级订阅
const upgrade = useAction(api.creem.upgradeCurrentSubscription);
await upgrade({ productId: "prod_new_plan_id" });
```

### 简化的访问控制（推荐）

使用高级 `onGrantAccess` / `onRevokeAccess` 回调处理最常见的授权与撤销场景：

```ts
creem.registerRoutes(http as any, {
  onGrantAccess: async (ctx, { userId, productId, subscriptionId }) => {
    // 触发事件：checkout.completed, subscription.active, subscription.paid
    if (userId) {
      await ctx.runMutation(api.users.grantPremiumAccess, { userId, productId });
    }
  },
  onRevokeAccess: async (ctx, { userId, subscriptionId, reason }) => {
    // 触发事件：subscription.canceled, subscription.expired
    if (userId) {
      await ctx.runMutation(api.users.revokePremiumAccess, { userId });
    }
  },
});
```

### 细粒度 Webhook 回调

如需更细粒度控制，可使用具体的事件回调，可与 `onGrantAccess`/`onRevokeAccess` 同时使用：

```ts
creem.registerRoutes(http as any, {
  onCheckoutCompleted: async (ctx, event) => {
    const userId = event.object.metadata?.userId;
    if (userId) {
      await ctx.runMutation(api.users.grantPremiumAccess, { userId });
    }
  },
  onSubscriptionCanceled: async (ctx, event) => {
    // 取消时撤销访问
  },
  onSubscriptionPaid: async (ctx, event) => {
    // 处理续费
  },
  onRefundCreated: async (ctx, event) => {
    // 处理退款
  },
});
```

### 许可证管理

验证、激活、停用用于软件分发的许可证密钥：

```ts
const { validateLicense, activateLicense, deactivateLicense } = creem.api();

// 验证许可证
const result = await validateLicense({ key: "LIC-KEY-123" });

// 在设备上激活
const activated = await activateLicense({
  key: "LIC-KEY-123",
  instanceName: "User's MacBook",
});

// 在设备上停用
await deactivateLicense({
  key: "LIC-KEY-123",
  instanceId: "inst_abc",
});
```

### 折扣码

创建和管理促销折扣：

```ts
const { createDiscount, getDiscount, deleteDiscount } = creem.api();

// 创建 20% 折扣
await createDiscount({
  code: "SAVE20",
  type: "percentage",
  amount: 20,
  maxRedemptions: 100,
});

// 结账时使用
<CheckoutLink
  creemApi={api.creem}
  productId="prod_xxx"
  discountCode="SAVE20"
>
  享受 20% 折扣
</CheckoutLink>
```

### 交易记录

直接查询支付交易：

```ts
const { getTransaction, listTransactions } = creem.api();

// 获取指定交易
const tx = await getTransaction({ transactionId: "tx_xxx" });

// 列出所有交易
const txList = await listTransactions({ pageNumber: 1, pageSize: 20 });
```

## API 参考

### Creem 客户端

`Creem` 类接受配置对象：

| 选项 | 类型 | 说明 |
|--------|------|-------------|
| `getUserInfo` | `(ctx) => Promise<{userId, email}>` | **必填**。返回当前用户信息。 |
| `products` | `Record<string, string>` | 键名到 Creem 产品 ID 的映射。 |
| `apiKey` | `string` | Creem API 密钥。默认为 `CREEM_API_KEY` 环境变量。 |
| `webhookSecret` | `string` | Webhook 密钥。默认为 `CREEM_WEBHOOK_SECRET` 环境变量。 |
| `environment` | `"production" \| "test"` | API 环境。默认为 `CREEM_ENVIRONMENT` 或 `"test"`。 |

### Query 方法

| 方法 | 说明 |
|--------|-------------|
| `getCurrentSubscription(ctx, { userId })` | 获取用户当前有效订阅 |
| `listUserSubscriptions(ctx, { userId })` | 列出用户所有订阅 |
| `listProducts(ctx, { activeOnly? })` | 列出已同步产品 |
| `getProduct(ctx, { productId })` | 获取指定产品 |
| `listUserOrders(ctx, { userId })` | 列出用户所有订单 |
| `getCustomerByUserId(ctx, { userId })` | 获取客户记录 |

### Action 方法

| 方法 | 说明 |
|--------|-------------|
| `createCheckoutSession(ctx, args)` | 创建结账会话并返回 URL |
| `cancelSubscription(ctx, opts?)` | 取消当前用户订阅 |
| `upgradeSubscription(ctx, { productId })` | 升级到其他产品 |
| `pauseSubscription(ctx)` | 暂停当前订阅 |
| `resumeSubscription(ctx)` | 恢复已暂停订阅 |
| `generateCustomerPortalUrl(ctx)` | 获取客户门户 URL |
| `syncProducts(ctx)` | 从 Creem 同步所有产品 |

### 导出的 API 函数

| 函数 | 类型 | 说明 |
|----------|------|-------------|
| `generateCheckoutLink` | Action | 为产品创建结账链接 |
| `generateCustomerPortalUrl` | Action | 获取客户门户 URL |
| `cancelCurrentSubscription` | Action | 取消当前订阅 |
| `upgradeCurrentSubscription` | Action | 升级订阅 |
| `updateCurrentSubscription` | Action | 更新订阅（数量、元数据） |
| `pauseCurrentSubscription` | Action | 暂停当前订阅 |
| `resumeCurrentSubscription` | Action | 恢复已暂停订阅 |
| `createProduct` | Action | 通过 Creem API 创建产品 |
| `getConfiguredProducts` | Query | 按配置键获取产品 |
| `listAllProducts` | Query | 列出已同步产品 |
| `getCurrentSubscription` | Query | 获取当前用户有效订阅 |
| `listUserSubscriptions` | Query | 列出当前用户所有订阅 |
| `listUserOrders` | Query | 列出当前用户所有订单 |
| `syncProducts` | Action | 从 Creem API 同步产品 |
| `validateLicense` | Action | 验证许可证密钥 |
| `activateLicense` | Action | 在设备上激活许可证 |
| `deactivateLicense` | Action | 停用许可证实例 |
| `createDiscount` | Action | 创建促销折扣码 |
| `getDiscount` | Action | 获取折扣详情 |
| `deleteDiscount` | Action | 删除折扣码 |
| `getTransaction` | Action | 按 ID 获取交易 |
| `listTransactions` | Action | 列出支付交易 |
| `getCustomerFromCreem` | Action | 从 Creem API 获取客户 |
| `listCustomersFromCreem` | Action | 从 Creem API 列出客户 |

### React 组件

#### `<CheckoutLink>`

| 属性 | 类型 | 说明 |
|------|------|-------------|
| `creemApi` | object | 包含 `generateCheckoutLink` 函数的对象 |
| `productId` | `string` | Creem 产品 ID |
| `successUrl` | `string?` | 结账后重定向 URL |
| `metadata` | `object?` | 结账自定义元数据 |
| `discountCode` | `string?` | 预填折扣码 |
| `className` | `string?` | CSS 类名 |

#### `<CheckoutButton>`

与 `CheckoutLink` 相同，但在挂载时提前获取结账 URL，实现即时跳转。

#### `<CustomerPortalLink>`

| 属性 | 类型 | 说明 |
|------|------|-------------|
| `creemApi` | object | 包含 `generateCustomerPortalUrl` 函数的对象 |
| `className` | `string?` | CSS 类名 |

### Webhook 事件

所有事件会自动同步。支持的事件类型：

| 事件 | 说明 |
|-------|-------------|
| `checkout.completed` | 结账会话完成 |
| `subscription.active` | 新订阅创建 |
| `subscription.paid` | 订阅支付成功 |
| `subscription.canceled` | 订阅已取消 |
| `subscription.scheduled_cancel` | 已安排在周期结束时取消 |
| `subscription.past_due` | 支付失败，重试中 |
| `subscription.expired` | 订阅已过期 |
| `subscription.update` | 订阅已更新 |
| `subscription.trialing` | 订阅试用中 |
| `subscription.paused` | 订阅已暂停 |
| `refund.created` | 退款已创建 |
| `dispute.created` | 支付争议已创建 |

## 数据库结构

组件将数据存储在以下沙箱表中：

- **customers** - 将 Creem 客户映射到应用用户 ID
- **products** - 从 Creem 同步的产品目录
- **subscriptions** - 支持实时更新的订阅状态
- **orders** - 一次性及 recurring 订单记录
- **webhookEvents** - 所有 Webhook 事件的审计日志（幂等）

所有数据通过 Webhook 自动同步，并可通过 Convex 的实时响应式能力进行查询。

## 测试模式

Creem 提供用于开发的测试环境：

1. 设置 `CREEM_ENVIRONMENT=test`（此为默认值）
2. 使用 Creem 控制台中的测试 API 密钥
3. 测试支付可使用任意卡号
4. Webhook 事件会发送到你的测试 Webhook URL

准备上线时，将 `CREEM_ENVIRONMENT` 改为 `production` 并使用生产 API 密钥。

## 许可证

MIT
