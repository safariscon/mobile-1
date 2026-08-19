import { Platform } from 'react-native';

/** Neutralizes browser autofill painting light backgrounds on web. */
export function webInputCompat(colors) {
  if (Platform.OS !== 'web') return {};
  return {
    outlineStyle: 'none',
    boxShadow: `0 0 0 1000px ${colors.input} inset`,
    WebkitBoxShadow: `0 0 0 1000px ${colors.input} inset`,
    WebkitTextFillColor: colors.text,
  };
}

export function baseInputStyle(colors, extra = {}) {
  return {
    backgroundColor: colors.input,
    borderColor: colors.border,
    color: colors.text,
    ...webInputCompat(colors),
    ...extra,
  };
}

export function passwordFieldStyle(colors, extra = {}) {
  return {
    backgroundColor: 'transparent',
    color: colors.text,
    ...webInputCompat(colors),
    ...extra,
  };
}
