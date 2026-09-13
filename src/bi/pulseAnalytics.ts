import { Transaction, BudgetCaps, BudgetPeriod } from '../types';
import { getCategoryById } from '../categories';

export interface SmartInsight {
  id: string;
  emoji: string;
  title: string;
  body: string;
  tone: 'positive' | 'warning' | 'neutral';
  highlightMetric?: string;
  actionPeriod?: BudgetPeriod;
}

/**
 * Generates engaging, youth-tailored smart insights (Pulse Nuggets)
 * based on transaction history and configured budget targets.
 */
export function generatePulseNuggets(
  transactions: Transaction[],
  caps: BudgetCaps,
  activePeriod: BudgetPeriod = 'monthly'
): SmartInsight[] {
  const insights: SmartInsight[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysPassed = Math.max(1, currentDay);
  const daysRemaining = Math.max(0, daysInMonth - daysPassed);

  // Filter expenses strictly
  const expenses = transactions.filter(t => t.type === 'expense');

  // Month-to-date expenses
  const monthExpenses = expenses.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });

  const monthSpent = monthExpenses.reduce((sum, t) => sum + t.amount, 0);

  // If user has zero or very few transactions, give an encouraging starter nugget
  if (monthExpenses.length === 0) {
    insights.push({
      id: 'welcome_starter',
      emoji: '🚀',
      title: 'ברוך הבא ל-PulseBudget!',
      body: 'רשום הוצאות והכנסות, ותוך רגע תקבל כאן טיפים ותובנות חכמות שיעזרו לך לשמור על הכסף בכיף ובלי לחץ.',
      tone: 'positive',
      actionPeriod: 'monthly'
    });
    return insights;
  }

  // 1. Month-End Forecast (תחזית סוף חודש)
  const monthlyCap = caps.monthly || 0;
  const dailyAvg = monthSpent / daysPassed;
  const projectedTotal = Math.round(monthSpent + (dailyAvg * daysRemaining));

  if (monthlyCap > 0) {
    const diff = monthlyCap - projectedTotal;
    if (diff >= 0) {
      insights.push({
        id: 'month_forecast_positive',
        emoji: '💪',
        title: 'תחזית סוף חודש: בדרך לניצחון',
        body: `בקצב הנוכחי אתה סוגר את החודש עם עודף של כ-₪${Math.round(diff).toLocaleString()} בכיס! תמשיך ככה, אתה מככב.`,
        tone: 'positive',
        highlightMetric: `+₪${Math.round(diff).toLocaleString()}`,
        actionPeriod: 'monthly'
      });
    } else {
      const overAmount = Math.abs(diff);
      const daysUntilBreach = dailyAvg > 0 ? Math.floor((monthlyCap - monthSpent) / dailyAvg) : 0;
      const breachDay = Math.min(daysInMonth, daysPassed + Math.max(1, daysUntilBreach));

      insights.push({
        id: 'month_forecast_warning',
        emoji: '🛑',
        title: 'קצב שריפה מהיר החודש',
        body: `בקצב הנוכחי תקרת החודש תיחצה סביב ה-${breachDay} לחודש. חריגה צפויה של כ-₪${Math.round(overAmount).toLocaleString()}. כדאי להאט קצת!`,
        tone: 'warning',
        highlightMetric: `-₪${Math.round(overAmount).toLocaleString()}`,
        actionPeriod: 'monthly'
      });
    }
  }

  // 2. Recommended Daily Allowance (תקציב מומלץ ליום עד סוף החודש)
  if (monthlyCap > 0 && daysRemaining > 0) {
    const remainingBudget = monthlyCap - monthSpent;
    if (remainingBudget > 0) {
      const safeDailyAllowance = Math.floor(remainingBudget / daysRemaining);
      if (safeDailyAllowance > 0) {
        insights.push({
          id: 'daily_allowance',
          emoji: '👑',
          title: 'תקציב מומלץ ליום',
          body: `נשארו עוד ${daysRemaining} ימים לחודש — שמירה על כ-₪${safeDailyAllowance.toLocaleString()} ליום תביא אותך לקו הסיום בראש שקט!`,
          tone: 'positive',
          highlightMetric: `₪${safeDailyAllowance}/יום`,
          actionPeriod: 'daily'
        });
      }
    }
  }

  // 3. Weekend vs. Weekday Spikes (אפקט הסופ"ש)
  // Thu (4), Fri (5), Sat (6) vs Sun (0), Mon (1), Tue (2), Wed (3)
  let weekendSum = 0;
  let weekendCount = 0;
  let weekdaySum = 0;
  let weekdayCount = 0;

  monthExpenses.forEach(t => {
    const dayOfWeek = new Date(t.date).getDay();
    if (dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6) {
      weekendSum += t.amount;
      weekendCount++;
    } else {
      weekdaySum += t.amount;
      weekdayCount++;
    }
  });

  const weekendAvg = weekendCount > 0 ? weekendSum / weekendCount : 0;
  const weekdayAvg = weekdayCount > 0 ? weekdaySum / weekdayCount : 0;

  if (weekendCount >= 3 && weekdayCount >= 3 && weekdayAvg > 0) {
    const ratio = weekendAvg / weekdayAvg;
    if (ratio >= 1.4) {
      insights.push({
        id: 'weekend_effect',
        emoji: '🎉',
        title: 'אפקט הסופ"ש שלך',
        body: `בימי חמישי עד שבת אתה שורף פי ${ratio.toFixed(1)} יותר ליום מאמצע השבוע. הכי כיף להתפנק — רק שווה לשריין לזה תקציב מראש!`,
        tone: 'neutral',
        highlightMetric: `פי ${ratio.toFixed(1)}`,
        actionPeriod: 'weekly'
      });
    }
  }

  // 4. Top Spending Category Leak (בולען הכסף של החודש)
  if (monthSpent > 80) {
    const catMap: Record<string, number> = {};
    monthExpenses.forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    });

    let topCatId = '';
    let topCatAmount = 0;
    Object.entries(catMap).forEach(([catId, amt]) => {
      if (amt > topCatAmount) {
        topCatAmount = amt;
        topCatId = catId;
      }
    });

    if (topCatId && topCatAmount > 0) {
      const topCatInfo = getCategoryById(topCatId);
      const catPercent = Math.round((topCatAmount / monthSpent) * 100);

      if (catPercent >= 28) {
        insights.push({
          id: 'top_category_leak',
          emoji: topCatInfo.icon || '🍔',
          title: `בולען הכסף המוביל: ${topCatInfo.name}`,
          body: `החודש ${topCatInfo.name} אחראי על ${catPercent}% מכל ההוצאות שלך (₪${Math.round(topCatAmount).toLocaleString()}).`,
          tone: catPercent >= 50 ? 'warning' : 'neutral',
          highlightMetric: `${catPercent}% מהתקציב`,
          actionPeriod: 'monthly'
        });
      }
    }
  }

  // 5. Micro-Expenses Accumulation (נשנושים וקניות קטנות)
  const smallExpenses = monthExpenses.filter(t => t.amount <= 35 && t.amount > 0);
  const smallExpensesSum = smallExpenses.reduce((s, t) => s + t.amount, 0);

  if (smallExpenses.length >= 4 && smallExpensesSum >= 90) {
    insights.push({
      id: 'micro_expenses',
      emoji: '☕',
      title: 'הקניות הקטנות מצטברות',
      body: `שמת לב? ${smallExpenses.length} הוצאות קטנות של עד ₪35 (קפה, נשנושים, משלוחים) הצטברו כבר ל-₪${Math.round(smallExpensesSum).toLocaleString()} החודש!`,
      tone: 'neutral',
      highlightMetric: `₪${Math.round(smallExpensesSum).toLocaleString()}`,
      actionPeriod: 'monthly'
    });
  }

  // 6. Clean Streak Celebration (רצף אלופים ללא חריגות)
  const dailyCap = caps.daily || 0;
  if (dailyCap > 0 && monthExpenses.length >= 3) {
    // Check expenses over the last 3 days
    let cleanDays = 0;
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      const daySpend = monthExpenses
        .filter(t => t.date.startsWith(dayStr))
        .reduce((sum, t) => sum + t.amount, 0);

      if (daySpend <= dailyCap) {
        cleanDays++;
      }
    }

    if (cleanDays === 3) {
      insights.push({
        id: 'clean_streak',
        emoji: '🔥',
        title: 'רצף של אלופים',
        body: '3 ימים ברצף ללא חריגה מהתקרה היומית! שליטה מעולה בקצב, אתה בכיוון הנכון 🚀',
        tone: 'positive',
        highlightMetric: '3 ימים נקיים',
        actionPeriod: 'daily'
      });
    }
  }

  // 7. Balance / Income Health (אם יש הכנסות)
  const monthIncomes = transactions.filter(t => {
    if (t.type !== 'income') return false;
    const d = new Date(t.date);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });
  const monthIncomeTotal = monthIncomes.reduce((s, t) => s + t.amount, 0);

  if (monthIncomeTotal > 0 && monthSpent > 0) {
    const savingsRate = Math.round(((monthIncomeTotal - monthSpent) / monthIncomeTotal) * 100);
    if (savingsRate >= 20) {
      insights.push({
        id: 'savings_rate_champion',
        emoji: '💎',
        title: 'מדד החיסכון שלך זוהר',
        body: `שמרת עד כה ${savingsRate}% מסך כל ההכנסות שלך החודש. זה מעולה! כסף שנשאר אצלך בכיס הוא כוח אמיתי.`,
        tone: 'positive',
        highlightMetric: `${savingsRate}% נשמר בכיס`,
        actionPeriod: 'monthly'
      });
    }
  }

  // Fallback if no specific rule matched but we have expenses
  if (insights.length === 0) {
    insights.push({
      id: 'steady_pulse',
      emoji: '⚡',
      title: 'הדופק הפיננסי שלך יציב',
      body: `רשמת החודש ${monthExpenses.length} הוצאות בסך ₪${Math.round(monthSpent).toLocaleString()}. כל רישום עוזר לך להכיר את ההרגלים שלך טוב יותר!`,
      tone: 'positive',
      actionPeriod: activePeriod
    });
  }

  return insights;
}

// ==========================================================================
// Phase 2: Pulse Lab (מעבדת הדופק - Deep Analytics & BI Hub)
// ==========================================================================

export interface WeekdayHeatmapDay {
  dayIndex: number; // 0 (Sun) to 6 (Sat)
  name: string;
  shortName: string;
  totalAmount: number;
  avgAmount: number;
  count: number;
  intensity: number; // 0 to 1
  isPeak: boolean;
}

export interface CategoryExpenseShare {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  percent: number; // 0 to 100
  cap?: number;
  isBreached?: boolean;
}

export interface MerchantStat {
  name: string;
  amount: number;
  count: number;
}

export interface PulseLabMetrics {
  monthSpent: number;
  monthlyCap: number;
  daysPassed: number;
  daysRemaining: number;
  dailyAvgSpend: number;
  projectedMonthEndSpend: number;
  expectedSurplusOrDeficit: number;
  breachDayOfMonth?: number;
  safeDailyAllowance: number;
  monthIncome: number;
  netCashFlow: number;
  savingsRate: number;
  peakDayName: string;
  peakDayAvg: number;
  heatmapDays: WeekdayHeatmapDay[];
  topCategories: CategoryExpenseShare[];
  topMerchants: MerchantStat[];
  smallExpensesSum: number;
  smallExpensesCount: number;
}

const WEEKDAY_NAMES = [
  { index: 0, name: 'ראשון', shortName: 'א׳' },
  { index: 1, name: 'שני', shortName: 'ב׳' },
  { index: 2, name: 'שלישי', shortName: 'ג׳' },
  { index: 3, name: 'רביעי', shortName: 'ד׳' },
  { index: 4, name: 'חמישי', shortName: 'ה׳' },
  { index: 5, name: 'שישי', shortName: 'ו׳' },
  { index: 6, name: 'שבת', shortName: 'ש׳' }
];

export function computePulseLabMetrics(
  transactions: Transaction[],
  caps: BudgetCaps
): PulseLabMetrics {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysPassed = Math.max(1, currentDay);
  const daysRemaining = Math.max(0, daysInMonth - daysPassed);

  // Filter current month transactions
  const monthTxs = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });

  const monthExpenses = monthTxs.filter(t => t.type === 'expense');
  const monthIncomes = monthTxs.filter(t => t.type === 'income');

  const monthSpent = monthExpenses.reduce((s, t) => s + t.amount, 0);
  const monthIncome = monthIncomes.reduce((s, t) => s + t.amount, 0);
  const netCashFlow = monthIncome - monthSpent;
  const savingsRate = monthIncome > 0 ? Math.max(0, Math.round((netCashFlow / monthIncome) * 100)) : 0;

  const monthlyCap = caps.monthly || 0;
  const dailyAvgSpend = Math.round(monthSpent / daysPassed);
  const projectedMonthEndSpend = Math.round(monthSpent + (dailyAvgSpend * daysRemaining));
  const expectedSurplusOrDeficit = monthlyCap > 0 ? monthlyCap - projectedMonthEndSpend : 0;

  let breachDayOfMonth: number | undefined;
  if (monthlyCap > 0 && expectedSurplusOrDeficit < 0 && dailyAvgSpend > 0) {
    const daysUntilBreach = Math.floor((monthlyCap - monthSpent) / dailyAvgSpend);
    breachDayOfMonth = Math.min(daysInMonth, daysPassed + Math.max(1, daysUntilBreach));
  }

  const remainingCap = monthlyCap - monthSpent;
  const safeDailyAllowance = (daysRemaining > 0 && remainingCap > 0)
    ? Math.floor(remainingCap / daysRemaining)
    : 0;

  // Weekly Vibe Heatmap
  const dayStats = WEEKDAY_NAMES.map(d => ({
    dayIndex: d.index,
    name: d.name,
    shortName: d.shortName,
    totalAmount: 0,
    count: 0
  }));

  // Analyze all expenses in current month (or last 45 days if month is very young)
  const analysisExpenses = monthExpenses.length >= 7 ? monthExpenses : transactions.filter(t => t.type === 'expense');
  analysisExpenses.forEach(t => {
    const day = new Date(t.date).getDay();
    if (day >= 0 && day <= 6) {
      dayStats[day].totalAmount += t.amount;
      dayStats[day].count++;
    }
  });

  let maxAvg = 0;
  let peakIndex = 0;
  const heatmapDays: WeekdayHeatmapDay[] = dayStats.map(stat => {
    const avg = stat.count > 0 ? Math.round(stat.totalAmount / stat.count) : 0;
    if (avg > maxAvg) {
      maxAvg = avg;
      peakIndex = stat.dayIndex;
    }
    return {
      dayIndex: stat.dayIndex,
      name: stat.name,
      shortName: stat.shortName,
      totalAmount: Math.round(stat.totalAmount),
      avgAmount: avg,
      count: stat.count,
      intensity: 0,
      isPeak: false
    };
  });

  heatmapDays.forEach(d => {
    d.intensity = maxAvg > 0 ? Number((d.avgAmount / maxAvg).toFixed(2)) : 0;
    d.isPeak = d.dayIndex === peakIndex && maxAvg > 0;
  });

  const peakDayName = maxAvg > 0 ? WEEKDAY_NAMES[peakIndex].name : 'אין עדיין';
  const peakDayAvg = maxAvg;

  // Top Category Eaters
  const catMap: Record<string, number> = {};
  monthExpenses.forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  });

  const categoryCaps = caps.categoryCaps || {};
  const topCategories: CategoryExpenseShare[] = Object.entries(catMap)
    .map(([catId, amt]) => {
      const catInfo = getCategoryById(catId);
      const cap = categoryCaps[catId]?.monthly;
      const percent = monthSpent > 0 ? Math.round((amt / monthSpent) * 100) : 0;
      const isBreached = cap !== undefined && cap > 0 && amt > cap;
      return {
        categoryId: catId,
        name: catInfo.name,
        icon: catInfo.icon,
        color: catInfo.color,
        amount: Math.round(amt),
        percent,
        cap,
        isBreached
      };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Top Places / Merchants from note field
  const merchantMap: Record<string, { originalName: string; amount: number; count: number }> = {};
  monthExpenses.forEach(t => {
    const note = t.note?.trim();
    if (!note) return;
    const cleanKey = note.toLowerCase();
    if (!merchantMap[cleanKey]) {
      merchantMap[cleanKey] = { originalName: note, amount: 0, count: 0 };
    }
    merchantMap[cleanKey].amount += t.amount;
    merchantMap[cleanKey].count++;
  });

  const topMerchants: MerchantStat[] = Object.values(merchantMap)
    .map(m => ({
      name: m.originalName,
      amount: Math.round(m.amount),
      count: m.count
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Micro-Expenses Leak
  const smallExpenses = monthExpenses.filter(t => t.amount <= 35 && t.amount > 0);
  const smallExpensesSum = Math.round(smallExpenses.reduce((s, t) => s + t.amount, 0));
  const smallExpensesCount = smallExpenses.length;

  return {
    monthSpent: Math.round(monthSpent),
    monthlyCap: Math.round(monthlyCap),
    daysPassed,
    daysRemaining,
    dailyAvgSpend,
    projectedMonthEndSpend,
    expectedSurplusOrDeficit: Math.round(expectedSurplusOrDeficit),
    breachDayOfMonth,
    safeDailyAllowance,
    monthIncome: Math.round(monthIncome),
    netCashFlow: Math.round(netCashFlow),
    savingsRate,
    peakDayName,
    peakDayAvg,
    heatmapDays,
    topCategories,
    topMerchants,
    smallExpensesSum,
    smallExpensesCount
  };
}

