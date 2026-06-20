const DailySales = {
  init() {
    document.getElementById("dailySalesDate").addEventListener("change", () => this.render());
    document.getElementById("dailySalesSource").addEventListener("change", () => this.render());
    document.getElementById("dailySalesPrev").addEventListener("click", () => this.shiftDate(-1));
    document.getElementById("dailySalesNext").addEventListener("click", () => this.shiftDate(1));
    document.getElementById("dailySalesToday").addEventListener("click", () => {
      document.getElementById("dailySalesDate").value = todayStr();
      this.render();
    });
  },

  openDate(dateStr) {
    const el = document.getElementById("dailySalesDate");
    if (el) el.value = dateStr || todayStr();
    this.render();
  },

  shiftDate(delta) {
    const el = document.getElementById("dailySalesDate");
    el.value = addDays(el.value || todayStr(), delta);
    this.render();
  },

  getFilteredSales(date) {
    const source = document.getElementById("dailySalesSource").value;
    let sales = Storage.getSales().filter((s) => s.date === date);
    if (source === "excel") sales = sales.filter((s) => s.legacy || s.source === "excel");
    if (source === "pos") sales = sales.filter((s) => !s.legacy && s.source !== "excel");
    return sales.sort((a, b) => {
      const ta = a.createdAt || a.date || "";
      const tb = b.createdAt || b.date || "";
      return ta.localeCompare(tb);
    });
  },

  cancel(id) {
    const sale = Storage.getSales().find((s) => s.id === id);
    if (!sale || sale.cancelled) return;

    const label = saleSourceLabel(sale);
    const msg = `[${label}] ${formatMoney(sale.total)} 매출을 취소하시겠습니까?\n취소된 매출은 합계에서 제외됩니다.`;
    if (!confirm(msg)) return;

    Storage.cancelSale(id);
    showToast("매출이 취소되었습니다.");
    this.render();
    App.renderDashboard();
    if (typeof SalesView !== "undefined") SalesView.render();
    if (typeof SalesDashboard !== "undefined") SalesDashboard.render();
  },

  renderSaleBlock(sale) {
    const cancelled = !!sale.cancelled;
    const items = sale.items || [];
    const itemRows = items.length
      ? items
          .map(
            (item) => `<tr>
              <td>${item.name}</td>
              <td class="num">${item.qty}</td>
              <td class="num">${formatMoney(item.price)}</td>
              <td class="num">${formatMoney(item.price * item.qty)}</td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="4" class="empty-cell">엑셀 일별 매출 합계 (상품 내역 없음)</td></tr>`;

    const statusBadge = cancelled
      ? `<span class="badge cancelled">취소됨</span>`
      : `<span class="badge pos">정상</span>`;

    const cancelBtn =
      !cancelled && sale.id
        ? `<button type="button" class="btn sm danger" data-cancel-sale="${sale.id}">매출 취소</button>`
        : cancelled && sale.cancelledAt
          ? `<small class="muted">${formatDate(sale.cancelledAt.slice(0, 10))} 취소</small>`
          : "";

    return `<article class="sale-tx ${cancelled ? "cancelled" : ""}">
      <div class="sale-tx-header">
        <div class="sale-tx-meta">
          ${saleSourceBadge(sale)}
          <span class="sale-tx-time">${sale.time || "-"}</span>
          ${statusBadge}
        </div>
        <div class="sale-tx-actions">
          <strong class="sale-tx-total">${formatMoney(sale.total)}</strong>
          ${cancelBtn}
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table compact">
          <thead><tr><th>상품</th><th>수량</th><th>단가</th><th>금액</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>
    </article>`;
  },

  render() {
    const date = document.getElementById("dailySalesDate").value || todayStr();
    const sales = this.getFilteredSales(date);
    const active = sales.filter(isActiveSale);
    const cancelled = sales.filter((s) => s.cancelled);

    const activeTotal = active.reduce((sum, s) => sum + s.total, 0);
    const cancelledTotal = cancelled.reduce((sum, s) => sum + s.total, 0);
    const itemCount = active.reduce(
      (sum, s) => sum + (s.items || []).reduce((a, i) => a + i.qty, 0),
      0
    );

    document.getElementById("dailySalesTitle").textContent = formatDate(date);
    document.getElementById("dailySalesStats").innerHTML = `
      <div class="stat-card highlight">
        <div class="label">매점 일매출 (정상)</div>
        <div class="value">${formatMoney(activeTotal)}</div>
        <small>${active.length}건</small>
      </div>
      <div class="stat-card">
        <div class="label">판매 수량</div>
        <div class="value">${itemCount}<small>개</small></div>
      </div>
      <div class="stat-card">
        <div class="label">취소 매출</div>
        <div class="value">${cancelled.length ? formatMoney(cancelledTotal) : "-"}</div>
        <small>${cancelled.length}건</small>
      </div>
    `;

    const container = document.getElementById("dailySalesList");
    if (!sales.length) {
      container.innerHTML = `<p class="empty-hint">선택한 날짜에 매점 매출 기록이 없습니다.</p>`;
      return;
    }

    container.innerHTML = sales.map((s) => this.renderSaleBlock(s)).join("");

    container.querySelectorAll("[data-cancel-sale]").forEach((btn) => {
      btn.addEventListener("click", () => this.cancel(btn.dataset.cancelSale));
    });
  },
};
