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
        if (document.getElementById('page-order')?.classList.contains('active')) {
            renderOrderPage();
        }
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

function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
            <p class="form-hint">Ürün görseli linki. Boş bırakılabilir.</p>
            <div class="img-preview" id="itemImagePreview"></div>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" id="itemPopular" style="width:auto">
            <label for="itemPopular" style="margin:0;font-weight:400">Popüler ürün olarak işaretle</label>
        </div>
        <button class="btn btn-primary" onclick="saveItem()">Ürünü Kaydet</button>
    `;
    bindImagePreview('itemImage', 'itemImagePreview');
    openModal();
}

function openEditItemModal(catId, itemId) {
    const cat = menuData.categories.find(c => c.id === catId);
    const item = cat.items.find(i => i.id === itemId);
    editingItem = { catId, itemId, wasAvailable: item.available };

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
            <input type="text" id="itemName" class="input" value="${escapeAttr(item.name)}">
        </div>
        <div class="form-group">
            <label>Açıklama</label>
            <input type="text" id="itemDescription" class="input" value="${escapeAttr(item.description)}">
        </div>
        <div class="form-group">
            <label>Fiyat (₺)</label>
            <input type="number" id="itemPrice" class="input" value="${item.price}" min="0" step="1">
        </div>
        <div class="form-group">
            <label>Fotoğraf URL</label>
            <input type="url" id="itemImage" class="input" value="${escapeAttr(item.image)}" placeholder="https://...">
            <p class="form-hint">Değiştirmek için yeni URL yapıştırın. Silmek için boşaltın.</p>
            <div class="img-preview" id="itemImagePreview"></div>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" id="itemPopular" style="width:auto" ${item.popular ? 'checked' : ''}>
            <label for="itemPopular" style="margin:0;font-weight:400">Popüler ürün olarak işaretle</label>
        </div>
        <button class="btn btn-primary" onclick="saveItem()">Değişiklikleri Kaydet</button>
    `;
    bindImagePreview('itemImage', 'itemImagePreview');
    updateImagePreview('itemImage', 'itemImagePreview');
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
        popular
    };

    try {
        if (editingItem) {
            item.available = editingItem.wasAvailable;
            item.categoryId = catId;
            const res = await fetch(`/api/menu/item/${editingItem.catId}/${editingItem.itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            if (!res.ok) throw new Error();
            showToast('Ürün güncellendi!');
        } else {
            item.available = true;
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
    grid.innerHTML = menuData.categories.map(cat => {
        const bannerHtml = cat.banner
            ? `<img class="category-card-banner" src="${cat.banner}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'category-card-banner empty',textContent:'Kapak fotoğrafı yok'}))">`
            : `<div class="category-card-banner empty">Kapak fotoğrafı yok</div>`;

        return `
        <div class="category-card">
            ${bannerHtml}
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
    `}).join('');
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
        <div class="form-group">
            <label>Kapak Fotoğrafı URL</label>
            <input type="url" id="catBanner" class="input" placeholder="https://... (kategori kartı görseli)">
            <p class="form-hint">Menüde kategori grid'inde görünen kare kapak fotoğrafı.</p>
            <div class="img-preview banner-preview" id="catBannerPreview"></div>
        </div>
        <button class="btn btn-primary" onclick="saveCategory()">Kategori Ekle</button>
    `;
    bindImagePreview('catBanner', 'catBannerPreview');
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
        <div class="form-group">
            <label>Kapak Fotoğrafı URL</label>
            <input type="url" id="catBanner" class="input" value="${cat.banner || ''}" placeholder="https://...">
            <p class="form-hint">Boş bırakırsanız sadece ikon görünür.</p>
            <div class="img-preview banner-preview" id="catBannerPreview"></div>
        </div>
        <button class="btn btn-primary" onclick="updateCategory('${catId}')">Kaydet</button>
    `;
    bindImagePreview('catBanner', 'catBannerPreview');
    updateImagePreview('catBanner', 'catBannerPreview');
    openModal();
}

async function saveCategory() {
    const name = document.getElementById('catName').value.trim();
    const icon = document.getElementById('catIcon').value.trim() || '📋';
    const banner = document.getElementById('catBanner').value.trim();

    if (!name) { showToast('Kategori adı zorunludur!', 'error'); return; }

    try {
        const res = await fetch('/api/menu/category', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, icon, banner })
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
    const banner = document.getElementById('catBanner').value.trim();

    if (!name) { showToast('Kategori adı zorunludur!', 'error'); return; }

    try {
        const res = await fetch(`/api/menu/category/${catId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, icon, banner })
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

// ========== ORDER ==========

let orderSelectedCatId = null;

function renderOrderPage() {
    if (!menuData?.categories?.length) {
        document.getElementById('orderCatList').innerHTML =
            '<li style="cursor:default;border:none;background:transparent;padding:8px 0;color:var(--text-muted)">Henüz kategori yok.</li>';
        clearOrderItems();
        return;
    }

    if (!orderSelectedCatId || !menuData.categories.some(c => c.id === orderSelectedCatId)) {
        orderSelectedCatId = menuData.categories[0].id;
    }

    renderOrderCategories();
    renderOrderItems(orderSelectedCatId);
}

function renderOrderCategories() {
    const list = document.getElementById('orderCatList');
    list.innerHTML = menuData.categories.map((cat, i) => `
        <li class="${cat.id === orderSelectedCatId ? 'selected' : ''}" onclick="selectOrderCategory('${cat.id}')">
            <span class="order-meta">${i + 1}</span>
            <span class="order-name">${cat.icon} ${cat.name}</span>
            <span class="order-meta">${cat.items.length} ürün</span>
            <div class="order-btns" onclick="event.stopPropagation()">
                <button type="button" ${i === 0 ? 'disabled' : ''} onclick="moveCategory(${i}, -1)" title="Yukarı">↑</button>
                <button type="button" ${i === menuData.categories.length - 1 ? 'disabled' : ''} onclick="moveCategory(${i}, 1)" title="Aşağı">↓</button>
            </div>
        </li>
    `).join('');
}

function selectOrderCategory(catId) {
    orderSelectedCatId = catId;
    renderOrderCategories();
    renderOrderItems(catId);
}

function renderOrderItems(catId) {
    const cat = menuData.categories.find(c => c.id === catId);
    if (!cat) {
        clearOrderItems();
        return;
    }

    document.getElementById('orderItemsTitle').textContent = `${cat.icon} ${cat.name}`;
    document.getElementById('orderItemsHint').textContent =
        `${cat.items.length} ürün — sırayı değiştirdikten sonra «Sırayı Kaydet» ile kaydedin.`;

    const list = document.getElementById('orderItemList');
    if (!cat.items.length) {
        list.innerHTML = '<li style="cursor:default;border:none;background:transparent;padding:8px 0;color:var(--text-muted)">Bu kategoride ürün yok.</li>';
        return;
    }

    list.innerHTML = cat.items.map((item, i) => `
        <li>
            <span class="order-meta">${i + 1}</span>
            <span class="order-name">${item.name}</span>
            <span class="order-meta">${item.price} ₺</span>
            <div class="order-btns">
                <button type="button" ${i === 0 ? 'disabled' : ''} onclick="moveItem(${i}, -1)" title="Yukarı">↑</button>
                <button type="button" ${i === cat.items.length - 1 ? 'disabled' : ''} onclick="moveItem(${i}, 1)" title="Aşağı">↓</button>
            </div>
        </li>
    `).join('');
}

function clearOrderItems() {
    document.getElementById('orderItemsTitle').textContent = 'Ürünler';
    document.getElementById('orderItemsHint').textContent = 'Soldan bir kategori seçin.';
    document.getElementById('orderItemList').innerHTML = '';
}

function moveCategory(index, dir) {
    const next = index + dir;
    if (next < 0 || next >= menuData.categories.length) return;
    const cats = menuData.categories;
    [cats[index], cats[next]] = [cats[next], cats[index]];
    cats.forEach((c, i) => { c.order = i; });
    renderOrderCategories();
}

function moveItem(index, dir) {
    const cat = menuData.categories.find(c => c.id === orderSelectedCatId);
    if (!cat) return;
    const next = index + dir;
    if (next < 0 || next >= cat.items.length) return;
    [cat.items[index], cat.items[next]] = [cat.items[next], cat.items[index]];
    cat.items.forEach((it, i) => { it.order = i; });
    renderOrderItems(orderSelectedCatId);
}

async function saveOrder() {
    const payload = {
        categories: menuData.categories.map(c => c.id),
        items: {}
    };
    menuData.categories.forEach(cat => {
        payload.items[cat.id] = cat.items.map(i => i.id);
    });

    try {
        const res = await fetch('/api/menu/order', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error();
        showToast('Sıralama kaydedildi!');
        await loadMenuData();
        renderOrderPage();
    } catch (err) {
        showToast('Sıralama kaydedilemedi!', 'error');
    }
}

async function createBackup() {
    try {
        const res = await fetch('/api/backup', { method: 'POST' });
        if (!res.ok) throw new Error();
        const data = await res.json();
        showToast(`Yedek alındı (${data.timestamp})`);
    } catch (err) {
        showToast('Yedek alınamadı!', 'error');
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
    if (r.cover) document.getElementById('settingCover').value = r.cover;
    updateImagePreview('settingCover', 'coverPreview');
    bindImagePreview('settingCover', 'coverPreview');
}

async function saveSettings() {
    const settings = {
        name: document.getElementById('settingName').value.trim(),
        address: document.getElementById('settingAddress').value.trim(),
        phone: document.getElementById('settingPhone').value.trim(),
        instagram: document.getElementById('settingInstagram').value.trim(),
        description: document.getElementById('settingDescription').value.trim(),
        cover: document.getElementById('settingCover').value.trim()
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

// ========== IMAGE PREVIEW ==========

function updateImagePreview(inputId, previewId) {
    const url = document.getElementById(inputId)?.value.trim();
    const box = document.getElementById(previewId);
    if (!box) return;
    box.innerHTML = url
        ? `<img src="${url}" alt="" onerror="this.parentElement.innerHTML='<span class=form-hint>Görsel yüklenemedi, URL kontrol edin.</span>'">`
        : '';
}

function bindImagePreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.previewBound) return;
    input.dataset.previewBound = '1';
    input.addEventListener('input', () => updateImagePreview(inputId, previewId));
}

// ========== QR CODE ==========

async function loadQR() {
    const urlEl = document.getElementById('qrUrl');
    const img = document.getElementById('qrImage');
    const imgPrint = document.getElementById('qrImagePrint');

    try {
        const res = await fetch('/api/qr-url');
        if (!res.ok) throw new Error('api');
        const data = await res.json();
        const menuUrl = data.url || window.location.origin;
        urlEl.textContent = menuUrl;

        const extUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(menuUrl)}&color=2c1810&bgcolor=ffffff&margin=10`;

        if (typeof QRCode !== 'undefined' && QRCode.toDataURL) {
            try {
                const dataUrl = await QRCode.toDataURL(menuUrl, {
                    width: 400,
                    margin: 2,
                    color: { dark: '#2c1810', light: '#ffffff' }
                });
                img.src = dataUrl;
                imgPrint.src = dataUrl;
                img.dataset.download = dataUrl;
            } catch {
                img.src = extUrl;
                imgPrint.src = extUrl;
            }
        } else {
            img.src = extUrl;
            imgPrint.src = extUrl;
        }
    } catch (err) {
        const fallbackUrl = window.location.origin;
        urlEl.textContent = fallbackUrl;
        const extUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(fallbackUrl)}&color=2c1810&bgcolor=ffffff&margin=10`;
        img.src = extUrl;
        imgPrint.src = extUrl;
    }
}

function downloadQR() {
    const img = document.getElementById('qrImage');
    const src = img.dataset.download || img.src;
    if (!src) { showToast('QR kod henüz oluşturulmadı', 'error'); return; }
    const a = document.createElement('a');
    a.href = src;
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

    if (page === 'order' && menuData) renderOrderPage();

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
