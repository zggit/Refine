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
