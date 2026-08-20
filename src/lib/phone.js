/** Normalize local Rwanda-style numbers and international input to E.164 + ISO. */

const DIGITS = /[^\d+]/g;

export function normalizePhoneInput(value = '') {
  return String(value || '').replace(DIGITS, '');
}

export function toE164(value, defaultIso = 'RW') {
  const raw = normalizePhoneInput(value);
  if (!raw) return { phoneE164: '', phoneIso: defaultIso };

  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    const iso = digits.startsWith('250') ? 'RW' : defaultIso;
    return { phoneE164: `+${digits}`, phoneIso: iso };
  }

  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('250') && digits.length >= 12) {
    return { phoneE164: `+${digits}`, phoneIso: 'RW' };
  }
  if (digits.startsWith('0') && digits.length >= 10) {
    return { phoneE164: `+250${digits.slice(1)}`, phoneIso: 'RW' };
  }
  if (digits.length >= 9 && digits.length <= 10 && defaultIso === 'RW') {
    return { phoneE164: `+250${digits.replace(/^0/, '')}`, phoneIso: 'RW' };
  }

  return {
    phoneE164: digits ? `+${digits}` : '',
    phoneIso: defaultIso,
  };
}

export function displayPhoneFromE164(phoneE164 = '', fallback = '') {
  const value = String(phoneE164 || fallback || '').trim();
  if (!value) return '';
  if (value.startsWith('+250') && value.length === 13) {
    return `0${value.slice(4)}`;
  }
  return value;
}
