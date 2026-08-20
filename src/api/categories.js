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
  return categories.map((category) => [
    category._id || category.id || category.slug,
    category.name || category.label || category.slug,
  ]);
}

export function findCategory(categories = [], idOrSlug) {
  const key = String(idOrSlug || '');
  return categories.find((item) => [item._id, item.id, item.slug].map(String).includes(key)) || null;
}
