const App = {
  init() {
    const today = todayStr();
    document.getElementById("todayLabel").textContent = new Date().toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });

    ["siteViewDate", "salesFilterDate", "dailySalesDate", "posSaleDate"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = today;
    });

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.switchView(btn.dataset.view));
    });

    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => btn.closest("dialog")?.close());
    });

    document.getElementById("btnExportData").addEventListener("click", () => this.exportData());
    document.getElementById("btnImportData").addEventListener("click", () => {
      document.getElementById("importDataFile").click();
    });
    document.getElementById("importDataFile").addEventListener("change", (e) => this.importData(e));
    document.getElementById("btnResetAll").addEventListener("click", () => this.resetAll());

    Reservations.init();
    Sites.init();
    Products.init();
    Categories.init();
    POS.init();
    SalesView.init();
    SalesDashboard.init();
    DailySales.init();
    SiteAdmin.init();

    document.getElementById("siteAdminFilter")?.addEventListener("change", () => SiteAdmin.render());

    this.renderAll();
    this.registerServiceWorker();
    this.updateFirebaseSettings();
    window.addEventListener("camping-data-sync", () => this.onDataSync());
  },

  updateFirebaseSettings() {
    const panel = document.getElementById("firebaseSettingsPanel");
    const emailEl = document.getElementById("firebaseUserEmail");
    const logoutBtn = document.getElementById("firebaseLogoutBtn");
    if (!panel) return;

    if (!FirebaseSync.isConfigured()) {
      const desc = document.getElementById("firebaseSettingsDesc");
      if (desc) {
        desc.textContent =
          "Firebase 미설정 — js/firebase-config.js 를 설정하면 PC·폰 자동 동기화가 활성화됩니다.";
      }
      if (logoutBtn) logoutBtn.classList.add("hidden");
      if (emailEl) emailEl.textContent = "";
      return;
    }

    const user = typeof firebase !== "undefined" ? firebase.auth()?.currentUser : null;
    if (emailEl) emailEl.textContent = user ? `로그인: ${user.email}` : "";
    if (logoutBtn) logoutBtn.classList.toggle("hidden", !user);
  },

  onDataSync() {
    this.renderDashboard();
    Sites.render();
    if (typeof SiteAdmin !== "undefined") SiteAdmin.render();
    if (typeof Products !== "undefined") Products.render();
    if (typeof SalesView !== "undefined") SalesView.render();
    if (typeof SalesDashboard !== "undefined") SalesDashboard.render();
    if (typeof DailySales !== "undefined") DailySales.render();
    if (typeof POS !== "undefined") POS.render();
    this.updateFirebaseSettings();
  },

  registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    const local =
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1" ||
      location.hostname === "[::1]";
    if (location.protocol !== "https:" && !local) return;

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  },

  switchView(view) {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));

    if (view === "pos") POS.render();
    if (view === "products") {
      Products.render();
      Categories.render();
    }
    if (view === "sales") SalesView.render();
    if (view === "sales-dashboard") {
      SalesDashboard.focusLatestSalesMonth();
      SalesDashboard.render();
    }
    if (view === "daily-sales") DailySales.render();
    if (view === "sites") Sites.render();
    if (view === "site-admin") SiteAdmin.render();
    if (view === "dashboard") this.renderDashboard();
  },

  renderAll() {
    this.renderDashboard();
    Sites.render();
    Products.render();
  },

  renderDashboard() {
    const today = todayStr();
    const reservations = Storage.getReservations();
    const sales = activeSales(Storage.getSales().filter((s) => s.date === today));

    const todayCheckins = reservations.filter((r) => r.checkInDate === today);
    const unpaid = reservations.filter((r) => r.paid !== "완료");
    const checkedIn = reservations.filter((r) => {
      const end = addDays(r.checkInDate, r.nights);
      return isCheckedIn(r.checkedIn) && r.checkInDate <= today && today < end;
    });

    const daySales = sales.reduce((sum, s) => sum + s.total, 0);

    document.getElementById("dashboardStats").innerHTML = `
      <div class="stat-card"><div class="label">전체 예약</div><div class="value">${reservations.length}<small>건</small></div></div>
      <div class="stat-card"><div class="label">오늘 입실</div><div class="value">${todayCheckins.length}<small>건</small></div></div>
      <div class="stat-card"><div class="label">현재 입실</div><div class="value">${checkedIn.length}<small>명</small></div></div>
      <div class="stat-card"><div class="label">미결제</div><div class="value">${unpaid.length}<small>건</small></div></div>
      <div class="stat-card"><div class="label">오늘 매출</div><div class="value">${formatMoney(daySales)}</div></div>
    `;

    const checkinBox = document.getElementById("todayCheckins");
    if (!todayCheckins.length) {
      checkinBox.innerHTML = `<div class="list-item empty">오늘 입실 예약 없음</div>`;
    } else {
      checkinBox.innerHTML = todayCheckins
        .map(
          (r) =>
            `<div class="list-item"><strong>${r.siteNumber}번</strong> ${r.guest} · ${r.nights}박 · ${r.contact}</div>`
        )
        .join("");
    }

    const unpaidBox = document.getElementById("unpaidList");
    if (!unpaid.length) {
      unpaidBox.innerHTML = `<div class="list-item empty">미결제 예약 없음</div>`;
    } else {
      unpaidBox.innerHTML = unpaid
        .slice(0, 10)
        .map(
          (r) =>
            `<div class="list-item"><strong>${r.siteNumber}번</strong> ${r.guest} · ${formatMoney(r.deposit)} · ${formatDate(r.checkInDate)}</div>`
        )
        .join("");
    }
  },

  exportData() {
    const data = Storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `camping-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("백업 파일이 다운로드되었습니다.");
  },

  importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        Storage.importAll(data);
        showToast("데이터를 불러왔습니다.");
        this.renderAll();
        POS.render();
        SalesView.render();
        SalesDashboard.render();
        if (typeof DailySales !== "undefined") DailySales.render();
        if (typeof SiteAdmin !== "undefined") SiteAdmin.render();
      } catch {
        showToast("백업 파일 형식이 올바르지 않습니다.");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  },

  resetAll() {
    if (!Storage.resetAll()) return;
    showToast("엑셀 기준으로 초기화되었습니다.");
    this.renderAll();
    POS.render();
    SalesView.render();
    SalesDashboard.render();
    DailySales.render();
  },
};

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove("show"), 2500);
}

document.addEventListener("DOMContentLoaded", async () => {
  await FirebaseSync.bootstrap();
  App.init();
});
