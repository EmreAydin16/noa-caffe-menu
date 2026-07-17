/**
 * Canlı menüyü okur ve yedekler — menu.json'a DOKUNMAZ.
 * Kullanım: node scripts/backup-live.js
 */
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pyxcgtsbjyvifpafqdjv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5eGNndHNianl2aWZwYWZxZGp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY2NTY4MiwiZXhwIjoyMDk2MjQxNjgyfQ.zOuy1xKsUabkwSMpDtae3OIkeJjIxk3I9nZDYJWWHNA';
const BUCKET = 'noa-menu';
const FILE = 'menu.json';

if (!SUPABASE_KEY) {
    console.error('SUPABASE_SERVICE_KEY gerekli');
    process.exit(1);
}

function headers(extra = {}) {
    return {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        ...extra
    };
}

function backupTimestamp() {
    return new Date().toISOString().slice(0, 19).replace(/:/g, '-');
}

async function upload(filePath, content) {
    const res = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`,
        {
            method: 'POST',
            headers: headers({
                'Content-Type': 'application/json',
                'x-upsert': 'true'
            }),
            body: content
        }
    );
    if (!res.ok) throw new Error(`Yukleme hatasi ${filePath}: ${res.status} ${await res.text()}`);
}

async function main() {
    const res = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${FILE}`,
        { headers: headers() }
    );

    if (!res.ok) {
        console.error('Canli menu okunamadi:', res.status, await res.text());
        process.exit(1);
    }

    const data = await res.json();
    const payload = JSON.stringify(data, null, 2);
    const ts = backupTimestamp();

    const dir = path.join(__dirname, '..', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `menu-live-${ts}.json`), payload, 'utf8');
    fs.writeFileSync(path.join(dir, 'menu-latest.json'), payload, 'utf8');

    await upload(`backups/menu-live-${ts}.json`, payload);
    await upload('backups/menu-latest.json', payload);

    console.log('Yedek alindi:', ts);
    console.log('Kategori sayisi:', data.categories?.length ?? 0);
    console.log('menu.json degistirilmedi.');
}

main().catch(err => {
    console.error(err.message);
    process.exit(1);
});
