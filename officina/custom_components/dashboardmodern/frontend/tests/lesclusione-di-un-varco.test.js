/* Escludere un varco dall'antifurto (#136).
 *
 * «Nei varchi che ho inserito, che sono i sensori del mio allarme Risco, sono
 * tutti dei binary sensor che gia' Home Assistant vede mi da' la possibilita' di
 * disabilitare. Possiamo farlo anche qui?»
 *
 * Qui si tiene ferma la parte che si puo' sbagliare in silenzio: quale
 * interruttore si propone, cosa vuol dire acceso, cosa si manda, e — la piu'
 * importante — che una finestra esclusa resta una finestra APERTA. Su un
 * antifurto uno sbaglio di segno non e' un numero storto: e' una porta che chi
 * ha premuto crede esclusa e invece e' sorvegliata, o il contrario.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMPO_ESCLUSIONE,
  comeStaLEsclusione,
  contoDelleEsclusioni,
  esclusioneProposta,
  ilComandoDellEsclusione,
  puoEscludere,
} from "../src/core/l-esclusione-del-varco.js";
import { contoDeiVarchi, varchiDiCasa } from "../src/core/varchi-di-casa.js";

/* Una casa con una centrale Risco: due contatti, e accanto a ognuno
 * l'interruttore che la centrale pubblica per escluderlo. */
const CASA = {
  "binary_sensor.porta_ingresso": {
    state: "off",
    attributes: { device_class: "door", friendly_name: "Porta ingresso" },
  },
  "switch.porta_ingresso_bypass": { state: "off", attributes: { friendly_name: "Porta ingresso Bypass" } },
  "binary_sensor.finestra_bagno": {
    state: "on",
    attributes: { device_class: "window", friendly_name: "Finestra bagno" },
  },
  "switch.finestra_bagno_bypass": { state: "on", attributes: { friendly_name: "Finestra bagno Bypass" } },
};

/* ── quale interruttore si propone ──────────────────────────────────────── */

test("l'interruttore che pubblica Risco si riconosce dal nome", () => {
  assert.equal(
    esclusioneProposta("binary_sensor.porta_ingresso", CASA),
    "switch.porta_ingresso_bypass",
  );
});

test("e anche quello scritto in casa, con la parola davanti", () => {
  /* Chi la centrale la governa con le automazioni lo chiama all'italiana, e
   * mette la parola prima del nome invece che dopo. */
  const suo = { "input_boolean.escludi_finestra_bagno": { state: "off" } };
  assert.equal(
    esclusioneProposta("binary_sensor.finestra_bagno", suo),
    "input_boolean.escludi_finestra_bagno",
  );
});

test("l'esclusione di un'ALTRA porta non si propone mai", () => {
  /* Questa prova e' il motivo per cui la ricerca e' cosi' stretta. La regola
   * larga di prima — «cominci come il contatto e abbia bypass addosso» — per un
   * contatto chiamato solo `porta` proponeva l'esclusione della cantina, pronta
   * da salvare a chi si fida. Una proposta sbagliata qui vuol dire una finestra
   * sorvegliata mentre la si crede esclusa, e un'altra esclusa senza che
   * nessuno l'abbia chiesto: meglio nessuna proposta. */
  const st = { "switch.porta_cantina_bypass": { state: "off" } };
  assert.equal(esclusioneProposta("binary_sensor.porta", st), "");
  assert.equal(esclusioneProposta("binary_sensor.porta_ingresso", st), "");
});

test("e senza niente da proporre non si propone niente", () => {
  assert.equal(esclusioneProposta("binary_sensor.porta_ingresso", {}), "");
  assert.equal(esclusioneProposta("", CASA), "");
  assert.equal(esclusioneProposta("senza_punto", CASA), "");
});

test("un sensore non puo' fare da interruttore d'esclusione", () => {
  /* Un `binary_sensor` racconta e basta: non ha `turn_on`. Metterlo in quella
   * casella vorrebbe dire disegnare un tasto che non comanda niente, che e' la
   * stessa cosa che si e' tolta dai comandi di una TV (#132). */
  assert.equal(puoEscludere("switch.porta_bypass"), true);
  assert.equal(puoEscludere("input_boolean.porta_bypass"), true);
  assert.equal(puoEscludere("binary_sensor.porta"), false);
  assert.equal(puoEscludere("switch."), false);
  assert.equal(puoEscludere(""), false);
  assert.equal(puoEscludere(null), false);
});

/* ── acceso vuol dire escluso ───────────────────────────────────────────── */

test("acceso e' escluso, spento e' sorvegliato", () => {
  assert.equal(comeStaLEsclusione("switch.finestra_bagno_bypass", CASA), "escluso");
  assert.equal(comeStaLEsclusione("switch.porta_ingresso_bypass", CASA), "sorvegliato");
});

test("e un interruttore che non risponde non e' «sorvegliato»", () => {
  /* E' la bugia tranquillizzante che i varchi evitano da sempre: dire a chi sta
   * inserendo l'antifurto che quella porta e' guardata quando non si sa. */
  for (const muto of ["unavailable", "unknown", "", "none", "qualcosaltro"])
    assert.equal(
      comeStaLEsclusione("switch.x", { "switch.x": { state: muto } }),
      "",
      `«${muto}» non e' una risposta`,
    );
  assert.equal(comeStaLEsclusione("", CASA), "");
  assert.equal(comeStaLEsclusione("switch.che_non_ce", CASA), "");
});

/* ── cosa si manda ──────────────────────────────────────────────────────── */

test("si manda dove deve andare, non «toggle»", () => {
  /* `toggle` su uno stato letto male fa il contrario di quello che chi premeva
   * si aspettava, e su un antifurto il contrario e' una porta scoperta. */
  assert.deepEqual(ilComandoDellEsclusione("switch.porta_ingresso_bypass", CASA), {
    domain: "switch",
    service: "turn_on",
    data: { entity_id: "switch.porta_ingresso_bypass" },
  });
  assert.deepEqual(ilComandoDellEsclusione("switch.finestra_bagno_bypass", CASA), {
    domain: "switch",
    service: "turn_off",
    data: { entity_id: "switch.finestra_bagno_bypass" },
  });
});

test("e su un interruttore muto non si manda niente", () => {
  assert.equal(ilComandoDellEsclusione("switch.x", { "switch.x": { state: "unavailable" } }), null);
  assert.equal(ilComandoDellEsclusione("binary_sensor.porta_ingresso", CASA), null);
  assert.equal(ilComandoDellEsclusione("", CASA), null);
});

/* ── e i varchi, letti ──────────────────────────────────────────────────── */

const RIGHE = [
  { entity: "binary_sensor.porta_ingresso", name: "Porta ingresso", icon: "front-door" },
  {
    entity: "binary_sensor.finestra_bagno",
    name: "Finestra bagno",
    icon: "window",
    [CAMPO_ESCLUSIONE]: "switch.finestra_bagno_bypass",
  },
];

const lette = () => varchiDiCasa(CASA, { righe: RIGHE }, new Set());

test("la riga porta con se' il suo interruttore e come sta", () => {
  const bagno = lette().find((riga) => riga.entity === "binary_sensor.finestra_bagno");
  assert.equal(bagno.esclusione, "switch.finestra_bagno_bypass");
  assert.equal(bagno.escluso, "escluso");
});

test("e chi non l'ha dichiarato non ne ha uno indovinato", () => {
  /* La porta d'ingresso ha il suo `switch.porta_ingresso_bypass` in casa, e la
   * proposta lo troverebbe. Ma nessuno l'ha scritto nella riga, e un'esclusione
   * che nessuno ha dichiarato non si comanda: proporla in configurazione e
   * darla per buona in pagina sono due cose diverse. */
  const porta = lette().find((riga) => riga.entity === "binary_sensor.porta_ingresso");
  assert.equal(porta.esclusione, "");
  assert.equal(porta.escluso, "");
});

test("una finestra esclusa resta una finestra APERTA", () => {
  /* La cosa da non sbagliare. L'esclusione parla alla centrale, non all'infisso:
   * il contatto dice il vero, e il conto in cima alla pagina non si tocca.
   * Contarla chiusa perche' e' esclusa sarebbe dire che la casa e' a posto
   * mentre c'e' una finestra aperta. */
  const conto = contoDeiVarchi(lette());
  assert.equal(conto.aperti, 1);
  assert.deepEqual(conto.nomi, ["Finestra bagno"]);
});

test("ma si sa quante sono escluse, e quali", () => {
  /* La meta' che conta di questa segnalazione: poter escludere serve a poco se
   * poi, davanti al tastierino, non si vede che c'e' una porta esclusa. */
  assert.deepEqual(contoDelleEsclusioni(lette()), { esclusi: 1, nomi: ["Finestra bagno"] });
});

test("e un'esclusione che non risponde non si conta fra le escluse", () => {
  const muta = varchiDiCasa(
    { ...CASA, "switch.finestra_bagno_bypass": { state: "unavailable" } },
    { righe: RIGHE },
    new Set(),
  );
  assert.deepEqual(contoDelleEsclusioni(muta), { esclusi: 0, nomi: [] });
  assert.equal(contoDelleEsclusioni().esclusi, 0);
});
