import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { lightColors } from '../theme/colors';
import { baseInputStyle, passwordFieldStyle } from '../theme/inputStyles';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

export default function HeroSearch() {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();

  return (
    <View style={styles.hero}>
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1000&q=80' }}
        style={styles.heroImage}
      />
      <View style={styles.tint} />
      <Text style={styles.title}>{t('legacyComponents.heroTitle')}</Text>

      <View style={styles.searchBox}>
        <Feather name="search" size={21} color={colors.muted} />
        <TextInput
          placeholder={t('legacyComponents.heroSearch')}
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>

      <TouchableOpacity style={styles.categoryButton} activeOpacity={0.85}>
        <View style={styles.categoryLeft}>
          <Feather name="grid" size={20} color={colors.primary} />
          <Text style={styles.categoryText}>{t('legacyComponents.allCategories')}</Text>
        </View>
        <Feather name="chevron-down" size={22} color={colors.primaryDark} />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  hero: {
    marginHorizontal: 18,
    borderRadius: 22,
    overflow: 'hidden',
    padding: 20,
    minHeight: 260,
    backgroundColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.68,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 55, 135, 0.58)',
  },
  title: {
    color: colors.white,
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 32,
    maxWidth: '88%',
    marginBottom: 22,
  },
  searchBox: {
    alignItems: 'center',
    ...baseInputStyle(colors),
    borderRadius: 17,
    flexDirection: 'row',
    height: 52,
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  input: {
    ...passwordFieldStyle(colors),
    flex: 1,
    fontSize: 15,
    marginLeft: 10,
  },
  categoryButton: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 54,
    borderRadius: 17,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
  },
  categoryLeft: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  categoryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
});
