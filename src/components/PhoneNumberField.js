import { TextField } from './FormFields';
import { displayPhoneFromE164, toE164 } from '../lib/phone';

/**
 * Collects a phone number and emits E.164 + ISO for API payloads.
 * value shape: { phoneE164, phoneIso } or plain string (legacy).
 */
export default function PhoneNumberField({
  label,
  value,
  onChange,
  defaultIso = 'RW',
  placeholder = '078xxxxxxx',
  error,
}) {
  const display = typeof value === 'string'
    ? value
    : displayPhoneFromE164(value?.phoneE164 || '', value?.display || '');

  return (
    <TextField
      label={label}
      value={display}
      error={error}
      placeholder={placeholder}
      keyboardType="phone-pad"
      onChangeText={(text) => {
        const normalized = toE164(text, defaultIso);
        onChange({
          ...normalized,
          display: text,
        });
      }}
    />
  );
}
