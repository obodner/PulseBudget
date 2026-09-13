import {
  Chart,
  BarController,
  LineController,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartConfiguration
} from 'chart.js';
import { BudgetPeriod, BudgetCaps, Transaction, DateRange } from './types';
import { getCategoryById } from './categories';

// Register Chart.js components
Chart.register(
  BarController,
  LineController,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export class ChartManager {
  private chart: Chart | null = null;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  public render(
    period: BudgetPeriod,
    transactions: Transaction[],
    caps: BudgetCaps,
    customRange?: DateRange
  ): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    const config = this.buildConfig(period, transactions, caps, customRange);
    this.chart = new Chart(this.canvas, config);
  }

  private buildConfig(
    period: BudgetPeriod,
    transactions: Transaction[],
    caps: BudgetCaps,
    customRange?: DateRange
  ): ChartConfiguration {
    const ctx = this.canvas.getContext('2d');

    if (period === 'daily') {
      return this.buildDailyConfig(transactions, caps);
    } else if (period === 'weekly') {
      return this.buildWeeklyConfig(transactions, caps);
    } else if (period === 'monthly') {
      return this.buildMonthlyConfig(transactions, caps, ctx);
    } else {
      return this.buildCustomRangeConfig(transactions, caps, customRange, ctx);
    }
  }

  private buildDailyConfig(
    transactions: Transaction[],
    caps: BudgetCaps
  ): ChartConfiguration {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayExpenses = transactions.filter(
      t => t.type === 'expense' && t.date.startsWith(todayStr)
    );

    return this.buildCategoryBarConfig(todayExpenses, 'הוצאות היום לפי קטגוריה (₪)', 'daily', caps);
  }

  private buildWeeklyConfig(
    transactions: Transaction[],
    caps: BudgetCaps
  ): ChartConfiguration {
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - currentDayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const weekData: number[] = [0, 0, 0, 0, 0, 0, 0];
    const dailyCapLine: number[] = Array(7).fill(caps.daily);

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + i);
      const dayStr = dayDate.toISOString().slice(0, 10);

      const dayTotal = transactions
        .filter(t => t.type === 'expense' && t.date.startsWith(dayStr))
        .reduce((sum, t) => sum + t.amount, 0);

      weekData[i] = dayTotal;
    }

    const barColors = weekData.map(amount => {
      if (amount === 0) return 'rgba(255, 255, 255, 0.05)';
      if (amount > caps.daily) return 'rgba(239, 68, 68, 0.85)';
      if (amount >= caps.daily * 0.8) return 'rgba(245, 158, 11, 0.85)';
      return 'rgba(0, 245, 212, 0.85)';
    });

    const borderColors = weekData.map(amount => {
      if (amount === 0) return 'rgba(255, 255, 255, 0.1)';
      if (amount > caps.daily) return '#EF4444';
      if (amount >= caps.daily * 0.8) return '#F59E0B';
      return '#00F5D4';
    });

    return {
      type: 'bar',
      data: {
        labels: dayNames,
        datasets: [
          {
            type: 'bar',
            label: 'הוצאה יומית (₪)',
            data: weekData,
            backgroundColor: barColors,
            borderColor: borderColors,
            borderWidth: 2,
            borderRadius: 8,
            order: 2
          },
          {
            type: 'line',
            label: `תקרה יומית (₪${caps.daily.toLocaleString()})`,
            data: dailyCapLine,
            borderColor: 'rgba(255, 255, 255, 0.45)',
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
          }
        ]
      },
      options: this.getBaseOptions('מעקב שבועי: הוצאות ליום מול תקרת יעד')
    };
  }

  private buildMonthlyConfig(
    transactions: Transaction[],
    caps: BudgetCaps,
    ctx: CanvasRenderingContext2D | null
  ): ChartConfiguration {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const labels: string[] = [];
    const dailyExpenses: (number | null)[] = [];
    const cumulativeExpenses: (number | null)[] = [];
    const monthlyCapLine: number[] = [];

    let runningTotal = 0;
    let maxDaily = 0;
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    for (let day = 1; day <= daysInMonth; day++) {
      labels.push(`${day}`);
      const dayStr = `${yearMonth}-${String(day).padStart(2, '0')}`;

      if (day <= now.getDate()) {
        const dayTotal = transactions
          .filter(t => t.type === 'expense' && t.date.startsWith(dayStr))
          .reduce((sum, t) => sum + t.amount, 0);

        if (dayTotal > maxDaily) maxDaily = dayTotal;
        dailyExpenses.push(dayTotal);

        runningTotal += dayTotal;
        cumulativeExpenses.push(runningTotal);
      } else {
        dailyExpenses.push(null);
        cumulativeExpenses.push(null);
      }

      monthlyCapLine.push(caps.monthly);
    }

    let gradientFill: CanvasGradient | string = 'rgba(0, 245, 212, 0.12)';
    if (ctx) {
      gradientFill = ctx.createLinearGradient(0, 0, 0, 300);
      gradientFill.addColorStop(0, 'rgba(0, 245, 212, 0.3)');
      gradientFill.addColorStop(1, 'rgba(0, 245, 212, 0.0)');
    }

    const hebrewMonthName = now.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

    // Dynamic color coding for daily bars: neon purple for regular, neon amber/red if high
    const barBackgrounds = dailyExpenses.map(amt => {
      if (amt === null || amt === undefined) return 'transparent';
      if (caps.daily > 0 && amt > caps.daily) return 'rgba(239, 68, 68, 0.7)'; // Exceeded daily cap
      if (caps.daily > 0 && amt >= caps.daily * 0.8) return 'rgba(245, 158, 11, 0.7)'; // Warning
      return 'rgba(168, 85, 247, 0.55)'; // Neon purple/violet daily bar
    });

    const barBorders = dailyExpenses.map(amt => {
      if (amt === null || amt === undefined) return 'transparent';
      if (caps.daily > 0 && amt > caps.daily) return '#EF4444';
      if (caps.daily > 0 && amt >= caps.daily * 0.8) return '#F59E0B';
      return '#A855F7';
    });

    const baseOptions = this.getBaseOptions(`מעקב חודשי משולב: הוצאה יומית ומגמה מצטברת (${hebrewMonthName})`);

    const suggestedDailyMax = Math.max(
      caps.daily > 0 ? caps.daily * 1.5 : 500,
      maxDaily > 0 ? maxDaily * 1.25 : 300,
      100
    );

    const suggestedMonthlyMax = Math.max(
      caps.monthly > 0 ? caps.monthly * 1.05 : 1000,
      runningTotal > 0 ? runningTotal * 1.1 : 500,
      500
    );

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'הוצאה יומית (₪)',
            data: dailyExpenses as number[],
            yAxisID: 'yDaily',
            backgroundColor: barBackgrounds,
            borderColor: barBorders,
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.55,
            order: 3
          },
          {
            type: 'line',
            label: `הוצאה מצטברת (${hebrewMonthName}) (₪)`,
            data: cumulativeExpenses as number[],
            yAxisID: 'y',
            borderColor: '#00F5D4',
            backgroundColor: gradientFill,
            borderWidth: 3,
            tension: 0.35,
            pointBackgroundColor: '#00F5D4',
            pointHoverRadius: 6,
            pointRadius: (ctxItem: { dataIndex: number }) => {
              return ctxItem.dataIndex === now.getDate() - 1 ? 6 : 2;
            },
            fill: true,
            order: 2
          },
          {
            type: 'line',
            label: `תקרה חודשית (₪${caps.monthly.toLocaleString()})`,
            data: monthlyCapLine,
            yAxisID: 'y',
            borderColor: '#EF4444',
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
          }
        ]
      },
      options: {
        ...baseOptions,
        scales: {
          x: {
            ...baseOptions.scales.x,
            title: {
              display: true,
              text: 'יום בחודש',
              color: '#64748B',
              font: { family: "'Heebo', sans-serif", size: 10 }
            }
          },
          y: {
            ...baseOptions.scales.y,
            position: 'left',
            title: {
              display: true,
              text: 'מצטבר ותקרה (₪)',
              color: '#00F5D4',
              font: { family: "'Heebo', sans-serif", size: 10 }
            },
            ticks: {
              color: '#00F5D4',
              font: { family: "'JetBrains Mono', 'Heebo', monospace", size: 10 },
              callback: (value: number) => `₪${value.toLocaleString()}`
            },
            suggestedMax: suggestedMonthlyMax
          },
          yDaily: {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: 'הוצאה יומית (₪)',
              color: '#A855F7',
              font: { family: "'Heebo', sans-serif", size: 10 }
            },
            grid: {
              drawOnChartArea: false // Prevents overlapping gridlines with left axis
            },
            ticks: {
              color: '#A855F7',
              font: { family: "'JetBrains Mono', 'Heebo', monospace", size: 10 },
              callback: (value: number) => `₪${value.toLocaleString()}`
            },
            min: 0,
            suggestedMax: suggestedDailyMax
          }
        }
      }
    };
  }

  private buildCustomRangeConfig(
    transactions: Transaction[],
    caps: BudgetCaps,
    customRange: DateRange | undefined,
    _ctx: CanvasRenderingContext2D | null
  ): ChartConfiguration {
    if (!customRange || !customRange.start || !customRange.end) {
      return this.buildDailyConfig(transactions, caps);
    }

    const start = new Date(customRange.start);
    const end = new Date(customRange.end);

    // Ensure valid chronological range
    const startTime = Math.min(start.getTime(), end.getTime());
    const endTime = Math.max(start.getTime(), end.getTime());

    const diffDays = Math.max(1, Math.round((endTime - startTime) / (1000 * 60 * 60 * 24)) + 1);

    // Filter transactions in range
    const rangeTxs = transactions.filter(t => {
      const d = new Date(t.date.slice(0, 10)).getTime();
      return d >= startTime && d <= endTime && t.type === 'expense';
    });

    // If single day, show category breakdown
    if (diffDays === 1) {
      const dateLabel = new Date(startTime).toLocaleDateString('he-IL', { month: 'short', day: 'numeric' });
      return this.buildCategoryBarConfig(rangeTxs, `הוצאות לפי קטגוריה לתאריך ${dateLabel}`);
    }

    // If multi-day range, build day-by-day bar chart
    const labels: string[] = [];
    const data: number[] = [];
    const dailyCapLine: number[] = [];

    for (let i = 0; i < diffDays; i++) {
      const current = new Date(startTime);
      current.setDate(current.getDate() + i);
      const dayStr = current.toISOString().slice(0, 10);
      const label = current.toLocaleDateString('he-IL', { month: 'numeric', day: 'numeric' });
      labels.push(label);

      const dayTotal = rangeTxs
        .filter(t => t.date.startsWith(dayStr))
        .reduce((sum, t) => sum + t.amount, 0);

      data.push(dayTotal);
      dailyCapLine.push(caps.daily);
    }

    const barColors = data.map(amt => {
      if (amt === 0) return 'rgba(255, 255, 255, 0.05)';
      if (amt > caps.daily) return 'rgba(239, 68, 68, 0.85)';
      if (amt >= caps.daily * 0.8) return 'rgba(245, 158, 11, 0.85)';
      return 'rgba(0, 245, 212, 0.85)';
    });

    const borderColors = data.map(amt => {
      if (amt === 0) return 'rgba(255, 255, 255, 0.1)';
      if (amt > caps.daily) return '#EF4444';
      if (amt >= caps.daily * 0.8) return '#F59E0B';
      return '#00F5D4';
    });

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'הוצאה יומית (₪)',
            data,
            backgroundColor: barColors,
            borderColor: borderColors,
            borderWidth: 2,
            borderRadius: 6,
            order: 2
          },
          {
            type: 'line',
            label: `תקרה יומית (₪${caps.daily.toLocaleString()})`,
            data: dailyCapLine,
            borderColor: 'rgba(255, 255, 255, 0.45)',
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1
          }
        ]
      },
      options: this.getBaseOptions(`מעקב הוצאות בטווח תאריכים מותאם (${diffDays} ימים)`)
    };
  }

  private buildCategoryBarConfig(
    expenses: Transaction[],
    titleText: string,
    period?: BudgetPeriod,
    caps?: BudgetCaps
  ): ChartConfiguration {
    const catMap = new Map<string, number>();
    expenses.forEach(t => {
      catMap.set(t.category, (catMap.get(t.category) || 0) + t.amount);
    });

    if (catMap.size === 0) {
      return {
        type: 'bar',
        data: {
          labels: ['אין הוצאות בטווח זה עדיין'],
          datasets: [{
            label: 'סכום (₪)',
            data: [0],
            backgroundColor: 'rgba(0, 245, 212, 0.2)',
            borderColor: '#00F5D4',
            borderWidth: 1,
            borderRadius: 8
          }]
        },
        options: this.getBaseOptions(titleText)
      };
    }

    const labels: string[] = [];
    const data: number[] = [];
    const bgColors: string[] = [];
    const borderColors: string[] = [];

    catMap.forEach((amount, catId) => {
      const cat = getCategoryById(catId);
      const catCapConfig = caps?.categoryCaps?.[catId];
      let activeCap = 0;
      if (period === 'daily') activeCap = catCapConfig?.daily || 0;
      else if (period === 'weekly') activeCap = catCapConfig?.weekly || 0;
      else if (period === 'monthly') activeCap = catCapConfig?.monthly || 0;

      if (activeCap > 0) {
        labels.push(`${cat.icon} ${cat.name} (יעד: ₪${activeCap.toLocaleString()})`);
      } else {
        labels.push(`${cat.icon} ${cat.name}`);
      }

      data.push(amount);

      if (activeCap > 0 && amount > activeCap) {
        bgColors.push('rgba(239, 68, 68, 0.45)');
        borderColors.push('#EF4444');
      } else if (activeCap > 0 && amount >= activeCap * 0.8) {
        bgColors.push('rgba(245, 158, 11, 0.45)');
        borderColors.push('#F59E0B');
      } else {
        bgColors.push(`${cat.color}33`);
        borderColors.push(cat.color);
      }
    });

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'הוצאה לפי קטגוריה (₪)',
          data,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 2,
          borderRadius: 8,
          barPercentage: 0.6
        }]
      },
      options: {
        ...this.getBaseOptions(titleText),
        indexAxis: 'y'
      }
    };
  }

  private getBaseOptions(titleText: string): any {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        title: {
          display: true,
          text: titleText,
          color: '#E2E8F0',
          font: {
            family: "'Heebo', 'Outfit', sans-serif",
            size: 13,
            weight: '600'
          },
          padding: { bottom: 12 }
        },
        legend: {
          labels: {
            color: '#94A3B8',
            font: { family: "'Heebo', sans-serif", size: 11 },
            boxWidth: 12,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#00F5D4',
          bodyColor: '#F8FAFC',
          borderColor: 'rgba(0, 245, 212, 0.3)',
          borderWidth: 1,
          padding: 10,
          boxPadding: 5,
          usePointStyle: true,
          callbacks: {
            title: (items: any[]) => {
              if (!items || !items.length) return '';
              const lbl = items[0].label;
              return isNaN(Number(lbl)) ? lbl : `יום ${lbl} בחודש`;
            },
            label: (item: any) => {
              const val = item.raw;
              if (val === null || val === undefined) return '';
              return ` ${item.dataset.label}: ₪${Number(val).toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: '#94A3B8',
            font: { family: "'Heebo', sans-serif", size: 10 }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: '#94A3B8',
            font: { family: "'JetBrains Mono', 'Heebo', monospace", size: 10 },
            callback: (value: number) => `₪${value.toLocaleString()}`
          }
        }
      }
    };
  }
}
