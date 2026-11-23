/* «Sarebbe comodo avere il tasto per aprire e chiudere la valvola dell'acqua
 * nella tessera allagamenti» (#495).
 *
 * Le regole che contano sono tre: cosa si puo' scegliere come valvola (anche
 * un rele'), quale servizio la chiude davvero — su un rele' normalmente
 * aperto chiudere vuol dire ACCENDERE — e che il tasto non sbagli mai verso.
 * Poi il resto: la conferma prima di chiudere, il «In chiusura» subito dopo
 * il tocco, e con una perdita il tasto rosso al primo posto.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  ATTESA_MASSIMA_MS,
  CHIAVE_VALVOLA_ACQUA,
  acquaCheScorre,
  attesaArrivata,
  attesaValida,
  comandoDellaValvola,
  normalizzaValvolaDellAcqua,
  puoEssereLaValvola,
  statoComeValve,
  statoDellaValvola,
  valvoleDellAcqua,
} from "../src/core/la-valvola-dell-acqua.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";
import {
  cartaDellaValvola,
  parolaDelloStato,
  rigaDellaTessera,
  rigaDiAdesso,
  schedaDellaValvolaMarkup,
} from "../src/sections/la-valvola-dell-acqua-section.js";

const leggi = (quale) => readFileSync(new URL(quale, import.meta.url), "utf8");
const ADESSO = Date.parse("2026-11-23T10:00:00Z");
const s = (state, attributes = {}) => ({ state, attributes });

test("si sceglie una valvola, un interruttore o un input_boolean, e basta", () => {
  for (const id of ["valve.acqua_generale", "switch.rele_acqua", "input_boolean.acqua"])
    assert.equal(puoEssereLaValvola(id), true, id);
  for (const id of ["light.cucina", "sensor.acqua", "valve", "", "switch.", "valve.a b"])
    assert.equal(puoEssereLaValvola(id), false, id);
});

test("la scelta, ripulita: l'entita', il nome e il verso del rele'", () => {
  assert.equal(CHIAVE_VALVOLA_ACQUA, "cd_valvola_acqua");
  const vuota = { entity: "", nome: "", inverti: false };
  assert.deepEqual(normalizzaValvolaDellAcqua(null), vuota);
  assert.deepEqual(normalizzaValvolaDellAcqua({}), vuota);
  assert.deepEqual(normalizzaValvolaDellAcqua({ entity: "light.cucina" }), vuota);
  /* Scritta nuda, come la scriverebbe uno a mano. */
  assert.deepEqual(normalizzaValvolaDellAcqua(" valve.acqua "), {
    entity: "valve.acqua",
    nome: "",
    inverti: false,
  });
  assert.deepEqual(
    normalizzaValvolaDellAcqua({ entity: "switch.rele", nome: "  Acqua di casa ", inverti: true }),
    { entity: "switch.rele", nome: "Acqua di casa", inverti: true },
  );
  /* Su un valve.* la spunta non conta: la valvola dice da se' com'e'. */
  assert.equal(normalizzaValvolaDellAcqua({ entity: "valve.a", inverti: true }).inverti, false);
  /* Solo un «si'» scritto inverte. */
  assert.equal(normalizzaValvolaDellAcqua({ entity: "switch.a", inverti: "true" }).inverti, false);
  assert.equal(
    normalizzaValvolaDellAcqua({ entity: "switch.a", nome: "x".repeat(80) }).nome.length,
    40,
  );
});

test("lo stato: le parole di una valvola, e acceso e spento di un rele'", () => {
  assert.equal(statoDellaValvola("valve.a", s("open")), "aperta");
  assert.equal(statoDellaValvola("valve.a", s("closed")), "chiusa");
  assert.equal(statoDellaValvola("valve.a", s("opening")), "in-apertura");
  assert.equal(statoDellaValvola("valve.a", s("closing")), "in-chiusura");
  assert.equal(statoDellaValvola("valve.a", s("unavailable")), "muta");
  assert.equal(statoDellaValvola("valve.a", undefined), "muta");
  /* Un valve.* che dice «on» non e' una valvola che si sappia leggere. */
  assert.equal(statoDellaValvola("valve.a", s("on")), "muta");
  assert.equal(statoDellaValvola("switch.a", s("on")), "aperta");
  assert.equal(statoDellaValvola("switch.a", s("off")), "chiusa");
  assert.equal(statoDellaValvola("input_boolean.a", s("on")), "aperta");
  assert.equal(statoDellaValvola("switch.a", s("unknown")), "muta");
  /* Il rele' della valvola normalmente aperta: acceso e' l'acqua chiusa. */
  assert.equal(statoDellaValvola("switch.a", s("on"), { inverti: true }), "chiusa");
  assert.equal(statoDellaValvola("switch.a", s("off"), { inverti: true }), "aperta");
});

test("il comando: il servizio giusto, e su un rele' invertito chiudere e' accendere", () => {
  assert.deepEqual(comandoDellaValvola("valve.a", "chiudi"), {
    domain: "valve",
    service: "close_valve",
    data: { entity_id: "valve.a" },
  });
  assert.equal(comandoDellaValvola("valve.a", "apri").service, "open_valve");
  /* La spunta su un valve.* non cambia niente: la valvola ha i suoi servizi. */
  assert.equal(comandoDellaValvola("valve.a", "chiudi", { inverti: true }).service, "close_valve");
  assert.deepEqual(comandoDellaValvola("switch.rele", "chiudi"), {
    domain: "switch",
    service: "turn_off",
    data: { entity_id: "switch.rele" },
  });
  assert.equal(comandoDellaValvola("switch.rele", "apri").service, "turn_on");
  assert.equal(comandoDellaValvola("switch.rele", "chiudi", { inverti: true }).service, "turn_on");
  assert.equal(comandoDellaValvola("switch.rele", "apri", { inverti: true }).service, "turn_off");
  assert.equal(comandoDellaValvola("input_boolean.acqua", "chiudi").domain, "input_boolean");
  assert.equal(comandoDellaValvola("light.cucina", "chiudi"), null);
  assert.equal(comandoDellaValvola("valve.a", "gira"), null);
  /* Il comando e lo stato si danno ragione: dopo «chiudi» lo stato e' chiusa,
   * con e senza la spunta. */
  for (const inverti of [false, true]) {
    const { service } = comandoDellaValvola("switch.r", "chiudi", { inverti });
    const dopo = service === "turn_on" ? "on" : "off";
    assert.equal(statoDellaValvola("switch.r", s(dopo), { inverti }), "chiusa");
  }
});

test("subito dopo il tocco la valvola e' in movimento, finche' lo stato non arriva", () => {
  const attesa = { verso: "chiusura", da: ADESSO - 2000 };
  const opzioni = { attesa, adesso: ADESSO };
  assert.equal(statoDellaValvola("valve.a", s("open"), opzioni), "in-chiusura");
  assert.equal(statoDellaValvola("valve.a", s("closing"), opzioni), "in-chiusura");
  assert.equal(statoDellaValvola("valve.a", s("closed"), opzioni), "chiusa");
  assert.equal(statoDellaValvola("switch.a", s("on"), opzioni), "in-chiusura");
  assert.equal(
    statoDellaValvola("valve.a", s("closed"), {
      attesa: { verso: "apertura", da: ADESSO },
      adesso: ADESSO,
    }),
    "in-apertura",
  );
  /* Oltre il minuto il comando e' andato perso: si torna allo stato vero. */
  const vecchia = { verso: "chiusura", da: ADESSO - ATTESA_MASSIMA_MS - 1 };
  assert.equal(attesaValida(vecchia, ADESSO), false);
  assert.equal(
    statoDellaValvola("valve.a", s("open"), { attesa: vecchia, adesso: ADESSO }),
    "aperta",
  );
  assert.equal(attesaValida({ verso: "boh", da: ADESSO }, ADESSO), false);
  assert.equal(attesaArrivata(attesa, "chiusa"), true);
  assert.equal(attesaArrivata(attesa, "aperta"), false);
  assert.equal(acquaCheScorre("aperta"), true);
  assert.equal(acquaCheScorre("in-apertura"), true);
  assert.equal(acquaCheScorre("in-chiusura"), false);
  assert.equal(acquaCheScorre("muta"), false);
});

test("le valvole della finestra: la scelta per prima, poi quelle dichiarate, senza doppioni", () => {
  const states = {
    "valve.generale": s("open", { device_class: "water", friendly_name: "Valvola generale" }),
    "valve.irrigazione": s("closed", { friendly_name: "Irrigazione" }),
    "switch.rele_acqua": s("on", { friendly_name: "Relè 1" }),
  };
  const nessuna = valvoleDellAcqua({}, states, { adesso: ADESSO });
  assert.deepEqual(
    nessuna.map((v) => [v.entity, v.stato, v.scelta]),
    [["valve.generale", "aperta", false]],
  );
  const scelta = valvoleDellAcqua(
    { entity: "switch.rele_acqua", nome: "Acqua di casa", inverti: true },
    states,
    { attese: { "valve.generale": { verso: "chiusura", da: ADESSO } }, adesso: ADESSO },
  );
  assert.deepEqual(
    scelta.map((v) => [v.entity, v.name, v.stato, v.scelta]),
    [
      ["switch.rele_acqua", "Acqua di casa", "chiusa", true],
      ["valve.generale", "Valvola generale", "in-chiusura", false],
    ],
  );
  /* Scelta due volte non vale due: la dichiarata scelta resta una. */
  assert.equal(valvoleDellAcqua({ entity: "valve.generale" }, states).length, 1);
  /* La scelta c'e' anche quando non risponde: e' proprio allora che serve
   * vederla. */
  assert.deepEqual(
    valvoleDellAcqua({ entity: "valve.sparita" }, {}).map((v) => [v.entity, v.stato]),
    [["valve.sparita", "muta"]],
  );
  assert.equal(statoComeValve("chiusa"), "closed");
  assert.equal(statoComeValve("in-apertura"), "opening");
  assert.equal(statoComeValve("muta"), "unavailable");
});

test("la carta: lo stato a colori e il tasto giusto per ogni stato", () => {
  const carta = (stato, opzioni) =>
    cartaDellaValvola({ entity: "valve.a", name: "Acqua <di> casa", stato }, opzioni);
  assert.match(
    carta("aperta"),
    /data-stato="aperta"[\s\S]*Aperta[\s\S]*data-dm-valvola-fa="chiudi"[^>]*>Chiudi</,
  );
  assert.match(carta("chiusa"), /data-dm-valvola-fa="apri"[^>]*>Apri</);
  /* In movimento non c'e' tasto: un secondo tocco a meta' strada farebbe
   * solo confusione. */
  assert.match(carta("in-chiusura"), /data-muove="true"[\s\S]*In chiusura…/);
  assert.doesNotMatch(carta("in-chiusura"), /data-dm-valvola-fa/);
  assert.doesNotMatch(carta("muta"), /data-dm-valvola-fa/);
  assert.match(carta("muta"), /Non risponde/);
  assert.match(carta("aperta"), /Acqua &lt;di&gt; casa/);
  /* Con una perdita: rosso e largo, con le parole della cosa da fare. */
  assert.match(
    carta("aperta", { perdita: true }),
    /data-perdita="true"[\s\S]*class="dm-valv-tasto dm-valv-rosso dm-valv-largo"[^>]*>Chiudi l&#39;acqua</,
  );
  assert.match(carta("chiusa", { perdita: true }), /L&#39;acqua è ferma\./);
  assert.equal(cartaDellaValvola({ entity: "" }), "");
});

test("chiudere chiede conferma, e la conferma resta finche' non scade", () => {
  const memoria = globalThis.__DASHBOARDMODERN_VALVOLA_ACQUA__;
  assert.ok(memoria, "la sezione tiene la sua memoria");
  memoria.armata = { entity: "valve.a", verso: "chiusura", fino: ADESSO + 5000 };
  const armata = cartaDellaValvola(
    { entity: "valve.a", name: "Acqua", stato: "aperta" },
    { adesso: ADESSO },
  );
  assert.match(armata, /data-armata="true"/);
  assert.match(armata, /Chiudere l&#39;acqua\?/);
  assert.match(armata, /data-dm-valvola-fa="annulla"/);
  assert.match(armata, /data-dm-valvola-fa="conferma-chiudi"[^>]*>Sì, chiudi</);
  assert.doesNotMatch(armata, /data-dm-valvola-fa="chiudi"/);
  /* Un'altra valvola non e' armata. */
  assert.match(
    cartaDellaValvola({ entity: "valve.b", name: "B", stato: "aperta" }, { adesso: ADESSO }),
    /data-armata="false"/,
  );
  /* Scaduta, torna il tasto di prima. */
  assert.match(
    cartaDellaValvola({ entity: "valve.a", name: "A", stato: "aperta" }, { adesso: ADESSO + 6000 }),
    /data-armata="false"[\s\S]*data-dm-valvola-fa="chiudi"/,
  );
  assert.equal(memoria.armata, null);
  /* Riaprire con una perdita chiede conferma anche lui. */
  memoria.armata = { entity: "valve.a", verso: "apertura", fino: ADESSO + 5000 };
  assert.match(
    cartaDellaValvola(
      { entity: "valve.a", name: "A", stato: "chiusa" },
      { perdita: true, adesso: ADESSO },
    ),
    /Una sonda è ancora bagnata[\s\S]*data-dm-valvola-fa="conferma-apri"/,
  );
  memoria.armata = null;
});

test("le parole: nella carta e sotto la tessera", () => {
  assert.equal(parolaDelloStato("aperta"), "Aperta");
  assert.equal(parolaDelloStato("in-apertura"), "In apertura…");
  assert.equal(rigaDellaTessera({ stato: "aperta" }), "Acqua aperta");
  assert.equal(rigaDellaTessera({ stato: "chiusa" }), "Acqua chiusa");
  assert.equal(rigaDellaTessera({ stato: "in-chiusura" }), "Acqua in chiusura…");
  assert.equal(rigaDellaTessera(undefined), "");
});

test("la scheda: l'entita', il nome, la spunta dei rele' e cosa dice adesso", () => {
  const states = { "switch.rele": s("on"), "valve.a": s("closed") };
  const rele = schedaDellaValvolaMarkup(
    normalizzaValvolaDellAcqua({ entity: "switch.rele", nome: "Acqua", inverti: true }),
    states,
  );
  assert.match(rele, /data-vacq-entity value="switch\.rele"/);
  assert.match(rele, /data-vacq-nome maxlength="40" value="Acqua"/);
  assert.match(rele, /data-vacq-inverti-riga>/);
  assert.match(rele, /<input type="checkbox" data-vacq-inverti checked>/);
  assert.match(rele, /Adesso: Chiusa/);
  assert.match(rele, /data-vacq-salva/);
  /* Su una valvola la spunta non si vede: non servirebbe. */
  const valvola = schedaDellaValvolaMarkup(normalizzaValvolaDellAcqua("valve.a"), states);
  assert.match(valvola, /data-vacq-inverti-riga hidden/);
  assert.match(
    schedaDellaValvolaMarkup(normalizzaValvolaDellAcqua({}), {}),
    /data-vacq-inverti-riga hidden/,
  );
  assert.equal(rigaDiAdesso("", false, states), "");
  assert.match(rigaDiAdesso("light.x", false, states), /Serve una valvola/);
  assert.match(rigaDiAdesso("valve.manca", false, states), /non c'è in Home Assistant/);
});

test("la valvola viaggia con la configurazione, e la sezione si installa dopo le sonde", () => {
  assert.ok(CONFIG_KEYS.includes(CHIAVE_VALVOLA_ACQUA));
  const runtime = leggi("../src/sections/section-runtime.js");
  assert.match(runtime, /senzaCadere\(installValvolaDellAcqua\)/);
  assert.ok(
    runtime.indexOf("senzaCadere(installValvolaDellAcqua)") >
      runtime.indexOf("senzaCadere(installFloodAlertsSection)"),
  );
  assert.match(leggi("../src/sections/cerca-nel-config-section.js"), /cd_valvola_acqua: "avvisi"/);
  /* La tessera dice com'e' l'acqua, e la finestra ha le valvole con il loro
   * comando: anche l'assistente di casa chiude un rele' col servizio giusto. */
  const home = leggi("../src/sections/home-widgets-section.js");
  assert.match(home, /sottotitolo: rigaDellaTessera\(valvole\[0\]\)/);
  assert.match(
    home,
    /chiudi: comandoDellaValvola\(valvola\.entity, "chiudi", \{ inverti: valvola\.inverti \}\)/,
  );
  assert.match(
    leggi("../src/sections/assistente-di-casa-section.js"),
    /dominio: v\.chiudi\.domain/,
  );
  /* Chi ha chiesto meno animazioni non vede pulsare niente. */
  assert.match(
    leggi("../src/sections/la-valvola-dell-acqua-section.js"),
    /@media \(prefers-reduced-motion:reduce\)\{[^\n]*?animation:none/,
  );
});
