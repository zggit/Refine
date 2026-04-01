import { NextResponse } from "next/server";
import { getAccessToken, BASE } from "../token";

const ORDERS_URL = `${BASE}/sell/fulfillment/v1/order`;

export interface EbayOrder {
  orderId: string;           // e.g. "02-14432-76894"
  orderFulfillmentStatus: string;
  buyerUsername: string | null;
  totalAmount: number | null;
  currency: string | null;
  creationDate: string | null;
  lastModifiedDate: string | null;
}

function normalizeOrderId(orderId: string): string {
  return orderId.trim().toUpperCase();
}

export async function GET() {
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
