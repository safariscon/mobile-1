import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function useThemedStyles(createStyles) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, createStyles, isDark]);
  return { colors, isDark, styles };
}
