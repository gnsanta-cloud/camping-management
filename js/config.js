/** 사이트 타입 · 사이트 기본 구성 (렌탈 9 · 오토 22 · 디럭스 3) */
const DEFAULT_SITE_TYPES = [
  { name: "렌탈", extraGuestPrice: 10000 },
  { name: "오토", extraGuestPrice: 5000 },
  { name: "디럭스", extraGuestPrice: 5000 },
];

const DEFAULT_EXTRA_GUEST_PRICES = { 렌탈: 10000, 오토: 5000, 디럭스: 5000 };

function normalizeSiteType(type) {
  if (!type) return type;
  if (type === "렌탈A" || type === "렌탈B" || type.includes("렌탈")) return "렌탈";
  return type;
}

function defaultSitePrice(type) {
  return normalizeSiteType(type) === "렌탈" ? 90000 : 40000;
}

function defaultExtraGuestPrice(type) {
  return DEFAULT_EXTRA_GUEST_PRICES[normalizeSiteType(type)] ?? 0;
}

function getExtraGuestPrice(type) {
  const typeName = normalizeSiteType(type);
  if (typeof Storage !== "undefined") {
    const siteType = Storage.getSiteTypes().find((t) => t.name === typeName);
    if (siteType && siteType.extraGuestPrice != null) {
      return Number(siteType.extraGuestPrice) || 0;
    }
  }
  return defaultExtraGuestPrice(typeName);
}

function calcReservationDeposit(site, nights, extraGuests) {
  const n = Number(nights) || 1;
  const extra = Number(extraGuests) || 0;
  const base = getSitePrice(site) * n;
  const extraFee = getExtraGuestPrice(site?.type) * extra * n;
  return base + extraFee;
}

const DEFAULT_SITES = [
  ...Array.from({ length: 6 }, (_, i) => ({
    number: String(i + 1),
    type: "렌탈",
    price: 90000,
    active: true,
  })),
  ...Array.from({ length: 3 }, (_, i) => ({
    number: String(i + 7),
    type: "렌탈",
    price: 90000,
    active: true,
  })),
  ...Array.from({ length: 22 }, (_, i) => ({
    number: String(i + 11),
    type: "오토",
    price: 40000,
    active: true,
  })),
  ...Array.from({ length: 3 }, (_, i) => ({
    number: `D${i + 1}`,
    type: "디럭스",
    price: 40000,
    active: true,
  })),
];

/** @deprecated Storage.getSites() 사용 */
const SITE_CONFIG = DEFAULT_SITES;

/** 엑셀 excel-catalog.js 에서 로드 (없으면 빈 배열) */
const DEFAULT_CATEGORIES =
  typeof EXCEL_CATALOG !== "undefined" ? [...EXCEL_CATALOG.categories] : [];
const DEFAULT_PRODUCTS =
  typeof EXCEL_CATALOG !== "undefined" ? [...EXCEL_CATALOG.products] : [];

const STORAGE_KEYS = {
  products: "camping_products",
  categories: "camping_categories",
  reservations: "camping_reservations",
  sales: "camping_sales",
  sites: "camping_sites",
  siteTypes: "camping_site_types",
  sitePricesApplied: "camping_site_prices_v1",
  siteSchemaV2: "camping_site_schema_v2",
  extraGuestPricesApplied: "camping_extra_guest_prices_v1",
  initialized: "camping_initialized_v3",
  legacySalesLoaded: "camping_legacy_sales_loaded",
};

function getSitePrice(site) {
  if (!site) return 0;
  return Number(site.price) || defaultSitePrice(normalizeSiteType(site.type));
}

function getSiteByNumber(num) {
  if (typeof Storage !== "undefined") {
    return Storage.getSites().find((s) => s.number === String(num));
  }
  return DEFAULT_SITES.find((s) => s.number === String(num));
}

function getActiveSites() {
  if (typeof Storage !== "undefined") {
    return Storage.getSites().filter((s) => s.active !== false);
  }
  return DEFAULT_SITES.filter((s) => s.active !== false);
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString("ko-KR") + "원";
}

function formatShortMoney(n) {
  const v = Number(n || 0);
  if (v === 0) return "-";
  if (v >= 10000) {
    const man = v / 10000;
    return (Number.isInteger(man) ? man : man.toFixed(1)) + "만";
  }
  return v.toLocaleString("ko-KR");
}

/** 캘린더 셀용 — 천 단위 구분 전체 금액 */
function formatCalendarMoney(n) {
  const v = Number(n || 0);
  if (!v) return "";
  return v.toLocaleString("ko-KR") + "원";
}

function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function parseMonthKey(key) {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m - 1 };
}

function formatDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("ko-KR");
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 한글 가나다순 비교 */
function compareKo(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), "ko");
}

function sortKo(list) {
  return [...list].sort(compareKo);
}

function sortProductsKo(products) {
  return [...products].sort((a, b) => {
    const byCat = compareKo(a.category, b.category);
    if (byCat !== 0) return byCat;
    return compareKo(a.name, b.name);
  });
}

function sortSiteTypesKo(types) {
  return [...types].sort((a, b) => compareKo(a.name, b.name));
}

function typeBadgeClass(type) {
  const t = normalizeSiteType(type);
  if (t === "렌탈") return "rental";
  if (t === "오토") return "auto";
  if (t === "디럭스") return "deluxe";
  return "";
}

function isCheckedIn(status) {
  return status === "입실" || status === "입실완료";
}

/** 매점(POS·엑셀) 일별 매출 */
function getStoreDailyTotals() {
  const map = {};
  if (typeof Storage === "undefined") return map;
  activeSales(Storage.getSales()).forEach((s) => {
    if (!s.date) return;
    map[s.date] = (map[s.date] || 0) + (s.total || 0);
  });
  return map;
}

/** 사이트(예약 입금) 일별 매출 — 입실일 기준 */
function getSiteDailyTotals() {
  const map = {};
  if (typeof Storage === "undefined") return map;
  Storage.getReservations().forEach((r) => {
    if (!r.checkInDate || !r.deposit || r.paid === "미결제") return;
    map[r.checkInDate] = (map[r.checkInDate] || 0) + Number(r.deposit || 0);
  });
  return map;
}

function mergeDailyTotals(...maps) {
  const map = {};
  maps.forEach((m) => {
    Object.entries(m).forEach(([date, total]) => {
      map[date] = (map[date] || 0) + total;
    });
  });
  return map;
}

function getCombinedDailyTotals() {
  return mergeDailyTotals(getStoreDailyTotals(), getSiteDailyTotals());
}

function isActiveSale(sale) {
  return sale && !sale.cancelled;
}

function activeSales(list) {
  return (list || []).filter(isActiveSale);
}

function saleSourceLabel(sale) {
  if (sale.legacy || sale.source === "excel") return "엑셀";
  return "POS";
}

function saleSourceBadge(sale) {
  const cls = sale.legacy || sale.source === "excel" ? "excel" : "pos";
  return `<span class="badge ${cls}">${saleSourceLabel(sale)}</span>`;
}
