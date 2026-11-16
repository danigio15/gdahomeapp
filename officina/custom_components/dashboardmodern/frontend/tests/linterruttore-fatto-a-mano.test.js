/* «Vorrei che sia possibile creare entità personalizzata di tipo switch.
 * L'azione di uno switch se fosse possibile configurarla come fosse
 * un'entità ma come switch e assegnarla alla maschera che voglio come
 * facciamo per le entità personalizzate» (#406).
 *
 * Un interruttore fatto a mano vive fra «Le tue entità», con un campo in più:
 * all'accensione fa una cosa, allo spegnimento un'altra, e dice acceso
 * leggendo un'entità a scelta — o non legge niente, ed è un tasto. Queste
 * prove tengono le tre regole che contano: il tocco chiama i servizi scritti
 * nella voce e non quelli dell'entità che dice lo stato; i servizi passano
 * dalla stessa porta di «Chiama un servizio» delle automazioni; e una
 * serratura si apre solo col PIN della sua porta.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  TIPO_INTERRUTTORE,
  entitaDaGuardare,
  entitaMie,
  lettureDellaSezione,
  normalizzaVoce,
  servizioDellInterruttore,
  sezioniConEntita,
  toccoDellInterruttore,
} from "../src/core/entita-mie.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

/* Come lo scrive la scheda: piatto, campo per campo. */
const POMPA = {
  id: "int-pompa",
  tipo: "interruttore",
  nome: "Pompa giardino",
  icona: "💧",
  sezione: "energy",
  entity: "input_boolean.pompa",
  acceso_se: "on",
  accendi_servizio: "script.turn_on",
  accendi_entity: "script.pompa_accendi",
  accendi_dati: "",
  spegni_servizio: "script.turn_on",
  spegni_entity: "script.pompa_spegni",
  spegni_dati: "",
};

const SERA = {
  id: "int-sera",
  tipo: "interruttore",
  nome: "Sera",
  sezione: "energy",
  entity: "",
  accendi_servizio: "",
  accendi_entity: "scene.sera",
};

test("un interruttore è una voce anche senza entità, se sa cosa fare", () => {
  const voci = entitaMie([
    POMPA,
    SERA,
    /* Appena aggiunto, ancora vuoto: non c'è. */
    { id: "vuoto", tipo: "interruttore", sezione: "energy" },
    { entity: "sensor.temperatura", sezione: "energy" },
  ]);
  assert.deepEqual(
    voci.map((voce) => voce.id),
    ["int-pompa", "int-sera", "mia-4"],
  );
  assert.deepEqual(sezioniConEntita([POMPA, SERA]), ["energy"]);
  /* Si guarda l'entità che dice lo stato, e un tasto non ne aggiunge una vuota. */
  assert.deepEqual(entitaDaGuardare([POMPA, SERA]), ["input_boolean.pompa"]);
  const pompa = normalizzaVoce(POMPA);
  assert.equal(pompa.tipo, TIPO_INTERRUTTORE);
  assert.deepEqual(pompa.accendi, {
    servizio: "script.turn_on",
    entity: "script.pompa_accendi",
    dati: "",
  });
  /* Un interruttore non va in una stanza: lì la levetta sarebbe dell'entità. */
  assert.equal(normalizzaVoce({ ...POMPA, room_id: "cucina" }).room_id, "");
});

test("il tocco chiama i servizi della voce, secondo lo stato letto", () => {
  const spento = toccoDellInterruttore(normalizzaVoce(POMPA), {
    "input_boolean.pompa": { state: "off", attributes: {} },
  });
  assert.equal(spento.lettura.acceso, false);
  assert.equal(spento.lettura.verso, "accendi");
  assert.deepEqual(
    [spento.domain, spento.service, spento.data],
    ["script", "turn_on", { entity_id: "script.pompa_accendi" }],
  );

  const acceso = toccoDellInterruttore(normalizzaVoce(POMPA), {
    "input_boolean.pompa": { state: "on", attributes: {} },
  });
  assert.equal(acceso.lettura.acceso, true);
  assert.equal(acceso.lettura.verso, "spegni");
  assert.deepEqual(acceso.data, { entity_id: "script.pompa_spegni" });

  /* «Acceso» lo dice chi configura: qui una tapparella aperta. */
  const tenda = normalizzaVoce({ ...POMPA, entity: "cover.tenda", acceso_se: "open, opening" });
  assert.equal(
    toccoDellInterruttore(tenda, { "cover.tenda": { state: "opening" } }).lettura.acceso,
    true,
  );

  /* Senza spegnimento scritto, ogni tocco riaccende. */
  const soloAccende = normalizzaVoce({ ...POMPA, spegni_servizio: "", spegni_entity: "" });
  const tocco = toccoDellInterruttore(soloAccende, { "input_boolean.pompa": { state: "on" } });
  assert.equal(tocco.lettura.verso, "accendi");

  /* Chi dice lo stato e non risponde non è «spento». */
  const muto = toccoDellInterruttore(normalizzaVoce(POMPA), {});
  assert.equal(muto.lettura.muto, true);
  assert.equal(muto.lettura.acceso, false);
});

test("senza entità di stato è un tasto, e il verbo lo sa la plancia", () => {
  const tasto = toccoDellInterruttore(normalizzaVoce(SERA), {
    "scene.sera": { state: "scening", attributes: { friendly_name: "Scena sera" } },
  });
  assert.equal(tasto.lettura.impulso, true);
  assert.equal(tasto.lettura.muto, false);
  assert.deepEqual([tasto.domain, tasto.service], ["scene", "turn_on"]);

  const verbo = (entity, verso = "accendi") => {
    const fatto = servizioDellInterruttore({ entity }, verso);
    return `${fatto.domain}.${fatto.service}`;
  };
  assert.equal(verbo("script.irrigazione"), "script.turn_on");
  /* Un'automazione si esegue: «turn_on» la riabiliterebbe e basta. */
  assert.equal(verbo("automation.luci_sera"), "automation.trigger");
  assert.equal(verbo("button.portone"), "button.press");
  assert.equal(verbo("switch.presa"), "switch.turn_on");
  assert.equal(verbo("switch.presa", "spegni"), "switch.turn_off");
  /* Il nome, se nessuno l'ha scritto, è quello di Home Assistant. */
  const senzaNome = toccoDellInterruttore(normalizzaVoce({ ...SERA, nome: "" }), {
    "scene.sera": { state: "x", attributes: { friendly_name: "Scena sera" } },
  });
  assert.equal(senzaNome.lettura.nome, "Scena sera");
});

test("i servizi passano dalla stessa porta delle automazioni", () => {
  const no = (parte) => servizioDellInterruttore(parte).perche;
  /* Quello che «Chiama un servizio» non chiama, non lo chiama nemmeno un tasto. */
  assert.equal(no({ servizio: "shell_command.cancella" }), "chiuso");
  assert.equal(no({ servizio: "hassio.addon_stdin" }), "chiuso");
  assert.equal(no({ servizio: "homeassistant.restart" }), "chiuso");
  assert.equal(
    no({ servizio: "alarm_control_panel.alarm_disarm", entity: "alarm_control_panel.casa" }),
    "chiuso",
  );
  assert.equal(no({ servizio: "automation.reload" }), "chiuso");
  /* La strada lunga per aprire una serratura: `homeassistant.turn_off`. */
  assert.equal(no({ servizio: "homeassistant.turn_off", entity: "lock.portone" }), "chiuso");
  assert.equal(no({ servizio: "switch.turn_on", dati: '{"entity_id": "lock.portone"}' }), "chiuso");
  /* Aree, piani e dispositivi nasconderebbero cosa c'è dietro. */
  assert.equal(no({ servizio: "light.turn_on", dati: '{"area_id": "cucina"}' }), "bersaglio");
  assert.equal(no({ servizio: "light.turn_on", dati: "{non json" }), "dati");
  assert.equal(no({ servizio: "light.turn_on", entity: "Non Valida" }), "entita");
  assert.equal(no({ servizio: "questo non è un servizio" }), "servizio");
  assert.equal(no({}), "vuoto");

  /* Il resto passa, coi suoi dati. */
  const luce = servizioDellInterruttore({
    servizio: "light.turn_on",
    entity: "light.cucina, light.sala",
    dati: '{"brightness_pct": 40}',
  });
  assert.equal(luce.ok, true);
  assert.deepEqual(luce.data, { brightness_pct: 40, entity_id: ["light.cucina", "light.sala"] });
  const avviso = servizioDellInterruttore({
    servizio: "notify.mobile_app_telefono",
    dati: { message: "Pompa accesa" },
  });
  assert.equal(avviso.ok, true);
  assert.deepEqual(avviso.data, { message: "Pompa accesa" });
});

test("serrature e antifurto: conferma, e la serratura si apre solo col PIN", () => {
  const chiudi = servizioDellInterruttore({ servizio: "lock.lock", entity: "lock.portone" });
  assert.equal(chiudi.ok, true);
  assert.equal(chiudi.conferma, true);
  assert.equal(chiudi.pin, false);
  const inserisci = servizioDellInterruttore({
    servizio: "alarm_control_panel.alarm_arm_away",
    entity: "alarm_control_panel.casa",
  });
  assert.equal(inserisci.ok, true);
  assert.equal(inserisci.conferma, true);
  /* Aprire passa solo come richiesta di PIN, e una porta alla volta. */
  const apri = servizioDellInterruttore({ servizio: "lock.unlock", entity: "lock.portone" });
  assert.equal(apri.ok, true);
  assert.equal(apri.pin, true);
  assert.equal(
    servizioDellInterruttore({ servizio: "lock.unlock", entity: "lock.a, lock.b" }).perche,
    "serratura",
  );
  /* E chi disegna il PIN lo chiede davvero, col tastierino delle porte; senza
   * una porta col PIN la serratura non si apre. */
  const sezione = leggi("sections/entita-mie-section.js");
  assert.match(sezione, /portaColPinPerLAzione\(\s*configuredSecurityDoors\(\)/);
  assert.match(
    sezione,
    /if \(!porta \|\| !chiediIlPinDellaPorta\(porta, esegui\)\) return dilloNo\("serratura"\);/,
  );
  assert.match(sezione, /tocco\.conferma && typeof root\.confermaAzione === "function"/);
  /* E il divieto «si vede ma non si comanda» vale anche qui. */
  assert.match(sezione, /tocco\.entita\.some\(\(entity\) => !siComanda\(entity\)\)/);
});

test("in pagina esce insieme alle entità, con la levetta o col tasto", () => {
  const stati = { "input_boolean.pompa": { state: "on" } };
  const righe = lettureDellaSezione(
    [POMPA, SERA, { entity: "input_boolean.pompa", sezione: "energy", nome: "Lo stato" }],
    "energy",
    stati,
  );
  assert.deepEqual(
    righe.map((riga) => [riga.id, riga.tipo || "entita", riga.acceso, Boolean(riga.impulso)]),
    [
      ["int-pompa", "interruttore", true, false],
      ["int-sera", "interruttore", false, true],
      ["mia-3", "entita", true, false],
    ],
  );
  const sezione = leggi("sections/entita-mie-section.js");
  assert.match(sezione, /data-dm-mie-int="\$\{esc\(riga\.id\)\}"/);
  assert.match(sezione, /class="dm-mie-premi"/);
  /* Le stanze lo saltano: lì l'entità di stato uscirebbe con la levetta sua. */
  assert.match(
    leggi("sections/rooms-page-section.js"),
    /if \(voce\.tipo === TIPO_INTERRUTTORE\) continue;/,
  );
});

test("la scheda lo compila, e non salva un interruttore che non partirebbe", async () => {
  const editor = leggi("sections/entita-mie-editor-section.js");
  assert.match(editor, /data-mia-ent-add="\$\{TIPO_INTERRUTTORE\}"/);
  /* I campi piatti della voce, scritti dalla stessa riga delle entità. */
  for (const campo of [
    'data-mia-ent-campo="tipo"',
    'data-mia-ent-campo="${verso}_servizio"',
    "`${verso}_entity`,",
    'data-mia-ent-campo="${verso}_dati"',
    'data-mia-ent-campo="acceso_se"',
  ])
    assert.ok(editor.includes(campo), `manca ${campo}`);
  const { nonSiSalvaPerche } = await import("../src/sections/entita-mie-editor-section.js");
  assert.equal(nonSiSalvaPerche(POMPA), "");
  assert.equal(nonSiSalvaPerche(SERA), "");
  assert.equal(nonSiSalvaPerche({ ...POMPA, accendi_servizio: "shell_command.x" }), "chiuso");
  assert.equal(nonSiSalvaPerche({ ...POMPA, spegni_dati: "{rotto" }), "dati");
  assert.equal(nonSiSalvaPerche({ tipo: "interruttore" }), "vuoto");
  /* Un'entità resta un'entità: niente controlli da interruttore. */
  assert.equal(nonSiSalvaPerche({ entity: "sensor.x" }), "");
});
