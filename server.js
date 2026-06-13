const http = require('http');
const fs = require('fs');
const path = require('path');

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

async function readMenuFromSupabase() {
    await ensureSupabaseBucket();

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
    if (USE_SUPABASE) return readMenuFromSupabase();
    return readMenuFromFile();
}

async function writeMenu(data) {
    if (USE_SUPABASE) return writeMenuToSupabase(data);
    writeMenuToFile(data);
}

function slugify(text) {
    return text.toLowerCase()
        .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u')
        .replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/ı/g, 'i')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function sendJSON(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
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

function serveStatic(res, filePath) {
    const ext = path.extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';

    if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method;

    try {
        if (pathname === '/api/menu' && method === 'GET') {
            return sendJSON(res, await readMenu());
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
                available: body.available !== undefined ? body.available : true
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
            const newCat = {
                id: slugify(body.name) + '-' + Date.now().toString(36),
                name: body.name,
                icon: body.icon || '📋',
                banner: body.banner || '',
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

        if (pathname === '/api/qr-url' && method === 'GET') {
            const menuUrl = PUBLIC_URL || `http://${req.headers.host}`;
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(menuUrl)}&color=2c1810&bgcolor=ffffff&margin=10`;
            return sendJSON(res, { url: menuUrl, qrApiUrl });
        }

        if (pathname === '/') {
            return serveStatic(res, path.join(__dirname, 'public', 'index.html'));
        }

        if (pathname === '/admin') {
            return serveStatic(res, path.join(__dirname, 'public', 'admin.html'));
        }

        const staticPath = path.join(__dirname, 'public', pathname);
        if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
            return serveStatic(res, staticPath);
        }

        res.writeHead(404);
        res.end('Not found');

    } catch (err) {
        console.error(err);
        sendJSON(res, { error: 'Sunucu hatasi' }, 500);
    }
});

server.listen(PORT, () => {
    console.log('');
    console.log('  Noa Caffe & Co - QR Menu Sistemi');
    console.log('  -----------------------------------');
    console.log(`  Menu:    http://localhost:${PORT}`);
    console.log(`  Admin:   http://localhost:${PORT}/admin`);
    console.log(`  Depo:    ${USE_SUPABASE ? 'Supabase (kalici)' : 'Dosya (gecici)'}`);
    console.log('  -----------------------------------');
    console.log('');
});
