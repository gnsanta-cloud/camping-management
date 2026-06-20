const SalesDashboard = {
  mode: "calendar",
  category: "combined",
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  selectedDate: null,

  categoryLabels: {
    site: "사이트",
    store: "매점",
    combined: "통합",
  },

  init() {
    document.querySelectorAll(".sd-category-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        this.category = tab.dataset.category;
        this.render();
      });
    });
    document.querySelectorAll(".sd-mode-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        this.mode = tab.dataset.mode;
        this.render();
      });
    });
    document.getElementById("sdPrev").addEventListener("click", () => this.shiftPeriod(-1));
    document.getElementById("sdNext").addEventListener("click", () => this.shiftPeriod(1));
    document.getElementById("sdToday").addEventListener("click", () => this.goToday());
    document.getElementById("sdYearSelect").addEventListener("change", (e) => {
      this.year = Number(e.target.value);
      this.render();
    });
  },

  getDailyTotals() {
    if (this.category === "site") return getSiteDailyTotals();
    if (this.category === "store") return getStoreDailyTotals();
    return getCombinedDailyTotals();
  },

  getMonthlyTotals() {
    const map = {};
    Object.entries(this.getDailyTotals()).forEach(([date, total]) => {
      const ym = date.slice(0, 7);
      if (!map[ym]) map[ym] = { total: 0, days: 0 };
      map[ym].total += total;
      map[ym].days += 1;
    });
    return map;
  },

  getStoreSalesForDate(date) {
    return Storage.getSales().filter((s) => s.date === date);
  },

  getSiteReservationsForDate(date) {
    return Storage.getReservations().filter(
      (r) => r.checkInDate === date && r.deposit > 0 && r.paid !== "미결제"
    );
  },

  getAvailableYears() {
    const years = new Set([new Date().getFullYear()]);
    [getStoreDailyTotals(), getSiteDailyTotals()].forEach((daily) => {
      Object.keys(daily).forEach((d) => years.add(Number(d.slice(0, 4))));
    });
    return [...years].sort((a, b) => b - a);
  },

  goToday() {
    const now = new Date();
    this.year = now.getFullYear();
    this.month = now.getMonth();
    this.selectedDate = todayStr();
    this.render();
  },

  focusLatestSalesMonth() {
    const daily = this.getDailyTotals();
    const mk = monthKey(this.year, this.month);
    const hasCurrentMonth = Object.entries(daily).some(([d, v]) => d.startsWith(mk) && v > 0);
    if (hasCurrentMonth) {
      if (!this.selectedDate) this.selectedDate = todayStr();
      return;
    }

    const dates = Object.keys(daily).sort();
    if (!dates.length) return;
    const latest = dates[dates.length - 1];
    const [y, m] = latest.split("-").map(Number);
    this.year = y;
    this.month = m - 1;
    this.selectedDate = latest;
  },

  shiftPeriod(delta) {
    if (this.mode === "calendar") {
      this.month += delta;
      if (this.month > 11) {
        this.month = 0;
        this.year += 1;
      } else if (this.month < 0) {
        this.month = 11;
        this.year -= 1;
      }
    } else {
      this.year += delta;
    }
    this.render();
  },

  render() {
    const daily = this.getDailyTotals();
    const monthly = this.getMonthlyTotals();
    const catLabel = this.categoryLabels[this.category];

    document.querySelectorAll(".sd-category-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.category === this.category);
    });
    document.querySelectorAll(".sd-mode-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.mode === this.mode);
    });

    document.getElementById("sdCalendarView").classList.toggle("hidden", this.mode !== "calendar");
    document.getElementById("sdMonthlyView").classList.toggle("hidden", this.mode !== "monthly");

    const desc = document.getElementById("sdDashboardDesc");
    if (desc) {
      desc.textContent =
        this.category === "site"
          ? "예약 입금(입실일) — 캘린더 / 월별"
          : this.category === "store"
            ? "매점 POS·엑셀 — 캘린더 / 월별"
            : "사이트 + 매점 합산 — 캘린더 / 월별";
    }

    this.renderYearSelect();
    this.renderSummary(daily, monthly, catLabel);
    this.renderPeriodLabel();

    if (this.mode === "calendar") {
      this.renderCalendar(daily);
    } else {
      this.renderMonthlyChart(monthly);
    }

    this.renderDayDetail();
  },

  renderYearSelect() {
    const sel = document.getElementById("sdYearSelect");
    const years = this.getAvailableYears();
    if (!years.includes(this.year)) years.push(this.year);
    years.sort((a, b) => b - a);
    sel.innerHTML = years.map((y) => `<option value="${y}">${y}년</option>`).join("");
    sel.value = String(this.year);
  },

  renderPeriodLabel() {
    const el = document.getElementById("sdPeriodLabel");
    if (this.mode === "calendar") {
      el.textContent = `${this.year}년 ${this.month + 1}월`;
    } else {
      el.textContent = `${this.year}년`;
    }
  },

  renderSummary(daily, monthly, catLabel) {
    const mk = monthKey(this.year, this.month);
    const monthData = monthly[mk] || { total: 0, days: 0 };

    let yearTotal = 0;
    let yearDays = 0;
    Object.entries(monthly).forEach(([ym, data]) => {
      if (ym.startsWith(String(this.year))) {
        yearTotal += data.total;
        yearDays += data.days;
      }
    });

    const allTotal = Object.values(daily).reduce((s, v) => s + v, 0);
    const allDays = Object.keys(daily).length;

    let extra = "";
    if (this.category === "combined") {
      const siteMonth = Object.entries(getSiteDailyTotals())
        .filter(([d]) => d.startsWith(mk))
        .reduce((s, [, v]) => s + v, 0);
      const storeMonth = Object.entries(getStoreDailyTotals())
        .filter(([d]) => d.startsWith(mk))
        .reduce((s, [, v]) => s + v, 0);
      extra = `<small>사이트 ${formatMoney(siteMonth)} · 매점 ${formatMoney(storeMonth)}</small>`;
    }

    document.getElementById("sdSummary").innerHTML = `
      <div class="stat-card highlight">
        <div class="label">${this.mode === "calendar" ? `이번 달 ${catLabel} 매출` : `연간 ${catLabel} 매출`}</div>
        <div class="value">${formatMoney(this.mode === "calendar" ? monthData.total : yearTotal)}</div>
        <small>${this.mode === "calendar" ? monthData.days + "일" : yearDays + "일"}${this.category === "combined" && this.mode === "calendar" ? "" : " 영업"}</small>
        ${this.category === "combined" && this.mode === "calendar" ? extra : ""}
      </div>
      <div class="stat-card">
        <div class="label">${this.mode === "calendar" ? "일 평균" : "월 평균"}</div>
        <div class="value">${
          this.mode === "calendar"
            ? monthData.days
              ? formatMoney(Math.round(monthData.total / monthData.days))
              : "-"
            : (() => {
                const cnt = Object.keys(monthly).filter((k) => k.startsWith(String(this.year))).length;
                return cnt ? formatMoney(Math.round(yearTotal / cnt)) : "-";
              })()
        }</div>
      </div>
      <div class="stat-card">
        <div class="label">올해 누적</div>
        <div class="value">${formatMoney(yearTotal)}</div>
      </div>
      <div class="stat-card">
        <div class="label">전체 누적</div>
        <div class="value">${formatMoney(allTotal)}</div>
        <small>${allDays}일</small>
      </div>
    `;
  },

  renderCalendar(daily) {
    const grid = document.getElementById("sdCalendarGrid");
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const firstDay = new Date(this.year, this.month, 1).getDay();
    const daysInMonth = new Date(this.year, this.month + 1, 0).getDate();
    const today = todayStr();

    const monthValues = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${this.year}-${String(this.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      monthValues.push(daily[dateStr] || 0);
    }
    const maxVal = Math.max(...monthValues, 1);

    let html = `<div class="cal-weekdays">${weekdays.map((w) => `<span>${w}</span>`).join("")}</div><div class="cal-days">`;

    for (let i = 0; i < firstDay; i++) {
      html += `<div class="cal-day empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${this.year}-${String(this.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const amount = daily[dateStr] || 0;
      const level = amount ? Math.ceil((amount / maxVal) * 4) : 0;
      const isToday = dateStr === today;
      const isSelected = dateStr === this.selectedDate;
      const dow = new Date(this.year, this.month, d).getDay();
      const cls = [
        "cal-day",
        amount ? `has-sales lv${level}` : "",
        this.category === "site" ? "cat-site" : "",
        this.category === "store" ? "cat-store" : "",
        this.category === "combined" ? "cat-combined" : "",
        isToday ? "today" : "",
        isSelected ? "selected" : "",
        dow === 0 ? "sun" : "",
        dow === 6 ? "sat" : "",
      ]
        .filter(Boolean)
        .join(" ");

      html += `<button type="button" class="${cls}" data-date="${dateStr}">
        <span class="cal-num">${d}</span>
        <span class="cal-amt">${amount ? formatCalendarMoney(amount) : ""}</span>
      </button>`;
    }

    html += `</div>`;
    grid.innerHTML = html;

    grid.querySelectorAll(".cal-day[data-date]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.selectedDate = btn.dataset.date;
        this.renderDayDetail();
        grid.querySelectorAll(".cal-day.selected").forEach((el) => el.classList.remove("selected"));
        btn.classList.add("selected");
      });
      btn.addEventListener("dblclick", () => {
        if (this.category === "site") return;
        App.switchView("daily-sales");
        DailySales.openDate(btn.dataset.date);
      });
    });
  },

  renderMonthlyChart(monthly) {
    const container = document.getElementById("sdMonthlyChart");
    const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

    const values = monthNames.map((_, i) => {
      const mk = monthKey(this.year, i);
      return monthly[mk]?.total || 0;
    });
    const maxVal = Math.max(...values, 1);
    const yearTotal = values.reduce((s, v) => s + v, 0);

    container.innerHTML = `
      <div class="month-bars">
        ${monthNames
          .map((name, i) => {
            const mk = monthKey(this.year, i);
            const data = monthly[mk] || { total: 0, days: 0 };
            const pct = data.total ? Math.max(4, (data.total / maxVal) * 100) : 0;
            const share = yearTotal ? Math.round((data.total / yearTotal) * 100) : 0;
            return `<button type="button" class="month-bar-item" data-month="${i}">
              <div class="month-bar-wrap">
                <div class="month-bar-fill" style="height:${pct}%"></div>
              </div>
              <div class="month-bar-label">${name}</div>
              <div class="month-bar-value">${data.total ? formatShortMoney(data.total) : "-"}</div>
              <div class="month-bar-sub">${data.days ? data.days + "일 · " + share + "%" : ""}</div>
            </button>`;
          })
          .join("")}
      </div>
      <div class="month-table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>월</th><th>매출</th><th>영업일</th><th>일평균</th><th>비율</th></tr>
          </thead>
          <tbody>
            ${monthNames
              .map((name, i) => {
                const mk = monthKey(this.year, i);
                const data = monthly[mk] || { total: 0, days: 0 };
                const avg = data.days ? Math.round(data.total / data.days) : 0;
                const share = yearTotal ? ((data.total / yearTotal) * 100).toFixed(1) : "0.0";
                return `<tr class="${data.total ? "clickable" : ""}" data-month="${i}">
                  <td><strong>${name}</strong></td>
                  <td>${data.total ? formatMoney(data.total) : "-"}</td>
                  <td>${data.days || "-"}</td>
                  <td>${avg ? formatMoney(avg) : "-"}</td>
                  <td>${data.total ? share + "%" : "-"}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll("[data-month]").forEach((el) => {
      el.addEventListener("click", () => {
        this.month = Number(el.dataset.month);
        this.mode = "calendar";
        this.render();
      });
    });
  },

  renderDayDetail() {
    const panel = document.getElementById("sdDayDetail");
    if (!this.selectedDate) {
      panel.innerHTML = `<p class="empty-hint">캘린더에서 날짜를 클릭하면 상세 매출을 확인할 수 있습니다.</p>`;
      return;
    }

    if (this.category === "site") {
      this.renderSiteDayDetail(panel);
      return;
    }
    if (this.category === "combined") {
      this.renderCombinedDayDetail(panel);
      return;
    }
    this.renderStoreDayDetail(panel);
  },

  renderSiteDayDetail(panel) {
    const reservations = this.getSiteReservationsForDate(this.selectedDate);
    const total = reservations.reduce((s, r) => s + Number(r.deposit || 0), 0);

    if (!reservations.length) {
      panel.innerHTML = `
        <h3>${formatDate(this.selectedDate)}</h3>
        <p class="empty-hint">사이트 매출 기록이 없습니다.</p>`;
      return;
    }

    const rows = reservations
      .map(
        (r) => `<tr>
          <td><strong>${r.siteNumber}</strong></td>
          <td>${normalizeSiteType(r.type)}</td>
          <td>${r.guest}</td>
          <td>${formatMoney(r.deposit)}</td>
          <td><span class="badge ${r.paid === "완료" ? "pos" : "excel"}">${r.paid}</span></td>
        </tr>`
      )
      .join("");

    panel.innerHTML = `
      <div class="day-detail-header">
        <h3>${formatDate(this.selectedDate)}</h3>
        <strong class="day-detail-total">${formatMoney(total)}</strong>
      </div>
      <p class="detail-sub">입실일 기준 입금 합계</p>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>사이트</th><th>타입</th><th>이용객</th><th>입금</th><th>결제</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  renderStoreDayDetail(panel) {
    const sales = this.getStoreSalesForDate(this.selectedDate).filter(isActiveSale);
    const total = sales.reduce((s, r) => s + r.total, 0);

    if (!sales.length) {
      panel.innerHTML = `
        <h3>${formatDate(this.selectedDate)}</h3>
        <p class="empty-hint">매점 매출 기록이 없습니다.</p>
        <button type="button" class="btn sm" id="sdOpenDaily">매점매출상세</button>`;
      document.getElementById("sdOpenDaily")?.addEventListener("click", () => {
        App.switchView("daily-sales");
        DailySales.openDate(this.selectedDate);
      });
      return;
    }

    const itemRows = [];
    sales.forEach((sale) => {
      if (!sale.items.length) {
        itemRows.push(
          `<tr>
            <td>일별 합계</td><td>-</td><td>${formatMoney(sale.total)}</td>
            <td>${saleSourceBadge(sale)}</td>
          </tr>`
        );
        return;
      }
      sale.items.forEach((item) => {
        itemRows.push(
          `<tr>
            <td>${item.name}</td>
            <td>${item.qty}</td>
            <td>${formatMoney(item.price * item.qty)}</td>
            <td>${saleSourceBadge(sale)}</td>
          </tr>`
        );
      });
    });

    panel.innerHTML = `
      <div class="day-detail-header">
        <h3>${formatDate(this.selectedDate)}</h3>
        <strong class="day-detail-total">${formatMoney(total)}</strong>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>상품</th><th>수량</th><th>금액</th><th>구분</th></tr></thead>
          <tbody>${itemRows.join("")}</tbody>
        </table>
      </div>
      <button type="button" class="btn sm" id="sdOpenDaily">매점매출상세 · 취소</button>`;

    document.getElementById("sdOpenDaily")?.addEventListener("click", () => {
      App.switchView("daily-sales");
      DailySales.openDate(this.selectedDate);
    });
  },

  renderCombinedDayDetail(panel) {
    const siteRes = this.getSiteReservationsForDate(this.selectedDate);
    const storeSales = this.getStoreSalesForDate(this.selectedDate).filter(isActiveSale);
    const siteTotal = siteRes.reduce((s, r) => s + Number(r.deposit || 0), 0);
    const storeTotal = storeSales.reduce((s, r) => s + r.total, 0);
    const total = siteTotal + storeTotal;

    if (!total) {
      panel.innerHTML = `
        <h3>${formatDate(this.selectedDate)}</h3>
        <p class="empty-hint">매출 기록이 없습니다.</p>`;
      return;
    }

    panel.innerHTML = `
      <div class="day-detail-header">
        <h3>${formatDate(this.selectedDate)}</h3>
        <strong class="day-detail-total">${formatMoney(total)}</strong>
      </div>
      <div class="combined-breakdown">
        <div class="combined-row"><span>🏕️ 사이트</span><strong>${formatMoney(siteTotal)}</strong><small>${siteRes.length}건</small></div>
        <div class="combined-row"><span>🛒 매점</span><strong>${formatMoney(storeTotal)}</strong><small>${storeSales.length}건</small></div>
      </div>
      ${
        siteRes.length
          ? `<h4 class="detail-section-title">사이트</h4>
        <div class="table-wrap"><table class="data-table compact"><thead><tr><th>사이트</th><th>이용객</th><th>입금</th></tr></thead><tbody>
        ${siteRes.map((r) => `<tr><td>${r.siteNumber}</td><td>${r.guest}</td><td>${formatMoney(r.deposit)}</td></tr>`).join("")}
        </tbody></table></div>`
          : ""
      }
      ${
        storeTotal
          ? `<button type="button" class="btn sm" id="sdOpenDaily">매점매출상세 · 취소</button>`
          : ""
      }`;

    document.getElementById("sdOpenDaily")?.addEventListener("click", () => {
      App.switchView("daily-sales");
      DailySales.openDate(this.selectedDate);
    });
  },
};
