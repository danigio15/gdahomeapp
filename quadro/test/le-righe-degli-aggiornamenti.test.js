/* Come il quadro disegna un aggiornamento: il segno, e cosa cambia.
 *
 * Queste due righe prendono roba che arriva da una casa — il nome di un
 * aggiornamento, il marchio di chi lo porta, le note della versione, un
 * indirizzo — e la mettono dentro l'HTML di questa pagina. E' l'unico posto
 * del quadro dove del testo di fuori diventa disegno, ed e' esattamente il
 * posto dove si sbaglia.
 *
 * Il ponte quei campi se li controlla gia'. Non basta: fra il ponte e questa
 * pagina c'e' una rete, e un controllo solo da una parte della rete non e' un
 * controllo. Qui si prova quello di **questa** parte.
 *
 * Le funzioni stanno dentro un `<script>` di una pagina, quindi nessuno le
 * puo' importare. Si prende il pezzo di sorgente fra due segni fissi e lo si
 * compila: e' lo stesso programma che gira nel browser, non una copia.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const PAGINA = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");
const CHI = "inst_0123456789abcdef";

/* Due pezzi, perche' in mezzo c'e' roba che ha bisogno del browser. Se un
 * segno sparisce la prova non passa in silenzio: si ferma dicendo qual e'. */
const PEZZI = [
  ["const staLavorando = (c) =>", "const spia = (stato) =>"],
  ["function ilTasto(uno, c, casa) {", "/* Il cartello in cima agli aggiornamenti"],
];

function iPezzi() {
  let programma = "";
  for (const [da, a] of PEZZI) {
    const primo = PAGINA.indexOf(da);
    const ultimo = PAGINA.indexOf(a);
    assert.ok(primo >= 0, `nella pagina non c'e' piu' «${da}»`);
    assert.ok(ultimo > primo, `nella pagina non c'e' piu' «${a}» dopo «${da}»`);
    programma += PAGINA.slice(primo, ultimo);
  }
  /* Chi e' l'installatore: le icone stanno nella sua cartella, e
   * l'indirizzo lo porta davanti. */
  return new Function(
    `const IO = { chi: ${JSON.stringify(CHI)} }; ${programma}; return { ilSegnoDi, cosaCambia, unaRiga, ilTasto, eLaStessa };`,
  )();
}

test("il segno si ricontrolla qui, non solo nel ponte", () => {
  const { ilSegnoDi } = iPezzi();
  /* Il segno finisce dentro un indirizzo, e chi lo compone e' questa pagina:
   * una barra o due punti la porterebbero da un'altra parte. */
  for (const storto of [
    "../../altro",
    "e574160d1c8dc4e2/../x",
    "https://altrove.invalid/x",
    'x" onload="alert(1)',
    "E574160D1C8DC4E2",
    "e574160d1c8dc4",
  ]) {
    const disegnato = ilSegnoDi({ nome: "Switch", segno: storto });
    assert.ok(!disegnato.includes("<img"), `«${storto}» non deve diventare un'immagine`);
    assert.ok(!disegnato.includes(storto), `«${storto}» non deve finire nella pagina`);
  }
});

test("l'icona arriva dal quadro, non dai marchi di Home Assistant", () => {
  /* Prima questa pagina mandava il browser di chi installa su
   * `brands.home-assistant.io` con una parola presa dal rapporto, e c'erano
   * due guai in uno: quel browser andava a farsi vedere da una macchina che
   * non e' la sua, e quello che trovava era sbagliato — il logo di HACS al
   * posto di quello dell'applicazione, o niente per un firmware.
   *
   * Adesso l'icona vera la manda la casa e la serve il quadro. */
  const { ilSegnoDi } = iPezzi();
  const disegnato = ilSegnoDi({ nome: "Switch casa", segno: "e574160d1c8dc4e2" });
  /* `../segno/`, con il punto punto: la pagina sta in `/console/`, e senza
   * quello l'indirizzo si legge da li' — `/console/segno/…`, dove non c'e'
   * niente, e ogni icona salvata bene tornava un 404. */
  assert.match(disegnato, /src="\.\.\/segno\/inst_0123456789abcdef\/e574160d1c8dc4e2"/);
  assert.ok(
    !/src="segno\//.test(disegnato),
    "l'indirizzo si legge da /console/ e non trova niente",
  );
  assert.ok(
    !disegnato.includes("brands.home-assistant.io"),
    "il browser di chi installa va ancora a farsi vedere fuori",
  );
  /* E sotto c'e' l'iniziale: finche' l'icona non e' arrivata — il primo giro
   * dopo che un aggiornamento compare — la riga si legge lo stesso. */
  assert.match(disegnato, />S</);
  /* Se non arriva si toglie: non con un `onerror` dentro il tag, che la
   * politica della pagina non lascia girare, ma con un ascolto solo. */
  assert.match(disegnato, /data-se-non-arriva="via"/);
  assert.doesNotMatch(disegnato, /onerror=/);
  assert.match(PAGINA, /chi\.dataset\.seNonArriva === "via"\) chi\.remove\(\)/);
});

test("in tutta la pagina non si va piu' a prendere niente dai marchi", () => {
  /* Nei commenti quel nome c'e' ancora, ed e' giusto: e' il racconto di com'era
   * prima. Quello che non ci deve piu' essere e' un indirizzo che il browser
   * vada a chiedere. */
  const senzaCommenti = PAGINA.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(
    !senzaCommenti.includes("brands.home-assistant.io"),
    "resta un indirizzo dei marchi: quel browser ci va ancora",
  );
});

test("la roba nostra porta il bollo del quadro, che non si scarica da nessuna parte", () => {
  const { ilSegnoDi } = iPezzi();
  const disegnato = ilSegnoDi({ nome: "gdahome", nostra: true, marchio: "hassio" });
  assert.match(disegnato, /class="bollo"/);
  assert.ok(!disegnato.includes("<img"), "il nostro segno non va a chiedere niente fuori");
});

test("cosa cambia si disegna come testo, non come programma", () => {
  const { cosaCambia } = iPezzi();
  const disegnato = cosaCambia({
    cosaCambia: '<img src=x onerror="alert(1)"> & <b>grassetto</b>',
  });
  assert.ok(!disegnato.includes("<img"), "un tag dalle note non deve diventare un tag");
  assert.ok(!disegnato.includes("<b>"), "nemmeno uno innocuo: qui dentro non si fida di niente");
  assert.match(disegnato, /&lt;img/);
  assert.match(disegnato, /&amp;/);
});

test("le note per intero si aprono qui, e non mandano piu' fuori", () => {
  /* Era un collegamento verso il sito di chi ha scritto l'aggiornamento:
   * leggere cosa cambia prima di premere «Installa» voleva dire uscire dal
   * cruscotto, e chi esce non sempre torna. */
  const { cosaCambia } = iPezzi();
  globalThis.CON_LE_NOTE = new Set(["e574160d1c8dc4e2"]);
  const con = cosaCambia({ cosaCambia: "qualcosa", segno: "e574160d1c8dc4e2" });
  assert.match(con, /data-note="e574160d1c8dc4e2"/);
  assert.ok(!con.includes("<a "), "manda ancora fuori");
  assert.ok(!con.includes('target="_blank"'), "manda ancora fuori");

  /* Il tasto c'e' solo dove le note ci sono davvero: un tasto che non apre
   * niente e' peggio di nessun tasto. */
  globalThis.CON_LE_NOTE = new Set();
  const senza = cosaCambia({ cosaCambia: "qualcosa", segno: "e574160d1c8dc4e2" });
  assert.ok(!senza.includes("data-note="), "il tasto c'e' anche senza note da aprire");

  /* E un segno storto non ci prova nemmeno. */
  globalThis.CON_LE_NOTE = new Set(["../altro"]);
  assert.ok(!cosaCambia({ cosaCambia: "x", segno: "../altro" }).includes("data-note="));
});

test("chi non ha niente da dire non occupa una riga vuota", () => {
  const { cosaCambia } = iPezzi();
  assert.equal(cosaCambia({}), "");
  assert.equal(cosaCambia({ cosaCambia: "   ", note: "" }), "");
});

test("la riga e' una sola, e la usano tutt'e due le schermate", () => {
  /* Prima erano due disegni per la stessa cosa — righe nella scheda di una
   * casa, pastigline nella flotta — e nella flotta non si vedeva ne' il logo
   * ne' cosa cambiava. Due disegni per una cosa sola vuol dire che uno resta
   * indietro, ed era sempre lo stesso. */
  const quante = [...PAGINA.matchAll(/(?<!function )unaRiga\(uno/g)].length;
  assert.equal(quante, 2, "le due schermate non disegnano piu' la stessa riga");
  const { unaRiga } = iPezzi();
  const disegnata = unaRiga(
    { nome: "Shelly", da: "1.2.0", a: "1.3.0", marchio: "shelly", cosaCambia: "Risolve il buio." },
    { fare: '<button type="button" class="tasto">Installa</button>' },
  );
  assert.match(disegnata, /Shelly/);
  assert.match(disegnata, /1\.2\.0 → 1\.3\.0/);
  assert.match(disegnata, /Risolve il buio\./);
  assert.match(disegnata, /Installa/);
});

/* ─── Il tasto che installa a casa di qualcun altro ─────────────────────────
 *
 * Sei casi, e l'ordine in cui si leggono e' tutta la storia: il tasto e'
 * l'ultimo, e tutto quello che viene prima e' una ragione per non mostrarlo.
 * Un tasto che compare quando non dovrebbe e' una promessa che non si
 * mantiene — o, peggio, un'installazione in casa di qualcuno che non l'ha
 * permessa.
 */

const UNO = { nome: "Shelly Plus", da: "1.2.0", a: "1.3.0", installabile: true };
const APERTA = { manutenzione: true };
const CASA = { casa: "casa_a3f19c74e05b2d8890fa4c1e6b73d052", chiesto: null };

test("senza manutenzione aperta il tasto non c'e', e c'e' scritto perche'", () => {
  const { ilTasto } = iPezzi();
  const disegnato = ilTasto(UNO, { manutenzione: false }, CASA);
  assert.ok(!disegnato.includes("<button"), "il tasto compare su una casa che non l'ha aperta");
  assert.match(disegnato, /manutenzione non attiva/);
});

test("una casa che non dice niente della manutenzione vale come chiusa", () => {
  /* Una casa ferma a un ponte di ieri quella riga non la manda: `undefined`
   * non e' un permesso. */
  const { ilTasto } = iPezzi();
  assert.ok(!ilTasto(UNO, {}, CASA).includes("<button"));
});

test("un firmware che si aggiorna dal suo apparecchio non ha nessun tasto", () => {
  const { ilTasto } = iPezzi();
  const disegnato = ilTasto({ ...UNO, installabile: false }, APERTA, CASA);
  assert.ok(!disegnato.includes("<button"));
  /* Le stesse parole dell\'app, che per la stessa cosa dice «Questo si
   * aggiorna dal suo apparecchio». Due schermate che raccontano la stessa
   * cosa con due parole diverse sono due cose da imparare invece di una. */
  assert.match(disegnato, /si aggiorna dal suo apparecchio/);
});

test("con la manutenzione aperta il tasto porta nome e salto, non l'entita'", () => {
  const { ilTasto } = iPezzi();
  const disegnato = ilTasto({ ...UNO, entita: "update.camera_di_marco" }, APERTA, CASA);
  assert.match(disegnato, /data-installa="casa_a3f19c74e05b2d8890fa4c1e6b73d052"/);
  assert.match(disegnato, /data-quale-nome="Shelly Plus"/);
  assert.match(disegnato, /data-quale-da="1\.2\.0"/);
  assert.match(disegnato, /data-quale-a="1\.3\.0"/);
  assert.ok(!disegnato.includes("camera_di_marco"), "l'entita' non deve finire nella pagina");
});

test("uno per volta: mentre una cosa sta andando le altre non hanno tasto", () => {
  const { ilTasto } = iPezzi();
  const altro = { nome: "Altro", da: "1", a: "2", installabile: true };
  const inBallo = { ...APERTA, lavoro: { ...UNO, stato: "in corso" } };
  assert.match(ilTasto(UNO, inBallo, CASA), /in corso/);
  const disegnato = ilTasto(altro, inBallo, CASA);
  assert.ok(!disegnato.includes("<button"));
  assert.match(disegnato, /uno per volta/);
});

test("quello appena chiesto si puo' annullare, e gli altri aspettano", () => {
  const { ilTasto } = iPezzi();
  const conRichiesta = { ...CASA, chiesto: { ...UNO, chiesto: Date.now() } };
  assert.match(ilTasto(UNO, APERTA, conRichiesta), /data-lascia-stare=/);
  const altro = { nome: "Altro", da: "1", a: "2", installabile: true };
  assert.match(ilTasto(altro, APERTA, conRichiesta), /uno per volta/);
});

test("si riconosce per nome e salto insieme, non per nome soltanto", () => {
  /* Due versioni dello stesso nome sono due righe diverse: se bastasse il
   * nome, il tasto sparirebbe da quella sbagliata. */
  const { eLaStessa } = iPezzi();
  assert.equal(eLaStessa(UNO, { nome: "Shelly Plus", da: "1.2.0", a: "1.3.0" }), true);
  assert.equal(eLaStessa(UNO, { nome: "Shelly Plus", da: "1.3.0", a: "1.4.0" }), false);
  assert.equal(eLaStessa(UNO, null), false);
});

test("quando dice «manutenzione chiusa», dice anche dove si apre — con le parole vere", () => {
  /* La domanda che ha fatto nascere questa prova: «dove si abilita?». La
   * pagina mandava a cercare l'interruttore in una scheda della console
   * dell'add-on, e l'interruttore invece e' una **casella della
   * configurazione**. Un installatore che legge quella riga manda il suo
   * cliente nel posto sbagliato, e poi la colpa e' del programma.
   *
   * Il nome della casella si legge dalle traduzioni del ponte: se un giorno
   * cambia li', questa prova si ferma invece di lasciare in giro istruzioni
   * che non portano da nessuna parte. */
  const parole = readFileSync(join(QUI, "..", "..", "ponte", "translations", "it.yaml"), "utf8");
  /* A otto spazi e senza prefisso: dalla 1.5.8 le caselle stanno dentro una
   * sezione, e «Casa · » lo dice il titolo del gruppo. */
  const come = /^ {8}name: (Lascia che.*)$/m.exec(parole)?.[1];
  assert.ok(come, "nelle traduzioni non c'e' piu' la casella della manutenzione");
  assert.ok(PAGINA.includes(come), `il quadro non chiama quella casella col suo nome: «${come}»`);
  /* E la strada per arrivarci, che senza il nome da solo non basta. */
  assert.match(PAGINA, /Impostazioni › Add-on › gdahome › Configurazione/);
});
