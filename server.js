const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || '';
const DATA_FILE = path.join(__dirname, 'data', 'menu.json');

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

function readMenu() {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeMenu(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
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
        // ===== API ROUTES =====

        if (pathname === '/api/menu' && method === 'GET') {
            return sendJSON(res, readMenu());
        }

        // Add item to category
        if (pathname.match(/^\/api\/menu\/item\/([^/]+)$/) && method === 'POST') {
            const catId = pathname.split('/')[4];
            const body = await parseBody(req);
            const data = readMenu();
            const cat = data.categories.find(c => c.id === catId);
            if (!cat) return sendJSON(res, { error: 'Kategori bulunamadı' }, 404);

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
            writeMenu(data);
            return sendJSON(res, newItem);
        }

        // Update item
        if (pathname.match(/^\/api\/menu\/item\/([^/]+)\/([^/]+)$/) && method === 'PUT') {
            const parts = pathname.split('/');
            const catId = parts[4];
            const itemId = parts[5];
            const body = await parseBody(req);
            const data = readMenu();
            const cat = data.categories.find(c => c.id === catId);
            if (!cat) return sendJSON(res, { error: 'Kategori bulunamadı' }, 404);

            const itemIndex = cat.items.findIndex(i => i.id === itemId);
            if (itemIndex === -1) return sendJSON(res, { error: 'Ürün bulunamadı' }, 404);

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

            writeMenu(data);
            return sendJSON(res, item);
        }

        // Delete item
        if (pathname.match(/^\/api\/menu\/item\/([^/]+)\/([^/]+)$/) && method === 'DELETE') {
            const parts = pathname.split('/');
            const catId = parts[4];
            const itemId = parts[5];
            const data = readMenu();
            const cat = data.categories.find(c => c.id === catId);
            if (!cat) return sendJSON(res, { error: 'Kategori bulunamadı' }, 404);

            cat.items = cat.items.filter(i => i.id !== itemId);
            writeMenu(data);
            return sendJSON(res, { success: true });
        }

        // Add category
        if (pathname === '/api/menu/category' && method === 'POST') {
            const body = await parseBody(req);
            const data = readMenu();
            const newCat = {
                id: slugify(body.name) + '-' + Date.now().toString(36),
                name: body.name,
                icon: body.icon || '📋',
                items: []
            };
            data.categories.push(newCat);
            writeMenu(data);
            return sendJSON(res, newCat);
        }

        // Update category
        if (pathname.match(/^\/api\/menu\/category\/([^/]+)$/) && method === 'PUT') {
            const catId = pathname.split('/')[4];
            const body = await parseBody(req);
            const data = readMenu();
            const cat = data.categories.find(c => c.id === catId);
            if (!cat) return sendJSON(res, { error: 'Kategori bulunamadı' }, 404);

            if (body.name) cat.name = body.name;
            if (body.icon) cat.icon = body.icon;
            writeMenu(data);
            return sendJSON(res, cat);
        }

        // Delete category
        if (pathname.match(/^\/api\/menu\/category\/([^/]+)$/) && method === 'DELETE') {
            const catId = pathname.split('/')[4];
            const data = readMenu();
            data.categories = data.categories.filter(c => c.id !== catId);
            writeMenu(data);
            return sendJSON(res, { success: true });
        }

        // Settings
        if (pathname === '/api/settings' && method === 'PUT') {
            const body = await parseBody(req);
            const data = readMenu();
            data.restaurant = { ...data.restaurant, ...body };
            writeMenu(data);
            return sendJSON(res, data.restaurant);
        }

        // QR URL - uses external API
        if (pathname === '/api/qr-url' && method === 'GET') {
            const menuUrl = PUBLIC_URL || `http://${req.headers.host}`;
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(menuUrl)}&color=2c1810&bgcolor=ffffff&margin=10`;
            return sendJSON(res, { url: menuUrl, qrApiUrl });
        }

        // ===== STATIC FILES =====

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
        sendJSON(res, { error: 'Sunucu hatası' }, 500);
    }
});

server.listen(PORT, () => {
    console.log('');
    console.log('  ☕ Noa Caffe & Co - QR Menü Sistemi');
    console.log('  ───────────────────────────────────');
    console.log(`  🌐 Menü:    http://localhost:${PORT}`);
    console.log(`  🔧 Admin:   http://localhost:${PORT}/admin`);
    console.log('  ───────────────────────────────────');
    console.log('');
});
