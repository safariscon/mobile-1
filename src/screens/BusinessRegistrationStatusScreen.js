import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

export default function BusinessRegistrationStatusScreen({ onEdit }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const status = user?.businessStatus || user?.businessReviewStatus || 'pending';
  const isRejected = status === 'rejected';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Feather name={isRejected ? 'alert-circle' : 'clock'} size={32} color={isRejected ? '#DC2626' : colors.primary} />
        <Text style={styles.title}>{isRejected ? t('businessRegistration.needsUpdates') : t('businessRegistration.underReview')}</Text>
        <Text style={styles.text}>
          {isRejected
            ? t('businessRegistration.rejectedText')
            : t('businessRegistration.reviewText')}
        </Text>
        <Text style={styles.status}>{t('businessRegistration.status')}: {status}</Text>

        <TouchableOpacity style={styles.button} onPress={refreshUser} activeOpacity={0.86}>
          <Text style={styles.buttonText}>{t('businessRegistration.refreshStatus')}</Text>
        </TouchableOpacity>
        {isRejected ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={onEdit} activeOpacity={0.86}>
            <Text style={styles.secondaryButtonText}>{t('businessRegistration.correct')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 22,
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
    marginTop: 14,
    textAlign: 'center',
  },
  text: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    textAlign: 'center',
  },
  status: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 14,
    textTransform: 'uppercase',
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 9,
    height: 44,
    justifyContent: 'center',
    marginTop: 18,
    width: '100%',
  },
  buttonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 9,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    marginTop: 10,
    width: '100%',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
});
