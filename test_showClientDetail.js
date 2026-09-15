// Verifies the /admin client detail view against the REAL Firebase data shape.
// Firebase Realtime Database stores arrays as index-keyed objects, so this test
// deliberately uses object-shaped arrays (the cause of the original bug where
// clicking a client showed nothing).
const fs = require('fs');
const vm = require('vm');

const c = fs.readFileSync('admin.html', 'utf8');
const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
let m, i = 0;
const scripts = {};
while ((m = re.exec(c))) {
    i++;
    const s = m[1].trim();
    if (s) scripts[i] = s;
}
const scriptKeys = Object.keys(scripts).map(Number).sort((a, b) => a - b);
console.log('[INFO] inline script blocks found:', scriptKeys.join(', '));

// ---- Minimal DOM shim ----
class ClassList {
    constructor() { this.set = new Set(); }
    add(...cs) { cs.forEach(x => this.set.add(x)); }
    remove(...cs) { cs.forEach(x => this.set.delete(x)); }
    contains(x) { return this.set.has(x); }
    toggle(x) { this.set.has(x) ? this.set.delete(x) : this.set.add(x); }
}
const clickedAnchors = [];
class El {
    constructor(tag, id) {
        this.tagName = (tag || 'div').toUpperCase();
        this.id = id || '';
        this.style = {};
        this.classList = new ClassList();
        this._innerHTML = '';
        this.children = [];
        this.handlers = {};
        this.value = '';
        this.textContent = '';
        this.download = '';
        this.href = '';
    }
    get innerHTML() { return this._innerHTML; }
    set innerHTML(v) { this._innerHTML = String(v); this.children = []; }
    addEventListener(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); }
    appendChild(ch) { this.children.push(ch); return ch; }
    remove() {}
    click() { clickedAnchors.push({ href: this.href, download: this.download }); }
    querySelectorAll() { return []; }
    querySelector() { return null; }
    closest() { return null; }
    getAttribute() { return null; }
    setAttribute() {}
}
const elements = new Map();
function getEl(id) {
    if (!elements.has(id)) elements.set(id, new El('div', id));
    return elements.get(id);
}
const documentMock = {
    getElementById: (id) => getEl(id),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: (t) => new El(t),
    body: new El('body'),
    documentElement: new El('html'),
};
const windowMock = {
    scrollTo: () => {},
    addEventListener: () => {},
    open: () => {},
    location: { href: 'http://localhost/admin.html', origin: 'http://localhost' },
    alert: (msg) => console.log('[ALERT]:', msg),
};
let fetchCalls = 0;

// ---- Firebase sample data (REAL shape: arrays are index-keyed objects) ----
const sampleData = {
    '-P1Le4kKiQDRBGmi-cm1': {
        date: '2026-09-12T17:26:51.157Z',
        status: 'New',
        url: 'https://webdrop.systomic.com',
        order: {
            businessName: 'WebDrop',
            businessType: 'restaurants',
            businessTypeLabel: 'Restaurants',
            websiteLevel: 'premium',
            websiteLevelLabel: 'Premium',
            phone: '555-0100',
            email: 'a@b.c',
            address: '1 Main St',
            whatsapp: '555-0100',
            brandColor: '#55EFC4',
            brandTheme: 'Spring Green',
            brandPalette: { '0': '#55EFC4', '1': '#00B894', '2': '#2D3436' },
            logoName: 'logo.png',
            logoUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/logo.png?alt=media',
            photoUrls: {
                '0': { name: 'front.jpg', url: 'https://firebasestorage.googleapis.com/v0/b/x/o/front.jpg?alt=media', size: 2048, type: 'image/jpeg' },
                '1': { name: 'interior.jpg', url: 'https://firebasestorage.googleapis.com/v0/b/x/o/interior.jpg?alt=media', size: 4096, type: 'image/jpeg' },
            },
            videoUrls: {
                '0': { name: 'tour.mp4', url: 'https://firebasestorage.googleapis.com/v0/b/x/o/tour.mp4?alt=media', size: 1048576, type: 'video/mp4' },
            },
            photosCount: 2,
            videosCount: 1,
        },
        details: {
            projectType: 'New Website',
            yearEstablished: '2020',
            companyDescription: 'Test co',
            topGoals: 'Sales',
            targetAudience: { '0': 'Everyone' },
            businessGoals: { '0': 'Get more leads' },
            websitePages: { '0': 'Home', '1': 'About' },
            websiteFeatures: { '0': 'Contact form' },
            nicheSelections: { '0': 'Online ordering' },
            socialMedia: { instagram: 'https://instagram.com/x' },
            hasDomain: 'Yes',
            domainName: 'webdrop.com',
            hasHosting: 'No',
            platforms: { '0': 'WordPress', '1': 'Shopify' },
        },
    },
    // Second client whose details were never completed - must not crash
    '-P2NoDetails0000000000': {
        date: '2026-09-10T10:00:00.000Z',
        status: 'Approved',
        url: '',
        order: {
            businessName: 'Bare Co',
            businessTypeLabel: 'Retail',
            websiteLevelLabel: 'Basic',
            phone: '555-0200',
            photosCount: 3,
            videosCount: 0,
        },
        details: null,
    },
};

// ---- Firebase mock ----
function makeSnapshot(data, key) {
    const keys = Object.keys(data);
    return {
        val: () => data,
        exists: () => keys.length > 0,
        key: key || null,
        forEach: function(cb) {
            keys.forEach(k => {
                const child = makeSnapshot(data[k], k);
                cb(child);
            });
        },
    };
}
const firebaseMock = {
    apps: [],
    initializeApp: () => {},
    database: () => ({
        ref: (path) => ({
            on: (evt, cb) => {
                if (evt === 'value') setTimeout(() => cb(makeSnapshot(sampleData, 'submissions')), 10);
            },
            once: (evt, cb) => {
                // Support both the callback style and the promise style
                let snap;
                if (path === 'submissions') {
                    snap = makeSnapshot(sampleData, 'submissions');
                } else {
                    const key = String(path).replace('submissions/', '');
                    snap = makeSnapshot(sampleData[key] || {}, key);
                }
                if (typeof cb === 'function') setTimeout(() => cb(snap), 5);
                return Promise.resolve(snap);
            },
            off: () => {},
            update: () => Promise.resolve(),
            child: () => ({ on: () => {}, off: () => {} }),
        }),
    }),
};

// ---- Build sandbox and run ----
const sandbox = {
    console,
    document: documentMock,
    window: windowMock,
    localStorage: { getItem: () => 'true', setItem: () => {}, removeItem: () => {} },
    firebase: firebaseMock,
    navigator: { userAgent: 'test' },
    setTimeout, clearTimeout,
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
    fetch: () => { fetchCalls++; return Promise.resolve({ blob: () => Promise.resolve({}) }); },
    Blob: function () {},
};
sandbox.window.document = documentMock;
sandbox.window.firebase = firebaseMock;
sandbox.window.localStorage = sandbox.localStorage;
sandbox.window.URL = sandbox.URL;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// ---- Helpers to simulate clicks through delegated listeners ----
function fire(el, type, target) {
    const handlers = (el && el.handlers[type]) || [];
    handlers.forEach(fn => fn({
        target,
        stopPropagation: () => {},
        preventDefault: () => {},
    }));
    return handlers.length;
}
// A fake DOM node that answers closest() for the selectors we care about
function fakeNode(selectors) {
    return {
        dataset: {},
        closest: (sel) => (selectors[sel] ? { dataset: selectors[sel] } : null),
        getAttribute: () => null,
    };
}

const results = [];
function check(label, condition, detail) {
    results.push({ label, ok: !!condition });
    console.log((condition ? '[PASS] ' : '[FAIL] ') + label + (detail !== undefined ? ' -> ' + detail : ''));
}

try {
    scriptKeys.forEach(k => vm.runInContext(scripts[k], sandbox, { filename: 'block' + k + '.js' }));
    console.log('[OK] all admin.html script blocks executed');
} catch (e) {
    console.log('[FAIL] Script execution error:', e.message);
    process.exit(1);
}

const WEBDROP_KEY = '-P1Le4kKiQDRBGmi-cm1';
const BARE_KEY = '-P2NoDetails0000000000';
const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async function run() {
    await delay(60); // let the Firebase snapshot callback fire

    const clientsList = getEl('clientsList');
    const listHtml = clientsList.innerHTML;

    // ---- 1. Client list renders with data-id, no inline handlers ----
    check('client list rendered', listHtml.length > 0, listHtml.length + ' chars');
    check('card has data-id for WebDrop', listHtml.includes('data-id="' + WEBDROP_KEY + '"'));
    check('card has data-id for second client', listHtml.includes('data-id="' + BARE_KEY + '"'));
    check('no inline onclick in client list', !listHtml.includes('onclick='));

    // ---- 2. Clicking a client card opens the detail view ----
    const delegatedClicks = fire(clientsList, 'click', fakeNode({ '.client-card': { id: WEBDROP_KEY } }));
    check('delegated card click handler registered', delegatedClicks > 0, delegatedClicks + ' handler(s)');
    check('viewDetail got the "show" class', getEl('viewDetail').classList.contains('show'));
    check('viewClients hidden', getEl('viewClients').style.display === 'none', getEl('viewClients').style.display);

    await delay(40); // allow the fresh-from-Firebase re-render
    let detailHtml = getEl('clientDetail').innerHTML;

    check('detail HTML generated', detailHtml.length > 500, detailHtml.length + ' chars');
    check('detail contains business name', detailHtml.includes('WebDrop'));
    check('detail did NOT fail to render', !detailHtml.includes('Could not render'));

    // ---- 3. details.html data (object-shaped arrays) renders correctly ----
    check('target audience (object array) rendered', detailHtml.includes('Everyone'));
    check('business goals (object array) rendered', detailHtml.includes('Get more leads'));
    check('website pages (object array) rendered', detailHtml.includes('Home') && detailHtml.includes('About'));
    check('website features (object array) rendered', detailHtml.includes('Contact form'));
    check('niche selections (object array) rendered', detailHtml.includes('Online ordering'));
    check('platforms (object array) rendered', detailHtml.includes('WordPress') && detailHtml.includes('Shopify'));
    check('social media link rendered', detailHtml.includes('instagram.com/x'));

    // ---- 4. Step-4 brand colour + theme ----
    check('brand colour section present', detailHtml.includes('Brand Colour &amp; Theme'));
    check('brand colour value shown', detailHtml.includes('#55EFC4'));
    check('brand theme name shown', detailHtml.includes('Spring Green'));
    check('theme palette swatches rendered', (detailHtml.match(/palette-swatch/g) || []).length >= 3,
          (detailHtml.match(/palette-swatch/g) || []).length + ' swatches');

    // ---- 5. Step-4 uploaded files (logo / photos / videos) ----
    check('logo preview rendered', detailHtml.includes('logo.png') && detailHtml.includes('alt=media'));
    check('photo previews rendered', detailHtml.includes('front.jpg') && detailHtml.includes('interior.jpg'));
    check('video preview rendered', detailHtml.includes('<video') && detailHtml.includes('tour.mp4'));
    check('photo count heading correct', detailHtml.includes('Photos (2)'));
    check('video count heading correct', detailHtml.includes('Videos (1)'));
    check('per-file download buttons rendered',
          (detailHtml.match(/data-download-url=/g) || []).length >= 3,
          (detailHtml.match(/data-download-url=/g) || []).length + ' button(s)');
    check('download-all buttons rendered',
          detailHtml.includes('data-download-all="photos"') && detailHtml.includes('data-download-all="videos"'));
    check('admin.html contains no inline onclick handlers at all', !c.includes('onclick='));

    // ---- 6. Download buttons actually work through delegation ----
    const detailPane = getEl('clientDetail');
    clickedAnchors.length = 0;
    fetchCalls = 0;
    const dlHandlers = fire(detailPane, 'click', fakeNode({
        '[data-download-url]': {
            downloadUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/front.jpg?alt=media',
            downloadName: 'front.jpg',
        },
    }));
    check('detail click delegation registered', dlHandlers > 0, dlHandlers + ' handler(s)');
    await delay(60);
    check('single download triggered a fetch', fetchCalls > 0, fetchCalls + ' fetch(es)');
    check('single download saved as front.jpg',
          clickedAnchors.some(a => a.download === 'front.jpg'),
          JSON.stringify(clickedAnchors));

    clickedAnchors.length = 0;
    fetchCalls = 0;
    fire(detailPane, 'click', fakeNode({ '[data-download-all]': { downloadAll: 'photos' } }));
    await delay(1600); // downloads are staggered ~700ms apart
    check('download-all fetched every photo', fetchCalls >= 2, fetchCalls + ' fetch(es)');
    check('download-all used real filenames',
          clickedAnchors.some(a => a.download === 'front.jpg') &&
          clickedAnchors.some(a => a.download === 'interior.jpg'),
          JSON.stringify(clickedAnchors.map(a => a.download)));

    // ---- 7. Status change still works (list dropdown) ----
    const fakeSelect = {
        value: 'Approved',
        getAttribute: (a) => (a === 'data-key' ? WEBDROP_KEY : null),
        closest: (sel) => (sel === 'select.status-select' ? fakeSelect : null),
    };
    let statusError = null;
    try {
        fire(clientsList, 'change', fakeSelect);
    } catch (e) { statusError = e; }
    check('status change via list dropdown runs', !statusError, statusError && statusError.message);

    // ---- 8. Status controls inside the detail view ----
    let statusErr = null;
    try {
        fire(detailPane, 'click', fakeNode({
            '[data-status-set]': { statusKey: WEBDROP_KEY, statusSet: 'Approved' },
        }));
        fire(detailPane, 'click', fakeNode({ '[data-status-menu]': { statusMenu: WEBDROP_KEY } }));
    } catch (e) { statusErr = e; }
    check('status controls inside detail view run', !statusErr, statusErr && statusErr.message);
    check('no inline onclick in detail view after rerender', !getEl('clientDetail').innerHTML.includes('onclick='));

    // ---- 9. A client with no details must not crash ----
    detailHtml = getEl('clientDetail').innerHTML;
    fire(clientsList, 'click', fakeNode({ '.client-card': { id: BARE_KEY } }));
    await delay(40);
    const bareHtml = getEl('clientDetail').innerHTML;
    check('detail for client without details rendered', bareHtml.includes('Bare Co'), bareHtml.length + ' chars');
    check('no literal "undefined" in bare detail', !bareHtml.includes('undefined'));
    check('legacy-order hint shown when files are missing', bareHtml.includes('cannot be recovered'));
    check('no literal "undefined" in full detail', !detailHtml.includes('undefined'));

    // ---- Summary ----
    const failed = results.filter(r => !r.ok);
    console.log('\n=== ' + (results.length - failed.length) + '/' + results.length + ' checks passed ===');
    if (failed.length) {
        console.log('FAILED CHECKS:');
        failed.forEach(f => console.log(' - ' + f.label));
        process.exit(1);
    }
    console.log('=== SIMULATION PASSED ===');
})();

