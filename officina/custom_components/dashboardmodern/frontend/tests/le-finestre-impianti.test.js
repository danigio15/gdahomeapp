/* Le finestre degli impianti (vedi `src/sections/finestre/impianti.js`).
 *
 * Qui si tiene fermo quello che conta di ogni finestra senza una casa vera:
 * la risposta in cima, i comandi subito sotto e col servizio giusto, i nomi
 * umani al posto di quelli delle entità, e le parti che spariscono quando il
 * dato non c'è — niente numeri d'esempio.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const { finestraDi, stiliDelleFinestre } = await import("../src/sections/finestre-dei-widget.js");
const { FINESTRE_IMPIANTI } = await import("../src/sections/finestre/impianti.js");
const { analisiDellaSezione } = await import("../src/core/analisi-sezione.js");

/* Gli apostrofi escono protetti (`&#39;`): qui si leggono come si vedono. */
const disegna = (chiave, widget, states = {}) =>
  finestraDi(chiave).disegna(widget, states).replaceAll("&#39;", "'");
const it = (testo) => testo;
const posto = (markup, cosa) => markup.indexOf(cosa);

test("tutte le tessere del gruppo hanno la loro finestra, con un foglio solo", () => {
  assert.deepEqual(
    [...FINESTRE_IMPIANTI],
    ["scaldabagno", "caldaia", "ups", "accumulo", "contatori", "piscina", "irrigazione", "vmc"],
  );
  for (const chiave of FINESTRE_IMPIANTI) assert.ok(finestraDi(chiave), chiave);
  const foglio = stiliDelleFinestre();
  assert.match(foglio, /#dm-widget-popup,#dm-casa-popup,#dm-qa-popup\) \.dm-f-imp\{/);
  /* Le classi sono tutte del gruppo: niente che pesti la finestra generica. */
  for (const classe of foglio.match(/\.dm-[a-z-]+/g)) assert.match(classe, /^\.dm-f-/);
});

test("lo scaldabagno: l'acqua in cima, poi la resistenza e l'obiettivo coi tasti", () => {
  const lettura = {
    name: "Bagno",
    comandabile: "switch.scaldabagno",
    acceso: true,
    temperatura: 41.6,
    obiettivo: 55,
    obiettivoEntita: "input_number.obiettivo",
    potenza: 1180,
    energia: 2.3,
    quota: 0.67,
    stato: "scalda",
    da: Date.now() - 47 * 60000,
  };
  const states = {
    "input_number.obiettivo": { state: "55", attributes: { min: 30, max: 55, step: 1 } },
  };
  const markup = disegna("scaldabagno", { unita: [lettura] }, states);
  assert.match(markup, /dm-f-scaldabagno-serbatoio/);
  assert.match(markup, /41,6°/);
  assert.match(markup, /scalda da 47 minuti/);
  assert.match(markup, /Scalda · 1,18 kW/);
  /* L'eroe prima dei comandi, i comandi prima dell'oggi. */
  assert.ok(
    posto(markup, "dm-f-scaldabagno-eroe") < posto(markup, 'data-dm-f-comando="resistenza"'),
  );
  assert.ok(
    posto(markup, 'data-dm-f-comando="obiettivo"') < posto(markup, 'data-dm-f-casella="consumato"'),
  );
  assert.match(markup, /data-dm-w-light="switch\.scaldabagno"/);
  /* Il + chiama il servizio dell'input_number col valore nuovo, e al massimo
   * dichiarato si spegne. */
  assert.match(markup, /&quot;service&quot;:&quot;set_value&quot;.*&quot;value&quot;:54/);
  assert.match(markup, /data-dm-f-obiettivo="su" disabled/);
  /* Il costo solo con un prezzo: qui nessuno l'ha detto. */
  assert.doesNotMatch(markup, /€/);
  /* Uno scaldabagno solo non si nomina. */
  assert.doesNotMatch(markup, /dm-f-imp-nome/);
});

test("lo scaldabagno senza obiettivo: niente serbatoio, niente tasti", () => {
  const markup = disegna("scaldabagno", {
    unita: [{ name: "", acceso: false, temperatura: 38, stato: "spento", comandabile: "" }],
  });
  assert.doesNotMatch(markup, /serbatoio/);
  assert.doesNotMatch(markup, /data-dm-f-obiettivo/);
  assert.doesNotMatch(markup, /data-dm-f-comando/);
});

test("la caldaia: il giro mandata/ritorno, il giudizio sul salto e l'interruttore", () => {
  const lettura = {
    inFunzione: true,
    fiamma: true,
    uscita: "radiatori",
    interruttore: "switch.caldaia",
    interruttoreAcceso: true,
    mandata: 58.4,
    ritorno: 46.9,
    salto: 11.5,
    pressione: 0.8,
    acquaCalda: 47.2,
    modulazione: 38,
  };
  const markup = disegna("caldaia", { letture: [lettura], lettura });
  assert.match(markup, /Accesa, scalda la casa/);
  assert.match(markup, /fiamma al 38%/);
  assert.match(markup, /58,4°[\s\S]*cede[\s\S]*11,5°[\s\S]*46,9°/);
  assert.match(markup, /il salto è quello giusto/);
  assert.match(markup, /data-dm-w-light="switch\.caldaia" data-on="true"/);
  /* La pressione sotto il bar dice di rabboccare, in rosso. */
  assert.match(markup, /data-tono="male">bassa: rabbocca/);
  assert.ok(
    posto(markup, "dm-f-caldaia-giro") < posto(markup, 'data-dm-f-comando="riscaldamento"'),
  );
});

test("l'UPS: la corrente, quanto regge, il carico con i watt; a batteria il rosso", () => {
  const lettura = {
    rete: true,
    batteria: 100,
    autonomia: 42,
    carico: 23,
    potenza: 138,
    tensione: 231,
    temperatura: 31.5,
  };
  const markup = disegna("ups", {
    gruppi: [{ nome: "Rack", lettura, da: Date.now() - 3 * 86400000 }],
  });
  assert.match(markup, /Corrente presente/);
  assert.match(markup, /Se va via la luce, regge/);
  assert.match(markup, /42 min/);
  assert.match(markup, /in rete da 3 giorni/);
  assert.match(markup, /138 W/);
  assert.match(markup, /23% di quello che può reggere: c'è margine/);
  assert.match(markup, /regolare/);
  /* Un gruppo solo non si nomina. */
  assert.doesNotMatch(markup, /Rack/);
  const giu = disegna("ups", {
    gruppi: [
      {
        nome: "Studio",
        lettura: { rete: false, batteria: 34, autonomia: 9 },
        da: Date.now() - 5 * 60000,
      },
      { nome: "Rack", lettura: { rete: true, batteria: 100 }, da: null },
    ],
  });
  assert.match(giu, /Va a batteria/);
  assert.match(giu, /Regge ancora/);
  assert.match(giu, /data-tono="male"/);
  assert.ok(posto(giu, ">Studio<") < posto(giu, ">Rack<"));
});

test("l'accumulo: un pacco per scheda, l'avviso solo sul pacco che ce l'ha", () => {
  const pacco = (n, extra = {}) => ({
    entity: `sensor.jk_${n}`,
    name: `Pacco ${n}`,
    soc: 80,
    potenza: 600,
    verso: "carica",
    temperatura: 27,
    soh: 98,
    cicli: 214,
    delta: 9,
    sbilanciato: false,
    ...extra,
  });
  const sbilanciato = pacco(2, {
    delta: 42,
    sbilanciato: true,
    minima: { numero: 13 },
    massima: { numero: 8 },
  });
  const widget = {
    alert: true,
    tintaDellaSezione: "rgb(234,88,12)",
    vista: {
      pacchi: [pacco(1), sbilanciato],
      come: {
        stato: "carica",
        verso: "carica",
        soc: 78,
        potenza: 1240,
        daDove: "solare",
        minuti: 315,
        sbilanciati: [sbilanciato],
      },
    },
  };
  const markup = disegna("accumulo", widget);
  assert.match(markup, /Si sta caricando/);
  assert.match(markup, /1,24 kW/);
  assert.match(markup, /dal fotovoltaico/);
  assert.match(markup, /piena fra <b>5 h 15<\/b>/);
  assert.equal((markup.match(/data-dm-f-pacco=/g) || []).length, 2);
  assert.equal((markup.match(/data-dm-f-avviso/g) || []).length, 1);
  assert.match(markup, /Cella più bassa 13, più alta 8: Δ 42 mV\. Il BMS/);
  /* Il rosso solo sulla pillola del pacco sbilanciato, e la finestra coi
   * colori dell'Energia anche se la tessera e' rossa. */
  assert.equal((markup.match(/data-tono="male"/g) || []).length, 1);
  assert.match(markup, /--dm-widget-accent:rgb\(234,88,12\)/);
  /* Il nome del BMS non si legge da nessuna parte. */
  assert.doesNotMatch(markup, /JK BMS/);
});

test("acqua e gas: senza storico la lettura del contatore, con lo storico i litri di oggi", () => {
  const acqua = {
    entity: "sensor.acqua",
    name: "Contatore",
    genere: "acqua",
    valore: 412.873,
    unita: "m³",
  };
  const gas = { entity: "sensor.gas", name: "Gas", genere: "gas", valore: 1834.2, unita: "m³" };
  const pressione = { entity: "sensor.p", genere: "pressione", bar: 3.1 };
  const senzaStorico = disegna("contatori", {
    vista: {
      letture: [acqua, gas, pressione],
      come: {
        acqua: { oggi: null, ieri: null, meseScorso: null },
        gas: { oggi: null },
        pressioni: [{ lettura: pressione, bar: 3.1, verdetto: "ok" }],
        portate: [],
        sali: [],
      },
    },
  });
  assert.match(senzaStorico, /data-dm-f-oggi>412,873 m³/);
  assert.match(senzaStorico, /3,1 bar[\s\S]*regolare/);
  assert.match(senzaStorico, /dm-f-contatori-letture/);
  /* Senza la storia della portata non si giura che non ci sono perdite. */
  assert.doesNotMatch(senzaStorico, /data-dm-f-perdita/);

  const conStorico = disegna("contatori", {
    vista: {
      letture: [acqua, gas],
      come: {
        acqua: { oggi: 186, ieri: 212, meseScorso: 205 * 30 },
        gas: { oggi: 1.8, costoOggi: 1.9 },
        pressioni: [],
        portate: [],
        sali: [],
        perdita: { tipo: "portata", ore: 4 },
      },
    },
  });
  assert.match(conStorico, /data-dm-f-oggi>186 L/);
  assert.match(conStorico, /ieri 212 L/);
  assert.match(conStorico, /media \d+ L/);
  assert.match(conStorico, /Gas oggi[\s\S]*1,8 m³[\s\S]*≈ 1,90 €/);
  assert.match(conStorico, /data-dm-f-perdita="si"/);
});

test("la piscina: la chimica con la sua fascia, i comandi coi nomi umani", () => {
  const markup = disegna("piscina", {
    vasche: [
      {
        nome: "",
        acqua: 26.8,
        ph: 7.3,
        cloro: 0.6,
        phMin: 7.2,
        phMax: 7.6,
        comandi: [
          { chiave: "pumpEnt", entity: "switch.pool_pump_filter", on: true, comando: true },
          { chiave: "lightEnt", entity: "light.piscina", on: false, comando: false },
        ],
      },
    ],
  });
  assert.match(markup, /26,8°/);
  assert.match(markup, /data-dm-f-chimica="ph" data-bene="true"/);
  assert.match(markup, /data-dm-f-chimica="cloro" data-bene="false"/);
  assert.match(markup, /cloro da correggere/);
  assert.match(markup, /Filtrazione/);
  assert.match(markup, /Luce/);
  /* Il nome dell'entità non si legge: sta solo dentro l'attributo del comando. */
  assert.doesNotMatch(markup.replace(/<[^>]+>/g, " "), /pool_pump/i);
  /* La pompa si comanda; la luce protetta si vede e basta. */
  assert.equal((markup.match(/data-dm-w-light=/g) || []).length, 1);
  /* Senza sonde chimiche, niente barre. */
  const solaPompa = disegna("piscina", {
    vasche: [{ comandi: [{ chiave: "pumpEnt", entity: "switch.p", on: false, comando: true }] }],
  });
  assert.doesNotMatch(solaPompa, /dm-f-piscina-chimica/);
  assert.doesNotMatch(solaPompa, /dm-f-imp-eroe/);
});

test("l'irrigazione: la zona che bagna in cima, il tasto per fermarla, il terreno su una scala", () => {
  const zona = (nome, on, entity = `switch.${nome}`) => ({
    entity,
    name: nome,
    on,
    da: on ? Date.now() - 7 * 60000 : null,
    comando: true,
  });
  const markup = disegna("irrigazione", {
    zone: [zona("Siepe", false), zona("Prato", true), zona("Orto", false)],
    umidita: 34,
  });
  assert.match(markup, /Sta bagnando[\s\S]*Prato[\s\S]*da 7 minuti/);
  assert.match(markup, /Ferma l'irrigazione/);
  assert.match(
    markup,
    /&quot;domain&quot;:&quot;switch&quot;,&quot;service&quot;:&quot;turn_off&quot;/,
  );
  /* La zona attiva prima delle altre. */
  assert.ok(
    posto(markup, 'data-dm-w-light="switch.Prato"') <
      posto(markup, 'data-dm-w-light="switch.Siepe"'),
  );
  assert.equal((markup.match(/dm-f-irrigazione-zona/g) || []).length, 3);
  assert.match(markup, /secco[\s\S]*giusto[\s\S]*bagnato/);
  /* Le valvole si chiudono, non si spengono. */
  const valvola = disegna("irrigazione", { zone: [zona("Orto", true, "valve.orto")] });
  assert.match(valvola, /&quot;service&quot;:&quot;close_valve&quot;/);
  /* Il solo sensore: niente zone, niente tasto. */
  const soloTerreno = disegna("irrigazione", { zone: [], umidita: 55 });
  assert.doesNotMatch(soloTerreno, /Ferma/);
  assert.doesNotMatch(soloTerreno, /data-dm-f-zone/);
  assert.match(soloTerreno, /55%/);
});

test("l'irrigazione conta le zone, non il sensore del terreno", () => {
  const righe = [
    ...["Prato", "Siepe", "Orto", "Aiuole"].map((nome, i) => ({ name: nome, on: i === 0 })),
    { name: "Umidità terreno", value: "34%", terreno: true },
  ];
  const lettura = analisiDellaSezione(
    { key: "irrigazione", rows: righe, attiva: true },
    it,
    Date.now(),
  );
  assert.match(lettura.frase, /su 4 zone/);
});

test("la ventilazione: il recupero, i due flussi, la velocità a tasti", () => {
  const voce = (valore) => ({ valore, muto: false });
  const lettura = {
    nome: "",
    clima: "fan.vmc",
    recupero: 77,
    bypassAperto: false,
    temperature: {
      esterna: voce(12.4),
      immissione: voce(19.6),
      ripresa: voce(21.8),
      espulsione: voce(14.1),
    },
    interruttori: { filtri: { acceso: true, muto: false }, bypass: { acceso: false, muto: false } },
    numeri: {
      ventola_immissione: {
        chiave: "ventola_immissione",
        glifo: "🌀",
        valore: 1420,
        unita: "rpm",
        muto: false,
      },
    },
  };
  const states = {
    "fan.vmc": {
      state: "on",
      attributes: { preset_modes: ["low", "medium", "boost"], preset_mode: "medium" },
    },
  };
  const markup = disegna("vmc", { letture: [lettura] }, states);
  assert.match(markup, /77%/);
  assert.match(markup, /19,6°/);
  assert.doesNotMatch(markup, /19\.6/);
  assert.equal((markup.match(/class="dm-f-vmc-modo"/g) || []).length, 3);
  assert.match(markup, /data-on="true" data-dm-f-velocita="medium"/);
  assert.match(markup, /&quot;service&quot;:&quot;set_preset_mode&quot;/);
  assert.match(markup, /data-tono="male">🧽 Filtri da cambiare/);
  assert.match(markup, /Bypass chiuso/);
  /* Senza un'entità che dichiari le velocità, niente selettore. */
  assert.doesNotMatch(disegna("vmc", { letture: [lettura] }, {}), /dm-f-vmc-velocita/);
});

test("il modulo importa solo il registro, shared e il nucleo", () => {
  const sorgente = readFileSync(
    new URL("../src/sections/finestre/impianti.js", import.meta.url),
    "utf8",
  );
  const da = [...sorgente.matchAll(/from "([^"]+)"/g)].map((voce) => voce[1]);
  for (const percorso of da)
    assert.match(
      percorso,
      /^(\.\.\/finestre-dei-widget\.js|\.\.\/shared\.js|\.\.\/\.\.\/core\/.+)$/,
    );
});
