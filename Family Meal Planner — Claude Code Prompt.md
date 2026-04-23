# Family Meal Planner — Claude Code Prompt

---

## How to Use This Prompt

Paste everything between **PROMPT START** and **PROMPT END** directly into Claude Code as your opening message. Work through the **Phased Build Order** table sequentially — each phase produces a working, testable increment. The **Tips** section at the bottom provides ready-made follow-up prompts for common tasks such as adding recipes, updating prices, and extending features.

---

---

# PROMPT START

---

## Project Overview

Build a full-featured **Family Meal Planner mobile app** that helps UK families plan their weekly dinners, discover recipes, understand exactly how much each ingredient will cost at UK supermarkets, and save money by always finding the cheapest option. The app is **primarily a native mobile app for iOS and Android**, with a fully functional **web version** accessible from any browser — all from a single shared codebase.

Families can create accounts, log in, and have their meal plan, pantry, budget, favourites, and settings **sync in real time across all their devices** — so both parents can see and edit the same plan from their own phones.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React Native with **Expo SDK 51+** (managed workflow) |
| **Web support** | Expo for Web (`expo-web`) — same codebase, browser-accessible |
| **Language** | TypeScript (strict mode throughout) |
| **Styling** | **NativeWind v4** (Tailwind CSS utility classes for React Native) |
| **Navigation** | **Expo Router** (file-based routing, works on mobile and web) |
| **Backend & Database** | **Supabase** (PostgreSQL database, real-time subscriptions, Row Level Security) |
| **Authentication** | **Supabase Auth** (email/password + magic link; Google OAuth optional) |
| **State management** | **Zustand** with Supabase real-time sync |
| **Icons** | `@expo/vector-icons` (Ionicons set) |
| **Charts** | `react-native-gifted-charts` or `victory-native` |
| **Barcode scanning** | `expo-camera` + `expo-barcode-scanner` (native camera, far superior to browser-based) |
| **Image handling** | `expo-image` |
| **Notifications** | `expo-notifications` (push notifications for meal reminders) |
| **Offline support** | Zustand persistence via `expo-secure-store` / `AsyncStorage` for offline-first behaviour |

---

## Architecture Overview

The app follows an **offline-first** architecture:

1. All data is cached locally in Zustand stores persisted to `AsyncStorage`.
2. When online, Supabase real-time subscriptions keep all data in sync across devices.
3. When offline, the app reads from and writes to the local cache; changes are synced to Supabase when connectivity is restored.
4. Static data (recipes, ingredient pricing, deals, seasonal produce) lives in local TypeScript data files and is never stored in Supabase — it is part of the app bundle.
5. User-specific data (meal plan, pantry, budget, favourites, ratings, family profiles, templates, freezer inventory, scan history, imported recipes, custom recipes) is stored in Supabase and synced to the local cache.

---

## Supabase Setup

### Database Tables

Create the following tables in Supabase. All tables include `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id uuid REFERENCES auth.users NOT NULL`, `created_at timestamptz DEFAULT now()`, and `updated_at timestamptz DEFAULT now()`. Enable **Row Level Security (RLS)** on every table with a policy that allows users to read and write only their own rows (`user_id = auth.uid()`).

| Table | Key Columns |
|---|---|
| `profiles` | `user_id`, `family_name`, `family_size` (int, default 4) |
| `meal_plans` | `user_id`, `week_key` (text, ISO week e.g. "2025-W03"), `monday_recipe_id`, `tuesday_recipe_id`, `wednesday_recipe_id`, `thursday_recipe_id`, `friday_recipe_id`, `saturday_recipe_id`, `sunday_recipe_id` |
| `pantry_items` | `user_id`, `ingredient_id` (text), `in_stock` (bool), `quantity` (numeric), `is_low_stock` (bool) |
| `freezer_items` | `user_id`, `label`, `type` ("meal" or "ingredient"), `recipe_id` (text, nullable), `ingredient_id` (text, nullable), `portions` (int), `quantity` (numeric), `frozen_at` (date), `use_by_date` (date, nullable) |
| `user_recipe_data` | `user_id`, `recipe_id` (text), `is_favourite` (bool), `rating` (int 1–5, nullable), `rated_at` (timestamptz, nullable) |
| `family_members` | `user_id`, `name`, `avatar_emoji`, `allergens` (text[]), `dislikes` (text[]), `diet_type` (text) |
| `meal_plan_templates` | `user_id`, `name`, `days` (jsonb), `last_used_at` (timestamptz, nullable) |
| `imported_recipes` | `user_id`, `recipe_data` (jsonb — full Recipe object), `source` (text), `external_id` (text), `imported_at` (timestamptz) |
| `custom_recipes` | `user_id`, `recipe_data` (jsonb — full Recipe object) |
| `scan_history` | `user_id`, `barcode`, `product_name`, `matched_ingredient_id` (text, nullable), `scanned_at` (timestamptz), `action` (text) |
| `budget_settings` | `user_id`, `weekly_budget` (numeric) |
| `price_logs` | `user_id`, `ingredient_id` (text), `supermarket` (text), `price_paid` (numeric), `logged_at` (timestamptz) |

### Supabase Client Setup

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

Store `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. Never hardcode these values.

---

## Design Philosophy

The design must feel like a **Modern British Kitchen App** — warm, tactile, and built for real family life. It should feel native on iOS and Android, not like a website crammed into a phone.

- **Colour palette:** Off-white `#FAFAF8` background · Deep navy `#1A2B4A` primary · Warm amber `#E8A020` accent · Sage green `#8FAF7E` for savings and success · Soft red `#C0392B` for alerts and over-budget states
- **Typography:** Use `expo-font` to load **Fraunces** (display headings — warm serif) and **Source Sans 3** (body — clean and legible). Use a monospace system font (`Platform.OS === 'ios' ? 'Courier New' : 'monospace'`) for all prices and numerical data.
- **Layout:** Bottom tab bar navigation on mobile (5 primary tabs). Stack navigation within each tab. On web, render a persistent left sidebar instead of the bottom tab bar.
- **Native feel:** Use `Pressable` with `scale` animations on press, haptic feedback (`expo-haptics`) on key interactions (adding to plan, marking in stock, scanning), and `FlatList` / `SectionList` for all scrollable lists (never `ScrollView` for long lists).
- **Signature elements:** A prominent **Family Size selector** (stepper, 1–10) always visible in the header — this drives every cost, quantity, and nutritional figure in the entire app. Cost badges on every recipe card. Supermarket colour-coded chips on ingredient rows.
- **Tone:** Warm, practical, honest. Never use stock-photo aesthetics or generic placeholder imagery.

---

## Navigation Structure

```
Bottom Tab Bar (mobile) / Left Sidebar (web):
├── 🏠  Home          (app/(tabs)/index.tsx)
├── 🍽️  Recipes       (app/(tabs)/recipes/)
│   ├── Browse Library        (app/(tabs)/recipes/index.tsx)
│   ├── Search Online         (app/(tabs)/recipes/search.tsx)
│   └── Create Your Own       (app/(tabs)/recipes/create.tsx)
├── 📅  Planner       (app/(tabs)/planner.tsx)
├── 🛒  Shopping      (app/(tabs)/shopping.tsx)
└── ⚙️  More          (app/(tabs)/more.tsx)
        ├── Pantry            (app/pantry/)
        │   ├── Cupboard      (app/pantry/cupboard.tsx)
        │   └── Freezer       (app/pantry/freezer.tsx)
        ├── Budget            (app/budget.tsx)
        ├── Favourites        (app/favourites.tsx)
        └── Settings          (app/settings/)
                ├── Family Profiles   (app/settings/family.tsx)
                ├── Recipe APIs       (app/settings/apis.tsx)
                └── Preferences       (app/settings/preferences.tsx)

Auth screens (unauthenticated):
├── app/(auth)/login.tsx
├── app/(auth)/register.tsx
└── app/(auth)/forgot-password.tsx

Detail screens (stack navigation):
├── app/recipe/[id].tsx
└── app/recipe/cooking/[id].tsx
```

---

## Authentication

### Screens

**Register screen** (`app/(auth)/register.tsx`):
- Family name input (e.g. "The Smiths")
- Email address input
- Password input (min 8 characters, show/hide toggle)
- "Create Account" button — calls `supabase.auth.signUp()`, then creates a row in `profiles` with the family name and default family size of 4
- Link to Login screen

**Login screen** (`app/(auth)/login.tsx`):
- Email and password inputs
- "Sign In" button — calls `supabase.auth.signInWithPassword()`
- "Forgot Password?" link → forgot-password screen
- Link to Register screen

**Forgot Password screen** (`app/(auth)/forgot-password.tsx`):
- Email input
- "Send Reset Link" button — calls `supabase.auth.resetPasswordForEmail()`
- Confirmation message shown after submission

**Session handling:**
- On app launch, check `supabase.auth.getSession()`. If a valid session exists, navigate to the main app. If not, navigate to the Login screen.
- Use a `useAuth` hook that listens to `supabase.auth.onAuthStateChange()` and updates a global auth Zustand store.
- On sign-out, clear all local Zustand stores and navigate to Login.

---

## Core Features

---

### Feature 1 — Family Size & Portion Scaling

A persistent **Family Size selector** (stepper control, 1–10 people) must be visible at all times in the app header. This is the single most important interactive element in the entire app. Every cost figure, ingredient quantity, nutritional total, and shopping list quantity shown anywhere must update instantly when this value changes.

The family size is stored in the `profiles` table in Supabase and synced across all the family's devices in real time.

**Scaling logic:**
- All recipes are authored for a base serving of 4 people. Scale linearly: `scaledQuantity = Math.ceil((baseQuantity × familySize) / 4)`.
- For fixed-pack items (e.g. sausages in packs of 8, eggs in packs of 6), always round up to the nearest whole pack and display "2 packs needed".
- For loose items (e.g. onions, garlic cloves), round to the nearest whole item.
- For measured ingredients (e.g. grams, millilitres), round to the nearest 10g or 10ml.
- On the recipe detail screen, show both the scaled quantity and a human-readable purchase note, e.g. "875g (buy 2 × 500g packs)".

---

### Feature 2 — Recipe Browser

A browsable library of family recipes displayed as cards in a responsive grid (`FlatList` with `numColumns={2}` on mobile, `numColumns={3}` on tablet/web). Each card must show:

- Recipe photo (`expo-image` with placeholder)
- Recipe name and short description
- Difficulty badge (Easy / Medium / Hard)
- Total prep + cook time
- Dietary tags (Vegetarian, Vegan, Gluten-Free, Dairy-Free)
- **Total cost for the current family size** — calculated live
- **Cost per person**
- Colour-coded cost badge: green (under £1.50/person) · amber (£1.50–£3.00/person) · red (over £3.00/person)
- Star rating display (average of all ratings, or empty stars if unrated)
- Heart/favourite icon toggle
- Compact allergen chips for any of the 14 UK major allergens present
- Snowflake ❄️ badge if the meal is freezer-friendly
- "Deals Available" chip if any ingredient has an active deal
- "Seasonal" badge if the recipe contains currently in-season produce
- Family member conflict chips (green/amber/red) if family profiles are set up

**Quick filter chips** (horizontally scrollable row at the top, multiple active simultaneously — results are the intersection of all active filters):

| Chip | Logic |
|---|---|
| Under 30 mins | `prepTime + cookTime <= 30` |
| Under 45 mins | `prepTime + cookTime <= 45` |
| 5 ingredients or fewer | `recipe.ingredients.length <= 5` |
| One pot / one pan | `onePot: true` |
| Freezer-friendly | `freezerFriendly: true` |
| Kid-friendly | `kidFriendly: true` |
| Safe for everyone | No allergen or dislike conflicts for any family member |
| In season | Contains at least one currently in-season ingredient |
| Deals available | Contains at least one ingredient with an active deal |

**Full filter panel** (bottom sheet modal on mobile):
- Filter by category, dietary requirement, difficulty, cost range, allergen exclusion (multi-select)
- Sort by: cost (cheapest first), total time (quickest first), rating (highest first), name (A–Z)
- Search bar to find recipes by name or ingredient

---

### Feature 3 — Recipe Detail Screen

**Header:**
- Large recipe photo (full-width hero image)
- Recipe name, description, category, difficulty, prep/cook time, dietary badges
- Family size selector (mirrored from the global selector, editable inline)
- Star rating widget (1–5 stars)
- Family member conflict chips

**Ingredient Cost Breakdown** (scrollable table):
- Every ingredient scaled to the current family size
- Columns: Ingredient · Quantity Needed · Cheapest At · Price · All Supermarket Prices
- Allergen indicator next to each ingredient row
- Green "In Pantry" badge on ingredients already in stock — cost deducted from total
- Green "On Offer" badge with deal label and saving amount for any ingredient with an active deal
- Total row: total meal cost and cost per person
- Disclaimer: "Prices are approximate and based on 2024/2025 UK supermarket data."

**Allergen summary panel:**
- All allergens present, displayed as bold text on coloured backgrounds (UK allergen label style)
- "No Major Allergens" badge if the recipe is free from all 14
- Disclaimer: "Allergen information is provided as a guide only. Always check product labels when shopping. If you have a severe allergy, consult a healthcare professional."

**Nutritional summary panel:**
- Calories, Protein (g), Carbohydrates (g), Fat (g) — per person at the current family size
- Visual macro split bar
- Label: "High Protein" / "Low Calorie" / "Balanced"

**Freezer & Batch Cook panel** (if `freezerFriendly: true`):
- Batch cook notes (how to freeze, defrost, and reheat)
- "Add to Batch Cook Plan" button

**Step-by-step instructions:**
- Numbered steps with instruction text, optional duration, and optional tip callout
- "Start Cooking" button → navigates to `app/recipe/cooking/[id].tsx`

**Cooking mode screen** (`app/recipe/cooking/[id].tsx`):
- Full-screen, one-step-at-a-time view
- Large step number and instruction text
- "Previous" / "Next" buttons with haptic feedback
- Screen stays awake (`expo-keep-awake`) during cooking mode
- Progress indicator showing current step out of total

**Action buttons (sticky bottom bar):**
- "Add to Meal Plan" — bottom sheet to choose day of week
- "Add to Shopping List" — adds all scaled ingredients
- "Save to Favourites" / "Remove from Favourites"
- "Edit Recipe" (for imported and custom recipes only)

---

### Feature 4 — Shopping List Generator

A dedicated screen that **automatically consolidates all ingredients from the current week's meal plan** into a single organised list (`SectionList`).

**Core behaviour:**
- Combines duplicate ingredients across all meals for the week, scaled to the current family size
- Deducts pantry stock when the "Pantry Deduction" toggle is enabled
- Deducts frozen portions when a frozen meal is assigned to a day — shows "Using frozen portion (£0.00)"
- Calculates the cheapest supermarket for each item and shows the total estimated cost

**Display options (segmented control):**
- **By Category** (default): Meat, Dairy, Vegetables, Pasta & Rice, Canned Goods, Spices, Bakery, Frozen
- **By Supermarket**: Regroups the entire list by where to buy each item

**Each list item shows:**
- Ingredient name and total quantity with pack size guidance
- Cheapest supermarket chip and price
- Allergen indicators
- Checkbox to tick off while shopping (with strikethrough animation)

**Controls:**
- Pantry Deduction toggle
- "Scan to Add" button — opens barcode scanner to add items directly
- "Share List" — shares as plain text via the native share sheet (`expo-sharing`)
- "Clear Completed" — removes all ticked items
- Total estimated cost banner at the top
- Ability to manually add ad-hoc items not tied to a recipe

---

### Feature 5 — Weekly Meal Planner

A full-screen weekly planner showing Monday–Sunday as a horizontally scrollable card row (on mobile) or a 7-column grid (on tablet/web).

**Each day card shows:**
- Day name and date
- Assigned meal: recipe photo thumbnail, name, cost for current family size
- Allergen/conflict warning icon if the meal has a red conflict for any family member
- Frozen portion indicator if a freezer item is being used for that day
- "+" button if no meal is assigned
- Swipe-to-remove gesture on the assigned meal card

**"Add Meal" bottom sheet:**
- Searchable `FlatList` of all recipes with cost for current family size
- Quick filter chips and family conflict indicators visible
- Recipes from the full merged library (built-in + imported + custom)

**Weekly summary card (below the planner):**
- Total estimated cost for all planned meals this week
- Cost per person per week and per day
- Progress bar: spend vs. weekly budget target (green / amber / red)
- Weekly nutritional summary: average daily calories, total protein
- Calories-per-day bar chart

**Planner controls:**
- Prev/next week navigation
- "Save as Template" button
- "Load Template" button
- "Copy Last Week" shortcut

**Storage:** Synced to the `meal_plans` table in Supabase, keyed by ISO week string (e.g. `"2025-W03"`).

---

### Feature 6 — Pantry / Cupboard Tracker

A dedicated screen within the Pantry section where the family logs what ingredients they have at home.

**Core behaviour:**
- `SectionList` of all ingredients organised by category
- For each ingredient: toggle "In Stock" (with haptic feedback) and optionally enter a quantity
- "Low Stock" flag — shown with an amber indicator; surfaced in a "Running Low" section at the top
- Ability to add custom ingredients (name and category only)
- "Scan Item" button — opens barcode scanner to mark items as in-stock
- "Clear All" option

**Visual design:**
- In-stock items: green tick with quantity
- Low-stock items: amber warning icon
- Out-of-stock items: greyed out

**Synced to** the `pantry_items` table in Supabase in real time.

---

### Feature 7 — Leftover Meal Suggestions ("What Can I Make?")

A feature that helps families reduce food waste by suggesting recipes based on what is already in the pantry.

**Behaviour:**
- Accessible from a prominent button on the Pantry screen and as a widget on the Home screen
- Scans the pantry and scores every recipe in the library by ingredient coverage
- Returns a ranked `FlatList` showing:
  - Recipe name and photo
  - "You have X of Y ingredients" with a visual coverage progress bar
  - Estimated cost of **missing ingredients only**, scaled to the current family size
  - Cheapest supermarket for the missing ingredients
- Tapping a suggestion navigates to the recipe detail screen with pantry-owned ingredients highlighted green and missing ingredients highlighted amber
- Filter: "Only show recipes I can make right now" (100% match) or "Show recipes with 1–2 missing ingredients"

---

### Feature 8 — Nutritional Overview

**Per recipe (recipe detail screen):**
- Calories, Protein (g), Carbohydrates (g), Fat (g) — per person at current family size
- Visual macro split bar
- Label: "High Protein" / "Low Calorie" / "Balanced"

**Per week (Meal Planner screen):**
- Weekly nutritional summary: total and average daily figures across all planned meals
- Calories-per-day bar chart
- Note: "Nutritional values are approximate estimates."

**Data model:** Each recipe includes `nutritionPer4: { calories, protein, carbs, fat }` for 4 people. Scale proportionally to the current family size. If unavailable (imported/custom recipes without data), show "Not available."

---

### Feature 9 — Budget Target Setting

**Settings:**
- Weekly dinner budget input (£ per week), synced to the `budget_settings` table in Supabase

**Tracking:**
- Progress bar on both the Budget screen and the Meal Planner summary
- Colour states: green (under 80%) · amber (80–100%) · red (over budget)
- Amber warning banner at 80% of budget; red alert when over budget

**Insights panel:**
- "This week you are projected to spend £X on dinners for your family of Y."
- "By shopping at Aldi instead of Sainsbury's for this week's meals, you could save £Z."
- "Your cheapest meal this week is [Name] at £X.XX per person."
- "Your most expensive meal this week is [Name] at £X.XX per person."
- **"Suggest a Cheaper Week"** button — auto-fills the 7-day planner with the 7 cheapest recipes after a confirmation prompt

**Monthly overview:**
- Bar chart showing projected weekly spend across the current 4-week month, with the budget target as a horizontal reference line

**Price Check (Barcode):**
- "Scan & Compare" button — opens the barcode scanner to check a product's price across all 6 supermarkets and optionally log the actual price paid to the `price_logs` table

---

### Feature 10 — Meal Favourites & Ratings

**Favourites:**
- Heart icon on every recipe card and recipe detail screen
- Dedicated Favourites screen with the same card grid, filtering, and sorting
- Synced to `user_recipe_data` in Supabase

**Ratings:**
- 1–5 star rating widget on every recipe detail screen
- Average rating shown on recipe cards
- Sort by rating available on the Favourites screen
- "Top Rated Meals" section on the Home screen showing the 3 highest-rated recipes
- Synced to `user_recipe_data` in Supabase

---

### Feature 11 — Seasonal & Deal Alerts

**Deal Alerts:**
- Static `src/data/deals.ts` file: `ingredientId`, `supermarket`, `originalPrice`, `dealPrice`, `dealLabel`, `validUntil`
- Green "On Offer" badge on ingredient rows in the recipe detail cost table
- "Deals Available" chip on recipe cards
- "This Week's Deals" widget on the Home screen, grouped by supermarket
- Include clear comments in `deals.ts` explaining how to add new deals

**Seasonal Produce:**
- Static `src/data/seasonal.ts` mapping each month (1–12) to in-season ingredients
- "Seasonal" filter in the recipe browser
- "Seasonal Ingredients" badge on recipe cards
- "In Season This Month" widget on the Home screen

---

### Feature 12 — Online Recipe Search (TheMealDB)

Integrate the free [TheMealDB API](https://www.themealdb.com/api.php) (no API key required).

**Search screen:**
- Search by meal name; browse by category and by area/cuisine
- Results as recipe cards
- "Random Recipe" button

**Import flow:**
1. Tap result → preview screen with photo, name, category, and instructions
2. Tap "Import to My Library"
3. Fuzzy-match each ingredient to the local ingredient database (70% similarity threshold)
4. Matched → pricing pre-filled; unmatched → user selects from dropdown, adds as custom, or skips
5. User reviews, sets base serving size, optionally adds nutritional data
6. On confirmation, recipe saved to `imported_recipes` table in Supabase

**Imported recipe handling:**
- Merged with built-in recipes throughout the app via `useRecipeLibrary`
- "Imported" badge on recipe cards
- User can edit or delete imported recipes at any time

**API endpoints:**
- Search by name: `https://www.themealdb.com/api/json/v1/1/search.php?s={query}`
- Filter by category: `https://www.themealdb.com/api/json/v1/1/filter.php?c={category}`
- Filter by area: `https://www.themealdb.com/api/json/v1/1/filter.php?a={area}`
- Random meal: `https://www.themealdb.com/api/json/v1/1/random.php`
- Lookup by ID: `https://www.themealdb.com/api/json/v1/1/lookup.php?i={id}`

**Error handling:** If TheMealDB is unavailable, show a friendly offline message and fall back to the local library.

---

### Feature 13 — Manual Recipe Builder

A form-based screen for families to create and save their own custom recipes.

**Form fields:**
- Name, description, category (picker), difficulty (segmented control), prep time, cook time
- Dietary flags (Vegetarian, Vegan, Gluten-Free, Dairy-Free — toggles)
- Recipe photo (URL input or camera capture via `expo-image-picker`)
- Tags (free-text)
- `freezerFriendly` toggle; `onePot` toggle; `kidFriendly` toggle
- Batch cook notes field (shown if freezer-friendly is enabled)

**Ingredients section:**
- Searchable ingredient picker from the local database
- For each ingredient: quantity (for 4 people), unit, optional preparation notes
- "Add as custom ingredient" for items not in the database
- Drag-to-reorder (`react-native-draggable-flatlist`)

**Instructions section:**
- Dynamic numbered steps with instruction text, optional duration, optional tip
- Steps can be added, removed, and reordered

**Nutritional data section (optional):**
- Calories, protein, carbs, fat per 4 people

**Saving:** Saved to `custom_recipes` table in Supabase. "My Recipe" badge on cards. Edit, delete, and duplicate options on the recipe detail screen.

---

### Feature 14 — Premium Recipe API (Future-Ready Architecture)

Design the recipe API layer so a premium provider can be plugged in with minimal code changes.

**Settings screen — External Recipe APIs section:**
- Picker: "TheMealDB (Free, no key required)" | "Spoonacular" | "Edamam"
- When a premium provider is selected: API key input, link to provider sign-up, "Test Connection" button
- API key stored in `expo-secure-store` (never in Supabase or plain AsyncStorage)
- Notice: "Your API key is stored securely on this device only."

**Feature comparison table:**

| Feature | TheMealDB (Free) | Spoonacular | Edamam |
|---|---|---|---|
| Recipe search | ✓ | ✓ | ✓ |
| Browse by category | ✓ | ✓ | ✓ |
| Nutritional data | ✗ | ✓ | ✓ |
| Diet/allergy filters | ✗ | ✓ | ✓ |
| Search by ingredients | ✗ | ✓ | ✗ |
| API key required | No | Yes | Yes |

**Abstraction layer (`src/services/recipeApi.ts`):** Implement the `RecipeApiService` interface for TheMealDB (default), Spoonacular, and Edamam. Active provider determined by settings at runtime. Falls back to TheMealDB if no key is set.

---

### Feature 15 — Fussy Eater Profiles

**Profile setup (Settings → Family Profiles):**
- Add family members by name with an avatar emoji
- For each person: allergens (from the 14 UK major allergens), dislikes (free-text), diet type
- Synced to `family_members` table in Supabase

**Recipe conflict indicators:**
- Green chip — this person can eat this meal
- Amber chip — this person dislikes one or more ingredients
- Red chip — this person has an allergen conflict (shown prominently)

**Filtering:**
- "Safe for Everyone" filter toggle in the recipe browser
- Conflict indicators in the "Add Meal" bottom sheet
- Red warning icon on planner day cards with a tooltip listing affected family members

**Fussy Eater Mode (Settings toggle):** When enabled, automatically hides all recipes containing any ingredient listed as a dislike by any family member.

---

### Feature 16 — Meal Plan Templates

**Saving:** "Save as Template" button on the Planner screen — prompts for a name. Current 7-day plan saved to `meal_plan_templates` in Supabase. Up to 10 templates per user.

**Loading:** "Load Template" bottom sheet showing all saved templates as cards: name, 7 meal names, estimated cost for current family size, date last used. Preview option; load replaces current week after confirmation.

**Additional controls:**
- "Copy Last Week" shortcut
- Rename and Delete options
- "Export Template" — shares as JSON via the native share sheet
- "Import Template" — accepts pasted JSON string

---

### Feature 17 — Allergen Warnings

**The 14 UK major allergens:**
Celery · Cereals containing gluten · Crustaceans · Eggs · Fish · Lupin · Milk · Molluscs · Mustard · Peanuts · Sesame · Soybeans · Sulphur dioxide & sulphites · Tree nuts

**Data layer:** Every ingredient includes `allergens: Allergen[]`. Pre-populate for all starter data.

**Display throughout the app:**
- Recipe detail screen: dedicated allergen summary panel; allergen indicator on each ingredient row
- Recipe cards: compact allergen chips
- Shopping list: allergen indicators next to each item
- Meal planner: red warning icon on day cards when a family member's allergen is triggered
- Recipe browser: "Exclude Allergens" multi-select filter

**Disclaimer (on every allergen panel):** "Allergen information is provided as a guide only. Always check product labels when shopping, as formulations and manufacturing processes can vary. If you have a severe allergy, consult a healthcare professional."

---

### Feature 18 — Freezer-Friendly Tagging & Batch Cook Planner

**Recipe tagging:** `freezerFriendly: boolean`, `batchCookNotes: string`, `onePot: boolean`, `kidFriendly: boolean` on every recipe. Pre-populate for all 8 starter recipes. Snowflake ❄️ badge on recipe cards.

**Batch Cook Planner:** "Batch Cook Day" feature on the Planner screen. App suggests which freezer-friendly meals from the upcoming week could be made in bulk, showing combined ingredient list and total cost for double/triple portions. "Cook Once, Eat Twice" mode.

**Freezer Inventory (Pantry → Freezer tab):**
- Log meals and ingredients in the freezer: label, type, portions/quantity, date frozen, optional use-by date
- "Scan to Log" button — opens barcode scanner
- Frozen meal portions deduct that day's ingredient cost to £0.00 in the planner and shopping list
- Amber warning when items are approaching 3 months old
- Synced to `freezer_items` table in Supabase

---

### Feature 19 — Quick Meal Filters

Quick filter chips in a horizontally scrollable row at the top of the recipe browser. Multiple chips active simultaneously — results are the intersection of all active filters.

| Filter Chip | Logic |
|---|---|
| Under 30 mins | `prepTime + cookTime <= 30` |
| Under 45 mins | `prepTime + cookTime <= 45` |
| 5 ingredients or fewer | `recipe.ingredients.length <= 5` |
| One pot / one pan | `onePot: true` |
| Freezer-friendly | `freezerFriendly: true` |
| Kid-friendly | `kidFriendly: true` |
| Safe for everyone | No allergen or dislike conflicts for any family member |
| In season | Contains at least one currently in-season ingredient |
| Deals available | Contains at least one ingredient with an active deal |

Additional: "Quickest This Week" widget on Home screen; "Quickest first" sort option in the recipe browser.

---

### Feature 20 — Barcode Scanner

Use `expo-camera` and `expo-barcode-scanner` for **native barcode scanning** — far superior to browser-based scanning, works instantly on iOS and Android.

**Technical implementation:**
- Use `expo-barcode-scanner` with `BarCodeScanner.scanFromURLAsync` or the camera-based `BarCodeScanner` component
- Scanner renders a full-screen camera view with a targeting reticle overlay
- Decoding is handled natively — no JavaScript barcode library needed
- On web: fall back to a manual barcode entry text input
- Request camera permission via `BarCodeScanner.requestPermissionsAsync()`. If denied, explain why and offer the manual fallback.
- Scanner screen must be dismissible at any time (back button / swipe down)

**Open Food Facts API integration:**
- Query: `https://world.openfoodfacts.org/api/v0/product/{barcode}.json`
- Fuzzy-match product name against the local ingredient database (70% similarity threshold)
- Confident match → proceed automatically to the relevant action
- No confident match → show raw product name; user selects from dropdown, adds as custom, or skips
- Cache lookups in `AsyncStorage` — check cache before every network request
- Scan history synced to `scan_history` table in Supabase

**Four scan entry points:**

1. **Pantry / Cupboard screen** — "Scan Item" button: scan → confirm match → "Mark as In Stock?" with optional quantity
2. **Shopping List screen** — "Scan to Add" button: scan → matched ingredient added as an ad-hoc item
3. **Freezer Inventory screen** — "Scan to Log" button: scan → confirm → enter portions/quantity → logged with today's date
4. **Budget screen** — "Scan & Compare" button: scan → shows all 6 supermarket prices → "Did you buy this today? Enter what you paid:" → logs to `price_logs` in Supabase

**Scanned product history:**
- "Recently Scanned" section on the Pantry screen (last 20 scans from Supabase)
- One-tap re-add buttons for each item

**Privacy note in scanner screen:** "Your camera is used only to read the barcode. No images are stored or shared."

**Dependencies:**
```
npx expo install expo-camera expo-barcode-scanner expo-haptics expo-keep-awake expo-image-picker expo-sharing expo-secure-store
```

Create a reusable `BarcodeScanner` screen component at `src/components/BarcodeScanner.tsx` that encapsulates all camera and permission logic, accepts an `onDetected(barcode: string)` callback, and handles all permission, error, and fallback states internally.

---

### Feature 21 — Push Notifications

Use `expo-notifications` to send helpful reminders to the family.

**Notification types:**
- **Weekly plan reminder** — "You haven't planned your meals for this week yet. Tap to start planning!" — sent every Sunday evening if the current week's planner is empty
- **Freezer use-by warning** — "You have items in your freezer that are approaching 3 months old. Check your freezer inventory." — sent when a freezer item's use-by date is within 7 days
- **Budget alert** — "You're close to your weekly dinner budget. Tap to see cheaper meal options." — triggered when projected spend exceeds 80% of the budget

**Implementation:**
- Request notification permissions on first launch via `expo-notifications`
- Schedule local notifications for weekly reminders using `expo-notifications` scheduled notifications
- Store notification preferences in the `profiles` table in Supabase
- Allow users to enable/disable each notification type in Settings → Preferences

---

## Data Architecture

### TypeScript Interfaces

```typescript
type Allergen =
  | "celery" | "gluten" | "crustaceans" | "eggs" | "fish"
  | "lupin" | "milk" | "molluscs" | "mustard" | "peanuts"
  | "sesame" | "soybeans" | "sulphites" | "tree-nuts";

type Supermarket = "Tesco" | "Sainsbury's" | "Asda" | "Morrisons" | "Lidl" | "Aldi";

interface Ingredient {
  id: string;
  name: string;
  category: "meat" | "dairy" | "vegetables" | "pasta-rice" | "canned"
          | "spices" | "bakery" | "frozen" | "condiments" | "other";
  unitType: "g" | "ml" | "item" | "tbsp" | "tsp";
  baseQuantityPer4: number;
  allergens: Allergen[];
  prices: {
    supermarket: Supermarket;
    pricePerUnit: number;     // £ per standard pack/unit
    unitLabel: string;        // e.g. "500g", "1 litre", "6 pack"
  }[];
}

interface Recipe {
  id: string;
  name: string;
  description: string;
  category: "pasta" | "roast" | "curry" | "soup" | "pie"
           | "stir-fry" | "bake" | "grill";
  tags: string[];
  servesBase: 4;
  prepTime: number;           // minutes
  cookTime: number;           // minutes
  difficulty: "easy" | "medium" | "hard";
  image: string;              // URL
  ingredients: {
    ingredientId: string;
    quantityPer4: number;
    unit: string;
    notes?: string;
  }[];
  steps: {
    stepNumber: number;
    instruction: string;
    duration?: number;        // minutes
    tip?: string;
  }[];
  nutritionPer4: {
    calories: number;
    protein: number;          // g
    carbs: number;            // g
    fat: number;              // g
  } | null;
  tips?: string[];
  dietaryInfo: {
    vegetarian: boolean;
    vegan: boolean;
    glutenFree: boolean;
    dairyFree: boolean;
  };
  allergens: Allergen[];
  freezerFriendly: boolean;
  batchCookNotes?: string;
  onePot: boolean;
  kidFriendly: boolean;
}

interface ImportedRecipe extends Recipe {
  source: "themealdb" | "spoonacular" | "edamam";
  externalId: string;
  importedAt: string;         // ISO date
  userId: string;
}

interface CustomRecipe extends Recipe {
  source: "custom";
  createdAt: string;          // ISO date
  updatedAt: string;          // ISO date
  userId: string;
}

interface Deal {
  ingredientId: string;
  supermarket: Supermarket;
  originalPrice: number;
  dealPrice: number;
  dealLabel: string;          // e.g. "Clubcard Price", "2 for £3"
  validUntil: string;         // ISO date
}

interface FamilyMember {
  id: string;
  userId: string;
  name: string;
  avatarEmoji: string;
  allergens: Allergen[];
  dislikes: string[];
  dietType: "none" | "vegetarian" | "vegan" | "gluten-free" | "dairy-free";
}

interface MealPlanTemplate {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
  days: {
    monday?: string;          // recipeId
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
}

interface FreezerItem {
  id: string;
  userId: string;
  label: string;
  type: "meal" | "ingredient";
  recipeId?: string;
  ingredientId?: string;
  portions?: number;
  quantity?: number;
  frozenAt: string;           // ISO date
  useByDate?: string;         // ISO date
}

interface BarcodeCacheEntry {
  barcode: string;
  productName: string;
  matchedIngredientId?: string;
  cachedAt: string;
}
```

### Utility Functions

Implement in `src/utils/`:

```typescript
// src/utils/pricing.ts
function scaleQuantity(baseQuantity: number, familySize: number): number
function getCheapestPrice(ingredientId: string): { supermarket: Supermarket; price: number; unitLabel: string }
function calculateRecipeCost(recipe: Recipe, familySize: number, pantry?: PantryItem[], freezer?: FreezerItem[]): { totalCost: number; costPerPerson: number; ingredientBreakdown: IngredientCostRow[] }
function buildShoppingList(recipes: Recipe[], familySize: number, pantry?: PantryItem[], freezer?: FreezerItem[]): ShoppingListItem[]
function scoreRecipeByPantry(recipe: Recipe, pantry: PantryItem[]): { ownedCount: number; totalCount: number; coveragePercent: number; missingIngredients: RecipeIngredient[]; missingCost: number }

// src/utils/nutrition.ts
function calculateWeeklyNutrition(mealPlan: WeeklyMealPlan, familySize: number): WeeklyNutrition

// src/utils/allergens.ts
function checkAllergenConflicts(recipe: Recipe, familyMembers: FamilyMember[]): AllergenConflict[]

// src/utils/seasonal.ts
function getActiveDeals(recipe: Recipe): Deal[]
function isInSeason(ingredientId: string, month: number): boolean

// src/utils/fuzzyMatch.ts
function fuzzyMatch(query: string, target: string): number  // returns 0–1 similarity score
```

### Zustand Stores

Create the following Zustand stores in `src/stores/`, each persisted to `AsyncStorage` and synced with Supabase:

- `useAuthStore` — session, user, profile, family size
- `useMealPlanStore` — current and past week meal plans
- `usePantryStore` — pantry items
- `useFreezerStore` — freezer inventory
- `useRecipeDataStore` — imported and custom recipes
- `useFavouritesStore` — favourites and ratings
- `useFamilyStore` — family member profiles
- `useTemplatesStore` — meal plan templates
- `useBudgetStore` — budget settings and price logs
- `useScanStore` — scan history and barcode cache

Each store must expose a `syncFromSupabase()` function called on app launch and on auth state change, and a `subscribeToRealtime()` function that sets up a Supabase real-time subscription for that table.

---

## Starter Recipe Data

Pre-populate the app with the following **8 family favourite recipes** in `src/data/recipes.ts`. Write full, detailed data for each: all ingredients with realistic UK supermarket prices (2024/2025), step-by-step instructions, nutritional information for 4 people, allergen data, and all boolean flags.

| # | Recipe | Category | Difficulty | Freezer | One Pot | Kid-Friendly |
|---|---|---|---|---|---|---|
| 1 | Spaghetti Bolognese | Pasta | Easy | ✓ | ✗ | ✓ |
| 2 | Chicken Tikka Masala | Curry | Medium | ✓ | ✗ | ✗ |
| 3 | Sunday Roast Chicken | Roast | Medium | ✗ | ✗ | ✓ |
| 4 | Shepherd's Pie | Pie | Easy | ✓ | ✗ | ✓ |
| 5 | Chicken & Leek Pie | Pie | Medium | ✓ | ✗ | ✓ |
| 6 | Sausage & Bean Casserole | Bake | Easy | ✓ | ✓ | ✓ |
| 7 | Cheesy Pasta Bake | Bake | Easy | ✓ | ✗ | ✓ |
| 8 | Toad in the Hole | Bake | Easy | ✗ | ✓ | ✓ |

Include realistic UK supermarket prices for all 6 supermarkets: **Tesco, Sainsbury's, Asda, Morrisons, Lidl, and Aldi**. Aldi and Lidl should consistently be the cheapest. Use approximate real-world 2024/2025 UK prices.

Pre-populate `src/data/deals.ts` with **5–8 example deals** across different supermarkets. Include clear comments explaining how to add new deals.

Pre-populate `src/data/seasonal.ts` with seasonal produce data for all 12 months (e.g. leeks Nov–Mar, asparagus Apr–Jun, courgettes Jun–Sep, parsnips Oct–Feb).

---

## Supermarket Colour Coding

| Supermarket | Background | Text |
|---|---|---|
| Tesco | `#005EB8` | White |
| Sainsbury's | `#F06C00` | White |
| Asda | `#78BE20` | White |
| Morrisons | `#FFD700` | Dark `#1A1A1A` |
| Lidl | `#0050AA` | White |
| Aldi | `#00539B` | White |

---

## Home Screen

The Home screen must show:

- Welcome message: "Good evening, [Family Name]! Planning meals for [N] people."
- This week's meal plan summary strip (7 day cards; assigned meals or empty slots; conflict warnings)
- This week's estimated total cost vs. budget progress bar
- "This Week's Deals" widget — active ingredient offers grouped by supermarket
- "In Season This Month" widget
- "What Can I Make?" shortcut button
- "Top Rated Meals" section — 3 highest-rated recipes
- "Recipe of the Day" — rotates daily based on date
- "Quickest This Week" — fastest meal in the current week's plan
- Savings tip (e.g. "Switch 2 ingredients to Aldi this week and save £4.20")

---

## Platform-Specific Considerations

**iOS:**
- Use `expo-haptics` for tactile feedback on key interactions (adding meals, marking in stock, scanning)
- Use `expo-keep-awake` during cooking mode so the screen does not dim
- Use `SafeAreaView` and `useSafeAreaInsets` throughout to handle notches and home indicator
- Use `KeyboardAvoidingView` with `behavior="padding"` on all forms

**Android:**
- Use `StatusBar` component to manage status bar appearance
- Use `android:windowSoftInputMode="adjustResize"` in `app.json` for keyboard handling

**Web:**
- Replace the bottom tab bar with a persistent left sidebar
- Replace `expo-barcode-scanner` with a manual barcode entry text input (camera scanning not supported on web)
- Use `Platform.OS === 'web'` checks where native APIs are unavailable
- Ensure all touch targets are at least 44px on mobile and have hover states on web

---

## Code Quality Requirements

- TypeScript throughout — strict mode, no `any` types
- Data files: `src/data/recipes.ts`, `src/data/ingredients.ts`, `src/data/deals.ts`, `src/data/seasonal.ts`
- Utility files: `src/utils/pricing.ts`, `src/utils/nutrition.ts`, `src/utils/allergens.ts`, `src/utils/seasonal.ts`, `src/utils/fuzzyMatch.ts`
- Supabase client: `src/lib/supabase.ts`
- API service: `src/services/recipeApi.ts` with TheMealDB, Spoonacular, and Edamam implementations
- Barcode cache: `src/lib/barcodeCache.ts` (AsyncStorage)
- All Supabase interactions through dedicated service functions in `src/services/`
- `useRecipeLibrary` hook must always return the merged view of built-in + imported + custom recipes
- Components: small and focused, no component over ~200 lines
- JSDoc comments on all utility functions and data model interfaces
- API keys stored in `expo-secure-store` only — never in Supabase, plain AsyncStorage, or source control
- Environment variables (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) in `.env.local` — never hardcoded

---

## Phased Build Order

| Phase | Focus | Key Deliverables |
|---|---|---|
| 1 | Project setup | Expo project, NativeWind, Expo Router, Supabase client, `.env.local`, folder structure |
| 2 | Authentication | Login, Register, Forgot Password screens; `useAuth` hook; session persistence |
| 3 | Data layer | All TypeScript data files, pricing utilities, scaling functions |
| 4 | App shell & navigation | Bottom tab bar, stack navigation, global family size selector, design tokens |
| 5 | Recipe browser | Card grid with quick filter chips, full filter panel, sorting, search |
| 6 | Recipe detail | Cost breakdown table, allergen panel, nutrition panel, cooking mode screen |
| 7 | Weekly meal planner | Calendar view, meal assignment, weekly cost and nutrition summary, Supabase sync |
| 8 | Shopping list | Aggregation from meal plan, supermarket grouping, pantry deduction toggle |
| 9 | Pantry tracker | Cupboard inventory, in-stock/low-stock states, Supabase sync |
| 10 | Leftover suggestions | "What Can I Make?" scoring engine and results UI |
| 11 | Nutritional overview | Per-recipe and per-week nutrition panels and charts |
| 12 | Budget planner | Budget settings, progress tracking, savings insights, Supabase sync |
| 13 | Ratings & favourites | Star rating widget, favourites screen, top-rated widget, Supabase sync |
| 14 | Deals & seasonal alerts | Deals data, seasonal data, deal badges, dashboard widgets |
| 15 | Online recipe search | TheMealDB integration, import flow, ingredient auto-matching, Supabase sync |
| 16 | Manual recipe builder | Recipe creation form, drag-to-reorder, image picker, Supabase sync |
| 17 | Premium API architecture | `recipeApi.ts` abstraction, Settings screen, Spoonacular & Edamam stubs |
| 18 | Allergen warnings | Allergen data on all ingredients & recipes, allergen panel, exclude filter |
| 19 | Fussy eater profiles | Family member profiles, conflict detection, Safe for Everyone filter, Supabase sync |
| 20 | Meal plan templates | Save/load/export/import templates, Copy Last Week, Supabase sync |
| 21 | Freezer & batch cook | Freezer inventory, batch cook planner, Cook Once Eat Twice, Supabase sync |
| 22 | Barcode scanner | `expo-barcode-scanner`, Open Food Facts, BarcodeScanner component, all 4 entry points |
| 23 | Push notifications | `expo-notifications`, weekly reminder, freezer warning, budget alert |
| 24 | Polish & web | Home screen, animations, haptics, web sidebar, platform-specific polish, offline handling |

---

## Important Notes

- All prices are **approximate** and based on 2024/2025 UK supermarket data. Include a disclaimer on the app that prices may vary — users should check current prices in store or online.
- The app does **not** connect to live supermarket pricing APIs — all pricing is static data maintained manually in `src/data/ingredients.ts`.
- The **family size selector** is the most important interactive element. Every cost figure, quantity, and nutritional value anywhere in the app must be derived from this value, which is stored in Supabase and synced across all devices.
- The **pantry deduction** and **freezer deduction** must be consistent across the shopping list, recipe detail cost table, and leftover suggestions — always use the same Zustand store state.
- The **recipe library** must always be a unified merged view (built-in + imported + custom) via `useRecipeLibrary` — never query only one source.
- **Allergen data is safety-critical.** Always display allergen warnings prominently. The disclaimer must appear on every allergen panel. Never hide or minimise allergen information for aesthetic reasons.
- **Family member conflict detection** must use a single `useAllergenCheck(recipeId)` hook — never duplicate this logic across components.
- **Freezer inventory** deductions must be reflected in the shopping list and meal plan cost totals — frozen portions show as £0.00 with a "Using frozen portion" label.
- **Quick filter chips** are stateless and composable — multiple chips active simultaneously produce the intersection of all filters.
- The **BarcodeScanner component** is fully self-contained — parent components only receive the decoded barcode string via `onDetected`. Never duplicate camera logic.
- **Barcode lookups** always check the local `AsyncStorage` cache before making a network request to Open Food Facts.
- **API keys** for premium recipe providers must be stored in `expo-secure-store` only. Include a comment in `recipeApi.ts` warning future developers never to expose keys in source control or transmit them to any server other than the chosen provider.
- **Supabase Row Level Security must be enabled on every table.** Never disable RLS. Every policy must check `user_id = auth.uid()`.
- Design all data files so that adding new recipes, deals, or seasonal data requires only editing the relevant data file — no other code changes should be needed.
- When building for web, always test that `Platform.OS === 'web'` fallbacks are in place for any native-only API (camera, haptics, keep-awake, secure store).

---

# PROMPT END

---

## Tips for Using This Prompt with Claude Code

**Starting the project:** Paste the full prompt and ask Claude Code to begin with Phase 1 (project setup). Work through phases sequentially — each phase builds on the last.

**Setting up Supabase:** Before starting Phase 2, create a new project in your Supabase account, copy the Project URL and anon key, and add them to `.env.local` as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Then ask Claude Code to create the database tables using the schema in this prompt.

**Running on your phone:** After Phase 1, run `npx expo start` and scan the QR code with the Expo Go app on your phone to see the app live.

**Adding new recipes:** *"Add a new recipe for [dish name]. Follow the same data structure as the existing recipes in `src/data/recipes.ts`. Include realistic UK supermarket prices for all 6 supermarkets, allergen data, and set the freezerFriendly, onePot, and kidFriendly flags appropriately."*

**Updating deals:** *"Update `src/data/deals.ts` with these new offers: [list your offers with supermarket, original price, deal price, and deal label]."*

**Updating prices:** *"Update the prices for [ingredient] in `src/data/ingredients.ts` to reflect current 2025 UK supermarket prices."*

**Adding a family member profile:** *"Add a family member profile for a child called [name] who is allergic to milk and eggs and dislikes mushrooms."*

**Connecting a premium recipe API:** Go to Settings → Recipe APIs in the app and paste in your Spoonacular or Edamam API key. The app will automatically switch to that provider.

**Adding a new API provider:** *"Add support for [API name] as a new recipe provider in `src/services/recipeApi.ts`. It uses [describe the API endpoints and authentication]. Implement the RecipeApiService interface and add it as an option in the Settings screen."*

**Extending the recipe library:** *"Add 5 more family favourite British recipes to `src/data/recipes.ts`, following the existing data structure."*

**Publishing to the App Store / Google Play:** Once the app is ready, ask Claude Code to help you configure `app.json` with your bundle identifier, app name, and icons, then run `eas build` using Expo Application Services (EAS) to create production builds for iOS and Android.
