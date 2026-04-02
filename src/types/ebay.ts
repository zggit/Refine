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

export type ListingWithWeight = EbayListing & { weightOz: number | null };
