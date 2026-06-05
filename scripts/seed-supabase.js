/**
 * Mevcut menu.json verisini Supabase'e yukler.
 * Kullanim:
 *   set SUPABASE_URL=https://xxx.supabase.co
 *   set SUPABASE_SERVICE_KEY=eyJ...
 *   node scripts/seed-supabase.js
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('SUPABASE_URL ve SUPABASE_SERVICE_KEY gerekli');
    process.exit(1);
}

const menu = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'menu.json'), 'utf8'));

fetch(`${SUPABASE_URL}/rest/v1/menu_store`, {
    method: 'POST',
    headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({
        id: 'main',
        data: menu,
        updated_at: new Date().toISOString()
    })
}).then(async res => {
    if (!res.ok) {
        console.error('Hata:', res.status, await res.text());
        process.exit(1);
    }
    console.log('Menu Supabase\'e yuklendi.');
}).catch(err => {
    console.error(err);
    process.exit(1);
});
