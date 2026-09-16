/* Le stanze di Home Assistant non si chiedono: si ricordano.
 *
 * Il conto della presenza per stanza (#549) — «ho due sensori sulla stessa
 * stanza e mi dice in due stanze c'è qualcuno» — si appoggia ai tre registri di
 * Home Assistant: le aree, le aree dei dispositivi, le aree delle entità. Chi
 * disegna non ce li ha: il guscio li tiene in `WIZ`, che nasce vuoto a ogni
 * caricamento della pagina, e dentro il pannello non lo riempie nessuno. Lì la
 * correzione della #549 non è mai entrata in funzione.
 *
 * Chiederli da chi disegna si è provato, ed è costata la #553: «carica
 * correttamente i dati poi all'improvviso scompaiono». La domanda partiva una
 * volta per entità, `config/entity_registry/list` è la risposta più pesante che
 * Home Assistant sappia dare, e fallendo si rifaceva a ogni cambio di stato
 * della casa — la linea cadeva e con lei le sottoscrizioni.
 *
 * Quindi non si chiedono. Chi i registri li ha già in mano — il pannello e la
 * card, che li ricevono dentro `hass` senza chiedere niente; il rilevamento
 * automatico, che li carica per conto suo — ne lascia una mappa piatta
 * «entità → nome della stanza», e chi disegna la legge.
 *
 * Qui si prova il posto dove quella mappa vive, e i due che gliela consegnano.
 */
import assert from "node:assert/strict";
import test from "node:test";

// Pannello e card dichiarano un elemento su misura: i due appigli del DOM
// devono esistere già all'importazione.
globalThis.HTMLElement = class {
  attachShadow() {
    this.shadowRoot = { replaceChildren() {} };
    return this.shadowRoot;
  }
};
globalThis.customElements = { get: () => undefined, define: () => {} };
// La card si registra fra le card su misura di Lovelace all'importazione.
globalThis.window = globalThis;

const {
  CHIAVE_DELLE_STANZE,
  dimenticaLeStanze,
  ricordaLeStanze,
  ricordaLeStanzeDiHomeAssistant,
  stanzaRicordata,
  stanzeDaiRegistri,
  stanzeDalGuscio,
} = await import("../src/core/le-stanze-di-home-assistant.js");
const { DashboardModernPanel } = await import("../panel.js");
const { DashboardModernCard } = await import("../dashboard-card.js");

class DiscoFinto {
  values = new Map();
  letture = 0;
  getItem(key) {
    this.letture += 1;
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

function conDiscoFinto(prova) {
  const storage = new DiscoFinto();
  const prima = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  try {
    dimenticaLeStanze();
    prova(storage);
  } finally {
    if (prima) Object.defineProperty(globalThis, "localStorage", prima);
    else delete globalThis.localStorage;
    dimenticaLeStanze();
  }
}

const casaConRegistri = (nome = "Salotto") => ({
  locale: { language: "it" },
  areas: { salotto: { area_id: "salotto", name: nome } },
  devices: { dev1: { id: "dev1", area_id: "salotto" } },
  entities: {
    /* Uno dichiara l'area da sé, l'altro la eredita dal dispositivo: sono i due
     * modi in cui Home Assistant assegna una stanza. */
    "binary_sensor.prox": { entity_id: "binary_sensor.prox", area_id: "salotto" },
    "binary_sensor.pres": { entity_id: "binary_sensor.pres", device_id: "dev1" },
    "binary_sensor.senza_stanza": { entity_id: "binary_sensor.senza_stanza" },
  },
});

test("una mappa a metà non cancella quella buona", () => {
  /* Il pannello che sta ancora caricando, o un rilevamento che non ha trovato
   * niente, arrivano con le mani vuote. Scrivere il vuoto vorrebbe dire
   * spegnere il conto per stanza fino al prossimo giro fortunato. */
  dimenticaLeStanze();
  const storage = new DiscoFinto();
  assert.equal(ricordaLeStanze({ "binary_sensor.prox": "Salotto" }, storage), true);
  assert.equal(ricordaLeStanze({}, storage), false);
  assert.equal(ricordaLeStanze(null, storage), false);
  assert.equal(stanzaRicordata("binary_sensor.prox", storage), "Salotto");

  /* E la stessa mappa non si riscrive: a ogni caricamento sarebbe una
   * scrittura su disco per niente. */
  dimenticaLeStanze();
  assert.equal(ricordaLeStanze({ "binary_sensor.prox": "Salotto" }, storage), false);
  /* Una diversa sì: le stanze si rinominano. */
  assert.equal(ricordaLeStanze({ "binary_sensor.prox": "Soggiorno" }, storage), true);
  assert.equal(stanzaRicordata("binary_sensor.prox", storage), "Soggiorno");
});

test("i tre registri arrivano in due forme, e sono gli stessi", () => {
  /* A elenco da chi li chiede al socket, a dizionario da chi li riceve già
   * pronti dal pannello. Una forma sola da qui in poi. */
  const aElenco = stanzeDaiRegistri({
    aree: [{ area_id: "salotto", name: "Salotto" }],
    dispositivi: [{ id: "dev1", area_id: "salotto" }],
    entita: [
      { entity_id: "binary_sensor.pres", device_id: "dev1" },
      { entity_id: "binary_sensor.orfana" },
    ],
  });
  assert.deepEqual(aElenco, { "binary_sensor.pres": "Salotto" });

  /* E la forma compatta del guscio storico, che la #549 leggeva già. */
  assert.deepEqual(
    stanzeDalGuscio({
      entReg: {
        "binary_sensor.prox": { a: "salotto" },
        "binary_sensor.pres": { d: "dev1" },
        "binary_sensor.orfana": {},
      },
      devArea: { dev1: "salotto" },
      areaNames: { salotto: "Salotto" },
    }),
    { "binary_sensor.prox": "Salotto", "binary_sensor.pres": "Salotto" },
  );
  assert.deepEqual(stanzeDalGuscio(null), {});
  assert.deepEqual(stanzeDaiRegistri(), {});
});

/* ── Chi la consegna: il pannello e la card ───────────────────────────────── */

for (const [chi, Elemento] of [
  ["il pannello", DashboardModernPanel],
  ["la card", DashboardModernCard],
]) {
  test(`${chi} mette da parte le stanze appena \`hass\` gliele porta`, () => {
    conDiscoFinto((storage) => {
      const elemento = new Elemento();
      /* Senza registri non si scrive niente: al primo `hass` le sottoscrizioni
       * possono non aver ancora risposto, e il vuoto non deve cancellare la
       * mappa di ieri. */
      elemento.hass = { locale: { language: "it" } };
      assert.equal(storage.getItem(CHIAVE_DELLE_STANZE), null);

      elemento.hass = casaConRegistri();
      assert.deepEqual(JSON.parse(storage.getItem(CHIAVE_DELLE_STANZE)), {
        "binary_sensor.prox": "Salotto",
        "binary_sensor.pres": "Salotto",
      });
    });
  });

  test(`${chi}: a ogni cambio di stato della casa non rifà il lavoro`, () => {
    conDiscoFinto((storage) => {
      const elemento = new Elemento();
      const casa = casaConRegistri();
      elemento.hass = casa;
      const dopoLaPrima = storage.letture;

      /* `set hass` arriva decine di volte al minuto: Home Assistant rifà
       * l'oggetto a ogni cambio di stato, ma i tre registri li sostituisce solo
       * quando cambiano davvero. Ripassarli ogni volta sarebbe il genere di
       * spreco che si vede sul termometro del mini PC — e questa plancia una
       * volta l'ha già fatto. */
      for (let giro = 0; giro < 50; giro += 1) elemento.hass = { ...casa };
      assert.equal(storage.letture, dopoLaPrima, "sono gli stessi tre registri");

      /* Ma una stanza rinominata si vede: i registri sono oggetti nuovi. */
      elemento.hass = casaConRegistri("Soggiorno");
      assert.deepEqual(JSON.parse(storage.getItem(CHIAVE_DELLE_STANZE)), {
        "binary_sensor.prox": "Soggiorno",
        "binary_sensor.pres": "Soggiorno",
      });
    });
  });
}

test("e una casa che quei registri non li porta non manda giù niente", () => {
  /* I tre registri dentro `hass` sono un regalo, non un patto: se un giorno non
   * ci fossero, la plancia deve partire lo stesso e il conto ripiegare sul
   * nome — non fermarsi sul montaggio. */
  const storage = {
    getItem() {
      throw new Error("niente disco");
    },
    setItem() {
      throw new Error("niente disco");
    },
  };
  const prima = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  try {
    dimenticaLeStanze();
    assert.doesNotThrow(() => {
      new DashboardModernPanel().hass = casaConRegistri();
      new DashboardModernCard().hass = casaConRegistri();
    });
    assert.equal(ricordaLeStanzeDiHomeAssistant(casaConRegistri()), false);
  } finally {
    if (prima) Object.defineProperty(globalThis, "localStorage", prima);
    else delete globalThis.localStorage;
    dimenticaLeStanze();
  }
});
