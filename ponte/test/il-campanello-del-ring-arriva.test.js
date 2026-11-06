/* Il campanello del Ring arriva, sempre, a tutti e due i telefoni.
 *
 * Dal campo: «le notifiche del Ring, il citofono: prima arrivavano ogni
 * tanto, non sempre e con ritardo; adesso non arrivano piu' ne' sul tablet
 * ne' su iPhone». Le cause trovate, una prova per ognuna, con le entita' come
 * le fa l'integrazione Ring di Home Assistant oggi:
 *
 *  - `event.<nome>_ding`, classe «doorbell», `event_types: ["ring"]`, lo
 *    stato e' l'ora dell'ultima pressione («unknown» se non ha mai suonato);
 *  - `event.<nome>_motion`, classe «motion»;
 *  - la Intercom: `event.<nome>_ding` e `event.<nome>_intercom_unlock`
 *    (classe «button»), e `button.<nome>_open_door`;
 *  - le case di prima: `binary_sensor.<nome>_ding`.
 *
 * 1. Il tetto di trenta notifiche all'ora per telefono valeva anche per le
 *    urgenti: una casa con tante telecamere lo riempiva coi movimenti, e il
 *    campanello dopo si perdeva senza dirlo a nessuno.
 * 2. Il Citofono della plancia non suonava alla prima pressione di un evento
 *    mai suonato («unknown» → l'ora).
 * 3. L'apertura della Intercom suonava come un campanello, e un evento che
 *    tornava «unknown» anche.
 * 4. Lo stesso campanello da due entita' (il sensore di prima e l'evento)
 *    suonava due volte.
 * 5. Una scelta «in che ore» o «muta» rimasta scritta sul campanello — che
 *    l'app per le urgenti non mostra — lo zittiva.
 * 6. Il registro dell'add-on non diceva niente: adesso dice che il campanello
 *    e' arrivato, e a chi non e' partito e perche'.
 *
 * Il freno del centralino per le urgenti si prova in
 * `centralino/test/spinte.test.js`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Dispositivi } from "../src/dispositivi.js";
import { Notifiche } from "../src/notifiche.js";
import { Sentinella, suonaIlCitofono } from "../src/sentinella.js";
import { apriLaSpinta } from "../src/spinta.js";

const IPHONE = "a".repeat(32);
const TABLET = "b".repeat(32);
const mezzogiorno = () => new Date(2026, 10, 6, 12, 0, 0).getTime();

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
const ding = (id, state, extra = {}) =>
  stato(id, state, {
    device_class: "doorbell",
    event_types: ["ring"],
    event_type: state === "unknown" ? null : "ring",
    friendly_name: "Ingresso Ding",
    ...extra,
  });

/* Lascia correre le consegne che la sentinella fa partire senza aspettarle. */
const corri = async () => {
  for (let i = 0; i < 20; i += 1) await new Promise((fatto) => setImmediate(fatto));
};

function unaCasa({ stati = [], valori = {} } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "ring-"));
  const orologio = { ora: mezzogiorno() };
  const dispositivi = new Dispositivi({ cartella, adesso: () => orologio.ora });
  const iphone = dispositivi.abbina({ nome: "iPhone", utente: IPHONE });
  const tablet = dispositivi.abbina({ nome: "Tablet", utente: TABLET });
  const utenti = {
    elenco: async () => [
      { id: IPHONE, nome: "Persona 1", amministratore: true, attivo: true },
      { id: TABLET, nome: "Persona 2", amministratore: false, attivo: true },
    ],
    eVivo: async () => true,
  };
  const spinte = [];
  const postino = {
    pronto: true,
    spingi: (spinta) => {
      spinte.push(spinta);
      return true;
    },
    diIGettoni: () => {},
  };
  const righe = [];
  const registro = {
    info: (riga) => righe.push(riga),
    attenzione: (riga) => righe.push(riga),
    errore: (riga) => righe.push(riga),
    debug: () => {},
  };
  const notifiche = new Notifiche({
    cartella,
    dispositivi,
    utenti,
    postino,
    registro,
    configurazione: { leggi: () => ({ snapshot: { values: valori } }) },
    adesso: () => orologio.ora,
  });
  notifiche.sentinella.carica(stati);
  const chiave = (chi) => ({ iphone, tablet })[chi];
  const registra = (chi) =>
    notifiche.rispondi(
      {
        id: 1,
        type: "ponte/notifiche/registra",
        gettone: `gettone-${chiave(chi).dispositivo.id}-${"x".repeat(20)}`,
      },
      { dispositivo: chiave(chi).dispositivo },
    );
  const imposta = (chi, impostazioni) =>
    notifiche.rispondi(
      { id: 2, type: "ponte/notifiche/imposta", impostazioni },
      { dispositivo: chiave(chi).dispositivo },
    );
  const apri = (spinta) => {
    const chi = [iphone, tablet].find((uno) => uno.dispositivo.id === spinta.telefono);
    return apriLaSpinta({
      chiaveDelFilo: chi.chiave,
      telefono: spinta.telefono,
      busta: spinta.busta,
    });
  };
  const campanelli = () => spinte.map(apri).filter((c) => c.tipo === "campanello");
  return {
    notifiche,
    sentinella: notifiche.sentinella,
    orologio,
    iphone,
    tablet,
    spinte,
    righe,
    registra,
    imposta,
    apri,
    campanelli,
    spegni: () => {
      notifiche.ferma();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

test("trenta movimenti nell'ora, poi il campanello: arriva a tutti e due i telefoni", async () => {
  /* La casa vuota e trenta telecamere: ogni movimento e' una notifica. */
  const telecamere = Array.from({ length: 31 }, (_v, i) => `binary_sensor.telecamera_${i}_motion`);
  const casa = unaCasa({
    stati: [
      stato("person.uno", "not_home", { user_id: IPHONE }),
      ding("event.ingresso_ding", "2026-11-06T09:00:00.000+00:00"),
      ...telecamere.map((id) => stato(id, "off", { device_class: "motion" })),
    ],
  });
  try {
    await casa.registra("iphone");
    await casa.registra("tablet");
    for (const id of telecamere.slice(0, 30)) {
      casa.sentinella.cambia(id, stato(id, "on", { device_class: "motion" }));
      await corri();
    }
    assert.equal(casa.spinte.length, 60, "trenta movimenti a ognuno dei due telefoni");
    /* Il trentunesimo movimento resta fuori: il tetto c'e' ancora. */
    casa.sentinella.cambia(telecamere[30], stato(telecamere[30], "on", { device_class: "motion" }));
    await corri();
    assert.equal(casa.spinte.length, 60, "il tetto vale per il movimento");

    casa.sentinella.cambia(
      "event.ingresso_ding",
      ding("event.ingresso_ding", "2026-11-06T11:00:00.000+00:00"),
    );
    await corri();
    const suonati = casa.campanelli();
    assert.equal(suonati.length, 2, "il campanello passa il tetto, su tutti e due");
    assert.deepEqual(
      new Set(casa.spinte.slice(-2).map((s) => s.telefono)),
      new Set([casa.iphone.dispositivo.id, casa.tablet.dispositivo.id]),
    );
    assert.ok(casa.spinte.slice(-2).every((s) => s.urgente === true));
    assert.ok(suonati.every((c) => c.chiamata === true && c.urg === "urgente"));
    /* E conta fra le trenta: un movimento dopo resta fuori lo stesso. */
    assert.equal(casa.notifiche._cePosto(casa.iphone.dispositivo.id, { tipo: "movimento" }), false);
    /* Il registro dice che e' arrivato e a quanti e' partito. */
    assert.ok(casa.righe.includes("campanello da event.ingresso_ding: 2 dispositivi abbinati"));
    assert.ok(casa.righe.includes("campanello: partita a 2 telefoni"));
  } finally {
    casa.spegni();
  }
});

test("antifurto, allarmi e blackout passano il tetto anche loro", async () => {
  const casa = unaCasa();
  try {
    await casa.registra("iphone");
    const id = casa.iphone.dispositivo.id;
    for (let i = 0; i < 30; i += 1) assert.ok(casa.notifiche._cePosto(id, { tipo: "movimento" }));
    assert.equal(casa.notifiche._cePosto(id, { tipo: "elettrodomestici" }), false);
    for (const tipo of ["campanello", "antifurto", "allarmi", "blackout"])
      assert.equal(casa.notifiche._cePosto(id, { tipo }), true, tipo);
  } finally {
    casa.spegni();
  }
});

test("la prima pressione dopo «unknown» suona; tornare «unknown» o disponibile no", async () => {
  const casa = unaCasa({ stati: [ding("event.ingresso_ding", "unknown")] });
  try {
    await casa.registra("iphone");
    await casa.registra("tablet");
    const passa = async (valore) => {
      casa.sentinella.cambia("event.ingresso_ding", ding("event.ingresso_ding", valore));
      await corri();
    };
    await passa("2026-11-06T11:00:00.000+00:00");
    assert.equal(casa.campanelli().length, 2, "la prima pressione, su tutti e due");
    casa.orologio.ora += 60 * 1000;
    await passa("unknown");
    await passa("unavailable");
    await passa("2026-11-06T11:00:00.000+00:00");
    assert.equal(casa.campanelli().length, 2, "ne' «unknown» ne' il ritorno sono squilli");
    await passa("2026-11-06T11:01:00.000+00:00");
    assert.equal(casa.campanelli().length, 4, "la pressione dopo, una per telefono");
  } finally {
    casa.spegni();
  }
});

test("il Ring scelto nel Citofono suona alla prima pressione, col nome e la telecamera scelti", async () => {
  const casa = unaCasa({
    stati: [
      ding("event.ingresso_ding", "unknown"),
      stato("camera.ingresso", "idle"),
      stato("camera.giardino", "idle"),
      stato("button.ingresso_open_door", "unknown"),
    ],
    valori: {
      cd_citofono: JSON.stringify({
        citofoni: [
          {
            nome: "Portone",
            campanello: "event.ingresso_ding",
            telecamera: "camera.giardino",
            apri: "button.ingresso_open_door",
          },
        ],
      }),
    },
  });
  const dette = [];
  const quando = casa.sentinella.quando;
  casa.sentinella.quando = (evento) => {
    dette.push(evento);
    quando(evento);
  };
  try {
    await casa.registra("iphone");
    casa.sentinella.cambia(
      "event.ingresso_ding",
      ding("event.ingresso_ding", "2026-11-06T11:00:00.000+00:00"),
    );
    await corri();
    assert.equal(dette.length, 1);
    assert.equal(dette[0].tipo, "campanello");
    assert.equal(dette[0].camera, "camera.giardino", "la telecamera del Citofono");
    assert.equal(dette[0].parole.it.testo, "Portone · adesso", "il nome del Citofono");
    assert.deepEqual(dette[0].azioni[0].servizio, {
      dominio: "button",
      servizio: "press",
      entita: ["button.ingresso_open_door"],
    });
    assert.equal(casa.campanelli().length, 1);
  } finally {
    casa.spegni();
  }
});

test("suonaIlCitofono: un evento o un pulsante da «unknown» suona, un sensore no", () => {
  assert.equal(suonaIlCitofono("event", "unknown", "2026-11-06T11:00:00Z"), true);
  assert.equal(suonaIlCitofono("button", "unknown", "2026-11-06T11:00:00Z"), true);
  assert.equal(suonaIlCitofono("input_button", "unknown", "2026-11-06T11:00:00Z"), true);
  assert.equal(suonaIlCitofono("event", "2026-11-06T11:00:00Z", "unknown"), false);
  assert.equal(suonaIlCitofono("event", "unavailable", "2026-11-06T11:00:00Z"), false);
  assert.equal(suonaIlCitofono("event", undefined, "2026-11-06T11:00:00Z"), false);
  assert.equal(suonaIlCitofono("binary_sensor", "unknown", "on"), false);
  assert.equal(suonaIlCitofono("sensor", "unknown", "ring"), false);
});

test("la Intercom: il ding suona, l'apertura e il movimento no", () => {
  const dette = [];
  const sentinella = new Sentinella({ adesso: mezzogiorno, quando: (e) => dette.push(e) });
  const apertura = (state) =>
    stato("event.intercom_intercom_unlock", state, {
      device_class: "button",
      event_types: ["intercom_unlock"],
      event_type: state === "unknown" ? null : "intercom_unlock",
    });
  const movimento = (state) =>
    stato("event.campanello_motion", state, {
      device_class: "motion",
      event_types: ["motion"],
      event_type: "motion",
    });
  sentinella.carica([
    ding("event.intercom_ding", "unknown"),
    apertura("unknown"),
    movimento("2026-11-06T10:00:00Z"),
    stato("binary_sensor.campanello_motion", "off", { device_class: "motion" }),
    stato("binary_sensor.campanello_ding", "off", { device_class: "occupancy" }),
  ]);
  sentinella.cambia("event.intercom_intercom_unlock", apertura("2026-11-06T11:00:00Z"));
  sentinella.cambia("event.campanello_motion", movimento("2026-11-06T11:00:00Z"));
  sentinella.cambia(
    "binary_sensor.campanello_motion",
    stato("binary_sensor.campanello_motion", "on", { device_class: "motion" }),
  );
  assert.deepEqual(dette, [], "aprire la porta e muoversi non sono squilli");
  sentinella.cambia("event.intercom_ding", ding("event.intercom_ding", "2026-11-06T11:01:00Z"));
  assert.deepEqual(
    dette.map((e) => [e.tipo, e.entita]),
    [["campanello", "event.intercom_ding"]],
  );
});

test("il sensore di prima e l'evento dello stesso Ring: una notifica per telefono", async () => {
  const casa = unaCasa({
    stati: [
      stato("binary_sensor.ingresso_ding", "off", { device_class: "occupancy" }),
      ding("event.ingresso_ding", "2026-11-06T09:00:00.000+00:00"),
    ],
  });
  casa.sentinella.dispositivoDi = {
    "binary_sensor.ingresso_ding": "ring1",
    "event.ingresso_ding": "ring1",
  };
  try {
    await casa.registra("iphone");
    await casa.registra("tablet");
    casa.sentinella.cambia(
      "binary_sensor.ingresso_ding",
      stato("binary_sensor.ingresso_ding", "on", { device_class: "occupancy" }),
    );
    casa.sentinella.cambia(
      "event.ingresso_ding",
      ding("event.ingresso_ding", "2026-11-06T11:00:00.000+00:00"),
    );
    await corri();
    assert.equal(casa.campanelli().length, 2, "uno squillo, uno per telefono");
  } finally {
    casa.spegni();
  }
});

test("«in che ore» e «muta» rimasti scritti non zittiscono il campanello", async () => {
  const casa = unaCasa({ stati: [ding("event.ingresso_ding", "2026-11-06T09:00:00.000+00:00")] });
  try {
    await casa.registra("iphone");
    await casa.imposta("iphone", {
      su: { campanello: { orari: { dalle: "20:00", alle: "21:00" }, suono: "muta" } },
    });
    casa.sentinella.cambia(
      "event.ingresso_ding",
      ding("event.ingresso_ding", "2026-11-06T11:00:00.000+00:00"),
    );
    await corri();
    const [campanello] = casa.campanelli();
    assert.ok(campanello, "parte anche fuori dalle ore");
    assert.equal(campanello.suono, undefined, "e suona");
  } finally {
    casa.spegni();
  }
});

test("il registro dice a quale telefono il campanello non va, e perche'", async () => {
  const casa = unaCasa({ stati: [ding("event.ingresso_ding", "2026-11-06T09:00:00.000+00:00")] });
  try {
    await casa.registra("iphone");
    await casa.registra("tablet");
    await casa.imposta("tablet", { eventi: { campanello: false } });
    casa.sentinella.cambia(
      "event.ingresso_ding",
      ding("event.ingresso_ding", "2026-11-06T11:00:00.000+00:00"),
    );
    await corri();
    assert.equal(casa.campanelli().length, 1);
    const tablet = casa.tablet.dispositivo.id;
    assert.ok(
      casa.righe.includes(
        `campanello: non va a ${tablet} (voce «campanello» spenta (o non scelta) sul telefono)`,
      ),
      casa.righe.join("\n"),
    );
    assert.ok(casa.righe.includes("campanello: partita a 1 telefoni"));
    /* Di nuovo entro mezzo minuto: «gia' detta». */
    casa.orologio.ora += 5000;
    casa.sentinella.cambia(
      "event.ingresso_ding",
      ding("event.ingresso_ding", "2026-11-06T11:00:05.000+00:00"),
    );
    await corri();
    assert.ok(
      casa.righe.includes(`campanello: non va a ${casa.iphone.dispositivo.id} (gia' detta 5 s fa)`),
    );
    /* Niente gettoni ne' chiavi nel registro. */
    const tutto = casa.righe.join("\n");
    assert.ok(!tutto.includes("gettone-") && !tutto.includes(casa.iphone.chiave));
  } finally {
    casa.spegni();
  }
});
