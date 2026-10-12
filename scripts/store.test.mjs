import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal browser shims for the store module.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => void mem.set(k, String(v)),
  removeItem: (k) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size;
  },
};
const ses = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (ses.has(k) ? ses.get(k) : null),
  setItem: (k, v) => void ses.set(k, String(v)),
  removeItem: (k) => void ses.delete(k),
  clear: () => ses.clear(),
  key: (i) => [...ses.keys()][i] ?? null,
  get length() {
    return ses.size;
  },
};

const { createLot, registerReception, confirmBlend, getLot, setStoreLang } = await import(
  '../src/lib/store.ts'
);

const actor = { role: 'apicultor', name: 'Test', org: 'Test Org' };
const packer = { role: 'envasadora', name: 'Pack', org: 'Pack S.L.' };

beforeEach(() => {
  mem.clear();
  ses.clear();
});

function makeLot(id, kg = 100) {
  return createLot(
    {
      id,
      beekeeper: 'A',
      farm: 'F',
      country: 'España',
      location: 'L',
      harvestDate: '2026-06-01',
      extractionDate: '2026-06-02',
      honeyType: 'Romero',
      totalKg: kg,
      drums: [{ id: `BID-${id}`, weightKg: kg }],
      docs: [],
      destCompany: 'Pack S.L.',
      shipDate: '2026-06-03',
    },
    actor,
  );
}

describe('receptions', () => {
  it('blocks duplicate reception of the same lot', () => {
    makeLot('BT-26-1001');
    registerReception(
      { lotId: 'BT-26-1001', date: '2026-06-05', kgReceived: 99, responsible: 'P', notes: '', samples: '', status: 'aceptado' },
      packer,
    );
    assert.throws(
      () =>
        registerReception(
          { lotId: 'BT-26-1001', date: '2026-06-06', kgReceived: 99, responsible: 'P', notes: '', samples: '', status: 'aceptado' },
          packer,
        ),
      /duplicado|ya tiene/i,
    );
  });
});

describe('language', () => {
  it('reports store errors in English when asked', () => {
    setStoreLang('en');
    makeLot('BT-26-5001');
    const input = (date) => ({
      lotId: 'BT-26-5001',
      date,
      kgReceived: 99,
      responsible: 'P',
      notes: '',
      samples: '',
      status: 'aceptado',
    });
    registerReception(input('2026-06-05'), packer);
    assert.throws(() => registerReception(input('2026-06-06'), packer), /already has/i);
    setStoreLang('es');
  });
});

describe('blends', () => {
  it('deducts stock and keeps origin traceability', () => {
    makeLot('BT-26-2001', 100);
    makeLot('BT-26-2002', 50);
    const { lot, totalKg } = confirmBlend(
      { uses: [{ lotId: 'BT-26-2001', kg: 60 }, { lotId: 'BT-26-2002', kg: 40 }], drumId: 'DEP-01', responsible: 'P', idemKey: 'k-1' },
      packer,
    );
    assert.equal(totalKg, 100);
    assert.equal(getLot('BT-26-2001').availableKg, 40);
    assert.equal(getLot('BT-26-2002').availableKg, 10);
    assert.deepEqual(lot.origins, [
      { lotId: 'BT-26-2001', kg: 60 },
      { lotId: 'BT-26-2002', kg: 40 },
    ]);
  });
  it('is idempotent on retry with the same key', () => {
    makeLot('BT-26-3001', 100);
    const first = confirmBlend(
      { uses: [{ lotId: 'BT-26-3001', kg: 10 }], drumId: 'DEP-02', responsible: 'P', idemKey: 'k-dup' },
      packer,
    );
    const second = confirmBlend(
      { uses: [{ lotId: 'BT-26-3001', kg: 10 }], drumId: 'DEP-02', responsible: 'P', idemKey: 'k-dup' },
      packer,
    );
    assert.equal(first.lot.id, second.lot.id);
    assert.equal(getLot('BT-26-3001').availableKg, 90);
  });
  it('blocks kilos above stock', () => {
    makeLot('BT-26-4001', 20);
    assert.throws(
      () =>
        confirmBlend(
          { uses: [{ lotId: 'BT-26-4001', kg: 21 }], drumId: 'DEP-03', responsible: 'P', idemKey: 'k-2' },
          packer,
        ),
      /stock/i,
    );
  });
});
