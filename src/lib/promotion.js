export function getVisiblePromotion(promotion) {
  if (!promotion || promotion.enabled === false) return null;

  const title = String(promotion.title || promotion.name || 'Promotion').trim();
  const percent = Number(promotion.percent ?? promotion.promotionPercent ?? promotion.discountPercent ?? 0);
  if (!title || !Number.isFinite(percent) || percent <= 0 || percent > 100) return null;

  const start = promotion.startAt ? new Date(promotion.startAt) : null;
  const end = promotion.endAt ? new Date(promotion.endAt) : null;
  const hasValidStart = start && !Number.isNaN(start.getTime());
  const hasValidEnd = end && !Number.isNaN(end.getTime());
  const now = new Date();

  if (hasValidStart && hasValidEnd && start >= end) return null;
  if (hasValidEnd && end < now) return null;

  const status = hasValidStart && start > now ? 'scheduled' : 'active';

  return {
    ...promotion,
    title,
    percent,
    status,
    isActive: status === 'active',
    note: promotion.note || promotion.description || '',
    startAt: hasValidStart ? start : null,
    endAt: hasValidEnd ? end : null,
  };
}

export function formatPromotionDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

