import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  costPerPerson: number;
  showLabel?: boolean;
}

function getBadgeColour(cost: number): string {
  if (cost < 1.5) return '#8FAF7E';
  if (cost <= 3.0) return '#E8A020';
  return '#C0392B';
}

export default function CostBadge({ costPerPerson, showLabel = false }: Props): React.ReactElement {
  const bg = getBadgeColour(costPerPerson);
  const isLight = bg === '#E8A020';
  const textColour = isLight ? '#1A2B4A' : '#FFFFFF';

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {showLabel && (
        <Text style={[styles.label, { color: textColour }]}>Cost: </Text>
      )}
      <Text style={[styles.price, { color: textColour }]}>
        £{costPerPerson.toFixed(2)} pp
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
  price: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
