function effectsOf(promotion) {
  return Array.isArray(promotion.effects) ? promotion.effects : [{ type: promotion.type, value: promotion.value }];
}

function promotionFields(input) {
  return { name: input.name.trim(), effects: effectsOf(input).map(effect => effect.type === 'free_addon' ? { type: effect.type, addonName: effect.addonName.trim() } : { type: effect.type, value: effect.value }), categories: input.categories?.map(category => category.trim()) ?? null, productIds: input.categories !== undefined ? null : input.productIds ?? null };
}

function validPromotion(promotion) {
  if (!promotion || typeof promotion.name !== 'string' || !promotion.name.trim() || promotion.name.trim().length > 80) return false;
  if (promotion.effects !== undefined && !Array.isArray(promotion.effects)) return false;
  const effects = effectsOf(promotion);
  if (effects.length < 1 || effects.length > 2 || new Set(effects.map(effect => effect?.type)).size !== effects.length || !effects.every(effect => effect && (
    effect.type === 'free_addon'
      ? typeof effect.addonName === 'string' && !!effect.addonName.trim() && effect.addonName.trim().length <= 80
      : ['fixed', 'percent'].includes(effect.type) && Number.isSafeInteger(effect.value) && effect.value > 0 && effect.value <= (effect.type === 'percent' ? 100 : 100000000)
  ))) return false;
  const categories = promotion.categories;
  if (categories != null && (!Array.isArray(categories) || !categories.length || categories.length > 1000 || !categories.every(category => typeof category === 'string' && category.trim().length <= 60) || new Set(categories.map(category => category.trim())).size !== categories.length || promotion.productIds != null)) return false;
  if (categories !== undefined && promotion.productIds != null) return false;
  const ids = promotion.productIds;
  return ids == null || (Array.isArray(ids) && ids.length > 0 && ids.length <= 1000 && ids.every(id => Number.isSafeInteger(id) && id > 0) && new Set(ids).size === ids.length);
}

function appliesTo(promotion, product) {
  return promotion.categories != null ? promotion.categories.some(category => category.trim() === (product.category || '')) : !promotion.productIds || promotion.productIds.includes(product.id);
}

function promotionProductsAvailable(promotion, products) {
  const eligible = products.filter(product => product.active && !product.hidden && appliesTo(promotion, product));
  if (promotion.categories != null && !promotion.categories.every(category => eligible.some(product => (product.category || '') === category.trim()))) return false;
  if (promotion.categories == null && promotion.productIds && eligible.length !== promotion.productIds.length) return false;
  return effectsOf(promotion).filter(effect => effect.type === 'free_addon').every(effect => eligible.some(product => (product.addons || []).some(addon => addon.name.toLowerCase() === effect.addonName.trim().toLowerCase())));
}

function promotionDiscount(promotion, items) {
  if (!promotion) return 0;
  const eligible = items.filter(item => appliesTo(promotion, item));
  const effects = effectsOf(promotion);
  const freeNames = new Set(effects.filter(effect => effect.type === 'free_addon').map(effect => effect.addonName.trim().toLowerCase()));
  const subtotal = eligible.reduce((sum, item) => sum + item.price * item.quantity, 0);
  let discount = eligible.flatMap(item => item.addons || []).find(addon => freeNames.has(addon.name.toLowerCase()))?.price || 0;
  let remaining = Math.max(0, subtotal - discount);
  for (const effect of effects) {
    if (effect.type === 'free_addon') continue;
    const amount = Math.min(remaining, effect.type === 'percent' ? Math.round(remaining * effect.value / 100) : effect.value);
    discount += amount;
    remaining -= amount;
  }
  return Math.min(subtotal, discount);
}

module.exports = { effectsOf, promotionFields, validPromotion, promotionProductsAvailable, promotionDiscount };
