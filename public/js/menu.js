let D;
let currentCat = null;
const itemStore = [];

const pages = {
    cover: document.getElementById('pageCover'),
    cats: document.getElementById('pageCats'),
    items: document.getElementById('pageItems'),
    detail: document.getElementById('pageDetail')
};

document.addEventListener('DOMContentLoaded', async () => {
    wire();
    try {
        const r = await fetch('/api/menu');
        D = await r.json();
        renderCover();
        renderCategories();
        document.getElementById('loader').classList.add('done');
    } catch {
        document.getElementById('loader').innerHTML =
            '<p style="color:#a33;font-size:14px">Menü yüklenemedi.</p>';
    }
});

function wire() {
    document.getElementById('btnMenu').onclick = () => showPage('cats');
    document.getElementById('backCover').onclick = () => showPage('cover');
    document.getElementById('backCats').onclick = () => showPage('cats');
    document.getElementById('backItems').onclick = () => showPage('items');

    window.addEventListener('orientationchange', checkOrient);
    window.addEventListener('resize', checkOrient);
    checkOrient();
}

function checkOrient() {
    const o = document.getElementById('orient');
    const landscape = window.innerWidth > window.innerHeight && window.innerHeight < 500;
    o.style.display = landscape ? 'block' : 'none';
}

function showPage(name) {
    Object.values(pages).forEach(p => p.classList.add('hide'));
    pages[name].classList.remove('hide');
    document.getElementById('app').scrollTop = 0;
}

function renderCover() {
    const r = D.restaurant || {};
    const name = r.name || 'NOA caffé & co';

    document.getElementById('coverName').textContent = name;
    document.getElementById('orientName').textContent = name;

    const coverEl = document.getElementById('coverBg');
    const coverUrl = r.cover || r.banner || '';
    if (coverUrl) {
        coverEl.innerHTML = `<div style="background-image:url('${coverUrl}')"></div>`;
    } else {
        coverEl.innerHTML = `<div style="background:linear-gradient(180deg,rgba(59,37,22,.3) 0%,rgba(59,37,22,.85) 100%),url('/logo.png') center 30%/120px no-repeat,var(--backbtncolor)"></div>`;
    }

    if (r.description) {
        document.getElementById('menuNote').textContent =
            'Güncel menümüze buradan ulaşabilirsiniz. ' + r.description;
    }
}

function renderCategories() {
    const ul = document.getElementById('catGrid');
    ul.innerHTML = D.categories.map(cat => {
        const count = cat.items.filter(i => i.available !== false).length;
        if (!count) return '';

        const img = cat.banner
            ? `<img class="cat-img" src="${cat.banner}" alt="" loading="lazy">`
            : `<div class="cat-placeholder"><span>${cat.icon || '📋'}</span></div>`;

        return `<li data-id="${cat.id}">
            ${img}
            <h2>${cat.name}</h2>
        </li>`;
    }).join('');

    ul.querySelectorAll('li').forEach(li => {
        li.onclick = () => openCategory(li.dataset.id);
        const img = li.querySelector('.cat-img');
        if (img) {
            img.onerror = () => {
                const icon = D.categories.find(c => c.id === li.dataset.id)?.icon || '📋';
                const ph = document.createElement('div');
                ph.className = 'cat-placeholder';
                ph.innerHTML = `<span>${icon}</span>`;
                img.replaceWith(ph);
            };
        }
    });
}

function openCategory(id) {
    currentCat = D.categories.find(c => c.id === id);
    if (!currentCat) return;

    itemStore.length = 0;

    document.getElementById('itemsTopTitle').textContent = currentCat.name;
    document.getElementById('grpTitle').textContent = currentCat.name;

    const ul = document.getElementById('itemList');
    const available = currentCat.items.filter(i => i.available !== false);

    ul.innerHTML = available.map(it => {
        const idx = storeItem(it, currentCat);
        const img = it.image
            ? `<img src="${it.image}" alt="" loading="lazy" onerror="this.remove()">`
            : '';
        const desc = it.description
            ? `<h5 class="udetay">${it.description}</h5>` : '';

        return `<li data-idx="${idx}">
            ${img}
            <h2>${it.name}</h2>
            <span class="price">${it.price} ₺</span>
            ${desc}
        </li>`;
    }).join('');

    ul.querySelectorAll('li').forEach(li => {
        li.onclick = () => openDetail(+li.dataset.idx);
    });

    showPage('items');
}

function storeItem(item, cat) {
    const idx = itemStore.length;
    itemStore.push({
        name: item.name,
        description: item.description || '',
        price: item.price,
        image: item.image || '',
        catName: cat.name,
        catIcon: cat.icon || ''
    });
    return idx;
}

function openDetail(idx) {
    const d = itemStore[idx];
    if (!d) return;

    let html = '';
    if (d.image) {
        html += `<img src="${d.image}" alt="${d.name}" onerror="this.remove()">`;
    }
    html += `<span class="dcat">${d.catIcon} ${d.catName}</span>`;
    html += `<h1>${d.name}</h1>`;
    if (d.description) html += `<p>${d.description}</p>`;
    html += `<div class="dprice">${d.price} ₺</div>`;

    document.getElementById('detailBox').innerHTML = html;
    showPage('detail');
}
