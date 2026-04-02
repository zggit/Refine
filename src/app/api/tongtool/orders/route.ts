import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://open.tongtool.com";
const ACCESS_KEY = process.env.TONGTOOL_ACCESS_KEY!;
const SECRET_KEY = process.env.TONGTOOL_SECRET_KEY!;
const MERCHANT_ID = process.env.TONGTOOL_MERCHANT_ID!;

export interface TongtoolOrder {
  orderIdKey: string | null;        // TongtoolERP internal ID (for cancel operations)
  orderIdCode: string | null;       // TongtoolERP package number, e.g. "AV-02-14432-76894"
  salesRecordNumber: string | null; // eBay Order Number, e.g. "02-14432-76894" ← match key
  webstoreOrderId: string | null;   // same as salesRecordNumber
  orderStatus: string | null;       // e.g. "waitPacking", "waitingDespatching"
  buyerName: string | null;
  buyerEmail: string | null;
  buyerAccountId: string | null;
  saleAccount: string | null;       // eBay seller account
  actualTotalPrice: number | null;
  paidTime: string | null;
  shippingLimiteDate: string | null;
  warehouseName: string | null;
  dispathTypeName: string | null;
}

function buildSign(appToken: string, timestamp: string): string {
  const input = `app_token${appToken}timestamp${timestamp}${SECRET_KEY}`;
  return createHash("md5").update(input).digest("hex");
}

function buildSignedUrl(path: string, appToken: string): string {
  const timestamp = Date.now().toString();
  const sign = buildSign(appToken, timestamp);
  return `${API_BASE}/api-service${path}?app_token=${appToken}&timestamp=${timestamp}&sign=${sign}`;
}

async function getAppToken(): Promise<string> {
  const url = `${API_BASE}/open-platform-service/devApp/appToken?accessKey=${encodeURIComponent(ACCESS_KEY)}&secretAccessKey=${encodeURIComponent(SECRET_KEY)}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`appToken request failed: HTTP ${res.status}`);
  const data = await res.json() as { success: boolean; code: number; message: string; datas: string };
  if (!data.success || !data.datas)
    throw new Error(`appToken error (code ${data.code}): ${data.message}`);
  return data.datas;
}



function formatDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 7);
  // payDateTo = tomorrow, so all orders paid today are included regardless of query time
  const defaultTo = new Date(now);
  defaultTo.setDate(defaultTo.getDate() + 1);

  const payDateFrom = searchParams.get("payDateFrom") ?? formatDate(defaultFrom);
  const payDateTo = searchParams.get("payDateTo") ?? formatDate(defaultTo);
  const orderStatusParam = searchParams.get("orderStatus") ?? "waitPacking";
  const statusesToFetch = [orderStatusParam];

  async function fetchAllForStatus(token: string, merchantId: string, status: string): Promise<TongtoolOrder[]> {
    const orders: TongtoolOrder[] = [];
    let pageNo = 1;
    const pageSize = 100;

    while (true) {
      const url = buildSignedUrl("/openapi/tongtool/ordersQuery", token);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          api_version: "3.0",
        },
        body: JSON.stringify({
          merchantId,
          orderStatus: status,
          payDateFrom,
          payDateTo,
          pageNo: String(pageNo),
          pageSize: String(pageSize),
          isSuspended: "0",
        }),
        cache: "no-store",
      });

      if (!res.ok) throw new Error(`ordersQuery failed: HTTP ${res.status}`);

      const data = await res.json() as {
        code: number | string; message: string;
        datas: { array: TongtoolOrder[] | null; pageNo: number | null; pageSize: number | null } | null;
      };

      if (Number(data.code) !== 200)
        throw new Error(`TongtoolERP error (code ${data.code}): ${data.message}`);

      const batch = data.datas?.array ?? [];
      orders.push(...batch);

      if (batch.length < pageSize) break;
      pageNo++;
    }

    return orders;
  }

  try {
    const token = await getAppToken();
    const merchantId = MERCHANT_ID;

    const allOrders: TongtoolOrder[] = [];
    for (const status of statusesToFetch) {
      const orders = await fetchAllForStatus(token, merchantId, status);
      allOrders.push(...orders);
    }

    return NextResponse.json({
      success: true,
      orders: allOrders,
      total: allOrders.length,
      payDateFrom,
      payDateTo,
      orderStatus: statusesToFetch.join(","),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
