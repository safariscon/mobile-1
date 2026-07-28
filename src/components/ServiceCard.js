import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;
import { formatPromotionDate, getVisiblePromotion } from '../lib/promotion';

export default function ServiceCard({ service, style, onPress }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  const promotion = getVisiblePromotion(service.promotion);

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View>
        <Image source={{ uri: service.image }} style={styles.image} />
        <TouchableOpacity style={styles.heartButton} activeOpacity={0.8}>
          <Feather name="heart" size={23} color={colors.white} />
        </TouchableOpacity>
        {promotion ? (
          <View style={styles.promotionBadge}>
            <Text style={styles.promotionBadgeText}>-{promotion.percent}% Promotion</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>{service.title}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>{service.category}</Text>
          </View>
        </View>

        <View style={styles.locationRow}>
          <Feather name="map-pin" size={15} color={colors.muted} />
          <Text style={styles.location}>{service.generalLocation || service.location}</Text>
        </View>

        <Text style={styles.description} numberOfLines={3}>{service.description}</Text>

        {promotion ? (
          <View style={styles.promotionPanel}>
            <Text style={styles.promotionTitle}>{promotion.title}</Text>
            <Text style={styles.promotionText}>{promotion.status === 'scheduled' ? `Starts soon: save ${promotion.percent}% on this service.` : `Save ${promotion.percent}% on this service.`}</Text>
            {promotion.startAt || promotion.endAt ? (
              <Text style={styles.promotionDates}>
                Valid {formatPromotionDate(promotion.startAt) || 'now'} - {formatPromotionDate(promotion.endAt) || 'scheduled'}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{service.bookingMode}</Text>
          <Text style={styles.metaText}>{service.deposit}</Text>
        </View>

        <View style={styles.footer}>
          <View>
            <Text style={styles.from}>{t('legacyComponents.from')}</Text>
            <Text style={styles.price}>{service.price}<Text style={styles.night}> / {t('legacyComponents.night')}</Text></Text>
          </View>
          <View style={styles.button}>
            <Text style={styles.buttonText}>{t('legacyComponents.viewDetails')}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors) => StyleSheet.create({
  card: {
    width: 288,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  image: {
    height: 145,
    width: '100%',
  },
  heartButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    height: 34,
    width: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 24, 40, 0.36)',
  },
  promotionBadge: {
    backgroundColor: '#FBBF24',
    borderColor: '#F59E0B',
    borderRadius: 999,
    borderWidth: 1,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    top: 12,
  },
  promotionBadgeText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  body: {
    padding: 14,
  },
  titleRow: {
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  badgeText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  locationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 10,
  },
  location: {
    color: colors.muted,
    fontSize: 13,
    marginLeft: 6,
  },
  description: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    minHeight: 57,
  },
  promotionPanel: {
    backgroundColor: colors.warningSurface,
    borderColor: '#FCD34D',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    padding: 10,
  },
  promotionTitle: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '900',
  },
  promotionText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  promotionDates: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  metaText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  footer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  from: {
    color: colors.muted,
    fontSize: 11,
  },
  price: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '800',
  },
  night: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '500',
  },
  button: {
    borderRadius: 9,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
});

