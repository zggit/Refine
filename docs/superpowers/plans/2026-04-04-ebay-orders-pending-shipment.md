# eBay Orders Pending Shipment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `/ebay-orders` list page (which reads from Supabase seed data) with a page that fetches live "needs shipping" orders from the eBay Fulfillment API (both AV + ST stores) and displays them in a paginated table, 100 per page.

**Architecture:** The existing `/api/ebay/orders` route already fetches unfulfilled orders (`NOT_STARTED|IN_PROGRESS`) from eBay for a given store. The list page will call this API for both stores on mount, merge results, and render in an Ant Design `<Table>` with client-side pagination (100/page). No Refine data provider involved — this is a direct API fetch, same pattern as the reconcile page.

**Tech Stack:** Next.js App Router, Ant Design Table, existing `/api/ebay/orders` route, TypeScript strict mode.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/app/ebay-orders/page.tsx` | Replace Supabase-backed `useTable` with direct fetch from `/api/ebay/orders`, client-side pagination at 100/page |
| Reference (no change) | `src/app/api/ebay/orders/route.ts` | Already serves `EbayOrder[]` with `orderId`, `buyerUsername`, `totalAmount`, `currency`, `creationDate`, `orderFulfillmentStatus` |

Only one file changes. The API route already does exactly what we need.

---

### Task 1: Replace the list page with live eBay API data

**Files:**
- Modify: `src/app/ebay-orders/page.tsx` (full rewrite)
- Reference: `src/app/api/ebay/orders/route.ts` (existing `EbayOrder` type at line 6-14)

- [ ] **Step 1: Read the existing files to confirm current state**

Read `src/app/ebay-orders/page.tsx` and `src/app/api/ebay/orders/route.ts` to confirm the current code matches what the plan expects.

- [ ] **Step 2: Rewrite `src/app/ebay-orders/page.tsx`**

Replace the entire file with the following. This fetches orders from both stores on mount, merges them, and renders in a paginated table.

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Table, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import type { EbayOrder } from "@/app/api/ebay/orders/route";

const { Text } = Typography;

const STORES = ["AV", "ST"] as const;
const PAGE_SIZE = 100;

export default function EbayOrderList() {
  const [orders, setOrders] = useState<EbayOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didFetch = useRef(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        STORES.map(async (store) => {
          const res = await fetch(`/api/ebay/orders?store=${store}`);
          const data = (await res.json()) as {
            success: boolean;
            orders: EbayOrder[];
            error?: string;
          };
          if (!data.success) throw new Error(`${store}: ${data.error ?? "Failed"}`);
          return data.orders.map((o) => ({ ...o, _store: store }));
        }),
      );
      setOrders(results.flat());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>eBay 待发货订单</h3>
          <Text type="secondary">{orders.length} orders pending shipment</Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchOrders}
          loading={loading}
          type="primary"
        >
          Refresh
        </Button>
      </div>

      {error && (
        <div style={{ color: "#ff4d4f", marginBottom: 12 }}>{error}</div>
      )}

      <Table
        dataSource={orders}
        rowKey="orderId"
        loading={loading}
        pagination={{ pageSize: PAGE_SIZE, showTotal: (total) => `${total} orders` }}
        size="small"
        columns={[
          {
            title: "Order ID",
            dataIndex: "orderId",
            key: "orderId",
            width: 200,
          },
          {
            title: "Store",
            dataIndex: "_store",
            key: "_store",
            width: 70,
            render: (value: string) => <Tag>{value}</Tag>,
          },
          {
            title: "Buyer",
            dataIndex: "buyerUsername",
            key: "buyerUsername",
            width: 160,
            render: (value: string | null) => value ?? "-",
          },
          {
            title: "Total",
            dataIndex: "totalAmount",
            key: "totalAmount",
            width: 100,
            render: (value: number | null, record: EbayOrder & { _store: string }) =>
              value != null
                ? `${record.currency ?? "$"}${value.toFixed(2)}`
                : "-",
          },
          {
            title: "Status",
            dataIndex: "orderFulfillmentStatus",
            key: "orderFulfillmentStatus",
            width: 130,
            render: (value: string) => (
              <Tag color={value === "NOT_STARTED" ? "orange" : "blue"}>
                {value}
              </Tag>
            ),
          },
          {
            title: "Created",
            dataIndex: "creationDate",
            key: "creationDate",
            width: 180,
            render: (value: string | null) =>
              value ? new Date(value).toLocaleString() : "-",
          },
        ]}
      />
    </div>
  );
}
```

Key decisions:
- **`_store` field**: Added during merge so we can show which store each order belongs to. Prefixed with `_` to indicate it's not from the API.
- **`PAGE_SIZE = 100`**: Client-side pagination, 100 per page as requested.
- **`didFetch` ref**: Prevents double-fetch in React Strict Mode, same pattern as the reconcile page.
- **No Refine hooks**: Since the data comes from eBay API, not Supabase, we bypass Refine's data provider entirely.
- **`rowKey="orderId"`**: Each eBay order has a unique `orderId`.

- [ ] **Step 3: Verify the dev server compiles without errors**

Run: `npm run dev`

Open the browser at `http://localhost:3000/ebay-orders`. Confirm:
1. Page loads without compile errors
2. Table shows with loading spinner
3. Orders appear from both AV and ST stores
4. Pagination shows at bottom with 100/page
5. Store column shows AV or ST tags
6. Refresh button re-fetches

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: No new lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/ebay-orders/page.tsx
git commit -m "feat: ebay-orders list page shows live pending-shipment orders from eBay API"
```
