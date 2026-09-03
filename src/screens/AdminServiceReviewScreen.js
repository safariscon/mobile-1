import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import ServiceDetailsView from '../components/ServiceDetailsView';
import { lightColors } from '../theme/colors';
import { baseInputStyle } from '../theme/inputStyles';
import useThemedStyles from '../theme/useThemedStyles';
import { serviceApprovalStatus } from '../lib/serviceMapper';

let colors = lightColors;
let styles;

function Field({ label, value, onChangeText, keyboardType, placeholder, multiline = false }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={[styles.input, multiline && styles.textarea]}
      />
    </View>
  );
}

export default function AdminServiceReviewScreen({
  service,
  loading = false,
  busyAction = null,
  approvalForm,
  setApprovalForm,
  onBack,
  onApprove,
  onReject,
}) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  const approval = serviceApprovalStatus(service);
  const approving = busyAction === 'approve';
  const rejecting = busyAction === 'reject';
  const busy = approving || rejecting;

  return (
    <View style={styles.screen}>
      <ServiceDetailsView
        visible
        presentation="page"
        title="Service review"
        service={service}
        loading={loading && !service}
        showProvider
        showPrivateFields
        onBack={onBack}
        footer={(
          <View style={styles.decisionCard}>
            <Text style={styles.decisionTitle}>Agreement terms (required to approve)</Text>
            <Text style={styles.decisionHelp}>
              Review every section above, then set cancel penalty and platform commission from the signed agreement.
            </Text>

            <View style={styles.fieldGrid}>
              <Field
                label="Cancel window (hours)"
                value={String(approvalForm.cancelWindowHours ?? '')}
                onChangeText={(cancelWindowHours) => setApprovalForm((current) => ({ ...current, cancelWindowHours }))}
                keyboardType="number-pad"
              />
              <Field
                label="Cancel penalty %"
                value={String(approvalForm.cancelPenaltyPercent ?? '')}
                onChangeText={(cancelPenaltyPercent) => setApprovalForm((current) => ({ ...current, cancelPenaltyPercent }))}
                keyboardType="number-pad"
              />
              <Field
                label="Platform commission %"
                value={String(approvalForm.platformCommissionPercent ?? '')}
                onChangeText={(platformCommissionPercent) => setApprovalForm((current) => ({ ...current, platformCommissionPercent }))}
                keyboardType="number-pad"
              />
            </View>

            <Field
              label="Approval notes"
              value={approvalForm.notes || ''}
              onChangeText={(notes) => setApprovalForm((current) => ({ ...current, notes }))}
              placeholder="Agreement reference, special terms…"
              multiline
            />
            <Field
              label="Rejection reason"
              value={approvalForm.reason || ''}
              onChangeText={(reason) => setApprovalForm((current) => ({ ...current, reason }))}
              placeholder="Required when rejecting"
              multiline
            />

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.rejectButton, (busy || approval === 'rejected') && styles.disabled]}
                onPress={onReject}
                disabled={busy || approval === 'rejected'}
                activeOpacity={0.86}
              >
                {rejecting ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.rejectText}>{t('actions.reject')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.approveButton, (busy || approval === 'approved') && styles.disabled]}
                onPress={onApprove}
                disabled={busy || approval === 'approved'}
                activeOpacity={0.86}
              >
                {approving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.approveText}>{t('actions.approve')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const createStyles = (themeColors) => StyleSheet.create({
  screen: { backgroundColor: themeColors.background, flex: 1 },
  decisionCard: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  decisionTitle: { color: themeColors.text, fontSize: 16, fontWeight: '900' },
  decisionHelp: { color: themeColors.muted, fontSize: 12, fontWeight: '700', lineHeight: 18, marginBottom: 12, marginTop: 6 },
  fieldGrid: { gap: 0 },
  field: { marginBottom: 10 },
  fieldLabel: { color: themeColors.text, fontSize: 12, fontWeight: '800', marginBottom: 5 },
  input: {
    ...baseInputStyle(themeColors),
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    fontWeight: '700',
    height: 46,
    paddingHorizontal: 12,
  },
  textarea: {
    height: 78,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  rejectButton: {
    alignItems: 'center',
    backgroundColor: themeColors.dangerSurface,
    borderRadius: 12,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  rejectText: { color: themeColors.danger, fontSize: 14, fontWeight: '900' },
  approveButton: {
    alignItems: 'center',
    backgroundColor: themeColors.success,
    borderRadius: 12,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  approveText: { color: themeColors.white, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
