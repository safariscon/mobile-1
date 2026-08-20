import { apiFetch } from '../config/api';

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function asList(payload, ...keys) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

export async function fetchServiceCategories({ seller = false } = {}) {
  const path = seller ? '/hotel/service-categories' : '/service-categories';
  const response = await apiFetch(path, { timeoutMs: 12000, skipAuth: !seller });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not load service categories.');
  const categories = asList(data, 'categories');
  const groups = asList(data, 'groups');
  return {
    categories,
    groups: groups.length
      ? groups
      : Object.values(
        categories.reduce((acc, category) => {
          const group = category.group || 'Other';
          if (!acc[group]) acc[group] = { group, categories: [] };
          acc[group].categories.push(category);
          return acc;
        }, {})
      ),
  };
}

export async function fetchServiceCategory(idOrSlug) {
  const response = await apiFetch(`/service-categories/${encodeURIComponent(idOrSlug)}`, {
    timeoutMs: 12000,
    skipAuth: true,
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not load category.');
  return data.category || data;
}

export async function fetchAdminServiceCategories() {
  const response = await apiFetch('/admin/service-categories', { timeoutMs: 15000 });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not load categories.');
  return asList(data, 'categories', 'items');
}

export async function createAdminServiceCategory(body) {
  const response = await apiFetch('/admin/service-categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 15000,
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not create category.');
  return data.category || data;
}

export async function updateAdminServiceCategory(id, body) {
  const response = await apiFetch(`/admin/service-categories/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 15000,
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not update category.');
  return data.category || data;
}

export async function updateAdminServiceCategoryFields(id, body) {
  const response = await apiFetch(`/admin/service-categories/${encodeURIComponent(id)}/fields`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 15000,
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not update category fields.');
  return data.category || data;
}

export async function deleteAdminServiceCategory(id) {
  const response = await apiFetch(`/admin/service-categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    timeoutMs: 12000,
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || data.error || 'Could not deactivate category.');
  return data;
}

export function categorySelectOptions(categories = []) {
  return categories
    .map((category) => {
      const id = category._id || category.id;
      if (!id) return null;
      return [String(id), category.name || category.label || category.slug || String(id)];
    })
    .filter(Boolean);
}

/** Prefer stable Mongo id; slug is display/legacy fallback only. */
export function findCategory(categories = [], idOrSlug) {
  const key = String(idOrSlug || '');
  if (!key) return null;
  return (
    categories.find((item) => String(item._id || '') === key || String(item.id || '') === key)
    || categories.find((item) => String(item.slug || '') === key)
    || null
  );
}

export function serviceCategoryId(service) {
  const raw = service?.categoryId;
  if (raw && typeof raw === 'object') return String(raw._id || raw.id || '');
  return String(raw || service?.category?._id || service?.category?.id || '');
}

export function serviceCategoryLabel(service, categories = []) {
  const liveName = service?.categoryName || (typeof service?.category === 'object' ? service.category?.name : null);
  if (liveName) return liveName;
  const id = serviceCategoryId(service);
  const match = findCategory(categories, id) || findCategory(categories, service?.categorySlug || service?.type);
  if (match?.name) return match.name;
  if (service?.categorySlug) return service.categorySlug;
  if (typeof service?.category === 'string') return service.category;
  return service?.type || 'Service';
}

