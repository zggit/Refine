import { NextResponse } from "next/server";

const CLIENT_ID = process.env.EBAY_CLIENT_ID!;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET!;
const REFRESH_TOKEN = process.env.EBAY_REFRESH_TOKEN!;

const SANDBOX = process.env.EBAY_SANDBOX === "true";
const BASE = SANDBOX ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
const TOKEN_URL = `${BASE}/identity/v1/oauth2/token`;
const ORDERS_URL = `${BASE}/sell/fulfillment/v1/order`;

// Cache access token in memory — survives across requests, resets on cold start
let cachedToken: { value: string; expiresAt: number } | null = null;

export interface EbayOrder {
  orderId: string;           // e.g. "02-14432-76894"
  orderFulfillmentStatus: string;
  buyerUsername: string | null;
  totalAmount: number | null;
  currency: string | null;
  creationDate: string | null;
  lastModifiedDate: string | null;
}

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5-min buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: REFRESH_TOKEN,
      scope: "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    cachedToken = null;
    throw new Error(`eBay token request failed (${res.status}): ${body}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000, // refresh 5 min early
  };
  return data.access_token;
}

function normalizeOrderId(orderId: string): string {
  // eBay order IDs are already in "XX-XXXXX-XXXXX" format
  return orderId.trim().toUpperCase();
}

export async function GET() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN ||
      CLIENT_ID === "your-client-id-here") {
    return NextResponse.json(
      { success: false, error: "eBay API credentials not configured. Set EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_REFRESH_TOKEN in .env.local" },
      { status: 503 }
    );
  }

  try {
    const accessToken = await getAccessToken();

    const allOrders: EbayOrder[] = [];
    let offset = 0;
    const limit = 200;

    while (true) {
      const url = new URL(ORDERS_URL);
      url.searchParams.set("filter", "orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}");
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("offset", String(offset));

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`eBay getOrders failed (${res.status}): ${body}`);
      }

      const data = await res.json() as {
        orders?: Array<{
          orderId: string;
          orderFulfillmentStatus: string;
          buyer?: { username?: string };
          pricingSummary?: { total?: { value?: string; currency?: string } };
          creationDate?: string;
          lastModifiedDate?: string;
        }>;
        total?: number;
        next?: string;
      };

      const batch = data.orders ?? [];
      for (const o of batch) {
        allOrders.push({
          orderId: normalizeOrderId(o.orderId),
          orderFulfillmentStatus: o.orderFulfillmentStatus,
          buyerUsername: o.buyer?.username ?? null,
          totalAmount: o.pricingSummary?.total?.value != null
            ? parseFloat(o.pricingSummary.total.value)
            : null,
          currency: o.pricingSummary?.total?.currency ?? null,
          creationDate: o.creationDate ?? null,
          lastModifiedDate: o.lastModifiedDate ?? null,
        });
      }

      // No more pages if batch is smaller than limit or no "next" cursor
      if (batch.length < limit || !data.next) break;
      offset += limit;
    }

    return NextResponse.json({
      success: true,
      orders: allOrders,
      total: allOrders.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
