const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before migrating');
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(process.env.POS_PASSWORD_HASH || '')) throw new Error('Set POS_PASSWORD_HASH before migrating');
  const file = path.join(__dirname, '..', 'pos-data.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data.products) || !Array.isArray(data.sales)) throw new Error('Invalid local POS data');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE TABLE IF NOT EXISTS pos_state (id integer PRIMARY KEY, payload jsonb NOT NULL)');
    await client.query('CREATE TABLE IF NOT EXISTS pos_sessions (token_hash text PRIMARY KEY, expires_at timestamptz NOT NULL, account_id integer NOT NULL)');
    await client.query('CREATE TABLE IF NOT EXISTS pos_login_attempts (ip text PRIMARY KEY, attempts integer NOT NULL, reset_at timestamptz NOT NULL)');
    await client.query('CREATE SEQUENCE IF NOT EXISTS pos_account_ids START WITH 2');
    await client.query("CREATE TABLE IF NOT EXISTS pos_credentials (id integer PRIMARY KEY DEFAULT nextval('pos_account_ids'), username text NOT NULL, password_hash text NOT NULL, promptpay_id text)");
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS pos_credentials_username_unique ON pos_credentials (lower(username))');
    await client.query('INSERT INTO pos_credentials (id, username, password_hash) VALUES (1, $1, $2) ON CONFLICT (id) DO NOTHING', ['admin', process.env.POS_PASSWORD_HASH]);
    if (/^(0\d{9}|\d{13})$/.test(process.env.POS_PROMPTPAY_ID || '')) await client.query('UPDATE pos_credentials SET promptpay_id = $1 WHERE id = 1 AND promptpay_id IS NULL', [process.env.POS_PROMPTPAY_ID]);
    if (process.argv.includes('--credentials-only')) { await client.query('COMMIT'); console.log('Login credentials initialized.'); return; }
    const existing = await client.query('SELECT 1 FROM pos_state WHERE id = 1 FOR UPDATE');
    if (existing.rowCount) throw new Error('Remote POS already has data; migration stopped without overwriting it');
    await client.query('INSERT INTO pos_state (id, payload) VALUES (1, $1)', [data]);
    await client.query('COMMIT');
    console.log(`Migrated ${data.products.length} products and ${data.sales.length} sales.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { await client.end(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
