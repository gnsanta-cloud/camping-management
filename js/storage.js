const Storage = {
  init() {
    if (localStorage.getItem(STORAGE_KEYS.initialized)) {
      this.ensureSitesData();
      this.ensureSiteSchemaV2();
      this.ensureSitePrices();
      this.ensureExtraGuestPrices();
      this.ensureLegacySales();
      return;
    }

    const hadOld =
      localStorage.getItem("camping_initialized_v1") ||
      localStorage.getItem("camping_initialized_v2");

    if (hadOld) {
      this.resetToExcel();
    } else {
      this.setupFromExcel();
    }
  },

  setupFromExcel() {
    const categories = DEFAULT_CATEGORIES.length ? DEFAULT_CATEGORIES : ["기타"];
    const products = DEFAULT_PRODUCTS.map((p) => ({ ...p, id: uid() }));

    this.saveCategories(categories);
    localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products));
    this.saveReservations([]);
    this.saveSales([]);
    this.initDefaultSites();
    localStorage.removeItem(STORAGE_KEYS.legacySalesLoaded);
    localStorage.setItem(STORAGE_KEYS.initialized, "1");
    this.ensureLegacySales();
  },

  initDefaultSites() {
    this.saveSiteTypes(
      DEFAULT_SITE_TYPES.map((t) => ({ ...t, id: uid() }))
    );
    this.saveSites(
      DEFAULT_SITES.map((s) => ({ ...s, id: uid() }))
    );
  },

  ensureSitesData() {
    try {
      if (!JSON.parse(localStorage.getItem(STORAGE_KEYS.siteTypes) || "[]").length) {
        this.saveSiteTypes(DEFAULT_SITE_TYPES.map((t) => ({ ...t, id: uid() })));
      }
      if (!JSON.parse(localStorage.getItem(STORAGE_KEYS.sites) || "[]").length) {
        this.saveSites(DEFAULT_SITES.map((s) => ({ ...s, id: uid() })));
      }
    } catch {
      this.initDefaultSites();
    }
  },

  resetToExcel() {
    const reservations = this.getReservations();
    const sites = this.getSites();
    const siteTypes = this.getSiteTypes();
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("camping_initialized_v1");
    localStorage.removeItem("camping_initialized_v2");
    this.setupFromExcel();
    this.saveReservations(reservations);
    if (sites.length) this.saveSites(sites);
    if (siteTypes.length) this.saveSiteTypes(siteTypes);
  },

  ensureSiteSchemaV2() {
    if (localStorage.getItem(STORAGE_KEYS.siteSchemaV2)) return;

    const typeNames = new Set(["렌탈", "오토", "디럭스"]);
    this.getSiteTypes().forEach((t) => {
      const name = normalizeSiteType(t.name);
      if (name && name !== "렌탈A" && name !== "렌탈B") typeNames.add(name);
    });

    this.saveSiteTypes(sortKo([...typeNames]).map((name) => ({ id: uid(), name })));

    const sites = this.getSites().map((s) => {
      const type = normalizeSiteType(s.type);
      const { group, ...rest } = s;
      return { ...rest, type, price: s.price || defaultSitePrice(type) };
    });
    this.saveSites(sites);

    const reservations = this.getReservations().map((r) => ({
      ...r,
      type: normalizeSiteType(r.type),
    }));
    this.saveReservations(reservations);

    localStorage.setItem(STORAGE_KEYS.siteSchemaV2, "1");
  },

  ensureSitePrices() {
    if (localStorage.getItem(STORAGE_KEYS.sitePricesApplied)) return;
    const sites = this.getSites().map((s) => ({
      ...s,
      type: normalizeSiteType(s.type),
      price: defaultSitePrice(normalizeSiteType(s.type)),
    }));
    this.saveSites(sites);
    localStorage.setItem(STORAGE_KEYS.sitePricesApplied, "1");
  },

  ensureExtraGuestPrices() {
    if (localStorage.getItem(STORAGE_KEYS.extraGuestPricesApplied)) return;
    const types = this.getSiteTypes().map((t) => ({
      ...t,
      extraGuestPrice: t.extraGuestPrice ?? defaultExtraGuestPrice(t.name),
    }));
    this.saveSiteTypes(types);
    localStorage.setItem(STORAGE_KEYS.extraGuestPricesApplied, "1");
  },

  ensureLegacySales() {
    const version = ExcelImport?.LEGACY_VERSION || "daily-totals-v6";

    const loadLegacy = (data) => {
      if (!Array.isArray(data) || !data.length) return;
      const flag = localStorage.getItem(STORAGE_KEYS.legacySalesLoaded);
      const hasLegacy = this.getSales().some((s) => s.legacy);
      if (flag === version && hasLegacy) return;

      const posSales = this.getSales().filter((s) => !s.legacy && s.source !== "excel");
      this.saveSales(posSales.concat(data));
      localStorage.setItem(STORAGE_KEYS.legacySalesLoaded, version);

      if (typeof App !== "undefined") {
        App.renderDashboard();
        if (typeof SalesView !== "undefined") SalesView.render();
        if (typeof SalesDashboard !== "undefined") SalesDashboard.render();
        if (typeof DailySales !== "undefined") DailySales.render();
      }
    };

    if (typeof LEGACY_SALES !== "undefined" && Array.isArray(LEGACY_SALES)) {
      loadLegacy(LEGACY_SALES);
      return;
    }

    fetch("js/legacy-sales.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => loadLegacy(data))
      .catch(() => {});
  },

  getSiteTypes() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.siteTypes) || "[]");
      if (saved.length) return sortSiteTypesKo(saved);
    } catch {
      /* ignore */
    }
    return sortSiteTypesKo(DEFAULT_SITE_TYPES.map((t) => ({ ...t, id: uid() })));
  },

  saveSiteTypes(list) {
    localStorage.setItem(STORAGE_KEYS.siteTypes, JSON.stringify(sortSiteTypesKo(list)));
  },

  getSites() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.sites) || "[]");
      if (saved.length) return saved;
    } catch {
      /* ignore */
    }
    return DEFAULT_SITES.map((s) => ({ ...s, id: uid() }));
  },

  saveSites(list) {
    localStorage.setItem(STORAGE_KEYS.sites, JSON.stringify(list));
  },

  getCategories() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.categories) || "[]");
      if (saved.length) return sortKo(saved);
    } catch {
      /* ignore */
    }
    return sortKo([...DEFAULT_CATEGORIES]);
  },

  saveCategories(list) {
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(sortKo([...new Set(list)])));
  },

  getProducts() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.products) || "[]");
    } catch {
      return [];
    }
  },

  saveProducts(list) {
    localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(list));
  },

  getReservations() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.reservations) || "[]");
    } catch {
      return [];
    }
  },

  saveReservations(list) {
    localStorage.setItem(STORAGE_KEYS.reservations, JSON.stringify(list));
  },

  getSales() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.sales) || "[]");
    } catch {
      return [];
    }
  },

  saveSales(list) {
    localStorage.setItem(STORAGE_KEYS.sales, JSON.stringify(list));
  },

  cancelSale(id) {
    const sales = this.getSales().map((s) =>
      s.id === id
        ? { ...s, cancelled: true, cancelledAt: new Date().toISOString() }
        : s
    );
    this.saveSales(sales);
  },

  getActiveSales() {
    return activeSales(this.getSales());
  },

  exportAll() {
    return {
      version: 4,
      exportedAt: new Date().toISOString(),
      categories: this.getCategories(),
      products: this.getProducts(),
      reservations: this.getReservations(),
      sales: this.getSales(),
      sites: this.getSites(),
      siteTypes: this.getSiteTypes(),
    };
  },

  importAll(data) {
    if (data.categories) this.saveCategories(data.categories);
    if (data.products) this.saveProducts(data.products);
    if (data.reservations) this.saveReservations(data.reservations);
    if (data.sales) this.saveSales(data.sales);
    if (data.sites) this.saveSites(data.sites);
    if (data.siteTypes) this.saveSiteTypes(data.siteTypes);
  },

  resetAll() {
    if (!confirm("상품·카테고리·매출을 엑셀 기준으로 초기화합니다.\n예약·사이트 데이터는 유지됩니다.\n계속하시겠습니까?")) return false;
    this.resetToExcel();
    return true;
  },
};
