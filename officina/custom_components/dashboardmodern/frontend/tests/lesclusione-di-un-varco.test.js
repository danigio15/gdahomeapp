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
  NESSUNA_ESCLUSIONE,
  comeStaLEsclusione,
  contoDelleEsclusioni,
  esclusioneDelDispositivo,
  esclusioneProposta,
  ilComandoDellEsclusione,
  lInterruttoreDelVarco,
  laMossaDelloScudo,
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

test("e chi non l'ha scritto ha quello che la centrale pubblica col suo nome", () => {
  /* Fino alla prima versione qui si diceva il contrario: senza la casella
   * scritta, niente esclusione. Ma «sono tutti binary sensor che gia' Home
   * Assistant vede»: chi ha trenta zone Risco non deve riscrivere trenta nomi.
   * Il nome esatto `<contatto>_bypass` e' una prova forte, e si usa — dicendo
   * che l'ha trovato la plancia. */
  const porta = lette().find((riga) => riga.entity === "binary_sensor.porta_ingresso");
  assert.equal(porta.esclusione, "switch.porta_ingresso_bypass");
  assert.equal(porta.esclusioneTrovata, true);
  assert.equal(porta.escluso, "sorvegliato");
  const bagno = lette().find((riga) => riga.entity === "binary_sensor.finestra_bagno");
  assert.equal(bagno.esclusioneTrovata, false, "quello scritto non e' «trovato»");
});

test("e il trattino dice che quel varco da qui non si esclude", () => {
  const conTrattino = varchiDiCasa(
    CASA,
    {
      righe: [
        {
          entity: "binary_sensor.porta_ingresso",
          name: "Porta ingresso",
          [CAMPO_ESCLUSIONE]: NESSUNA_ESCLUSIONE,
        },
      ],
    },
    new Set(),
  );
  assert.equal(conTrattino[0].esclusione, "");
  assert.equal(conTrattino[0].escluso, "");
});

/* ── la zona della centrale, dal registro ──────────────────────────────── */

/* Una zona Risco rinominata a mano: il contatto si chiama «Ingresso», e
 * l'interruttore ha l'identificativo che gli ha dato l'integrazione. Dal nome
 * non si troverebbe mai; dal dispositivo si'. */
const ZONA = {
  "binary_sensor.ingresso": {
    state: "off",
    attributes: { device_class: "door", friendly_name: "Ingresso" },
  },
  "switch.zona_1_bypass": { state: "off", attributes: { friendly_name: "Zona 1 Bypass" } },
  "switch.luce_ingresso": { state: "on", attributes: { friendly_name: "Luce ingresso" } },
  "binary_sensor.zona_1_alarmed": { state: "off", attributes: {} },
  "switch.garage_bypass": { state: "off", attributes: { friendly_name: "Garage Bypass" } },
};
const REGISTRO = {
  "binary_sensor.ingresso": "zona1",
  "switch.zona_1_bypass": "zona1",
  "binary_sensor.zona_1_alarmed": "zona1",
  "switch.luce_ingresso": "zona1",
  "switch.garage_bypass": "garage",
};

test("l'interruttore sulla stessa zona della centrale si trova dal registro", () => {
  assert.equal(
    esclusioneDelDispositivo("binary_sensor.ingresso", ZONA, REGISTRO),
    "switch.zona_1_bypass",
  );
  /* E la proposta lo prova per primo: il nome non c'entra. */
  assert.equal(esclusioneProposta("binary_sensor.ingresso", ZONA, REGISTRO), "switch.zona_1_bypass");
  assert.deepEqual(lInterruttoreDelVarco("binary_sensor.ingresso", "", ZONA, REGISTRO), {
    interruttore: "switch.zona_1_bypass",
    trovato: true,
  });
});

test("la parola si riconosce anche dal nome che si legge, e in italiano", () => {
  const st = {
    "binary_sensor.porta": { state: "off", attributes: { device_class: "door" } },
    "switch.zona_3_x": { state: "off", attributes: { friendly_name: "Porta Escludi" } },
  };
  const reg = { "binary_sensor.porta": "z3", "switch.zona_3_x": "z3" };
  assert.equal(esclusioneDelDispositivo("binary_sensor.porta", st, reg), "switch.zona_3_x");
});

test("sulla stessa zona, un interruttore qualsiasi non e' un'esclusione", () => {
  /* La luce dell'ingresso sta sullo stesso dispositivo — capita, con le
   * centrali che hanno le uscite — ma non ha la parola: non si prende. */
  const reg = { "binary_sensor.ingresso": "zona1", "switch.luce_ingresso": "zona1" };
  assert.equal(esclusioneDelDispositivo("binary_sensor.ingresso", ZONA, reg), "");
});

test("due esclusioni sulla stessa zona sono una domanda, non una risposta", () => {
  /* Non si sceglie a caso quale finestra lasciare scoperta: si torna vuoti, e
   * decide il nome o chi configura. */
  const reg = { ...REGISTRO, "switch.garage_bypass": "zona1" };
  assert.equal(esclusioneDelDispositivo("binary_sensor.ingresso", ZONA, reg), "");
});

test("senza registro si cerca per nome, come prima", () => {
  assert.equal(esclusioneDelDispositivo("binary_sensor.ingresso", ZONA, null), "");
  assert.equal(esclusioneProposta("binary_sensor.ingresso", ZONA, null), "");
  assert.equal(
    esclusioneProposta("binary_sensor.porta_ingresso", CASA, {}),
    "switch.porta_ingresso_bypass",
  );
});

test("quello scritto vince sempre su quello trovato", () => {
  assert.deepEqual(
    lInterruttoreDelVarco("binary_sensor.ingresso", "switch.altro", ZONA, REGISTRO),
    { interruttore: "switch.altro", trovato: false },
  );
  assert.deepEqual(
    lInterruttoreDelVarco("binary_sensor.ingresso", NESSUNA_ESCLUSIONE, ZONA, REGISTRO),
    { interruttore: "", trovato: false },
  );
});

test("la riga del varco prende l'esclusione dal registro, se gliela si passa", () => {
  const [riga] = varchiDiCasa(
    ZONA,
    { righe: [{ entity: "binary_sensor.ingresso", name: "Ingresso" }] },
    new Set(),
    (entity) => entity,
    null,
    REGISTRO,
  );
  assert.equal(riga.esclusione, "switch.zona_1_bypass");
  assert.equal(riga.escluso, "sorvegliato");
});

/* ── cosa fa lo scudo premuto ─────────────────────────────────────────── */

const rigaDi = (entity, esclusione) => ({ entity, esclusione });

test("escludere chiede prima, includere no", () => {
  /* Le due direzioni non pesano uguale: una lascia scoperta una finestra,
   * l'altra la rimette sotto sorveglianza. */
  const esclude = laMossaDelloScudo(
    rigaDi("binary_sensor.porta_ingresso", "switch.porta_ingresso_bypass"),
    CASA,
  );
  assert.equal(esclude.mossa, "chiedi");
  assert.equal(esclude.comando.service, "turn_on");
  const include = laMossaDelloScudo(
    rigaDi("binary_sensor.finestra_bagno", "switch.finestra_bagno_bypass"),
    CASA,
  );
  assert.equal(include.mossa, "manda");
  assert.equal(include.comando.service, "turn_off");
});

test("col lucchetto, sul contatto o sull'interruttore, non si manda niente", () => {
  for (const chiuso of ["switch.porta_ingresso_bypass", "binary_sensor.porta_ingresso"]) {
    const mossa = laMossaDelloScudo(
      rigaDi("binary_sensor.porta_ingresso", "switch.porta_ingresso_bypass"),
      CASA,
      (entity) => entity !== chiuso,
    );
    assert.deepEqual(mossa, { mossa: "bloccato", comando: null }, chiuso);
  }
});

test("e un interruttore muto non fa niente, lucchetto o no", () => {
  const muta = { ...CASA, "switch.porta_ingresso_bypass": { state: "unavailable" } };
  assert.deepEqual(
    laMossaDelloScudo(rigaDi("binary_sensor.porta_ingresso", "switch.porta_ingresso_bypass"), muta),
    { mossa: "niente", comando: null },
  );
  assert.equal(laMossaDelloScudo(null, CASA).mossa, "niente");
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
