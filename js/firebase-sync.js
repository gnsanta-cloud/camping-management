const FirebaseSync = {
  enabled: false,
  db: null,
  auth: null,
  campgroundId: "main",
  _pushing: false,
  _debounce: {},
  _patched: false,

  isConfigured() {
    const c = window.FIREBASE_CONFIG;
    return !!(c && c.apiKey && c.projectId);
  },

  async bootstrap() {
    Storage.init();

    if (!this.isConfigured()) {
      this.setStatus("로컬 저장", "muted");
      return false;
    }

    if (typeof firebase === "undefined") {
      console.warn("Firebase SDK not loaded");
      return false;
    }

    this.enabled = true;
    this.campgroundId = window.FIREBASE_CAMPGROUND_ID || "main";

    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    this.auth = firebase.auth();
    this.db = firebase.firestore();

    this.auth.onAuthStateChanged((user) => this.onAuthChange(user));

    await new Promise((resolve) => {
      this._readyResolve = resolve;
      if (!this.auth.currentUser) {
        this.showAuthOverlay(true);
      }
    });

    return true;
  },

  resolveReady() {
    if (this._readyResolve) {
      this._readyResolve();
      this._readyResolve = null;
    }
  },

  onAuthChange(user) {
    if (user) {
      this.showAuthOverlay(false);
      this.setStatus("동기화 연결 중…", "syncing");
      this.afterLogin().then(() => this.resolveReady());
    } else if (this.enabled) {
      this.setStatus("로그인 필요", "warn");
      this._syncReady = false;
      this._listenersStarted = false;
    }
  },

  async afterLogin() {
    if (this._syncReady) return;
    if (!this._patched) {
      this.patchStorage();
      this._patched = true;
    }
    await this.pullAll();
    await this.uploadLocalIfCloudEmpty();
    this.startListeners();
    this._syncReady = true;
    this.setStatus("Firebase 동기화", "ok");
    this.notifyUI();
  },

  docRef(name) {
    return this.db
      .collection("campgrounds")
      .doc(this.campgroundId)
      .collection("data")
      .doc(name);
  },

  collectionMap: {
    siteTypes: { key: "siteTypes", field: "items" },
    sites: { key: "sites", field: "items" },
    categories: { key: "categories", field: "items" },
    products: { key: "products", field: "items" },
    reservations: { key: "reservations", field: "items" },
    sales: { key: "sales", field: "items" },
  },

  readLocal(name) {
    const map = this.collectionMap[name];
    if (!map) return null;
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS[map.key]) || "null");
    } catch {
      return null;
    }
  },

  writeLocal(name, items) {
    const map = this.collectionMap[name];
    if (!map || items == null) return;
    localStorage.setItem(STORAGE_KEYS[map.key], JSON.stringify(items));
  },

  applyRemote(name, data) {
    if (this._pushing || !data) return;
    const field = this.collectionMap[name].field;
    const items = data[field];
    if (!Array.isArray(items)) return;
    this.writeLocal(name, items);
  },

  async pullAll() {
    const names = Object.keys(this.collectionMap);
    for (const name of names) {
      const snap = await this.docRef(name).get();
      if (snap.exists) this.applyRemote(name, snap.data());
    }
  },

  startListeners() {
    if (this._listenersStarted) return;
    this._listenersStarted = true;
    Object.keys(this.collectionMap).forEach((name) => {
      this.docRef(name).onSnapshot(
        (snap) => {
          if (!snap.exists) return;
          this.applyRemote(name, snap.data());
          this.notifyUI();
        },
        (err) => {
          console.error("Firestore listener error", err);
          this.setStatus("동기화 오류", "warn");
        }
      );
    });
  },

  pushCollection(name, items) {
    if (!this.enabled || !this.auth?.currentUser || !Array.isArray(items)) return;

    clearTimeout(this._debounce[name]);
    this._debounce[name] = setTimeout(async () => {
      const field = this.collectionMap[name].field;
      this._pushing = true;
      try {
        await this.docRef(name).set({
          [field]: items,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        this.setStatus("Firebase 동기화", "ok");
      } catch (err) {
        console.error("Firestore write error", err);
        this.setStatus("업로드 실패", "warn");
        showToast("클라우드 저장 실패 — 로컬에는 저장됨");
      } finally {
        this._pushing = false;
      }
    }, 500);
  },

  patchStorage() {
    const bind = (method, collection) => {
      const original = Storage[method].bind(Storage);
      Storage[method] = (list) => {
        original(list);
        this.pushCollection(collection, list);
      };
    };

    bind("saveSiteTypes", "siteTypes");
    bind("saveSites", "sites");
    bind("saveCategories", "categories");
    bind("saveProducts", "products");
    bind("saveReservations", "reservations");
    bind("saveSales", "sales");
  },

  async uploadLocalIfCloudEmpty() {
    const reservationsSnap = await this.docRef("reservations").get();
    if (reservationsSnap.exists && (reservationsSnap.data().items || []).length > 0) {
      return;
    }

    const localRes = this.readLocal("reservations") || [];
    const localSites = this.readLocal("sites") || [];
    if (!localRes.length && !localSites.length) return;

    if (!confirm("클라우드가 비어 있습니다.\n이 기기의 데이터를 Firebase에 업로드할까요?")) {
      return;
    }

    this._pushing = true;
    try {
      for (const name of Object.keys(this.collectionMap)) {
        const items = this.readLocal(name);
        if (Array.isArray(items) && items.length) {
          const field = this.collectionMap[name].field;
          await this.docRef(name).set({
            [field]: items,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
      showToast("클라우드에 데이터를 업로드했습니다.");
    } catch (err) {
      console.error(err);
      showToast("클라우드 업로드 실패");
    } finally {
      this._pushing = false;
    }
  },

  notifyUI() {
    window.dispatchEvent(new CustomEvent("camping-data-sync"));
    if (typeof App !== "undefined" && App.onDataSync) App.onDataSync();
    if (typeof MobileApp !== "undefined" && MobileApp.onDataSync) MobileApp.onDataSync();
  },

  showAuthOverlay(show) {
    const el = document.getElementById("firebaseAuthOverlay");
    if (el) el.classList.toggle("hidden", !show);
  },

  setStatus(text, tone) {
    const el = document.getElementById("firebaseSyncStatus");
    if (!el) return;
    el.textContent = text;
    el.dataset.tone = tone || "muted";
  },

  bindAuthForm() {
    const form = document.getElementById("firebaseAuthForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.login();
    });

    document.getElementById("firebaseRegisterBtn")?.addEventListener("click", () => this.register());
    document.getElementById("firebaseLogoutBtn")?.addEventListener("click", () => this.logout());
  },

  async login() {
    const email = document.getElementById("firebaseEmail")?.value.trim();
    const password = document.getElementById("firebasePassword")?.value;
    const errEl = document.getElementById("firebaseAuthError");
    if (!email || !password) return;

    try {
      if (errEl) errEl.textContent = "";
      await this.auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      if (errEl) errEl.textContent = this.authErrorMessage(err);
    }
  },

  async register() {
    const email = document.getElementById("firebaseEmail")?.value.trim();
    const password = document.getElementById("firebasePassword")?.value;
    const errEl = document.getElementById("firebaseAuthError");
    if (!email || !password) {
      if (errEl) errEl.textContent = "이메일과 비밀번호(6자 이상)를 입력하세요.";
      return;
    }
    if (password.length < 6) {
      if (errEl) errEl.textContent = "비밀번호는 6자 이상이어야 합니다.";
      return;
    }

    try {
      if (errEl) errEl.textContent = "";
      await this.auth.createUserWithEmailAndPassword(email, password);
      showToast("계정이 생성되었습니다.");
    } catch (err) {
      if (errEl) errEl.textContent = this.authErrorMessage(err);
    }
  },

  async logout() {
    if (!confirm("로그아웃하시겠습니까?")) return;
    this._syncReady = false;
    this._listenersStarted = false;
    await this.auth.signOut();
    this.showAuthOverlay(true);
    this.setStatus("로그인 필요", "warn");
  },

  authErrorMessage(err) {
    const code = err?.code || "";
    if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    }
    if (code === "auth/email-already-in-use") return "이미 사용 중인 이메일입니다.";
    if (code === "auth/weak-password") return "비밀번호가 너무 짧습니다.";
    return "로그인 오류가 발생했습니다.";
  },
};

document.addEventListener("DOMContentLoaded", () => FirebaseSync.bindAuthForm());
