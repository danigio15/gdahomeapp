/* Il riposo del tablet a muro ha uno stile: l'orologio di sempre, il «Cielo
 * di casa» o la «Cornice foto» (`core/il-riposo-vivo.js`).
 *
 * Qui si provano i conti, senza browser: lo stile che si disegna (la cornice
 * senza foto e' il cielo), il config pulito, la luna nella fase giusta, l'alba
 * e il tramonto da `sun.sun` o stimati, i colori del cielo per l'ora e per il
 * tempo, cosa si muove e quanto in fretta, e l'ordine delle foto. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  SECONDI_PER_FOTO,
  STILI_DEL_RIPOSO,
  altezzaDelSole,
  chiarezza,
  coloriDelCielo,
  faseDellaLuna,
  fotoSuccessiva,
  fotogrammiDelCielo,
  misuraRidotta,
  momentoDelGiorno,
  movimentoDellaFoto,
  ordineDelleFoto,
  oreDelSole,
  riposoDiNotte,
  scenaDelCielo,
  secondiPerFoto,
  stileDelRiposo,
  tempoDelCielo,
} from "../src/core/il-riposo-vivo.js";
import { MURO_VUOTO, muroPulito } from "../src/core/plancia-a-muro.js";

const ORA = 3_600_000;
/* Un giorno qualunque d'autunno, a mezzogiorno di qui. */
const OGGI = new Date(2026, 9, 14, 12, 0, 0);
const alle = (ore, minuti = 0) => new Date(2026, 9, 14, ore, minuti, 0);
/* `sun.sun` come lo scrive Home Assistant: la prossima alba e il prossimo
 * tramonto, che dopo il tramonto sono di domani. */
const sole = (alba, tramonto, extra = {}) => ({
  "sun.sun": {
    state: "above_horizon",
    attributes: {
      next_rising: alba.toISOString(),
      next_setting: tramonto.toISOString(),
      ...extra,
    },
  },
});
const domani = (d) => new Date(d.getTime() + 24 * ORA);
const rgb = (esa) => [1, 3, 5].map((i) => parseInt(esa.slice(i, i + 2), 16));
const saturazione = (esa) => {
  const c = rgb(esa);
  return (Math.max(...c) - Math.min(...c)) / 255;
};

/* ── lo stile e il config ───────────────────────────────────────────────── */

test("di serie il riposo e' l'orologio di sempre: chi non sceglie non vede cambiare niente", () => {
  assert.deepEqual([...STILI_DEL_RIPOSO], ["orologio", "cielo", "foto"]);
  const vuoto = muroPulito({});
  assert.equal(vuoto.riposo.stile, "orologio");
  assert.equal(vuoto.riposo.ogni, 60);
  assert.equal(vuoto.riposo.notteAlMinimo, false);
  assert.equal(MURO_VUOTO.riposo.stile, "orologio");
  assert.equal(stileDelRiposo(vuoto.riposo, 10), "orologio");
  /* Un config di prima, senza la riga: e' l'orologio. */
  assert.equal(muroPulito({ riposo: { attivo: true, minuti: 5 } }).riposo.stile, "orologio");
});

test("lo stile, l'intervallo e la notte si puliscono", () => {
  const m = muroPulito({ riposo: { stile: "foto", ogni: "300", notteAlMinimo: true } });
  assert.equal(m.riposo.stile, "foto");
  assert.equal(m.riposo.ogni, 300);
  assert.equal(m.riposo.notteAlMinimo, true);
  const strano = muroPulito({ riposo: { stile: "acquario", ogni: 45, notteAlMinimo: "si" } });
  assert.equal(strano.riposo.stile, "orologio");
  assert.equal(strano.riposo.ogni, 60);
  assert.equal(strano.riposo.notteAlMinimo, false);
  assert.deepEqual([...SECONDI_PER_FOTO], [30, 60, 300]);
  assert.equal(secondiPerFoto(30), 30);
  assert.equal(secondiPerFoto("abc"), 60);
});

test("la cornice senza foto ripiega sul cielo", () => {
  assert.equal(stileDelRiposo({ stile: "foto" }, 0), "cielo");
  assert.equal(stileDelRiposo({ stile: "foto" }, undefined), "cielo");
  assert.equal(stileDelRiposo({ stile: "foto" }, 3), "foto");
  assert.equal(stileDelRiposo({ stile: "cielo" }, 0), "cielo");
  assert.equal(stileDelRiposo(null, 0), "orologio");
});

test("di notte il riposo resta nero, salvo «Anche di notte, al minimo»", () => {
  assert.equal(riposoDiNotte({ notte: false }), "giorno");
  assert.equal(riposoDiNotte({ notte: false, alMinimo: true }), "giorno");
  assert.equal(riposoDiNotte({ notte: true }), "nero");
  assert.equal(riposoDiNotte({ notte: true, alMinimo: true }), "minimo");
});

/* ── la luna ────────────────────────────────────────────────────────────── */

test("la luna e' nella fase giusta nei giorni che si ricordano", () => {
  /* L'eclissi di sole dell'8 aprile 2024: luna nuova. */
  const nuova = faseDellaLuna(new Date(Date.UTC(2024, 3, 8, 18, 21)));
  assert.ok(Math.min(nuova.fase, 1 - nuova.fase) < 0.03, `fase ${nuova.fase}`);
  assert.ok(nuova.illuminata < 0.02);
  assert.equal(nuova.nome, "nuova");
  /* L'eclissi di luna del 25 marzo 2024: luna piena. */
  const piena = faseDellaLuna(new Date(Date.UTC(2024, 2, 25, 7, 0)));
  assert.ok(Math.abs(piena.fase - 0.5) < 0.03, `fase ${piena.fase}`);
  assert.ok(piena.illuminata > 0.98);
  assert.equal(piena.nome, "piena");
  /* La luna di sangue del 31 gennaio 2018: piena anche lei. */
  assert.equal(faseDellaLuna(new Date(Date.UTC(2018, 0, 31, 13, 30))).nome, "piena");
});

test("la luna cresce e cala, e a meta' strada e' a meta'", () => {
  const nuova = Date.UTC(2024, 3, 8, 18, 21);
  const giorno = 86_400_000;
  const quarto = faseDellaLuna(new Date(nuova + 7.4 * giorno));
  assert.equal(quarto.crescente, true);
  assert.equal(quarto.nome, "primo-quarto");
  assert.ok(Math.abs(quarto.illuminata - 0.5) < 0.08);
  const calante = faseDellaLuna(new Date(nuova + 22.1 * giorno));
  assert.equal(calante.crescente, false);
  assert.equal(calante.nome, "ultimo-quarto");
  /* Un mese dopo si ricomincia. */
  const dopo = faseDellaLuna(new Date(nuova + 29.53 * giorno));
  assert.ok(Math.min(dopo.fase, 1 - dopo.fase) < 0.01);
  /* La fase e' sempre fra 0 e 1, anche prima dell'anno da cui si conta. */
  const prima = faseDellaLuna(new Date(Date.UTC(1990, 5, 1)));
  assert.ok(prima.fase >= 0 && prima.fase < 1);
});

/* ── il sole ────────────────────────────────────────────────────────────── */

test("l'alba e il tramonto vengono da sun.sun, anche quando dice quelli di domani", () => {
  const alba = alle(7, 20);
  const tramonto = alle(18, 40);
  /* La mattina presto: la prossima alba e' oggi. */
  const presto = oreDelSole(sole(alba, tramonto), alle(5));
  assert.equal(presto.stimate, false);
  assert.equal(presto.alba, alba.getTime());
  assert.equal(presto.tramonto, tramonto.getTime());
  /* La sera: il prossimo di tutti e due e' domani, ma il cielo e' di oggi. */
  const sera = oreDelSole(sole(domani(alba), domani(tramonto)), alle(21));
  assert.equal(sera.alba, alba.getTime());
  assert.equal(sera.tramonto, tramonto.getTime());
  /* Di pomeriggio l'alba e' di domani e il tramonto di oggi. */
  const pomeriggio = oreDelSole(sole(domani(alba), tramonto), alle(15));
  assert.equal(pomeriggio.alba, alba.getTime());
  assert.equal(pomeriggio.mezzogiorno, (alba.getTime() + tramonto.getTime()) / 2);
});

test("senza sun.sun l'alba e il tramonto si stimano: d'estate il giorno e' lungo", () => {
  const giugno = oreDelSole({}, new Date(2026, 5, 21, 12));
  const dicembre = oreDelSole({}, new Date(2026, 11, 21, 12));
  const marzo = oreDelSole({}, new Date(2026, 2, 20, 12));
  assert.equal(giugno.stimate, true);
  const ore = (o) => (o.tramonto - o.alba) / ORA;
  assert.ok(ore(giugno) > 15 && ore(giugno) < 16.5, `giugno ${ore(giugno)}`);
  assert.ok(ore(dicembre) > 8 && ore(dicembre) < 9.5, `dicembre ${ore(dicembre)}`);
  assert.ok(Math.abs(ore(marzo) - 12) < 0.4, `marzo ${ore(marzo)}`);
  /* Piu' a nord, d'estate, il giorno e' ancora piu' lungo. */
  const nord = oreDelSole(
    { "zone.home": { state: "0", attributes: { latitude: 60 } } },
    new Date(2026, 5, 21, 12),
  );
  assert.ok(ore(nord) > ore(giugno) + 2);
});

test("quanto e' alto il sole: l'elevazione di sun.sun quando c'e', se no dalle ore", () => {
  const stati = sole(alle(7), alle(19), { elevation: 33.5 });
  assert.equal(altezzaDelSole(stati, alle(3)), 33.5);
  const senza = sole(alle(7), alle(19));
  assert.ok(altezzaDelSole(senza, alle(13)) > 25);
  assert.ok(Math.abs(altezzaDelSole(senza, alle(7))) < 0.01);
  assert.ok(altezzaDelSole(senza, alle(19, 30)) < -4);
  assert.ok(altezzaDelSole(senza, alle(23)) <= -25);
  assert.equal(momentoDelGiorno(-12, false), "notte");
  assert.equal(momentoDelGiorno(2, true), "alba");
  assert.equal(momentoDelGiorno(2, false), "tramonto");
  assert.equal(momentoDelGiorno(30, true), "giorno");
});

/* ── i colori e la scena ────────────────────────────────────────────────── */

test("a mezzogiorno sereno il cielo e' azzurro, col sole e senza stelle", () => {
  const s = scenaDelCielo({ stati: sole(alle(7), alle(19)), condizione: "sunny", adesso: OGGI });
  assert.equal(s.fase, "giorno");
  assert.ok(s.sole, "il sole si vede");
  assert.equal(s.luna, null);
  assert.equal(s.stelle, 0);
  assert.equal(s.nuvole, 0);
  const [r, g, b] = rgb(s.colori.alto);
  assert.ok(b > r + 60 && b > g, `azzurro, non ${s.colori.alto}`);
  assert.ok(chiarezza(s.colori.basso) > 0.6, "l'orizzonte e' chiaro");
  assert.equal(fotogrammiDelCielo(s), 0, "un cielo sereno di giorno non si muove");
});

test("al tramonto l'orizzonte si scalda; nuvoloso, le nuvole ci sono e il sole no", () => {
  const stati = sole(alle(7), alle(18, 40));
  const sereno = scenaDelCielo({ stati, condizione: "sunny", adesso: alle(18, 40) });
  assert.equal(sereno.fase, "tramonto");
  const [r, , b] = rgb(sereno.colori.basso);
  assert.ok(r > b + 80, `arancio all'orizzonte, non ${sereno.colori.basso}`);
  const nuvoloso = scenaDelCielo({ stati, condizione: "cloudy", adesso: alle(18, 40) });
  assert.equal(nuvoloso.fase, "tramonto");
  assert.ok(nuvoloso.nuvole >= 5);
  assert.equal(nuvoloso.sole, null);
  assert.ok(saturazione(nuvoloso.colori.basso) < saturazione(sereno.colori.basso));
  assert.equal(fotogrammiDelCielo(nuvoloso), 5);
});

test("di notte ci sono le stelle e la luna nella sua fase", () => {
  const stati = sole(domani(alle(7)), domani(alle(18, 40)));
  /* La notte del 24 ottobre 2026 (piena il 26): una luna quasi piena. */
  const notte = new Date(2026, 9, 24, 23, 30);
  const s = scenaDelCielo({ stati, condizione: "clear-night", adesso: notte });
  assert.equal(s.fase, "notte");
  assert.ok(s.stelle > 0.8);
  assert.ok(s.luna, "la luna si vede");
  assert.equal(s.luna.fase, faseDellaLuna(notte).fase);
  assert.ok(s.luna.x > 0 && s.luna.x < 1 && s.luna.y > 0 && s.luna.y < 0.5);
  assert.ok(chiarezza(s.colori.alto) < 0.05, "il cielo e' scuro");
  assert.equal(s.sole, null);
  assert.equal(fotogrammiDelCielo(s), 5, "le stelle brillano piano");
  /* Coperto di notte: niente stelle, niente luna. */
  const coperta = scenaDelCielo({ stati, condizione: "pouring", adesso: notte });
  assert.equal(coperta.luna, null);
  assert.ok(coperta.stelle < 0.1);
});

test("la pioggia, la neve e la nebbia sono quelle del meteo", () => {
  assert.equal(tempoDelCielo("rainy").pioggia, 1);
  assert.equal(tempoDelCielo("pouring").pioggia, 2);
  assert.equal(tempoDelCielo("lightning-rainy").pioggia, 2);
  assert.equal(tempoDelCielo("snowy").neve, 1);
  assert.equal(tempoDelCielo("snowy-rainy").neve, 1);
  assert.equal(tempoDelCielo("fog").nebbia, 1);
  assert.equal(tempoDelCielo("windy").vento, true);
  /* Un tempo che non si conosce non si inventa la pioggia. */
  assert.deepEqual(tempoDelCielo("boh"), tempoDelCielo("sunny"));
  assert.deepEqual(tempoDelCielo(undefined), tempoDelCielo("sunny"));
  const pioggia = scenaDelCielo({
    stati: sole(alle(7), alle(19)),
    condizione: "rainy",
    adesso: OGGI,
  });
  assert.equal(pioggia.pioggia, 1);
  assert.equal(fotogrammiDelCielo(pioggia), 12);
  /* La pioggia scurisce: il cielo coperto di pioggia e' piu' scuro di
   * quello solo nuvoloso. */
  const nuvole = coloriDelCielo({ altezza: 35, condizione: "cloudy" });
  const piove = coloriDelCielo({ altezza: 35, condizione: "rainy" });
  assert.ok(chiarezza(piove.medio) < chiarezza(nuvole.medio));
  assert.ok(saturazione(nuvole.alto) < saturazione(coloriDelCielo({ altezza: 35 }).alto));
});

test("la firma cambia quando cambia il cielo, non a ogni minuto", () => {
  const stati = sole(alle(7), alle(19));
  const a = scenaDelCielo({ stati, condizione: "sunny", adesso: alle(12, 0) });
  const b = scenaDelCielo({
    stati,
    condizione: "sunny",
    adesso: new Date(alle(12, 0).getTime() + 20_000),
  });
  assert.equal(a.firma, b.firma);
  const c = scenaDelCielo({ stati, condizione: "rainy", adesso: alle(12, 0) });
  assert.notEqual(a.firma, c.firma);
  const d = scenaDelCielo({ stati, condizione: "sunny", adesso: alle(18, 50) });
  assert.notEqual(a.firma, d.firma);
});

/* ── le foto ────────────────────────────────────────────────────────────── */

const NOMI = [
  "aaaaaaaaaaaaaaaa",
  "bbbbbbbbbbbbbbbb",
  "cccccccccccccccc",
  "dddddddddddddddd",
  "eeeeeeeeeeeeeeee",
];

test("le foto passano tutte prima che una torni, sempre nello stesso ordine per lo stesso giro", () => {
  const ordine = ordineDelleFoto(NOMI, 0);
  assert.deepEqual([...ordine].sort(), [...NOMI].sort());
  assert.deepEqual(
    ordineDelleFoto([...NOMI].reverse(), 0),
    ordine,
    "l'ordine non dipende da come arrivano",
  );
  assert.notDeepEqual(ordineDelleFoto(NOMI, 1), ordine, "un giro nuovo, un ordine nuovo");
  /* Cinque passi: cinque foto diverse. */
  let attuale = "";
  let giro = 0;
  const viste = [];
  for (let i = 0; i < NOMI.length; i += 1) {
    const dopo = fotoSuccessiva(NOMI, attuale, giro);
    viste.push(dopo.nome);
    attuale = dopo.nome;
    giro = dopo.giro;
  }
  assert.equal(new Set(viste).size, NOMI.length);
  assert.equal(giro, 0);
  /* Il sesto passo comincia un giro nuovo, e non ripete l'ultima. */
  const sesta = fotoSuccessiva(NOMI, attuale, giro);
  assert.equal(sesta.giro, 1);
  assert.notEqual(sesta.nome, attuale);
});

test("a cavallo dei giri la stessa foto non passa mai due volte di fila", () => {
  for (let n = 2; n <= 7; n += 1) {
    const nomi = NOMI.concat(["ffffffffffffffff", "gggggggggggggggg"]).slice(0, n);
    let attuale = "";
    let giro = 0;
    for (let i = 0; i < n * 12; i += 1) {
      const dopo = fotoSuccessiva(nomi, attuale, giro);
      assert.notEqual(dopo.nome, attuale, `${n} foto, passo ${i}`);
      attuale = dopo.nome;
      giro = dopo.giro;
    }
  }
});

test("una foto sola resta quella; senza foto non c'e' niente; una foto tolta fa ricominciare", () => {
  assert.deepEqual(fotoSuccessiva(["aaaaaaaaaaaaaaaa"], "aaaaaaaaaaaaaaaa", 3), {
    nome: "aaaaaaaaaaaaaaaa",
    giro: 3,
  });
  assert.equal(fotoSuccessiva([], "", 0), null);
  assert.equal(fotoSuccessiva(null, "", 0), null);
  const tolta = fotoSuccessiva(NOMI, "zzzzzzzzzzzzzzzz", 2);
  assert.equal(tolta.nome, ordineDelleFoto(NOMI, 2)[0]);
});

test("il movimento lento di una foto e' sempre lo stesso e non scopre il bordo", () => {
  assert.deepEqual(movimentoDellaFoto("aaaaaaaaaaaaaaaa"), movimentoDellaFoto("aaaaaaaaaaaaaaaa"));
  assert.notDeepEqual(
    movimentoDellaFoto("aaaaaaaaaaaaaaaa"),
    movimentoDellaFoto("bbbbbbbbbbbbbbbb"),
  );
  for (const nome of NOMI.concat(Array.from({ length: 40 }, (_, i) => `foto${i}`))) {
    const { da, a } = movimentoDellaFoto(nome);
    for (const posa of [da, a]) {
      assert.ok(posa.scala >= 1.02 && posa.scala <= 1.16, `${nome} scala ${posa.scala}`);
      const libero = ((posa.scala - 1) / 2) * 100;
      assert.ok(Math.abs(posa.x) <= libero && Math.abs(posa.y) <= libero, `${nome} esce dal bordo`);
    }
    assert.notEqual(da.scala, a.scala, "si avvicina o si allontana");
  }
});

test("la foto si rimpicciolisce al lato lungo di 1920, e mai si ingrandisce", () => {
  assert.deepEqual(misuraRidotta(4032, 3024), { larghezza: 1920, altezza: 1440 });
  assert.deepEqual(misuraRidotta(3024, 4032), { larghezza: 1440, altezza: 1920 });
  assert.deepEqual(misuraRidotta(1280, 800), { larghezza: 1280, altezza: 800 });
  assert.deepEqual(misuraRidotta(4000, 1000, 320), { larghezza: 320, altezza: 80 });
  assert.deepEqual(misuraRidotta(0, 0), { larghezza: 1, altezza: 1 });
});
