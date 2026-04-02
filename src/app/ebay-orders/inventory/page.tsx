"use client";

import {
  Alert,
  Button,
  Image,
  Input,
  Progress,
  Radio,
  Table,
  Tag,
  Typography,
  Space,
} from "antd";
import { ReloadOutlined, LoadingOutlined, SyncOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useInventory } from "@/hooks/useInventory";
import type { ListingWithWeight } from "@/types/ebay";

const { Title, Text } = Typography;

const STORES = [
  { value: "AV", label: "AV" },
  { value: "ST", label: "ST" },
];

export default function InventoryPage() {
  const [store, setStore] = useState("AV");
  const {
    listings,
    loading,
    syncing,
    error,
    lastSource,
    weightLoading,
    weightProgress,
    loadFromSupabase,
    syncFromEbay,
    fetchWeights,
  } = useInventory(store);

  const [search, setSearch] = useState("");

  // Filter listings by search
  const filtered = listings.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.sku ?? "").toLowerCase().includes(q) ||
      item.itemId.includes(q)
    );
  });

  const columns = [
    {
      title: "",
      dataIndex: "imageUrl",
      key: "image",
      width: 60,
      render: (url: string | null) =>
        url ? (
          <Image src={url} width={40} height={40} style={{ objectFit: "cover", borderRadius: 4 }} />
        ) : (
          <div style={{ width: 40, height: 40, background: "#f0f0f0", borderRadius: 4 }} />
        ),
    },
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
    },
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      width: 180,
      render: (v: string | null) => v ? <Tag>{v}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: "Price",
      dataIndex: "price",
      key: "price",
      width: 90,
      sorter: (a: ListingWithWeight, b: ListingWithWeight) => (a.price ?? 0) - (b.price ?? 0),
      render: (v: number | null) => v != null ? `$${v.toFixed(2)}` : "-",
    },
    {
      title: "Qty",
      dataIndex: "quantityAvailable",
      key: "qty",
      width: 70,
      sorter: (a: ListingWithWeight, b: ListingWithWeight) => (a.quantityAvailable ?? 0) - (b.quantityAvailable ?? 0),
      render: (v: number | null, record: ListingWithWeight) => {
        if (v === null) return "-";
        const sold = record.quantitySold ?? 0;
        return (
          <span>
            {v} <Text type="secondary" style={{ fontSize: 11 }}>({sold} sold)</Text>
          </span>
        );
      },
    },
    {
      title: "Weight (oz)",
      dataIndex: "weightOz",
      key: "weight",
      width: 100,
      sorter: (a: ListingWithWeight, b: ListingWithWeight) => (a.weightOz ?? -1) - (b.weightOz ?? -1),
      render: (v: number | null) => {
        if (v === null) return <Text type="secondary">-</Text>;
        return `${v} oz`;
      },
    },
    {
      title: "Item ID",
      dataIndex: "itemId",
      key: "itemId",
      width: 140,
      render: (v: string) => (
        <a
          href={`https://www.ebay.com/itm/${v}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: "monospace", fontSize: 12 }}
        >
          {v}
        </a>
      ),
    },
  ];

  const cachedCount = listings.filter((i) => i.weightOz !== null).length;
  const uncachedCount = listings.length - cachedCount;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Title level={4} style={{ margin: 0 }}>
              eBay Inventory
            </Title>
            <Radio.Group
              value={store}
              onChange={(e) => setStore(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              size="small"
              options={STORES}
            />
          </div>
          <Text type="secondary">
            {listings.length > 0 ? `${listings.length} listings` : ""}
            {cachedCount > 0 ? ` · ${cachedCount} weights` : ""}
            {lastSource ? ` · from ${lastSource}` : ""}
          </Text>
        </div>
        <Space>
          {listings.length > 0 && !weightLoading && uncachedCount > 0 && (
            <Button
              onClick={() => fetchWeights(listings)}
              icon={<LoadingOutlined />}
            >
              Load Weights ({uncachedCount})
            </Button>
          )}
          {weightLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 220 }}>
              <Progress
                percent={Math.round((weightProgress.done / (weightProgress.total || 1)) * 100)}
                size="small"
                style={{ flex: 1, minWidth: 120 }}
              />
              <Text type="secondary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                {weightProgress.done}/{weightProgress.total}
              </Text>
            </div>
          )}
          <Button
            icon={<SyncOutlined spin={syncing} />}
            onClick={syncFromEbay}
            loading={syncing}
          >
            Sync from eBay
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadFromSupabase}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

      {!loading && !error && listings.length === 0 && (
        <Alert
          type="info"
          message={`No cached data for ${store} yet. Click 'Sync from eBay' to populate.`}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Input.Search
        placeholder="Search by title, SKU, or item ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        style={{ marginBottom: 16, maxWidth: 400 }}
      />

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="itemId"
        size="small"
        loading={loading}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ["25", "50", "100", "200"] }}
        scroll={{ x: 900 }}
      />
    </div>
  );
}
