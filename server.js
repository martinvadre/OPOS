const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const promptpayPayload = require('promptpay-qr');
const QRCode = require('qrcode');
const { promotionFields, validPromotion, promotionProductsAvailable } = require('./promotion');
const { tableState, tableMutation, productInOpenOrder, changesOrderProduct } = require('./tables');
const { manualPayments, promptpayEnabled, validManualPayments } = require('./payment-methods');
const { validSale, recordSale } = require('./sales');
const { stockMutation, validRecipe } = require('./stock');

const dataDir = process.env.POS_DATA_DIR || __dirname;
const dataFile = path.join(dataDir, 'pos-data.json');
const passwordFile = path.join(dataDir, 'password.hash');
const credentialsFile = path.join(dataDir, 'credentials.json');
const promptpayFile = path.join(dataDir, 'promptpay-id.txt');
function writeFile(file, contents) {
  const temporary = `${file}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try { fs.writeFileSync(fd, contents); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  try { fs.renameSync(temporary, file); } catch (error) { fs.rmSync(temporary, { force: true }); throw error; }
}
if (require.main === module && process.argv.includes('--set-password')) {
  const password = fs.readFileSync(0, 'utf8').replace(/\r?\n$/, '');
  if (password.length < 12) { console.error('Use a password of at least 12 characters.'); process.exit(1); }
  const salt = crypto.randomBytes(16).toString('hex');
  writeFile(credentialsFile, JSON.stringify({ username: 'admin', passwordHash: `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}` }) + '\n');
  console.log('Password saved.');
  process.exit(0);
}
if (!fs.existsSync(credentialsFile) && fs.existsSync(passwordFile)) writeFile(credentialsFile, JSON.stringify({ username: 'admin', passwordHash: fs.readFileSync(passwordFile, 'utf8').trim() }) + '\n');
if (!fs.existsSync(credentialsFile)) { console.error('No credentials file. Run start.command to create one.'); process.exit(1); }
function credentials() { return JSON.parse(fs.readFileSync(credentialsFile, 'utf8')); }
function promptpayId() { return fs.existsSync(promptpayFile) ? fs.readFileSync(promptpayFile, 'utf8').trim() : ''; }
function checkPassword(password, stored) {
  const [salt, passwordHash] = stored.split(':');
  if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(passwordHash || '')) throw new Error('Invalid credentials file');
  return crypto.timingSafeEqual(Buffer.from(passwordHash, 'hex'), crypto.scryptSync(password, salt, 64));
}
function hashPassword(password) { const salt = crypto.randomBytes(16).toString('hex'); return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`; }
checkPassword('', credentials().passwordHash);
let data = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf8')) : { products: [], sales: [] };
if (!Array.isArray(data.products) || !Array.isArray(data.sales)) throw new Error('Invalid data file');
function save(next) { writeFile(dataFile, JSON.stringify(next, null, 2) + '\n'); data = next; }
const sessions = new Map();
const attempts = new Map();
const distDir = path.join(__dirname, 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const send = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
const products = () => data.products.filter(p => p.active).map(({ id, name, price, image, addons, hidden, category, priority, recipe }) => ({ id, name, price, category: category || '', priority: priority || 'medium', recipe: recipe || [], image: image || '', addons: addons || [], hidden: !!hidden })).sort((a, b) => a.name.localeCompare(b.name));
// shortcut: send full history for one register; paginate if sales volume makes state slow.
const sales = () => data.sales.slice().reverse().map(({ requestId, ...sale }) => sale);
const validAddons = addons => Array.isArray(addons) && addons.length <= 20 && addons.every(a => a && typeof a.name === 'string' && a.name.trim().length > 0 && a.name.trim().length <= 80 && Number.isSafeInteger(a.price) && a.price >= 0 && a.price <= 100000000);
const validProduct = p => p && typeof p.name === 'string' && p.name.trim().length > 0 && p.name.trim().length <= 120 && Number.isSafeInteger(p.price) && p.price >= 0 && p.price <= 100000000 && validAddons(p.addons) && (p.category === undefined || (typeof p.category === 'string' && p.category.trim().length <= 60)) && (p.priority === undefined || ['high', 'medium', 'low'].includes(p.priority)) && (p.image === undefined || (typeof p.image === 'string' && p.image.length <= 2000000));
const sameOrigin = req => !req.headers.origin || req.headers.origin === `http://${req.headers.host}` || req.headers.origin === `https://${req.headers.host}`;
async function body(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 2500000) throw new Error('Request too large'); }
  return JSON.parse(raw || '{}');
}
async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (!['GET', 'HEAD'].includes(req.method) && !sameOrigin(req)) return send(res, 403, { error: 'Invalid origin' });
  if (url.pathname === '/api/login' && req.method === 'POST') {
    const key = req.socket.remoteAddress;
    const recent = (attempts.get(key) || []).filter(t => Date.now() - t < 60000);
    if (recent.length >= 5) return send(res, 429, { error: 'Too many attempts. Wait a minute.' });
    const input = await body(req);
    const saved = credentials();
    const username = typeof input.username === 'string' ? input.username.trim() : '';
    const password = typeof input.password === 'string' && input.password.length <= 1024 ? input.password : '';
    if (username.toLowerCase() !== saved.username.toLowerCase() || !checkPassword(password, saved.passwordHash)) { recent.push(Date.now()); attempts.set(key, recent); return send(res, 401, { error: 'Wrong username or password' }); }
    attempts.delete(key);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + 12 * 60 * 60 * 1000);
    res.setHeader('Set-Cookie', `pos_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);
    return send(res, 200, { ok: true });
  }
  if (url.pathname.startsWith('/api/')) {
    const token = /(?:^|; )pos_session=([a-f0-9]{64})/.exec(req.headers.cookie || '')?.[1];
    const now = Date.now();
    const expires = sessions.get(token) || 0;
    if (!token || expires <= now) return send(res, 401, { error: 'Sign in to continue' });
    if (url.pathname === '/api/logout' && req.method === 'POST') { sessions.delete(token); res.setHeader('Set-Cookie', 'pos_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return send(res, 200, { ok: true }); }
    if (expires - now <= 11 * 60 * 60 * 1000) {
      sessions.set(token, now + 12 * 60 * 60 * 1000);
      res.setHeader('Set-Cookie', `pos_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);
    }
    if (url.pathname === '/api/settings' && req.method === 'GET') return send(res, 200, { username: credentials().username, promptpayId: promptpayId(), promptpayEnabled: promptpayEnabled(data, promptpayId()), manualPayments: manualPayments(data) });
    if (url.pathname === '/api/settings' && req.method === 'PUT') {
      const input = await body(req);
      const saved = credentials();
      const username = typeof input.username === 'string' ? input.username.trim() : saved.username;
      if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) return send(res, 400, { error: 'Username must be 3–50 letters, numbers, dots, dashes, or underscores' });
      if (input.promptpayEnabled !== undefined && typeof input.promptpayEnabled !== 'boolean') return send(res, 400, { error: 'Choose whether PromptPay is enabled' });
      if (input.manualPayments !== undefined && !validManualPayments(input.manualPayments)) return send(res, 400, { error: 'Enter up to 8 unique payment names of 1–30 characters' });
      const nextPromptpayId = input.promptpayId === undefined ? promptpayId() : typeof input.promptpayId === 'string' ? input.promptpayId.trim() : null;
      if (nextPromptpayId === null || (nextPromptpayId && !/^(0\d{9}|\d{13})$/.test(nextPromptpayId))) return send(res, 400, { error: 'Enter a 10-digit phone or 13-digit PromptPay ID' });
      const next = structuredClone(data);
      if (input.promptpayEnabled !== undefined) next.promptpayEnabled = input.promptpayEnabled;
      if (input.manualPayments !== undefined) next.manualPayments = input.manualPayments.map(name => name.trim());
      if (input.promptpayId !== undefined && !promptpayEnabled(next, promptpayId())) return send(res, 409, { error: 'Enable PromptPay before setting its ID' });
      if (input.newPassword !== undefined) {
        if (typeof input.currentPassword !== 'string' || !checkPassword(input.currentPassword, saved.passwordHash)) return send(res, 403, { error: 'Current password is incorrect' });
        if (typeof input.newPassword !== 'string' || input.newPassword.length < 12 || input.newPassword.length > 1024) return send(res, 400, { error: 'New password must be 12–1024 characters' });
        saved.passwordHash = hashPassword(input.newPassword);
      }
      saved.username = username;
      writeFile(credentialsFile, JSON.stringify(saved) + '\n');
      if (input.promptpayId !== undefined) writeFile(promptpayFile, nextPromptpayId + '\n');
      if (input.promptpayEnabled !== undefined || input.manualPayments !== undefined) save(next);
      if (input.newPassword !== undefined) { const expires = sessions.get(token); sessions.clear(); sessions.set(token, expires); }
      return send(res, 200, { username, promptpayId: nextPromptpayId, promptpayEnabled: promptpayEnabled(data, nextPromptpayId), manualPayments: manualPayments(data) });
    }
    if (url.pathname === '/api/state' && req.method === 'GET') return send(res, 200, { ...tableState(data), stock: data.stock || [], promptpayEnabled: promptpayEnabled(data, promptpayId()), promptpayConfigured: promptpayEnabled(data, promptpayId()) && !!promptpayId(), manualPayments: manualPayments(data), products: products(), sales: sales(), promotions: (data.promotions || []).filter(p => p.active !== false) });
    if (url.pathname === '/api/promptpay' && req.method === 'GET') {
      const amount = Number(url.searchParams.get('amount'));
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000000) return send(res, 400, { error: 'Invalid PromptPay amount' });
      const recipient = promptpayId();
      if (!promptpayEnabled(data, recipient)) return send(res, 409, { error: 'Enable PromptPay in Settings first' });
      if (!/^(0\d{9}|\d{13})$/.test(recipient)) return send(res, 503, { error: 'Set a valid PromptPay phone or national ID in promptpay-id.txt' });
      const qr = await QRCode.toDataURL(promptpayPayload(recipient, { amount: amount / 100 }), { width: 280, margin: 2 });
      return send(res, 200, { qr });
    }
    const tableRoute = url.pathname.slice('/api/'.length);
    if (req.method === 'POST' && (tableRoute === 'stock' || /^stock\/\d+\/restock$/.test(tableRoute))) {
      const input = await body(req);
      const next = structuredClone(data);
      const result = stockMutation(next, tableRoute, input);
      if (result.save) save(next);
      return send(res, result.status, result.value);
    }
    if (((tableRoute === 'restaurant' || tableRoute === 'tables/grid') && req.method === 'PUT') || ((tableRoute === 'tables' || /^tables\/\d+$/.test(tableRoute)) && ['POST', 'PATCH', 'DELETE'].includes(req.method))) {
      const input = await body(req);
      const next = structuredClone(data);
      const result = tableMutation(next, tableRoute, req.method, input);
      if (result.save) save(next);
      return send(res, result.status, result.value);
    }
    if (url.pathname === '/api/promotions' && req.method === 'POST') {
      const input = await body(req);
      if (!validPromotion(input)) return send(res, 400, { error: 'Enter a valid promotion name and value' });
      if (!promotionProductsAvailable(input, data.products)) return send(res, 400, { error: 'Selected category or add-on unavailable' });
      const next = structuredClone(data);
      next.promotions ||= [];
      const id = Math.max(0, ...next.promotions.map(p => p.id)) + 1;
      next.promotions.push({ id, ...promotionFields(input), active: true, hidden: false });
      save(next);
      return send(res, 201, { id });
    }
    const promotionMatch = /^\/api\/promotions\/(\d+)$/.exec(url.pathname);
    if (promotionMatch && req.method === 'PUT') {
      const input = await body(req);
      if (!validPromotion(input) || !promotionProductsAvailable(input, data.products)) return send(res, 400, { error: 'Enter a valid promotion and available categories or add-on' });
      const next = structuredClone(data);
      const promotion = (next.promotions || []).find(p => p.id === Number(promotionMatch[1]) && p.active !== false);
      if (!promotion) return send(res, 404, { error: 'Promotion not found' });
      Object.assign(promotion, promotionFields(input));
      delete promotion.type;
      delete promotion.value;
      save(next);
      return send(res, 200, { ok: true });
    }
    if (promotionMatch && req.method === 'PATCH') {
      const input = await body(req);
      if (typeof input.hidden !== 'boolean') return send(res, 400, { error: 'Invalid visibility' });
      const next = structuredClone(data);
      const promotion = (next.promotions || []).find(p => p.id === Number(promotionMatch[1]) && p.active !== false);
      if (!promotion) return send(res, 404, { error: 'Promotion not found' });
      promotion.hidden = input.hidden;
      save(next);
      return send(res, 200, { ok: true });
    }
    if (promotionMatch && req.method === 'DELETE') {
      const next = structuredClone(data);
      const promotion = (next.promotions || []).find(p => p.id === Number(promotionMatch[1]) && p.active !== false);
      if (!promotion) return send(res, 404, { error: 'Promotion not found' });
      promotion.active = false;
      save(next);
      return send(res, 200, { ok: true });
    }
    if (url.pathname === '/api/products/import' && req.method === 'POST') {
      const { parseMenuCsv, importMenuItems } = await import('./menu-import.mjs');
      const payload = await body(req);
      let items;
      try { items = parseMenuCsv(payload?.csv); } catch (error) { return send(res, 400, { error: error.message }); }
      const next = structuredClone(data);
      const result = importMenuItems(next, items);
      if (result.added) save(next);
      return send(res, 200, result);
    }
    if (url.pathname === '/api/products' && req.method === 'POST') {
      const p = await body(req);
      if (!validProduct(p)) return send(res, 400, { error: 'Enter a valid product and add-ons' });
      if (!validRecipe(data, p.recipe)) return send(res, 400, { error: 'Enter valid recipe quantities and stock items' });
      const next = structuredClone(data);
      const id = Math.max(0, ...next.products.map(p => p.id)) + 1;
      next.products.push({ id, name: p.name.trim(), price: p.price, priority: p.priority || 'medium', recipe: p.recipe || [], addons: p.addons.map(a => ({ name: a.name.trim(), price: a.price })), category: p.category?.trim() || '', image: typeof p.image === 'string' ? p.image : '', active: true, hidden: false });
      save(next);
      return send(res, 201, { id });
    }
    const match = /^\/api\/products\/(\d+)$/.exec(url.pathname);
    if (match && req.method === 'PUT') {
      const p = await body(req);
      if (!validProduct(p)) return send(res, 400, { error: 'Enter a valid product and add-ons' });
      if (!validRecipe(data, p.recipe)) return send(res, 400, { error: 'Enter valid recipe quantities and stock items' });
      const next = structuredClone(data);
      const current = next.products.find(p => p.id === Number(match[1]) && p.active);
      if (!current) return send(res, 404, { error: 'Product not found' });
      if (changesOrderProduct(current, p) && productInOpenOrder(next, current.id)) return send(res, 409, { error: 'Finish open table orders before changing this product' });
      Object.assign(current, { name: p.name.trim(), price: p.price, addons: p.addons.map(a => ({ name: a.name.trim(), price: a.price })), ...(p.category !== undefined ? { category: p.category.trim() } : {}), ...(p.priority !== undefined ? { priority: p.priority } : {}), ...(p.image !== undefined ? { image: p.image } : {}), ...(p.recipe !== undefined ? { recipe: p.recipe } : {}) });
      save(next);
      return send(res, 200, { ok: true });
    }
    if (match && req.method === 'DELETE') {
      const next = structuredClone(data);
      const current = next.products.find(p => p.id === Number(match[1]) && p.active);
      if (!current) return send(res, 404, { error: 'Product not found' });
      if (productInOpenOrder(next, current.id)) return send(res, 409, { error: 'Finish open table orders before changing this product' });
      current.active = false;
      save(next);
      return send(res, 200, { ok: true });
    }
    if (match && req.method === 'PATCH') {
      const input = await body(req);
      if (typeof input.hidden !== 'boolean') return send(res, 400, { error: 'Invalid visibility' });
      const next = structuredClone(data);
      const current = next.products.find(p => p.id === Number(match[1]) && p.active);
      if (!current) return send(res, 404, { error: 'Product not found' });
      if (productInOpenOrder(next, current.id)) return send(res, 409, { error: 'Finish open table orders before changing this product' });
      current.hidden = input.hidden;
      save(next);
      return send(res, 200, { ok: true });
    }
    if (url.pathname === '/api/sales' && req.method === 'POST') {
      const order = await body(req);
      if (!validSale(order)) return send(res, 400, { error: 'Invalid sale' });
      const next = structuredClone(data);
      const result = recordSale(next, order, promptpayId());
      if (result.save) save(next);
      return send(res, result.status, result.value);
    }
    return send(res, 404, { error: 'Not found' });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
  const file = url.pathname === '/' || url.pathname === '/index.html' ? 'index.html' : /^\/assets\/[\w.-]+$/.test(url.pathname) ? url.pathname.slice(1) : null;
  if (!file || !fs.existsSync(path.join(distDir, file))) return send(res, 404, { error: 'Not found' });
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(path.join(distDir, file)).pipe(res);
}
// shortcut: one Mac server owns the data file; use a database if multiple server processes are needed.
const server = http.createServer((req, res) => handler(req, res).catch(error => send(res, error instanceof SyntaxError ? 400 : 500, { error: error instanceof SyntaxError ? 'Invalid JSON' : 'Server error' })));
if (require.main === module) server.listen(Number(process.env.PORT || 3000), process.env.POS_HOST || '127.0.0.1', () => console.log(`OPOS running on port ${process.env.PORT || 3000}`));
module.exports = server;
