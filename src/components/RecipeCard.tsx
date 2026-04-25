import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AnyRecipe, AllergenConflict } from '../types';
import CostBadge from './CostBadge';
import AllergenChip from './AllergenChip';
import { calculateRecipeCost } from '../utils/pricing';
import { getActiveDealsForRecipe, isRecipeInSeason } from '../utils/seasonal';
import { ingredients as allIngredients } from '../data/ingredients';

interface Props {
  recipe: AnyRecipe;
  familySize: number;
  onPress: () => void;
  onFavouriteToggle?: () => void;
  isFavourite?: boolean;
  familyConflicts?: AllergenConflict[];
  rating?: number;
}

const DIFFICULTY_COLOURS: Record<string, { bg: string; text: string }> = {
  easy: { bg: '#8FAF7E', text: '#FFFFFF' },
  medium: { bg: '#E8A020', text: '#1A2B4A' },
  hard: { bg: '#C0392B', text: '#FFFFFF' },
};

const DIETARY_COLOURS: Record<string, { bg: string; text: string }> = {
  vegetarian: { bg: '#8FAF7E', text: '#FFFFFF' },
  vegan: { bg: '#4A7A4A', text: '#FFFFFF' },
  glutenFree: { bg: '#E8A020', text: '#1A2B4A' },
  dairyFree: { bg: '#4A90D9', text: '#FFFFFF' },
};

export default function RecipeCard({
  recipe,
  familySize,
  onPress,
  onFavouriteToggle,
  isFavourite = false,
  familyConflicts,
  rating,
}: Props): React.ReactElement {
  const currentMonth = new Date().getMonth() + 1;
  const totalCost = calculateRecipeCost(recipe, allIngredients, familySize);
  const costPerPerson = totalCost / familySize;
  const activeDeals = getActiveDealsForRecipe(recipe);
  const inSeason = isRecipeInSeason(recipe, currentMonth);

  const visibleAllergens = recipe.allergens.slice(0, 3);
  const extraAllergenCount = recipe.allergens.length - 3;

  const difficultyColour = DIFFICULTY_COLOURS[recipe.difficulty] ?? DIFFICULTY_COLOURS['easy'];
  const totalTime = recipe.prepTime + recipe.cookTime;

  const sourceBadge = 'source' in recipe
    ? (recipe as { source: string }).source === 'custom' ? 'My Recipe'
    : 'Imported'
    : null;

  const dietaryTags: { key: string; label: string }[] = [];
  if (recipe.dietaryInfo.vegetarian) dietaryTags.push({ key: 'vegetarian', label: 'VG' });
  if (recipe.dietaryInfo.vegan) dietaryTags.push({ key: 'vegan', label: 'V' });
  if (recipe.dietaryInfo.glutenFree) dietaryTags.push({ key: 'glutenFree', label: 'GF' });
  if (recipe.dietaryInfo.dairyFree) dietaryTags.push({ key: 'dairyFree', label: 'DF' });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${recipe.name}, ${recipe.difficulty}, ${totalTime} minutes`}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: recipe.image }}
          style={styles.image}
          contentFit="cover"
          placeholder={{ color: '#E5E7EB' }}
          transition={200}
        />
        {/* Badges overlay */}
        <View style={styles.imageOverlayTop}>
          {recipe.freezerFriendly && (
            <View style={styles.freezerBadge}>
              <Text style={styles.freezerText}>❄️</Text>
            </View>
          )}
          {inSeason && (
            <View style={styles.seasonalBadge}>
              <Text style={styles.seasonalText}>Seasonal</Text>
            </View>
          )}
          {sourceBadge && (
            <View style={[styles.sourceBadge, sourceBadge === 'My Recipe' && styles.sourceBadgeMine]}>
              <Text style={styles.sourceBadgeText}>{sourceBadge}</Text>
            </View>
          )}
        </View>
        {/* Favourite button */}
        <Pressable
          onPress={onFavouriteToggle}
          style={({ pressed }) => [styles.heartButton, pressed && styles.heartButtonPressed]}
          hitSlop={8}
          accessibilityLabel={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
          accessibilityRole="button"
        >
          <Ionicons
            name={isFavourite ? 'heart' : 'heart-outline'}
            size={20}
            color={isFavourite ? '#C0392B' : '#FFFFFF'}
          />
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Name */}
        <Text style={styles.name} numberOfLines={1}>
          {recipe.name}
        </Text>

        {/* Description */}
        <Text style={styles.description} numberOfLines={2}>
          {recipe.description}
        </Text>

        {/* Meta row: difficulty + time */}
        <View style={styles.metaRow}>
          <View style={[styles.difficultyBadge, { backgroundColor: difficultyColour.bg }]}>
            <Text style={[styles.difficultyText, { color: difficultyColour.text }]}>
              {recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}
            </Text>
          </View>
          <View style={styles.timeChip}>
            <Ionicons name="time-outline" size={12} color="#6B7280" />
            <Text style={styles.timeText}>{totalTime}m</Text>
          </View>
        </View>

        {/* Dietary tags */}
        {dietaryTags.length > 0 && (
          <View style={styles.tagRow}>
            {dietaryTags.map((tag) => {
              const col = DIETARY_COLOURS[tag.key] ?? { bg: '#E5E7EB', text: '#1A2B4A' };
              return (
                <View key={tag.key} style={[styles.dietaryTag, { backgroundColor: col.bg }]}>
                  <Text style={[styles.dietaryTagText, { color: col.text }]}>{tag.label}</Text>
                </View>
              );
            })}
            {activeDeals.length > 0 && (
              <View style={styles.dealChip}>
                <Text style={styles.dealChipText}>Deals</Text>
              </View>
            )}
          </View>
        )}

        {/* Cost + rating row */}
        <View style={styles.costRow}>
          <CostBadge costPerPerson={costPerPerson} />
          {rating !== undefined && rating > 0 && (
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={10}
                  color="#E8A020"
                />
              ))}
            </View>
          )}
        </View>

        {/* Allergen chips */}
        {visibleAllergens.length > 0 && (
          <View style={styles.allergenRow}>
            {visibleAllergens.map((allergen) => (
              <AllergenChip key={allergen} allergen={allergen} small />
            ))}
            {extraAllergenCount > 0 && (
              <View style={styles.moreAllergens}>
                <Text style={styles.moreAllergensText}>+{extraAllergenCount}</Text>
              </View>
            )}
          </View>
        )}

        {/* Family conflict indicators */}
        {familyConflicts && familyConflicts.length > 0 && (
          <View style={styles.conflictRow}>
            {familyConflicts.map((conflict) => {
              const isDanger = conflict.conflictType === 'allergen' && conflict.allergens.length > 0;
              return (
                <View
                  key={conflict.memberId}
                  style={[styles.conflictChip, isDanger ? styles.conflictChipDanger : styles.conflictChipWarning]}
                >
                  <Text style={styles.conflictChipText}>{conflict.memberName.charAt(0)}</Text>
                </View>
              );
            })}
            <Text style={styles.conflictLabel}>
              {familyConflicts.length === 1
                ? `${familyConflicts[0].memberName} may not like this`
                : `${familyConflicts.length} family conflicts`}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    margin: 8,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.93,
    transform: [{ scale: 0.98 }],
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 130,
    backgroundColor: '#E5E7EB',
  },
  imageOverlayTop: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'column',
    gap: 4,
  },
  freezerBadge: {
    backgroundColor: 'rgba(26, 43, 74, 0.75)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  freezerText: {
    fontSize: 12,
  },
  seasonalBadge: {
    backgroundColor: '#8FAF7E',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  seasonalText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sourceBadge: {
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sourceBadgeMine: {
    backgroundColor: '#E8A020',
  },
  sourceBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  heartButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartButtonPressed: {
    opacity: 0.7,
  },
  content: {
    padding: 10,
    gap: 6,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A2B4A',
    lineHeight: 18,
  },
  description: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  difficultyBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeText: {
    fontSize: 11,
    color: '#6B7280',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  dietaryTag: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dietaryTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  dealChip: {
    backgroundColor: '#E8A020',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dealChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  starRow: {
    flexDirection: 'row',
    gap: 1,
  },
  allergenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  moreAllergens: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  moreAllergensText: {
    fontSize: 9,
    color: '#6B7280',
    fontWeight: '600',
  },
  conflictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  conflictChip: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conflictChipDanger: {
    backgroundColor: '#C0392B',
  },
  conflictChipWarning: {
    backgroundColor: '#E8A020',
  },
  conflictChipText: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  conflictLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    flex: 1,
  },
});
