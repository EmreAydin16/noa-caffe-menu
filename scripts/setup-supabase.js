/**
 * Supabase Storage kurulumu - SQL gerekmez.
 * Kullanim:
 *   set SUPABASE_URL=https://xxx.supabase.co
 *   set SUPABASE_SERVICE_KEY=eyJ...
 *   node scripts/setup-supabase.js
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'noa-menu';
const FILE = 'menu.json';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('SUPABASE_URL ve SUPABASE_SERVICE_KEY gerekli');
    process.exit(1);
}

function headers(extra = {}) {
    return {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        ...extra
    };
}

async function main() {
    console.log('1/3 Bucket olusturuluyor...');
    const bucketRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
        method: 'POST',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: BUCKET, public: false })
    });
    if (!bucketRes.ok && bucketRes.status !== 409) {
        throw new Error(await bucketRes.text());
    }
    console.log('   Bucket hazir');

    console.log('2/3 Menu yukleniyor...');
    const menu = JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', 'data', 'menu.json'), 'utf8')
    );
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${FILE}`, {
        method: 'POST',
        headers: headers({
            'Content-Type': 'application/json',
            'x-upsert': 'true'
        }),
        body: JSON.stringify(menu, null, 2)
    });
    if (!uploadRes.ok) throw new Error(await uploadRes.text());
    console.log('   Menu yuklendi');

    console.log('3/3 Dogrulaniyor...');
    const checkRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${FILE}`, {
        headers: headers()
    });
    if (!checkRes.ok) throw new Error(await checkRes.text());
    const data = await checkRes.json();
    const count = data.categories?.reduce((n, c) => n + c.items.length, 0) || 0;
    console.log(`   ${data.categories?.length || 0} kategori, ${count} urun OK`);
    console.log('');
    console.log('Supabase kurulumu tamam!');
}

main().catch(err => {
    console.error('HATA:', err.message || err);
    process.exit(1);
});
