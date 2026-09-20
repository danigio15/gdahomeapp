/* Le note di un aggiornamento, disegnate come le disegna l'app.
 *
 * Sono un CHANGELOG scritto da chi ha fatto l'aggiornamento — da fuori — e
 * questo e' l'unico posto del quadro dove del markdown di fuori diventa HTML
 * dentro la pagina. Quindi qui si provano due cose, e la seconda conta piu'
 * della prima:
 *
 *  1. che si legga **come nell'app**: gli stessi titoli, gli stessi elenchi,
 *     lo stesso taglio dalla versione nuova in giu'. Una cosa sola mostrata
 *     in due modi diversi sono due cose da spiegare invece di una;
 *  2. che da quelle parole non esca **mai** un tag che non abbia scritto
 *     questa pagina. Il ponte quei campi se li controlla gia': fra il ponte
 *     e qui c'e' una rete, e un controllo da una parte sola non e' un
 *     controllo.
 *
 * Le funzioni stanno dentro un `<script>`, quindi nessuno le puo' importare:
 * si prende il pezzo di sorgente fra due segni fissi e lo si compila. E' lo
 * stesso programma che gira nel browser, non una copia.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const PAGINA = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");

const DA = "const testo = (cosa) =>";
const A = "/* Come va un controllo";

function iPezzi() {
  const primo = PAGINA.indexOf(DA);
  const ultimo = PAGINA.indexOf(A);
  assert.ok(primo >= 0, `nella pagina non c'e' piu' «${DA}»`);
  assert.ok(ultimo > primo, `nella pagina non c'e' piu' «${A}» dopo «${DA}»`);
  return new Function(
    `${PAGINA.slice(primo, ultimo)}; return { testo, ilMarkdown, iPezziDi, daQuellaVersione };`,
  )();
}

/* ─── Che si legga come nell'app ──────────────────────────────────────── */

test("i titoli diventano titoli, non cancelletti", () => {
  const { ilMarkdown } = iPezzi();
  const disegnato = ilMarkdown("# uno\n\n## due\n\n### tre");
  assert.match(disegnato, /<h3>uno<\/h3>/);
  assert.match(disegnato, /<h4>due<\/h4>/);
  assert.match(disegnato, /<h5>tre<\/h5>/);
  assert.doesNotMatch(disegnato, /#/);
});

test("«#139» non e' un titolo: al cancelletto serve lo spazio", () => {
  const { ilMarkdown } = iPezzi();
  assert.match(ilMarkdown("#139 la sezione segnalazioni"), /<p>#139 la sezione segnalazioni<\/p>/);
});

test("un elenco diventa un elenco, coi rientri", () => {
  const { ilMarkdown } = iPezzi();
  const disegnato = ilMarkdown("- fuori\n  - dentro\n* e un altro");
  /* Il punto che non sta dentro niente non porta nessuna classe: il rientro
   * si scrive solo quando c\'e\'. */
  assert.match(disegnato, /<ul><li>fuori<\/li><li class="r1">dentro<\/li>/);
  assert.match(disegnato, /<li>e un altro<\/li><\/ul>/);
});

test("il rientro non scappa oltre il terzo", () => {
  const { ilMarkdown } = iPezzi();
  assert.match(ilMarkdown("        - molto dentro"), /class="r3"/);
});

test("le righe attaccate fanno un paragrafo solo, quelle staccate no", () => {
  const { ilMarkdown } = iPezzi();
  assert.equal(ilMarkdown("la prima\ne la seconda"), "<p>la prima e la seconda</p>");
  assert.equal(ilMarkdown("uno\n\ndue"), "<p>uno</p><p>due</p>");
});

test("grassetto, corsivo e codice", () => {
  const { ilMarkdown } = iPezzi();
  assert.match(ilMarkdown("va **forte**"), /<strong>forte<\/strong>/);
  assert.match(ilMarkdown("va *piano*"), /<em>piano<\/em>/);
  assert.match(ilMarkdown("si scrive `binary_sensor`"), /<code>binary_sensor<\/code>/);
});

test("un segno aperto e mai chiuso resta il carattere che e'", () => {
  const { ilMarkdown } = iPezzi();
  assert.equal(ilMarkdown("**mai chiuso e poi il resto"), "<p>**mai chiuso e poi il resto</p>");
});

test("il trattino basso in mezzo a un nome non fa il corsivo", () => {
  const { ilMarkdown } = iPezzi();
  assert.equal(ilMarkdown("sensor_di_casa"), "<p>sensor_di_casa</p>");
});

test("una riga di trattini separa", () => {
  const { ilMarkdown } = iPezzi();
  assert.equal(ilMarkdown("sopra\n\n---\n\nsotto"), "<p>sopra</p><hr /><p>sotto</p>");
  assert.match(ilMarkdown("***"), /<hr \/>/);
});

test("il blocco di codice si mostra com'e', e dentro non si legge markdown", () => {
  const { ilMarkdown } = iPezzi();
  const disegnato = ilMarkdown("```yaml\n# non e' un titolo\n- ne' un punto\n```");
  assert.match(disegnato, /<pre><code># non e&#39; un titolo\n- ne&#39; un punto<\/code><\/pre>/);
});

test("un recinto lasciato aperto non si perde", () => {
  const { ilMarkdown } = iPezzi();
  assert.match(ilMarkdown("prima\n\n```\nqualcosa\nancora"), /<pre><code>qualcosa\nancora<\/code>/);
});

test("quello che non sa disegnare lo legge come testo", () => {
  const { ilMarkdown } = iPezzi();
  /* Una tabella markdown, o un avviso di GitHub: vengono fuori con le loro
   * barre e i loro segni, e si capiscono lo stesso. */
  assert.match(ilMarkdown("| che | quanto |"), /<p>\| che \| quanto \|<\/p>/);
  assert.match(ilMarkdown("> [!IMPORTANT]"), /<p>&gt; \[!IMPORTANT\]<\/p>/);
});

test("niente da leggere, niente da disegnare", () => {
  const { ilMarkdown } = iPezzi();
  assert.equal(ilMarkdown(""), "");
  assert.equal(ilMarkdown("\n\n   \n"), "");
});

/* ─── Il taglio dalla versione nuova in giu' ──────────────────────────── */

const TUTTO = [
  "# Cosa cambia, giro per giro",
  "",
  "Come si leggono i numeri.",
  "",
  "## 1.4.32.8",
  "",
  "il racconto della nuova",
  "",
  "## 1.4.32.7",
  "",
  "quella di prima",
].join("\n");

test("si comincia dal titolo di quella versione, e il titolo non si ripete", () => {
  const { daQuellaVersione } = iPezzi();
  const da = daQuellaVersione(TUTTO, "1.4.32.8");
  assert.ok(da.startsWith("il racconto della nuova"));
  assert.ok(da.includes("quella di prima"));
  assert.ok(!da.includes("Come si leggono i numeri"));
});

test("un titolo che non c'e' non taglia niente", () => {
  const { daQuellaVersione } = iPezzi();
  assert.equal(daQuellaVersione(TUTTO, "9.9.9.9"), TUTTO);
  assert.equal(daQuellaVersione(TUTTO, ""), TUTTO);
  assert.equal(daQuellaVersione(TUTTO, "   "), TUTTO);
});

test("«1.4.32.8» non si trova dentro «1.4.32.80»", () => {
  const { daQuellaVersione } = iPezzi();
  const con80 = "## 1.4.32.80\n\nquella lunga\n\n## 1.4.32.8\n\nquella corta";
  assert.equal(daQuellaVersione(con80, "1.4.32.8"), "quella corta");
});

test("il numero deve stare in un titolo, non in una riga qualunque", () => {
  const { daQuellaVersione } = iPezzi();
  const scritto = "la 1.4.32.8 sistema due cose\n\n## 1.4.32.8\n\nil racconto";
  assert.equal(daQuellaVersione(scritto, "1.4.32.8"), "il racconto");
});

/* ─── Che da fuori non entri un tag ───────────────────────────────────── */

test("un tag scritto nelle note si legge, non si esegue", () => {
  const { ilMarkdown } = iPezzi();
  for (const storto of [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "# <iframe src='https://altrove.invalid'></iframe>",
    "- <b>grassetto di fuori</b>",
    "**<svg onload=alert(1)>**",
    "`<style>body{display:none}</style>`",
    "```\n<script>alert(1)</script>\n```",
  ]) {
    const disegnato = ilMarkdown(storto);
    assert.doesNotMatch(disegnato, /<(script|img|iframe|svg|style|b)\b/i, `e' passato: ${storto}`);
  }
});

test("un apice o una virgoletta non aprono un attributo", () => {
  const { ilMarkdown } = iPezzi();
  const disegnato = ilMarkdown('- x" onmouseover="alert(1)');
  assert.match(disegnato, /<li>x&quot; onmouseover=&quot;alert\(1\)<\/li>/);
});

test("un link si preme solo se porta sul web", () => {
  const { ilMarkdown } = iPezzi();
  const buono = ilMarkdown("[le note](https://esempio.invalid/note)");
  assert.match(
    buono,
    /<a href="https:\/\/esempio\.invalid\/note" target="_blank" rel="noopener noreferrer">le note<\/a>/,
  );
  /* `noreferrer` non e' un vezzo: a chi ha scritto l'aggiornamento non deve
   * arrivare l'indirizzo del quadro di nessuno. */
  assert.match(buono, /rel="noopener noreferrer"/);
});

test("«javascript:» e «data:» restano parole scritte", () => {
  const { ilMarkdown } = iPezzi();
  for (const storto of [
    "[premi](javascript:alert(1))",
    "[guarda](data:text/html,<script>alert(1)</script>)",
    "[vai](vbscript:msgbox)",
    "[su](JaVaScRiPt:alert(1))",
  ]) {
    const disegnato = ilMarkdown(storto);
    assert.doesNotMatch(disegnato, /<a\b/i, `e' diventato un link: ${storto}`);
  }
});

test("una virgoletta dentro l'indirizzo non esce dall'attributo", () => {
  const { ilMarkdown } = iPezzi();
  const disegnato = ilMarkdown('[x](https://esempio.invalid/a"onmouseover="alert(1))');
  assert.match(disegnato, /href="https:\/\/esempio\.invalid\/a&quot;onmouseover=&quot;alert\(1"/);
  assert.doesNotMatch(disegnato, /onmouseover="/);
});

test("i soli tag che escono sono quelli scritti in questa pagina", () => {
  const { ilMarkdown } = iPezzi();
  /* Un CHANGELOG vero, con dentro tutto quello che un CHANGELOG ha. */
  const disegnato = ilMarkdown(
    [
      "# 5.3.0",
      "",
      "> [!IMPORTANT]",
      "> **Coming from a version before 5.0.0?**",
      "",
      "- una cosa con `del codice`",
      "  - e una dentro",
      "",
      "---",
      "",
      "Vedi [le note](https://esempio.invalid) per il resto.",
      "",
      "```sh",
      "apt update && apt install",
      "```",
    ].join("\n"),
  );
  const tag = [...disegnato.matchAll(/<\/?([a-z0-9]+)/gi)].map((uno) => uno[1].toLowerCase());
  const permessi = new Set([
    "h3",
    "h4",
    "h5",
    "p",
    "ul",
    "li",
    "hr",
    "pre",
    "code",
    "strong",
    "em",
    "a",
  ]);
  for (const uno of new Set(tag)) {
    assert.ok(permessi.has(uno), `dalle note e' uscito un <${uno}>`);
  }
});
