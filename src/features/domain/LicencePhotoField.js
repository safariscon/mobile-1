import { useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { uploadCustomerDocument } from '../../api/documents';
import useThemedStyles from '../../theme/useThemedStyles';

/**
 * Single licence / permit photo. Uploads immediately so the booking payload
 * only ever carries a URL.
 */
export default function LicencePhotoField({ label, help, value, error, onChange }) {
  const { t } = useTranslation();
  const { colors, styles } = useThemedStyles(createStyles);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const pick = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('common.permissionRequired'), t('domain.transport.licence.permission'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (result.canceled || !result.assets?.length) return;
      setUploadError('');
      setUploading(true);
      const url = await uploadCustomerDocument(result.assets[0]);
      onChange(url);
    } catch (requestError) {
      setUploadError(requestError.message || t('domain.transport.licence.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const shownError = uploadError || error;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {value ? (
        <Image source={{ uri: value }} style={styles.preview} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>{t('domain.transport.licence.noPhoto')}</Text>
        </View>
      )}
      <View style={styles.actions}>
        <TouchableOpacity onPress={pick} disabled={uploading} activeOpacity={0.84} style={styles.button}>
          {uploading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>
              {value ? t('domain.transport.licence.replace') : t('domain.transport.licence.upload')}
            </Text>
          )}
        </TouchableOpacity>
        {value ? (
          <TouchableOpacity onPress={() => onChange('')} activeOpacity={0.84} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{t('domain.transport.licence.remove')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {!!help && <Text style={styles.help}>{help}</Text>}
      {!!shownError && <Text style={styles.error}>{shownError}</Text>}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  wrap: { marginTop: 13 },
  label: { color: colors.text, fontSize: 12, fontWeight: '900', marginBottom: 7 },
  preview: { borderRadius: 10, height: 140, width: '100%' },
  placeholder: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt || colors.background,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 140,
    justifyContent: 'center',
  },
  placeholderText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 130,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  secondaryButton: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  help: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 6 },
  error: { color: colors.danger, fontSize: 11, fontWeight: '800', marginTop: 6 },
});
