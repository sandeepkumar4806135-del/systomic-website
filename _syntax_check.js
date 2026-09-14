const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('admin.html', 'utf8');
const re = /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g;
let m, i = 0;
while ((m = re.exec(html))) {
  i++;
  const js = m[1];
  if (!js.trim()) { console.log('block ' + i + ': empty, skip'); continue; }
  const upto = html.slice(0, m.index).split('\n').length;
  console.log('block ' + i + ' starts at html line ~' + upto + ', js length=' + js.length);
  try {
    new vm.Script(js);
    console.log('  SYNTAX OK');
  } catch (e) {
    console.log('  SYNTAX ERROR: ' + e.message);
    console.log('  ' + (e.stack || '').split('\n').slice(0, 5).join('\n  '));
  }
}
