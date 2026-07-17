let D;
let currentCat = null;
let mainScroll = 0;
let listScroll = 0;
let tabmenuOpen = false;
let listStore = [];
let searchStore = [];

const PAGES = {
    start: document.getElementById('pageStart'),
    main: document.getElementById('pageMain'),
    list: document.getElementById('pageList'),
    urun: document.getElementById('pageUrun')
};

document.addEventListener('DOMContentLoaded', async () => {
    wire();
    try {
        const r = await fetch('/api/menu');
        D = await r.json();
        renderCover();
        renderCategories();
        buildSearchIndex();
        document.getElementById('loader').classList.add('done');
    } catch {
        document.getElementById('loader').innerHTML =
            '<p style="color:#a33;font-size:14px;padding:20px">Menü yüklenemedi.</p>';
    }
});

function wire() {
    const app = document.getElementById('app');

    document.getElementById('gosipa').onclick = () => loadPage('main');
    document.getElementById('cover').onclick = () => {
        if (!tabmenuOpen) loadPage('main');
    };
    document.getElementById('gotabmenu').onclick = e => {
        e.stopPropagation();
        toggleTabmenu();
    };
    document.getElementById('tabGoMenu').onclick = () => {
        closeTabmenu();
        loadPage('main');
    };

    document.getElementById('backStart').onclick = () => loadPage('start');
    document.getElementById('backMain').onclick = () => {
        loadPage('main', { scroll: listScroll });
    };
    document.getElementById('backList').onclick = () => loadPage('list');

    document.getElementById('btnSearch').onclick = openSearch;
    document.getElementById('searchClose').onclick = closeSearch;
    document.getElementById('txtsearch').addEventListener('input', filterSearch);

    document.getElementById('navToggle').onclick = toggleSideNav;

    window.addEventListener('orientationchange', checkOrient);
    window.addEventListener('resize', checkOrient);
    checkOrient();
}

function checkOrient() {
    const landscape = window.innerWidth > window.innerHeight && window.innerHeight < 500;
    document.getElementById('orient').style.display = landscape ? 'block' : 'none';
}

/* ===== Sayfa geçişi (menucebimde loadPage) ===== */
function loadPage(name, opts = {}) {
    const overlay = document.getElementById('overlay');
    overlay.classList.add('show');

    setTimeout(() => {
        if (PAGES.main && !PAGES.main.classList.contains('hide')) {
            mainScroll = document.getElementById('app').scrollTop;
        }

        Object.values(PAGES).forEach(p => p.classList.add('hide'));
        closeTabmenu();
        closeSideNav();
        closeSearch();

        PAGES[name].classList.remove('hide');

        const app = document.getElementById('app');
        if (opts.scroll !== undefined) {
            app.scrollTop = opts.scroll;
        } else {
            app.scrollTop = 0;
        }

        setTimeout(() => overlay.classList.remove('show'), 80);
    }, 180);
}

/* ===== Tabmenu ===== */
function toggleTabmenu() {
    tabmenuOpen = !tabmenuOpen;
    document.getElementById('tabmenu').classList.toggle('hide', !tabmenuOpen);
    document.getElementById('pageStart').classList.toggle('openned', tabmenuOpen);
}
function closeTabmenu() {
    tabmenuOpen = false;
    document.getElementById('tabmenu').classList.add('hide');
    document.getElementById('pageStart').classList.remove('openned');
}

/* ===== Side nav ===== */
function toggleSideNav() {
    document.getElementById('headbarMain').classList.toggle('nav--open');
    const menu = document.getElementById('sideNav');
    menu.hidden = !menu.hidden;
}
function closeSideNav() {
    document.getElementById('headbarMain').classList.remove('nav--open');
    document.getElementById('sideNav').hidden = true;
}

/* ===== Kapak ===== */
function renderCover() {
    const r = D.restaurant || {};
    const name = r.name || 'NOA caffé & co';

    document.getElementById('coverName').textContent = name;
    document.getElementById('orientName').textContent = name;

    const coverUrl = r.cover || r.banner || '';
    const cover = document.getElementById('cover');
    if (coverUrl) {
        cover.innerHTML = `<div style="background-image:url('${coverUrl}')"></div>`;
    } else {
        cover.innerHTML = `<div style="background:linear-gradient(180deg,rgba(59,37,22,.25) 0%,rgba(59,37,22,.88) 100%),url('/logo.svg') center 28%/130px no-repeat,var(--backbtncolor)"></div>`;
    }

    const note = r.description
        ? `Güncel menümüze buradan ulaşabilirsiniz. ${r.description}`
        : 'Güncel menümüze buradan ulaşabilirsiniz.';
    document.getElementById('menuAltTxt').textContent = note;
}

/* ===== Kategoriler (gruplar) ===== */
function renderCategories() {
    const ul = document.getElementById('catGrid');
    const gruplarBox = document.getElementById('gruplarBox');
    let hasBanner = false;

    ul.innerHTML = D.categories.map(cat => {
        const count = cat.items.filter(i => i.available !== false).length;
        if (!count) return '';

        if (cat.banner) hasBanner = true;

        const img = cat.banner
            ? `<img src="${cat.banner}" alt="" loading="lazy">`
            : `<div class="cat-ph"><span>${cat.icon || '📋'}</span></div>`;

        return `<li data-id="${cat.id}">${img}<h2>${cat.name}</h2></li>`;
    }).join('');

    if (!hasBanner) gruplarBox.classList.add('noimg');

    ul.querySelectorAll('li').forEach(li => {
        li.onclick = () => openCategory(li.dataset.id);
        const img = li.querySelector('img');
        if (img) {
            img.onerror = () => {
                const cat = D.categories.find(c => c.id === li.dataset.id);
                const ph = document.createElement('div');
                ph.className = 'cat-ph';
                ph.innerHTML = `<span>${cat?.icon || '📋'}</span>`;
                img.replaceWith(ph);
            };
        }
    });
}

/* ===== Kategori aç (list) ===== */
function openCategory(id) {
    currentCat = D.categories.find(c => c.id === id);
    if (!currentCat) return;

    listStore = [];
    listScroll = document.getElementById('app').scrollTop;

    document.getElementById('listGrpTitle').textContent = currentCat.name;

    if (currentCat.banner) {
        document.getElementById('listHeadImg').src = currentCat.banner;
        document.getElementById('listHeadImg').onerror = () => {
            document.getElementById('listHeadImg').src = '/logo.svg';
        };
    } else {
            document.getElementById('listHeadImg').src = '/logo.svg';
    }

    const available = currentCat.items.filter(i => i.available !== false);
    const hasImg = available.some(i => i.image);
    const urunlerEl = document.getElementById('listUrunler');
    urunlerEl.classList.toggle('noimg', !hasImg);

    document.getElementById('itemList').innerHTML = available.map(it => {
        const idx = storeItem(it, currentCat, listStore);
        return buildItemRow(it, idx);
    }).join('');

    document.getElementById('itemList').querySelectorAll('li').forEach(li => {
        li.onclick = () => openDetail(+li.dataset.idx, listStore);
    });

    loadPage('list');
}

function buildItemRow(it, idx) {
    const img = it.image
        ? `<img src="${it.image}" alt="" loading="lazy" onerror="this.remove()">`
        : '';
    const desc = it.description
        ? `<h5 class="udetay">${it.description}</h5>`
        : `<h5 class="udetay">&nbsp;</h5>`;

    return `<li data-idx="${idx}" data-name="${norm(it.name)}">
        ${img}
        <h2><p>${it.name}</p></h2>
        ${desc}
        <div class="divlalerjen"><span>${it.price} ₺</span><div></div></div>
        <i class="arr">›</i>
    </li>`;
}

function storeItem(item, cat, store) {
    const idx = store.length;
    store.push({
        name: item.name,
        description: item.description || '',
        price: item.price,
        image: item.image || '',
        catName: cat.name,
        catIcon: cat.icon || ''
    });
    return idx;
}

/* ===== Ürün detay (urun) ===== */
function openDetail(idx, store) {
    const d = store[idx];
    if (!d) return;

    const detayBox = document.getElementById('detayBox');
    const imgEl = document.getElementById('detayImg');

    if (d.image) {
        detayBox.classList.remove('noimg');
        imgEl.src = d.image;
        imgEl.style.display = 'block';
        imgEl.onerror = () => { imgEl.style.display = 'none'; detayBox.classList.add('noimg'); };
    } else {
        detayBox.classList.add('noimg');
        imgEl.style.display = 'none';
    }

    document.getElementById('detayTitle').textContent = d.name;
    document.getElementById('detayDesc').textContent = d.description || '';

    document.getElementById('fiyatList').innerHTML =
        `<li class="done">
            <span class="portion-main-row">
                ${d.name}
                <span class="portion-price">${d.price} ₺</span>
            </span>
        </li>`;

    loadPage('urun');
}

/* ===== Arama ===== */
function buildSearchIndex() {
    searchStore = [];
    const items = [];
    D.categories.forEach(cat => {
        cat.items.filter(i => i.available !== false).forEach(it => {
            const idx = storeItem(it, cat, searchStore);
            items.push({ idx, it });
        });
    });

    const hasImg = items.some(x => x.it.image);
    const el = document.getElementById('searchResults');
    el.classList.toggle('noimg', !hasImg);

    document.getElementById('allItems').innerHTML = items.map(({ idx, it }) =>
        buildItemRow(it, idx)
    ).join('');

    document.getElementById('allItems').querySelectorAll('li').forEach(li => {
        li.onclick = () => {
            closeSearch();
            openDetail(+li.dataset.idx, searchStore);
        };
    });
}

function openSearch() {
    document.getElementById('searchbar').classList.add('open');
    document.getElementById('pageMain').classList.add('wtsearch');
    document.getElementById('gruplarBox').classList.add('hide');
    document.getElementById('searchResults').classList.remove('hide');
    document.getElementById('txtsearch').focus();
}

function closeSearch() {
    document.getElementById('searchbar').classList.remove('open');
    document.getElementById('pageMain').classList.remove('wtsearch');
    document.getElementById('gruplarBox').classList.remove('hide');
    document.getElementById('searchResults').classList.add('hide');
    document.getElementById('txtsearch').value = '';
    filterSearch();
}

function filterSearch() {
    const q = norm(document.getElementById('txtsearch').value);
    document.getElementById('allItems').querySelectorAll('li').forEach(li => {
        li.style.display = !q || li.dataset.name.includes(q) ? '' : 'none';
    });
}

function norm(s) {
    return (s || '').toLocaleLowerCase('tr-TR').replace(/\s/g, '');
}
