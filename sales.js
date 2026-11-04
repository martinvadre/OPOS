const { effectsOf, promotionDiscount } = require('./promotion');
const { tableForSale, releaseTable, validItems } = require('./tables');
const { deductStock } = require('./stock');
const { validPaymentCode, paymentAvailable } = require('./payment-methods');

function validSale(order) {
  return order && typeof order.requestId === 'string' && /^[a-f0-9-]{36}$/.test(order.requestId)
    && validPaymentCode(order.payment) && validItems(order.items) && order.items.length > 0
    && (order.payment !== 'cash' || (Number.isSafeInteger(order.received) && order.received >= 0))
    && (order.promotionId == null || Number.isSafeInteger(order.promotionId))
    && order.discount === undefined;
}

function recordSale(data, order, promptpayId) {
  const previous = data.sales.find(s => s.requestId === order.requestId);
  if (previous) return { status: 200, value: { id: previous.id, total: previous.total } };
  if (!paymentAvailable(data, promptpayId, order.payment)) return { status: 409, value: { error: 'Payment method unavailable. Refresh and try again.' } };
  const tableResult = tableForSale(data, order);
  if (tableResult.status) return tableResult;
  const table = tableResult.table;
  const items = [];
  const usage = new Map();
  for (const item of order.items) {
    const p = data.products.find(p => p.id === item.id && p.active);
    if (!p || p.hidden || item.addons.some(index => index >= (p.addons || []).length)) return { status: 409, value: { error: 'Product or add-on unavailable. Refresh and try again.' } };
    for (const line of p.recipe || []) {
      usage.set(line.stockId, (usage.get(line.stockId) || 0) + line.quantity * item.quantity);
    }
    const addons = item.addons.map(index => p.addons[index]);
    items.push({ id: p.id, name: p.name, category: p.category || '', price: p.price + addons.reduce((sum, addon) => sum + addon.price, 0), quantity: item.quantity, addons });
  }
  const subtotal = items.reduce((n, p) => n + p.price * p.quantity, 0);
  const promotion = order.promotionId == null ? null : (data.promotions || []).find(p => p.id === order.promotionId && p.active !== false && !p.hidden);
  if (order.promotionId != null && !promotion) return { status: 409, value: { error: 'Promotion unavailable. Refresh and try again.' } };
  const discount = promotionDiscount(promotion, items);
  if (!Number.isSafeInteger(subtotal) || discount > subtotal || ((promotion?.categories || promotion?.productIds) && discount === 0) || (order.payment === 'promptpay' && discount === subtotal)) return { status: 409, value: { error: 'Invalid discount' } };
  const total = subtotal - discount;
  if (order.payment === 'cash' && order.received < total) return { status: 409, value: { error: 'Insufficient payment' } };
  const id = data.sales.reduce((max, sale) => Math.max(max, sale.id), 0) + 1;
  data.sales.push({ id, table: table ? { id: table.id, name: table.name, guests: table.guests } : null, requestId: order.requestId, date: new Date().toISOString(), subtotal, discount, promotion: promotion ? { id: promotion.id, name: promotion.name, effects: effectsOf(promotion), categories: promotion.categories ?? null, productIds: promotion.productIds ?? null } : null, total, payment: order.payment, received: order.payment === 'cash' ? order.received : null, items });
  deductStock(data, usage);
  releaseTable(table);
  return { status: 201, value: { id, total }, save: true };
}

module.exports = { validSale, recordSale };
