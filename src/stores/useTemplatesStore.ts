import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MealPlanTemplate } from '../types';
import { supabase } from '../lib/supabase';
import {
  fetchTemplates,
  upsertTemplate,
  deleteTemplate as deleteTemplateService,
} from '../services/supabaseService';

interface TemplatesState {
  templates: MealPlanTemplate[];
  isLoading: boolean;
  saveTemplate: (
    userId: string,
    name: string,
    days: MealPlanTemplate['days'],
  ) => Promise<void>;
  loadTemplate: (id: string) => MealPlanTemplate | undefined;
  deleteTemplate: (id: string) => Promise<void>;
  renameTemplate: (id: string, name: string) => Promise<void>;
  syncFromSupabase: (userId: string) => Promise<void>;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set, get) => ({
      templates: [],
      isLoading: false,

      saveTemplate: async (
        userId: string,
        name: string,
        days: MealPlanTemplate['days'],
      ) => {
        const now = new Date().toISOString();
        const template: MealPlanTemplate = {
          id: generateId(),
          userId,
          name,
          days,
          createdAt: now,
          lastUsedAt: now,
        };

        set((state) => ({ templates: [...state.templates, template] }));

        try {
          await upsertTemplate(template);
        } catch (error) {
          console.error('[TemplatesStore] saveTemplate error:', error);
          set((state) => ({
            templates: state.templates.filter((t) => t.id !== template.id),
          }));
        }
      },

      loadTemplate: (id: string) => {
        const template = get().templates.find((t) => t.id === id);
        if (!template) return undefined;

        // Update lastUsedAt optimistically
        const now = new Date().toISOString();
        const updated: MealPlanTemplate = { ...template, lastUsedAt: now };
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? updated : t)),
        }));

        // Persist to Supabase in the background
        upsertTemplate(updated).catch((error) => {
          console.error('[TemplatesStore] loadTemplate upsert error:', error);
        });

        return updated;
      },

      deleteTemplate: async (id: string) => {
        const previous = get().templates;
        set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }));

        try {
          await deleteTemplateService(id);
        } catch (error) {
          console.error('[TemplatesStore] deleteTemplate error:', error);
          set({ templates: previous });
        }
      },

      renameTemplate: async (id: string, name: string) => {
        const previous = get().templates;
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? { ...t, name } : t)),
        }));

        try {
          const updated = get().templates.find((t) => t.id === id);
          if (updated) {
            await upsertTemplate(updated);
          }
        } catch (error) {
          console.error('[TemplatesStore] renameTemplate error:', error);
          set({ templates: previous });
        }
      },

      syncFromSupabase: async (userId: string) => {
        set({ isLoading: true });
        try {
          const templates = await fetchTemplates(userId);
          set({ templates });
        } catch (error) {
          console.error('[TemplatesStore] syncFromSupabase error:', error);
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'templates-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
