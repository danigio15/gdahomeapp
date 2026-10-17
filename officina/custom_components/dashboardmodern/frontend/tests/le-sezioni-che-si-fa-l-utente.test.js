/* «Dare la possibilità di creare sezioni custom, dove poter inserire le proprie
 * entità a piacimento. Per esempio con questa feature avrei potuto inserire le
 * entità dell'UPS senza necessariamente attendere lo sviluppo della sezione
 * apposita» (#262).
 *
 * Qui si prova la parte pura — cosa e' una sezione, cosa se ne legge — e le
 * due cose che una pagina nuova nella barra deve rispettare in questa
 * plancia: si deve poter spegnere, e la sua configurazione deve viaggiare.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  ATTRIBUTI_TECNICI,
  FORMATI_SEZIONE,
  MASSIMO_SEZIONI,
  MASSIMO_VOCI_DI_LISTA,
  attributiDisponibili,
  chiaveDellaSezione,
  contoDellaSezione,
  entitaDelleSezioni,
  lettureDellaSezione,
  formatoDellaSezione,
  nomeLeggibile,
  normalizzaSezioni,
  sezioniDaMostrare,
  testoSemplice,
  valoreDellAttributo,
} from "../src/core/sezioni-mie.js";
import { loadCatalog } from "../src/core/i18n.js";

const leggi = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), "utf8");

/* Il caso della segnalazione, scritto come lo scriverebbe l'editor. */
const UPS = {
  id: "ups",
  titolo: "Gruppo di continuità",
  icona: "🔌",
  voci: [
    { nome: "Stato", entity: "sensor.ups_stato", icona: "🔋" },
    { nome: "Carica", entity: "sensor.ups_carica" },
    { nome: "Bypass", entity: "switch.ups_bypass" },
  ],
};

test("una sezione appena creata sopravvive alla normalizzazione", () => {
  /* E' il primo momento di ogni sezione: senza titolo, senza entita'. Buttarla
   * via mentre la si compila sarebbe il modo piu' rapido di rendere la
   * funzione inservibile. */
  const [nuova] = normalizzaSezioni([{}]);
  assert.equal(nuova.voci.length, 0);
  assert.equal(nuova.titolo, "");
  assert.equal(nuova.icona, "⭐");
  assert.equal(nuova.mostra, true);
  assert.ok(nuova.id, "una sezione senza id ne prende uno");
  /* Ma nella barra non ci va: portare a una pagina vuota e' peggio che non
   * offrirla. */
  assert.deepEqual(sezioniDaMostrare([{}]), []);
});

test("le righe senza entità non passano, quelle buone restano", () => {
  const [sezione] = normalizzaSezioni([
    { ...UPS, voci: [...UPS.voci, { nome: "Senza", entity: "" }, { nome: "Storta", entity: "nondominio" }] },
  ]);
  assert.deepEqual(
    sezione.voci.map((voce) => voce.entity),
    ["sensor.ups_stato", "sensor.ups_carica", "switch.ups_bypass"],
  );
});

test("la barra non è infinita: oltre otto sezioni non si va", () => {
  const troppe = Array.from({ length: MASSIMO_SEZIONI + 4 }, (_, i) => ({
    id: `s${i}`,
    voci: [{ entity: "sensor.x" }],
  }));
  assert.equal(normalizzaSezioni(troppe).length, MASSIMO_SEZIONI);
});

test("chi non vuole una sezione nella barra la tiene fuori, senza cancellarla", () => {
  const config = [{ ...UPS, mostra: false }];
  assert.equal(normalizzaSezioni(config).length, 1, "resta configurata");
  assert.deepEqual(sezioniDaMostrare(config), [], "ma fuori dalla barra");
});

test("le letture dicono come sta ogni riga, e chi si può toccare", () => {
  const states = {
    "sensor.ups_stato": { state: "OL" },
    "sensor.ups_carica": { state: "97", attributes: { unit_of_measurement: "%" } },
    "switch.ups_bypass": { state: "on", attributes: { friendly_name: "Bypass automatico" } },
  };
  const [sezione] = normalizzaSezioni([UPS]);
  const letture = lettureDellaSezione(sezione, states);

  /* Un numero con la sua unita' esce come numero; una sigla resta una sigla. */
  assert.equal(letture[0].numero, null);
  assert.equal(letture[0].stato, "OL");
  assert.equal(letture[1].numero, 97);
  assert.equal(letture[1].unita, "%");

  /* Chiamare `toggle` su un sensore non fa niente, e un interruttore che non fa
   * niente e' peggio di nessun interruttore. */
  assert.equal(letture[0].comandabile, false);
  assert.equal(letture[2].comandabile, true);
  assert.equal(letture[2].acceso, true);

  const conto = contoDellaSezione(letture);
  assert.deepEqual(conto, { quante: 3, vive: 3, accese: 1, mute: 0, comandabili: 1 });
});

test("un'entità che non risponde si vede che non risponde, e non conta", () => {
  const [sezione] = normalizzaSezioni([UPS]);
  const letture = lettureDellaSezione(sezione, { "sensor.ups_stato": { state: "unavailable" } });
  assert.equal(letture[0].muto, true);
  assert.equal(letture[0].acceso, false);
  /* Le altre due non stanno proprio negli stati: mute anche loro. */
  assert.deepEqual(contoDellaSezione(letture), {
    quante: 3,
    vive: 0,
    accese: 0,
    mute: 3,
    comandabili: 1,
  });
});

test("il nome scritto vince, poi quello di Home Assistant, poi l'entità nuda", () => {
  const [sezione] = normalizzaSezioni([
    { id: "x", voci: [{ entity: "sensor.uno", nome: "Il mio" }, { entity: "sensor.due" }, { entity: "sensor.tre" }] },
  ]);
  const letture = lettureDellaSezione(sezione, {
    "sensor.due": { state: "1", attributes: { friendly_name: "Quello di HA" } },
  });
  assert.deepEqual(
    letture.map((riga) => riga.nome),
    ["Il mio", "Quello di HA", "sensor.tre"],
  );
});

test("le entità di tutte le sezioni, senza doppioni", () => {
  const config = [UPS, { id: "b", voci: [{ entity: "sensor.ups_stato" }, { entity: "sensor.orto" }] }];
  assert.deepEqual(entitaDelleSezioni(config), [
    "sensor.ups_stato",
    "sensor.ups_carica",
    "switch.ups_bypass",
    "sensor.orto",
  ]);
});

test("la voce di ogni sezione ha la sua chiave, e la chiave è sua", () => {
  assert.equal(chiaveDellaSezione("ups"), "mia-ups");
  assert.notEqual(chiaveDellaSezione("ups"), "ups", "non deve pestare i piedi all'UPS");
});

test("la pagina si spegne con la stessa chiave che la fascia scrive", () => {
  /* Il difetto da cui nasce la prova sorella (#l'Agenda e l'UPS): una
   * voce nella barra e nessun posto dove spegnerla. */
  const pagina = leggi("sections/sezioni-mie-section.js");
  assert.match(pagina, /SEZIONI_MIE_TAB = "mie"/);
  assert.match(pagina, /readJson\("cd_sections"/);
  const editor = leggi("sections/sezioni-mie-editor-section.js");
  assert.match(editor, /cdSecToggleHtml\?\.\(CHIAVE_SEZIONE\)/);
});

test("la configurazione viaggia, come tutte le altre", () => {
  /* Le sezioni le disegna l'utente: non viaggiare vorrebbe dire rifarle su
   * ogni dispositivo. */
  const persistenza = leggi("core/chiavi-di-configurazione.js");
  assert.match(persistenza, /"cd_sezioni_mie"/);
});

test("l'intestazione la disegna chi disegna tutte le altre", () => {
  /* Una pagina senza intestazione sarebbe l'unica senza — cioè l'unica che si
   * vede come una pagina di serie B. */
  const pagina = leggi("sections/sezioni-mie-section.js");
  assert.match(pagina, /registraPaginaARuntime\(/);
  const masthead = leggi("sections/page-masthead-section.js");
  assert.match(masthead, /export function registraPaginaARuntime/);
});

/* ── il formato delle voci (#515) ──────────────────────────────────────── */

test("una sezione senza formato scritto sta a righe, come è sempre stata", () => {
  /* «Si potrebbe poter scegliere il tipo di scheda? Magari averle più piccole»
   * (#515). Chi non sceglie niente non deve accorgersi di niente: tutte le
   * sezioni che esistono oggi non hanno il campo, e devono restare com'erano. */
  assert.equal(normalizzaSezioni([UPS])[0].formato, "righe");
  assert.equal(formatoDellaSezione(""), "righe");
  assert.equal(formatoDellaSezione("gigante"), "righe");
  assert.equal(formatoDellaSezione(undefined), "righe");
});

test("il formato scelto si tiene, e sono due", () => {
  assert.deepEqual([...FORMATI_SEZIONE], ["righe", "piccole"]);
  assert.equal(normalizzaSezioni([{ ...UPS, formato: "piccole" }])[0].formato, "piccole");
  assert.equal(formatoDellaSezione("piccole"), "piccole");
});

test("il formato lo porta la pagina in un attributo, non un secondo disegno", () => {
  /* La riga disegnata resta una sola — stessa icona, stesso nome, stesso
   * valore, stessa leva — e cambia come si dispone. Due disegni per la stessa
   * voce sarebbero due disegni da tenere allineati. */
  const sezione = leggi("sections/sezioni-mie-section.js");
  assert.match(sezione, /data-formato="\$\{esc\(formato\)\}"/);
  assert.match(sezione, /\.dm-mia-lista\[data-formato="piccole"\]\{/);
  assert.equal((sezione.match(/function rigaMarkup\(/g) || []).length, 1);
  /* E il ridisegno lo vede: senza il formato nella firma, cambiarlo non
   * avrebbe ridipinto niente finché non cambiava anche uno stato. */
  assert.match(sezione, /JSON\.stringify\(\[sezione\.titolo, sezione\.icona, sezione\.formato, letture\]\)/);
});

test("la scelta sta nell'editor della sezione, accanto a quella della barra", () => {
  const editor = leggi("sections/sezioni-mie-editor-section.js");
  assert.match(editor, /data-mia-formato="\$\{esc\(formato\)\}"/);
  assert.match(editor, /letto\.formato = formatoDellaSezione\(/);
  /* Una sezione nuova nasce a righe: è il formato che hanno tutte le altre. */
  assert.match(editor, /formato: FORMATI_SEZIONE\[0\]/);
});

/* ── gli attributi (#256) ──────────────────────────────────────────────── */

/* Un sensore della scuola come lo manda un'integrazione qualunque: la media
 * nello stato, e il resto negli attributi, tecnici compresi. */
const MEDIA = {
  state: "7.8",
  attributes: {
    ultimo_voto: 8.5,
    materia: "Storia",
    data: "2026-10-14",
    tipo: "Interrogazione",
    friendly_name: "Media voti",
    icon: "mdi:school",
    unit_of_measurement: "",
    device_class: "voto",
    state_class: "measurement",
    attribution: "Dati del registro",
    entity_picture: "/foto.png",
    supported_features: 0,
  },
};

const SCUOLA = {
  id: "scuola",
  titolo: "Scuola",
  voci: [
    {
      entity: "sensor.scuola_media_voti",
      attributi: [
        { chiave: "ultimo_voto", nome: "Ultimo voto" },
        { chiave: "materia", nome: "" },
        { chiave: "data", nome: "Quando" },
      ],
    },
  ],
};

test("gli attributi scelti si tengono nell'ordine, una volta sola, e senza tecnici", () => {
  const [sezione] = normalizzaSezioni([
    {
      id: "x",
      voci: [
        {
          entity: "sensor.uno",
          attributi: [
            { chiave: "materia", nome: "  Materia  " },
            { chiave: "ultimo_voto" },
            { chiave: "materia", nome: "Doppione" },
            { chiave: "friendly_name", nome: "Tecnico" },
            { chiave: "", nome: "Senza chiave" },
            "tipo",
            null,
          ],
        },
        { entity: "sensor.due" },
      ],
    },
  ]);
  assert.deepEqual(sezione.voci[0].attributi, [
    { chiave: "materia", nome: "Materia" },
    { chiave: "ultimo_voto", nome: "" },
    { chiave: "tipo", nome: "" },
  ]);
  /* Una voce di prima, che gli attributi non li conosceva, ne ha zero. */
  assert.deepEqual(sezione.voci[1].attributi, []);
});

test("la chiave si legge come una parola", () => {
  assert.equal(nomeLeggibile("ultimo_voto"), "Ultimo voto");
  assert.equal(nomeLeggibile("materia"), "Materia");
  assert.equal(nomeLeggibile("prossima-consegna"), "Prossima consegna");
  assert.equal(nomeLeggibile("oreDiAssenza"), "Ore di assenza");
  assert.equal(nomeLeggibile(""), "");
});

test("all'editor si offrono gli attributi di adesso, senza quelli tecnici", () => {
  const offerti = attributiDisponibili(MEDIA, "it");
  assert.deepEqual(
    offerti.map((attributo) => attributo.chiave),
    ["ultimo_voto", "materia", "data", "tipo"],
  );
  for (const tecnico of [
    "friendly_name",
    "icon",
    "unit_of_measurement",
    "device_class",
    "state_class",
    "attribution",
    "entity_picture",
    "supported_features",
  ])
    assert.ok(ATTRIBUTI_TECNICI.has(tecnico), `${tecnico} deve stare fra i tecnici`);
  /* Con l'anteprima del valore, gia' nella lingua di casa. */
  assert.equal(offerti[0].anteprima, "8,5");
  assert.equal(offerti[2].anteprima, "mer 14 ott");
  assert.deepEqual(attributiDisponibili(undefined), []);
  assert.deepEqual(attributiDisponibili({ state: "1" }), []);
});

test("i valori si leggono come si dicono: numeri, sì e no, date", () => {
  assert.equal(testoSemplice(8.5, "it"), "8,5");
  assert.equal(testoSemplice("8.5", "it"), "8,5");
  assert.equal(testoSemplice(12345.5, "it"), "12.345,5");
  assert.equal(testoSemplice(11, "it"), "11");
  assert.equal(testoSemplice(8.5, "en"), "8.5");
  assert.equal(testoSemplice(true, "it"), "Sì");
  assert.equal(testoSemplice(false, "it"), "No");
  assert.equal(testoSemplice(true, "en"), "Yes");
  /* Una data non va a capo: gli spazi sono quelli che non si spezzano. */
  assert.equal(testoSemplice("2026-10-14", "it"), "mer 14 ott");
  assert.doesNotMatch(testoSemplice("2026-10-17", "it"), / /);
  /* Mezzanotte e' il giorno, in qualunque fuso sia scritta. */
  assert.equal(testoSemplice("2026-10-14T00:00:00+00:00", "it"), "mer 14 ott");
  /* Un'ora vera si tiene. */
  assert.match(testoSemplice("2026-10-14T08:30:00", "it"), /^mer 14 ott.*08:30$/);
  /* Quello che non e' ne' numero ne' data resta com'e'. */
  assert.equal(testoSemplice("Interrogazione", "it"), "Interrogazione");
  assert.equal(testoSemplice("0042", "it"), "0042");
});

test("una lista mostra al massimo tre voci, poi «e altri N»", () => {
  assert.equal(MASSIMO_VOCI_DI_LISTA, 3);
  const valore = valoreDellAttributo(["uno", "due", "tre", "quattro", "cinque"], "it");
  assert.equal(valore.lista, true);
  assert.deepEqual(
    valore.pezzi.map((pezzo) => pezzo.testa),
    ["uno", "due", "tre"],
  );
  assert.equal(valore.altri, 2);
  assert.equal(valore.altriTesto, "e altri 2");
  assert.equal(valore.testo, "uno, due, tre e altri 2");
  /* Tre su tre: niente «e altri 0». */
  const giuste = valoreDellAttributo(["a", "b", "c"], "it");
  assert.equal(giuste.altri, 0);
  assert.equal(giuste.altriTesto, "");
});

test("un elemento-oggetto di una lista: il primo valore in testa, gli altri dopo", () => {
  const compiti = [
    { materia: "Matematica", cosa: "Esercizi da pag. 42 a pag. 44", consegna: "2026-10-17" },
    { materia: "Italiano", cosa: "Tema", consegna: "2026-10-19", fatto: false },
  ];
  const valore = valoreDellAttributo(compiti, "it");
  assert.deepEqual(valore.pezzi[0], {
    testa: "Matematica",
    resto: ["Esercizi da pag. 42 a pag. 44", "sab 17 ott"],
  });
  assert.deepEqual(valore.pezzi[1], {
    testa: "Italiano",
    resto: ["Tema", "lun 19 ott", "No"],
  });
  assert.equal(
    valore.testo,
    "Matematica · Esercizi da pag. 42 a pag. 44 · sab 17 ott, " +
      "Italiano · Tema · lun 19 ott · No",
  );
});

test("un valore vuoto non fa una riga", () => {
  for (const vuoto of [null, undefined, "", "   ", [], [null, ""], {}])
    assert.equal(valoreDellAttributo(vuoto, "it"), null, JSON.stringify(vuoto));
});

test("la lettura porta etichetta e valore degli attributi scelti, e salta quelli spariti", () => {
  const [sezione] = normalizzaSezioni([SCUOLA]);
  const stati = { "sensor.scuola_media_voti": MEDIA };
  const [riga] = lettureDellaSezione(sezione, stati, undefined, "it");
  assert.equal(riga.numero, 7.8);
  assert.deepEqual(
    riga.attributi.map((attributo) => [attributo.etichetta, attributo.valore.testo]),
    [
      ["Ultimo voto", "8,5"],
      /* Senza nome scritto si legge la chiave resa leggibile. */
      ["Materia", "Storia"],
      ["Quando", "mer 14 ott"],
    ],
  );
  /* L'entita' ha smesso di mandare «materia»: la riga se ne va, le altre no. */
  const senza = { ...MEDIA, attributes: { ...MEDIA.attributes } };
  delete senza.attributes.materia;
  const [dopo] = lettureDellaSezione(
    sezione,
    { "sensor.scuola_media_voti": senza },
    undefined,
    "it",
  );
  assert.deepEqual(
    dopo.attributi.map((attributo) => attributo.chiave),
    ["ultimo_voto", "data"],
  );
  /* E un'entita' che non c'e' proprio non ne ha nessuno. */
  assert.deepEqual(lettureDellaSezione(sezione, {}, undefined, "it")[0].attributi, []);
});

test("le parole e le date seguono la lingua della plancia", async () => {
  await loadCatalog("de");
  assert.equal(valoreDellAttributo(["a", "b", "c", "d", "e"], "de").altriTesto, "und 2 weitere");
  assert.equal(testoSemplice(true, "de"), "Ja");
  assert.equal(testoSemplice(8.5, "de"), "8,5");
  assert.doesNotMatch(testoSemplice("2026-10-14", "de"), /mer|ott/);
  assert.match(testoSemplice("2026-10-14", "de"), /Okt/);
});

test("una sezione di soli sensori non conta le accese", () => {
  /* «0 accese su 4» in una sezione dove non c'e' niente da accendere si
   * legge come un guasto. */
  const [sezione] = normalizzaSezioni([
    { id: "s", voci: [{ entity: "sensor.a" }, { entity: "sensor.b" }] },
  ]);
  const conto = contoDellaSezione(
    lettureDellaSezione(sezione, { "sensor.a": { state: "1" }, "sensor.b": { state: "2" } }),
  );
  assert.equal(conto.comandabili, 0);
  const pagina = leggi("sections/sezioni-mie-section.js");
  const sotto = pagina.slice(pagina.indexOf("function sottotitolo("));
  assert.match(sotto, /conto\.comandabili/);
  assert.match(sotto, /t\("entità", "entities"\)/);
});

test("la scheda rimostra lo stato e mette gli attributi sotto, passati da esc", () => {
  const pagina = leggi("sections/sezioni-mie-section.js");
  const riga = pagina.slice(pagina.indexOf("function rigaMarkup("), pagina.indexOf("function sottotitolo("));
  assert.match(riga, /valoreMarkup\(riga\)/, "lo stato torna a destra");
  assert.match(riga, /attributiMarkup\(riga, formato\)/);
  assert.match(pagina, /<dl class="dm-mia-attr">/);
  assert.match(pagina, /<dt>\$\{esc\(attributo\.etichetta\)\}<\/dt>/);
  assert.match(pagina, /<b>\$\{esc\(testa\)\}<\/b>/);
  /* Nelle piccole al massimo due, su una riga sola. */
  assert.match(pagina, /const ATTRIBUTI_NELLE_PICCOLE = 2;/);
  assert.match(
    pagina,
    /\.dm-mia-lista\[data-formato="piccole"\] \.dm-mia-attr dd\{[^}]*white-space:nowrap/,
  );
});

test("l'editor salva gli attributi spuntati nella voce, col loro nome", () => {
  const editor = leggi("sections/sezioni-mie-editor-section.js");
  assert.match(editor, /attributiDisponibili\(/);
  assert.match(editor, /data-mia-attr-spunta/);
  assert.match(editor, /data-mia-attr-nome/);
  assert.match(editor, /if \(attributi\.length\) voce\.attributi = attributi;/);
  /* Le caselle degli attributi non sono campi della voce: se lo fossero,
   * `leggiLaRiga` le scriverebbe come `voce[chiave] = valore`. */
  const blocco = editor.slice(editor.indexOf("function rigaAttributoMarkup("));
  assert.doesNotMatch(blocco.slice(0, blocco.indexOf("\n}\n")), /data-mia-campo/);
});
