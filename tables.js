const fail = (status, error) => ({ status, value: { error } });
const tableState = data => ({ restaurantEnabled: !!data.restaurantEnabled, tables: (data.tables || []).filter(table => table.active !== false) });
const validDetails = input => input && typeof input.name === 'string' && input.name.trim().length > 0 && input.name.trim().length <= 40 && Number.isSafeInteger(input.seats) && input.seats >= 1 && input.seats <= 100;
const validItems = items => Array.isArray(items) && items.length <= 100 && items.every(item => item && Number.isSafeInteger(item.id) && Number.isSafeInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 10000 && Array.isArray(item.addons) && item.addons.length <= 20 && item.addons.every(index => Number.isSafeInteger(index) && index >= 0) && new Set(item.addons).size === item.addons.length);

function tableMutation(data, route, method, input) {
  if (route === 'restaurant' && method === 'PUT') {
    if (typeof input?.enabled !== 'boolean') return fail(400, 'Choose whether dine-in tables are enabled');
    if (!input.enabled && tableState(data).tables.some(table => table.openedAt)) return fail(409, 'Close all occupied tables before disabling dine-in');
    data.restaurantEnabled = input.enabled;
    return { status: 200, value: tableState(data), save: true };
  }
  if (!data.restaurantEnabled) return fail(409, 'Enable dine-in tables in Settings first');
  data.tables ||= [];
  const nameTaken = (name, id) => data.tables.some(table => table.active !== false && table.id !== id && table.name.toLowerCase() === name.trim().toLowerCase());
  if (route === 'tables' && method === 'POST') {
    if (!validDetails(input)) return fail(400, 'Enter a table name and 1–100 seats');
    if (tableState(data).tables.length >= 100) return fail(400, 'A register can have up to 100 tables');
    if (nameTaken(input.name)) return fail(409, 'Table name already exists');
    const table = { id: Math.max(0, ...data.tables.map(table => table.id)) + 1, name: input.name.trim(), seats: input.seats, guests: 0, openedAt: null, order: [], version: 1, active: true };
    data.tables.push(table);
    return { status: 201, value: table, save: true };
  }
  const match = /^tables\/(\d+)$/.exec(route);
  const table = match && data.tables.find(table => table.id === Number(match[1]) && table.active !== false);
  if (!table) return fail(404, 'Table not found');
  if (method === 'DELETE') {
    if (table.openedAt) return fail(409, 'Close the table before removing it');
    table.active = false;
    return { status: 200, value: { ok: true }, save: true };
  }
  if (method !== 'PATCH') return fail(405, 'Method not allowed');
  if (!Number.isSafeInteger(input?.version) || input.version !== table.version) return fail(409, 'This table changed on another device. Reload its saved order and try again.');
  if (input.action === 'details') {
    if (!validDetails(input)) return fail(400, 'Enter a table name and 1–100 seats');
    if (nameTaken(input.name, table.id)) return fail(409, 'Table name already exists');
    if (input.seats < table.guests) return fail(409, 'Seats cannot be fewer than the current guest count');
    table.name = input.name.trim(); table.seats = input.seats;
  } else if (input.action === 'open') {
    if (table.openedAt) return fail(409, 'Table is already occupied');
    if (!Number.isSafeInteger(input.guests) || input.guests < 1 || input.guests > table.seats) return fail(400, `Enter 1–${table.seats} guests`);
    table.guests = input.guests; table.openedAt = new Date().toISOString(); table.order = [];
  } else if (input.action === 'order') {
    if (!table.openedAt) return fail(409, 'Open the table before adding an order');
    if (!validItems(input.items)) return fail(400, 'Invalid table order');
    if (input.items.some(item => { const product = data.products.find(product => product.id === item.id && product.active && !product.hidden); return !product || item.addons.some(index => index >= (product.addons || []).length); })) return fail(409, 'Product or add-on unavailable. Refresh and try again.');
    table.order = input.items.map(item => ({ id: item.id, quantity: item.quantity, addons: item.addons }));
  } else if (input.action === 'close') {
    if (table.order.length) return fail(409, 'Check out or clear the saved order before closing this table');
    table.guests = 0; table.openedAt = null;
  } else return fail(400, 'Invalid table action');
  table.version += 1;
  return { status: 200, value: table, save: true };
}

function tableForSale(data, order) {
  if (order.tableId == null) return { table: null };
  if (!Number.isSafeInteger(order.tableId) || !Number.isSafeInteger(order.tableVersion)) return fail(400, 'Invalid table');
  const table = tableState(data).tables.find(table => table.id === order.tableId);
  if (!data.restaurantEnabled || !table?.openedAt) return fail(409, 'Table is no longer open');
  if (table.version !== order.tableVersion || JSON.stringify(table.order.map(item => [item.id, item.quantity, item.addons])) !== JSON.stringify(order.items.map(item => [item.id, item.quantity, item.addons]))) return fail(409, 'Table order changed. Reload and save it before checking out.');
  return { table };
}

function releaseTable(table) {
  if (table) { table.guests = 0; table.openedAt = null; table.order = []; table.version += 1; }
}

const productInOpenOrder = (data, id) => tableState(data).tables.some(table => table.openedAt && table.order.some(item => item.id === id));

module.exports = { tableState, tableMutation, tableForSale, releaseTable, productInOpenOrder };
