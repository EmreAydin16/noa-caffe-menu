let menuData = null;
let editingItem = null;

document.addEventListener('DOMContentLoaded', () => {
    loadMenuData();
    loadQR();
});

async function loadMenuData() {
    try {
        const res = await fetch('/api/menu');
        menuData = await res.json();
        renderMenuTable();
        renderCategoriesGrid();
        populateCategoryFilter();
        populateSettings();
    } catch (err) {
        showToast('Menü yüklenemedi!', 'error');
    }
}

// ========== MENU TABLE ==========

function renderMenuTable() {
    const tbody = document.getElementById('menuTableBody');
    const filter = document.getElementById('categoryFilter').value;
    const search = document.getElementById('searchInput').value.toLowerCase();

    let rows = '';
    menuData.categories.forEach(cat => {
        cat.items.forEach(item => {
            if (filter !== 'all' && cat.id !== filter) return;
            if (search && !item.name.toLowerCase().includes(search) && !item.description.toLowerCase().includes(search)) return;

            const thumb = item.image
                ? `<img src="${item.image}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;margin-right:8px;vertical-align:middle">`
                : '';

            rows += `
                <tr>
                    <td>${thumb}<strong>${item.name}</strong></td>
                    <td>${item.description || '-'}</td>
                    <td><span style="color:var(--text-secondary)">${cat.icon} ${cat.name}</span></td>
                    <td><strong>${item.price} ₺</strong></td>
                    <td>
                        <span class="status-badge ${item.available ? 'status-active' : 'status-inactive'}" 
                              style="cursor:pointer" 
                              onclick="toggleAvailability('${cat.id}','${item.id}')">
                            ${item.available ? '✓ Aktif' : '✕ Pasif'}
                        </span>
                    </td>
                    <td>
                        <div class="action-btns">
                            <button class="btn btn-sm btn-outline" onclick="openEditItemModal('${cat.id}','${item.id}')">✏️</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteItem('${cat.id}','${item.id}')">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        });
    });

    tbody.innerHTML = rows || '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">Ürün bulunamadı</td></tr>';
}

function filterItems() {
    renderMenuTable();
}

function populateCategoryFilter() {
    const sel = document.getElementById('categoryFilter');
    sel.innerHTML = '<option value="all">Tüm Kategoriler</option>';
    menuData.categories.forEach(cat => {
        sel.innerHTML += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
    });
}

// ========== ADD / EDIT ITEM ==========

function openAddItemModal() {
    editingItem = null;
    document.getElementById('modalTitle').textContent = 'Yeni Ürün Ekle';

    const catOptions = menuData.categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');

    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label>Kategori</label>
            <select id="itemCategory" class="input">${catOptions}</select>
        </div>
        <div class="form-group">
            <label>Ürün Adı</label>
            <input type="text" id="itemName" class="input" placeholder="Ör: Cappuccino">
        </div>
        <div class="form-group">
            <label>Açıklama</label>
            <input type="text" id="itemDescription" class="input" placeholder="Ör: Espresso + süt köpüğü">
        </div>
        <div class="form-group">
            <label>Fiyat (₺)</label>
            <input type="number" id="itemPrice" class="input" placeholder="85" min="0" step="1">
        </div>
        <div class="form-group">
            <label>Fotoğraf URL</label>
            <input type="url" id="itemImage" class="input" placeholder="https://... (opsiyonel)">
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" id="itemPopular" style="width:auto">
            <label for="itemPopular" style="margin:0;font-weight:400">Popüler ürün olarak işaretle</label>
        </div>
        <button class="btn btn-primary" onclick="saveItem()">Ürünü Kaydet</button>
    `;
    openModal();
}

function openEditItemModal(catId, itemId) {
    const cat = menuData.categories.find(c => c.id === catId);
    const item = cat.items.find(i => i.id === itemId);
    editingItem = { catId, itemId };

    document.getElementById('modalTitle').textContent = 'Ürünü Düzenle';
    const catOptions = menuData.categories.map(c =>
        `<option value="${c.id}" ${c.id === catId ? 'selected' : ''}>${c.icon} ${c.name}</option>`
    ).join('');

    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label>Kategori</label>
            <select id="itemCategory" class="input">${catOptions}</select>
        </div>
        <div class="form-group">
            <label>Ürün Adı</label>
            <input type="text" id="itemName" class="input" value="${item.name}">
        </div>
        <div class="form-group">
            <label>Açıklama</label>
            <input type="text" id="itemDescription" class="input" value="${item.description || ''}">
        </div>
        <div class="form-group">
            <label>Fiyat (₺)</label>
            <input type="number" id="itemPrice" class="input" value="${item.price}" min="0" step="1">
        </div>
        <div class="form-group">
            <label>Fotoğraf URL</label>
            <input type="url" id="itemImage" class="input" value="${item.image || ''}" placeholder="https://...">
            ${item.image ? `<img src="${item.image}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;margin-top:6px">` : ''}
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" id="itemPopular" style="width:auto" ${item.popular ? 'checked' : ''}>
            <label for="itemPopular" style="margin:0;font-weight:400">Popüler ürün olarak işaretle</label>
        </div>
        <button class="btn btn-primary" onclick="saveItem()">Değişiklikleri Kaydet</button>
    `;
    openModal();
}

async function saveItem() {
    const catId = document.getElementById('itemCategory').value;
    const name = document.getElementById('itemName').value.trim();
    const description = document.getElementById('itemDescription').value.trim();
    const price = parseInt(document.getElementById('itemPrice').value);
    const image = document.getElementById('itemImage').value.trim();
    const popular = document.getElementById('itemPopular').checked;

    if (!name || !price) {
        showToast('Ürün adı ve fiyat zorunludur!', 'error');
        return;
    }

    const item = {
        name,
        description,
        price,
        image,
        popular,
        available: true
    };

    try {
        if (editingItem) {
            const res = await fetch(`/api/menu/item/${editingItem.catId}/${editingItem.itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...item, categoryId: catId })
            });
            if (!res.ok) throw new Error();
            showToast('Ürün güncellendi!');
        } else {
            const res = await fetch(`/api/menu/item/${catId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            if (!res.ok) throw new Error();
            showToast('Yeni ürün eklendi!');
        }
        closeModal();
        await loadMenuData();
    } catch (err) {
        showToast('İşlem başarısız!', 'error');
    }
}

async function deleteItem(catId, itemId) {
    const cat = menuData.categories.find(c => c.id === catId);
    const item = cat.items.find(i => i.id === itemId);

    if (!confirm(`"${item.name}" ürününü silmek istediğinize emin misiniz?`)) return;

    try {
        const res = await fetch(`/api/menu/item/${catId}/${itemId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        showToast('Ürün silindi!');
        await loadMenuData();
    } catch (err) {
        showToast('Silme işlemi başarısız!', 'error');
    }
}

async function toggleAvailability(catId, itemId) {
    const cat = menuData.categories.find(c => c.id === catId);
    const item = cat.items.find(i => i.id === itemId);

    try {
        const res = await fetch(`/api/menu/item/${catId}/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ available: !item.available })
        });
        if (!res.ok) throw new Error();
        showToast(item.available ? 'Ürün pasif yapıldı' : 'Ürün aktif yapıldı');
        await loadMenuData();
    } catch (err) {
        showToast('İşlem başarısız!', 'error');
    }
}

// ========== CATEGORIES ==========

function renderCategoriesGrid() {
    const grid = document.getElementById('categoriesGrid');
    grid.innerHTML = menuData.categories.map(cat => `
        <div class="category-card">
            <div class="category-card-header">
                <div class="category-card-icon">${cat.icon}</div>
                <div>
                    <div class="category-card-name">${cat.name}</div>
                    <div class="category-card-count">${cat.items.length} ürün</div>
                </div>
            </div>
            <div class="category-card-actions">
                <button class="btn btn-sm btn-outline" onclick="openEditCategoryModal('${cat.id}')">✏️ Düzenle</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCategory('${cat.id}')">🗑️ Sil</button>
            </div>
        </div>
    `).join('');
}

function openAddCategoryModal() {
    document.getElementById('modalTitle').textContent = 'Yeni Kategori Ekle';
    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label>Kategori Adı</label>
            <input type="text" id="catName" class="input" placeholder="Ör: Kahvaltı">
        </div>
        <div class="form-group">
            <label>İkon (emoji)</label>
            <input type="text" id="catIcon" class="input" placeholder="Ör: 🥐" maxlength="4">
        </div>
        <button class="btn btn-primary" onclick="saveCategory()">Kategori Ekle</button>
    `;
    openModal();
}

function openEditCategoryModal(catId) {
    const cat = menuData.categories.find(c => c.id === catId);
    document.getElementById('modalTitle').textContent = 'Kategori Düzenle';
    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label>Kategori Adı</label>
            <input type="text" id="catName" class="input" value="${cat.name}">
        </div>
        <div class="form-group">
            <label>İkon (emoji)</label>
            <input type="text" id="catIcon" class="input" value="${cat.icon}" maxlength="4">
        </div>
        <button class="btn btn-primary" onclick="updateCategory('${catId}')">Kaydet</button>
    `;
    openModal();
}

async function saveCategory() {
    const name = document.getElementById('catName').value.trim();
    const icon = document.getElementById('catIcon').value.trim() || '📋';

    if (!name) { showToast('Kategori adı zorunludur!', 'error'); return; }

    try {
        const res = await fetch('/api/menu/category', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, icon })
        });
        if (!res.ok) throw new Error();
        showToast('Kategori eklendi!');
        closeModal();
        await loadMenuData();
    } catch (err) {
        showToast('İşlem başarısız!', 'error');
    }
}

async function updateCategory(catId) {
    const name = document.getElementById('catName').value.trim();
    const icon = document.getElementById('catIcon').value.trim();

    if (!name) { showToast('Kategori adı zorunludur!', 'error'); return; }

    try {
        const res = await fetch(`/api/menu/category/${catId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, icon })
        });
        if (!res.ok) throw new Error();
        showToast('Kategori güncellendi!');
        closeModal();
        await loadMenuData();
    } catch (err) {
        showToast('İşlem başarısız!', 'error');
    }
}

async function deleteCategory(catId) {
    const cat = menuData.categories.find(c => c.id === catId);
    if (!confirm(`"${cat.name}" kategorisini ve içindeki tüm ürünleri silmek istediğinize emin misiniz?`)) return;

    try {
        const res = await fetch(`/api/menu/category/${catId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        showToast('Kategori silindi!');
        await loadMenuData();
    } catch (err) {
        showToast('Silme başarısız!', 'error');
    }
}

// ========== SETTINGS ==========

function populateSettings() {
    const r = menuData.restaurant;
    if (r.name) document.getElementById('settingName').value = r.name;
    if (r.address) document.getElementById('settingAddress').value = r.address;
    if (r.phone) document.getElementById('settingPhone').value = r.phone;
    if (r.instagram) document.getElementById('settingInstagram').value = r.instagram;
    if (r.description) document.getElementById('settingDescription').value = r.description;
}

async function saveSettings() {
    const settings = {
        name: document.getElementById('settingName').value.trim(),
        address: document.getElementById('settingAddress').value.trim(),
        phone: document.getElementById('settingPhone').value.trim(),
        instagram: document.getElementById('settingInstagram').value.trim(),
        description: document.getElementById('settingDescription').value.trim()
    };

    try {
        const res = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        if (!res.ok) throw new Error();
        showToast('Ayarlar kaydedildi!');
        await loadMenuData();
    } catch (err) {
        showToast('Kaydetme başarısız!', 'error');
    }
}

// ========== QR CODE ==========

async function loadQR() {
    try {
        const res = await fetch('/api/qr-url');
        const data = await res.json();
        document.getElementById('qrUrl').textContent = data.url;
        document.getElementById('qrImage').src = data.qrApiUrl;
        document.getElementById('qrImagePrint').src = data.qrApiUrl;
    } catch (err) {
        document.getElementById('qrUrl').textContent = 'QR kod oluşturulamadı';
    }
}

function downloadQR() {
    const img = document.getElementById('qrImage');
    const a = document.createElement('a');
    a.href = img.src;
    a.download = 'noa-caffe-qr-menu.png';
    a.click();
}

function printTableCard() {
    const card = document.getElementById('qrPrintPreview').innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
        <html>
        <head>
            <title>Masa Kartı - Noa Caffe & Co</title>
            <style>
                body { display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; font-family:Arial,sans-serif; }
                .print-card { text-align:center; padding:40px 30px; border:2px solid #ddd; border-radius:20px; max-width:300px; }
                .print-logo { width:60px; height:60px; }
                h2 { font-size:1.3rem; margin:10px 0 4px; }
                .print-subtitle { font-size:0.85rem; color:#666; margin-bottom:20px; }
                .print-qr { max-width:180px; }
                .print-wifi { font-size:0.8rem; color:#999; margin-top:16px; }
            </style>
        </head>
        <body>${card}</body>
        </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
}

// ========== PAGE NAV ==========

function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    document.getElementById(`page-${page}`).classList.add('active');
    document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');

    closeSidebar();
}

// ========== MODAL ==========

function openModal() {
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
    editingItem = null;
}

// ========== SIDEBAR ==========

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');

    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.onclick = closeSidebar;
        document.body.appendChild(overlay);
    }
    overlay.classList.toggle('active', sidebar.classList.contains('open'));
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.classList.remove('active');
}

// ========== TOAST ==========

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
