import { NextResponse } from "next/server";
import { getAccessToken } from "../token";
import { tradingApiCall, xmlText } from "../trading";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export interface EbayListing {
  itemId: string;
  title: string;
  sku: string | null;
  price: number | null;
  currency: string | null;
  quantity: number | null;
  quantityAvailable: number | null;
  quantitySold: number | null;
  imageUrl: string | null;
}

function parseItems(xml: string): EbayListing[] {
  const items: EbayListing[] = [];
  const itemBlocks = xml.split(/<Item>/g).slice(1);
  for (const block of itemBlocks) {
    const itemXml = block.split(/<\/Item>/)[0];
    const itemId = xmlText(itemXml, "ItemID");
    const title = xmlText(itemXml, "Title");
    const sku = xmlText(itemXml, "SKU");
    const qty = xmlText(itemXml, "Quantity");
    const qtyAvail = xmlText(itemXml, "QuantityAvailable");
    const qtySold = xmlText(itemXml, "QuantitySold");
    const price = xmlText(itemXml, "CurrentPrice") ?? xmlText(itemXml, "BuyItNowPrice");
    const galleryUrl = xmlText(itemXml, "GalleryURL");

    items.push({
      itemId: itemId ?? "",
      title: title ?? "",
      sku: sku ?? null,
      price: price != null ? parseFloat(price) : null,
      currency: "USD",
      quantity: qty != null ? parseInt(qty, 10) : null,
      quantityAvailable: qtyAvail != null ? parseInt(qtyAvail, 10) : null,
      quantitySold: qtySold != null ? parseInt(qtySold, 10) : null,
      imageUrl: galleryUrl ?? null,
    });
  }
  return items;
}

// GET /api/ebay/inventory
// ?source=cache  → load from Supabase (fast, default)
// ?source=ebay   → fetch from eBay, update Supabase, return fresh data
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const source = url.searchParams.get("source") ?? "cache";
    const supabase = await createSupabaseServerClient();

    if (source === "cache") {
      // Load listings and weights separately
      const [listingsRes, weightsRes] = await Promise.all([
        supabase.from("ebay_listings").select("*").order("updated_at", { ascending: false }).limit(2000),
        supabase.from("ebay_item_weights").select("item_id, weight_oz").limit(2000),
      ]);

      if (listingsRes.error) throw new Error(listingsRes.error.message);

      const weightMap = new Map<string, number>();
      for (const w of weightsRes.data ?? []) {
        weightMap.set(w.item_id, w.weight_oz);
      }

      const listings: (EbayListing & { weightOz: number | null })[] = (listingsRes.data ?? []).map((row: Record<string, unknown>) => ({
        itemId: row.item_id as string,
        title: row.title as string,
        sku: row.sku as string | null,
        price: row.price != null ? Number(row.price) : null,
        currency: (row.currency as string) ?? "USD",
        quantity: row.quantity as number | null,
        quantityAvailable: row.quantity_available as number | null,
        quantitySold: row.quantity_sold as number | null,
        imageUrl: row.image_url as string | null,
        weightOz: weightMap.get(row.item_id as string) ?? null,
      }));

      return NextResponse.json({
        success: true,
        listings,
        total: listings.length,
        source: "cache",
      });
    }

    // source=ebay — fetch from eBay Trading API
    const accessToken = await getAccessToken();
    const allItems: EbayListing[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const body = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ActiveList>
    <Sort>TimeLeft</Sort>
    <Pagination>
      <EntriesPerPage>200</EntriesPerPage>
      <PageNumber>${page}</PageNumber>
    </Pagination>
  </ActiveList>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`;

      const xml = await tradingApiCall("GetMyeBaySelling", body, accessToken);
      const ack = xmlText(xml, "Ack");
      if (ack !== "Success" && ack !== "Warning") {
        const errMsg = xmlText(xml, "ShortMessage") ?? xmlText(xml, "LongMessage") ?? "Unknown Trading API error";
        throw new Error(errMsg);
      }

      totalPages = parseInt(xmlText(xml, "TotalNumberOfPages") ?? "1", 10);
      allItems.push(...parseItems(xml));
      page++;
    }

    // Deduplicate by itemId (eBay can return duplicates across pages)
    const seen = new Set<string>();
    const uniqueItems = allItems.filter((item) => {
      if (seen.has(item.itemId)) return false;
      seen.add(item.itemId);
      return true;
    });

    const rows = uniqueItems.map((item) => ({
      item_id: item.itemId,
      title: item.title,
      sku: item.sku,
      price: item.price,
      currency: item.currency,
      quantity: item.quantity,
      quantity_available: item.quantityAvailable,
      quantity_sold: item.quantitySold,
      image_url: item.imageUrl,
      updated_at: new Date().toISOString(),
    }));

    // Upsert in chunks of 200
    for (let i = 0; i < rows.length; i += 200) {
      const { error: upsertErr } = await supabase
        .from("ebay_listings")
        .upsert(rows.slice(i, i + 200), { onConflict: "item_id" });
      if (upsertErr) {
        console.error("Upsert error:", upsertErr);
        throw new Error(`Failed to save listings: ${upsertErr.message}`);
      }
    }

    // Also load weights to return complete data
    const { data: weights } = await supabase
      .from("ebay_item_weights")
      .select("item_id, weight_oz");

    const weightMap = new Map<string, number>();
    for (const w of weights ?? []) {
      weightMap.set(w.item_id, w.weight_oz);
    }

    const listings = uniqueItems.map((item) => ({
      ...item,
      weightOz: weightMap.get(item.itemId) ?? null,
    }));

    return NextResponse.json({
      success: true,
      listings,
      total: uniqueItems.length,
      source: "ebay",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
