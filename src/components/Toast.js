import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';

const ICONS = {
  error: 'alert-circle',
  success: 'check-circle',
  info: 'info',
  warning: 'alert-triangle',
};

/**
 * Lightweight toast host for step validation / routing feedback.
 * Usage: const { toastNode, showToast } = useToast();
 */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const hideToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  const showToast = useCallback((message, tone = 'error', durationMs = 3200) => {
    if (!message) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message: String(message), tone });
    timerRef.current = setTimeout(() => setToast(null), durationMs);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return {
    showToast,
    hideToast,
    toastNode: toast ? <ToastBanner message={toast.message} tone={toast.tone} /> : null,
  };
}

function ToastBanner({ message, tone = 'error' }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  const accent = tone === 'success'
    ? colors.success
    : tone === 'warning'
      ? colors.warning
      : tone === 'info'
        ? colors.primary
        : colors.danger;
  const surface = tone === 'success'
    ? colors.successSurface
    : tone === 'warning'
      ? colors.warningSurface
      : tone === 'info'
        ? colors.infoSurface || colors.primaryLight
        : colors.dangerSurface;

  return (
    <View pointerEvents="none" style={styles.host}>
      <Animated.View
        style={[
          styles.banner,
          {
            backgroundColor: surface,
            borderColor: accent,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Feather name={ICONS[tone] || ICONS.error} size={16} color={accent} />
        <Text style={[styles.text, { color: colors.text }]} numberOfLines={3}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    left: 14,
    position: 'absolute',
    right: 14,
    top: 54,
    zIndex: 1000,
  },
  banner: {
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    elevation: 6,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
});

export default ToastBanner;
