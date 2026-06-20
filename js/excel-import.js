/** 엑셀 매출 시트 파싱 및 일괄 가져오기 */
const ExcelImport = {
  LEGACY_VERSION: "daily-totals-v6",

  parsePrice(val) {
    if (typeof val === "number") return val;
    const s = String(val ?? "").replace(/[^0-9]/g, "");
    return Number(s) || 0;
  },

  parseQty(val) {
    return this.parsePrice(val);
  },

  guessYear(sheetName) {
    const y = sheetName.match(/(20\d{2})/);
    if (y) return Number(y[1]);
    const mo = sheetName.match(/(\d{1,2})/);
    if (!mo) return 2026;
    const month = Number(mo[1]);
    if (month >= 10 && month <= 12) return 2025;
    if (month >= 1 && month <= 6) return 2026;
    return 2026;
  },

  guessMonth(sheetName) {
    const m = sheetName.match(/(\d{1,2})\s*월/);
    return m ? Number(m[1]) : null;
  },

  parseDateLabel(label, defaultYear, defaultMonth) {
    const text = String(label ?? "").trim();
    if (!text || text === "-") return null;

    // 금액 셀(465,500 등) 제외
    if (/^[\d,.\s]+$/.test(text) && this.parsePrice(text) >= 1000) return null;

    const full = text.match(/(\d{1,2})\D+(\d{1,2})/);
    if (full) {
      const month = Number(full[1]);
      const day = Number(full[2]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${defaultYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }

    // "16일" 형식 (월은 시트명에서)
    if (defaultMonth && !text.includes(",") && text.length <= 8) {
      const dayOnly = text.match(/(\d{1,2})/);
      if (dayOnly) {
        const day = Number(dayOnly[1]);
        if (day >= 1 && day <= 31) {
          return `${defaultYear}-${String(defaultMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }
    }
    return null;
  },

  isSalesSheet(rows) {
    return this.findDateHeaderRow(rows) >= 0;
  },

  findDateHeaderRow(rows) {
    for (let r = 0; r < Math.min(12, rows.length); r++) {
      const b = String((rows[r] || [])[1] ?? "");
      if (b.includes("상품")) return r;
      for (let c = 2; c < (rows[r]?.length || 0); c++) {
        if (this.parseDateLabel(rows[r][c], 2025, 6)) return r;
      }
    }
    return -1;
  },

  isPairLayout(rows, headerRow) {
    const sub = rows[headerRow + 1] || [];
    for (let c = 2; c < sub.length; c++) {
      const t = String(sub[c] ?? "");
      if (t.includes("수량") || t.includes("금액")) return true;
    }
    return false;
  },

  /** 날짜 행 바로 위(가격검색/현금매출) 금액 = 일별 매출 합계 */
  parseDailyTotals(rows, sheetName) {
    const year = this.guessYear(sheetName);
    const defaultMonth = this.guessMonth(sheetName);
    const headerRow = this.findDateHeaderRow(rows);
    if (headerRow < 0) return [];

    const totalRow = Math.max(0, headerRow - 1);
    const header = rows[headerRow] || [];
    const totals = rows[totalRow] || [];
    const pairLayout = this.isPairLayout(rows, headerRow);
    const sub = rows[headerRow + 1] || [];
    const result = [];

    for (let c = 2; c < header.length; c++) {
      if (pairLayout && String(sub[c] ?? "").includes("금액")) continue;

      const dateStr = this.parseDateLabel(header[c], year, defaultMonth);
      if (!dateStr) continue;

      let total = this.parsePrice(totals[c]);
      if (total <= 0 && pairLayout) total = this.parsePrice(totals[c + 1]);
      if (total <= 0) continue;

      result.push({ date: dateStr, total, col: c });
    }
    return result;
  },

  parseLineItems(rows, sheetName, dateColMap) {
    const year = this.guessYear(sheetName);
    const defaultMonth = this.guessMonth(sheetName);
    const headerRow = this.findDateHeaderRow(rows);
    if (headerRow < 0) return {};

    const pairLayout = this.isPairLayout(rows, headerRow);
    let startRow = headerRow + 1;
    if (pairLayout) startRow = headerRow + 2;

    const dateCols = {};
    const header = rows[headerRow] || [];
    header.forEach((cell, c) => {
      const dt = this.parseDateLabel(cell, year, defaultMonth);
      if (dt) dateCols[c] = dt;
    });

    const dayItems = {};
    let currentCategory = "";

    for (let r = startRow; r < rows.length; r++) {
      const row = rows[r] || [];
      const c0 = String(row[0] ?? "").trim();
      const c1 = String(row[1] ?? "").trim();
      const price = this.parsePrice(row[2]);

      if (c0 && !c1) {
        if (!this.isBadCategory(c0)) currentCategory = c0;
        continue;
      }
      if (!c1 || price <= 0) continue;
      if (this.parsePrice(c1) > 0 && price === 0) continue;
      if (c0 && !this.isBadCategory(c0)) currentCategory = c0;
      if (!currentCategory || this.isBadCategory(currentCategory)) continue;

      Object.keys(dateCols).forEach((colKey) => {
        const c = Number(colKey);
        const dateStr = dateCols[c];
        const qtyCol = pairLayout ? c : c;
        const amtCol = pairLayout ? c + 1 : c;

        const qty = this.parseQty(row[qtyCol]);
        if (qty <= 0) return;

        let amt = pairLayout ? this.parseQty(row[amtCol]) : qty * price;
        if (amt <= 0) amt = qty * price;

        if (!dayItems[dateStr]) dayItems[dateStr] = [];
        dayItems[dateStr].push({
          name: c1,
          price: Math.floor(amt / qty),
          qty,
        });
      });
    }
    return dayItems;
  },

  parseSalesSheet(rows, sheetName) {
    const dailyTotals = this.parseDailyTotals(rows, sheetName);
    if (!dailyTotals.length) return [];

    const lineItems = this.parseLineItems(rows, sheetName);

    return dailyTotals.map(({ date, total }) => {
      const items = (lineItems[date] || []).map((it) => ({
        productId: "legacy",
        name: it.name,
        price: it.price,
        qty: it.qty,
      }));

      return {
        id: uid(),
        date,
        time: "엑셀",
        items,
        total,
        received: total,
        change: 0,
        source: "excel",
        legacy: true,
        sheet: sheetName,
        createdAt: `${date}T12:00:00.000Z`,
      };
    });
  },

  parseProductSheet(rows) {
    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const [name, category, priceRaw, note] = rows[i];
      if (!name) continue;
      const price = this.parsePrice(priceRaw);
      if (price <= 0) continue;
      result.push({
        category: String(category || "기타").trim(),
        name: String(name).trim(),
        price,
        note: String(note || "").trim(),
      });
    }
    return result;
  },

  isBadCategory(name) {
    if (!name || name.length < 2) return true;
    if (/^\d/.test(name)) return true;
    if (name.length > 15) return true;
    return false;
  },

  parseProductsFromSalesSheet(rows) {
    const result = [];
    let currentCategory = "";

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || [];
      const c0 = String(row[0] ?? "").trim();
      const c1 = String(row[1] ?? "").trim();
      const price = this.parsePrice(row[2]);

      if (c0 && !c1) {
        if (!this.isBadCategory(c0)) currentCategory = c0;
        continue;
      }
      if (!c1 || price <= 0) continue;
      if (this.parsePrice(c1) > 0 && price === 0) continue;

      if (c0 && !this.isBadCategory(c0)) currentCategory = c0;
      if (!currentCategory || this.isBadCategory(currentCategory)) continue;

      if (!result.find((p) => p.name === c1 && p.category === currentCategory)) {
        result.push({ category: currentCategory, name: c1, price, note: "" });
      }
    }
    return result;
  },

  importWorkbook(wb) {
    let products = [];
    let sales = [];
    const categories = new Set(DEFAULT_CATEGORIES);

    const productSheet = wb.SheetNames.find((n) => n.includes("물품"));
    if (productSheet) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[productSheet], { header: 1, defval: "" });
      products = this.parseProductSheet(rows);
    }

    wb.SheetNames.forEach((name) => {
      if (name.includes("사이트") || name.includes("물품")) return;
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" });
      if (this.isSalesSheet(rows)) {
        sales = sales.concat(this.parseSalesSheet(rows, name));
        this.parseProductsFromSalesSheet(rows).forEach((p) => {
          if (!products.find((x) => x.name === p.name && x.category === p.category)) {
            products.push(p);
          }
        });
      }
    });

    products.forEach((p) => categories.add(p.category));
    return { products, sales, categories: [...categories] };
  },

  mergeProducts(imported) {
    const existing = Storage.getProducts();
    const merged = [...existing];
    imported.forEach((item) => {
      const idx = merged.findIndex((p) => p.category === item.category && p.name === item.name);
      if (idx >= 0) {
        merged[idx].price = item.price;
        if (item.note) merged[idx].note = item.note;
      } else {
        merged.push({ ...item, id: uid() });
      }
    });
    Storage.saveProducts(merged);
    return imported.length;
  },

  mergeSales(imported) {
    const posSales = Storage.getSales().filter((s) => !s.legacy && s.source !== "excel");
    Storage.saveSales(posSales.concat(imported));
    localStorage.setItem(STORAGE_KEYS.legacySalesLoaded, this.LEGACY_VERSION);
    return imported.length;
  },

  mergeCategories(imported) {
    const existing = Storage.getCategories();
    const set = new Set(existing);
    imported.forEach((c) => set.add(c));
    Storage.saveCategories([...set]);
  },
};
