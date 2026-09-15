// Verifies the step-4 asset upload logic in index.html (logo / photos / videos
// are pushed to Firebase Storage so the admin can view and download them).
// The real upload helpers are sliced out of index.html and executed here, so
// this tests the shipped code and not a copy of it.
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');

const START = '// ===== Firebase Storage asset upload helpers =====';
const END = 'function submitOrder() {';
const startIdx = html.indexOf(START);
const endIdx = html.indexOf(END);
if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    console.log('[FAIL] Could not locate the upload helpers in index.html');
    process.exit(1);
}
const helperSource = html.slice(startIdx, endIdx);
console.log('[INFO] extracted ' + helperSource.length + ' chars of upload helper code');

// ---- Firebase Storage mock ----
const state = { puts: [], progress: [], failPrefix: null, downloadUrls: [] };
function makeRef(path) {
    return {
        path: path,
        put: function (file) {
            state.puts.push({ path: path, name: file.name, size: file.size });
            return {
                on: function (evt, onProgress, onError, onComplete) {
                    setTimeout(function () {
                        if (state.failPrefix && file.name.indexOf(state.failPrefix) === 0) {
                            if (onError) onError({ message: 'simulated upload failure', code: 'storage/unknown' });
                        } else if (onComplete) {
                            onComplete();
                        }
                    }, 1);
                },
            };
        },
        getDownloadURL: function () {
            const url = 'https://firebasestorage.googleapis.com/v0/b/test/o/' +
                        encodeURIComponent(path) + '?alt=media';
            state.downloadUrls.push(url);
            return Promise.resolve(url);
        },
    };
}
const firebaseMock = {
    apps: [],
    initializeApp: function () {},
    database: function () { return { ref: function () { return {}; } }; },
    storage: function () { return { ref: makeRef }; },
};

// ---- Sandbox ----
const windowMock = {
    updateAssetProgress: function (p) { state.progress.push({ done: p.done, total: p.total }); },
};
const sandbox = {
    console: console,
    window: windowMock,
    firebase: firebaseMock,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Promise: Promise,
    logoFile: null,
    uploadedPhotos: [],
    uploadedVideos: [],
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

try {
    vm.runInContext(helperSource, sandbox, { filename: 'upload-helpers.js' });
    console.log('[OK] upload helpers loaded');
} catch (e) {
    console.log('[FAIL] Could not load upload helpers:', e.message);
    process.exit(1);
}

// ---- Helpers ----
function setFiles(logo, photos, videos) {
    sandbox.logoFile = logo;
    sandbox.uploadedPhotos = photos || [];
    sandbox.uploadedVideos = videos || [];
}
function file(name, size, type) {
    return { name: name, size: size, type: type };
}
const results = [];
function check(label, condition, detail) {
    results.push({ label: label, ok: !!condition });
    console.log((condition ? '[PASS] ' : '[FAIL] ') + label + (detail !== undefined ? ' -> ' + detail : ''));
}
const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async function run() {
    // ---- 1. Happy path: logo + 2 photos + 1 video ----
    setFiles(
        file('logo.png', 9000, 'image/png'),
        [file('front.jpg', 2048, 'image/jpeg'), file('interior.jpg', 4096, 'image/jpeg')],
        [file('tour.mp4', 1048576, 'video/mp4')]
    );

    const assets = await sandbox.uploadAllAssets();
    await delay(20);

    check('every selected file was uploaded', state.puts.length === 4, state.puts.length + ' upload(s)');
    check('uploads go to the logo folder',
          state.puts.some(p => p.path.indexOf('client-assets/logo/') === 0));
    check('uploads go to the photos folder',
          state.puts.filter(p => p.path.indexOf('client-assets/photos/') === 0).length === 2,
          state.puts.filter(p => p.path.indexOf('client-assets/photos/') === 0).length + ' photo upload(s)');
    check('uploads go to the videos folder',
          state.puts.some(p => p.path.indexOf('client-assets/videos/') === 0));
    check('original filenames kept in the storage path',
          state.puts.some(p => p.path.endsWith('front.jpg')) && state.puts.some(p => p.path.endsWith('tour.mp4')));
    check('storage paths are unique',
          new Set(state.puts.map(p => p.path)).size === 4, new Set(state.puts.map(p => p.path)).size + ' unique');

    check('logo URL returned', !!(assets.logo && assets.logo.url), assets.logo && assets.logo.url);
    check('logo keeps its original filename', assets.logo && assets.logo.name === 'logo.png');
    check('logo keeps its mime type', assets.logo && assets.logo.type === 'image/png');
    check('all photo URLs returned', assets.photos.length === 2, assets.photos.length + ' photo(s)');
    check('photo metadata returned (name/size/type)',
          assets.photos[0] && assets.photos[0].name === 'front.jpg' && assets.photos[0].size === 2048);
    check('all video URLs returned', assets.videos.length === 1, assets.videos.length + ' video(s)');
    check('progress total matches the file count', state.progress[0] && state.progress[0].total === 4,
          JSON.stringify(state.progress[0]));
    check('progress reaches 4/4', state.progress.length > 0 &&
          state.progress[state.progress.length - 1].done === 4,
          JSON.stringify(state.progress.slice(-1)));

    // ---- 2. No files selected: must resolve, not hang ----
    state.puts.length = 0;
    setFiles(null, [], []);
    const empty = await sandbox.uploadAllAssets();
    check('empty selection returns empty assets',
          empty.logo === null && empty.photos.length === 0 && empty.videos.length === 0);
    check('empty selection performs no uploads', state.puts.length === 0);

    // ---- 3. A failing upload must not break the whole order ----
    state.failPrefix = 'broken';
    setFiles(
        file('logo.png', 100, 'image/png'),
        [file('broken1.jpg', 100, 'image/jpeg'), file('good.jpg', 100, 'image/jpeg')],
        []
    );
    let threw = null;
    let partial;
    try {
        partial = await sandbox.uploadAllAssets();
    } catch (e) { threw = e; }
    state.failPrefix = null;
    await delay(20);

    check('failed upload does not reject the promise', !threw, threw && threw.message);
    check('successful files are still returned', partial && partial.photos.length === 1,
          partial && partial.photos.length + ' photo(s)');
    check('failed file is excluded from the results',
          partial && !partial.photos.some(p => p.name.indexOf('broken') === 0));
    check('logo still uploaded while a photo failed', !!(partial && partial.logo));

    // ---- 4. Storage unavailable must not break the order ----
    setFiles(file('logo.png', 100, 'image/png'), [file('a.jpg', 100, 'image/jpeg')], []);
    const savedFirebase = sandbox.firebase;
    sandbox.firebase = { database: function () { return { ref: function () { return {}; } }; } }; // no .storage
    let threw2 = null;
    let noStorage;
    try {
        noStorage = await sandbox.uploadAllAssets();
    } catch (e) { threw2 = e; }
    sandbox.firebase = savedFirebase;
    check('missing Firebase Storage does not reject', !threw2, threw2 && threw2.message);
    check('missing Firebase Storage returns empty assets',
          noStorage && !noStorage.logo && noStorage.photos.length === 0);

    // ---- 5. submitOrder() must persist the uploaded URLs ----
    const submitSrc = html.slice(html.indexOf('function submitOrder()'));
    check('submitOrder stores logoUrl', submitSrc.includes('formData.logoUrl ='));
    check('submitOrder stores logoFileName', submitSrc.includes('formData.logoFileName ='));
    check('submitOrder stores photoUrls', submitSrc.includes('formData.photoUrls = assets.photos'));
    check('submitOrder stores videoUrls', submitSrc.includes('formData.videoUrls = assets.videos'));
    check('submitOrder stores the real photo count', submitSrc.includes('formData.photosCount = assets.photos.length'));
    check('submitOrder stores the real video count', submitSrc.includes('formData.videosCount = assets.videos.length'));
    check('submitOrder saves the enriched formData to Firebase', /order:\s*formData/.test(submitSrc));
    check('submitOrder uploads before writing to the database',
          submitSrc.indexOf('uploadAllAssets()') < submitSrc.indexOf("ref('submissions').push()"));

    // ---- 6. Brand colour + theme palette captured in step 4 ----
    check('selectedThemeColors is declared', html.includes('let selectedThemeColors = null;'));
    check('selecting a theme captures its palette',
          /selectedThemeColors\s*=\s*theme\.colors\.slice\(\)/.test(html));
    check('brandPalette is sent to Firebase', html.includes('brandPalette: selectedThemeColors'));
    check('brandColor still sent to Firebase', html.includes('brandColor: selectedColor'));

    // ---- 7. Firebase Storage SDK is loaded on the main page ----
    check('firebase-storage-compat.js is included',
          /firebase-storage-compat\.js/.test(html));

    // ---- 8. Duplicate submission guard (click + submit both fire) ----
    check('double-submit guard exists', html.includes('__systomicSubmitting'));
    check('guard is set before uploading',
          submitSrc.indexOf('window.__systomicSubmitting = true') < submitSrc.indexOf('uploadAllAssets()'));
    check('the guard is single-shot and stays locked after submit',
          !submitSrc.includes('__systomicSubmitting = false'));
    check('a failed database write still redirects to details.html',
          /catch\(function\(error\)[\s\S]{0,400}details\.html/.test(submitSrc));

    // ---- Summary ----
    const failed = results.filter(r => !r.ok);
    console.log('\n=== ' + (results.length - failed.length) + '/' + results.length + ' checks passed ===');
    if (failed.length) {
        console.log('FAILED CHECKS:');
        failed.forEach(f => console.log(' - ' + f.label));
        process.exit(1);
    }
    console.log('=== ASSET UPLOAD SIMULATION PASSED ===');
})();
