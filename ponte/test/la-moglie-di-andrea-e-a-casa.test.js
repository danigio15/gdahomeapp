/* Chi e' in casa, per il ponte come per la plancia (Andrea, Premium).
 *
 * «È un paio di giorni che mi dà casa vuota anche quando mia moglie è a
 * casa. Così come non mi dà più le notifiche quando lei esce o rientra a
 * casa. Ho controllato nelle notifiche: è abilitata. Però il suo segnalino,
 * sia da browser che da app, è corretto quando è a casa e/o quando è fuori.»
 *
 * Il segnalino lo disegna la plancia con le persone della sua configurazione
 * (`cd_people`): l'entita' scelta li' — spesso il `device_tracker` del
 * telefono — e la regola di `chiEInCasa` (a casa, in una zona che si chiama
 * casa, sullo stesso Wi‑Fi). Il ponte guardava solo le `person.*`, e solo
 * «home». Adesso guarda le stesse persone con la stessa regola; e la scelta
 * «dimmi quando arriva» segue la persona anche quando Home Assistant la
 * rinomina.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Sentinella } from "../src/sentinella.js";
import { Dispositivi } from "../src/dispositivi.js";
import { Notifiche, vuoleLaVoce, impostazioniPulite } from "../src/notifiche.js";

const MINUTO = 60 * 1000;
const ORA = 60 * MINUTO;
const ANDREA = "a".repeat(32);
const GIULIA = "b".repeat(32);

const alle = (ore, minuti = 0) => new Date(2026, 10, 10, ore, minuti).getTime();

const stato = (entity_id, state, attributes = {}, fa = ORA, ora = alle(15)) => ({
  entity_id,
  state,
  attributes,
  last_changed: new Date(ora - fa).toISOString(),
});

/* La plancia di Andrea: lui con la sua persona, lei col telefono. */
const PLANCIA = {
  cd_people: JSON.stringify([
    { id: "andrea", name: "Andrea", entity: "person.andrea" },
    {
      id: "giulia",
      name: "Giulia",
      entity: "device_tracker.iphone_di_giulia",
      wifi: "sensor.iphone_di_giulia_ssid",
    },
  ]),
};

/* Le persone di Home Assistant: quella di Giulia non ha il telefono fra i suoi
 * tracker, e resta ferma a «fuori» da giorni. */
const casaDiAndrea = ({
  giulia = "home",
  personaGiulia = "not_home",
  andrea = "not_home",
} = {}) => [
  stato("person.andrea", andrea, { friendly_name: "Andrea", user_id: ANDREA }),
  stato(
    "person.giulia",
    personaGiulia,
    { friendly_name: "Giulia", user_id: GIULIA, device_trackers: [] },
    3 * 24 * ORA,
  ),
  stato("device_tracker.iphone_di_giulia", giulia, {
    friendly_name: "iPhone di Giulia",
    source_type: "gps",
  }),
  stato("sensor.iphone_di_giulia_ssid", giulia === "home" ? "CasaRossi" : "Not Connected"),
  stato("alarm_control_panel.casa", "disarmed", { friendly_name: "Antifurto" }),
  stato("binary_sensor.movimento_sala", "off", { device_class: "motion" }),
];

function unaSentinella(stati, valori = PLANCIA) {
  const orologio = { ora: alle(15) };
  const dette = [];
  const sentinella = new Sentinella({ adesso: () => orologio.ora, quando: (e) => dette.push(e) });
  sentinella.valori = () => valori;
  sentinella.carica(stati);
  return { sentinella, dette, orologio };
}

test("Giulia e' a casa col telefono: la casa non e' vuota, anche se la sua persona dice fuori", () => {
  const { sentinella, dette } = unaSentinella(casaDiAndrea());
  assert.equal(sentinella.casaVuota(), false);
  assert.equal(sentinella.aCasa(GIULIA), true, "si lega alla sua persona per nome");
  assert.equal(sentinella.aCasa(ANDREA), false);
  /* E il movimento in sala e' lei: niente «casa vuota». */
  sentinella.cambia(
    "binary_sensor.movimento_sala",
    stato("binary_sensor.movimento_sala", "on", { device_class: "motion" }, 0),
  );
  assert.equal(dette.filter((e) => e.tipo === "movimento").length, 0);
});

test("una zona che si chiama «Casa» e' casa, come per la plancia", () => {
  const { sentinella } = unaSentinella(
    casaDiAndrea({ giulia: "Casa" }),
    /* Senza plancia: le persone di Home Assistant e basta. */
    {},
  );
  assert.equal(sentinella.casaVuota(), true, "senza plancia la persona di lei dice fuori");
  const conLaZona = unaSentinella(
    [
      stato("person.andrea", "not_home", { friendly_name: "Andrea", user_id: ANDREA }),
      stato("person.giulia", "Casa", { friendly_name: "Giulia", user_id: GIULIA }),
    ],
    {},
  );
  assert.equal(conLaZona.sentinella.casaVuota(), false);
});

test("Giulia esce e rientra: l'arrivo e l'uscita sono di person.giulia, che il telefono ha scelto", () => {
  const { sentinella, dette } = unaSentinella(casaDiAndrea());
  const iphone = "device_tracker.iphone_di_giulia";
  sentinella.cambia(iphone, stato(iphone, "not_home", { friendly_name: "iPhone di Giulia" }, 0));
  const uscita = dette.find((e) => e.tipo === "arrivi");
  assert.ok(uscita, "l'uscita c'e'");
  assert.equal(uscita.persona, "person.giulia");
  assert.equal(uscita.parole.it.titolo.includes("Giulia"), true);
  /* Era l'ultima: la casa si e' svuotata, e si propone l'antifurto. */
  assert.ok(dette.some((e) => e.tipo === "uscito"));
  assert.equal(sentinella.casaVuota(), true);
  const imp = impostazioniPulite({ persone: ["person.giulia"] });
  assert.equal(vuoleLaVoce(imp, uscita), true);

  sentinella.cambia(iphone, stato(iphone, "home", { friendly_name: "iPhone di Giulia" }, 0));
  const arrivi = dette.filter((e) => e.tipo === "arrivi");
  assert.equal(arrivi.length, 2);
  assert.match(arrivi[1].chiave, /^arrivi:person\.giulia:su$/);
  assert.equal(sentinella.casaVuota(), false);
});

test("una persona senza telefono, o un riavvio: la casa non diventa vuota per sbaglio", () => {
  /* Una `person.*` che nessuno traccia resta `unknown`: non tiene la casa
   * piena, ma nemmeno la svuota. */
  const ospite = unaSentinella(
    [
      stato("person.andrea", "not_home", { friendly_name: "Andrea" }),
      stato("person.ospite", "unknown", { friendly_name: "Ospite" }),
    ],
    {},
  );
  assert.equal(ospite.sentinella.casaVuota(), true);
  /* Il riavvio di Home Assistant: le persone sono `unavailable`. Non si sa,
   * e il movimento non si dice come «casa vuota». */
  const riavvio = unaSentinella(
    casaDiAndrea({ giulia: "unavailable", personaGiulia: "unavailable", andrea: "unavailable" }),
  );
  assert.equal(riavvio.sentinella.casaVuota(), null);
  riavvio.sentinella.cambia(
    "binary_sensor.movimento_sala",
    stato("binary_sensor.movimento_sala", "on", { device_class: "motion" }, 0),
  );
  assert.equal(riavvio.dette.filter((e) => e.perche === "casa-vuota").length, 0);
  /* E quando tornano, nessuno «arriva»: erano gia' a casa. */
  riavvio.sentinella.cambia(
    "device_tracker.iphone_di_giulia",
    stato("device_tracker.iphone_di_giulia", "home", {}, 0),
  );
  assert.equal(riavvio.dette.filter((e) => e.tipo === "arrivi").length, 0);
});

test("la persona rinominata da Home Assistant: la scelta del telefono la segue, e chi non c'e' piu' si dice una volta", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "andrea-"));
  const orologio = { ora: alle(15) };
  const righe = [];
  try {
    const dispositivi = new Dispositivi({ cartella, adesso: () => orologio.ora });
    const a = dispositivi.abbina({ nome: "Telefono di Andrea", utente: ANDREA });
    const notifiche = new Notifiche({
      cartella,
      dispositivi,
      registro: {
        info: (r) => righe.push(r),
        attenzione: (r) => righe.push(r),
        errore: () => {},
        debug: () => {},
      },
      utenti: {
        elenco: async () => [{ id: ANDREA, nome: "Andrea", amministratore: true, attivo: true }],
        eVivo: async () => true,
      },
      casa: { chiedi: async () => [], ascolta: async () => () => {} },
      postino: { pronto: true, spingi: () => true, diIGettoni: () => {} },
      adesso: () => orologio.ora,
    });
    await notifiche.rispondi(
      { id: 1, type: "ponte/notifiche/registra", gettone: `gettone-${"x".repeat(24)}` },
      { dispositivo: a.dispositivo },
    );
    await notifiche.rispondi(
      {
        id: 2,
        type: "ponte/notifiche/imposta",
        impostazioni: { persone: ["person.giulia", "person.nonna"] },
      },
      { dispositivo: a.dispositivo },
    );
    /* Home Assistant ha rifatto la persona di Giulia: adesso e'
     * `person.giulia_2`. La nonna non c'e' piu'. */
    notifiche.sentinella.valori = () => ({});
    notifiche.sentinella.carica([
      stato("person.andrea", "not_home", { friendly_name: "Andrea", user_id: ANDREA }),
      stato("person.giulia_2", "home", { friendly_name: "Giulia", user_id: GIULIA }),
    ]);
    notifiche._lePersoneScelte();
    notifiche._lePersoneScelte();
    const imp = notifiche.impostazioniDi(a.dispositivo.id);
    assert.deepEqual(imp.persone, ["person.giulia_2", "person.nonna"]);
    assert.equal(
      righe.filter((r) => r.includes("person.nonna")).length,
      1,
      "chi non c'e' piu' si dice una volta sola",
    );
    /* E l'uscita di lei arriva a quel telefono. */
    const dette = [];
    notifiche.sentinella.quando = (e) => dette.push(e);
    notifiche.sentinella.cambia(
      "person.giulia_2",
      stato("person.giulia_2", "not_home", { friendly_name: "Giulia", user_id: GIULIA }, 0),
    );
    const uscita = dette.find((e) => e.tipo === "arrivi");
    assert.equal(uscita.persona, "person.giulia_2");
    assert.equal(vuoleLaVoce(imp, uscita), true);
    /* L'elenco che l'app mostra e' quello di adesso. */
    const detto = await notifiche.rispondi(
      { id: 3, type: "ponte/notifiche/stato" },
      { dispositivo: a.dispositivo },
    );
    assert.deepEqual(
      detto.result.persone.map((p) => p.id),
      ["person.andrea", "person.giulia_2"],
    );
    notifiche.ferma();
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});
