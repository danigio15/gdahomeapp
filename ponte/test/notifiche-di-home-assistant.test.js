/* Le notifiche delle automazioni di Home Assistant, anche in GdAHome.
 *
 * Una casa finta con due telefoni veri (`dispositivi.js`, con la loro chiave
 * del filo): le automazioni si trovano dalla configurazione, il telefono
 * giusto si trova da `notify.mobile_app_…` alla persona e al suo utente, e
 * quando Home Assistant chiama `notify` dentro un'automazione accesa la busta
 * parte, e si apre col testo che Home Assistant ha scritto.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Dispositivi } from "../src/dispositivi.js";
import { Notifiche } from "../src/notifiche.js";
import {
  PER_AUTOMAZIONE_ALL_ORA,
  aChiVa,
  notificheDellAutomazione,
  scriptChiamati,
  segniDi,
  senzaTemplate,
  telecameraDi,
} from "../src/notifiche-di-home-assistant.js";
import { apriLaSpinta } from "../src/spinta.js";

const MINUTO = 60 * 1000;
const UTENTE_A = "a".repeat(32);
const UTENTE_B = "b".repeat(32);
const mezzogiorno = () => new Date(2026, 9, 14, 12, 0, 0).getTime();
const mezzanotte = () => new Date(2026, 9, 14, 0, 30, 0).getTime();

/* ─── Trovarle ────────────────────────────────────────────────────────── */

test("le notifiche si trovano dentro scelte, se, parallele, ripetizioni e script", () => {
  const config = {
    alias: "Tante strade",
    triggers: [{ trigger: "state", entity_id: "binary_sensor.porta" }],
    actions: [
      { action: "light.turn_on", target: { entity_id: "light.ingresso" } },
      {
        choose: [
          {
            conditions: [],
            sequence: [{ action: "notify.mobile_app_pixel_8", data: { message: "Dalla scelta" } }],
          },
        ],
        default: [{ service: "notify.notify", data: { message: "Dal default" } }],
      },
      {
        if: [{ condition: "state", entity_id: "sun.sun", state: "below_horizon" }],
        then: [{ action: "notify.mobile_app_pixel_8", data: { message: "Dal then" } }],
        else: [
          {
            sequence: [
              {
                parallel: [
                  { action: "notify.mobile_app_iphone_15", data: { message: "Dal parallelo" } },
                  {
                    sequence: [{ repeat: { count: 2, sequence: [{ action: "script.avvisa" }] } }],
                  },
                ],
              },
            ],
          },
        ],
      },
      /* I comandi della Companion non sono notifiche. */
      { action: "notify.mobile_app_pixel_8", data: { message: "clear_notification" } },
      { action: "notify.mobile_app_pixel_8", data: { message: "TTS" } },
      { action: "notify.mobile_app_pixel_8", data: { message: "command_dnd" } },
      { action: "notify.persistent_notification", data: { message: "Nel campanello di HA" } },
      { action: "notify.gdahome", data: { message: "Nostra" } },
      { action: "script.turn_on", target: { entity_id: "script.dentro" } },
    ],
  };
  assert.deepEqual(scriptChiamati(config).sort(), ["script.avvisa", "script.dentro"]);
  const script = {
    "script.avvisa": {
      sequence: [
        {
          action: "notify.send_message",
          target: { entity_id: "notify.cucina" },
          data: { message: "Dallo script" },
        },
        /* Un livello solo: dentro uno script gli script non si seguono. */
        { action: "script.ancora" },
      ],
    },
    "script.dentro": {
      sequence: [
        { service: "notify.mobile_app_pixel_8", data: { title: "T", message: "Da turn_on" } },
      ],
    },
    "script.ancora": { sequence: [{ action: "notify.notify", data: { message: "Troppo giu'" } }] },
  };
  const trovate = notificheDellAutomazione(config, { scriptDi: (s) => script[s] ?? null });
  assert.deepEqual(
    trovate.map((n) => n.messaggio).sort(),
    [
      "Da turn_on",
      "Dal default",
      "Dal parallelo",
      "Dal then",
      "Dalla scelta",
      "Dallo script",
    ].sort(),
  );
  const dalloScript = trovate.find((n) => n.messaggio === "Dallo script");
  assert.equal(dalloScript.servizio, "notify.send_message");
  assert.deepEqual(dalloScript.bersagli, ["notify.cucina"]);
  /* Le chiavi vecchie al singolare valgono come le nuove. */
  assert.equal(
    notificheDellAutomazione({ action: [{ service: "notify.notify", data: { message: "x" } }] })
      .length,
    1,
  );
  assert.deepEqual(notificheDellAutomazione({ actions: [] }), []);
});

test("com'e' fatta: foto, tasti, urgente, testo che cambia", () => {
  assert.deepEqual(
    segniDi({
      titolo: "Allarme",
      messaggio: "Movimento alle {{ now().strftime('%H:%M') }}",
      data: {
        image: "/api/camera_proxy/camera.giardino",
        actions: [{ action: "DISINSERISCI", title: "Disinserisci" }],
        push: { "interruption-level": "critical" },
      },
    }),
    { conFoto: true, conTasti: true, urgente: true, testoCheCambia: true },
  );
  assert.deepEqual(segniDi({ titolo: "Lavatrice", messaggio: "Finita" }), {
    conFoto: false,
    conTasti: false,
    urgente: false,
    testoCheCambia: false,
  });
  assert.equal(segniDi({ data: { priority: "high" } }).urgente, true);
  assert.equal(segniDi({ data: { ttl: 0 } }).urgente, true);
  assert.equal(segniDi({ data: { channel: "alarm_stream" } }).urgente, true);
  assert.equal(
    telecameraDi({ image: "https://x/api/camera_proxy/camera.porta?token=1" }),
    "camera.porta",
  );
  assert.equal(telecameraDi({ entity_id: "camera.giardino" }), "camera.giardino");
  assert.equal(telecameraDi({ image: "/media/local/foto.jpg" }), null);
  assert.equal(
    senzaTemplate("Il bucato è pronto: {{ states('sensor.durata') }} {% if x %}ok{% endif %}"),
    "Il bucato è pronto: … ok",
  );
});

test("dal servizio al telefono: mobile_app → device_tracker → persona → utente", () => {
  const persone = [
    [
      "person.uno",
      { attributes: { user_id: UTENTE_A, device_trackers: ["device_tracker.pixel_8"] } },
    ],
    [
      "person.due",
      { attributes: { user_id: UTENTE_B, device_trackers: "device_tracker.iphone_15" } },
    ],
  ];
  assert.deepEqual(aChiVa("notify.mobile_app_pixel_8", persone), {
    tutti: false,
    utenti: [UTENTE_A],
    persone: ["person.uno"],
  });
  assert.deepEqual(aChiVa("notify.mobile_app_iphone_15", persone).utenti, [UTENTE_B]);
  assert.deepEqual(aChiVa("notify.mobile_app_tablet", persone), {
    tutti: false,
    utenti: [],
    persone: [],
  });
  assert.equal(aChiVa("notify.notify", persone).tutti, true);
  assert.equal(aChiVa("notify.telefoni_di_casa", persone).tutti, true);
});

/* ─── La casa ─────────────────────────────────────────────────────────── */

const AUTOMAZIONI = {
  "automation.lavatrice_finita": {
    id: "1700000000001",
    alias: "Lavatrice finita",
    triggers: [
      {
        trigger: "numeric_state",
        entity_id: "sensor.lavatrice_potenza",
        below: 5,
        for: { minutes: 3 },
      },
    ],
    actions: [
      {
        action: "notify.mobile_app_pixel_8",
        data: { title: "Lavatrice", message: "Il bucato è pronto: {{ states('sensor.durata') }}" },
      },
    ],
  },
  "automation.allarme_giardino": {
    id: "1700000000002",
    alias: "Allarme: movimento in giardino",
    triggers: [{ trigger: "state", entity_id: "binary_sensor.giardino", to: "on" }],
    actions: [
      {
        action: "notify.mobile_app_pixel_8",
        data: {
          title: "Allarme",
          message: "Movimento in giardino",
          data: {
            image: "/api/camera_proxy/camera.giardino",
            actions: [
              { action: "APRI_TELECAMERA", title: "Apri telecamera" },
              { action: "DISINSERISCI", title: "Disinserisci" },
              { action: "URI", title: "Apri", uri: "/lovelace/0" },
            ],
          },
        },
      },
    ],
  },
  "automation.batterie": {
    id: "1700000000003",
    alias: "Batterie dei sensori scariche",
    triggers: [{ trigger: "time", at: "09:00:00" }],
    actions: [
      {
        action: "notify.mobile_app_iphone_15",
        data: { message: "Sensore finestra bagno: batteria al 5%" },
      },
    ],
  },
  "automation.garage": {
    id: "1700000000004",
    alias: "Porta garage aperta da 10 minuti",
    triggers: [{ trigger: "state", entity_id: "cover.garage", to: "open", for: "00:10:00" }],
    actions: [{ action: "notify.notify", data: { message: "La porta del garage è aperta" } }],
  },
  "automation.luci": {
    id: "1700000000005",
    alias: "Luci al tramonto",
    triggers: [{ trigger: "sun", event: "sunset" }],
    actions: [{ action: "light.turn_on", target: { entity_id: "light.giardino" } }],
  },
};

function unaCasa({ adesso = mezzogiorno(), premium = true } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "notifiche-ha-"));
  const orologio = { ora: adesso };
  const dispositivi = new Dispositivi({ cartella, adesso: () => orologio.ora });
  const a = dispositivi.abbina({
    nome: "Pixel 8",
    utente: UTENTE_A,
    modello: "Pixel 8",
    proprietario: "Persona 1",
  });
  const b = dispositivi.abbina({
    nome: "iPhone 15",
    utente: UTENTE_B,
    modello: "iPhone 15",
    proprietario: "Persona 2",
  });
  const utenti = {
    elenco: async () => [
      { id: UTENTE_A, nome: "Persona 1", amministratore: false, attivo: true },
      { id: UTENTE_B, nome: "Persona 2", amministratore: false, attivo: true },
    ],
    eVivo: async () => true,
  };
  const spinte = [];
  const foto = [];
  const postino = {
    pronto: true,
    spingi: (spinta) => {
      spinte.push(spinta);
      return true;
    },
    mandaLaFoto: async (una) => {
      const id = String(foto.length + 1).padStart(32, "0");
      foto.push({ ...una, id });
      return id;
    },
    diIGettoni: () => {},
  };
  const chiamate = [];
  const ascolti = new Map();
  const casa = {
    chiedi: async (comando) => {
      chiamate.push(comando);
      if (comando.type === "automation/config") {
        const config = AUTOMAZIONI[comando.entity_id];
        if (!config) throw new Error("not_found");
        return { config };
      }
      return [];
    },
    ascolta: async (tipo, fai) => {
      ascolti.set(tipo, fai);
      return () => ascolti.delete(tipo);
    },
    immagine: async () => Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]),
  };
  const licenze = { attive: true, premium };
  const notifiche = new Notifiche({
    cartella,
    dispositivi,
    utenti,
    casa,
    commissioni: { telecamereChiuse: () => new Set() },
    postino,
    licenze,
    adesso: () => orologio.ora,
  });
  notifiche.sentinella.carica([
    {
      entity_id: "person.uno",
      state: "home",
      attributes: {
        friendly_name: "Persona 1",
        user_id: UTENTE_A,
        device_trackers: ["device_tracker.pixel_8"],
      },
    },
    {
      entity_id: "person.due",
      state: "home",
      attributes: {
        friendly_name: "Persona 2",
        user_id: UTENTE_B,
        device_trackers: ["device_tracker.iphone_15"],
      },
    },
    { entity_id: "camera.giardino", state: "idle", attributes: {} },
    ...Object.entries(AUTOMAZIONI).map(([entity_id, config]) => ({
      entity_id,
      state: "on",
      attributes: {
        id: config.id,
        friendly_name: config.alias,
        last_triggered: "2026-10-13T16:42:00Z",
      },
    })),
  ]);
  const ha = notifiche.daHomeAssistant;
  const chiedi = (chi, detto) =>
    notifiche.rispondi({ id: 1, ...detto }, { dispositivo: chi.dispositivo });
  const registra = (chi) =>
    chiedi(chi, {
      type: "ponte/notifiche/registra",
      gettone: `gettone-${chi.dispositivo.id}-${"x".repeat(20)}`,
    });
  const apri = (spinta) => {
    const chi = [a, b].find((uno) => uno.dispositivo.id === spinta.telefono);
    return apriLaSpinta({
      chiaveDelFilo: chi.chiave,
      telefono: chi.dispositivo.id,
      busta: spinta.busta,
    });
  };
  /* Home Assistant che fa correre un'automazione e chiama notify. */
  let numero = 0;
  const corre = async (entity, servizio, service_data) => {
    numero += 1;
    const contesto = { id: `ctx${numero}`, parent_id: null, user_id: null };
    ha.scattata({ data: { entity_id: entity, name: "x" }, context: contesto });
    return ha.chiamata({
      data: { domain: "notify", service: servizio, service_data },
      context: contesto,
    });
  };
  return {
    orologio,
    notifiche,
    ha,
    licenze,
    spinte,
    foto,
    chiamate,
    ascolti,
    a,
    b,
    chiedi,
    registra,
    apri,
    corre,
    spegni: () => {
      notifiche.ferma();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

const lavatrice = { title: "Lavatrice", message: "Il bucato è pronto: 1 h 52 min, 0,9 kWh" };

test("l'elenco di questo telefono: chi la riceve, i segni, e tutte spente", async () => {
  const casa = unaCasa();
  try {
    const risposta = await casa.chiedi(casa.a, { type: "ponte/notifiche/ha/elenco" });
    assert.equal(risposta.success, true);
    const { automazioni, telefoni, proponi, premium } = risposta.result;
    assert.equal(premium, true);
    assert.equal(proponi, true);
    /* Le luci al tramonto non avvisano nessuno: non ci sono. */
    assert.deepEqual(
      automazioni.map((r) => r.alias),
      [
        "Allarme: movimento in giardino",
        "Batterie dei sensori scariche",
        "Lavatrice finita",
        "Porta garage aperta da 10 minuti",
      ],
    );
    const per = (alias) => automazioni.find((r) => r.alias === alias);
    assert.equal(per("Lavatrice finita").bersaglio, "questo");
    assert.equal(per("Porta garage aperta da 10 minuti").bersaglio, "tutti");
    assert.equal(per("Batterie dei sensori scariche").bersaglio, "altro");
    assert.deepEqual(per("Batterie dei sensori scariche").telefoni, [casa.b.dispositivo.id]);
    /* Di serie spente, tutte. */
    assert.ok(
      automazioni.every((r) => r.acceso === false && r.silenzio === true && r.a === "questo"),
    );
    /* L'anteprima senza template, e il testo che cambia. */
    assert.equal(per("Lavatrice finita").anteprima.testo, "Il bucato è pronto: …");
    assert.equal(per("Lavatrice finita").testoCheCambia, true);
    assert.equal(per("Allarme: movimento in giardino").conFoto, true);
    assert.equal(per("Allarme: movimento in giardino").conTasti, true);
    assert.match(per("Lavatrice finita").quando.it, /^Quando /);
    assert.equal(per("Lavatrice finita").ultimaVolta, Date.parse("2026-10-13T16:42:00Z"));
    /* Il testo di quella che va al telefono di un altro non si vede. */
    assert.equal(per("Batterie dei sensori scariche").anteprima, undefined);
    /* I telefoni col nome che chi li usa ha scritto in GdAHome. */
    assert.deepEqual(
      telefoni.map((t) => [t.nome, t.modello, t.io]),
      [
        ["Persona 1", "Pixel 8", true],
        ["Persona 2", "iPhone 15", false],
      ],
    );
    /* Nessun nome di persona di Home Assistant nella risposta. */
    assert.ok(!JSON.stringify(risposta).includes("person."));
  } finally {
    casa.spegni();
  }
});

test("una notifica di un'automazione accesa arriva col testo di Home Assistant", async () => {
  const casa = unaCasa();
  try {
    await casa.registra(casa.a);
    await casa.registra(casa.b);
    await casa.ha.leggi();
    /* Spenta (com'e' di serie): niente. */
    assert.equal(
      await casa.corre("automation.lavatrice_finita", "mobile_app_pixel_8", lavatrice),
      0,
    );
    assert.equal(casa.spinte.length, 0);
    const accesa = await casa.chiedi(casa.a, {
      type: "ponte/notifiche/ha/imposta",
      voci: { 1700000000001: { acceso: true } },
    });
    assert.equal(accesa.success, true);
    assert.equal(accesa.result.automazioni.find((r) => r.chiave === "1700000000001").acceso, true);
    assert.equal(
      await casa.corre("automation.lavatrice_finita", "mobile_app_pixel_8", lavatrice),
      1,
    );
    const busta = casa.apri(casa.spinte.at(-1));
    assert.equal(casa.spinte.at(-1).telefono, casa.a.dispositivo.id);
    assert.equal(busta.tipo, "ha_notify");
    assert.equal(busta.cat, "homeassistant");
    assert.equal(busta.titolo, "Lavatrice");
    assert.equal(busta.testo, "Il bucato è pronto: 1 h 52 min, 0,9 kWh");
    assert.equal(busta.fonte, "Automazione di Home Assistant · Lavatrice finita");
    /* E l'ultimo testo vero si vede nell'elenco. */
    const elenco = await casa.chiedi(casa.a, { type: "ponte/notifiche/ha/elenco" });
    assert.equal(
      elenco.result.automazioni.find((r) => r.chiave === "1700000000001").ultimo.testo,
      lavatrice.message,
    );
    /* Una notify che non viene da un'automazione (lo sviluppatore, uno
     * script a mano) non si manda. */
    const prima = casa.spinte.length;
    await casa.ha.chiamata({
      data: { domain: "notify", service: "mobile_app_pixel_8", service_data: lavatrice },
      context: { id: "ctx-di-nessuno" },
    });
    assert.equal(casa.spinte.length, prima);
    /* Ne' un comando della Companion. */
    assert.equal(
      await casa.corre("automation.lavatrice_finita", "mobile_app_pixel_8", {
        message: "clear_notification",
      }),
      0,
    );
    /* Il titolo che manca e' il nome dell'automazione. */
    await casa.corre("automation.lavatrice_finita", "mobile_app_pixel_8", { message: "Fatto" });
    assert.equal(casa.apri(casa.spinte.at(-1)).titolo, "Lavatrice finita");
  } finally {
    casa.spegni();
  }
});

test("il contesto: anche una notify con l'automazione come genitore, e due uguali fanno una", async () => {
  const casa = unaCasa();
  try {
    await casa.registra(casa.a);
    await casa.ha.leggi();
    await casa.chiedi(casa.a, {
      type: "ponte/notifiche/ha/imposta",
      voci: { 1700000000004: { acceso: true } },
    });
    casa.ha.scattata({ data: { entity_id: "automation.garage" }, context: { id: "padre" } });
    const quanti = await casa.ha.chiamata({
      data: { domain: "notify", service: "notify", service_data: { message: "Garage aperto" } },
      context: { id: "figlio", parent_id: "padre" },
    });
    assert.equal(quanti, 1);
    /* Un'automazione che manda la stessa cosa a due servizi: una sola. */
    const di_nuovo = await casa.ha.chiamata({
      data: { domain: "notify", service: "notify", service_data: { message: "Garage aperto" } },
      context: { id: "figlio", parent_id: "padre" },
    });
    assert.equal(di_nuovo, 0);
    /* Dopo venti minuti il contesto non vale piu'. */
    casa.orologio.ora += 21 * MINUTO;
    assert.equal(
      await casa.ha.chiamata({
        data: { domain: "notify", service: "notify", service_data: { message: "Tardi" } },
        context: { id: "altro", parent_id: "padre" },
      }),
      0,
    );
  } finally {
    casa.spegni();
  }
});

test("Base: solo il testo, solo su questo telefono, solo quelle per lui", async () => {
  const casa = unaCasa({ premium: false });
  try {
    await casa.registra(casa.a);
    await casa.registra(casa.b);
    await casa.ha.leggi();
    /* Quella che va al telefono di un altro: Premium. */
    const altro = await casa.chiedi(casa.a, {
      type: "ponte/notifiche/ha/imposta",
      voci: { 1700000000003: { acceso: true } },
    });
    assert.equal(altro.success, false);
    assert.equal(altro.error.code, "premium-richiesto");
    /* Mandarla a tutti: Premium. */
    const tutti = await casa.chiedi(casa.a, {
      type: "ponte/notifiche/ha/imposta",
      voci: { 1700000000002: { acceso: true, a: "tutti" } },
    });
    assert.equal(tutti.error.code, "premium-richiesto");
    /* «Proponimi le nuove»: Premium. */
    const proponi = await casa.chiedi(casa.a, {
      type: "ponte/notifiche/ha/proponi",
      acceso: false,
    });
    assert.equal(proponi.error.code, "premium-richiesto");
    /* Tutte o nessuna: la buona insieme alla cattiva non passa. */
    const insieme = await casa.chiedi(casa.a, {
      type: "ponte/notifiche/ha/imposta",
      voci: { 1700000000001: { acceso: true }, 1700000000003: { acceso: true } },
    });
    assert.equal(insieme.success, false);
    const ok = await casa.chiedi(casa.a, {
      type: "ponte/notifiche/ha/imposta",
      voci: { 1700000000002: { acceso: true } },
    });
    assert.equal(ok.success, true);
    assert.equal(
      await casa.corre("automation.allarme_giardino", "mobile_app_pixel_8", {
        title: "Allarme",
        message: "Movimento in giardino alle 02:14",
        data: {
          image: "/api/camera_proxy/camera.giardino",
          actions: [{ action: "DISINSERISCI", title: "Disinserisci" }],
        },
      }),
      1,
    );
    const busta = casa.apri(casa.spinte.at(-1));
    assert.equal(busta.testo, "Movimento in giardino alle 02:14");
    /* Niente foto, niente tasti, niente telecamera. */
    assert.equal(casa.foto.length, 0);
    assert.equal(busta.foto, undefined);
    assert.deepEqual(busta.azioni, []);
    assert.equal(busta.stile, "s");
  } finally {
    casa.spegni();
  }
});

test("Premium: la foto, i tasti, e un tasto torna a Home Assistant", async () => {
  const casa = unaCasa();
  try {
    await casa.registra(casa.a);
    await casa.ha.leggi();
    await casa.chiedi(casa.a, {
      type: "ponte/notifiche/ha/imposta",
      voci: { 1700000000002: { acceso: true } },
    });
    await casa.corre("automation.allarme_giardino", "mobile_app_pixel_8", {
      title: "Allarme",
      message: "Movimento in giardino alle 02:14",
      data: {
        image: "/api/camera_proxy/camera.giardino",
        actions: [
          { action: "APRI_TELECAMERA", title: "Apri telecamera" },
          { action: "DISINSERISCI", title: "Disinserisci" },
          { action: "URI", title: "Apri", uri: "/lovelace/0" },
        ],
      },
    });
    const busta = casa.apri(casa.spinte.at(-1));
    assert.equal(casa.foto.length, 1);
    assert.equal(busta.foto.id, casa.foto[0].id);
    assert.equal(busta.camera, "camera.giardino");
    /* Il tasto «URI» apre una pagina sul telefono di Home Assistant: qui no. */
    assert.deepEqual(
      busta.azioni.map((t) => [t.id, t.etichetta]),
      [
        ["ha1", "Apri telecamera"],
        ["ha2", "Disinserisci"],
      ],
    );
    /* Il comando non sta nella busta: lo sa il ponte. */
    assert.ok(!JSON.stringify(busta).includes("DISINSERISCI"));
    const premuto = await casa.chiedi(casa.a, {
      type: "ponte/notifiche/azione",
      notifica: busta.id,
      azione: "ha2",
    });
    assert.equal(premuto.success, true);
    assert.deepEqual(casa.chiamate.at(-1), {
      type: "fire_event",
      event_type: "mobile_app_notification_action",
      event_data: { action: "DISINSERISCI" },
    });
    /* Una volta sola. */
    const ancora = await casa.chiedi(casa.a, {
      type: "ponte/notifiche/azione",
      notifica: busta.id,
      azione: "ha2",
    });
    assert.equal(ancora.success, false);
    /* E dal telefono di un altro no. */
    const dallAltro = await casa.chiedi(casa.b, {
      type: "ponte/notifiche/azione",
      notifica: busta.id,
      azione: "ha1",
    });
    assert.equal(dallAltro.success, false);
  } finally {
    casa.spegni();
  }
});

test("Premium: anche quella di un altro telefono, a un telefono scelto o a tutti", async () => {
  const casa = unaCasa();
  try {
    await casa.registra(casa.a);
    await casa.registra(casa.b);
    await casa.ha.leggi();
    const fatto = await casa.chiedi(casa.a, {
      type: "ponte/notifiche/ha/imposta",
      voci: { 1700000000003: { acceso: true } },
    });
    assert.equal(fatto.success, true);
    await casa.corre("automation.batterie", "mobile_app_iphone_15", {
      message: "Sensore finestra bagno: batteria al 5%",
    });
    assert.deepEqual(
      casa.spinte.map((s) => s.telefono),
      [casa.a.dispositivo.id],
    );
    /* A un telefono scelto. */
    await casa.chiedi(casa.a, {
      type: "ponte/notifiche/ha/imposta",
      voci: { 1700000000001: { acceso: true, a: casa.b.dispositivo.id } },
    });
    casa.spinte.length = 0;
    await casa.corre("automation.lavatrice_finita", "mobile_app_pixel_8", lavatrice);
    assert.deepEqual(
      casa.spinte.map((s) => s.telefono),
      [casa.b.dispositivo.id],
    );
    /* A tutti. */
    await casa.chiedi(casa.a, {
      type: "ponte/notifiche/ha/imposta",
      voci: { 1700000000001: { a: "tutti" } },
    });
    casa.spinte.length = 0;
    await casa.corre("automation.lavatrice_finita", "mobile_app_pixel_8", lavatrice);
    assert.deepEqual(
      casa.spinte.map((s) => s.telefono).sort(),
      [casa.a.dispositivo.id, casa.b.dispositivo.id].sort(),
    );
    /* Un telefono che non e' della casa: no. */
    const fuori = await casa.chiedi(casa.a, {
      type: "ponte/notifiche/ha/imposta",
      voci: { 1700000000001: { a: "dm_inventato" } },
    });
    assert.equal(fuori.error.code, "invalid_format");
  } finally {
    casa.spegni();
  }
});

test("le ore di silenzio: si rispettano di serie, e si possono saltare", async () => {
  const casa = unaCasa({ adesso: mezzanotte() });
  try {
    await casa.registra(casa.a);
    await casa.ha.leggi();
    await casa.chiedi(casa.a, {
      type: "ponte/notifiche/ha/imposta",
      voci: { 1700000000001: { acceso: true } },
    });
    assert.equal(
      await casa.corre("automation.lavatrice_finita", "mobile_app_pixel_8", lavatrice),
      0,
    );
    await casa.chiedi(casa.a, {
      type: "ponte/notifiche/ha/imposta",
      voci: { 1700000000001: { silenzio: false } },
    });
    assert.equal(
      await casa.corre("automation.lavatrice_finita", "mobile_app_pixel_8", lavatrice),
      1,
    );
    /* Un'urgente di Home Assistant passa anche col silenzio rispettato. */
    await casa.chiedi(casa.a, {
      type: "ponte/notifiche/ha/imposta",
      voci: { 1700000000002: { acceso: true } },
    });
    assert.equal(
      await casa.corre("automation.allarme_giardino", "mobile_app_pixel_8", {
        message: "Movimento",
        data: { push: { "interruption-level": "critical" } },
      }),
      1,
    );
    assert.equal(casa.apri(casa.spinte.at(-1)).urg, "urgente");
  } finally {
    casa.spegni();
  }
});

test("al piu' venti all'ora per automazione", async () => {
  const casa = unaCasa();
  try {
    await casa.registra(casa.a);
    await casa.ha.leggi();
    await casa.chiedi(casa.a, {
      type: "ponte/notifiche/ha/imposta",
      voci: { 1700000000004: { acceso: true } },
    });
    let arrivate = 0;
    for (let i = 0; i < PER_AUTOMAZIONE_ALL_ORA + 5; i += 1) {
      casa.orologio.ora += 1000;
      arrivate += await casa.corre("automation.garage", "notify", { message: `Garage ${i}` });
    }
    assert.equal(arrivate, PER_AUTOMAZIONE_ALL_ORA);
    casa.orologio.ora += 61 * MINUTO;
    assert.equal(await casa.corre("automation.garage", "notify", { message: "Dopo" }), 1);
  } finally {
    casa.spegni();
  }
});

test("«Proponimi le nuove»: una nuova si segna e si dice, e arriva spenta", async () => {
  const casa = unaCasa();
  try {
    await casa.registra(casa.a);
    await casa.chiedi(casa.a, { type: "ponte/notifiche/ha/elenco" });
    AUTOMAZIONI["automation.buongiorno"] = {
      id: "1700000000006",
      alias: "Buongiorno: meteo di oggi",
      triggers: [{ trigger: "time", at: "07:00:00" }],
      actions: [{ action: "notify.mobile_app_pixel_8", data: { message: "{{ meteo }}" } }],
    };
    casa.notifiche.sentinella.cambia("automation.buongiorno", {
      entity_id: "automation.buongiorno",
      state: "on",
      attributes: { id: "1700000000006", friendly_name: "Buongiorno: meteo di oggi" },
    });
    await casa.ha.leggi();
    const detta = casa.apri(casa.spinte.at(-1));
    assert.equal(detta.titolo, "Una nuova automazione manda notifiche");
    assert.match(detta.testo, /Buongiorno: meteo di oggi/);
    const elenco = await casa.chiedi(casa.a, { type: "ponte/notifiche/ha/elenco" });
    const nuova = elenco.result.automazioni.find((r) => r.chiave === "1700000000006");
    assert.equal(nuova.nuova, true);
    assert.equal(nuova.acceso, false);
    /* Spento «Proponimi», la prossima non si dice. */
    await casa.chiedi(casa.a, { type: "ponte/notifiche/ha/proponi", acceso: false });
    const prima = casa.spinte.length;
    AUTOMAZIONI["automation.altra"] = {
      id: "1700000000007",
      alias: "Un'altra",
      actions: [{ action: "notify.notify", data: { message: "x" } }],
    };
    casa.notifiche.sentinella.cambia("automation.altra", {
      entity_id: "automation.altra",
      state: "on",
      attributes: { id: "1700000000007", friendly_name: "Un'altra" },
    });
    await casa.ha.leggi();
    assert.equal(casa.spinte.length, prima);
  } finally {
    delete AUTOMAZIONI["automation.buongiorno"];
    delete AUTOMAZIONI["automation.altra"];
    casa.spegni();
  }
});

test("senza un utente sul filo non si vede niente, e si ascolta Home Assistant", async () => {
  const casa = unaCasa();
  try {
    const senza = casa.notifiche.daHomeAssistant;
    const risposta = await casa.notifiche.rispondi(
      { id: 1, type: "ponte/notifiche/ha/elenco" },
      { dispositivo: { id: "dm_x", utente: "" } },
    );
    assert.equal(risposta.error.code, "unauthorized");
    await senza._abbonati();
    assert.deepEqual([...casa.ascolti.keys()].sort(), [
      "automation_reloaded",
      "automation_triggered",
      "call_service",
    ]);
  } finally {
    casa.spegni();
  }
});
