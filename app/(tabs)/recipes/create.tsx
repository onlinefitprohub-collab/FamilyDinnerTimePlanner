import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  Switch, Alert, StyleSheet,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRecipeDataStore } from '../../../src/stores/useRecipeDataStore';
import { useAuthStore } from '../../../src/stores/useAuthStore';
import { CustomRecipe, RecipeCategory } from '../../../src/types';

const CATEGORIES: RecipeCategory[] = ['pasta', 'roast', 'curry', 'soup', 'pie', 'stir-fry', 'bake', 'grill'];

interface IngredientRow { name: string; quantity: string; unit: string; }
interface StepRow { instruction: string; }

export default function CreateRecipeScreen() {
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { addCustomRecipe, updateCustomRecipe, customRecipes } = useRecipeDataStore();
  const { user } = useAuthStore();

  const isEditing = Boolean(editId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RecipeCategory>('bake');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [vegetarian, setVegetarian] = useState(false);
  const [vegan, setVegan] = useState(false);
  const [glutenFree, setGlutenFree] = useState(false);
  const [dairyFree, setDairyFree] = useState(false);
  const [freezerFriendly, setFreezerFriendly] = useState(false);
  const [onePot, setOnePot] = useState(false);
  const [kidFriendly, setKidFriendly] = useState(false);
  const [batchNotes, setBatchNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([{ name: '', quantity: '', unit: '' }]);
  const [stepRows, setStepRows] = useState<StepRow[]>([{ instruction: '' }]);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!editId) return;
    const recipe = customRecipes.find((r) => r.id === editId);
    if (!recipe) return;
    setName(recipe.name);
    setDescription(recipe.description);
    setCategory(recipe.category as RecipeCategory);
    setDifficulty(recipe.difficulty as 'easy' | 'medium' | 'hard');
    setPrepTime(String(recipe.prepTime));
    setCookTime(String(recipe.cookTime));
    setVegetarian(recipe.dietaryInfo.vegetarian);
    setVegan(recipe.dietaryInfo.vegan);
    setGlutenFree(recipe.dietaryInfo.glutenFree);
    setDairyFree(recipe.dietaryInfo.dairyFree);
    setFreezerFriendly(recipe.freezerFriendly);
    setOnePot(recipe.onePot);
    setKidFriendly(recipe.kidFriendly);
    setBatchNotes(recipe.batchCookNotes ?? '');
    setImageUrl(recipe.image ?? '');
    setIngredientRows(
      recipe.ingredients.map((i) => ({
        name: i.ingredientId.replace(/-/g, ' '),
        quantity: String(i.quantityPer4),
        unit: i.unit,
      })),
    );
    setStepRows(recipe.steps.map((s) => ({ instruction: s.instruction })));
    if (recipe.nutritionPer4) {
      setCalories(String(recipe.nutritionPer4.calories));
      setProtein(String(recipe.nutritionPer4.protein));
      setCarbs(String(recipe.nutritionPer4.carbs));
      setFat(String(recipe.nutritionPer4.fat));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const addIngredient = () => setIngredientRows((r) => [...r, { name: '', quantity: '', unit: '' }]);
  const removeIngredient = (i: number) => setIngredientRows((r) => r.filter((_, idx) => idx !== i));
  const updateIngredient = (i: number, field: keyof IngredientRow, val: string) =>
    setIngredientRows((r) => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const addStep = () => setStepRows((r) => [...r, { instruction: '' }]);
  const removeStep = (i: number) => setStepRows((r) => r.filter((_, idx) => idx !== i));
  const updateStep = (i: number, val: string) =>
    setStepRows((r) => r.map((row, idx) => idx === i ? { instruction: val } : row));

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Recipe name is required.'); return; }
    const validIngredients = ingredientRows.filter((r) => r.name.trim());
    if (validIngredients.length === 0) { Alert.alert('Error', 'Add at least one ingredient.'); return; }
    const validSteps = stepRows.filter((r) => r.instruction.trim());
    if (validSteps.length === 0) { Alert.alert('Error', 'Add at least one step.'); return; }

    setIsSaving(true);
    const now = new Date().toISOString();
    const recipeFields = {
      name: name.trim(),
      description: description.trim(),
      category,
      tags: [],
      servesBase: 4 as const,
      prepTime: parseInt(prepTime) || 15,
      cookTime: parseInt(cookTime) || 30,
      difficulty,
      image: imageUrl.trim() || 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=800&auto=format&fit=crop',
      ingredients: validIngredients.map((r) => ({
        ingredientId: r.name.toLowerCase().replace(/\s+/g, '-'),
        quantityPer4: parseFloat(r.quantity) || 1,
        unit: r.unit || 'item',
      })),
      steps: validSteps.map((r, i) => ({ stepNumber: i + 1, instruction: r.instruction })),
      nutritionPer4: calories ? {
        calories: parseInt(calories) || 0,
        protein: parseInt(protein) || 0,
        carbs: parseInt(carbs) || 0,
        fat: parseInt(fat) || 0,
      } : null,
      dietaryInfo: { vegetarian, vegan, glutenFree, dairyFree },
      allergens: [],
      freezerFriendly,
      batchCookNotes: freezerFriendly ? batchNotes : undefined,
      onePot,
      kidFriendly,
    };

    try {
      if (isEditing && editId) {
        await updateCustomRecipe(editId, { ...recipeFields, updatedAt: now });
        Alert.alert('Recipe updated!', `"${recipeFields.name}" has been saved.`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const recipe: CustomRecipe = {
          ...recipeFields,
          id: `custom-${Date.now()}`,
          source: 'custom',
          createdAt: now,
          updatedAt: now,
          userId: user?.id ?? '',
        };
        await addCustomRecipe(recipe);
        Alert.alert('Recipe saved!', `"${recipe.name}" has been added to your library.`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch {
      Alert.alert('Error', 'Failed to save recipe. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: isEditing ? 'Edit Recipe' : 'Create Recipe' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SectionHeader title="Basic Info" />
        <Field label="Recipe Name *">
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Mum's Lasagne" />
        </Field>
        <Field label="Description">
          <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} multiline numberOfLines={3} placeholder="A short description…" />
        </Field>
        <Field label="Category">
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => (
              <Pressable key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </Field>
        <Field label="Difficulty">
          <View style={styles.chipRow}>
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <Pressable key={d} style={[styles.chip, difficulty === d && styles.chipActive]} onPress={() => setDifficulty(d)}>
                <Text style={[styles.chipText, difficulty === d && styles.chipTextActive]}>{d}</Text>
              </Pressable>
            ))}
          </View>
        </Field>
        <View style={styles.timeRow}>
          <Field label="Prep (mins)" style={styles.flex1}>
            <TextInput style={styles.input} value={prepTime} onChangeText={setPrepTime} keyboardType="number-pad" placeholder="15" />
          </Field>
          <Field label="Cook (mins)" style={styles.flex1}>
            <TextInput style={styles.input} value={cookTime} onChangeText={setCookTime} keyboardType="number-pad" placeholder="30" />
          </Field>
        </View>

        <SectionHeader title="Options" />
        <View style={styles.switchCard}>
          {([
            ['Vegetarian', vegetarian, setVegetarian],
            ['Vegan', vegan, setVegan],
            ['Gluten-Free', glutenFree, setGlutenFree],
            ['Dairy-Free', dairyFree, setDairyFree],
            ['Freezer-Friendly', freezerFriendly, setFreezerFriendly],
            ['One Pot', onePot, setOnePot],
            ['Kid-Friendly', kidFriendly, setKidFriendly],
          ] as [string, boolean, React.Dispatch<React.SetStateAction<boolean>>][]).map(([label, value, setter], i, arr) => (
            <View key={label} style={[styles.switchRow, i < arr.length - 1 && styles.rowBorder]}>
              <Text style={styles.switchLabel}>{label}</Text>
              <Switch value={value} onValueChange={setter} trackColor={{ true: '#E8A020' }} thumbColor="#fff" />
            </View>
          ))}
        </View>
        {freezerFriendly && (
          <Field label="Batch Cook Notes">
            <TextInput style={[styles.input, styles.multiline]} value={batchNotes} onChangeText={setBatchNotes} multiline numberOfLines={2} placeholder="How to freeze, defrost, and reheat…" />
          </Field>
        )}

        <SectionHeader title="Photo" />
        <Field label="Photo URL">
          <TextInput style={styles.input} value={imageUrl} onChangeText={setImageUrl} placeholder="https://…" autoCapitalize="none" keyboardType="url" />
        </Field>

        <SectionHeader title="Ingredients *" />
        {ingredientRows.map((row, i) => (
          <View key={i} style={styles.dynamicRow}>
            <TextInput style={[styles.input, styles.flex2]} value={row.name} onChangeText={(v) => updateIngredient(i, 'name', v)} placeholder="Ingredient" />
            <TextInput style={[styles.input, styles.flex1]} value={row.quantity} onChangeText={(v) => updateIngredient(i, 'quantity', v)} placeholder="Qty" keyboardType="decimal-pad" />
            <TextInput style={[styles.input, styles.flex1]} value={row.unit} onChangeText={(v) => updateIngredient(i, 'unit', v)} placeholder="Unit" />
            <Pressable onPress={() => removeIngredient(i)} style={styles.removeBtn}>
              <Ionicons name="close-circle" size={22} color="#C0392B" />
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.addBtn} onPress={addIngredient}>
          <Ionicons name="add-circle-outline" size={18} color="#1A2B4A" />
          <Text style={styles.addBtnText}>Add Ingredient</Text>
        </Pressable>

        <SectionHeader title="Instructions *" />
        {stepRows.map((row, i) => (
          <View key={i} style={styles.stepDynamicRow}>
            <View style={styles.stepNumCircle}><Text style={styles.stepNumText}>{i + 1}</Text></View>
            <TextInput style={[styles.input, styles.flex1]} value={row.instruction} onChangeText={(v) => updateStep(i, v)} placeholder={`Step ${i + 1}…`} multiline />
            <Pressable onPress={() => removeStep(i)} style={styles.removeBtn}>
              <Ionicons name="close-circle" size={22} color="#C0392B" />
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.addBtn} onPress={addStep}>
          <Ionicons name="add-circle-outline" size={18} color="#1A2B4A" />
          <Text style={styles.addBtnText}>Add Step</Text>
        </Pressable>

        <SectionHeader title="Nutrition (optional, per 4 people)" />
        <View style={styles.timeRow}>
          {[['Calories', calories, setCalories], ['Protein (g)', protein, setProtein], ['Carbs (g)', carbs, setCarbs], ['Fat (g)', fat, setFat]].map(([label, value, setter]) => (
            <Field key={label as string} label={label as string} style={styles.flex1}>
              <TextInput style={styles.input} value={value as string} onChangeText={setter as (v: string) => void} keyboardType="number-pad" placeholder="0" />
            </Field>
          ))}
        </View>

        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
          <Text style={styles.saveBtnText}>{isSaving ? 'Saving…' : isEditing ? 'Save Changes' : 'Save Recipe'}</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  content: { padding: 16, paddingBottom: 40 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: '#1A2B4A', marginTop: 24, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#E8A020', paddingLeft: 10 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1A2B4A' },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#1A2B4A', borderColor: '#1A2B4A' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  timeRow: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  switchCard: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  switchLabel: { fontSize: 15, color: '#1A2B4A', fontWeight: '500' },
  dynamicRow: { flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' },
  stepDynamicRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-start' },
  stepNumCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E8A020', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  stepNumText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  removeBtn: { padding: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4 },
  addBtnText: { color: '#1A2B4A', fontWeight: '600', fontSize: 14 },
  saveBtn: { backgroundColor: '#E8A020', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
