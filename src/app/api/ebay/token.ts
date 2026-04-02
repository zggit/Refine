const CLIENT_ID = process.env.EBAY_CLIENT_ID!;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET!;

const SANDBOX = process.env.EBAY_SANDBOX === "true";
const BASE = SANDBOX ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
const TOKEN_URL = `${BASE}/identity/v1/oauth2/token`;

export const STORE_IDS = ["AV", "ST"] as const;
export type StoreId = (typeof STORE_IDS)[number];

const REFRESH_TOKENS: Record<StoreId, string> = {
  AV: process.env.EBAY_REFRESH_TOKEN_AV!,
  ST: process.env.EBAY_REFRESH_TOKEN_ST!,
};

export { BASE };

// Per-store token cache
const tokenCache = new Map<StoreId, { value: string; expiresAt: number }>();

export async function getAccessToken(store: StoreId): Promise<string> {
  const cached = tokenCache.get(store);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  const refreshToken = REFRESH_TOKENS[store];
  if (!refreshToken) throw new Error(`No refresh token for store ${store}`);

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    tokenCache.delete(store);
    throw new Error(`eBay token request failed for ${store} (${res.status}): ${body}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  tokenCache.set(store, {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  });
  return data.access_token;
}
