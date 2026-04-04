/**
 * Parses USPS NZCM Format2.txt into a compact JSON lookup.
 *
 * Input:  data/usps-zones/raw/Format2.txt
 *   - Line 1: effective date header (MMDDYYYY)
 *   - Lines 2+: one row per origin 3-digit ZIP prefix
 *     - Positions 1-3:    Origin 3-digit ZIP
 *     - Positions 4-2001: 999 destinations × (1 zone digit + 1 flag char)
 *     - Positions 2002+:  CRLF
 *
 * Output: src/data/usps-zones.json
 *   { effectiveDate: "YYYY-MM-DD", source: "...", zones: { "001": "888...", ... } }
 *   - Each value is a 999-char string where index (destPrefix - 1) is the zone digit.
 *   - Zone digit "0" means no assignment (treat as not-found at lookup time).
 *
 * Usage: npx tsx scripts/build-usps-zones.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const INPUT = resolve(process.cwd(), "data/usps-zones/raw/Format2.txt");
const OUTPUT = resolve(process.cwd(), "src/data/usps-zones.json");

function parseHeaderDate(line: string): string {
  // Format: "MMDDYYYY" followed by spaces
  const mm = line.slice(0, 2);
  const dd = line.slice(2, 4);
  const yyyy = line.slice(4, 8);
  if (!/^\d{2}$/.test(mm) || !/^\d{2}$/.test(dd) || !/^\d{4}$/.test(yyyy)) {
    throw new Error(`Invalid header date in Format2.txt: "${line.slice(0, 20)}"`);
  }
  return `${yyyy}-${mm}-${dd}`;
}

function main() {
  const raw = readFileSync(INPUT, "utf-8");
  // Handle both CRLF and LF line endings.
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error(`Expected header + data lines, got ${lines.length} lines`);
  }

  const effectiveDate = parseHeaderDate(lines[0]);
  console.log(`Effective date: ${effectiveDate}`);
  console.log(`Data rows: ${lines.length - 1}`);

  const zones: Record<string, string> = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // USPS rows are padded to 2001 chars; some may be slightly shorter.
    // We only need positions 1-2001.
    const origin = line.slice(0, 3);
    if (!/^\d{3}$/.test(origin)) {
      console.warn(`Skipping line ${i + 1}: invalid origin "${origin}"`);
      continue;
    }

    // Extract zone digits at positions 4, 6, 8, ... (0-indexed: 3, 5, 7, ...)
    // 999 destinations × 2 chars each = 1998 chars, starting at index 3.
    let zoneStr = "";
    for (let j = 0; j < 999; j++) {
      const pos = 3 + j * 2;
      const digit = line[pos] ?? "0";
      // Sanitize: zone is 0-9, anything else → treat as no-assignment "0".
      zoneStr += /^[0-9]$/.test(digit) ? digit : "0";
    }

    zones[origin] = zoneStr;
  }

  const payload = {
    effectiveDate,
    source: "USPS NZCM Format2.txt",
    generatedAt: new Date().toISOString(),
    originCount: Object.keys(zones).length,
    zones,
  };

  writeFileSync(OUTPUT, JSON.stringify(payload));
  const sizeKb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(0);
  console.log(`Wrote ${OUTPUT} (${sizeKb} KB, ${payload.originCount} origins)`);
}

main();
