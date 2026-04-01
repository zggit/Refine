import { NextResponse } from "next/server";
import { getAccessToken } from "../../token";
import { tradingApiCall, xmlText, toOz } from "../../trading";
import { createSupabaseServerClient } from "@/utils/supabase/server";

// GET /api/ebay/inventory/weight?ids=123,456
// Fetches from eBay Trading API, saves to Supabase, returns weights in oz
export async function GET(req: Request) {
  try {
    const accessToken = await getAccessToken();
    const supabase = await createSupabaseServerClient();
    const url = new URL(req.url);
    const idsParam = url.searchParams.get("ids") ?? "";
    const ids = idsParam.split(",").filter(Boolean).slice(0, 50);

    if (ids.length === 0) {
      return NextResponse.json({ success: true, weights: {} });
    }

    // Check Supabase cache first
    const { data: cached } = await supabase
      .from("ebay_item_weights")
      .select("item_id, weight_oz")
      .in("item_id", ids);

    const cachedMap = new Map<string, number>();
    for (const row of cached ?? []) {
      cachedMap.set(row.item_id, row.weight_oz);
    }

    // Only fetch from eBay for uncached items
    const uncached = ids.filter((id) => !cachedMap.has(id));

    if (uncached.length > 0) {
      const results = await Promise.all(
        uncached.map(async (id) => {
          const body = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ItemID>${id}</ItemID>
  <OutputSelector>ShippingPackageDetails</OutputSelector>
</GetItemRequest>`;
          const xml = await tradingApiCall("GetItem", body, accessToken);
          const major = xmlText(xml, "WeightMajor");
          const minor = xmlText(xml, "WeightMinor");
          const oz = toOz(major, minor);
          return { id, oz };
        })
      );

      // Save to Supabase
      const rows = results.map((r) => ({
        item_id: r.id,
        weight_oz: r.oz,
        updated_at: new Date().toISOString(),
      }));
      if (rows.length > 0) {
        const { error: upsertErr } = await supabase
          .from("ebay_item_weights")
          .upsert(rows, { onConflict: "item_id" });
        if (upsertErr) {
          console.error("Weight upsert error:", upsertErr);
        }
      }

      for (const r of results) {
        cachedMap.set(r.id, r.oz);
      }
    }

    // Build response
    const weights: Record<string, number> = {};
    for (const id of ids) {
      const oz = cachedMap.get(id);
      if (oz !== undefined) weights[id] = oz;
    }

    return NextResponse.json({ success: true, weights });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
