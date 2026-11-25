/* La scena delle luci di Natale: che cielo c'e', quali cose, dove stanno.
 *
 * Il riquadro in Home disegna un paesaggio d'inverno dove ogni luce e' la
 * cosa vera. Le prove dicono le tre regole che contano per chi lo guarda:
 * nella scena c'e' solo quello che e' configurato; il cielo segue la
 * giornata (di mattina non e' nero, e il testo sul cielo chiaro e' scuro);
 * toccare una cosa accende o spegne tutte le sue luci.
 *
 * Le date si costruiscono in ora locale, come le legge la plancia.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  chiamateDelTocco,
  cieloDellaScena,
  coloriDellaScena,
  coseDellaScena,
  disposizioneDellaScena,
  etichetteDellaScena,
  faseDelCielo,
  MISURE_DELLE_COSE,
  partiDivise,
  variabiliDellaScena,
} from "../src/core/scena-delle-luci.js";
import { chiarezza } from "../src/core/il-riposo-vivo.js";
import { pathDellaLuna, scenaDelleLuci } from "../src/sections/la-scena-delle-luci.js";

const d = (anno, mese, giorno, ore = 0, minuti = 0) =>
  new Date(anno, mese - 1, giorno, ore, minuti);

/* Il sole di Home Assistant a fine novembre: alba alle 7:25, tramonto alle 16:42. */
const sole = (elevation) => ({
  "sun.sun": {
    state: elevation > 0 ? "above_horizon" : "below_horizon",
    attributes: {
      elevation,
      next_rising: d(2026, 11, 29, 7, 25).toISOString(),
      next_setting: d(2026, 11, 29, 16, 42).toISOString(),
    },
  },
});

/* ── il cielo ───────────────────────────────────────────────────────────── */

test("la fase del cielo: alba, giorno, tramonto, sera, notte", () => {
  assert.equal(faseDelCielo(30, true), "giorno");
  assert.equal(faseDelCielo(8, false), "giorno");
  assert.equal(faseDelCielo(3, true), "alba");
  assert.equal(faseDelCielo(-5, true), "alba");
  assert.equal(faseDelCielo(-7, true), "notte");
  assert.equal(faseDelCielo(2, false), "tramonto");
  assert.equal(faseDelCielo(-4, false), "tramonto");
  assert.equal(faseDelCielo(-8, false), "sera");
  assert.equal(faseDelCielo(-12, false), "sera");
  assert.equal(faseDelCielo(-13, false), "notte");
});

test("il cielo segue la giornata: di mattina non e' nero, di notte ci sono la luna e le stelle", () => {
  const mattina = cieloDellaScena({ stati: sole(8.5), adesso: d(2026, 11, 28, 8, 30) });
  const giorno = cieloDellaScena({ stati: sole(24), adesso: d(2026, 11, 28, 13) });
  const tramonto = cieloDellaScena({ stati: sole(-3.4), adesso: d(2026, 11, 28, 17) });
  const notte = cieloDellaScena({ stati: sole(-48), adesso: d(2026, 11, 28, 22) });

  assert.equal(giorno.fase, "giorno");
  assert.equal(tramonto.fase, "tramonto");
  assert.equal(notte.fase, "notte");
  assert.ok(chiarezza(mattina.cielo.alto) > 0.3, "la mattina il cielo e' chiaro");
  assert.ok(chiarezza(giorno.cielo.medio) > 0.5);
  assert.ok(chiarezza(notte.cielo.alto) < 0.12, "la notte e' blu scuro");

  /* Di giorno: niente stelle, niente luna, il sole; testo scuro. */
  assert.equal(giorno.stelle, 0);
  assert.equal(giorno.luna, null);
  assert.ok(giorno.sole);
  assert.equal(giorno.chiaro, true);
  assert.equal(mattina.chiaro, true);
  assert.equal(giorno.pannelloChiaro, true);
  /* Di notte: le stelle, la luna (se non e' nuova), testo chiaro. */
  assert.ok(notte.stelle > 0.5);
  assert.equal(notte.sole, null);
  assert.equal(notte.chiaro, false);
  assert.equal(notte.pannelloChiaro, false);
  assert.equal(notte.fiocchi, true);
  assert.equal(giorno.fiocchi, false);

  /* Le luci di giorno si vedono, ma con l'alone piccolo. */
  assert.ok(giorno.colori.alone < notte.colori.alone);
  assert.ok(giorno.colori.alone > 0.3);
});

test("senza sun.sun il cielo si stima dall'ora", () => {
  assert.equal(cieloDellaScena({ adesso: d(2026, 11, 28, 13) }).fase, "giorno");
  assert.equal(cieloDellaScena({ adesso: d(2026, 11, 28, 23) }).fase, "notte");
});

test("il tempo coperto ingrigisce il cielo, e di notte le nuvole sparse non ci sono", () => {
  const sereno = cieloDellaScena({
    stati: sole(24),
    condizione: "sunny",
    adesso: d(2026, 11, 28, 13),
  });
  const coperto = cieloDellaScena({
    stati: sole(24),
    condizione: "cloudy",
    adesso: d(2026, 11, 28, 13),
  });
  assert.notEqual(sereno.cielo.alto, coperto.cielo.alto);
  assert.ok(coperto.nuvole > sereno.nuvole);
  const notte = cieloDellaScena({
    stati: sole(-40),
    condizione: "partlycloudy",
    adesso: d(2026, 11, 28, 22),
  });
  assert.equal(notte.nuvole, 0);
});

test("i colori delle cose passano dal giorno alla notte, e la firma cambia solo con la fase", () => {
  const giorno = coloriDellaScena(30, true);
  const notte = coloriDellaScena(-30, false);
  assert.equal(giorno.neve1, "#ffffff");
  assert.ok(chiarezza(notte.neve1) < chiarezza(giorno.neve1));
  assert.ok(chiarezza(notte.muro) < chiarezza(giorno.muro));
  const mezzo = coloriDellaScena(-7, false);
  assert.ok(chiarezza(mezzo.muro) > chiarezza(notte.muro));
  assert.ok(chiarezza(mezzo.muro) < chiarezza(giorno.muro));

  const v = variabiliDellaScena(cieloDellaScena({ stati: sole(-40), adesso: d(2026, 11, 28, 22) }));
  assert.ok(v["--sc-c1"].startsWith("#"));
  assert.ok("--sc-neve1" in v && "--sc-neve-ombra" in v && "--sc-abete-lontano" in v);

  const a = cieloDellaScena({ stati: sole(-40), adesso: d(2026, 11, 28, 22) });
  const b = cieloDellaScena({ stati: sole(-41), adesso: d(2026, 11, 28, 22, 1) });
  assert.equal(a.firma, b.firma, "un minuto dopo, la stessa scena: si cambiano solo i colori");
});

/* ── le cose ────────────────────────────────────────────────────────────── */

const tipi = (cose) => cose.map((c) => c.tipo);

test("nella scena c'e' solo quello che e' configurato", () => {
  assert.deepEqual(tipi(coseDellaScena([])), []);
  assert.deepEqual(tipi(coseDellaScena([{ entity: "switch.presa_albero" }])), ["albero"]);
  assert.deepEqual(
    tipi(coseDellaScena([{ entity: "switch.presa_albero" }, { entity: "light.striscia_balcone" }])),
    ["albero", "casa"],
  );
  assert.deepEqual(
    tipi(
      coseDellaScena([
        { entity: "light.striscia_balcone" },
        { entity: "light.presepe" },
        { entity: "switch.presa_albero" },
      ]),
    ),
    ["albero", "presepe", "casa"],
    "sempre nello stesso ordine, da sinistra",
  );
  /* Una luce che non dice cos'e' e' una ghirlanda. */
  assert.deepEqual(tipi(coseDellaScena([{ entity: "light.lucine" }])), ["ghirlanda"]);
  /* Il tipo si indovina anche dal nome di Home Assistant. */
  assert.deepEqual(
    tipi(coseDellaScena([{ entity: "switch.presa_3" }], { "switch.presa_3": "Presepe" })),
    ["presepe"],
  );
});

test("piu' luci dello stesso tipo: una cosa sola, con tutte le sue luci", () => {
  const [albero] = coseDellaScena([
    { entity: "switch.albero_sala", tipo: "albero" },
    { entity: "light.albero_puntale", tipo: "albero" },
  ]);
  assert.deepEqual(albero.entita, ["switch.albero_sala", "light.albero_puntale"]);
  /* I festoni si dividono a turno fra le luci. */
  assert.deepEqual(partiDivise(albero.entita, 5), [
    "switch.albero_sala",
    "light.albero_puntale",
    "switch.albero_sala",
    "light.albero_puntale",
    "switch.albero_sala",
  ]);
  assert.deepEqual(partiDivise([], 2), ["", ""]);

  /* Le ghirlande stanno in due posti, oltre la seconda si dividono quelli. */
  const ghirlande = coseDellaScena([
    { entity: "light.a" },
    { entity: "light.b" },
    { entity: "light.c" },
  ]);
  assert.deepEqual(tipi(ghirlande), ["ghirlanda", "ghirlanda"]);
  assert.deepEqual(ghirlande[0].entita, ["light.b"]);
  assert.deepEqual(ghirlande[1].entita, ["light.a", "light.c"]);
  assert.notEqual(ghirlande[0].chiave, ghirlande[1].chiave);
});

test("la casa, il presepe e la stella", () => {
  /* La finestra da sola e' una casa, con le candele e senza lucine fuori. */
  const [casa] = coseDellaScena([{ entity: "light.candele", tipo: "finestra" }]);
  assert.equal(casa.tipo, "casa");
  assert.deepEqual(casa.balcone, []);
  assert.deepEqual(casa.finestra, ["light.candele"]);
  const [conTutto] = coseDellaScena([
    { entity: "light.candele", tipo: "finestra" },
    { entity: "light.grondaia", tipo: "balcone" },
  ]);
  assert.deepEqual(conTutto.balcone, ["light.grondaia"]);
  assert.deepEqual(conTutto.entita, ["light.grondaia", "light.candele"]);

  /* La stella col presepe sta sopra la capanna; senza, ha il suo posto in cielo. */
  const conPresepe = coseDellaScena([{ entity: "light.presepe" }, { entity: "light.stella" }]);
  assert.deepEqual(tipi(conPresepe), ["presepe"]);
  assert.deepEqual(conPresepe[0].stella, ["light.stella"]);
  assert.deepEqual(conPresepe[0].presepe, ["light.presepe"]);
  assert.deepEqual(
    tipi(coseDellaScena([{ entity: "switch.presa_albero" }, { entity: "light.stella" }])),
    ["albero", "stella"],
  );
});

test("la disposizione: centrata accanto ai comandi, in ordine, mai fuori", () => {
  const cose = coseDellaScena([
    { entity: "switch.presa_albero" },
    { entity: "light.presepe" },
    { entity: "light.striscia_balcone" },
  ]);
  const largo = disposizioneDellaScena(cose, { larghezza: 1400, da: 470, a: 1300 });
  assert.equal(largo.length, 3);
  assert.ok(largo[0].x < largo[1].x && largo[1].x < largo[2].x);
  assert.ok(largo[0].x - largo[0].larghezza / 2 >= 470 - 0.5);
  assert.ok(largo.at(-1).x + largo.at(-1).larghezza / 2 <= 1300 + 0.5);
  const centro =
    (largo[0].x - largo[0].larghezza / 2 + largo.at(-1).x + largo.at(-1).larghezza / 2) / 2;
  assert.ok(Math.abs(centro - 885) < 1);
  /* Nessuna cosa supera la cima della scena. */
  for (const cosa of largo)
    assert.ok(252 - MISURE_DELLE_COSE[cosa.tipo].altezza * cosa.scala >= 14 - 0.5);

  /* L'albero da solo: in mezzo allo spazio, a grandezza piena. */
  const [solo] = disposizioneDellaScena(coseDellaScena([{ entity: "switch.presa_albero" }]), {
    larghezza: 1400,
    da: 470,
    a: 1300,
  });
  assert.equal(solo.x, 885);
  assert.ok(solo.scala > 1);

  /* Sul telefono si stringe, e poco poco si accavalla, senza uscire. */
  const stretto = disposizioneDellaScena(cose, { larghezza: 470, da: 12, a: 458 });
  assert.ok(stretto[0].scala < 0.8);
  assert.ok(stretto[0].x - stretto[0].larghezza / 2 >= 11.5);
  assert.ok(stretto.at(-1).x + stretto.at(-1).larghezza / 2 <= 458.5);
});

/* ── i tocchi e le parole ───────────────────────────────────────────────── */

test("un tocco su una cosa: se una delle sue luci e' accesa le spegne tutte, se no le accende", () => {
  const accese = new Set(["switch.albero_sala"]);
  assert.deepEqual(
    chiamateDelTocco(["switch.albero_sala", "light.albero_puntale"], (e) => accese.has(e)),
    [
      { domain: "switch", service: "turn_off", data: { entity_id: ["switch.albero_sala"] } },
      { domain: "light", service: "turn_off", data: { entity_id: ["light.albero_puntale"] } },
    ],
  );
  assert.deepEqual(
    chiamateDelTocco(["light.a", "light.b"], () => false),
    [{ domain: "light", service: "turn_on", data: { entity_id: ["light.a", "light.b"] } }],
  );
  assert.deepEqual(chiamateDelTocco([]), []);
});

test("le etichette per chi non vede: i nomi delle luci di ogni cosa", () => {
  const cose = coseDellaScena([
    { entity: "light.presepe" },
    { entity: "light.stella" },
    { entity: "light.grondaia", tipo: "balcone" },
    { entity: "light.candele", tipo: "finestra" },
  ]);
  const nomi = {
    "light.presepe": "Presepe",
    "light.stella": "Cometa",
    "light.grondaia": "Grondaia",
    "light.candele": "Candele",
  };
  assert.deepEqual(
    etichetteDellaScena(cose, (e) => nomi[e]),
    {
      presepe: "Presepe",
      stella: "Cometa",
      casa: "Grondaia",
      finestre: "Candele",
    },
  );
});

/* ── il disegno ─────────────────────────────────────────────────────────── */

const disegna = (luci, accese = [], elevazione = -40) => {
  const cielo = cieloDellaScena({ stati: sole(elevazione), adesso: d(2026, 11, 28, 22) });
  const cose = disposizioneDellaScena(coseDellaScena(luci), { larghezza: 1200, da: 400, a: 1100 });
  return scenaDelleLuci({ cose, cielo, larghezza: 1200, accese: new Set(accese), prefisso: "t1" });
};

test("il disegno ha solo le cose configurate, e le luci accese portano la classe", () => {
  const { svg, sopra } = disegna([{ entity: "switch.presa_albero" }], ["switch.presa_albero"]);
  assert.match(svg, /data-feste-cosa="albero"/);
  assert.doesNotMatch(svg, /data-feste-cosa="presepe"/);
  assert.doesNotMatch(svg, /sc-sagome/, "senza presepe, niente Nativita'");
  assert.doesNotMatch(svg, /sc-abbaino/, "senza balcone ne' finestre, niente casa");
  assert.doesNotMatch(sopra, /dm-sc-fumo/, "niente casa, niente camino");
  assert.match(sopra, /dm-sc-fiocchi/, "di notte cadono i fiocchi");
  assert.match(svg, /class="sc-p acceso" data-luce="switch.presa_albero"/);
  assert.match(svg, /data-feste-entita="switch.presa_albero"/);
  /* Gli id dei gradienti hanno il prefisso: due scene nello stesso documento
   * non si pestano. */
  assert.match(svg, /id="t1cielo"/);
  assert.doesNotMatch(svg, /id="cielo"/);

  const tutte = disegna(
    [{ entity: "light.presepe" }, { entity: "light.grondaia", tipo: "balcone" }],
    [],
  );
  assert.match(tutte.svg, /sc-sagome/);
  assert.match(tutte.svg, /sc-abbaino/);
  assert.match(tutte.sopra, /dm-sc-fumo/);
  assert.doesNotMatch(tutte.svg, /sc-p acceso/, "spente, nessuna parte accesa");
});

test("di giorno non ci sono i fiocchi, e i colori stanno nelle variabili", () => {
  const { svg, sopra } = disegna([{ entity: "light.lucine" }], [], 25);
  assert.doesNotMatch(sopra, /dm-sc-fiocchi/);
  assert.match(svg, /--sc-neve1:#ffffff/);
  assert.match(svg, /class="dm-sc dm-sc-giorno"/);
});

test("la luna nella sua fase", () => {
  assert.equal(pathDellaLuna(10, 0.5), "M0 -10A10 10 0 0 1 0 10A0 10 0 0 0 0 -10Z");
  assert.match(
    pathDellaLuna(10, 0.9),
    /A8 10 0 0 1 0 -10Z$/,
    "gibbosa: il terminatore va a sinistra",
  );
  assert.match(pathDellaLuna(10, 0.1), /A8 10 0 0 0 0 -10Z$/, "falce: il terminatore va a destra");
});

test("la mattina d'inverno, appena sorto il sole, e' gia' giorno: chiaro anche col cielo coperto", () => {
  const coperta = cieloDellaScena({
    stati: sole(3),
    condizione: "snowy",
    adesso: d(2026, 11, 28, 8, 30),
  });
  assert.equal(coperta.fase, "giorno");
  assert.ok(chiarezza(coperta.cielo.alto) > 0.45, "grigio-azzurro luminoso, non da crepuscolo");
  assert.equal(coperta.colori.neve1, "#ffffff");
  /* La sera, alla stessa altezza, il crepuscolo resta: e' l'ora delle lucine. */
  const sera = cieloDellaScena({
    stati: sole(3),
    condizione: "snowy",
    adesso: d(2026, 11, 28, 16, 20),
  });
  assert.equal(sera.fase, "tramonto");
  assert.ok(chiarezza(sera.cielo.alto) < chiarezza(coperta.cielo.alto));
});

/* «Riesci a fare qualcosa di più animato, tipo le luci sull'albero a
 * intermittenza?» Le lampadine accese girano fra alcuni giochi; qui il
 * programma, e che il disegno lo usi solo per chi non ha chiesto di ridurre
 * le animazioni. */
test("i giochi delle lampadine: alterna, rincorsa, respiro, scintille, ferme", async () => {
  const { GIOCHI_DELLE_LUCI, GRUPPI_DELLE_LAMPADINE, LUCE_BASSA, programmaDelleLuci } =
    await import("../src/core/scena-delle-luci.js");
  const passi = GIOCHI_DELLE_LUCI.reduce((n, [, q]) => n + q, 0);
  const tutti = Array.from({ length: GRUPPI_DELLE_LAMPADINE }, (_, g) => programmaDelleLuci(g));
  for (const p of tutti) {
    assert.equal(p.length, passi);
    for (const v of p) assert.ok(v >= LUCE_BASSA && v <= 1, `luce fuori misura: ${v}`);
  }
  /* «alterna»: due gruppi vicini sono uno acceso e uno basso, e si scambiano */
  assert.notEqual(tutti[0][0], tutti[1][0]);
  assert.equal(tutti[0][0], tutti[1][2]);
  /* «rincorsa»: il tratto acceso si sposta di un gruppo a ogni passo */
  const r = GIOCHI_DELLE_LUCI[0][1];
  for (let g = 0; g < GRUPPI_DELLE_LAMPADINE - 1; g += 1)
    assert.equal(tutti[g][r + 1], tutti[g + 1][r + 2]);
  /* «respiro»: tutte insieme */
  const respiro = r + GIOCHI_DELLE_LUCI[1][1];
  for (let t = respiro; t < respiro + GIOCHI_DELLE_LUCI[2][1]; t += 1)
    assert.equal(new Set(tutti.map((p) => p[t])).size, 1);
  /* in fondo, tutte accese */
  for (const p of tutti) assert.equal(p.at(-1), 1);
  /* un gruppo fuori misura torna nel giro */
  assert.deepEqual(programmaDelleLuci(GRUPPI_DELLE_LAMPADINE + 2), tutti[2]);
  assert.deepEqual(programmaDelleLuci(-1), tutti[GRUPPI_DELLE_LAMPADINE - 1]);
});

test("il disegno: le lampadine nei gruppi, i giochi solo senza «riduci animazioni»", async () => {
  const { cssDellaScena } = await import("../src/sections/la-scena-delle-luci.js");
  const { cieloDellaScena, coseDellaScena, disposizioneDellaScena } =
    await import("../src/core/scena-delle-luci.js");
  const cielo = cieloDellaScena({ adesso: new Date(2026, 11, 20, 22, 30) });
  const cose = disposizioneDellaScena(coseDellaScena([{ entity: "switch.presa_albero" }]), {
    larghezza: 600,
    da: 0,
    a: 600,
  });
  const { svg, sopra } = scenaDelleLuci({ cose, cielo, larghezza: 600 });
  assert.match(svg, /class="sc-lg sc-lg0"/);
  assert.match(svg, /class="sc-lg sc-lg5"/);
  assert.match(svg, /sc-luccica/);
  /* di notte passa una stella cadente; di giorno no */
  assert.match(sopra, /dm-sc-cadente/);
  const giorno = scenaDelleLuci({
    cose,
    cielo: cieloDellaScena({ adesso: new Date(2026, 11, 20, 13) }),
    larghezza: 600,
  });
  assert.doesNotMatch(giorno.sopra, /dm-sc-cadente/);
  const css = cssDellaScena("#x");
  assert.match(css, /@keyframes dm-sc-gioco0\{/);
  /* le animazioni dei giochi stanno tutte dentro «no-preference» */
  const fuori = css.replace(
    /@media \(prefers-reduced-motion:no-preference\)\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g,
    "",
  );
  assert.doesNotMatch(fuori, /animation:dm-sc-gioco/);
  assert.doesNotMatch(fuori, /animation:dm-sc-cadente/);
});
