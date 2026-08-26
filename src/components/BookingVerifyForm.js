import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { lightColors } from '../theme/colors';
import { baseInputStyle } from '../theme/inputStyles';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

export default function BookingVerifyForm({
  value,
  onChangeText,
  onVerify,
  onScan,
  loading = false,
  label,
  placeholder = 'SCN-XXXX',
}) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label || t('seller.bookingCode')}</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.scanBtn} onPress={onScan} activeOpacity={0.84}>
          <Feather name="camera" size={18} color={colors.primary} />
        </TouchableOpacity>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={onVerify}
          style={styles.input}
        />
        <TouchableOpacity style={[styles.verifyBtn, loading && styles.verifyBtnDisabled]} onPress={onVerify} disabled={loading} activeOpacity={0.86}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.verifyBtnText}>{t('actions.verify')}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  group: {
    marginBottom: 10,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 5,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  scanBtn: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  input: {
    ...baseInputStyle(colors),
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    height: 48,
    paddingHorizontal: 14,
  },
  verifyBtn: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    minWidth: 88,
    paddingHorizontal: 14,
  },
  verifyBtnDisabled: {
    opacity: 0.72,
  },
  verifyBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
});
