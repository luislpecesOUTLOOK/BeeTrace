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
  return {
    version: 1,
    seq: 413,
    lots: [
      {
        id: 'BT-26-0412',
        kind: 'origen',
        beekeeper: 'Apícola La Rubia (demo)',
        farm: 'Colmenar La Rubia',
        country: 'España',
        location: 'La Alcarria, Guadalajara',
        harvestDate: '2026-06-14',
        extractionDate: '2026-06-16',
        honeyType: 'Romero',
        totalKg: 240,
        availableKg: 240,
        drums: [
          { id: 'BID-0412-01', weightKg: 120 },
          { id: 'BID-0412-02', weightKg: 120 },
        ],
        docs: [{ name: 'Análisis humedad (demo)' }],
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
        action: 'Datos de demostración cargados',
        detail: 'Lote BT-26-0412 de ejemplo. Tus lotes reales aparecen sin la marca «demo».',
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
  if (!isValidLotId(id)) throw new Error('Identificador de lote no válido.');
  const db = load();
  if (db.lots.some((l) => l.id === id)) throw new Error(`El lote ${id} ya existe.`);
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
  log(db, actor.name, actor.role, `Lote ${id} creado`, `${input.totalKg} kg de ${input.honeyType}.`);
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
  if (!lot) throw new Error(`El lote ${lotId} no existe.`);
  if (lot.receptionStatus === 'aceptado' || lot.receptionStatus === 'rechazado') {
    throw new Error(`El lote ${lotId} ya tiene una recepción registrada (${lot.receptionStatus}).`);
  }
  if (db.receptions.some((r) => r.lotId === lotId)) {
    throw new Error(`El lote ${lotId} ya tiene una recepción registrada (duplicado bloqueado).`);
  }
  if (!(input.kgReceived > 0)) throw new Error('La cantidad recibida debe ser mayor que 0.');
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
    `Recepción de ${lotId}`,
    `${input.kgReceived} kg (enviados: ${lot.totalKg} kg, diferencia: ${diff >= 0 ? '+' : ''}${diff} kg). Estado: ${input.status}.`,
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
    if (!l) throw new Error(`Lote de origen ${lotId} no encontrado.`);
    return l.availableKg;
  };
  const check = checkBlend({ uses: input.uses, stockOf });
  if (!check.ok) throw new Error(check.errors.join(' '));
  if (!input.drumId.trim()) throw new Error('Indica el bidón o depósito de la mezcla.');

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
    `Mezcla ${id} confirmada`,
    `${check.totalKg} kg desde ${input.uses.length} lote(s) en ${input.drumId.trim()}.`,
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
  if (!lot) throw new Error(`El lote ${lotId} no existe.`);
  if (!input.param.trim()) throw new Error('Indica el parámetro analizado.');
  if (!input.value.trim()) throw new Error('Indica el valor o la conclusión.');
  if (!input.method.trim()) throw new Error('Indica el método de análisis.');
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
    `Análisis en ${lotId}`,
    `${rec.param}: ${rec.value}${rec.unit ? ' ' + rec.unit : ''} (${rec.method}, ${rec.screening ? 'cribado' : 'confirmatorio'}).`,
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
