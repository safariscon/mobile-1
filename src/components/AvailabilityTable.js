import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import useThemedStyles from '../theme/useThemedStyles';
import { formatMoney, numberFrom } from '../lib/serviceMapper';
import { baseInputStyle } from '../theme/inputStyles';

export default function AvailabilityTable({ table, emptyText = 'No options are available yet.' }) {
  const { colors, styles } = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('service');
  const [sortDirection, setSortDirection] = useState('asc');

  const columns = table?.columns || [];
  const rows = table?.rows || [];

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let nextRows = rows;
    if (normalizedQuery) {
      nextRows = rows.filter((row) => {
        const haystack = [
          row.optionName,
          ...Object.values(row.cells || {}),
        ].map((value) => String(value || '').toLowerCase()).join(' ');
        return haystack.includes(normalizedQuery);
      });
    }

    const sorted = [...nextRows].sort((left, right) => {
      const leftValue = sortKey === 'price'
        ? numberFrom(left.price)
        : String(sortKey === 'service' ? left.optionName : left.cells?.[sortKey] || '').toLowerCase();
      const rightValue = sortKey === 'price'
        ? numberFrom(right.price)
        : String(sortKey === 'service' ? right.optionName : right.cells?.[sortKey] || '').toLowerCase();
      if (leftValue < rightValue) return sortDirection === 'asc' ? -1 : 1;
      if (leftValue > rightValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [query, rows, sortDirection, sortKey]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  if (!rows.length) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <Feather name="search" size={15} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search options..."
          placeholderTextColor={colors.muted}
          style={[styles.searchInput, baseInputStyle(colors)]}
        />
      </View>

      <ScrollableHeader columns={columns} sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} styles={styles} colors={colors} />

      <View style={styles.rowList}>
        {filteredRows.map((row) => (
          <View key={row.id} style={styles.rowCard}>
            <View style={styles.rowTop}>
              <Text style={styles.rowTitle}>{row.optionName}</Text>
              <Text style={styles.rowPrice}>{row.priceText || formatMoney(row.price)}</Text>
            </View>
            {columns
              .filter((column) => !['service', 'name', 'option', 'price'].includes(column.id))
              .map((column) => {
                const value = row.cells?.[column.id];
                if (value === undefined || value === null || value === '') return null;
                return (
                  <View key={`${row.id}-${column.id}`} style={styles.cellChip}>
                    <Text style={styles.cellLabel}>{column.label}</Text>
                    <Text style={styles.cellValue}>{String(value)}</Text>
                  </View>
                );
              })}
          </View>
        ))}
      </View>
    </View>
  );
}

function ScrollableHeader({ columns, sortKey, sortDirection, onSort, styles, colors }) {
  const sortableColumns = [
    { id: 'service', label: 'Option' },
    ...columns.filter((column) => !['service', 'name', 'option'].includes(column.id)),
  ].slice(0, 4);

  return (
    <View style={styles.headerRow}>
      {sortableColumns.map((column) => {
        const active = sortKey === column.id || (column.id === 'service' && ['service', 'name', 'option'].includes(sortKey));
        return (
          <TouchableOpacity key={column.id} style={styles.headerButton} onPress={() => onSort(column.id)} activeOpacity={0.84}>
            <Text style={[styles.headerText, active && styles.headerTextActive]}>{column.label}</Text>
            {active ? <Feather name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'} size={12} color={colors.primary} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  wrap: { gap: 10 },
  searchRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    minHeight: 42,
    paddingVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  headerText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  headerTextActive: {
    color: colors.primary,
  },
  rowList: { gap: 10 },
  rowCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  rowTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  rowTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  rowPrice: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  cellChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cellLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  cellValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
});
