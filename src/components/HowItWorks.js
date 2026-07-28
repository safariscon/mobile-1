import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

const steps = [
  { titleKey: 'legacyComponents.searchExplore', textKey: 'legacyComponents.searchExploreText', icon: 'search' },
  { titleKey: 'legacyComponents.selectBook', textKey: 'legacyComponents.selectBookText', icon: 'send' },
  { titleKey: 'legacyComponents.paySecurely', textKey: 'legacyComponents.paySecurelyText', icon: 'credit-card' },
  { titleKey: 'legacyComponents.enjoyService', textKey: 'legacyComponents.enjoyServiceText', icon: 'lock' },
];

export default function HowItWorks() {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t('legacyComponents.howWorks')}</Text>
      <View style={styles.grid}>
        {steps.map((step, index) => {
          return (
            <View key={step.titleKey} style={styles.card}>
              <View style={styles.iconCircle}>
                <Feather name={step.icon} size={31} color={colors.primary} />
              </View>
              <View style={styles.number}>
                <Text style={styles.numberText}>{index + 1}</Text>
              </View>
              <Text style={styles.title}>{t(step.titleKey)}</Text>
              <Text style={styles.text}>{t(step.textKey)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  section: {
    marginTop: 24,
    paddingHorizontal: 18,
  },
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  card: {
    width: '48%',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 17,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  iconCircle: {
    height: 58,
    width: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  number: {
    height: 25,
    width: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginTop: 8,
    marginBottom: 9,
  },
  numberText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  text: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
    textAlign: 'center',
  },
});
