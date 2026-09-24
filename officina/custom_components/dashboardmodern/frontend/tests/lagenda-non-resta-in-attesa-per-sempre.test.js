/* «Solo su iPhone ogni volta che apro HA il widget agenda non carica gli
 * eventi; devo cliccare sul widget e fare apri selezione e dopo va, ma appena
 * richiudo mi fa lo stesso difetto» (#122).
 *
 * Il sospetto facile era il calendario — la richiesta a `calendar.get_events`,
 * la finestra del mese, il fuso. Non è lì: la stessa agenda sullo stesso
 * telefono, toccata due volte, si riempie. Quello che cambia fra il primo
 * disegno e il secondo non è cosa si chiede, è SE si chiede.
 *
 * `inflight` era un contrassegno a due stati: si accende quando la richiesta
 * parte e si spegne quando torna, bene o male che vada. Su iOS c'è un terzo
 * esito. L'app di Home Assistant sospende la pagina quando va in secondo
 * piano, e la richiesta che era per aria muore senza risolvere e senza
 * rompere: quel `finally` non viene eseguito mai. Al ritorno la scheda si
 * crede ancora in attesa di una risposta che non arriverà, e da lì in poi ogni
 * disegno trova il contrassegno acceso e non chiede più niente. Il widget
 * resta vuoto per tutta la sessione — e riaprendo la app è ancora lì, acceso,
 * perché la pagina è la stessa di prima.
 *
 * Due rimedi, e servono tutti e due. Il contrassegno diventa un ORARIO, così
 * una richiesta persa scade da sé anche quando nessuno avvisa; e i due momenti
 * in cui il telefono dice «eccomi» — `pageshow` e `visibilitychange` —
 * liberano subito quello che era per aria, perché chi riapre la app vuole
 * vedere la sua agenda adesso, non fra mezzo minuto.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { ancoraInVolo } = await import("../src/sections/home-widgets-section.js");

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const sezione = readFileSync(join(SRC, "sections", "home-widgets-section.js"), "utf8");

const ADESSO = Date.parse("2026-09-24T09:00:00Z");

test("una richiesta appena partita è in volo, e non se ne fa una seconda", () => {
  assert.equal(ancoraInVolo({ inflight: true, inVoloDa: ADESSO }, ADESSO + 500), true);
});

test("una scheda che non ha chiesto niente non è in volo", () => {
  assert.equal(ancoraInVolo({ inflight: false, inVoloDa: 0 }, ADESSO), false);
  assert.equal(ancoraInVolo(null, ADESSO), false);
  assert.equal(ancoraInVolo(undefined, ADESSO), false);
});

test("dopo mezzo minuto la richiesta si dà per persa: l'agenda torna a chiedere", () => {
  /* È il guaio di #122: la pagina sospesa ha ucciso la richiesta senza farla
   * tornare. Senza scadenza questa scheda resterebbe «in volo» per sempre. */
  const morta = { inflight: true, inVoloDa: ADESSO };
  assert.equal(ancoraInVolo(morta, ADESSO + 29000), true);
  assert.equal(ancoraInVolo(morta, ADESSO + 31000), false);
});

test("un contrassegno acceso senza ora è già scaduto", () => {
  /* Una scheda rimasta accesa da prima di questa correzione — o da un percorso
   * che accende `inflight` e si dimentica l'orario — non deve bloccare la
   * lista per sempre: senza ora non c'è niente da aspettare. */
  assert.equal(ancoraInVolo({ inflight: true }, ADESSO), false);
  assert.equal(ancoraInVolo({ inflight: true, inVoloDa: 0 }, ADESSO), false);
  assert.equal(ancoraInVolo({ inflight: true, inVoloDa: "boh" }, ADESSO), false);
});

test("le due richieste che si potevano piantare usano la scadenza, non il contrassegno nudo", () => {
  /* Liste ToDo e calendari: tutte e due avevano lo stesso `if (x.inflight)
   * return`, e tutte e due erano quella porta chiusa per sempre. */
  assert.ok(
    !/if \((?:cache|scheda)\.inflight\) return;/.test(sezione),
    "una delle due richieste guarda ancora il contrassegno nudo",
  );
  const conScadenza = sezione.match(
    /if \(ancoraInVolo\((?:cache|scheda), (?:now|adesso)\)\) return;/g,
  );
  assert.equal(conScadenza?.length, 2);
  /* E tutte e due scrivono l'ora insieme al contrassegno, se no la scadenza
   * non ha niente da misurare. */
  assert.equal(sezione.match(/\.inVoloDa = (?:now|adesso);/g)?.length, 2);
});

test("tornando in primo piano quello che era per aria si libera subito", () => {
  /* Mezzo minuto è la rete di sicurezza; il telefono però lo sa prima di noi
   * che è tornato, e lo dice in questi due modi. */
  assert.match(sezione, /addEventListener\?\.\("pageshow", tornatiInPrimoPiano\)/);
  assert.match(sezione, /visibilityState === "visible"/);
  const corpo = sezione.slice(
    sezione.indexOf("const tornatiInPrimoPiano = () => {"),
    sezione.indexOf('root.addEventListener?.("pageshow"'),
  );
  assert.ok(corpo.includes("state.lists.values()"), "le liste ToDo restano appese");
  assert.ok(corpo.includes("state.calendari.values()"), "i calendari restano appesi");
  assert.match(corpo, /scheda\.inflight = false;/);
  assert.match(corpo, /scheda\.inVoloDa = 0;/);
  /* Anche l'ultimo fallimento si dimentica: se la richiesta è morta perché il
   * telefono è andato in secondo piano, farsi aspettare altri venti secondi
   * per un errore che non è mai stato un errore è tempo regalato. */
  assert.match(corpo, /scheda\.failedAt = 0;/);
  /* E si ridisegna, se no la liberazione non la vede nessuno finché non tocca
   * qualcosa — che è esattamente il «devo cliccare sul widget» di #122. */
  assert.match(corpo, /schedule\(\);/);
});
