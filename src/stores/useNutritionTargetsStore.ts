import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface NutritionTargetsStore {
  targets: NutritionTargets;
  setTargets: (targets: NutritionTargets) => void;
}

const DEFAULT_TARGETS: NutritionTargets = {
  calories: 2000,
  protein: 50,
  carbs: 260,
  fat: 70,
};

export const useNutritionTargetsStore = create<NutritionTargetsStore>()(
  persist(
    (set) => ({
      targets: DEFAULT_TARGETS,
      setTargets: (targets) => set({ targets }),
    }),
    {
      name: 'nutrition-targets-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
