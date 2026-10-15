/* I viaggi pianificati di gdanav, nella casa (`viaggi.js`).
 *
 * Quello che deve restare vero: un viaggio sta in piedi solo con una meta e
 * un'ora; ognuno vede e cambia i suoi; con «arrivo entro» la partenza tiene
 * conto della strada, e senza traffico ci mette il margine; l'avviso parte
 * una volta per volta, solo a chi l'ha fatto, anche nelle ore di silenzio;
 * il clima si accende prima; il garage non si apre mai da solo; senza
 * Premium la casa tiene i viaggi ma non fa niente.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  durataDelViaggio,
  MARGINE_SENZA_TRAFFICO,
  prossimaVolta,
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
  const { viaggio } = viaggi.salva("anna", unViaggio());
  assert.ok(viaggio.id);
  viaggi.salva("bruno", unViaggio({ nome: "Altro" }));
  assert.equal(viaggi.elenco("anna").viaggi.length, 1);
  assert.equal(viaggi.elenco("bruno").viaggi.length, 1);
  assert.deepEqual(viaggi.salva("bruno", { ...unViaggio(), id: viaggio.id }), {
    errore: "non-trovato",
  });
  assert.deepEqual(viaggi.togli("bruno", viaggio.id), { errore: "non-trovato" });
  assert.deepEqual(viaggi.togli("anna", viaggio.id), { tolto: viaggio.id });
  assert.equal(viaggi.elenco("anna").viaggi.length, 0);
});

test("la stima del navigatore resta; cambiata la meta, si butta", () => {
  const { viaggi } = nuovi();
  const { viaggio } = viaggi.salva("anna", unViaggio());
  const conStima = viaggi.stima("anna", viaggio.id, {
    durataS: 2880,
    km: 41.3,
    fonte: "traffico",
  }).viaggio;
  assert.equal(conStima.stima.fonte, "traffico");
  const stessa = viaggi.salva("anna", {
    ...unViaggio({ nome: "Ufficio" }),
    id: viaggio.id,
  }).viaggio;
  assert.equal(stessa.stima.durataS, 2880);
  const altra = viaggi.salva("anna", {
    ...unViaggio({ tappe: [{ nome: "Salerno", lat: 40.68, lon: 14.77 }] }),
    id: viaggio.id,
  }).viaggio;
  assert.equal(altra.stima, null);
});

test("l'avviso parte una volta, solo a chi l'ha fatto, e passa il silenzio", async () => {
  const { viaggi, notifiche, vai } = nuovi();
  const { viaggio } = viaggi.salva("anna", unViaggio());
  viaggi.stima("anna", viaggio.id, { durataS: 48 * 60, fonte: "traffico" });
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
  assert.deepEqual(avviso.solo, ["anna"]);
  assert.equal(avviso.oltreIlSilenzio, true);
  assert.equal(avviso.parole.it.titolo, "Parti fra 10 minuti");
  assert.match(avviso.parole.it.testo, /Caserta: arrivo entro le 09:00/);
  assert.deepEqual(avviso.azioni, [], "senza garage, nessun tasto");
});

test("il clima si accende prima; il garage e' solo un tasto nell'avviso", async () => {
  const { viaggi, notifiche, casa, vai } = nuovi();
  const { viaggio } = viaggi.salva(
    "anna",
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
  assert.deepEqual(avviso.azioni[0].servizio.service_data, { entity_id: "cover.garage" });
});

test("senza Premium i viaggi restano, ma non si salvano di nuovi e non si avvisa", async () => {
  const { viaggi, notifiche } = nuovi({ sbloccato: false });
  assert.deepEqual(viaggi.salva("anna", unViaggio()), { errore: "premium-richiesto" });
  assert.equal(viaggi.elenco("anna").sbloccato, false);
  await viaggi.battito();
  assert.equal(notifiche.consegnate.length, 0);
});

test("i viaggi di una volta passati da un giorno si tolgono da soli", async () => {
  const { viaggi, vai } = nuovi();
  viaggi.salva("anna", unViaggio());
  vai(new Date(2026, 9, 18, 9, 0).getTime());
  await viaggi.battito();
  assert.equal(viaggi.archivio.dati.viaggi.length, 0);
});

test("sul filo: ognuno coi suoi, e i comandi che non ci sono dicono di no", async () => {
  const { viaggi } = nuovi();
  const salvato = await viaggi.rispondi(
    { id: 1, type: "ponte/viaggi/salva", viaggio: unViaggio() },
    { utente: "anna" },
  );
  assert.equal(salvato.success, true);
  const elenco = await viaggi.rispondi({ id: 2, type: "ponte/viaggi/elenco" }, { utente: "anna" });
  assert.equal(elenco.result.viaggi.length, 1);
  const altro = await viaggi.rispondi({ id: 3, type: "ponte/viaggi/elenco" }, { utente: "bruno" });
  assert.equal(altro.result.viaggi.length, 0);
  const cattivo = await viaggi.rispondi(
    { id: 4, type: "ponte/viaggi/salva", viaggio: { tipo: "una" } },
    { utente: "anna" },
  );
  assert.equal(cattivo.success, false);
  assert.equal(cattivo.error.code, "viaggio-non-valido");
  const ignoto = await viaggi.rispondi({ id: 5, type: "ponte/viaggi/vola" }, { utente: "anna" });
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
  assert.deepEqual(await muta.cerca("piazza dante"), { posti: [] });
});
