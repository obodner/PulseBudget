import { AppSettings, BudgetCaps, Transaction } from './types';

const TRANSACTIONS_KEY = 'pulse_budget_transactions_v1';
const SETTINGS_KEY = 'pulse_budget_settings_v1';

export const DEFAULT_CAPS: BudgetCaps = {
  daily: 0,
  weekly: 0,
  monthly: 0,
  categoryCaps: {}
};

export const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  currency: '₪',
  caps: { ...DEFAULT_CAPS }
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      caps: {
        ...DEFAULT_CAPS,
        ...(parsed.caps || {}),
        categoryCaps: parsed.caps?.categoryCaps || {}
      }
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(TRANSACTIONS_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem('pulse_caps_configured');
  } catch (e) {
    console.error('Failed to clear storage:', e);
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export function loadTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    if (!raw) {
      return [];
    }
    const list: Transaction[] = JSON.parse(raw);
    const seen = new Set<string>();
    return list.filter(t => {
      if (!t.id || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  } catch {
    return [];
  }
}

export function saveTransactions(transactions: Transaction[]): void {
  try {
    const seen = new Set<string>();
    const unique = transactions.filter(t => {
      if (!t.id || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(unique));
  } catch (e) {
    console.error('Failed to save transactions:', e);
  }
}

export function generateDemoData(): Transaction[] {
  const list: Transaction[] = [];
  const now = new Date();

  // Salary at beginning of current month
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 9, 0);
  list.push({
    id: 'demo-sal-1',
    type: 'income',
    amount: 14500,
    category: 'salary',
    date: firstOfMonth.toISOString().slice(0, 16),
    note: 'משכורת חודשית',
    createdAt: firstOfMonth.getTime()
  });

  // Freelance income mid month
  const midMonth = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - 10), 14, 30);
  list.push({
    id: 'demo-inc-2',
    type: 'income',
    amount: 2200,
    category: 'business',
    date: midMonth.toISOString().slice(0, 16),
    note: 'פרויקט פרילנס',
    createdAt: midMonth.getTime()
  });

  // Daily / past days expenses distribution
  const expenseSamples = [
    { cat: 'food', note: 'סופרמרקט שופרסל', min: 140, max: 320 },
    { cat: 'food', note: 'ארוחת צהריים / וולט', min: 45, max: 95 },
    { cat: 'transport', note: 'דלק / רב-קו', min: 50, max: 240 },
    { cat: 'shopping', note: 'קניות זארה / אמזון', min: 90, max: 420 },
    { cat: 'entertainment', note: 'קולנוע ובילוי סופ"ש', min: 80, max: 210 },
    { cat: 'bills', note: 'חשבון חשמל ומים', min: 180, max: 480 },
    { cat: 'health', note: 'מנוי חדר כושר / פארם', min: 60, max: 220 },
  ];

  // Generate for past 14 days
  for (let d = 13; d >= 0; d--) {
    const itemDate = new Date(now);
    itemDate.setDate(now.getDate() - d);
    
    // 1-3 items per day
    const count = d === 0 ? 2 : (d % 3 === 0 ? 3 : 2);
    for (let i = 0; i < count; i++) {
      const sample = expenseSamples[(d * 2 + i) % expenseSamples.length];
      const hour = 9 + (i * 4);
      const minute = (i * 23) % 60;
      itemDate.setHours(hour, minute, 0, 0);

      const amount = Math.floor(sample.min + Math.random() * (sample.max - sample.min));
      list.push({
        id: `demo-exp-${d}-${i}`,
        type: 'expense',
        amount,
        category: sample.cat,
        date: itemDate.toISOString().slice(0, 16),
        note: sample.note,
        createdAt: itemDate.getTime()
      });
    }
  }

  return list.sort((a, b) => b.createdAt - a.createdAt);
}
