export type TransactionType = 'expense' | 'income';

export interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
  isCustom?: boolean;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string; // ISO date string: YYYY-MM-DD or YYYY-MM-DDTHH:mm
  note?: string;
  receiptUrl?: string; // Future receipt image / PDF download URL
  createdAt: number;
}

export type BudgetPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export interface BudgetCaps {
  daily: number;
  weekly: number;
  monthly: number;
  categoryCaps?: Record<string, Partial<BudgetCaps>>;
}

export interface CategoryBudgetStatus {
  categoryId: string;
  spent: number;
  cap?: number;
  status: 'none' | 'safe' | 'warning' | 'danger';
  percent?: number;
}

export interface BudgetStatus {
  period: BudgetPeriod;
  status: 'safe' | 'warning' | 'danger';
  percent: number; // e.g. 65.4
  spent: number;
  cap: number;
  remaining: number;
  income: number;
  net: number;
  paceDescription: string;
  rangeLabel?: string;
}

export interface AppSettings {
  soundEnabled: boolean;
  currency: string;
  caps: BudgetCaps;
}
