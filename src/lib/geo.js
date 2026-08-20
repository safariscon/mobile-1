import { apiFetch } from '../config/api';

const REST_COUNTRIES_URL = 'https://restcountries.com/v3.1/all?fields=name,cca2';
const COUNTRIES_NOW_STATES = 'https://countriesnow.space/api/v0.1/countries/states';
const COUNTRIES_NOW_CITIES = 'https://countriesnow.space/api/v0.1/countries/state/cities';
const PHOTON_URL = 'https://photon.komoot.io/api/';
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

let countriesCache = null;
const statesCache = new Map();
const citiesCache = new Map();

async function readJson(response) {
  return response.json().catch(() => ({}));
}

export function locationToText(details = {}) {
  return [
    details.sector,
    details.city || details.district,
    details.state || details.province,
    details.country,
  ].filter(Boolean).join(', ');
}

export async function fetchCountries() {
  if (countriesCache) return countriesCache;
  const response = await fetch(REST_COUNTRIES_URL);
  const payload = await readJson(response);
  const list = Array.isArray(payload) ? payload : [];
  countriesCache = list
    .map((item) => ({
      name: item?.name?.common || '',
      code: String(item?.cca2 || '').toUpperCase(),
    }))
    .filter((item) => item.name && item.code)
    .sort((left, right) => left.name.localeCompare(right.name));
  return countriesCache;
}

export async function fetchCountryStates(country) {
  const key = String(country || '').trim().toLowerCase();
  if (!key) return [];
  if (statesCache.has(key)) return statesCache.get(key);
  const response = await fetch(COUNTRIES_NOW_STATES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country }),
  });
  const payload = await readJson(response);
  const states = Array.isArray(payload?.data?.states)
    ? payload.data.states.map((item) => item?.name).filter(Boolean)
    : [];
  statesCache.set(key, states);
  return states;
}

export async function fetchStateCities(country, state) {
  const key = `${String(country || '').trim().toLowerCase()}::${String(state || '').trim().toLowerCase()}`;
  if (!country || !state) return [];
  if (citiesCache.has(key)) return citiesCache.get(key);
  const response = await fetch(COUNTRIES_NOW_CITIES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country, state }),
  });
  const payload = await readJson(response);
  const cities = Array.isArray(payload?.data) ? payload.data.filter(Boolean) : [];
  citiesCache.set(key, cities);
  return cities;
}

function mapGeoResults(items = []) {
  return items
    .map((item) => {
      const latitudeRaw = item.latitudeRaw != null
        ? String(item.latitudeRaw)
        : item.latitude != null || item.lat != null
          ? String(item.latitude ?? item.lat ?? item.geometry?.coordinates?.[1] ?? '')
          : '';
      const longitudeRaw = item.longitudeRaw != null
        ? String(item.longitudeRaw)
        : item.longitude != null || item.lon != null || item.lng != null
          ? String(item.longitude ?? item.lon ?? item.lng ?? item.geometry?.coordinates?.[0] ?? '')
          : '';
      const latitude = Number(latitudeRaw || (item.latitude ?? item.lat ?? item.geometry?.coordinates?.[1]));
      const longitude = Number(longitudeRaw || (item.longitude ?? item.lon ?? item.lng ?? item.geometry?.coordinates?.[0]));
      return {
        label: item.formattedAddress || item.address || item.label || item.display_name || item.name || '',
        formattedAddress: item.formattedAddress || item.address || item.label || item.display_name || item.name || '',
        latitude,
        longitude,
        latitudeRaw: latitudeRaw || (Number.isFinite(latitude) ? String(latitude) : ''),
        longitudeRaw: longitudeRaw || (Number.isFinite(longitude) ? String(longitude) : ''),
        country: item.country || item.address?.country || '',
        countryCode: item.countryCode || item.address?.country_code || '',
        state: item.state || item.province || item.address?.state || '',
        city: item.city || item.district || item.address?.city || item.address?.town || '',
        area: item.area || item.sector || item.address?.suburb || '',
        placeId: item.placeId || item.place_id || '',
        placeName: item.placeName || item.name || '',
      };
    })
    .filter((item) => item.label && Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
}

async function searchPhoton(query, countryCode) {
  const params = new URLSearchParams({ q: query, limit: '8' });
  if (countryCode) params.set('osm_tag', 'place');
  const response = await fetch(`${PHOTON_URL}?${params.toString()}`);
  const payload = await readJson(response);
  return mapGeoResults((payload.features || []).map((feature) => ({
    label: [feature?.properties?.name, feature?.properties?.city, feature?.properties?.state, feature?.properties?.country].filter(Boolean).join(', '),
    latitude: feature?.geometry?.coordinates?.[1],
    longitude: feature?.geometry?.coordinates?.[0],
    country: feature?.properties?.country,
    state: feature?.properties?.state,
    city: feature?.properties?.city,
  })));
}

async function searchNominatim(query, countryCode) {
  const params = new URLSearchParams({ q: query, format: 'json', addressdetails: '1', limit: '8' });
  if (countryCode) params.set('countrycodes', String(countryCode).toLowerCase());
  const response = await fetch(`${NOMINATIM_SEARCH}?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'SafarisConMobile/1.0' },
  });
  const payload = await readJson(response);
  return mapGeoResults(Array.isArray(payload) ? payload : []);
}

export async function searchPlaces(query, countryCode = '') {
  const q = String(query || '').trim();
  if (q.length < 3) return [];
  try {
    const params = new URLSearchParams({ q });
    if (countryCode) params.set('country', countryCode);
    const response = await apiFetch(`/geo/search?${params.toString()}`, { timeoutMs: 9000, skipAuth: true });
    const data = await readJson(response);
    if (response.ok) {
      const results = mapGeoResults(data.results || data.items || data.places || []);
      if (results.length) return results;
    }
  } catch (_error) {
    // Fall through to public geocoders.
  }

  try {
    const photon = await searchPhoton(q, countryCode);
    if (photon.length) return photon;
  } catch (_error) {
    // Try Nominatim next.
  }

  try {
    return await searchNominatim(q, countryCode);
  } catch (_error) {
    return [];
  }
}

export async function reverseGeocode(latitude, longitude) {
  try {
    const response = await apiFetch(`/geo/reverse?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`, {
      timeoutMs: 8000,
      skipAuth: true,
    });
    const data = await readJson(response);
    const place = data.place || data;
    if (response.ok && (place.formattedAddress || place.address || data.fullAddress || data.label || data.address)) {
      return {
        label: place.formattedAddress || place.address || data.address || data.fullAddress || data.label,
        formattedAddress: place.formattedAddress || place.address || data.address || data.fullAddress || data.label,
        country: place.country || data.country || '',
        countryCode: place.countryCode || data.countryCode || '',
        state: place.state || place.province || data.state || data.province || '',
        city: place.city || place.district || data.city || data.district || '',
        area: place.area || place.sector || data.area || '',
        latitudeRaw: place.latitudeRaw != null ? String(place.latitudeRaw) : String(latitude),
        longitudeRaw: place.longitudeRaw != null ? String(place.longitudeRaw) : String(longitude),
        placeId: place.placeId || '',
        placeName: place.placeName || place.name || '',
      };
    }
  } catch (_error) {
    // Fall through.
  }

  try {
    const hotelResponse = await apiFetch(`/hotel/locations/reverse?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`, {
      timeoutMs: 8000,
    });
    const hotelData = await readJson(hotelResponse);
    if (hotelResponse.ok && hotelData.address) {
      return {
        label: hotelData.address,
        formattedAddress: hotelData.address,
        country: hotelData.country || '',
        state: hotelData.state || '',
        city: hotelData.city || '',
        latitudeRaw: String(latitude),
        longitudeRaw: String(longitude),
      };
    }
  } catch (_error) {
    // Fall through to Nominatim.
  }

  const response = await fetch(`${NOMINATIM_REVERSE}?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&format=json`, {
    headers: { Accept: 'application/json', 'User-Agent': 'SafarisConMobile/1.0' },
  });
  const data = await readJson(response);
  return {
    label: data.display_name || '',
    formattedAddress: data.display_name || '',
    country: data.address?.country || '',
    state: data.address?.state || '',
    city: data.address?.city || data.address?.town || data.address?.village || '',
    latitudeRaw: String(latitude),
    longitudeRaw: String(longitude),
  };
}
