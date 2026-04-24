-- Family Dinner Time Planner — Initial Schema
-- Run this in your Supabase SQL Editor or via `supabase db push`
-- Every table uses Row Level Security: users can only read/write their own rows.

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Helper: updated_at trigger ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users NOT NULL UNIQUE,
  family_name text NOT NULL DEFAULT '',
  family_size int  NOT NULL DEFAULT 4 CHECK (family_size BETWEEN 1 AND 20),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON profiles
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── meal_plans ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES auth.users NOT NULL,
  week_key            text NOT NULL,                   -- e.g. "2025-W03"
  monday_recipe_id    text,
  tuesday_recipe_id   text,
  wednesday_recipe_id text,
  thursday_recipe_id  text,
  friday_recipe_id    text,
  saturday_recipe_id  text,
  sunday_recipe_id    text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE (user_id, week_key)
);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meal_plans_own" ON meal_plans
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER meal_plans_updated_at
  BEFORE UPDATE ON meal_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── pantry_items ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pantry_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users NOT NULL,
  ingredient_id   text NOT NULL,
  in_stock        bool NOT NULL DEFAULT false,
  quantity        numeric NOT NULL DEFAULT 0,
  is_low_stock    bool NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, ingredient_id)
);

ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pantry_items_own" ON pantry_items
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER pantry_items_updated_at
  BEFORE UPDATE ON pantry_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── freezer_items ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS freezer_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users NOT NULL,
  label           text NOT NULL,
  type            text NOT NULL CHECK (type IN ('meal', 'ingredient')),
  recipe_id       text,
  ingredient_id   text,
  portions        int,
  quantity        numeric,
  frozen_at       date NOT NULL DEFAULT CURRENT_DATE,
  use_by_date     date,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE freezer_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "freezer_items_own" ON freezer_items
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER freezer_items_updated_at
  BEFORE UPDATE ON freezer_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── user_recipe_data (favourites + ratings) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS user_recipe_data (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users NOT NULL,
  recipe_id       text NOT NULL,
  is_favourite    bool NOT NULL DEFAULT false,
  rating          int CHECK (rating BETWEEN 1 AND 5),
  rated_at        timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, recipe_id)
);

ALTER TABLE user_recipe_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_recipe_data_own" ON user_recipe_data
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER user_recipe_data_updated_at
  BEFORE UPDATE ON user_recipe_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── family_members ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS family_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users NOT NULL,
  name            text NOT NULL,
  avatar_emoji    text NOT NULL DEFAULT '😊',
  allergens       text[] NOT NULL DEFAULT '{}',
  dislikes        text[] NOT NULL DEFAULT '{}',
  diet_type       text NOT NULL DEFAULT 'none'
                    CHECK (diet_type IN ('none','vegetarian','vegan','gluten-free','dairy-free')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_members_own" ON family_members
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER family_members_updated_at
  BEFORE UPDATE ON family_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── meal_plan_templates ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_plan_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users NOT NULL,
  name            text NOT NULL,
  days            jsonb NOT NULL DEFAULT '{}',
  last_used_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE meal_plan_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meal_plan_templates_own" ON meal_plan_templates
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER meal_plan_templates_updated_at
  BEFORE UPDATE ON meal_plan_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── imported_recipes ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS imported_recipes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users NOT NULL,
  recipe_data     jsonb NOT NULL,
  source          text NOT NULL,
  external_id     text NOT NULL,
  imported_at     timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, source, external_id)
);

ALTER TABLE imported_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imported_recipes_own" ON imported_recipes
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── custom_recipes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_recipes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users NOT NULL,
  recipe_data     jsonb NOT NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE custom_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom_recipes_own" ON custom_recipes
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER custom_recipes_updated_at
  BEFORE UPDATE ON custom_recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── scan_history ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_history (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES auth.users NOT NULL,
  barcode               text NOT NULL,
  product_name          text NOT NULL,
  matched_ingredient_id text,
  scanned_at            timestamptz DEFAULT now(),
  action                text NOT NULL DEFAULT 'lookup',
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan_history_own" ON scan_history
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS scan_history_user_scanned
  ON scan_history (user_id, scanned_at DESC);

-- ─── budget_settings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budget_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users NOT NULL UNIQUE,
  weekly_budget   numeric NOT NULL DEFAULT 60,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE budget_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budget_settings_own" ON budget_settings
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER budget_settings_updated_at
  BEFORE UPDATE ON budget_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── price_logs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users NOT NULL,
  ingredient_id   text NOT NULL,
  supermarket     text NOT NULL,
  price_paid      numeric NOT NULL,
  logged_at       timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE price_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_logs_own" ON price_logs
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS price_logs_user_ingredient
  ON price_logs (user_id, ingredient_id, logged_at DESC);

-- ─── Realtime publications ───────────────────────────────────────────────────
-- Enable realtime for the tables that sync across devices in real time.
ALTER PUBLICATION supabase_realtime ADD TABLE meal_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE family_members;
ALTER PUBLICATION supabase_realtime ADD TABLE pantry_items;
ALTER PUBLICATION supabase_realtime ADD TABLE freezer_items;
ALTER PUBLICATION supabase_realtime ADD TABLE user_recipe_data;
