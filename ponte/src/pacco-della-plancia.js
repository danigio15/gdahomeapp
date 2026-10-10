/* La plancia in un pacchetto, servita dal ponte.
 *
 * «Velocizza il caricamento delle plance, sia su Home Assistant che su
 * gdahome app: quando clicco ci mette tempo ad aprirsi.» Misurato: la pagina
 * chiedeva **quattrocentotrentotto file** a ogni apertura — trecentottanta
 * moduli sciolti, uno per sezione — e il browser ne fa sei per volta. Dentro
 * Home Assistant passano dall'ingress uno per uno; nell'app il WebView li
 * richiede tutti al servitore di casa, che per ognuno guarda il disco e
 * risponde «non e' cambiato». Con la CPU di un telefono e quaranta millesimi
 * di strada il velo se ne andava dopo sei secondi; impacchettata, dopo tre.
 *
 * Il pacchetto lo costruisce `strumenti/impacchetta-la-plancia.mjs`, e lo
 * costruisce da se' ogni volta che si risigilla la plancia: sta in
 * `ponte/plancia/pacco/`, dentro il sigillo come tutto il resto. Accanto c'e'
 * `sorgenti.json`, con l'impronta dei sorgenti da cui e' stato fatto.
 *
 * Il ponte lo usa **solo se quell'impronta torna** con i sorgenti che ha sul
 * disco. Un pacchetto rimasto indietro — si e' corretta la plancia e non la si
 * e' risigillata — servirebbe il codice di ieri con la pagina di oggi, e
 * nessuno capirebbe perche' la correzione non si vede. Se non torna, la pagina
 * esce come prima, coi moduli sciolti: lenta come ieri, mai sbagliata.
 *
 * La pagina nel deposito resta quella dei sorgenti: chi sviluppa apre i file
 * veri. E' il ponte a riscriverla mentre la serve, come gia' fa col marchio.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/* Dove sta il pacchetto, dentro la cartella della plancia. Fuori da `legacy/`
 * e da `src/` apposta: le prove della plancia passano al setaccio quelle due
 * cartelle, e un secondo esemplare di tutto il codice le confonderebbe. */
export const CARTELLA_DEL_PACCO = "pacco";

/* Il foglio che dice da quali sorgenti e' fatto. */
export const FOGLIO_DEL_PACCO = "sorgenti.json";

/* I due ingressi. Il primo lo carica la pagina; il secondo lo chiede
 * `config.js` quando il guscio e' pronto, ed e' quello che si porta dietro
 * tutte le sezioni. */
export const INGRESSI_DEL_PACCO = Object.freeze([
  "legacy/modules-entry.js",
  "src/sections/section-runtime.js",
]);

/* Quello da cui il pacchetto e' fatto: tutto `legacy/` e tutto `src/`. Anche
 * i fogli di stile e le pagine, che nel pacchetto non entrano: costa un
 * pacchetto rifatto per niente ogni tanto, e in cambio non c'e' un elenco di
 * eccezioni da tenere giusto. */
const SORGENTI = Object.freeze(["legacy", "src"]);

function* iFile(cartella, radice) {
  let nomi;
  try {
    nomi = readdirSync(cartella).sort();
  } catch (_errore) {
    return;
  }
  for (const nome of nomi) {
    const intero = join(cartella, nome);
    const dati = statSync(intero);
    if (dati.isDirectory()) yield* iFile(intero, radice);
    else if (dati.isFile()) yield relative(radice, intero).split("\\").join("/");
  }
}

/** L'impronta dei sorgenti della plancia in `cartella`. */
export function improntaDeiSorgenti(cartella) {
  const somma = createHash("sha256");
  for (const dove of SORGENTI) {
    for (const relativo of iFile(join(cartella, dove), cartella)) {
      somma.update(relativo);
      somma.update("\0");
      somma.update(readFileSync(join(cartella, relativo)));
      somma.update("\0");
    }
  }
  return somma.digest("hex");
}

/**
 * Il pacchetto che sta in `cartella`, se c'e' ed e' fatto da questi sorgenti:
 * `{ file }`, i suoi moduli relativi alla plancia. Altrimenti `null`, con il
 * perche' in `perche` per chi lo vuole dire nel registro.
 */
export function ilPaccoDi(cartella) {
  const dove = join(cartella, CARTELLA_DEL_PACCO);
  let foglio;
  try {
    foglio = JSON.parse(readFileSync(join(dove, FOGLIO_DEL_PACCO), "utf8"));
  } catch (_errore) {
    return { pacco: null, perche: "non c'e'" };
  }
  if (!foglio || typeof foglio.sorgenti !== "string")
    return { pacco: null, perche: "foglio storto" };
  for (const ingresso of INGRESSI_DEL_PACCO) {
    if (!existsSync(join(dove, ingresso))) return { pacco: null, perche: `manca ${ingresso}` };
  }
  if (foglio.sorgenti !== improntaDeiSorgenti(cartella)) {
    return { pacco: null, perche: "fatto da sorgenti diversi da questi" };
  }
  const file = [...iFile(dove, cartella)].filter((nome) => nome.endsWith(".js"));
  return { pacco: { file }, perche: "" };
}

/* Il segno che una pagina e' gia' stata riscritta. */
export const APERTURA_DEL_PACCO = "<!-- dm:pacco -->";

/* Un precaricamento dei moduli sciolti. La pagina li elenca uno per riga. */
const PRECARICO_SCIOLTO = /^[ \t]*<link rel="modulepreload" href="\.\.\/src\/[^"]*">\r?\n/gm;
const PRECARICO_INGRESSO = /^[ \t]*<link rel="modulepreload" href="\.\/modules-entry\.js">\r?\n/m;
const SCRIPT_INGRESSO = /<script type="module" src="\.\/modules-entry\.js"><\/script>/;

/**
 * La pagina `legacy/dashboard*.html`, coi moduli del pacchetto al posto dei
 * sorgenti sciolti. `file` sono i moduli del pacchetto, relativi alla
 * plancia (`pacco/…`).
 *
 * Se la pagina non ha la forma che ci si aspetta torna com'era: meglio sciolta
 * che a meta'.
 */
export function laPaginaImpacchettata(html, file) {
  const testo = String(html);
  if (testo.includes(APERTURA_DEL_PACCO)) return testo;
  if (!PRECARICO_INGRESSO.test(testo) || !SCRIPT_INGRESSO.test(testo)) return testo;
  const ingresso = `../${CARTELLA_DEL_PACCO}/${INGRESSI_DEL_PACCO[0]}`;
  const sezioni = `../${CARTELLA_DEL_PACCO}/${INGRESSI_DEL_PACCO[1]}`;
  /* Tutti i moduli del pacchetto, precaricati: sono una ventina, e chiederli
   * subito vuol dire non aspettare che il primo dica quali sono gli altri.
   * L'app li legge come lista della spesa e li prende in un giro solo
   * (`app/lib/plancia/precarichi.dart`). */
  const precarichi = [
    ingresso,
    ...file.map((nome) => `../${nome}`).filter((via) => via !== ingresso),
  ]
    .map((via) => `<link rel="modulepreload" href="${via}">\n`)
    .join("");
  /* Gli indirizzi si fissano interi, dal `<base>` della pagina: i moduli del
   * pacchetto stanno in un'altra cartella dei sorgenti, e un indirizzo
   * relativo si conterebbe da li'. */
  const dichiarazione =
    `${APERTURA_DEL_PACCO}\n` +
    precarichi +
    `<script>\n` +
    `window.__DASHBOARDMODERN_PACCO_SEZIONI__ = new URL(${JSON.stringify(sezioni)}, document.baseURI).href;\n` +
    `window.__DASHBOARDMODERN_CATALOGHI__ = new URL("../src/i18n/", document.baseURI).href;\n` +
    `window.__DASHBOARDMODERN_IMPACCHETTATA__ = true;\n` +
    `</script>\n` +
    `<!-- /dm:pacco -->\n`;
  /* Il ripiego: se il pacchetto non arriva, la pagina se ne accorge da se',
   * ritira le dichiarazioni e torna ai sorgenti sciolti. */
  const ripiego =
    `<script type="module" src="${ingresso}" ` +
    `onerror="window.__DASHBOARDMODERN_PACCO_SEZIONI__=null;` +
    `window.__DASHBOARDMODERN_CATALOGHI__=null;` +
    `window.__DASHBOARDMODERN_IMPACCHETTATA__=false;` +
    `var s=document.createElement('script');s.type='module';s.src='./modules-entry.js';` +
    `document.head.appendChild(s)"></script>`;
  return testo
    .replace(PRECARICO_SCIOLTO, "")
    .replace(PRECARICO_INGRESSO, () => dichiarazione)
    .replace(SCRIPT_INGRESSO, () => ripiego);
}
