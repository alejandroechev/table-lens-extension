// License and feature gating logic for TableLens
// Handles free vs premium limits and license verification
// Persistence strategy: chrome.storage.sync (primary), localStorage (secondary), in-memory fallback.
// NOTE: Truly preventing reset on uninstall requires a backend; this module prepares for future remote sync.

const SUBSCRIPTION_URL = 'https://alejandroechev.gumroad.com/l/tablelens';
const GUMROAD_VERIFY_ENDPOINT = 'https://api.gumroad.com/v2/licenses/verify';
const PRODUCT_ID = 't3W-nhAkaVOqR2Wv4cdEWg==';

class LicenseManager {
  constructor(env = {}) {
    this.storage = null;
    this.cache = {};
    this.env = env; // allow injection for tests
    this.defaults = {
      extractMonth: null,
      extractCount: 0,
      exportAllCount: 0,
      exportSingleCount: 0,
      savedWorkspaceCount: 0,
      licenseKey: null,
      licenseValid: false,
      licenseType: 'free',
      lastVerify: 0
    };
    this.state = { ...this.defaults };
  }

  async init() {
    await this._initStorage();
    await this._load();
    this._enforceMonthlyWindow();
    return this.state;
  }

  async _initStorage() {
    // chrome.storage.sync preferred
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      this.storage = {
        get: (keys) => new Promise(res => chrome.storage.sync.get(keys, res)),
        set: (obj) => new Promise(res => chrome.storage.sync.set(obj, res))
      };
      return;
    }
    // fallback localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        this.storage = {
          get: async () => JSON.parse(localStorage.getItem('tableLens_license') || '{}'),
          set: async (obj) => localStorage.setItem('tableLens_license', JSON.stringify({ ...(await this.storage.get()), ...obj }))
        };
        return;
      }
    } catch (_) { /* ignore */ }
    // memory fallback
    const mem = {};
    this.storage = {
      get: async () => mem,
      set: async (obj) => Object.assign(mem, obj)
    };
  }

  async _load() {
    const stored = await this.storage.get(null);
    this.state = { ...this.defaults, ...stored };
    
    // Migration: Convert legacy boolean flags to counters (run on every load)
    let needsSave = false;
    if (typeof this.state.exportAllUsed === 'boolean') {
      this.state.exportAllCount = this.state.exportAllUsed ? 1 : 0;
      delete this.state.exportAllUsed;
      needsSave = true;
    }
    if (typeof this.state.exportSingleUsed === 'boolean') {
      this.state.exportSingleCount = this.state.exportSingleUsed ? 1 : 0;
      delete this.state.exportSingleUsed;
      needsSave = true;
    }
    
    // Save migrated state immediately if needed
    if (needsSave) {
      await this.storage.set(this.state);
    }
  }

  async _save(patch) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...patch };
    try {
      await this.storage.set(this.state);
    } catch (error) {
      throw error;
    }
    return this.state;
  }

  _currentMonthKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2,'0')}`;
  }

  _enforceMonthlyWindow() {
    const mk = this._currentMonthKey();
    if (this.state.extractMonth !== mk) {
      this.state.extractMonth = mk;
      this.state.extractCount = 0;
      // Reset monthly export counters when month changes
      this.state.exportAllCount = 0;
      this.state.exportSingleCount = 0;
    }
  }

  isPremium() {
    return this.state.licenseValid && this.state.licenseType === 'premium';
  }

  getExtractUsage() {
    return { used: this.state.extractCount, max: this.isPremium() ? Infinity : 15 };
  }

  canExtractTables() {
    if (this.isPremium()) return true;
    const { used, max } = this.getExtractUsage();
    return used < max;
  }

  async recordExtraction(foundTables = 0) {
    if (foundTables <= 0) return this.state; // do not count empty runs
    if (this.isPremium()) return this.state; // unlimited
    if (!this.canExtractTables()) return this.state; // already capped
    await this._save({ extractCount: this.state.extractCount + 1, extractMonth: this._currentMonthKey() });
    return this.state;
  }

  _getMonthlyExportLimits() {
    return { all: 5, single: 2 }; // free limits per month
  }

  canExportAllXLSX() {
    if (this.isPremium()) return true;
    const { all } = this._getMonthlyExportLimits();
    return this.state.exportAllCount < all;
  }

  async markExportAllXLSX() {
    if (this.isPremium()) return;
    const { all } = this._getMonthlyExportLimits();
    if (this.state.exportAllCount >= all) return;
    await this._save({ exportAllCount: this.state.exportAllCount + 1, extractMonth: this._currentMonthKey() });
  }

  canExportSingleXLSX() {
    const isPremium = this.isPremium();
    const { single } = this._getMonthlyExportLimits();
    const canExport = isPremium || this.state.exportSingleCount < single;
    return canExport;
  }

  async markExportSingleXLSX() {
    const isPremium = this.isPremium();
    if (isPremium) {
      return;
    }
    const { single } = this._getMonthlyExportLimits();
    const currentCount = this.state.exportSingleCount;
    if (currentCount >= single) {
      return;
    }
    const newCount = currentCount + 1;
    const monthKey = this._currentMonthKey();
    await this._save({ exportSingleCount: newCount, extractMonth: monthKey });
  }

  canSaveAnotherWorkspace() {
    return this.isPremium() || this.state.savedWorkspaceCount < 1;
  }

  async incrementWorkspaceCount() {
    if (this.isPremium()) return;
    await this._save({ savedWorkspaceCount: Math.min(1, this.state.savedWorkspaceCount + 1) });
  }

  async decrementWorkspaceCount() {
    if (this.isPremium()) return;
    await this._save({ savedWorkspaceCount: Math.max(0, this.state.savedWorkspaceCount - 1) });
  }

  async setLicenseKey(key) {
    key = (key || '').trim();
    await this._save({ licenseKey: key, licenseValid: false, licenseType: 'free' });
  }

  async verifyLicense(force = false) {
    if (!this.state.licenseKey) return { valid: false };
    const now = Date.now();
    if (!force && now - this.state.lastVerify < 1000 * 60 * 10 && this.state.licenseValid) {
      return { valid: this.state.licenseValid, premium: this.isPremium() };
    }
    try {
      const body = new URLSearchParams({ product_id: PRODUCT_ID, license_key: this.state.licenseKey });
      const res = await fetch(GUMROAD_VERIFY_ENDPOINT, { method: 'POST', body });
      const json = await res.json();
      const valid = !!json?.success;
      const premium = valid; // All valid licenses treated as premium for now
      await this._save({ licenseValid: valid, licenseType: premium ? 'premium' : 'free', lastVerify: now });
      return { valid, premium };
    } catch (err) {
      console.error('License verify failed', err);
      return { valid: false, error: err.message };
    }
  }

  getDisplayStatus() {
    if (this.isPremium()) {
      return {
        plan: 'Premium',
        extract: 'Unlimited',
        exportAll: 'Unlimited',
        exportSingle: 'Unlimited',
        workspaces: 'Unlimited'
      };
    }
    return {
      plan: 'Free',
      extract: `${this.state.extractCount}/${this.getExtractUsage().max} per month`,
      exportAll: `${this.state.exportAllCount}/${this._getMonthlyExportLimits().all}  per month`,
      exportSingle: `${this.state.exportSingleCount}/${this._getMonthlyExportLimits().single}  per month`,
      workspaces: `${this.state.savedWorkspaceCount}/1`
    };
  }

  /**
   * Returns a Date object representing the UTC-agnostic local first day of the next month
   * used to reset the monthly quotas. We reset counters when the observed month key changes,
   * so effectively at local midnight on the 1st of next month.
   */
  getNextResetDate() {
    const now = new Date();
    // First day of next month
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    return nextMonth;
  }
}

// Singleton helper for runtime contexts
const licenseManager = new LicenseManager();

if (typeof module !== 'undefined') {
  module.exports = { LicenseManager, licenseManager, SUBSCRIPTION_URL };
}

// Expose to window for runtime (popup/table-viewer) environments without ESM exports
if (typeof window !== 'undefined') {
  // Avoid overwriting if already present
  if (!window.licenseManager) window.licenseManager = licenseManager;
  if (!window.LicenseManager) window.LicenseManager = LicenseManager;
  if (!window.TABLELENS_SUBSCRIPTION_URL) window.TABLELENS_SUBSCRIPTION_URL = SUBSCRIPTION_URL;
}
