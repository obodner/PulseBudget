# PulseBudget — System Requirements Document (SRD)

**Document Version:** 1.0  
**Product Name:** PulseBudget (The Budget Pedometer)  
**Project Path:** `home_mng`  
**Deployment URL:** [https://pulsebudget-erez.web.app](https://pulsebudget-erez.web.app)  
**Status:** Production / Active  
**Author / Team:** PulseBudget Engineering  

---

## 1. Executive Summary & Vision

**PulseBudget** is a real-time personal finance and cashflow management web application built around the concept of a **"Financial Pedometer" (מד צעדים לתקציב)**. 

Just as fitness wearables track steps and heart rate throughout the day to encourage active physical habits, PulseBudget provides an instant, continuous feedback loop on daily spending speed and budgetary thresholds. By monitoring the financial "pulse" in real time, users avoid month-end surprises and maintain disciplined financial health through lightweight, gamified micro-interactions.

---

## 2. Motivation & Problem Statement

### 2.1 The Problem with Traditional Budgeting Apps
- **Delayed Awareness ("Post-Mortem Budgeting"):** Most users review their expenses only when credit card statements arrive or at the end of the calendar month—long after the money has already been spent.
- **Cognitive Friction & Tedious Forms:** Complex budgeting software requires burdensome account reconciliation, multi-nested menus, and accounting knowledge, causing high churn within the first 14 days.
- **Missing Proactive Pacing:** Traditional apps report historical totals (e.g., "You spent ₪4,200 this month") but fail to answer the immediate daily question: *"Can I afford to spend ₪150 on dinner tonight without exceeding my monthly target?"*
- **Mixing Incomes into Spending Restraints:** Many platforms offset limits by total income, causing false confidence where large irregular deposits (e.g., bonuses, tax refunds) mask dangerous daily overspending habits.

### 2.2 The PulseBudget Solution
- **The "Pedometer" Paradigm:** Treats budget caps as daily/weekly/monthly quotas. Every expense is a step that fills the glowing progress ring.
- **Zero-Latency Daily Pulse:** A single glance at the hero screen indicates if current spending is **Safe (Cyan)**, in **Warning (Amber)**, or **Danger (Crimson)**.
- **Strict Separation of Limits vs. Income:** Budget ceilings strictly measure expense discipline. Incomes are tracked cleanly for overall net worth and cash flow, but never inflate or distort expense caps.
- **Auditory & Visual Gamification:** Integrated Web Audio API synthesizes retro Super Mario chiptune sounds (Coin chime on safe additions, Game Over jingle on budget exceedance), transforming money tracking into an engaging, rewarding routine.

---

## 3. Target Customers & User Personas

### 3.1 Target Market Segments
1. **Young Professionals & Digital Natives (Ages 20–38):** Tech-savvy consumers, freelancers, and salaried workers who want quick mobile logging and modern dark-mode aesthetics.
2. **Couples & Household Financial Managers:** Individuals responsible for keeping groceries, fuel, leisure, and household utility bills strictly bounded within predefined monthly ceilings.
3. **Budget-Conscious Savers & Recovering Overspenders:** Users actively trying to limit discretionary spending (dining out, impulse online shopping) through real-time guardrails.

### 3.2 User Personas

```
+-------------------------------------------------------------------------------+
| Persona 1: "The Daily Mindful Spender" (e.g., Maya, 29, Product Designer)      |
| • Goal: Stop overspending on daily lunches, coffee, and deliveries.           |
| • Pain Point: Loses track of small daily NIS 40-100 expenses until end-of-month.|
| • PulseBudget Value: Opens app on mobile, logs coffee in 3 seconds, sees      |
|   her daily ring at 60% (Safe Cyan), hears a satisfying coin chime.           |
+-------------------------------------------------------------------------------+

+-------------------------------------------------------------------------------+
| Persona 2: "The Family Household Gatekeeper" (e.g., Erez, 41, Operations Mgr) |
| • Goal: Keep family living expenses strictly under ₪14,000/month.              |
| • Pain Point: Unclear pacing mid-month; wants to know exact daily burn rate.   |
| • PulseBudget Value: Uses Monthly Combo Chart to track cumulative curve vs.    |
|   red ceiling line, and inspects daily bar spikes to diagnose expensive days. |
+-------------------------------------------------------------------------------+
```

---

## 4. Product Principles & Financial Business Logic

### 4.1 The Golden Expense Cap Principle
> **Rule:** *Budget ceilings and pedometer rings apply exclusively to EXPENSES.*

- **Expenses:** Count against the Daily, Weekly, and Monthly caps. They fill the progress ring and trigger warning/danger states.
- **Income:** Tracked purely for cashflow statistics (`metricIncValue`, `metricNetValue`, income tabs). Incomes do NOT increase remaining budget caps or reset the progress ring.

### 4.2 Status Thresholds & Color Code
- **Safe State (`percent < 80%`):**
  - Accent Color: `#00F5D4` (Neon Cyan)
  - Pace: "בקצב תקין ומאוזן" (On-track & balanced)
- **Warning State (`80% <= percent <= 100%`):**
  - Accent Color: `#F59E0B` (Amber / Warning Gold)
  - Pace: "קצב צריכה מואץ - תשומת לב" (Accelerated burn rate - caution)
- **Danger / Over-Cap State (`percent > 100%`):**
  - Accent Color: `#EF4444` (Crimson Red)
  - Pace: "חריגה מתקרת התקציב!" (Budget Ceiling Exceeded!)
  - Triggers Mario warning/game-over audio and pulsating red visual glow.

### 4.3 Pacing & Burn Rate Logic
For any period, PulseBudget calculates:
$$\text{Burn Percent} = \left( \frac{\text{Total Period Expenses}}{\text{Period Cap}} \right) \times 100$$
$$\text{Remaining} = \max(0, \text{Period Cap} - \text{Total Period Expenses})$$
$$\text{Net Cashflow} = \text{Total Incomes} - \text{Total Expenses}$$

---

## 5. Functional Requirements (FR)

### 5.1 User Authentication & Cloud Synchronization (FR-AUTH)
- **FR-AUTH-1 (Google OAuth):** One-click sign-in with Google via popup with `prompt: 'select_account'` support.
- **FR-AUTH-2 (Email / Password):** Full registration and sign-in capabilities with validation.
- **FR-AUTH-3 (Guest / Offline Fallback):** Seamless offline functionality using browser `localStorage` when unauthenticated.
- **FR-AUTH-4 (Cloud Sync):** When authenticated, real-time bidirectional synchronization via Firebase Cloud Firestore.
- **FR-AUTH-5 (Profile Modal):** Displays user avatar, email, authentication status, and sign-out action.
- **FR-AUTH-6 (Custom Profile Display Name - FR-PROFILE-NAME):**
  - **Personalization:** Allows users to edit and update their display name at any time directly from the profile dropdown, both via a quick pencil action button in the header and through a dedicated menu option.
  - **Edit Dialog & Validation:** Opens a dedicated modal dialog with auto-focused text input and robust validation (non-empty, length between 1 and 50 characters, trims extraneous whitespace).
  - **Multi-Tier Persistence:** Immediate synchronization across Firebase Auth user profile (`updateProfile`), Firestore user document (`users/{uid}`), and browser `localStorage` (`pulsebudget_profile_name`) for seamless guest and offline operation.
  - **Instant Live Feedback:** Immediate UI refresh updating avatar initial, greeting title, profile header, synthesized 8-bit retro chime (Mario 1-UP), and toast notification without full page reload.

### 5.2 Budget Ceiling Management (FR-CAPS)
- **FR-CAPS-1 (Multi-Tier Targets):** Ability to configure **Daily**, **Weekly**, and **Monthly** expense ceilings in NIS (₪).
- **FR-CAPS-2 (Initial Setup Wizard):** If no caps are set, prompts the user on first launch to configure targets.
- **FR-CAPS-3 (Instant Recalculation):** Editing caps immediately recalculates all ring percentages, remaining allowances, and chart ceiling lines without page reload.

#### 5.2.1 Category-Based Budget Caps (FR-CATEGORY-CAPS)

##### 1. Overview & Core Principles
- **Extending the Caps Engine:** Broadens the ceiling setting capabilities (Daily, Weekly, Monthly) to allow limits at the individual expense category level in addition to the overall general cap.
- **Expenses Only:** In accordance with the system's core principle, category caps apply strictly to transactions of type `expense`.

##### 2. Hierarchy & "General" Category Logic (Umbrella Budget)
- **Umbrella Budget:** The "General" (`כללי`) category serves as the master umbrella ceiling for total system expenses.
- **Upper Bound Enforcement:** A cap defined on a specific category (Daily, Weekly, or Monthly) cannot exceed the corresponding cap defined in "General".
- **Dependencies & Synchronization:** When typing or updating a category cap, the system performs real-time validation:
  - If `CategoryCap > GeneralCap`, saving is blocked with an explicit error alert.
  - Decreasing the "General" cap below an existing category cap prompts the user for guided adjustments.

##### 3. Validation & Minimum Requirements
- **Minimum Configuration Safeguard:** To preserve the integrity of the "Financial Pedometer", at least one valid cap (Daily, Weekly, or Monthly) must be defined either in one of the expense categories or in "General".
- **Empty State Prevention:** The caps modal cannot be saved without satisfying this minimum threshold.

##### 4. User Interface — Caps Modal (UI/UX)
- **Unified & Transparent Overview:** The modal presents a consolidated list of all expense categories (including existing icons: Food, Transport, Leisure, etc.) alongside the "General" category.
- **Editing & Overview:**
  - Dedicated input fields for Daily, Weekly, and Monthly caps (₪) per category.
  - Clear visual indicator for categories with active limits vs. unrestricted categories.
  - Real-time display of the "General" upper bound adjacent to category input fields.

##### 5. Category Cap Breach Notifications
- **In-App Floating Toast:** When an expense causes a category to breach its daily, weekly, or monthly ceiling, an instant neon alert toast pops at top-center with exact spent, cap, and overrun numbers.
- **Audio & Haptic Feedback:** Triggers retro 8-bit Mario Game Over audio (`playMarioGameOver`) and mobile vibration patterns.
- **System Web Notifications:** Sends a native browser push notification via Web Notifications API (if permission granted).
- **Dashboard Alert Banner:** Displays all active category overruns in the main dashboard banner for the selected time horizon.
- **Ledger Breach Badge:** Tags offending transactions in the ledger with a visible `חריגה בקטגוריה` badge.
 
##### 6. Top Notification Bell & Active Overrun Counter (FR-NOTIF-BELL)
- **Top Navigation Alignment:** The notification bell icon is strictly positioned in the top navigation row to the left of the user profile button on both desktop and mobile viewports.
- **Real-Time Active Breach Counter Badge:**
  - Vibrant neon red badge positioned over the bell displaying the exact count of breached caps across all tracked horizons (daily, weekly, monthly, custom).
  - Automatically updates on every transaction record, edit, deletion, and ceiling adjustment.
  - Remains concealed or clean when no active overruns exist.
- **Interactive Notification Dropdown Popover:**
  - Clicking the bell opens a sleek glassmorphic popover displaying a detailed list of all breached categories (category icon, period tag, spent amount, cap, and exact overrun value).
  - Empty State: When no limits are exceeded, displays an encouraging green state: *"No active overruns - all under control!"*.
- **One-Click Period Jump Navigation:** Clicking any breached alert item directly jumps the active dashboard view to the corresponding period (e.g., switches to weekly or daily view), recalculating the pedometer ring, metrics, breakdown table, and charts, while smoothly closing the popover.

### 5.3 Transaction Engine (FR-TX)
- **FR-TX-1 (Transaction Creation):** Modal for recording:
  - Amount (₪)
  - Type: Expense (`הוצאה`) or Income (`הכנסה`)
  - Category (with dynamic category selector tailored to transaction type)
  - Date & Time (HTML5 `datetime-local` input)
  - Free-text Note (`הערה / בית עסק`)
- **FR-TX-2 (Idempotency & Deduplication):** Enforces unique IDs per transaction (`crypto.randomUUID()` or timestamped keys) preventing duplicate entries.
- **FR-TX-3 (Inline Deletion):** Transactions can be removed directly from the ledger with instant budget and chart updates.
- **FR-TX-4 (Ledger Tabs & Filters):**
  - Tabs: "הכל", "הוצאות", "הכנסות" with live count badges on tab labels (e.g. `הוצאות (24)`).
  - Contextual custom date range selector shown only when the "טווח תאריכים" period is activated.
  - Overlap prevention: Clean numeric display without redundant currency symbols in dense rows.

### 5.4 The "Pedometer" Hero Visualizer (FR-HERO)
- **FR-HERO-1 (SVG Circular Gauge):** High-precision SVG ring ($r = 90$, circumference $\approx 565.48\text{px}$) with CSS transition smoothing.
- **FR-HERO-2 (Period Switching):** Switch seamlessly between Daily, Weekly, Monthly, and Custom Range views.
- **FR-HERO-3 (Metric Cards):** Displays:
  - Total Spent (`נוצל`)
  - Target Cap (`תקרה`)
  - Remaining Allowance (`נותר`)
  - Total Income (`הכנסות`)
  - Net Balance (`מאזן נטו`)

### 5.5 Advanced Analytics & Charts (FR-CHART)
- **FR-CHART-1 (Daily View):** Horizontal bar chart of expenses broken down by categories with percentage breakdown.
- **FR-CHART-2 (Weekly View):** 7-day bar chart (Sunday–Saturday) with color-coded daily bars and dashed daily target line.
- **FR-CHART-3 (Monthly Combo Chart with Dual Y-Axes):**
  - **Left Y-Axis (Cyan):** Cumulative month-to-date expense line with gradient fill, plus dashed red monthly cap line.
  - **Right Y-Axis (Neon Violet):** Daily expense bars showing individual day totals.
  - **Dynamic Bar Coloring:** Violet for standard days, Amber for days reaching 80% of daily cap, Crimson for days exceeding daily cap.
  - **Smart Tooltips:** Shows Day of month, daily expense amount, and cumulative sum. Suppresses null data for future calendar days.
- **FR-CHART-4 (Custom Range View):** Dynamic category distribution for user-defined date intervals.
- **FR-CHART-5 (Category Budget Breakdown Table Below Graph - FR-CAT-BREAKDOWN-TABLE):**
  - **Placement & Structure:** Dedicated tabular breakdown panel positioned directly below the chart canvas and above the transaction ledger (`txSection`), styled in cohesive dark glassmorphism.
  - **Period-Conditional Visibility:**
    - Rendered strictly when viewing standard calendar horizons: **Daily (`daily`)**, **Weekly (`weekly`)**, or **Monthly (`monthly`)**.
    - Completely suppressed and hidden when selecting **Custom Date Range (`custom`)**, preventing clutter where strict static category caps are not configured.
  - **Activity-Filtered Categories:** Displays only categories that have registered actual expenses in the active timeframe (`spent > 0`), ensuring a clean, focused display without zero-spend noise.
  - **Data Columns & Metrics:**
    1. *Category:* Category icon, name, and visual identifier.
    2. *Period Cap (₪):* The allocated ceiling for the category in the selected timeframe, or a dash (`-`) if no specific limit is set.
    3. *Total Spent (₪):* Aggregate expenditure recorded for that category in the selected timeframe.
    4. *% Utilization & Visual Progress:*
       - Exact percentage calculation ($\frac{\text{Spent}}{\text{Cap}} \times 100$).
       - Animated neon mini progress bar with 3-tier color coding: Safe (Cyan <80%), Warning (Amber 80%-100%), and Breach (Red >100% with a prominent glowing `Over-Cap!` badge).
  - **Live Bidirectional Synchronization:** Recalculates and updates instantly in response to transaction additions, removals, edits, or ceiling reconfigurations.

### 5.6 Gamified Sound Synthesizer (FR-SOUND)
- **FR-SOUND-1 (Zero External Assets):** 100% synthesized via Web Audio API oscillators and gain nodes.
- **FR-SOUND-2 (Sound Library):**
  - *Mario Jump:* UI click/tap confirmation.
  - *Mario Coin:* Successful transaction save.
  - *Mario 1-UP:* Setup completion or positive milestone.
  - *Mario Bump:* Warning threshold reached.
  - *Mario Game Over:* Budget ceiling exceeded.
- **FR-SOUND-3 (Sound Toggle):** Global mute setting stored in user preferences.

---

## 6. Non-Functional Requirements (NFR)

### 6.1 Performance & Responsiveness
- **Page Load:** Initial bundle load under 1.5 seconds on 4G mobile networks.
- **Micro-Interaction Latency:** Sub-50ms UI response upon clicking tabs, toggles, or modals.
- **Bundle Optimization:** Tree-shaken production bundle via Vite; gzipped footprint under 260KB.

### 6.2 UI/UX & Design Philosophy
- **RTL-First Architecture:** Native right-to-left layout designed specifically for Hebrew speakers.
- **Typography:** Modern Google Fonts (`Heebo` for primary Hebrew typography, `JetBrains Mono` for financial figures, `Outfit` for brand accents).
- **Dark-Mode Glassmorphism:** High-contrast palette (`#0F172A` Slate Dark, `#00F5D4` Neon Cyan, `#A855F7` Neon Violet, `#EF4444` Crimson).
- **Mobile Ergonomics:** Compact header structure (maximum 2 rows on mobile screens), sticky bottom action buttons, and touch-optimized tap targets ($\ge 44\text{px}$).

### 6.3 Security & Data Privacy
- **Isolated User Storage:** All cloud records are scoped strictly under `users/{userId}/*`.
- **Firestore Security Rules:** Server-side declarative enforcement ensuring users can only read and write their own documents:
  ```javascript
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{userId}/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
  ```
- **Zero Cross-Tenant Leakage:** Client applications never query global collections.

### 6.4 Reliability & Resilience
- **Offline First:** All operations function continuously without internet connectivity, storing changes in `localStorage`.
- **Automatic Reconciliation:** When online connectivity is restored or user authenticates, transactions synchronize seamlessly.

---

## 7. System Architecture & Tech Stack

```
+---------------------------------------------------------------+
|                      Client Web Application                   |
|  [TypeScript + Vite + Vanilla CSS Glassmorphism + Web Audio] |
+-------------------------------+-------------------------------+
                                |
          +---------------------+---------------------+
          |                                           |
          v                                           v
+-----------------------+                   +-------------------+
| Browser LocalStorage  |                   | Firebase Auth     |
| (Offline Fallback &   |                   | (Google & Email)  |
|  Guest Preferences)   |                   +---------+---------+
+-----------------------+                             |
                                                      v
                                            +-------------------+
                                            | Cloud Firestore   |
                                            | users/{uid}/txs   |
                                            | users/{uid}/caps  |
                                            +-------------------+
```

### 7.1 Tech Stack Table
| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Core Language** | TypeScript (ES2022) | Type-safe business logic & DOM interaction |
| **Bundler / Dev Server** | Vite 6 | Rapid HMR and optimized production build |
| **Styling** | Vanilla CSS3 | Custom design system, CSS variables, glassmorphism |
| **Charts** | Chart.js 4 | Responsive canvas charts, dual Y-axis combo graph |
| **Sound Synthesis** | Web Audio API | Pure synthesized 8-bit retro audio effects |
| **Authentication** | Firebase Auth | OAuth 2.0 (Google) and Email/Password provider |
| **Database** | Cloud Firestore | Real-time NoSQL cloud document database |
| **Hosting** | Firebase Hosting | Global CDN hosting with SSL |

---

## 8. Data Schema & Models

### 8.1 Transaction Entity (`src/types.ts`)
```typescript
export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;             // Unique identifier (UUID or Firestore Doc ID)
  type: TransactionType;  // 'expense' | 'income'
  amount: number;         // Positive numeric amount in NIS (₪)
  category: string;       // e.g. 'food', 'transport', 'salary'
  date: string;           // ISO format: YYYY-MM-DDTHH:mm or YYYY-MM-DD
  note?: string;          // User description / vendor name
  receiptUrl?: string;    // Cloud Storage download URL for receipts
  createdAt: number;      // Epoch timestamp in milliseconds
}
```

### 8.2 Budget Caps Entity
```typescript
export interface BudgetCaps {
  daily: number;                                      // Daily ceiling in ₪ (e.g. 350)
  weekly: number;                                     // Weekly ceiling in ₪ (e.g. 2500)
  monthly: number;                                    // Monthly ceiling in ₪ (e.g. 10000)
  categoryCaps?: Record<string, Partial<BudgetCaps>>; // Category-specific ceilings
}
```

### 8.3 Categories Directory (`src/categories.ts`)
- **Expense Categories:**
  - 🍔 מזון ומסעדות (`food`)
  - 🚗 תחבורה ודלק (`transport`)
  - ⚡ חשבונות וחשמל (`bills`)
  - 🛍️ קניות וביגוד (`shopping`)
  - 🎉 בילויים ופנאי (`entertainment`)
  - 💊 בריאות וכושר (`health`)
  - 🏠 דיור ואחזקה (`housing`)
  - 📦 הוצאות שונות (`other_exp`)
- **Income Categories:**
  - 💼 משכורת (`salary`)
  - 🚀 עסק / פרילנס (`business`)
  - 📈 השקעות ותשואה (`investment`)
  - 🎁 מתנה / קצבה (`gift`)
  - 💰 הכנסה אחרת (`other_inc`)

---

## 9. Future Roadmap & Enhancements

1. **Receipt OCR & Image Upload:** Leverage the existing `uploadReceipt` integration with Google Cloud Storage and Gemini AI Logic to auto-extract amount, date, and vendor from scanned paper receipts.
2. **Collaborative Family Budgets:** Multi-user shared vaults enabling partners to record to the same pool in real time.
3. **Daily Evening Digest Push Notifications:** Gentle end-of-day browser notification summarizing day burn vs. daily target.
4. **Data Portability:** 1-click export to Excel / CSV and import of bank transaction files.
