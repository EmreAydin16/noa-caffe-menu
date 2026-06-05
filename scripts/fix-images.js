/**
 * Urun gorsellerini duzeltir ve Supabase'e yukler.
 * node scripts/fix-images.js
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pyxcgtsbjyvifpafqdjv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5eGNndHNianl2aWZwYWZxZGp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY2NTY4MiwiZXhwIjoyMDk2MjQxNjgyfQ.zOuy1xKsUabkwSMpDtae3OIkeJjIxk3I9nZDYJWWHNA';
const Q = '?w=400&h=400&fit=crop';
const u = id => `https://images.unsplash.com/photo-${id}${Q}`;

const FIX = {
    cay: u('1576092768241-dec231879fc3'),
    'fincan-cay': u('1597318181409-cf64d0b5d8a2'),
    'klasik-bitki-caylari': u('1564890369478-c89ca6d9cde9'),

    su: u('1548839140-29a749e1cf4d'),
    soda: u('1625772299848-391b6a87d7b3'),
    'meyveli-soda': u('1622483767028-3f66f32aef97'),
    churchill: u('1558642452-9d2a7deb7f62'),
    ayran: u('1584278860047-22db9ff82bed'),
    kola: u('1629203851122-3726ecdf080e'),
    fanta: u('1624517452488-04869289c4ca'),
    gazoz: u('1534353473418-4cfa6c56fd38'),
    'ice-tea': u('1556679343-c7306c1976bc'),

    espresso: u('1510707577719-ae7c14805e3a'),
    'double-espresso': u('1495474472287-4d71bcdd2085'),
    'espresso-macchiato': u('1485808191679-5f86510681a2'),
    'turk-kahvesi': u('1544787219-7f47ccb76574'),
    'duble-turk-kahvesi': u('1546549032-9571cd6b27df'),
    'dibek-kahvesi': u('1504753793650-d4a2b783c15e'),
    'damla-sakizli-turk-kahvesi': u('1544787219-7f47ccb76574'),
    'menengic-kahvesi': u('1521302200778-33500795e128'),
    'filtre-kahve': u('1497935586351-b67a49e012bf'),
    americano: u('1551030173-122aabc4489c'),
    'flat-white': u('1577968897966-3d4325b36b61'),
    latte: u('1570968915860-54d5c301fa9f'),
    'karamel-latte': u('1572442388796-11668a67e53d'),
    'toffee-nut-latte': u('1579888944880-d98341245702'),
    'lotus-latte': u('1611564494260-6f21b80af7ea'),
    mocha: u('1578314675249-a6910f80cc4e'),
    'white-mocha': u('1592663527359-cf6642f54cff'),
    'caramel-macchiato': u('1577805947697-89e18249d767'),
    affogato: u('1594631252845-29fc4cc8cde9'),

    'noa-limonata': u('1621263764928-df1444c5e859'),
    'noa-brownisa': u('1600271886742-f049cd451bba'),
    'noa-blueberry': u('1579954115563-e72bf1381629'),
    'ice-filtre-coffee': u('1517701604599-bb29b565090c'),
    'ice-americano': u('1541167760496-1628856ab772'),
    'ice-latte': u('1517701550927-30cf4ba1dba5'),
    'ice-mocha': u('1572490122747-3968b75cc699'),
    'ice-karamel-latte': u('1461696114087-397271a7aedc'),
    'ice-white-mocha': u('1595981234058-a9302fb97229'),
    frappe: u('1553530666-ba11a7da3888'),
    milkshake: u('1563729784474-d77dbb933a9e'),
    frozen: u('1560707303-4e980ce876ad'),
    smoothie: u('1623065422902-30a2d299bbe4'),

    'ozel-gun-tabagi': u('1504674900247-0877df9cc836'),
    'serpme-kahvalti': u('1533089860892-a7c6f0a88666'),
    'kahvalti-tabagi': u('1525351484163-7529414344d8'),
    'pisi-tabagi': u('1509722747041-616f39b57569'),
    kuymak: u('1588195538326-c5b1e9f80a1b'),
    menemen: u('1590412200988-a436970781fa'),
    omlet: u('1510693206972-df098062cb71'),
    'sahanda-yumurta': u('1482049016688-2d3e1b311543'),

    'karisik-gozleme': u('1601050690597-df0568f70950'),
    'kasarli-gozleme': u('1612203985729-70726954388c'),
    'karisik-tost': u('1528736235302-52922df5c122'),
    'kasarli-sucuklu-tost': u('1475090169767-40ed8d18f67d'),

    'noa-burger': u('1568901346375-23c9450c58cd'),
    'cheese-burger': u('1553979459-d2229ba7433b'),
    'crispy-burger': u('1586190848861-99aa4a171e90'),
    'manti-klasik': u('1625398407796-82650a8c135f'),
    'citir-manti': u('1552332386-f8dd00dc2f85'),
    'noa-tavuk-menu': u('1598515214211-89d3c73ae83b'),

    'noa-combo-mix': u('1630384060421-cb20d0e0649d'),
    'crispy-tavuk-patates': u('1562967914-608f82629710'),
    'baharatli-patates': u('1573080496219-bb080dd4f877'),
    'gunun-corbasi': u('1547592166-23ac45744acd'),

    'tavuklu-sezar': u('1550304943-4f24f54ddde9'),
    'citir-tavuklu-salata': u('1512621776951-a57141f2eefd'),
    'ton-balikli-salata': u('1540420773420-3366772f4999'),

    'noa-waffle': u('1562376552-0d160a2f238d'),
    spoonful: u('1488477181946-6428a0291777'),
    'ev-yapimi-magnolia': u('1563805042-7684c019e1cb')
};

async function verify(url) {
    const res = await fetch(url.split('?')[0] + '?w=50&h=50&fit=crop');
    return res.ok;
}

async function main() {
    const menuPath = path.join(__dirname, '..', 'data', 'menu.json');
    const menu = JSON.parse(fs.readFileSync(menuPath, 'utf8'));

    const broken = [];
    for (const [id, url] of Object.entries(FIX)) {
        if (!(await verify(url))) broken.push(id);
    }
    if (broken.length) {
        console.error('Kirik URL:', broken.join(', '));
        process.exit(1);
    }

    let updated = 0;
    for (const cat of menu.categories) {
        for (const item of cat.items) {
            if (FIX[item.id] !== undefined) {
                if (item.image !== FIX[item.id]) updated++;
                item.image = FIX[item.id];
            }
        }
    }

    fs.writeFileSync(menuPath, JSON.stringify(menu, null, 2));
    console.log(`${updated} gorsel guncellendi`);

    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/noa-menu/menu.json`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'x-upsert': 'true'
        },
        body: JSON.stringify(menu, null, 2)
    });
    if (!res.ok) throw new Error(await res.text());
    console.log('Supabase guncellendi');
}

main().catch(e => { console.error(e); process.exit(1); });
