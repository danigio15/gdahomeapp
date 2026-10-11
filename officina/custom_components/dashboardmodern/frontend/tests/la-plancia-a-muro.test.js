/* La plancia a muro: il config che si scrive e quello che il tablet ne legge.
 *
 * «Crea una plancia prettamente per dispositivi a muro, minimal, con comandi
 * ben precisi» — e poi: le cose le prende dalla plancia principale, qui si
 * sceglie solo cosa mostrare. Queste prove tengono ferme le scelte che il
 * tablet non puo' sbagliare: i posti sono sei, le pagine al massimo quattro,
 * un comando punta a un'entita' vera, il blocco senza PIN non blocca, e la
 * stanza propone da sola i suoi comandi finche' nessuno li ha scelti. */
import assert from "node:assert/strict";
import test from "node:test";
import { climaScalda } from "../src/core/device-model.js";
import {
  comandiDellElenco,
  comandiDellaPagina,
  comandoPulito,
  comandiProposti,
  derivaDelRiposo,
  GRIGLIE,
  eNotte,
  fonteDaiValori,
  ingressoProposto,
  muroDiPartenza,
  muroPulito,
  nuovaPagina,
  PAGINE_AL_MASSIMO,
  pinGiusto,
  POSTI,
  scala,
  temaDelMomento,
  verso,
} from "../src/core/plancia-a-muro.js";
import { sharedReconcileAction } from "../src/sections/config-persistence-section.js";

const STATO = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "soggiorno", name: "Soggiorno" },
      { id: "cucina", name: "Cucina" },
    ],
    lights: [
      { id: "l1", entity: "light.soggiorno", room_id: "soggiorno", room: "Soggiorno" },
      { id: "l2", entity: "light.tavolo", room: "Soggiorno" },
      { id: "l3", entity: "light.cucina", room_id: "cucina" },
      { id: "l4", entity: "light.spenta", room: "Soggiorno", enabled: false },
    ],
    climate: [{ id: "c1", entity: "climate.soggiorno", room_id: "soggiorno" }],
    covers: [{ id: "t1", entity: "cover.soggiorno", room: "Soggiorno" }],
    cameras: [{ id: "k1", entity: "camera.cancello" }],
  },
};
const VALORI = {
  dm_dashboard_state: JSON.stringify(STATO),
  cd_quick_actions: JSON.stringify([
    { name: "Cinema", type: "scene", entity: "scene.cinema" },
    { name: "Esco", type: "script", entity: "script.esco" },
    { name: "Rientro", type: "script", entity: "script.rientro" },
    { name: "Luci", type: "builtin", builtin: "luci" },
  ]),
  cd_people: JSON.stringify([{ entity: "person.anna", name: "Anna" }]),
  cd_entity_overrides: JSON.stringify({
    "dm.security_centrale_allarme": "alarm_control_panel.casa",
  }),
};

test("dalla plancia principale si leggono stanze, dispositivi, azioni e centrale", () => {
  const fonte = fonteDaiValori(VALORI);
  assert.deepEqual(
    fonte.stanze.map((s) => s.name),
    ["Soggiorno", "Cucina"],
  );
  assert.equal(fonte.luci.length, 3, "la luce spenta nel config non si offre");
  assert.equal(fonte.azioni.length, 4);
  assert.deepEqual(fonte.centrali, ["alarm_control_panel.casa"]);
  assert.deepEqual(fonte.persone, [{ entity: "person.anna", name: "Anna" }]);
});

test("una fonte rotta non fa cadere il tablet", () => {
  const fonte = fonteDaiValori({ dm_dashboard_state: "{non e' json", cd_quick_actions: 7 });
  assert.deepEqual(fonte.stanze, []);
  assert.deepEqual(fonte.azioni, []);
});

test("la stanza propone luci, poi clima e tapparelle, poi le azioni", () => {
  const fonte = fonteDaiValori(VALORI);
  const comandi = comandiProposti(fonte, "Soggiorno");
  assert.deepEqual(
    comandi.map((c) => c.tipo + ":" + (c.entita || c.azione)),
    [
      "luce:light.soggiorno",
      "luce:light.tavolo",
      "clima:climate.soggiorno",
      "tapparella:cover.soggiorno",
      "azione:Cinema",
      "azione:Esco",
    ],
  );
  assert.ok(comandi.length <= POSTI);
  assert.deepEqual(comandiProposti(fonte, "Non c'e'"), []);
});

test("finche' nessuno li sceglie, i comandi seguono la stanza", () => {
  const fonte = fonteDaiValori(VALORI);
  const muro = muroPulito({ pagine: [{ modello: "stanza", stanza: "Cucina" }] });
  assert.equal(muro.pagine[0].scelti, false);
  assert.deepEqual(
    comandiDellaPagina(muro.pagine[0], fonte).map((c) => c.entita || c.azione),
    ["light.cucina", "Cinema", "Esco", "Rientro"],
  );
  const scelto = muroPulito({
    pagine: [
      { modello: "stanza", stanza: "Cucina", comandi: [{ tipo: "luce", entita: "light.tavolo" }] },
    ],
  });
  assert.equal(scelto.pagine[0].scelti, true);
  assert.deepEqual(
    comandiDellaPagina(scelto.pagine[0], fonte).map((c) => c.entita),
    ["light.tavolo"],
  );
});

test("sei posti di serie, otto pagine, e un comando senza entita' vera non entra", () => {
  const troppi = Array.from({ length: 9 }, (_, i) => ({ tipo: "luce", entita: `light.l${i}` }));
  const muro = muroPulito({
    pagine: Array.from({ length: 10 }, () => ({
      modello: "stanza",
      comandi: [
        ...troppi,
        { tipo: "luce", entita: "non un'entita" },
        { tipo: "boh", entita: "light.x" },
      ],
    })),
  });
  assert.equal(PAGINE_AL_MASSIMO, 8);
  assert.equal(muro.pagine.length, PAGINE_AL_MASSIMO);
  assert.equal(muro.pagine[0].comandi.length, POSTI);
  assert.ok(
    muro.pagine[0].comandi.every((c) => c.tipo === "luce" && /^light\.l\d$/.test(c.entita)),
  );
  assert.equal(new Set(muro.pagine.map((p) => p.id)).size, muro.pagine.length, "id diversi");
});

test("un config vuoto o rotto e' un muro spento con valori sensati", () => {
  for (const dentro of [undefined, null, "", "{rotto", [], 42]) {
    const muro = muroPulito(dentro);
    assert.equal(muro.attiva, false);
    assert.equal(muro.fonte, "primary");
    assert.equal(muro.orientamento, "auto");
    assert.equal(muro.riposo.minuti, 2);
    assert.deepEqual(muro.pagine, []);
  }
});

test("il blocco senza PIN non blocca, e il PIN e' di 4-8 cifre", () => {
  assert.equal(muroPulito({ blocco: { attivo: true, pin: "" } }).blocco.attivo, false);
  assert.equal(muroPulito({ blocco: { attivo: true, pin: "12" } }).blocco.attivo, false);
  const muro = muroPulito({ blocco: { attivo: true, pin: "1 2 3 4" } });
  assert.equal(muro.blocco.attivo, true);
  assert.equal(pinGiusto(muro, "1234"), true);
  assert.equal(pinGiusto(muro, "4321"), false);
  assert.equal(pinGiusto(muroPulito({}), ""), true, "senza blocco si esce sempre");
});

test("la notte scavalca la mezzanotte", () => {
  const muro = muroPulito({ notte: { attiva: true, da: "23:00", a: "6:30" } });
  const alle = (h, m) => new Date(2026, 9, 9, h, m);
  assert.equal(eNotte(muro, alle(23, 30)), true);
  assert.equal(eNotte(muro, alle(3, 0)), true);
  assert.equal(eNotte(muro, alle(6, 30)), false);
  assert.equal(eNotte(muro, alle(12, 0)), false);
  assert.equal(eNotte(muroPulito({ notte: { attiva: false } }), alle(2, 0)), false);
});

test("tema, verso e misura", () => {
  const alle = (h) => new Date(2026, 9, 9, h, 0);
  assert.equal(temaDelMomento(muroPulito({ tema: "orario" }), alle(12)), "light");
  assert.equal(temaDelMomento(muroPulito({ tema: "orario" }), alle(21)), "dark");
  assert.equal(temaDelMomento(muroPulito({ tema: "plancia" }), alle(12), "light"), "light");
  assert.equal(temaDelMomento(muroPulito({ tema: "scuro" }), alle(12), "light"), "dark");
  assert.equal(verso(muroPulito({}), 1280, 800), "orizzontale");
  assert.equal(verso(muroPulito({}), 800, 1280), "verticale");
  assert.equal(verso(muroPulito({ orientamento: "verticale" }), 1280, 800), "verticale");
  assert.equal(scala("orizzontale", 1280, 800), 1);
  assert.ok(scala("orizzontale", 1024, 600) < 1);
  assert.ok(scala("orizzontale", 1920, 1080) > 1);
});

test("le pagine nuove nascono gia' piene", () => {
  const fonte = fonteDaiValori(VALORI);
  assert.equal(nuovaPagina("stanza", fonte).stanza, "Soggiorno");
  assert.deepEqual(
    nuovaPagina("scene", fonte).scene.map((s) => s.azione),
    ["Cinema", "Esco", "Rientro"],
    "i pannelli gia' pronti (builtin) non sono scene",
  );
  const ingresso = ingressoProposto(fonte);
  assert.equal(ingresso.centrale, "alarm_control_panel.casa");
  assert.equal(ingresso.telecamera, "camera.cancello");
  assert.equal(ingresso.esco, "Esco");
  assert.equal(ingresso.rientro, "Rientro");
});

test("una plancia nata a muro e' gia' accesa, con le pagine che la casa permette", () => {
  const muro = muroDiPartenza(fonteDaiValori(VALORI));
  assert.equal(muro.attiva, true);
  assert.equal(muro.fonte, "primary");
  assert.deepEqual(
    muro.pagine.map((p) => p.modello),
    ["stanza", "scene", "ingresso"],
  );
  assert.equal(muro.pagine[0].stanza, "Soggiorno");
  assert.equal(muro.pagine[0].scelti, false, "i comandi seguono la stanza");
  assert.deepEqual(muroPulito(JSON.stringify(muro)), muro);
  /* Senza scene ne' centrale ne' telecamere resta la stanza sola. */
  assert.deepEqual(
    muroDiPartenza({}).pagine.map((p) => p.modello),
    ["stanza"],
  );
});

test("un tablet nuovo su una plancia nata a muro si prende il suo config", () => {
  /* La plancia nata dalla console ha nel cassetto solo `cd_muro`: deve contare
   * come configurata, se no il tablet non la scarica e resta sulla plancia
   * vuota del primo giorno. */
  const scelta = sharedReconcileAction({
    snapshot: {
      revision: 1,
      updated_at: 1_800_000_000_000,
      keys_revision: 62,
      writer_generation: 0,
      values: { cd_muro: JSON.stringify(muroDiPartenza(fonteDaiValori(VALORI))) },
    },
    local: {},
    localConfigured: false,
    syncedRevision: 0,
  });
  assert.equal(scelta, "restore-remote");
});

test("sul riposo si vedono gli avvisi accesi della casa e l'antifurto che suona", async () => {
  const { avvisiAccesi } = await import("../src/core/plancia-a-muro.js");
  const fonte = fonteDaiValori({
    ...VALORI,
    cd_avvisi_custom: JSON.stringify([
      { name: "Lavatrice finita", entities: ["binary_sensor.lavatrice"], cond: "on" },
      { name: "Freddo in cantina", entity: "sensor.cantina", cond: "lt", value: "5" },
      { name: "Rotto", entities: [] },
    ]),
  });
  assert.equal(fonte.avvisi.length, 2);
  const stati = {
    "binary_sensor.lavatrice": { state: "on" },
    "sensor.cantina": { state: "8" },
    "alarm_control_panel.casa": { state: "triggered" },
  };
  const accesi = avvisiAccesi(fonte, stati);
  assert.deepEqual(
    accesi.map((a) => [a.chiave, a.grave]),
    [
      ["alarm_control_panel.casa", true],
      ["binary_sensor.lavatrice", false],
    ],
  );
});

test("i pannelli piccoli passano alla forma compatta, senza scritte da formica", async () => {
  const { eCompatto } = await import("../src/core/plancia-a-muro.js");
  /* NSPanel Pro 120 (750×1334 a densita' 2) e NSPanel Pro quadrato (480×480). */
  assert.equal(eCompatto(375, 667), true);
  assert.equal(eCompatto(480, 480), true);
  assert.equal(eCompatto(1280, 800), false);
  assert.ok(scala("verticale", 375, 667) >= 0.75);
  assert.ok(scala("orizzontale", 480, 480) > 1);
});

test("un posto prende qualunque entita', col suo nome, la riga sotto e il disegno", () => {
  /* La luce resta luce anche scelta a mano; una presa e' una card «entita'». */
  assert.deepEqual(comandoPulito({ tipo: "entita", entita: "light.tavolo", nome: "Tavolo" }), {
    tipo: "luce",
    entita: "light.tavolo",
    nome: "Tavolo",
    sotto: "",
    disegno: "",
  });
  assert.equal(comandoPulito({ tipo: "entita", entita: "switch.presa_tv" }).tipo, "entita");
  assert.equal(comandoPulito({ tipo: "entita", entita: "non valida" }), null);
  const pagina = muroPulito({
    attiva: true,
    pagine: [
      {
        modello: "personale",
        comandi: [
          { tipo: "entita", entita: "lock.portone", nome: "Portone", disegno: "varchi" },
          { tipo: "vuoto" },
          { tipo: "azione", azione: "Cinema", sotto: "Luci basse" },
          { tipo: "vuoto" },
        ],
      },
    ],
  }).pagine[0];
  /* Il vuoto in mezzo resta al suo posto; quello in fondo se ne va. */
  assert.deepEqual(
    pagina.comandi.map((c) => c.tipo),
    ["entita", "vuoto", "azione"],
  );
  assert.equal(pagina.comandi[0].disegno, "varchi");
  assert.deepEqual(comandiDellaPagina(pagina, {}), pagina.comandi);
});

test("le scene prendono anche un'entita' qualunque", () => {
  const pagina = muroPulito({
    attiva: true,
    pagine: [
      {
        modello: "scene",
        scene: [
          { azione: "Cinema" },
          { tipo: "entita", entita: "script.buonanotte", nome: "Notte" },
          { tipo: "entita", entita: "light.salone" },
        ],
      },
    ],
  }).pagine[0];
  assert.deepEqual(
    pagina.scene.map((c) => [c.tipo, c.azione || c.entita]),
    [
      ["azione", "Cinema"],
      ["entita", "script.buonanotte"],
      ["entita", "light.salone"],
    ],
  );
});

test("le pagine elenco: tutte le luci, il clima che raffresca e quello che scalda", () => {
  const fonte = fonteDaiValori({
    ...VALORI,
    cd_clima_units: JSON.stringify([
      { entity: "climate.soggiorno", type: "clima" },
      { entity: "climate.termostato", type: "termo" },
      { entity: "climate.pompa", type: "pompa" },
    ]),
  });
  const di = (modello) =>
    comandiDellaPagina(muroPulito({ attiva: true, pagine: [{ modello }] }).pagine[0], fonte).map(
      (c) => c.entita,
    );
  assert.deepEqual(di("luci"), ["light.soggiorno", "light.tavolo", "light.cucina"]);
  assert.deepEqual(di("freddo"), ["climate.soggiorno", "climate.pompa"]);
  assert.deepEqual(di("caldo"), ["climate.termostato", "climate.pompa"]);
  assert.equal(nuovaPagina("personale", fonte).scelti, true);
});

test("nella pagina Luci anche una presa fa la card della luce", () => {
  const comandi = comandiDellElenco("luci", {
    luci: [{ entity: "light.lampadario" }, { entity: "switch.faretti_cucina" }],
  });
  assert.deepEqual(
    comandi.map((c) => [c.entita, c.tipo]),
    [
      ["light.lampadario", "luce"],
      ["switch.faretti_cucina", "luce"],
    ],
  );
});

test("caldo o freddo: comanda quello che fa, poi la pagina, poi il tipo", () => {
  assert.equal(climaScalda({ stato: "heat_cool", azione: "heating" }), true);
  assert.equal(climaScalda({ stato: "heat", tipo: "clima" }), true);
  assert.equal(climaScalda({ stato: "cool", tipo: "termo" }), false);
  /* Spenta: un termosifone resta caldo, un condizionatore freddo, e la pompa
   * segue la pagina in cui sta. */
  assert.equal(climaScalda({ stato: "off", tipo: "termo" }), true);
  assert.equal(climaScalda({ stato: "off", tipo: "clima" }), false);
  assert.equal(climaScalda({ stato: "off", tipo: "pompa", zona: "caldo" }), true);
  assert.equal(climaScalda({ stato: "off", tipo: "pompa" }), false);
});

test("il riposo cambia posto ogni minuto, e mai vicino a quello di prima", () => {
  const minuto = 60000;
  const base = Date.UTC(2026, 9, 10, 21, 0, 0);
  assert.deepEqual(derivaDelRiposo(base), derivaDelRiposo(base + 59000), "fermo dentro il minuto");
  let prima = derivaDelRiposo(base);
  for (let i = 1; i <= 240; i += 1) {
    const ora = derivaDelRiposo(base + i * minuto);
    assert.ok(Math.abs(ora.x) <= 1 && Math.abs(ora.y) <= 1, "dentro il riquadro");
    assert.ok(Math.hypot(ora.x - prima.x, ora.y - prima.y) > 0.4, `minuto ${i}: troppo vicino`);
    prima = ora;
  }
});

test("le plance della 1.11.1 scrivevano `posti`: 6, 8 o 12 valgono ancora", () => {
  assert.equal(PAGINE_AL_MASSIMO, 8);
  const comandi = Array.from({ length: 12 }, (_, n) => ({ tipo: "luce", entita: `light.l${n}` }));
  const di = (posti) =>
    muroPulito({ attiva: true, pagine: [{ modello: "personale", posti, comandi }] }).pagine[0];
  assert.equal(di(8).griglia, 8);
  assert.equal(di(8).comandi.length, 8);
  assert.equal(di(12).comandi.length, 12);
  assert.equal(di(7).griglia, 6, "un numero che non e' fra quelli si rimette a sei");
  assert.equal(di(undefined).comandi.length, 6);
});

test("il meteo del tablet e' quello scelto nella config della plancia", () => {
  const fonte = fonteDaiValori({
    ...VALORI,
    cd_entity_overrides: JSON.stringify({ "dm.home_meteo": "weather.openweathermap" }),
  });
  assert.equal(fonte.meteo, "weather.openweathermap");
  assert.equal(fonteDaiValori(VALORI).meteo, "");
});

/* «Come configuratore e come sezioni da gestire e vedere riusciamo a fare
 * meglio?» La griglia si sceglie, le pagine hanno un colore, e ci sono le
 * pagine da guardare: tapparelle, ambienti, telecamere, energia. */
test("la griglia si sceglie: da quattro a dodici posti, e in verticale si gira", async () => {
  const { GRIGLIE, grigliaDellaPagina, postiDellaPagina } = await import(
    "../src/core/plancia-a-muro.js"
  );
  assert.deepEqual(Object.keys(GRIGLIE), ["4", "6", "8", "9", "12"]);
  const troppi = Array.from({ length: 14 }, (_, i) => ({ tipo: "luce", entita: `light.l${i}` }));
  const muro = muroPulito({
    pagine: [
      { modello: "personale", griglia: 12, comandi: troppi },
      { modello: "personale", griglia: 7, comandi: troppi },
      { modello: "telecamere" },
    ],
  });
  assert.equal(muro.pagine[0].griglia, 12);
  assert.equal(muro.pagine[0].comandi.length, 12);
  assert.equal(muro.pagine[1].griglia, POSTI, "una griglia che non c'e' torna quella di serie");
  assert.equal(muro.pagine[1].comandi.length, POSTI);
  assert.equal(postiDellaPagina(muro.pagine[2]), 4, "le telecamere nascono in quattro");
  assert.deepEqual(grigliaDellaPagina(muro.pagine[0], "orizzontale"), { colonne: 4, righe: 3 });
  assert.deepEqual(grigliaDellaPagina(muro.pagine[0], "verticale"), { colonne: 3, righe: 4 });
  assert.deepEqual(muroPulito(JSON.stringify(muro)), muro);
});

test("una stanza con la griglia grande propone piu' comandi", () => {
  const fonte = fonteDaiValori(VALORI);
  const pagina = muroPulito({ pagine: [{ modello: "stanza", stanza: "Soggiorno", griglia: 4 }] })
    .pagine[0];
  assert.equal(comandiDellaPagina(pagina, fonte).length, 4);
  assert.equal(comandiProposti(fonte, "Soggiorno", 12).length, 7, "tutto quello che c'e'");
});

test("il colore della pagina e' uno della tavolozza, o quello del tipo", async () => {
  const { COLORI_DELLE_PAGINE } = await import("../src/core/plancia-a-muro.js");
  const muro = muroPulito({
    pagine: [
      { modello: "stanza", colore: COLORI_DELLE_PAGINE[2].toUpperCase() },
      { modello: "stanza", colore: "red; background:url(x)" },
    ],
  });
  assert.equal(muro.pagine[0].colore, COLORI_DELLE_PAGINE[2]);
  assert.equal(muro.pagine[1].colore, "");
});

test("le pagine da guardare: tapparelle, ambienti, telecamere, energia", async () => {
  const { ambientiDellaFonte, comandiDellElenco, energiaDellaPagina, telecamereDellaFonte } =
    await import("../src/core/plancia-a-muro.js");
  const fonte = fonteDaiValori({
    ...VALORI,
    dm_dashboard_state: JSON.stringify({
      ...STATO,
      sections: {
        ...STATO.sections,
        rooms: [
          { id: "soggiorno", name: "Soggiorno", temp: "sensor.t_sog", hum: "sensor.h_sog" },
          { id: "cucina", name: "Cucina" },
          { id: "cantina", name: "Cantina" },
        ],
      },
    }),
    cd_entity_overrides: JSON.stringify({
      "dm.security_centrale_allarme": "alarm_control_panel.casa",
      "dm.energy_potenza_consumo_casa": "sensor.casa_w",
      "dm.energy_potenza_fotovoltaico": "sensor.fv_w",
    }),
  });
  assert.deepEqual(
    comandiDellElenco("tapparelle", fonte).map((c) => [c.tipo, c.entita]),
    [["tapparella", "cover.soggiorno"]],
  );
  assert.deepEqual(
    ambientiDellaFonte(fonte).map((a) => [a.stanza.name, a.luci.length]),
    [
      ["Soggiorno", 2],
      ["Cucina", 1],
    ],
    "la cantina senza sonde ne' luci non dice niente",
  );
  assert.deepEqual(telecamereDellaFonte(fonte), [{ entita: "camera.cancello", nome: "" }]);
  const pagina = muroPulito({
    pagine: [{ modello: "energia", energia: { casa: "sensor.mia_casa", rete: "non valida" } }],
  }).pagine[0];
  assert.deepEqual(energiaDellaPagina(pagina, fonte), {
    casa: "sensor.mia_casa",
    solare: "sensor.fv_w",
    rete: "",
    batteria: "",
  });
});

test("meteo e riposo si scelgono, e di serie il riposo torna alla prima pagina", () => {
  const vuoto = muroPulito({});
  assert.equal(vuoto.meteo, "");
  assert.equal(vuoto.riposo.torna, true);
  assert.equal(vuoto.riposo.sensore, "");
  const scelto = muroPulito({
    meteo: "weather.casa",
    riposo: { torna: false, sensore: "sensor.salotto_t", minuti: 5 },
  });
  assert.equal(scelto.meteo, "weather.casa");
  assert.deepEqual(scelto.riposo, {
    attivo: true,
    minuti: 5,
    torna: false,
    sensore: "sensor.salotto_t",
  });
});

/* «Me ne devi fare una con sezione musica.» I lettori vengono dalla sezione
 * Musica della plancia di origine, o si scelgono. */
test("la pagina Musica prende i lettori della plancia, o quelli scelti", async () => {
  const { lettoriDellaPagina, LETTORI_AL_MASSIMO } = await import(
    "../src/core/plancia-a-muro.js"
  );
  const fonte = fonteDaiValori({
    ...VALORI,
    cd_media_player: JSON.stringify([
      { entity: "media_player.sonos_cucina", nome: "Cucina" },
      { entity: "media_player.tv_sala" },
      { nome: "senza entita'" },
    ]),
  });
  assert.deepEqual(fonte.lettori, [
    { entity: "media_player.sonos_cucina", nome: "Cucina" },
    { entity: "media_player.tv_sala", nome: "" },
  ]);
  const pagina = muroPulito({ pagine: [{ modello: "musica" }] }).pagine[0];
  assert.deepEqual(
    lettoriDellaPagina(pagina, fonte).map((l) => l.entita),
    ["media_player.sonos_cucina", "media_player.tv_sala"],
  );
  const scelti = muroPulito({
    pagine: [
      {
        modello: "musica",
        lettori: [
          "media_player.studio",
          "media_player.studio",
          "light.non_e_un_lettore",
          "",
          ...Array.from({ length: 12 }, (_, i) => `media_player.l${i}`),
        ],
      },
    ],
  }).pagine[0];
  assert.equal(scelti.lettori[0], "media_player.studio");
  assert.equal(scelti.lettori.length, LETTORI_AL_MASSIMO, "doppi e non lettori fuori");
  assert.ok(!scelti.lettori.includes("light.non_e_un_lettore"));
  const giro = muroPulito({ pagine: [scelti] }).pagine[0];
  assert.deepEqual(giro.lettori, scelti.lettori, "si rilegge uguale");
});

/* «Quando sono piu' di una partizione andrei a capo, con le partizioni
 * attive scritte.» Le aree portano il loro nome, e suona una qualunque. */
test("le aree dell'antifurto: col nome, e l'allarme di una qualunque", async () => {
  const { avvisiAccesi } = await import("../src/core/plancia-a-muro.js");
  const fonte = fonteDaiValori({
    ...VALORI,
    cd_centrali: JSON.stringify([
      { nome: "Perimetrale", caselle: { "dm.security_centrale_allarme": "alarm_control_panel.p" } },
      { nome: "Zona notte", caselle: { "dm.security_centrale_allarme": "alarm_control_panel.n" } },
    ]),
  });
  assert.deepEqual(fonte.aree, [
    { entita: "alarm_control_panel.casa", nome: "" },
    { entita: "alarm_control_panel.p", nome: "Perimetrale" },
    { entita: "alarm_control_panel.n", nome: "Zona notte" },
  ]);
  const accesi = avvisiAccesi(fonte, {
    "alarm_control_panel.casa": { state: "disarmed" },
    "alarm_control_panel.n": { state: "triggered" },
  });
  assert.deepEqual(
    accesi.map((a) => [a.chiave, a.grave]),
    [["alarm_control_panel.n", true]],
  );
});

/* «Visto che hai Sonos prevedi il pulsante gruppo.» */
test("il gruppo dei lettori: chi c'e', e il servizio per entrare e uscire", async () => {
  const { compagniDelGruppo, letturaDelLettore, servizioDelGruppo, SA } = await import(
    "../src/core/media-player.js"
  );
  const stati = {
    "media_player.cucina": {
      state: "playing",
      attributes: {
        supported_features: SA.GRUPPO | SA.PAUSA,
        group_members: ["media_player.cucina", "media_player.sala"],
      },
    },
  };
  const l = letturaDelLettore({ entity: "media_player.cucina" }, stati);
  assert.equal(l.puo.gruppo, true);
  assert.deepEqual(compagniDelGruppo(l), ["media_player.sala"]);
  assert.deepEqual(servizioDelGruppo(l, "media_player.sala"), {
    service: "unjoin",
    data: { entity_id: "media_player.sala" },
  });
  assert.deepEqual(servizioDelGruppo(l, "media_player.bagno"), {
    service: "join",
    data: { entity_id: "media_player.cucina", group_members: ["media_player.bagno"] },
  });
  assert.equal(servizioDelGruppo(l, "media_player.cucina"), null, "con se' stesso no");
  const solo = letturaDelLettore(
    { entity: "media_player.tv" },
    { "media_player.tv": { state: "on", attributes: { supported_features: SA.PAUSA } } },
  );
  assert.equal(solo.puo.gruppo, false);
  assert.deepEqual(compagniDelGruppo(solo), []);
});
