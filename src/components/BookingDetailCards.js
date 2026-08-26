import { StyleSheet, Text, View } from 'react-native';
import useThemedStyles from '../theme/useThemedStyles';
import { getBookingDetailSections, hasBookingDetailSections } from '../lib/bookingDetailDisplay';

function FieldGrid({ rows, styles }) {
  if (!rows?.length) return null;
  return (
    <View style={styles.grid}>
      {rows.map((row, index) => (
        <View key={`${row.label}-${index}`} style={styles.cell}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function SectionCard({ title, children, styles }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

export default function BookingDetailCards({ details, title = 'Submitted details' }) {
  const { styles } = useThemedStyles(createStyles);
  const sections = getBookingDetailSections(details);
  if (!hasBookingDetailSections(sections)) return null;

  return (
    <View style={styles.wrap}>
      {sections.fields.length ? (
        <SectionCard title={title} styles={styles}>
          <FieldGrid rows={sections.fields} styles={styles} />
        </SectionCard>
      ) : null}
      {sections.stay.length ? (
        <SectionCard title="Stay details" styles={styles}>
          <FieldGrid rows={sections.stay} styles={styles} />
        </SectionCard>
      ) : null}
      {sections.location.length ? (
        <SectionCard title="Customer location" styles={styles}>
          <FieldGrid rows={sections.location} styles={styles} />
        </SectionCard>
      ) : null}
      {sections.consumption.length ? (
        <SectionCard title="Schedule" styles={styles}>
          <FieldGrid rows={sections.consumption} styles={styles} />
        </SectionCard>
      ) : null}
      {sections.rules.length ? (
        <SectionCard title="Provider rules" styles={styles}>
          {sections.rules.map((rule, index) => (
            <View key={`${rule}-${index}`} style={styles.rule}>
              <Text style={styles.value}>{rule}</Text>
            </View>
          ))}
        </SectionCard>
      ) : null}
      {sections.custom.length ? (
        <SectionCard title="Form answers" styles={styles}>
          <FieldGrid rows={sections.custom} styles={styles} />
        </SectionCard>
      ) : null}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  wrap: { gap: 10, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  title: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    backgroundColor: colors.surfaceMuted || colors.background,
    borderRadius: 10,
    flexGrow: 1,
    minWidth: '46%',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  label: { color: colors.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  value: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 3 },
  rule: {
    backgroundColor: colors.surfaceMuted || colors.background,
    borderRadius: 10,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
