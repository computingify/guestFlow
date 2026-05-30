const test = require('node:test');
const assert = require('node:assert/strict');

const { entryToRows, buildRows, CSV_HEADERS } = require('../utils/accountingExport');
const { buildClientAccount } = require('../constants/accounting');

// Pure engine: encaissement entries → balanced double-entry journal rows.

function makeEntry(overrides = {}) {
  // Total TTC 200; encaissement 60 (deposit at 30 %); accommodation HT 181.82 + VAT 18.18 (10 %);
  // options HT 8.33 + VAT 1.67 (20 %). Pro-rated 30 % → debit 60 / Σ credits 60.
  return {
    reservationId: 42,
    kind: 'deposit',
    paidDate: '2026-08-15',
    client: { firstName: 'Jean', lastName: 'Dupont' },
    platform: 'direct',
    clientGrossAmount: null,
    finalPrice: 200,
    encaissementTtc: 60,
    fraction: 60 / 200,
    buckets: [
      { name: 'accommodation', ht: 181.82, vat: 18.18, ratePercent: 10 },
      { name: 'options',       ht:   8.33, vat:  1.67, ratePercent: 20 },
    ],
    ...overrides,
  };
}

function sumCredits(rows) {
  return rows.reduce((s, r) => s + (typeof r[6] === 'number' ? r[6] : 0), 0);
}

function debit(rows) {
  return rows.find((r) => typeof r[5] === 'number' && r[5] !== '')[5];
}

test('CSV_HEADERS are the agreed 10 columns in order', () => {
  assert.deepEqual(CSV_HEADERS, [
    'Jour', 'Mois', 'Année',
    'Compte', 'Libellé',
    'Débit', 'Crédit',
    'Plateforme', 'Prix payé client', 'Commission',
  ]);
});

test('one entry → 1 debit + N credits; Σ credits == debit (balanced)', () => {
  const rows = entryToRows(makeEntry());
  const totalCredits = Math.round(sumCredits(rows) * 100) / 100;
  assert.equal(totalCredits, debit(rows));
});

test('debit line uses the client auxiliary account C<NAME>; libellé is the client name', () => {
  const rows = entryToRows(makeEntry());
  const debitRow = rows[0];
  assert.equal(debitRow[3], buildClientAccount('Dupont')); // 'CDUPONX' (6 chars)
  assert.equal(debitRow[4], 'Jean Dupont');
});

test('revenue accounts: accommodation → 70600000; options → 70600010; resources → 70601000', () => {
  const e = makeEntry({
    buckets: [
      { name: 'accommodation', ht: 100, vat: 10, ratePercent: 10 },
      { name: 'options',       ht:  20, vat:  4, ratePercent: 20 },
      { name: 'resources',     ht:  10, vat:  2, ratePercent: 20 },
    ],
    encaissementTtc: 146,
    finalPrice: 146,
    fraction: 1,
  });
  const rows = entryToRows(e);
  const accounts = rows.map((r) => r[3]);
  assert.ok(accounts.includes('70600000'));
  assert.ok(accounts.includes('70600010'));
  assert.ok(accounts.includes('70601000'));
});

test('VAT account by rate: 10 % → 44571100, 20 % → 44571200', () => {
  const rows = entryToRows(makeEntry());
  const accounts = rows.map((r) => r[3]);
  assert.ok(accounts.includes('44571100')); // 10 %
  assert.ok(accounts.includes('44571200')); // 20 %
});

test('pro-rata: a 30 % deposit produces lines summing to 30 % of HT + VAT (within rounding)', () => {
  const rows = entryToRows(makeEntry()); // fraction = 0.30, debit = 60
  assert.equal(debit(rows), 60);
  const totalCredits = Math.round(sumCredits(rows) * 100) / 100;
  assert.equal(totalCredits, 60);
});

test('rounding residue: Σ credits is nudged to match debit exactly to the cent', () => {
  const tricky = makeEntry({
    encaissementTtc: 33.33,
    finalPrice: 100,
    fraction: 33.33 / 100,
    buckets: [
      { name: 'accommodation', ht: 90.91, vat: 9.09, ratePercent: 10 },
    ],
  });
  const rows = entryToRows(tricky);
  assert.equal(Math.round(sumCredits(rows) * 100) / 100, debit(rows));
});

test('platform info columns are filled only on the debit row, for non-direct only', () => {
  const platformEntry = makeEntry({
    platform: 'airbnb',
    clientGrossAmount: 240, // commission = 240 - 200 = 40
  });
  const rows = entryToRows(platformEntry);
  assert.equal(rows[0][7], 'airbnb');
  assert.equal(rows[0][8], 240);
  assert.equal(rows[0][9], 40);
  // Credit rows have empty platform info.
  for (let i = 1; i < rows.length; i++) {
    assert.equal(rows[i][7], '');
    assert.equal(rows[i][8], '');
    assert.equal(rows[i][9], '');
  }
});

test('direct booking → platform info columns empty even on the debit row', () => {
  const rows = entryToRows(makeEntry()); // direct
  assert.equal(rows[0][7], '');
  assert.equal(rows[0][8], '');
  assert.equal(rows[0][9], '');
});

test('buildRows concatenates multiple entries in order', () => {
  const a = makeEntry({ paidDate: '2026-08-15' });
  const b = makeEntry({ paidDate: '2026-08-20', reservationId: 99, encaissementTtc: 80, fraction: 0.4 });
  const rows = buildRows([a, b]);
  // First row is a's debit; somewhere later, b's debit appears.
  assert.equal(rows[0][2], 2026);
  assert.equal(rows[0][0], 15);
  assert.ok(rows.some((r) => r[0] === 20));
});

test('paidDate "YYYY-MM-DD" is split into day, month, year integers', () => {
  const rows = entryToRows(makeEntry({ paidDate: '2026-12-03' }));
  assert.equal(rows[0][0], 3);
  assert.equal(rows[0][1], 12);
  assert.equal(rows[0][2], 2026);
});

test('client account formatting: 6 chars uppercased, accent-stripped, padded with X if shorter', () => {
  assert.equal(buildClientAccount('Élise'),     'CELISEX'); // accent stripped, padded
  assert.equal(buildClientAccount('Müller'),    'CMULLER');
  assert.equal(buildClientAccount('Li'),        'CLIXXXX');
  assert.equal(buildClientAccount('Saint-Cyr'), 'CSAINTC'); // hyphen removed, 6 chars
  assert.equal(buildClientAccount(''),          'CXXXXXX');
  assert.equal(buildClientAccount(null),        'CXXXXXX');
});
