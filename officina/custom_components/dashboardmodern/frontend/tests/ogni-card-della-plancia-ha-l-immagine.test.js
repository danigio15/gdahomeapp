/* «Lo devi aggiungere a tutti la possibilita' di inserire immagini o
 * disegni, altrimenti e' inutile.»
 *
 * Il guardiano delle card della plancia. Ogni elenco di cose che la plancia
 * disegna come card (le sezioni del deposito, `SECTION_KEYS`) deve stare fra
 * le superfici con l'immagine (`core/superfici-con-immagine.js`), o dire qui
 * sotto perche' no. Una sezione nuova che arriva senza fa cadere la prova.
 *
 * E per ognuna: l'immagine passa la normalizzazione della sua sezione — una
 * di casa resta, una che non e' di casa se ne va — e la card della pagina
 * trova la sua voce. */
import assert from "node:assert/strict";
import test from "node:test";

import { conLeImmaginiDiPrima } from "../src/core/dashboard-store.js";
import { rigaPulita } from "../src/core/elenco-dichiarato.js";
import { SECTION_KEYS, normalizeSection } from "../src/core/migrations.js";
import {
  CHIAVE_DELLE_IMMAGINI,
  PAGINE_CON_IMMAGINI,
  SUPERFICI_CON_IMMAGINE,
  SUPERFICI_DA_VESTIRE,
  conLImmagineSciolta,
  immaginiSciolte,
  voceDellaCard,
} from "../src/core/superfici-con-immagine.js";

const IMMAGINE = Object.freeze({ src: "disegno:prato", fuoco: [50, 50], zoom: 1 });

/* L'unica sezione che non fa card: le entita' scelte per le caselle fisse
 * (le misure dell'energia, la centrale), che si vedono nelle card degli
 * altri. Tutto il resto ha la sua immagine — «senza eccezioni». */
const NON_SONO_CARD = Object.freeze({
  entityOverrides: "le entita' scelte per le caselle fisse: non sono card",
});

test("ogni sezione che fa card ha la sua superficie con l'immagine", () => {
  const coperte = new Set(
    SUPERFICI_CON_IMMAGINE.flatMap((s) => [s.sezione, s.casella, ...(s.copre || [])]),
  );
  for (const [sezione, casella] of Object.entries(SECTION_KEYS)) {
    if (NON_SONO_CARD[sezione]) continue;
    assert.ok(
      coperte.has(sezione) || coperte.has(casella),
      `la sezione «${sezione}» fa card ma non ha l'immagine: aggiungila a superfici-con-immagine.js`,
    );
  }
  for (const s of SUPERFICI_DA_VESTIRE) {
    assert.ok(s.selettore, s.chiave);
    assert.ok(s.pagine?.length, `${s.chiave}: in che pagina stanno le sue card?`);
    assert.ok(s.nome.it && s.nome.en, s.chiave);
  }
  for (const id of PAGINE_CON_IMMAGINI) assert.match(id, /^page-[a-z-]+$/);
});

test("l'immagine passa la normalizzazione di ogni sezione, solo se e' di casa", () => {
  for (const s of SUPERFICI_CON_IMMAGINE.filter((x) => x.sezione && !x.propria)) {
    const voce = { id: "x1", name: "Cosa", entity: "switch.cosa", immagine: IMMAGINE };
    const [buona] = normalizeSection(s.sezione, [voce]);
    assert.deepEqual(buona.immagine, IMMAGINE, s.sezione);
    const [fuori] = normalizeSection(s.sezione, [
      { ...voce, immagine: { src: "https://x.example/a.png" } },
    ]);
    assert.ok(!fuori.immagine || !String(fuori.immagine.src).startsWith("https:"), s.sezione);
  }
  /* Gli elenchi dichiarati (varchi, presenza…): la riga tiene la sua. */
  assert.deepEqual(
    rigaPulita({ entity: "binary_sensor.porta", immagine: IMMAGINE }).immagine,
    IMMAGINE,
  );
  assert.equal(
    "immagine" in rigaPulita({ entity: "binary_sensor.porta", immagine: { src: "/x" } }),
    false,
  );
});

test("un editor del guscio che riscrive la sua chiave non porta via l'immagine", () => {
  const prima = [{ id: "c1", entity: "cover.sala", immagine: IMMAGINE }];
  const dopo = conLeImmaginiDiPrima([{ id: "c1", entity: "cover.sala", name: "Sala" }], prima);
  assert.deepEqual(dopo[0].immagine, IMMAGINE);
  /* Per entita', quando l'id e' cambiato. */
  assert.deepEqual(
    conLeImmaginiDiPrima([{ id: "nuovo", entity: "cover.sala" }], prima)[0].immagine,
    IMMAGINE,
  );
  /* Una cosa diversa non prende l'immagine di un'altra. */
  assert.equal(
    conLeImmaginiDiPrima([{ id: "c2", entity: "cover.cucina" }], prima)[0].immagine,
    undefined,
  );
});

test("ogni card trova la sua voce", () => {
  const card = (attributi) => ({ getAttribute: (nome) => attributi[nome] ?? null });
  const voci = {
    entity: [{ entity: "light.a" }, { entity: "light.b", immagine: IMMAGINE }],
    id: [{ id: "soggiorno", immagine: IMMAGINE }],
    indice: [{ name: "Uno" }, { name: "Due", immagine: IMMAGINE }],
  };
  /* Le card «mappa» leggono la casella delle immagini sciolte. */
  const sciolte = Object.fromEntries(
    SUPERFICI_DA_VESTIRE.filter((s) => s.forma === "mappa").map((s) => [
      `${s.chiave}:light.b`,
      IMMAGINE,
    ]),
  );
  voci.mappa = sciolte;
  for (const s of SUPERFICI_DA_VESTIRE) {
    const valore = s.chiaveDellaVoce === "id" ? "soggiorno" : "light.b";
    const attributi = Object.fromEntries((s.attributi || []).map((a) => [a, valore]));
    const trovata = voceDellaCard(s, voci[s.chiaveDellaVoce], card(attributi), 1);
    assert.deepEqual(trovata?.immagine, IMMAGINE, s.chiave);
  }
});

test("le immagini sciolte: solo «superficie:card» e immagini di casa", () => {
  assert.equal(CHIAVE_DELLE_IMMAGINI, "cd_immagini_riquadri");
  const pulite = immaginiSciolte({
    "energia:casa": IMMAGINE,
    "home:luci": { src: "https://x.example/a.png" },
    "senza-due-punti": IMMAGINE,
  });
  assert.deepEqual(Object.keys(pulite), ["energia:casa"]);
  const con = conLImmagineSciolta({}, "piscina", "p1", IMMAGINE);
  assert.deepEqual(con, { "piscina:p1": IMMAGINE });
  assert.deepEqual(conLImmagineSciolta(con, "piscina", "p1", null), {});
});
