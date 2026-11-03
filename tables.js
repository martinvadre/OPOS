const fail = (status, error) => ({ status, value: { error } });
const activeTables = data => (data.tables || []).filter(table => table.active !== false);
const groupIds = table => table.combinedTableIds || [];
const groupCapacity = (tables, table) => table.seats + tables.reduce((sum, member) => sum + (groupIds(table).includes(member.id) ? member.seats : 0), 0);

function tableState(data) {
  const tables = activeTables(data);
  const used = new Set(tables.map(table => table.position).filter(Number.isSafeInteger));
  let next = 0;
  const positioned = tables.map(table => {
    let position = table.position;
    if (position === undefined) {
      while (used.has(next)) next++;
      position = next++;
    }
    return { ...table, position };
  });
  const grid = data.tableGrid || { columns: 4, rows: Math.max(4, ...positioned.map(table => Math.floor(table.position / 4) + 1)) };
  return { restaurantEnabled: !!data.restaurantEnabled, tables: positioned, tableGrid: grid };
}
const validDetails = input => input && typeof input.name === 'string' && input.name.trim().length > 0 && input.name.trim().length <= 40 && Number.isSafeInteger(input.seats) && input.seats >= 1 && input.seats <= 100;
const validChairLayout = input => input.chairLayout === undefined || (
  Array.isArray(input.chairLayout) && input.chairLayout.length === 4 &&
  input.chairLayout.every(count => Number.isSafeInteger(count) && count >= 0 && count <= 100) &&
  input.chairLayout.reduce((sum, count) => sum + count, 0) === input.seats
);
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
  const tables = activeTables(data);
  const floor = tableState(data);
  const { columns, rows } = floor.tableGrid;
  const slots = columns * rows;
  if (route === 'tables/grid' && method === 'PUT') {
    const { columns: width, rows: height } = input || {};
    if (!Number.isInteger(width) || width < 1 || width > 12 || !Number.isInteger(height) || height < 1 || height > 50) {
      return fail(400, 'Choose 1–12 columns and 1–50 rows');
    }
    const positions = new Map();
    for (const table of floor.tables) {
      const row = Math.floor(table.position / columns);
      const column = table.position % columns;
      if (row >= height || column >= width) return fail(409, 'Move tables inside the new grid before resizing');
      positions.set(table.id, row * width + column);
    }
    for (const table of tables) table.position = positions.get(table.id);
    data.tableGrid = { columns: width, rows: height };
    return { status: 200, value: data.tableGrid, save: true };
  }
  const positionError = (position, id) => {
    if (input.gridColumns !== undefined && input.gridColumns !== columns) return fail(409, 'The grid changed. Refresh and try again.');
    if (position === undefined) return null;
    if (!Number.isSafeInteger(position) || position < 0 || position >= slots) return fail(400, 'Choose a valid floor position');
    if (floor.tables.some(table => table.id !== id && table.position === position)) return fail(409, 'That floor position is already in use');
    return null;
  };
  const savePositions = () => {
    const positions = new Map(floor.tables.map(table => [table.id, table.position]));
    for (const table of tables) table.position = positions.get(table.id);
  };
  const nameTaken = (name, id) => data.tables.some(table => table.active !== false && table.id !== id && table.name.toLowerCase() === name.trim().toLowerCase());
  if (route === 'tables' && method === 'POST') {
    if (!validDetails(input)) return fail(400, 'Enter a table name and 1–100 seats');
    if (tables.length >= slots) return fail(409, 'The grid is full. Enlarge it to add more tables');
    if (tables.length >= 100) return fail(400, 'A register can have up to 100 tables');
    if (nameTaken(input.name)) return fail(409, 'Table name already exists');
    const table = { id: Math.max(0, ...data.tables.map(table => table.id)) + 1, name: input.name.trim(), seats: input.seats, guests: 0, openedAt: null, order: [], version: 1, active: true };
    if (input.size !== undefined && !['M', '2M', 'L'].includes(input.size)) return fail(400, 'Choose a valid table size');
    if (!validChairLayout(input)) return fail(400, 'Choose a valid chair layout');
    if (input.rotation !== undefined && input.rotation !== 0 && input.rotation !== 90) return fail(400, 'Choose a valid table rotation');
    const invalidPosition = positionError(input.position);
    if (invalidPosition) return invalidPosition;
    savePositions();
    if (input.rotation !== undefined) table.rotation = input.rotation;
    if (input.size !== undefined) table.size = input.size;
    if (input.chairLayout !== undefined) table.chairLayout = [...input.chairLayout];
    table.position = input.position ?? table.position;
    if (table.position === undefined) {
      const used = new Set(tables.map(table => table.position));
      table.position = Array.from({ length: slots }, (_, index) => index).find(position => !used.has(position));
    }
    data.tables.push(table);
    return { status: 201, value: table, save: true };
  }
  const match = /^tables\/(\d+)$/.exec(route);
  const table = match && data.tables.find(table => table.id === Number(match[1]) && table.active !== false);
  if (!table) return fail(404, 'Table not found');
  if (tables.some(anchor => groupIds(anchor).includes(table.id))) return fail(409, 'Manage this table from its combined order');
  if (method === 'DELETE') {
    if (table.openedAt) return fail(409, 'Close the table before removing it');
    savePositions();
    table.active = false;
    return { status: 200, value: { ok: true }, save: true };
  }
  if (method !== 'PATCH') return fail(405, 'Method not allowed');
  if (!Number.isSafeInteger(input?.version) || input.version !== table.version) return fail(409, 'This table changed on another device. Reload its saved order and try again.');
  if (input.action === 'details') {
    if (!validDetails(input)) return fail(400, 'Enter a table name and 1–100 seats');
    if (nameTaken(input.name, table.id)) return fail(409, 'Table name already exists');
    if (groupIds(table).length) return fail(409, 'Close the combined table before editing it');
    if (input.size !== undefined && !['M', '2M', 'L'].includes(input.size)) return fail(400, 'Choose a valid table size');
    if (!validChairLayout(input)) return fail(400, 'Choose a valid chair layout');
    if (input.rotation !== undefined && input.rotation !== 0 && input.rotation !== 90) return fail(400, 'Choose a valid table rotation');
    const invalidPosition = positionError(input.position, table.id);
    if (invalidPosition) return invalidPosition;
    if (input.seats < table.guests) return fail(409, 'Seats cannot be fewer than the current guest count');
    savePositions();
    if (input.rotation !== undefined) table.rotation = input.rotation;
    if (input.size !== undefined) table.size = input.size;
    if (input.chairLayout !== undefined) table.chairLayout = [...input.chairLayout];
    table.position = input.position ?? table.position;
    if (input.chairLayout === undefined && table.seats !== input.seats) delete table.chairLayout;
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
  } else if (input.action === 'guests') {
    if (!table.openedAt) return fail(409, 'Open the table before changing guests');
    const capacity = groupCapacity(tables, table);
    if (!Number.isSafeInteger(input.guests) || input.guests < 1 || input.guests > capacity) return fail(400, `Enter 1–${capacity} guests`);
    table.guests = input.guests;
  } else if (input.action === 'combine') {
    const destination = tables.find(candidate => candidate.id === input.destinationId && candidate.id !== table.id);
    if (!destination || destination.version !== input.destinationVersion || tables.some(anchor => groupIds(anchor).includes(destination.id))) {
      return fail(409, 'Destination table changed. Refresh and try again.');
    }
    const capacity = groupCapacity(tables, table) + groupCapacity(tables, destination);
    const guests = table.openedAt || destination.openedAt ? table.guests + destination.guests : input.guests;
    if (!Number.isSafeInteger(guests) || guests < 1 || guests > capacity) return fail(400, `Enter 1–${capacity} guests`);
    const lines = new Map();
    for (const item of [...table.order, ...destination.order]) {
      const addons = [...item.addons].sort((a, b) => a - b);
      const key = JSON.stringify([item.id, addons]);
      const quantity = (lines.get(key)?.quantity || 0) + item.quantity;
      lines.set(key, { id: item.id, addons, quantity });
    }
    const order = [...lines.values()];
    if (!validItems(order)) return fail(409, 'The combined order has too many items');
    table.combinedTableIds = [...groupIds(table), destination.id, ...groupIds(destination)];
    table.guests = guests;
    table.openedAt = [table.openedAt, destination.openedAt].filter(Boolean).sort()[0] || new Date().toISOString();
    table.order = order;
    releaseTable(destination);
  } else if (input.action === 'move') {
    if (!table.openedAt) return fail(409, 'Open the table before moving it');
    if (!Number.isSafeInteger(input.destinationId) || !Number.isSafeInteger(input.destinationVersion)) return fail(400, 'Choose an available table');
    const destination = data.tables.find(candidate => candidate.id === input.destinationId && candidate.active !== false && candidate.id !== table.id);
    if (!destination || destination.openedAt || destination.version !== input.destinationVersion || tables.some(anchor => groupIds(anchor).includes(destination.id))) return fail(409, 'Destination table is no longer available. Refresh and try again.');
    if (destination.seats < table.guests) return fail(409, 'Destination table has too few seats');
    destination.guests = table.guests; destination.openedAt = table.openedAt; destination.order = table.order;
    destination.version += 1;
    releaseTable(table);
    return { status: 200, value: destination, save: true };
  } else if (input.action === 'close') {
    if (table.order.length) return fail(409, 'Check out or clear the saved order before closing this table');
    releaseTable(table);
    return { status: 200, value: table, save: true };
  } else return fail(400, 'Invalid table action');
  table.version += 1;
  return { status: 200, value: table, save: true };
}

function tableForSale(data, order) {
  if (order.tableId == null) return { table: null };
  if (!Number.isSafeInteger(order.tableId) || !Number.isSafeInteger(order.tableVersion)) return fail(400, 'Invalid table');
  const table = activeTables(data).find(table => table.id === order.tableId);
  if (!data.restaurantEnabled || !table?.openedAt) return fail(409, 'Table is no longer open');
  if (table.version !== order.tableVersion || JSON.stringify(table.order.map(item => [item.id, item.quantity, item.addons])) !== JSON.stringify(order.items.map(item => [item.id, item.quantity, item.addons]))) return fail(409, 'Table order changed. Reload and save it before checking out.');
  return { table };
}

function releaseTable(table) {
  if (table) { table.guests = 0; table.openedAt = null; table.order = []; delete table.combinedTableIds; table.version += 1; }
}

const productInOpenOrder = (data, id) => tableState(data).tables.some(table => table.openedAt && table.order.some(item => item.id === id));

module.exports = { tableState, tableMutation, tableForSale, releaseTable, productInOpenOrder };
