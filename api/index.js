const crypto = require('node:crypto');
const { Pool } = require('pg');
const promptpayPayload = require('promptpay-qr');
const QRCode = require('qrcode');
const { effectsOf, promotionFields, validPromotion, promotionProductsAvailable, promotionDiscount } = require('../promotion');
const { tableState, tableMutation, tableForSale, releaseTable, productInOpenOrder } = require('../tables');
const { manualPayments, promptpayEnabled, validManualPayments, validPaymentCode, paymentAvailable } = require('../payment-methods');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, idleTimeoutMillis: 10000 });
const send = (res, status, value) => { res.status(status); res.setHeader('Cache-Control', 'no-store'); return res.json(value); };
const hash = token => crypto.createHash('sha256').update(token).digest('hex');
function checkPassword(password, stored) {
  const [salt, passwordHash] = stored.split(':');
  if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(passwordHash || '')) throw new Error('Invalid password hash');
  return crypto.timingSafeEqual(Buffer.from(passwordHash, 'hex'), crypto.scryptSync(password, salt, 64));
}
function hashPassword(password) { const salt = crypto.randomBytes(16).toString('hex'); return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`; }
const products = data => data.products.filter(p => p.active).map(({ id, name, price, image, addons, hidden, category, priority }) => ({ id, name, price, category: category || '', priority: priority || 'medium', image: image || '', addons: addons || [], hidden: !!hidden })).sort((a, b) => a.name.localeCompare(b.name));
// shortcut: send full history for one register; paginate if sales volume makes state slow.
const sales = data => data.sales.slice().reverse().map(({ requestId, ...sale }) => sale);
const validAddons = addons => Array.isArray(addons) && addons.length <= 20 && addons.every(a => a && typeof a.name === 'string' && a.name.trim().length > 0 && a.name.trim().length <= 80 && Number.isSafeInteger(a.price) && a.price >= 0 && a.price <= 100000000);
const validProduct = p => p && typeof p.name === 'string' && p.name.trim().length > 0 && p.name.trim().length <= 120 && Number.isSafeInteger(p.price) && p.price >= 0 && p.price <= 100000000 && validAddons(p.addons) && (p.category === undefined || (typeof p.category === 'string' && p.category.trim().length <= 60)) && (p.priority === undefined || ['high', 'medium', 'low'].includes(p.priority)) && (p.image === undefined || (typeof p.image === 'string' && p.image.length <= 2000000));

async function body(req) {
  const value = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
  const raw = typeof value === 'string' ? value : JSON.stringify(value ?? {});
  if (Buffer.byteLength(raw) > 2500000) throw new Error('Request too large');
  return typeof value === 'string' ? JSON.parse(value || '{}') : value ?? {};
}

async function mutate(accountId, change) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT payload FROM pos_state WHERE id = $1 FOR UPDATE', [accountId]);
    if (!rows.length) { await client.query('COMMIT'); return { status: 503, value: { error: 'Database not initialized' } }; }
    const data = rows[0].payload;
    const result = change(data);
    if (result.save) await client.query('UPDATE pos_state SET payload = $1 WHERE id = $2', [data, accountId]);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

async function login(req, res) {
  const input = await body(req);
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').slice(0, 128);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO pos_login_attempts (ip, attempts, reset_at) VALUES ($1, 0, NOW() + INTERVAL \'1 minute\') ON CONFLICT DO NOTHING', [ip]);
    const { rows } = await client.query('SELECT attempts, reset_at FROM pos_login_attempts WHERE ip = $1 FOR UPDATE', [ip]);
    const attempts = new Date(rows[0].reset_at).getTime() > Date.now() ? rows[0].attempts : 0;
    if (attempts >= 5) { await client.query('COMMIT'); return send(res, 429, { error: 'Too many attempts. Wait a minute.' }); }
    const saved = await client.query('SELECT id, username, password_hash FROM pos_credentials WHERE lower(username) = lower($1)', [typeof input.username === 'string' ? input.username.trim() : '']);
    const username = typeof input.username === 'string' ? input.username.trim() : '';
    const password = typeof input.password === 'string' && input.password.length <= 1024 ? input.password : '';
    if (!saved.rowCount || username.toLowerCase() !== saved.rows[0].username.toLowerCase() || !checkPassword(password, saved.rows[0].password_hash)) {
      await client.query('UPDATE pos_login_attempts SET attempts = $2, reset_at = NOW() + INTERVAL \'1 minute\' WHERE ip = $1', [ip, attempts + 1]);
      await client.query('COMMIT');
      return send(res, 401, { error: 'Wrong password' });
    }
    await client.query('DELETE FROM pos_login_attempts WHERE ip = $1', [ip]);
    const token = crypto.randomBytes(32).toString('hex');
    await client.query('INSERT INTO pos_sessions (token_hash, expires_at, account_id) VALUES ($1, NOW() + INTERVAL \'12 hours\', $2)', [hash(token), saved.rows[0].id]);
    await client.query('COMMIT');
    res.setHeader('Set-Cookie', `pos_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`);
    return send(res, 200, { ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

async function signup(req, res) {
  const input = await body(req);
  const username = typeof input.username === 'string' ? input.username.trim() : '';
  const password = input.password;
  if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) return send(res, 400, { error: 'Username must be 3–50 letters, numbers, dots, dashes, or underscores' });
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024) return send(res, 400, { error: 'Password must be 12–1024 characters' });
  const ip = `signup:${String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').slice(0, 121)}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO pos_login_attempts (ip, attempts, reset_at) VALUES ($1, 0, NOW() + INTERVAL \'1 minute\') ON CONFLICT DO NOTHING', [ip]);
    const { rows } = await client.query('SELECT attempts, reset_at FROM pos_login_attempts WHERE ip = $1 FOR UPDATE', [ip]);
    const attempts = new Date(rows[0].reset_at).getTime() > Date.now() ? rows[0].attempts : 0;
    if (attempts >= 3) { await client.query('COMMIT'); return send(res, 429, { error: 'Too many sign-ups. Wait a minute.' }); }
    await client.query('UPDATE pos_login_attempts SET attempts = $2, reset_at = NOW() + INTERVAL \'1 minute\' WHERE ip = $1', [ip, attempts + 1]);
    const account = await client.query('INSERT INTO pos_credentials (username, password_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id', [username, hashPassword(password)]);
    if (!account.rowCount) { await client.query('COMMIT'); return send(res, 409, { error: 'Username already exists' }); }
    await client.query('INSERT INTO pos_state (id, payload) VALUES ($1, $2)', [account.rows[0].id, { products: [], sales: [], promotions: [] }]);
    const token = crypto.randomBytes(32).toString('hex');
    await client.query('INSERT INTO pos_sessions (token_hash, expires_at, account_id) VALUES ($1, NOW() + INTERVAL \'12 hours\', $2)', [hash(token), account.rows[0].id]);
    await client.query('COMMIT');
    res.setHeader('Set-Cookie', `pos_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`);
    return send(res, 201, { ok: true });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

module.exports = async function handler(req, res) {
  try {
    if (!process.env.DATABASE_URL) return send(res, 503, { error: 'Database not configured' });
    const origin = req.headers.origin;
    if (!['GET', 'HEAD'].includes(req.method) && origin && origin !== `https://${req.headers.host}`) return send(res, 403, { error: 'Invalid origin' });
    const route = String(req.query.path || '').replace(/^\/+/, '');
    if (route === 'login' && req.method === 'POST') return await login(req, res);
    if (route === 'signup' && req.method === 'POST') return await signup(req, res);
    const token = /(?:^|; )pos_session=([a-f0-9]{64})/.exec(req.headers.cookie || '')?.[1];
    const session = token && await pool.query('SELECT account_id FROM pos_sessions WHERE token_hash = $1 AND expires_at > NOW()', [hash(token)]);
    if (!session?.rowCount) return send(res, 401, { error: 'Sign in to continue' });
    const accountId = session.rows[0].account_id;
    if (route === 'logout' && req.method === 'POST') {
      await pool.query('DELETE FROM pos_sessions WHERE token_hash = $1', [hash(token)]);
      res.setHeader('Set-Cookie', 'pos_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
      return send(res, 200, { ok: true });
    }
    if (route === 'settings' && req.method === 'GET') {
      const { rows } = await pool.query('SELECT c.username, c.promptpay_id, s.payload FROM pos_credentials c JOIN pos_state s ON s.id = c.id WHERE c.id = $1', [accountId]);
      return rows.length ? send(res, 200, { username: rows[0].username, promptpayId: rows[0].promptpay_id || '', promptpayEnabled: promptpayEnabled(rows[0].payload, rows[0].promptpay_id), manualPayments: manualPayments(rows[0].payload) }) : send(res, 503, { error: 'Login not configured' });
    }
    if (route === 'settings' && req.method === 'PUT') {
      const input = await body(req);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT username, password_hash, promptpay_id FROM pos_credentials WHERE id = $1 FOR UPDATE', [accountId]);
        if (!rows.length) { await client.query('COMMIT'); return send(res, 503, { error: 'Login not configured' }); }
        const username = typeof input.username === 'string' ? input.username.trim() : rows[0].username;
        if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) { await client.query('COMMIT'); return send(res, 400, { error: 'Username must be 3–50 letters, numbers, dots, dashes, or underscores' }); }
        if (input.promptpayEnabled !== undefined && typeof input.promptpayEnabled !== 'boolean') { await client.query('COMMIT'); return send(res, 400, { error: 'Choose whether PromptPay is enabled' }); }
        if (input.manualPayments !== undefined && !validManualPayments(input.manualPayments)) { await client.query('COMMIT'); return send(res, 400, { error: 'Enter up to 8 unique payment names of 1–30 characters' }); }
        const promptpayId = input.promptpayId === undefined ? rows[0].promptpay_id : input.promptpayId;
        if (promptpayId !== null && promptpayId !== '' && (typeof promptpayId !== 'string' || !/^(0\d{9}|\d{13})$/.test(promptpayId))) { await client.query('COMMIT'); return send(res, 400, { error: 'Enter a 10-digit phone or 13-digit PromptPay ID' }); }
        const state = await client.query('SELECT payload FROM pos_state WHERE id = $1 FOR UPDATE', [accountId]);
        if (!state.rowCount) { await client.query('COMMIT'); return send(res, 503, { error: 'Database not initialized' }); }
        const data = state.rows[0].payload;
        if (input.promptpayEnabled !== undefined) data.promptpayEnabled = input.promptpayEnabled;
        if (input.manualPayments !== undefined) data.manualPayments = input.manualPayments.map(name => name.trim());
        if (input.promptpayId !== undefined && !promptpayEnabled(data, rows[0].promptpay_id)) { await client.query('COMMIT'); return send(res, 409, { error: 'Enable PromptPay before setting its ID' }); }
        let passwordHash = rows[0].password_hash;
        if (input.newPassword !== undefined) {
          if (typeof input.currentPassword !== 'string' || !checkPassword(input.currentPassword, passwordHash)) { await client.query('COMMIT'); return send(res, 403, { error: 'Current password is incorrect' }); }
          if (typeof input.newPassword !== 'string' || input.newPassword.length < 12 || input.newPassword.length > 1024) { await client.query('COMMIT'); return send(res, 400, { error: 'New password must be 12–1024 characters' }); }
          passwordHash = hashPassword(input.newPassword);
        }
        await client.query('UPDATE pos_credentials SET username = $1, password_hash = $2, promptpay_id = $3 WHERE id = $4', [username, passwordHash, promptpayId || null, accountId]);
        if (input.promptpayEnabled !== undefined || input.manualPayments !== undefined) await client.query('UPDATE pos_state SET payload = $1 WHERE id = $2', [data, accountId]);
        if (input.newPassword !== undefined) await client.query('DELETE FROM pos_sessions WHERE account_id = $1 AND token_hash <> $2', [accountId, hash(token)]);
        await client.query('COMMIT');
        return send(res, 200, { username, promptpayId: promptpayId || '', promptpayEnabled: promptpayEnabled(data, promptpayId), manualPayments: manualPayments(data) });
      } catch (error) { await client.query('ROLLBACK'); if (error.code === '23505') return send(res, 409, { error: 'Username already exists' }); throw error; } finally { client.release(); }
    }
    if (route === 'state' && req.method === 'GET') {
      const { rows } = await pool.query('SELECT s.payload, c.promptpay_id FROM pos_state s JOIN pos_credentials c ON c.id = s.id WHERE s.id = $1', [accountId]);
      return rows.length ? send(res, 200, { accountId, ...tableState(rows[0].payload), promptpayEnabled: promptpayEnabled(rows[0].payload, rows[0].promptpay_id), promptpayConfigured: promptpayEnabled(rows[0].payload, rows[0].promptpay_id) && !!rows[0].promptpay_id, manualPayments: manualPayments(rows[0].payload), products: products(rows[0].payload), sales: sales(rows[0].payload), promotions: (rows[0].payload.promotions || []).filter(p => p.active !== false) }) : send(res, 503, { error: 'Database not initialized' });
    }
    if (route === 'promptpay' && req.method === 'GET') {
      const amount = Number(req.query.amount);
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000000) return send(res, 400, { error: 'Invalid PromptPay amount' });
      const paymentSettings = (await pool.query('SELECT c.promptpay_id, s.payload FROM pos_credentials c JOIN pos_state s ON s.id = c.id WHERE c.id = $1', [accountId])).rows[0];
      const recipient = paymentSettings?.promptpay_id || '';
      if (!paymentSettings || !promptpayEnabled(paymentSettings.payload, recipient)) return send(res, 409, { error: 'Enable PromptPay in Settings first' });
      if (!/^(0\d{9}|\d{13})$/.test(recipient)) return send(res, 503, { error: 'PromptPay recipient not configured' });
      return send(res, 200, { qr: await QRCode.toDataURL(promptpayPayload(recipient, { amount: amount / 100 }), { width: 280, margin: 2 }) });
    }
    if (((route === 'restaurant' || route === 'tables/grid') && req.method === 'PUT') || ((route === 'tables' || /^tables\/\d+$/.test(route)) && ['POST', 'PATCH', 'DELETE'].includes(req.method))) {
      const input = await body(req);
      const result = await mutate(accountId, data => tableMutation(data, route, req.method, input));
      return send(res, result.status, result.value);
    }
    if (route === 'promotions' && req.method === 'POST') {
      const input = await body(req);
      if (!validPromotion(input)) return send(res, 400, { error: 'Enter a valid promotion name and value' });
      const result = await mutate(accountId, data => {
        if (!promotionProductsAvailable(input, data.products)) return { status: 400, value: { error: 'Selected category or add-on unavailable' } };
        data.promotions ||= [];
        const id = Math.max(0, ...data.promotions.map(p => p.id)) + 1;
        data.promotions.push({ id, ...promotionFields(input), active: true, hidden: false });
        return { status: 201, value: { id }, save: true };
      });
      return send(res, result.status, result.value);
    }
    const promotionMatch = /^promotions\/(\d+)$/.exec(route);
    if (promotionMatch && req.method === 'PUT') {
      const input = await body(req);
      if (!validPromotion(input)) return send(res, 400, { error: 'Enter a valid promotion' });
      const result = await mutate(accountId, data => {
        const promotion = (data.promotions || []).find(p => p.id === Number(promotionMatch[1]) && p.active !== false);
        if (!promotion) return { status: 404, value: { error: 'Promotion not found' } };
        if (!promotionProductsAvailable(input, data.products)) return { status: 400, value: { error: 'Selected category or add-on unavailable' } };
        Object.assign(promotion, promotionFields(input));
        delete promotion.type;
        delete promotion.value;
        return { status: 200, value: { ok: true }, save: true };
      });
      return send(res, result.status, result.value);
    }
    if (promotionMatch && req.method === 'PATCH') {
      const input = await body(req);
      if (typeof input.hidden !== 'boolean') return send(res, 400, { error: 'Invalid visibility' });
      const result = await mutate(accountId, data => {
        const promotion = (data.promotions || []).find(p => p.id === Number(promotionMatch[1]) && p.active !== false);
        if (!promotion) return { status: 404, value: { error: 'Promotion not found' } };
        promotion.hidden = input.hidden;
        return { status: 200, value: { ok: true }, save: true };
      });
      return send(res, result.status, result.value);
    }
    if (promotionMatch && req.method === 'DELETE') {
      const result = await mutate(accountId, data => {
        const promotion = (data.promotions || []).find(p => p.id === Number(promotionMatch[1]) && p.active !== false);
        if (!promotion) return { status: 404, value: { error: 'Promotion not found' } };
        promotion.active = false;
        return { status: 200, value: { ok: true }, save: true };
      });
      return send(res, result.status, result.value);
    }
    if (route === 'products/import' && req.method === 'POST') {
      const { parseMenuCsv, importMenuItems } = await import('../menu-import.mjs');
      const payload = await body(req);
      let items;
      try { items = parseMenuCsv(payload?.csv); } catch (error) { return send(res, 400, { error: error.message }); }
      const result = await mutate(accountId, data => {
        const value = importMenuItems(data, items);
        return { status: 200, value, save: value.added > 0 };
      });
      return send(res, result.status, result.value);
    }
    if (route === 'products' && req.method === 'POST') {
      const p = await body(req);
      if (!validProduct(p)) return send(res, 400, { error: 'Enter a valid product and add-ons' });
      const result = await mutate(accountId, data => {
        const id = Math.max(0, ...data.products.map(p => p.id)) + 1;
        data.products.push({ id, name: p.name.trim(), price: p.price, priority: p.priority || 'medium', addons: p.addons.map(a => ({ name: a.name.trim(), price: a.price })), category: p.category?.trim() || '', image: typeof p.image === 'string' ? p.image : '', active: true, hidden: false });
        return { status: 201, value: { id }, save: true };
      });
      return send(res, result.status, result.value);
    }
    const match = /^products\/(\d+)$/.exec(route);
    if (match && req.method === 'PUT') {
      const p = await body(req);
      if (!validProduct(p)) return send(res, 400, { error: 'Enter a valid product and add-ons' });
      const result = await mutate(accountId, data => {
        const current = data.products.find(p => p.id === Number(match[1]) && p.active);
        if (!current) return { status: 404, value: { error: 'Product not found' } };
        if (productInOpenOrder(data, current.id)) return { status: 409, value: { error: 'Finish open table orders before changing this product' } };
        Object.assign(current, { name: p.name.trim(), price: p.price, addons: p.addons.map(a => ({ name: a.name.trim(), price: a.price })), ...(p.category !== undefined ? { category: p.category.trim() } : {}), ...(p.priority !== undefined ? { priority: p.priority } : {}), ...(p.image !== undefined ? { image: p.image } : {}) });
        return { status: 200, value: { ok: true }, save: true };
      });
      return send(res, result.status, result.value);
    }
    if (match && req.method === 'DELETE') {
      const result = await mutate(accountId, data => {
        const current = data.products.find(p => p.id === Number(match[1]) && p.active);
        if (!current) return { status: 404, value: { error: 'Product not found' } };
        if (productInOpenOrder(data, current.id)) return { status: 409, value: { error: 'Finish open table orders before changing this product' } };
        current.active = false;
        return { status: 200, value: { ok: true }, save: true };
      });
      return send(res, result.status, result.value);
    }
    if (match && req.method === 'PATCH') {
      const input = await body(req);
      if (typeof input.hidden !== 'boolean') return send(res, 400, { error: 'Invalid visibility' });
      const result = await mutate(accountId, data => {
        const current = data.products.find(p => p.id === Number(match[1]) && p.active);
        if (!current) return { status: 404, value: { error: 'Product not found' } };
        if (productInOpenOrder(data, current.id)) return { status: 409, value: { error: 'Finish open table orders before changing this product' } };
        current.hidden = input.hidden;
        return { status: 200, value: { ok: true }, save: true };
      });
      return send(res, result.status, result.value);
    }
    if (route === 'sales' && req.method === 'POST') {
      const order = await body(req);
      if (!order || typeof order.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(order.requestId) || !validPaymentCode(order.payment) || !Array.isArray(order.items) || !order.items.length || order.items.length > 100 || order.items.some(i => !Number.isSafeInteger(i.id) || !Number.isSafeInteger(i.quantity) || i.quantity < 1 || i.quantity > 10000 || !Array.isArray(i.addons) || i.addons.length > 20 || i.addons.some(a => !Number.isSafeInteger(a) || a < 0) || new Set(i.addons).size !== i.addons.length) || (order.payment === 'cash' && (!Number.isSafeInteger(order.received) || order.received < 0)) || (order.promotionId !== undefined && order.promotionId !== null && !Number.isSafeInteger(order.promotionId)) || order.discount !== undefined) return send(res, 400, { error: 'Invalid sale' });
      const promptpayId = order.payment === 'cash' ? null : (await pool.query('SELECT promptpay_id FROM pos_credentials WHERE id = $1', [accountId])).rows[0]?.promptpay_id;
      const result = await mutate(accountId, data => {
        const previous = data.sales.find(s => s.requestId === order.requestId);
        if (previous) return { status: 200, value: { id: previous.id, total: previous.total } };
        if (!paymentAvailable(data, promptpayId, order.payment)) return { status: 409, value: { error: 'Payment method unavailable. Refresh and try again.' } };
        const tableResult = tableForSale(data, order);
        if (tableResult.status) return tableResult;
        const table = tableResult.table;
        const items = [];
        for (const item of order.items) {
          const p = data.products.find(p => p.id === item.id && p.active);
          if (!p || p.hidden || item.addons.some(index => index >= (p.addons || []).length)) return { status: 409, value: { error: 'Product or add-on unavailable. Refresh and try again.' } };
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
        const id = Math.max(0, ...data.sales.map(s => s.id)) + 1;
        data.sales.push({ id, table: table ? { id: table.id, name: table.name, guests: table.guests } : null, requestId: order.requestId, date: new Date().toISOString(), subtotal, discount, promotion: promotion ? { id: promotion.id, name: promotion.name, effects: effectsOf(promotion), categories: promotion.categories ?? null, productIds: promotion.productIds ?? null } : null, total, payment: order.payment, received: order.payment === 'cash' ? order.received : null, items });
        releaseTable(table);
        return { status: 201, value: { id, total }, save: true };
      });
      return send(res, result.status, result.value);
    }
    return send(res, 404, { error: 'Not found' });
  } catch (error) {
    if (error instanceof SyntaxError) return send(res, 400, { error: 'Invalid JSON' });
    if (error.message === 'Request too large') return send(res, 413, { error: error.message });
    console.error('POS API error:', error.message);
    return send(res, 500, { error: 'Server error' });
  }
};
