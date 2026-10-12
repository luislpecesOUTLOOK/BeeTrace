import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  blendComposition,
  checkBlend,
  deductStock,
  drumsMatchTotal,
  isValidDrumId,
  isValidLotId,
  parseScannedText,
  qrPayloadFor,
} from '../src/lib/trace.ts';

describe('lot ids', () => {
  it('accepts BT-26-0412', () => assert.equal(isValidLotId('BT-26-0412'), true));
  it('rejects garbage', () => assert.equal(isValidLotId('honey-1'), false));
});

describe('qr parsing', () => {
  it('parses our payload', () => {
    assert.deepEqual(parseScannedText(qrPayloadFor('BT-26-0412')), {
      ok: true,
      lotId: 'BT-26-0412',
    });
  });
  it('parses our lot URL', () => {
    const r = parseScannedText('https://beetrace-five.vercel.app/lote/BT-26-0412');
    assert.deepEqual(r, { ok: true, lotId: 'BT-26-0412' });
  });
  it('rejects external urls without opening them', () => {
    const r = parseScannedText('https://evil.example/x');
    assert.equal(r.ok, false);
  });
  it('rejects empty input', () => {
    assert.deepEqual(parseScannedText('   '), { ok: false, reason: 'empty' });
  });
  it('accepts a hand-typed lot id', () => {
    assert.deepEqual(parseScannedText('bt-26-0007'), { ok: true, lotId: 'BT-26-0007' });
  });
});

describe('blends', () => {
  const stock = new Map([
    ['BT-26-0001', 100],
    ['BT-26-0002', 50],
  ]);
  const stockOf = (id) => stock.get(id) ?? 0;
  const countryOf = (id) => (id === 'BT-26-0001' ? 'España' : 'Portugal');

  it('computes total and composition', () => {
    const uses = [
      { lotId: 'BT-26-0001', kg: 60 },
      { lotId: 'BT-26-0002', kg: 40 },
    ];
    const check = checkBlend({ uses, stockOf });
    assert.equal(check.ok, true);
    assert.equal(check.totalKg, 100);
    assert.deepEqual(blendComposition(uses, countryOf), [
      { country: 'España', kg: 60, pct: 60 },
      { country: 'Portugal', kg: 40, pct: 40 },
    ]);
  });
  it('blocks kilos above stock', () => {
    const check = checkBlend({ uses: [{ lotId: 'BT-26-0002', kg: 51 }], stockOf });
    assert.equal(check.ok, false);
  });
  it('reports errors in English when asked', () => {
    const check = checkBlend({ uses: [{ lotId: 'BT-26-0002', kg: 51 }], stockOf }, 'en');
    assert.equal(check.ok, false);
    assert.match(check.errors.join(' '), /stock/i);
    assert.doesNotMatch(check.errors.join(' '), /Sin stock/);
  });
  it('blocks zero and negative kilos', () => {
    assert.equal(checkBlend({ uses: [{ lotId: 'BT-26-0001', kg: 0 }], stockOf }).ok, false);
    assert.equal(checkBlend({ uses: [{ lotId: 'BT-26-0001', kg: -5 }], stockOf }).ok, false);
  });
  it('deducts stock and floors at zero', () => {
    assert.equal(deductStock(100, 30), 70);
    assert.equal(deductStock(10, 10), 0);
  });
});

describe('drums', () => {
  it('matches total within tolerance', () => {
    assert.equal(drumsMatchTotal([{ id: 'A', weightKg: 120 }, { id: 'B', weightKg: 120 }], 240), true);
    assert.equal(drumsMatchTotal([{ id: 'A', weightKg: 100 }], 240), false);
  });
  it('validates drum ids', () => {
    assert.equal(isValidDrumId('BID-0412-01'), true);
    assert.equal(isValidDrumId(''), false);
  });
});
