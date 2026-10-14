/* Le macchine e la rete, con le loro altre letture (#177).
 *
 * «Ho un sistema di ping esterno che per ogni apparecchio mi espone diversi
 * sensori: online, latenza, uptime, pacchetti persi, ultima volta visto.
 * Vorrei vederli nella pagina MiniPC.»
 *
 * L'entita' della riga dice soltanto se l'apparecchio c'e' o non c'e'. Il resto
 * sta in altri sensori accanto, e chi configura li sceglie come le «Altre
 * letture» del robot, della TV e degli elettrodomestici. Qui si tiene fermo che
 * quelle scelte arrivino al salvataggio e tornino indietro intere — un campo
 * che non sta in `CAMPI_IN_PIU` sparisce alla prima riapertura — e che in
 * pagina si leggano come si leggono altrove: nome corto, valore con l'unita',
 * il trattino per chi non risponde, e una data detta per quanto e' lontana.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMPI_IN_PIU,
  conLaRiga,
  lettureDellaRiga,
  lettureProposteDellaMacchina,
  macchineERete,
  righeDichiarate,
} from "../src/core/macchine-e-rete.js";
import { durataLeggibile, letturaDelDispositivo } from "../src/core/letture-accanto.js";

const ADESSO = Date.parse("2026-10-14T10:00:00Z");

const STATI = {
  "binary_sensor.router_online": {
    state: "on",
    attributes: { device_class: "connectivity", friendly_name: "Router Online" },
  },
  "sensor.router_latenza": {
    state: "12.4",
    attributes: { friendly_name: "Router Latenza", unit_of_measurement: "ms" },
  },
  "sensor.router_pacchetti_persi": {
    state: "0",
    attributes: { friendly_name: "Router Pacchetti persi", unit_of_measurement: "%" },
  },
  "sensor.router_ultima_volta": {
    state: new Date(ADESSO - 5 * 60000).toISOString(),
    attributes: { friendly_name: "Router Ultima volta visto", device_class: "timestamp" },
  },
  "sensor.router_uptime": {
    state: "unavailable",
    attributes: { friendly_name: "Router Uptime" },
  },
  /* Si chiama come il router ma non si legge: e' un comando. */
  "switch.router_wifi_ospiti": { state: "on", attributes: { friendly_name: "Router Wi-Fi ospiti" } },
  /* Si chiama in un altro modo, ma il nome dice di chi e'. */
  "sensor.ping_7": {
    state: "3",
    attributes: { friendly_name: "Router jitter", unit_of_measurement: "ms" },
  },
  /* Un altro apparecchio: non va proposto sotto il router. */
  "sensor.nas_latenza": {
    state: "2",
    attributes: { friendly_name: "NAS Latenza", unit_of_measurement: "ms" },
  },
};

const RIGA = {
  entity: "binary_sensor.router_online",
  name: "Router",
  icon: "router",
  famiglia: "rete",
  letture: ["sensor.router_latenza", "sensor.router_pacchetti_persi"],
};

test("le letture sono un campo della riga, e arrivano al salvataggio", () => {
  assert.ok(CAMPI_IN_PIU.includes("letture"), "senza stare qui le letture non si salvano");
  assert.ok(CAMPI_IN_PIU.includes("famiglia"), "la fascia resta un campo della riga");
  /* Il giro intero: si salva la riga, si scrive il documento come lo scrive
   * la memoria, si rilegge. Le letture tornano quelle che erano, nell'ordine
   * in cui sono state scelte. */
  const salvata = conLaRiga({}, -1, RIGA, CAMPI_IN_PIU);
  const riletta = righeDichiarate(JSON.parse(JSON.stringify(salvata)), CAMPI_IN_PIU);
  assert.deepEqual(riletta[0].letture, RIGA.letture);
  assert.equal(riletta[0].famiglia, "rete");
});

test("l'elenco delle letture si ripulisce come tutte le «Altre letture»", () => {
  assert.deepEqual(
    lettureDellaRiga({
      letture: [
        " sensor.router_latenza ",
        "sensor.router_latenza",
        "switch.router_wifi_ospiti",
        "",
        "sensor.router_uptime",
      ],
    }),
    ["sensor.router_latenza", "sensor.router_uptime"],
  );
  /* Scritte nella casella come le scrive la scheda: separate da virgole. */
  assert.deepEqual(lettureDellaRiga({ letture: "sensor.a, sensor.b" }), ["sensor.a", "sensor.b"]);
  assert.deepEqual(lettureDellaRiga({}), []);
  assert.deepEqual(lettureDellaRiga(null), []);
});

test("in pagina ogni lettura ha il suo nome corto e il valore con l'unita'", () => {
  const elenchi = macchineERete(STATI, {
    righe: [{ ...RIGA, letture: [...RIGA.letture, "sensor.router_uptime"] }],
  });
  const [router] = elenchi.rete;
  assert.equal(router.name, "Router");
  assert.deepEqual(router.letture, [
    "sensor.router_latenza",
    "sensor.router_pacchetti_persi",
    "sensor.router_uptime",
  ]);
  /* «Router Latenza» sotto «Router» e' «Latenza»: il nome della riga non si
   * ripete in ogni pastiglia. */
  assert.deepEqual(
    router.valori.map((voce) => voce.name),
    ["Latenza", "Pacchetti persi", "Uptime"],
  );
  assert.match(router.valori[0].testo, /^12[.,]4 ms$/);
  assert.equal(router.valori[1].testo, "0 %");
  /* Chi non risponde dice il trattino: uno zero sarebbe un uptime inventato. */
  assert.equal(router.valori[2].testo, "—");
  assert.equal(router.valori[2].available, false);
});

test("una riga senza letture resta com'era", () => {
  const elenchi = macchineERete(STATI, { righe: [{ ...RIGA, letture: undefined }] });
  assert.deepEqual(elenchi.rete[0].letture, []);
  assert.deepEqual(elenchi.rete[0].valori, []);
});

test("una data si dice per quanto e' lontana, non col suo anno", () => {
  const lettura = letturaDelDispositivo(
    "sensor.router_ultima_volta",
    RIGA,
    STATI,
    "it",
    ADESSO,
  );
  /* `parseFloat` di «2026-10-14T…» e' 2026: si leggeva «2.026». */
  assert.doesNotMatch(lettura.testo, /2[.,]?026/);
  assert.equal(lettura.testo, "5 min fa");
  assert.equal(lettura.istante, ADESSO - 5 * 60000);
  /* Senza la classe, una data con l'ora si riconosce lo stesso. */
  const senzaClasse = letturaDelDispositivo(
    "sensor.x",
    {},
    { "sensor.x": { state: new Date(ADESSO - 3 * 3600000).toISOString(), attributes: {} } },
    "it",
    ADESSO,
  );
  assert.equal(senzaClasse.testo, "3 h fa");
  /* Da quanto e' acceso, oltre la settimana, in giorni: 552 ore non si
   * leggono. Sotto la settimana restano le ore del filtro del robot. */
  assert.equal(durataLeggibile(1987200, "s", "it"), "23 giorni");
  assert.equal(durataLeggibile(3, "d", "it"), "72 h");
  assert.equal(durataLeggibile(8100, "min", "it"), "135 h");
  /* Non piu' cifre di quelle scritte dal sensore: «3.2» non e' «3,20». */
  assert.equal(
    letturaDelDispositivo(
      "sensor.l",
      {},
      { "sensor.l": { state: "3.2", attributes: { unit_of_measurement: "ms" } } },
      "it",
    ).testo,
    "3,2 ms",
  );
  /* Un numero resta un numero. */
  assert.equal(
    letturaDelDispositivo("sensor.n", {}, { "sensor.n": { state: "42", attributes: {} } }, "it")
      .testo,
    "42",
  );
});

test("si propongono i sensori accanto all'entita' della riga, e nient'altro", () => {
  const proposte = lettureProposteDellaMacchina({ ...RIGA, letture: [] }, STATI);
  /* Quelli che cominciano come l'entita' senza la coda «_online», e quello
   * che si chiama «Router …» anche se il suo id non lo dice. */
  for (const attesa of [
    "sensor.router_latenza",
    "sensor.router_pacchetti_persi",
    "sensor.router_ultima_volta",
    "sensor.router_uptime",
    "sensor.ping_7",
  ])
    assert.ok(proposte.includes(attesa), `${attesa} doveva essere proposta`);
  /* Non l'entita' stessa, non un comando, non il NAS. */
  assert.ok(!proposte.includes("binary_sensor.router_online"));
  assert.ok(!proposte.includes("switch.router_wifi_ospiti"));
  assert.ok(!proposte.includes("sensor.nas_latenza"));
  /* Quelle gia' scelte non si ripropongono. */
  const dopo = lettureProposteDellaMacchina(RIGA, STATI);
  assert.ok(!dopo.includes("sensor.router_latenza"));
  assert.ok(!dopo.includes("sensor.router_pacchetti_persi"));
  /* Una riga senza entita' e senza nome non ha niente accanto. */
  assert.deepEqual(lettureProposteDellaMacchina({}, STATI), []);
});
