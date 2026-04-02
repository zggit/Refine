"use client";

import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Row,
  Spin,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import { InboxOutlined, SyncOutlined } from "@ant-design/icons";
import { useState } from "react";
import type { TongtoolOrder } from "@/app/api/tongtool/orders/route";
import type { EbayOrder } from "@/app/api/ebay/orders/route";

const { Title, Text } = Typography;
const { Dragger } = Upload;

// ── Types ──────────────────────────────────────────────────────────────────

type ErpOrder = {
  raw: string;        // e.g. "AV-02-14432-76894"  (orderIdCode or paste-extracted)
  normalized: string; // e.g. "02-14432-76894"      (salesRecordNumber, matches eBay CSV)
  // enriched from API (undefined when from paste)
  buyerName?: string;
  saleAccount?: string;
  actualTotalPrice?: number;
  orderIdKey?: string;
  paidTime?: string;
};

type CompareRow = ErpOrder & { key: string };

// ── eBay CSV parser ─────────────────────────────────────────────────────────

function parseCsvRow(row: string): string[] {
  const result: string[] = [];
  let inQuote = false;
  let cur = "";
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (inQuote) {
      if (c === '"' && row[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuote = false; }
      else { cur += c; }
    } else {
      if (c === '"') { inQuote = true; }
      else if (c === ',') { result.push(cur); cur = ""; }
      else { cur += c; }
    }
  }
  result.push(cur);
  return result;
}

function parseEbayCsv(text: string): Set<string> {
  const content = text.startsWith("\ufeff") ? text.slice(1) : text;
  const lines = content.split("\n");
  const headerLine = lines.find((l) => l.includes("Order Number") && l.includes("Buyer"));
  if (!headerLine) throw new Error('找不到表头行（含 "Order Number"）');
  const headers = parseCsvRow(headerLine);
  const orderIdx = headers.findIndex((h) => h.trim() === "Order Number");
  if (orderIdx < 0) throw new Error('CSV 中找不到 "Order Number" 列');
  const headerRowIdx = lines.indexOf(headerLine);
  const seen = new Set<string>();
  for (let i = headerRowIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.includes("record(s) downloaded")) continue;
    const cols = parseCsvRow(lines[i]);
    const orderNum = cols[orderIdx]?.trim().toUpperCase();
    if (orderNum) seen.add(orderNum);
  }
  return seen;
}

// ── TongtoolERP paste parser ────────────────────────────────────────────────

function parseErpPaste(text: string): ErpOrder[] {
  const pattern = /\b[A-Z]{2,3}-\d{2}-\d{5}-\d{5}\b/g;
  const matches = text.match(pattern) ?? [];
  const found = Array.from(new Set(matches));
  return found.map((raw) => ({
    raw,
    normalized: raw.replace(/^[A-Z]+-/, ""),
  }));
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ReconcilePage() {
  // eBay — shared set + source
  const [ebaySet, setEbaySet] = useState<Set<string> | null>(null);
  const [ebayCount, setEbayCount] = useState(0);
  const [ebaySource, setEbaySource] = useState<"csv" | "api" | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [ebayApiLoading, setEbayApiLoading] = useState(false);
  const [ebayApiError, setEbayApiError] = useState<string | null>(null);

  // TongtoolERP — paste
  const [erpPaste, setErpPaste] = useState("");

  // TongtoolERP — shared order list + source
  const [erpOrders, setErpOrders] = useState<ErpOrder[]>([]);
  const [erpSource, setErpSource] = useState<"paste" | "api" | null>(null);
  const [erpLoading, setErpLoading] = useState(false);
  const [erpError, setErpError] = useState<string | null>(null);

  // Result
  const [result, setResult] = useState<CompareRow[] | null>(null);

  // ── CSV upload ──
  const handleCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const parsed = parseEbayCsv(text);
        setEbaySet(parsed);
        setEbayCount(parsed.size);
        setEbaySource("csv");
        setCsvError(null);
        setEbayApiError(null);
        setResult(null);
      } catch (err: unknown) {
        setCsvError(err instanceof Error ? err.message : "CSV 解析失败");
      }
    };
    reader.readAsText(file, "utf-8");
    return false;
  };

  // ── eBay API fetch (all stores) ──
  const handleEbayApiFetch = async () => {
    setEbayApiLoading(true);
    setEbayApiError(null);
    setCsvError(null);
    setResult(null);
    try {
      const stores = ["AV", "ST"];
      const results = await Promise.all(
        stores.map(async (store) => {
          const res = await fetch(`/api/ebay/orders?store=${store}`);
          const data = await res.json() as { success: boolean; orders: EbayOrder[]; error?: string };
          if (!data.success) throw new Error(`${store}: ${data.error ?? "eBay API 返回失败"}`);
          return data.orders;
        })
      );
      const allOrders = results.flat();
      const set = new Set<string>(allOrders.map((o) => o.orderId.toUpperCase()));
      setEbaySet(set);
      setEbayCount(set.size);
      setEbaySource("api");
    } catch (err: unknown) {
      setEbayApiError(err instanceof Error ? err.message : "拉取失败");
    } finally {
      setEbayApiLoading(false);
    }
  };

  // ── Paste input ──
  const handlePasteChange = (text: string) => {
    setErpPaste(text);
    const parsed = parseErpPaste(text);
    setErpOrders(parsed);
    setErpSource(parsed.length > 0 ? "paste" : null);
    setErpError(null);
    setResult(null);
  };

  // ── API fetch ──
  const handleApiFetch = async () => {
    setErpLoading(true);
    setErpError(null);
    setResult(null);
    try {
      const res = await fetch("/api/tongtool/orders");
      const data = await res.json() as { success: boolean; orders: TongtoolOrder[]; error?: string };
      if (!data.success) throw new Error(data.error ?? "API 返回失败");
      const orders: ErpOrder[] = data.orders.map((o) => ({
        raw: o.orderIdCode ?? o.salesRecordNumber ?? "",
        normalized: (o.salesRecordNumber ?? "").toUpperCase(),
        buyerName: o.buyerName ?? o.buyerAccountId ?? undefined,
        saleAccount: o.saleAccount ?? undefined,
        actualTotalPrice: o.actualTotalPrice ?? undefined,
        orderIdKey: o.orderIdKey ?? undefined,
        paidTime: o.paidTime ?? undefined,
      }));
      setErpOrders(orders);
      setErpSource("api");
    } catch (err: unknown) {
      setErpError(err instanceof Error ? err.message : "拉取失败");
    } finally {
      setErpLoading(false);
    }
  };

  // ── Compare ──
  const handleCompare = () => {
    if (!ebaySet) return;
    const toCheck = erpOrders.filter(
      (o) => !ebaySet.has(o.normalized.toUpperCase())
    );
    setResult(toCheck.map((o) => ({ ...o, key: o.raw || o.normalized })));
  };

  const canCompare = ebaySet !== null && erpOrders.length > 0;
  const riskCount = result?.length ?? 0;
  const okCount = result !== null ? erpOrders.length - riskCount : 0;

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <Title level={4} style={{ marginBottom: 4 }}>
        eBay × TongtoolERP 待发货订单核对
      </Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        找出已在 eBay web 端发货、但仍留在 TongtoolERP 待发货队列中的订单
      </Text>

      <Row gutter={16}>
        {/* STEP 1 */}
        <Col xs={24} lg={12}>
          <Card
            title="STEP 1 — eBay 待发货订单"
            extra={ebaySet && (
              <Tag color="green">
                {ebaySource === "api" ? "API · " : "CSV · "}{ebayCount} 个订单
              </Tag>
            )}
          >
            {/* eBay API button */}
            <Button
              icon={<SyncOutlined />}
              loading={ebayApiLoading}
              onClick={handleEbayApiFetch}
              type={ebaySource === "api" ? "primary" : "default"}
              block
            >
              从 eBay API 拉取待发货订单
            </Button>
            {ebayApiError && (
              <Alert type="error" message={ebayApiError} showIcon style={{ marginTop: 8 }} />
            )}

            <Divider plain style={{ margin: "12px 0", color: "#aaa" }}>或上传 CSV</Divider>

            <Dragger
              accept=".csv"
              beforeUpload={handleCsvFile}
              showUploadList={false}
              style={{ padding: "8px 0" }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p style={{ margin: "8px 0 4px" }}>拖拽或点击上传 CSV 文件</p>
              <p style={{ color: "#888", fontSize: 12 }}>
                eBay 后台 → Orders → Awaiting shipment → Export orders
              </p>
            </Dragger>
            {csvError && <Alert type="error" message={csvError} showIcon style={{ marginTop: 8 }} />}
            {ebaySet && (
              <Alert
                type="success"
                message={ebaySource === "api"
                  ? `API 拉取成功：${ebayCount} 个待发货订单`
                  : `CSV 解析成功：${ebayCount} 个待发货订单`}
                showIcon
                style={{ marginTop: 8 }}
              />
            )}
          </Card>
        </Col>

        {/* STEP 2 */}
        <Col xs={24} lg={12}>
          <Card
            title="STEP 2 — TongtoolERP 待发货列表"
            extra={erpOrders.length > 0 && (
              <Tag color={erpSource === "api" ? "purple" : "blue"}>
                {erpSource === "api" ? "API" : "粘贴"} · {erpOrders.length} 个订单
              </Tag>
            )}
          >
            {/* API fetch button */}
            <Button
              icon={<SyncOutlined />}
              loading={erpLoading}
              onClick={handleApiFetch}
              type={erpSource === "api" ? "primary" : "default"}
              block
            >
              从 TongtoolERP API 拉取（最近 7 天待发货）
            </Button>

            {erpError && <Alert type="error" message={erpError} showIcon style={{ marginTop: 8 }} />}

            <Divider plain style={{ margin: "12px 0", color: "#aaa" }}>或手动粘贴</Divider>

            <textarea
              placeholder={
                "从 TongtoolERP「待发货」列表全选复制，粘贴到这里…\n\n" +
                "系统会自动识别包裹号（如 AV-12-14414-75602），\n" +
                "去掉店铺前缀（AV-、ST- 等）后与 eBay 订单号比对。"
              }
              value={erpPaste}
              onChange={(e) => handlePasteChange(e.target.value)}
              style={{
                width: "100%",
                height: 150,
                fontFamily: "monospace",
                fontSize: 12,
                resize: "vertical",
                border: "1px solid #d9d9d9",
                borderRadius: 6,
                padding: 8,
                boxSizing: "border-box",
              }}
            />

            {erpSource === "paste" && erpOrders.length > 0 && (
              <Alert type="success" message={`识别到 ${erpOrders.length} 个 TongtoolERP 订单`} showIcon style={{ marginTop: 8 }} />
            )}
            {erpSource === "api" && erpOrders.length > 0 && (
              <Alert type="success" message={`API 拉取成功：${erpOrders.length} 个待发货订单（waitPacking）`} showIcon style={{ marginTop: 8 }} />
            )}
          </Card>
        </Col>
      </Row>

      {/* TongtoolERP orders preview (API only) */}
      {erpSource === "api" && erpOrders.length > 0 && (
        <Card
          title={`TongtoolERP 待发货订单（${erpOrders.length} 条）`}
          size="small"
          style={{ marginTop: 16 }}
        >
          <Table
            dataSource={erpOrders.map((o) => ({ ...o, key: o.raw || o.normalized }))}
            size="small"
            pagination={{ pageSize: 50, showSizeChanger: false }}
            columns={[
              { title: "包裹号", dataIndex: "raw", key: "raw", width: 200 },
              { title: "eBay 订单号", dataIndex: "normalized", key: "normalized", width: 180 },
              {
                title: "付款时间",
                dataIndex: "paidTime",
                key: "paidTime",
                width: 160,
                render: (v: string) => v || "-",
              },
              {
                title: "买家",
                dataIndex: "buyerName",
                key: "buyerName",
                width: 150,
                render: (v: string) => v || "-",
              },
              {
                title: "店铺",
                dataIndex: "saleAccount",
                key: "saleAccount",
                width: 120,
                render: (v: string) => v || "-",
              },
              {
                title: "金额",
                dataIndex: "actualTotalPrice",
                key: "actualTotalPrice",
                width: 90,
                render: (v: number) => (v != null ? `$${v.toFixed(2)}` : "-"),
              },
            ]}
          />
        </Card>
      )}

      {/* Compare button */}
      <Row style={{ marginTop: 16, marginBottom: 8 }} align="middle">
        <Col>
          <Button type="primary" size="large" disabled={!canCompare} onClick={handleCompare}>
            开始核对
          </Button>
        </Col>
        {!canCompare && (
          <Col>
            <Text type="secondary" style={{ marginLeft: 12 }}>
              {!ebaySet ? "请先上传 eBay CSV" : "请拉取或粘贴 TongtoolERP 数据"}
            </Text>
          </Col>
        )}
      </Row>

      {/* Results */}
      {result !== null && (
        <>
          <Row gutter={12} style={{ marginBottom: 16 }}>
            {[
              { label: "eBay 待发货", value: ebayCount },
              { label: "TongtoolERP 待发货", value: erpOrders.length },
              {
                label: "⚠ 重复发货风险",
                value: riskCount,
                bg: riskCount > 0 ? "#fff1f0" : "#f6ffed",
                color: riskCount > 0 ? "#cf1322" : "#389e0d",
                border: riskCount > 0 ? "#ffa39e" : "#b7eb8f",
              },
              { label: "✓ 正常", value: okCount, bg: "#f6ffed", color: "#389e0d", border: "#b7eb8f" },
            ].map(({ label, value, bg, color, border }) => (
              <Col key={label}>
                <Card size="small" style={{ textAlign: "center", minWidth: 130, background: bg, borderColor: border }}>
                  <div style={{ fontSize: 28, fontWeight: "bold", color }}>{value}</div>
                  <div style={{ fontSize: 12 }}>{label}</div>
                </Card>
              </Col>
            ))}
          </Row>

          {riskCount > 0 ? (
            <Card title={`需注意的订单（${riskCount} 条）`}>
              <Table
                dataSource={result}
                size="small"
                pagination={false}
                columns={[
                  {
                    title: "TongtoolERP 包裹号",
                    dataIndex: "raw",
                    key: "raw",
                    width: 200,
                  },
                  {
                    title: "eBay 订单号",
                    dataIndex: "normalized",
                    key: "normalized",
                    width: 180,
                  },
                  ...(erpSource === "api" ? [
                    {
                      title: "买家",
                      dataIndex: "buyerName",
                      key: "buyerName",
                      width: 140,
                      render: (v: string) => v || "-",
                    },
                    {
                      title: "店铺",
                      dataIndex: "saleAccount",
                      key: "saleAccount",
                      width: 120,
                      render: (v: string) => v || "-",
                    },
                    {
                      title: "金额",
                      dataIndex: "actualTotalPrice",
                      key: "actualTotalPrice",
                      width: 90,
                      render: (v: number) => v != null ? `$${v.toFixed(2)}` : "-",
                    },
                  ] : []),
                  {
                    title: "状态",
                    key: "status",
                    render: () => <Tag color="red">已从 eBay web 端发货，TongtoolERP 仍待处理</Tag>,
                  },
                ]}
              />
            </Card>
          ) : (
            <Alert
              type="success"
              showIcon
              message="无需处理"
              description="TongtoolERP 所有待发货订单均在 eBay 待发货列表中，无重复发货风险。"
            />
          )}
        </>
      )}
    </div>
  );
}
