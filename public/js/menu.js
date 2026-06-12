let D;
const itemStore = [];

document.addEventListener('DOMContentLoaded', async () => {
    wire();
    try {
        const r = await fetch('/api/menu');
        D = await r.json();
        renderTop();
        renderTabs();
        renderMenu();
        document.getElementById('loader').remove();
    } catch {
        document.getElementById('loader').innerHTML =
            '<p style="color:#a33;font-size:.85rem;text-align:center">Menü yüklenemedi.</p>';
    }
});

function wire() {
    document.getElementById('fab').onclick = () =>
        scrollTo({ top: 0, behavior: 'smooth' });

    addEventListener('scroll', () => {
        document.getElementById('fab').classList.toggle('show', scrollY > 400);
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

function renderTop() {
    const r = D.restaurant;
    if (!r) return;
    const el = document.getElementById('topLoc');
    if (r.address) el.textContent = r.address;
}

function renderTabs() {
    const el = document.getElementById('tabsScroll');
    el.innerHTML = D.categories.map(c =>
        `<button class="tab" data-id="${c.id}" onclick="go('${c.id}')">${c.icon} ${c.name}</button>`
    ).join('');
    spy();
}

function go(id) {
    const s = document.getElementById('s-' + id);
    if (!s) return;
    scrollTo({ top: s.offsetTop - 52, behavior: 'smooth' });
}

function spy() {
    const tabs = document.querySelectorAll('.tab');
    const io = new IntersectionObserver(es => {
        es.forEach(e => {
            if (!e.isIntersecting) return;
            const id = e.target.id.replace('s-', '');
            tabs.forEach(t => t.classList.toggle('on', t.dataset.id === id));
            document.querySelector(`.tab[data-id="${id}"]`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    }, { rootMargin: '-60px 0px -65% 0px', threshold: 0.05 });

    D.categories.forEach(c => {
        const s = document.getElementById('s-' + c.id);
        if (s) io.observe(s);
    });
}

function renderMenu() {
    const box = document.getElementById('menuInner');

    D.categories.forEach(cat => {
        const block = document.createElement('section');
        block.className = 'cat-block';
        block.id = 's-' + cat.id;

        const available = cat.items.filter(i => i.available !== false);
        if (!available.length) return;

        const rows = available.map(it => {
            const idx = storeItem(it, cat);
            const thumb = it.image
                ? `<img class="item-thumb" src="${it.image}" alt="" loading="lazy" onerror="this.remove()">`
                : '';
            const desc = it.description
                ? `<div class="item-desc">${it.description}</div>` : '';
            const badge = it.popular ? `<span class="item-badge">Popüler</span>` : '';

            return `<div class="item" onclick="showItem(${idx})">
                ${thumb}
                <div class="item-body">
                    <div class="item-row">
                        <span class="item-name">${it.name}</span>
                        <span class="item-price">${it.price} ₺</span>
                    </div>
                    ${desc}
                    ${badge}
                </div>
            </div>`;
        }).join('');

        block.innerHTML = `
            <div class="cat-head">
                <h2>${cat.icon} ${cat.name} <span>(${available.length})</span></h2>
            </div>
            <div class="cat-list">${rows}</div>
        `;
        box.appendChild(block);
    });
}

function showItem(idx) {
    const d = itemStore[idx];
    if (!d) return;

    const imgEl = document.getElementById('modalImg');
    if (d.image) {
        imgEl.className = 'modal-img has-img';
        imgEl.innerHTML = `<img src="${d.image}" alt="${d.name}" onerror="this.parentElement.className='modal-img';this.parentElement.innerHTML=''">`;
    } else {
        imgEl.className = 'modal-img';
        imgEl.innerHTML = '';
    }

    document.getElementById('modalCat').textContent = (d.catIcon || '') + ' ' + (d.catName || '');
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
