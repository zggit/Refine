const TRADING_API = "https://api.ebay.com/ws/api.dll";

export async function tradingApiCall(callName: string, body: string, token: string): Promise<string> {
  const res = await fetch(TRADING_API, {
    method: "POST",
    headers: {
      "X-EBAY-API-SITEID": "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1271",
      "X-EBAY-API-CALL-NAME": callName,
      "X-EBAY-API-IAF-TOKEN": token,
      "Content-Type": "text/xml",
    },
    body,
    cache: "no-store",
  });
  return res.text();
}

export function xmlText(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`);
  const m = xml.match(re);
  return m ? m[1] : null;
}

export function toOz(major: string | null, minor: string | null): number {
  return parseInt(major ?? "0", 10) * 16 + parseInt(minor ?? "0", 10);
}
