/**
 * Local persistence layer (localStorage).
 *
 * HONESTY CONTRACT: this is on-device demo storage, NOT a server database.
 * There is no real authentication or server-side permission check here.
 * Every screen that uses this store shows the "modo local" banner.
 * The server migration path is documented in README-BACKEND.md.
 */
import {
  checkBlend,
  deductStock,
  isValidLotId,
  normalizeLotId,
  type ReceptionStatus,
} from './trace.ts';
import type { Lang } from './i18n.ts';

let storeLang: Lang = 'es';

export function setStoreLang(lang: Lang): void {
  storeLang = lang;
}

const STR = {
  es: {
    badLotId: 'Identificador de lote no válido.',
    lotExists: (id: string) => `El lote ${id} ya existe.`,
    lotMissing: (id: string) => `El lote ${id} no existe.`,
    recDone: (id: string, st: string) => `El lote ${id} ya tiene una recepción registrada (${st}).`,
    recDup: (id: string) => `El lote ${id} ya tiene una recepción registrada (duplicado bloqueado).`,
    recKg: 'La cantidad recibida debe ser mayor que 0.',
    originMissing: (id: string) => `Lote de origen ${id} no encontrado.`,
    drumRequired: 'Indica el bidón o depósito de la mezcla.',
    anaParam: 'Indica el parámetro analizado.',
    anaValue: 'Indica el valor o la conclusión.',
    anaMethod: 'Indica el método de análisis.',
    logCreated: (id: string) => `Lote ${id} creado`,
    logCreatedDetail: (kg: number, type: string) => `${kg} kg de ${type}.`,
    logRec: (id: string) => `Recepción de ${id}`,
    logRecDetail: (kg: number, sent: number, diff: number, st: string) =>
      `${kg} kg (enviados: ${sent} kg, diferencia: ${diff >= 0 ? '+' : ''}${diff} kg). Estado: ${st}.`,
    logBlend: (id: string) => `Mezcla ${id} confirmada`,
    logBlendDetail: (kg: number, n: number, drum: string) =>
      `${kg} kg desde ${n} lote(s) en ${drum}.`,
    logAna: (id: string) => `Análisis en ${id}`,
    logAnaDetail: (param: string, value: string, unit: string, method: string, screening: boolean) =>
      `${param}: ${value}${unit ? ' ' + unit : ''} (${method}, ${screening ? 'cribado' : 'confirmatorio'}).`,
    seedAction: 'Datos de demostración cargados',
    seedDetail: 'Lote BT-26-0412 de ejemplo. Tus lotes reales aparecen sin la marca «demo».',
    seedKeeper: 'Apícola La Rubia (demo)',
    seedFarm: 'Colmenar La Rubia',
    seedCountry: 'España',
    seedLocation: 'La Alcarria, Guadalajara',
    seedType: 'Romero',
    seedDoc: 'Análisis humedad (demo)',
  },
  en: {
    badLotId: 'Invalid lot identifier.',
    lotExists: (id: string) => `Lot ${id} already exists.`,
    lotMissing: (id: string) => `Lot ${id} does not exist.`,
    recDone: (id: string, st: string) => `Lot ${id} already has a registered reception (${st}).`,
    recDup: (id: string) => `Lot ${id} already has a registered reception (duplicate blocked).`,
    recKg: 'The received quantity must be greater than 0.',
    originMissing: (id: string) => `Source lot ${id} not found.`,
    drumRequired: 'Enter the blend drum or tank.',
    anaParam: 'Enter the analysed parameter.',
    anaValue: 'Enter the value or conclusion.',
    anaMethod: 'Enter the analysis method.',
    logCreated: (id: string) => `Lot ${id} created`,
    logCreatedDetail: (kg: number, type: string) => `${kg} kg of ${type}.`,
    logRec: (id: string) => `Reception of ${id}`,
    logRecDetail: (kg: number, sent: number, diff: number, st: string) =>
      `${kg} kg (shipped: ${sent} kg, difference: ${diff >= 0 ? '+' : ''}${diff} kg). Status: ${st}.`,
    logBlend: (id: string) => `Blend ${id} confirmed`,
    logBlendDetail: (kg: number, n: number, drum: string) =>
      `${kg} kg from ${n} lot(s) into ${drum}.`,
    logAna: (id: string) => `Analysis on ${id}`,
    logAnaDetail: (param: string, value: string, unit: string, method: string, screening: boolean) =>
      `${param}: ${value}${unit ? ' ' + unit : ''} (${method}, ${screening ? 'screening' : 'confirmatory'}).`,
    seedAction: 'Demo data loaded',
    seedDetail: 'Sample lot BT-26-0412. Your real lots appear without the “demo” tag.',
    seedKeeper: 'La Rubia Apiary (demo)',
    seedFarm: 'La Rubia Apiary',
    seedCountry: 'Spain',
    seedLocation: 'La Alcarria, Guadalajara',
    seedType: 'Rosemary',
    seedDoc: 'Moisture analysis (demo)',
  },
} satisfies Record<Lang, unknown> as Record<Lang, typeof STR.es>;

function S(): typeof STR.es {
  return STR[storeLang];
}

export type Role = 'apicultor' | 'envasadora';

export interface Profile {
  role: Role;
  name: string;
  org: string;
}

export interface DrumRec {
  id: string;
  weightKg: number;
}

export interface LotRec {
  id: string;
  kind: 'origen' | 'mezcla';
  beekeeper: string;
  farm: string;
  country: string;
  location: string;
  harvestDate: string;
  extractionDate: string;
  honeyType: string;
  totalKg: number;
  availableKg: number;
  drums: DrumRec[];
  docs: { name: string; note?: string }[];
  destCompany: string;
  shipDate: string;
  receptionStatus: ReceptionStatus;
  origins: { lotId: string; kg: number }[];
  demo?: boolean;
  createdAt: string;
  updatedAt: string;
  idemKeys: string[];
}

export interface ReceptionRec {
  id: string;
  lotId: string;
  date: string;
  kgReceived: number;
  responsible: string;
  notes: string;
  samples: string;
  status: 'pendiente-analisis' | 'aceptado' | 'rechazado';
  createdAt: string;
}

export interface AnalysisRec {
  id: string;
  lotId: string;
  param: string;
  value: string;
  unit: string;
  method: string;
  screening: boolean;
  date: string;
  sample: string;
  lab: string;
  responsible: string;
  reportName: string;
  createdAt: string;
}

export interface MovementRec {
  id: string;
  at: string;
  actor: string;
  role: Role | 'sistema';
  action: string;
  detail: string;
}

interface Db {
  version: 1;
  seq: number;
  lots: LotRec[];
  receptions: ReceptionRec[];
  analyses: AnalysisRec[];
  movements: MovementRec[];
}

const DB_KEY = 'beetrace.db.v1';
const PROFILE_KEY = 'beetrace.profile.v1';
const PENDING_SCAN_KEY = 'beetrace.pendingScan.v1';

function now(): string {
  return new Date().toISOString();
}

function uid(prefix: string): string {
  const r =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${r}`;
}

function seed(): Db {
  const t = now();
  const s = STR[storeLang];
  return {
    version: 1,
    seq: 413,
    lots: [
      {
        id: 'BT-26-0412',
        kind: 'origen',
        beekeeper: s.seedKeeper,
        farm: s.seedFarm,
        country: s.seedCountry,
        location: s.seedLocation,
        harvestDate: '2026-06-14',
        extractionDate: '2026-06-16',
        honeyType: s.seedType,
        totalKg: 240,
        availableKg: 240,
        drums: [
          { id: 'BID-0412-01', weightKg: 120 },
          { id: 'BID-0412-02', weightKg: 120 },
        ],
        docs: [{ name: s.seedDoc }],
        destCompany: '',
        shipDate: '',
        receptionStatus: 'no-enviado',
        origins: [],
        demo: true,
        createdAt: t,
        updatedAt: t,
        idemKeys: [],
      },
    ],
    receptions: [],
    analyses: [],
    movements: [
      {
        id: uid('mov'),
        at: t,
        actor: 'sistema',
        role: 'sistema',
        action: s.seedAction,
        detail: s.seedDetail,
      },
    ],
  };
}

function load(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      const db = seed();
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      return db;
    }
    const db = JSON.parse(raw) as Db;
    if (db.version !== 1 || !Array.isArray(db.lots)) return seed();
    return db;
  } catch {
    return seed();
  }
}

function save(db: Db): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function log(db: Db, actor: string, role: Role | 'sistema', action: string, detail: string): void {
  db.movements.unshift({ id: uid('mov'), at: now(), actor, role, action, detail });
}

export function getDb(): Db {
  return load();
}

export function getLot(id: string): LotRec | undefined {
  const db = load();
  return db.lots.find((l) => l.id === normalizeLotId(id));
}

export function listLots(): LotRec[] {
  return load().lots;
}

export function nextLotId(): string {
  const db = load();
  db.seq += 1;
  const id = `BT-26-${String(db.seq).padStart(4, '0')}`;
  save(db);
  return id;
}

export interface NewLotInput {
  id?: string;
  beekeeper: string;
  farm: string;
  country: string;
  location: string;
  harvestDate: string;
  extractionDate: string;
  honeyType: string;
  totalKg: number;
  drums: DrumRec[];
  docs: { name: string; note?: string }[];
  destCompany: string;
  shipDate: string;
}

export function createLot(input: NewLotInput, actor: Profile): LotRec {
  const id = input.id ? normalizeLotId(input.id) : nextLotId();
  if (!isValidLotId(id)) throw new Error(S().badLotId);
  const db = load();
  if (db.lots.some((l) => l.id === id)) throw new Error(S().lotExists(id));
  const t = now();
  const lot: LotRec = {
    id,
    kind: 'origen',
    beekeeper: input.beekeeper,
    farm: input.farm,
    country: input.country,
    location: input.location,
    harvestDate: input.harvestDate,
    extractionDate: input.extractionDate,
    honeyType: input.honeyType,
    totalKg: input.totalKg,
    availableKg: input.totalKg,
    drums: input.drums,
    docs: input.docs,
    destCompany: input.destCompany,
    shipDate: input.shipDate,
    receptionStatus: input.destCompany ? 'enviado' : 'no-enviado',
    origins: [],
    createdAt: t,
    updatedAt: t,
    idemKeys: [],
  };
  db.lots.unshift(lot);
  log(db, actor.name, actor.role, S().logCreated(id), S().logCreatedDetail(input.totalKg, input.honeyType));
  save(db);
  return lot;
}

export interface ReceptionInput {
  lotId: string;
  date: string;
  kgReceived: number;
  responsible: string;
  notes: string;
  samples: string;
  status: ReceptionRec['status'];
}

/** Registers a reception. Duplicate reception of the same lot is blocked. */
export function registerReception(input: ReceptionInput, actor: Profile): ReceptionRec {
  const lotId = normalizeLotId(input.lotId);
  const db = load();
  const lot = db.lots.find((l) => l.id === lotId);
  if (!lot) throw new Error(S().lotMissing(lotId));
  if (lot.receptionStatus === 'aceptado' || lot.receptionStatus === 'rechazado') {
    throw new Error(S().recDone(lotId, lot.receptionStatus));
  }
  if (db.receptions.some((r) => r.lotId === lotId)) {
    throw new Error(S().recDup(lotId));
  }
  if (!(input.kgReceived > 0)) throw new Error(S().recKg);
  const rec: ReceptionRec = {
    id: uid('rec'),
    lotId,
    date: input.date,
    kgReceived: input.kgReceived,
    responsible: input.responsible,
    notes: input.notes,
    samples: input.samples,
    status: input.status,
    createdAt: now(),
  };
  db.receptions.unshift(rec);
  lot.receptionStatus =
    input.status === 'aceptado'
      ? 'aceptado'
      : input.status === 'rechazado'
        ? 'rechazado'
        : 'pendiente-analisis';
  lot.updatedAt = now();
  const diff = Math.round((input.kgReceived - lot.totalKg) * 100) / 100;
  log(
    db,
    actor.name,
    actor.role,
    S().logRec(lotId),
    S().logRecDetail(input.kgReceived, lot.totalKg, diff, input.status),
  );
  save(db);
  return rec;
}

export interface BlendInput {
  uses: { lotId: string; kg: number }[];
  drumId: string;
  responsible: string;
  idemKey: string;
}

/**
 * Confirms a blend atomically: validates, deducts stock, creates the blend lot.
 * The idemKey makes retries safe: same key returns the already-created lot.
 */
export function confirmBlend(input: BlendInput, actor: Profile): { lot: LotRec; totalKg: number } {
  const db = load();
  const existing = db.lots.find((l) => l.kind === 'mezcla' && l.idemKeys.includes(input.idemKey));
  if (existing) return { lot: existing, totalKg: existing.totalKg };

  const stockOf = (lotId: string): number => {
    const l = db.lots.find((x) => x.id === normalizeLotId(lotId));
    if (!l) throw new Error(S().originMissing(lotId));
    return l.availableKg;
  };
  const check = checkBlend({ uses: input.uses, stockOf }, storeLang);
  if (!check.ok) throw new Error(check.errors.join(' '));
  if (!input.drumId.trim()) throw new Error(S().drumRequired);

  for (const u of input.uses) {
    const l = db.lots.find((x) => x.id === normalizeLotId(u.lotId));
    if (l) {
      l.availableKg = deductStock(l.availableKg, u.kg);
      l.updatedAt = now();
    }
  }

  const id = nextLotIdReload(db);
  const first = db.lots.find((x) => x.id === normalizeLotId(input.uses[0].lotId));
  const t = now();
  const lot: LotRec = {
    id,
    kind: 'mezcla',
    beekeeper: actor.org,
    farm: `Mezcla en ${input.drumId.trim()}`,
    country: 'Varios (ver composición)',
    location: actor.org,
    harvestDate: t.slice(0, 10),
    extractionDate: t.slice(0, 10),
    honeyType: 'Mezcla',
    totalKg: check.totalKg,
    availableKg: check.totalKg,
    drums: [{ id: input.drumId.trim(), weightKg: check.totalKg }],
    docs: [],
    destCompany: '',
    shipDate: '',
    receptionStatus: 'no-enviado',
    origins: input.uses.map((u) => ({ lotId: normalizeLotId(u.lotId), kg: u.kg })),
    createdAt: t,
    updatedAt: t,
    idemKeys: [input.idemKey],
  };
  void first;
  db.lots.unshift(lot);
  log(
    db,
    actor.name,
    actor.role,
    S().logBlend(id),
    S().logBlendDetail(check.totalKg, input.uses.length, input.drumId.trim()),
  );
  save(db);
  return { lot, totalKg: check.totalKg };
}

function nextLotIdReload(db: Db): string {
  db.seq += 1;
  return `BT-26-${String(db.seq).padStart(4, '0')}`;
}

export interface AnalysisInput {
  lotId: string;
  param: string;
  value: string;
  unit: string;
  method: string;
  screening: boolean;
  date: string;
  sample: string;
  lab: string;
  responsible: string;
  reportName: string;
}

export function addAnalysis(input: AnalysisInput, actor: Profile): AnalysisRec {
  const lotId = normalizeLotId(input.lotId);
  const db = load();
  const lot = db.lots.find((l) => l.id === lotId);
  if (!lot) throw new Error(S().lotMissing(lotId));
  if (!input.param.trim()) throw new Error(S().anaParam);
  if (!input.value.trim()) throw new Error(S().anaValue);
  if (!input.method.trim()) throw new Error(S().anaMethod);
  const rec: AnalysisRec = {
    id: uid('ana'),
    lotId,
    param: input.param.trim(),
    value: input.value.trim(),
    unit: input.unit.trim(),
    method: input.method.trim(),
    screening: input.screening,
    date: input.date,
    sample: input.sample.trim(),
    lab: input.lab.trim(),
    responsible: input.responsible.trim(),
    reportName: input.reportName.trim(),
    createdAt: now(),
  };
  db.analyses.unshift(rec);
  lot.updatedAt = now();
  log(
    db,
    actor.name,
    actor.role,
    S().logAna(lotId),
    S().logAnaDetail(rec.param, rec.value, rec.unit, rec.method, rec.screening),
  );
  save(db);
  return rec;
}

export function listReceptions(lotId?: string): ReceptionRec[] {
  const db = load();
  return lotId
    ? db.receptions.filter((r) => r.lotId === normalizeLotId(lotId))
    : db.receptions;
}

export function listAnalyses(lotId?: string): AnalysisRec[] {
  const db = load();
  return lotId
    ? db.analyses.filter((a) => a.lotId === normalizeLotId(lotId))
    : db.analyses;
}

export function listMovements(limit = 50): MovementRec[] {
  return load().movements.slice(0, limit);
}

/* ---- profile (local demo session, NOT real auth) ---- */

export function getProfile(): Profile | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export function setProfile(p: Profile): void {
  sessionStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export function clearProfile(): void {
  sessionStorage.removeItem(PROFILE_KEY);
}

export function setPendingScan(lotId: string): void {
  sessionStorage.setItem(PENDING_SCAN_KEY, lotId);
}

export function takePendingScan(): string | null {
  const v = sessionStorage.getItem(PENDING_SCAN_KEY);
  if (v) sessionStorage.removeItem(PENDING_SCAN_KEY);
  return v;
}
