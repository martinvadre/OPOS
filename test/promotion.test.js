const { test } = require('node:test');
const assert = require('node:assert/strict');
const { promotionFields, validPromotion, promotionProductsAvailable, promotionDiscount } = require('../promotion');

test('promotion category scopes validate, normalize, and replace previous item scopes', () => {
  const base = { name: 'Special', effects: [{ type: 'fixed', value: 500 }] };
  assert.equal(validPromotion({ ...base, categories: [' Drinks ', ''] }), true);
  assert.deepEqual(promotionFields({ ...base, categories: [' Drinks ', ''] }).categories, ['Drinks', '']);
  assert.equal(promotionFields({ ...base, categories: null }).productIds, null);
  for (const categories of [[], ['Drinks', ' Drinks '], [1], {}, ['x'.repeat(61)]]) assert.equal(validPromotion({ ...base, categories }), false);
  assert.equal(validPromotion({ ...base, categories: ['Drinks'], productIds: [1] }), false);
  assert.equal(validPromotion({ ...base, categories: null, productIds: [1] }), false);
  assert.equal(validPromotion({ ...base, productIds: [1] }), true);
});

test('category discounts cover matching items, free add-ons and uncategorized items while legacy scopes stay intact', () => {
  const items = [
    { id: 1, category: 'Drinks', price: 5000, quantity: 2, addons: [{ name: 'Cream cheese', price: 500 }] },
    { id: 2, category: 'Desserts', price: 4000, quantity: 1, addons: [{ name: 'Cream cheese', price: 500 }] },
    { id: 3, price: 1000, quantity: 1, addons: [] },
  ];
  assert.equal(promotionDiscount({ categories: ['Drinks'], effects: [{ type: 'fixed', value: 500 }] }, items), 500);
  assert.equal(promotionDiscount({ categories: ['Drinks'], effects: [{ type: 'percent', value: 10 }] }, items), 1000);
  assert.equal(promotionDiscount({ categories: ['Drinks'], effects: [{ type: 'free_addon', addonName: 'Cream cheese' }, { type: 'fixed', value: 500 }] }, items), 1000);
  assert.equal(promotionDiscount({ categories: [''], effects: [{ type: 'percent', value: 10 }] }, items), 100);
  assert.equal(promotionDiscount({ productIds: [2], effects: [{ type: 'percent', value: 10 }] }, items), 400);
  assert.equal(promotionDiscount({ categories: ['Missing'], effects: [{ type: 'fixed', value: 500 }] }, items), 0);
  const products = items.map(item => ({ ...item, active: true }));
  assert.equal(promotionProductsAvailable({ categories: ['Drinks'], effects: [{ type: 'free_addon', addonName: 'Cream cheese' }] }, products), true);
  assert.equal(promotionProductsAvailable({ categories: ['Drinks'], effects: [{ type: 'fixed', value: 500 }] }, products.map(product => ({ ...product, hidden: true }))), false);
  assert.equal(promotionProductsAvailable({ categories: ['Missing'], effects: [{ type: 'fixed', value: 500 }] }, products), false);
});
