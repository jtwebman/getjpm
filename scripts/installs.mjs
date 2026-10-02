// How often jpm is fetched, from the two counts there are:
//   - install scripts handed out by getjpm.sh, per day and script, from the D1 table
//     functions/_middleware.js counts into, read with `wrangler d1 execute` and your own login
//     (`npx wrangler login`; no token is kept anywhere).
//   - release files downloaded from GitHub, per release and file (the installers fetch the binary
//     from there, so this is closer to an install). Needs nothing.
// Neither counts people: a fetch is not an install, and nothing identifies who fetched.
//   npm run installs [-- --days 30]
import { execFileSync } from 'node:child_process';

const days = Number(process.argv[process.argv.indexOf('--days') + 1]) || 30;

function scripts() {
  const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const sql = `SELECT day, script, SUM(count) AS fetched FROM installs WHERE day >= '${since}'
    GROUP BY day, script ORDER BY day, script`;
  let out;
  try {
    out = execFileSync('npx', ['--yes', 'wrangler@4.145.0', 'd1', 'execute', 'getjpm', '--remote', '--json', '--command', sql], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    console.log(`Install scripts: could not read D1 (run \`npx wrangler login\` first): ${String(e.stderr ?? e.message).trim().split('\n').pop()}\n`);
    return;
  }
  const rows = JSON.parse(out.slice(out.indexOf('[')))[0]?.results ?? [];
  console.log(`Install scripts handed out by getjpm.sh, last ${days} days:`);
  if (!rows.length) console.log('  none yet');
  const total = {};
  for (const row of rows) {
    console.log(`  ${row.day}  ${row.script.padEnd(12)} ${row.fetched}`);
    total[row.script] = (total[row.script] ?? 0) + Number(row.fetched);
  }
  for (const [script, n] of Object.entries(total)) console.log(`  total       ${script.padEnd(12)} ${n}`);
  console.log();
}

async function releases() {
  const res = await fetch('https://api.github.com/repos/jtwebman/jpm/releases?per_page=100', {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'getjpm-installs' },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}: ${await res.text()}`);
  const list = await res.json();
  console.log('Release files downloaded from GitHub:');
  if (!list.length) console.log('  no releases yet');
  for (const release of list) {
    const binaries = release.assets.filter((a) => a.name.startsWith('jpm-'));
    const sum = binaries.reduce((n, a) => n + a.download_count, 0);
    console.log(`  ${release.tag_name}${release.prerelease ? ' (pre-release)' : ''}: ${sum} binary downloads`);
    for (const a of binaries.sort((x, y) => y.download_count - x.download_count)) {
      console.log(`    ${a.name.padEnd(24)} ${a.download_count}`);
    }
  }
}

scripts();
await releases();
