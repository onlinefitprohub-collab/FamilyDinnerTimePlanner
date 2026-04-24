import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Supermarket } from '../types';

interface Props {
  supermarket: Supermarket;
  price?: number;
  small?: boolean;
}

const COLOURS: Record<Supermarket, { bg: string; text: string }> = {
  'Tesco': { bg: '#005EB8', text: '#FFFFFF' },
  "Sainsbury's": { bg: '#F06C00', text: '#FFFFFF' },
  'Asda': { bg: '#78BE20', text: '#FFFFFF' },
  'Morrisons': { bg: '#FFD700', text: '#1A1A1A' },
  'Lidl': { bg: '#0050AA', text: '#FFFFFF' },
  'Aldi': { bg: '#00539B', text: '#FFFFFF' },
};

export default function SupermarketChip({ supermarket, price, small = false }: Props): React.ReactElement {
  const colours = COLOURS[supermarket];
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: colours.bg },
        small && styles.chipSmall,
      ]}
    >
      <Text
        style={[
          styles.name,
          { color: colours.text },
          small && styles.nameSmall,
        ]}
        numberOfLines={1}
      >
        {supermarket}
      </Text>
      {price !== undefined && (
        <Text
          style={[
            styles.price,
            { color: colours.text },
            small && styles.priceSmall,
          ]}
        >
          £{price.toFixed(2)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 5,
    alignSelf: 'flex-start',
  },
  chipSmall: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  name: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  nameSmall: {
    fontSize: 10,
    fontWeight: '700',
  },
  price: {
    fontSize: 12,
    fontWeight: '500',
  },
  priceSmall: {
    fontSize: 10,
  },
});
