const fs = require('fs');
let bad = 0;
for (const f of ['index.html', 'details.html', 'admin.html']) {
    const h = fs.readFileSync(f, 'utf8');
    const rg = /<script[^>]*>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = rg.exec(h))) {
        const s = m[1];
        if (!s.trim()) continue;
        try { new Function(s); }
        catch (e) { bad++; console.log(f, 'SYNTAX ERROR:', e.message); }
    }
    const open = (h.match(/<div[\s\S]*?>/g) || []).length;
    const close = (h.match(/<\/div>/g) || []).length;
    console.log(f, 'div open/close:', open, close, open === close ? 'OK' : 'MISMATCH');
}
console.log(bad === 0 ? 'ALL SCRIPTS OK' : 'SYNTAX ERRORS: ' + bad);