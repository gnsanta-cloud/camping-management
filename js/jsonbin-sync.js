const JSONBinSync = {
  enabled: false,
  config: null,
  _debounce: null,
  _pollTimer: null,
  _pushing: false,
  _patched: false,
  _lastLocalAt: null,
  _lastRemoteAt: null,
  SETTINGS_KEY: "camping_jsonbin_settings",
  POLL_MS: 20000,

  loadConfig() {
    try {
      const saved = localStorage.getItem(this.SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.binId && parsed.accessKey) return parsed;
      }
    } catch {
      /* ignore */
    }
    const cfg = window.JSONBIN_CONFIG;
    if (cfg?.binId && cfg?.accessKey) return cfg;
    return null;
  },

  isConfigured() {
    const c = this.loadConfig();
    return !!(c && c.binId && c.accessKey);
  },

  saveConfig(binId, accessKey) {
    const config = { binId: binId.trim(), accessKey: accessKey.trim() };
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(config));
    this.config = config;
    this.enabled = true;
  },

  clearConfig() {
    localStorage.removeItem(this.SETTINGS_KEY);
    this.config = null;
    this.enabled = false;
    this._patched = false;
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this.setStatus("로컬 저장", "muted");
  },

  headers() {
    return {
      "Content-Type": "application/json",
      "X-Access-Key": this.config.accessKey,
    };
  },

  apiUrl(path = "") {
    return `https://api.jsonbin.io/v3/b/${this.config.binId}${path}`;
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
    this.setStatus("JSONBin 동기화", "ok");
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
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this._lastLocalAt = data.exportedAt;
      this._lastRemoteAt = data.exportedAt;
      this.setStatus("JSONBin 동기화", "ok");
      this.updateLastSyncLabel(data.exportedAt);
    } catch (err) {
      console.error("JSONBin push failed", err);
      this.setStatus("업로드 실패", "warn");
      showToast("클라우드 저장 실패 — 로컬에는 저장됨");
    } finally {
      this._pushing = false;
    }
  },

  async pull(silent) {
    if (!this.enabled || !this.config || this._pushing) return false;
    try {
      const res = await fetch(this.apiUrl("/latest"), { headers: this.headers() });
      if (res.status === 404) return false;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = json.record;
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
      this.setStatus("JSONBin 동기화", "ok");
      if (!silent) showToast("클라우드 데이터를 불러왔습니다.");
      this.notifyUI();
      return true;
    } catch (err) {
      console.error("JSONBin pull failed", err);
      if (!silent) this.setStatus("불러오기 실패", "warn");
      return false;
    }
  },

  async uploadIfEmpty() {
    try {
      const res = await fetch(this.apiUrl("/latest"), { headers: this.headers() });
      if (res.ok) {
        const json = await res.json();
        if (json.record?.reservations?.length || json.record?.sites?.length) return;
      }
    } catch {
      /* treat as empty */
    }

    const localRes = Storage.getReservations();
    const localSites = Storage.getSites();
    if (!localRes.length && !localSites.length) return;

    if (!confirm("클라우드가 비어 있습니다.\n이 기기의 데이터를 JSONBin에 업로드할까요?")) {
      return;
    }
    await this.push();
    showToast("클라우드에 업로드했습니다.");
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
    const el = document.getElementById("jsonbinLastSync");
    if (!el || !iso) return;
    const d = new Date(iso);
    el.textContent = Number.isNaN(d.getTime())
      ? ""
      : `마지막 동기화: ${d.toLocaleString("ko-KR")}`;
  },

  bindSettingsForm() {
    const form = document.getElementById("jsonbinSettingsForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    const cfg = this.loadConfig();
    if (cfg) {
      form.binId.value = cfg.binId;
      form.accessKey.value = cfg.accessKey;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const binId = form.binId.value.trim();
      const accessKey = form.accessKey.value.trim();
      if (!binId || !accessKey) {
        showToast("Bin ID와 Access Key를 입력하세요.");
        return;
      }
      this.saveConfig(binId, accessKey);
      await this.reconnect();
      showToast("JSONBin 동기화가 연결되었습니다.");
      document.getElementById("syncSettingsModal")?.close();
      if (typeof App !== "undefined") App.updateJsonBinSettings();
    });

    document.getElementById("btnJsonBinPull")?.addEventListener("click", () => this.pull(false));
    document.getElementById("btnJsonBinPush")?.addEventListener("click", () => this.push());
    document.getElementById("btnJsonBinDisconnect")?.addEventListener("click", () => {
      if (!confirm("JSONBin 연결을 해제할까요?")) return;
      this.clearConfig();
      if (typeof App !== "undefined") App.updateJsonBinSettings();
      showToast("동기화 연결이 해제되었습니다.");
    });
  },
};

document.addEventListener("DOMContentLoaded", () => JSONBinSync.bindSettingsForm());
