const SheetsSync = {
  enabled: false,
  config: null,
  _debounce: null,
  _pollTimer: null,
  _pushing: false,
  _patched: false,
  _lastLocalAt: null,
  _lastRemoteAt: null,
  SETTINGS_KEY: "camping_sheets_settings",
  POLL_MS: 20000,

  loadConfig() {
    try {
      const saved = localStorage.getItem(this.SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.webAppUrl && parsed.syncToken) return parsed;
      }
    } catch {
      /* ignore */
    }
    const cfg = window.SHEETS_CONFIG;
    if (cfg?.webAppUrl && cfg?.syncToken) return cfg;
    return null;
  },

  isConfigured() {
    const c = this.loadConfig();
    return !!(c && c.webAppUrl && c.syncToken);
  },

  saveConfig(webAppUrl, syncToken) {
    const config = {
      webAppUrl: webAppUrl.trim().replace(/\/$/, ""),
      syncToken: syncToken.trim(),
    };
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(config));
    this.config = config;
    this.enabled = true;
  },

  clearConfig() {
    localStorage.removeItem(this.SETTINGS_KEY);
    this.config = null;
    this.enabled = false;
    this._patched = false;
    this.stopPolling();
    this.setStatus("로컬 저장", "muted");
  },

  apiUrl() {
    const token = encodeURIComponent(this.config.syncToken);
    return `${this.config.webAppUrl}?token=${token}`;
  },

  async bootstrap() {
    Storage.init();
    this.config = this.loadConfig();

    if (!this.config) {
      this.setStatus("로컬 저장", "muted");
      return false;
    }

    this.enabled = true;
    if (!this._patched) {
      this.patchStorage();
      this._patched = true;
    }

    this.setStatus("동기화 중…", "syncing");
    await this.pull(true);
    await this.uploadIfEmpty();
    this.startPolling();
    this.setStatus("시트 동기화", "ok");
    return true;
  },

  async reconnect() {
    this.stopPolling();
    this._patched = false;
    return this.bootstrap();
  },

  patchStorage() {
    const bind = (method) => {
      const original = Storage[method].bind(Storage);
      Storage[method] = (list) => {
        original(list);
        this.schedulePush();
      };
    };
    bind("saveSiteTypes");
    bind("saveSites");
    bind("saveCategories");
    bind("saveProducts");
    bind("saveReservations");
    bind("saveSales");
  },

  schedulePush() {
    if (!this.enabled || this._pushing) return;
    clearTimeout(this._debounce);
    this._debounce = setTimeout(() => this.push(), 800);
  },

  async push() {
    if (!this.enabled || !this.config) return;
    const data = Storage.exportAll();
    data.exportedAt = new Date().toISOString();
    this._pushing = true;
    try {
      const res = await fetch(this.apiUrl(), {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      this._lastLocalAt = data.exportedAt;
      this._lastRemoteAt = data.exportedAt;
      this.setStatus("시트 동기화", "ok");
      this.updateLastSyncLabel(data.exportedAt);
    } catch (err) {
      console.error("Sheets push failed", err);
      this.setStatus("업로드 실패", "warn");
      showToast("시트 저장 실패 — 로컬에는 저장됨");
    } finally {
      this._pushing = false;
    }
  },

  async pull(silent) {
    if (!this.enabled || !this.config || this._pushing) return false;
    try {
      const res = await fetch(this.apiUrl(), { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data || !data.exportedAt) return false;
      if (data.exportedAt === this._lastRemoteAt) return false;
      if (this._lastLocalAt && data.exportedAt <= this._lastLocalAt) {
        this._lastRemoteAt = data.exportedAt;
        return false;
      }

      this._pushing = true;
      Storage.importAll(data);
      this._lastRemoteAt = data.exportedAt;
      this._pushing = false;
      this.updateLastSyncLabel(data.exportedAt);
      this.setStatus("시트 동기화", "ok");
      if (!silent) showToast("시트 데이터를 불러왔습니다.");
      this.notifyUI();
      return true;
    } catch (err) {
      console.error("Sheets pull failed", err);
      if (!silent) this.setStatus("불러오기 실패", "warn");
      return false;
    }
  },

  async uploadIfEmpty() {
    try {
      const res = await fetch(this.apiUrl(), { redirect: "follow" });
      if (res.ok) {
        const data = await res.json();
        if (data.reservations?.length || data.sites?.length) return;
      }
    } catch {
      /* treat as empty */
    }

    const localRes = Storage.getReservations();
    const localSites = Storage.getSites();
    if (!localRes.length && !localSites.length) return;

    if (!confirm("시트가 비어 있습니다.\n이 기기의 데이터를 Google 시트에 업로드할까요?")) {
      return;
    }
    await this.push();
    showToast("시트에 업로드했습니다.");
  },

  _onVisible: null,

  startPolling() {
    this.stopPolling();
    this._onVisible = () => {
      if (document.visibilityState === "visible") this.pull(true);
    };
    this._pollTimer = setInterval(() => this.pull(true), this.POLL_MS);
    document.addEventListener("visibilitychange", this._onVisible);
  },

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    if (this._onVisible) {
      document.removeEventListener("visibilitychange", this._onVisible);
      this._onVisible = null;
    }
  },

  notifyUI() {
    window.dispatchEvent(new CustomEvent("camping-data-sync"));
    if (typeof App !== "undefined" && App.onDataSync) App.onDataSync();
    if (typeof MobileApp !== "undefined" && MobileApp.onDataSync) MobileApp.onDataSync();
  },

  setStatus(text, tone) {
    const el = document.getElementById("syncStatus");
    if (!el) return;
    el.textContent = text;
    el.dataset.tone = tone || "muted";
  },

  updateLastSyncLabel(iso) {
    const el = document.getElementById("sheetsLastSync");
    if (!el || !iso) return;
    const d = new Date(iso);
    el.textContent = Number.isNaN(d.getTime())
      ? ""
      : `마지막 동기화: ${d.toLocaleString("ko-KR")}`;
  },

  bindSettingsForm() {
    const form = document.getElementById("sheetsSettingsForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    const cfg = this.loadConfig();
    if (cfg) {
      form.webAppUrl.value = cfg.webAppUrl;
      form.syncToken.value = cfg.syncToken;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const webAppUrl = form.webAppUrl.value.trim();
      const syncToken = form.syncToken.value.trim();
      if (!webAppUrl || !syncToken) {
        showToast("웹 앱 URL과 동기화 토큰을 입력하세요.");
        return;
      }
      this.saveConfig(webAppUrl, syncToken);
      await this.reconnect();
      showToast("Google 시트 동기화가 연결되었습니다.");
      document.getElementById("syncSettingsModal")?.close();
      if (typeof App !== "undefined") App.updateSheetsSettings();
    });

    document.getElementById("btnSheetsPull")?.addEventListener("click", () => this.pull(false));
    document.getElementById("btnSheetsPush")?.addEventListener("click", () => this.push());
    document.getElementById("btnSheetsDisconnect")?.addEventListener("click", () => {
      if (!confirm("Google 시트 연결을 해제할까요?")) return;
      this.clearConfig();
      if (typeof App !== "undefined") App.updateSheetsSettings();
      showToast("동기화 연결이 해제되었습니다.");
    });
  },
};

document.addEventListener("DOMContentLoaded", () => SheetsSync.bindSettingsForm());
