import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';

export default function OverflowMenu({ visible, title = 'Actions', items = [], onClose }) {
  const { colors } = useTheme();
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
          <Text style={[styles.title, { color: colors.textStrong }]}>{title}</Text>
          {items.filter(Boolean).map((item) => {
            const color = item.destructive ? colors.danger : colors.text;
            return (
              <TouchableOpacity
                key={item.key || item.label}
                style={[styles.row, { backgroundColor: colors.surfaceMuted }]}
                onPress={() => {
                  onClose();
                  item.onPress?.();
                }}
                activeOpacity={0.86}
              >
                <Feather name={item.icon || 'circle'} size={16} color={color} />
                <Text style={[styles.label, { color }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.cancel} onPress={onClose} activeOpacity={0.86}>
            <Text style={[styles.cancelText, { color: colors.muted }]}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function MenuTrigger({ onPress }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity style={[styles.trigger, { backgroundColor: colors.surfaceMuted }]} onPress={onPress} activeOpacity={0.84}>
      <Feather name="more-vertical" size={16} color={colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(2, 6, 23, 0.5)', flex: 1, justifyContent: 'flex-end', padding: 16 },
  sheet: { borderRadius: 18, padding: 14, paddingBottom: 10, width: '100%' },
  title: { fontSize: 16, fontWeight: '900', marginBottom: 10, paddingHorizontal: 4 },
  row: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 10, marginTop: 8, minHeight: 48, paddingHorizontal: 12 },
  label: { flex: 1, fontSize: 14, fontWeight: '800' },
  cancel: { alignItems: 'center', minHeight: 44, justifyContent: 'center', marginTop: 6 },
  cancelText: { fontSize: 13, fontWeight: '800' },
  trigger: { alignItems: 'center', borderRadius: 10, height: 32, justifyContent: 'center', width: 32 },
});
