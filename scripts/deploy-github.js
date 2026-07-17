const fs = require('fs');
const path = require('path');

const REPO = 'EmreAydin16/noa-caffe-menu';
const BRANCH = 'main';
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
    console.error('GITHUB_TOKEN gerekli. Kullanim:');
    console.error('  $env:GITHUB_TOKEN="ghp_xxx"; node scripts/deploy-github.js');
    process.exit(1);
}

const ROOT = path.join(__dirname, '..');

const FILES = [
    'server.js',
    'package.json',
    'render.yaml',
    '.gitignore',
    'README.md',
    'public/index.html',
    'public/admin.html',
    'public/logo.svg',
    'public/css/menu.css',
    'public/css/admin.css',
    'public/js/menu.js',
    'public/js/admin.js',
    'data/menu.json',
];

async function api(endpoint, opts = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
    const res = await fetch(url, {
        ...opts,
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            ...(opts.headers || {})
        }
    });
    const text = await res.text();
    if (!res.ok && res.status !== 404) {
        throw new Error(`GitHub API ${res.status}: ${text.slice(0, 300)}`);
    }
    return { status: res.status, data: text ? JSON.parse(text) : null };
}

async function getLatestCommitSha() {
    const { status, data } = await api(`/repos/${REPO}/git/ref/heads/${BRANCH}`);
    if (status === 404) return null;
    return data.object.sha;
}

async function getTreeSha(commitSha) {
    const { data } = await api(`/repos/${REPO}/git/commits/${commitSha}`);
    return data.tree.sha;
}

async function createBlob(content) {
    const { data } = await api(`/repos/${REPO}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: Buffer.from(content).toString('base64'), encoding: 'base64' })
    });
    return data.sha;
}

async function createTree(baseTreeSha, items) {
    const { data } = await api(`/repos/${REPO}/git/trees`, {
        method: 'POST',
        body: JSON.stringify({ base_tree: baseTreeSha, tree: items })
    });
    return data.sha;
}

async function createCommit(treeSha, parentSha, message) {
    const body = { message, tree: treeSha };
    if (parentSha) body.parents = [parentSha];
    const { data } = await api(`/repos/${REPO}/git/commits`, {
        method: 'POST',
        body: JSON.stringify(body)
    });
    return data.sha;
}

async function updateRef(sha) {
    const existing = await getLatestCommitSha();
    if (existing) {
        await api(`/repos/${REPO}/git/refs/heads/${BRANCH}`, {
            method: 'PATCH',
            body: JSON.stringify({ sha, force: true })
        });
    } else {
        await api(`/repos/${REPO}/git/refs`, {
            method: 'POST',
            body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha })
        });
    }
}

async function main() {
    console.log('GitHub push basliyor...');
    console.log(`Repo: ${REPO}, Branch: ${BRANCH}`);

    const commitSha = await getLatestCommitSha();
    const baseTreeSha = commitSha ? await getTreeSha(commitSha) : null;
    console.log(`Mevcut commit: ${commitSha ? commitSha.slice(0, 8) : 'yok'}`);

    const treeItems = [];
    for (const file of FILES) {
        const fullPath = path.join(ROOT, file);
        if (!fs.existsSync(fullPath)) {
            console.log(`  [ATLA] ${file} bulunamadi`);
            continue;
        }
        const content = fs.readFileSync(fullPath);
        const blobSha = await createBlob(content);
        treeItems.push({ path: file, mode: '100644', type: 'blob', sha: blobSha });
        console.log(`  [OK] ${file}`);
    }

    const treeSha = await createTree(baseTreeSha, treeItems);
    const newCommitSha = await createCommit(treeSha, commitSha, 'Fix: QR kod, urun foto guncelleme, onbellek, gzip, bant tasarrufu');
    await updateRef(newCommitSha);

    console.log('');
    console.log(`Push tamam! Commit: ${newCommitSha.slice(0, 8)}`);
    console.log('Render 2-3 dk icinde otomatik deploy edecek.');
    console.log(`https://github.com/${REPO}/commits/${BRANCH}`);
}

main().catch(err => {
    console.error('HATA:', err.message);
    process.exit(1);
});
