/* Le finestre del gruppo «sicurezza»: ognuna dice prima la risposta, poi
 * quello su cui si agisce, e niente di quello che la casa non sa.
 *
 * Si disegnano con modelli finti, come li passa la Home: qui conta l'ordine,
 * che i comandi ci siano, che i nomi grezzi non escano, e che una parte senza
 * dati non compaia. */
import assert from "node:assert/strict";
import test from "node:test";
import { finestraDi } from "../src/sections/finestre-dei-widget.js";
import {
  FINESTRE_SICUREZZA,
  durata,
  nomePulitoDellaPila,
  nomePulitoDellaSonda,
} from "../src/sections/finestre/sicurezza.js";

const MINUTO = 60000;
const fa = (minuti) => Date.now() - minuti * MINUTO;
const disegna = (chiave, widget, states = {}) => finestraDi(chiave).disegna(widget, states);
const prima = (testo, a, b) => {
  const i = testo.indexOf(a);
  const j = testo.indexOf(b);
  assert.ok(i >= 0, `manca ${a}`);
  assert.ok(j >= 0, `manca ${b}`);
  return i < j;
};

test("tutte e otto le tessere hanno la loro finestra, con lo stile", () => {
  for (const chiave of FINESTRE_SICUREZZA) {
    const finestra = finestraDi(chiave);
    assert.ok(finestra, chiave);
    assert.match(finestra.stile, new RegExp(`\\.dm-f-${chiave}`));
  }
});

test("l'antifurto: stato, modi a schede, disinserimento col codice, cosa e' aperto", () => {
  const markup = disegna("sicurezza", {
    key: "sicurezza",
    value: "Inserito",
    armed: true,
    triggered: false,
    dalle: fa(30),
    modi: [
      { mode: "home", service: "alarm_arm_home", label: "Casa", hint: "Solo perimetro", on: true },
      {
        mode: "away",
        service: "alarm_arm_away",
        label: "Fuori",
        hint: "Inserimento totale",
        on: false,
      },
      {
        mode: "disarm",
        service: "alarm_disarm",
        label: "Sblocca",
        hint: "",
        on: false,
        codice: true,
      },
    ],
    daSapere: [
      { name: "Finestra cucina", glyph: "window", tipo: "finestra", stato: "aperto", da: fa(47) },
    ],
  });
  assert.match(markup, /Inserito/);
  assert.match(markup, /Modo Casa · dalle/);
  assert.match(markup, /data-dm-w-alarm="alarm_arm_home"[^>]*data-on="true"/);
  assert.match(markup, /data-dm-w-alarm="alarm_disarm"/);
  assert.match(markup, /Chiede il codice/);
  assert.match(markup, /da 47 min/);
  assert.ok(prima(markup, "Da sapere", "Cambia modo"));
  // Il nome del disegno non diventa una parola.
  assert.doesNotMatch(markup, />window</);
  // Niente storico inventato.
  assert.doesNotMatch(markup, /Ultimi eventi/);
});

test("l'antifurto spento non offre di disinserire, e senza varchi aperti tace", () => {
  const markup = disegna("sicurezza", {
    key: "sicurezza",
    value: "Disinserito",
    armed: false,
    modi: [
      { mode: "away", service: "alarm_arm_away", label: "Fuori", hint: "x", on: false },
      { mode: "disarm", service: "alarm_disarm", label: "Sblocca", hint: "", on: false },
    ],
    daSapere: [],
  });
  assert.doesNotMatch(markup, /alarm_disarm/);
  assert.doesNotMatch(markup, /Da sapere/);
  assert.match(markup, /data-tono="spento"/);
});

test("le telecamere riusano i segni dei fotogrammi della Home", () => {
  const markup = disegna("telecamere", {
    key: "telecamere",
    rows: [
      { entity: "camera.ingresso", name: "Ingresso" },
      { entity: "camera.giardino", name: "Giardino" },
    ],
    visti: [
      {
        camera: "camera.giardino",
        nome: "Giardino",
        parola: "Persona",
        segno: "👤",
        quando: fa(2),
      },
    ],
  });
  // La grande e' quella che vede qualcuno adesso.
  assert.match(markup, /dm-f-telecamere-big" data-dm-w-cam="camera\.giardino"/);
  assert.match(markup, /data-dm-w-cam="camera\.ingresso"/);
  assert.equal((markup.match(/data-dm-camera-state="loading"/g) || []).length, 2);
  assert.match(markup, /data-ora="true"/);
  assert.doesNotMatch(markup, /Letture|Registrazioni/);
});

test("i varchi: aperti in cima con da quanto, chiusi in griglia, muti a parte", () => {
  const markup = disegna("varchi", {
    key: "varchi",
    rows: [
      { name: "Porta ingresso", glyph: "door", tipo: "porta", stato: "aperto", da: fa(12) },
      { name: "Bagno", glyph: "window", tipo: "finestra", stato: "chiuso" },
      { name: "Cantina", glyph: "door", tipo: "porta", stato: "", da: fa(180) },
    ],
  });
  assert.ok(prima(markup, "Porta ingresso", "Bagno"));
  assert.ok(prima(markup, "Bagno", "Cantina"));
  assert.match(markup, /12 min/);
  assert.match(markup, /da 3 h/);
  assert.doesNotMatch(markup, />(door|window)</);
});

test("la presenza conta i posti, non i rilevatori", () => {
  const markup = disegna("presenza", {
    key: "presenza",
    rows: [
      { name: "Divano", stanza: "Salone", stato: "attivo", stabile: true, da: fa(60), glyph: "" },
      { name: "Porta", stanza: "Salone", stato: "attivo", stabile: false, da: fa(1), glyph: "" },
      { name: "Studio", stanza: "", stato: "libero", da: fa(30), glyph: "" },
      { name: "Garage", stanza: "", stato: "", glyph: "" },
    ],
  });
  assert.equal((markup.match(/dm-f-presenza-st" data-on="true"/g) || []).length, 1);
  assert.match(markup, /Occupato da 1 h/);
  assert.match(markup, /Libero da 30 min/);
  assert.match(markup, /Non risponde/);
  assert.doesNotMatch(markup, /Fermo/);
});

test("il fumo: una lista per tipo, la pila solo se si sa", () => {
  const states = {
    "binary_sensor.fumo": {
      state: "off",
      attributes: { device_class: "smoke", battery_level: 12 },
    },
    "binary_sensor.gas": { state: "on", attributes: { device_class: "gas" } },
  };
  const markup = disegna(
    "fumo",
    {
      key: "fumo",
      rows: [
        { entity: "binary_sensor.gas", name: "Gas cucina", on: true },
        { entity: "binary_sensor.fumo", name: "Fumo salone", on: false },
      ],
    },
    states,
  );
  assert.match(markup, /Allarme: Gas cucina/);
  assert.match(markup, /data-bassa="true">🪫 12%/);
  assert.equal((markup.match(/dm-f-fumo-pila/g) || []).length, 1);
  assert.match(markup, /Gas e monossido/);
  assert.doesNotMatch(markup, /a rete/);
});

test("gli allagamenti: la valvola c'e' solo se Home Assistant la dichiara", () => {
  const widget = {
    key: "allagamenti",
    rows: [{ entity: "binary_sensor.perdita_lavatrice", name: "Perdita lavatrice", on: false }],
  };
  const senza = disegna("allagamenti", { ...widget, valvole: [] });
  assert.doesNotMatch(senza, /Acqua di casa|data-dm-w-servizio/);
  assert.match(senza, />Lavatrice</);
  const con = disegna("allagamenti", {
    ...widget,
    valvole: [{ entity: "valve.generale", name: "Valvola generale", state: "open" }],
  });
  assert.match(con, /close_valve/);
  assert.match(con, /data-dm-w-conferma=/);
});

test("chi non risponde: dal piu' lungo, e il tasto riprova le entita' vere", () => {
  const markup = disegna("nonrisponde", {
    key: "nonrisponde",
    rows: [
      { name: "Luci vialetto", entity: "switch.vialetto", entita: ["switch.vialetto"], da: fa(20) },
      { name: "Pompa piscina", entity: "dispositivo:abc", entita: ["switch.pompa"], da: fa(300) },
    ],
  });
  assert.ok(prima(markup, "Pompa piscina", "Luci vialetto"));
  assert.match(markup, /data-lungo="true"/);
  assert.match(markup, /update_entity/);
  assert.match(markup, /switch\.pompa/);
  assert.doesNotMatch(markup, /dispositivo:abc/);
});

test("le batterie: da cambiare, le prossime, le cariche — senza «Batteria» nel nome", () => {
  const markup = disegna("batterie", {
    key: "batterie",
    soglia: 20,
    rows: [
      { entity: "sensor.a", name: "Sensore porta ingresso Batteria", level: 8 },
      { entity: "sensor.b", name: "Termostato Battery", level: 41 },
      { entity: "sensor.c", name: "Serratura", level: 90 },
    ],
  });
  assert.ok(prima(markup, "Sensore porta ingresso", "Termostato"));
  assert.ok(prima(markup, "Termostato", "Serratura"));
  assert.doesNotMatch(markup, /Batteria|Battery/);
  assert.match(markup, /soglia 20%/);
});

test("i nomi ripuliti e il da quanto", () => {
  assert.equal(nomePulitoDellaSonda("Perdita lavatrice"), "Lavatrice");
  assert.equal(nomePulitoDellaSonda("Sensore perdita acqua bagno"), "Bagno");
  assert.equal(nomePulitoDellaSonda("Perdita"), "Perdita");
  assert.equal(
    nomePulitoDellaPila("Valvola termostatica bagno Batteria"),
    "Valvola termostatica bagno",
  );
  assert.equal(nomePulitoDellaPila("Batteria"), "Batteria");
  assert.equal(durata(Date.now() - 47 * MINUTO), "47 min");
  assert.equal(durata(Date.now() - 3 * 60 * MINUTO), "3 h");
  assert.equal(durata(null), "");
});
