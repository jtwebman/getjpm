// How often jpm is fetched, from the two counts there are:
//   - install scripts handed out by getjpm.sh, per day and script, from Workers Analytics Engine
//     (functions/_middleware.js writes them). Needs CLOUDFLARE_ACCOUNT_ID and a
//     CLOUDFLARE_API_TOKEN with "Account Analytics: Read".
//   - release files downloaded from GitHub, per release and file (the installers fetch the binary
//     from there, so this is closer to an install). Needs nothing.
// Neither counts people: a fetch is not an install, and nothing identifies who fetched.
//   npm run installs [-- --days 30]
const days = Number(process.argv[process.argv.indexOf('--days') + 1]) || 30;

async function scripts() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) {
    console.log('Install scripts: set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN ("Account Analytics: Read") to see them.\n');
    return;
  }
  const sql = `SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, blob1 AS script,
      SUM(_sample_interval) AS fetched
    FROM getjpm_installs
    WHERE timestamp > NOW() - INTERVAL '${days}' DAY
    GROUP BY day, script ORDER BY day, script FORMAT JSON`;
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: sql,
  });
  if (!res.ok) throw new Error(`Analytics Engine answered ${res.status}: ${await res.text()}`);
  const { data } = await res.json();
  console.log(`Install scripts handed out by getjpm.sh, last ${days} days:`);
  if (!data.length) console.log('  none yet');
  const total = {};
  for (const row of data) {
    console.log(`  ${String(row.day).slice(0, 10)}  ${row.script.padEnd(12)} ${row.fetched}`);
    total[row.script] = (total[row.script] ?? 0) + Number(row.fetched);
  }
  for (const [script, n] of Object.entries(total)) console.log(`  total        ${script.padEnd(12)} ${n}`);
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

await scripts();
await releases();
