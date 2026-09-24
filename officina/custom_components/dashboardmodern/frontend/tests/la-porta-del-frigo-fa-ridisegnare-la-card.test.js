/* «Lo stato della marcia funziona e cambia stato mentre quello delle porte
 * (correttamente funzionanti in home assistant) non viene rilevato.» «In
 * pratica se aggiungo due binary_sensor delle porte non rileva lo stato né
 * colora la card.» (#107)
 *
 * Due comportamenti diversi sulla stessa scheda, ed è quella differenza a dire
 * dove guardare: la lettura della porta è giusta — `applianceDoor` la legge, e
 * riaprendo la pagina la pastiglia c'è — ma la scheda non si rifà quando la
 * porta cambia. La sezione degli elettrodomestici non si ridisegna a ogni
 * respiro della casa (un misuratore di potenza manda stati in continuazione);
 * si ridisegna quando cambia un'entità che le schede mostrano, e l'elenco di
 * quelle entità era scritto a mano accanto a `stateChangeAffectsAppliances`.
 *
 * In quell'elenco c'erano l'interruttore, lo stato, la potenza e i contatori
 * dell'energia. Non la porta, non la temperatura, non il tempo che manca, non
 * l'anomalia; e nemmeno le letture, i comandi e le voci scelte in «Cosa
 * accende la card», che sono proprio quelle che uno aggiunge a mano e poi
 * guarda. `state_entity` invece c'era, ed è per questo che «la marcia funziona
 * e la porta no».
 *
 * Un elenco scritto a mano accanto a campi che legge qualcun altro si scolla
 * sempre. Qui si prova che adesso è uno solo — `entitaDellApparecchio` — e
 * soprattutto che non può più scollarsi: l'ultima prova rilegge i moduli della
 * scheda e pretende che ogni casella che loro guardano sia in quell'elenco.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

const { CASELLE_DELL_APPARECCHIO, entitaDellApparecchio, entitaDegliApparecchi } =
  await import("../src/core/le-entita-dellapparecchio.js");

const FRIGO = Object.freeze({
  id: "frigo",
  name: "Frigorifero",
  state_entity: "sensor.frigo_marcia",
  door_entity: "binary_sensor.frigo_porta",
  temperature_entity: "sensor.frigo_temperatura",
  temperature_entity_2: "sensor.freezer_temperatura",
  alert_entity: "binary_sensor.frigo_guasto",
  letture: "binary_sensor.freezer_porta,sensor.frigo_umidita",
  colorano: ["binary_sensor.freezer_porta"],
});

test("la porta del frigo è fra le entità che questa scheda guarda", () => {
  /* È il difetto di #107 in una riga: se la porta non è qui, il cambio di
   * stato della porta non fa ridisegnare niente. */
  assert.ok(entitaDellApparecchio(FRIGO).includes("binary_sensor.frigo_porta"));
});

test("e con lei tutto il resto che la scheda mostra e che si scordava", () => {
  const viste = entitaDellApparecchio(FRIGO);
  for (const entity of [
    "sensor.frigo_marcia",
    "sensor.frigo_temperatura",
    /* La seconda temperatura: frigo e congelatore sono due vani, e il secondo
     * numero si scordava esattamente come la porta. */
    "sensor.freezer_temperatura",
    "binary_sensor.frigo_guasto",
  ])
    assert.ok(viste.includes(entity), `manca ${entity}`);
});

test("anche le letture e le voci che accendono la card, che sono quelle scelte a mano", () => {
  const viste = entitaDellApparecchio(FRIGO);
  /* «né colora la card»: la seconda porta è una lettura, ed è scelta in «Cosa
   * accende la card». Accendersi senza far ridisegnare vuol dire una card che
   * si colora al prossimo cambio di qualcun altro — cioè a caso. */
  assert.ok(viste.includes("binary_sensor.freezer_porta"));
  assert.ok(viste.includes("sensor.frigo_umidita"));
  /* Una volta sola, anche se sta in due campi. */
  assert.equal(viste.filter((id) => id === "binary_sensor.freezer_porta").length, 1);
});

test("i comandi scelti a mano e le entità del dispositivo collegato", () => {
  const viste = entitaDellApparecchio({
    comandi: "switch.forno_luce,button.forno_avvia",
    entities: ["sensor.forno_potenza"],
    device_entities: [{ entity_id: "number.forno_gradi" }],
  });
  for (const entity of [
    "switch.forno_luce",
    "button.forno_avvia",
    "sensor.forno_potenza",
    "number.forno_gradi",
  ])
    assert.ok(viste.includes(entity), `manca ${entity}`);
});

test("una casella lasciata a metà non sveglia il ridisegno", () => {
  /* Senza il punto non è un'entità di Home Assistant. Una voce così
   * risponderebbe «sì» a ogni confronto sbagliato, e tanto varrebbe
   * ridisegnare sempre. */
  assert.deepEqual(entitaDellApparecchio({ power_entity: "sensor", door_entity: "  " }), []);
  assert.deepEqual(entitaDellApparecchio(), []);
  assert.deepEqual(entitaDellApparecchio(null), []);
});

test("un campo che porta l'oggetto invece dell'identificativo si legge lo stesso", () => {
  assert.deepEqual(entitaDellApparecchio({ door_entity: { entity: "binary_sensor.porta" } }), [
    "binary_sensor.porta",
  ]);
  assert.deepEqual(entitaDellApparecchio({ state_entity: { entity_id: "sensor.marcia" } }), [
    "sensor.marcia",
  ]);
});

test("gli apparecchi di casa insieme, senza ripetizioni", () => {
  const insieme = entitaDegliApparecchi([
    FRIGO,
    { door_entity: "binary_sensor.frigo_porta", state_entity: "sensor.lavatrice_marcia" },
  ]);
  assert.ok(insieme instanceof Set);
  assert.ok(insieme.has("binary_sensor.frigo_porta"));
  assert.ok(insieme.has("sensor.lavatrice_marcia"));
  assert.equal(entitaDegliApparecchi([]).size, 0);
  assert.equal(entitaDegliApparecchi(null).size, 0);
});

test("la sezione non tiene più un elenco suo", () => {
  const sezione = leggi("sections/appliances-section.js");
  assert.match(sezione, /entitaDegliApparecchi/);
  /* Il secondo elenco era proprio questo: le quattro righe che c'erano e le
   * altre che mancavano. Se torna, torna il difetto. */
  assert.ok(
    !/function applianceEntityIds\(\)[\s\S]{0,400}device\.control_entity/.test(sezione),
    "applianceEntityIds è tornata a elencare i campi a mano",
  );
});

test("ogni casella che la scheda legge sta nell'elenco: le due liste non si possono più scollare", () => {
  /* La prova che vale più di tutte le altre. Non guarda cosa fa il codice
   * oggi: rilegge i moduli che disegnano l'apparecchio, raccoglie ogni campo
   * di entità che vanno a leggere, e pretende di trovarlo nell'elenco. Una
   * casella nuova aggiunta domani solo di là fa fallire questa riga, invece di
   * diventare un'altra porta del frigo che non si aggiorna. */
  const MODULI = [
    "core/appliance-view-model.js",
    "core/appliance-card-view-model.js",
    "core/appliance-cycle-tracker.js",
    "core/appliance-program.js",
    "sections/appliance-showcase-section.js",
    "sections/appliance-detail-popup-section.js",
  ];
  /* Le caselle che tengono un elenco invece di una sola entità: le legge
   * `entitaDellApparecchio` per conto suo, con la regola di quel campo. */
  const ELENCHI = new Set(["entities", "device_entities", "letture", "comandi", "colorano"]);
  const dichiarate = new Set(CASELLE_DELL_APPARECCHIO);
  const mancanti = new Set();
  for (const modulo of MODULI) {
    const sorgente = leggi(modulo);
    /* `device.qualcosa_entity`, come lo scrivono i modelli… */
    for (const [, campo] of sorgente.matchAll(/\bdevice\.([a-z0-9_]*entity[a-z0-9_]*)\b/g))
      if (!dichiarate.has(campo) && !ELENCHI.has(campo)) mancanti.add(campo);
    /* …e i nomi passati a `candidates(device, [...])`, che sono caselle come
     * le altre anche se scritte fra virgolette. */
    for (const [, dentro] of sorgente.matchAll(/\bcandidates\(\s*device\s*,\s*\[([^\]]*)\]/g))
      for (const [, campo] of dentro.matchAll(/"([a-z0-9_]+)"/g))
        if (!dichiarate.has(campo) && !ELENCHI.has(campo)) mancanti.add(campo);
  }
  assert.deepEqual(
    [...mancanti].sort(),
    [],
    "queste caselle le legge la scheda e non le guarda il ridisegno",
  );
});
