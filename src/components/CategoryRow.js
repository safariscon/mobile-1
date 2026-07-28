import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import categories from '../data/categories';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

export default function CategoryRow() {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {categories.map((category) => {
        return (
          <TouchableOpacity key={category.id} style={styles.item} activeOpacity={0.8}>
            <Feather name={category.icon} size={28} color={colors.primary} />
            <Text style={styles.label}>{t(category.labelKey)}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    marginHorizontal: 18,
    marginTop: 18,
    paddingHorizontal: 8,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  item: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 9,
    minHeight: 32,
    textAlign: 'center',
  },
});
