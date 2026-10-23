/* Il Pianificatore, gli Aiutanti e le procedure guidate di Home Assistant:
 * le regole pure.
 *
 *  - una routine a orari e un calendario a fasce diventano automazioni vere
 *    di Home Assistant, e tornano indietro uguali (`core/automazioni-ha.js`);
 *  - il periodo «dal 15 ottobre al 15 aprile» vale anche a cavallo di
 *    capodanno, e il prossimo momento si calcola nei giorni e nel periodo;
 *  - un modulo di una procedura (`data_schema`, coi selettori) diventa campi
 *    semplici, e le risposte tornano nella forma di Home Assistant;
 *  - i campi degli aiutanti semplici e le fasce di un programma scritte a mano.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  automazionePulita,
  eCompleta,
  nelPeriodo,
  prossimoDelPianificatore,
} from "../src/core/automazioni.js";
import { dallaHomeAssistant, inHomeAssistant } from "../src/core/automazioni-ha.js";
import {
  campiDelPasso,
  datiDelModulo,
  durataDaTesto,
  erroriDelPasso,
  paroleDelPasso,
  testoDelPasso,
  valoriDiPartenza,
  vociDelMenu,
} from "../src/core/flussi-di-home-assistant.js";
import {
  campiDelTipo,
  campiPerIlPonte,
  fasceDaTesto,
  fasceInTesto,
  valoriDellAiutante,
} from "../src/core/aiutanti-di-home-assistant.js";

const ROUTINE = {
  id: "r1",
  nome: "Mattina feriale",
  tipo: "routine",
  soloSe: [{ tipo: "casa", chi: "qualcuno" }],
  routine: {
    giorni: [true, true, true, true, true, false, false],
    periodo: { da: "10-01", a: "03-31" },
    passi: [
      { ora: "07:00", allora: [{ tipo: "tapparella", entita: ["cover.soggiorno"], modo: "apri" }] },
      {
        ora: "06:30",
        allora: [
          { tipo: "accendi", entita: ["switch.caldaia"] },
          { tipo: "aspetta", minuti: 45 },
          { tipo: "spegni", entita: ["switch.caldaia"] },
        ],
      },
    ],
  },
};

const FASCE = {
  id: "f1",
  nome: "Caldaia",
  tipo: "fasce",
  fasce: { entita: ["switch.caldaia"], periodo: { da: "10-15", a: "04-15" }, fuori: "spegni" },
};

test("una routine: un orario per passo, in ordine, i giorni e il periodo, e torna uguale", () => {
  const ha = inHomeAssistant(ROUTINE);
  assert.equal(ha.mode, "parallel", "un «aspetta» non ferma il passo dopo");
  assert.deepEqual(
    ha.triggers.map((x) => [x.at, x.id]),
    [
      ["06:30:00", "passo_0"],
      ["07:00:00", "passo_1"],
    ],
  );
  assert.deepEqual(ha.conditions[0], {
    condition: "time",
    weekday: ["mon", "tue", "wed", "thu", "fri"],
  });
  assert.match(ha.conditions[1].value_template, /'10-01' or .*'03-31'/);
  assert.deepEqual(ha.actions[0].choose[0].conditions, [{ condition: "trigger", id: "passo_0" }]);
  const indietro = dallaHomeAssistant(ha);
  assert.equal(indietro.tipo, "routine");
  assert.deepEqual(
    indietro.routine.passi.map((p) => p.ora),
    ["06:30", "07:00"],
  );
  assert.equal(indietro.soloSe[0].tipo, "casa");
});

test("una routine senza azioni non si salva; un calendario senza cose nemmeno", () => {
  assert.equal(
    eCompleta(automazionePulita({ ...ROUTINE, routine: { passi: [{ ora: "07:00" }] } })),
    false,
  );
  assert.equal(inHomeAssistant({ ...ROUTINE, routine: { passi: [] } }), null);
  assert.equal(eCompleta(automazionePulita({ ...FASCE, fasce: { entita: [] } })), false);
  /* Due passi alla stessa ora diventano uno; un'ora storta si toglie. */
  const r = automazionePulita({
    ...ROUTINE,
    routine: {
      passi: [
        { ora: "07:00", allora: [] },
        { ora: "07:00", allora: [] },
        { ora: "25:00", allora: [] },
      ],
    },
  });
  assert.equal(r.routine.passi.length, 1);
});

test("un calendario a fasce: parte a ogni cambio e alla riaccensione, acceso dentro e spento fuori", () => {
  const ha = inHomeAssistant(FASCE);
  assert.deepEqual(ha.triggers.at(-1), { trigger: "homeassistant", event: "start" });
  assert.ok(ha.triggers[0].at.includes("06:30:00"));
  assert.equal(ha.actions[0].choose[0].sequence[0].action, "homeassistant.turn_on");
  assert.equal(ha.actions[0].default[0].action, "homeassistant.turn_off");
  assert.equal(dallaHomeAssistant(ha).tipo, "fasce");
  /* «Lascia com'è»: fuori dalle fasce non si spegne niente. */
  const lascia = inHomeAssistant({ ...FASCE, fasce: { ...FASCE.fasce, fuori: "lascia" } });
  assert.equal(lascia.actions[0].default, undefined);
});

test("il periodo a cavallo di capodanno, e il prossimo momento nei giorni giusti", () => {
  const p = { da: "10-15", a: "04-15" };
  assert.equal(nelPeriodo(p, new Date(2027, 0, 10).getTime()), true);
  assert.equal(nelPeriodo(p, new Date(2027, 6, 10).getTime()), false);
  assert.equal(nelPeriodo(null, Date.now()), true);
  /* Venerdi' 23 ottobre alle 8: la routine dei feriali riparte lunedi'. */
  const r = automazionePulita(ROUTINE);
  const lunedi = new Date(prossimoDelPianificatore(r, new Date(2026, 9, 23, 8, 0).getTime()));
  assert.equal(lunedi.getDay(), 1);
  assert.equal(lunedi.getHours(), 6);
  assert.equal(lunedi.getMinutes(), 30);
  /* A luglio, fuori periodo: il primo ottobre. */
  const ottobre = new Date(prossimoDelPianificatore(r, new Date(2026, 6, 1).getTime()));
  assert.equal(ottobre.getMonth(), 9);
});

test("un modulo di una procedura: i campi, le parole, le scelte tradotte, le sezioni", () => {
  const passo = {
    flow_id: "abc123",
    handler: "prova",
    tipo: "form",
    step_id: "user",
    schema: [
      { name: "host", required: true, type: "string" },
      { name: "port", optional: true, type: "integer", default: 80 },
      { name: "verify_ssl", type: "boolean", default: true },
      { name: "mode", selector: { select: { options: ["a", "b"], translation_key: "modo" } } },
      {
        name: "avanzate",
        type: "expandable",
        schema: [
          { name: "timeout", selector: { number: { min: 1, max: 60, unit_of_measurement: "s" } } },
        ],
      },
    ],
    errori: { base: "cannot_connect", host: "invalid_host" },
    segnaposti: { nome: "Casa" },
    parole: {
      "step.user.title": "Collega {nome}",
      "step.user.description": "Vedi [la guida](https://esempio.it) **prima**",
      "step.user.data.host": "Indirizzo",
      "selector.modo.options.a": "Automatico",
    },
  };
  const campi = campiDelPasso(passo);
  assert.deepEqual(
    campi.map((c) => [c.nome, c.tipo, c.etichetta, c.sezione]),
    [
      ["host", "testo", "Indirizzo", ""],
      ["port", "numero", "Port", ""],
      ["verify_ssl", "si-no", "Verify ssl", ""],
      ["mode", "scelta", "Mode", ""],
      ["timeout", "numero", "Timeout", "avanzate"],
    ],
  );
  assert.equal(campi[3].opzioni[0].etichetta, "Automatico");
  assert.deepEqual(paroleDelPasso(passo), {
    titolo: "Collega Casa",
    spiegazione: "Vedi la guida (https://esempio.it) prima",
  });
  const errori = erroriDelPasso(passo);
  assert.equal(errori.base, "Non riesco a collegarmi.");
  assert.equal(errori.campi.host, "Indirizzo non valido.");
  const valori = valoriDiPartenza(campi);
  assert.deepEqual(valori, { port: 80, verify_ssl: true });
  /* Senza l'indirizzo manca qualcosa; con, le risposte nella forma giusta. */
  assert.deepEqual(datiDelModulo(campi, valori).mancanti, ["host"]);
  const { dati, mancanti } = datiDelModulo(campi, {
    ...valori,
    host: " 192.168.1.4 ",
    port: "8080",
    mode: "b",
    timeout: "5",
  });
  assert.deepEqual(mancanti, []);
  assert.deepEqual(dati, {
    host: "192.168.1.4",
    port: 8080,
    verify_ssl: true,
    mode: "b",
    avanzate: { timeout: 5 },
  });
});

test("il menu, le durate e il testo di Home Assistant", () => {
  assert.deepEqual(
    vociDelMenu({
      step_id: "user",
      menu: ["cloud", "local"],
      parole: { "step.user.menu_options.cloud": "Nel cloud" },
    }),
    [
      { valore: "cloud", etichetta: "Nel cloud" },
      { valore: "local", etichetta: "Local" },
    ],
  );
  assert.deepEqual(durataDaTesto("1:30:00"), { hours: 1, minutes: 30, seconds: 0 });
  assert.deepEqual(durataDaTesto("90"), { hours: 1, minutes: 30, seconds: 0 });
  assert.equal(durataDaTesto("1:75"), null);
  assert.equal(testoDelPasso("<b>x</b> {y}", {}), "x {y}");
});

test("gli aiutanti: i campi di ogni tipo, riempiti da uno che c'e', e per il ponte", () => {
  assert.deepEqual(
    campiDelTipo("input_number").map((c) => c.nome),
    ["name", "icon", "min", "max", "step", "unit_of_measurement", "mode"],
  );
  const valori = valoriDellAiutante("input_select", { name: "Modo", options: ["Casa", "Fuori"] });
  assert.equal(valori.options, "Casa\nFuori");
  assert.deepEqual(
    campiPerIlPonte("input_select", { name: "Modo", options: "Casa\n\nFuori\n" }).campi.options,
    ["Casa", "Fuori"],
  );
  /* Voci doppie, un minimo sopra il massimo, un'icona storta: si dice quale. */
  assert.equal(
    campiPerIlPonte("input_select", { name: "x", options: "a\na" }).sbagliato,
    "options",
  );
  assert.equal(campiPerIlPonte("input_number", { name: "x", min: 5, max: 1 }).sbagliato, "max");
  assert.equal(
    campiPerIlPonte("input_boolean", { name: "x", icon: "lampadina" }).sbagliato,
    "icon",
  );
  assert.deepEqual(campiPerIlPonte("input_datetime", { name: "x", cosa: "ora" }).campi, {
    name: "x",
    icon: "",
    has_date: false,
    has_time: true,
  });
  assert.equal(
    campiPerIlPonte("timer", { name: "x", duration: { hours: 1, minutes: 5, seconds: 0 } }).campi
      .duration,
    "01:05:00",
  );
});

test("le fasce di un programma scritte a mano", () => {
  assert.deepEqual(fasceDaTesto("8-12, 14:30-18"), [
    { from: "08:00:00", to: "12:00:00" },
    { from: "14:30:00", to: "18:00:00" },
  ]);
  assert.deepEqual(fasceDaTesto("22-24"), [{ from: "22:00:00", to: "24:00:00" }]);
  assert.equal(fasceDaTesto("9-8"), null, "al contrario");
  assert.equal(fasceDaTesto("8-12, 11-13"), null, "accavallate");
  assert.deepEqual(fasceDaTesto(""), []);
  assert.equal(fasceInTesto([{ from: "08:00:00", to: "12:00:00" }]), "08:00-12:00");
});
