/* Gli animali di casa, anche in Home (#145).
 *
 * «La sezione animali non appare nei widget della home.»
 *
 * La sezione c'era: scheda nel Config, pagina, disegno nel catalogo. La
 * tessera no — non esisteva proprio il modello — e quindi nemmeno la riga per
 * ordinarla o spegnerla. Queste prove tengono insieme i cinque agganci che
 * servono perché una tessera esista davvero, perché a dimenticarne uno la
 * tessera esce a metà: senza catalogo non si sposta, senza disegno esce
 * l'emoji, senza sezione non compare «Apri sezione», senza interruttore le
 * entità spente rientrano dalla finestra.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { animaliModel } = await import("../src/sections/home-widgets-section.js");
const { CHIAVE_ANIMALI } = await import("../src/core/animali-model.js");
const { TESSERE_PER_SCHEDA, scriviLaVoce } = await import("../src/core/fuori-dai-widget.js");
const { haOggettoWidget } = await import("../src/core/oggetti-widget.js");

const scrivi = (chiave, valore) => magazzino.set(chiave, JSON.stringify(valore));

const MILO = {
  id: "milo",
  nome: "Milo",
  specie: "gatto",
  cibo_livello: "sensor.milo_cibo",
  lettiera_ultima: "sensor.milo_lettiera",
};
const LUNA = { id: "luna", nome: "Luna", specie: "cane", cibo_livello: "sensor.luna_cibo" };

const quota = (valore) => ({ state: String(valore), attributes: { unit_of_measurement: "%" } });

const CIOTOLE_PIENE = {
  "sensor.milo_cibo": quota(80),
  "sensor.luna_cibo": quota(70),
  /* La lettiera di Milo, pulita da poco: è la sua seconda lettura, e serve a
   * provare che spegnendo la prima lui resta. */
  "sensor.milo_lettiera": {
    state: new Date(Date.now() - 3600000).toISOString(),
    attributes: { device_class: "timestamp" },
  },
};

/* Milo ha la ciotola quasi vuota: sotto metà della soglia di serie, quindi
 * urgente. È il caso per cui uno guarda la Home invece che la sezione. */
const CIOTOLA_DI_MILO_VUOTA = { ...CIOTOLE_PIENE, "sensor.milo_cibo": quota(5) };

function conGliAnimali(animali, stati, extra = {}) {
  magazzino.clear();
  scrivi(CHIAVE_ANIMALI, animali);
  for (const [chiave, valore] of Object.entries(extra)) scrivi(chiave, valore);
  return animaliModel(stati);
}

/* ── che ci sia ───────────────────────────────────────────────────────── */

test("con un animale configurato la tessera esiste", () => {
  const tessera = conGliAnimali([MILO, LUNA], CIOTOLE_PIENE);
  assert.ok(tessera, "è tutta l'issue: non c'era");
  assert.equal(tessera.key, "animali");
  assert.equal(tessera.label, "Animali");
  assert.equal(tessera.value, "2");
  assert.equal(tessera.caption, "Milo · Luna", "senza niente da dire, i nomi");
  assert.equal(tessera.attiva, false);
  assert.equal(tessera.alert, false);
});

test("senza animali, e senza niente da leggere, la tessera non c'è", () => {
  assert.equal(conGliAnimali([], CIOTOLE_PIENE), null);
  /* Una scheda col solo nome non è una notizia: in Home non ci va. */
  assert.equal(conGliAnimali([{ id: "solo", nome: "Solo" }], {}), null);
  /* E un'entità che non risponde non è una lettura. */
  assert.equal(conGliAnimali([MILO], { "sensor.milo_cibo": { state: "unavailable" } }), null);
});

/* ── che dica la cosa giusta ──────────────────────────────────────────── */

test("quando qualcosa serve, la tessera lo dice e si accende", () => {
  const tessera = conGliAnimali([MILO, LUNA], CIOTOLA_DI_MILO_VUOTA);
  assert.equal(tessera.caption, "Milo: cibo in esaurimento");
  assert.equal(tessera.attiva, true);
  assert.equal(tessera.alert, true, "sotto metà soglia è urgente");
  assert.equal(tessera.accent, "#dc2626");
});

test("chi ha bisogno sta in cima, e porta l'entità giusta", () => {
  const tessera = conGliAnimali([LUNA, MILO], CIOTOLA_DI_MILO_VUOTA);
  assert.equal(tessera.rows[0].name, "Milo", "prima chi ha bisogno, poi gli altri");
  assert.equal(tessera.rows[0].value, "Cibo in esaurimento");
  assert.equal(tessera.rows[0].tono, "allarme");
  assert.equal(
    tessera.rows[0].entity,
    "sensor.milo_cibo",
    "lo storico è dell'entità dell'avviso: un animale non è un'entità",
  );
  assert.equal(tessera.rows[1].name, "Luna");
  assert.equal(tessera.rows[1].value, "70 %", "chi sta bene mostra la sua lettura");
  assert.equal(tessera.rows[1].tono, "quiete");
});

test("le parole sono quelle della sezione, non una seconda copia", () => {
  const sezione = leggi("sections/animali-section.js");
  assert.ok(
    /export function parolaAvviso/.test(sezione) && /export function testoLettura/.test(sezione),
    "la sezione non presta più le sue parole: la tessera se le riscriverebbe",
  );
  const tessere = leggi("sections/home-widgets-section.js");
  assert.ok(
    /import \{ parolaAvviso, testoLettura \} from "\.\/animali-section\.js"/.test(tessere),
    "la tessera si è scritta le parole per conto suo",
  );
});

/* ── l'interruttore «nel widget» ──────────────────────────────────────── */

test("l'entità spenta nel widget esce dal modello, non solo dalla vista", () => {
  const tessera = conGliAnimali([MILO, LUNA], CIOTOLA_DI_MILO_VUOTA, {
    cd_widgets: { excluded: [scriviLaVoce("animali", "sensor.milo_cibo")] },
  });
  /* Milo resta — la lettiera parla ancora — ma il suo avviso no: era di
   * un'entità che qualcuno ha deciso di non vedere in Home. */
  assert.equal(tessera.caption, "Milo · Luna");
  assert.equal(tessera.attiva, false);
  assert.ok(!tessera.rows.some((riga) => riga.entity === "sensor.milo_cibo"));
});

test("spento in un'altra tessera, qui non cambia niente", () => {
  const tessera = conGliAnimali([MILO], CIOTOLA_DI_MILO_VUOTA, {
    cd_widgets: { excluded: [scriviLaVoce("presenza", "sensor.milo_cibo")] },
  });
  assert.equal(tessera.attiva, true, "chi l'ha spento nella Presenza non ha detto niente qui");
});

/* ── i cinque agganci ─────────────────────────────────────────────────── */

test("la scheda Animali sa di quale tessera parla", () => {
  assert.equal(TESSERE_PER_SCHEDA.animali, "animali");
});

test("la tessera ha il suo disegno, non l'emoji di ripiego", () => {
  assert.ok(haOggettoWidget("animali"), "la chiave della tessera non trova l'orma");
});

test("la tessera si può ordinare e spegnere dal catalogo", () => {
  const editor = leggi("sections/todo-editor-section.js");
  const catalogo = editor.slice(
    editor.indexOf("function catalogoTessere"),
    editor.indexOf("function tessereOrdinate"),
  );
  assert.ok(/\["animali",/.test(catalogo));
});

test("dalla tessera si apre la sezione Animali", () => {
  const tessere = leggi("sections/home-widgets-section.js");
  const mappa = tessere.slice(tessere.indexOf("const SEZIONE_DEL_WIDGET"));
  assert.ok(/^\s+animali: "animali",$/m.test(mappa), "il tasto «Apri sezione» non comparirebbe");
});
