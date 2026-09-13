import { AppSettings, BudgetCaps, BudgetPeriod, BudgetStatus, DateRange, Transaction, TransactionType } from './types';
import { CATEGORIES, getCategoryById } from './categories';
import { DEFAULT_SETTINGS, clearLocalStorage, loadSettings, loadTransactions, saveSettings, saveTransactions } from './storage';
import { ChartManager } from './chartManager';
import { generatePulseNuggets, SmartInsight, computePulseLabMetrics, PulseLabMetrics } from './bi/pulseAnalytics';
import { isSoundEnabled, playMario1Up, playMarioCoin, playMarioGameOver, playMarioJump, playMarioWarning, setSoundEnabled } from './sound';
import confetti from 'canvas-confetti';
import {
  loginWithGoogle,
  loginWithEmail,
  signupWithEmail,
  logoutUser,
  subscribeToAuthState,
  subscribeToUserTransactions,
  saveUserTransactionToFirestore,
  deleteUserTransactionFromFirestore,
  saveUserCapsToFirestore,
  loadUserCapsFromFirestore,
  updateUserProfileName,
  loadUserProfileNameFromFirestore
} from './firebase';
import { User } from 'firebase/auth';

// European Date Formatting Helpers (DD/MM/YYYY <-> YYYY-MM-DD)
function toEuropeanDate(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

function fromEuropeanDate(euDate: string): string {
  if (!euDate) return '';
  const clean = euDate.trim().replace(/[\.\-]/g, '/');
  const parts = clean.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return euDate;
}

function formatLocalYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

class PulseBudgetApp {
  private transactions: Transaction[] = [];
  private settings: AppSettings = DEFAULT_SETTINGS;
  private currentPeriod: BudgetPeriod = 'monthly';
  private activeTxFilter: 'all' | 'expense' | 'income' = 'all';
  private alertDismissed: boolean = false;
  private chartManager: ChartManager;

  // Limits setup state (user must set up caps before adding records)
  private hasConfiguredCaps: boolean = false;

  // Firebase User & Cloud State
  private currentUser: User | null = null;
  private unsubscribeFirestore: (() => void) | null = null;
  private authMode: 'login' | 'register' = 'login';

  // Custom Date Range State
  private customDateRange: DateRange = {
    start: formatLocalYMD(new Date()),
    end: formatLocalYMD(new Date())
  };

  // DOM Elements cache
  private dateDisplay = document.getElementById('currentDateDisplay') as HTMLElement;
  private soundToggleBtn = document.getElementById('soundToggleBtn') as HTMLButtonElement;
  private soundIcon = document.getElementById('soundIcon') as unknown as SVGElement;
  private openCapsBtn = document.getElementById('openCapsBtn') as HTMLButtonElement;
  private openNewTxBtn = document.getElementById('openNewTxBtn') as HTMLButtonElement;
  private mobileFabBtn = document.getElementById('mobileFabBtn') as HTMLButtonElement;

  // Auth & User Menu DOM Elements
  private authBtn = document.getElementById('authBtn') as HTMLButtonElement;
  private authBtnText = document.getElementById('authBtnText') as HTMLElement;
  private authBtnIcon = document.getElementById('authBtnIcon') as unknown as SVGElement;
  private authDropdownArrow = document.getElementById('authDropdownArrow') as HTMLElement;
  private userMenuWrapper = document.getElementById('userMenuWrapper') as HTMLElement;
  private userDropdownMenu = document.getElementById('userDropdownMenu') as HTMLElement;
  private dropdownUserName = document.getElementById('dropdownUserName') as HTMLElement;
  private dropdownUserEmail = document.getElementById('dropdownUserEmail') as HTMLElement;
  private logoutDropdownBtn = document.getElementById('logoutDropdownBtn') as HTMLButtonElement;
  private authModal = document.getElementById('authModal') as HTMLElement;
  private closeAuthModalBtn = document.getElementById('closeAuthModalBtn') as HTMLButtonElement;
  private googleLoginBtn = document.getElementById('googleLoginBtn') as HTMLButtonElement;
  private authErrorAlert = document.getElementById('authErrorAlert') as HTMLElement;
  private emailAuthForm = document.getElementById('emailAuthForm') as HTMLFormElement;
  private authTabLogin = document.getElementById('authTabLogin') as HTMLButtonElement;
  private authTabRegister = document.getElementById('authTabRegister') as HTMLButtonElement;
  private authEmail = document.getElementById('authEmail') as HTMLInputElement;
  private authPassword = document.getElementById('authPassword') as HTMLInputElement;
  private authSubmitBtn = document.getElementById('authSubmitBtn') as HTMLButtonElement;
  private guestAuthBtn = document.getElementById('guestAuthBtn') as HTMLButtonElement;

  // Edit Profile Name DOM Elements
  private editProfileNameHeaderBtn = document.getElementById('editProfileNameHeaderBtn') as HTMLButtonElement | null;
  private editProfileNameMenuBtn = document.getElementById('editProfileNameMenuBtn') as HTMLButtonElement | null;
  private editNameModal = document.getElementById('editNameModal') as HTMLElement;
  private closeEditNameModalBtn = document.getElementById('closeEditNameModalBtn') as HTMLButtonElement;
  private cancelEditNameBtn = document.getElementById('cancelEditNameBtn') as HTMLButtonElement;
  private editNameForm = document.getElementById('editNameForm') as HTMLFormElement;
  private inputProfileName = document.getElementById('inputProfileName') as HTMLInputElement;
  private editNameErrorAlert = document.getElementById('editNameErrorAlert') as HTMLElement;
  private saveProfileNameBtn = document.getElementById('saveProfileNameBtn') as HTMLButtonElement;

  // Active Notifications DOM Elements
  private notificationsWrapper = document.getElementById('notificationsWrapper') as HTMLElement;
  private notificationsBtn = document.getElementById('notificationsBtn') as HTMLButtonElement;
  private notificationsBadge = document.getElementById('notificationsBadge') as HTMLElement;
  private notificationsDropdown = document.getElementById('notificationsDropdown') as HTMLElement;
  private notificationsDropdownCount = document.getElementById('notificationsDropdownCount') as HTMLElement;
  private notificationsList = document.getElementById('notificationsList') as HTMLElement;

  private alertBanner = document.getElementById('alertBanner') as HTMLElement;
  private alertIcon = document.getElementById('alertIcon') as HTMLElement;
  private alertTitle = document.getElementById('alertTitle') as HTMLElement;
  private alertDesc = document.getElementById('alertDesc') as HTMLElement;
  private alertDismissBtn = document.getElementById('alertDismissBtn') as HTMLButtonElement;

  private periodButtons = document.querySelectorAll<HTMLButtonElement>('.period-btn');
  private dateRangeBar = document.getElementById('dateRangeBar') as HTMLElement;
  private filterStartDateInput = document.getElementById('filterStartDate') as HTMLInputElement;
  private filterEndDateInput = document.getElementById('filterEndDate') as HTMLInputElement;
  private nativeStartDate = document.getElementById('nativeStartDate') as HTMLInputElement;
  private nativeEndDate = document.getElementById('nativeEndDate') as HTMLInputElement;
  private triggerStartCalendar = document.getElementById('triggerStartCalendar') as HTMLButtonElement;
  private triggerEndCalendar = document.getElementById('triggerEndCalendar') as HTMLButtonElement;
  private datePresetBtns = document.querySelectorAll<HTMLButtonElement>('.date-preset-btn');

  private ringProgressCircle = document.getElementById('ringProgressCircle') as unknown as SVGCircleElement;
  private ringStatusPill = document.getElementById('ringStatusPill') as HTMLElement;
  private ringStatusText = document.getElementById('ringStatusText') as HTMLElement;
  private ringSpentDisplay = document.getElementById('ringSpentDisplay') as HTMLElement;
  private ringCapPrefix = document.getElementById('ringCapPrefix') as HTMLElement | null;
  private ringCapDisplay = document.getElementById('ringCapDisplay') as HTMLElement;
  private ringPercentBadge = document.getElementById('ringPercentBadge') as HTMLElement;
  private heroRemainingVal = document.getElementById('heroRemainingVal') as HTMLElement;
  private heroPaceVal = document.getElementById('heroPaceVal') as HTMLElement;

  private metricExpTitle = document.getElementById('metricExpTitle') as HTMLElement;
  private metricExpValue = document.getElementById('metricExpValue') as HTMLElement;
  private metricExpCount = document.getElementById('metricExpCount') as HTMLElement;
  private metricIncTitle = document.getElementById('metricIncTitle') as HTMLElement;
  private metricIncValue = document.getElementById('metricIncValue') as HTMLElement;
  private metricIncCount = document.getElementById('metricIncCount') as HTMLElement;
  private metricNetValue = document.getElementById('metricNetValue') as HTMLElement;
  private metricNetStatus = document.getElementById('metricNetStatus') as HTMLElement;
  private metricCapTitle = document.getElementById('metricCapTitle') as HTMLElement;
  private metricCapValue = document.getElementById('metricCapValue') as HTMLElement;
  private metricCapAlert = document.getElementById('metricCapAlert') as HTMLElement;

  private chartSectionTitle = document.getElementById('chartSectionTitle') as HTMLElement;
  private categoryBreakdownSection = document.getElementById('categoryBreakdownSection') as HTMLElement;
  private categoryBreakdownTitle = document.getElementById('categoryBreakdownTitle') as HTMLElement;
  private categoryBreakdownPeriodBadge = document.getElementById('categoryBreakdownPeriodBadge') as HTMLElement;
  private categoryBreakdownSummary = document.getElementById('categoryBreakdownSummary') as HTMLElement;
  private categoryBreakdownTbody = document.getElementById('categoryBreakdownTbody') as HTMLElement;

  // Pulse Nuggets (Smart Insights Card - Phase 1)
  private pulseNuggetsSection = document.getElementById('pulseNuggetsSection') as HTMLElement | null;
  private pulseNuggetsCard = document.getElementById('pulseNuggetsCard') as HTMLElement | null;
  private nuggetsCounter = document.getElementById('nuggetsCounter') as HTMLElement | null;
  private nuggetsBody = document.getElementById('nuggetsBody') as HTMLElement | null;
  private nuggetEmoji = document.getElementById('nuggetEmoji') as HTMLElement | null;
  private nuggetTitle = document.getElementById('nuggetTitle') as HTMLElement | null;
  private nuggetHighlight = document.getElementById('nuggetHighlight') as HTMLElement | null;
  private nuggetText = document.getElementById('nuggetText') as HTMLElement | null;
  private nuggetsDots = document.getElementById('nuggetsDots') as HTMLElement | null;
  private nuggetPrevBtn = document.getElementById('nuggetPrevBtn') as HTMLButtonElement | null;
  private nuggetNextBtn = document.getElementById('nuggetNextBtn') as HTMLButtonElement | null;
  private currentNuggets: SmartInsight[] = [];
  private currentNuggetIndex: number = 0;
  private nuggetAutoTimer: number | null = null;
  private touchStartX: number = 0;
  private touchEndX: number = 0;

  // Pulse Lab (Deep BI Hub - Phase 2)
  private openPulseLabBtn = document.getElementById('openPulseLabBtn') as HTMLButtonElement | null;
  private nuggetsToLabBtn = document.getElementById('nuggetsToLabBtn') as HTMLButtonElement | null;
  private pulseLabModal = document.getElementById('pulseLabModal') as HTMLElement | null;
  private closePulseLabBtn = document.getElementById('closePulseLabBtn') as HTMLButtonElement | null;
  private pulseLabPeriodSubtitle = document.getElementById('pulseLabPeriodSubtitle') as HTMLElement | null;
  private labForecastValue = document.getElementById('labForecastValue') as HTMLElement | null;
  private labForecastSub = document.getElementById('labForecastSub') as HTMLElement | null;
  private labSavingsValue = document.getElementById('labSavingsValue') as HTMLElement | null;
  private labSavingsSub = document.getElementById('labSavingsSub') as HTMLElement | null;
  private labPeakDayValue = document.getElementById('labPeakDayValue') as HTMLElement | null;
  private labPeakDaySub = document.getElementById('labPeakDaySub') as HTMLElement | null;
  private labBurnValue = document.getElementById('labBurnValue') as HTMLElement | null;
  private labBurnSub = document.getElementById('labBurnSub') as HTMLElement | null;
  private labHeatmapGrid = document.getElementById('labHeatmapGrid') as HTMLElement | null;
  private labCategoriesList = document.getElementById('labCategoriesList') as HTMLElement | null;
  private labMerchantsList = document.getElementById('labMerchantsList') as HTMLElement | null;
  private simTargetSavingsInput = document.getElementById('simTargetSavingsInput') as HTMLInputElement | null;
  private simTargetVal = document.getElementById('simTargetVal') as HTMLElement | null;
  private simDaysRemainingText = document.getElementById('simDaysRemainingText') as HTMLElement | null;
  private simDailyAllowanceVal = document.getElementById('simDailyAllowanceVal') as HTMLElement | null;
  private simResultTip = document.getElementById('simResultTip') as HTMLElement | null;
  private currentLabMetrics: PulseLabMetrics | null = null;

  private transactionsListEl = document.getElementById('transactionsList') as HTMLElement;
  private filterButtons = document.querySelectorAll<HTMLButtonElement>('.filter-btn');
  private tabCountAll = document.getElementById('tabCountAll') as HTMLElement | null;
  private tabCountExpense = document.getElementById('tabCountExpense') as HTMLElement | null;
  private tabCountIncome = document.getElementById('tabCountIncome') as HTMLElement | null;

  // Modals
  private newTxModal = document.getElementById('newTxModal') as HTMLElement;
  private closeTxModalBtn = document.getElementById('closeTxModalBtn') as HTMLButtonElement;
  private cancelTxBtn = document.getElementById('cancelTxBtn') as HTMLButtonElement;
  private txForm = document.getElementById('txForm') as HTMLFormElement;
  private txTypeBtns = document.querySelectorAll<HTMLButtonElement>('#txForm .type-option-btn');
  private txAmountInput = document.getElementById('txAmount') as HTMLInputElement;
  private txCategorySelect = document.getElementById('txCategory') as HTMLSelectElement;
  private txDateInput = document.getElementById('txDate') as HTMLInputElement;
  private txNoteInput = document.getElementById('txNote') as HTMLInputElement;
  private currentTxType: TransactionType = 'expense';

  private capsModal = document.getElementById('capsModal') as HTMLElement;
  private closeCapsModalBtn = document.getElementById('closeCapsModalBtn') as HTMLButtonElement;
  private capsForm = document.getElementById('capsForm') as HTMLFormElement;
  private inputDailyCap = document.getElementById('inputDailyCap') as HTMLInputElement;
  private inputWeeklyCap = document.getElementById('inputWeeklyCap') as HTMLInputElement;
  private inputMonthlyCap = document.getElementById('inputMonthlyCap') as HTMLInputElement;
  private dailyCapDisplayVal = document.getElementById('dailyCapDisplayVal') as HTMLElement;
  private weeklyCapDisplayVal = document.getElementById('weeklyCapDisplayVal') as HTMLElement;
  private monthlyCapDisplayVal = document.getElementById('monthlyCapDisplayVal') as HTMLElement;
  private categoryCapsContainer = document.getElementById('categoryCapsContainer') as HTMLElement;
  private categoryCapsActiveCount = document.getElementById('categoryCapsActiveCount') as HTMLElement;
  private toastContainer = document.getElementById('toastContainer') as HTMLElement;
  private resetDataBtn = document.getElementById('resetDataBtn') as HTMLButtonElement;
  private capsValidationMsg = document.getElementById('capsValidationMsg') as HTMLElement;
  private capsMandatoryNotice = document.getElementById('capsMandatoryNotice') as HTMLElement;
  private saveCapsBtn: HTMLButtonElement | null = null;

  constructor() {
    const canvas = document.getElementById('budgetChart') as HTMLCanvasElement;
    this.chartManager = new ChartManager(canvas);

    this.init();
  }

  private init(): void {
    // 1. Load Local Settings and initialize clean state
    this.settings = loadSettings();
    if (!this.settings.caps.categoryCaps) {
      this.settings.caps.categoryCaps = {};
    }
    this.hasConfiguredCaps = localStorage.getItem('pulse_caps_configured') === 'true';
    this.transactions = loadTransactions();
    setSoundEnabled(this.settings.soundEnabled);
    this.updateSoundIcon();

    // 2. Initialize Date Range inputs with default monthly period in European format
    this.syncDatesToPeriod('monthly');
    this.updateDateRangeBarVisibility();

    // 3. Setup Date & Clock
    this.renderCurrentDate();
    setInterval(() => this.renderCurrentDate(), 30000);

    // 4. Populate Categories in form & category caps inputs
    this.populateCategoryOptions();
    this.renderCategoryCapsInputs();

    // 5. Setup Event Listeners
    this.bindEvents();

    // 6. Setup Firebase Auth & Firestore Synchronization
    this.initAuthAndFirestore();

    // 7. Initial Render
    this.refreshUI();
  }

  private initAuthAndFirestore(): void {
    subscribeToAuthState(async (user) => {
      this.currentUser = user;

      if (this.unsubscribeFirestore) {
        this.unsubscribeFirestore();
        this.unsubscribeFirestore = null;
      }

      if (user) {
        // User is logged in
        let displayName = localStorage.getItem(`pulse_custom_name_${user.uid}`) || user.displayName || '';
        if (!displayName) {
          const cloudName = await loadUserProfileNameFromFirestore(user.uid);
          if (cloudName) displayName = cloudName;
        }
        if (!displayName) {
          displayName = user.email?.split('@')[0] || 'מחובר';
        }
        const shortName = displayName.split(' ')[0];
        this.authBtnText.textContent = shortName;
        this.authBtn.title = `מחובר כ-${displayName} (${user.email || ''}) (לחץ לפתיחת תפריט)`;
        this.authBtn.classList.add('active');
        if (this.authDropdownArrow) this.authDropdownArrow.style.display = 'inline-block';
        if (this.dropdownUserName) this.dropdownUserName.textContent = displayName;
        if (this.dropdownUserEmail) this.dropdownUserEmail.textContent = user.email || '';

        // Load user's cloud budget caps
        const cloudCaps = await loadUserCapsFromFirestore(user.uid);
        const hasAnyCap = cloudCaps && (
          cloudCaps.daily > 0 ||
          cloudCaps.weekly > 0 ||
          cloudCaps.monthly > 0 ||
          (cloudCaps.categoryCaps && Object.values(cloudCaps.categoryCaps).some(c => (c?.daily || 0) > 0 || (c?.weekly || 0) > 0 || (c?.monthly || 0) > 0))
        );
        if (cloudCaps && hasAnyCap) {
          this.hasConfiguredCaps = true;
          this.settings.caps = cloudCaps;
          saveSettings(this.settings);
        } else {
          // New user has not set up limits yet! Enforce caps setup first with clean blank state
          this.hasConfiguredCaps = false;
          this.settings.caps = { daily: 0, weekly: 0, monthly: 0, categoryCaps: {} };
          setTimeout(() => {
            this.openCapsSettingsModal(true);
          }, 350);
        }

        // Subscribe to user's Firestore transactions in real time
        this.unsubscribeFirestore = subscribeToUserTransactions(
          user.uid,
          async (cloudTxs) => {
            const seen = new Set<string>();
            const unique: Transaction[] = [];
            for (const tx of cloudTxs) {
              if (tx.id && !seen.has(tx.id)) {
                seen.add(tx.id);
                unique.push(tx);
              }
            }
            this.transactions = unique;
            saveTransactions(unique);
            this.refreshUI();
          },
          (err) => {
            console.warn('Firestore sync warning:', err);
          }
        );
      } else {
        // User is unauthenticated / logged out: blank app page + auto-open login modal
        this.authBtnText.textContent = 'התחברות';
        this.authBtn.title = 'התחבר כדי לסנכרן עם Firestore בענן';
        this.authBtn.classList.remove('active');
        if (this.authDropdownArrow) this.authDropdownArrow.style.display = 'none';
        this.closeUserDropdown();
        this.transactions = loadTransactions();
        this.refreshUI();

        // When user first navigates to the link, present login modal
        this.openAuthModal();
      }
    });
  }

  private bindEvents(): void {
    // Period Switcher (Daily / Weekly / Monthly / Custom)
    this.periodButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const period = btn.dataset.period as BudgetPeriod;
        if (period) {
          this.switchPeriod(period);
        }
      });
    });

    // European Date Range Inputs and Calendar Pickers
    const openPicker = (picker: HTMLInputElement | null) => {
      if (!picker) return;
      try {
        const p = picker as HTMLInputElement & { showPicker?: () => void };
        if (typeof p.showPicker === 'function') {
          p.showPicker();
        } else {
          picker.focus();
        }
      } catch {
        picker.focus();
      }
    };

    this.triggerStartCalendar?.addEventListener('click', () => openPicker(this.nativeStartDate));
    this.triggerEndCalendar?.addEventListener('click', () => openPicker(this.nativeEndDate));

    this.nativeStartDate?.addEventListener('change', () => {
      if (this.nativeStartDate.value) {
        this.filterStartDateInput.value = toEuropeanDate(this.nativeStartDate.value);
        this.handleCustomDateChange();
      }
    });

    this.nativeEndDate?.addEventListener('change', () => {
      if (this.nativeEndDate.value) {
        this.filterEndDateInput.value = toEuropeanDate(this.nativeEndDate.value);
        this.handleCustomDateChange();
      }
    });

    // Auto-formatting and direct editing on DD/MM/YYYY text inputs
    const handleTextInputChange = (input: HTMLInputElement) => {
      const val = input.value.trim();
      if (val.length === 10) {
        this.handleCustomDateChange();
      }
    };

    const attachSlashAutoFormat = (input: HTMLInputElement) => {
      input.addEventListener('input', (e: Event) => {
        const inputEvent = e as InputEvent;
        if (inputEvent.inputType === 'deleteContentBackward') return;
        let v = input.value.replace(/[^\d]/g, '');
        if (v.length >= 2 && v.length < 4) {
          v = v.slice(0, 2) + '/' + v.slice(2);
        } else if (v.length >= 4) {
          v = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4, 8);
        }
        input.value = v;
        if (v.length === 10) handleTextInputChange(input);
      });
      input.addEventListener('change', () => handleTextInputChange(input));
    };

    attachSlashAutoFormat(this.filterStartDateInput);
    attachSlashAutoFormat(this.filterEndDateInput);

    // Date Presets
    this.datePresetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        playMarioJump();
        const preset = btn.dataset.preset;
        this.applyDatePreset(preset);
      });
    });

    // Super Mario Sound toggle
    this.soundToggleBtn.addEventListener('click', () => {
      this.settings.soundEnabled = !this.settings.soundEnabled;
      setSoundEnabled(this.settings.soundEnabled);
      saveSettings(this.settings);
      this.updateSoundIcon();
      if (this.settings.soundEnabled) playMarioCoin();
    });

    // Open/Close Modals (Enforce limits configured before allowing new transactions)
    const openTxHandler = () => {
      playMarioJump();
      if (!this.hasConfiguredCaps) {
        playMarioWarning();
        this.openCapsSettingsModal(true);
        return;
      }
      this.openTransactionModal();
    };

    this.openNewTxBtn.addEventListener('click', openTxHandler);
    if (this.mobileFabBtn) {
      this.mobileFabBtn.addEventListener('click', openTxHandler);
    }

    this.closeTxModalBtn.addEventListener('click', () => this.closeTransactionModal());
    this.cancelTxBtn.addEventListener('click', () => this.closeTransactionModal());

    this.openCapsBtn.addEventListener('click', () => {
      playMarioJump();
      this.openCapsSettingsModal();
    });

    this.closeCapsModalBtn.addEventListener('click', () => this.closeCapsModal());

    // Auth Button & Custom Dropdown Menu Events
    this.authBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playMarioJump();
      if (this.currentUser) {
        this.toggleUserDropdown();
      } else {
        this.openAuthModal();
      }
    });

    // Active Notifications Bell Button & Dropdown
    this.notificationsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      playMarioJump();
      this.toggleNotificationsDropdown();
    });

    // Custom Dropdown Logout
    this.logoutDropdownBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      playMarioJump();
      this.closeUserDropdown();
      clearLocalStorage();
      await logoutUser();
    });

    // Edit Profile Name Buttons
    this.editProfileNameHeaderBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      playMarioJump();
      this.openEditNameModal();
    });

    this.editProfileNameMenuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      playMarioJump();
      this.openEditNameModal();
    });

    this.closeEditNameModalBtn?.addEventListener('click', () => this.closeEditNameModal());
    this.cancelEditNameBtn?.addEventListener('click', () => this.closeEditNameModal());

    this.editNameForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveProfileName();
    });

    // Close user dropdown & notifications dropdown on click outside or escape key
    document.addEventListener('click', (e) => {
      if (this.userMenuWrapper && !this.userMenuWrapper.contains(e.target as Node)) {
        this.closeUserDropdown();
      }
      if (this.notificationsWrapper && !this.notificationsWrapper.contains(e.target as Node)) {
        this.closeNotificationsDropdown();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeUserDropdown();
        this.closeNotificationsDropdown();
        this.closeEditNameModal();
        this.closePulseLab();
        if (this.hasConfiguredCaps) {
          this.closeCapsModal();
        } else if (this.capsModal.classList.contains('open')) {
          playMarioWarning();
          this.showCapsError('⚠️ חובה להגדיר תקרות תקציב ראשוניות כדי להמשיך להשתמש באפליקציה.');
          this.inputDailyCap.focus();
        }
      }
    });

    this.closeAuthModalBtn.addEventListener('click', () => this.closeAuthModal());
    this.guestAuthBtn.addEventListener('click', () => this.closeAuthModal());

    // Google Sign-In
    this.googleLoginBtn.addEventListener('click', async () => {
      try {
        playMarioJump();
        this.hideAuthError();
        await loginWithGoogle();
        playMario1Up();
        this.closeAuthModal();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.showAuthError(`שגיאת התחברות עם Google: ${message}`);
        playMarioWarning();
      }
    });

    // Switch between Email Login & Register
    this.authTabLogin.addEventListener('click', () => {
      playMarioJump();
      this.authMode = 'login';
      this.authTabLogin.classList.add('active');
      this.authTabRegister.classList.remove('active');
      this.authSubmitBtn.textContent = 'התחבר';
      this.hideAuthError();
    });

    this.authTabRegister.addEventListener('click', () => {
      playMarioJump();
      this.authMode = 'register';
      this.authTabRegister.classList.add('active');
      this.authTabLogin.classList.remove('active');
      this.authSubmitBtn.textContent = 'צור חשבון חדש';
      this.hideAuthError();
    });

    // Email Form Submit
    this.emailAuthForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = this.authEmail.value.trim();
      const pass = this.authPassword.value.trim();

      if (!email || !pass) return;

      try {
        this.hideAuthError();
        if (this.authMode === 'login') {
          await loginWithEmail(email, pass);
        } else {
          await signupWithEmail(email, pass);
        }
        playMario1Up();
        this.closeAuthModal();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        let hebrewMsg = msg;
        if (msg.includes('user-not-found') || msg.includes('invalid-credential')) {
          hebrewMsg = 'שם משתמש או סיסמה שגויים';
        } else if (msg.includes('email-already-in-use')) {
          hebrewMsg = 'כתובת אימייל זו כבר רשומה במערכת';
        } else if (msg.includes('weak-password')) {
          hebrewMsg = 'הסיסמה חלשה מדי, נדרשים לפחות 6 תווים';
        }
        this.showAuthError(hebrewMsg);
        playMarioWarning();
      }
    });

    // Dismiss Alert
    this.alertDismissBtn.addEventListener('click', () => {
      playMarioJump();
      this.alertDismissed = true;
      this.alertBanner.style.display = 'none';
    });

    // Transaction Type switch (Expense / Income)
    this.txTypeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        playMarioJump();
        const type = btn.dataset.type as TransactionType;
        if (type) {
          this.setTransactionType(type);
        }
      });
    });

    // Transaction Form Submission
    this.txForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleNewTransaction();
    });

    // Caps Form Live input updates with strict hierarchy validation
    const updateDisplay = (input: HTMLInputElement, target: HTMLElement) => {
      const val = Number(input.value) || 0;
      target.textContent = `₪${val.toLocaleString()}`;
      this.updateCategoryBoundsHints();
      this.validateCapsHierarchy();
    };

    this.saveCapsBtn = this.capsForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;

    this.inputDailyCap.addEventListener('input', () => updateDisplay(this.inputDailyCap, this.dailyCapDisplayVal));
    this.inputWeeklyCap.addEventListener('input', () => updateDisplay(this.inputWeeklyCap, this.weeklyCapDisplayVal));
    this.inputMonthlyCap.addEventListener('input', () => updateDisplay(this.inputMonthlyCap, this.monthlyCapDisplayVal));

    this.capsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveCaps();
    });

    // Reset Data
    this.resetDataBtn.addEventListener('click', async () => {
      if (confirm('האם אתה בטוח שברצונך לאפס את כל הנתונים והתנועות?')) {
        playMarioJump();
        // If user logged in, delete from Firestore
        if (this.currentUser) {
          for (const t of this.transactions) {
            await deleteUserTransactionFromFirestore(this.currentUser.uid, t.id);
          }
        }
        this.transactions = [];
        this.settings.caps = { ...DEFAULT_SETTINGS.caps };
        saveTransactions(this.transactions);
        saveSettings(this.settings);
        this.closeCapsModal();
        this.refreshUI();
      }
    });

    // Filter Buttons in ledger
    this.filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        playMarioJump();
        const filter = btn.dataset.filter as 'all' | 'expense' | 'income';
        this.activeTxFilter = filter;
        this.filterButtons.forEach(b => b.classList.toggle('active', b === btn));
        this.renderTransactionsList();
      });
    });

    // Close modal on click outside
    window.addEventListener('click', (e) => {
      if (e.target === this.newTxModal) this.closeTransactionModal();
      if (e.target === this.capsModal) {
        if (this.hasConfiguredCaps) {
          this.closeCapsModal();
        } else {
          playMarioWarning();
          this.showCapsError('⚠️ חובה להגדיר תקרות תקציב ראשוניות כדי להמשיך להשתמש באפליקציה.');
          this.inputDailyCap.focus();
        }
      }
      if (e.target === this.authModal) this.closeAuthModal();
      if (e.target === this.editNameModal) this.closeEditNameModal();
      if (e.target === this.pulseLabModal) this.closePulseLab();
    });

    // Pulse Nuggets events (Phase 1)
    this.setupPulseNuggetsEvents();

    // Pulse Lab events (Phase 2)
    this.setupPulseLabEvents();
  }

  public switchPeriod(period: BudgetPeriod): void {
    if (period && period !== this.currentPeriod) {
      playMarioJump();
      this.currentPeriod = period;
      this.periodButtons.forEach(b => b.classList.toggle('active', b.dataset.period === period));
      this.alertDismissed = false;

      // Sync dates if switched to standard periods
      this.syncDatesToPeriod(period);
      this.updateDateRangeBarVisibility();
      this.refreshUI();
    }
  }

  private toggleUserDropdown(): void {
    if (!this.userDropdownMenu) return;
    const isCurrentlyOpen = this.userDropdownMenu.style.display === 'block';
    if (isCurrentlyOpen) {
      this.closeUserDropdown();
    } else {
      this.closeNotificationsDropdown();
      this.openUserDropdown();
    }
  }

  private openUserDropdown(): void {
    if (!this.userDropdownMenu) return;
    this.closeNotificationsDropdown();
    this.userDropdownMenu.style.display = 'block';
    this.userMenuWrapper?.classList.add('open');
    this.authBtn?.setAttribute('aria-expanded', 'true');
  }

  private closeUserDropdown(): void {
    if (!this.userDropdownMenu) return;
    this.userDropdownMenu.style.display = 'none';
    this.userMenuWrapper?.classList.remove('open');
    this.authBtn?.setAttribute('aria-expanded', 'false');
  }

  private toggleNotificationsDropdown(): void {
    if (!this.notificationsDropdown) return;
    const isCurrentlyOpen = this.notificationsDropdown.style.display === 'block';
    if (isCurrentlyOpen) {
      this.closeNotificationsDropdown();
    } else {
      this.closeUserDropdown();
      this.openNotificationsDropdown();
    }
  }

  private openNotificationsDropdown(): void {
    if (!this.notificationsDropdown) return;
    this.closeUserDropdown();
    this.notificationsDropdown.style.display = 'block';
    this.notificationsBtn?.classList.add('open');
    this.notificationsBtn?.setAttribute('aria-expanded', 'true');
  }

  private closeNotificationsDropdown(): void {
    if (!this.notificationsDropdown) return;
    this.notificationsDropdown.style.display = 'none';
    this.notificationsBtn?.classList.remove('open');
    this.notificationsBtn?.setAttribute('aria-expanded', 'false');
  }

  private openAuthModal(): void {
    this.hideAuthError();
    this.authEmail.value = '';
    this.authPassword.value = '';
    this.authModal.classList.add('open');
    setTimeout(() => this.authEmail.focus(), 50);
  }

  private closeAuthModal(): void {
    this.authModal.classList.remove('open');
  }

  private showAuthError(msg: string): void {
    this.authErrorAlert.textContent = msg;
    this.authErrorAlert.style.display = 'flex';
  }

  private hideAuthError(): void {
    this.authErrorAlert.textContent = '';
    this.authErrorAlert.style.display = 'none';
  }

  private openEditNameModal(): void {
    this.closeUserDropdown();
    this.hideEditNameError();
    const currentName = this.dropdownUserName?.textContent || (this.currentUser?.displayName || '');
    if (this.inputProfileName) {
      this.inputProfileName.value = (currentName === 'משתמש' || currentName === 'אורח') ? '' : currentName;
    }
    this.editNameModal?.classList.add('open');
    setTimeout(() => this.inputProfileName?.focus(), 50);
  }

  private closeEditNameModal(): void {
    this.editNameModal?.classList.remove('open');
    this.hideEditNameError();
  }

  private showEditNameError(msg: string): void {
    if (this.editNameErrorAlert) {
      this.editNameErrorAlert.textContent = msg;
      this.editNameErrorAlert.style.display = 'flex';
    }
  }

  private hideEditNameError(): void {
    if (this.editNameErrorAlert) {
      this.editNameErrorAlert.textContent = '';
      this.editNameErrorAlert.style.display = 'none';
    }
  }

  private async handleSaveProfileName(): Promise<void> {
    const newName = this.inputProfileName.value.trim();
    if (!newName) {
      this.showEditNameError('נא להזין שם תצוגה תקין.');
      playMarioWarning();
      return;
    }
    if (newName.length > 30) {
      this.showEditNameError('השם ארוך מדי (עד 30 תווים).');
      playMarioWarning();
      return;
    }

    this.hideEditNameError();
    if (this.saveProfileNameBtn) {
      this.saveProfileNameBtn.disabled = true;
      this.saveProfileNameBtn.textContent = 'שומר...';
    }

    try {
      if (this.currentUser) {
        await updateUserProfileName(this.currentUser, newName);
        localStorage.setItem(`pulse_custom_name_${this.currentUser.uid}`, newName);
      } else {
        localStorage.setItem('pulse_custom_name_guest', newName);
      }

      const shortName = newName.split(' ')[0];
      this.authBtnText.textContent = shortName;
      if (this.dropdownUserName) this.dropdownUserName.textContent = newName;
      if (this.currentUser) {
        this.authBtn.title = `מחובר כ-${newName} (${this.currentUser.email || ''}) (לחץ לפתיחת תפריט)`;
      }

      this.closeEditNameModal();
      playMario1Up();

      this.showToastNotification({
        title: 'שם הפרופיל עודכן!',
        desc: `שם התצוגה שונה בהצלחה ל-"${newName}"`,
        icon: '👤',
        type: 'info',
        durationMs: 4000
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.showEditNameError(`שגיאה בעדכון השם: ${msg}`);
      playMarioWarning();
    } finally {
      if (this.saveProfileNameBtn) {
        this.saveProfileNameBtn.disabled = false;
        this.saveProfileNameBtn.textContent = 'שמור שינויים';
      }
    }
  }

  private syncDatesToPeriod(period: BudgetPeriod): void {
    const now = new Date();
    const todayStr = formatLocalYMD(now);

    if (period === 'daily') {
      this.customDateRange = { start: todayStr, end: todayStr };
    } else if (period === 'weekly') {
      const day = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - day);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      this.customDateRange = {
        start: formatLocalYMD(start),
        end: formatLocalYMD(end)
      };
    } else if (period === 'monthly') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      this.customDateRange = {
        start: formatLocalYMD(start),
        end: formatLocalYMD(end)
      };
    }

    this.filterStartDateInput.value = toEuropeanDate(this.customDateRange.start);
    this.filterEndDateInput.value = toEuropeanDate(this.customDateRange.end);
    if (this.nativeStartDate) this.nativeStartDate.value = this.customDateRange.start;
    if (this.nativeEndDate) this.nativeEndDate.value = this.customDateRange.end;
    const preset = period === 'daily' ? 'today' : undefined;
    this.updatePresetButtonsState(preset);
    this.updateDateRangeBarVisibility();
  }

  private handleCustomDateChange(): void {
    const rawStart = this.filterStartDateInput.value;
    const rawEnd = this.filterEndDateInput.value;

    const start = fromEuropeanDate(rawStart);
    const end = fromEuropeanDate(rawEnd);

    if (!start || !end || start.length !== 10 || end.length !== 10) return;

    this.customDateRange = { start, end };
    if (this.nativeStartDate) this.nativeStartDate.value = start;
    if (this.nativeEndDate) this.nativeEndDate.value = end;

    this.currentPeriod = 'custom';
    this.periodButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.period === 'custom');
    });

    this.updateDateRangeBarVisibility();
    this.updatePresetButtonsState();
    this.refreshUI();
  }

  private applyDatePreset(preset?: string): void {
    const now = new Date();
    const todayStr = formatLocalYMD(now);

    if (preset === 'today') {
      this.customDateRange = { start: todayStr, end: todayStr };
      this.currentPeriod = 'custom';
    } else if (preset === '7days') {
      const past = new Date(now);
      past.setDate(now.getDate() - 6);
      this.customDateRange = { start: formatLocalYMD(past), end: todayStr };
      this.currentPeriod = 'custom';
    } else if (preset === '30days') {
      const past = new Date(now);
      past.setDate(now.getDate() - 29);
      this.customDateRange = { start: formatLocalYMD(past), end: todayStr };
      this.currentPeriod = 'custom';
    } else if (preset === 'all') {
      let oldest = new Date(now);
      oldest.setFullYear(now.getFullYear() - 1);
      if (this.transactions.length > 0) {
        const sorted = [...this.transactions].sort((a, b) => a.date.localeCompare(b.date));
        oldest = new Date(sorted[0].date.slice(0, 10));
      }
      this.customDateRange = { start: formatLocalYMD(oldest), end: todayStr };
      this.currentPeriod = 'custom';
    }

    this.filterStartDateInput.value = toEuropeanDate(this.customDateRange.start);
    this.filterEndDateInput.value = toEuropeanDate(this.customDateRange.end);
    if (this.nativeStartDate) this.nativeStartDate.value = this.customDateRange.start;
    if (this.nativeEndDate) this.nativeEndDate.value = this.customDateRange.end;

    this.periodButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.period === this.currentPeriod);
    });

    this.updateDateRangeBarVisibility();
    this.updatePresetButtonsState(preset);
    this.refreshUI();
  }

  private updatePresetButtonsState(activePreset?: string): void {
    this.datePresetBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === activePreset);
    });
  }

  private updateDateRangeBarVisibility(): void {
    if (!this.dateRangeBar) return;
    const isCustom = this.currentPeriod === 'custom';
    this.dateRangeBar.classList.toggle('open', isCustom);
  }

  private renderCurrentDate(): void {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    const dateStr = now.toLocaleDateString('he-IL', options);
    const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    this.dateDisplay.textContent = `${dateStr} • ${timeStr}`;
  }

  private updateSoundIcon(): void {
    if (this.settings.soundEnabled) {
      this.soundToggleBtn.classList.add('active');
      this.soundToggleBtn.title = 'צלילי סופר מריו פעילים (לחץ להשתקה)';
      this.soundIcon.innerHTML = `
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      `;
    } else {
      this.soundToggleBtn.classList.remove('active');
      this.soundToggleBtn.title = 'צלילים מושתקים (לחץ להפעלה)';
      this.soundIcon.innerHTML = `
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <line x1="23" y1="9" x2="17" y2="15"></line>
        <line x1="17" y1="9" x2="23" y2="15"></line>
      `;
    }
  }

  private setTransactionType(type: TransactionType): void {
    this.currentTxType = type;
    this.txTypeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    this.populateCategoryOptions();
  }

  private populateCategoryOptions(): void {
    const filtered = CATEGORIES.filter(c => c.type === this.currentTxType);
    this.txCategorySelect.innerHTML = filtered
      .map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`)
      .join('');
  }

  private openTransactionModal(type: TransactionType = 'expense'): void {
    this.txAmountInput.value = '';
    this.txNoteInput.value = '';

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    this.txDateInput.value = now.toISOString().slice(0, 16);

    this.setTransactionType(type);

    this.newTxModal.classList.add('open');
    setTimeout(() => this.txAmountInput.focus(), 50);
  }

  private closeTransactionModal(): void {
    this.newTxModal.classList.remove('open');
  }

  private renderCategoryCapsInputs(): void {
    if (!this.categoryCapsContainer) return;
    const expenseCategories = CATEGORIES.filter(c => c.type === 'expense');

    this.categoryCapsContainer.innerHTML = expenseCategories.map(cat => {
      return `
        <div class="category-cap-card" id="catCard_${cat.id}" data-cat-id="${cat.id}">
          <div class="category-cap-header" data-toggle-cat="${cat.id}">
            <div class="category-cap-info">
              <span class="cat-cap-icon" style="background: ${cat.color}22; color: ${cat.color};">${cat.icon}</span>
              <span class="cat-cap-name">${cat.name}</span>
            </div>
            <div class="category-cap-right">
              <span class="cat-status-badge empty" id="catBadge_${cat.id}">ללא הגבלה</span>
              <span class="category-cap-toggle-arrow">▼</span>
            </div>
          </div>
          <div class="category-cap-body">
            <div class="category-cap-inputs-grid">
              <div class="cap-input-subgroup">
                <div class="cap-subgroup-label">
                  <span>יומי (₪)</span>
                  <span class="cap-bound-hint" id="catBoundDaily_${cat.id}">עד ₪0</span>
                </div>
                <input type="number" class="category-cap-input" min="0" step="any"
                  id="catInput_daily_${cat.id}" data-cat-id="${cat.id}" data-period="daily"
                  placeholder="ללא הגבלה" />
              </div>
              <div class="cap-input-subgroup">
                <div class="cap-subgroup-label">
                  <span>שבועי (₪)</span>
                  <span class="cap-bound-hint" id="catBoundWeekly_${cat.id}">עד ₪0</span>
                </div>
                <input type="number" class="category-cap-input" min="0" step="any"
                  id="catInput_weekly_${cat.id}" data-cat-id="${cat.id}" data-period="weekly"
                  placeholder="ללא הגבלה" />
              </div>
              <div class="cap-input-subgroup">
                <div class="cap-subgroup-label">
                  <span>חודשי (₪)</span>
                  <span class="cap-bound-hint" id="catBoundMonthly_${cat.id}">עד ₪0</span>
                </div>
                <input type="number" class="category-cap-input" min="0" step="any"
                  id="catInput_monthly_${cat.id}" data-cat-id="${cat.id}" data-period="monthly"
                  placeholder="ללא הגבלה" />
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Toggle card expansion
    const headers = this.categoryCapsContainer.querySelectorAll<HTMLElement>('.category-cap-header');
    headers.forEach(h => {
      h.addEventListener('click', () => {
        const catId = h.dataset.toggleCat;
        const card = document.getElementById(`catCard_${catId}`);
        if (card) {
          card.classList.toggle('open');
        }
      });
    });

    // Attach input listeners on category inputs
    const catInputs = this.categoryCapsContainer.querySelectorAll<HTMLInputElement>('.category-cap-input');
    catInputs.forEach(input => {
      input.addEventListener('input', () => {
        const catId = input.dataset.catId;
        if (catId) {
          this.updateCategoryCardBadge(catId);
        }
        this.updateActiveCategoryCapsCounter();
        this.validateCapsHierarchy();
      });
    });
  }

  private updateCategoryBoundsHints(): void {
    const genDaily = Number(this.inputDailyCap.value) || 0;
    const genWeekly = Number(this.inputWeeklyCap.value) || 0;
    const genMonthly = Number(this.inputMonthlyCap.value) || 0;

    const expenseCategories = CATEGORIES.filter(c => c.type === 'expense');
    expenseCategories.forEach(cat => {
      const dHint = document.getElementById(`catBoundDaily_${cat.id}`);
      const wHint = document.getElementById(`catBoundWeekly_${cat.id}`);
      const mHint = document.getElementById(`catBoundMonthly_${cat.id}`);

      if (dHint) dHint.textContent = genDaily > 0 ? `עד ₪${genDaily.toLocaleString()}` : 'לפי כללי';
      if (wHint) wHint.textContent = genWeekly > 0 ? `עד ₪${genWeekly.toLocaleString()}` : 'לפי כללי';
      if (mHint) mHint.textContent = genMonthly > 0 ? `עד ₪${genMonthly.toLocaleString()}` : 'לפי כללי';
    });
  }

  private updateCategoryCardBadge(catId: string): void {
    const card = document.getElementById(`catCard_${catId}`);
    const badge = document.getElementById(`catBadge_${catId}`);
    const dInput = document.getElementById(`catInput_daily_${catId}`) as HTMLInputElement | null;
    const wInput = document.getElementById(`catInput_weekly_${catId}`) as HTMLInputElement | null;
    const mInput = document.getElementById(`catInput_monthly_${catId}`) as HTMLInputElement | null;

    const d = Number(dInput?.value) || 0;
    const w = Number(wInput?.value) || 0;
    const m = Number(mInput?.value) || 0;

    if (!badge || !card) return;

    if (d === 0 && w === 0 && m === 0) {
      badge.textContent = 'ללא הגבלה';
      badge.className = 'cat-status-badge empty';
      card.classList.remove('active');
    } else {
      const parts: string[] = [];
      if (d > 0) parts.push(`יומי: ₪${d.toLocaleString()}`);
      if (w > 0) parts.push(`שבועי: ₪${w.toLocaleString()}`);
      if (m > 0) parts.push(`חודשי: ₪${m.toLocaleString()}`);

      badge.textContent = parts.join(' | ');
      badge.className = 'cat-status-badge active';
      card.classList.add('active');
    }
  }

  private updateActiveCategoryCapsCounter(): void {
    if (!this.categoryCapsActiveCount) return;
    const expenseCategories = CATEGORIES.filter(c => c.type === 'expense');
    let activeCount = 0;

    expenseCategories.forEach(cat => {
      const d = Number((document.getElementById(`catInput_daily_${cat.id}`) as HTMLInputElement)?.value) || 0;
      const w = Number((document.getElementById(`catInput_weekly_${cat.id}`) as HTMLInputElement)?.value) || 0;
      const m = Number((document.getElementById(`catInput_monthly_${cat.id}`) as HTMLInputElement)?.value) || 0;
      if (d > 0 || w > 0 || m > 0) activeCount++;
    });

    this.categoryCapsActiveCount.textContent = `${activeCount} מוגדרות`;
  }

  private openCapsSettingsModal(isMandatory: boolean = false): void {
    if (this.capsMandatoryNotice) {
      this.capsMandatoryNotice.style.display = isMandatory ? 'flex' : 'none';
    }

    const hasAnyGeneralCap = this.settings.caps.daily > 0 || this.settings.caps.weekly > 0 || this.settings.caps.monthly > 0;

    if (!this.hasConfiguredCaps || isMandatory || !hasAnyGeneralCap) {
      if (this.closeCapsModalBtn) this.closeCapsModalBtn.style.display = 'none';
      this.inputDailyCap.value = '';
      this.inputWeeklyCap.value = '';
      this.inputMonthlyCap.value = '';
      this.dailyCapDisplayVal.textContent = '₪0';
      this.weeklyCapDisplayVal.textContent = '₪0';
      this.monthlyCapDisplayVal.textContent = '₪0';
    } else {
      if (this.closeCapsModalBtn) this.closeCapsModalBtn.style.display = 'flex';
      this.inputDailyCap.value = this.settings.caps.daily ? this.settings.caps.daily.toString() : '';
      this.inputWeeklyCap.value = this.settings.caps.weekly ? this.settings.caps.weekly.toString() : '';
      this.inputMonthlyCap.value = this.settings.caps.monthly ? this.settings.caps.monthly.toString() : '';
      this.dailyCapDisplayVal.textContent = `₪${(this.settings.caps.daily || 0).toLocaleString()}`;
      this.weeklyCapDisplayVal.textContent = `₪${(this.settings.caps.weekly || 0).toLocaleString()}`;
      this.monthlyCapDisplayVal.textContent = `₪${(this.settings.caps.monthly || 0).toLocaleString()}`;
    }

    // Populate category caps inputs
    const catCaps = this.settings.caps.categoryCaps || {};
    const expenseCategories = CATEGORIES.filter(c => c.type === 'expense');
    expenseCategories.forEach(cat => {
      const caps = catCaps[cat.id];
      const dInput = document.getElementById(`catInput_daily_${cat.id}`) as HTMLInputElement | null;
      const wInput = document.getElementById(`catInput_weekly_${cat.id}`) as HTMLInputElement | null;
      const mInput = document.getElementById(`catInput_monthly_${cat.id}`) as HTMLInputElement | null;

      if (dInput) dInput.value = caps?.daily ? caps.daily.toString() : '';
      if (wInput) wInput.value = caps?.weekly ? caps.weekly.toString() : '';
      if (mInput) mInput.value = caps?.monthly ? caps.monthly.toString() : '';

      this.updateCategoryCardBadge(cat.id);
    });

    this.updateCategoryBoundsHints();
    this.updateActiveCategoryCapsCounter();

    // Reset error validation state
    this.hideCapsError();
    this.inputDailyCap.classList.remove('input-error');
    this.inputWeeklyCap.classList.remove('input-error');
    this.inputMonthlyCap.classList.remove('input-error');
    const allCatInputs = this.capsModal.querySelectorAll('.category-cap-input');
    allCatInputs.forEach(i => i.classList.remove('input-error'));
    if (this.saveCapsBtn) this.saveCapsBtn.disabled = false;

    this.capsModal.classList.add('open');
    setTimeout(() => this.inputDailyCap.focus(), 50);
  }

  private closeCapsModal(force: boolean = false): void {
    if (!force && !this.hasConfiguredCaps) {
      playMarioWarning();
      this.showCapsError('⚠️ חובה להגדיר תקרות תקציב ראשוניות כדי להמשיך להשתמש באפליקציה.');
      this.inputDailyCap.focus();
      return;
    }
    this.capsModal.classList.remove('open');
  }

  private validateCapsHierarchy(showVisualError: boolean = true): boolean {
    const genDaily = Number(this.inputDailyCap.value) || 0;
    const genWeekly = Number(this.inputWeeklyCap.value) || 0;
    const genMonthly = Number(this.inputMonthlyCap.value) || 0;

    // Reset visual error states
    this.inputDailyCap.classList.remove('input-error');
    this.inputWeeklyCap.classList.remove('input-error');
    this.inputMonthlyCap.classList.remove('input-error');
    const allCatInputs = this.capsModal.querySelectorAll('.category-cap-input');
    allCatInputs.forEach(i => i.classList.remove('input-error'));

    // Rule 1: General Daily <= General Weekly
    if (genDaily > 0 && genWeekly > 0 && genDaily > genWeekly) {
      if (showVisualError) {
        this.inputDailyCap.classList.add('input-error');
        this.inputWeeklyCap.classList.add('input-error');
        this.showCapsError(`⚠️ שגיאה: תקרה יומית כללית (₪${genDaily.toLocaleString()}) אינה יכולה לעלות על תקרה שבועית (₪${genWeekly.toLocaleString()})`);
      }
      if (this.saveCapsBtn) this.saveCapsBtn.disabled = true;
      return false;
    }

    // Rule 2: General Weekly <= General Monthly
    if (genWeekly > 0 && genMonthly > 0 && genWeekly > genMonthly) {
      if (showVisualError) {
        this.inputWeeklyCap.classList.add('input-error');
        this.inputMonthlyCap.classList.add('input-error');
        this.showCapsError(`⚠️ שגיאה: תקרה שבועית כללית (₪${genWeekly.toLocaleString()}) אינה יכולה לעלות על תקרה חודשית (₪${genMonthly.toLocaleString()})`);
      }
      if (this.saveCapsBtn) this.saveCapsBtn.disabled = true;
      return false;
    }

    // Rule 3: Category Caps must not exceed General Caps (Umbrella Upper Bound) & Category intra-hierarchy
    const expenseCategories = CATEGORIES.filter(c => c.type === 'expense');
    let hasAnyCategoryCap = false;

    for (const cat of expenseCategories) {
      const dInput = document.getElementById(`catInput_daily_${cat.id}`) as HTMLInputElement | null;
      const wInput = document.getElementById(`catInput_weekly_${cat.id}`) as HTMLInputElement | null;
      const mInput = document.getElementById(`catInput_monthly_${cat.id}`) as HTMLInputElement | null;
      const card = document.getElementById(`catCard_${cat.id}`);

      const catDaily = Number(dInput?.value) || 0;
      const catWeekly = Number(wInput?.value) || 0;
      const catMonthly = Number(mInput?.value) || 0;

      if (catDaily > 0 || catWeekly > 0 || catMonthly > 0) {
        hasAnyCategoryCap = true;
      }

      // 3.1: Category Daily vs General Daily
      if (catDaily > 0 && genDaily > 0 && catDaily > genDaily) {
        if (showVisualError) {
          dInput?.classList.add('input-error');
          card?.classList.add('open');
          this.showCapsError(`⚠️ שגיאה: תקרת ${cat.name} היומית (₪${catDaily.toLocaleString()}) אינה יכולה לעלות על התקרה הכללית (₪${genDaily.toLocaleString()})`);
        }
        if (this.saveCapsBtn) this.saveCapsBtn.disabled = true;
        return false;
      }

      // 3.2: Category Weekly vs General Weekly
      if (catWeekly > 0 && genWeekly > 0 && catWeekly > genWeekly) {
        if (showVisualError) {
          wInput?.classList.add('input-error');
          card?.classList.add('open');
          this.showCapsError(`⚠️ שגיאה: תקרת ${cat.name} השבועית (₪${catWeekly.toLocaleString()}) אינה יכולה לעלות על התקרה הכללית (₪${genWeekly.toLocaleString()})`);
        }
        if (this.saveCapsBtn) this.saveCapsBtn.disabled = true;
        return false;
      }

      // 3.3: Category Monthly vs General Monthly
      if (catMonthly > 0 && genMonthly > 0 && catMonthly > genMonthly) {
        if (showVisualError) {
          mInput?.classList.add('input-error');
          card?.classList.add('open');
          this.showCapsError(`⚠️ שגיאה: תקרת ${cat.name} החודשית (₪${catMonthly.toLocaleString()}) אינה יכולה לעלות על התקרה הכללית (₪${genMonthly.toLocaleString()})`);
        }
        if (this.saveCapsBtn) this.saveCapsBtn.disabled = true;
        return false;
      }

      // 3.4: Category intra-hierarchy (Daily <= Weekly <= Monthly)
      if (catDaily > 0 && catWeekly > 0 && catDaily > catWeekly) {
        if (showVisualError) {
          dInput?.classList.add('input-error');
          wInput?.classList.add('input-error');
          card?.classList.add('open');
          this.showCapsError(`⚠️ שגיאה: תקרת ${cat.name} היומית (₪${catDaily.toLocaleString()}) אינה יכולה לעלות על תקרתה השבועית (₪${catWeekly.toLocaleString()})`);
        }
        if (this.saveCapsBtn) this.saveCapsBtn.disabled = true;
        return false;
      }

      if (catWeekly > 0 && catMonthly > 0 && catWeekly > catMonthly) {
        if (showVisualError) {
          wInput?.classList.add('input-error');
          mInput?.classList.add('input-error');
          card?.classList.add('open');
          this.showCapsError(`⚠️ שגיאה: תקרת ${cat.name} השבועית (₪${catWeekly.toLocaleString()}) אינה יכולה לעלות על תקרתה החודשית (₪${catMonthly.toLocaleString()})`);
        }
        if (this.saveCapsBtn) this.saveCapsBtn.disabled = true;
        return false;
      }
    }

    // Rule 4: Minimum requirement - at least ONE valid cap (>0) across General or Categories
    const hasAnyGeneralCap = genDaily > 0 || genWeekly > 0 || genMonthly > 0;
    if (!hasAnyGeneralCap && !hasAnyCategoryCap) {
      if (showVisualError) {
        this.showCapsError('⚠️ חובה להגדיר לפחות תקרה תקפה אחת (ביומית, שבועית או חודשית) ב"כללי" או באחת הקטגוריות.');
      }
      if (this.saveCapsBtn) this.saveCapsBtn.disabled = true;
      return false;
    }

    this.hideCapsError();
    if (this.saveCapsBtn) this.saveCapsBtn.disabled = false;
    return true;
  }

  private showCapsError(msg: string): void {
    if (this.capsValidationMsg) {
      this.capsValidationMsg.textContent = msg;
      this.capsValidationMsg.style.display = 'flex';
    }
  }

  private hideCapsError(): void {
    if (this.capsValidationMsg) {
      this.capsValidationMsg.textContent = '';
      this.capsValidationMsg.style.display = 'none';
    }
  }

  private async handleSaveCaps(): Promise<void> {
    if (!this.validateCapsHierarchy(true)) {
      playMarioWarning();
      return;
    }

    const daily = Number(this.inputDailyCap.value) || 0;
    const weekly = Number(this.inputWeeklyCap.value) || 0;
    const monthly = Number(this.inputMonthlyCap.value) || 0;

    // Collect category caps
    const categoryCaps: Record<string, Partial<BudgetCaps>> = {};
    const expenseCategories = CATEGORIES.filter(c => c.type === 'expense');

    expenseCategories.forEach(cat => {
      const d = Number((document.getElementById(`catInput_daily_${cat.id}`) as HTMLInputElement)?.value) || 0;
      const w = Number((document.getElementById(`catInput_weekly_${cat.id}`) as HTMLInputElement)?.value) || 0;
      const m = Number((document.getElementById(`catInput_monthly_${cat.id}`) as HTMLInputElement)?.value) || 0;

      if (d > 0 || w > 0 || m > 0) {
        categoryCaps[cat.id] = {};
        if (d > 0) categoryCaps[cat.id]!.daily = d;
        if (w > 0) categoryCaps[cat.id]!.weekly = w;
        if (m > 0) categoryCaps[cat.id]!.monthly = m;
      }
    });

    this.settings.caps = { daily, weekly, monthly, categoryCaps };
    this.hasConfiguredCaps = true;
    localStorage.setItem('pulse_caps_configured', 'true');
    saveSettings(this.settings);

    // If user logged in, persist to Firestore
    if (this.currentUser) {
      await saveUserCapsToFirestore(this.currentUser.uid, this.settings.caps);
    }

    if (this.capsMandatoryNotice) {
      this.capsMandatoryNotice.style.display = 'none';
    }

    if (this.closeCapsModalBtn) {
      this.closeCapsModalBtn.style.display = 'flex';
    }

    playMario1Up();
    this.requestNotificationPermission();
    this.closeCapsModal(true);
    this.refreshUI();
  }

  private isSubmittingTx: boolean = false;

  private async handleNewTransaction(): Promise<void> {
    if (this.isSubmittingTx) return;

    if (!this.hasConfiguredCaps) {
      playMarioWarning();
      this.closeTransactionModal();
      this.openCapsSettingsModal(true);
      return;
    }

    const amount = parseFloat(this.txAmountInput.value);
    if (!amount || amount <= 0) {
      alert('נא להזין סכום תקין גדול מ-0');
      return;
    }

    this.isSubmittingTx = true;
    const submitBtn = this.txForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (submitBtn) submitBtn.disabled = true;

    try {
      const category = this.txCategorySelect.value;
      const dateVal = this.txDateInput.value || new Date().toISOString().slice(0, 16);
      const note = this.txNoteInput.value.trim();

      const newTx: Transaction = {
        id: 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        type: this.currentTxType,
        amount,
        category,
        date: dateVal,
        note: note || undefined,
        createdAt: new Date(dateVal).getTime() || Date.now()
      };

      // Close modal immediately to avoid duplicate taps/submissions
      this.closeTransactionModal();

      // Only add to local array if not already present
      if (!this.transactions.some(t => t.id === newTx.id)) {
        this.transactions.unshift(newTx);
        saveTransactions(this.transactions);
      }

      this.refreshUI();

      if (newTx.type === 'income') {
        playMarioCoin();
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.7 }
        });
      } else {
        this.checkCategoryBreachesAfterExpense(newTx);
      }

      // Re-evaluate notification bell badge and list immediately
      this.updateNotificationsState();

      // Save to Firestore if user logged in
      if (this.currentUser) {
        await saveUserTransactionToFirestore(this.currentUser.uid, newTx);
      }
    } finally {
      this.isSubmittingTx = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  public async deleteTransaction(id: string): Promise<void> {
    if (confirm('האם למחוק תנועה זו?')) {
      playMarioJump();

      // If user logged in, delete from Firestore
      if (this.currentUser) {
        await deleteUserTransactionFromFirestore(this.currentUser.uid, id);
      }

      this.transactions = this.transactions.filter(t => t.id !== id);
      saveTransactions(this.transactions);
      this.refreshUI();
    }
  }

  private checkCategoryBreachesAfterExpense(newTx: Transaction): void {
    const catCaps = this.settings.caps.categoryCaps?.[newTx.category];
    const catInfo = getCategoryById(newTx.category);

    if (!catCaps) {
      playMarioJump();
      return;
    }

    const now = new Date();
    const todayStr = formatLocalYMD(now);
    const currentYearMonth = todayStr.slice(0, 7);

    // Current week boundaries
    const currentDayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - currentDayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfWeekTime = startOfWeek.getTime();

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    const endOfWeekTime = endOfWeek.getTime();

    let isBreach = false;
    const breachMessages: string[] = [];

    // Helper to get normalized date
    const getCleanDate = (dateStr: string) => {
      let d = dateStr.slice(0, 10);
      if (d.includes('/')) d = fromEuropeanDate(d);
      return d;
    };

    // Check Daily
    if (catCaps.daily && catCaps.daily > 0) {
      const dayTotal = this.transactions
        .filter(t => t.type === 'expense' && t.category === newTx.category && getCleanDate(t.date) === todayStr)
        .reduce((sum, t) => sum + t.amount, 0);

      if (dayTotal > catCaps.daily) {
        isBreach = true;
        const diff = dayTotal - catCaps.daily;
        breachMessages.push(`יומי: ₪${dayTotal.toLocaleString()} מתוך ₪${catCaps.daily.toLocaleString()} (+₪${diff.toLocaleString()})`);
      }
    }

    // Check Weekly
    if (catCaps.weekly && catCaps.weekly > 0) {
      const weekTotal = this.transactions
        .filter(t => {
          if (t.type !== 'expense' || t.category !== newTx.category) return false;
          let d = t.date;
          if (d.includes('/')) d = fromEuropeanDate(d);
          const time = new Date(d).getTime();
          return time >= startOfWeekTime && time <= endOfWeekTime;
        })
        .reduce((sum, t) => sum + t.amount, 0);

      if (weekTotal > catCaps.weekly) {
        isBreach = true;
        const diff = weekTotal - catCaps.weekly;
        breachMessages.push(`שבועי: ₪${weekTotal.toLocaleString()} מתוך ₪${catCaps.weekly.toLocaleString()} (+₪${diff.toLocaleString()})`);
      }
    }

    // Check Monthly
    if (catCaps.monthly && catCaps.monthly > 0) {
      const monthTotal = this.transactions
        .filter(t => t.type === 'expense' && t.category === newTx.category && getCleanDate(t.date).startsWith(currentYearMonth))
        .reduce((sum, t) => sum + t.amount, 0);

      if (monthTotal > catCaps.monthly) {
        isBreach = true;
        const diff = monthTotal - catCaps.monthly;
        breachMessages.push(`חודשי: ₪${monthTotal.toLocaleString()} מתוך ₪${catCaps.monthly.toLocaleString()} (+₪${diff.toLocaleString()})`);
      }
    }

    if (isBreach) {
      playMarioGameOver();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([150, 80, 150, 80, 250]); } catch {}
      }

      const desc = breachMessages.join(' • ');
      this.showToastNotification({
        title: `🚨 חריגה מתקרת ${catInfo.name}!`,
        desc,
        icon: catInfo.icon,
        type: 'danger',
        durationMs: 7500
      });

      this.sendBrowserNotification(`🚨 חריגה מתקרת ${catInfo.name}!`, desc);
    } else {
      playMarioJump();
    }
  }

  private showToastNotification(options: {
    title: string;
    desc: string;
    icon?: string;
    type?: 'danger' | 'warning' | 'info';
    durationMs?: number;
  }): void {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast-item ${options.type || 'danger'}`;
    toast.setAttribute('role', 'alert');

    toast.innerHTML = `
      <div class="toast-icon">${options.icon || '🚨'}</div>
      <div class="toast-body">
        <div class="toast-title">${options.title}</div>
        <div class="toast-desc">${options.desc}</div>
      </div>
      <button type="button" class="toast-close-btn" aria-label="סגור">✕</button>
    `;

    const closeBtn = toast.querySelector<HTMLButtonElement>('.toast-close-btn');
    const removeToast = () => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    };

    if (closeBtn) {
      closeBtn.addEventListener('click', removeToast);
    }

    this.toastContainer.appendChild(toast);

    setTimeout(removeToast, options.durationMs || 6500);
  }

  private sendBrowserNotification(title: string, body: string): void {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico'
        });
      } catch (e) {
        console.warn('Browser notification error:', e);
      }
    }
  }

  private requestNotificationPermission(): void {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  private getFilteredTransactions(): Transaction[] {
    const startStr = this.customDateRange.start;
    const endStr = this.customDateRange.end;
    const seen = new Set<string>();

    return this.transactions.filter(t => {
      if (!t.id || seen.has(t.id)) return false;
      seen.add(t.id);
      let txDateStr = t.date.slice(0, 10);
      if (txDateStr.includes('/')) {
        txDateStr = fromEuropeanDate(txDateStr);
      }
      return txDateStr >= startStr && txDateStr <= endStr;
    });
  }

  private computeBudgetStatus(): BudgetStatus {
    const periodTxs = this.getFilteredTransactions();

    // Calculate Cap depending on period or custom date range length
    let cap = this.settings.caps.daily;
    let rangeLabel = 'יומי';

    if (this.currentPeriod === 'daily') {
      cap = this.settings.caps.daily;
      rangeLabel = 'היום';
    } else if (this.currentPeriod === 'weekly') {
      cap = this.settings.caps.weekly;
      rangeLabel = 'השבוע';
    } else if (this.currentPeriod === 'monthly') {
      cap = this.settings.caps.monthly;
      const now = new Date();
      const hebrewMonthName = now.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
      rangeLabel = `חודש ${hebrewMonthName}`;
    } else {
      // Custom date range: calculate days count
      const start = new Date(this.customDateRange.start).getTime();
      const end = new Date(this.customDateRange.end).getTime();
      const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
      cap = this.settings.caps.daily * diffDays;
      const startEu = toEuropeanDate(this.customDateRange.start);
      const endEu = toEuropeanDate(this.customDateRange.end);
      rangeLabel = startEu === endEu ? `${startEu}` : `${startEu} - ${endEu} (${diffDays} ימים)`;
    }

    let spent = 0;
    let income = 0;

    periodTxs.forEach(t => {
      if (t.type === 'expense') {
        spent += t.amount;
      } else {
        income += t.amount;
      }
    });

    const percent = cap > 0 ? (spent / cap) * 100 : 0;
    const remaining = cap - spent;
    const net = income - spent;

    let status: 'safe' | 'warning' | 'danger' = 'safe';
    let paceDescription = 'תקין';

    if (percent >= 100) {
      status = 'danger';
      paceDescription = 'חריגה מהיעד!';
    } else if (percent >= 75) {
      status = 'warning';
      paceDescription = 'קצב הוצאות גבוה!';
    } else {
      status = 'safe';
      paceDescription = 'בטווח המטרה';
    }

    return {
      period: this.currentPeriod,
      status,
      percent,
      spent,
      cap,
      remaining,
      income,
      net,
      paceDescription,
      rangeLabel
    };
  }

  private refreshUI(): void {
    const status = this.computeBudgetStatus();
    const periodTxs = this.getFilteredTransactions();

    // 1. Dynamic Titles
    const periodText = status.rangeLabel || 'התקופה הנבחרת';
    this.chartSectionTitle.textContent = `מעקב הוצאות • ${periodText}`;
    this.metricExpTitle.textContent = `סך הוצאות (${periodText})`;
    this.metricIncTitle.textContent = `סך הכנסות (${periodText})`;

    // 2. Central Activity Ring
    this.updatePedometerRing(status);

    // 3. Side Metric Cards
    this.updateMetricCards(status, periodTxs);

    // 4. Alert Banner with Mario sounds
    this.updateAlertBanner(status);

    // 5. Interactive Chart
    this.chartManager.render(
      this.currentPeriod,
      this.transactions,
      this.settings.caps,
      this.customDateRange
    );

    // 6. Transaction Ledger
    this.renderTransactionsList();

    // 7. Active Notifications Bell & Dropdown
    this.updateNotificationsState();

    // 8. Category Breakdown Table (Only visible for Daily, Weekly, Monthly; hidden for custom date range)
    this.renderCategoryBreakdownTable();

    // 9. Pulse Nuggets (Smart Insights Card - Phase 1)
    this.renderPulseNuggets();

    // 10. Pulse Lab (Deep BI Hub - Phase 2)
    if (this.pulseLabModal?.classList.contains('open')) {
      this.renderPulseLab();
    }
  }

  private updateNotificationsState(): void {
    if (!this.notificationsBadge || !this.notificationsList) return;

    const now = new Date();
    const todayStr = formatLocalYMD(now);
    const currentYearMonth = todayStr.slice(0, 7);

    // Current week boundaries (Sunday 00:00 to Saturday 23:59:59.999)
    const currentDayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - currentDayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfWeekTime = startOfWeek.getTime();

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    const endOfWeekTime = endOfWeek.getTime();

    const getCleanDate = (dateStr: string) => {
      let d = dateStr.slice(0, 10);
      if (d.includes('/')) d = fromEuropeanDate(d);
      return d;
    };

    const allExpenseTxs = this.transactions.filter(t => t.type === 'expense');

    // Filter transactions into calendar timeframes
    const todayExpenses = allExpenseTxs.filter(t => getCleanDate(t.date) === todayStr);

    const weekExpenses = allExpenseTxs.filter(t => {
      let d = t.date;
      if (d.includes('/')) d = fromEuropeanDate(d);
      const time = new Date(d).getTime();
      return time >= startOfWeekTime && time <= endOfWeekTime;
    });

    const monthExpenses = allExpenseTxs.filter(t => getCleanDate(t.date).startsWith(currentYearMonth));

    const activeNotifications: Array<{
      id: string;
      title: string;
      icon: string;
      spent: number;
      cap: number;
      overage: number;
      isGeneral: boolean;
      targetPeriod: BudgetPeriod;
      categoryId?: string;
      timeframeLabel: string;
    }> = [];

    // 1. General Caps Breaches
    const caps = this.settings.caps;

    // 1.1 General Daily Cap
    if (caps.daily && caps.daily > 0) {
      const spentDaily = todayExpenses.reduce((sum, t) => sum + t.amount, 0);
      if (spentDaily > caps.daily) {
        activeNotifications.push({
          id: 'general_daily',
          title: 'תקרה כללית (היום)',
          icon: '⚠️',
          spent: spentDaily,
          cap: caps.daily,
          overage: spentDaily - caps.daily,
          isGeneral: true,
          targetPeriod: 'daily',
          timeframeLabel: 'היום'
        });
      }
    }

    // 1.2 General Weekly Cap
    if (caps.weekly && caps.weekly > 0) {
      const spentWeekly = weekExpenses.reduce((sum, t) => sum + t.amount, 0);
      if (spentWeekly > caps.weekly) {
        activeNotifications.push({
          id: 'general_weekly',
          title: 'תקרה כללית (השבוע)',
          icon: '⚠️',
          spent: spentWeekly,
          cap: caps.weekly,
          overage: spentWeekly - caps.weekly,
          isGeneral: true,
          targetPeriod: 'weekly',
          timeframeLabel: 'השבוע'
        });
      }
    }

    // 1.3 General Monthly Cap
    if (caps.monthly && caps.monthly > 0) {
      const spentMonthly = monthExpenses.reduce((sum, t) => sum + t.amount, 0);
      if (spentMonthly > caps.monthly) {
        activeNotifications.push({
          id: 'general_monthly',
          title: 'תקרה כללית (החודש)',
          icon: '⚠️',
          spent: spentMonthly,
          cap: caps.monthly,
          overage: spentMonthly - caps.monthly,
          isGeneral: true,
          targetPeriod: 'monthly',
          timeframeLabel: 'החודש'
        });
      }
    }

    // 2. Category Caps Breaches
    const catCapsMap = this.settings.caps.categoryCaps || {};
    const expenseCats = CATEGORIES.filter(c => c.type === 'expense');

    for (const cat of expenseCats) {
      const cCap = catCapsMap[cat.id];
      if (!cCap) continue;

      // 2.1 Category Daily
      if (cCap.daily && cCap.daily > 0) {
        const catDailySpent = todayExpenses
          .filter(t => t.category === cat.id)
          .reduce((sum, t) => sum + t.amount, 0);

        if (catDailySpent > cCap.daily) {
          activeNotifications.push({
            id: `cat_${cat.id}_daily`,
            title: `תקרת ${cat.name} (היום)`,
            icon: cat.icon,
            spent: catDailySpent,
            cap: cCap.daily,
            overage: catDailySpent - cCap.daily,
            isGeneral: false,
            targetPeriod: 'daily',
            categoryId: cat.id,
            timeframeLabel: 'היום'
          });
        }
      }

      // 2.2 Category Weekly
      if (cCap.weekly && cCap.weekly > 0) {
        const catWeeklySpent = weekExpenses
          .filter(t => t.category === cat.id)
          .reduce((sum, t) => sum + t.amount, 0);

        if (catWeeklySpent > cCap.weekly) {
          activeNotifications.push({
            id: `cat_${cat.id}_weekly`,
            title: `תקרת ${cat.name} (השבוע)`,
            icon: cat.icon,
            spent: catWeeklySpent,
            cap: cCap.weekly,
            overage: catWeeklySpent - cCap.weekly,
            isGeneral: false,
            targetPeriod: 'weekly',
            categoryId: cat.id,
            timeframeLabel: 'השבוע'
          });
        }
      }

      // 2.3 Category Monthly
      if (cCap.monthly && cCap.monthly > 0) {
        const catMonthlySpent = monthExpenses
          .filter(t => t.category === cat.id)
          .reduce((sum, t) => sum + t.amount, 0);

        if (catMonthlySpent > cCap.monthly) {
          activeNotifications.push({
            id: `cat_${cat.id}_monthly`,
            title: `תקרת ${cat.name} (החודש)`,
            icon: cat.icon,
            spent: catMonthlySpent,
            cap: cCap.monthly,
            overage: catMonthlySpent - cCap.monthly,
            isGeneral: false,
            targetPeriod: 'monthly',
            categoryId: cat.id,
            timeframeLabel: 'החודש'
          });
        }
      }
    }

    // 3. Custom Date Range Breach (if currently viewing custom period)
    if (this.currentPeriod === 'custom') {
      const customStatus = this.computeBudgetStatus();
      if (customStatus.cap > 0 && customStatus.spent > customStatus.cap) {
        activeNotifications.push({
          id: 'general_custom',
          title: `תקרה כללית (${customStatus.rangeLabel})`,
          icon: '⚠️',
          spent: customStatus.spent,
          cap: customStatus.cap,
          overage: customStatus.spent - customStatus.cap,
          isGeneral: true,
          targetPeriod: 'custom',
          timeframeLabel: customStatus.rangeLabel || 'טווח מותאם'
        });
      }
    }

    const count = activeNotifications.length;

    // Update Bell Button & Counter Badge
    if (count > 0) {
      this.notificationsBadge.style.display = 'flex';
      this.notificationsBadge.textContent = count > 9 ? '9+' : String(count);
      this.notificationsBtn?.classList.add('has-breach');
      this.notificationsBtn?.setAttribute('title', `${count} התראות חריגת תקציב פעילות`);
      if (this.notificationsDropdownCount) {
        this.notificationsDropdownCount.className = 'notifications-count-tag';
        this.notificationsDropdownCount.textContent = `${count} חריגות`;
      }
    } else {
      this.notificationsBadge.style.display = 'none';
      this.notificationsBadge.textContent = '0';
      this.notificationsBtn?.classList.remove('has-breach');
      this.notificationsBtn?.setAttribute('title', 'התראות תקציב (אין חריגות)');
      if (this.notificationsDropdownCount) {
        this.notificationsDropdownCount.className = 'notifications-count-tag empty';
        this.notificationsDropdownCount.textContent = 'הכל תקין ✓';
      }
    }

    // Render Notifications Dropdown List
    if (count === 0) {
      this.notificationsList.innerHTML = `
        <div class="notification-empty-state">
          <div class="notification-empty-icon">✅</div>
          <div class="notification-empty-text">אין חריגות תקציב פעילות</div>
          <div class="notification-empty-sub">כל ההוצאות בטווח התקרות שהוגדרו</div>
        </div>
      `;
    } else {
      this.notificationsList.innerHTML = activeNotifications.map(n => `
        <div class="notification-dropdown-item breach" data-target-period="${n.targetPeriod}" data-cat-id="${n.categoryId || ''}" title="לחץ למעבר לתצוגת ${n.timeframeLabel}">
          <div class="notification-item-icon">${n.icon}</div>
          <div class="notification-item-content">
            <div class="notification-item-title">
              <span>${n.title}</span>
              <span class="notification-item-badge">+₪${n.overage.toLocaleString()}</span>
            </div>
            <div class="notification-item-desc">
              הוצאת ₪${n.spent.toLocaleString()} מתוך תקרה של ₪${n.cap.toLocaleString()} (${n.timeframeLabel})
            </div>
          </div>
        </div>
      `).join('');

      // Add click interactions to jump to the relevant timeframe
      this.notificationsList.querySelectorAll('.notification-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const target = (item as HTMLElement).dataset.targetPeriod as BudgetPeriod | undefined;
          if (target && target !== 'custom') {
            this.switchPeriod(target);
            this.closeNotificationsDropdown();
          }
        });
      });
    }
  }

  private renderCategoryBreakdownTable(): void {
    if (!this.categoryBreakdownSection || !this.categoryBreakdownTbody) return;

    // Hide panel completely when custom date range filter is chosen
    if (this.currentPeriod === 'custom') {
      this.categoryBreakdownSection.style.display = 'none';
      return;
    }

    this.categoryBreakdownSection.style.display = 'block';

    // Update Period Badge Text
    let periodLabel = 'חודשי';
    if (this.currentPeriod === 'daily') periodLabel = 'יומי (היום)';
    else if (this.currentPeriod === 'weekly') periodLabel = 'שבועי (השבוע)';
    else if (this.currentPeriod === 'monthly') periodLabel = 'חודשי (החודש)';

    if (this.categoryBreakdownPeriodBadge) {
      this.categoryBreakdownPeriodBadge.textContent = periodLabel;
    }

    // Filter current period's transactions
    const periodTxs = this.getFilteredTransactions();
    const expenseTxs = periodTxs.filter(t => t.type === 'expense');

    // Group expenses sum per category
    const spentByCat: Record<string, number> = {};
    expenseTxs.forEach(t => {
      spentByCat[t.category] = (spentByCat[t.category] || 0) + t.amount;
    });

    // The categories to be shown are ONLY the ones that have expenses set to them
    const activeCatIds = Object.keys(spentByCat).filter(catId => (spentByCat[catId] || 0) > 0);

    if (this.categoryBreakdownSummary) {
      this.categoryBreakdownSummary.textContent = `${activeCatIds.length} קטגוריות עם הוצאות`;
    }

    if (activeCatIds.length === 0) {
      this.categoryBreakdownTbody.innerHTML = `
        <tr>
          <td colspan="4" class="category-table-empty">
            🍃 אין עדיין הוצאות שנרשמו ב${periodLabel}
          </td>
        </tr>
      `;
      return;
    }

    const catCapsMap = this.settings.caps.categoryCaps || {};

    // Build row data for each active category
    const rows = activeCatIds.map(catId => {
      const cat = getCategoryById(catId);
      const spent = spentByCat[catId] || 0;
      const caps = catCapsMap[catId];

      let limit = 0;
      if (this.currentPeriod === 'daily') limit = caps?.daily || 0;
      else if (this.currentPeriod === 'weekly') limit = caps?.weekly || 0;
      else if (this.currentPeriod === 'monthly') limit = caps?.monthly || 0;

      const hasLimit = limit > 0;
      const pct = hasLimit ? (spent / limit) * 100 : 0;
      const isBreach = hasLimit && spent > limit;

      return { cat, spent, limit, hasLimit, pct, isBreach };
    });

    // Sort: breached categories first, then highest spent descending
    rows.sort((a, b) => {
      if (a.isBreach !== b.isBreach) return a.isBreach ? -1 : 1;
      return b.spent - a.spent;
    });

    this.categoryBreakdownTbody.innerHTML = rows.map(r => {
      const limitDisplay = r.hasLimit
        ? `<span class="cat-table-amount limit">₪${r.limit.toLocaleString()}</span>`
        : `<span class="cat-table-no-limit">ללא תקרה</span>`;

      let progressHtml = '';
      if (r.hasLimit) {
        let statusClass: 'safe' | 'warning' | 'danger' = 'safe';
        if (r.pct >= 100) statusClass = 'danger';
        else if (r.pct >= 75) statusClass = 'warning';

        const label = r.pct >= 100 ? `חריגה ${r.pct.toFixed(0)}%` : `${r.pct.toFixed(1)}%`;
        const barWidth = Math.min(r.pct, 100);

        progressHtml = `
          <div class="cat-progress-cell">
            <div class="cat-progress-track">
              <div class="cat-progress-bar ${statusClass}" style="width: ${barWidth}%;"></div>
            </div>
            <span class="cat-percent-tag ${statusClass}">${label}</span>
          </div>
        `;
      } else {
        progressHtml = `<span class="cat-table-no-limit">-</span>`;
      }

      return `
        <tr class="${r.isBreach ? 'row-breach' : ''}">
          <td>
            <div class="cat-cell-info">
              <span class="cat-table-icon" style="background: ${r.cat.color}22; color: ${r.cat.color};">${r.cat.icon}</span>
              <span class="cat-table-name">${r.cat.name}</span>
            </div>
          </td>
          <td>${limitDisplay}</td>
          <td><span class="cat-table-amount spent">₪${r.spent.toLocaleString()}</span></td>
          <td>${progressHtml}</td>
        </tr>
      `;
    }).join('');
  }

  private updatePedometerRing(status: BudgetStatus): void {
    const circumference = 2 * Math.PI * 125;
    const clampedPercent = Math.min(100, Math.max(0, status.percent));
    const offset = circumference - (clampedPercent / 100) * circumference;

    this.ringProgressCircle.style.strokeDashoffset = `${offset}`;

    this.ringProgressCircle.classList.remove('warning', 'danger');
    this.ringStatusPill.classList.remove('safe', 'warning', 'danger');

    // Display REMAINING budget as the central hero figure (increases when expenses are removed)
    if (status.remaining >= 0) {
      this.ringSpentDisplay.textContent = `₪${status.remaining.toLocaleString()}`;
      this.ringSpentDisplay.style.color = '#ffffff';
      if (this.ringCapPrefix) this.ringCapPrefix.textContent = 'נותר מתוך תקרה של ';
    } else {
      this.ringSpentDisplay.textContent = `-₪${Math.abs(status.remaining).toLocaleString()}`;
      this.ringSpentDisplay.style.color = 'var(--neon-red)';
      if (this.ringCapPrefix) this.ringCapPrefix.textContent = 'חריגה מתקרה של ';
    }

    this.ringCapDisplay.textContent = `₪${status.cap.toLocaleString()}`;
    this.ringPercentBadge.textContent = status.spent > 0
      ? `הוצאת ₪${status.spent.toLocaleString()} • ${status.percent.toFixed(1)}%`
      : '0.0% נוצל';

    if (status.status === 'danger') {
      this.ringProgressCircle.classList.add('danger');
      this.ringStatusPill.classList.add('danger');
      this.ringStatusText.textContent = 'חריגה מהתקרה!';
      this.ringPercentBadge.style.color = 'var(--neon-red)';
      this.ringPercentBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    } else if (status.status === 'warning') {
      this.ringProgressCircle.classList.add('warning');
      this.ringStatusPill.classList.add('warning');
      this.ringStatusText.textContent = 'מתקרב לתקרה!';
      this.ringPercentBadge.style.color = 'var(--neon-amber)';
      this.ringPercentBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    } else {
      this.ringStatusPill.classList.add('safe');
      this.ringStatusText.textContent = 'בטווח היעד';
      this.ringPercentBadge.style.color = 'var(--neon-cyan)';
      this.ringPercentBadge.style.borderColor = 'rgba(0, 245, 212, 0.4)';
    }

    // Bottom stat in hero card: actual spent expenses (decreases when expenses are removed)
    this.heroRemainingVal.className = 'hero-stat-value';
    this.heroRemainingVal.textContent = `₪${status.spent.toLocaleString()}`;

    this.heroPaceVal.textContent = status.paceDescription;
    this.heroPaceVal.style.color =
      status.status === 'danger' ? 'var(--neon-red)' :
        status.status === 'warning' ? 'var(--neon-amber)' : 'var(--neon-cyan)';
  }

  private updateMetricCards(status: BudgetStatus, periodTxs: Transaction[]): void {
    const expCount = periodTxs.filter(t => t.type === 'expense').length;
    const incCount = periodTxs.filter(t => t.type === 'income').length;

    this.metricExpValue.textContent = `₪${status.spent.toLocaleString()}`;
    this.metricExpCount.textContent = `${expCount} עסקאות`;

    this.metricIncValue.textContent = `₪${status.income.toLocaleString()}`;
    this.metricIncCount.textContent = `${incCount} הפקדות`;

    if (status.net > 0) {
      this.metricNetValue.textContent = `+₪${status.net.toLocaleString()}`;
      this.metricNetValue.style.color = 'var(--neon-cyan)';
      this.metricNetStatus.textContent = '+ עודף תקציבי';
      this.metricNetStatus.style.color = 'var(--neon-cyan)';
    } else if (status.net < 0) {
      this.metricNetValue.textContent = `-₪${Math.abs(status.net).toLocaleString()}`;
      this.metricNetValue.style.color = 'var(--neon-red)';
      this.metricNetStatus.textContent = '- גירעון';
      this.metricNetStatus.style.color = 'var(--neon-red)';
    } else {
      this.metricNetValue.textContent = '₪0';
      this.metricNetValue.style.color = '#ffffff';
      this.metricNetStatus.textContent = 'מאוזן בדיוק';
      this.metricNetStatus.style.color = 'var(--text-dim)';
    }

    this.metricCapTitle.textContent = `יעד תקרה (${status.rangeLabel || 'תקופה'})`;
    this.metricCapValue.textContent = `₪${status.cap.toLocaleString()}`;

    const remPercent = Math.max(0, 100 - status.percent);
    if (status.status === 'danger') {
      this.metricCapAlert.textContent = '0% נותרו • חריגה!';
      this.metricCapAlert.style.color = 'var(--neon-red)';
    } else if (status.status === 'warning') {
      this.metricCapAlert.textContent = `${remPercent.toFixed(0)}% נותרו • שים לב!`;
      this.metricCapAlert.style.color = 'var(--neon-amber)';
    } else {
      this.metricCapAlert.textContent = `${remPercent.toFixed(0)}% נותרו לבזבוז`;
      this.metricCapAlert.style.color = 'var(--neon-green)';
    }
  }

  private updateAlertBanner(status: BudgetStatus): void {
    if (this.alertDismissed) {
      this.alertBanner.style.display = 'none';
      return;
    }

    const periodName = status.rangeLabel || 'הנוכחית';

    if (status.status === 'danger') {
      this.alertBanner.className = 'alert-banner danger';
      this.alertIcon.textContent = '🚨';
      this.alertTitle.textContent = `התראת חריגה מתקרה (${periodName})!`;
      this.alertDesc.textContent = `הוצאת ₪${status.spent.toLocaleString()} מתוך תקרה של ₪${status.cap.toLocaleString()} (חריגה של ₪${Math.abs(status.remaining).toLocaleString()}).`;
      this.alertBanner.style.display = 'flex';
      playMarioGameOver();
    } else if (status.status === 'warning') {
      this.alertBanner.className = 'alert-banner warning';
      this.alertIcon.textContent = '⚠️';
      this.alertTitle.textContent = `שים לב: מתקרב לתקרה (${periodName})!`;
      this.alertDesc.textContent = `ניצלת ${status.percent.toFixed(1)}% מהתקרה. נותרו רק ₪${status.remaining.toLocaleString()} להוצאה.`;
      this.alertBanner.style.display = 'flex';
      playMarioWarning();
    } else {
      // Check if any individual category cap has been exceeded
      const catCaps = this.settings.caps.categoryCaps || {};
      const periodTxs = this.getFilteredTransactions();
      const exceededCategories: { name: string; spent: number; cap: number }[] = [];

      for (const [catId, caps] of Object.entries(catCaps)) {
        let capForPeriod = 0;
        if (this.currentPeriod === 'daily') capForPeriod = caps?.daily || 0;
        else if (this.currentPeriod === 'weekly') capForPeriod = caps?.weekly || 0;
        else if (this.currentPeriod === 'monthly') capForPeriod = caps?.monthly || 0;

        if (capForPeriod > 0) {
          const catSpent = periodTxs
            .filter(t => t.type === 'expense' && t.category === catId)
            .reduce((sum, t) => sum + t.amount, 0);

          if (catSpent > capForPeriod) {
            const info = getCategoryById(catId);
            exceededCategories.push({ name: info.name, spent: catSpent, cap: capForPeriod });
          }
        }
      }

      if (exceededCategories.length > 0) {
        this.alertBanner.className = 'alert-banner warning';
        this.alertIcon.textContent = '⚠️';
        this.alertTitle.textContent = `חריגה בתקרת קטגוריה (${periodName})!`;
        this.alertDesc.textContent = exceededCategories
          .map(c => `${c.name}: הוצאת ₪${c.spent.toLocaleString()} מתוך תקרה של ₪${c.cap.toLocaleString()}`)
          .join(' • ');
        this.alertBanner.style.display = 'flex';
        playMarioWarning();
      } else {
        this.alertBanner.style.display = 'none';
      }
    }
  }

  private renderTransactionsList(): void {
    const allFiltered = this.getFilteredTransactions();
    const expCount = allFiltered.filter(t => t.type === 'expense').length;
    const incCount = allFiltered.filter(t => t.type === 'income').length;
    const allCount = allFiltered.length;

    if (this.tabCountAll) this.tabCountAll.textContent = allCount.toString();
    if (this.tabCountExpense) this.tabCountExpense.textContent = expCount.toString();
    if (this.tabCountIncome) this.tabCountIncome.textContent = incCount.toString();

    let list = allFiltered;
    if (this.activeTxFilter !== 'all') {
      list = list.filter(t => t.type === this.activeTxFilter);
    }

    // Identify categories that exceed their active cap
    const breachedCatIds = new Set<string>();
    const catCaps = this.settings.caps.categoryCaps || {};
    for (const [catId, caps] of Object.entries(catCaps)) {
      let capForPeriod = 0;
      if (this.currentPeriod === 'daily') capForPeriod = caps?.daily || 0;
      else if (this.currentPeriod === 'weekly') capForPeriod = caps?.weekly || 0;
      else if (this.currentPeriod === 'monthly') capForPeriod = caps?.monthly || 0;

      if (capForPeriod > 0) {
        const catSpent = allFiltered
          .filter(t => t.type === 'expense' && t.category === catId)
          .reduce((sum, t) => sum + t.amount, 0);

        if (catSpent > capForPeriod) {
          breachedCatIds.add(catId);
        }
      }
    }

    if (list.length === 0) {
      this.transactionsListEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📂</div>
          <div>אין תנועות להצגה בטווח התאריכים הנבחר</div>
          <div style="font-size: 0.8rem; margin-top: 0.4rem; color: var(--text-dim);">
            בחר טווח אחר או לחץ על "תנועה חדשה"
          </div>
        </div>
      `;
      return;
    }

    this.transactionsListEl.innerHTML = list
      .map(tx => {
        const cat = getCategoryById(tx.category);
        const isExp = tx.type === 'expense';
        const isBreached = isExp && breachedCatIds.has(tx.category);
        const d = new Date(tx.date);
        const dayFormatted = String(d.getDate()).padStart(2, '0');
        const monthFormatted = String(d.getMonth() + 1).padStart(2, '0');
        const yearFormatted = d.getFullYear();
        const timeFormatted = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        const formattedDate = `${dayFormatted}/${monthFormatted}/${yearFormatted} • ${timeFormatted}`;

        return `
          <div class="transaction-item ${isBreached ? 'cat-breach' : ''}" data-id="${tx.id}">
            <div class="tx-main-info">
              <div class="tx-cat-icon" style="background: ${cat.color}22; border: 1px solid ${cat.color}55;">
                <span>${cat.icon}</span>
              </div>
              <div class="tx-details">
                <span class="tx-title">
                  <span>${tx.note || cat.name}</span>
                  ${isBreached ? '<span class="tx-breach-badge">חריגה בקטגוריה</span>' : ''}
                </span>
                <span class="tx-meta">
                  <span>${cat.name}</span>
                  <span>•</span>
                  <span>${formattedDate}</span>
                </span>
              </div>
            </div>
            <div class="tx-amount-side">
              <div class="tx-amount ${isExp ? 'expense' : 'income'}">
                ${isExp ? '-' : '+'}${tx.amount.toLocaleString()}
              </div>
              <button class="tx-delete-btn" data-delete-id="${tx.id}" title="מחק תנועה" aria-label="מחק">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    const deleteBtns = this.transactionsListEl.querySelectorAll<HTMLButtonElement>('.tx-delete-btn');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.deleteId;
        if (id) {
          this.deleteTransaction(id);
        }
      });
    });
  }

  // ==========================================================================
  // Pulse Nuggets (Smart Insights Card - Phase 1)
  // ==========================================================================

  private renderPulseNuggets(): void {
    if (!this.pulseNuggetsSection || !this.pulseNuggetsCard) return;

    this.currentNuggets = generatePulseNuggets(
      this.transactions,
      this.settings.caps,
      this.currentPeriod
    );

    if (this.currentNuggets.length === 0) {
      this.pulseNuggetsSection.style.display = 'none';
      return;
    }

    this.pulseNuggetsSection.style.display = 'block';

    if (this.currentNuggetIndex >= this.currentNuggets.length) {
      this.currentNuggetIndex = 0;
    }

    this.displayActiveNugget(false);
    this.renderNuggetDots();
    this.restartNuggetAutoTimer();
  }

  private displayActiveNugget(animate: boolean = true): void {
    if (!this.currentNuggets || this.currentNuggets.length === 0) return;
    const nugget = this.currentNuggets[this.currentNuggetIndex];
    if (!nugget) return;

    const updateDOM = () => {
      if (this.nuggetEmoji) this.nuggetEmoji.textContent = nugget.emoji;
      if (this.nuggetTitle) this.nuggetTitle.textContent = nugget.title;
      if (this.nuggetText) this.nuggetText.textContent = nugget.body;

      if (this.nuggetHighlight) {
        if (nugget.highlightMetric) {
          this.nuggetHighlight.textContent = nugget.highlightMetric;
          this.nuggetHighlight.style.display = 'inline-block';
        } else {
          this.nuggetHighlight.style.display = 'none';
        }
      }

      if (this.nuggetsCounter) {
        this.nuggetsCounter.textContent = `${this.currentNuggetIndex + 1}/${this.currentNuggets.length}`;
      }

      if (this.pulseNuggetsCard) {
        this.pulseNuggetsCard.classList.remove('tone-positive', 'tone-warning', 'tone-neutral');
        this.pulseNuggetsCard.classList.add(`tone-${nugget.tone}`);
      }

      const dots = this.nuggetsDots?.querySelectorAll('.nugget-dot');
      dots?.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === this.currentNuggetIndex);
      });
    };

    if (animate && this.nuggetsBody) {
      this.nuggetsBody.classList.remove('fade-in');
      this.nuggetsBody.classList.add('fade-out');
      setTimeout(() => {
        updateDOM();
        if (this.nuggetsBody) {
          this.nuggetsBody.classList.remove('fade-out');
          this.nuggetsBody.classList.add('fade-in');
        }
      }, 150);
    } else {
      updateDOM();
    }
  }

  private renderNuggetDots(): void {
    if (!this.nuggetsDots) return;
    this.nuggetsDots.innerHTML = '';
    this.currentNuggets.forEach((_, idx) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `nugget-dot ${idx === this.currentNuggetIndex ? 'active' : ''}`;
      dot.setAttribute('aria-label', `תובנה ${idx + 1}`);
      dot.addEventListener('click', () => {
        this.currentNuggetIndex = idx;
        this.displayActiveNugget(true);
        this.restartNuggetAutoTimer();
      });
      this.nuggetsDots?.appendChild(dot);
    });
  }

  private nextNugget(): void {
    if (this.currentNuggets.length <= 1) return;
    this.currentNuggetIndex = (this.currentNuggetIndex + 1) % this.currentNuggets.length;
    this.displayActiveNugget(true);
    this.restartNuggetAutoTimer();
  }

  private prevNugget(): void {
    if (this.currentNuggets.length <= 1) return;
    this.currentNuggetIndex = (this.currentNuggetIndex - 1 + this.currentNuggets.length) % this.currentNuggets.length;
    this.displayActiveNugget(true);
    this.restartNuggetAutoTimer();
  }

  private restartNuggetAutoTimer(): void {
    if (this.nuggetAutoTimer) {
      clearInterval(this.nuggetAutoTimer);
      this.nuggetAutoTimer = null;
    }
    if (this.currentNuggets.length > 1) {
      this.nuggetAutoTimer = window.setInterval(() => {
        this.nextNugget();
      }, 8000);
    }
  }

  private setupPulseNuggetsEvents(): void {
    this.nuggetPrevBtn?.addEventListener('click', () => this.prevNugget());
    this.nuggetNextBtn?.addEventListener('click', () => this.nextNugget());

    this.pulseNuggetsCard?.addEventListener('mouseenter', () => {
      if (this.nuggetAutoTimer) {
        clearInterval(this.nuggetAutoTimer);
        this.nuggetAutoTimer = null;
      }
    });

    this.pulseNuggetsCard?.addEventListener('mouseleave', () => {
      this.restartNuggetAutoTimer();
    });

    // Touch Swipe gestures for flawless mobile UX
    this.pulseNuggetsCard?.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) {
        this.touchStartX = e.touches[0].clientX;
      }
      if (this.nuggetAutoTimer) {
        clearInterval(this.nuggetAutoTimer);
        this.nuggetAutoTimer = null;
      }
    }, { passive: true });

    this.pulseNuggetsCard?.addEventListener('touchend', (e: TouchEvent) => {
      if (e.changedTouches && e.changedTouches.length > 0) {
        this.touchEndX = e.changedTouches[0].clientX;
        this.handleNuggetSwipe();
      }
      this.restartNuggetAutoTimer();
    }, { passive: true });

    // Tap on nugget content jumps to relevant timeframe if available
    this.nuggetsBody?.addEventListener('click', (e: MouseEvent) => {
      // Don't trigger if clicked on controls
      if ((e.target as HTMLElement).closest('.nuggets-nav-controls') || (e.target as HTMLElement).closest('.nuggets-dots-container')) return;
      const nugget = this.currentNuggets[this.currentNuggetIndex];
      if (nugget && nugget.actionPeriod && nugget.actionPeriod !== this.currentPeriod) {
        this.switchPeriod(nugget.actionPeriod);
      }
    });
  }

  private handleNuggetSwipe(): void {
    const swipeDistance = this.touchEndX - this.touchStartX;
    const minSwipe = 35; // 35px threshold

    // In RTL:
    // Swiping right (positive) = previous nugget
    // Swiping left (negative) = next nugget
    if (swipeDistance > minSwipe) {
      this.prevNugget();
    } else if (swipeDistance < -minSwipe) {
      this.nextNugget();
    }
  }

  // ==========================================================================
  // Phase 2: Pulse Lab (מעבדת הדופק - Deep BI & Analytics Hub)
  // ==========================================================================

  public openPulseLab(): void {
    this.closeUserDropdown();
    this.closeNotificationsDropdown();
    playMarioJump();

    if (this.pulseLabPeriodSubtitle) {
      const now = new Date();
      const hebrewMonth = now.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
      this.pulseLabPeriodSubtitle.textContent = `אנליטיקה וחוכמת תקציב לחודש ${hebrewMonth}`;
    }

    this.pulseLabModal?.classList.add('open');
    this.renderPulseLab();
  }

  public closePulseLab(): void {
    this.pulseLabModal?.classList.remove('open');
  }

  private setupPulseLabEvents(): void {
    this.openPulseLabBtn?.addEventListener('click', () => this.openPulseLab());
    this.nuggetsToLabBtn?.addEventListener('click', () => this.openPulseLab());
    this.closePulseLabBtn?.addEventListener('click', () => this.closePulseLab());

    // Safe Spend Simulator Slider
    this.simTargetSavingsInput?.addEventListener('input', () => {
      this.updateSimulator();
    });
  }

  private renderPulseLab(): void {
    if (!this.pulseLabModal || !this.pulseLabModal.classList.contains('open')) return;

    this.currentLabMetrics = computePulseLabMetrics(this.transactions, this.settings.caps);
    const m = this.currentLabMetrics;

    // 1. KPI Cards
    // Card 1: Forecast
    if (this.labForecastValue && this.labForecastSub) {
      if (m.monthlyCap > 0) {
        if (m.expectedSurplusOrDeficit >= 0) {
          this.labForecastValue.textContent = `+₪${m.expectedSurplusOrDeficit.toLocaleString()}`;
          this.labForecastValue.style.color = 'var(--neon-cyan)';
          this.labForecastSub.textContent = 'צפי לסגירת החודש בעודף מעולה 💪';
        } else {
          this.labForecastValue.textContent = `-₪${Math.abs(m.expectedSurplusOrDeficit).toLocaleString()}`;
          this.labForecastValue.style.color = 'var(--neon-red)';
          this.labForecastSub.textContent = m.breachDayOfMonth
            ? `חריגה צפויה סביב ה-${m.breachDayOfMonth} לחודש 🛑`
            : 'צפי חריגה מהתקרה החודשית';
        }
      } else {
        this.labForecastValue.textContent = `₪${m.projectedMonthEndSpend.toLocaleString()}`;
        this.labForecastValue.style.color = '#ffffff';
        this.labForecastSub.textContent = 'צפי סך הוצאות (ללא תקרה חודשית)';
      }
    }

    // Card 2: Savings / Cash Kept
    if (this.labSavingsValue && this.labSavingsSub) {
      this.labSavingsValue.textContent = `${m.savingsRate}%`;
      this.labSavingsValue.style.color = m.savingsRate >= 20 ? 'var(--neon-green)' : (m.savingsRate > 0 ? 'var(--neon-amber)' : 'var(--text-muted)');
      this.labSavingsSub.textContent = m.netCashFlow >= 0
        ? `מאזן נטו חיובי: +₪${m.netCashFlow.toLocaleString()}`
        : `גרעון תזרימי: -₪${Math.abs(m.netCashFlow).toLocaleString()}`;
    }

    // Card 3: Peak Day
    if (this.labPeakDayValue && this.labPeakDaySub) {
      this.labPeakDayValue.textContent = m.peakDayName;
      this.labPeakDayValue.style.color = m.peakDayAvg > 0 ? 'var(--neon-orange)' : '#ffffff';
      this.labPeakDaySub.textContent = m.peakDayAvg > 0
        ? `ממוצע של ₪${m.peakDayAvg.toLocaleString()} ליום זה`
        : 'אין עדיין מספיק נתונים';
    }

    // Card 4: Daily Burn Rate
    if (this.labBurnValue && this.labBurnSub) {
      this.labBurnValue.textContent = `₪${m.dailyAvgSpend.toLocaleString()}/יום`;
      const dailyCap = this.settings.caps.daily || Math.round(m.monthlyCap / 30);
      this.labBurnSub.textContent = dailyCap > 0
        ? `מול תקרה יומית של ₪${dailyCap.toLocaleString()}`
        : 'ללא תקרה יומית מוגדרת';
    }

    // 2. Weekly Vibe Heatmap
    if (this.labHeatmapGrid) {
      this.labHeatmapGrid.innerHTML = m.heatmapDays.map(day => {
        const intensityPct = Math.round(day.intensity * 100);
        let color = '#00f5d4';
        if (day.intensity >= 0.75) {
          color = '#ef4444';
        } else if (day.intensity >= 0.45) {
          color = '#f59e0b';
        }

        return `
          <div class="heatmap-day-box ${day.isPeak ? 'peak' : ''}" title="${day.name}: סך הכל ₪${day.totalAmount.toLocaleString()} (${day.count} תנועות)">
            <span class="heatmap-day-name">${day.shortName}</span>
            <span class="heatmap-day-amount" style="color: ${day.avgAmount > 0 ? color : 'var(--text-dim)'};">
              ₪${day.avgAmount > 0 ? day.avgAmount.toLocaleString() : '0'}
            </span>
            <div class="heatmap-intensity-bar">
              <div class="heatmap-intensity-fill" style="width: ${intensityPct}%; background: ${color};"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // 3. Top Category Eaters
    if (this.labCategoriesList) {
      if (m.topCategories.length === 0) {
        this.labCategoriesList.innerHTML = `
          <div class="empty-state" style="padding: 1rem;">
            <div style="font-size: 0.85rem; color: var(--text-muted);">אין עדיין הוצאות שנרשמו החודש בקטגוריות</div>
          </div>
        `;
      } else {
        this.labCategoriesList.innerHTML = m.topCategories.map(cat => {
          let barColor = cat.color || '#00f5d4';
          if (cat.isBreached) {
            barColor = '#ef4444';
          }
          return `
            <div class="lab-cat-row">
              <div class="lab-cat-icon-wrap" style="background: ${cat.color}22; border: 1px solid ${cat.color}44;">
                <span>${cat.icon}</span>
              </div>
              <div class="lab-cat-details">
                <div class="lab-cat-info-top">
                  <span class="lab-cat-name">${cat.name} ${cat.isBreached ? '<span style="color: #ef4444; font-size: 0.75rem; font-weight: bold;">(חריגה!)</span>' : ''}</span>
                  <span class="lab-cat-amt">₪${cat.amount.toLocaleString()} <span style="font-size: 0.76rem; color: var(--text-dim); font-weight: normal;">(${cat.percent}%)</span></span>
                </div>
                <div class="lab-cat-progress-bg">
                  <div class="lab-cat-progress-fill" style="width: ${cat.percent}%; background: ${barColor};"></div>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 4. Top Places & Merchants
    if (this.labMerchantsList) {
      if (m.topMerchants.length === 0) {
        this.labMerchantsList.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1; padding: 1rem;">
            <div style="font-size: 0.85rem; color: var(--text-muted);">
              רשום שמות בתי עסק בשדה ההערה (למשל: סופר, וולט, זארה) כדי לראות כאן את המקומות המובילים שלך 📍
            </div>
          </div>
        `;
      } else {
        this.labMerchantsList.innerHTML = m.topMerchants.map(merch => `
          <div class="lab-merchant-chip">
            <span class="lab-merch-name">📍 ${merch.name}</span>
            <div class="lab-merch-right">
              <div class="lab-merch-amt">₪${merch.amount.toLocaleString()}</div>
              <div class="lab-merch-count">${merch.count} רכישות</div>
            </div>
          </div>
        `).join('');
      }
    }

    // 5. Simulator Setup
    if (this.simTargetSavingsInput && m.monthlyCap > 0) {
      const maxSavings = Math.max(1500, Math.round(m.monthlyCap * 0.5));
      this.simTargetSavingsInput.max = String(maxSavings);
      if (Number(this.simTargetSavingsInput.value) > maxSavings) {
        this.simTargetSavingsInput.value = String(Math.round(maxSavings * 0.3));
      }
    }

    this.updateSimulator();
  }

  private updateSimulator(): void {
    if (!this.currentLabMetrics || !this.simTargetSavingsInput) return;
    const m = this.currentLabMetrics;
    const targetSavings = Number(this.simTargetSavingsInput.value) || 0;

    if (this.simTargetVal) {
      this.simTargetVal.textContent = `₪${targetSavings.toLocaleString()}`;
    }

    if (this.simDaysRemainingText) {
      this.simDaysRemainingText.textContent = `ב-${m.daysRemaining} הימים שנשארו לחודש:`;
    }

    // Calculate allowance:
    const remainingBudget = Math.max(0, m.monthlyCap - m.monthSpent);
    const availableForSpend = remainingBudget - targetSavings;
    const dailyAllowance = m.daysRemaining > 0
      ? Math.max(0, Math.floor(availableForSpend / m.daysRemaining))
      : 0;

    if (this.simDailyAllowanceVal) {
      this.simDailyAllowanceVal.textContent = `₪${dailyAllowance.toLocaleString()}`;
    }

    if (this.simResultTip) {
      if (dailyAllowance >= 150) {
        this.simResultTip.textContent = 'תקציב מרווח ומאוזן — שמור עליו ותסגור את החודש כמלך 👑';
        this.simResultTip.style.color = 'var(--neon-green)';
      } else if (dailyAllowance >= 60) {
        this.simResultTip.textContent = 'תקציב סביר שדורש קצת תשומת לב — שים עין על יציאות וקניות 🎯';
        this.simResultTip.style.color = 'var(--neon-cyan)';
      } else if (dailyAllowance > 0) {
        this.simResultTip.textContent = 'תקציב הדוק מאוד! שווה להסתפק ביעד חיסכון קצת יותר צנוע החודש 🧗';
        this.simResultTip.style.color = 'var(--neon-amber)';
      } else {
        this.simResultTip.textContent = 'ההוצאות עד כה לא מאפשרות להגיע ליעד זה בחודש הנוכחי 🛑';
        this.simResultTip.style.color = 'var(--neon-red)';
      }
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new PulseBudgetApp();
});
