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
      exportAllUsed: false,
      exportSingleUsed: false,
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
  }

  async _save(patch) {
    this.state = { ...this.state, ...patch };
    await this.storage.set(this.state);
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

  canExportAllXLSX() {
    return this.isPremium() || !this.state.exportAllUsed;
  }

  async markExportAllXLSX() {
    if (this.isPremium()) return;
    if (!this.state.exportAllUsed) await this._save({ exportAllUsed: true });
  }

  canExportSingleXLSX() {
    return this.isPremium() || !this.state.exportSingleUsed;
  }

  async markExportSingleXLSX() {
    if (this.isPremium()) return;
    if (!this.state.exportSingleUsed) await this._save({ exportSingleUsed: true });
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
      extract: `${this.state.extractCount}/15`,
      exportAll: this.state.exportAllUsed ? 'Used' : 'Available',
      exportSingle: this.state.exportSingleUsed ? 'Used' : 'Available',
      workspaces: `${this.state.savedWorkspaceCount}/1`
    };
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
