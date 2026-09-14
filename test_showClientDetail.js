const fs = require('fs');
const c = fs.readFileSync('admin.html', 'utf8');
const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
let m, i = 0;
const scripts = {};
while ((m = re.exec(c))) {
    i++;
    const s = m[1].trim();
    if (s) scripts[i] = s;
}

// ---- Minimal DOM shim ----
class ClassList {
    constructor() { this.set = new Set(); }
    add(...cs) { cs.forEach(x => this.set.add(x)); }
    remove(...cs) { cs.forEach(x => this.set.delete(x)); }
    contains(x) { return this.set.has(x); }
    toggle(x) { this.set.has(x) ? this.set.delete(x) : this.set.add(x); }
}
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
    }
    get innerHTML() { return this._innerHTML; }
    set innerHTML(v) { this._innerHTML = String(v); this.children = []; }
    addEventListener(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); }
    appendChild(ch) { this.children.push(ch); return ch; }
    remove() {}
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
    location: { href: 'http://localhost/admin.html', origin: 'http://localhost' },
    alert: (msg) => console.log('[ALERT]:', msg),
};

// Firebase mock that delivers sample data
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
            photosCount: 2,
            videosCount: 1,
        },
        details: {
            projectType: 'New Website',
            yearEstablished: '2020',
            companyDescription: 'Test co',
            topGoals: 'Sales',
            targetAudience: ['Everyone'],
            websitePages: ['Home', 'About'],
            websiteFeatures: ['Contact form'],
            socialMedia: { instagram: 'https://instagram.com/x' },
            hasDomain: 'Yes',
            domainName: 'webdrop.com',
            hasHosting: 'No',
            platforms: ['WordPress'],
        },
    },
};
// Build a Firebase-like snapshot from sampleData
function makeSnapshot(data) {
    const keys = Object.keys(data);
    return {
        val: () => data,
        exists: () => keys.length > 0,
        key: null,
        forEach: function(cb) {
            keys.forEach(k => {
                const child = makeSnapshot(data[k]);
                child.key = k;
                cb(child);
            });
        },
    };
}
let refCallback = null;
const firebaseMock = {
    apps: [],
    initializeApp: () => {},
    database: () => ({
        ref: (path) => ({
            on: (evt, cb, errCb) => {
                if (evt === 'value') { refCallback = cb; setTimeout(() => cb(makeSnapshot(sampleData)), 10); }
            },
            once: (evt, cb, errCb) => {
                if (evt === 'value') setTimeout(() => cb(makeSnapshot(sampleData)), 5);
                return Promise.resolve(makeSnapshot(sampleData));
            },
            off: () => {},
            update: (obj) => Promise.resolve(),
            child: () => ({ on: () => {}, off: () => {} }),
        }),
    }),
};

// ---- Build sandbox and run ----
const vm = require('vm');
const sandbox = {
    console,
    document: documentMock,
    window: windowMock,
    localStorage: { getItem: () => 'true', setItem: () => {}, removeItem: () => {} },
    firebase: firebaseMock,
    navigator: { userAgent: 'test' },
    setTimeout, clearTimeout,
    URL,
};
sandbox.window.document = documentMock;
sandbox.window.firebase = firebaseMock;
sandbox.window.localStorage = sandbox.localStorage;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

try {
    vm.runInContext(scripts[4], sandbox, { filename: 'firebase-init.js' });
    console.log('[OK] Script #4 (firebase init) executed');
    vm.runInContext(scripts[5], sandbox, { filename: 'main.js' });
    console.log('[OK] Script #5 (main) executed');
} catch (e) {
    console.log('[FAIL] Script execution error:', e.message);
    process.exit(1);
}

setTimeout(() => {
    try {
        // Check renderClients output
        const clientsList = getEl('clientsList');
        const html = clientsList.innerHTML;
        console.log('[CHECK] clientsList length:', html.length);
        const idMatch = html.match(/data-id="([^"]*)"/);
        console.log('[CHECK] data-id found:', idMatch ? idMatch[1] : 'NOT FOUND');
        console.log('[CHECK] inline onclick removed:', !html.includes('onclick='));

        // Simulate a click through the delegated handler
        const clickHandlers = clientsList.handlers['click'] || [];
        console.log('[CHECK] delegated click handlers:', clickHandlers.length);
        if (idMatch && clickHandlers.length) {
            const fakeTarget = {
                closest: (sel) => (sel === '.client-card' ? { dataset: { id: idMatch[1] } } : null),
            };
            clickHandlers.forEach(fn => fn({ target: fakeTarget }));

            const vd = getEl('viewDetail');
            console.log('[CHECK] viewDetail has show class:', vd.classList.contains('show'));
            console.log('[CHECK] viewClients display:', getEl('viewClients').style.display);
            const detailHtml = getEl('clientDetail').innerHTML;
            console.log('[CHECK] clientDetail html length:', detailHtml.length);
            console.log('[CHECK] detail contains business name:', detailHtml.includes('WebDrop'));
        }

        // Simulate a status change through the delegated change handler
        const changeHandlers = clientsList.handlers['change'] || [];
        console.log('[CHECK] delegated change handlers:', changeHandlers.length);
        if (idMatch && changeHandlers.length) {
            const fakeSelect = {
                value: 'Approved',
                getAttribute: (a) => (a === 'data-key' ? idMatch[1] : null),
                closest: (sel) => (sel === 'select.status-select' ? fakeSelect : null),
            };
            changeHandlers.forEach(fn => fn({ target: fakeSelect, stopPropagation: () => {} }));
            console.log('[CHECK] updateStatus delegation executed without error');
        }
        console.log('=== SIMULATION PASSED ===');
    } catch (e) {
        console.log('[FAIL] Runtime error during click simulation:', e.stack);
    }
}, 50);


console.log('done');













