---
title: What it took to trust a package manager
description: jpm is a 2 MB JavaScript package manager in Rust, written by Claude Code Opus 5.5 in five days. This is how I directed it, and why I trust code I never typed.
date: 2026-10-14
image: /blog/speed-chart.png
---

I didn't write or even read a single line of code when making jpm, which is a package manager for JavaScript that works in npm, pnpm, yarn, and bun projects. This includes me asking AI to write its own TLS, crypto, and http module to make it smaller. A true vibe coded project at first. It also finished in an afternoon. I, nor anyone else, should have trusted it in that state but then I took what I know from 27+ years as a professional software engineer and had it test against existing test suites and had it write and heavily test itself for five days to harden it.

## Where I come from

I have used many programming languages in my career but they have mostly been higher level like C#, Elixir, and JavaScript. I had not used a low level language for more than a couple of functions since I was a kid learning C and helping my father with low level disk controllers at his job in the summer. So picking up Rust and building a 60k+ line project with it was not something I could have done in a short time. What I have learned is how npm, pnpm, and bun work as I have been using Node.js professionally since Node.js 0.8 (2012). I also know how much testing really needs to go into software and how automating it not just doing it one time really matters. All those agile guys telling me to write tests first did pay off!

## Why jpm

I was watching a [podcast on YouTube called Syntax](https://www.youtube.com/watch?v=Z412bnUNiDI) with the hosts [Wes](https://x.com/wesbos), [Scott](https://x.com/stolinski), and [CJ](https://x.com/CodingGarden) where they started out the episode talking about upm a fast and really small package manager but written in JavaScript. It made me think first of the size is false because you have to include the Node.js runtime or a runtime. [Pooya](https://x.com/_pi0_) had written it and CJ was showing benchmarks the project provided of it being fast but I wanted to just see could we make it faster. Pooya is a good engineer making many good tools for the JavaScript ecosystem, so I know it wouldn't be easy. Lastly, I had been using Opus 5.5 as a model and it was blowing me away. So I thought since so many other tools have been built in Rust, they even joked about it in the podcast, maybe I could make a really small and fast package manager in Rust.

In the podcast the hosts were answering questions from their audience about AI, questions everyone is asking right now. Can it build real software, or just demos? Should engineers be worried, or excited? Most people believe AI can one-shot anything. Spoiler it can. The results are just not good without directing it and understanding software development.

## The afternoon

So that afternoon after I was wrapping up my day job work I opened up a tab in my terminal and asked Claude what it would take to rewrite upm as a Rust CLI. I read over the summary and gave the ok and it started on it. I think it maybe took 45 minutes and it had a working version using a bunch of third-party Rust crates which made it much bigger and was only tested on a small package.json file. To make it smaller I had it break down what was making it so big and by the end of that evening I had a custom HTTP, JSON, crypto, and TLS module and a much smaller binary. I did direct it to only write the parts we need but also to heavily test them with other projects tests if we could or our own with some fuzz testing. I wanted to make sure they were solid. 

## The five days

So this is the part everyone that is "vibe coding" projects leaves out. Sure I had it working on a small package.json file running in Linux on Windows WSL2 but I had not tested Mac or Windows or any really big projects. So I had it write a script to harden it that took 100, eventually 166, large public projects and tried to install and build them. Then install and build them with the package manager they use and compare. Including running their tests where it could, as some tests needed secrets or other setup. Also do this on Windows command line and PowerShell as well as I started an agent on my Mac to do the same on the Mac. And five days later, making many calls on what to support and how, we got 261 merged PRs and a hardened and well tested package manager.

## What directing looked like

So I didn't write code but I did direct it and make lots of small calls. Like Claude saying a faster lock file format would only remove a few ms but I asked for the change anyways. Claude also wanted to make the global store an opt-in feature but I called out if 99% of packages can use it why, and it became the default. I also didn't want it running scripts including dependencies install scripts unless you listed them out as ok. My thinking here was that AI does most the work now, so before approving a package's scripts I can just ask it to review them for issues first.

There were also two times Claude actually pushed back on me but both times I insisted.

The first was TLS. I wanted to get the binary smaller, and the TLS and crypto crates were a big part of it. Claude said that's the code you never write yourself. I told it that was old engineering thinking. We are in Rust, so the memory bugs behind things like Heartbleed are off the table, and we can test our version hard just the same if not better. It agreed it had overstated the risk, laid out which test suites would prove it (Wycheproof, NIST vectors, x509-limbo, BoGo). I still question if this is a good idea or not and Claude likes to glaze you so it saying it overstated the risk could still be it just being helpful. It passes a bunch of tests including tests made from real bugs from other projects. I know I would trust it way more now regardless of who wrote it.

The second was HTTP/2. I wanted more speed and asked about it. Claude tested it with curl first and said it wasn't worth building, because jpm's whole install over HTTP/1.1 was already faster than curl's HTTP/2 download alone. I pushed anyway. curl has to handle every case, and we only need many GETs to one registry. We have to think outside the norm to beat bun. It agreed and had a working client about two hours later.

Then we measured it. On my home connection HTTP/2 was about 17% faster. On GitHub's runners it tied or lost, was up to 2x slower on a cold nuxt install, and used 8 to 15% more CPU on big tarballs. CI is where installs cost real time and money, and it added 60 KB to the binary. So I had it delete all 3,671 lines. I was wrong on that one, and the numbers told me so.

It went the other way too. jpm will install Node for you if you want and I wanted Node's signature check behind a flag because I thought it would slow installs. Claude measured it at 15 to 19 ms and said a flag just means nobody turns it on. It's on by default and I am glad as it adds security.

## Why I trust code nobody typed

The short answer is Wycheproof, node-semver, pnpm, yarn and bun's own tests, and the 166 repos we tested it on. Some of the bugs they found along the way:

- node-semver's own tests found 25 cases where jpm disagreed, like accepting `^9007199254740991.0.0` as a range.
- npm-package-arg's tests only matched 117 of 154 at first. `a@a.tar.gz` was read as a tag.
- A security scan found a cloned repo's `.npmrc` could send your registry token through its own proxy. The proof of concept captured `Bearer USER-SECRET-TOKEN`. A project's `.npmrc` can no longer lower security.
- On the real repos, the dependency links where jpm's install differed from pnpm's dropped from 1,320 to 183, and from npm's, 614 to 14.
- macOS didn't even compile at all till I tested on macOS.

I also know after this many years building software nothing is bug free regardless of tests and testing. And trust is earned so I plan on using it in all my projects going forward as well as supporting fixes, even AI-submitted ones. It doesn't mean I will take them all. They need to prove they are fixing something with tests. The point is I don't plan on turning off PRs but I will be using AI to help with it.

## Where it stands

We got the executable to 2MB and it isn't always the fastest but it is up at the top. It also is one of the most secure as well with it not running scripts without approval. Not updating packages to the latest version if they are not at least a day old. And the security around `.npmrc`.

Here is one of the charts showing how fast we can be on a GitHub Actions runner compared to other package managers:

![Cold install of nuxt (591 packages) on GitHub CI, Linux, median of 5 runs: jpm 1.22 s, bun 1.28 s, pnpm 1.72 s, aube 3.00 s, upm 3.52 s, deno 7.64 s, yarn 9.63 s, npm 18.54 s](/blog/speed-chart.png)

Every machine, phase and project is on [getjpm.sh](https://getjpm.sh/#speed).

## Where it isn't the fastest

I am going to be honest here the benchmark is small, only three repos. We are also not always the fastest. Like on Windows nuxt the Defender scans are killing it. On macOS bun and aube win for warm installs of nuxt. So there is room for improvement if speed is the end goal. We did run 166 project installs on Linux, macOS, and Windows, plus even more random ones on Linux to find bugs but we didn't performance test each one in CI and on machines.

Is jpm perfect? No. Neither is anything I've written by hand in 27 years, or anything any human has written. Perfect doesn't exist. There's good enough, there's great, and there's tested enough to know which one you have.

Try it with `curl -fsSL https://getjpm.sh | sh` on macOS and Linux, or `irm https://getjpm.sh/install.ps1 | iex` on Windows, then run `jpm install` in any project. If you find a bug, open an issue on [GitHub](https://github.com/jtwebman/jpm/issues).
