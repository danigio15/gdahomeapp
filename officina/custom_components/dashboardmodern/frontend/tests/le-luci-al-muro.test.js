/* Le luci di casa sul tablet a muro: quando la scena delle luci prende il
 * riposo, quando il tablet si sveglia per guardarle accendersi (una volta per
 * sera, mai di notte), e il «Spegni tutte» del riposo che non sveglia.
 *
 * Le date si costruiscono in ora locale, come le legge il pannello.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { festePulite, momentoDelMuro } from "../src/core/feste.js";
import {
  DURATA_DEL_MOMENTO,
  TOCCHI_CHE_NON_SVEGLIANO,
  ilToccoSveglia,
  luciSulRiposo,
  luciSullaPlancia,
  fiocchiSulRiposo,
  momentoDellAccensione,
  riposoDelleFeste,
  seraDi,
} from "../src/core/le-luci-al-muro.js";
import { stileDelRiposo } from "../src/core/il-riposo-vivo.js";

const d = (anno, mese, giorno, ore = 0, minuti = 0, secondi = 0) =>
  new Date(anno, mese - 1, giorno, ore, minuti, secondi);

const conLuci = festePulite({ luci: [{ entity: "switch.presa_albero", nome: "Albero" }] });
const senzaLuci = festePulite(null);

/* ── la scena sul riposo ────────────────────────────────────────────────── */

test("la scena delle luci prende il riposo solo nel momento della Vigilia, e solo con delle luci", () => {
  const sera = d(2026, 12, 20, 17, 0);
  assert.equal(momentoDelMuro(sera), "vigilia");
  assert.equal(luciSulRiposo(momentoDelMuro(sera), conLuci), true);
  /* Senza luci resta la scena di sempre. */
  assert.equal(luciSulRiposo(momentoDelMuro(sera), senzaLuci), false);
  assert.equal(luciSulRiposo(momentoDelMuro(sera), null), false);
  /* Il conto alla rovescia e i fuochi restano loro. */
  assert.equal(luciSulRiposo(momentoDelMuro(d(2026, 12, 31, 23, 59, 50)), conLuci), false);
  assert.equal(luciSulRiposo(momentoDelMuro(d(2027, 1, 1, 0, 0, 30)), conLuci), false);
  /* Fuori dalla finestra non c'e' niente da cambiare. */
  assert.equal(luciSulRiposo(momentoDelMuro(d(2026, 11, 23, 17, 0)), conLuci), false);
});

test("la fascia delle luci sulla plancia sveglia: solo dentro la finestra, solo con delle luci", () => {
  assert.equal(luciSullaPlancia(d(2026, 12, 20, 17, 0), conLuci), true);
  assert.equal(luciSullaPlancia(d(2027, 1, 6, 23, 59), conLuci), true);
  assert.equal(luciSullaPlancia(d(2026, 12, 20, 17, 0), senzaLuci), false);
  assert.equal(luciSullaPlancia(d(2026, 11, 23, 17, 0), conLuci), false);
  assert.equal(luciSullaPlancia(d(2027, 1, 7, 0, 0), conLuci), false);
});

/* ── il momento dell'accensione ─────────────────────────────────────────── */

const sera = (altro = {}) => ({
  prima: 0,
  accese: 3,
  note: 3,
  riposo: true,
  conLeLuci: true,
  notte: false,
  fase: "tramonto",
  mattina: false,
  adesso: d(2026, 12, 20, 17, 0, 5),
  fatta: "",
  ...altro,
});

test("le luci che si accendono col tablet a riposo, di sera, lo svegliano per un momento", () => {
  assert.deepEqual(momentoDellAccensione(sera()), { mostra: true, sera: seraDi(sera().adesso) });
  assert.equal(momentoDellAccensione(sera({ fase: "sera" })).mostra, true);
  assert.equal(
    momentoDellAccensione(sera({ fase: "notte", adesso: d(2026, 12, 20, 21, 0) })).mostra,
    true,
  );
  assert.equal(DURATA_DEL_MOMENTO, 20 * 1000);
});

test("una volta per sera: la seconda accensione della stessa sera non sveglia piu'", () => {
  const prima = momentoDellAccensione(sera());
  assert.equal(prima.mostra, true);
  const ancora = momentoDellAccensione(
    sera({ adesso: d(2026, 12, 20, 20, 15), fatta: prima.sera }),
  );
  assert.equal(ancora.mostra, false);
  assert.equal(ancora.sera, prima.sera);
  /* La sera dopo si', di nuovo. */
  assert.equal(
    momentoDellAccensione(sera({ adesso: d(2026, 12, 21, 17, 1), fatta: prima.sera })).mostra,
    true,
  );
});

test("mai di notte, mai di giorno, mai quando si spengono", () => {
  /* Il buio della notte del pannello. */
  assert.equal(momentoDellAccensione(sera({ notte: true })).mostra, false);
  /* Dopo la mezzanotte e' mattina, anche se e' buio. */
  assert.equal(
    momentoDellAccensione(sera({ fase: "notte", mattina: true, adesso: d(2026, 12, 21, 0, 30) }))
      .mostra,
    false,
  );
  /* Di giorno e all'alba no. */
  assert.equal(momentoDellAccensione(sera({ fase: "giorno" })).mostra, false);
  assert.equal(momentoDellAccensione(sera({ fase: "alba", mattina: true })).mostra, false);
  /* Le luci che si spengono, o che restano accese, non sono un'accensione. */
  assert.equal(momentoDellAccensione(sera({ prima: 3, accese: 0 })).mostra, false);
  assert.equal(momentoDellAccensione(sera({ prima: 2, accese: 3 })).mostra, false);
  assert.equal(momentoDellAccensione(sera({ prima: 0, accese: 0 })).mostra, false);
});

test("niente momento senza sapere com'erano, col tablet sveglio, o senza la scena delle luci", () => {
  /* Al primo giro (o con gli stati non ancora arrivati) non si sa com'erano. */
  assert.equal(momentoDellAccensione(sera({ prima: null })).mostra, false);
  assert.equal(momentoDellAccensione(sera({ note: 0 })).mostra, false);
  /* Sveglio: chi guarda le vede gia'. */
  assert.equal(momentoDellAccensione(sera({ riposo: false })).mostra, false);
  /* Il riposo che non mostra la scena delle luci (il conto, i fuochi, o
   * nessuna luce configurata). */
  assert.equal(momentoDellAccensione(sera({ conLeLuci: false })).mostra, false);
  assert.equal(momentoDellAccensione().mostra, false);
});

test("la sera si ricorda col giorno di calendario", () => {
  assert.equal(seraDi(d(2026, 12, 20, 17, 0)), "2026-12-20");
  assert.equal(seraDi(d(2027, 1, 2, 23, 59)), "2027-01-02");
  assert.equal(seraDi("non e' una data"), "");
});

/* ── il tocco che non sveglia ───────────────────────────────────────────── */

test("«Spegni tutte» sul riposo non sveglia; il resto del riposo si'", () => {
  assert.deepEqual([...TOCCHI_CHE_NON_SVEGLIANO], ["luci-quiete"]);
  assert.equal(ilToccoSveglia({ riposo: true, fa: "luci-quiete" }), false);
  assert.equal(ilToccoSveglia({ riposo: true, fa: "sveglia" }), true);
  assert.equal(ilToccoSveglia({ riposo: true, fa: "" }), true);
  assert.equal(ilToccoSveglia({ riposo: true }), true);
  /* Sveglio, ogni tocco e' un tocco: tiene lontano il riposo. */
  assert.equal(ilToccoSveglia({ riposo: false, fa: "luci-quiete" }), true);
  assert.equal(ilToccoSveglia({ riposo: false, fa: "luci-tutte" }), true);
  assert.equal(ilToccoSveglia(), true);
});

/* ── il riposo e i tocchi, nel disegno ──────────────────────────────────── */

test("il riposo della Vigilia con le luci: la scena al posto della baita, e «Spegni tutte» solo se c'e' qualcosa acceso", async () => {
  const { riposoDellaVigilia } = await import("../src/sections/feste-al-muro.js");
  const cose = (feste, stato) => ({
    ora: "17:00",
    lungo: "domenica 20 dicembre",
    feste,
    states: { "switch.presa_albero": { state: stato } },
    deriva: { x: 0, y: 0 },
  });
  const adesso = d(2026, 12, 20, 17, 0);
  const accese = riposoDellaVigilia(cose({ luci: ["switch.presa_albero"] }, "on"), adesso);
  assert.match(accese, /data-mu-scena="luci"/);
  assert.match(accese, /data-mu-luci-scena="riposo"/);
  assert.doesNotMatch(accese, /data-mu-feste="vigilia/);
  assert.match(accese, /data-mu-fa="luci-quiete"/);
  /* Il resto del riposo sveglia come sempre. */
  assert.match(accese, /class="mu-riposo[^"]*" data-mu-fa="sveglia"/);
  const spente = riposoDellaVigilia(cose({ luci: ["switch.presa_albero"] }, "off"), adesso);
  assert.doesNotMatch(spente, /luci-quiete/);
  /* Il momento dell'accensione: l'orologio si fa da parte. */
  assert.match(
    riposoDellaVigilia({ ...cose({ luci: ["switch.presa_albero"] }, "on"), momento: true }, adesso),
    /mu-luci-momento/,
  );
  /* Senza luci, la Vigilia di sempre con le sue tele. */
  const sempre = riposoDellaVigilia(cose(null, "on"), adesso);
  assert.match(sempre, /data-mu-scena="vigilia"/);
  assert.match(sempre, /<canvas class="mu-feste-fondo" data-mu-feste="vigilia"/);
  assert.doesNotMatch(sempre, /luci-quiete|data-mu-luci-scena|mu-luci-momento/);
});

test("i tocchi sulle luci del muro: spegni tutte, accendi tutte, una cosa della scena", async () => {
  const { chiamateDelToccoAlMuro, scenaDaTenere } =
    await import("../src/sections/le-luci-al-muro.js");
  const config = festePulite({ luci: ["switch.presa_albero", "light.presepe"] });
  const stati = { "switch.presa_albero": { state: "on" }, "light.presepe": { state: "off" } };
  const tasto = (dataset) => ({ dataset });
  assert.deepEqual(chiamateDelToccoAlMuro(tasto({ muFa: "luci-quiete" }), config, stati), [
    { domain: "switch", service: "turn_off", data: { entity_id: ["switch.presa_albero"] } },
    { domain: "light", service: "turn_off", data: { entity_id: ["light.presepe"] } },
  ]);
  assert.deepEqual(
    chiamateDelToccoAlMuro(tasto({ muFa: "luci-tutte", muVerso: "turn_on" }), config, stati).map(
      (c) => c.service,
    ),
    ["turn_on", "turn_on"],
  );
  /* L'albero acceso si spegne; il presepe spento si accende. */
  assert.deepEqual(
    chiamateDelToccoAlMuro(tasto({ festeEntita: "switch.presa_albero" }), config, stati),
    [{ domain: "switch", service: "turn_off", data: { entity_id: ["switch.presa_albero"] } }],
  );
  assert.equal(
    chiamateDelToccoAlMuro(tasto({ festeEntita: "light.presepe" }), config, stati)[0].service,
    "turn_on",
  );
  assert.equal(chiamateDelToccoAlMuro(tasto({ muFa: "sveglia" }), config, stati), null);
  /* Nel ridisegno, il contenitore della scena resta col suo disegno. */
  const nodo = (muLuciScena) => ({ dataset: { muLuciScena } });
  assert.equal(scenaDaTenere(nodo("riposo"), nodo("riposo")), true);
  assert.equal(scenaDaTenere(nodo("riposo"), nodo("fascia")), false);
  assert.equal(scenaDaTenere({ dataset: {} }, { dataset: {} }), false);
});

/* ── quale riposo nelle feste, e la neve ────────────────────────────────── */

test("nelle feste: le foto di chi le ha scelte restano; orologio e cielo diventano la scena", () => {
  const vigilia = momentoDelMuro(d(2026, 12, 20, 17, 0));
  const scelto = (stile, foto) => stileDelRiposo({ stile }, foto);
  /* La cornice con delle foto resta la cornice, con o senza luci. */
  assert.equal(
    riposoDelleFeste({ momento: vigilia, stile: scelto("foto", 3), config: conLuci }),
    "cornice",
  );
  assert.equal(
    riposoDelleFeste({ momento: vigilia, stile: scelto("foto", 3), config: senzaLuci }),
    "cornice",
  );
  /* La cornice senza foto e' il cielo: allora la scena. */
  assert.equal(
    riposoDelleFeste({ momento: vigilia, stile: scelto("foto", 0), config: conLuci }),
    "luci",
  );
  /* L'orologio e il cielo: la scena delle luci, o la Vigilia senza luci. */
  for (const stile of ["orologio", "cielo"]) {
    assert.equal(
      riposoDelleFeste({ momento: vigilia, stile: scelto(stile, 3), config: conLuci }),
      "luci",
    );
    assert.equal(
      riposoDelleFeste({ momento: vigilia, stile: scelto(stile, 3), config: senzaLuci }),
      "vigilia",
    );
  }
  /* Il conto e i fuochi passano sopra anche alle foto. */
  for (const quando of [d(2026, 12, 31, 23, 59, 50), d(2027, 1, 1, 0, 0, 30)]) {
    const momento = momentoDelMuro(quando);
    assert.equal(riposoDelleFeste({ momento, stile: scelto("foto", 3), config: conLuci }), momento);
  }
  /* Fuori, il riposo di tutto l'anno. */
  assert.equal(
    riposoDelleFeste({
      momento: momentoDelMuro(d(2026, 11, 23, 17, 0)),
      stile: "foto",
      config: conLuci,
    }),
    "",
  );
});

test("la neve del riposo e' leggera: poche decine di fiocchi", () => {
  assert.ok(fiocchiSulRiposo(1280) >= 20 && fiocchiSulRiposo(1280) <= 80);
  assert.ok(fiocchiSulRiposo(480) < fiocchiSulRiposo(1280));
});

test("la cornice nelle feste: le foto restano, sopra la neve, gli auguri e «Spegni tutte»", async () => {
  const { festaSullaCornice } = await import("../src/sections/feste-al-muro.js");
  const { riposoDellaCornice } = await import("../src/sections/il-riposo-vivo-al-muro.js");
  const states = { "switch.presa_albero": { state: "on" } };
  const feste = { luci: ["switch.presa_albero"] };
  const base = { ora: "17:00", lungo: "domenica 20 dicembre", foto: ["fotofinta0000001"] };
  const festa = festaSullaCornice({ feste, states });
  const cornice = riposoDellaCornice({ ...base, festa });
  assert.match(cornice, /data-mu-vivo="cornice"/);
  assert.match(cornice, /data-mu-scena="foto"/);
  assert.match(cornice, /data-mu-feste="neve"/);
  assert.match(cornice, /mu-cornice-feste[^>]*>[^<]+<\/div>\s*<div class="mu-cornice-ora"/);
  assert.match(cornice, /data-mu-fa="luci-quiete"/);
  /* Di notte al minimo niente neve; senza luci niente tasto. */
  assert.doesNotMatch(
    riposoDellaCornice({ ...base, festa: festaSullaCornice({ feste, states, minimo: true }) }),
    /data-mu-feste="neve"/,
  );
  assert.doesNotMatch(
    riposoDellaCornice({ ...base, festa: festaSullaCornice({ feste: null, states }) }),
    /luci-quiete/,
  );
  /* Fuori dalle feste la cornice e' quella di sempre. */
  const sempre = riposoDellaCornice(base);
  assert.doesNotMatch(sempre, /data-mu-scena|data-mu-feste|mu-cornice-feste|luci-quiete/);
});

test("sulla scena delle luci nevica; sulla scena fioca della notte no", async () => {
  const { riposoDellaVigilia } = await import("../src/sections/feste-al-muro.js");
  const cose = {
    ora: "17:00",
    lungo: "domenica",
    feste: { luci: ["switch.presa_albero"] },
    states: {},
    deriva: { x: 0, y: 0 },
  };
  assert.match(riposoDellaVigilia(cose, d(2026, 12, 20, 17)), /data-mu-feste="neve"/);
  assert.doesNotMatch(
    riposoDellaVigilia({ ...cose, fioco: true }, d(2026, 12, 20, 23)),
    /data-mu-feste="neve"/,
  );
});
