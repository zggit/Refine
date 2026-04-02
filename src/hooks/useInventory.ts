"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowserClient } from "@/utils/supabase/client";
import type { ListingWithWeight } from "@/types/ebay";

interface InventoryState {
  listings: ListingWithWeight[];
  loading: boolean;
  syncing: boolean;
  error: string | null;
  lastSource: string | null;
  weightLoading: boolean;
  weightProgress: { done: number; total: number };
}

// Map a Supabase row (snake_case) to our ListingWithWeight type (camelCase)
function mapRow(row: Record<string, unknown>, weightOz: number | null): ListingWithWeight {
  return {
    itemId: row.item_id as string,
    title: row.title as string,
    sku: row.sku as string | null,
    price: row.price != null ? Number(row.price) : null,
    currency: (row.currency as string) ?? "USD",
    quantity: row.quantity as number | null,
    quantityAvailable: row.quantity_available as number | null,
    quantitySold: row.quantity_sold as number | null,
    imageUrl: row.image_url as string | null,
    weightOz,
  };
}

export function useInventory() {
  const [state, setState] = useState<InventoryState>({
    listings: [],
    loading: false,
    syncing: false,
    error: null,
    lastSource: null,
    weightLoading: false,
    weightProgress: { done: 0, total: 0 },
  });
  const abortRef = useRef(false);
  const hadDataRef = useRef(false);

  // Direct Supabase read — two parallel queries + JS merge
  const loadFromSupabase = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [listingsRes, weightsRes] = await Promise.all([
        supabaseBrowserClient
          .from("ebay_listings")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(2000),
        supabaseBrowserClient
          .from("ebay_item_weights")
          .select("item_id, weight_oz")
          .limit(2000),
      ]);

      if (listingsRes.error) {
        setState((s) => ({
          ...s,
          loading: false,
          error: `加载失败: ${listingsRes.error.message}`,
        }));
        return;
      }

      const weightMap = new Map<string, number>();
      for (const w of weightsRes.data ?? []) {
        weightMap.set(w.item_id as string, w.weight_oz as number);
      }

      const listings = (listingsRes.data ?? []).map((row) =>
        mapRow(row, weightMap.get(row.item_id as string) ?? null)
      );

      // Detect suspicious empty result (had data before, now empty)
      if (listings.length === 0 && hadDataRef.current) {
        setState((s) => ({
          ...s,
          listings: [],
          loading: false,
          lastSource: "cache",
          error: "Unexpected empty result — try refreshing",
        }));
        return;
      }

      if (listings.length > 0) hadDataRef.current = true;

      setState((s) => ({
        ...s,
        listings,
        loading: false,
        lastSource: "cache",
        error: null,
      }));
    } catch (err: unknown) {
      setState((s) => ({
        ...s,
        loading: false,
        error: `加载失败: ${err instanceof Error ? err.message : "unknown error"}`,
      }));
    }
  }, []);

  // Sync from eBay via API route, then re-read Supabase
  const syncFromEbay = useCallback(async () => {
    setState((s) => ({ ...s, syncing: true, error: null }));
    try {
      const res = await fetch("/api/ebay/inventory/sync", { method: "POST" });
      const data = (await res.json()) as {
        success: boolean;
        count?: number;
        error?: string;
      };
      if (!data.success) throw new Error(data.error ?? "Sync failed");

      // Re-read from Supabase to get fresh data
      setState((s) => ({ ...s, syncing: false, lastSource: "ebay" }));
      await loadFromSupabase();
    } catch (err: unknown) {
      setState((s) => ({
        ...s,
        syncing: false,
        error: `同步失败: ${err instanceof Error ? err.message : "network error"}`,
      }));
    }
  }, [loadFromSupabase]);

  // Fetch weights in batches via API route, merge into local state
  const fetchWeights = useCallback(
    async (items: ListingWithWeight[]) => {
      const needWeight = items.filter((i) => i.weightOz === null && i.itemId);
      if (needWeight.length === 0) return;

      abortRef.current = false;
      setState((s) => ({
        ...s,
        weightLoading: true,
        weightProgress: { done: 0, total: needWeight.length },
      }));

      const batchSize = 50;
      for (let i = 0; i < needWeight.length; i += batchSize) {
        if (abortRef.current) break;
        const batch = needWeight.slice(i, i + batchSize);
        const ids = batch.map((b) => b.itemId).join(",");

        try {
          const res = await fetch(`/api/ebay/inventory/weight?ids=${ids}`);
          const data = (await res.json()) as {
            success: boolean;
            weights: Record<string, number>;
          };
          if (data.success) {
            setState((s) => ({
              ...s,
              listings: s.listings.map((item) => {
                const oz = data.weights[item.itemId];
                if (oz !== undefined) return { ...item, weightOz: oz };
                return item;
              }),
            }));
          }
        } catch {
          // Silently continue on weight fetch errors — same as current behavior
        }

        setState((s) => ({
          ...s,
          weightProgress: {
            done: Math.min(i + batchSize, needWeight.length),
            total: needWeight.length,
          },
        }));
      }

      setState((s) => ({ ...s, weightLoading: false }));
    },
    []
  );

  const stopWeights = useCallback(() => {
    abortRef.current = true;
  }, []);

  // Load on mount
  useEffect(() => {
    loadFromSupabase();
  }, [loadFromSupabase]);

  return {
    ...state,
    loadFromSupabase,
    syncFromEbay,
    fetchWeights,
    stopWeights,
  };
}
