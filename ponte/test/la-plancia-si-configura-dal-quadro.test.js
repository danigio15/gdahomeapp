/* Il terzo verbo, «configura», e chi dice di no.
 *
 * E' il pezzo con cui una macchina di fuori riscrive com'e' fatta la plancia
 * di casa di qualcuno, quindi — come per gli altri due verbi — le prove che
 * contano sono quelle dei **no**: il terzo interruttore chiuso, un flusso di
 * telecamera dentro la configurazione, una plancia cambiata in casa nel
 * frattempo. Il si' e' una riga; i no sono il prodotto.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Lavori } from "../src/lavori.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };

/* Gli aggiornamenti non c'entrano: qui non si installa niente. */
const NIENTE_DA_INSTALLARE = {
  async elenco() {
    return [];
  },
  async installa() {
    throw new Error("qui non si installa");
  },
  async riavvia() {
    throw new Error("qui non si riavvia");
  },
};

const VALORI = {
  dm_schema_version: "4",
  cd_stanze: JSON.stringify([{ id: "cucina", name: "Cucina" }]),
};

/* La plancia di casa, finta: dice se il permesso c'e', ritira dal quadro
 * quello che le si e' scritto, e si ricorda cosa le e' stato chiesto di
 * scrivere. */
function planciaFinta({
  aperta = true,
  chiesta = null,
  esito = { status: "saved" },
  correnti = null,
} = {}) {
  const scritte = [];
  const ritirate = [];
  return {
    scritte,
    ritirate,
    aperta: () => aperta,
    correnti: () => correnti,
    async prendi(profilo, id) {
      ritirate.push({ profilo, id });
      return typeof chiesta === "function" ? chiesta(profilo, id) : chiesta;
    },
    scrivi(profilo, valori, come) {
      scritte.push({ profilo, valori, come });
      return esito;
    },
    titoloDi: (profilo) => (profilo === "primary" ? "Casa" : ""),
  };
}

const comando = (piu = {}) => ({
  id: "c-1",
  cosa: "configura",
  nome: "primary",
  da: "12",
  a: "",
  ...piu,
});

const lavoriCon = (plancia, { manutenzione = true } = {}) =>
  new Lavori({
    aggiornamenti: NIENTE_DA_INSTALLARE,
    registro: ZITTO,
    aperta: () => manutenzione,
    plancia,
  });

test("quello che il quadro ha scritto si applica, con la revisione su cui l'ha scritto", async () => {
  const plancia = planciaFinta({ chiesta: { valori: VALORI, revisioneAttesa: 12 } });
  const lavori = lavoriCon(plancia);
  await lavori.fai(comando());
  assert.deepEqual(plancia.ritirate, [{ profilo: "primary", id: "c-1" }]);
  assert.equal(plancia.scritte.length, 1);
  assert.equal(plancia.scritte[0].profilo, "primary");
  assert.deepEqual(plancia.scritte[0].valori, VALORI);
  /* La revisione attesa e' quello che impedisce di sovrascrivere il lavoro di
   * chi ci abita: passa com'e' arrivata. */
  assert.equal(plancia.scritte[0].come.expected_revision, 12);
  const stato = lavori.stato([]);
  assert.equal(stato.stato, "fatto");
  assert.equal(stato.configurazione, true);
  assert.equal(stato.cosa, "configurazione della plancia «Casa»");
});

test("col terzo interruttore chiuso non si scrive niente, e si scrive perche'", async () => {
  /* Il no che conta e' questo: il quadro quel lavoro non dovrebbe nemmeno
   * mandarlo, ma se lo mandasse lo stesso la risposta viene da dentro casa. */
  const plancia = planciaFinta({ aperta: false, chiesta: { valori: VALORI, revisioneAttesa: 12 } });
  const lavori = lavoriCon(plancia);
  await lavori.fai(comando());
  assert.deepEqual(plancia.ritirate, [], "chiusa, non si va nemmeno a ritirare");
  assert.deepEqual(plancia.scritte, []);
  const stato = lavori.stato([]);
  assert.equal(stato.stato, "non riuscito");
  assert.match(stato.perche, /chiusa in questa casa/);
  assert.equal(stato.configurazione, true);
});

test("il terzo permesso non dipende dalla manutenzione: sono due interruttori", async () => {
  /* Chi apre la configurazione della plancia e tiene chiusa la manutenzione
   * ha scelto proprio quello: la plancia si', gli aggiornamenti no. */
  const plancia = planciaFinta({ chiesta: { valori: VALORI, revisioneAttesa: 12 } });
  const lavori = lavoriCon(plancia, { manutenzione: false });
  await lavori.fai(comando());
  assert.equal(plancia.scritte.length, 1);
  assert.equal(lavori.stato([]).stato, "fatto");
});

test("una configurazione con dentro un flusso si rifiuta, e non si scrive", async () => {
  /* La regola che tiene in piedi il permesso: da lontano si sceglie quale
   * telecamera va dove, non dove sta il suo flusso. */
  const conFlusso = {
    ...VALORI,
    cd_telecamere: JSON.stringify([
      { entity: "camera.ingresso", stream: "rtsp://u:p@192.168.1.9/x" },
    ]),
  };
  const plancia = planciaFinta({ chiesta: { valori: conFlusso, revisioneAttesa: 12 } });
  const lavori = lavoriCon(plancia);
  await lavori.fai(comando());
  assert.deepEqual(plancia.scritte, []);
  const stato = lavori.stato([]);
  assert.equal(stato.stato, "non riuscito");
  assert.match(stato.perche, /flusso/);
});

test("se la plancia e' cambiata in casa nel frattempo, non si sovrascrive", async () => {
  const plancia = planciaFinta({
    chiesta: { valori: VALORI, revisioneAttesa: 12 },
    esito: { status: "conflict" },
  });
  const lavori = lavoriCon(plancia);
  await lavori.fai(comando());
  const stato = lavori.stato([]);
  assert.equal(stato.stato, "non riuscito");
  assert.match(stato.perche, /cambiata in casa/);
});

test("una plancia configurata non si svuota da lontano", async () => {
  const plancia = planciaFinta({
    chiesta: { valori: { dm_schema_version: "4" }, revisioneAttesa: 12 },
    esito: { status: "refused-empty" },
  });
  const lavori = lavoriCon(plancia);
  await lavori.fai(comando());
  const stato = lavori.stato([]);
  assert.equal(stato.stato, "non riuscito");
  assert.match(stato.perche, /non si svuota/);
});

test("senza niente da ritirare non si scrive niente, e lo si dice", async () => {
  const plancia = planciaFinta({ chiesta: null });
  const lavori = lavoriCon(plancia);
  await lavori.fai(comando());
  assert.deepEqual(plancia.scritte, []);
  const stato = lavori.stato([]);
  assert.equal(stato.stato, "non riuscito");
  assert.match(stato.perche, /nessuna configurazione/);
});

test("un quadro che non risponde al ritiro non e' un lavoro fatto", async () => {
  const plancia = planciaFinta({
    chiesta: () => {
      throw new Error("ECONNRESET");
    },
  });
  const lavori = lavoriCon(plancia);
  await lavori.fai(comando());
  assert.deepEqual(plancia.scritte, []);
  const stato = lavori.stato([]);
  assert.equal(stato.stato, "non riuscito");
  assert.match(stato.perche, /non si e' potuta ritirare/);
});

test("lo stesso lavoro chiesto due volte si applica una volta sola", async () => {
  const plancia = planciaFinta({ chiesta: { valori: VALORI, revisioneAttesa: 12 } });
  const lavori = lavoriCon(plancia);
  await lavori.fai(comando());
  await lavori.fai(comando());
  assert.equal(plancia.scritte.length, 1);
});

test("i flussi di casa restano al loro posto quando il quadro riscrive la plancia", async () => {
  /* Il quadro i flussi non li ha mai visti: li riscrive vuoti. Scriverli
   * vuoti davvero vorrebbe dire cancellare l'indirizzo di ogni telecamera. */
  const inCasa = {
    ...VALORI,
    cd_cameras: JSON.stringify([
      { entity: "camera.ingresso", name: "Ingresso", rtsp: "rtsp://u:p@192.168.1.9/ingresso" },
    ]),
  };
  const dalQuadro = {
    ...VALORI,
    cd_cameras: JSON.stringify([{ entity: "camera.ingresso", name: "Portone", rtsp: "" }]),
  };
  const plancia = planciaFinta({
    chiesta: { valori: dalQuadro, revisioneAttesa: 12 },
    correnti: inCasa,
  });
  const lavori = lavoriCon(plancia);
  await lavori.fai(comando());
  assert.equal(lavori.stato([]).stato, "fatto");
  assert.deepEqual(JSON.parse(plancia.scritte[0].valori.cd_cameras), [
    { entity: "camera.ingresso", name: "Portone", rtsp: "rtsp://u:p@192.168.1.9/ingresso" },
  ]);
});
