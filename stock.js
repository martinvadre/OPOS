const units = ['pcs', 'ml', 'g', 'oz'];
const fail = (status, error) => ({ status, value: { error } });
const roundQuantity = value => Math.round(value * 1000) / 1000;
const validQuantity = (value, max) => Number.isFinite(value) && value > 0 && value <= max && value === roundQuantity(value);

function validRecipe(data, recipe) {
  if (recipe === undefined) return true;
  if (!Array.isArray(recipe) || recipe.length > 50) return false;
  const stock = new Map((data.stock || []).map(item => [item.id, item]));
  const seen = new Set();
  for (const line of recipe) {
    if (!line || !stock.has(line.stockId) || seen.has(line.stockId) || !validQuantity(line.quantity, 100000)) return false;
    const item = stock.get(line.stockId);
    if (item.unit === 'pcs' && !Number.isInteger(line.quantity)) return false;
    seen.add(line.stockId);
  }
  return true;
}

function stockMutation(data, route, input) {
  const stock = data.stock || [];
  if (!validQuantity(input?.quantity, 1000000000) || !Number.isSafeInteger(input.cost) || input.cost < 0 || input.cost > 100000000) {
    return fail(400, 'Enter a valid stock quantity and purchase cost');
  }

  const { quantity, cost } = input;
  if (route === 'stock') {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 100 || !units.includes(input.unit)) return fail(400, 'Enter a stock name and unit');
    if (stock.some(item => item.name.toLowerCase() === name.toLowerCase())) return fail(409, 'Stock item already exists');
    if (input.unit === 'pcs' && !Number.isInteger(quantity)) return fail(400, 'Enter a whole number of pieces');
    const item = {
      id: stock.reduce((max, item) => Math.max(max, item.id), 0) + 1,
      name, unit: input.unit, quantity, unitCost: cost / quantity, lastPurchase: { quantity, cost },
    };
    data.stock = [...stock, item];
    return { status: 201, value: item, save: true };
  }

  const id = Number(/^stock\/(\d+)\/restock$/.exec(route)?.[1]);
  const item = stock.find(item => item.id === id);
  if (!item) return fail(404, 'Stock item not found');
  if (item.unit === 'pcs' && !Number.isInteger(quantity)) return fail(400, 'Enter a whole number of pieces');
  const onHand = Math.max(0, item.quantity);
  item.unitCost = (onHand * item.unitCost + cost) / (onHand + quantity);
  item.quantity = roundQuantity(item.quantity + quantity);
  item.lastPurchase = { quantity, cost };
  return { status: 200, value: item, save: true };
}

function deductStock(data, usage) {
  for (const item of data.stock || []) {
    if (usage.has(item.id)) item.quantity = roundQuantity(item.quantity - usage.get(item.id));
  }
}

module.exports = { validRecipe, stockMutation, deductStock };
