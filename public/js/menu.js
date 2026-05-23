let D;
const itemStore = [];

document.addEventListener('DOMContentLoaded', async () => {
    wire();
    try {
        const r = await fetch('/api/menu');
        D = await r.json();
        renderPicks();
        renderBar();
        renderMenu();
        renderFoot();
        document.getElementById('loader').remove();
        observe();
    } catch {
        document.getElementById('loader').innerHTML =
            '<p style="color:#a33;font-size:.85rem">Menü yüklenemedi.</p>';
    }
});

function wire() {
    document.getElementById('heroBtn').onclick = () =>
        (document.getElementById('picks') || document.getElementById('main'))
            .scrollIntoView({ behavior: 'smooth' });

    const fab = document.getElementById('fab');
    fab.onclick = () => scrollTo({ top: 0, behavior: 'smooth' });
    addEventListener('scroll', () => {
        fab.classList.toggle('show', scrollY > 600);
        document.getElementById('bar').classList.toggle('shd', scrollY > 200);
    }, { passive: true });

    const sheet = document.querySelector('.modal-sheet');
    let y0 = 0;
    sheet.addEventListener('touchstart', e => y0 = e.touches[0].clientY, { passive: true });
    sheet.addEventListener('touchmove', e => {
        if (e.touches[0].clientY - y0 > 80) closeModal();
    }, { passive: true });
}

function storeItem(item, cat) {
    const idx = itemStore.length;
    itemStore.push({
        name: item.name,
        description: item.description || '',
        price: item.price,
        image: item.image || '',
        catName: cat ? cat.name : item._c || '',
        catIcon: cat ? cat.icon : item._i || ''
    });
    return idx;
}

/* ============ PICKS ============ */
function renderPicks() {
    const el = document.getElementById('picksGrid');
    const pops = [];
    D.categories.forEach(c => c.items.forEach(i => {
        if (i.popular && i.available && i.image) pops.push({ ...i, _c: c.name, _i: c.icon });
    }));
    if (!pops.length) { document.getElementById('picks').remove(); return; }

    el.innerHTML = pops.map(p => {
        const idx = storeItem(p, null);
        return `
        <div class="pk" onclick="showItem(${idx})">
            <img src="${p.image}" alt="${p.name}" loading="lazy">
            <div class="pk-grad"></div>
            <div class="pk-wm">NOA caffé & co</div>
            <div class="pk-body">
                <div class="pk-cat">${p._i} ${p._c}</div>
                <div class="pk-name">${p.name}</div>
                <div class="pk-price">${p.price} ₺</div>
            </div>
        </div>`;
    }).join('');
}

/* ============ BAR ============ */
function renderBar() {
    const el = document.getElementById('barScroll');
    el.innerHTML = D.categories.map(c =>
        `<button class="pill" data-id="${c.id}" onclick="go('${c.id}')">${c.icon} ${c.name}</button>`
    ).join('');
    spy();
}

function go(id) {
    const s = document.getElementById('s-' + id);
    if (!s) return;
    scrollTo({ top: s.offsetTop - 60, behavior: 'smooth' });
}

function spy() {
    const pills = document.querySelectorAll('.pill');
    const io = new IntersectionObserver(es => {
        es.forEach(e => {
            if (!e.isIntersecting) return;
            const id = e.target.id.replace('s-', '');
            pills.forEach(p => p.classList.toggle('on', p.dataset.id === id));
            document.querySelector(`.pill[data-id="${id}"]`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    }, { rootMargin: '-70px 0px -60% 0px', threshold: 0.05 });
    D.categories.forEach(c => {
        const s = document.getElementById('s-' + c.id);
        if (s) io.observe(s);
    });
}

/* ============ MENU ============ */
function renderMenu() {
    const box = document.getElementById('menuInner');
    D.categories.forEach((cat, ci) => {
        const sec = document.createElement('section');
        sec.className = 'cat-sec rv';
        sec.id = 's-' + cat.id;
        sec.style.transitionDelay = ci * 0.04 + 's';

        const cards = cat.items.map((it, ii) => {
            const idx = storeItem(it, cat);
            const img = it.image
                ? `<img class="card-img" src="${it.image}" alt="${it.name}" loading="lazy"
                        onerror="this.outerHTML='<div class=card-noimg>${cat.icon}</div>'">`
                : `<div class="card-noimg">${cat.icon}</div>`;
            const badge = it.popular ? `<span class="card-badge">Hit</span>` : '';
            const cls = it.available === false ? ' off' : '';

            return `<div class="card${cls}" style="animation-delay:${ci * 0.04 + ii * 0.03}s"
                         onclick="showItem(${idx})">
                ${img}
                <div class="card-body">
                    <div class="card-name">${it.name}</div>
                    <div class="card-desc">${it.description || ''}</div>
                    <div class="card-foot">
                        <span class="card-price">${it.price} ₺</span>
                        ${badge}
                    </div>
                </div>
            </div>`;
        }).join('');

        sec.innerHTML = `
            <div class="cat-banner">
                <img src="${cat.banner || ''}" alt="${cat.name}" loading="lazy"
                     onerror="this.parentElement.style.background='linear-gradient(135deg,var(--espresso),var(--brown))'">
                <div class="cat-banner-dim">
                    <span class="cat-banner-icon">${cat.icon}</span>
                    <div class="cat-banner-text">
                        <h2>${cat.name}</h2>
                        <span>${cat.items.length} çeşit</span>
                    </div>
                </div>
            </div>
            <div class="grid">${cards}</div>
        `;
        box.appendChild(sec);
    });
}

/* ============ MODAL ============ */
function showItem(idx) {
    const d = itemStore[idx];
    if (!d) return;

    const v = document.getElementById('modalVisual');
    if (d.image) {
        v.innerHTML = `<img src="${d.image}" alt="${d.name}">`;
        v.style.display = '';
    } else {
        v.style.display = 'none';
    }

    document.getElementById('modalTag').textContent = (d.catIcon || '') + ' ' + (d.catName || '');
    document.getElementById('modalTitle').textContent = d.name;
    document.getElementById('modalDesc').textContent = d.description || '';
    document.getElementById('modalPrice').textContent = d.price + ' ₺';
    document.getElementById('modal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal').classList.remove('open');
    document.body.style.overflow = '';
}
addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ============ FOOTER ============ */
function renderFoot() {
    const r = D.restaurant; if (!r) return;
    const el = document.getElementById('footMid');
    let h = `<span>${r.address || 'Cumhuriyet Caddesi, Bursa'}</span>`;
    if (r.phone) h += `<a href="tel:${r.phone}">${r.phone}</a>`;
    if (r.instagram) h += `<a href="https://instagram.com/${r.instagram}" target="_blank">@${r.instagram}</a>`;
    el.innerHTML = h;
}

/* ============ REVEAL ============ */
function observe() {
    const io = new IntersectionObserver(es => {
        es.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('show'); io.unobserve(e.target); }
        });
    }, { rootMargin: '0px 0px -30px 0px', threshold: 0.08 });
    document.querySelectorAll('.rv').forEach(el => io.observe(el));
}
