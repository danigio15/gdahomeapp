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
  altriModi,
  coppiaDellaFinestraMarkup,
  gradiScritti,
  misuraDiStanza,
  modiDelSegmentato,
  modiInOrdine,
  nomeDelModo,
  nomeDelModoFra,
  obiettivoSpostato,
  presetDaOffrire,
  nomeDelPreset,
  nomeDellaVentola,
  nomeDellAletta,
  potenzaDellaFinestra,
  statoDellaFinestra,
  tonoDelModo,
} from "../src/sections/home-widgets-section.js";
import { contenutoMarkup } from "../src/sections/report-del-clima-section.js";
import { coloreDeiGradi, versoDelProgramma } from "../src/sections/programma-del-clima-section.js";

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

test("le modalita' dell'integrazione («sleep») stanno in «Altre modalità», non fra i preset", () => {
  assert.deepEqual(modiDelSegmentato(["heat", "sleep", "off"]), ["off", "heat"]);
  assert.deepEqual(altriModi(["heat", "sleep", "off"]), ["sleep"]);
  assert.deepEqual(altriModi(["off", "cool"]), []);
});

test("i preset: «none» non conta, uno solo vero basta, mai due «Notte»", () => {
  assert.deepEqual(presetDaOffrire({ presets: ["none"], modi: ["heat"] }), []);
  assert.deepEqual(presetDaOffrire({ presets: ["boost"], modi: ["heat"] }), ["boost"]);
  assert.deepEqual(presetDaOffrire({ presets: ["none", "boost"], modi: ["heat"] }), ["none", "boost"]);
  // «sleep» e' gia' fra le Altre modalita': il preset omonimo non si offre.
  assert.deepEqual(presetDaOffrire({ presets: ["none", "sleep", "eco"], modi: ["heat", "sleep"] }), ["none", "eco"]);
});

test("«Caldo e freddo» si chiama «Auto» se l'unita' non ha anche «auto»", () => {
  assert.equal(nomeDelModoFra("heat_cool", ["off", "heat", "cool", "heat_cool"]), "Auto");
  assert.equal(nomeDelModoFra("heat_cool", ["heat_cool", "auto"]), "Caldo e freddo");
  assert.equal(nomeDelModoFra("cool", ["cool"]), "Freddo");
});

test("il passo dell'obiettivo e' quello dell'unita': passo, scala, arrotondamento", () => {
  const pompa = { target: 45, passo: 0.5, minima: 5, massima: 60, obiettivi: { doppio: false } };
  assert.equal(obiettivoSpostato(pompa, 1), 45.5);
  assert.equal(obiettivoSpostato(pompa, -1), 44.5);
  // Dallo schermo, gia' avanti di qualche tocco.
  assert.equal(obiettivoSpostato(pompa, 1, 59.5), 60);
  // A fine corsa non parte niente.
  assert.equal(obiettivoSpostato(pompa, 1, 60), null);
  assert.equal(obiettivoSpostato({ ...pompa, target: 5 }, -1), null);
  // Un numero fuori dal passo torna sul passo.
  assert.equal(obiettivoSpostato({ ...pompa, passo: 1 }, 1, 20.5), 22);
  // Coi due obiettivi, o senza obiettivo, non e' affar suo.
  assert.equal(obiettivoSpostato({ ...pompa, obiettivi: { doppio: true } }, 1), undefined);
  assert.equal(obiettivoSpostato({ ...pompa, target: null }, 1), undefined);
});

test("«in stanza» solo per chi scalda o raffresca una stanza", () => {
  assert.equal(misuraDiStanza({ stanza: "Salone", name: "Salone", entity: "climate.salone" }), true);
  assert.equal(misuraDiStanza({ stanza: "Locale tecnico", name: "Pompa di calore", entity: "climate.pdc" }), false);
  assert.equal(misuraDiStanza({ stanza: "Bagno", name: "ACS", entity: "climate.acs" }), false);
  assert.equal(misuraDiStanza({ stanza: "", name: "Salone", entity: "climate.salone" }), false);
});

test("i gradi si scrivono con la virgola e senza decimali inutili", () => {
  assert.equal(gradiScritti(20), "20°");
  assert.equal(gradiScritti(20.5), "20,5°");
  assert.equal(gradiScritti(null), "--°");
});

test("la coppia nella testata: Minima (caldo) e Massima (freddo), ognuna coi suoi tasti", () => {
  const html = coppiaDellaFinestraMarkup({
    entity: "climate.doppio",
    obiettivi: { doppio: true, basso: 20.5, alto: 24.5, mostra: "entrambi" },
  });
  assert.match(html, /Minima \(caldo\)/);
  assert.match(html, /Massima \(freddo\)/);
  assert.match(html, /<b>20,5°<\/b>/);
  assert.match(html, /<b>24,5°<\/b>/);
  assert.equal((html.match(/data-dm-w-temp=/g) || []).length, 4);
  assert.doesNotMatch(html, /20\.5/);
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
  // Senza hvac_action si dice il modo, con la parola del segmentato — e se
  // il segmentato lo mostra gia', la pastiglia non si scrive.
  const senza = statoDellaFinestra({ acceso: true, on: true, mode: "heat", modi: ["off", "heat"] });
  assert.equal(senza.parola, "Caldo");
  assert.equal(senza.ripete, true);
  assert.equal(statoDellaFinestra({ acceso: false, mode: "off", modi: ["off", "heat"] }).ripete, true);
  assert.equal(statoDellaFinestra({ acceso: false, mode: "off", modi: ["heat"] }).ripete, false);
});

test("un'unita' che non risponde e' «Non disponibile», senza accensione", () => {
  const morta = { disponibile: false, acceso: false, mode: "unavailable", modi: [] };
  const stato = statoDellaFinestra(morta);
  assert.equal(stato.parola, "Non disponibile");
  assert.equal(stato.verso, "assente");
  assert.equal(potenzaDellaFinestra(morta), "via");
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

test("una stima senza caldaia non parla della caldaia", () => {
  const stima = contenutoMarkup({ ...report({ secchielli: giorni(() => ({ ms: 0, noto: true })) }), stima: true });
  assert.doesNotMatch(stima, /La caldaia non si è mai accesa|Caldaia accesa/);
  assert.match(stima, /Impianto acceso/);
  assert.match(stima, /data-dm-rcl-grafico-vuoto>Nessuna accensione in questo periodo\./);
});

test("le stanze: il numero una volta sola, a destra; la riga dice da dove viene", () => {
  const base = report({ secchielli: giorni(() => ({ ms: 3_600_000, noto: true })) });
  base.stanze[0] = { ...base.stanze[0], msAccesa: 3_600_000, stimaDa: ["consumi"], richiestaStimata: true };
  const html = contenutoMarkup(base);
  const riga = html.slice(html.indexOf('data-dm-rcl-stanza="climate.s0"'));
  assert.equal((riga.match(/1 h/g) || []).length, 1);
  assert.match(riga, /data-dm-rcl-richiesta>richiesta dai consumi</);
  // «accesa» uguale alla richiesta non si ripete.
  assert.doesNotMatch(riga, /data-dm-rcl-accesa/);
});

test("senza ore di richiesta niente classifica 1, 2, 3", () => {
  const base = report({ secchielli: giorni(() => ({ ms: 0, noto: false })), stanze: 3 });
  base.stanze = base.stanze.map((s) => ({ ...s, msRichiesta: null }));
  const html = contenutoMarkup(base);
  assert.doesNotMatch(html, /dm-rcl-pos/);
});

test("in raffrescamento la valvola non c'e'", () => {
  const freddo = contenutoMarkup({ ...report({ secchielli: giorni(() => ({ ms: 3_600_000, noto: true })) }), impianto: "freddo" });
  assert.doesNotMatch(freddo, /data-dm-rcl-tessera="valvola"/);
  assert.match(freddo, /data-quante="3"/);
});

test("il Programma: ambra per chi scalda, azzurro per chi raffresca", () => {
  assert.match(coloreDeiGradi(20), /#ea580c/);
  assert.match(coloreDeiGradi(24, "freddo"), /#0284c7/);
  assert.equal(versoDelProgramma({ modo: "cool" }), "freddo");
  assert.equal(versoDelProgramma({ tipo: "clima" }), "freddo");
  assert.equal(versoDelProgramma({ tipo: "clima", modo: "heat" }), "caldo");
  assert.equal(versoDelProgramma({ zone: ["freddo"] }), "freddo");
  assert.equal(versoDelProgramma({ zone: ["caldo", "freddo"] }), "caldo");
});

test("la nota lunga sta in «Come si calcola», a scomparsa", () => {
  const html = contenutoMarkup(report({ secchielli: giorni(() => ({ ms: 3_600_000, noto: true })) }));
  assert.match(html, /<details class="dm-rcl-come"><summary>Come si calcola<\/summary>/);
});
