import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../config/api';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

export const ANNOUNCEMENT_BAR_SPACE = 48;
export const DEFAULT_ANNOUNCEMENTS = [
  {
    text: 'Welcome to SafarisCon, the best way to get services anywhere you want across Rwanda destinations.',
    linkUrl: '/services',
    linkLabel: 'Browse services',
  },
];

const ANNOUNCEMENT_CACHE_MS = 60 * 1000;
let cachedFeed = {
  announcements: DEFAULT_ANNOUNCEMENTS,
  intervalSeconds: 5,
  loadedAt: 0,
};
let feedRequest = null;

function uniqueAnnouncements(items) {
  return items.filter((item, index, all) => (
    String(item?.text || '').trim()
    && all.findIndex((entry) => String(entry?.text || '').trim() === String(item?.text || '').trim()) === index
  ));
}

async function fetchAnnouncementFeed() {
  if (Date.now() - cachedFeed.loadedAt < ANNOUNCEMENT_CACHE_MS) return cachedFeed;
  if (feedRequest) return feedRequest;

  feedRequest = (async () => {
    try {
      const response = await apiFetch('/announcement', { timeoutMs: 4000 });
      const data = await response.json();
      if (!response.ok) throw new Error('Announcement request failed');

      const receivedItems = Array.isArray(data.announcements) && data.announcements.length
        ? data.announcements
        : data.announcement?.text
          ? [data.announcement]
          : [];
      const backendItems = data.enabled === false ? [] : receivedItems;
      cachedFeed = {
        announcements: uniqueAnnouncements([...DEFAULT_ANNOUNCEMENTS, ...backendItems]).slice(0, 5),
        intervalSeconds: Math.max(1, Number(data.intervalSeconds) || 5),
        loadedAt: Date.now(),
      };
      return cachedFeed;
    } catch (_error) {
      cachedFeed = {
        announcements: DEFAULT_ANNOUNCEMENTS,
        intervalSeconds: 5,
        loadedAt: Date.now(),
      };
      return cachedFeed;
    } finally {
      feedRequest = null;
    }
  })();

  return feedRequest;
}

export default function AnnouncementBar({ fixed = false, onBrowseServices, onVisibilityChange }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const { t } = useTranslation();
  const [announcements, setAnnouncements] = useState(cachedFeed.announcements);
  const [activeIndex, setActiveIndex] = useState(0);
  const [intervalSeconds, setIntervalSeconds] = useState(cachedFeed.intervalSeconds);

  useEffect(() => {
    let active = true;

    const loadAnnouncement = async () => {
      const feed = await fetchAnnouncementFeed();
      if (!active) return;
      setAnnouncements(feed.announcements);
      setIntervalSeconds(feed.intervalSeconds);
      setActiveIndex((current) => current % feed.announcements.length);
    };

    loadAnnouncement();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (announcements.length <= 1) return undefined;
    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % announcements.length);
    }, intervalSeconds * 1000);

    return () => clearInterval(timer);
  }, [announcements.length, intervalSeconds]);

  const activeAnnouncement = useMemo(() => announcements[activeIndex] || announcements[0], [activeIndex, announcements]);
  const isVisible = !!activeAnnouncement?.text;

  useEffect(() => {
    onVisibilityChange?.(isVisible);
  }, [isVisible, onVisibilityChange]);

  if (!isVisible) {
    return null;
  }

  return (
    <View style={[styles.bar, fixed && styles.fixedBar]}>
      <Feather name="bell" size={13} color={colors.white} />
      <Text style={styles.text} numberOfLines={2}>{activeAnnouncement.text}</Text>
      {typeof onBrowseServices === 'function' ? (
        <TouchableOpacity style={styles.linkButton} onPress={onBrowseServices} activeOpacity={0.8}>
          <Text style={styles.linkText}>{activeAnnouncement.linkLabel || t('common.browseServices')}</Text>
        </TouchableOpacity>
      ) : null}
      {announcements.length > 1 ? (
        <Text style={styles.count}>{activeIndex + 1}/{announcements.length}</Text>
      ) : null}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  bar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    marginBottom: 12,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fixedBar: {
    elevation: 12,
    left: 16,
    marginBottom: 0,
    position: 'absolute',
    right: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    top: 7,
    zIndex: 30,
  },
  text: {
    color: colors.white,
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 14,
  },
  linkButton: {
    borderBottomColor: colors.white,
    borderBottomWidth: 1,
  },
  linkText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  count: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    opacity: 0.9,
  },
});
