import { CategoryInfo } from './types';

export const DEFAULT_CATEGORIES: CategoryInfo[] = [
  // Expenses
  { id: 'food', name: 'מזון ומסעדות', icon: '🍔', color: '#FF7A00', type: 'expense' },
  { id: 'transport', name: 'תחבורה ודלק', icon: '🚗', color: '#00D2FF', type: 'expense' },
  { id: 'bills', name: 'חשבונות וחשמל', icon: '⚡', color: '#FACC15', type: 'expense' },
  { id: 'shopping', name: 'קניות וביגוד', icon: '🛍️', color: '#EC4899', type: 'expense' },
  { id: 'entertainment', name: 'בילויים ופנאי', icon: '🎉', color: '#8B5CF6', type: 'expense' },
  { id: 'health', name: 'בריאות וכושר', icon: '💊', color: '#10B981', type: 'expense' },
  { id: 'housing', name: 'דיור ואחזקה', icon: '🏠', color: '#6366F1', type: 'expense' },
  { id: 'other_exp', name: 'הוצאות שונות', icon: '📦', color: '#94A3B8', type: 'expense' },

  // Incomes
  { id: 'salary', name: 'משכורת', icon: '💼', color: '#10B981', type: 'income' },
  { id: 'business', name: 'עסק / פרילנס', icon: '🚀', color: '#00F5D4', type: 'income' },
  { id: 'investment', name: 'השקעות ותשואה', icon: '📈', color: '#38BDF8', type: 'income' },
  { id: 'gift', name: 'מתנה / קצבה', icon: '🎁', color: '#F43F5E', type: 'income' },
  { id: 'other_inc', name: 'הכנסה אחרת', icon: '💰', color: '#A855F7', type: 'income' },
];

export const CATEGORIES: CategoryInfo[] = [...DEFAULT_CATEGORIES];

let customCategories: CategoryInfo[] = [];

export function getCustomCategories(): CategoryInfo[] {
  return [...customCategories];
}

export function setCustomCategories(cats: CategoryInfo[]): void {
  customCategories = cats.map(c => ({ ...c, isCustom: true }));
  CATEGORIES.length = 0;
  CATEGORIES.push(...DEFAULT_CATEGORIES, ...customCategories);
}

export function addCustomCategory(cat: Omit<CategoryInfo, 'type'> & { type?: 'expense' | 'income' }): CategoryInfo {
  const newCat: CategoryInfo = {
    ...cat,
    type: cat.type || 'expense',
    isCustom: true
  };
  const existingIdx = customCategories.findIndex(c => c.id === newCat.id);
  if (existingIdx >= 0) {
    customCategories[existingIdx] = newCat;
  } else {
    customCategories.push(newCat);
  }
  CATEGORIES.length = 0;
  CATEGORIES.push(...DEFAULT_CATEGORIES, ...customCategories);
  return newCat;
}

export function deleteCustomCategory(id: string): boolean {
  const prevLen = customCategories.length;
  customCategories = customCategories.filter(c => c.id !== id);
  CATEGORIES.length = 0;
  CATEGORIES.push(...DEFAULT_CATEGORIES, ...customCategories);
  return customCategories.length < prevLen;
}

export function getCategoryById(id: string): CategoryInfo {
  const found = CATEGORIES.find(c => c.id === id);
  if (found) return found;
  return {
    id,
    name: 'כללי',
    icon: '🏷️',
    color: '#94A3B8',
    type: 'expense'
  };
}

