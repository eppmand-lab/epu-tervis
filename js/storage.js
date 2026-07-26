// Kogu rakenduse andmepüsivus localStorage'is.
const Storage = {
  KEYS: {
    PROFILE: 'fitness_profile',
    FOOD_LOG: 'fitness_food_log',
    RECIPES: 'fitness_recipes',
    WORKOUTS: 'fitness_workouts',
    MEASUREMENTS: 'fitness_measurements',
    CYCLE: 'fitness_cycle',
    WATER: 'fitness_water',
    STEPS: 'fitness_steps',
    PHOTOS: 'fitness_photos',
    WEEKLY: 'fitness_weekly_analysis',
    GYM_SESSIONS: 'fitness_gym_sessions',
    FINANCE_PLANS: 'fitness_finance_plans',
    FINANCE_TRANSACTIONS: 'fitness_finance_transactions',
    FINANCE_RECURRING: 'fitness_finance_recurring',
    FINANCE_GOALS: 'fitness_finance_goals',
    FINANCE_MONTH_SUMMARY: 'fitness_finance_month_summary',
  },

  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (e) {
      console.error('Storage.get error', key, e);
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      if (window.CloudSync && CloudSync.ready && !CloudSync.applyingRemote) {
        CloudSync.queue(key === this.KEYS.PHOTOS);
      }
      return true;
    } catch (e) {
      console.error('Storage.set error', key, e);
      if (e && e.name === 'QuotaExceededError') {
        UI.toast('Salvestusruum on täis. Kustuta mõni vana foto, et jätkata.');
      }
      return false;
    }
  },

  defaultProfile() {
    return {
      age: 35,
      gender: 'female',
      weight: 73.3,
      height: 176,
      activity: 'moderate',
      bodyFat: 28.8,
      cycleLength: 28,
      macros: { kcal: 1972, protein: 147, fat: 55, carbs: 222 },
      waterTarget: 2500,
      anthropicApiKey: '',
    };
  },

  getProfile() {
    const stored = this.get(this.KEYS.PROFILE, null);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
      const def = this.defaultProfile();
      this.set(this.KEYS.PROFILE, def);
      return def;
    }
    // Täienda puuduvad väljad vaikeväärtustega (nt. rakenduse esimene korras avamine).
    const defaults = this.defaultProfile();
    return {
      ...defaults,
      ...stored,
      macros: {
        ...defaults.macros,
        ...(stored.macros && typeof stored.macros === 'object' ? stored.macros : {}),
      },
    };
  },

  saveProfile(profile) {
    this.set(this.KEYS.PROFILE, profile);
  },
};

const UI = {
  toast(message, duration = 2600) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
  },
};
