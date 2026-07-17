const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://noa-caffe-menu.onrender.com';
const DATA_FILE = path.join(__dirname, 'data', 'menu.json');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pyxcgtsbjyvifpafqdjv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5eGNndHNianl2aWZwYWZxZGp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY2NTY4MiwiZXhwIjoyMDk2MjQxNjgyfQ.zOuy1xKsUabkwSMpDtae3OIkeJjIxk3I9nZDYJWWHNA';
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);
const SUPABASE_BUCKET = 'noa-menu';
const SUPABASE_FILE = 'menu.json';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

const CACHE_AGE = {
    '.html': 0,
    '.css': 604800,
    '.js': 604800,
    '.svg': 604800,
    '.png': 604800,
    '.jpg': 604800,
    '.json': 300
};

const MENU_CACHE_MS = 120000;
let menuCache = null;
let menuCacheTime = 0;
let menuEtag = '';

function invalidateMenuCache() {
    menuCache = null;
    menuCacheTime = 0;
    menuEtag = '';
}

function etagFor(body) {
    return '"' + crypto.createHash('md5').update(body).digest('hex') + '"';
}

function wantsGzip(req) {
    return (req.headers['accept-encoding'] || '').includes('gzip');
}

function sendBody(res, status, headers, body, req) {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
    if (wantsGzip(req) && buf.length > 512) {
        zlib.gzip(buf, (err, compressed) => {
            if (err) {
                res.writeHead(status, { ...headers, 'Content-Length': buf.length });
                return res.end(buf);
            }
            res.writeHead(status, {
                ...headers,
                'Content-Encoding': 'gzip',
                'Content-Length': compressed.length,
                'Vary': 'Accept-Encoding'
            });
            res.end(compressed);
        });
        return;
    }
    res.writeHead(status, { ...headers, 'Content-Length': buf.length });
    res.end(buf);
}

function readMenuFromFile() {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeMenuToFile(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function supabaseHeaders(extra = {}) {
    return {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        ...extra
    };
}

async function ensureSupabaseBucket() {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
        method: 'POST',
        headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: SUPABASE_BUCKET, public: false })
    });
    if (res.ok) return;
    const err = await res.text();
    if (err.includes('already exists') || err.includes('Duplicate')) return;
    throw new Error(`Supabase bucket hatasi: ${res.status} ${err}`);
}

function backupTimestamp() {
    return new Date().toISOString().slice(0, 19).replace(/:/g, '-');
}

function sortMenu(data) {
    if (!data?.categories) return data;

    data.categories.forEach((cat, i) => {
        if (cat.order == null) cat.order = i;
    });
    data.categories.sort((a, b) => a.order - b.order);

    data.categories.forEach(cat => {
        if (!Array.isArray(cat.items)) cat.items = [];
        cat.items.forEach((item, i) => {
            if (item.order == null) item.order = i;
        });
        cat.items.sort((a, b) => a.order - b.order);
    });

    return data;
}

async function uploadSupabaseFile(filePath, content) {
    await ensureSupabaseBucket();
    const res = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${filePath}`,
        {
            method: 'POST',
            headers: supabaseHeaders({
                'Content-Type': 'application/json',
                'x-upsert': 'true'
            }),
            body: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
        }
    );
    if (!res.ok) throw new Error(`Supabase yedek hatasi: ${res.status} ${await res.text()}`);
}

async function saveBackup(data) {
    const ts = backupTimestamp();
    const payload = JSON.stringify(data, null, 2);

    const localDir = path.join(__dirname, 'backups');
    fs.mkdirSync(localDir, { recursive: true });
    fs.writeFileSync(path.join(localDir, `menu-${ts}.json`), payload, 'utf8');
    fs.writeFileSync(path.join(localDir, 'menu-latest.json'), payload, 'utf8');

    if (USE_SUPABASE) {
        await uploadSupabaseFile(`backups/menu-${ts}.json`, payload);
        await uploadSupabaseFile('backups/menu-latest.json', payload);
    }
    return ts;
}

async function readMenuFromSupabase() {
    const res = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${SUPABASE_FILE}`,
        { headers: supabaseHeaders() }
    );

    if (res.status === 404) {
        console.warn('Supabase menu.json bulunamadi - yerel dosya okunuyor (Supabase UZERINE YAZILMAZ)');
        return readMenuFromFile();
    }

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Supabase okuma hatasi: ${res.status} ${err}`);
    }

    return res.json();
}

async function writeMenuToSupabase(data) {
    await ensureSupabaseBucket();

    const res = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${SUPABASE_FILE}`,
        {
            method: 'POST',
            headers: supabaseHeaders({
                'Content-Type': 'application/json',
                'x-upsert': 'true'
            }),
            body: JSON.stringify(data, null, 2)
        }
    );

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Supabase yazma hatasi: ${res.status} ${err}`);
    }
}

async function readMenu() {
    if (menuCache && Date.now() - menuCacheTime < MENU_CACHE_MS) {
        return menuCache;
    }

    let data;
    if (USE_SUPABASE) {
        try {
            data = sortMenu(await readMenuFromSupabase());
        } catch (err) {
            console.error('Supabase okuma hatasi, yedek deneniyor:', err.message);
            data = null;
        }
    }

    if (!data) {
        const backupPath = path.join(__dirname, 'backups', 'menu-latest.json');
        if (fs.existsSync(backupPath)) {
            console.warn('backups/menu-latest.json kullaniliyor');
            data = sortMenu(JSON.parse(fs.readFileSync(backupPath, 'utf8')));
        } else {
            data = sortMenu(readMenuFromFile());
        }
    }

    menuCache = data;
    menuCacheTime = Date.now();
    menuEtag = etagFor(JSON.stringify(data));
    return data;
}

async function writeMenu(data) {
    sortMenu(data);
    invalidateMenuCache();

    try {
        if (USE_SUPABASE) {
            const res = await fetch(
                `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${SUPABASE_FILE}`,
                { headers: supabaseHeaders() }
            );
            if (res.ok) await saveBackup(await res.json());
        } else if (fs.existsSync(DATA_FILE)) {
            await saveBackup(readMenuFromFile());
        }
    } catch (err) {
        console.warn('Yedek alinamadi:', err.message);
    }

    if (USE_SUPABASE) return writeMenuToSupabase(data);
    writeMenuToFile(data);
}

function applyOrder(data, body) {
    if (body.categories?.length) {
        const map = new Map(data.categories.map(c => [c.id, c]));
        const ordered = [];
        body.categories.forEach((id, i) => {
            const cat = map.get(id);
            if (cat) {
                cat.order = i;
                ordered.push(cat);
            }
        });
        data.categories.forEach(cat => {
            if (!body.categories.includes(cat.id)) {
                cat.order = ordered.length;
                ordered.push(cat);
            }
        });
        data.categories = ordered;
    }

    if (body.items && typeof body.items === 'object') {
        for (const [catId, itemIds] of Object.entries(body.items)) {
            const cat = data.categories.find(c => c.id === catId);
            if (!cat || !Array.isArray(itemIds)) continue;
            const map = new Map(cat.items.map(it => [it.id, it]));
            const ordered = [];
            itemIds.forEach((id, i) => {
                const item = map.get(id);
                if (item) {
                    item.order = i;
                    ordered.push(item);
                }
            });
            cat.items.forEach(item => {
                if (!itemIds.includes(item.id)) {
                    item.order = ordered.length;
                    ordered.push(item);
                }
            });
            cat.items = ordered;
        }
    }

    return sortMenu(data);
}

function getMenuUrl(req) {
    if (PUBLIC_URL) return PUBLIC_URL.replace(/\/$/, '');
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'http';
    return `${proto}://${host}`.replace(/\/$/, '');
}

function slugify(text) {
    return text.toLowerCase()
        .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u')
        .replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/ı/g, 'i')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function sendJSON(res, data, status = 200, req = null, cacheSeconds = 0) {
    const body = JSON.stringify(data);
    const headers = { 'Content-Type': 'application/json; charset=utf-8' };
    if (cacheSeconds > 0) {
        headers['Cache-Control'] = `public, max-age=${cacheSeconds}`;
        headers.ETag = etagFor(body);
        if (req?.headers['if-none-match'] === headers.ETag) {
            res.writeHead(304);
            return res.end();
        }
    } else {
        headers['Cache-Control'] = 'no-store';
    }
    sendBody(res, status, headers, body, req || { headers: {} });
}

function serveStatic(res, filePath, req) {
    const ext = path.extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';

    if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath);
    const maxAge = CACHE_AGE[ext] || 3600;
    const etag = '"' + stat.mtimeMs + '-' + stat.size + '"';
    const cacheHeader = maxAge > 0
        ? `public, max-age=${maxAge}`
        : 'no-cache';

    if (req?.headers['if-none-match'] === etag) {
        res.writeHead(304, { ETag: etag, 'Cache-Control': cacheHeader });
        return res.end();
    }

    sendBody(res, 200, {
        'Content-Type': mime,
        'Cache-Control': cacheHeader,
        ETag: etag
    }, content, req || { headers: {} });
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch { resolve({}); }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method;

    try {
        if (pathname === '/health' && method === 'GET') {
            return sendJSON(res, { ok: true, ts: Date.now() }, 200, req, 0);
        }

        if (pathname === '/ping' && method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
            return res.end('ok');
        }

        if (pathname === '/api/menu' && method === 'GET') {
            const data = await readMenu();
            if (menuEtag && req.headers['if-none-match'] === menuEtag) {
                res.writeHead(304, { ETag: menuEtag, 'Cache-Control': 'public, max-age=120' });
                return res.end();
            }
            return sendJSON(res, data, 200, req, 120);
        }

        if (pathname.match(/^\/api\/menu\/item\/([^/]+)$/) && method === 'POST') {
            const catId = pathname.split('/')[4];
            const body = await parseBody(req);
            const data = await readMenu();
            const cat = data.categories.find(c => c.id === catId);
            if (!cat) return sendJSON(res, { error: 'Kategori bulunamadi' }, 404);

            const newItem = {
                id: slugify(body.name) + '-' + Date.now().toString(36),
                name: body.name,
                description: body.description || '',
                price: Number(body.price),
                image: body.image || '',
                popular: body.popular || false,
                available: body.available !== undefined ? body.available : true,
                order: cat.items.length
            };
            cat.items.push(newItem);
            await writeMenu(data);
            return sendJSON(res, newItem);
        }

        if (pathname.match(/^\/api\/menu\/item\/([^/]+)\/([^/]+)$/) && method === 'PUT') {
            const parts = pathname.split('/');
            const catId = parts[4];
            const itemId = parts[5];
            const body = await parseBody(req);
            const data = await readMenu();
            const cat = data.categories.find(c => c.id === catId);
            if (!cat) return sendJSON(res, { error: 'Kategori bulunamadi' }, 404);

            const itemIndex = cat.items.findIndex(i => i.id === itemId);
            if (itemIndex === -1) return sendJSON(res, { error: 'Urun bulunamadi' }, 404);

            const item = cat.items[itemIndex];
            if (body.name !== undefined) item.name = body.name;
            if (body.description !== undefined) item.description = body.description;
            if (body.price !== undefined) item.price = Number(body.price);
            if (body.image !== undefined) item.image = body.image;
            if (body.popular !== undefined) item.popular = body.popular;
            if (body.available !== undefined) item.available = body.available;

            if (body.categoryId && body.categoryId !== catId) {
                const newCat = data.categories.find(c => c.id === body.categoryId);
                if (newCat) {
                    cat.items.splice(itemIndex, 1);
                    newCat.items.push(item);
                }
            }

            await writeMenu(data);
            return sendJSON(res, item);
        }

        if (pathname.match(/^\/api\/menu\/item\/([^/]+)\/([^/]+)$/) && method === 'DELETE') {
            const parts = pathname.split('/');
            const catId = parts[4];
            const itemId = parts[5];
            const data = await readMenu();
            const cat = data.categories.find(c => c.id === catId);
            if (!cat) return sendJSON(res, { error: 'Kategori bulunamadi' }, 404);

            cat.items = cat.items.filter(i => i.id !== itemId);
            await writeMenu(data);
            return sendJSON(res, { success: true });
        }

        if (pathname === '/api/menu/category' && method === 'POST') {
            const body = await parseBody(req);
            const data = await readMenu();
            const maxOrder = data.categories.reduce((m, c) => Math.max(m, c.order ?? -1), -1);
            const newCat = {
                id: slugify(body.name) + '-' + Date.now().toString(36),
                name: body.name,
                icon: body.icon || '📋',
                banner: body.banner || '',
                order: maxOrder + 1,
                items: []
            };
            data.categories.push(newCat);
            await writeMenu(data);
            return sendJSON(res, newCat);
        }

        if (pathname.match(/^\/api\/menu\/category\/([^/]+)$/) && method === 'PUT') {
            const catId = pathname.split('/')[4];
            const body = await parseBody(req);
            const data = await readMenu();
            const cat = data.categories.find(c => c.id === catId);
            if (!cat) return sendJSON(res, { error: 'Kategori bulunamadi' }, 404);

            if (body.name !== undefined) cat.name = body.name;
            if (body.icon !== undefined) cat.icon = body.icon;
            if (body.banner !== undefined) cat.banner = body.banner;
            await writeMenu(data);
            return sendJSON(res, cat);
        }

        if (pathname.match(/^\/api\/menu\/category\/([^/]+)$/) && method === 'DELETE') {
            const catId = pathname.split('/')[4];
            const data = await readMenu();
            data.categories = data.categories.filter(c => c.id !== catId);
            await writeMenu(data);
            return sendJSON(res, { success: true });
        }

        if (pathname === '/api/settings' && method === 'PUT') {
            const body = await parseBody(req);
            const data = await readMenu();
            data.restaurant = { ...data.restaurant, ...body };
            await writeMenu(data);
            return sendJSON(res, data.restaurant);
        }

        if (pathname === '/api/backup' && method === 'POST') {
            const data = await readMenu();
            const ts = await saveBackup(data);
            return sendJSON(res, { success: true, timestamp: ts });
        }

        if (pathname === '/api/menu/order' && method === 'PUT') {
            const body = await parseBody(req);
            const data = await readMenu();
            applyOrder(data, body);
            await writeMenu(data);
            return sendJSON(res, { success: true, categories: data.categories.map(c => c.id) });
        }

        if (pathname === '/api/qr-url' && method === 'GET') {
            const menuUrl = getMenuUrl(req);
            return sendJSON(res, { url: menuUrl }, 200, req, 3600);
        }

        if (pathname === '/') {
            return serveStatic(res, path.join(__dirname, 'public', 'index.html'), req);
        }

        if (pathname === '/admin') {
            return serveStatic(res, path.join(__dirname, 'public', 'admin.html'), req);
        }

        const staticPath = path.join(__dirname, 'public', pathname);
        if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
            return serveStatic(res, staticPath, req);
        }

        res.writeHead(404);
        res.end('Not found');

    } catch (err) {
        console.error(err);
        sendJSON(res, { error: 'Sunucu hatasi' }, 500);
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  Noa Caffe & Co - QR Menu Sistemi');
    console.log('  -----------------------------------');
    console.log(`  Menu:    http://localhost:${PORT}`);
    console.log(`  Admin:   http://localhost:${PORT}/admin`);
    console.log(`  Depo:    ${USE_SUPABASE ? 'Supabase (kalici)' : 'Dosya (gecici)'}`);
    console.log('  -----------------------------------');
    console.log('');
});
