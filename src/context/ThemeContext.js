import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors } from '../theme/colors';

const THEME_KEY = 'safariscon.theme';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemMode = useColorScheme();
  const [mode, setMode] = useState(() => systemMode === 'dark' ? 'dark' : 'light');
  const isDark = mode === 'dark';
  const colors = isDark ? darkColors : lightColors;

  useEffect(() => {
    let mounted = true;
    SecureStore.getItemAsync(THEME_KEY)
      .then((storedMode) => {
        if (mounted) {
          if (['light', 'dark'].includes(storedMode)) setMode(storedMode);
          else setMode(systemMode === 'dark' ? 'dark' : 'light');
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [systemMode]);

  const setThemeMode = useCallback(async (nextMode) => {
    const safeMode = nextMode === 'dark' ? 'dark' : 'light';
    setMode(safeMode);
    await SecureStore.setItemAsync(THEME_KEY, safeMode).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeMode(isDark ? 'light' : 'dark');
  }, [isDark, setThemeMode]);

  const value = useMemo(() => ({
    colors,
    isDark,
    mode,
    setThemeMode,
    toggleTheme,
  }), [colors, isDark, mode, setThemeMode, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      colors: lightColors,
      isDark: false,
      mode: 'light',
      setThemeMode: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}
