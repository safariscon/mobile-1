import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';

const ICONS = {
  success: 'check-circle',
  error: 'alert-circle',
  confirm: 'help-circle',
  info: 'info',
};

export default function AppDialog({
  visible,
  title,
  message,
  tone = 'info',
  confirmLabel = 'OK',
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
}) {
  const { colors } = useTheme();
  if (!visible) return null;
  const icon = ICONS[tone] || ICONS.info;
  const iconColor = tone === 'success' ? colors.success : tone === 'error' || destructive ? colors.danger : colors.primary;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={loading ? undefined : onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
          <View style={[styles.iconWrap, { backgroundColor: `${iconColor}22` }]}>
            <Feather name={icon} size={22} color={iconColor} />
          </View>
          <Text style={[styles.title, { color: colors.textStrong }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: colors.muted }]}>{message}</Text> : null}
          <View style={styles.actions}>
            {cancelLabel ? (
              <TouchableOpacity style={[styles.button, { backgroundColor: colors.surfaceMuted }]} onPress={onClose} disabled={loading} activeOpacity={0.86}>
                <Text style={[styles.buttonText, { color: colors.text }]}>{cancelLabel}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: destructive ? colors.danger : colors.primary, flex: cancelLabel ? 1 : undefined }]}
              onPress={onConfirm || onClose}
              disabled={loading}
              activeOpacity={0.86}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(2, 6, 23, 0.55)', flex: 1, justifyContent: 'center', padding: 22 },
  sheet: { borderRadius: 18, maxWidth: 420, padding: 18, width: '100%' },
  iconWrap: { alignItems: 'center', alignSelf: 'center', borderRadius: 16, height: 44, justifyContent: 'center', marginBottom: 12, width: 44 },
  title: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  message: { fontSize: 13, fontWeight: '700', lineHeight: 20, marginTop: 8, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  button: { alignItems: 'center', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 46, paddingHorizontal: 12 },
  buttonText: { fontSize: 14, fontWeight: '900' },
});

export function useAppDialog() {
  const [dialog, setDialog] = useState({ visible: false });
  const closeDialog = useCallback(() => setDialog({ visible: false }), []);

  const showResult = useCallback((title, message, tone = 'success') => {
    setDialog({
      visible: true,
      title,
      message,
      tone,
      confirmLabel: 'OK',
      onConfirm: closeDialog,
      onClose: closeDialog,
    });
  }, [closeDialog]);

  const askConfirm = useCallback((options) => {
    setDialog({
      visible: true,
      tone: 'confirm',
      cancelLabel: 'Cancel',
      confirmLabel: 'Confirm',
      onClose: closeDialog,
      ...options,
    });
  }, [closeDialog]);

  return {
    dialog,
    closeDialog,
    showResult,
    askConfirm,
    dialogNode: (
      <AppDialog
        visible={!!dialog.visible}
        title={dialog.title}
        message={dialog.message}
        tone={dialog.tone}
        confirmLabel={dialog.confirmLabel}
        cancelLabel={dialog.cancelLabel}
        destructive={dialog.destructive}
        loading={dialog.loading}
        onConfirm={dialog.onConfirm}
        onClose={dialog.onClose || closeDialog}
      />
    ),
  };
}
