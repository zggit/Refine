import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = process.env.EBAY_CLIENT_ID!;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET!;
const RUNAME = process.env.EBAY_RUNAME ?? "Edward_Zhang-EdwardZh-Shippi-jfgya";
const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SCOPE = [
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
].join(" ");

// Step 1: GET /api/ebay/auth  → redirects to eBay consent page
export async function GET() {
  const url = new URL("https://auth.ebay.com/oauth2/authorize");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", RUNAME);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", "get-refresh-token");
  return NextResponse.redirect(url.toString());
}

// Step 2: POST /api/ebay/auth  → called with ?code=... after eBay redirects back
// eBay redirects to auth-accepted URL; we manually POST the code here
export async function POST(req: NextRequest) {
  const { code } = await req.json() as { code: string };
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: RUNAME,
    }),
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data);
}
