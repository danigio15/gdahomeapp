/* Porte, finestre e tapparelle: tre cose, tre conti (#162).
 *
 * «Nella pagina Home i chip di riepilogo attualmente aggregano categorie
 * diverse: “Varchi aperti” somma insieme contatti di porte e finestre.
 * “Finestre aperte” in realtà conta le tapparelle/covers aperti.»
 *
 * E poi, punto per punto: le porte aperte solo dai contatti porta, le finestre
 * solo dai contatti finestra, mai una serratura fra le porte aperte —
 * «unlocked significa solo serratura non chiusa a chiave, non porta
 * fisicamente aperta» —, solo sensori di contatto per dire aperto o chiuso, e
 * dall'editor il modo di correggere un contatto classificato male.
 *
 * Qui si tiene fermo ognuno di quei punti, nel nucleo dove sta la regola e
 * nelle due pagine che la usano: la fascia sotto il meteo e le stanze.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  CAMPI_IN_PIU,
  CAMPO_TIPO,
  contoDeiVarchi,
  eUnContatto,
  tipoDelVarco,
  varchiDiCasa,
} from "../src/core/varchi-di-casa.js";
import { coperturaAlzata } from "../src/core/cover-kind.js";
import { finestreAperteDellaCasa, pastiglieDellaCasa } from "../src/core/come-sta-la-casa.js";

const { contiDellaStanza } = await import(
  `../src/sections/rooms-page-section.js?porte-finestre=${Date.now()}`
);

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

const stato = (state, device_class = "") => ({
  state,
  attributes: device_class ? { device_class } : {},
});

test("porta o finestra: la riga, poi la casella dell'anta, poi Home Assistant", () => {
  /* La classe di Home Assistant: `window` e' una finestra, tutto il resto una
   * porta — il portone del garage, l'«opening» generico delle centrali. */
  assert.equal(tipoDelVarco({ entity: "binary_sensor.a", classe: "window" }), "finestra");
  assert.equal(tipoDelVarco({ entity: "binary_sensor.a", classe: "door" }), "porta");
  assert.equal(tipoDelVarco({ entity: "binary_sensor.a", classe: "garage_door" }), "porta");
  assert.equal(tipoDelVarco({ entity: "binary_sensor.a", classe: "opening" }), "porta");
  /* Un contatto scritto nella casella dell'anta delle Finestre e' una
   * finestra, anche se l'integrazione l'ha chiamato porta. */
  const nelleFinestre = new Set(["binary_sensor.a"]);
  assert.equal(
    tipoDelVarco({ entity: "binary_sensor.a", classe: "door" }, nelleFinestre),
    "finestra",
  );
  /* E la parola scritta nella riga vince su tutto: e' l'etichetta che
   * l'editor lascia correggere. */
  assert.equal(
    tipoDelVarco({ entity: "binary_sensor.a", classe: "window", tipo: "porta" }, nelleFinestre),
    "porta",
  );
  assert.equal(
    tipoDelVarco({ entity: "binary_sensor.a", classe: "door", tipo: "finestra" }),
    "finestra",
  );
  /* Una parola che non e' nessuna delle due vale «automatico». */
  assert.equal(
    tipoDelVarco({ entity: "binary_sensor.a", classe: "window", tipo: "boh" }),
    "finestra",
  );
});

test("la riga del varco si tiene il suo tipo, e la lettura lo porta fuori", () => {
  assert.ok(CAMPI_IN_PIU.includes(CAMPO_TIPO));
  const config = {
    righe: [
      { entity: "binary_sensor.bagno", name: "Bagno", icon: "window", tipo: "porta" },
      { entity: "binary_sensor.ingresso", name: "Ingresso", icon: "door" },
    ],
  };
  const states = {
    "binary_sensor.bagno": stato("on", "window"),
    "binary_sensor.ingresso": stato("on", "door"),
  };
  const righe = varchiDiCasa(states, config, new Set());
  const per = Object.fromEntries(righe.map((riga) => [riga.entity, riga]));
  assert.equal(per["binary_sensor.bagno"].tipo, "porta");
  assert.equal(per["binary_sensor.bagno"].tipoScritto, "porta");
  assert.equal(per["binary_sensor.ingresso"].tipo, "porta");
  assert.equal(per["binary_sensor.ingresso"].tipoScritto, "");
});

test("porte e finestre aperte si contano separate, e solo dai contatti", () => {
  const config = {
    righe: [
      { entity: "binary_sensor.ingresso", name: "Ingresso", icon: "door" },
      { entity: "binary_sensor.cucina", name: "Cucina", icon: "window" },
      { entity: "binary_sensor.camera", name: "Camera", icon: "window" },
      /* Un lucernario motorizzato nei Varchi: la pagina lo mostra, ma il suo
       * «open» e' un motore, non un'anta. */
      { entity: "cover.lucernario", name: "Lucernario", icon: "skylight" },
      /* E una serratura aggiunta a mano: sbloccata non vuol dire aperta. */
      { entity: "lock.portoncino", name: "Portoncino", icon: "door" },
    ],
  };
  const states = {
    "binary_sensor.ingresso": stato("on", "door"),
    "binary_sensor.cucina": stato("on", "window"),
    "binary_sensor.camera": stato("off", "window"),
    "cover.lucernario": stato("open", "window"),
    "lock.portoncino": stato("unlocked"),
  };
  const conto = contoDeiVarchi(varchiDiCasa(states, config, new Set()));
  assert.deepEqual(
    conto.porte.map((riga) => riga.entity),
    ["binary_sensor.ingresso"],
  );
  assert.deepEqual(
    conto.finestre.map((riga) => riga.entity),
    ["binary_sensor.cucina"],
  );
  /* La tessera dei Varchi resta quella di prima: tutto quello che e' aperto,
   * lucernario compreso. Sono le pastiglie a volere i soli contatti. */
  assert.ok(conto.aperti >= 3);
  assert.equal(eUnContatto("lock.portoncino"), false);
  assert.equal(eUnContatto("cover.lucernario"), false);
  assert.equal(eUnContatto("binary_sensor.cucina"), true);
});

test("il contatto girato conta col suo verso anche fra le porte e le finestre", () => {
  const config = { righe: [{ entity: "binary_sensor.girata", name: "Girata", icon: "window" }] };
  /* Sta a ON quando e' chiusa: chi l'ha girata l'ha detto una volta per tutte. */
  const states = { "binary_sensor.girata": stato("on", "window") };
  const conto = contoDeiVarchi(varchiDiCasa(states, config, new Set(["binary_sensor.girata"])));
  assert.deepEqual(conto.finestre, []);
});

test("nella fascia: porte, finestre, serrature e tapparelle, ognuna con la sua parola", () => {
  const modelli = [
    {
      key: "varchi",
      icon: "🚪",
      accent: "#dc2626",
      porteAperte: [{ entity: "binary_sensor.ingresso", name: "Ingresso" }],
      finestreAperte: [{ entity: "binary_sensor.cucina", name: "Cucina" }],
    },
    {
      key: "porte",
      icon: "🚪",
      accent: "#dc2626",
      open: [{ entity: "lock.portoncino", name: "Portoncino" }],
    },
    {
      key: "tapparelle",
      icon: "🪟",
      accent: "#8b5cf6",
      alzate: [
        { entity: "cover.sala", name: "Sala" },
        { entity: "cover.studio", name: "Studio" },
      ],
      contattiAperti: [{ entity: "binary_sensor.anta_bagno", name: "Bagno · Finestra" }],
    },
  ];
  const pastiglie = pastiglieDellaCasa(modelli, {});
  assert.deepEqual(
    pastiglie.map((voce) => [voce.chiave, voce.conto]),
    [
      ["porteAperte", 1],
      ["finestreAperte", 2],
      ["porte", 1],
      ["tapparelle", 2],
    ],
  );
  /* La finestra del bagno sta nella pastiglia delle finestre, non in quella
   * delle tapparelle: e' un'anta, non un motore. */
  const finestre = pastiglie.find((voce) => voce.chiave === "finestreAperte");
  assert.deepEqual(
    finestre.voci.map((voce) => voce.entity),
    ["binary_sensor.cucina", "binary_sensor.anta_bagno"],
  );
  const tapparelle = pastiglie.find((voce) => voce.chiave === "tapparelle");
  assert.ok(tapparelle.voci.every((voce) => voce.entity.startsWith("cover.")));
  /* La serratura non entra mai fra le porte aperte. */
  const porte = pastiglie.find((voce) => voce.chiave === "porteAperte");
  assert.ok(!porte.voci.some((voce) => voce.entity.startsWith("lock.")));
});

test("le finestre delle due tessere non si contano due volte", () => {
  const varchi = { finestreAperte: [{ entity: "binary_sensor.cucina", name: "Cucina" }] };
  const finestre = {
    contattiAperti: [{ entity: "binary_sensor.cucina", name: "Cucina · Finestra" }],
  };
  assert.deepEqual(finestreAperteDellaCasa(varchi, finestre), [
    { entity: "binary_sensor.cucina", name: "Cucina" },
  ]);
  assert.deepEqual(finestreAperteDellaCasa(null, null), []);
});

test("la tapparella su si decide in un posto solo, con la soglia e col verso", () => {
  assert.equal(coperturaAlzata({}, { state: "open", attributes: { current_position: 60 } }), true);
  assert.equal(
    coperturaAlzata({}, { state: "open", attributes: { current_position: 8 } }, 10),
    false,
  );
  assert.equal(coperturaAlzata({ invertita: true }, { state: "open", attributes: {} }), false);
  assert.equal(coperturaAlzata({}, { state: "closed", attributes: {} }), false);
  assert.equal(coperturaAlzata({}, null), false);
});

test("nella stanza: niente tapparelle fra le finestre, niente serrature fra le porte", () => {
  const pagina = {
    id: "sala",
    blocchi: [
      {
        key: "coperture",
        voci: [
          /* La tapparella su e il contatto della sua anta aperto: una
           * finestra aperta, non due. */
          { entity: "cover.sala", contact: "binary_sensor.anta_sala" },
          /* Una tapparella su e basta: nessuna finestra aperta. */
          { entity: "cover.studio" },
          /* Un'anta senza motore, scritta nella casella della tapparella. */
          { entity: "binary_sensor.anta_bagno" },
        ],
      },
      {
        key: "altro",
        voci: [
          { entity: "lock.porta" },
          { entity: "binary_sensor.porta_ingresso" },
          /* Un contatto che non e' un varco non c'entra. */
          { entity: "binary_sensor.movimento" },
        ],
      },
    ],
  };
  const states = {
    "cover.sala": { state: "open", attributes: { current_position: 100 } },
    "cover.studio": { state: "open", attributes: {} },
    "binary_sensor.anta_sala": stato("on"),
    "binary_sensor.anta_bagno": stato("on"),
    "lock.porta": stato("unlocked"),
    "binary_sensor.porta_ingresso": stato("on", "door"),
    "binary_sensor.movimento": stato("on", "motion"),
  };
  const conti = contiDellaStanza(pagina, states, new Map());
  assert.equal(conti.finestre, 2);
  assert.equal(conti.porte, 1);
  /* E un contatto che nei Varchi qualcuno ha chiamato finestra si conta
   * finestra anche nella stanza. */
  const tipi = new Map([["binary_sensor.porta_ingresso", "finestra"]]);
  const girati = contiDellaStanza(pagina, states, tipi);
  assert.equal(girati.finestre, 3);
  assert.equal(girati.porte, 0);
});

test("nell'editor dei Varchi: porta o finestra per ogni contatto, e si salva", () => {
  const editor = leggi("sections/varchi-editor-section.js");
  assert.match(
    editor,
    /data-dm-dich-campo="\$\{esc\(CAMPO_TIPO\)\}" data-dm-dich-riga="\$\{indice\}"/,
  );
  /* La prima voce dice cosa si e' deciso da soli, cosi' si corregge solo il
   * resto. */
  assert.match(
    editor,
    /voce\("", `\$\{t\("Automatico", "Automatic"\)\} · \$\{parolaDelTipo\(dedotto\)\}`\)/,
  );
  assert.match(editor, /for \(const campo of \[CAMPO_ESCLUSIONE, CAMPO_TIPO\]\)/);
  /* Una tapparella nei Varchi non ha la domanda: nelle pastiglie non entra. */
  assert.match(editor, /if \(!eUnContatto\(riga\.entity\)\) return "";/);
  /* E la riga chiusa non ci mette una parola accanto al nome: a 390 punti
   * «Porta» o «Finestra» li' si mangiavano il nome («Finestr…»). Il tipo si
   * legge aprendo la riga, nella prima voce del menu. */
  assert.doesNotMatch(editor, /accanto: \(letta\)/);
});
