const CLIENT_ID = process.env.EBAY_CLIENT_ID!;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET!;
const REFRESH_TOKEN = process.env.EBAY_REFRESH_TOKEN!;

const SANDBOX = process.env.EBAY_SANDBOX === "true";
const BASE = SANDBOX ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
const TOKEN_URL = `${BASE}/identity/v1/oauth2/token`;

export { BASE };

// Cache access token in memory — survives across requests, resets on cold start
let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
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
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };
  return data.access_token;
}
