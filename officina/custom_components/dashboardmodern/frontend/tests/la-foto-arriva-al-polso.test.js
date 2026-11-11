/* La fotografia di una casa vera, come parte dalla plancia verso l'orologio.
 *
 * «Dall'orologio i comandi non partono», e due correzioni di fila non l'hanno
 * sistemato: erano fatte guardando un pezzo solo della catena. Qui la catena
 * si rifa' dal primo anello: una casa configurata come la configura chi la
 * abita — le luci in `cd_luci`, una presa, le azioni rapide dell'editor — e la
 * fotografia la scatta **il codice vero della sezione** (`laFotoVaInAuto`),
 * non un oggetto scritto a mano gia' «giusto».
 *
 * Quello che esce e' il messaggio che la plancia manda all'app sul canale
 * `gdahomeAuto`. Sta scritto in `app/test/auto/dati/la_foto_dalla_plancia.json`
 * e da li' lo legge la prova dell'app (`dal_polso_alla_casa_test.dart`), che lo
 * fa passare per i file veri, il comando dal polso e chi lo esegue. Questa
 * prova tiene fermo che quel file sia davvero quello che la plancia manda: se
 * la plancia cambia, il file va rifatto, e la prova dell'app riparte da li'.
 *
 *     AGGIORNA_LA_FOTO=1 npm run -s test:frontend      rifa' il file
 *
 * I nomi sono inventati: non c'e' la casa di nessuno.
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import test from "node:test";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

/* Il canale dell'app: quello che la sezione cerca prima di fare qualunque
 * cosa. Qui si tiene da parte quello che ci passa. */
const mandati = [];
globalThis.gdahomeAuto = { postMessage: (messaggio) => mandati.push(messaggio) };

/* ── La casa ──────────────────────────────────────────────────────────────
 *
 * Le luci della pagina Luci. In una casa vera non sono tutte `light.*`: la
 * luce del giardino sta su un rele' ed e' uno `switch.*`, e la plancia lo sa
 * da sempre (`core/light-model.js`: «a switch only knows turn_on/turn_off/
 * toggle»). */
localStorage.setItem(
  "cd_luci",
  JSON.stringify({
    "light.sala": "Sala",
    "light.cucina": "Cucina",
    "switch.luce_esterna": "Luce esterna",
    "light.studio": "Studio",
  }),
);
localStorage.setItem("cd_prese", JSON.stringify([{ entity: "switch.presa_tv", name: "Presa TV" }]));

/* Le azioni rapide, come le scrive l'editor (`edAddQA` nel guscio). Il primo
 * tipo della tendina, quello che resta scelto se non si tocca, e' il gruppo
 * di luci: un'azione che si chiama «Luce esterna» nasce cosi'. */
const AZIONI = [
  { type: "luci_group", name: "Luce esterna", icon: "💡", lights: ["switch.luce_esterna"] },
  { type: "luci_group", name: "Zona giorno", icon: "💡", lights: ["light.sala", "light.cucina"] },
  { type: "toggle", name: "Cancello", icon: "🚧", entity: "switch.cancello" },
  { type: "builtin", builtin: "luci", name: "Tutte le luci" },
  { type: "script", name: "Buonanotte", entity: "script.buonanotte", confirm: "Spengo tutto?" },
  { type: "toggle", name: "Portone", entity: "lock.portone" },
  /* La settima: in auto e al polso ne entrano sei. */
  { type: "scene", name: "Cinema", entity: "scene.cinema" },
];
localStorage.setItem("cd_quick_actions", JSON.stringify(AZIONI));

/* Gli stati, dove li tiene il guscio. */
globalThis._RAW_STATES = {
  "light.sala": { state: "off", attributes: {} },
  "light.cucina": { state: "on", attributes: {} },
  "light.studio": { state: "unavailable", attributes: {} },
  "switch.luce_esterna": { state: "off", attributes: {} },
  "switch.presa_tv": { state: "on", attributes: {} },
  "switch.cancello": { state: "off", attributes: {} },
  "lock.portone": { state: "locked", attributes: {} },
};

const { laFotoVaInAuto } = await import("../src/sections/la-foto-va-in-auto-section.js");

/* Un momento fisso: il file non deve cambiare a ogni giro. */
const QUANDO = 1794400000000;
assert.equal(laFotoVaInAuto(QUANDO), true, "la plancia manda la fotografia");
assert.equal(mandati.length, 1);
const messaggio = JSON.parse(mandati[0]);

const DOVE = new URL(
  "../../../../../app/test/auto/dati/la_foto_dalla_plancia.json",
  import.meta.url,
);

const ricettaDi = (id) => messaggio.ricette.find((una) => una.id === id) || null;
const azione = (nome) => messaggio.azioni.find((una) => una.nome === nome) || null;
const dispositivo = (nome) => messaggio.dispositivi.find((uno) => uno.nome === nome) || null;

test("il file che legge la prova dell'app e' quello che la plancia manda davvero", () => {
  const scritto = `${JSON.stringify(messaggio, null, 2)}\n`;
  if (process.env.AGGIORNA_LA_FOTO) {
    mkdirSync(new URL("./", DOVE), { recursive: true });
    writeFileSync(DOVE, scritto);
  }
  assert.equal(
    readFileSync(DOVE, "utf8"),
    scritto,
    "la plancia e' cambiata: rifai il file con AGGIORNA_LA_FOTO=1",
  );
});

test("una luce dell'elenco dispositivi ha la sua ricetta, accesa o spenta", () => {
  /* «Sala», spenta: in auto non entra, al polso si' (`polso`), e la ricetta
   * c'e' — senza, il telefono risponderebbe «Questo si fa dal telefono». */
  assert.deepEqual(dispositivo("Sala"), {
    id: "light.sala",
    nome: "Sala",
    genere: "luce",
    acceso: false,
    stato: "Spenta",
    polso: true,
  });
  assert.deepEqual(ricettaDi("light.sala"), {
    id: "light.sala",
    dominio: "light",
    servizio: "toggle",
    entita: "light.sala",
    dati: {},
  });
  /* Una luce che e' uno `switch.*` si gira col suo dominio. */
  assert.equal(ricettaDi("switch.luce_esterna").dominio, "switch");
  /* Ogni dispositivo nella fotografia ha la sua ricetta, con lo stesso id. */
  for (const uno of messaggio.dispositivi) assert.ok(ricettaDi(uno.id), uno.id);
});

test("chi parte da solo e chi no, azione per azione", () => {
  const partono = Object.fromEntries(messaggio.azioni.map((una) => [una.nome, una.subito]));
  assert.deepEqual(partono, {
    "Luce esterna": true,
    "Zona giorno": true,
    Cancello: true,
    /* Apre un pannello della plancia: senza plancia non c'e' niente da aprire. */
    "Tutte le luci": false,
    /* Ha una domanda di conferma: qualcuno deve guardare. */
    Buonanotte: false,
    /* Una serratura: il servizio dipende da com'e' messa adesso. */
    Portone: false,
  });
  /* E chi parte da solo ha la ricetta con lo stesso id della fotografia. */
  for (const una of messaggio.azioni)
    assert.equal(Boolean(ricettaDi(una.id)), una.subito, una.nome);
  /* Sei, e non la settima. */
  assert.equal(azione("Cinema"), null);
  /* In tutto, mai piu' di quante l'app ne tiene: sei tasti e ventiquattro
   * dispositivi (`ricetteAlMassimo` in `app/lib/auto/la_foto.dart`). */
  assert.ok(messaggio.ricette.length <= 30);
});

test(
  "un gruppo di luci fatto di interruttori non si comanda con light.toggle",
  /* Rossa finche' non si corregge la plancia: non ferma le Prove, ma resta
   * scritto qui cos'e' che non torna. L'app intanto lo corregge da se' quando
   * esegue (`dominioDaChiamare`, `app/lib/auto/la_foto.dart`), ed e' quella la
   * correzione che arriva a chi non aggiorna l'add-on. */
  { todo: "la-foto-per-lauto.js, laRicettaDelGruppo: il dominio e' sempre «light»" },
  () => {
    /* `light.toggle` su `switch.luce_esterna`: Home Assistant risponde che e'
     * andata bene e non fa niente — il servizio delle luci guarda solo le
     * luci. Al polso esce «Fatto», e il giardino resta buio. */
    const ricetta = ricettaDi(azione("Luce esterna").id);
    assert.equal(ricetta.entita, "switch.luce_esterna");
    assert.notEqual(ricetta.dominio, "light");
  },
);
