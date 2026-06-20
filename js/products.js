const Products = {
  editingId: null,

  init() {
    document.getElementById("btnAddProduct").addEventListener("click", () => this.openModal());
    document.getElementById("btnImportExcel").addEventListener("click", () => {
      document.getElementById("excelImportFile").click();
    });
    document.getElementById("excelImportFile").addEventListener("change", (e) => this.importExcel(e));
    document.getElementById("productForm").addEventListener("submit", (e) => this.save(e));
  },

  getCategories() {
    return Storage.getCategories();
  },

  render() {
    const filter = document.getElementById("productCategoryFilter")?.value || "";
    const tbody = document.getElementById("productBody");
    let list = Storage.getProducts();

    if (filter) list = list.filter((p) => p.category === filter);

    list = sortProductsKo(list);

    const filterEl = document.getElementById("productCategoryFilter");
    if (filterEl) {
      const cats = this.getCategories();
      const cur = filterEl.value;
      filterEl.innerHTML =
        `<option value="">전체 카테고리</option>` +
        cats.map((c) => `<option value="${c}">${c}</option>`).join("");
      filterEl.value = cur;
      filterEl.onchange = () => this.render();
    }

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted)">등록된 상품이 없습니다.</td></tr>`;
    } else {
      tbody.innerHTML = list
        .map(
          (p) => `<tr>
            <td>${p.category}</td>
            <td>${p.name}</td>
            <td>${formatMoney(p.price)}</td>
            <td>${p.note || "-"}</td>
            <td>
              <button class="btn sm" data-edit="${p.id}">수정</button>
              <button class="btn sm danger" data-del="${p.id}">삭제</button>
            </td>
          </tr>`
        )
        .join("");

      tbody.querySelectorAll("[data-edit]").forEach((btn) => {
        btn.addEventListener("click", () => this.openModal(btn.dataset.edit));
      });
      tbody.querySelectorAll("[data-del]").forEach((btn) => {
        btn.addEventListener("click", () => this.remove(btn.dataset.del));
      });
    }

    const categorySelect = document.getElementById("productCategorySelect");
    if (categorySelect) {
      const cats = this.getCategories();
      categorySelect.innerHTML = cats.map((c) => `<option value="${c}">${c}</option>`).join("");
    }

    const datalist = document.getElementById("categoryList");
    if (datalist) {
      datalist.innerHTML = this.getCategories().map((c) => `<option value="${c}">`).join("");
    }

    Categories.render();
  },

  openModal(id) {
    const modal = document.getElementById("productModal");
    const form = document.getElementById("productForm");
    form.reset();
    this.editingId = id || null;
    document.getElementById("productModalTitle").textContent = id ? "상품 수정" : "상품 추가";

    const cats = this.getCategories();
    form.category.innerHTML = cats.map((c) => `<option value="${c}">${c}</option>`).join("");

    if (id) {
      const p = Storage.getProducts().find((x) => x.id === id);
      if (p) {
        form.category.value = p.category;
        form.name.value = p.name;
        form.price.value = p.price;
        form.note.value = p.note || "";
      }
    }

    modal.showModal();
  },

  save(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      id: this.editingId || uid(),
      category: form.category.value.trim(),
      name: form.name.value.trim(),
      price: Number(form.price.value),
      note: form.note.value.trim(),
    };

    let list = Storage.getProducts();
    if (this.editingId) {
      list = list.map((p) => (p.id === this.editingId ? data : p));
    } else {
      list.push(data);
    }

    Storage.saveProducts(list);
    document.getElementById("productModal").close();
    showToast(this.editingId ? "상품이 수정되었습니다." : "상품이 추가되었습니다.");
    this.render();
    POS.render();
  },

  remove(id) {
    if (!confirm("이 상품을 삭제하시겠습니까?")) return;
    Storage.saveProducts(Storage.getProducts().filter((p) => p.id !== id));
    showToast("상품이 삭제되었습니다.");
    this.render();
    POS.render();
  },

  importExcel(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const { products, sales, categories } = ExcelImport.importWorkbook(wb);

        if (!products.length && !sales.length) {
          showToast("가져올 데이터를 찾지 못했습니다.");
          return;
        }

        if (categories.length) ExcelImport.mergeCategories(categories);
        if (products.length) ExcelImport.mergeProducts(products);
        const sCount = sales.length ? ExcelImport.mergeSales(sales) : 0;

        if (sCount > 0) {
          localStorage.setItem(STORAGE_KEYS.legacySalesLoaded, ExcelImport.LEGACY_VERSION);
        }

        showToast(`상품 ${products.length}종 · 매출 ${sCount}일치 가져옴`);
        this.render();
        POS.render();
        SalesView.render();
        if (typeof SalesDashboard !== "undefined") SalesDashboard.render();
        if (typeof DailySales !== "undefined") DailySales.render();
        App.renderDashboard();
      } catch (err) {
        showToast("엑셀 파일을 읽는 중 오류가 발생했습니다.");
        console.error(err);
      }
      e.target.value = "";
    };
    reader.readAsArrayBuffer(file);
  },
};
