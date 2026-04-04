"use client";

import { CopyOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Input, Space, Tag, Typography, message } from "antd";
import { useState } from "react";

const { Title, Text } = Typography;

type ZoneResponse =
  | {
      success: true;
      zone: number;
      originPrefix: string;
      destPrefix: string;
      effectiveDate: string;
    }
  | { success: false; error: string };

// Zone → color scale (1=green/close → 9=red/far)
const ZONE_COLORS: Record<number, string> = {
  1: "#52c41a",
  2: "#73d13d",
  3: "#95de64",
  4: "#fadb14",
  5: "#fa8c16",
  6: "#fa541c",
  7: "#f5222d",
  8: "#cf1322",
  9: "#a8071a",
};

export default function UspsZonePage() {
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ZoneResponse | null>(null);
  const [effectiveDate, setEffectiveDate] = useState<string | null>(null);

  const validZip = (z: string) => /^\d{5}$/.test(z.trim());
  const canSubmit = validZip(origin) && validZip(dest) && !loading;

  const handleLookup = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/logistics/zone?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(dest)}`,
      );
      const data = (await res.json()) as ZoneResponse;
      setResult(data);
      if (data.success) setEffectiveDate(data.effectiveDate);
    } catch (err: unknown) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "请求失败",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canSubmit) handleLookup();
  };

  const handleCopy = () => {
    if (result?.success) {
      const text = `${origin.trim()} → ${dest.trim()}: Zone ${result.zone}`;
      navigator.clipboard.writeText(text);
      message.success("已复制");
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          USPS Zone Chart
        </Title>
        <Text type="secondary">
          输入两个 5 位 ZIP code,查询 USPS 邮寄区域 (Zone 1–9)
        </Text>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: "100%" }} size="large">
          <Input
            placeholder="起始 ZIP (例: 90210)"
            value={origin}
            onChange={(e) => setOrigin(e.target.value.replace(/\D/g, "").slice(0, 5))}
            onKeyDown={handleKeyDown}
            maxLength={5}
            status={origin && !validZip(origin) ? "error" : undefined}
            style={{ width: "35%" }}
          />
          <Input
            placeholder="目的 ZIP (例: 10001)"
            value={dest}
            onChange={(e) => setDest(e.target.value.replace(/\D/g, "").slice(0, 5))}
            onKeyDown={handleKeyDown}
            maxLength={5}
            status={dest && !validZip(dest) ? "error" : undefined}
            style={{ width: "35%" }}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleLookup}
            loading={loading}
            disabled={!canSubmit}
            style={{ width: "30%" }}
          >
            查询
          </Button>
        </Space.Compact>

        {(origin && !validZip(origin)) || (dest && !validZip(dest)) ? (
          <Text type="danger" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
            ZIP 必须是 5 位数字
          </Text>
        ) : null}
      </Card>

      {result?.success && (
        <Card style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {origin.trim()} → {dest.trim()}
              </Text>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 14, color: "#666" }}>Zone</span>
                <Tag
                  style={{
                    fontSize: 28,
                    padding: "4px 16px",
                    fontWeight: "bold",
                    background: ZONE_COLORS[result.zone] ?? "#8c8c8c",
                    color: "#fff",
                    border: "none",
                    margin: 0,
                  }}
                >
                  {result.zone}
                </Tag>
              </div>
            </div>
            <Button icon={<CopyOutlined />} onClick={handleCopy}>
              复制
            </Button>
          </div>
        </Card>
      )}

      {result && !result.success && (
        <Alert
          type="error"
          message={result.error}
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      {effectiveDate && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          数据生效日期: {effectiveDate} · 来源: USPS NZCM
        </Text>
      )}
    </div>
  );
}
