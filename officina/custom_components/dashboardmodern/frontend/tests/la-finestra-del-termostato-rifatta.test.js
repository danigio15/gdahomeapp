/* La finestra del termostato, rifatta, e il report del clima come scheda.
 *
 * «Graficamente riesci a fare meglio?» Nella finestra l'obiettivo era scritto
 * due volte, le modalita' e i preset stavano mescolati in pastiglie col nome
 * grezzo («sleep»), Spegni e Accendi dicevano quello che «Spento» gia' dice.
 * Qui si tengono ferme le parole e le scelte che la finestra fa adesso: in
 * che ordine stanno le modalita', come si chiamano, di che colore sono, cosa
 * dice la pastiglia in cima e quando i bottoni di accensione se ne vanno. E
 * nel report: «1 stanza», non «1 stanze»; un grafico vuoto dice perche'.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  modiComePreset,
  modiDelSegmentato,
  modiInOrdine,
  nomeDelModo,
  nomeDelPreset,
  nomeDellaVentola,
  nomeDellAletta,
  potenzaDellaFinestra,
  statoDellaFinestra,
  tonoDelModo,
} from "../src/sections/home-widgets-section.js";
import { contenutoMarkup } from "../src/sections/report-del-clima-section.js";

test("le modalita': Spento per prima, poi le note, poi quelle dell'integrazione", () => {
  assert.deepEqual(modiInOrdine(["heat", "sleep", "off"]), ["off", "heat", "sleep"]);
  assert.deepEqual(modiInOrdine(["fan_only", "dry", "cool", "heat", "heat_cool", "off"]), [
    "off",
    "heat",
    "cool",
    "heat_cool",
    "dry",
    "fan_only",
  ]);
});

test("le modalita' dell'integrazione («sleep») stanno con i preset, non nel segmentato", () => {
  assert.deepEqual(modiDelSegmentato(["heat", "sleep", "off"]), ["off", "heat"]);
  assert.deepEqual(modiComePreset(["heat", "sleep", "off"]), ["sleep"]);
  assert.deepEqual(modiComePreset(["off", "cool"]), []);
});

test("i nomi si leggono: «sleep» e' Notte, uno sconosciuto prende la maiuscola", () => {
  assert.equal(nomeDelModo("sleep"), "Notte");
  assert.equal(nomeDelModo("heat"), "Caldo");
  assert.equal(nomeDelModo("off"), "Spento");
  assert.equal(nomeDelModo("antigelo_casa"), "Antigelo casa");
  assert.equal(nomeDelPreset("away"), "Fuori casa");
  assert.equal(nomeDelPreset("none"), "Nessuno");
  assert.equal(nomeDelPreset("vacanza"), "Vacanza");
  assert.equal(nomeDellaVentola("medium"), "Media");
  assert.equal(nomeDellaVentola("Silence"), "Silenziosa");
  assert.equal(nomeDellAletta("vertical"), "Verticali");
});

test("un colore per volta: caldo, freddo, spento, notte", () => {
  assert.equal(tonoDelModo("heat"), "caldo");
  assert.equal(tonoDelModo("cool"), "freddo");
  assert.equal(tonoDelModo("off"), "spento");
  assert.equal(tonoDelModo("sleep"), "notte");
  assert.equal(tonoDelModo("auto"), "auto");
  // Un modo che non si conosce prende il colore della macchina.
  assert.equal(tonoDelModo("comfort", "termo"), "caldo");
  assert.equal(tonoDelModo("comfort", "clima"), "freddo");
});

test("la pastiglia in cima dice cosa fa adesso, non cosa potrebbe fare", () => {
  assert.deepEqual(statoDellaFinestra({ acceso: false, on: false, mode: "off" }).verso, "spento");
  assert.equal(statoDellaFinestra({ acceso: true, on: true, mode: "heat", azione: "heating" }).parola, "Scalda");
  assert.equal(statoDellaFinestra({ acceso: true, on: true, mode: "cool", azione: "cooling" }).tono, "freddo");
  const fermo = statoDellaFinestra({ acceso: true, on: false, mode: "heat", azione: "idle" });
  assert.equal(fermo.verso, "attesa");
  assert.equal(fermo.parola, "In attesa");
  assert.equal(fermo.tono, "caldo");
  // Senza hvac_action si dice il modo.
  assert.equal(statoDellaFinestra({ acceso: true, on: true, mode: "heat" }).parola, "Riscaldamento");
});

test("Spegni e Accendi se ne vanno quando Spento e' fra le modalita'", () => {
  assert.equal(potenzaDellaFinestra({ modi: ["off", "heat"], acceso: true }), "via");
  assert.equal(potenzaDellaFinestra({ modi: ["heat"], acceso: true }), "spegni");
  assert.equal(potenzaDellaFinestra({ modi: [], acceso: false }), "accendi");
  // Un elenco col solo «off» non e' una scelta: resta il bottone.
  assert.equal(potenzaDellaFinestra({ modi: ["off"], acceso: false }), "accendi");
});

const GIORNO = 86_400_000;
const inizio = Date.UTC(2026, 0, 5);

function report({ secchielli, stanze = 1, valvole = 1 }) {
  return {
    vuoto: false,
    impianto: "caldo",
    stima: false,
    generatori: [{ nome: "Caldaia", ms: 0, accensioni: 1 }],
    totali: {
      msGeneratore: secchielli.reduce((s, x) => s + x.ms, 0),
      accensioni: 1,
      consumo: null,
      kwhStanze: null,
      msRichiesta: 3_600_000,
      ambiente: 20,
      ambienteComfort: null,
      obiettivoComfort: null,
      valvola: 10,
    },
    periodo: { vista: "settimana", passo: "giorno", inizio, prossimo: inizio + 7 * GIORNO },
    secchielli,
    stanze: Array.from({ length: stanze }, (_, i) => ({
      entity: `climate.s${i}`,
      nome: `Stanza ${i}`,
      stanza: "",
      msRichiesta: 3_600_000,
      msAccesa: null,
      valvola: i < valvole ? 10 : null,
      ambiente: 20,
      ambienteComfort: null,
      obiettivoComfort: null,
      kwh: null,
    })),
    fonti: { storia: 7 },
    nascoste: 0,
  };
}

const giorni = (fn) => Array.from({ length: 7 }, (_, i) => ({ inizio: inizio + i * GIORNO, ...fn(i) }));

test("«1 stanza» e «1 valvola», al singolare", () => {
  const html = contenutoMarkup(report({ secchielli: giorni(() => ({ ms: 3_600_000, noto: true })) }));
  assert.match(html, />1 stanza</);
  assert.match(html, />1 valvola</);
  assert.match(html, />1 accensione</);
  assert.doesNotMatch(html, /1 stanze|1 valvole|1 accensioni/);
});

test("un grafico vuoto dice perche': mai accesa, oppure nessun dato", () => {
  const spenta = contenutoMarkup(report({ secchielli: giorni(() => ({ ms: 0, noto: true })) }));
  assert.match(spenta, /data-dm-rcl-grafico-vuoto>La caldaia non si è mai accesa in questo periodo\./);
  const ignoto = contenutoMarkup(report({ secchielli: giorni(() => ({ ms: 0, noto: false })) }));
  assert.match(ignoto, /data-dm-rcl-grafico-vuoto>Nessun dato per questo periodo/);
  /* Qualche giorno senza dati: niente avviso sopra, una legenda sotto. */
  const mezzo = contenutoMarkup(
    report({ secchielli: giorni((i) => (i < 3 ? { ms: 0, noto: false } : { ms: 3_600_000, noto: true })) }),
  );
  assert.doesNotMatch(mezzo, /data-dm-rcl-grafico-vuoto/);
  assert.match(mezzo, /class="dm-rcl-legenda"><i aria-hidden="true"><\/i>3 giorni senza dati/);
});

test("la nota lunga sta in «Come si calcola», a scomparsa", () => {
  const html = contenutoMarkup(report({ secchielli: giorni(() => ({ ms: 3_600_000, noto: true })) }));
  assert.match(html, /<details class="dm-rcl-come"><summary>Come si calcola<\/summary>/);
});
