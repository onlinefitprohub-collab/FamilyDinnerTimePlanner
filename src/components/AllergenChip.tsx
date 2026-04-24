import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Allergen } from '../types';
import { ALLERGEN_LABELS } from '../utils/allergens';

interface Props {
  allergen: Allergen;
  small?: boolean;
}

const ALLERGEN_COLOURS: Record<Allergen, string> = {
  celery: '#7CB77A',
  gluten: '#D4A843',
  crustaceans: '#E07040',
  eggs: '#E8C840',
  fish: '#4A90D9',
  lupin: '#9B7DC8',
  milk: '#A8D4E6',
  molluscs: '#6B8FA8',
  mustard: '#C8B420',
  peanuts: '#B87040',
  sesame: '#C4A870',
  soybeans: '#7DAF5A',
  sulphites: '#C46060',
  'tree-nuts': '#8B6B3D',
};

function getTextColour(bg: string): string {
  // Convert hex to RGB to calculate luminance
  const hex = bg.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? '#1A2B4A' : '#FFFFFF';
}

export default function AllergenChip({ allergen, small = false }: Props): React.ReactElement {
  const bg = ALLERGEN_COLOURS[allergen];
  const textColour = getTextColour(bg);
  const label = ALLERGEN_LABELS[allergen] ?? allergen;

  return (
    <View style={[styles.chip, { backgroundColor: bg }, small && styles.chipSmall]}>
      <Text
        style={[styles.text, { color: textColour }, small && styles.textSmall]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  chipSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  textSmall: {
    fontSize: 9,
    fontWeight: '600',
  },
});
