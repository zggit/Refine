import { NextResponse } from "next/server";
import zoneData from "@/data/usps-zones.json";

type ZoneData = {
  effectiveDate: string;
  source: string;
  generatedAt: string;
  originCount: number;
  zones: Record<string, string>;
};

const data = zoneData as ZoneData;

function extractPrefix(zip: string): string | null {
  const trimmed = zip.trim();
  if (!/^\d{5}$/.test(trimmed)) return null;
  return trimmed.slice(0, 3);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const originParam = searchParams.get("origin") ?? "";
  const destParam = searchParams.get("dest") ?? "";

  const originPrefix = extractPrefix(originParam);
  const destPrefix = extractPrefix(destParam);

  if (!originPrefix || !destPrefix) {
    return NextResponse.json(
      { success: false, error: "ZIP 必须是 5 位数字" },
      { status: 400 },
    );
  }

  const row = data.zones[originPrefix];
  if (!row) {
    return NextResponse.json(
      { success: false, error: `起始 ZIP 前缀 ${originPrefix} 不在 USPS 矩阵中` },
      { status: 404 },
    );
  }

  const destIndex = parseInt(destPrefix, 10) - 1;
  const digit = row.charAt(destIndex);

  if (digit === "0" || digit === "") {
    return NextResponse.json(
      { success: false, error: `目的 ZIP 前缀 ${destPrefix} 在此矩阵中未分配区域` },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    zone: parseInt(digit, 10),
    originPrefix,
    destPrefix,
    effectiveDate: data.effectiveDate,
  });
}
