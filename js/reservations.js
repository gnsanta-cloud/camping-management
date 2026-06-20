const Reservations = {
  editingId: null,

  init() {
    document.getElementById("reservationForm")?.addEventListener("submit", (e) => this.save(e));
    document.getElementById("btnCancelReservation")?.addEventListener("click", () => this.cancelFromModal());
    document.getElementById("resSiteNumber")?.addEventListener("change", () => this.applySiteDefaults());
    document.getElementById("resNights")?.addEventListener("input", () => this.applyDefaultDeposit());
    document.getElementById("resExtraGuests")?.addEventListener("input", () => this.applyDefaultDeposit());

    this.refreshSiteSelect();
  },

  applyDefaultDeposit(form = document.getElementById("reservationForm")) {
    if (!form) return;
    const site = getSiteByNumber(form.siteNumber.value);
    const nights = Number(form.nights.value) || 1;
    const extraGuests = Number(form.extraGuests.value) || 0;
    form.deposit.value = calcReservationDeposit(site, nights, extraGuests);
  },

  updateExtraGuestHint(form = document.getElementById("reservationForm")) {
    const hint = document.getElementById("resExtraGuestHint");
    if (!hint || !form) return;
    const site = getSiteByNumber(form.siteNumber.value);
    const price = getExtraGuestPrice(site?.type);
    hint.textContent = price ? `${formatMoney(price)}/명·박 추가` : "추가요금 미설정";
  },

  applySiteDefaults(form = document.getElementById("reservationForm")) {
    if (!form) return;
    const site = getSiteByNumber(form.siteNumber.value);
    document.getElementById("resType").value = site ? normalizeSiteType(site.type) : "";
    this.updateExtraGuestHint(form);
    this.applyDefaultDeposit(form);
  },

  refreshSiteSelect() {
    const siteSelect = document.getElementById("resSiteNumber");
    if (!siteSelect) return;
    siteSelect.innerHTML = getActiveSites()
      .map((s) => `<option value="${s.number}">${s.number} (${normalizeSiteType(s.type)})</option>`)
      .join("");
  },

  getFiltered() {
    const date = document.getElementById("resFilterDate").value;
    const typeGroup = document.getElementById("resFilterType").value;
    const q = document.getElementById("resSearch").value.trim().toLowerCase();
    let list = Storage.getReservations();

    if (date) {
      list = list.filter((r) => {
        const end = addDays(r.checkInDate, r.nights);
        return r.checkInDate <= date && date < end;
      });
    }
    if (typeGroup) {
      list = list.filter((r) => normalizeSiteType(r.type) === typeGroup);
    }
    if (q) {
      list = list.filter(
        (r) =>
          r.guest.toLowerCase().includes(q) ||
          r.contact.includes(q) ||
          String(r.siteNumber).includes(q)
      );
    }
    return list.sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
  },

  render() {
    const tbody = document.getElementById("reservationBody");
    if (!tbody) return;
    const list = this.getFiltered();

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;color:var(--muted)">등록된 예약이 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((r) => {
        const paidCls = r.paid === "완료" ? "paid" : "unpaid";
        const checkCls = isCheckedIn(r.checkedIn) ? "checkin" : "";
        return `<tr>
          <td><strong>${r.siteNumber}</strong></td>
          <td><span class="badge ${typeBadgeClass(r.type)}">${normalizeSiteType(r.type)}</span></td>
          <td>${r.guest}</td>
          <td>${r.contact}</td>
          <td>${formatDate(r.checkInDate)}</td>
          <td>${r.nights}박</td>
          <td>${formatMoney(r.deposit)}</td>
          <td title="${r.notes || ""}">${(r.notes || "-").slice(0, 20)}</td>
          <td><span class="badge ${paidCls}">${r.paid}</span></td>
          <td><span class="badge ${checkCls}">${r.checkedIn}</span></td>
          <td title="${r.etc || ""}">${(r.etc || "-").slice(0, 15)}</td>
          <td>
            <button class="btn sm" data-edit="${r.id}">수정</button>
            <button class="btn sm danger" data-del="${r.id}">삭제</button>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => this.openModal(btn.dataset.edit));
    });
    tbody.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => this.remove(btn.dataset.del));
    });
  },

  openModal(id) {
    const modal = document.getElementById("reservationModal");
    const form = document.getElementById("reservationForm");
    form.reset();
    this.editingId = id || null;
    document.getElementById("resModalTitle").textContent = id ? "예약 수정" : "예약 추가";

    if (id) {
      const r = Storage.getReservations().find((x) => x.id === id);
      if (r) {
        form.siteNumber.value = r.siteNumber;
        form.type.value = normalizeSiteType(r.type);
        form.guest.value = r.guest;
        form.contact.value = r.contact;
        form.checkInDate.value = r.checkInDate;
        form.nights.value = r.nights;
        form.extraGuests.value = r.extraGuests ?? 0;
        form.deposit.value = r.deposit ?? "";
        form.paid.value = r.paid;
        form.checkedIn.value = r.checkedIn;
        form.notes.value = r.notes || "";
        form.etc.value = r.etc || "";
      }
      this.updateExtraGuestHint(form);
    } else {
      form.checkInDate.value = todayStr();
      this.applySiteDefaults(form);
    }

    document.getElementById("btnCancelReservation")?.classList.toggle("hidden", !id);
    modal.showModal();
  },

  cancelFromModal() {
    if (!this.editingId) return;
    this.remove(this.editingId);
  },

  save(e) {
    e.preventDefault();
    const form = e.target;
    const site = getSiteByNumber(form.siteNumber.value);
    const data = {
      id: this.editingId || uid(),
      siteNumber: form.siteNumber.value,
      type: site ? normalizeSiteType(site.type) : normalizeSiteType(form.type.value),
      guest: form.guest.value.trim(),
      contact: form.contact.value.trim(),
      checkInDate: form.checkInDate.value,
      nights: Number(form.nights.value),
      extraGuests: Number(form.extraGuests.value) || 0,
      deposit: Number(form.deposit.value) || 0,
      notes: form.notes.value.trim(),
      paid: form.paid.value,
      checkedIn: form.checkedIn.value,
      etc: form.etc.value.trim(),
      updatedAt: new Date().toISOString(),
    };

    let list = Storage.getReservations();
    if (this.editingId) {
      list = list.map((r) => (r.id === this.editingId ? data : r));
    } else {
      data.createdAt = new Date().toISOString();
      list.push(data);
    }

    Storage.saveReservations(list);
    document.getElementById("reservationModal").close();
    showToast(this.editingId ? "예약이 수정되었습니다." : "예약이 등록되었습니다.");
    this.render();
    Sites.render();
    App.renderDashboard();
    if (typeof SalesDashboard !== "undefined") SalesDashboard.render();
  },

  remove(id) {
    if (!confirm("이 예약을 취소하시겠습니까?")) return;
    Storage.saveReservations(Storage.getReservations().filter((r) => r.id !== id));
    document.getElementById("reservationModal")?.close();
    this.editingId = null;
    showToast("예약이 취소되었습니다.");
    this.render();
    Sites.render();
    App.renderDashboard();
    if (typeof SalesDashboard !== "undefined") SalesDashboard.render();
  },

  getActiveForSite(siteNumber, date) {
    return Storage.getReservations().find((r) => {
      if (String(r.siteNumber) !== String(siteNumber)) return false;
      const end = addDays(r.checkInDate, r.nights);
      return r.checkInDate <= date && date < end;
    });
  },
};

const Sites = {
  init() {
    document.getElementById("siteViewDate").addEventListener("change", () => this.render());
  },

  render() {
    const date = document.getElementById("siteViewDate").value || todayStr();
    const container = document.getElementById("siteGroups");
    const allSites = getActiveSites();
    const types = Storage.getSiteTypes().map((t) => t.name);

    container.innerHTML = types
      .map((typeName) => {
        const sites = allSites
          .filter((s) => normalizeSiteType(s.type) === typeName)
          .sort((a, b) => compareKo(a.number, b.number));
        const title = `${typeName} (${sites.length})`;
        const cards = sites
          .map((site) => {
            const res = Reservations.getActiveForSite(site.number, date);
            let cls = "";
            let guest = "빈 사이트";
            if (res) {
              cls = isCheckedIn(res.checkedIn) ? "checked-in" : "reserved";
              const extra = res.extraGuests > 0 ? ` (+${res.extraGuests})` : "";
              guest = res.guest + extra;
            }
            const priceLabel = site.price ? formatMoney(site.price) : "";
            const checkinLabel = res && isCheckedIn(res.checkedIn) ? `<div class="checkin-label">입실완료</div>` : "";
            return `<div class="site-card ${cls}" data-site="${site.number}" title="${guest}${priceLabel ? " · " + priceLabel : ""}">
              ${checkinLabel}
              <div class="num">${site.number}</div>
              <div class="type">${normalizeSiteType(site.type)}</div>
              <div class="guest">${guest}</div>
              ${priceLabel ? `<div class="site-price">${priceLabel}</div>` : ""}
            </div>`;
          })
          .join("");
        if (!sites.length) return "";
        return `<div class="site-group"><h3>${title}</h3><div class="site-grid">${cards}</div></div>`;
      })
      .filter(Boolean)
      .join("");

    container.querySelectorAll(".site-card").forEach((card) => {
      card.addEventListener("click", () => {
        const siteNum = card.dataset.site;
        const viewDate = document.getElementById("siteViewDate").value || todayStr();
        const existing = Reservations.getActiveForSite(siteNum, viewDate);

        if (existing) {
          Reservations.openModal(existing.id);
          return;
        }

        Reservations.openModal();
        const form = document.getElementById("reservationForm");
        form.siteNumber.value = siteNum;
        form.checkInDate.value = viewDate;
        Reservations.applySiteDefaults(form);
      });
    });
  },
};
