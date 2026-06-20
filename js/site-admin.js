const SiteAdmin = {
  editingSiteId: null,
  editingTypeId: null,

  init() {
    document.getElementById("btnAddSite").addEventListener("click", () => this.openSiteModal());
    document.getElementById("btnAddSiteType").addEventListener("click", () => this.openTypeModal());
    document.getElementById("siteForm").addEventListener("submit", (e) => this.saveSite(e));
    document.getElementById("siteTypeForm").addEventListener("submit", (e) => this.saveType(e));
    document.getElementById("btnSaveExtraGuestPrices")?.addEventListener("click", () => this.saveExtraGuestPrices());
    document.querySelectorAll(".site-admin-tab").forEach((tab) => {
      tab.addEventListener("click", () => this.switchTab(tab.dataset.tab));
    });
    document.getElementById("siteFormType").addEventListener("change", (e) => {
      if (!this.editingSiteId) {
        e.target.form.price.value = defaultSitePrice(e.target.value);
      }
    });
  },

  switchTab(tab) {
    document.querySelectorAll(".site-admin-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === tab);
    });
    document.getElementById("siteTabSites").classList.toggle("hidden", tab !== "sites");
    document.getElementById("siteTabTypes").classList.toggle("hidden", tab !== "types");
    document.getElementById("siteTabExtraGuests")?.classList.toggle("hidden", tab !== "extra-guests");
  },

  getTypeOptions(selected) {
    return Storage.getSiteTypes()
      .map((t) => `<option value="${t.name}" ${t.name === selected ? "selected" : ""}>${t.name}</option>`)
      .join("");
  },

  render() {
    this.renderSites();
    this.renderTypes();
    this.renderExtraGuests();
  },

  renderSites() {
    const tbody = document.getElementById("siteAdminBody");
    const filter = document.getElementById("siteAdminFilter")?.value || "";
    let sites = Storage.getSites();
    if (filter) sites = sites.filter((s) => normalizeSiteType(s.type) === filter);
    sites = sites.sort((a, b) => {
      const byType = compareKo(normalizeSiteType(a.type), normalizeSiteType(b.type));
      if (byType !== 0) return byType;
      return compareKo(a.number, b.number);
    });

    if (!sites.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted)">등록된 사이트가 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = sites
      .map((site) => {
        const active = site.active !== false;
        const type = normalizeSiteType(site.type);
        return `<tr class="${active ? "" : "inactive-row"}">
          <td><strong>${site.number}</strong></td>
          <td><span class="badge ${typeBadgeClass(type)}">${type}</span></td>
          <td>${formatMoney(site.price)}</td>
          <td><span class="badge ${active ? "pos" : "excel"}">${active ? "사용" : "미사용"}</span></td>
          <td>
            <button class="btn sm" data-edit-site="${site.id}">수정</button>
            <button class="btn sm danger" data-del-site="${site.id}">삭제</button>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("[data-edit-site]").forEach((btn) => {
      btn.addEventListener("click", () => this.openSiteModal(btn.dataset.editSite));
    });
    tbody.querySelectorAll("[data-del-site]").forEach((btn) => {
      btn.addEventListener("click", () => this.removeSite(btn.dataset.delSite));
    });
  },

  renderTypes() {
    const tbody = document.getElementById("siteTypeBody");
    const types = Storage.getSiteTypes();
    const sites = Storage.getSites();

    if (!types.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--muted)">등록된 타입이 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = types
      .map((type) => {
        const count = sites.filter((s) => normalizeSiteType(s.type) === type.name).length;
        return `<tr>
          <td><strong>${type.name}</strong></td>
          <td>${count}개</td>
          <td>
            <button class="btn sm" data-edit-type="${type.id}">수정</button>
            <button class="btn sm danger" data-del-type="${type.id}">삭제</button>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("[data-edit-type]").forEach((btn) => {
      btn.addEventListener("click", () => this.openTypeModal(btn.dataset.editType));
    });
    tbody.querySelectorAll("[data-del-type]").forEach((btn) => {
      btn.addEventListener("click", () => this.removeType(btn.dataset.delType));
    });
  },

  renderExtraGuests() {
    const tbody = document.getElementById("extraGuestBody");
    if (!tbody) return;
    const types = Storage.getSiteTypes();

    if (!types.length) {
      tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--muted)">등록된 타입이 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = types
      .map((type) => {
        const price = type.extraGuestPrice ?? defaultExtraGuestPrice(type.name);
        return `<tr>
          <td><strong>${type.name}</strong></td>
          <td>
            <input type="number" class="input extra-guest-price-input" data-type-id="${type.id}" min="0" step="1000" value="${price}">
          </td>
        </tr>`;
      })
      .join("");
  },

  saveExtraGuestPrices() {
    const inputs = document.querySelectorAll(".extra-guest-price-input");
    if (!inputs.length) return;

    const priceById = new Map(
      [...inputs].map((input) => [input.dataset.typeId, Number(input.value) || 0])
    );

    const types = Storage.getSiteTypes().map((t) => ({
      ...t,
      extraGuestPrice: priceById.has(t.id) ? priceById.get(t.id) : t.extraGuestPrice ?? 0,
    }));

    Storage.saveSiteTypes(types);
    showToast("추가인원 요금이 저장되었습니다.");
    this.renderExtraGuests();
  },

  openSiteModal(id) {
    const modal = document.getElementById("siteModal");
    const form = document.getElementById("siteForm");
    form.reset();
    this.editingSiteId = id || null;

    const typeSelect = document.getElementById("siteFormType");
    typeSelect.innerHTML = this.getTypeOptions();

    if (id) {
      const site = Storage.getSites().find((s) => s.id === id);
      if (!site) return;
      document.getElementById("siteModalTitle").textContent = "사이트 수정";
      form.number.value = site.number;
      typeSelect.innerHTML = this.getTypeOptions(normalizeSiteType(site.type));
      form.price.value = site.price || 0;
      form.active.checked = site.active !== false;
    } else {
      document.getElementById("siteModalTitle").textContent = "사이트 추가";
      form.active.checked = true;
      if (typeSelect.options.length) {
        typeSelect.dispatchEvent(new Event("change"));
      }
    }

    modal.showModal();
  },

  saveSite(e) {
    e.preventDefault();
    const form = e.target;
    const number = form.number.value.trim();
    const type = normalizeSiteType(form.type.value);
    const price = Number(form.price.value) || defaultSitePrice(type);
    const active = form.active.checked;

    if (!number || !type) return;

    let sites = Storage.getSites();
    const duplicate = sites.find((s) => s.number === number && s.id !== this.editingSiteId);
    if (duplicate) {
      showToast("이미 사용 중인 사이트 번호입니다.");
      return;
    }

    if (this.editingSiteId) {
      sites = sites.map((s) =>
        s.id === this.editingSiteId ? { ...s, number, type, price, active } : s
      );
    } else {
      sites.push({ id: uid(), number, type, price, active });
    }

    Storage.saveSites(sites);
    document.getElementById("siteModal").close();
    showToast(this.editingSiteId ? "사이트가 수정되었습니다." : "사이트가 추가되었습니다.");
    this.render();
    Sites.render();
    Reservations.refreshSiteSelect();
  },

  removeSite(id) {
    const site = Storage.getSites().find((s) => s.id === id);
    if (!site) return;
    const inUse = Storage.getReservations().some((r) => String(r.siteNumber) === String(site.number));
    if (inUse) {
      showToast("예약이 있는 사이트는 삭제할 수 없습니다.");
      return;
    }
    if (!confirm(`${site.number}번 사이트를 삭제하시겠습니까?`)) return;
    Storage.saveSites(Storage.getSites().filter((s) => s.id !== id));
    showToast("사이트가 삭제되었습니다.");
    this.render();
    Sites.render();
    Reservations.refreshSiteSelect();
  },

  openTypeModal(id) {
    const modal = document.getElementById("siteTypeModal");
    const form = document.getElementById("siteTypeForm");
    form.reset();
    this.editingTypeId = id || null;

    if (id) {
      const type = Storage.getSiteTypes().find((t) => t.id === id);
      if (!type) return;
      document.getElementById("siteTypeModalTitle").textContent = "타입 수정";
      form.name.value = type.name;
    } else {
      document.getElementById("siteTypeModalTitle").textContent = "타입 추가";
    }

    modal.showModal();
  },

  saveType(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim();
    if (!name) return;

    let types = Storage.getSiteTypes();
    const oldType = this.editingTypeId ? types.find((t) => t.id === this.editingTypeId) : null;

    if (this.editingTypeId) {
      if (oldType && oldType.name !== name && types.some((t) => t.name === name)) {
        showToast("이미 존재하는 타입명입니다.");
        return;
      }
      types = types.map((t) => (t.id === this.editingTypeId ? { ...t, name } : t));
      if (oldType && oldType.name !== name) {
        const sites = Storage.getSites().map((s) =>
          normalizeSiteType(s.type) === oldType.name ? { ...s, type: name } : s
        );
        Storage.saveSites(sites);
        const reservations = Storage.getReservations().map((r) =>
          normalizeSiteType(r.type) === oldType.name ? { ...r, type: name } : r
        );
        Storage.saveReservations(reservations);
      }
    } else {
      if (types.some((t) => t.name === name)) {
        showToast("이미 존재하는 타입명입니다.");
        return;
      }
      types.push({ id: uid(), name, extraGuestPrice: defaultExtraGuestPrice(name) });
    }

    Storage.saveSiteTypes(types);
    document.getElementById("siteTypeModal").close();
    showToast(this.editingTypeId ? "타입이 수정되었습니다." : "타입이 추가되었습니다.");
    this.render();
    Sites.render();
    Reservations.refreshSiteSelect();
  },

  removeType(id) {
    const type = Storage.getSiteTypes().find((t) => t.id === id);
    if (!type) return;
    const count = Storage.getSites().filter((s) => normalizeSiteType(s.type) === type.name).length;
    if (count > 0) {
      showToast(`'${type.name}' 타입 사이트 ${count}개가 있어 삭제할 수 없습니다.`);
      return;
    }
    if (!confirm(`'${type.name}' 타입을 삭제하시겠습니까?`)) return;
    Storage.saveSiteTypes(Storage.getSiteTypes().filter((t) => t.id !== id));
    showToast("타입이 삭제되었습니다.");
    this.render();
  },
};
