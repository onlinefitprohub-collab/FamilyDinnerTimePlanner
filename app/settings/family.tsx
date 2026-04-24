import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  Alert,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useFamilyStore } from '../../src/stores/useFamilyStore';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { FamilyMember, Allergen } from '../../src/types';

const AVATAR_OPTIONS = [
  '🧑', '👩', '👨', '👦', '👧', '🧒', '🧓', '👴', '👵', '🐶',
  '🐱', '🦁', '🐯', '🦊', '🐻', '🐼', '🦋', '🌟', '🎉', '🍕',
];

const DIET_OPTIONS: { key: FamilyMember['dietType']; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'gluten-free', label: 'GF' },
  { key: 'dairy-free', label: 'DF' },
];

const ALL_ALLERGENS: Allergen[] = [
  'celery', 'gluten', 'crustaceans', 'eggs', 'fish',
  'lupin', 'milk', 'molluscs', 'mustard', 'peanuts',
  'sesame', 'soybeans', 'sulphites', 'tree-nuts',
];

const ALLERGEN_LABELS: Record<Allergen, string> = {
  celery: 'Celery',
  gluten: 'Gluten',
  crustaceans: 'Crustaceans',
  eggs: 'Eggs',
  fish: 'Fish',
  lupin: 'Lupin',
  milk: 'Milk',
  molluscs: 'Molluscs',
  mustard: 'Mustard',
  peanuts: 'Peanuts',
  sesame: 'Sesame',
  soybeans: 'Soybeans',
  sulphites: 'Sulphites',
  'tree-nuts': 'Tree Nuts',
};

interface FormState {
  name: string;
  avatarEmoji: string;
  dietType: FamilyMember['dietType'];
  allergens: Allergen[];
  dislikes: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  avatarEmoji: '🧑',
  dietType: 'none',
  allergens: [],
  dislikes: '',
};

function memberToForm(member: FamilyMember): FormState {
  return {
    name: member.name,
    avatarEmoji: member.avatarEmoji,
    dietType: member.dietType,
    allergens: [...member.allergens],
    dislikes: member.dislikes.join(', '),
  };
}

export default function FamilyScreen(): React.ReactElement {
  const members = useFamilyStore((s) => s.members);
  const addMember = useFamilyStore((s) => s.addMember);
  const updateMember = useFamilyStore((s) => s.updateMember);
  const removeMember = useFamilyStore((s) => s.removeMember);

  const user = useAuthStore((s) => s.user);

  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const openAddModal = useCallback(() => {
    setEditingMember(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }, []);

  const openEditModal = useCallback((member: FamilyMember) => {
    setEditingMember(member);
    setForm(memberToForm(member));
    setShowModal(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      Alert.alert('Missing name', 'Please enter a name for this family member.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to manage family members.');
      return;
    }

    const dislikesArr = form.dislikes
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);

    if (editingMember) {
      void updateMember(editingMember.id, {
        name: form.name.trim(),
        avatarEmoji: form.avatarEmoji,
        dietType: form.dietType,
        allergens: form.allergens,
        dislikes: dislikesArr,
      });
    } else {
      void addMember({
        userId: user.id,
        name: form.name.trim(),
        avatarEmoji: form.avatarEmoji,
        dietType: form.dietType,
        allergens: form.allergens,
        dislikes: dislikesArr,
      });
    }
    setShowModal(false);
  }, [form, editingMember, user, addMember, updateMember]);

  const handleDelete = useCallback(
    (member: FamilyMember) => {
      Alert.alert(
        'Remove Member',
        `Remove ${member.name} from your family?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => void removeMember(member.id),
          },
        ],
      );
    },
    [removeMember],
  );

  const toggleAllergen = useCallback((allergen: Allergen) => {
    setForm((prev) => {
      const has = prev.allergens.includes(allergen);
      return {
        ...prev,
        allergens: has
          ? prev.allergens.filter((a) => a !== allergen)
          : [...prev.allergens, allergen],
      };
    });
  }, []);

  const renderMember = ({ item }: { item: FamilyMember }) => (
    <View style={styles.memberCard}>
      <Text style={styles.memberAvatar}>{item.avatarEmoji}</Text>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.name}</Text>
        {item.dietType !== 'none' && (
          <Text style={styles.memberDiet}>{item.dietType}</Text>
        )}
        {item.allergens.length > 0 && (
          <Text style={styles.memberAllergens} numberOfLines={1}>
            Allergens: {item.allergens.map((a) => ALLERGEN_LABELS[a]).join(', ')}
          </Text>
        )}
        {item.dislikes.length > 0 && (
          <Text style={styles.memberDislikes} numberOfLines={1}>
            Dislikes: {item.dislikes.join(', ')}
          </Text>
        )}
      </View>
      <View style={styles.memberActions}>
        <Pressable
          onPress={() => openEditModal(item)}
          style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
          accessibilityLabel={`Edit ${item.name}`}
        >
          <Text style={styles.editBtnText}>Edit</Text>
        </Pressable>
        <Pressable
          onPress={() => handleDelete(item)}
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
          accessibilityLabel={`Delete ${item.name}`}
        >
          <Text style={styles.deleteBtnText}>✕</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={renderMember}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.title}>Family Profiles</Text>
            <Text style={styles.subtitle}>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👨‍👩‍👧‍👦</Text>
            <Text style={styles.emptyTitle}>No family members yet</Text>
            <Text style={styles.emptySubtitle}>
              Add family members to personalise meal suggestions and allergen warnings.
            </Text>
          </View>
        }
        ListFooterComponent={
          <Pressable
            onPress={openAddModal}
            style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
          >
            <Text style={styles.addBtnText}>+ Add Family Member</Text>
          </Pressable>
        }
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingMember ? 'Edit Member' : 'Add Member'}
            </Text>
            <Pressable
              onPress={() => setShowModal(false)}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.formContent}>
            {/* Name */}
            <Text style={styles.formLabel}>Name</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Enter name"
              placeholderTextColor="#9CA3AF"
              value={form.name}
              onChangeText={(t) => setForm((p) => ({ ...p, name: t }))}
              autoFocus={!editingMember}
            />

            {/* Avatar */}
            <Text style={styles.formLabel}>Avatar</Text>
            <FlatList
              data={AVATAR_OPTIONS}
              keyExtractor={(item) => item}
              numColumns={5}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setForm((p) => ({ ...p, avatarEmoji: item }))}
                  style={[
                    styles.avatarOption,
                    form.avatarEmoji === item && styles.avatarOptionSelected,
                  ]}
                >
                  <Text style={styles.avatarOptionText}>{item}</Text>
                </Pressable>
              )}
              columnWrapperStyle={styles.avatarRow}
            />

            {/* Diet type */}
            <Text style={styles.formLabel}>Diet Type</Text>
            <View style={styles.chipRow}>
              {DIET_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => setForm((p) => ({ ...p, dietType: opt.key }))}
                  style={[
                    styles.chip,
                    form.dietType === opt.key && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      form.dietType === opt.key && styles.chipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Allergens */}
            <Text style={styles.formLabel}>Allergens</Text>
            <View style={styles.allergenGrid}>
              {ALL_ALLERGENS.map((allergen) => {
                const active = form.allergens.includes(allergen);
                return (
                  <Pressable
                    key={allergen}
                    onPress={() => toggleAllergen(allergen)}
                    style={[styles.allergenChip, active && styles.allergenChipActive]}
                  >
                    <Text
                      style={[
                        styles.allergenChipText,
                        active && styles.allergenChipTextActive,
                      ]}
                    >
                      {ALLERGEN_LABELS[allergen]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Dislikes */}
            <Text style={styles.formLabel}>Dislikes (comma-separated)</Text>
            <TextInput
              style={[styles.formInput, styles.formInputMultiline]}
              placeholder="e.g. mushrooms, onions"
              placeholderTextColor="#9CA3AF"
              value={form.dislikes}
              onChangeText={(t) => setForm((p) => ({ ...p, dislikes: t }))}
              multiline
              numberOfLines={3}
            />

            {/* Save */}
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
            >
              <Text style={styles.saveBtnText}>
                {editingMember ? 'Update' : 'Add Member'}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  listContent: {
    paddingBottom: 32,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A2B4A',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#FFFFFF',
    gap: 14,
  },
  memberAvatar: {
    fontSize: 40,
    lineHeight: 48,
  },
  memberInfo: {
    flex: 1,
    gap: 3,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  memberDiet: {
    fontSize: 12,
    color: '#8FAF7E',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  memberAllergens: {
    fontSize: 12,
    color: '#C0392B',
  },
  memberDislikes: {
    fontSize: 12,
    color: '#6B7280',
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingTop: 4,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EEF1F7',
    borderRadius: 8,
  },
  editBtnPressed: {
    opacity: 0.7,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A2B4A',
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnPressed: {
    opacity: 0.7,
  },
  deleteBtnText: {
    fontSize: 14,
    color: '#C0392B',
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 70,
  },
  addBtn: {
    margin: 16,
    backgroundColor: '#1A2B4A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnPressed: {
    opacity: 0.8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
    gap: 10,
  },
  emptyIcon: {
    fontSize: 52,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2B4A',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
  },
  // Modal
  modalSafe: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    opacity: 0.7,
  },
  closeBtnText: {
    fontSize: 16,
    color: '#1A2B4A',
    fontWeight: '700',
  },
  formContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A2B4A',
    marginBottom: 2,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A2B4A',
  },
  formInputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  avatarRow: {
    gap: 8,
    marginBottom: 4,
  },
  avatarOption: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionSelected: {
    borderColor: '#E8A020',
    backgroundColor: '#FFF8EC',
  },
  avatarOptionText: {
    fontSize: 28,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9F9F7',
  },
  chipActive: {
    backgroundColor: '#1A2B4A',
    borderColor: '#1A2B4A',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  allergenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  allergenChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9F9F7',
  },
  allergenChipActive: {
    backgroundColor: '#C0392B',
    borderColor: '#C0392B',
  },
  allergenChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  allergenChipTextActive: {
    color: '#FFFFFF',
  },
  saveBtn: {
    backgroundColor: '#1A2B4A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnPressed: {
    opacity: 0.8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
