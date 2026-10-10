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
import {
  comandiDellaPagina,
  comandiProposti,
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

test("sei posti, quattro pagine, e un comando senza entita' vera non entra", () => {
  const troppi = Array.from({ length: 9 }, (_, i) => ({ tipo: "luce", entita: `light.l${i}` }));
  const muro = muroPulito({
    pagine: Array.from({ length: 6 }, () => ({
      modello: "stanza",
      comandi: [
        ...troppi,
        { tipo: "luce", entita: "non un'entita" },
        { tipo: "boh", entita: "light.x" },
      ],
    })),
  });
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
