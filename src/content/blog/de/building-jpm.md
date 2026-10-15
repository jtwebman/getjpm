---
title: "Was es gebraucht hat, einem Paketmanager zu vertrauen"
description: "jpm ist ein 2 MB großer Paketmanager für JavaScript in Rust, geschrieben von Claude Code Opus 5.5 in fünf Tagen. So habe ich es gesteuert, und deshalb vertraue ich Code, den ich nie getippt habe."
date: 2026-10-14
image: /blog/speed-chart.png
---

Ich habe keine einzige Zeile Code geschrieben oder auch nur gelesen, als ich jpm gebaut habe, einen Paketmanager für JavaScript, der in npm-, pnpm-, yarn- und bun-Projekten funktioniert. Dazu gehört auch, dass ich die KI ein eigenes TLS-, Krypto- und HTTP-Modul habe schreiben lassen, um es kleiner zu machen. Am Anfang ein echtes Vibe-Coding-Projekt. Fertig war es auch an einem Nachmittag. Weder ich noch sonst jemand hätte ihm in diesem Zustand vertrauen sollen, aber dann habe ich das genommen, was ich aus 27+ Jahren als professioneller Softwareentwickler weiß, es gegen bestehende Testsuiten testen lassen und es fünf Tage lang Tests schreiben und sich selbst intensiv testen lassen, um es zu härten.

## Wo ich herkomme

Ich habe in meiner Karriere viele Programmiersprachen benutzt, aber meistens eher höhere wie C#, Elixir und JavaScript. Eine Low-Level-Sprache hatte ich für nicht mehr als ein paar Funktionen benutzt, seit ich als Kind C gelernt und meinem Vater im Sommer bei seiner Arbeit mit Low-Level-Festplattencontrollern geholfen habe. Mal eben Rust zu lernen und damit ein Projekt mit 60k+ Zeilen zu bauen, hätte ich also nicht in kurzer Zeit geschafft. Was ich aber gelernt habe, ist, wie npm, pnpm und bun funktionieren, denn ich nutze Node.js beruflich seit Node.js 0.8 (2012). Ich weiß auch, wie viel Testen wirklich in Software stecken muss und wie wichtig es ist, das zu automatisieren, statt es nur einmal zu machen. Dass mir die ganzen Agile-Leute immer gesagt haben, ich soll zuerst Tests schreiben, hat sich am Ende echt ausgezahlt!

## Warum jpm

Ich habe mir einen [Podcast auf YouTube namens Syntax](https://www.youtube.com/watch?v=Z412bnUNiDI) mit den Hosts [Wes](https://x.com/wesbos), [Scott](https://x.com/stolinski) und [CJ](https://x.com/CodingGarden) angesehen, in dem sie die Folge damit angefangen haben, über upm zu reden, einen schnellen und wirklich kleinen Paketmanager, allerdings in JavaScript geschrieben. Mein erster Gedanke war, dass das mit der Größe nicht stimmt, weil man die Node.js-Runtime oder irgendeine Runtime mitrechnen muss. [Pooya](https://x.com/_pi0_) hatte ihn geschrieben, und CJ zeigte Benchmarks aus dem Projekt, laut denen er schnell ist, aber ich wollte einfach mal sehen, ob wir ihn noch schneller hinkriegen. Pooya ist ein guter Engineer, der viele gute Tools für das JavaScript-Ökosystem baut, also wusste ich, dass es nicht leicht wird. Und zuletzt hatte ich Opus 5.5 als Modell benutzt, und es hat mich total umgehauen. Also dachte ich mir: Weil schon so viele andere Tools in Rust gebaut wurden, im Podcast haben sie sogar Witze darüber gemacht, könnte ich vielleicht einen wirklich kleinen und schnellen Paketmanager in Rust bauen.

Im Podcast haben die Hosts Fragen aus ihrem Publikum zu KI beantwortet, Fragen, die sich gerade alle stellen. Kann sie echte Software bauen oder nur Demos? Sollten Engineers sich Sorgen machen oder sich freuen? Die meisten glauben, dass KI alles per One-Shot bauen kann. Spoiler: Kann sie. Nur sind die Ergebnisse nicht gut, wenn man sie nicht steuert und nichts von Softwareentwicklung versteht.

## Der Nachmittag

An dem Nachmittag, als ich mit meinem eigentlichen Job für den Tag fertig wurde, habe ich also einen Tab in meinem Terminal aufgemacht und Claude gefragt, was es bräuchte, um upm als Rust-CLI neu zu schreiben. Ich habe mir die Zusammenfassung durchgelesen, mein Okay gegeben, und es hat losgelegt. Ich glaube, es hat vielleicht 45 Minuten gedauert, dann hatte es eine funktionierende Version, die einen Haufen Rust-Crates von Drittanbietern benutzte, was sie viel größer machte, und die nur mit einer kleinen package.json getestet war. Um sie kleiner zu kriegen, habe ich es aufschlüsseln lassen, was sie so groß macht, und am Ende des Abends hatte ich eigene Module für HTTP, JSON, Krypto und TLS und eine viel kleinere Binärdatei. Ich habe es angewiesen, nur die Teile zu schreiben, die wir brauchen, sie aber auch intensiv zu testen, mit den Tests anderer Projekte, wo es ging, oder mit eigenen samt etwas Fuzz-Testing. Ich wollte sicher sein, dass sie solide sind.

## Die fünf Tage

Das ist also der Teil, den alle, die Projekte per „Vibe Coding“ bauen, weglassen. Klar, ich hatte es mit einer kleinen package.json zum Laufen gebracht, unter Linux in WSL2 auf Windows, aber ich hatte weder Mac noch Windows noch irgendwelche wirklich großen Projekte getestet. Also habe ich es ein Skript zum Härten schreiben lassen, das 100, später 166, große öffentliche Projekte genommen und versucht hat, sie zu installieren und zu bauen. Dann dasselbe mit dem Paketmanager, den sie selbst benutzen, und die Ergebnisse vergleichen. Inklusive ihrer Tests, wo es ging, denn manche Tests brauchten Secrets oder anderes Setup. Und das Ganze auch in der Windows-Eingabeaufforderung und in PowerShell, während ich auf meinem Mac einen Agenten gestartet habe, der dasselbe auf dem Mac macht. Fünf Tage und viele Entscheidungen darüber, was wir unterstützen und wie, später hatten wir 261 gemergte PRs und einen gehärteten, gut getesteten Paketmanager.

## Wie das Steuern aussah

Ich habe also keinen Code geschrieben, aber ich habe gesteuert und viele kleine Entscheidungen getroffen. Claude meinte zum Beispiel, ein schnelleres Lockfile-Format würde nur ein paar ms bringen, aber ich wollte die Änderung trotzdem. Claude wollte den globalen Store auch zu einem Opt-in-Feature machen, aber ich habe gefragt, warum, wenn 99 % der Pakete ihn nutzen können, und so wurde er zum Standard. Ich wollte auch nicht, dass Skripte laufen, auch nicht die Install-Skripte von Abhängigkeiten, außer du hast sie ausdrücklich freigegeben. Meine Überlegung dabei war, dass KI heute den Großteil der Arbeit macht, also kann ich sie, bevor ich die Skripte eines Pakets freigebe, einfach erst mal bitten, sie auf Probleme zu prüfen.

Es gab auch zwei Mal, wo Claude mir tatsächlich widersprochen hat, aber beide Male habe ich darauf bestanden.

Das erste Mal ging es um TLS. Ich wollte die Binärdatei kleiner kriegen, und die TLS- und Krypto-Crates machten einen großen Teil davon aus. Claude sagte, das ist genau der Code, den man nie selbst schreibt. Ich habe gesagt, das ist altes Engineering-Denken. Wir sind in Rust, also sind die Speicherfehler hinter Sachen wie Heartbleed vom Tisch, und wir können unsere Version genauso hart testen, wenn nicht sogar besser. Es hat zugegeben, dass es das Risiko übertrieben hatte, und aufgelistet, welche Testsuiten das beweisen würden (Wycheproof, NIST-Vektoren, x509-limbo, BoGo). Ich frage mich immer noch, ob das eine gute Idee ist oder nicht, und Claude schmiert einem gern Honig ums Maul, also kann es gut sein, dass es nur hilfsbereit sein wollte, als es sagte, es habe das Risiko übertrieben. Es besteht einen Haufen Tests, auch Tests, die aus echten Bugs anderer Projekte entstanden sind. Ich weiß, dass ich ihm jetzt viel mehr vertrauen würde, egal wer es geschrieben hat.

Das zweite Mal ging es um HTTP/2. Ich wollte mehr Tempo und habe danach gefragt. Claude hat es zuerst mit curl getestet und gesagt, es lohnt sich nicht, das zu bauen, weil die komplette Installation von jpm über HTTP/1.1 schon schneller war als allein der HTTP/2-Download von curl. Ich habe trotzdem gedrängt. curl muss jeden Fall abdecken, und wir brauchen nur viele GETs an eine Registry. Wir müssen über den Tellerrand hinausdenken, um bun zu schlagen. Es hat zugestimmt und etwa zwei Stunden später einen funktionierenden Client gehabt.

Dann haben wir gemessen. Über meinen Anschluss zu Hause war HTTP/2 etwa 17 % schneller. Auf GitHubs Runnern war es gleichauf oder langsamer, bei einer kalten nuxt-Installation bis zu 2-mal langsamer, und bei großen Tarballs brauchte es 8 bis 15 % mehr CPU. In CI kosten Installationen echte Zeit und echtes Geld, und es machte die Binärdatei 60 KB größer. Also habe ich es alle 3.671 Zeilen löschen lassen. Da lag ich falsch, und die Zahlen haben es mir gezeigt.

Es ging auch andersherum. jpm installiert dir Node, wenn du willst, und ich wollte die Signaturprüfung für Node hinter einem Flag haben, weil ich dachte, sie würde Installationen bremsen. Claude hat 15 bis 19 ms gemessen und gesagt, ein Flag heißt nur, dass sie keiner einschaltet. Jetzt ist sie standardmäßig an, und ich bin froh darüber, weil sie für mehr Sicherheit sorgt.

## Warum ich Code vertraue, den niemand getippt hat

Die kurze Antwort: Wycheproof, node-semver, die eigenen Tests von pnpm, yarn und bun und die 166 Repos, an denen wir es getestet haben. Ein paar der Bugs, die sie dabei gefunden haben:

- Die eigenen Tests von node-semver haben 25 Fälle gefunden, in denen jpm anderer Meinung war, zum Beispiel `^9007199254740991.0.0` als Range zu akzeptieren.
- Von den Tests von npm-package-arg stimmten anfangs nur 117 von 154. `a@a.tar.gz` wurde als Tag gelesen.
- Ein Sicherheitsscan hat gefunden, dass die `.npmrc` eines geklonten Repos dein Registry-Token über ihren eigenen Proxy schicken konnte. Der Proof of Concept hat `Bearer USER-SECRET-TOKEN` abgefangen. Die `.npmrc` eines Projekts kann die Sicherheit jetzt nicht mehr senken.
- Bei den echten Repos sank die Zahl der Abhängigkeits-Links, bei denen sich die Installation von jpm von der von pnpm unterschied, von 1.320 auf 183, und gegenüber npm von 614 auf 14.
- Unter macOS hat es nicht mal kompiliert, bis ich auf macOS getestet habe.

Nach so vielen Jahren in der Softwareentwicklung weiß ich auch, dass nichts fehlerfrei ist, egal wie viele Tests und wie viel Testen. Und Vertrauen muss man sich verdienen, deshalb habe ich vor, es ab jetzt in all meinen Projekten zu benutzen und Fixes zu unterstützen, auch solche, die von KI eingereicht werden. Das heißt nicht, dass ich alle annehme. Sie müssen mit Tests beweisen, dass sie wirklich etwas fixen. Worum es mir geht: Ich habe nicht vor, PRs abzuschalten, aber ich werde KI nutzen, die mir dabei hilft.

## Wo es heute steht

Wir haben die ausführbare Datei auf 2 MB gebracht, und jpm ist nicht immer der schnellste, aber ganz vorne mit dabei. Außerdem ist es auch einer der sichersten, weil es keine Skripte ohne Freigabe ausführt. Es aktualisiert Pakete nicht auf die neueste Version, wenn die nicht mindestens einen Tag alt ist. Und dazu die Sicherheit rund um `.npmrc`.

Hier ist eins der Diagramme, das zeigt, wie schnell wir auf einem GitHub-Actions-Runner im Vergleich zu anderen Paketmanagern sein können:

![Kalte Installation von nuxt (591 Pakete) auf GitHub CI, Linux, Median aus 5 Läufen: jpm 1,22 s, bun 1,28 s, pnpm 1,72 s, aube 3,00 s, upm 3,52 s, deno 7,64 s, yarn 9,63 s, npm 18,54 s](/blog/speed-chart.png)

Alle Rechner, Phasen und Projekte findest du auf [getjpm.sh](https://getjpm.sh/de/#speed).

## Wo es nicht am schnellsten ist

Ich will hier ehrlich sein: Der Benchmark ist klein, nur drei Repos. Wir sind auch nicht immer die Schnellsten. Unter Windows bei nuxt zum Beispiel machen uns die Defender-Scans fertig. Unter macOS gewinnen bun und aube bei warmen Installationen von nuxt. Es gibt also noch Luft nach oben, wenn Tempo das Endziel ist. Wir haben zwar Installationen von 166 Projekten unter Linux, macOS und Windows laufen lassen, plus noch mehr zufällige unter Linux, um Bugs zu finden, aber wir haben nicht jedes davon in CI und auf echten Rechnern auf Performance getestet.

Ist jpm perfekt? Nein. Genauso wenig wie irgendwas, das ich in 27 Jahren von Hand geschrieben habe, oder irgendwas, das je ein Mensch geschrieben hat. Perfekt gibt es nicht. Es gibt gut genug, es gibt großartig, und es gibt genug getestet, um zu wissen, was davon man hat.

Probier es mit `curl -fsSL https://getjpm.sh | sh` unter macOS und Linux oder `irm https://getjpm.sh/install.ps1 | iex` unter Windows aus und führ dann `jpm install` in einem beliebigen Projekt aus. Wenn du einen Bug findest, eröffne ein Issue auf [GitHub](https://github.com/jtwebman/jpm/issues).
