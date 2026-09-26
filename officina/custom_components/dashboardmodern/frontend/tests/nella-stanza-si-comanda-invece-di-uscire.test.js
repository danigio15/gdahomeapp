/* «Quando si aggiungono azioni rapide e si mette la stanza, lo stesso esce
 * nella stanza; ma se si preme torna alla home.»
 *
 * E poi, dallo stesso collaudatore, due volte: «non e' solo select... anche la
 * scena, se la clicco sulla stanza non prende il comando ma esce e ritorna
 * sulla home», e «dentro la stanza se metto una entita per vedere solo lo
 * stato usando le mie entita, fa uguale, se premo esce dalla finestra. Penso
 * che sia una impostazione generale della stanza.»
 *
 * Era una impostazione generale della stanza. Un'entita' assegnata a mano
 * finisce nel blocco «Altro», e «Altro» aveva una destinazione scritta in
 * tabella: `home`. Da li' in poi tutta la riga era un tasto — `role="button"`,
 * `tabindex="0"`, il chevron — e quel tasto faceva una cosa sola: uscire dalla
 * stanza. Non importava cosa ci fosse dentro.
 *
 * Il difetto e' lo stesso gia' corretto tre volte in questa pagina: le
 * aperture (#275), i lettori (#405), le telecamere (#503). Ogni volta la cura
 * e' stata dare a quel genere una destinazione vera, e ogni volta ha guarito
 * un genere solo. Qui si guarisce la regola: non avere una destinazione non
 * vuol dire averne una qualsiasi. Vuol dire non andare da nessuna parte.
 *
 * Restano tre righe possibili, e nessuna delle tre esce dalla stanza:
 *
 *   - quella che si accende ha la sua levetta (c'era gia');
 *   - quella che si fa partire ha la sua stella (c'era gia', #504);
 *   - quella che si sceglie — un `select`, un `input_select` — ha i suoi tre
 *     puntini, che aprono lo stesso elenco delle azioni rapide;
 *   - e quella che si guarda e basta e' una riga e niente piu'.
 *
 * Queste prove tengono la regola, non i quattro casi: chi domani rimette una
 * destinazione di ripiego la trova qui.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { blockMarkup } = await import("../src/sections/rooms-page-section.js");

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

const STATI = {
  "select.ampli_sorgente": {
    state: "Giradischi",
    attributes: { friendly_name: "Sorgente ampli", options: ["Giradischi", "CD", "Radio"] },
  },
  "input_select.modalita_casa": {
    state: "Casa",
    attributes: { friendly_name: "Modalita casa", options: ["Casa", "Fuori", "Notte"] },
  },
  "scene.buonanotte": { state: "unknown", attributes: { friendly_name: "Buonanotte" } },
  "switch.presa_studio": { state: "on", attributes: { friendly_name: "Presa studio" } },
  "sensor.pressione": { state: "1013", attributes: { friendly_name: "Pressione" } },
};

/** La riga come la vede chi sta nella stanza. */
const riga = (entita, key = "altro") =>
  blockMarkup({ key, label: "Altro", voci: [{ entity: entita }] }, STATI);

/** Quello che la riga promette al dito: dove porta, e cosa ha accanto. */
function cosaOffre(html) {
  return {
    porta: /data-dm-stanza-vai="([^"]*)"/.exec(html)?.[1] ?? null,
    tasto: /data-dm-stanza-(tocca|avvia|scegli)=/.exec(html)?.[1] ?? null,
    siVesteDaTasto: /<article[^>]*role="button"/.test(html),
    chevron: html.includes('class="dm-stanze-vai"'),
  };
}

test("una riga senza una pagina dove andare non porta piu' in Home", () => {
  /* Il caso di Marco, alla lettera: un'entita' messa in stanza per leggerne lo
   * stato. Non c'e' niente da premere, e infatti adesso non c'e' niente da
   * premere: niente `role`, niente `tabindex`, niente chevron. Un tasto che
   * non fa niente e' peggio di nessun tasto — e con la tastiera e' anche una
   * fermata in piu' in un giro che non porta a niente. */
  const offerto = cosaOffre(riga("sensor.pressione"));
  assert.equal(offerto.porta, null, "la riga esce ancora dalla stanza");
  assert.equal(offerto.tasto, null);
  assert.equal(offerto.siVesteDaTasto, false, "si veste ancora da tasto senza esserlo");
  assert.equal(offerto.chevron, false, "il chevron promette un posto dove andare che non c'e'");
});

test("una scena in stanza parte, e resta nella stanza", () => {
  const offerto = cosaOffre(riga("scene.buonanotte"));
  assert.equal(offerto.tasto, "avvia", "la scena non ha piu' il suo tasto");
  assert.equal(offerto.porta, null, "la scena riporta di nuovo in Home");
});

test("un menu a tendina in stanza si sceglie, e resta nella stanza", () => {
  for (const entita of ["select.ampli_sorgente", "input_select.modalita_casa"]) {
    const html = riga(entita);
    const offerto = cosaOffre(html);
    assert.equal(offerto.tasto, "scegli", `${entita}: non ha il tasto che apre l'elenco`);
    assert.equal(offerto.porta, null, `${entita}: esce ancora dalla stanza`);
    /* E il segno e' suo: i tre puntini vogliono dire «c'e' un elenco», la
     * stella «questo parte adesso». Due gesti diversi non possono portare lo
     * stesso disegno. */
    assert.match(html, /class="dm-stanze-avvia dm-stanze-scegli"/);
    assert.match(html, /⋮/);
    assert.doesNotMatch(html, /✦/);
  }
});

test("quello che si accende ha ancora la sua levetta", () => {
  /* La riga che funzionava non si tocca: e' il controllo che dice che si e'
   * tolta una destinazione sbagliata e non un comando giusto. */
  const offerto = cosaOffre(riga("switch.presa_studio"));
  assert.equal(offerto.tasto, "tocca");
  assert.equal(offerto.porta, null);
});

test("e chi una pagina ce l'ha davvero continua ad andarci", () => {
  /* Le tre cure di prima — aperture (#275), lettori (#405), telecamere (#503)
   * — sono destinazioni vere, e restano. Qui si e' tolto solo il ripiego. */
  assert.equal(cosaOffre(riga("sensor.pressione", "clima")).porta, "clima");
  assert.equal(cosaOffre(riga("sensor.pressione", "coperture")).porta, "tapparelle");
  assert.equal(cosaOffre(riga("sensor.pressione", "telecamere")).porta, "security");
  assert.equal(cosaOffre(riga("sensor.pressione", "carichi")).porta, "energy");
});

test("un genere che la tabella non conosce non si manda in Home per ripiego", () => {
  /* `|| "home"` era la seconda porta da cui entrava lo stesso difetto: bastava
   * un blocco nuovo per rimettere in circolo la riga che esce dalla stanza. */
  assert.equal(cosaOffre(riga("sensor.pressione", "un-genere-che-non-esiste")).porta, null);
  const sorgente = leggi("sections/rooms-page-section.js");
  assert.doesNotMatch(sorgente, /TAB_DI\[blocco\.key\] \|\| "home"/);
  assert.match(sorgente, /TAB_DI\[blocco\.key\] \?\? ""/);
});

test("l'elenco delle voci e' quello delle azioni rapide, non un secondo elenco", () => {
  /* Due elenchi della stessa cosa, disegnati in due posti, dopo un po' dicono
   * due cose diverse. Il popup c'e' gia' e sa leggere e scrivere un menu a
   * tendina: da qui si chiama, non si ricopia. */
  const sorgente = leggi("sections/rooms-page-section.js");
  assert.match(sorgente, /import \{ apriIlMenu \} from "\.\/azioni-servizio-giusto-section\.js";/);
  /* Con chi l'ha aperta: il popup e' lo stesso che apre il tasto della Home, e
   * di la' gli arriva l'azione — nome scelto, icona scelta. Da qui non gli
   * arrivava niente e si intitolava col nome di Home Assistant: una finestra
   * «MODUS» aperta da una riga che si chiama «prova». */
  assert.match(sorgente, /apriIlMenu\(entity, \{/);
  assert.match(sorgente, /name: clean\(scegli\.getAttribute\("data-dm-stanza-nome"\)\),/);
  assert.match(sorgente, /icon: clean\(scegli\.getAttribute\("data-dm-stanza-segno"\)\),/);
  assert.doesNotMatch(sorgente, /dm-qa-voce/, "la stanza si e' disegnata un elenco suo");
  /* E di la' il tasto dev'esserci ancora. */
  assert.match(leggi("sections/azioni-servizio-giusto-section.js"), /export function apriIlMenu\(/);
});

test("il tocco sui tre puntini e' loro, non della riga", () => {
  /* E' lo stesso inciampo dell'interruttore (#467) e della stella (#504):
   * senza fermare l'evento, aprire l'elenco cambierebbe anche pagina, nei
   * blocchi che una pagina ce l'hanno. */
  const sorgente = leggi("sections/rooms-page-section.js");
  assert.match(
    sorgente,
    /const scegli = event\.target\?\.closest\?\.\("\[data-dm-stanza-scegli\]"\);[\s\S]{0,400}?event\.stopPropagation\(\);/,
  );
  /* Il divieto «si vede ma non si comanda» vale anche per l'elenco: un'entita'
   * messa in sola lettura non si sceglie. */
  assert.match(sorgente, /if \(!entity \|\| !siComanda\(entity\)\) return;\s*\n\s*root\.navigator\?\.vibrate/);
});

test("chi sa i generi resta uno solo", () => {
  /* «Tendina» e' la parola di `core/comandi-accanto.js` da sempre, e la
   * domanda la fanno in tre — le stanze, le sezioni proprie, le entita'
   * proprie — piu' le azioni rapide. Tre copie della stessa riga diventano tre
   * risposte diverse il giorno che nasce un dominio nuovo, e allora la riga sta
   * scritta una volta di la'. */
  const sorgente = leggi("sections/rooms-page-section.js");
  assert.match(sorgente, /siPuoScegliere as puoScegliere/);
  assert.match(
    sorgente,
    /function siPuoScegliere\(entity\) \{\n\s*return puoScegliere\(entity\) && siComanda\(entity\);/,
  );
  assert.doesNotMatch(sorgente, /=== "select" \|\| .*=== "input_select"/);
  /* E di la' la domanda guarda il genere, non un elenco suo di domini. */
  assert.match(
    leggi("core/comandi-accanto.js"),
    /export function siPuoScegliere\(entity\) \{\n\s*return genereDelComando\(entity\) === "tendina";/,
  );
});
