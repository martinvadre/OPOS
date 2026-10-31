const MAX_ROWS = 500;

export function parseMenuCsv(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > 1000000) throw new Error('Use a CSV file smaller than 1 MB');
  text = text.replace(/^\uFEFF/, '');
  const records = [];
  let row = [], cell = '', quoted = false, closed = false;
  const finishCell = () => { row.push(cell); cell = ''; closed = false; };
  const finishRow = () => { finishCell(); if (row.some(value => value.trim())) records.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else cell += char;
    } else if (char === ',') finishCell();
    else if (char === '\r' || char === '\n') { finishRow(); if (char === '\r' && text[i + 1] === '\n') i++; }
    else if (char === '"' && cell === '' && !closed) quoted = true;
    else if (closed || char === '"') throw new Error(`Invalid CSV quoting near row ${records.length + 1}`);
    else cell += char;
    if (records.length > MAX_ROWS + 1) throw new Error(`Import up to ${MAX_ROWS} items at a time`);
  }
  if (quoted) throw new Error('The CSV has an unclosed quote');
  finishRow();
  const headers = records.shift()?.map(value => { const header = value.trim().toLowerCase(); return header === 'product' ? 'name' : header === 'add-ons' ? 'addons' : header; });
  if (!headers?.includes('name') || !headers.includes('price')) throw new Error('CSV must have Product and Price columns. Download the template to get started.');
  if (new Set(headers).size !== headers.length || headers.some(value => !['name', 'price', 'category', 'addons'].includes(value))) throw new Error('Use only these columns: Product, Category, Price, Add-ons');
  if (!records.length) throw new Error('The CSV contains no menu items');
  if (records.length > MAX_ROWS) throw new Error(`Import up to ${MAX_ROWS} items at a time`);
  return records.map((values, index) => {
    const fail = message => { throw new Error(`Row ${index + 2}: ${message}`); };
    if (values.length !== headers.length) fail('column count does not match the header');
    const fields = Object.fromEntries(headers.map((header, column) => [header, values[column].trim()]));
    const amount = value => {
      let number = value.normalize('NFKC').replace(/[๐-๙]/g, digit => String(digit.charCodeAt(0) - 0x0e50)).trim();
      if (!number) return 0;
      number = number.replace(/^(?:฿|THB|บาท|baht)\s*|\s*(?:฿|THB|บาท|baht)$/gi, '').replace(/[\s']/g, '');
      if (number.includes(',')) {
        if (number.includes('.')) {
          number = number.lastIndexOf(',') > number.lastIndexOf('.') ? number.replaceAll('.', '').replace(',', '.') : number.replaceAll(',', '');
        } else {
          number = /^\d{1,3}(,\d{3})+$/.test(number) ? number.replaceAll(',', '') : number.replace(',', '.');
        }
      }
      if (!/^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(number)) fail('enter a numeric price or leave it blank for ฿0');
      const baht = Number(number);
      const cents = Math.round((baht + Number.EPSILON * Math.max(1, baht)) * 100);
      if (!Number.isFinite(baht) || baht < 0 || baht > 1000000 || !Number.isSafeInteger(cents)) fail('price must be between 0 and 1,000,000 baht');
      return cents;
    };
    if (!fields.name || fields.name.length > 120) fail('name must be 1–120 characters');
    if ((fields.category || '').length > 60) fail('category must be 60 characters or fewer');
    const addons = fields.addons ? fields.addons.split('|').map(value => {
      const colon = value.lastIndexOf(':');
      const name = value.slice(0, colon).trim();
      if (colon < 1 || !name || name.length > 80) fail('use add-ons like Cream cheese:10|Pearls:5');
      return { name, price: amount(value.slice(colon + 1).trim()) };
    }) : [];
    if (addons.length > 20) fail('use up to 20 add-ons per item');
    return { name: fields.name, price: amount(fields.price), category: fields.category || '', addons };
  });
}


export function importMenuItems(data, items) {
  const names = new Set(data.products.filter(item => item.active).map(item => item.name.trim().toLowerCase()));
  let nextId = data.products.reduce((max, item) => Math.max(max, item.id), 0), added = 0;
  for (const item of items) {
    const key = item.name.toLowerCase();
    if (names.has(key)) continue;
    data.products.push({ ...item, id: ++nextId, image: '', active: true, hidden: false });
    names.add(key); added++;
  }
  return { added, skipped: items.length - added };
}
