const MobileApp = {
  init() {
    Storage.init();

    const today = todayStr();
    const todayLabel = document.getElementById("todayLabel");
    if (todayLabel) {
      todayLabel.textContent = new Date().toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      });
    }

    const dateInput = document.getElementById("siteViewDate");
    if (dateInput) dateInput.value = today;

    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => btn.closest("dialog")?.close());
    });

    document.getElementById("btnToday")?.addEventListener("click", () => {
      dateInput.value = todayStr();
      Sites.render();
    });

    Reservations.init();
    Sites.init();
    Sites.render();
  },
};

document.addEventListener("DOMContentLoaded", () => MobileApp.init());

function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove("show"), 2500);
}
