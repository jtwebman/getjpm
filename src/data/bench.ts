// Benchmark medians from jpm's docs/benchmarks.md (2026-09-30), in milliseconds:
// https://github.com/jtwebman/jpm/blob/main/docs/benchmarks.md
// Values are copied as the tables print them (1.22 s is 1220 ms); nothing is rounded further.

export type Phase = 'cold' | 'warm' | 'ci' | 'repeat';
export type Fixture = 'nitro' | 'nuxt' | 'next';
export type Env = 'github' | 'windows';

/** Each manager's wall time: [phase][fixture]. */
type Times = Partial<Record<Phase, Record<Fixture, number>>>;

export interface Manager {
  name: string;
  version: string;
  times: Times;
}

export interface Environment {
  phases: Phase[];
  managers: Manager[];
}

const t = (nitro: number, nuxt: number, next: number) => ({ nitro, nuxt, next });

export const fixtures: Record<Fixture, number> = { nitro: 62, nuxt: 591, next: 275 };

export const bench: Record<Env, Environment> = {
  // ubuntu-latest, 4 cores, medians of 5 runs.
  github: {
    phases: ['cold', 'warm', 'ci', 'repeat'],
    managers: [
      { name: 'jpm', version: '', times: { cold: t(482, 1220, 924), warm: t(4, 206, 115), ci: t(168, 734, 770), repeat: t(1, 2, 1) } },
      { name: 'bun', version: '1.4.2', times: { cold: t(377, 1280, 1720), warm: t(29, 234, 149), ci: t(188, 676, 1020), repeat: t(4, 18, 3) } },
      { name: 'aube', version: '2.6.0', times: { cold: t(522, 3000, 1520), warm: t(43, 186, 134), ci: t(240, 896, 818), repeat: t(5, 7, 4) } },
      { name: 'pnpm', version: '12.8.1', times: { cold: t(634, 1720, 2870), warm: t(65, 435, 200), ci: t(461, 1530, 2100), repeat: t(10, 11, 10) } },
      { name: 'deno', version: '2.9.6', times: { cold: t(532, 7640, 2720), warm: t(33, 338, 219), ci: t(307, 1200, 1450), repeat: t(7, 28, 8) } },
      { name: 'upm', version: '1.3.1', times: { cold: t(1120, 3520, 2470), warm: t(99, 447, 209), ci: t(530, 2060, 1840), repeat: t(40, 44, 38) } },
      { name: 'yarn', version: '4.18.1', times: { cold: t(1750, 9630, 8360), warm: t(690, 3130, 3540), ci: t(1280, 5580, 6500), repeat: t(385, 1020, 771) } },
      { name: 'npm', version: '12.1.0', times: { cold: t(2070, 18540, 10550), warm: t(930, 4690, 6530), ci: t(1220, 6620, 7480), repeat: t(326, 794, 334) } },
    ],
  },
  // Windows 11 on an i9-12900K, Defender real-time protection on, medians of 3 runs.
  // Repeat installs were not measured there.
  windows: {
    phases: ['cold', 'warm', 'ci'],
    managers: [
      { name: 'jpm', version: '', times: { cold: t(1320, 8530, 6910), warm: t(28, 1450, 1250), ci: t(1030, 8010, 6760) } },
      { name: 'upm', version: '1.3.1', times: { cold: t(1770, 7400, 8000), warm: t(1020, 4410, 2970), ci: t(1490, 6800, 7560) } },
      { name: 'npm', version: '12.1.0', times: { cold: t(1670, 11880, 12070), warm: t(1270, 4840, 10820), ci: t(1310, 5150, 10940) } },
      { name: 'pnpm', version: '12.8.1', times: { cold: t(994, 9140, 9060), warm: t(418, 3750, 2440), ci: t(1020, 8810, 8350) } },
      { name: 'aube', version: '2.6.1', times: { cold: t(1770, 17450, 13830), warm: t(98, 491, 2540), ci: t(1330, 16010, 12080) } },
    ],
  },
};

/** A bar in one of the "lean" charts: a value and how to print it. */
export interface Bar {
  name: string;
  value: number;
  label: string;
}

const mb = (name: string, value: number, approx = false): Bar => ({ name, value, label: `${approx ? '~' : ''}${value} MB` });

/** GitHub CI, Linux, except the binary sizes, which are the README's round figures. */
export const lean: Record<'binary' | 'memory' | 'disk' | 'cache', Bar[]> = {
  binary: [mb('jpm', 2, true), mb('pnpm', 60, true), mb('bun', 80, true), mb('aube', 150, true)],
  memory: [mb('jpm', 34), mb('bun', 89), mb('pnpm', 184), mb('npm', 387)],
  disk: [mb('jpm', 244), mb('bun', 261), mb('pnpm', 290), mb('npm', 443)],
  cache: [mb('npm', 194), mb('yarn', 328), mb('jpm', 347), mb('pnpm', 433), mb('bun', 466)],
};

/** Milliseconds as the benchmark tables print them: `734 ms`, `1.22 s`, `18.54 s`. */
export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}
