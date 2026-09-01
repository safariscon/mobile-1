import { apiFetch } from '../config/api';
import i18n from '../i18n';

/**
 * Uploads a licence / permit photo the customer attaches to a vehicle booking.
 * Returns the hosted URL.
 */
export async function uploadCustomerDocument(asset) {
  const formData = new FormData();
  formData.append('documents', {
    uri: asset.uri,
    name: asset.fileName || `licence-${Date.now()}.jpg`,
    type: asset.mimeType || 'image/jpeg',
  });

  const response = await apiFetch('/auth/documents', {
    method: 'POST',
    body: formData,
    timeoutMs: 60000,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || i18n.t('domain.transport.licence.uploadFailed'));
  }
  const url = data.urls?.[0] || data.images?.[0]?.url || '';
  if (!url) throw new Error(i18n.t('domain.transport.licence.uploadFailed'));
  return url;
}
