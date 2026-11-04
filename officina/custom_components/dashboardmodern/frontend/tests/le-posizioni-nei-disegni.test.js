/* I pezzi che si spostano dentro i disegni (`cd_disegni`): i conti.
 *
 * «Vedi come poter spostare le cose anche nei disegni, tipo i tubi nel solare
 * termico.» Qui si tiene fermo che senza una scelta il disegno e' quello di
 * sempre (lo stesso oggetto: niente si ridisegna), che una scelta letta da
 * fuori si rimette in forma, che computer e telefono hanno due scelte che si
 * fondono una per una fra dispositivi, e che i tubi ridisegnati vanno da una
 * porta all'altra passando per i pezzi che attraversano.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CHIAVE_DISEGNI,
  PASSO,
  allaGriglia,
  allinea,
  casellaDel,
  conLePosizioni,
  curvaFraCerchi,
  disegniPuliti,
  firmaDellePosizioni,
  limita,
  posizioniDi,
  postoLibero,
  rettangolo,
  senzaIlDisegno,
  spezzataDelTubo,
  spingi,
  stessePosizioni,
  tuboIsometrico,
  tuboOrtogonale,
} from "../src/core/posizioni-nei-disegni.js";
import {
  CENTRI,
  LANDSCAPE,
  PLACES,
  PORTE,
  PORTRAIT,
  TUBI,
  centroInPercento,
  layoutConLePosizioni,
  nodiDelLayout,
} from "../src/core/il-disegno-del-solare.js";
import { CONFIG_KEYS, CONFIG_KEYS_REVISION } from "../src/core/chiavi-di-configurazione.js";
import { CHIAVI_A_CASELLE, fondiLeCaselle } from "../src/sections/config-persistence-section.js";

test("la casella viaggia col ponte, si fonde a caselle, e la revisione lo dice", () => {
  assert.equal(CHIAVE_DISEGNI, "cd_disegni");
  assert.ok(CONFIG_KEYS.includes(CHIAVE_DISEGNI));
  assert.ok(CHIAVI_A_CASELLE.includes(CHIAVE_DISEGNI));
  assert.ok(CONFIG_KEYS_REVISION >= 77);
});

test("senza scelta il disegno e' lo stesso oggetto, pixel per pixel", () => {
  for (const base of [LANDSCAPE, PORTRAIT]) {
    assert.equal(layoutConLePosizioni(base, {}), base);
    assert.equal(layoutConLePosizioni(base, null), base);
    assert.equal(layoutConLePosizioni(base, undefined), base);
    /* Un pezzo rimesso dove sta di serie non e' uno spostamento. */
    const serie = Object.fromEntries(
      nodiDelLayout(base).map((id) => [id, centroInPercento(base, id)]),
    );
    assert.equal(layoutConLePosizioni(base, serie), base);
    /* I pezzi che il disegno non ha non contano. */
    assert.equal(layoutConLePosizioni(base, { nessuno: { x: 10, y: 10 } }), base);
  }
  /* Il telefono non ha il rubinetto. */
  assert.equal(layoutConLePosizioni(PORTRAIT, { rubinetto: { x: 10, y: 10 } }), PORTRAIT);
});

test("le curve fatte a mano restano quelle di prima", () => {
  /* Le geometrie stanno in core/ adesso: le stesse di quando erano scritte
   * nella sezione. */
  assert.equal(
    LANDSCAPE.routes["flow-sol-hot"],
    "M 378 116 C 470 116, 520 116, 560 130 C 600 144, 608 168, 625 168",
  );
  assert.equal(
    PORTRAIT.routes["flow-ricircolo"],
    "M 270 300 L 340 300 C 364 300, 374 310, 374 334 L 374 396 C 374 420, 364 430, 340 430 L 270 430",
  );
  assert.deepEqual(PLACES.landscape.pump, [400, 372]);
  assert.deepEqual(PLACES.portrait.valve, [352, 150]);
  assert.ok(Object.isFrozen(LANDSCAPE) && Object.isFrozen(PORTRAIT));
});

test("si ridisegnano solo i tubi che toccano un pezzo spostato", () => {
  const pompa = centroInPercento(LANDSCAPE, "pompa");
  const L = layoutConLePosizioni(LANDSCAPE, { pompa: { x: pompa.x - 10, y: pompa.y } });
  assert.notEqual(L, LANDSCAPE);
  assert.equal(L.routes["flow-sol-hot"], LANDSCAPE.routes["flow-sol-hot"]);
  assert.equal(L.routes["flow-ricircolo"], LANDSCAPE.routes["flow-ricircolo"]);
  assert.notEqual(L.routes["flow-sol-cold"], LANDSCAPE.routes["flow-sol-cold"]);
  /* Il tubo freddo parte sempre dall'accumulo e arriva al collettore. */
  assert.match(L.routes["flow-sol-cold"], /^M 625 330 /);
  assert.match(L.routes["flow-sol-cold"], / L 130 300$/);
  /* Passa per la pompa dove adesso sta. */
  const x = (pompa.x - 10) * 11;
  assert.ok(L.routes["flow-sol-cold"].includes(" 372"), L.routes["flow-sol-cold"]);
  assert.deepEqual(L.places.pump, [Math.round(x * 10) / 10, 372]);
  assert.deepEqual(L.spostati, { pompa: [-110, 0] });
  /* I pezzi HTML che non si sono mossi hanno il posto di prima. */
  assert.equal(L.places.valve, PLACES.landscape.valve);
});

test("l'accumulo spostato si porta dietro le etichette e tutti i suoi tubi", () => {
  const L = layoutConLePosizioni(PORTRAIT, { accumulo: { x: 60, y: 60 } });
  const [dx, dy] = L.spostati.accumulo;
  assert.equal(dx, 240 - 222);
  assert.equal(dy, 360 - 346);
  for (const id of Object.keys(TUBI.portrait)) assert.notEqual(L.routes[id], PORTRAIT.routes[id]);
  assert.deepEqual(L.places.chipAlto, [28 + dx, 268 + dy]);
  assert.deepEqual(L.places.tankNode, [274 + dx, 264 + dy]);
  /* Il tubo caldo arriva in cima all'accumulo, dall'alto. */
  const [px, py] = PORTE.portrait.accumulo.caldo.p;
  assert.ok(
    L.routes["flow-sol-hot"].endsWith(` L ${px + dx} ${py + dy}`),
    L.routes["flow-sol-hot"],
  );
  assert.match(L.firma, /^accumulo:60,60$/);
});

test("un tubo ridisegnato: tratti diritti, angoli tondi, attraverso i pezzi", () => {
  const punti = spezzataDelTubo(
    [
      { p: [0, 0], verso: "e" },
      { p: [100, 50], asse: "h" },
      { p: [200, 100], verso: "w" },
    ],
    { uscita: 10 },
  );
  /* Ogni tratto e' orizzontale o verticale. */
  for (let i = 1; i < punti.length; i += 1) {
    const [a, b] = [punti[i - 1], punti[i]];
    assert.ok(a[0] === b[0] || a[1] === b[1], `tratto storto ${a} → ${b}`);
  }
  assert.deepEqual(punti[0], [0, 0]);
  assert.deepEqual(punti.at(-1), [200, 100]);
  /* La pompa e' sulla strada, su un tratto orizzontale. */
  const sopra = punti.some(
    (a, i) =>
      i > 0 &&
      a[1] === 50 &&
      punti[i - 1][1] === 50 &&
      Math.min(a[0], punti[i - 1][0]) <= 100 &&
      Math.max(a[0], punti[i - 1][0]) >= 100,
  );
  assert.ok(sopra, JSON.stringify(punti));
  const d = tuboOrtogonale(
    [
      { p: [0, 0], verso: "e" },
      { p: [200, 100], verso: "w" },
    ],
    { raggio: 12 },
  );
  assert.match(d, /^M 0 0 L /);
  assert.match(d, / Q /);
  assert.match(d, / L 200 100$/);
});

test("un tubo che deve tornare indietro gira intorno, non si sovrappone", () => {
  /* Esce a destra verso una porta che sta a sinistra e guarda a sinistra. */
  const punti = spezzataDelTubo([
    { p: [100, 0], verso: "e" },
    { p: [0, 100], verso: "w" },
  ]);
  for (let i = 1; i < punti.length; i += 1) {
    const [a, b] = [punti[i - 1], punti[i]];
    assert.ok(a[0] === b[0] || a[1] === b[1]);
  }
  /* Esce davvero verso destra, ed entra davvero da sinistra. */
  assert.ok(punti[1][0] > 100);
  assert.ok(punti.at(-2)[0] < 0);
});

test("il rubinetto: il tubo ci entra da un lato ed esce verso il basso", () => {
  const punti = spezzataDelTubo([
    { p: [0, 0], verso: "e" },
    { p: [100, 0], entra: "w", esce: "s" },
    { p: [0, 100], verso: "e" },
  ]);
  const i = punti.findIndex(([x, y]) => x === 100 && y === 0);
  assert.ok(i > 0);
  assert.equal(punti[i + 1][0], 100);
  assert.ok(punti[i + 1][1] > 0);
});

test("il tubo isometrico e la curva fra due cerchi", () => {
  const d = tuboIsometrico([
    { p: [0, 0], verso: "e" },
    { p: [200, 40], verso: "w" },
  ]);
  assert.match(d, /^M 0 0 /);
  assert.match(d, / L 200 40$/);
  const curva = curvaFraCerchi([0, 0], 10, [100, 0], 20);
  assert.match(curva, /^M 10 0 C /);
  assert.match(curva, /, 80 0$/);
  assert.equal(curvaFraCerchi([0, 0], 30, [40, 0], 20), "");
});

test("la casella letta da fuori si rimette in forma", () => {
  const sporca = {
    "solare:computer": {
      pompa: { x: 30, y: 140 },
      valvola: { x: "10", y: 2 },
      "<b>": { x: 1, y: 1 },
      accumulo: { x: -5, y: 50.12345 },
    },
    "solare:tablet": { pompa: { x: 1, y: 1 } },
    "solare:telefono": {},
    "solare:telefono:altro": { pompa: { x: 1, y: 1 } },
    "": { pompa: { x: 1, y: 1 } },
    energia: "no",
  };
  assert.deepEqual(disegniPuliti(sporca), {
    "solare:computer": { pompa: { x: 30, y: 100 }, accumulo: { x: 0, y: 50.123 } },
  });
  assert.deepEqual(disegniPuliti(null), {});
  assert.deepEqual(disegniPuliti([1, 2]), {});
  assert.deepEqual(posizioniDi(sporca, "solare", "telefono"), {});
  assert.deepEqual(posizioniDi(sporca, "solare", "computer"), {
    pompa: { x: 30, y: 100 },
    accumulo: { x: 0, y: 50.123 },
  });
});

test("computer e telefono: due scelte, due caselle", () => {
  let tutta = conLePosizioni({}, "solare", "computer", { pompa: { x: 20, y: 80 } });
  tutta = conLePosizioni(tutta, "solare", "telefono", { pompa: { x: 40, y: 70 } });
  assert.deepEqual(Object.keys(tutta).sort(), [
    casellaDel("solare", "computer"),
    casellaDel("solare", "telefono"),
  ]);
  /* Ripristina il disegno del telefono: il computer resta. */
  const senza = senzaIlDisegno(tutta, "solare", "telefono");
  assert.deepEqual(Object.keys(senza), ["solare:computer"]);
  assert.deepEqual(senzaIlDisegno(tutta, "solare"), {});
  /* Una scelta vuota non si scrive. */
  assert.deepEqual(conLePosizioni({}, "solare", "computer", {}), {});
  /* Una variante che non esiste non si scrive. */
  assert.deepEqual(conLePosizioni({}, "solare", "tablet", { pompa: { x: 1, y: 1 } }), {});
});

test("fra due dispositivi le varianti si fondono una per una", () => {
  const base = { "solare:computer": { pompa: { x: 20, y: 80 } } };
  /* Il telefono ha spostato il suo disegno; il computer, nel frattempo, il
   * suo. Nessuno dei due perde quello dell'altro. */
  const dalTelefono = { ...base, "solare:telefono": { pompa: { x: 40, y: 70 } } };
  const dalComputer = { "solare:computer": { pompa: { x: 25, y: 80 } } };
  const fusa = JSON.parse(
    fondiLeCaselle(JSON.stringify(dalComputer), JSON.stringify(dalTelefono), JSON.stringify(base)),
  );
  assert.deepEqual(fusa, {
    "solare:computer": { pompa: { x: 25, y: 80 } },
    "solare:telefono": { pompa: { x: 40, y: 70 } },
  });
});

test("la griglia, l'allineamento con le guide e il limite del disegno", () => {
  assert.equal(PASSO, 2.5);
  assert.equal(allaGriglia(11.2), 10);
  assert.equal(allaGriglia(11.3), 12.5);
  /* Vicino a un altro pezzo ci si allinea a lui, e la guida lo dice. */
  const a = allinea({ x: 31.1, y: 60.7 }, [
    { x: 30.4, y: 10 },
    { x: 80, y: 60 },
  ]);
  assert.deepEqual([a.x, a.y], [30.4, 60]);
  assert.deepEqual(a.guide, [
    { asse: "x", valore: 30.4 },
    { asse: "y", valore: 60 },
  ]);
  /* Lontano da tutti: la griglia, senza guide. */
  const b = allinea({ x: 51.1, y: 41.4 }, [{ x: 10, y: 10 }]);
  assert.deepEqual([b.x, b.y, b.guide.length], [50, 42.5, 0]);
  /* Il pezzo non esce dal disegno, con le sue etichette. */
  assert.deepEqual(limita({ x: 2, y: 99 }, { sinistra: 10, destra: 5, sopra: 3, sotto: 8 }), {
    x: 10,
    y: 92,
  });
  /* Piu' grande del disegno: sta in mezzo. */
  assert.equal(limita({ x: 2, y: 50 }, { sinistra: 60, destra: 60 }).x, 50);
});

test("le frecce spostano alla riga seguente della griglia, Maiusc a passi fini", () => {
  assert.deepEqual(spingi({ x: 10, y: 10 }, "ArrowRight"), { x: 12.5, y: 10 });
  assert.deepEqual(spingi({ x: 11, y: 10 }, "ArrowRight"), { x: 12.5, y: 10 });
  assert.deepEqual(spingi({ x: 11, y: 10 }, "ArrowLeft"), { x: 10, y: 10 });
  assert.deepEqual(spingi({ x: 10, y: 10 }, "ArrowUp"), { x: 10, y: 7.5 });
  assert.deepEqual(spingi({ x: 10, y: 10 }, "ArrowDown", { fine: true }), { x: 10, y: 10.5 });
  assert.deepEqual(spingi({ x: 0, y: 0 }, "ArrowLeft"), { x: 0, y: 0 });
  assert.equal(spingi({ x: 10, y: 10 }, "Enter"), null);
});

test("lasciato sopra un altro pezzo, va al posto libero piu' vicino", () => {
  const ingombro = { sinistra: 5, destra: 5, sopra: 5, sotto: 5 };
  const occupato = rettangolo({ x: 50, y: 50 }, ingombro);
  const p = postoLibero({ x: 52, y: 50 }, ingombro, [occupato]);
  assert.ok(Math.abs(p.x - 50) >= 10 || Math.abs(p.y - 50) >= 10, JSON.stringify(p));
  assert.ok(Math.hypot(p.x - 52, p.y - 50) <= 12);
  /* Libero: resta dove l'ha lasciato. */
  assert.deepEqual(postoLibero({ x: 20, y: 20 }, ingombro, [occupato]), { x: 20, y: 20 });
});

test("la firma: uguale per due scelte uguali, vuota senza scelta", () => {
  assert.equal(firmaDellePosizioni({}), "");
  assert.equal(firmaDellePosizioni({ b: { x: 1, y: 2 }, a: { x: 3, y: 4 } }), "a:3,4;b:1,2");
  assert.ok(stessePosizioni({ a: { x: 1, y: 2 } }, { a: { x: 1, y: 2.0001 } }));
  assert.ok(!stessePosizioni({ a: { x: 1, y: 2 } }, {}));
});

test("ogni pezzo del solare ha un centro dentro il disegno e le sue porte", () => {
  for (const base of [LANDSCAPE, PORTRAIT]) {
    for (const [nodo, [x, y]] of Object.entries(CENTRI[base.name])) {
      assert.ok(x > 0 && x < base.w && y > 0 && y < base.h, nodo);
      assert.ok(PORTE[base.name][nodo], nodo);
    }
    for (const tappe of Object.values(TUBI[base.name]))
      for (const [nodo, porta] of tappe) {
        assert.ok(CENTRI[base.name][nodo], nodo);
        if (porta) assert.ok(PORTE[base.name][nodo][porta]?.verso, `${nodo}.${porta}`);
      }
  }
});
