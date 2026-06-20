const Categories = {
  editingName: null,

  init() {
    document.getElementById("btnAddCategory").addEventListener("click", () => this.openModal());
    document.getElementById("categoryForm").addEventListener("submit", (e) => this.save(e));
    document.querySelectorAll(".product-tab").forEach((tab) => {
      tab.addEventListener("click", () => this.switchTab(tab.dataset.tab));
    });
  },

  switchTab(tab) {
    document.querySelectorAll(".product-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === tab);
    });
    document.getElementById("productTabProducts").classList.toggle("hidden", tab !== "products");
    document.getElementById("productTabCategories").classList.toggle("hidden", tab !== "categories");
  },

  getProductCount(name) {
    return Storage.getProducts().filter((p) => p.category === name).length;
  },

  render() {
    const tbody = document.getElementById("categoryBody");
    const list = Storage.getCategories();

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--muted)">등록된 카테고리가 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((name) => {
        const count = this.getProductCount(name);
        return `<tr>
          <td><strong>${name}</strong></td>
          <td>${count}개</td>
          <td>
            <button class="btn sm" data-edit-cat="${name}">수정</button>
            <button class="btn sm danger" data-del-cat="${name}" ${count > 0 ? "title='상품이 있으면 삭제 불가'" : ""}>삭제</button>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("[data-edit-cat]").forEach((btn) => {
      btn.addEventListener("click", () => this.openModal(btn.dataset.editCat));
    });
    tbody.querySelectorAll("[data-del-cat]").forEach((btn) => {
      btn.addEventListener("click", () => this.remove(btn.dataset.delCat));
    });
  },

  openModal(name) {
    const modal = document.getElementById("categoryModal");
    const form = document.getElementById("categoryForm");
    form.reset();
    this.editingName = name || null;
    document.getElementById("categoryModalTitle").textContent = name ? "카테고리 수정" : "카테고리 추가";
    if (name) form.name.value = name;
    modal.showModal();
  },

  save(e) {
    e.preventDefault();
    const form = e.target;
    const newName = form.name.value.trim();
    if (!newName) return;

    let list = Storage.getCategories();

    if (this.editingName) {
      if (this.editingName !== newName && list.includes(newName)) {
        showToast("이미 존재하는 카테고리입니다.");
        return;
      }
      list = list.map((c) => (c === this.editingName ? newName : c));
      if (this.editingName !== newName) {
        const products = Storage.getProducts().map((p) =>
          p.category === this.editingName ? { ...p, category: newName } : p
        );
        Storage.saveProducts(products);
      }
    } else {
      if (list.includes(newName)) {
        showToast("이미 존재하는 카테고리입니다.");
        return;
      }
      list.push(newName);
    }

    Storage.saveCategories(list);
    document.getElementById("categoryModal").close();
    showToast(this.editingName ? "카테고리가 수정되었습니다." : "카테고리가 추가되었습니다.");
    this.render();
    Products.render();
    POS.render();
  },

  remove(name) {
    const count = this.getProductCount(name);
    if (count > 0) {
      showToast(`'${name}'에 상품 ${count}개가 있어 삭제할 수 없습니다.`);
      return;
    }
    if (!confirm(`'${name}' 카테고리를 삭제하시겠습니까?`)) return;
    Storage.saveCategories(Storage.getCategories().filter((c) => c !== name));
    showToast("카테고리가 삭제되었습니다.");
    this.render();
  },
};
