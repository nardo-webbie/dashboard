const INCOME_TYPES = new Set(['income', 'openIncome', 'estimateIncome']);
const COST_TYPES = new Set(['payable', 'openPayable', 'estimatePayable', 'fixedEstimatePayable']);

function val(x) {
  if (x == null) return null;
  if (typeof x === 'object') return x['#text'] ?? null;
  const s = String(x).trim();
  return s === '' ? null : s;
}

function numOrNull(x) {
  const v = val(x);
  if (v == null) return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Vertaalt één <o:order> element (na removeNSPrefix parsing) naar een plat record.
 * Bewust beperkt tot de velden die dashboard/AI nodig hebben — breid uit
 * zodra je meer detail wilt bewaren (bijv. volledige jobcosting-regels).
 */
function normalizeOrder(o) {
  const departure = o.departure || {};
  const destination = o.destination || {};
  const customer = o.customer?.partner || {};
  const shipperAddr = o.shipper?.address || {};
  const consigneeAddr = o.consignee?.address || {};

  let revenueEUR = 0;
  let costEUR = 0;
  const entries = o.jobcostingEntries?.jobcostingEntry || [];
  for (const e of entries) {
    const amountNode = e.amount;
    if (!amountNode) continue;
    const currency = typeof amountNode === 'object' ? amountNode['@_currency'] : null;
    const amount = numOrNull(amountNode);
    if (currency !== 'EUR' || amount == null) continue;
    const type = val(e.type);
    if (INCOME_TYPES.has(type)) revenueEUR += amount;
    if (COST_TYPES.has(type)) costEUR += amount;
  }

  return {
    identifier: val(o.identifier),
    number: val(o.number),
    lastModified: val(o.lastModified),
    orderDate: val(o.orderDate),
    module: val(o.module),
    conveyanceType: val(o.conveyanceType),
    clerk: val(o.clerk),
    cancelled: val(o.cancelled) === 'true',
    consolidated: val(o.consolidated) === 'true',
    dgr: val(o.dgr) === 'true',
    customerName: val(customer.name),
    customerCode: val(customer.code),
    shipperCountry: val(shipperAddr.country),
    consigneeCountry: val(consigneeAddr.country),
    departureName: val(departure.name),
    departureCountry: val(departure.country),
    destinationName: val(destination.name),
    destinationCountry: val(destination.country),
    incoTerms: val(o.incoTerms),
    pieces: numOrNull(o.pieces),
    grossWeight: numOrNull(o.grossWeight),
    chargeableWeight: numOrNull(o.chargeableWeight),
    volume: numOrNull(o.volume),
    natureOfGoods: val(o.natureOfGoods),
    revenueEUR: round2(revenueEUR),
    costEUR: round2(costEUR),
    syncedAt: new Date().toISOString(),
  };
}

module.exports = { normalizeOrder };
