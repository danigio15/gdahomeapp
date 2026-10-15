/* La casa capisce le domande (#175).
 *
 * «Che temperatura è presente in casa», mandato ad Assist con l'agente di
 * serie, tornava «Mi dispiace, non conosco nessuna area chiamata è presente in
 * casa». «L'assistente non è intelligente a capire le domande.» Adesso la
 * frase si capisce prima, qui, con quello che la plancia sa della casa — e ad
 * Assist arriva solo quello che qui non si capisce.
 *
 * La tabella grande tiene ferme le frasi come le dice chi abita la casa:
 * con l'apostrofo e senza («c'è», «ce»), con gli errori di battitura, al
 * singolare e al plurale, in italiano e in inglese. Per ognuna: cosa si e'
 * capito, e cosa risponde la casa di prova (`fixtures/casa-che-risponde.js`).
 *
 * Poi le conversazioni («e in camera?», «spegnile», «sì»), e la sicurezza:
 * nessuna azione parte senza conferma, l'antifurto vuole il codice, la porta
 * non si sblocca per un equivoco.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { AGENTE_DI_SERIE, agenteDaUsare } from "../src/core/assist-model.js";
import {
  INTENTI,
  capisci,
  distanza,
  linguaDellaDomanda,
  normalizza,
  numeriDellaFrase,
  frase,
  quandoNellaFrase,
  radice,
  somiglia,
  stessaStanza,
  trovaStanza,
} from "../src/core/capire-le-domande.js";
import {
  alPercento,
  durata,
  elencoNomi,
  esempi,
  nonHoCapito,
  potenza,
  rispondiDaCasa,
  rispostaCheNonRisponde,
} from "../src/core/rispondere-alle-domande.js";
import { sapereDellaCasa } from "../src/core/sapere-della-casa.js";
import { ADESSO, fontiDiProva } from "./fixtures/casa-che-risponde.js";

const casa = (cambia) => sapereDellaCasa(fontiDiProva(cambia));

/* ── la frase ripulita ──────────────────────────────────────────────────── */

test("«c'è», «ce», «c e», «cè» diventano la stessa parola", () => {
  for (const scritto of ["c'è", "ce", "c e", "cè", "C’È", "c`è"])
    assert.equal(normalizza(`${scritto} qualcuno`), "ce qualcuno", scritto);
  assert.equal(
    normalizza("Che temperatura è presente in casa?"),
    "che temperatura e presente in casa",
  );
  assert.equal(normalizza("com'è il tempo"), "come e il tempo");
  assert.equal(normalizza("dov'è l'antifurto"), "dove e l antifurto");
  assert.equal(normalizza("metti 21,5°C"), "metti 21.5 gradi");
  assert.equal(normalizza("al 50%"), "al 50 percento");
});

test("le radici mettono insieme singolare e plurale, maschile e femminile", () => {
  assert.equal(radice("luci"), radice("luce"));
  assert.equal(radice("accese"), radice("acceso"));
  assert.equal(radice("finestre"), radice("finestra"));
  assert.equal(radice("lights"), radice("light"));
  assert.equal(radice("21"), "21");
});

test("gli errori di battitura si perdonano sulle parole lunghe, non sulle corte", () => {
  assert.equal(distanza("cucina", "cuicna"), 1);
  assert.equal(distanza("cucina", "cicuna"), 2);
  assert.equal(distanza("ab", "ba"), 1);
  assert.ok(somiglia("temperatira", "temperatura"));
  assert.ok(somiglia("cuicna", "cucina"));
  assert.ok(somiglia("soggiorno", "sogiorno"));
  assert.ok(!somiglia("luce", "lune"));
  assert.ok(!somiglia("casa", "cosa"));
  assert.ok(!somiglia("luce 1", "luce 2"));
});

test("la lingua della domanda: italiano, inglese, e a pari merito quella della plancia", () => {
  assert.equal(linguaDellaDomanda("che temperatura c'è in casa"), "it");
  assert.equal(linguaDellaDomanda("what's the temperature inside"), "en");
  assert.equal(linguaDellaDomanda("Persona 1", "en"), "en");
  assert.equal(linguaDellaDomanda("Persona 1", "de"), "it");
});

test("le stanze si trovano per nome, per sinonimo e con un errore", () => {
  const aree = ["Soggiorno", "Cucina", "Camera da letto", "Camera degli ospiti", "Bagno"];
  assert.equal(trovaStanza(frase("in sala"), aree), "Soggiorno");
  assert.equal(trovaStanza(frase("nel salotto"), aree), "Soggiorno");
  assert.equal(trovaStanza(frase("in camera"), aree), "Camera da letto");
  assert.equal(trovaStanza(frase("nella camera degli ospiti"), aree), "Camera degli ospiti");
  assert.equal(trovaStanza(frase("in cuicna"), aree), "Cucina");
  assert.equal(trovaStanza(frase("in the kitchen"), aree), "Cucina");
  assert.equal(trovaStanza(frase("in casa"), aree), "");
  assert.ok(stessaStanza("Sala", "Soggiorno"));
  assert.ok(stessaStanza("camera", "Camera da letto"));
  assert.ok(!stessaStanza("Cucina", "Bagno"));
});

test("i numeri: gradi, passi, percentuali", () => {
  assert.deepEqual(numeriDellaFrase(frase("alza di 2 gradi")), {
    gradi: null,
    passo: 2,
    percento: null,
    numero: null,
  });
  assert.equal(numeriDellaFrase(frase("metti 21 gradi")).gradi, 21);
  assert.equal(numeriDellaFrase(frase("di mezzo grado")).passo, 0.5);
  assert.equal(numeriDellaFrase(frase("di un grado")).passo, 1);
  assert.equal(numeriDellaFrase(frase("al 50%")).percento, 50);
  assert.equal(numeriDellaFrase(frase("a metà")).percento, 50);
  assert.equal(numeriDellaFrase(frase("to 21 degrees")).gradi, 21);
});

test("i giorni: oggi, domani, dopodomani, il giorno della settimana", () => {
  assert.equal(quandoNellaFrase(frase("domani"), ADESSO).giorno, 1);
  assert.equal(quandoNellaFrase(frase("dopodomani"), ADESSO).giorno, 2);
  assert.equal(quandoNellaFrase(frase("oggi"), ADESSO).giorno, 0);
  assert.equal(quandoNellaFrase(frase("tomorrow"), ADESSO).giorno, 1);
  /* Il giorno della prova e' un mercoledi': venerdi' e' fra due. */
  assert.equal(quandoNellaFrase(frase("venerdì"), ADESSO).giorno, 2);
  assert.equal(quandoNellaFrase(frase("che tempo fa"), ADESSO).giorno, null);
  assert.ok(quandoNellaFrase(frase("adesso"), ADESSO).adesso);
  assert.ok(quandoNellaFrase(frase("nei prossimi giorni"), ADESSO).settimana);
});

test("le parole: numeri, potenze, durate, elenchi, «al» e «all'»", () => {
  assert.equal(potenza(850, "it"), "850 W");
  assert.equal(potenza(1234, "it"), "1,2 kW");
  assert.equal(potenza(-2400, "en"), "2.4 kW");
  assert.equal(durata(25 * 60_000, "it"), "25 min");
  assert.equal(durata(130 * 60_000, "it"), "2 h 10 min");
  assert.equal(durata(3 * 86_400_000, "it"), "3 giorni");
  assert.equal(elencoNomi(["A", "B", "C"], "it"), "A, B e C");
  assert.equal(elencoNomi(["A", "B", "C", "D", "E", "F"], "it"), "A, B, C e altre 3");
  assert.equal(elencoNomi(["A", "B"], "en"), "A and B");
  assert.equal(alPercento(76, "it"), "al 76%");
  assert.equal(alPercento(80, "it"), "all'80%");
  assert.equal(alPercento(8, "it"), "all'8%");
  assert.equal(alPercento(11, "it"), "all'11%");
});

/* ── quello che la casa sa ──────────────────────────────────────────────── */

test("la casa sa le temperature delle stanze, senza il frigo e senza il giardino", () => {
  const s = casa();
  assert.deepEqual(
    s.dentro.map((r) => [r.stanza, r.temperatura, r.umidita]),
    [
      ["Bagno", 21.7, 68],
      ["Camera da letto", 19.8, 55],
      ["Cucina", 21.5, 48],
      ["Soggiorno", 22.6, 52],
    ],
  );
  assert.equal(s.fuori.temperatura, 14.2);
  assert.equal(s.fuori.condizione, "cloudy");
});

test("i termometri scelti nella plancia vincono su quelli trovati", () => {
  const s = casa({
    temperature: [{ name: "Sala", entity: "sensor.x", temperature: 20, humidity: 40 }],
  });
  assert.deepEqual(s.dentro, [
    { stanza: "Sala", entity: "sensor.x", temperatura: 20, umidita: 40 },
  ]);
});

test("la casa sa chi c'è, le batterie, gli aggiornamenti e chi non risponde", () => {
  const s = casa();
  assert.deepEqual(
    s.persone.map((p) => [p.nome, p.inCasa, p.zona]),
    [
      ["Persona 1", true, ""],
      ["Persona 2", false, "Lavoro"],
    ],
  );
  /* L'accumulo di casa non e' una batteria da cambiare. */
  assert.deepEqual(
    s.batterieBasse.map((b) => b.nome),
    ["Sensore porta", "Telecomando"],
  );
  assert.deepEqual(
    s.aggiornamenti.map((u) => u.nome),
    ["Home Assistant Core", "ESPHome"],
  );
  assert.deepEqual(
    s.nonRispondono.map((n) => n.nome),
    ["Portico"],
  );
  assert.deepEqual(s.energiaOggi, {
    consumo: 8.4,
    produzione: 12.6,
    prelievo: 3.1,
    immissione: null,
  });
  assert.equal(s.antifurto.entity, "alarm_control_panel.casa");
  assert.deepEqual(
    s.telecamere.map((t) => t.nome),
    ["Cancello", "Giardino", "Ingresso"],
  );
  assert.ok(s.aree.includes("Camera da letto"));
});

test("le entità in sola lettura non si comandano", () => {
  const s = casa({ comandabile: (id) => id !== "light.cucina" });
  assert.equal(s.entita.find((e) => e.entity === "light.cucina").comandabile, false);
  assert.equal(s.entita.find((e) => e.entity === "light.soggiorno").comandabile, true);
  assert.equal(s.entita.find((e) => e.entity === "sensor.temp_cucina").comandabile, false);
});

/* ── la tabella: le frasi come si dicono ────────────────────────────────── */

/* [frase, intento, cosa deve dire la risposta]. `null` come intento: la
 * frase non e' per la casa, e va ad Assist. */
const FRASI = [
  /* La temperatura in casa: le due frasi della segnalazione per prime. */
  [
    "Che temperatura è presente in casa",
    "temperatura_dentro",
    "In casa ci sono in media 21,4 °C: da 19,8° in Camera da letto a 22,6° in Soggiorno.",
  ],
  ["Che temperatura ce in casa", "temperatura_dentro", "in media 21,4 °C"],
  ["Che temperatura c'è in casa?", "temperatura_dentro", "in media 21,4 °C"],
  ["che temperatura c e in casa", "temperatura_dentro", "in media 21,4 °C"],
  ["quanti gradi ci sono in casa", "temperatura_dentro", "in media 21,4 °C"],
  ["quanti gradi fa in casa?", "temperatura_dentro", "in media 21,4 °C"],
  ["temperatura casa", "temperatura_dentro", "Umidità 56%"],
  ["dimmi la temperatura di casa", "temperatura_dentro", "in media 21,4 °C"],
  ["CHE TEMPERATURA C'È IN CASA", "temperatura_dentro", "in media 21,4 °C"],
  [
    "Che temperatura c'è in cucina?",
    "temperatura_dentro",
    "In Cucina ci sono 21,5 °C, umidità 48%.",
  ],
  [
    "quanti gradi ci sono in camera da letto",
    "temperatura_dentro",
    "In Camera da letto ci sono 19,8 °C",
  ],
  ["temperatura in camera", "temperatura_dentro", "In Camera da letto ci sono 19,8 °C"],
  ["che temperatura fa in sala", "temperatura_dentro", "In Soggiorno ci sono 22,6 °C"],
  ["temperatura del soggiorno", "temperatura_dentro", "In Soggiorno ci sono 22,6 °C"],
  ["in bagno che temperatura c'è", "temperatura_dentro", "In Bagno ci sono 21,7 °C"],
  ["fa caldo in sala?", "temperatura_dentro", "22,6 °C, umidità 52%: si sta bene."],
  ["fa freddo in camera?", "temperatura_dentro", "19,8 °C"],
  ["temperatira in cuicna", "temperatura_dentro", "In Cucina ci sono 21,5 °C"],
  ["tempratura sogiorno", "temperatura_dentro", "In Soggiorno ci sono 22,6 °C"],
  ["che temperatura c'è nello studio", "temperatura_dentro", "In Studio non ho un termometro."],
  ["che temperatura c'è in garage", "temperatura_dentro", "In Garage non ho un termometro."],
  ["what's the temperature inside", "temperatura_dentro", "It's 21.4 °C on average inside"],
  ["how warm is it in the kitchen", "temperatura_dentro", "It's 21.5 °C in Cucina"],
  ["temperature in the bedroom", "temperatura_dentro", "It's 19.8 °C in Camera da letto"],

  /* L'umidita'. */
  ["che umidità c'è in casa", "umidita", "In casa l'umidità media è al 56%"],
  ["umidità in bagno", "umidita", "In Bagno l'umidità è al 68%: è alta, arieggia un po'."],
  ["quanta umidità c'è fuori", "umidita", "Fuori l'umidità è al 71%."],

  /* Fuori. */
  [
    "che temperatura c'è fuori",
    "temperatura_fuori",
    "Fuori ci sono 14,2 °C, nuvoloso. Oggi tra 9° e 17°.",
  ],
  ["quanti gradi ci sono fuori?", "temperatura_fuori", "Fuori ci sono 14,2 °C"],
  ["fa freddo fuori?", "temperatura_fuori", "Fuori ci sono 14,2 °C"],
  ["temperatura esterna", "temperatura_fuori", "Fuori ci sono 14,2 °C"],
  ["che temperatura fa all'aperto", "temperatura_fuori", "Fuori ci sono 14,2 °C"],
  ["how cold is it outside", "temperatura_fuori", "It's 14.2 °C outside, cloudy."],

  /* Il meteo. */
  [
    "com'è il tempo domani",
    "meteo",
    "Domani: pioggia, tra 8° e 13°, probabilità 80%. Meglio l'ombrello.",
  ],
  ["come e il tempo domani", "meteo", "Domani: pioggia"],
  [
    "che tempo fa",
    "meteo",
    "Adesso è nuvoloso, 14,2 °C. Oggi: nuvoloso, tra 9° e 17°, pioggia al 20%.",
  ],
  ["che tempo farà domani?", "meteo", "Domani: pioggia"],
  [
    "pioverà domani?",
    "meteo",
    "Sì, domani è prevista pioggia (80%). Tra 8° e 13°. Meglio l'ombrello.",
  ],
  ["piove oggi?", "meteo", "No, oggi non è prevista pioggia (20%)."],
  ["serve l'ombrello domani?", "meteo", "Sì, domani è prevista pioggia"],
  ["meteo dopodomani", "meteo", "Dopodomani: sereno, tra 10° e 18°."],
  ["previsioni del tempo per venerdì", "meteo", "sereno, tra 10° e 18°"],
  ["che tempo fa nei prossimi giorni", "meteo", "Domani: pioggia, tra 8° e 13°, probabilità 80%."],
  ["meteo", "meteo", "Adesso è nuvoloso"],
  ["nevica domani?", "meteo", "No, domani non è prevista neve"],
  ["what's the weather tomorrow", "meteo", "Tomorrow: rain, between 8° and 13°, 80% chance."],
  ["will it rain tomorrow?", "meteo", "Yes, rain is expected tomorrow (80%)."],

  /* Chi c'e'. */
  ["c'è qualcuno in casa?", "chi_in_casa", "Sì: in casa c'è Persona 1. Fuori: Persona 2 (Lavoro)."],
  ["chi c'è in casa", "chi_in_casa", "in casa c'è Persona 1"],
  ["ce qualcuno a casa", "chi_in_casa", "in casa c'è Persona 1"],
  ["chi è a casa?", "chi_in_casa", "in casa c'è Persona 1"],
  ["c'è nessuno in casa?", "chi_in_casa", "in casa c'è Persona 1"],
  ["ci sono persone in casa?", "chi_in_casa", "in casa c'è Persona 1"],
  ["is anyone home?", "chi_in_casa", "Yes: Persona 1 is home. Away: Persona 2 (Lavoro)."],
  ["who's home", "chi_in_casa", "Persona 1 is home"],
  ["dov'è Persona 2?", "dove_e", "Persona 2 è in zona Lavoro da 7 h."],
  ["dove si trova Persona 2", "dove_e", "Persona 2 è in zona Lavoro"],
  ["Persona 1 è in casa?", "dove_e", "Persona 1 è in casa da 2 h."],
  [
    "quando è uscita Persona 2?",
    "quando_uscito",
    "Persona 2 è fuori casa dalle 08:12 (zona Lavoro), 7 h fa.",
  ],
  [
    "da quanto tempo Persona 1 è a casa",
    "quando_uscito",
    "Persona 1 è in casa dalle 13:00 (2 h fa).",
  ],
  ["where is Persona 2", "dove_e", "Persona 2 is at Lavoro for 7 h."],

  /* Le luci. */
  ["quante luci sono accese", "luci", "Sono accese 3 luci: Soggiorno, Lampada divano e Cucina."],
  ["ci sono luci accese?", "luci", "Sono accese 3 luci"],
  ["quali luci sono accese", "luci", "Sono accese 3 luci"],
  ["luci accese?", "luci", "Sono accese 3 luci"],
  ["quante luci ci sono accese in cucina", "luci", "In Cucina è accesa una luce: Cucina."],
  [
    "le luci del soggiorno sono accese?",
    "luci",
    "In Soggiorno sono accese 2 luci: Soggiorno e Lampada divano.",
  ],
  ["ci sono luci accese in camera?", "luci", "In Camera da letto le luci sono spente."],
  ["quali luci sono spente in cucina", "luci", "Sono spente 1 luci in Cucina: Pensile."],
  ["how many lights are on", "luci", "3 lights are on: Soggiorno, Lampada divano and Cucina."],

  /* Le aperture. */
  ["ci sono finestre aperte?", "aperture", "C'è 1 finestra aperta: Finestra camera (40 min)."],
  ["ci sono finestre aperte in bagno?", "aperture", "Le finestre sono tutte chiuse in Bagno."],
  ["le porte sono chiuse?", "aperture", "Le porte sono tutte chiuse."],
  ["cosa c'è di aperto", "aperture", "C'è 1 finestra aperta"],
  ["è aperto il cancello?", "aperture", "chiuso"],
  ["are any windows open", "aperture", "There is 1 window open: Finestra camera (40 min)."],
  ["quali tapparelle sono aperte", "tapparelle", "È aperta Tapparella soggiorno."],
  ["le tapparelle sono chiuse?", "tapparelle", "Tapparella soggiorno"],

  /* L'antifurto. */
  ["l'antifurto è inserito?", "antifurto_stato", "L'antifurto è disinserito."],
  ["com'è l'allarme", "antifurto_stato", "L'antifurto è disinserito."],
  ["is the alarm armed", "antifurto_stato", "The alarm is disarmed."],

  /* L'energia. */
  [
    "quanto consuma la casa",
    "energia",
    "Adesso la casa consuma 1,2 kW. Arrivano 2,4 kW dal fotovoltaico. Stai cedendo 300 W alla rete.",
  ],
  ["quanta corrente sto usando", "energia", "Adesso la casa consuma 1,2 kW."],
  ["consumo attuale", "energia", "Adesso la casa consuma 1,2 kW."],
  [
    "quanto ho consumato oggi",
    "energia",
    "Oggi la casa ha consumato 8,4 kWh: 3,1 kWh presi dalla rete. Il fotovoltaico ha prodotto 12,6 kWh.",
  ],
  ["quanta energia ho preso dalla rete oggi", "energia", "3,1 kWh presi dalla rete"],
  [
    "quanto produce il fotovoltaico",
    "solare",
    "Il fotovoltaico sta producendo 2,4 kW. Oggi ha prodotto 12,6 kWh.",
  ],
  ["quanto stanno producendo i pannelli", "solare", "2,4 kW"],
  ["quanto ha prodotto il solare oggi", "solare", "Oggi ha prodotto 12,6 kWh."],
  ["how much power is the house using", "energia", "The house is using 1.2 kW right now."],
  ["batteria di casa", "batteria_casa", "La batteria di casa è al 76% e si sta caricando (900 W)."],
  ["a quanto è l'accumulo", "batteria_casa", "al 76%"],
  ["la batteria è carica?", "batteria_casa", "al 76%"],

  /* Le macchine, l'auto. */
  [
    "quanto manca alla lavatrice",
    "elettrodomestici",
    "Lavatrice sta lavorando: mancano 25 min, finisce alle 15:25.",
  ],
  ["la lavatrice ha finito?", "elettrodomestici", "Lavatrice sta lavorando"],
  ["la lavastoviglie è accesa?", "elettrodomestici", "Lavastoviglie è ferma."],
  ["ci sono elettrodomestici accesi", "elettrodomestici", "Lavatrice sta lavorando"],
  [
    "when will the washing machine be done",
    "elettrodomestici",
    "Lavatrice is running: 25 min left, done at 15:25.",
  ],
  [
    "quanto è carica la macchina",
    "auto",
    "Auto è al 64%, 280 km di autonomia, in carica (2 h alla fine).",
  ],
  ["autonomia dell'auto", "auto", "280 km di autonomia"],
  ["batteria della macchina", "auto", "al 64%"],
  ["how much charge does the car have", "auto", "is at 64%"],

  /* Le telecamere. */
  ["mostrami il cancello", "telecamera", "Ecco Cancello."],
  ["fammi vedere il giardino", "telecamera", "Ecco Giardino."],
  ["apri la telecamera dell'ingresso", "telecamera", "Ecco Ingresso."],
  ["telecamera del cancello", "telecamera", "Ecco Cancello."],
  ["fammi vedere le telecamere", "telecamera", "Quale telecamera?"],
  ["show me the cameras", "telecamera", "Which camera?"],

  /* L'agenda e i rifiuti. */
  [
    "che impegni ho oggi",
    "calendario",
    "Oggi hai 2 impegni: alle 17:30 Dentista e alle 20:00 Cena con gli amici.",
  ],
  ["cosa ho in calendario domani", "calendario", "Domani hai un impegno: alle 09:00 Riunione."],
  ["ho appuntamenti?", "calendario", "I prossimi impegni: oggi alle 17:30 Dentista"],
  ["agenda di oggi", "calendario", "Oggi hai 2 impegni"],
  [
    "what's on my calendar today",
    "calendario",
    "Today you have 2 events: Dentista at 17:30 and Cena con gli amici at 20:00.",
  ],
  ["quando passa la plastica", "rifiuti", "Plastica passa domani. Stasera portala fuori."],
  [
    "cosa devo portare fuori stasera",
    "rifiuti",
    "Domani passano: Plastica e Carta. Stasera portalo fuori.",
  ],
  ["che rifiuti passano domani", "rifiuti", "Domani passano: Plastica e Carta."],
  ["quando passa l'umido", "rifiuti", "Umido passa sabato."],
  ["spazzatura", "rifiuti", "Il prossimo ritiro è domani: Plastica e Carta. Poi Umido, sabato."],
  ["when is the trash collected", "rifiuti", "Next collection tomorrow: Plastica and Carta."],

  /* La manutenzione. */
  [
    "ci sono batterie scariche?",
    "batterie_basse",
    "2 batterie sono quasi scariche: Sensore porta (8%) e Telecomando (15%).",
  ],
  ["quali pile devo cambiare", "batterie_basse", "Sensore porta (8%)"],
  ["batterie basse", "batterie_basse", "Sensore porta (8%)"],
  ["any low batteries?", "batterie_basse", "2 batteries are low"],
  [
    "ci sono dispositivi che non rispondono?",
    "non_rispondono",
    "Un dispositivo non risponde: Portico.",
  ],
  ["cosa è offline", "non_rispondono", "Portico"],
  ["which devices are unavailable", "non_rispondono", "One device isn't responding: Portico."],
  [
    "ci sono aggiornamenti?",
    "aggiornamenti",
    "Ci sono 2 aggiornamenti: Home Assistant Core (2026.10.2) e ESPHome (2026.10.0).",
  ],
  ["devo aggiornare qualcosa?", "aggiornamenti", "2 aggiornamenti"],
  ["any updates?", "aggiornamenti", "There are 2 updates"],

  /* I comandi: si propongono, non si fanno. */
  ["spegni la luce della cucina", "comando", "Spengo la luce Cucina?"],
  ["spengi la luce della cucina", "comando", "Spengo la luce Cucina?"],
  ["accendi la luce del bagno", "comando", "Accendo la luce Bagno?"],
  ["accnedi la luce del bagno", "comando", "Accendo la luce Bagno?"],
  [
    "spegni tutte le luci del soggiorno",
    "comando",
    "Spengo 2 luci in Soggiorno (Soggiorno e Lampada divano)?",
  ],
  ["spegni tutte le luci", "comando", "Spengo 3 luci (Soggiorno, Lampada divano e Cucina)?"],
  ["spegni le luci", "comando", "Spengo 3 luci"],
  ["accendi il pensile", "comando", "Accendo la luce Pensile?"],
  ["accendi la lampada dello studio", "comando", "Accendo Lampada studio?"],
  [
    "accendi le luci del soggiorno al 50%",
    "comando",
    "Accendo 2 luci in Soggiorno (Soggiorno e Lampada divano) al 50%?",
  ],
  ["chiudi le tapparelle", "comando", "Chiudo Tapparella soggiorno?"],
  ["abbassa la tapparella della camera", "comando", "Tapparella camera è già abbassata."],
  ["alza la tapparella del soggiorno a metà", "comando", "Alzo Tapparella soggiorno al 50%?"],
  ["apri il cancello", "comando", "Apro Cancello? Confermalo."],
  ["apri il garage", "comando", "Apro Basculante garage? Confermalo."],
  ["spegni la tv", "comando", "Spengo TV Sala?"],
  ["accendi la macchina del caffè", "comando", "Accendo Macchina caffè?"],
  ["spegni la presa della tv", "comando", "Spengo Presa TV?"],
  ["accendi il ventilatore in camera", "comando", "Accendo Ventilatore (Camera da letto)?"],
  ["accendi la luce", "comando", "Quale?"],
  ["spegni la luce della cucina per favore", "comando", "Spengo la luce Cucina?"],
  ["turn off the kitchen lights", "comando", "Turn off the Cucina light?"],
  ["turn on the bathroom light", "comando", "Turn on the Bagno light?"],
  ["close the blinds", "comando", "Close Tapparella soggiorno?"],

  /* Il clima. */
  [
    "alza la temperatura in camera di 1 grado",
    "clima_imposta",
    "Porto Termostato camera da 20 °C a 21 °C?",
  ],
  [
    "abbassa il riscaldamento in soggiorno",
    "clima_imposta",
    "Porto Termostato soggiorno da 21 °C a 20 °C?",
  ],
  ["metti 22 gradi in camera", "clima_imposta", "da 20 °C a 22 °C?"],
  ["imposta il termostato del soggiorno a 20 gradi", "clima_imposta", "da 21 °C a 20 °C?"],
  ["alza la temperatura di mezzo grado in camera", "clima_imposta", "da 20 °C a 20,5 °C?"],
  ["porta la camera a 19 gradi", "clima_imposta", "da 20 °C a 19 °C?"],
  ["alza la temperatura", "clima_imposta", "Quale?"],
  ["set the bedroom to 21 degrees", "clima_imposta", "Set Termostato camera from 20 °C to 21 °C?"],

  /* L'antifurto e le serrature. */
  [
    "inserisci l'antifurto",
    "antifurto_comando",
    "Per inserire l'antifurto (fuori casa) serve il codice: scrivilo qui sotto.",
  ],
  ["attiva l'allarme per la notte", "antifurto_comando", "(notte) serve il codice"],
  ["disinserisci l'antifurto", "antifurto_comando", "L'antifurto è già disinserito."],
  ["arm the alarm", "antifurto_comando", "Arming (away) needs the code"],
  ["chiudi a chiave la porta", "serratura_comando", "Serratura ingresso: già chiusa a chiave."],
  [
    "sblocca la porta d'ingresso",
    "serratura_comando",
    "Sblocco Serratura ingresso? Confermalo: la porta resterà aperta.",
  ],
  ["apri la serratura", "serratura_comando", "Sblocco Serratura ingresso?"],

  /* Una cosa per nome. */
  ["il pensile è acceso?", "stato_dispositivo", "Pensile: spento (da 1 h)."],
  ["com'è la tv sala", "stato_dispositivo", "TV Sala: acceso (da 1 h)."],
  [
    "com'è il termostato della camera",
    "stato_dispositivo",
    "Termostato camera: acceso (heat), in stanza 19,8 °C, impostato a 20 °C (da 1 h).",
  ],

  /* Cortesia e aiuto. */
  ["ciao", "saluto", "Ciao! Cosa vuoi sapere della casa?"],
  ["grazie", "saluto", "Figurati!"],
  ["cosa sai fare?", "aiuto", "Posso dirti la temperatura"],
  ["aiuto", "aiuto", "Prova:"],
  ["what can you do", "aiuto", "I can tell you the temperature"],

  /* Quello che non e' per la casa: va ad Assist. */
  ["raccontami una barzelletta", null],
  ["chi ha vinto la partita ieri", null],
  ["qual è la capitale della Francia", null],
  ["che ore sono", null],
];

test(`la tabella: ${FRASI.length} frasi, capite e risposte`, () => {
  const s = casa();
  const sbagliate = [];
  for (const [testo, intento, dice] of FRASI) {
    const r = rispondiDaCasa(testo, s, {});
    const capito = r.capita ? r.intento : null;
    if (capito !== intento) {
      sbagliate.push(`«${testo}»: capito ${capito}, atteso ${intento} — ${r.testo || ""}`);
      continue;
    }
    if (dice && !String(r.testo).includes(dice))
      sbagliate.push(`«${testo}»: «${r.testo}» non dice «${dice}»`);
  }
  assert.deepEqual(sbagliate, []);
  assert.ok(FRASI.length >= 150, `${FRASI.length} frasi`);
});

test("ogni intento della tabella esiste, e quasi tutti sono provati", () => {
  const provati = new Set(FRASI.map((f) => f[1]).filter(Boolean));
  for (const i of provati) assert.ok(INTENTI.includes(i), i);
  /* Quelli di una conversazione si provano sotto. */
  const daConversazione = new Set(["conferma", "annulla", "codice"]);
  assert.deepEqual(
    INTENTI.filter((i) => !provati.has(i) && !daConversazione.has(i)),
    [],
  );
});

/* ── le conversazioni ───────────────────────────────────────────────────── */

function conversazione(frasi, s = casa()) {
  let memoria = {};
  return frasi.map((testo) => {
    const r = rispondiDaCasa(testo, s, memoria);
    if (r.capita) memoria = r.memoria;
    return r;
  });
}

test("«e in camera?», «e fuori?», «e domani?»: il seguito della domanda di prima", () => {
  const [cucina, camera, fuori, domani] = conversazione([
    "che temperatura c'è in cucina",
    "e in camera?",
    "e fuori?",
    "e domani?",
  ]);
  assert.match(cucina.testo, /In Cucina ci sono 21,5 °C/);
  assert.equal(camera.intento, "temperatura_dentro");
  assert.match(camera.testo, /In Camera da letto ci sono 19,8 °C/);
  assert.equal(fuori.intento, "temperatura_fuori");
  assert.match(fuori.testo, /Fuori ci sono 14,2 °C/);
  assert.equal(domani.intento, "meteo");
  assert.match(domani.testo, /Domani: pioggia/);
});

test("la domanda dell'utente, poi «e in camera?»", () => {
  const [casaTutta, camera] = conversazione(["Che temperatura è presente in casa", "e in camera?"]);
  assert.match(casaTutta.testo, /in media 21,4 °C/);
  assert.match(camera.testo, /In Camera da letto ci sono 19,8 °C/);
});

test("«quali luci sono accese in soggiorno?», «spegnile», «sì»", () => {
  const [luci, spegnile, si] = conversazione([
    "quali luci sono accese in soggiorno",
    "spegnile",
    "sì",
  ]);
  assert.match(luci.testo, /In Soggiorno sono accese 2 luci/);
  assert.equal(spegnile.intento, "comando");
  assert.match(spegnile.testo, /Spengo 2 luci \(Soggiorno e Lampada divano\)\?/);
  assert.deepEqual(spegnile.esegui, []);
  assert.equal(si.intento, "conferma");
  assert.deepEqual(si.esegui, [
    {
      dominio: "light",
      servizio: "turn_off",
      dati: { entity_id: ["light.soggiorno", "light.lampada_divano"] },
    },
  ]);
  assert.match(si.testo, /Fatto: ho spento 2 luci/);
  assert.equal(si.memoria.inAttesa, null);
});

test("«spegni la luce della cucina», «e in soggiorno?»: lo stesso comando altrove", () => {
  const [, soggiorno] = conversazione(["spegni la luce della cucina", "e in soggiorno?"]);
  assert.equal(soggiorno.intento, "comando");
  assert.match(soggiorno.testo, /Spengo 2 luci in Soggiorno/);
});

test("il meteo, il calendario e le persone tengono il filo", () => {
  const [, dopodomani] = conversazione(["com'è il tempo domani", "e dopodomani?"]);
  assert.match(dopodomani.testo, /Dopodomani: sereno/);
  const [, domani] = conversazione(["che impegni ho oggi", "e domani?"]);
  assert.match(domani.testo, /Domani hai un impegno: alle 09:00 Riunione/);
  const [, persona1] = conversazione(["dov'è Persona 2", "e Persona 1?"]);
  assert.match(persona1.testo, /Persona 1 è in casa/);
});

test("«no» annulla, e un «sì» dopo non fa niente", () => {
  const [, no, si] = conversazione(["spegni la luce della cucina", "no", "sì"]);
  assert.equal(no.intento, "annulla");
  assert.match(no.testo, /lascio stare/);
  assert.notEqual(si.intento, "conferma");
  assert.deepEqual(si.esegui || [], []);
});

test("un «grazie» non fa perdere il filo", () => {
  const [, , camera] = conversazione(["che temperatura c'è in cucina", "grazie", "e in camera?"]);
  assert.match(camera.testo, /In Camera da letto/);
});

/* ── la sicurezza ───────────────────────────────────────────────────────── */

test("nessun comando parte senza conferma: il tasto «Sì» porta i servizi", () => {
  const s = casa();
  for (const [testo, intento] of FRASI) {
    if (!["comando", "clima_imposta", "antifurto_comando", "serratura_comando"].includes(intento))
      continue;
    const r = rispondiDaCasa(testo, s, {});
    assert.deepEqual(r.esegui, [], testo);
    const conferma = r.chips.find((c) => c.tipo === "fai");
    if (conferma) {
      assert.ok(
        r.chips.some((c) => c.tipo === "annulla"),
        `${testo}: manca «Annulla»`,
      );
      assert.ok(conferma.servizi.length > 0, testo);
      assert.deepEqual(r.memoria.inAttesa.servizi, conferma.servizi, testo);
    }
  }
});

test("l'antifurto vuole il codice; il codice non si ripete e parte col comando", () => {
  const [inserisci, codice] = conversazione(["inserisci l'antifurto", "1234"]);
  assert.equal(inserisci.codice, true);
  assert.deepEqual(inserisci.esegui, []);
  assert.equal(codice.intento, "codice");
  assert.equal(codice.nascondiDomanda, true);
  assert.ok(!codice.testo.includes("1234"));
  assert.deepEqual(codice.esegui, [
    {
      dominio: "alarm_control_panel",
      servizio: "alarm_arm_away",
      dati: { entity_id: "alarm_control_panel.casa", code: "1234" },
    },
  ]);
  /* «sì» al posto del codice non basta. */
  const [, si] = conversazione(["inserisci l'antifurto", "sì"]);
  assert.deepEqual(si.esegui, []);
  assert.equal(si.codice, true);
});

test("un antifurto senza codice si inserisce solo col tasto di conferma", () => {
  const fonti = fontiDiProva();
  fonti.states["alarm_control_panel.casa"].attributes = { friendly_name: "Antifurto" };
  const r = rispondiDaCasa("inserisci l'antifurto in modalità casa", sapereDellaCasa(fonti), {});
  assert.match(r.testo, /Inserisco l'antifurto in modalità in casa\? Confermalo\./);
  const tasto = r.chips.find((c) => c.tipo === "fai");
  assert.equal(tasto.pericolo, true);
  assert.deepEqual(tasto.servizi, [
    {
      dominio: "alarm_control_panel",
      servizio: "alarm_arm_home",
      dati: { entity_id: "alarm_control_panel.casa" },
    },
  ]);
});

test("la porta non si sblocca e il cancello non si apre per un equivoco", () => {
  const sblocca = rispondiDaCasa("sblocca la porta d'ingresso", casa(), {});
  assert.equal(sblocca.chips.find((c) => c.tipo === "fai").pericolo, true);
  assert.deepEqual(sblocca.esegui, []);
  const cancello = rispondiDaCasa("apri il cancello", casa(), {});
  assert.equal(cancello.chips.find((c) => c.tipo === "fai").pericolo, true);
  assert.deepEqual(cancello.chips.find((c) => c.tipo === "fai").servizi, [
    { dominio: "cover", servizio: "open_cover", dati: { entity_id: "cover.cancello" } },
  ]);
  /* «apri la porta» con una serratura e' uno sblocco, con la sua conferma. */
  const porta = rispondiDaCasa("apri la porta d'ingresso", casa(), {});
  assert.equal(porta.intento, "comando");
  assert.match(porta.testo, /Sblocco Serratura ingresso\?/);
});

test("le entità in sola lettura non si propongono", () => {
  const s = casa({ comandabile: (id) => id !== "light.cucina" });
  const r = rispondiDaCasa("spegni la luce della cucina", s, {});
  assert.doesNotMatch(r.testo, /Spengo la luce Cucina/);
});

test("le chiamate: una per servizio, coi dati giusti", () => {
  const s = casa();
  const tapparella = rispondiDaCasa("alza la tapparella del soggiorno a metà", s, {});
  assert.deepEqual(tapparella.chips[0].servizi, [
    {
      dominio: "cover",
      servizio: "set_cover_position",
      dati: { entity_id: "cover.tapparella_soggiorno", position: 50 },
    },
  ]);
  const luci = rispondiDaCasa("accendi le luci del soggiorno al 50%", s, {});
  assert.deepEqual(luci.chips[0].servizi, [
    {
      dominio: "light",
      servizio: "turn_on",
      dati: { entity_id: ["light.soggiorno", "light.lampada_divano"], brightness_pct: 50 },
    },
  ]);
  const clima = rispondiDaCasa("alza la temperatura in camera di 1 grado", s, {});
  assert.deepEqual(clima.chips[0].servizi, [
    {
      dominio: "climate",
      servizio: "set_temperature",
      dati: { entity_id: "climate.camera", temperature: 21 },
    },
  ]);
  const cam = rispondiDaCasa("mostrami il cancello", s, {});
  assert.equal(cam.telecamera, "camera.cancello");
});

/* ── Assist, quando qui non si capisce ──────────────────────────────────── */

test("la risposta di Assist della segnalazione è un «non ho capito»", () => {
  assert.ok(
    rispostaCheNonRisponde({
      testo: "Mi dispiace, non conosco nessuna area chiamata è presente in casa",
      errore: false,
    }),
  );
  assert.ok(rispostaCheNonRisponde({ testo: "Sorry, I couldn't understand that", errore: false }));
  assert.ok(rispostaCheNonRisponde({ testo: "Qualcosa", errore: true }));
  assert.ok(!rispostaCheNonRisponde({ testo: "In camera ci sono 21 gradi.", errore: false }));
  assert.ok(!rispostaCheNonRisponde({ testo: "", errore: false, muta: true }));
});

test("chi non ha capito lo dice gentilmente, con le domande da fare", () => {
  const r = nonHoCapito(casa(), "it");
  assert.match(r.testo, /Non ho capito bene/);
  assert.deepEqual(
    r.chips.map((c) => c.testo),
    [
      "Che temperatura c'è in casa?",
      "C'è qualcuno in casa?",
      "Quante luci sono accese?",
      "Com'è il tempo domani?",
    ],
  );
  /* Una casa vuota ha comunque qualcosa da suggerire. */
  assert.ok(esempi(sapereDellaCasa({ states: {} }), "it").length > 0);
  /* Ogni esempio suggerito si capisce davvero. */
  const s = casa();
  for (const domanda of esempi(s, "it", 20))
    assert.ok(rispondiDaCasa(domanda, s, {}).capita, domanda);
  for (const domanda of esempi(s, "en", 20))
    assert.ok(rispondiDaCasa(domanda, s, {}).capita, domanda);
});

test("l'agente: quello scelto, se no un modello linguistico, se no quello di serie", () => {
  const stati = {
    "conversation.home_assistant": { state: "unknown" },
    "conversation.google_generative_ai": {
      state: "2026-10-14T10:00:00",
      attributes: { friendly_name: "Google AI" },
    },
    "conversation.altro": { state: "2026-10-14T10:00:00" },
  };
  assert.equal(agenteDaUsare("", stati), "conversation.google_generative_ai");
  assert.equal(agenteDaUsare("auto", stati), "conversation.google_generative_ai");
  assert.equal(agenteDaUsare(AGENTE_DI_SERIE, stati), AGENTE_DI_SERIE);
  assert.equal(agenteDaUsare("conversation.altro", stati), "conversation.altro");
  assert.equal(agenteDaUsare("", { "conversation.home_assistant": { state: "x" } }), "");
  assert.equal(agenteDaUsare("", { "conversation.ollama": { state: "unavailable" } }), "");
  assert.equal(agenteDaUsare("", { "conversation.mio": { state: "x" } }), "conversation.mio");
});

test("le luci si chiamano come nella plancia, e tante si contano per stanza", () => {
  const acceso = (entity, friendly_name) => [
    entity,
    { state: "on", attributes: { friendly_name } },
  ];
  const states = Object.fromEntries([
    acceso("light.shelly_a_0", "Luce Camera da letto switch_0"),
    acceso("light.shelly_a_1", "Luce Camera da letto switch_1"),
    acceso("switch.shelly_b_0", "Shelly corridoio switch_0"),
    acceso("light.cucina_1", "Lampadario Cucina"),
    acceso("light.led_1", "Led Soggiorno"),
    acceso("light.led_2", "Led Soggiorno"),
    acceso("light.spia_del_router", "Router LED"),
  ]);
  const luci = [
    { entity: "light.shelly_a_0", nome: "Plafoniera", stanza: "Camera da letto" },
    { entity: "light.shelly_a_1", nome: "Abat-jour", stanza: "Camera da letto" },
    { entity: "switch.shelly_b_0", nome: "Luci corridoio", stanza: "Corridoio" },
    { entity: "light.cucina_1", nome: "Lampadario Cucina", stanza: "Cucina" },
    { entity: "light.led_1", nome: "Striscia", stanza: "Soggiorno" },
    { entity: "light.led_2", nome: "Striscia", stanza: "Soggiorno" },
  ];
  const s = sapereDellaCasa({ states, adesso: ADESSO, luci });
  const r = rispondiDaCasa("quante luci sono accese", s, {});
  /* Il led del router non e' una luce della plancia; l'interruttore del
   * corridoio si'. Nessun «switch_0». */
  assert.equal(
    r.testo,
    "Sono accese 6 luci: 2 in Camera da letto, Luci corridoio, Lampadario Cucina e 2 in Soggiorno.",
  );
  assert.doesNotMatch(r.testo, /switch_|shelly/i);
  assert.equal(r.chips[0].etichetta, "Spegnile tutte");
  assert.deepEqual(
    r.chips.slice(1).map((c) => c.etichetta),
    ["Spegni in Camera da letto", "Spegni in Corridoio", "Spegni in Cucina"],
  );
  /* L'interruttore si spegne da interruttore. */
  assert.ok(JSON.stringify(r.chips[0]).includes('"dominio":"switch"'));

  /* Poche luci si dicono per nome, e due uguali si contano. */
  const poche = sapereDellaCasa({ states, adesso: ADESSO, luci: luci.slice(3) });
  assert.equal(
    rispondiDaCasa("quante luci sono accese", poche, {}).testo,
    "Sono accese 3 luci: Lampadario Cucina e Striscia (2).",
  );
  /* Il nome della plancia si usa anche per comandare. */
  const comando = rispondiDaCasa("spegni la plafoniera", s, {});
  assert.match(comando.testo, /Plafoniera/i);
});
