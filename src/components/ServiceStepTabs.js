import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import useThemedStyles from '../theme/useThemedStyles';

/** Horizontal step / tab strip shared by service view + editor. */
export default function ServiceStepTabs({
  steps = [],
  activeIndex = 0,
  onChange,
  mode = 'edit',
}) {
  const { colors, styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {steps.map((step, index) => {
          const active = index === activeIndex;
          return (
            <TouchableOpacity
              key={step.id}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => onChange?.(index, step)}
              activeOpacity={0.84}
            >
              <Feather name={step.icon || 'circle'} size={13} color={active ? colors.white : colors.muted} />
              <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                {index + 1}. {step.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {mode === 'edit' ? (
        <View style={styles.progressRow}>
          {steps.map((step, index) => (
            <View
              key={`bar-${step.id}`}
              style={[styles.bar, { backgroundColor: index <= activeIndex ? colors.primary : colors.border }]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  wrap: { marginBottom: 12 },
  row: { gap: 8, paddingVertical: 2 },
  tab: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  tabTextActive: { color: colors.white },
  progressRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  bar: { borderRadius: 99, flex: 1, height: 5 },
});
