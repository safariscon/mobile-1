import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

const badges = [
  { titleKey: 'legacyComponents.verifiedProviders', textKey: 'legacyComponents.verifiedProvidersText', icon: 'shield' },
  { titleKey: 'legacyComponents.support', textKey: 'legacyComponents.supportText', icon: 'headphones' },
  { titleKey: 'legacyComponents.securePayments', textKey: 'legacyComponents.securePaymentsText', icon: 'lock' },
];

export default function TrustBadges() {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {badges.map((badge) => {
        return (
          <View key={badge.titleKey} style={styles.badge}>
            <Feather name={badge.icon} size={27} color={colors.primary} />
            <View style={styles.copy}>
              <Text style={styles.title}>{t(badge.titleKey)}</Text>
              <Text style={styles.text}>{t(badge.textKey)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    marginHorizontal: 18,
    marginTop: 28,
    marginBottom: 22,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  badge: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  copy: {
    marginLeft: 12,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  text: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
});
