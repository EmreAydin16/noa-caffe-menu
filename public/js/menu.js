let D;

document.addEventListener('DOMContentLoaded', async () => {
    wire();
    try {
        const r = await fetch('/api/menu');
        D = await r.json();
        buildHighlights();
        buildNav();
        buildMenu();
        buildFooter();
        document.getElementById('spinner').remove();
        observe();
    } catch {
        document.getElementById('spinner').innerHTML =
            '<p style="color:#a33;font-size:.88rem">Menü yüklenemedi.</p>';
    }
});

function wire() {
    document.getElementById('heroScroll').addEventListener('click', () => {
        (document.getElementById('highlights') || document.getElementById('content'))
            .scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('toTop').addEventListener('click', () =>
        window.scrollTo({ top: 0, behavior: 'smooth' }));

    window.addEventListener('scroll', () => {
        document.getElementById('toTop').classList.toggle('show', scrollY > 600);
        document.getElementById('topbar').classList.toggle('shadow', scrollY > 200);
    }, { passive: true });

    const dp = document.querySelector('.detail-panel');
    let sy = 0;
    dp.addEventListener('touchstart', e => sy = e.touches[0].clientY, { passive: true });
    dp.addEventListener('touchmove', e => {
        if (e.touches[0].clientY - sy > 90) closeDetail();
    }, { passive: true });
}

/* ============ HIGHLIGHTS ============ */
function buildHighlights() {
    const box = document.getElementById('hlScroll');
    const pops = [];
    D.categories.forEach(c => c.items.forEach(i => {
        if (i.popular && i.available && i.image) pops.push({ ...i, _c: c.name, _i: c.icon });
    }));
    if (!pops.length) { document.getElementById('highlights').remove(); return; }

    box.innerHTML = pops.map(p => `
        <div class="hl-card" onclick='openDetail(${j(p)})'>
            <img class="hl-card-img" src="${p.image}" alt="${p.name}" loading="lazy">
            <div class="hl-card-grad"></div>
            <div class="hl-card-wm">NOA caffé & co</div>
            <div class="hl-card-info">
                <div class="hl-card-name">${p.name}</div>
                <div class="hl-card-row">
                    <span class="hl-card-cat">${p._i} ${p._c}</span>
                    <span class="hl-card-price">${p.price} ₺</span>
                </div>
            </div>
        </div>
    `).join('');
}

/* ============ NAV ============ */
function buildNav() {
    const box = document.getElementById('topbarCats');
    box.innerHTML = D.categories.map(c =>
        `<button class="t-tab" data-id="${c.id}" onclick="jump('${c.id}')">${c.icon} ${c.name}</button>`
    ).join('');
    spy();
}

function jump(id) {
    const el = document.getElementById('s-' + id);
    if (!el) return;
    const off = document.getElementById('topbar').offsetHeight + 8;
    window.scrollTo({ top: el.offsetTop - off, behavior: 'smooth' });
}

function spy() {
    const tabs = document.querySelectorAll('.t-tab');
    const io = new IntersectionObserver(es => {
        es.forEach(e => {
            if (!e.isIntersecting) return;
            const id = e.target.id.replace('s-', '');
            tabs.forEach(t => t.classList.toggle('on', t.dataset.id === id));
            document.querySelector(`.t-tab[data-id="${id}"]`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    }, { rootMargin: '-70px 0px -60% 0px', threshold: 0.05 });
    D.categories.forEach(c => {
        const s = document.getElementById('s-' + c.id);
        if (s) io.observe(s);
    });
}

/* ============ MENU ============ */
function buildMenu() {
    const box = document.getElementById('menuWrap');
    D.categories.forEach((cat, ci) => {
        const sec = document.createElement('section');
        sec.className = 'm-sec rv';
        sec.id = 's-' + cat.id;
        sec.style.transitionDelay = ci * 0.05 + 's';

        sec.innerHTML = `
            <div class="m-head">
                <span class="m-icon">${cat.icon}</span>
                <h2 class="m-title">${cat.name}</h2>
            </div>
            <div class="m-line"></div>
            ${cat.items.map(it => {
                const img = it.image
                    ? `<img class="m-img" src="${it.image}" alt="${it.name}" loading="lazy"
                            onerror="this.outerHTML='<div class=m-no-img>${cat.icon}</div>'">`
                    : `<div class="m-no-img">${cat.icon}</div>`;
                const hit = it.popular ? '<span class="m-hit">HIT</span>' : '';
                const cls = it.available === false ? ' off' : '';
                return `
                    <div class="m-item${cls}" onclick='openDetail(${j(it, cat)})'>
                        ${img}
                        <div class="m-info">
                            <div class="m-name-row">
                                <span class="m-name">${it.name}</span>${hit}
                            </div>
                            <div class="m-desc">${it.description || ''}</div>
                        </div>
                        <div class="m-price">${it.price}<span class="m-cur"> ₺</span></div>
                    </div>`;
            }).join('')}
        `;
        box.appendChild(sec);
    });
}

/* ============ DETAIL ============ */
function openDetail(raw) {
    let d; try { d = JSON.parse(raw); } catch { return; }
    const el = document.getElementById('detail');
    const hero = document.getElementById('detailHero');

    if (d.image) {
        hero.innerHTML = `<img src="${d.image}" alt="${d.name}">`;
        hero.style.display = '';
    } else {
        hero.style.display = 'none';
    }

    document.getElementById('detailBadge').textContent =
        (d._i || d.catIcon || '') + ' ' + (d._c || d.catName || '');
    document.getElementById('detailName').textContent = d.name;
    document.getElementById('detailDesc').textContent = d.description || '';
    document.getElementById('detailPrice').textContent = d.price + ' ₺';

    el.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeDetail() {
    document.getElementById('detail').classList.remove('open');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });

/* ============ FOOTER ============ */
function buildFooter() {
    const info = D.restaurant; if (!info) return;
    const el = document.getElementById('ftLinks');
    let h = `<span>${info.address || 'Cumhuriyet Caddesi, Bursa'}</span>`;
    if (info.phone) h += `<a href="tel:${info.phone}">${info.phone}</a>`;
    if (info.instagram) h += `<a href="https://instagram.com/${info.instagram}" target="_blank">@${info.instagram}</a>`;
    el.innerHTML = h;
}

/* ============ HELPERS ============ */
function j(item, cat) {
    const o = {
        name: item.name, description: item.description, price: item.price,
        image: item.image || '',
        _c: cat ? cat.name : item._c || '', _i: cat ? cat.icon : item._i || '',
        catName: cat ? cat.name : item._c || '', catIcon: cat ? cat.icon : item._i || ''
    };
    return "'" + JSON.stringify(o).replace(/'/g, "\\'") + "'";
}

function observe() {
    const io = new IntersectionObserver(es => {
        es.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('show'); io.unobserve(e.target); }
        });
    }, { rootMargin: '0px 0px -30px 0px', threshold: 0.1 });
    document.querySelectorAll('.rv').forEach(el => io.observe(el));
}
