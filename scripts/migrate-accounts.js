const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before migrating');
  const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE pos_credentials DROP CONSTRAINT IF EXISTS pos_credentials_id_check');
    await client.query('ALTER TABLE pos_state DROP CONSTRAINT IF EXISTS pos_state_id_check');
    await client.query('CREATE SEQUENCE IF NOT EXISTS pos_account_ids');
    await client.query("SELECT setval('pos_account_ids', GREATEST((SELECT COALESCE(MAX(id), 0) FROM pos_credentials), 1))");
    await client.query("ALTER TABLE pos_credentials ALTER COLUMN id SET DEFAULT nextval('pos_account_ids')");
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS pos_credentials_username_unique ON pos_credentials (lower(username))');
    await client.query('ALTER TABLE pos_credentials ADD COLUMN IF NOT EXISTS promptpay_id text');
    const localPromptpay = path.join(__dirname, '..', 'promptpay-id.txt');
    const promptpayId = /^(0\d{9}|\d{13})$/.test(process.env.POS_PROMPTPAY_ID || '') ? process.env.POS_PROMPTPAY_ID : fs.existsSync(localPromptpay) ? fs.readFileSync(localPromptpay, 'utf8').trim() : '';
    if (/^(0\d{9}|\d{13})$/.test(promptpayId)) await client.query('UPDATE pos_credentials SET promptpay_id = $1 WHERE id = 1 AND promptpay_id IS NULL', [promptpayId]);
    await client.query('ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS account_id integer');
    await client.query('UPDATE pos_sessions SET account_id = 1 WHERE account_id IS NULL');
    // Keep the previous login deployment working during the rollout.
    await client.query('ALTER TABLE pos_sessions ALTER COLUMN account_id SET DEFAULT 1');
    await client.query('ALTER TABLE pos_sessions ALTER COLUMN account_id SET NOT NULL');
    if (process.argv.includes('--dry-run')) { await client.query('ROLLBACK'); console.log('Account migration dry run passed.'); }
    else { await client.query('COMMIT'); console.log('Account migration complete. Existing register remains with account 1.'); }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { await client.end(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
