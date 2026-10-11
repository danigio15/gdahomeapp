/* Le finestre del gruppo «comandi»: Finestre e tapparelle, Prese, Apri porte,
 * Musica, Citofono e posta, Robot.
 *
 * La finestra generica le apriva tutte allo stesso modo — un verdetto, «Le
 * misure» col numero della tessera ripetuto, le pillole de «Lo stato» — e i
 * comandi in fondo. Qui si prova quello che conta in ognuna: in cima la cosa
 * giusta, i tasti presenti, l'ordine, niente identificativi grezzi, e le parti
 * che non hanno il loro dato assenti invece che inventate.
 *
 * Ci sono anche i due difetti trovati nell'analisi: le Porte che dicevano
 * «Tutto chiuso» col garage aperto, e le Finestre che sommavano le ante aperte
 * alle tapparelle alzate in un numero solo. */
import assert from "node:assert/strict";
import test from "node:test";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { porteAperte } = await import("../src/sections/home-widgets-section.js");
const { finestraDi } = await import("../src/sections/finestre-dei-widget.js");
const { posizioneInParole, stanzeDelleFinestre, daQuanto, orario } = await import(
  "../src/sections/finestre/comandi.js"
);

const ADESSO = Date.now();
const minutiFa = (minuti) => ADESSO - minuti * 60000;
const disegna = (chiave, widget, states = {}) =>
  finestraDi(chiave).disegna({ key: chiave, ...widget }, states);
/* Il testo come si legge: senza tag, senza le icone, con gli apostrofi veri. */
const senzaTag = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&#39;", "'")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\u{FE0F}?/gu, " ")
    .replace(/\s+/g, " ");

test("tutte e sei le tessere hanno la loro finestra", () => {
  for (const chiave of ["tapparelle", "prese", "porte", "media", "citofono", "robot"])
    assert.ok(finestraDi(chiave), `manca la finestra di ${chiave}`);
});

/* ── Finestre e tapparelle ───────────────────────────────────────────── */

const motore = (stanza, extra = {}) => ({
  entity: `cover.${stanza.toLowerCase()}`,
  name: stanza,
  stanza,
  soloSensore: false,
  isCover: true,
  kind: "tapparella",
  open: false,
  position: 0,
  down: "",
  ...extra,
});
const anta = (stanza, open, extra = {}) => ({
  entity: `binary_sensor.${stanza.toLowerCase()}`,
  name: `${stanza} · Finestra`,
  stanza,
  soloSensore: true,
  open,
  position: null,
  ...extra,
});

const CASA_FINESTRE = [
  anta("Cucina", true, { da: minutiFa(25) }),
  anta("Bagno", true, { name: "Bagno", da: minutiFa(10) }),
  motore("Cucina", { open: true, position: 60 }),
  motore("Salone", { open: true, position: 100 }),
  motore("Studio", { open: true, position: 100 }),
  motore("Camera", { open: false, position: 0 }),
  motore("Camera", { entity: "cover.camera_sole", kind: "tenda_sole", open: false, position: 0 }),
  anta("Salone", false),
];

test("finestre aperte e tapparelle su stanno in due numeri separati, non in uno", () => {
  const html = disegna("tapparelle", { rows: CASA_FINESTRE });
  const testo = senzaTag(html);
  assert.match(testo, /Finestre aperte 2 Cucina e Bagno/);
  assert.match(testo, /Tapparelle su 3 su 5/);
  assert.doesNotMatch(testo, /aperte su 8|5 aperte/, "la somma di cose diverse non torna");
  assert.doesNotMatch(testo, /Le misure|Apertura media/);
});

test("una scheda per stanza, prima quelle con qualcosa aperto", () => {
  const stanze = stanzeDelleFinestre(CASA_FINESTRE);
  const cucina = stanze.find((stanza) => stanza.nome === "Cucina");
  assert.equal(cucina.ante.length, 1);
  assert.equal(cucina.motori.length, 1, "la Cucina non compare due volte");
  const html = disegna("tapparelle", { rows: CASA_FINESTRE });
  const ordine = [...html.matchAll(/dm-f-tapparelle-nome"><b>([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(ordine.slice(0, 2), ["Cucina", "Bagno"]);
  assert.equal(ordine.at(-1), "Camera");
  assert.match(senzaTag(html), /Camera Tapparella giù · Tenda da sole chiusa/);
});

test("le tapparelle hanno le frecce sulla riga e i tasti per tutte", () => {
  const html = disegna("tapparelle", { rows: CASA_FINESTRE });
  assert.match(html, /data-dm-w-cover="cover\.cucina"[^>]*data-svc="open_cover"/);
  assert.match(html, /data-dm-w-cover="cover\.cucina"[^>]*data-svc="close_cover"/);
  assert.match(html, /&quot;service&quot;:&quot;close_cover&quot;/, "Giù tutte");
  assert.match(html, /&quot;service&quot;:&quot;open_cover&quot;/, "Su tutte");
  /* La finestra col solo sensore non ha frecce: non c'e' niente da muovere. */
  assert.doesNotMatch(html, /data-dm-w-cover="binary_sensor/);
});

test("le posizioni si dicono a parole", () => {
  assert.equal(posizioneInParole({ position: 100 }), "Tutta su");
  assert.equal(posizioneInParole({ position: 60 }), "60% su");
  assert.equal(posizioneInParole({ position: 0 }), "Giù");
  assert.equal(posizioneInParole({ position: null, open: true }), "Su");
  assert.equal(posizioneInParole({ kind: "tenda_sole", position: 0 }), "Chiusa");
});

test("senza contatti sull'anta il numero delle finestre non compare", () => {
  const testo = senzaTag(disegna("tapparelle", { rows: [motore("Studio", { open: true })] }));
  assert.doesNotMatch(testo, /Finestre aperte/);
  assert.match(testo, /Tapparelle su 1/);
});

/* ── Prese ───────────────────────────────────────────────────────────── */

const presa = (name, extra = {}) => ({
  name,
  entity: `switch.${name.toLowerCase().replaceAll(" ", "_")}`,
  glyph: "🔌",
  on: false,
  comando: true,
  disponibile: true,
  protetta: false,
  stanza: "",
  watt: null,
  ...extra,
});

test("le prese accese in alto, le spente sotto, chi non risponde in fondo", () => {
  const rows = [
    presa("Giardino", { disponibile: false, comando: false, da: minutiFa(90) }),
    presa("Firestick", { stanza: "Salone" }),
    presa("TV", { on: true, stanza: "Salone", watt: 92 }),
    presa("Modem", { on: true, comando: false, protetta: true, stanza: "Studio" }),
  ];
  const html = disegna("prese", { rows, watt: 92 });
  const testo = senzaTag(html);
  assert.match(testo, /Accese 2 \/ 4/);
  assert.match(testo, /92 W assorbiti adesso/);
  const nomi = [...html.matchAll(/<b>([^<]+)<\/b>\s*<small>/g)].map((m) => m[1]);
  assert.deepEqual(nomi, ["TV", "Modem", "Firestick", "Giardino"]);
  assert.match(html, /data-dm-w-light="switch\.tv"/);
  /* La presa protetta ha il lucchetto, non l'interruttore. */
  assert.doesNotMatch(html, /data-dm-w-light="switch\.modem"/);
  assert.match(testo, /protetta/);
  assert.match(testo, /Non risponde da/);
  assert.doesNotMatch(testo, /Lo stato|In corso/);
});

test("senza wattmetri i watt non si inventano", () => {
  const testo = senzaTag(disegna("prese", { rows: [presa("TV", { on: true })], watt: null }));
  assert.doesNotMatch(testo, /assorbiti adesso|\bW\b/);
});

/* ── Apri porte ──────────────────────────────────────────────────────── */

test("un garage aperto non e' «Tutto chiuso»: le coperture dicono di stare aperte", () => {
  const doors = [{ entity: "lock.portone" }, { entity: "cover.garage" }, { entity: "switch.cancello" }];
  const states = {
    "lock.portone": { state: "locked" },
    "cover.garage": { state: "open" },
    "switch.cancello": { state: "on" },
  };
  assert.deepEqual(
    porteAperte(doors, states).map((door) => door.entity),
    ["cover.garage"],
  );
});

const porta = (name, dominio, extra = {}) => ({
  id: name.toLowerCase(),
  entity: `${dominio}.${name.toLowerCase()}`,
  name,
  icona: "🚪",
  dominio,
  dichiara: dominio === "lock" || dominio === "cover",
  aperta: false,
  chiusaAChiave: false,
  parola: "",
  pin: false,
  gesti: [{ gesto: "apri", parola: "Apri" }],
  da: null,
  ultima: null,
  ...extra,
});

test("in cima solo quello che e' rimasto aperto, con il tasto per chiuderlo", () => {
  const righe = [
    porta("Portone", "lock", {
      chiusaAChiave: true,
      parola: "Chiusa a chiave",
      gesti: [
        { gesto: "sblocca", parola: "Sblocca" },
        { gesto: "blocca", parola: "Blocca" },
      ],
      ultima: minutiFa(60 * 20),
    }),
    porta("Garage", "cover", { aperta: true, parola: "Aperta", da: minutiFa(12), ultima: minutiFa(12) }),
    porta("Pedonale", "button", { ultima: minutiFa(200) }),
  ];
  const html = disegna("porte", { righe, conferma: true });
  const testo = senzaTag(html);
  assert.match(testo, /Garage · Aperta da 12 minuti/);
  assert.doesNotMatch(testo, /Tutto chiuso/);
  /* Il garage aperto si chiude; il portone chiuso a chiave si sblocca. */
  assert.match(html, /&quot;service&quot;:&quot;close_cover&quot;,&quot;data&quot;:\{&quot;entity_id&quot;:&quot;cover\.garage&quot;/);
  assert.match(html, /data-dm-door="portone"\s+data-dm-door-gesto="sblocca"/);
  /* Tutti e tre i gesti della serratura restano (#34): pieno quello che
   * serve adesso, il blocco piu' leggero perche' e' gia' chiusa. */
  assert.match(html, /data-leggero="true" data-dm-door="portone"\s+data-dm-door-gesto="blocca"/);
  assert.match(html, /data-leggero="false" data-dm-door="portone"\s+data-dm-door-gesto="sblocca"/);
  assert.match(html, /data-dm-door="pedonale"[^>]*/);
  assert.match(html, /data-leggero="true" data-dm-door="pedonale"/, "l'impulso ha il tasto leggero");
  assert.match(testo, /Chiede conferma prima di aprire/);
  /* Le ultime aperture, la piu' recente in alto. */
  const storia = html.slice(html.indexOf("Ultime aperture"));
  assert.ok(storia.indexOf("Garage") < storia.indexOf("Pedonale"));
  assert.ok(storia.indexOf("Pedonale") < storia.indexOf("Portone"));
});

test("tutto chiuso: una riga verde, e niente storia se non c'e'", () => {
  const html = disegna("porte", {
    righe: [porta("Portone", "lock", { chiusaAChiave: true, parola: "Chiusa a chiave", gesti: [] })],
    conferma: false,
  });
  assert.match(html, /data-tono="ok"[^]*Tutto chiuso/);
  assert.doesNotMatch(html, /Ultime aperture/);
  assert.doesNotMatch(html, /Chiede conferma/);
});

/* ── Musica ──────────────────────────────────────────────────────────── */

const cassa = (nome, extra = {}) => ({
  entity: `media_player.${nome.toLowerCase()}`,
  nome,
  suona: false,
  inPausa: false,
  spento: false,
  muto: false,
  titolo: "",
  artista: "",
  album: "",
  sorgente: "",
  applicazione: "",
  volume: 0.3,
  puo: { pausa: true, precedente: true, successivo: true, volume: true, accendi: true },
  ...extra,
});

test("in cima quello che suona, coi tasti e il volume; mai l'entity_id", () => {
  const lettori = [
    cassa("Cucina", { inPausa: true, sorgente: "Radio Deejay" }),
    cassa("Salotto", {
      suona: true,
      titolo: "So What",
      artista: "Miles Davis",
      album: "Kind of Blue",
      applicazione: "Spotify",
      durata: 562,
      posizione: 143,
    }),
    cassa("TV camera", { spento: true }),
  ];
  const html = disegna("media", { lettori });
  const testo = senzaTag(html);
  assert.match(testo, /Salotto · Spotify So What Miles Davis · Kind of Blue/);
  assert.match(html, /data-dm-mp="precedente" data-dm-mp-entity="media_player\.salotto"/);
  assert.match(html, /data-dm-mp="successivo" data-dm-mp-entity="media_player\.salotto"/);
  assert.match(html, /data-dm-mp-volume="media_player\.salotto"/);
  assert.match(testo, /Le altre casse Cucina In pausa · Radio Deejay/);
  assert.match(testo, /TV camera Spenta/);
  assert.doesNotMatch(testo, /media_player\./);
  assert.ok(html.indexOf("Salotto") < html.indexOf("Cucina"));
});

test("quando non suona niente, l'elenco delle casse col tasto play", () => {
  const html = disegna("media", { lettori: [cassa("Cucina", { inPausa: true })] });
  assert.doesNotMatch(html, /dm-f-media-eroe/);
  assert.match(senzaTag(html), /Le casse Cucina/);
  assert.match(html, /data-centro="suona"/);
});

/* ── Citofono e posta ────────────────────────────────────────────────── */

const citofono = {
  id: "c1",
  nome: "Cancello",
  puoAprire: true,
  comando: { domain: "button", service: "press", data: { entity_id: "button.cancello" } },
  suona: false,
  squillo: minutiFa(60 * 24),
};

test("c'e' posta: la notizia in cima, «L'ho presa», e il cancello con la conferma", () => {
  const cassetta = {
    id: "k1",
    nome: "Cassetta",
    ce: true,
    arrivata: minutiFa(30),
    ritirata: minutiFa(60 * 26),
  };
  const html = disegna("citofono", { citofoni: [citofono], cassette: [cassetta] });
  const testo = senzaTag(html);
  assert.match(testo, /C'è posta arrivata alle .* · 30 minuti fa/);
  assert.match(html, /data-dm-cassetta-presa="k1"/);
  assert.match(html, /data-dm-w-servizio="\{&quot;domain&quot;:&quot;button&quot;,&quot;service&quot;:&quot;press&quot;/);
  assert.match(html, /data-dm-w-conferma=/, "aprire il cancello chiede un secondo tocco");
  assert.match(testo, /Apri il cancello/);
  const cose = testo.slice(testo.indexOf("Ultime cose"));
  assert.ok(cose.indexOf("Posta arrivata") < cose.indexOf("Hanno suonato"));
  assert.ok(cose.indexOf("Hanno suonato") < cose.indexOf("Posta ritirata"));
  assert.doesNotMatch(testo, /in funzione|Tutto regolare/);
});

test("quando suonano, l'eroe e' il campanello col tasto per aprire", () => {
  const html = disegna("citofono", {
    citofoni: [{ ...citofono, suona: true, squillo: ADESSO }],
    cassette: [],
  });
  const testo = senzaTag(html);
  assert.match(testo, /C'è qualcuno alla porta/);
  assert.ok(testo.indexOf("C'è qualcuno") < testo.indexOf("Apri il cancello"));
});

/* ── Robot ───────────────────────────────────────────────────────────── */

const robot = (name, extra = {}) => ({
  name,
  entity: `vacuum.${name.toLowerCase().replaceAll(" ", "_")}`,
  species: "vacuum",
  state: "docked",
  cleaning: false,
  mowing: false,
  available: true,
  battery: 100,
  room: "",
  fanSpeed: "",
  features: 0,
  ...extra,
});

test("il robot al lavoro in cima con Pausa e Alla base, gli altri con Avvia", () => {
  const rows = [
    robot("Roomba", { battery: 100 }),
    robot("Roborock", {
      state: "cleaning",
      cleaning: true,
      battery: 76,
      room: "Cucina",
      fanSpeed: "Turbo",
      da: minutiFa(18),
    }),
    robot("Tagliaerba", { entity: "lawn_mower.prato", species: "lawn_mower", battery: 15 }),
  ];
  const html = disegna("robot", { rows });
  const testo = senzaTag(html);
  assert.match(testo, /76% batteria Sta pulendo Roborock Cucina · da 18 minuti · Potenza Turbo/);
  assert.match(html, /&quot;service&quot;:&quot;pause&quot;,&quot;data&quot;:\{&quot;entity_id&quot;:&quot;vacuum\.roborock/);
  assert.match(html, /&quot;service&quot;:&quot;return_to_base&quot;/);
  assert.match(html, /&quot;service&quot;:&quot;start&quot;,&quot;data&quot;:\{&quot;entity_id&quot;:&quot;vacuum\.roomba/);
  assert.match(html, /&quot;domain&quot;:&quot;lawn_mower&quot;,&quot;service&quot;:&quot;start_mowing&quot;/);
  /* Batteria scarica in rosso solo sotto la soglia. */
  assert.match(html, /data-scarica="true"[^>]*><i style="width:15%"/);
  assert.match(html, /data-scarica="false"[^>]*><i style="width:100%"/);
  assert.doesNotMatch(testo, /Le misure|In corso/);
});

test("nessuno al lavoro: niente eroe, l'elenco dei robot", () => {
  const html = disegna("robot", { rows: [robot("Roomba")] });
  assert.doesNotMatch(html, /dm-f-robot-eroe/);
  assert.match(senzaTag(html), /I robot Roomba Alla base · 100%/);
});

/* ── le parole del tempo ─────────────────────────────────────────────── */

test("«da quanto» non dice mai «da appena adesso», e l'ora di ieri lo dice", () => {
  assert.equal(daQuanto(ADESSO, ADESSO), "appena adesso");
  assert.equal(daQuanto(minutiFa(12), ADESSO), "da 12 minuti");
  assert.equal(daQuanto(null), "");
  assert.match(orario(ADESSO - 86400000, ADESSO), /^ieri /);
});
