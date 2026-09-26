/* La presenza: dove c'è qualcuno adesso, e da quanto (#432).
 *
 * «Ci vorrebbe una sezione con i sensori presenza o movimento.»
 *
 * Le prove stanno sul nucleo, che è puro: quali entità sono rilevatori di
 * questa casa, come stanno, da quanto, e il conto che va in cima. Le parole e
 * il disegno li prova la sezione, più sotto, leggendo il proprio sorgente —
 * perché quello che questa richiesta chiede di non sbagliare è l'ordine delle
 * righe e la differenza fra un movimento e una presenza, non il markup.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { chiaveDelDisegno } from "../src/core/catalogo-disegni.js";
import { parolaDelRilevatore } from "../src/sections/presenza-section.js";
import { stanzaDiHomeAssistant } from "../src/sections/shared.js";

import {
  CHIAVE_DELLE_STANZE,
  dimenticaLeStanze,
  leStanzeRicordate,
  ricordaLeStanze,
  stanzaRicordata,
  stanzeDaiRegistri,
} from "../src/core/le-stanze-di-home-assistant.js";
import {
  ASSENTE,
  CHIAVE_PRESENZA,
  CLASSI_DELLA_PRESENZA,
  comeStaIlRilevatore,
  contoDellaPresenza,
  disegnoDelRilevatore,
  eUnRilevatore,
  eUnRilevatoreDiCasa,
  eUnaPresenzaStabile,
  istanteDelCambio,
  normalizzaPresenza,
  presenzaConfigurata,
  presenzaDiCasa,
  ultimoMovimento,
} from "../src/core/presenza-in-casa.js";

const leggi = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

const rilevatore = (stato, classe = "motion", quando = "2026-09-09T10:00:00Z", nome = "") => ({
  state: stato,
  last_changed: quando,
  attributes: { device_class: classe, ...(nome ? { friendly_name: nome } : {}) },
});

test("un rilevatore lo dichiara Home Assistant, e vibrazione non è presenza", () => {
  assert.ok(eUnRilevatore("binary_sensor.salone", rilevatore("on", "motion")));
  assert.ok(eUnRilevatore("binary_sensor.salone", rilevatore("off", "occupancy")));
  assert.ok(eUnRilevatore("binary_sensor.radar", rilevatore("on", "moving")));
  /* Una lavatrice che vibra non è qualcuno che passa. */
  assert.equal(eUnRilevatore("binary_sensor.lavatrice", rilevatore("on", "vibration")), false);
  assert.equal(eUnRilevatore("binary_sensor.porta", rilevatore("on", "door")), false);
  /* Un `sensor.` con la classe giusta non è un rilevatore: la presenza è
   * acceso/spento, e un numero non lo è. */
  assert.equal(eUnRilevatore("sensor.movimento", rilevatore("on", "motion")), false);
  assert.deepEqual([...CLASSI_DELLA_PRESENZA], ["motion", "occupancy", "presence", "moving"]);
});

test("movimento e presenza non dicono la stessa cosa", () => {
  assert.equal(eUnaPresenzaStabile("occupancy"), true);
  assert.equal(eUnaPresenzaStabile("presence"), true);
  assert.equal(eUnaPresenzaStabile("motion"), false);
  assert.equal(eUnaPresenzaStabile("moving"), false);
  /* I disegni di serie sono nomi del CATALOGO di casa, non emoji di sistema
   * (#74): un'emoji cambia faccia da un telefono all'altro, e un mmWave
   * disegnato come un omino che corre non lo riconosce nessuno. */
  assert.equal(disegnoDelRilevatore("occupancy"), "person");
  assert.equal(disegnoDelRilevatore("presence"), "radar");
  assert.equal(disegnoDelRilevatore("motion"), "motion");
  /* Una classe che non si conosce prende comunque un disegno: una riga senza
   * icona sarebbe più brutta di una icona approssimata. */
  assert.equal(disegnoDelRilevatore("boh"), "motion");
  for (const chiave of ["person", "radar", "motion"])
    assert.equal(chiaveDelDisegno(chiave), chiave, `${chiave} non è nel catalogo`);
});

test("la configurazione si ripulisce, e le tre correzioni valgono", () => {
  const scelte = normalizzaPresenza({
    escluse: ["binary_sensor.cortile", "binary_sensor.cortile", "spazzatura", 7],
    aggiunte: ["  binary_sensor.fatto_in_casa  "],
    nomi: { "binary_sensor.salone": "  Salone  ", "binary_sensor.x": "  ", niente: "Boh" },
  });
  assert.deepEqual(scelte.escluse, ["binary_sensor.cortile"]);
  assert.deepEqual(scelte.aggiunte, ["binary_sensor.fatto_in_casa"]);
  assert.deepEqual(scelte.nomi, { "binary_sensor.salone": "Salone" });
  assert.equal(CHIAVE_PRESENZA, "cd_presenza");

  /* Uno escluso non è un rilevatore per questa plancia... */
  assert.equal(
    eUnRilevatoreDiCasa("binary_sensor.cortile", rilevatore("on", "motion"), scelte),
    false,
  );
  /* ...e uno aggiunto lo è anche se Home Assistant non lo dichiara. */
  assert.equal(
    eUnRilevatoreDiCasa("binary_sensor.fatto_in_casa", { state: "on", attributes: {} }, scelte),
    true,
  );
  /* La configurazione vuota non toglie niente: chi ha un rilevatore se lo
   * ritrova senza configurare nulla. */
  assert.equal(eUnRilevatoreDiCasa("binary_sensor.salone", rilevatore("on"), {}), true);
});

test("un rilevatore muto non è una stanza vuota", () => {
  assert.equal(comeStaIlRilevatore(rilevatore("on")), "attivo");
  assert.equal(comeStaIlRilevatore(rilevatore("off")), "libero");
  assert.equal(comeStaIlRilevatore(rilevatore("unavailable")), "");
  assert.equal(comeStaIlRilevatore(rilevatore("unknown")), "");
  /* E «non c'è» non è «non risponde»: uno stato che non esiste affatto è una
   * riga che punta a un'entità che Home Assistant non ha — un dispositivo
   * tolto e rimesso, un identificativo cambiato sotto i piedi. Dal campo, un
   * sensore appena abbinato che diceva «Non risponde da 2 minuti» mandava a
   * guardare la batteria e il segnale di una cosa che non c'era.
   *
   * Si riparano in due posti diversi, quindi si dicono con due parole. */
  assert.equal(comeStaIlRilevatore(null), ASSENTE);
  assert.equal(comeStaIlRilevatore(undefined), ASSENTE);
  /* `last_changed` e non `last_updated`: il secondo si muove anche quando
   * cambia solo un attributo, e direbbe «libera da un minuto» di una stanza
   * vuota da ieri. */
  assert.equal(
    istanteDelCambio({ last_changed: "2026-09-09T10:00:00Z", last_updated: "2026-09-09T12:00:00Z" }),
    Date.parse("2026-09-09T10:00:00Z"),
  );
  assert.equal(istanteDelCambio({ last_changed: "boh" }), null);
  assert.equal(istanteDelCambio(null), null);
});

test("le righe stanno in ordine: prima chi rileva qualcuno, in fondo la quiete", () => {
  const states = {
    "binary_sensor.zeta": rilevatore("off", "motion", "2026-09-09T09:00:00Z"),
    "binary_sensor.alfa": rilevatore("off", "motion", "2026-09-09T09:30:00Z"),
    "binary_sensor.muto": rilevatore("unavailable", "motion", "2026-09-09T08:00:00Z"),
    "binary_sensor.salone": rilevatore("on", "occupancy", "2026-09-09T10:00:00Z"),
    "light.non_centra": { state: "on", attributes: {} },
  };
  const righe = presenzaDiCasa(states, {}, (entity) => entity.split(".")[1]);
  assert.deepEqual(
    righe.map((riga) => [riga.name, riga.stato]),
    [
      ["salone", "attivo"],
      ["muto", ""],
      ["alfa", "libero"],
      ["zeta", "libero"],
    ],
  );
  assert.equal(righe[0].stabile, true);
  assert.equal(righe[0].glifo, "person");
  assert.equal(righe[3].stabile, false);
});

test("il nome scelto batte quello dell'integrazione", () => {
  const states = { "binary_sensor.motion_3c": rilevatore("on", "motion") };
  const righe = presenzaDiCasa(states, { nomi: { "binary_sensor.motion_3c": "Corridoio" } }, () => "Motion 3C");
  assert.equal(righe[0].name, "Corridoio");
  /* Senza un nome scelto resta quello di Home Assistant, e senza nemmeno
   * quello l'identificativo: una riga senza titolo non si legge. */
  assert.equal(presenzaDiCasa(states, {}, () => "Motion 3C")[0].name, "Motion 3C");
  assert.equal(presenzaDiCasa(states, {}, () => "")[0].name, "binary_sensor.motion_3c");
});

test("il conto non conta libero chi non risponde", () => {
  const righe = presenzaDiCasa(
    {
      "binary_sensor.salone": rilevatore("on", "occupancy", "2026-09-09T10:00:00Z"),
      "binary_sensor.cucina": rilevatore("on", "motion", "2026-09-09T10:30:00Z"),
      "binary_sensor.bagno": rilevatore("off", "motion", "2026-09-09T09:00:00Z"),
      "binary_sensor.garage": rilevatore("unavailable", "motion", "2026-09-09T08:00:00Z"),
    },
    {},
    (entity) => entity.split(".")[1],
  );
  const conto = contoDellaPresenza(righe);
  assert.equal(conto.attivi, 2);
  assert.equal(conto.liberi, 1);
  assert.equal(conto.muti, 1);
  assert.equal(conto.totale, 4);
  /* Contare il muto fra i liberi sarebbe una bugia tranquillizzante: 2+1 non
   * fa 4, ed è giusto che non lo faccia. */
  assert.notEqual(conto.attivi + conto.liberi, conto.totale);
  assert.deepEqual(conto.nomi, ["cucina", "salone"]);
  assert.deepEqual(contoDellaPresenza([]), {
    attivi: 0,
    liberi: 0,
    muti: 0,
    totale: 0,
    nomi: [],
  });
});

test("a casa libera la notizia è l'ultima volta che c'è stato qualcuno", () => {
  const righe = [
    { stato: "libero", da: Date.parse("2026-09-09T09:00:00Z") },
    { stato: "libero", da: Date.parse("2026-09-09T10:30:00Z") },
    { stato: "libero", da: null },
  ];
  assert.equal(ultimoMovimento(righe), Date.parse("2026-09-09T10:30:00Z"));
  /* Nessuna storia, nessuna scritta: inventare «da poco» sarebbe una bugia. */
  assert.equal(ultimoMovimento([{ stato: "libero", da: null }]), null);
  assert.equal(ultimoMovimento([]), null);
});

test("un rilevatore che va giù non è un movimento", () => {
  /* Passare a `unavailable` è un cambio di stato, e il suo `last_changed` è
   * adesso. Contandolo, una casa in cui l'unica cosa successa era un sensore
   * andato giù leggeva «Ultimo movimento · appena adesso»: la notizia più
   * tranquillizzante possibile, detta proprio quando la sorveglianza manca. */
  const righe = [
    { stato: "libero", da: Date.parse("2026-09-09T07:00:00Z") },
    { stato: "", da: Date.parse("2026-09-09T11:59:00Z") },
  ];
  assert.equal(ultimoMovimento(righe), Date.parse("2026-09-09T07:00:00Z"));
  /* E chi si sta muovendo adesso conta: il suo cambio è un movimento vero. */
  assert.equal(
    ultimoMovimento([{ stato: "attivo", da: Date.parse("2026-09-09T12:00:00Z") }]),
    Date.parse("2026-09-09T12:00:00Z"),
  );
  /* Con i soli muti non c'è niente da dire. */
  assert.equal(ultimoMovimento([{ stato: "", da: Date.parse("2026-09-09T11:59:00Z") }]), null);
});

test("la voce compare solo con qualcosa da mostrare", () => {
  assert.equal(presenzaConfigurata({}, {}), false);
  assert.equal(presenzaConfigurata({ "light.salone": { state: "on", attributes: {} } }, {}), false);
  assert.equal(presenzaConfigurata({ "binary_sensor.x": rilevatore("on") }, {}), true);
  /* L'unico rilevatore escluso spegne la sezione: una pagina vuota che
   * compare comunque è peggio di una voce che non c'è. */
  assert.equal(
    presenzaConfigurata({ "binary_sensor.x": rilevatore("on") }, { escluse: ["binary_sensor.x"] }),
    false,
  );
});

test("la pagina è fatta con lo stesso impianto dei Varchi", async () => {
  const presenza = await leggi("../src/sections/presenza-section.js");
  const varchi = await leggi("../src/sections/varchi-section.js");
  /* «Le sezioni devono essere tutte strutturate nella stessa maniera, mai
   * differenti»: chi ha imparato i Varchi non deve imparare la Presenza. */
  for (const pezzo of [
    "function sezioneAccesa()",
    "function accendiLaVoce()",
    "function schedule()",
    "function svegliamiQuandoCambia(righe)",
    "function installStyles()",
    "quandoSiCambiaPagina(schedule)",
    "dashboardmodern:persistence-restored",
  ]) {
    assert.ok(varchi.includes(pezzo), `i Varchi non hanno più ${pezzo}`);
    assert.ok(presenza.includes(pezzo), `la Presenza non ha ${pezzo}`);
  }
  /* La scala dei tempi è una sola, e sta fuori da entrambe. */
  assert.match(presenza, /quantoTempoInParole/);
  assert.match(varchi, /quantoTempoInParole/);
  assert.doesNotMatch(presenza, /function quantoTempo\(/);
  /* A pagina chiusa non si disegna, come i Varchi. */
  assert.match(presenza, /if \(!paginaVisibile\(PRESENZA_PAGE_ID\)\) return;/);
  /* Nella firma ci va anche la scritta che cambia da sola, sennò il «da 5
   * minuti» resta lì per ore su una plancia appesa al muro. */
  assert.match(presenza, /righe\.map\(daQuandoTesto\)/);
});

test("la scheda del Config è quella dei Varchi — adesso proprio la stessa", async () => {
  /* Prima era «la stessa forma», scritta due volte. Adesso è lo stesso file:
   * `scheda-dichiarata-section.js` disegna la riga, la pastiglia, la striscia
   * dei disegni e i gesti, e la presenza porta solo quello che è suo — le
   * parole, i disegni, e cosa propone il tasto d'importazione (#74).
   *
   * Questa prova guarda che la scheda sia davvero quella condivisa e non una
   * terza copia: è l'unico modo perché fra sei mesi le quattro sezioni si
   * comportino ancora alla stessa maniera. */
  const scheda = await leggi("../src/sections/presenza-editor-section.js");
  assert.match(scheda, /costruisciSchedaDichiarata\(\{/);
  assert.match(scheda, /from "\.\/scheda-dichiarata-section\.js"/);
  for (const suo of ["nome: \"presenza\"", "ripiego: \"motion\"", "rilevatoriDaImportare"])
    assert.ok(scheda.includes(suo), `la presenza non porta ${suo}`);
  /* E i gesti del rilevamento non ci sono più: il cestino cancella.
   * Si guarda il codice, non i commenti: l'intestazione racconta com'era
   * prima, e raccontarlo non è rifarlo. */
  const codice = scheda.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const via of ["escludi", "riprendi", "Tolti dai conti"])
    assert.ok(!codice.includes(via), `«${via}» doveva sparire`);
});

test("la tessera della Home non si accende: chi è in casa non è un allarme", async () => {
  const home = await leggi("../src/sections/home-widgets-section.js");
  const tessera = home.slice(
    home.indexOf("function presenzaModel(states)"),
    home.indexOf("/* Le macchine del server e la rete"),
  );
  assert.ok(tessera, "presenzaModel non si trova più dove questa prova lo cerca");
  assert.match(tessera, /key: "presenza"/);
  /* La scelta «nel widget» vale per QUESTA tessera (#431 di prima): la sua
   * chiave le passa accanto, non un elenco globale. */
  assert.match(tessera, /widgetExcludedEntities\("presenza"\)/);
  /* Nessun `alert`: la tessera dei Varchi si accende rossa quando qualcosa è
   * aperto, questa no — qualcuno in casa è la normalità, non una notizia da
   * far lampeggiare. */
  assert.doesNotMatch(tessera, /alert:/);
  assert.match(tessera, /tono: riga\.stato === "attivo" \? "acceso"/);
  /* E il tono «acceso» esiste davvero: una pastiglia con un tono che nessuna
   * regola disegna resterebbe grigia in silenzio. */
  assert.match(home, /\.dm-w-pillola\[data-tono="acceso"\]/);
});

test("due rilevatori nella stessa stanza sono una stanza sola (#549)", () => {
  /* «Ho due sensori sulla stessa stanza e mi dice in due stanze c'è qualcuno.
   *  Ovviamente sono assegnati sulla stessa stanza.»
   *
   * Il conto guardava una riga alla volta, e una stanza grande — o un
   * corridoio con un sensore per capo — diventava due stanze occupate. La
   * didascalia della tessera ci scriveva anche «Salotto · Salotto». */
  const riga = (name, stato, entity) => ({ name, stato, entity });
  const conto = contoDellaPresenza([
    riga("Salotto", "attivo", "binary_sensor.salotto_1"),
    riga("Salotto", "libero", "binary_sensor.salotto_2"),
    riga("Cucina", "libero", "binary_sensor.cucina"),
  ]);
  assert.equal(conto.attivi, 1, "il salotto è una stanza sola");
  assert.deepEqual(conto.nomi, ["Salotto"], "e si nomina una volta sola");
  assert.equal(conto.liberi, 1, "la cucina");
  assert.equal(conto.totale, 2);
});

test("il verdetto di una stanza è il più forte dei suoi rilevatori", () => {
  const riga = (name, stato, entity) => ({ name, stato, entity });
  /* Basta che uno rilevi perché lì ci sia qualcuno: due sensori che si
   * contraddicono non fanno una stanza mezza libera. */
  const uno = contoDellaPresenza([
    riga("Salotto", "libero", "a.1"),
    riga("Salotto", "attivo", "a.2"),
  ]);
  assert.equal(uno.attivi, 1);
  assert.equal(uno.liberi, 0);
  /* E per dirla libera devono dirlo tutti quelli che rispondono. */
  const liberi = contoDellaPresenza([
    riga("Salotto", "libero", "a.1"),
    riga("Salotto", "libero", "a.2"),
  ]);
  assert.equal(liberi.liberi, 1);
  assert.equal(liberi.totale, 1);
});

test("un rilevatore muto non spegne la stanza che ha anche un rilevatore vivo", () => {
  const riga = (name, stato, entity) => ({ name, stato, entity });
  /* Un'assenza di notizie non è una notizia — ma accanto a una notizia vera
   * non la cancella: la stanza risponde, e si conta fra quelle che rispondono. */
  const misto = contoDellaPresenza([riga("Salotto", "", "a.1"), riga("Salotto", "libero", "a.2")]);
  assert.equal(misto.muti, 0);
  assert.equal(misto.liberi, 1);
  /* Una stanza in cui NESSUNO risponde resta muta, che è la regola di prima. */
  const spenta = contoDellaPresenza([riga("Salotto", "", "a.1"), riga("Salotto", "", "a.2")]);
  assert.equal(spenta.muti, 1);
  assert.equal(spenta.liberi, 0);
});

test("senza un nome i rilevatori restano distinti: è la risposta prudente", () => {
  /* Due righe senza nome non si possono dichiarare lo stesso posto: l'entità
   * le tiene separate, e chi guarda vede due letture invece di una fusione
   * inventata. */
  const conto = contoDellaPresenza([
    { name: "", stato: "attivo", entity: "binary_sensor.a" },
    { name: "", stato: "attivo", entity: "binary_sensor.b" },
  ]);
  assert.equal(conto.attivi, 2);
});

test("due rilevatori diversi nella stessa stanza fanno un posto solo, e tengono i loro nomi", () => {
  /* «Non posso dare lo stesso nome se i sensori sono diversi, uno prossimità è
   * l'altro presenza. È utile sapere quale dei due.» (#549)
   *
   * Contare i posti PER NOME non bastava: chiedeva di rinunciare proprio
   * all'informazione che distingue i due rilevatori. La stanza lo dice senza
   * toccare i nomi. */
  const conto = contoDellaPresenza([
    {
      name: "Prossimità salotto",
      stanza: "Salotto",
      stato: "attivo",
      entity: "binary_sensor.prox",
    },
    {
      name: "Presenza salotto",
      stanza: "Salotto",
      stato: "attivo",
      entity: "binary_sensor.pres",
    },
  ]);
  assert.equal(conto.attivi, 1, "una stanza, non due");
  assert.equal(conto.totale, 1);
  /* E il posto si chiama con la stanza: la didascalia diceva «Salotto ·
   * Salotto», adesso dice «Salotto». */
  assert.deepEqual(conto.nomi, ["Salotto"]);
});

test("stanze diverse restano posti diversi, anche col nome uguale", () => {
  /* Il contrario dello stesso errore: due rilevatori chiamati uguale — è
   * normale, «Movimento» dappertutto — ma in due stanze, sono due posti. Col
   * conto per nome facevano una stanza sola e se ne perdeva una. */
  const conto = contoDellaPresenza([
    { name: "Movimento", stanza: "Salotto", stato: "attivo", entity: "binary_sensor.a" },
    { name: "Movimento", stanza: "Cucina", stato: "attivo", entity: "binary_sensor.b" },
  ]);
  assert.equal(conto.attivi, 2);
  assert.deepEqual(conto.nomi.slice().sort(), ["Cucina", "Salotto"]);
});

test("senza stanza vale ancora il nome: Home Assistant non obbliga ad assegnarla", () => {
  /* Il ripiego resta quello di prima, per chi le stanze non le usa. */
  const conto = contoDellaPresenza([
    { name: "Salotto", stato: "attivo", entity: "binary_sensor.a" },
    { name: "Salotto", stato: "libero", entity: "binary_sensor.b" },
  ]);
  assert.equal(conto.attivi, 1);
  assert.equal(conto.totale, 1);
});

test("da un disegno non si chiede niente al socket: i registri si leggono, non si chiedono", async () => {
  /* La correzione per stanza (#549) si appoggia ai tre registri che il guscio
   * mette da parte — le aree, le aree dei dispositivi, quelle delle entità.
   * Quei tre il guscio li chiede dentro `wzLoadAllEntities()`, cioè nella
   * procedura iniziale e nel rilevamento automatico.
   *
   * Chiederli da qui si è provato, nella 1.4.28, ed è costata la #553: «carica
   * correttamente i dati poi all'improvviso scompaiono». La domanda partiva da
   * dentro il disegno, una volta per entità; `config/entity_registry/list` è la
   * risposta più pesante che Home Assistant sappia dare; e dentro il pannello
   * la presa è il ponte, non quella del guscio, quindi falliva sempre — e
   * fallendo si ri-segnava da rifare, cioè si rifaceva a ogni cambio di stato
   * della casa. La linea cadeva, con lei le sottoscrizioni, e i dati sparivano
   * dopo essere comparsi.
   *
   * Questa prova tiene chiusa quella porta: dal modulo che disegna non parte
   * nessuna domanda ai registri. Chi non ha i registri riceve stanza vuota e
   * ripiega sul nome, che è quello che la plancia faceva prima della #549. */
  const sorgente = await readFile(new URL("../src/sections/shared.js", import.meta.url), "utf8");
  /* L'asserzione vale su TUTTO il codice, non sul solo corpo della lettura: la
   * prima versione di questa prova ritagliava a partire da
   * `stanzaDiHomeAssistant`, e la funzione che chiedeva stava sopra — quindi
   * passava anche col difetto dentro. Una prova che non vede quello che deve
   * impedire non serve a niente.
   *
   * I commenti si tolgono prima di guardare: qui sopra, e nel modulo, i tre
   * comandi si NOMINANO apposta per spiegare perché non si chiedono. */
  const codice = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const registro of [
    "config/area_registry/list",
    "config/device_registry/list",
    "config/entity_registry/list",
  ])
    assert.doesNotMatch(codice, new RegExp(registro), `${registro}: non si chiede da qui`);
  const lettura = sorgente.slice(
    sorgente.indexOf("export function stanzaDiHomeAssistant("),
    sorgente.indexOf("/* Una variabile del runtime vendorizzato"),
  );
  assert.ok(lettura, "la lettura della stanza deve esistere");
  assert.doesNotMatch(lettura, /await/, "si legge e si risponde, senza aspettare nessuno");
});

/* ── I registri che sopravvivono al caricamento (#549, dentro il pannello) ──
 *
 * «Ho due sensori sulla stessa stanza e mi dice in due stanze c'è qualcuno.»
 * La correzione c'era, e dentro il pannello non ha mai funzionato: si appoggia
 * ai tre registri di Home Assistant, il guscio li tiene in `WIZ`, e `WIZ` nasce
 * vuoto a ogni caricamento della pagina. Nel pannello nessuno lo riempie — il
 * rilevamento automatico ospitato esce subito perché gli stati vivi gli bastano
 * — quindi la stanza usciva sempre vuota e il conto ripiegava sul nome.
 *
 * Chiederli dal disegno è quello che è costato la #553. Quindi non si chiedono:
 * chi li ha già in mano — il pannello, che li riceve da Home Assistant senza
 * chiedere niente — ne lascia una mappa piatta, e chi disegna la legge.
 */

class DiscoFinto {
  values = new Map();
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

test("con i registri ricordati, due rilevatori nella stessa area fanno un posto solo", () => {
  dimenticaLeStanze();
  const storage = new DiscoFinto();

  /* Quello che il pannello ha già in mano: `hass` porta i tre registri con sé.
   * Nessuna domanda, nessuna presa — ci sono e basta. */
  const hass = {
    areas: { salotto: { area_id: "salotto", name: "Salotto" } },
    devices: { dev1: { id: "dev1", area_id: "salotto" } },
    entities: {
      /* Uno dichiara l'area da sé, l'altro la eredita dal dispositivo: sono i
       * due modi in cui Home Assistant assegna una stanza, e la #549 nasce
       * proprio da una coppia così. */
      "binary_sensor.prox": { entity_id: "binary_sensor.prox", area_id: "salotto" },
      "binary_sensor.pres": { entity_id: "binary_sensor.pres", device_id: "dev1" },
      "binary_sensor.cucina": { entity_id: "binary_sensor.cucina" },
    },
  };
  assert.equal(
    ricordaLeStanze(
      stanzeDaiRegistri({ aree: hass.areas, dispositivi: hass.devices, entita: hass.entities }),
      storage,
    ),
    true,
  );
  /* Si tiene la mappa piatta, non i tre registri: è l'unica cosa che serve. */
  assert.deepEqual(JSON.parse(storage.getItem(CHIAVE_DELLE_STANZE)), {
    "binary_sensor.prox": "Salotto",
    "binary_sensor.pres": "Salotto",
  });

  /* Il caricamento dopo: `WIZ` è di nuovo vuoto, e la stanza si sa lo stesso. */
  dimenticaLeStanze();
  const stanzaDi = (entity) => stanzaRicordata(entity, storage);
  const rilevatori = {
    "binary_sensor.prox": rilevatore("on", "moving", "2026-09-09T10:00:00Z", "Prossimità"),
    "binary_sensor.pres": rilevatore("off", "occupancy", "2026-09-09T09:00:00Z", "Presenza"),
    "binary_sensor.cucina": rilevatore("on", "motion", "2026-09-09T10:30:00Z", "Movimento"),
  };
  const righe = presenzaDiCasa(
    rilevatori,
    {},
    (entity) => rilevatori[entity]?.attributes?.friendly_name || entity,
    stanzaDi,
  );
  assert.equal(righe.find((r) => r.entity === "binary_sensor.pres").stanza, "Salotto");

  const conto = contoDellaPresenza(righe);
  assert.equal(conto.attivi, 2, "il salotto e la cucina, non tre posti");
  assert.equal(conto.totale, 2);
  assert.deepEqual(conto.nomi.slice().sort(), ["Movimento", "Salotto"]);
  /* E i due rilevatori del salotto tengono i loro nomi: la stanza li mette
   * nello stesso posto senza cancellare quale dei due sia. */
  assert.deepEqual(
    righe.filter((r) => r.stanza === "Salotto").map((r) => r.name),
    ["Prossimità", "Presenza"],
  );
});

test("senza registri si ripiega sul nome, e non parte nessuna richiesta", async () => {
  dimenticaLeStanze();
  const vuoto = new DiscoFinto();
  assert.equal(stanzaRicordata("binary_sensor.prox", vuoto), "");
  assert.deepEqual(leStanzeRicordate(vuoto), {});

  /* È il comportamento di prima della #549, ed è quello giusto: senza stanza
   * il nome torna a essere l'identità del posto. */
  dimenticaLeStanze();
  const righe = presenzaDiCasa(
    {
      "binary_sensor.a": rilevatore("on", "motion", "2026-09-09T10:00:00Z"),
      "binary_sensor.b": rilevatore("libero", "motion", "2026-09-09T09:00:00Z"),
    },
    {},
    () => "Salotto",
    (entity) => stanzaRicordata(entity, vuoto),
  );
  const conto = contoDellaPresenza(righe);
  assert.equal(conto.totale, 1, "due righe senza stanza ma con lo stesso nome: un posto");

  /* E il posto dove la mappa vive non sa nemmeno cosa sia una presa di rete:
   * è la porta che la #553 ha chiuso, e questa prova la tiene chiusa. */
  const sorgente = await leggi("../src/core/le-stanze-di-home-assistant.js");
  const codice = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const presa of [
    "config/area_registry/list",
    "config/device_registry/list",
    "config/entity_registry/list",
    "WebSocket",
    "fetch",
    "sendMessage",
    "await",
  ])
    assert.doesNotMatch(codice, new RegExp(presa), `${presa}: qui dentro non ci entra`);
});

test("chi disegna legge la stanza anche a `WIZ` vuoto, e quando c'è la lascia scritta", () => {
  /* Le due metà della correzione, dal punto di vista di chi disegna.
   *
   * `WIZ` vuoto è il pannello, sempre: prima qui usciva vuoto e il conto per
   * stanza non partiva. Adesso risponde la mappa che il pannello ha lasciato.
   * E quando i registri vivi ci sono — fuori dal pannello, dopo la procedura
   * iniziale — si risponde da quelli E si lascia la mappa per il caricamento
   * dopo, che quei registri non li avrà. */
  const storage = new DiscoFinto();
  const primaLS = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  const primaWIZ = globalThis.WIZ;
  try {
    dimenticaLeStanze();
    delete globalThis.WIZ;
    assert.equal(stanzaDiHomeAssistant("binary_sensor.prox"), "", "niente registri, niente stanza");

    ricordaLeStanze({ "binary_sensor.prox": "Salotto" }, storage);
    dimenticaLeStanze();
    assert.equal(stanzaDiHomeAssistant("binary_sensor.prox"), "Salotto");
    assert.equal(stanzaDiHomeAssistant("binary_sensor.mai_vista"), "");
    assert.equal(stanzaDiHomeAssistant(""), "");

    /* Con i registri vivi vincono loro — sono più freschi della copia — e la
     * copia si aggiorna da sé: nessuno deve ricordarsi di farlo. */
    storage.removeItem(CHIAVE_DELLE_STANZE);
    dimenticaLeStanze();
    globalThis.WIZ = {
      entReg: { "binary_sensor.pres": { d: "dev1" } },
      devArea: { dev1: "cucina" },
      areaNames: { cucina: "Cucina" },
    };
    assert.equal(stanzaDiHomeAssistant("binary_sensor.pres"), "Cucina");
    assert.deepEqual(JSON.parse(storage.getItem(CHIAVE_DELLE_STANZE)), {
      "binary_sensor.pres": "Cucina",
    });
  } finally {
    if (primaWIZ === undefined) delete globalThis.WIZ;
    else globalThis.WIZ = primaWIZ;
    if (primaLS) Object.defineProperty(globalThis, "localStorage", primaLS);
    else delete globalThis.localStorage;
    dimenticaLeStanze();
  }
});

test("una riga che punta a un'entità che non c'è lo dice, invece di dire «non risponde»", () => {
  /* Le due frasi mandano in due posti diversi: «non risponde» col dispositivo
   * in mano, «non c'è» nella scheda della configurazione. */
  const righe = presenzaDiCasa(
    { "binary_sensor.salone": rilevatore("on") },
    {
      righe: [
        { entity: "binary_sensor.salone", name: "Salone" },
        { entity: "binary_sensor.sparito", name: "Presenza salone" },
      ],
    },
  );
  const sparito = righe.find((una) => una.entity === "binary_sensor.sparito");
  assert.equal(sparito.stato, ASSENTE);
  assert.equal(parolaDelRilevatore(sparito), "Non c'è in Home Assistant");
  /* E quella vera resta quella vera. */
  const vero = righe.find((una) => una.entity === "binary_sensor.salone");
  assert.equal(vero.stato, "attivo");
  assert.equal(parolaDelRilevatore(vero), "Movimento");
  /* Nel conto delle stanze una sorveglianza che manca non è una stanza
   * libera: sarebbe una casa che sembra più tranquilla di com'è. */
  const conto = contoDellaPresenza(righe);
  assert.equal(conto.liberi, 0);
});
