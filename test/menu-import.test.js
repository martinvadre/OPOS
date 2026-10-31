const { test } = require('node:test');
const assert = require('node:assert/strict');

test('CSV handles UTF-8, BOM, quoted fields, escaped quotes, reordered columns and optional fields', async () => {
  const { parseMenuCsv } = await import('../menu-import.mjs');
  const rows = parseMenuCsv('\uFEFFcategory,name,addons,price\r\nDrinks,"ชา, tea ""special""",Cream cheese:10|Pearls:5,45.50\r\n\r\n');
  assert.deepEqual(rows, [{ category: 'Drinks', name: 'ชา, tea "special"', price: 4550, addons: [{ name: 'Cream cheese', price: 1000 }, { name: 'Pearls', price: 500 }] }]);
  assert.deepEqual(parseMenuCsv('name,price\nFree water,0')[0], { name: 'Free water', price: 0, category: '', addons: [] });
  assert.deepEqual(parseMenuCsv('Product,Category,Price,Add-ons\nTea,Drinks,45,Cheese:10')[0], { name: 'Tea', category: 'Drinks', price: 4500, addons: [{ name: 'Cheese', price: 1000 }] });
  assert.throws(() => parseMenuCsv('Product,name,Price\nTea,Tea,45'), /columns/);
  assert.equal(parseMenuCsv('name,price\n"First\nsecond",1')[0].name, 'First\nsecond');
});

test('CSV rejects invalid money, malformed quoting, wrong headers, and excessive data before import', async () => {
  const { parseMenuCsv } = await import('../menu-import.mjs');
  for (const text of ['name,price\nTea,-1', 'name,price\nTea,abc', 'name,price\nTea,NaN', 'name,price\nTea,1000001', 'name,price\n,10', 'name,price\n"Tea,10', 'name,price\n"Tea"oops,10', 'name,price\nTea,10,extra', 'name,price,price\nTea,1,2', 'name,cost\nTea,10', 'name,price', 'name,price,addons\nTea,10,Cheese', 'name,price,category\nTea,10,' + 'x'.repeat(61)]) assert.throws(() => parseMenuCsv(text), Error);
  assert.throws(() => parseMenuCsv('name,price\n' + 'Tea,10\n'.repeat(501)), /500/);
  assert.throws(() => parseMenuCsv('x'.repeat(1000001)), /1 MB/);
  assert.throws(() => parseMenuCsv(null), /CSV/);
});

test('bulk import preserves existing and hidden items, skips repeated names, and allocates unique IDs', async () => {
  const { parseMenuCsv, importMenuItems } = await import('../menu-import.mjs');
  const original = { id: 8, name: 'Tea', active: true, hidden: true, price: 99 };
  const data = { products: [original, { id: 20, name: 'Old', active: false }] };
  assert.deepEqual(importMenuItems(data, parseMenuCsv('name,price\nTEA,45\nCoffee,50\ncoffee,60\nOld,10')), { added: 2, skipped: 2 });
  assert.deepEqual(original, { id: 8, name: 'Tea', active: true, hidden: true, price: 99 });
  assert.deepEqual(data.products.slice(2).map(item => item.id), [21, 22]);
  assert.equal(data.products[2].price, 5000);
});


test('CSV accepts blank and common formatted prices, rounding to satang', async () => {
  const { parseMenuCsv } = await import('../menu-import.mjs');
  const cases = [['', 0], ['   ', 0], ['฿45', 4500], ['45 THB', 4500], ['45 บาท', 4500], ['45 baht', 4500], ['1,000.00', 100000], ['1.000,50', 100050], ['45,50', 4550], ['1 000.50', 100050], ["1'000.50", 100050], ['45.000', 4500], ['1.234', 123], ['1.005', 101], ['1e3', 100000], ['.5', 50], ['45.', 4500], ['๔๕.๕๐', 4550], ['４５', 4500], ['1000000', 100000000]];
  for (const [price, expected] of cases) {
    const csv = `Product,Price,Add-ons\nTea,"${price}",Cheese:`;
    const item = parseMenuCsv(csv)[0];
    assert.equal(item.price, expected, price);
    assert.equal(item.addons[0].price, 0);
  }
  for (const price of ['-1', '(45)', 'USD45', '1e999', '1,2,3', '1000000.01', 'THB']) assert.throws(() => parseMenuCsv(`Product,Price\nTea,"${price}"`));
});
