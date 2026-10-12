/** Pure, dependency-free traceability logic. Testable in Node. No DOM. */

export type LotKind = 'origen' | 'mezcla';
export type ReceptionStatus =
  | 'no-enviado'
  | 'enviado'
  | 'pendiente-analisis'
  | 'aceptado'
  | 'rechazado';

export interface Drum {
  id: string;
  weightKg: number;
}

export interface OriginUse {
  lotId: string;
  kg: number;
}

export interface CountryShare {
  country: string;
  kg: number;
  pct: number;
}

export interface BlendInput {
  uses: OriginUse[];
  stockOf: (lotId: string) => number;
}

/** Lot identifiers look like BT-26-0412 */
const LOT_RE = /^BT-\d{2}-\d{3,6}$/;

export function isValidLotId(id: string): boolean {
  return LOT_RE.test(id.trim().toUpperCase());
}

export function normalizeLotId(id: string): string {
  return id.trim().toUpperCase();
}

/**
 * QR payloads we generate: `BT1:<LOTID>`.
 * Also accepted: BeeTrace lot URLs like
 * https://beetrace-five.vercel.app/lote/BT-26-0412 or /lote?id=BT-26-0412.
 * Anything else is rejected: we never follow arbitrary external URLs.
 */
export type ScanParse =
  | { ok: true; lotId: string }
  | { ok: false; reason: 'empty' | 'foreign' | 'malformed-url' };

const OUR_HOSTS = new Set(['beetrace-five.vercel.app', 'localhost']);

export function parseScannedText(raw: string): ScanParse {
  const text = raw.trim();
  if (!text) return { ok: false, reason: 'empty' };

  const m1 = /^BT1:([A-Za-z0-9-]+)$/.exec(text);
  if (m1) {
    const id = normalizeLotId(m1[1]);
    return isValidLotId(id)
      ? { ok: true, lotId: id }
      : { ok: false, reason: 'foreign' };
  }

  if (/^https?:\/\//i.test(text)) {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      return { ok: false, reason: 'malformed-url' };
    }
    const host = url.hostname.toLowerCase();
    if (!OUR_HOSTS.has(host) && !host.endsWith('.vercel.app')) {
      return { ok: false, reason: 'foreign' };
    }
    const fromPath = /\/lote\/([A-Za-z0-9-]+)/.exec(url.pathname);
    const fromQuery = url.searchParams.get('id') ?? url.searchParams.get('lote');
    const candidate = fromPath?.[1] ?? fromQuery ?? '';
    const id = normalizeLotId(candidate);
    return isValidLotId(id)
      ? { ok: true, lotId: id }
      : { ok: false, reason: 'foreign' };
  }

  // Bare lot id typed by hand.
  const bare = normalizeLotId(text);
  return isValidLotId(bare)
    ? { ok: true, lotId: bare }
    : { ok: false, reason: 'foreign' };
}

export function qrPayloadFor(lotId: string): string {
  return `BT1:${normalizeLotId(lotId)}`;
}

export interface BlendCheck {
  ok: boolean;
  totalKg: number;
  errors: string[];
}

/** Validate a blend before confirming: positive kilos, within stock. */
export function checkBlend(input: BlendInput, lang: 'es' | 'en' = 'es'): BlendCheck {
  const errors: string[] = [];
  if (input.uses.length === 0)
    errors.push(lang === 'en' ? 'Select at least one source lot.' : 'Selecciona al menos un lote de origen.');
  let total = 0;
  for (const u of input.uses) {
    if (!(u.kg > 0)) {
      errors.push(
        lang === 'en'
          ? `Invalid quantity in lot ${u.lotId}: it must be greater than 0.`
          : `Cantidad no válida en lote ${u.lotId}: debe ser mayor que 0.`,
      );
      continue;
    }
    const stock = input.stockOf(u.lotId);
    if (u.kg - stock > 1e-9) {
      errors.push(
        lang === 'en'
          ? `Not enough stock in ${u.lotId}: asking for ${u.kg} kg, available ${stock} kg.`
          : `Sin stock suficiente en ${u.lotId}: pides ${u.kg} kg y hay ${stock} kg.`,
      );
    }
    total += u.kg;
  }
  return { ok: errors.length === 0, totalKg: round2(total), errors };
}

/** Country composition from the kilos taken of each origin lot. */
export function blendComposition(
  uses: OriginUse[],
  countryOf: (lotId: string) => string,
): CountryShare[] {
  const byCountry = new Map<string, number>();
  let total = 0;
  for (const u of uses) {
    byCountry.set(countryOf(u.lotId), (byCountry.get(countryOf(u.lotId)) ?? 0) + u.kg);
    total += u.kg;
  }
  if (total <= 0) return [];
  return [...byCountry.entries()]
    .map(([country, kg]) => ({ country, kg: round2(kg), pct: round2((kg / total) * 100) }))
    .sort((a, b) => b.kg - a.kg);
}

/** New available stock after deducting used kilos. Never negative. */
export function deductStock(stock: number, used: number): number {
  return Math.max(0, round2(stock - used));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Sum of drum weights must match the lot total (tolerance 0.01 kg). */
export function drumsMatchTotal(drums: Drum[], totalKg: number): boolean {
  const sum = drums.reduce((acc, d) => acc + (Number(d.weightKg) || 0), 0);
  return Math.abs(sum - totalKg) < 0.01;
}

const DRUM_RE = /^[A-Za-z0-9][A-Za-z0-9-]{1,23}$/;

export function isValidDrumId(id: string): boolean {
  return DRUM_RE.test(id.trim());
}
