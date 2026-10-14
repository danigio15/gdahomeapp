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
  areeDellIngresso,
  comandiDellElenco,
  comandiDellaPagina,
  comandoPulito,
  comandiProposti,
  derivaDelRiposo,
  eComandoDellIngresso,
  eLetturaDellIngresso,
  GRIGLIE,
  eNotte,
  fonteDaiValori,
  ingressoProposto,
  lettureDellIngresso,
  muroDiPartenza,
  muroPulito,
  nuovaPagina,
  PAGINE_AL_MASSIMO,
  pinGiusto,
  POSTI,
  scala,
  tastiDellaTapparella,
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
test("la griglia si sceglie: da quattro a ventiquattro posti, e in verticale si gira", async () => {
  const { GRIGLIE, grigliaDellaPagina, postiDellaPagina } =
    await import("../src/core/plancia-a-muro.js");
  assert.deepEqual(Object.keys(GRIGLIE), ["4", "6", "8", "9", "12", "16", "20", "24"]);
  assert.deepEqual(GRIGLIE[20], { colonne: 5, righe: 4 });
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
  const { lettoriDellaPagina, LETTORI_AL_MASSIMO } = await import("../src/core/plancia-a-muro.js");
  const fonte = fonteDaiValori({
    ...VALORI,
    cd_media_player: JSON.stringify([
      { entity: "media_player.sonos_cucina", nome: "Cucina" },
      {
        entity: "media_player.tv_sala",
        telecomando: "remote.tv_sala",
        comandi: ["remote.ampli", "remote.ampli:volume_up", "sensor.non_e_un_comando"],
        letture: ["sensor.tv_sala_canale", "button.non_e_una_lettura"],
      },
      { nome: "senza entita'" },
    ]),
  });
  /* Le altre letture, il telecomando e i comandi dei telecomandi arrivano al
   * tablet: «i remote. e i sensor. li aggiungi nel config, ma non compaiono». */
  assert.deepEqual(fonte.lettori, [
    {
      entity: "media_player.sonos_cucina",
      nome: "Cucina",
      comandi: [],
      letture: [],
      telecomando: "",
    },
    {
      entity: "media_player.tv_sala",
      nome: "",
      comandi: ["remote.ampli", "remote.ampli:volume_up"],
      letture: ["sensor.tv_sala_canale"],
      telecomando: "remote.tv_sala",
    },
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
  const { compagniDelGruppo, letturaDelLettore, servizioDelGruppo, SA } =
    await import("../src/core/media-player.js");
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

/* «Pulsanti diretti sulle tapparelle, senza entrarci dentro»: i tasti della
 * card sono quelli che la cover dichiara di saper fare (1 apre, 2 chiude,
 * 8 ferma); senza il numero sono tutti e tre, come prima. */
test("una tapparella ha sulla card i tasti che sa usare", () => {
  assert.deepEqual(tastiDellaTapparella({}), ["su", "ferma", "giu"]);
  assert.deepEqual(tastiDellaTapparella(undefined), ["su", "ferma", "giu"]);
  assert.deepEqual(tastiDellaTapparella({ supported_features: "rotto" }), ["su", "ferma", "giu"]);
  assert.deepEqual(tastiDellaTapparella({ supported_features: 15 }), ["su", "ferma", "giu"]);
  assert.deepEqual(tastiDellaTapparella({ supported_features: 11 }), ["su", "ferma", "giu"]);
  /* Una tenda che apre e chiude soltanto: niente ■. */
  assert.deepEqual(tastiDellaTapparella({ supported_features: 3 }), ["su", "giu"]);
  assert.deepEqual(tastiDellaTapparella({ supported_features: "3" }), ["su", "giu"]);
  /* Solo la posizione: i tasti non servono, resta la finestra. */
  assert.deepEqual(tastiDellaTapparella({ supported_features: 4 }), []);
});

/* «Il meteo lo possiamo scegliere, ma la temperatura no.» La temperatura
 * accanto al meteo e' quella del meteo, o quella del sensore in casa — lo
 * stesso campo del riposo, non un secondo. */
test("la temperatura mostrata e' quella del meteo, o quella di casa", () => {
  assert.equal(muroPulito({}).temperatura, "meteo");
  assert.equal(muroPulito({ temperatura: "fuori" }).temperatura, "meteo");
  const casa = muroPulito({ temperatura: "casa", riposo: { sensore: "sensor.corridoio_t" } });
  assert.equal(casa.temperatura, "casa");
  assert.equal(casa.riposo.sensore, "sensor.corridoio_t");
  /* Un config di prima, col sensore del riposo gia' scelto, resta com'era. */
  const prima = muroPulito({ riposo: { sensore: "sensor.corridoio_t" } });
  assert.equal(prima.temperatura, "meteo");
  assert.equal(prima.riposo.sensore, "sensor.corridoio_t");
  assert.deepEqual(muroPulito(prima), prima);
});

/* ── la regia: mixer, telecamera, comandi ───────────────────────────────── */
import {
  CANALE_VUOTO,
  chiamateDelFermaTutto,
  comandoAlTelecomando,
  gruppiDelMixer,
  pulsanteDiceLoStato,
  servizioDelPasso,
  letturaDelCanale,
  menuDiLato,
  paginaPulita,
  posizioneDelValore,
  pulsanteAcceso,
  pulsantiDellaPagina,
  servizioDaPremere,
  servizioDelFader,
  servizioDelMuto,
  servizioDelPulsante,
  servizioDellaTelecamera,
  valoreDallaPosizione,
} from "../src/core/plancia-a-muro.js";

const DB = { min: -60, max: 10, step: 0.5, unit_of_measurement: "dB" };

test("il mixer tiene solo canali con un livello, e i muti che sono interruttori", () => {
  const p = paginaPulita({
    modello: "mixer",
    mixer: {
      gruppi: [
        {
          nome: "Microfoni",
          colore: "#ZZZ",
          canali: [
            "number.mic_1",
            { entita: "media_player.sala", nome: "Sala", muto: "light.no" },
            "light.non_e_un_canale",
            { entita: "input_number.aux", muto: "switch.aux_muto" },
          ],
        },
        { nome: "Vuoto" },
      ],
      master: "camera.non_va",
    },
  });
  assert.equal(p.modello, "mixer");
  const c = (fuori) => ({ ...CANALE_VUOTO, ...fuori });
  assert.deepEqual(p.mixer.gruppi[0].canali, [
    c({ entita: "number.mic_1" }),
    c({ entita: "media_player.sala", nome: "Sala" }),
    c({ entita: "input_number.aux", muto: "switch.aux_muto" }),
  ]);
  assert.equal(p.mixer.gruppi[0].colore, "", "un colore sbagliato torna quello del posto");
  assert.equal(p.mixer.gruppi.length, 2, "un gruppo appena nato resta nel config");
  assert.deepEqual(p.mixer.master, CANALE_VUOTO);
  /* Sul tablet il gruppo vuoto non c'e', e i colori seguono il posto. */
  const g = gruppiDelMixer(p);
  assert.equal(g.length, 1);
  assert.equal(g[0].colore, "#f59e0b");
  assert.deepEqual(paginaPulita(JSON.parse(JSON.stringify(p))), p, "si rilegge uguale");
});

test("un config di prima non cambia: le pagine vecchie hanno la regia vuota", () => {
  const vecchio = muroPulito({ attiva: true, pagine: [{ id: "p1", modello: "stanza" }] });
  assert.equal(vecchio.menuDiLato, false);
  assert.equal(vecchio.pagine[0].modello, "stanza");
  assert.deepEqual(vecchio.pagine[0].pulsanti, []);
  assert.deepEqual(vecchio.pagine[0].mixer.gruppi, []);
  assert.equal(muroPulito({ menuDiLato: true }).menuDiLato, true);
});

test("il cursore va dalla posizione al valore sul passo del canale, e ritorno", () => {
  const stati = {
    "number.mic": { state: "-12.5", attributes: DB },
    "media_player.sala": {
      state: "on",
      attributes: { volume_level: 0.4, supported_features: 4 + 8, is_volume_muted: true },
    },
  };
  const mic = letturaDelCanale({ entita: "number.mic" }, stati);
  assert.equal(mic.tipo, "numero");
  assert.equal(mic.valore, -12.5);
  assert.ok(Math.abs(mic.posizione - 47.5 / 70) < 1e-9);
  assert.equal(mic.puoMuto, false, "un numero senza interruttore non ha il muto");
  assert.equal(valoreDallaPosizione(0, mic), -60);
  assert.equal(valoreDallaPosizione(1, mic), 10);
  assert.equal(valoreDallaPosizione(0.5, mic), -25);
  assert.equal(valoreDallaPosizione(0.501, mic), -25, "sul passo da mezzo dB");
  assert.equal(valoreDallaPosizione(2, mic), 10, "mai oltre il massimo");
  assert.equal(posizioneDelValore(-60, -60, 10), 0);
  assert.equal(posizioneDelValore(5, 0, 0), 0, "una scala rotta e' in fondo");
  assert.deepEqual(servizioDelFader({ entita: "number.mic" }, 0.75, mic), {
    domain: "number",
    service: "set_value",
    data: { entity_id: "number.mic", value: -7.5 },
  });
  const sala = letturaDelCanale({ entita: "media_player.sala" }, stati);
  assert.equal(sala.posizione, 0.4);
  assert.equal(sala.mutato, true);
  assert.deepEqual(servizioDelFader({ entita: "media_player.sala" }, 0.623, sala), {
    domain: "media_player",
    service: "volume_set",
    data: { entity_id: "media_player.sala", volume_level: 0.62 },
  });
  assert.deepEqual(servizioDelMuto({ entita: "media_player.sala" }, sala), {
    domain: "media_player",
    service: "volume_mute",
    data: { entity_id: "media_player.sala", is_volume_muted: false },
  });
  const input = letturaDelCanale(
    { entita: "input_number.aux" },
    { "input_number.aux": { state: "3", attributes: { min: 0, max: 10, step: 1 } } },
  );
  assert.equal(servizioDelFader({ entita: "input_number.aux" }, 0.26, input).data.value, 3);
});

test("il muto e il cursore ci sono solo se il lettore li sa fare", () => {
  const stati = {
    "media_player.tv": { state: "on", attributes: { volume_level: 0.2, supported_features: 1 } },
    "media_player.spento": { state: "off", attributes: { supported_features: 12 } },
    "number.mic": { state: "unavailable", attributes: DB },
    "switch.mic_muto": { state: "on" },
  };
  const tv = letturaDelCanale({ entita: "media_player.tv" }, stati);
  assert.equal(tv.muove, false);
  assert.equal(tv.puoMuto, false);
  assert.equal(servizioDelMuto({ entita: "media_player.tv" }, tv), null);
  assert.equal(letturaDelCanale({ entita: "media_player.spento" }, stati).muove, false);
  const giu = letturaDelCanale({ entita: "number.mic", muto: "switch.mic_muto" }, stati);
  assert.equal(giu.disponibile, false);
  assert.equal(giu.muove, false);
  /* Un interruttore del muto: acceso e' muto, il tocco lo spegne. */
  const conMuto = letturaDelCanale({ entita: "media_player.tv", muto: "switch.mic_muto" }, stati);
  assert.equal(conMuto.mutato, true);
  assert.deepEqual(
    servizioDelMuto({ entita: "media_player.tv", muto: "switch.mic_muto" }, conMuto),
    {
      domain: "switch",
      service: "turn_off",
      data: { entity_id: "switch.mic_muto" },
    },
  );
});

test("la telecamera preme le entita' scelte, e un tasto senza entita' non fa niente", () => {
  const p = paginaPulita({
    modello: "telecamera",
    telecamera: {
      entita: "camera.sala",
      su: "button.ptz_su",
      sinistra: "script.ptz_sinistra",
      giu: "sensor.non_si_preme",
      destra: "remote.ptz",
      destraComando: "pan_right",
      stop: "remote.ptz",
      dispositivo: "Telecamera sala",
      zoom: "number.zoom",
      zoomPiu: "scene.no_zoom",
      preset: [{ entita: "button.home", nome: "HOME" }, { entita: "" }, "x"],
    },
  });
  assert.equal(p.telecamera.giu, "");
  assert.equal(p.telecamera.zoom, "number.zoom");
  assert.deepEqual(p.telecamera.preset, [{ entita: "button.home", nome: "HOME", comando: "" }]);
  assert.deepEqual(servizioDellaTelecamera(p.telecamera, "su"), {
    domain: "button",
    service: "press",
    data: { entity_id: "button.ptz_su" },
  });
  assert.equal(servizioDellaTelecamera(p.telecamera, "sinistra").service, "turn_on");
  assert.equal(servizioDellaTelecamera(p.telecamera, "giu"), null);
  /* Un telecomando manda il comando scritto, o quello di sempre. */
  assert.deepEqual(servizioDellaTelecamera(p.telecamera, "destra"), {
    domain: "remote",
    service: "send_command",
    data: { entity_id: "remote.ptz", command: "pan_right", device: "Telecamera sala" },
  });
  assert.equal(servizioDellaTelecamera(p.telecamera, "stop").data.command, "stop");
  assert.equal(servizioDaPremere("automation.x").service, "trigger");
  assert.equal(
    nuovaPagina("telecamera", { telecamere: [{ entity: "camera.cancello" }] }).telecamera.entita,
    "camera.cancello",
  );
});

test("i comandi: avvio, stop, lo stato acceso, e il ferma tutto", () => {
  const p = paginaPulita({
    modello: "comandi",
    pulsanti: [
      { nome: "Avvio", avvio: "script.avvio", stato: "binary_sensor.sala" },
      { nome: "Spegnimento", avvio: "script.spegnimento", colore: "#ef4444" },
      { nome: "Sala 1", avvio: "switch.sala_1", stop: "switch.sala_1" },
      { nome: "Proiettore", avvio: "script.pro_on", stop: "script.pro_off" },
      { nome: "Solo nome" },
      { avvio: "sensor.non_va" },
    ],
    fermaTutto: { attivo: true },
  });
  assert.equal(p.pulsanti.length, 5, "il solo nome resta, per il config");
  assert.equal(pulsantiDellaPagina(p).length, 4, "sul tablet solo chi ha un'entita'");
  const stati = {
    "binary_sensor.sala": { state: "on" },
    "switch.sala_1": { state: "on" },
    "script.pro_on": { state: "off" },
  };
  const [avvio, spegni, sala, pro] = pulsantiDellaPagina(p);
  assert.equal(pulsanteAcceso(avvio, stati), true);
  assert.equal(pulsanteAcceso(spegni, stati), false);
  assert.deepEqual(servizioDelPulsante(avvio, "avvio", stati), {
    domain: "script",
    service: "turn_on",
    data: { entity_id: "script.avvio" },
  });
  assert.equal(servizioDelPulsante(avvio, "stop", stati), null, "uno script senza stop non ferma");
  assert.deepEqual(servizioDelPulsante(sala, "stop", stati), {
    domain: "switch",
    service: "turn_off",
    data: { entity_id: "switch.sala_1" },
  });
  assert.equal(servizioDelPulsante(sala, "avvio", stati).service, "turn_on");
  assert.equal(servizioDelPulsante(pro, "stop", stati).data.entity_id, "script.pro_off");
  /* Un interruttore con un tasto solo si alterna. */
  const solo = { avvio: "switch.sala_1", stop: "" };
  assert.equal(servizioDelPulsante(solo, "avvio", stati).service, "turn_off");
  assert.equal(servizioDelPulsante(solo, "avvio", {}).service, "turn_on");
  assert.deepEqual(
    chiamateDelFermaTutto(p, stati).map((s) => s.data.entity_id),
    ["switch.sala_1", "script.pro_off"],
  );
  assert.deepEqual(
    chiamateDelFermaTutto({ ...p, fermaTutto: { attivo: true, entita: "script.tutto" } }),
    [{ domain: "script", service: "turn_on", data: { entity_id: "script.tutto" } }],
  );
  assert.deepEqual(chiamateDelFermaTutto({ ...p, fermaTutto: { attivo: false, entita: "" } }), []);
});

test("il menu di lato c'e' solo in orizzontale sul tablet vero", () => {
  const muro = muroPulito({ menuDiLato: true });
  assert.equal(menuDiLato(muro, "orizzontale", false), true);
  assert.equal(menuDiLato(muro, "verticale", false), false);
  assert.equal(menuDiLato(muro, "orizzontale", true), false);
  assert.equal(menuDiLato(muroPulito({}), "orizzontale", false), false);
});

test("il mixer prende anche i sensori (si guardano) e i telecomandi (▲ ▼ e muto)", () => {
  const p = paginaPulita({
    modello: "mixer",
    mixer: {
      gruppi: [
        {
          canali: [
            { entita: "sensor.uscita_sala", muto: "switch.sala_muto", letto: "sensor.altro" },
            { entita: "remote.amplificatore", suComando: "VOL+", dispositivo: "Ampli" },
            { entita: "number.mic_1", letto: "sensor.mic_1_livello", muto: "button.mic_1_muto" },
            { entita: "media_player.sala", muto: "remote.sala_ir", mutoComando: "" },
          ],
        },
      ],
      master: { entita: "remote.amplificatore", min: "-80", max: "x" },
    },
  });
  const [uscita, ampli, mic, sala] = p.mixer.gruppi[0].canali;
  assert.equal(uscita.letto, "", "un sensore e' gia' il suo livello");
  assert.equal(uscita.muto, "switch.sala_muto");
  assert.deepEqual(
    [ampli.suComando, ampli.giuComando, ampli.mutoComando, ampli.dispositivo],
    ["VOL+", "volume_down", "mute", "Ampli"],
  );
  assert.equal(mic.letto, "sensor.mic_1_livello");
  assert.equal(mic.muto, "button.mic_1_muto");
  assert.equal(sala.mutoComando, "mute", "il muto che e' un telecomando ha il suo comando");
  assert.equal(p.mixer.master.entita, "remote.amplificatore");
  assert.equal(p.mixer.master.min, null, "la scala vale solo per i sensori");
  assert.deepEqual(paginaPulita(JSON.parse(JSON.stringify(p))), p, "si rilegge uguale");

  const stati = {
    "sensor.uscita_sala": { state: "-18", attributes: { unit_of_measurement: "dB" } },
    "switch.sala_muto": { state: "on" },
    "remote.amplificatore": { state: "on" },
    "number.mic_1": { state: "-10", attributes: DB },
    "sensor.mic_1_livello": { state: "-24.5", attributes: { unit_of_measurement: "dB" } },
    "media_player.sala": { state: "on", attributes: { volume_level: 0.5 } },
  };
  /* Il sensore: si guarda, da -60 a +12 dB, e il cursore non si tocca. */
  const lu = letturaDelCanale(uscita, stati);
  assert.equal(lu.tipo, "misura");
  assert.equal(lu.muove, false);
  assert.equal(lu.valore, -18);
  assert.ok(Math.abs(lu.posizione - 42 / 72) < 1e-9);
  assert.equal(lu.mutato, true);
  assert.equal(servizioDelFader(uscita, 0.5, lu), null, "un sensore non si muove");
  assert.equal(servizioDelMuto(uscita, lu).service, "turn_off");
  /* Una scala scritta nel config vince su quella dell'unita'. */
  assert.equal(letturaDelCanale({ ...uscita, min: -40, max: 0 }, stati).posizione, 22 / 40);

  /* Il telecomando: ▲ ▼ e il muto mandano il loro comando. */
  const la = letturaDelCanale(ampli, stati);
  assert.equal(la.tipo, "telecomando");
  assert.equal(la.passi, true);
  assert.equal(la.puoMuto, true);
  assert.equal(la.mutoSaDire, false, "un comando non dice se e' muto");
  assert.deepEqual(servizioDelPasso(ampli, "su"), {
    domain: "remote",
    service: "send_command",
    data: { entity_id: "remote.amplificatore", command: "VOL+", device: "Ampli" },
  });
  assert.equal(servizioDelPasso(ampli, "giu").data.command, "volume_down");
  assert.equal(servizioDelMuto(ampli, la).data.command, "mute");
  assert.equal(servizioDelPasso(mic, "su"), null);

  /* Il numero col suo sensore: si muove lui, e sotto c'e' quello che legge. */
  const lm = letturaDelCanale(mic, stati);
  assert.equal(lm.muove, true);
  assert.equal(lm.misura.valore, -24.5);
  assert.equal(lm.misura.min, -60, "nella stessa unita' ha la scala del numero");
  assert.equal(lm.misura.max, 10);
  assert.deepEqual(servizioDelMuto(mic, lm), {
    domain: "button",
    service: "press",
    data: { entity_id: "button.mic_1_muto" },
  });
  /* Il lettore col muto di un telecomando IR. */
  const ls = letturaDelCanale(sala, stati);
  assert.deepEqual(servizioDelMuto(sala, ls), {
    domain: "remote",
    service: "send_command",
    data: { entity_id: "remote.sala_ir", command: "mute" },
  });
  assert.equal(comandoAlTelecomando("switch.no", "x"), null);
});

test("i comandi prendono anche un telecomando: col comando lo manda, senza si accende e si spegne", () => {
  const p = paginaPulita({
    modello: "comandi",
    pulsanti: [
      { nome: "AV", avvio: "remote.sala", avvioComando: "power_on", stop: "remote.sala", stopComando: "power_off", dispositivo: "TV" },
      { nome: "Ampli", avvio: "remote.ampli" },
      { nome: "Muro", avvio: "remote.muro", avvioComando: "PLAY", stop: "remote.muro" },
    ],
    fermaTutto: { attivo: true, entita: "remote.tutto" },
  });
  const [av, ampli, muro] = pulsantiDellaPagina(p);
  assert.deepEqual(servizioDelPulsante(av, "avvio", {}), {
    domain: "remote",
    service: "send_command",
    data: { entity_id: "remote.sala", command: "power_on", device: "TV" },
  });
  assert.equal(servizioDelPulsante(av, "stop", {}).data.command, "power_off");
  const stati = { "remote.ampli": { state: "on" }, "remote.muro": { state: "on" } };
  assert.equal(servizioDelPulsante(ampli, "avvio", stati).service, "turn_off", "si alterna");
  assert.equal(servizioDelPulsante(ampli, "avvio", {}).service, "turn_on");
  assert.equal(pulsanteDiceLoStato(ampli), true);
  assert.equal(pulsanteDiceLoStato(av), false);
  assert.equal(pulsanteAcceso(muro, stati), false, "un comando mandato non resta acceso");
  assert.equal(servizioDelPulsante(muro, "stop", {}).service, "turn_off");
  assert.deepEqual(chiamateDelFermaTutto(p), [
    { domain: "remote", service: "turn_off", data: { entity_id: "remote.tutto" } },
  ]);
});

/* «L'antifurto non gestisce piu' partizioni come abbiamo fatto sul telefono» e
 * «dentro la pagina dell'antifurto ci metterei la possibilita' di riprendere
 * altri dati, tipo se ci sono finestre aperte». L'Ingresso tiene le sue aree,
 * le sue letture e i suoi comandi; una pagina di prima resta com'era. */
test("l'ingresso tiene le aree, le altre letture e gli altri comandi", () => {
  const p = paginaPulita({
    modello: "ingresso",
    ingresso: {
      aree: [
        "alarm_control_panel.perimetrale",
        "ALARM_CONTROL_PANEL.Interno",
        "light.non_e_un_area",
        "alarm_control_panel.perimetrale",
      ],
      letture: ["binary_sensor.finestra_cucina", "lock.porta_ingresso", "button.no", "cover.garage"],
      comandi: ["lock.porta_ingresso", "remote.cancello:apri", "select.non_si_tocca", "script.luce", "sensor.no"],
    },
  });
  assert.deepEqual(p.ingresso.aree, ["alarm_control_panel.perimetrale", "alarm_control_panel.interno"]);
  assert.deepEqual(p.ingresso.letture, ["binary_sensor.finestra_cucina", "lock.porta_ingresso", "cover.garage"]);
  assert.deepEqual(p.ingresso.comandi, ["lock.porta_ingresso", "remote.cancello:apri", "script.luce"]);
  assert.equal(eLetturaDellIngresso("sensor.temperatura"), true);
  assert.equal(eLetturaDellIngresso("script.luce"), false);
  assert.equal(eComandoDellIngresso("cover.garage"), true);
  assert.equal(eComandoDellIngresso("select.modo"), false);
  /* Una pagina di prima: niente di nuovo, e gli elenchi vuoti. */
  const vecchia = paginaPulita({ modello: "ingresso", ingresso: { centrale: "alarm_control_panel.casa" } });
  assert.deepEqual(vecchia.ingresso.aree, []);
  assert.deepEqual(vecchia.ingresso.letture, []);
  assert.deepEqual(vecchia.ingresso.comandi, []);
});

test("le aree dell'ingresso: quelle scelte, o la centrale di prima, o tutte quelle della plancia", () => {
  const fonte = fonteDaiValori({
    ...VALORI,
    cd_centrali: JSON.stringify([
      { id: "a1", nome: "Perimetrale", caselle: { "dm.security_centrale_allarme": "alarm_control_panel.perimetrale" } },
      { id: "a2", nome: "Interno", caselle: { "dm.security_centrale_allarme": "alarm_control_panel.interno" } },
      { id: "a3", nome: "Garage", caselle: { "dm.security_centrale_allarme": "alarm_control_panel.garage" } },
    ]),
    cd_entity_overrides: JSON.stringify({
      "dm.security_centrale_allarme": "alarm_control_panel.perimetrale",
    }),
  });
  const tutte = areeDellIngresso(paginaPulita({ modello: "ingresso" }), fonte);
  assert.deepEqual(
    tutte.map((a) => [a.entita, a.nome]),
    [
      ["alarm_control_panel.perimetrale", "Perimetrale"],
      ["alarm_control_panel.interno", "Interno"],
      ["alarm_control_panel.garage", "Garage"],
    ],
  );
  /* La pagina di prima con la sua centrale: quella sola, come prima. */
  const vecchia = paginaPulita({ modello: "ingresso", ingresso: { centrale: "alarm_control_panel.interno" } });
  assert.deepEqual(areeDellIngresso(vecchia, fonte).map((a) => a.entita), ["alarm_control_panel.interno"]);
  /* Scelte: in quell'ordine, e vincono sulla centrale. */
  const scelte = paginaPulita({
    modello: "ingresso",
    ingresso: { centrale: "alarm_control_panel.interno", aree: ["alarm_control_panel.garage", "alarm_control_panel.perimetrale"] },
  });
  assert.deepEqual(areeDellIngresso(scelte, fonte).map((a) => a.nome), ["Garage", "Perimetrale"]);
  /* Una pagina nuova con piu' aree non ne fissa una: le segue tutte. */
  assert.equal(ingressoProposto(fonte).centrale, "");
  assert.equal(nuovaPagina("ingresso", fonte).ingresso.centrale, "");
});

test("le porte e le finestre fra le letture si contano insieme: «Finestre aperte: 2»", () => {
  const stati = {
    "binary_sensor.finestra_cucina": { state: "on", attributes: { device_class: "window" } },
    "binary_sensor.finestra_bagno": { state: "on", attributes: { device_class: "window" } },
    "binary_sensor.finestra_camera": { state: "off", attributes: { device_class: "window" } },
    "binary_sensor.porta_ingresso": { state: "off", attributes: { device_class: "door" } },
    "binary_sensor.movimento": { state: "on", attributes: { device_class: "motion" } },
  };
  const finestre = ["binary_sensor.finestra_cucina", "binary_sensor.finestra_bagno", "binary_sensor.finestra_camera"];
  const sole = lettureDellIngresso([...finestre, "sensor.temperatura", "binary_sensor.movimento"], stati);
  assert.deepEqual(sole.gruppo, {
    tipo: "finestre",
    tutte: finestre,
    aperte: ["binary_sensor.finestra_cucina", "binary_sensor.finestra_bagno"],
  });
  assert.deepEqual(sole.singole, ["sensor.temperatura", "binary_sensor.movimento"]);
  const miste = lettureDellIngresso([...finestre, "binary_sensor.porta_ingresso"], stati);
  assert.equal(miste.gruppo.tipo, "aperture");
  /* Una finestra sola non e' un conto: resta una lettura. */
  const una = lettureDellIngresso(["binary_sensor.finestra_cucina", "sensor.temperatura"], stati);
  assert.equal(una.gruppo, null);
  assert.deepEqual(una.singole, ["binary_sensor.finestra_cucina", "sensor.temperatura"]);
});
