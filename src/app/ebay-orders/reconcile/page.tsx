"use client";

import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Row,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import { InboxOutlined, ReloadOutlined, CheckCircleOutlined, WarningOutlined, LoadingOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TongtoolOrder } from "@/app/api/tongtool/orders/route";
import type { EbayOrder } from "@/app/api/ebay/orders/route";

const { Title, Text } = Typography;
const { Dragger } = Upload;

// ── Types ──────────────────────────────────────────────────────────────────

type ErpOrder = {
  raw: string;
  normalized: string;
  buyerName?: string;
  saleAccount?: string;
  actualTotalPrice?: number;
  orderIdKey?: string;
  paidTime?: string;
};

type CompareRow = ErpOrder & { key: string };

type StepStatus = "idle" | "loading" | "done" | "error";

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
  // Fetch states
  const [ebayStatus, setEbayStatus] = useState<StepStatus>("idle");
  const [erpStatus, setErpStatus] = useState<StepStatus>("idle");
  const [ebayError, setEbayError] = useState<string | null>(null);
  const [erpError, setErpError] = useState<string | null>(null);

  // Data
  const [ebaySet, setEbaySet] = useState<Set<string> | null>(null);
  const [ebayCount, setEbayCount] = useState(0);
  const [ebaySource, setEbaySource] = useState<"api" | "csv" | null>(null);
  const [erpOrders, setErpOrders] = useState<ErpOrder[]>([]);
  const [erpSource, setErpSource] = useState<"api" | "paste" | null>(null);
  const [result, setResult] = useState<CompareRow[] | null>(null);
  const [lastRunTime, setLastRunTime] = useState<Date | null>(null);

  // Manual override
  const [erpPaste, setErpPaste] = useState("");
  const [csvError, setCsvError] = useState<string | null>(null);

  // Prevent double-run on mount
  const didAutoRun = useRef(false);

  // ── Fetch eBay orders (all stores) ──
  const fetchEbay = useCallback(async (): Promise<Set<string> | null> => {
    setEbayStatus("loading");
    setEbayError(null);
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
      setEbayStatus("done");
      return set;
    } catch (err: unknown) {
      setEbayError(err instanceof Error ? err.message : "拉取失败");
      setEbayStatus("error");
      return null;
    }
  }, []);

  // ── Fetch TongtoolERP orders ──
  const fetchErp = useCallback(async (): Promise<ErpOrder[] | null> => {
    setErpStatus("loading");
    setErpError(null);
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
      setErpStatus("done");
      return orders;
    } catch (err: unknown) {
      setErpError(err instanceof Error ? err.message : "拉取失败");
      setErpStatus("error");
      return null;
    }
  }, []);

  // ── Run full reconciliation ──
  const runReconcile = useCallback(async () => {
    setResult(null);
    const [ebayResult, erpResult] = await Promise.all([fetchEbay(), fetchErp()]);
    if (ebayResult && erpResult) {
      const toCheck = erpResult.filter(
        (o) => !ebayResult.has(o.normalized.toUpperCase())
      );
      setResult(toCheck.map((o) => ({ ...o, key: o.raw || o.normalized })));
      setLastRunTime(new Date());
    }
  }, [fetchEbay, fetchErp]);

  // ── Auto-run on mount ──
  useEffect(() => {
    if (didAutoRun.current) return;
    didAutoRun.current = true;
    runReconcile();
  }, [runReconcile]);

  // ── Manual compare (when using CSV/paste overrides) ──
  const handleManualCompare = () => {
    if (!ebaySet || erpOrders.length === 0) return;
    const toCheck = erpOrders.filter(
      (o) => !ebaySet.has(o.normalized.toUpperCase())
    );
    setResult(toCheck.map((o) => ({ ...o, key: o.raw || o.normalized })));
    setLastRunTime(new Date());
  };

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
        setEbayStatus("done");
        setCsvError(null);
        setEbayError(null);
        // Auto-compare if ERP data already loaded
        if (erpOrders.length > 0) {
          const toCheck = erpOrders.filter(
            (o) => !parsed.has(o.normalized.toUpperCase())
          );
          setResult(toCheck.map((o) => ({ ...o, key: o.raw || o.normalized })));
          setLastRunTime(new Date());
        }
      } catch (err: unknown) {
        setCsvError(err instanceof Error ? err.message : "CSV 解析失败");
      }
    };
    reader.readAsText(file, "utf-8");
    return false;
  };

  // ── Paste input ──
  const handlePasteChange = (text: string) => {
    setErpPaste(text);
    const parsed = parseErpPaste(text);
    if (parsed.length > 0) {
      setErpOrders(parsed);
      setErpSource("paste");
      setErpStatus("done");
      setErpError(null);
      // Auto-compare if eBay data already loaded
      if (ebaySet) {
        const toCheck = parsed.filter(
          (o) => !ebaySet.has(o.normalized.toUpperCase())
        );
        setResult(toCheck.map((o) => ({ ...o, key: o.raw || o.normalized })));
        setLastRunTime(new Date());
      }
    }
  };

  const isLoading = ebayStatus === "loading" || erpStatus === "loading";
  const hasError = ebayStatus === "error" || erpStatus === "error";
  const riskCount = result?.length ?? 0;
  const okCount = result !== null ? erpOrders.length - riskCount : 0;

  // ── Step indicator ──
  const stepIcon = (status: StepStatus) => {
    switch (status) {
      case "loading": return <LoadingOutlined spin style={{ color: "#1677ff" }} />;
      case "done": return <CheckCircleOutlined style={{ color: "#52c41a" }} />;
      case "error": return <WarningOutlined style={{ color: "#ff4d4f" }} />;
      default: return <span style={{ color: "#d9d9d9" }}>○</span>;
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            eBay × TongtoolERP 待发货订单核对
          </Title>
          <Text type="secondary">
            自动拉取并比对，找出已在 eBay 发货但 TongtoolERP 仍待处理的订单
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={runReconcile}
          loading={isLoading}
          type="primary"
          size="large"
        >
          {isLoading ? "核对中…" : "刷新核对"}
        </Button>
      </div>

      {/* Progress steps */}
      {isLoading && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 32 }}>
            <span>{stepIcon(ebayStatus)} eBay 待发货订单 (AV+ST){ebayStatus === "done" ? ` · ${ebayCount} 条` : ""}</span>
            <span>{stepIcon(erpStatus)} TongtoolERP 待发货订单{erpStatus === "done" ? ` · ${erpOrders.length} 条` : ""}</span>
          </div>
        </Card>
      )}

      {/* Errors */}
      {ebayError && (
        <Alert type="error" message={`eBay 拉取失败: ${ebayError}`} showIcon closable style={{ marginBottom: 12 }} />
      )}
      {erpError && (
        <Alert type="error" message={`TongtoolERP 拉取失败: ${erpError}`} showIcon closable style={{ marginBottom: 12 }} />
      )}

      {/* Results */}
      {result !== null && (
        <>
          {/* Summary cards */}
          <Row gutter={12} style={{ marginBottom: 16 }}>
            {[
              { label: "eBay 待发货", value: ebayCount, source: ebaySource },
              { label: "TongtoolERP 待发货", value: erpOrders.length, source: erpSource },
              {
                label: "⚠ 重复发货风险",
                value: riskCount,
                bg: riskCount > 0 ? "#fff1f0" : "#f6ffed",
                color: riskCount > 0 ? "#cf1322" : "#389e0d",
                border: riskCount > 0 ? "#ffa39e" : "#b7eb8f",
              },
              { label: "✓ 正常", value: okCount, bg: "#f6ffed", color: "#389e0d", border: "#b7eb8f" },
            ].map(({ label, value, bg, color, border, source }) => (
              <Col key={label}>
                <Card size="small" style={{ textAlign: "center", minWidth: 140, background: bg, borderColor: border }}>
                  <div style={{ fontSize: 28, fontWeight: "bold", color }}>{value}</div>
                  <div style={{ fontSize: 12 }}>{label}</div>
                  {source && <div style={{ fontSize: 11, color: "#999" }}>via {source}</div>}
                </Card>
              </Col>
            ))}
          </Row>

          {lastRunTime && (
            <Text type="secondary" style={{ display: "block", marginBottom: 12, fontSize: 12 }}>
              上次核对: {lastRunTime.toLocaleTimeString()}
            </Text>
          )}

          {riskCount > 0 ? (
            <Card title={`需注意的订单（${riskCount} 条）`} style={{ marginBottom: 16 }}>
              <Table
                dataSource={result}
                size="small"
                pagination={false}
                columns={[
                  { title: "TongtoolERP 包裹号", dataIndex: "raw", key: "raw", width: 200 },
                  { title: "eBay 订单号", dataIndex: "normalized", key: "normalized", width: 180 },
                  ...(erpSource === "api" ? [
                    { title: "买家", dataIndex: "buyerName", key: "buyerName", width: 140, render: (v: string) => v || "-" },
                    { title: "店铺", dataIndex: "saleAccount", key: "saleAccount", width: 120, render: (v: string) => v || "-" },
                    { title: "金额", dataIndex: "actualTotalPrice", key: "actualTotalPrice", width: 90, render: (v: number) => v != null ? `$${v.toFixed(2)}` : "-" },
                  ] : []),
                  { title: "状态", key: "status", render: () => <Tag color="red">已从 eBay web 端发货，TongtoolERP 仍待处理</Tag> },
                ]}
              />
            </Card>
          ) : (
            <Alert
              type="success"
              showIcon
              message="无需处理"
              description="TongtoolERP 所有待发货订单均在 eBay 待发货列表中，无重复发货风险。"
              style={{ marginBottom: 16 }}
            />
          )}

          {/* TongtoolERP full list (collapsible) */}
          {erpSource === "api" && erpOrders.length > 0 && (
            <Collapse
              ghost
              items={[{
                key: "erp-list",
                label: `查看全部 TongtoolERP 订单（${erpOrders.length} 条）`,
                children: (
                  <Table
                    dataSource={erpOrders.map((o) => ({ ...o, key: o.raw || o.normalized }))}
                    size="small"
                    pagination={{ pageSize: 50, showSizeChanger: false }}
                    columns={[
                      { title: "包裹号", dataIndex: "raw", key: "raw", width: 200 },
                      { title: "eBay 订单号", dataIndex: "normalized", key: "normalized", width: 180 },
                      { title: "付款时间", dataIndex: "paidTime", key: "paidTime", width: 160, render: (v: string) => v || "-" },
                      { title: "买家", dataIndex: "buyerName", key: "buyerName", width: 150, render: (v: string) => v || "-" },
                      { title: "店铺", dataIndex: "saleAccount", key: "saleAccount", width: 120, render: (v: string) => v || "-" },
                      { title: "金额", dataIndex: "actualTotalPrice", key: "actualTotalPrice", width: 90, render: (v: number) => (v != null ? `$${v.toFixed(2)}` : "-") },
                    ]}
                  />
                ),
              }]}
              style={{ marginBottom: 16 }}
            />
          )}
        </>
      )}

      {/* Manual override section (collapsed) */}
      {!isLoading && (
        <Collapse
          ghost
          items={[{
            key: "manual",
            label: "手动输入（CSV 上传 / 粘贴）",
            children: (
              <Row gutter={16}>
                <Col xs={24} lg={12}>
                  <Card title="eBay — 上传 CSV" size="small">
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
                    {ebaySource === "csv" && (
                      <Alert type="success" message={`CSV 解析成功：${ebayCount} 个订单`} showIcon style={{ marginTop: 8 }} />
                    )}
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="TongtoolERP — 粘贴数据" size="small">
                    <textarea
                      placeholder={
                        "从 TongtoolERP「待发货」列表全选复制，粘贴到这里…\n\n" +
                        "系统会自动识别包裹号（如 AV-12-14414-75602），\n" +
                        "去掉店铺前缀后与 eBay 订单号比对。"
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
                      <Alert type="success" message={`识别到 ${erpOrders.length} 个订单`} showIcon style={{ marginTop: 8 }} />
                    )}
                  </Card>
                </Col>
                {(ebaySource === "csv" || erpSource === "paste") && (
                  <Col span={24} style={{ marginTop: 12 }}>
                    <Button
                      type="primary"
                      onClick={handleManualCompare}
                      disabled={!ebaySet || erpOrders.length === 0}
                    >
                      使用手动数据核对
                    </Button>
                  </Col>
                )}
              </Row>
            ),
          }]}
        />
      )}
    </div>
  );
}
