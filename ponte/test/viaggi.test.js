/* I viaggi pianificati di gdanav, nella casa (`viaggi.js`).
 *
 * Quello che deve restare vero: un viaggio sta in piedi solo con una meta e
 * un'ora; ognuno vede e cambia i suoi; con «arrivo entro» la partenza tiene
 * conto della strada, e senza traffico ci mette il margine; l'avviso parte
 * una volta per volta, solo a chi l'ha fatto, anche nelle ore di silenzio;
 * il clima si accende prima; il garage non si apre mai da solo; senza
 * Premium la casa tiene i viaggi ma non fa niente. Con un'auto elettrica la
 * strada porta le soste di ricarica, quelle del navigatore prendono il posto
 * di quelle della casa, e la ricarica si conta nell'ora di partenza.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { INDIRIZZO_DELLE_COLONNINE } from "../src/colonnine.js";
import { Dispositivi } from "../src/dispositivi.js";
import { Notifiche } from "../src/notifiche.js";
import { apriLaSpinta } from "../src/spinta.js";
import { chilometriDellaLinea, puntoAlKm } from "../src/soste.js";
import {
  autoDelViaggio,
  civicoScritto,
  durataDelViaggio,
  MARGINE_SENZA_TRAFFICO,
  prossimaVolta,
  sostePulite,
  Viaggi,
  viaggioPulito,
} from "../src/viaggi.js";

const MINUTO = 60_000;
/* Venerdi' 16 ottobre 2026, alle 7:00 della casa. */
const ALLE_SETTE = new Date(2026, 9, 16, 7, 0, 0).getTime();

const caserta = { nome: "Caserta", lat: 41.07, lon: 14.33 };

const unViaggio = (piu = {}) => ({
  tipo: "una",
  tappe: [caserta],
  quando: { modo: "arrivo", ora: "09:00", giorno: "2026-10-16" },
  ...piu,
});

function casaFinta() {
  const chiesti = [];
  return {
    chiesti,
    async chiedi(cosa) {
      chiesti.push(cosa);
      if (cosa.type === "get_config") return { latitude: 40.85, longitude: 14.26 };
      return null;
    },
  };
}

function notificheFinte() {
  const consegnate = [];
  return {
    consegnate,
    async consegna(evento) {
      consegnate.push(evento);
      return 1;
    },
  };
}

function nuovi({ adesso = ALLE_SETTE, sbloccato = true } = {}) {
  let ora = adesso;
  const casa = casaFinta();
  const notifiche = notificheFinte();
  const viaggi = new Viaggi({
    casa,
    notifiche,
    licenze: { attive: true, gdanav: sbloccato },
    adesso: () => ora,
    ogni: () => null,
  });
  return { viaggi, casa, notifiche, vai: (ms) => (ora = ms) };
}

test("un viaggio sta in piedi solo con una meta, un'ora e un giorno buoni", () => {
  assert.equal(viaggioPulito(unViaggio({ tappe: [] })), null);
  assert.equal(viaggioPulito(unViaggio({ quando: { ora: "25:00", giorno: "2026-10-16" } })), null);
  assert.equal(viaggioPulito(unViaggio({ quando: { ora: "09:00", giorno: "domani" } })), null);
  assert.equal(
    viaggioPulito({ tipo: "settimana", tappe: [caserta], quando: { ora: "08:30", giorni: [] } }),
    null,
  );
  const buono = viaggioPulito(unViaggio({ tappe: [caserta, caserta] }));
  assert.equal(buono.tappe.length, 1, "una meta sola se non e' a tappe");
  assert.equal(buono.avviso.minuti, 10);
  /* Il garage solo se e' una copertura, e il clima solo se e' un'entita'. */
  const preparato = viaggioPulito(
    unViaggio({
      prepara: { clima: { entity: "climate.auto" }, garage: { entity: "switch.garage" } },
    }),
  );
  assert.deepEqual(preparato.prepara.clima, { entity: "climate.auto", minuti: 10 });
  assert.equal(preparato.prepara.garage, null);
});

test("arrivo entro: la partenza toglie la strada, col margine se manca il traffico", () => {
  const v = {
    ...viaggioPulito(unViaggio()),
    stima: { durataS: 40 * 60, fonte: "strada", alle: ALLE_SETTE },
  };
  assert.equal(durataDelViaggio(v, ALLE_SETTE), Math.round(40 * MINUTO * MARGINE_SENZA_TRAFFICO));
  const volta = prossimaVolta(v, ALLE_SETTE);
  assert.equal(volta.arrivo, new Date(2026, 9, 16, 9, 0).getTime());
  assert.equal(volta.partenza, volta.arrivo - Math.round(40 * MINUTO * MARGINE_SENZA_TRAFFICO));
  /* Col traffico fresco del navigatore, niente margine. */
  const colTraffico = { ...v, stima: { durataS: 48 * 60, fonte: "traffico", alle: ALLE_SETTE } };
  assert.equal(prossimaVolta(colTraffico, ALLE_SETTE).partenza, volta.arrivo - 48 * MINUTO);
  /* Passato da piu' di un'ora: non c'e' piu' una prossima volta. */
  assert.equal(prossimaVolta(v, new Date(2026, 9, 16, 11, 0).getTime()), null);
});

test("ogni settimana: il prossimo giorno scelto, anche dopo il fine settimana", () => {
  const v = viaggioPulito({
    tipo: "settimana",
    tappe: [caserta],
    quando: { modo: "partenza", ora: "08:00", giorni: [1, 2, 3, 4, 5] },
  });
  /* Sabato 17 alle 9: il prossimo e' lunedi' 19. */
  const sabato = new Date(2026, 9, 17, 9, 0).getTime();
  assert.equal(prossimaVolta(v, sabato).giorno, "2026-10-19");
  /* Venerdi' alle 9: le 8 sono passate, il prossimo e' lunedi'. */
  assert.equal(prossimaVolta(v, new Date(2026, 9, 16, 9, 0).getTime()).giorno, "2026-10-19");
  /* Venerdi' alle 7: e' oggi. */
  assert.equal(prossimaVolta(v, ALLE_SETTE).giorno, "2026-10-16");
});

test("ognuno vede e cambia solo i suoi viaggi", () => {
  const { viaggi } = nuovi();
  const { viaggio } = viaggi.salva("persona_2", unViaggio());
  assert.ok(viaggio.id);
  viaggi.salva("persona_7", unViaggio({ nome: "Altro" }));
  assert.equal(viaggi.elenco("persona_2").viaggi.length, 1);
  assert.equal(viaggi.elenco("persona_7").viaggi.length, 1);
  assert.deepEqual(viaggi.salva("persona_7", { ...unViaggio(), id: viaggio.id }), {
    errore: "non-trovato",
  });
  assert.deepEqual(viaggi.togli("persona_7", viaggio.id), { errore: "non-trovato" });
  assert.deepEqual(viaggi.togli("persona_2", viaggio.id), { tolto: viaggio.id });
  assert.equal(viaggi.elenco("persona_2").viaggi.length, 0);
});

test("la stima del navigatore resta; cambiata la meta, si butta", () => {
  const { viaggi } = nuovi();
  const { viaggio } = viaggi.salva("persona_2", unViaggio());
  const conStima = viaggi.stima("persona_2", viaggio.id, {
    durataS: 2880,
    km: 41.3,
    fonte: "traffico",
  }).viaggio;
  assert.equal(conStima.stima.fonte, "traffico");
  const stessa = viaggi.salva("persona_2", {
    ...unViaggio({ nome: "Ufficio" }),
    id: viaggio.id,
  }).viaggio;
  assert.equal(stessa.stima.durataS, 2880);
  const altra = viaggi.salva("persona_2", {
    ...unViaggio({ tappe: [{ nome: "Salerno", lat: 40.68, lon: 14.77 }] }),
    id: viaggio.id,
  }).viaggio;
  assert.equal(altra.stima, null);
});

test("l'avviso parte una volta, solo a chi l'ha fatto, e passa il silenzio", async () => {
  const { viaggi, notifiche, vai } = nuovi();
  const { viaggio } = viaggi.salva("persona_2", unViaggio());
  viaggi.stima("persona_2", viaggio.id, { durataS: 48 * 60, fonte: "traffico" });
  const partenza = new Date(2026, 9, 16, 8, 12).getTime();
  vai(partenza - 11 * MINUTO);
  await viaggi.battito();
  assert.equal(notifiche.consegnate.length, 0, "non ancora");
  vai(partenza - 10 * MINUTO);
  await viaggi.battito();
  await viaggi.battito();
  assert.equal(notifiche.consegnate.length, 1, "una volta sola");
  const [avviso] = notifiche.consegnate;
  assert.equal(avviso.tipo, "viaggi");
  assert.deepEqual(avviso.solo, ["persona_2"]);
  assert.equal(avviso.oltreIlSilenzio, true);
  assert.equal(avviso.parole.it.titolo, "Parti fra 10 minuti");
  assert.match(avviso.parole.it.testo, /Caserta: arrivo entro le 09:00/);
  assert.deepEqual(avviso.azioni, [], "senza garage, nessun tasto");
});

test("il clima si accende prima; il garage e' solo un tasto nell'avviso", async () => {
  const { viaggi, notifiche, casa, vai } = nuovi();
  const { viaggio } = viaggi.salva(
    "persona_2",
    unViaggio({
      quando: { modo: "partenza", ora: "08:00", giorno: "2026-10-16" },
      prepara: {
        clima: { entity: "climate.auto", minuti: 15 },
        garage: { entity: "cover.garage" },
      },
    }),
  );
  assert.ok(viaggio);
  vai(new Date(2026, 9, 16, 7, 45).getTime());
  await viaggi.battito();
  const accesi = casa.chiesti.filter((c) => c.type === "call_service");
  assert.deepEqual(accesi, [
    {
      type: "call_service",
      domain: "homeassistant",
      service: "turn_on",
      service_data: { entity_id: "climate.auto" },
    },
  ]);
  assert.ok(!casa.chiesti.some((c) => c.domain === "cover"), "il garage non si apre da solo");
  vai(new Date(2026, 9, 16, 7, 50).getTime());
  await viaggi.battito();
  const [avviso] = notifiche.consegnate;
  assert.equal(avviso.azioni[0].id, "garage");
  assert.deepEqual(avviso.azioni[0].servizio, {
    dominio: "cover",
    servizio: "open_cover",
    entita: ["cover.garage"],
  });
});

test("«Apri il garage» dall'avviso vero: premuto, apre il garage", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "viaggi-garage-"));
  const orologio = { ora: new Date(2026, 9, 16, 7, 40).getTime() };
  const dispositivi = new Dispositivi({ cartella, adesso: () => orologio.ora });
  const UTENTE = "a".repeat(32);
  const a = dispositivi.abbina({ nome: "Telefono A", utente: UTENTE });
  const spinte = [];
  const chiamate = [];
  const notifiche = new Notifiche({
    cartella,
    dispositivi,
    utenti: {
      elenco: async () => [{ id: UTENTE, nome: "Persona 1", amministratore: true, attivo: true }],
      eVivo: async () => true,
    },
    casa: {
      chiedi: async (comando) => {
        chiamate.push(comando);
        return [];
      },
      ascolta: async () => () => {},
    },
    commissioni: { telecamereChiuse: () => new Set() },
    postino: {
      pronto: true,
      spingi: (spinta) => {
        spinte.push(spinta);
        return true;
      },
      diIGettoni: () => {},
    },
    adesso: () => orologio.ora,
  });
  const viaggi = new Viaggi({
    notifiche,
    casa: { chiedi: async () => null },
    adesso: () => orologio.ora,
    licenze: null,
    ogni: () => null,
  });
  try {
    await notifiche.rispondi(
      { id: 1, type: "ponte/notifiche/registra", gettone: `gettone-${"x".repeat(30)}` },
      { dispositivo: a.dispositivo },
    );
    const { viaggio } = viaggi.salva(
      UTENTE,
      unViaggio({
        quando: { modo: "partenza", ora: "08:00", giorno: "2026-10-16" },
        prepara: { garage: { entity: "cover.garage" } },
      }),
    );
    orologio.ora = new Date(2026, 9, 16, 7, 50).getTime();
    await viaggi.battito();
    assert.equal(spinte.length, 1, "l'avviso e' partito");
    const busta = apriLaSpinta({
      chiaveDelFilo: a.chiave,
      telefono: a.dispositivo.id,
      busta: spinte[0].busta,
    });
    assert.equal(busta.tipo, "viaggi");
    assert.deepEqual(
      busta.azioni.map((t) => [t.id, t.etichetta]),
      [["garage", "Apri il garage"]],
    );
    assert.ok(!chiamate.some((c) => c.domain === "cover"), "non si apre da solo");
    const premuto = await notifiche.rispondi(
      { id: 2, type: "ponte/notifiche/azione", notifica: busta.id, azione: "garage" },
      { dispositivo: a.dispositivo, utente: UTENTE },
    );
    assert.equal(premuto.success, true, JSON.stringify(premuto.error));
    assert.deepEqual(chiamate.at(-1), {
      type: "call_service",
      domain: "cover",
      service: "open_cover",
      target: { entity_id: ["cover.garage"] },
    });
    assert.ok(viaggio);
  } finally {
    viaggi.ferma();
    notifiche.ferma();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("senza Premium i viaggi restano, ma non si salvano di nuovi e non si avvisa", async () => {
  const { viaggi, notifiche } = nuovi({ sbloccato: false });
  assert.deepEqual(viaggi.salva("persona_2", unViaggio()), { errore: "premium-richiesto" });
  assert.equal(viaggi.elenco("persona_2").sbloccato, false);
  await viaggi.battito();
  assert.equal(notifiche.consegnate.length, 0);
});

test("i viaggi di una volta passati da un giorno si tolgono da soli", async () => {
  const { viaggi, vai } = nuovi();
  viaggi.salva("persona_2", unViaggio());
  vai(new Date(2026, 9, 18, 9, 0).getTime());
  await viaggi.battito();
  assert.equal(viaggi.archivio.dati.viaggi.length, 0);
});

test("sul filo: ognuno coi suoi, e i comandi che non ci sono dicono di no", async () => {
  const { viaggi } = nuovi();
  const salvato = await viaggi.rispondi(
    { id: 1, type: "ponte/viaggi/salva", viaggio: unViaggio() },
    { utente: "persona_2" },
  );
  assert.equal(salvato.success, true);
  const elenco = await viaggi.rispondi(
    { id: 2, type: "ponte/viaggi/elenco" },
    { utente: "persona_2" },
  );
  assert.equal(elenco.result.viaggi.length, 1);
  const altro = await viaggi.rispondi(
    { id: 3, type: "ponte/viaggi/elenco" },
    { utente: "persona_7" },
  );
  assert.equal(altro.result.viaggi.length, 0);
  const cattivo = await viaggi.rispondi(
    { id: 4, type: "ponte/viaggi/salva", viaggio: { tipo: "una" } },
    { utente: "persona_2" },
  );
  assert.equal(cattivo.success, false);
  assert.equal(cattivo.error.code, "viaggio-non-valido");
  const ignoto = await viaggi.rispondi(
    { id: 5, type: "ponte/viaggi/vola" },
    { utente: "persona_2" },
  );
  assert.equal(ignoto.error.code, "unknown_command");
});

test("cerca e strada: Photon e OSRM, vicino a casa, e niente se non rispondono", async () => {
  const chiesti = [];
  const viaggi = new Viaggi({
    casa: casaFinta(),
    licenze: { attive: false },
    ogni: () => null,
    scarica: async (indirizzo) => {
      chiesti.push(indirizzo);
      if (indirizzo.includes("photon"))
        return {
          ok: true,
          json: async () => ({
            features: [
              {
                properties: { name: "Piazza Dante", city: "Caserta" },
                geometry: { coordinates: [14.33, 41.07] },
              },
            ],
          }),
        };
      return {
        ok: true,
        json: async () => ({
          routes: [
            { duration: 2340.4, distance: 41320, geometry: { coordinates: [[14.26, 40.85]] } },
          ],
        }),
      };
    },
  });
  const { posti } = await viaggi.cerca("piazza dante caserta");
  assert.equal(posti[0].nome, "Piazza Dante · Caserta");
  assert.match(chiesti[0], /lat=40\.85/);
  const { stima, da } = await viaggi.strada(null, [caserta]);
  assert.deepEqual(stima, { durataS: 2340, km: 41.3, fonte: "strada" });
  assert.equal(da.nome, "Casa");
  const muta = new Viaggi({
    licenze: { attive: false },
    ogni: () => null,
    scarica: async () => {
      throw new Error("rete");
    },
  });
  /* Nessuna delle due risponde: si dice, perche' la pagina lo dica. */
  assert.deepEqual(await muta.cerca("piazza dante"), { posti: [], guasto: true });
});

test("cerca: se Photon non risponde, chiede a Nominatim", async () => {
  const chiesti = [];
  const viaggi = new Viaggi({
    casa: casaFinta(),
    licenze: { attive: false },
    ogni: () => null,
    scarica: async (indirizzo) => {
      chiesti.push(indirizzo);
      if (indirizzo.includes("photon")) return { ok: false, status: 503, json: async () => ({}) };
      return {
        ok: true,
        json: async () => [
          {
            lat: "40.8518",
            lon: "14.2681",
            name: "Napoli",
            display_name: "Napoli, Campania, Italia",
            address: { city: "Napoli", state: "Campania" },
          },
        ],
      };
    },
  });
  const { posti, guasto } = await viaggi.cerca("napoli");
  assert.equal(guasto, undefined);
  assert.equal(posti.length, 1);
  assert.match(posti[0].nome, /Napoli/);
  assert.ok(chiesti[1].startsWith("https://nominatim.openstreetmap.org/search"));
  assert.match(chiesti[1], /viewbox=/);
  /* Nessun posto da tutt'e due: vuoto, ma non guasto. */
  const vuota = new Viaggi({
    licenze: { attive: false },
    ogni: () => null,
    scarica: async (indirizzo) => ({
      ok: true,
      json: async () => (indirizzo.includes("photon") ? { features: [] } : []),
    }),
  });
  assert.deepEqual(await vuota.cerca("xqzzyw"), { posti: [] });
});

test("il numero civico scritto si legge, e non quello dentro un nome", () => {
  assert.equal(civicoScritto("via sandro pertini 82 aversa"), "82");
  assert.equal(civicoScritto("Via Roma, 12/B Caserta"), "12/b");
  assert.equal(civicoScritto("corso umberto n. 7 napoli"), "7");
  assert.equal(civicoScritto("via 4 novembre aversa"), "");
  assert.equal(civicoScritto("via 4 novembre 15 aversa"), "15");
  assert.equal(civicoScritto("via roma 81031 aversa"), "");
  assert.equal(civicoScritto("napoli"), "");
  assert.equal(civicoScritto("82"), "");
});

test("cerca col civico: chi conosce il numero va primo, sennò la via col numero scritto", async () => {
  /* «Non mi fa ricercare per numeri civici»: Photon conosceva solo la via. */
  const chiesti = [];
  const risponde = ({ photonCivico = false, nominatimCivico = false } = {}) =>
    new Viaggi({
      casa: casaFinta(),
      licenze: { attive: false },
      ogni: () => null,
      scarica: async (indirizzo) => {
        chiesti.push(indirizzo);
        if (indirizzo.includes("photon"))
          return {
            ok: true,
            json: async () => ({
              features: [
                {
                  properties: {
                    osm_key: photonCivico ? "place" : "highway",
                    name: photonCivico ? undefined : "Via Sandro Pertini",
                    street: "Via Sandro Pertini",
                    housenumber: photonCivico ? "82" : undefined,
                    city: "Aversa",
                    state: "Campania",
                  },
                  geometry: { coordinates: [14.2, 40.97] },
                },
              ],
            }),
          };
        return {
          ok: true,
          json: async () =>
            nominatimCivico
              ? [
                  {
                    lat: "40.9712",
                    lon: "14.2061",
                    category: "place",
                    address: {
                      road: "Via Sandro Pertini",
                      house_number: "82",
                      town: "Aversa",
                      state: "Campania",
                    },
                  },
                ]
              : [],
        };
      },
    });

  /* Nessuno conosce l'82: la via, col numero che si e' scritto. */
  const soloLaVia = await risponde().cerca("via sandro pertini 82 aversa");
  assert.deepEqual(
    soloLaVia.posti.map((p) => p.nome),
    ["Via Sandro Pertini 82 · Aversa, Campania"],
  );
  assert.equal(soloLaVia.posti[0].esatto, undefined);
  /* Si e' chiesto a tutti e due. */
  assert.ok(chiesti.some((u) => u.includes("photon")));
  assert.ok(chiesti.some((u) => u.includes("nominatim")));

  /* Nominatim conosce proprio quel portone: va primo, anche se arriva dopo. */
  const conIlPortone = await risponde({ nominatimCivico: true }).cerca(
    "via sandro pertini 82 aversa",
  );
  assert.equal(conIlPortone.posti[0].lat, 40.9712);
  assert.equal(conIlPortone.posti[0].nome, "Via Sandro Pertini 82 · Aversa, Campania");
  assert.equal(
    conIlPortone.posti.length,
    1,
    "la via col numero e il portone hanno lo stesso nome: uno solo",
  );

  /* Senza civico tutto come prima: Photon, e Nominatim solo se serve. */
  chiesti.length = 0;
  await risponde().cerca("via sandro pertini aversa");
  assert.ok(chiesti.every((u) => u.includes("photon")));
});

/* ── l'auto elettrica e le soste di ricarica ──────────────────────────── */

/* Da Napoli a Milano: una strada dritta da 788 km in due tratti (Aversa in
 * mezzo), e lungo la strada due rapide e una lenta nell'archivio. */
const NAPOLI = { nome: "Napoli", lat: 40.85, lon: 14.25 };
const AVERSA = { nome: "Aversa", lat: 40.97, lon: 14.2 };
const MILANO = { nome: "Milano", lat: 45.46, lon: 9.19 };
const LINEA = Array.from({ length: 81 }, (_v, i) => [
  14.25 + ((9.19 - 14.25) * i) / 80,
  40.85 + ((45.46 - 40.85) * i) / 80,
]);
const PROGRESSIVI = chilometriDellaLinea(LINEA, 788);
const rigaDiColonnina = (km, nome, kw) => {
  const [lon, lat] = puntoAlKm(LINEA, PROGRESSIVI, km);
  return [lat, lon, `osm-node-${nome}`, nome, "Operatore", [[0, kw, 2]]];
};
const ARCHIVIO = gzipSync(
  Buffer.from(
    JSON.stringify({
      v: 1,
      generato: "2026-10-12T05:00:00Z",
      evseInOrdine: true,
      q: [],
      c: [
        rigaDiColonnina(268, "Area di servizio Ovest", 300),
        rigaDiColonnina(280, "Lenta", 50),
        rigaDiColonnina(528, "Area di servizio Nord", 350),
      ],
    }),
  ),
);

const AUTO = { batteria: 80, kwh: 70, consumo: 17, minimaArrivo: 15, kwColonnine: 100 };

function viaggiConLaStrada({ archivio = ARCHIVIO } = {}) {
  const chiesti = [];
  const viaggi = new Viaggi({
    casa: casaFinta(),
    licenze: { attive: false },
    adesso: () => ALLE_SETTE,
    ogni: () => null,
    scarica: async (indirizzo) => {
      chiesti.push(indirizzo);
      if (indirizzo === INDIRIZZO_DELLE_COLONNINE) {
        if (!archivio) return new Response("Not Found", { status: 404 });
        return new Response(archivio, { status: 200 });
      }
      return new Response(
        JSON.stringify({
          routes: [
            {
              duration: 31080,
              distance: 788000,
              legs: [{ distance: 16000 }, { distance: 772000 }],
              geometry: { coordinates: LINEA },
            },
          ],
        }),
        { status: 200 },
      );
    },
  });
  return { viaggi, chiesti };
}

test("strada con l'auto: le soste alle rapide dell'archivio, con le fonti", async () => {
  const { viaggi, chiesti } = viaggiConLaStrada();
  const senza = await viaggi.strada(NAPOLI, [AVERSA, MILANO]);
  assert.equal(senza.soste, undefined, "senza auto, niente soste");
  assert.ok(!chiesti.includes(INDIRIZZO_DELLE_COLONNINE), "e niente archivio");
  const risposta = await viaggi.rispondi(
    { id: 9, type: "ponte/viaggi/strada", da: NAPOLI, tappe: [AVERSA, MILANO], auto: AUTO },
    { utente: "persona_2" },
  );
  assert.equal(risposta.success, true);
  const { soste, stima } = risposta.result;
  assert.deepEqual(stima, { durataS: 31080, km: 788, fonte: "strada" });
  assert.deepEqual(
    soste.elenco.map((s) => [s.nome, s.km, s.da, s.a]),
    [
      ["Area di servizio Ovest", 268, 15, 80],
      ["Area di servizio Nord", 528, 17, 80],
    ],
  );
  assert.equal(soste.arrivo, 17);
  assert.equal(soste.partenza, 80);
  assert.equal(soste.ricaricaMin, soste.elenco[0].min + soste.elenco[1].min);
  assert.deepEqual(soste.tappeKm, [16, 788]);
  assert.equal(soste.archivio, true);
  assert.deepEqual(
    soste.fonti.dati.map((f) => f.licenza),
    ["ODbL 1.0", "CC BY 4.0"],
  );
  /* La strada si e' chiesta a OSRM una volta sola, l'archivio una volta. */
  assert.equal(chiesti.filter((u) => u.includes("osrm")).length, 1);
  assert.equal(chiesti.filter((u) => u === INDIRIZZO_DELLE_COLONNINE).length, 1);
  /* Colonnine da 50 kW: la lenta, piu' avanti, diventa la prima. */
  const lente = await viaggi.strada(NAPOLI, [AVERSA, MILANO], { ...AUTO, kwColonnine: 50 });
  assert.equal(lente.soste.elenco[0].nome, "Lenta");
});

test("strada con l'auto ma senza archivio: le soste a chilometro", async () => {
  const { viaggi } = viaggiConLaStrada({ archivio: null });
  const { soste } = await viaggi.strada(NAPOLI, [AVERSA, MILANO], AUTO);
  assert.equal(soste.archivio, false);
  assert.equal(soste.fonti, undefined);
  assert.deepEqual(
    soste.elenco.map((s) => [s.nome, s.km]),
    [
      ["", 268],
      ["", 535],
    ],
  );
  /* Un'auto che non sta in piedi non rompe la strada: niente soste e basta. */
  const storta = await viaggi.strada(NAPOLI, [AVERSA, MILANO], { batteria: "tanta" });
  assert.equal(storta.soste, undefined);
  assert.equal(storta.stima.km, 788);
});

test("le scelte dell'auto si tengono col viaggio, ripulite", () => {
  const v = viaggioPulito(
    unViaggio({
      auto: { uid: "auto-1", partenza: "obiettivo", minimaArrivo: 20, kwColonnine: 150 },
    }),
  );
  assert.deepEqual(v.auto, {
    uid: "auto-1",
    partenza: "obiettivo",
    minimaArrivo: 20,
    kwColonnine: 150,
  });
  assert.equal(viaggioPulito(unViaggio()).auto, undefined);
  assert.deepEqual(
    autoDelViaggio({ uid: "<b>", partenza: "domani", minimaArrivo: "7", kwColonnine: null }),
    { uid: "", partenza: "adesso", minimaArrivo: 15, kwColonnine: 100 },
  );
  assert.equal(autoDelViaggio({ partenza: "100" }).partenza, 100);
  assert.equal(autoDelViaggio([1, 2]), null);
});

test("le soste si ripuliscono: una storta e non se ne tiene nessuna", () => {
  const buona = {
    km: 268.44,
    nome: " Area  Ovest ",
    kw: 300,
    lat: 42,
    lon: 13,
    da: 15,
    a: 80,
    min: 22,
  };
  const pulite = sostePulite([buona], { fonte: "gdanav", arrivo: 17.4, alle: 5 });
  assert.deepEqual(pulite, {
    elenco: [{ ...buona, km: 268.4, nome: "Area Ovest", operatore: "" }],
    arrivo: 17,
    fonte: "gdanav",
    alle: 5,
  });
  assert.deepEqual(sostePulite([]).elenco, [], "nessuna sosta e' una risposta");
  assert.equal(sostePulite([buona, { ...buona, km: null }]), null);
  assert.equal(sostePulite([{ ...buona, min: 9000 }]), null);
  assert.equal(sostePulite([{ ...buona, km: "dieci" }]), null);
  assert.equal(sostePulite("tante"), null);
  assert.equal(sostePulite(Array.from({ length: 21 }, () => buona)), null);
  /* Quello che non e' buono resta vuoto, senza buttare la sosta. */
  const strana = sostePulite([{ km: 10, min: 5, lat: 999, lon: 13, kw: -4, da: 300 }]);
  assert.deepEqual(strana.elenco[0], {
    km: 10,
    nome: "",
    operatore: "",
    kw: 0,
    lat: null,
    lon: null,
    da: null,
    a: null,
    min: 5,
  });
});

test("le soste del navigatore prendono il posto di quelle della casa, e si parte prima", async () => {
  const { viaggi } = nuovi();
  const conAuto = unViaggio({
    auto: { uid: "auto-1", partenza: "obiettivo", minimaArrivo: 15, kwColonnine: 100 },
    stima: { durataS: 40 * 60, fonte: "strada" },
    soste: { elenco: [{ km: 20, nome: "Casa dice", kw: 150, min: 30, da: 12, a: 80 }], arrivo: 40 },
  });
  const { viaggio } = viaggi.salva("persona_2", conAuto);
  assert.equal(viaggio.soste.fonte, "casa");
  assert.equal(viaggio.soste.elenco[0].nome, "Casa dice");
  /* Arrivo entro le 9: 40 minuti col margine, piu' 30 di ricarica. */
  const guida = Math.round(40 * MINUTO * MARGINE_SENZA_TRAFFICO);
  assert.equal(viaggio.prossima.partenza, new Date(2026, 9, 16, 9).getTime() - guida - 30 * MINUTO);
  /* Il navigatore porta traffico e soste sue. */
  const dal = await viaggi.rispondi(
    {
      id: 3,
      type: "ponte/viaggi/stima",
      viaggio: viaggio.id,
      stima: { durataS: 48 * 60, km: 41.3, fonte: "traffico" },
      soste: [
        {
          km: 22,
          nome: "Libera adesso",
          operatore: "X",
          kw: 300,
          lat: 41,
          lon: 14.3,
          da: 11,
          a: 80,
          min: 18,
        },
      ],
      caricaArrivo: 35,
    },
    { utente: "persona_2" },
  );
  assert.equal(dal.success, true);
  const v = dal.result.viaggio;
  assert.equal(v.soste.fonte, "gdanav");
  assert.equal(v.soste.elenco[0].nome, "Libera adesso");
  assert.equal(v.soste.arrivo, 35);
  assert.equal(durataDelViaggio(v, ALLE_SETTE), (48 + 18) * MINUTO);
  /* Risalvato dalla pagina con le soste della casa: restano quelle del
   * navigatore, che sanno quali colonnine sono libere. */
  const risalvato = viaggi.salva("persona_2", { ...conAuto, id: viaggio.id }).viaggio;
  assert.equal(risalvato.soste.elenco[0].nome, "Libera adesso");
  /* Solo le soste, senza stima: va bene. Soste storte: no, e non si tocca niente. */
  assert.equal(viaggi.stima("persona_2", viaggio.id, null, []).viaggio.soste.elenco.length, 0);
  assert.deepEqual(viaggi.stima("persona_2", viaggio.id, null, [{ km: "x" }]), {
    errore: "soste-non-valide",
  });
  assert.deepEqual(viaggi.stima("persona_2", viaggio.id, null, null), {
    errore: "stima-non-valida",
  });
  /* Come le manda davvero l'app gdanav: dentro la stima, con `arrivo`. */
  const dallApp = await viaggi.rispondi(
    {
      id: 4,
      type: "ponte/viaggi/stima",
      viaggio: viaggio.id,
      stima: {
        durataS: 50 * 60,
        km: 41.3,
        fonte: "traffico",
        soste: [
          {
            km: 25,
            nome: "Dentro la stima",
            kw: 150,
            lat: 41,
            lon: 14.3,
            da: 14,
            a: 80,
            min: 20,
            libera: true,
          },
        ],
        arrivo: 33,
      },
    },
    { utente: "persona_2" },
  );
  assert.equal(dallApp.success, true);
  assert.equal(dallApp.result.viaggio.soste.elenco[0].nome, "Dentro la stima");
  assert.equal(dallApp.result.viaggio.soste.arrivo, 33);
  assert.equal(dallApp.result.viaggio.soste.fonte, "gdanav");
  /* Senza auto il viaggio non tiene soste. */
  const senzaAuto = viaggi.salva("persona_2", { ...unViaggio(), soste: conAuto.soste }).viaggio;
  assert.equal(senzaAuto.soste, undefined);
});
