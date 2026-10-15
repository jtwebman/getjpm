---
title: "Lo que hizo falta para confiar en un gestor de paquetes escrito por Claude"
description: jpm es un gestor de paquetes para JavaScript de 2 MB en Rust, escrito por Claude Code Opus 5.5 en cinco días. Así es como lo dirigí, y por qué confío en código que nunca tecleé.
date: 2026-10-14
image: /blog/speed-chart.png
---

No escribí, ni siquiera leí, una sola línea de código al hacer jpm, un gestor de paquetes para JavaScript que funciona en proyectos de npm, pnpm, yarn y bun. Eso incluye cuando le pedí a la IA que escribiera su propio módulo de TLS, criptografía y HTTP para hacerlo más pequeño. Al principio fue un proyecto de vibe coding de verdad. Además, quedó terminado en una tarde. Ni yo ni nadie debería haber confiado en él en ese estado, pero luego apliqué lo que sé después de más de 27 años como ingeniero de software profesional: hice que lo probara contra suites de pruebas existentes y que pasara cinco días escribiendo y probando a fondo su propio código para endurecerlo.

## De dónde vengo

He usado muchos lenguajes de programación en mi carrera, pero casi todos de alto nivel, como C#, Elixir y JavaScript. No había usado un lenguaje de bajo nivel para más de un par de funciones desde que era niño, cuando aprendía C y en verano ayudaba a mi padre en su trabajo con controladoras de disco de bajo nivel. Así que aprender Rust y construir con él un proyecto de más de 60k líneas no era algo que hubiera podido hacer en poco tiempo. Lo que sí he aprendido es cómo funcionan npm, pnpm y bun, porque uso Node.js profesionalmente desde Node.js 0.8 (2012). También sé cuántas pruebas necesita de verdad el software, y lo mucho que importa automatizarlas en lugar de hacerlas una sola vez. ¡Al final sí valió la pena hacerles caso a todos esos de agile que me decían que escribiera las pruebas primero!

## Por qué jpm

Estaba viendo un [podcast en YouTube llamado Syntax](https://www.youtube.com/watch?v=Z412bnUNiDI) con los presentadores [Wes](https://x.com/wesbos), [Scott](https://x.com/stolinski) y [CJ](https://x.com/CodingGarden), en el que empezaron el episodio hablando de upm, un gestor de paquetes rápido y muy pequeño, pero escrito en JavaScript. Lo primero que pensé fue que lo del tamaño no era verdad, porque tienes que incluir el runtime de Node.js o algún runtime. Lo había escrito [Pooya](https://x.com/_pi0_), y CJ estaba mostrando los benchmarks del propio proyecto, en los que salía rápido, pero yo solo quería ver si podíamos hacerlo más rápido. Pooya es un buen ingeniero que hace muchas herramientas buenas para el ecosistema de JavaScript, así que sabía que no sería fácil. Por último, llevaba un tiempo usando Opus 5.5 como modelo y me estaba dejando alucinado. Así que pensé que, como ya se han hecho tantas otras herramientas en Rust, hasta bromearon con eso en el podcast, quizá yo podía hacer un gestor de paquetes realmente pequeño y rápido en Rust.

En el podcast, los presentadores respondían preguntas de su audiencia sobre la IA, preguntas que todo el mundo se está haciendo ahora mismo. ¿Puede construir software de verdad, o solo demos? ¿Los ingenieros deberían estar preocupados, o entusiasmados? La mayoría de la gente cree que la IA puede hacer cualquier cosa a la primera. Spoiler: puede. Lo que pasa es que los resultados no son buenos si no la diriges y no entiendes de desarrollo de software.

## La tarde

Así que esa tarde, cuando estaba terminando la jornada de mi trabajo, abrí una pestaña en la terminal y le pregunté a Claude qué haría falta para reescribir upm como una CLI en Rust. Leí el resumen, le di el ok y se puso con ello. Creo que tardó unos 45 minutos y ya tenía una versión que funcionaba, usando un montón de crates de Rust de terceros que la hacían mucho más grande, y probada solo con un package.json pequeño. Para hacerla más pequeña, le pedí que desglosara qué la hacía tan grande, y al final de esa noche tenía un módulo propio de HTTP, JSON, criptografía y TLS, y un binario mucho más pequeño. Eso sí, le indiqué que solo escribiera las partes que necesitábamos, pero también que las probara a fondo con las pruebas de otros proyectos cuando se pudiera, o con las nuestras con algo de fuzz testing. Quería asegurarme de que fueran sólidas.

## Los cinco días

Esta es la parte que se salta todo el que está haciendo proyectos con "vibe coding". Sí, lo tenía funcionando con un package.json pequeño, en Linux sobre WSL2 en Windows, pero no lo había probado en Mac ni en Windows, ni con ningún proyecto realmente grande. Así que le hice escribir un script para endurecerlo, que tomaba 100 proyectos públicos grandes, al final 166, e intentaba instalarlos y compilarlos. Después, instalarlos y compilarlos con el gestor de paquetes que usa cada uno, y comparar. Incluido ejecutar sus pruebas cuando se podía, porque algunas pruebas necesitaban secretos u otra configuración. Y hacer lo mismo también en la línea de comandos de Windows y en PowerShell, mientras arrancaba un agente en mi Mac para hacer lo mismo en el Mac. Y cinco días después, tomando muchas decisiones sobre qué soportar y cómo, teníamos 261 PRs mergeados y un gestor de paquetes endurecido y bien probado.

## Cómo fue dirigirlo

Así que no escribí código, pero sí lo dirigí y tomé muchas decisiones pequeñas. Por ejemplo, Claude decía que un formato de lockfile más rápido solo quitaría unos pocos ms, pero igual pedí el cambio. Claude también quería que el almacén global fuera una función opcional, pero le hice notar que, si el 99% de los paquetes pueden usarlo, ¿para qué?, y pasó a ser el comportamiento por defecto. Tampoco quería que ejecutara scripts, incluidos los scripts de instalación de las dependencias, a menos que los hubieras marcado como permitidos. Mi idea aquí era que ahora la IA hace la mayor parte del trabajo, así que antes de aprobar los scripts de un paquete, puedo simplemente pedirle que primero los revise en busca de problemas.

También hubo dos veces en que Claude de verdad me llevó la contraria, pero las dos veces insistí.

La primera fue con TLS. Quería que el binario fuera más pequeño, y los crates de TLS y criptografía eran una buena parte de su tamaño. Claude dijo que ese es el código que nunca escribes tú mismo. Le dije que esa era una forma antigua de pensar la ingeniería. Estamos en Rust, así que los bugs de memoria detrás de cosas como Heartbleed quedan descartados, y podemos probar nuestra versión a fondo igual de bien, si no mejor. Admitió que había exagerado el riesgo y detalló qué suites de pruebas lo demostrarían (Wycheproof, vectores de NIST, x509-limbo, BoGo). Todavía me pregunto si es buena idea o no, y a Claude le gusta decirte lo que quieres oír, así que eso de que había exagerado el riesgo podría ser simplemente él siendo complaciente. Pasa un montón de pruebas, incluidas pruebas hechas a partir de bugs reales de otros proyectos. Sé que ahora confiaría mucho más en él, sin importar quién lo escribiera.

La segunda fue con HTTP/2. Quería más velocidad y pregunté por ello. Claude primero lo probó con curl y dijo que no valía la pena construirlo, porque la instalación completa de jpm por HTTP/1.1 ya era más rápida que solo la descarga de curl por HTTP/2. Insistí de todos modos. curl tiene que manejar todos los casos, y nosotros solo necesitamos muchos GET a un único registro. Tenemos que pensar fuera de lo normal para ganarle a bun. Estuvo de acuerdo y unas dos horas después tenía un cliente funcionando.

Luego lo medimos. Con la conexión de mi casa, HTTP/2 era más o menos un 17% más rápido. En los runners de GitHub empataba o perdía, era hasta 2x más lento en una instalación en frío de nuxt, y usaba entre un 8 y un 15% más de CPU con tarballs grandes. CI es donde las instalaciones cuestan tiempo y dinero de verdad, y además añadía 60 KB al binario. Así que le hice borrar las 3671 líneas. En eso me equivoqué, y los números me lo dijeron.

También pasó al revés. jpm te instala Node si quieres, y yo quería que la verificación de la firma de Node estuviera detrás de un flag porque pensaba que haría más lentas las instalaciones. Claude midió que costaba entre 15 y 19 ms y dijo que un flag solo significa que nadie lo activa. Está activada por defecto y me alegro, porque añade seguridad.

## Por qué confío en código que nadie tecleó

La respuesta corta es Wycheproof, las propias pruebas de node-semver, pnpm, yarn y bun, y los 166 repos en los que lo probamos. Algunos de los bugs que encontraron por el camino:

- Las propias pruebas de node-semver encontraron 25 casos en los que jpm no coincidía, como aceptar `^9007199254740991.0.0` como rango.
- Al principio, solo coincidían 117 de 154 pruebas de npm-package-arg. `a@a.tar.gz` se interpretaba como un tag.
- Un escaneo de seguridad encontró que el `.npmrc` de un repo clonado podía enviar tu token del registro a través de su propio proxy. La prueba de concepto capturó `Bearer USER-SECRET-TOKEN`. El `.npmrc` de un proyecto ya no puede bajar la seguridad.
- En los repos reales, los enlaces de dependencias en los que la instalación de jpm difería de la de pnpm bajaron de 1320 a 183, y respecto a la de npm, de 614 a 14.
- En macOS ni siquiera compilaba hasta que lo probé en macOS.

También sé, después de tantos años construyendo software, que nada está libre de bugs, por muchas pruebas que escribas y ejecutes. Y la confianza se gana, así que pienso usarlo en todos mis proyectos de aquí en adelante, además de estar abierto a correcciones, incluso las enviadas por IA. Eso no significa que vaya a aceptarlas todas. Tienen que demostrar con pruebas que están arreglando algo. La idea es que no pienso cerrar los PRs, pero sí voy a usar IA para que me ayude con eso.

## Dónde está ahora

Dejamos el ejecutable en 2MB, y no siempre es el más rápido, pero está entre los de arriba. También es uno de los más seguros, porque no ejecuta scripts sin aprobación. No actualiza paquetes a la última versión si no tienen al menos un día. Y por la seguridad en torno a `.npmrc`.

Aquí va uno de los gráficos que muestra lo rápidos que podemos ser en un runner de GitHub Actions comparado con otros gestores de paquetes:

![Instalación en frío de nuxt (591 paquetes) en GitHub CI, Linux, mediana de 5 ejecuciones: jpm 1,22 s, bun 1,28 s, pnpm 1,72 s, aube 3,00 s, upm 3,52 s, deno 7,64 s, yarn 9,63 s, npm 18,54 s](/blog/speed-chart.png)

Todas las máquinas, fases y proyectos están en [getjpm.sh](https://getjpm.sh/es/#speed).

## Dónde no es el más rápido

Voy a ser sincero: el benchmark es pequeño, solo tres repos. Tampoco somos siempre los más rápidos. Por ejemplo, con nuxt en Windows, los escaneos de Defender lo están matando. En macOS, bun y aube ganan en las instalaciones en caliente de nuxt. Así que hay margen de mejora si la velocidad es el objetivo final. Sí hicimos instalaciones de 166 proyectos en Linux, macOS y Windows, y todavía más proyectos al azar en Linux para encontrar bugs, pero no medimos el rendimiento de cada uno en CI y en máquinas.

¿Es jpm perfecto? No. Tampoco lo es nada de lo que he escrito a mano en 27 años, ni nada que haya escrito ningún ser humano. Lo perfecto no existe. Existe lo suficientemente bueno, existe lo excelente, y existe lo suficientemente probado como para saber cuál de los dos tienes.

Pruébalo con `curl -fsSL https://getjpm.sh | sh` en macOS y Linux, o con `irm https://getjpm.sh/install.ps1 | iex` en Windows, y luego ejecuta `jpm install` en cualquier proyecto. Si encuentras un bug, abre un issue en [GitHub](https://github.com/jtwebman/jpm/issues).
