const POS = {
  cart: [],
  activeCategory: "전체",

  init() {
    document.getElementById("posSearch").addEventListener("input", () => this.renderProducts());
    document.getElementById("receivedAmount").addEventListener("input", () => this.updateChange());
    document.getElementById("btnClearCart").addEventListener("click", () => this.clearCart());
    document.getElementById("btnCheckout").addEventListener("click", () => this.checkout());
  },

  render() {
    const dateEl = document.getElementById("posSaleDate");
    if (dateEl) {
      if (!dateEl.value) dateEl.value = todayStr();
      dateEl.max = todayStr();
    }
    this.renderCategories();
    this.renderProducts();
    this.renderCart();
  },

  renderCategories() {
    const cats = ["전체", ...Products.getCategories()];
    const container = document.getElementById("posCategories");
    container.innerHTML = cats
      .map(
        (c) =>
          `<button class="cat-tab ${c === this.activeCategory ? "active" : ""}" data-cat="${c}">${c}</button>`
      )
      .join("");

    container.querySelectorAll(".cat-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.activeCategory = btn.dataset.cat;
        this.renderCategories();
        this.renderProducts();
      });
    });
  },

  getFilteredProducts() {
    const q = document.getElementById("posSearch").value.trim().toLowerCase();
    let list = Storage.getProducts();
    if (this.activeCategory !== "전체") {
      list = list.filter((p) => p.category === this.activeCategory);
    }
    if (q) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      );
    }
    return sortProductsKo(list);
  },

  renderProducts() {
    const grid = document.getElementById("posProductGrid");
    const list = this.getFilteredProducts();

    if (!list.length) {
      grid.innerHTML = `<p style="color:var(--muted);padding:1rem">표시할 상품이 없습니다.</p>`;
      return;
    }

    grid.innerHTML = list
      .map(
        (p) =>
          `<button class="product-btn" data-id="${p.id}">
            <div class="name">${p.name}</div>
            <div class="price">${formatMoney(p.price)}</div>
          </button>`
      )
      .join("");

    grid.querySelectorAll(".product-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.addToCart(btn.dataset.id));
    });
  },

  addToCart(productId) {
    const product = Storage.getProducts().find((p) => p.id === productId);
    if (!product) return;

    const existing = this.cart.find((c) => c.productId === productId);
    if (existing) {
      existing.qty += 1;
    } else {
      this.cart.push({
        productId,
        name: product.name,
        price: product.price,
        qty: 1,
      });
    }
    this.renderCart();
  },

  updateQty(productId, delta) {
    const item = this.cart.find((c) => c.productId === productId);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      this.cart = this.cart.filter((c) => c.productId !== productId);
    }
    this.renderCart();
  },

  renderCart() {
    const container = document.getElementById("cartItems");
    const total = this.getTotal();

    if (!this.cart.length) {
      container.innerHTML = `<p style="color:var(--muted);text-align:center;padding:2rem 0">상품을 선택하세요</p>`;
    } else {
      container.innerHTML = this.cart
        .map(
          (item) =>
            `<div class="cart-item">
              <div>
                <div>${item.name}</div>
                <small style="color:var(--muted)">${formatMoney(item.price)}</small>
              </div>
              <div class="qty-control">
                <button type="button" data-minus="${item.productId}">-</button>
                <span>${item.qty}</span>
                <button type="button" data-plus="${item.productId}">+</button>
              </div>
              <strong>${formatMoney(item.price * item.qty)}</strong>
            </div>`
        )
        .join("");

      container.querySelectorAll("[data-minus]").forEach((btn) => {
        btn.addEventListener("click", () => this.updateQty(btn.dataset.minus, -1));
      });
      container.querySelectorAll("[data-plus]").forEach((btn) => {
        btn.addEventListener("click", () => this.updateQty(btn.dataset.plus, 1));
      });
    }

    document.getElementById("cartTotal").textContent = formatMoney(total);
    this.updateChange();
  },

  getTotal() {
    return this.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  },

  updateChange() {
    const total = this.getTotal();
    const received = Number(document.getElementById("receivedAmount").value) || 0;
    const change = Math.max(0, received - total);
    document.getElementById("changeAmount").textContent = formatMoney(change);
  },

  clearCart() {
    this.cart = [];
    document.getElementById("receivedAmount").value = "";
    this.renderCart();
  },

  checkout() {
    if (!this.cart.length) {
      showToast("장바구니가 비어 있습니다.");
      return;
    }

    const total = this.getTotal();
    const received = Number(document.getElementById("receivedAmount").value) || 0;
    if (received > 0 && received < total) {
      showToast("받은 금액이 부족합니다.");
      return;
    }

    const saleDate = document.getElementById("posSaleDate")?.value || todayStr();
    if (!saleDate) {
      showToast("매출 일자를 선택하세요.");
      return;
    }

    const sale = {
      id: uid(),
      date: saleDate,
      time: new Date().toLocaleTimeString("ko-KR"),
      items: this.cart.map((c) => ({ ...c })),
      total,
      received: received || total,
      change: Math.max(0, (received || total) - total),
      source: "pos",
      createdAt: new Date().toISOString(),
    };

    const sales = Storage.getSales();
    sales.push(sale);
    Storage.saveSales(sales);

    showToast(`결제 완료: ${formatMoney(total)}`);
    this.clearCart();
    SalesView.render();
    if (typeof DailySales !== "undefined") DailySales.render();
    if (typeof SalesDashboard !== "undefined") SalesDashboard.render();
    App.renderDashboard();
  },
};

const SalesView = {
  init() {
    document.getElementById("salesFilterDate").addEventListener("change", () => this.render());
    document.getElementById("salesFilterSource").addEventListener("change", () => this.render());
    document.getElementById("btnClearSales").addEventListener("click", () => this.clearDay());
  },

  render() {
    const date = document.getElementById("salesFilterDate").value || todayStr();
    const source = document.getElementById("salesFilterSource").value;
    let sales = Storage.getSales().filter((s) => s.date === date);
    if (source === "excel") sales = sales.filter((s) => s.legacy || s.source === "excel");
    if (source === "pos") sales = sales.filter((s) => !s.legacy && s.source !== "excel");

    const tbody = document.getElementById("salesBody");
    const stats = document.getElementById("salesStats");

    const dayTotal = activeSales(sales).reduce((sum, s) => sum + s.total, 0);
    const txCount = activeSales(sales).length;
    const itemCount = activeSales(sales).reduce(
      (sum, s) => sum + s.items.reduce((a, i) => a + i.qty, 0),
      0
    );

    stats.innerHTML = `
      <div class="stat-card"><div class="label">일 매출</div><div class="value">${formatMoney(dayTotal)}</div></div>
      <div class="stat-card"><div class="label">결제 건수</div><div class="value">${txCount}<small>건</small></div></div>
      <div class="stat-card"><div class="label">판매 수량</div><div class="value">${itemCount}<small>개</small></div></div>
    `;

    if (!sales.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted)">매출 내역이 없습니다.</td></tr>`;
      return;
    }

    const rows = [];
    sales.forEach((sale) => {
      const srcBadge = saleSourceBadge(sale);
      const cancelled = sale.cancelled ? ' class="cancelled-row"' : "";
      sale.items.forEach((item, idx) => {
        rows.push(`<tr${cancelled}>
          <td>${idx === 0 ? srcBadge : ""}${sale.cancelled && idx === 0 ? ' <span class="badge cancelled">취소</span>' : ""}</td>
          <td>${idx === 0 ? sale.time : ""}</td>
          <td>${item.name}</td>
          <td>${item.qty}</td>
          <td>${formatMoney(item.price)}</td>
          <td>${idx === 0 ? formatMoney(sale.total) : ""}</td>
        </tr>`);
      });
    });
    tbody.innerHTML = rows.join("");
  },

  clearDay() {
    const date = document.getElementById("salesFilterDate").value || todayStr();
    if (!confirm(`${date} 매출 내역을 모두 삭제하시겠습니까?`)) return;
    Storage.saveSales(Storage.getSales().filter((s) => s.date !== date));
    showToast("매출 내역이 삭제되었습니다.");
    this.render();
    App.renderDashboard();
  },
};
