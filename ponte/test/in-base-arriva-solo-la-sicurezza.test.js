/* «Le notifiche sono solo per i Premium, non per tutti.»
 *
 * In GdAHome Base al telefono arrivano solo gli avvisi di sicurezza: fumo,
 * gas, allagamento, monossido, antifurto scattato e campanello. E la prova,
 * che in Base dice di provare quelli. Tutto il resto e' di Premium, da
 * qualunque strada arrivi: la sentinella, un messaggio dalla Home, le
 * automazioni di Home Assistant, le personalizzate, «aggiorna l'app».
 *
 * Dal campo, in una casa Base: «Movimento · Balcone — casa vuota · tocca per
 * vedere». Con Premium arriva tutto, come prima; quando il Premium finisce a
 * meta' strada la regola segue il Premium di adesso.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Dispositivi } from "../src/dispositivi.js";
import { AVVISI_DI_SICUREZZA, arrivaInBase, esempioDi, Notifiche } from "../src/notifiche.js";
import { apriLaSpinta } from "../src/spinta.js";

const MINUTO = 60 * 1000;
const UTENTE_A = "a".repeat(32);
const mezzogiorno = () => new Date(2026, 9, 14, 12, 0, 0).getTime();
const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
/* La sentinella consegna senza aspettare: si lascia finire il giro. */
const calma = () => new Promise((fatto) => setTimeout(fatto, 30));

function unBanco({ premium = false } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "in-base-"));
  const orologio = { ora: mezzogiorno() };
  const dispositivi = new Dispositivi({ cartella, adesso: () => orologio.ora });
  const a = dispositivi.abbina({ nome: "Telefono A", utente: UTENTE_A });
  const spinte = [];
  const postino = {
    pronto: true,
    spingi: (spinta) => {
      spinte.push(spinta);
      return true;
    },
    mandaLaFoto: async () => "foto-1",
    diIGettoni: () => {},
  };
  const licenze = { attive: true, premium };
  const notifiche = new Notifiche({
    cartella,
    dispositivi,
    utenti: {
      elenco: async () => [{ id: UTENTE_A, nome: "Persona 1", amministratore: true }],
      eVivo: async () => true,
    },
    casa: {
      chiedi: async () => [],
      ascolta: async () => () => {},
      immagine: async () => Buffer.from("jpeg"),
    },
    postino,
    licenze,
    adesso: () => orologio.ora,
  });
  const chiedi = (detto) => notifiche.rispondi({ id: 1, ...detto }, { dispositivo: a.dispositivo });
  const apri = (spinta) =>
    apriLaSpinta({ chiaveDelFilo: a.chiave, telefono: a.dispositivo.id, busta: spinta.busta });
  return {
    notifiche,
    licenze,
    orologio,
    spinte,
    chiedi,
    apri,
    titoli: () => spinte.map((una) => apri(una).titolo),
    spegni: () => {
      notifiche.ferma();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

/* Il telefono che le vuole tutte: ogni voce accesa, nessun silenzio, la
 * persona scelta per gli arrivi, il movimento sempre. */
async function vuoleTutto(banco) {
  await banco.chiedi({ type: "ponte/notifiche/registra", gettone: `g-${"x".repeat(30)}` });
  await banco.chiedi({
    type: "ponte/notifiche/imposta",
    impostazioni: {
      silenzio: { acceso: false },
      persone: ["person.uno"],
      su: { movimento: { quando: "sempre" } },
    },
  });
}

const SENSORI = [
  ["binary_sensor.fumo_cucina", "smoke", "Fumo"],
  ["binary_sensor.gas_caldaia", "gas", "Gas"],
  ["binary_sensor.perdita_bagno", "moisture", "Allagamento"],
  ["binary_sensor.co_garage", "carbon_monoxide", "Monossido di carbonio"],
];

/* La casa: i quattro sensori, l'antifurto inserito e il campanello. */
function laCasa(banco) {
  banco.notifiche.sentinella.carica([
    ...SENSORI.map(([id, classe]) => stato(id, "off", { device_class: classe, friendly_name: id })),
    stato("alarm_control_panel.casa", "armed_away", { friendly_name: "Casa" }),
    stato("event.campanello_ingresso", "2026-10-14T10:00:00Z", { device_class: "doorbell" }),
  ]);
}

/* Che succeda la sicurezza, dai sensori veri. */
async function succedeLaSicurezza(banco) {
  const sentinella = banco.notifiche.sentinella;
  for (const [id, classe] of SENSORI)
    sentinella.cambia(id, stato(id, "on", { device_class: classe, friendly_name: id }));
  sentinella.cambia(
    "alarm_control_panel.casa",
    stato("alarm_control_panel.casa", "triggered", { friendly_name: "Casa" }),
  );
  sentinella.cambia(
    "event.campanello_ingresso",
    stato("event.campanello_ingresso", "2026-10-14T12:00:00Z", { device_class: "doorbell" }),
  );
  await calma();
}

let numero = 0;
const unEvento = (tipo, extra = {}) => {
  numero += 1;
  return {
    tipo,
    urgenza: "normale",
    chiave: `${tipo}:${numero}`,
    pausa: 0,
    parole: { it: { titolo: `di ${tipo}`, testo: "x" }, en: { titolo: `of ${tipo}`, testo: "x" } },
    azioni: [],
    ...extra,
  };
};

const A_TAVOLA = { testo: "A tavola!", telefoni: true, persone: [], echo: [] };

/* Tutto quello che non e' sicurezza, da ogni strada. */
const IL_RESTO = () => [
  /* Il movimento del campo. */
  unEvento("movimento", {
    perche: "casa-vuota",
    camera: "camera.balcone",
    conFoto: true,
    parole: { it: { titolo: "Movimento · Balcone", testo: "casa vuota · tocca per vedere" } },
  }),
  unEvento("arrivi", { persona: "person.uno" }),
  unEvento("elettrodomestici"),
  unEvento("inserimenti"),
  unEvento("uscito"),
  unEvento("aperture"),
  unEvento("frigo"),
  unEvento("pioggia"),
  unEvento("animali"),
  unEvento("suggerimenti", { importante: true }),
  unEvento("blackout", { urgenza: "urgente" }),
  unEvento("riepilogo", { sempre: true }),
  unEvento("personalizzata"),
  unEvento("ha_notify"),
  unEvento("messaggio"),
  unEvento("aggiorna_app", { categoria: "manutenzione" }),
  unEvento("viaggi", { solo: [UTENTE_A] }),
];

test("la regola: gli avvisi di sicurezza, la prova di sempre, e le prove di quelli", () => {
  assert.deepEqual([...AVVISI_DI_SICUREZZA], ["antifurto", "allarmi", "campanello"]);
  for (const tipo of AVVISI_DI_SICUREZZA) {
    assert.equal(arrivaInBase({ tipo }), true, tipo);
    assert.equal(arrivaInBase(esempioDi(tipo, mezzogiorno())), true, `prova di ${tipo}`);
  }
  for (const evento of IL_RESTO()) assert.equal(arrivaInBase(evento), false, evento.tipo);
  assert.equal(arrivaInBase({ tipo: "prova" }), true, "la prova di sempre");
  for (const tipo of ["movimento", "blackout", "elettrodomestici", "riepilogo"])
    assert.equal(arrivaInBase(esempioDi(tipo, mezzogiorno())), false, `prova di ${tipo}`);
  assert.equal(arrivaInBase({ tipo: "prova", imita: "personalizzata" }), false);
  /* I viaggi col Premium di GdANav, che e' loro. */
  assert.equal(arrivaInBase({ tipo: "viaggi" }, { viaggi: true }), true);
  assert.equal(arrivaInBase({ tipo: "movimento" }, { viaggi: true }), false);
  assert.equal(arrivaInBase(null), false);
});

test("Base: fumo, gas, allagamento, monossido, antifurto e campanello arrivano", async () => {
  const banco = unBanco({ premium: false });
  try {
    await vuoleTutto(banco);
    laCasa(banco);
    await succedeLaSicurezza(banco);
    const titoli = banco.titoli();
    assert.equal(titoli.length, 6, titoli.join(" | "));
    for (const [, , parola] of SENSORI)
      assert.ok(
        titoli.some((t) => t.includes(parola)),
        `${parola}: ${titoli.join(" | ")}`,
      );
    assert.ok(
      titoli.some((t) => /antifurto/i.test(t)),
      titoli.join(" | "),
    );
    assert.ok(
      titoli.some((t) => /campanello/i.test(t)),
      titoli.join(" | "),
    );
    /* Semplici, come tutto in Base. */
    for (const spinta of banco.spinte) assert.equal(banco.apri(spinta).stile, "s");
  } finally {
    banco.spegni();
  }
});

test("Base: il movimento, gli arrivi, gli elettrodomestici, Home Assistant, i messaggi… no", async () => {
  const banco = unBanco({ premium: false });
  try {
    await vuoleTutto(banco);
    for (const evento of IL_RESTO())
      assert.equal(await banco.notifiche.consegna(evento), 0, evento.tipo);
    /* Anche a un telefono solo, come il riepilogo e chi aspettava. */
    const telefono = banco.notifiche.dispositivi.elenco()[0].id;
    for (const evento of IL_RESTO())
      assert.equal(
        await banco.notifiche.consegna(evento, { soloA: telefono }),
        0,
        `${evento.tipo} a un telefono solo`,
      );
    assert.equal(banco.spinte.length, 0, banco.titoli().join(" | "));
    /* Il messaggio dalla Home, dalla sua strada vera. */
    const detto = await banco.notifiche.mandaUnMessaggio(A_TAVOLA, "z".repeat(32));
    assert.equal(detto.success, true, JSON.stringify(detto));
    assert.equal(detto.result.telefoni, 0);
    assert.equal(banco.spinte.length, 0, banco.titoli().join(" | "));
  } finally {
    banco.spegni();
  }
});

test("Premium: arriva tutto, come prima", async () => {
  const banco = unBanco({ premium: true });
  try {
    await vuoleTutto(banco);
    laCasa(banco);
    await succedeLaSicurezza(banco);
    assert.equal(banco.spinte.length, 6, banco.titoli().join(" | "));
    for (const evento of IL_RESTO())
      assert.equal(await banco.notifiche.consegna(evento), 1, evento.tipo);
    const detto = await banco.notifiche.mandaUnMessaggio(A_TAVOLA, "z".repeat(32));
    assert.equal(detto.result.telefoni, 1);
  } finally {
    banco.spegni();
  }
});

test("il Premium che finisce a meta' strada: la regola segue quello di adesso", async () => {
  const banco = unBanco({ premium: true });
  try {
    await vuoleTutto(banco);
    const movimento = () => IL_RESTO()[0];
    assert.equal(await banco.notifiche.consegna(movimento()), 1);
    banco.licenze.premium = false;
    banco.orologio.ora += MINUTO;
    assert.equal(await banco.notifiche.consegna(movimento()), 0);
    assert.equal(await banco.notifiche.consegna(unEvento("campanello", { urgenza: "urgente" })), 1);
    /* La licenza revocata del tutto: lo stesso. */
    banco.licenze.premium = undefined;
    assert.equal(await banco.notifiche.consegna(movimento()), 0);
    banco.licenze.premium = true;
    assert.equal(await banco.notifiche.consegna(movimento()), 1);
  } finally {
    banco.spegni();
  }
});

test("la prova: in Base dice che prova gli avvisi di sicurezza, e solo quelli", async () => {
  const banco = unBanco({ premium: false });
  try {
    await vuoleTutto(banco);
    const prova = await banco.chiedi({ type: "ponte/notifiche/prova" });
    assert.equal(prova.success, true, JSON.stringify(prova));
    const detta = banco.apri(banco.spinte.at(-1));
    assert.equal(detta.titolo, "✅ Prova degli avvisi di sicurezza");
    assert.match(detta.testo, /fumo, gas, allagamento, antifurto scattato e campanello/);
    /* Le prove degli avvisi di sicurezza arrivano. */
    for (const tipo of AVVISI_DI_SICUREZZA) {
      const una = await banco.chiedi({ type: "ponte/notifiche/prova", tipo });
      assert.equal(una.success, true, `${tipo}: ${JSON.stringify(una)}`);
    }
    assert.equal(banco.spinte.length, 1 + AVVISI_DI_SICUREZZA.length);
    /* Il resto, nemmeno di prova: e l'app spiega il Premium. */
    for (const tipo of ["movimento", "arrivi", "elettrodomestici", "blackout"]) {
      const no = await banco.chiedi({ type: "ponte/notifiche/prova", tipo });
      assert.equal(no.error?.code, "premium-richiesto", tipo);
    }
    const personalizzata = await banco.chiedi({
      type: "ponte/notifiche/prova",
      regola: {
        entita: "sensor.freezer",
        condizione: "sopra",
        valore: "-10",
        titolo: "Freezer caldo",
      },
    });
    assert.equal(personalizzata.error?.code, "premium-richiesto");
    assert.equal(banco.spinte.length, 1 + AVVISI_DI_SICUREZZA.length);

    /* Con Premium la prova di sempre, e quella di ogni voce. */
    banco.licenze.premium = true;
    await banco.chiedi({ type: "ponte/notifiche/prova" });
    assert.equal(banco.apri(banco.spinte.at(-1)).titolo, "✅ Notifica di prova");
    const movimento = await banco.chiedi({ type: "ponte/notifiche/prova", tipo: "movimento" });
    assert.equal(movimento.success, true, JSON.stringify(movimento));
  } finally {
    banco.spegni();
  }
});

test("lo stato dice all'app se e' Premium, e se i viaggi arrivano", async () => {
  const banco = unBanco({ premium: false });
  try {
    let detto = await banco.chiedi({ type: "ponte/notifiche/stato" });
    assert.equal(detto.result.premium, false);
    assert.equal(detto.result.viaggi, false);
    banco.licenze.gdanav = true;
    detto = await banco.chiedi({ type: "ponte/notifiche/stato" });
    assert.equal(detto.result.viaggi, true);
    /* E i viaggi, col Premium di GdANav, arrivano anche in una casa Base. */
    await vuoleTutto(banco);
    assert.equal(await banco.notifiche.consegna(unEvento("viaggi", { solo: [UTENTE_A] })), 1);
  } finally {
    banco.spegni();
  }
});
