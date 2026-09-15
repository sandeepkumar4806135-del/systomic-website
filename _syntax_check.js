const fs = require('fs');
const vm = require('vm');

// Syntax-check every inline <script> block in each HTML page, so a broken
// template literal or a truncated edit can never reach production silently.
const files = process.argv.slice(2);
const targets = files.length ? files : ['index.html', 'details.html', 'admin.html'];

let totalErrors = 0;

targets.forEach(function(file) {
  let html;
  try {
    html = fs.readFileSync(file, 'utf8');
  } catch (e) {
    console.log('[' + file + '] ERROR: cannot read file');
    totalErrors++;
    return;
  }

  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, i = 0;
  let errors = 0;
  let ok = 0;

  while ((m = re.exec(html))) {
    i++;
    const js = m[1];
    if (!js.trim()) continue;
    const line = html.slice(0, m.index).split('\n').length;
    try {
      new vm.Script(js);
      ok++;
      console.log('[' + file + '] block ' + i + ' (html line ~' + line + ', ' + js.length + ' chars): SYNTAX OK');
    } catch (e) {
      errors++;
      totalErrors++;
      console.log('[' + file + '] block ' + i + ' (html line ~' + line + '): SYNTAX ERROR: ' + e.message);
    }
  }

  console.log('[' + file + '] ' + ok + ' block(s) OK, ' + errors + ' error(s)');
});

console.log(totalErrors === 0 ? '\n=== ALL SYNTAX CHECKS PASSED ===' : '\n=== ' + totalErrors + ' SYNTAX ERROR(S) ===');
process.exit(totalErrors === 0 ? 0 : 1);
