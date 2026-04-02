import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, STORE_IDS, type StoreId } from "../../token";
import { tradingApiCall, xmlText } from "../../trading";
import { supabaseServiceClient } from "@/utils/supabase/service";
import type { EbayListing } from "@/types/ebay";

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

// POST /api/ebay/inventory/sync?store=AV
export async function POST(req: NextRequest) {
  try {
    const store = (req.nextUrl.searchParams.get("store") ?? "AV") as StoreId;
    if (!STORE_IDS.includes(store)) {
      return NextResponse.json({ success: false, error: `Invalid store: ${store}` }, { status: 400 });
    }

    const supabase = supabaseServiceClient;
    const accessToken = await getAccessToken(store);
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

    // Deduplicate by itemId
    const seen = new Set<string>();
    const uniqueItems = allItems.filter((item) => {
      if (seen.has(item.itemId)) return false;
      seen.add(item.itemId);
      return true;
    });

    const rows = uniqueItems.map((item) => ({
      item_id: item.itemId,
      store_id: store,
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
        .upsert(rows.slice(i, i + 200), { onConflict: "item_id,store_id" });
      if (upsertErr) {
        console.error("Upsert error:", upsertErr);
        throw new Error(`Failed to save listings: ${upsertErr.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      count: uniqueItems.length,
      store,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
