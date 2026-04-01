"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Alert,
  Button,
  Image,
  Input,
  Progress,
  Table,
  Tag,
  Typography,
  Space,
} from "antd";
import { ReloadOutlined, LoadingOutlined, SyncOutlined } from "@ant-design/icons";
import type { EbayListing } from "@/app/api/ebay/inventory/route";

const { Title, Text } = Typography;

type ListingWithWeight = EbayListing & { weightOz: number | null };

export default function InventoryPage() {
  const [listings, setListings] = useState<ListingWithWeight[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lastSource, setLastSource] = useState<string | null>(null);

  // Weight loading state
  const [weightLoading, setWeightLoading] = useState(false);
  const [weightProgress, setWeightProgress] = useState({ done: 0, total: 0 });
  const abortRef = useRef(false);

  // Load from Supabase cache (fast)
  const loadFromCache = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ebay/inventory?source=cache");
      const data = await res.json() as {
        success: boolean;
        listings: ListingWithWeight[];
        total: number;
        source: string;
        error?: string;
      };
      if (!data.success) throw new Error(data.error ?? "Failed to load");
      setListings(data.listings);
      setLastSource(data.source);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync from eBay (slow, updates Supabase)
  const syncFromEbay = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/ebay/inventory?source=ebay");
      const data = await res.json() as {
        success: boolean;
        listings: ListingWithWeight[];
        total: number;
        source: string;
        error?: string;
      };
      if (!data.success) throw new Error(data.error ?? "Sync failed");
      setListings(data.listings);
      setLastSource(data.source);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  }, []);

  // Fetch weights from eBay in background, batch by batch, save to Supabase
  const fetchWeights = useCallback(async (items: ListingWithWeight[]) => {
    const needWeight = items.filter((i) => i.weightOz === null && i.itemId);
    if (needWeight.length === 0) return;

    abortRef.current = false;
    setWeightLoading(true);
    setWeightProgress({ done: 0, total: needWeight.length });

    const batchSize = 50;
    for (let i = 0; i < needWeight.length; i += batchSize) {
      if (abortRef.current) break;
      const batch = needWeight.slice(i, i + batchSize);
      const ids = batch.map((b) => b.itemId).join(",");

      try {
        const res = await fetch(`/api/ebay/inventory/weight?ids=${ids}`);
        const data = await res.json() as {
          success: boolean;
          weights: Record<string, number>;
        };

        if (data.success) {
          setListings((prev) =>
            prev.map((item) => {
              const oz = data.weights[item.itemId];
              if (oz !== undefined) return { ...item, weightOz: oz };
              return item;
            })
          );
        }
      } catch {
        // Silently continue on weight fetch errors
      }

      setWeightProgress({ done: Math.min(i + batchSize, needWeight.length), total: needWeight.length });
    }

    setWeightLoading(false);
  }, []);

  useEffect(() => {
    loadFromCache();
  }, [loadFromCache]);

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
          <Title level={4} style={{ margin: 0 }}>
            eBay Inventory
          </Title>
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
            onClick={loadFromCache}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

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
