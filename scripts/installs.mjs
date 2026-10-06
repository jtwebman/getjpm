// How often jpm is installed, from GitHub's download counts of each release's files: the
// installers fetch SHA256SUMS once a run to check the binary, and apt fetches a jpm_*.deb, so
// those two are installs; the jpm-* binaries are also fetched from the release page and by other
// tools. getjpm.sh counts nothing itself. Needs no login.
//   jpm run installs

const res = await fetch('https://api.github.com/repos/jtwebman/jpm/releases?per_page=100', {
  headers: { accept: 'application/vnd.github+json', 'user-agent': 'getjpm-installs' },
});
if (!res.ok) throw new Error(`GitHub answered ${res.status}: ${await res.text()}`);
const list = await res.json();
if (!list.length) console.log('no releases yet');
let installs = 0;
let binaries = 0;
for (const release of list) {
  const of = (test) => release.assets.filter((a) => test(a.name));
  const sum = (assets) => assets.reduce((n, a) => n + a.download_count, 0);
  const scripts = sum(of((n) => n === 'SHA256SUMS'));
  const debs = of((n) => /^jpm_.*\.deb$/.test(n));
  const bins = of((n) => n.startsWith('jpm-'));
  installs += scripts + sum(debs);
  binaries += sum(bins);
  console.log(`${release.tag_name}${release.prerelease ? ' (pre-release)' : ''}: ${scripts} by the install scripts, ${sum(debs)} by apt, ${sum(bins)} binary downloads`);
  for (const a of [...debs, ...bins].sort((x, y) => y.download_count - x.download_count)) {
    console.log(`  ${a.name.padEnd(24)} ${a.download_count}`);
  }
}
console.log(`total: ${installs} installs, ${binaries} binary downloads`);
