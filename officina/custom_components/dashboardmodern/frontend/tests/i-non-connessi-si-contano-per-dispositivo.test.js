/* «Non devi mettere le entità ma i dispositivi non connessi, così come li
 * mostri nel cruscotto installatore.»
 *
 * Dal campo, con lo scatto della scheda: dentro c'erano «Asciugatrice Child
 * lock», «Boiler Child lock», «Condizionatori Child lock», «Lavastoviglie
 * Child lock» — cioè quattro elettrodomestici che rispondono benissimo, di
 * ognuno dei quali tace una sola entità. Quella serratura bambini
 * l'integrazione la pubblica sempre ed è `unavailable` quando la macchina non
 * sta lavorando: non è un dispositivo non connesso, è una entità che quando la
 * macchina è ferma non ha niente da dire.
 *
 * Quindi l'avviso diceva il vero su cose che non interessano, che è il modo
 * esatto in cui un avviso si impara a ignorare — e un avviso che si ignora è
 * peggio di nessun avviso. Nel cruscotto dell'installatore quei `child_lock`
 * non compaiono, perché il ponte la regola giusta ce l'ha da sempre
 * (`ponte/src/salute.js`): si raggruppa per dispositivo, e un dispositivo è giù
 * **solo se tacciono tutte le sue entità**.
 *
 * Qui si difende che la plancia faccia la stessa e non una somigliante: due
 * regole per la stessa domanda sono due verità, e il giorno che si scostano
 * nessuno sa quale guardare.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { chiNonRisponde, chiNonRispondePerDispositivo } from "../src/core/chi-non-risponde.js";
import {
  dispositiviDaiRegistri,
  dispositiviDalGuscio,
  nonSiSaNiente,
} from "../src/core/i-dispositivi-di-home-assistant.js";
import {
  iDispositiviScollegati,
  mettiDaParte,
  rimettiInElenco,
} from "../src/core/i-dispositivi-scollegati.js";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

const muta = (nome) => ({
  state: "unavailable",
  attributes: { friendly_name: nome },
  last_changed: "2026-09-20T08:00:00Z",
});
const viva = (nome, stato = "off") => ({
  state: stato,
  attributes: { friendly_name: nome },
  last_changed: "2026-09-22T20:00:00Z",
});

/* La casa dello scatto, in piccolo.
 *
 * L'asciugatrice ha la serratura bambini muta e il resto che parla: sta bene.
 * Il ripetitore del giardino tace tutto: quello è giù davvero. E c'è un
 * `input_boolean`, che un dispositivo non ce l'ha proprio. */
const STATI = {
  "lock.asciugatrice_child_lock": muta("Asciugatrice Child lock"),
  "sensor.asciugatrice_programma": viva("Asciugatrice Programma", "idle"),
  "switch.asciugatrice_avvio": viva("Asciugatrice Avvio"),
  "switch.presa_giardino": muta("Presa giardino"),
  "sensor.presa_giardino_potenza": muta("Presa giardino Potenza"),
  "input_boolean.vacanza": muta("Vacanza"),
};

const DI = {
  "lock.asciugatrice_child_lock": "asc1",
  "sensor.asciugatrice_programma": "asc1",
  "switch.asciugatrice_avvio": "asc1",
  "switch.presa_giardino": "giard1",
  "sensor.presa_giardino_potenza": "giard1",
};

const NOMI = { asc1: "Asciugatrice", giard1: "Presa giardino" };

const CONFIGURATE = [
  "lock.asciugatrice_child_lock",
  "switch.presa_giardino",
  "sensor.presa_giardino_potenza",
  "input_boolean.vacanza",
];

test("un dispositivo che parla da un'altra bocca non è un dispositivo giù", () => {
  const fuori = chiNonRispondePerDispositivo(CONFIGURATE, STATI, { di: DI, nomi: NOMI });
  const nomi = fuori.map((una) => una.nome);
  assert.ok(
    !nomi.includes("Asciugatrice Child lock"),
    "la serratura bambini muta non deve comparire: l'asciugatrice risponde",
  );
  assert.ok(!nomi.includes("Asciugatrice"), "e nemmeno l'asciugatrice stessa");
});

test("le entità che parlano si guardano in tutta la casa, non fra le configurate", () => {
  /* Dell'asciugatrice, qui dentro, è mappata SOLO la serratura bambini: a dire
   * che la macchina sta bene sono le altre due, che nella plancia non sono
   * configurate. Guardare le sole configurate rimetterebbe l'asciugatrice
   * nell'elenco — cioè proprio il caso che ha fatto nascere questa regola. */
  const soloLaSerratura = ["lock.asciugatrice_child_lock"];
  const fuori = chiNonRispondePerDispositivo(soloLaSerratura, STATI, { di: DI, nomi: NOMI });
  assert.deepEqual(fuori, []);
});

test("un dispositivo con tutte le entità mute è una riga sola, col suo nome", () => {
  const fuori = chiNonRispondePerDispositivo(CONFIGURATE, STATI, { di: DI, nomi: NOMI });
  const presa = fuori.find((una) => una.dispositivo === "giard1");
  assert.ok(presa, "la presa del giardino tace tutta: deve esserci");
  assert.equal(presa.nome, "Presa giardino");
  assert.deepEqual(presa.entita.sort(), [
    "sensor.presa_giardino_potenza",
    "switch.presa_giardino",
  ]);
  assert.equal(
    fuori.filter((una) => una.dispositivo === "giard1").length,
    1,
    "una riga sola, non una per entità",
  );
});

/* ── «68 dispositivi non connessi» (#111) ──────────────────────────────────
 *
 * «Dagli ultimi aggiornamenti ricevo allerta di 68 cose che non rispondono,
 * fanno parte di package esistenti, i sensori sono tipicamente input boolean,
 * datetime, automation, input Number, script ecc. Ma secondo me funzionano.»
 *
 * Qui sopra c'era la prova opposta — «un'entità senza dispositivo resta una
 * riga per conto suo» — e teneva in piedi esattamente quelle sessantotto
 * righe. Il raggruppamento per dispositivo era arrivato per togliere i
 * `child_lock`, e alle entità sciolte non aveva guardato: restavano una per
 * una, come prima. Cioè una regola SOMIGLIANTE a quella del cruscotto
 * installatore, non la stessa — e la stessa era proprio quello che era stato
 * chiesto.
 *
 * Un aiutante, un'automazione, uno script, un sensore template non hanno un
 * apparecchio dietro e non hanno una strada che possa cadere: non c'è niente
 * da andare a premere. Se stanno `unavailable` è configurazione da
 * correggere, che è l'altro guaio — quello che questo elenco tiene fuori fin
 * dalla prima riga. */

test("un'entità che un dispositivo non ce l'ha non è un dispositivo non connesso", () => {
  const fuori = chiNonRispondePerDispositivo(CONFIGURATE, STATI, { di: DI, nomi: NOMI });
  assert.ok(
    !fuori.some((una) => una.entity === "input_boolean.vacanza"),
    "un input_boolean muto non è un dispositivo non connesso",
  );
  /* E la presa del giardino, che un dispositivo ce l'ha e tace tutta, resta:
   * togliere il rumore non vuol dire togliere l'avviso. */
  assert.ok(fuori.some((una) => una.dispositivo === "giard1"));
});

test("gli aiutanti di una casa intera non riempiono più l'avviso", () => {
  /* La casa della segnalazione, in piccolo: un package di aiutanti muti e una
   * presa vera giù in mezzo. Prima erano cinque righe e la presa era l'ultima;
   * adesso è l'unica. */
  const stati = { ...STATI };
  const configurate = [...CONFIGURATE];
  for (const quale of [
    "input_boolean.vacanza",
    "input_datetime.sveglia",
    "input_number.soglia",
    "automation.luci_sera",
    "script.buonanotte",
  ]) {
    stati[quale] = muta(quale);
    if (!configurate.includes(quale)) configurate.push(quale);
  }
  const fuori = chiNonRispondePerDispositivo(configurate, stati, { di: DI, nomi: NOMI });
  assert.equal(fuori.length, 1, "una riga sola: la presa del giardino");
  assert.equal(fuori[0].dispositivo, "giard1");
});

test("la plancia e il cruscotto installatore contano la stessa popolazione", async () => {
  /* Due regole per la stessa domanda sono due verità, e il giorno che si
   * scostano nessuno sa quale guardare: il ponte guarda solo le entità che un
   * dispositivo ce l'hanno, e da qui in avanti anche la plancia. */
  const salute = await readFile(new URL("../../../../ponte/src/salute.js", ROOT), "utf8");
  assert.match(
    salute,
    /elenco\(stati\)\.filter\(\(uno\) => quali\.diChiE\(/,
    "se il ponte smette di contare solo le entità di un dispositivo, questa prova lo deve dire",
  );
});

test("senza le mappe si torna riga per riga, meno gli aiutanti (#111)", () => {
  /* Senza registro si torna riga per riga, come prima: raggruppare per un
   * dispositivo che non si sa quale sia vorrebbe dire inventarlo.
   *
   * Con una differenza, ed e' la #111: gli aiutanti restano fuori comunque.
   * Un `input_boolean` non ha bisogno di nessun registro per sapere che dietro
   * non ha niente da andare a premere, e in una casa senza registro erano
   * proprio loro a riempire l'elenco — sessantotto righe, con in mezzo la
   * presa del giardino che non la trovava piu' nessuno. */
  const senza = chiNonRispondePerDispositivo(CONFIGURATE, STATI, {});
  const prima = chiNonRisponde(CONFIGURATE, STATI);
  assert.deepEqual(
    senza.map((una) => una.entity),
    prima.map((una) => una.entity).filter((entity) => !entity.startsWith("input_boolean.")),
  );
  /* E quello che resta e' tutto roba con un apparecchio dietro. */
  assert.ok(senza.length > 0, "la presa muta del giardino deve restare");
});

test("il dispositivo è irraggiungibile da quando ha smesso l'ultima delle sue", () => {
  const stati = {
    ...STATI,
    "switch.presa_giardino": { ...muta("Presa giardino"), last_changed: "2026-09-20T08:00:00Z" },
    "sensor.presa_giardino_potenza": {
      ...muta("Presa giardino Potenza"),
      last_changed: "2026-09-21T09:00:00Z",
    },
  };
  const fuori = chiNonRispondePerDispositivo(CONFIGURATE, stati, { di: DI, nomi: NOMI });
  const presa = fuori.find((una) => una.dispositivo === "giard1");
  assert.equal(presa.da, Date.parse("2026-09-21T09:00:00Z"));
});

test("il cestino mette da parte tutte le entità di quel dispositivo", () => {
  const dopo = mettiDaParte([], ["switch.presa_giardino", "sensor.presa_giardino_potenza"]);
  assert.ok(dopo.includes("nonrisponde|switch.presa_giardino"));
  assert.ok(dopo.includes("nonrisponde|sensor.presa_giardino_potenza"));
  /* E una sola continua a valere, com'era scritto prima: le voci già nel
   * deposito non vanno migrate. */
  assert.deepEqual(mettiDaParte([], "switch.presa_giardino"), [
    "nonrisponde|switch.presa_giardino",
  ]);
});

test("messo da parte il dispositivo, dall'elenco sparisce del tutto", () => {
  const escluse = mettiDaParte([], ["switch.presa_giardino", "sensor.presa_giardino_potenza"]);
  const { adesso } = iDispositiviScollegati({
    configurate: CONFIGURATE,
    states: STATI,
    escluse,
    di: DI,
    nomi: NOMI,
  });
  assert.ok(!adesso.some((una) => una.dispositivo === "giard1"));
});

test("le due mappe si ricavano dai registri, e dalla forma compatta del guscio", () => {
  const dai = dispositiviDaiRegistri({
    dispositivi: [
      { id: "asc1", name: "Dryer", name_by_user: "Asciugatrice" },
      { id: "giard1", name: "Presa giardino" },
    ],
    entita: [
      { entity_id: "lock.asciugatrice_child_lock", device_id: "asc1" },
      { entity_id: "input_boolean.vacanza" },
    ],
  });
  /* Il nome che gli ha messo chi abita vince su quello di fabbrica: è quello
   * che uno riconosce. */
  assert.equal(dai.nomi.asc1, "Asciugatrice");
  assert.equal(dai.di["lock.asciugatrice_child_lock"], "asc1");
  assert.ok(
    !("input_boolean.vacanza" in dai.di),
    "un'entità senza dispositivo non entra: «non lo so» deve restare vuoto",
  );
  const dal = dispositiviDalGuscio({
    entReg: { "lock.asciugatrice_child_lock": { d: "asc1" } },
    devNames: { asc1: "Asciugatrice" },
  });
  assert.equal(dal.di["lock.asciugatrice_child_lock"], "asc1");
  assert.equal(dal.nomi.asc1, "Asciugatrice");
  assert.ok(nonSiSaNiente({ di: {}, nomi: {} }));
});

test("qui dentro non si prende la rete: è la porta che la #553 ha chiuso", async () => {
  const sorgente = await read("src/core/i-dispositivi-di-home-assistant.js");
  for (const proibito of ["fetch(", "XMLHttpRequest", "WebSocket", "callWS", "sendMessage"])
    assert.ok(!sorgente.includes(proibito), `${proibito} non deve stare in questo file`);
});

test("la scheda si chiama «Dispositivi non connessi», come la tessera in Home", async () => {
  const scheda = await read("src/sections/i-dispositivi-scollegati-section.js");
  assert.match(scheda, /t\("Dispositivi non connessi", "Disconnected devices"\)/);
  assert.doesNotMatch(scheda, /t\("Scollegati", "Disconnected"\)/);
});

test("la sezione e la tessera leggono le stesse due mappe", async () => {
  for (const quale of [
    "src/sections/i-dispositivi-scollegati-section.js",
    "src/sections/home-widgets-section.js",
  ]) {
    const sorgente = await read(quale);
    assert.match(sorgente, /iDispositiviRicordati\(\)/, `${quale} deve leggere le mappe`);
  }
});

test("chi ha i registri li lascia scritti, da tutt'e tre le parti", async () => {
  for (const quale of ["panel.js", "dashboard-card.js"]) {
    const sorgente = await read(quale);
    assert.match(sorgente, /ricordaIDispositiviDiHomeAssistant\(value\)/, quale);
  }
  /* E il guscio storico, che i registri se li tiene in `WIZ`. */
  const condiviso = await read("src/sections/shared.js");
  assert.match(condiviso, /ricordaIDispositivi\(dispositiviDalGuscio\(wiz\)\)/);
});

/* ── E il modo di tornare indietro ────────────────────────────────────────
 *
 * «Non vedo i dispositivi e non c'è nulla per poter inserire nuovamente i
 * dispositivi.»
 *
 * Il cestino era a senso unico per scelta, e lo diceva: «Dall'avviso non
 * tornano». Il ragionamento reggeva finché nessuno lo premeva per sbaglio o
 * per provare — e chi prova preme tutto. Dopo quattro tocchi la sezione è
 * vuota, l'avviso non arriva più, e non c'è nessun gesto che rimetta le cose
 * come stavano: l'unica strada era andare a mano dentro `cd_widgets.excluded`,
 * che è esattamente il posto dove chi abita non deve mai dover entrare.
 */

test("quello che il cestino ha tolto, il campanello lo rimette", () => {
  const escluse = mettiDaParte([], ["switch.presa_giardino", "sensor.presa_giardino_potenza"]);
  const dopo = rimettiInElenco(escluse, [
    "switch.presa_giardino",
    "sensor.presa_giardino_potenza",
  ]);
  assert.deepEqual(dopo, [], "l'elenco torna esattamente com'era");
  /* E il dispositivo torna nell'avviso, perché è ancora muto. */
  const { adesso } = iDispositiviScollegati({
    configurate: CONFIGURATE,
    states: STATI,
    escluse: dopo,
    di: DI,
    nomi: NOMI,
  });
  assert.ok(adesso.some((una) => una.dispositivo === "giard1"));
});

test("il campanello non lascia in piedi quello che lo renderebbe un tasto morto", () => {
  /* Una voce NUDA — senza il nome della tessera davanti — tiene un'entità
   * fuori da tutte le tessere, questa compresa: `escluseDellaTessera` la conta
   * per qualunque chiave. Lasciandola lì, il campanello sarebbe un tasto che
   * si preme e non succede niente, che è il modo peggiore di rispondere a «non
   * c'è nulla per rimetterli». Quindi se ne va anche quella. */
  const escluse = ["switch.presa_giardino", "nonrisponde|switch.presa_giardino"];
  assert.deepEqual(rimettiInElenco(escluse, "switch.presa_giardino"), []);

  /* Ma la scelta di un'ALTRA tessera resta dov'è: quella l'ha scritta un altro
   * interruttore, e questa sezione non parla per lui. */
  const altrove = ["porte|switch.presa_giardino", "nonrisponde|switch.presa_giardino"];
  assert.deepEqual(rimettiInElenco(altrove, "switch.presa_giardino"), [
    "porte|switch.presa_giardino",
  ]);
});

test("i messi da parte si contano per dispositivo, come quelli vivi", () => {
  const escluse = mettiDaParte([], ["switch.presa_giardino", "sensor.presa_giardino_potenza"]);
  const { messiDaParte } = iDispositiviScollegati({
    configurate: CONFIGURATE,
    states: STATI,
    escluse,
    di: DI,
    nomi: NOMI,
  });
  assert.equal(messiDaParte.length, 1, "una riga sola, non una per entità");
  const presa = messiDaParte[0];
  assert.equal(presa.nome, "Presa giardino");
  assert.equal(presa.dispositivo, "giard1");
  assert.deepEqual(presa.entita.sort(), [
    "sensor.presa_giardino_potenza",
    "switch.presa_giardino",
  ]);
  /* Il campanello di quella riga le riporta indietro tutte insieme: rimetterne
   * una sola vorrebbe dire ritrovarsi il dispositivo nell'avviso con dentro
   * mezze entità, e l'altra metà ancora zitta in fondo. */
  assert.deepEqual(rimettiInElenco(escluse, presa.entita), []);
});

test("senza le mappe i messi da parte restano riga per riga, com'erano", () => {
  const escluse = mettiDaParte([], ["switch.presa_giardino", "sensor.presa_giardino_potenza"]);
  const { messiDaParte } = iDispositiviScollegati({
    configurate: CONFIGURATE,
    states: STATI,
    escluse,
  });
  assert.equal(messiDaParte.length, 2);
  for (const una of messiDaParte) assert.deepEqual(una.entita, [una.entity]);
});

test("un'entità che questa casa non ha più si distingue, anche raggruppata", () => {
  const escluse = mettiDaParte([], ["switch.roba_vecchia"]);
  const { messiDaParte } = iDispositiviScollegati({
    configurate: CONFIGURATE,
    states: STATI,
    escluse,
    di: DI,
    nomi: NOMI,
  });
  assert.equal(messiDaParte.length, 1);
  assert.equal(messiDaParte[0].cE, false, "Home Assistant non ce l'ha: è configurazione vecchia");
});

test("la sezione ha il tasto che rimette, e non promette più l'irreparabile", async () => {
  const scheda = await read("src/sections/i-dispositivi-scollegati-section.js");
  assert.match(scheda, /data-dm-scollegati-torna=/, "ogni riga messa da parte ha il suo tasto");
  assert.match(scheda, /rimettiInElenco\(widgetPreferences\(\)\.excluded, entita\)/);
  assert.doesNotMatch(
    scheda,
    /Dall'avviso non tornano/,
    "quella frase adesso sarebbe falsa",
  );
  assert.doesNotMatch(
    scheda,
    /Non si torna indietro/,
    "e anche questa: indietro si torna",
  );
});

test("nell'avviso non si assegnano stanze: la tendina lì non ci va", async () => {
  /* Visto rendendo la scheda: la riga di un'entità sciolta — una che un
   * dispositivo non ce l'ha — si prendeva la scelta della stanza, perché
   * `room-assign-section` passa su ogni riga dell'editor e attacca la tendina
   * a quelle che nominano una sola entità. Le righe raggruppate per
   * dispositivo dicono «2 entità» e non ne nominavano nessuna, quindi la
   * tendina non gliela metteva: la stessa scheda con due facce.
   *
   * Questa scheda è un avviso, non un posto dove si configura: chiedere la
   * stanza accanto a un guasto è chiedere di sistemare una cosa che non
   * c'entra. L'eccezione è scritta accanto a quella delle persone, che una
   * stanza non ce l'hanno. */
  const stanze = await read("src/sections/room-assign-section.js");
  assert.match(
    stanze,
    /row\.matches\("\.dm-people-row, \.dm-scollegati-riga"\)\) continue;/,
    "le righe dei non connessi restano fuori",
  );
});

test("nella finestra non si legge né l'identificativo né la maniglia del dispositivo", async () => {
  /* Visto rendendo la finestra: sotto «Presa giardino» c'era scritto
   * `dispositivo:giard1`, che non è nemmeno un'entità — è la maniglia con cui
   * il raggruppamento tiene insieme le entità mute di quell'apparecchio.
   * Prima ci finiva l'identificativo, che è rimasto da quando ogni riga era
   * un'entità; in tutt'e due i casi è la stessa regola: «non voglio vedere il
   * nome entità». Gli identificativi stanno nelle schede della
   * configurazione, non nelle pagine. */
  const sorgente = await read("src/sections/home-widgets-section.js");
  const finestra = /function nonRispondeDetail\(widget\) \{[\s\S]*?\n\}/.exec(sorgente);
  assert.ok(finestra, "la finestra dei non connessi deve esserci");
  assert.doesNotMatch(finestra[0], /riga\.entity/, "l'identificativo non si stampa");
});

/* E senza il registro dei dispositivi la regola vale lo stesso (#111).
 *
 * «Dagli ultimi aggiornamenti ricevo allerta di 68 cose che non rispondono,
 * fanno parte di package esistenti, i sensori sono tipicamente input boolean,
 * datetime, automation, input Number, script ecc. Ma secondo me funzionano.»
 *
 * La regola c'era gia': chi non ha un apparecchio dietro non e' un dispositivo
 * non connesso. Ma la si applicava guardando il registro — se l'entita' non
 * sta li' dentro, fuori — e senza registro si tornava a contare riga per riga.
 * In una casa che il registro non ce l'ha (o non e' ancora arrivato) le
 * sessantotto righe tornavano tutte, con in mezzo la presa del giardino che
 * non la trovava piu' nessuno.
 *
 * Un `input_boolean` pero' non ha bisogno di nessun registro per sapere cos'e':
 * e' un aiutante scritto in un file, e dietro non c'e' niente da andare a
 * premere. Quei domini restano fuori comunque.
 */

test("senza registro, aiutanti e automazioni non sono «dispositivi non connessi»", async () => {
  const { chiNonRispondePerDispositivo } = await import("../src/core/chi-non-risponde.js");
  const stati = {
    "switch.presa_giardino": { state: "unavailable", last_changed: "2026-09-24T10:00:00Z" },
    "automation.luci_di_sera": { state: "unavailable" },
    "input_boolean.vacanza": { state: "unavailable" },
    "input_number.soglia": { state: "unavailable" },
    "script.buonanotte": { state: "unavailable" },
    "scene.cinema": { state: "unavailable" },
    "timer.lavatrice": { state: "unavailable" },
    "sensor.frigo_temperatura": { state: "unavailable" },
  };
  const detto = chiNonRispondePerDispositivo(Object.keys(stati), stati);
  assert.deepEqual(
    detto.map((una) => una.entity),
    ["sensor.frigo_temperatura", "switch.presa_giardino"],
    "restano solo le cose che un apparecchio dietro ce l'hanno",
  );
});

test("col registro non cambia niente: la regola è la stessa, detta una volta", async () => {
  const { chiNonRispondePerDispositivo } = await import("../src/core/chi-non-risponde.js");
  const stati = {
    "switch.presa_giardino": { state: "unavailable", last_changed: "2026-09-24T10:00:00Z" },
    "automation.luci_di_sera": { state: "unavailable" },
  };
  const detto = chiNonRispondePerDispositivo(Object.keys(stati), stati, {
    di: { "switch.presa_giardino": "dev-presa" },
    nomi: { "dev-presa": "Presa giardino" },
  });
  assert.deepEqual(
    detto.map((una) => una.nome),
    ["Presa giardino"],
  );
});

test("l'elenco dei domini senza apparecchio è dichiarato, non indovinato", async () => {
  const { SENZA_DISPOSITIVO, senzaDispositivo } = await import("../src/core/chi-non-risponde.js");
  assert.ok(SENZA_DISPOSITIVO.includes("automation"));
  assert.ok(SENZA_DISPOSITIVO.includes("input_boolean"));
  assert.ok(SENZA_DISPOSITIVO.includes("script"));
  /* E quelli che un apparecchio ce l'hanno non ci stanno dentro. */
  for (const dominio of ["switch", "sensor", "light", "climate", "camera", "lock"])
    assert.ok(!SENZA_DISPOSITIVO.includes(dominio), `${dominio} può avere un apparecchio dietro`);
  assert.equal(senzaDispositivo("script.buonanotte"), true);
  assert.equal(senzaDispositivo("switch.presa"), false);
  assert.equal(senzaDispositivo("senza_punto"), false);
});
