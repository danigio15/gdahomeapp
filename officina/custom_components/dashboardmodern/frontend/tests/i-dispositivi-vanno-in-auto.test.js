/* I dispositivi che la plancia passa all'auto.
 *
 * La categoria dell'app in macchina è IOT, e le due cose che Google mette per
 * prime fra quelle che un'app così può fare guidando sono «vedere lo stato di
 * un dispositivo» e «accenderlo o spegnerlo con un tocco». Finché in auto
 * c'erano tre numeri del fotovoltaico e chi è in casa, non ce n'era nessuna
 * delle due: erano informazioni, non dispositivi.
 *
 * Questa è la metà della raccolta: da dove arrivano, e con che parola. Quali
 * entrano e in che ordine lo decide il nucleo, e ha le sue prove.
 *
 * La regola che tiene insieme tutto: **non si sceglie niente di nuovo.** Le
 * porte sono quelle di Sicurezza, i varchi quelli dei Varchi, le luci e le
 * prese quelle delle loro tessere — già scremate di quello che è nascosto in
 * Home. Una seconda scelta per l'auto sarebbe una seconda verità sulla stessa
 * casa.
 */
import assert from "node:assert/strict";
import test from "node:test";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { iDispositiviDiCasa } = await import("../src/sections/la-foto-va-in-auto-section.js");

const TESSERE = [
  { key: "porte", doors: [{ entity: "cover.cancello", name: "Cancello" }] },
  {
    key: "varchi",
    rows: [{ entity: "cover.finestra", name: "Finestra", on: true, value: "Aperto" }],
  },
  {
    key: "luci",
    rows: [
      { entity: "light.salone", name: "Salone", on: true, comando: true },
      { entity: "light.cantina", name: "Cantina", on: false, comando: true },
    ],
  },
  {
    key: "prese",
    rows: [{ entity: "switch.stufa", name: "Stufa", on: true, comando: true, value: "Accesa" }],
  },
];

const di = (elenco, entity) => elenco.find((uno) => uno.entity === entity);

test("arrivano dalle quattro tessere che parlano di cose che si aprono e si accendono", () => {
  const dentro = iDispositiviDiCasa(TESSERE, {});
  assert.deepEqual(
    dentro.map((uno) => `${uno.genere}:${uno.entity}`),
    [
      "porta:cover.cancello",
      "varco:cover.finestra",
      "luce:light.salone",
      "luce:light.cantina",
      "presa:switch.stufa",
    ],
  );
});

test("le porte stanno in «doors» e non in «rows», ed è lì che si vanno a prendere", () => {
  /* È come nasce quella tessera: qui si legge dove sono, non si cambia come è
   * fatta. Cercarle in `rows` vorrebbe dire nessuna porta in macchina, che è
   * proprio il tasto per cui uno prende il telefono arrivando. */
  assert.ok(di(iDispositiviDiCasa(TESSERE, {}), "cover.cancello"));
  assert.deepEqual(
    iDispositiviDiCasa([{ key: "porte", rows: [{ entity: "x.y", name: "X" }] }], {}),
    [],
  );
});

test("la parola della tessera vince su quella che scriveremmo noi", () => {
  /* Due parole diverse per lo stesso stato — una in macchina e una sul divano
   * — sono due stati per chi le legge. */
  const dentro = iDispositiviDiCasa(TESSERE, {});
  assert.equal(di(dentro, "cover.finestra").stato, "Aperto");
  assert.equal(di(dentro, "switch.stufa").stato, "Accesa");
});

test("dove la tessera non la scrive, la parola la fa il genere", () => {
  const dentro = iDispositiviDiCasa(TESSERE, {});
  assert.equal(di(dentro, "light.salone").stato, "Accesa");
  assert.equal(di(dentro, "light.cantina").stato, "Spenta");
  /* Una porta si apre e si chiude, non si accende. */
  assert.equal(di(dentro, "cover.cancello").stato, "Chiuso");
});

test("senza «on» si guarda lo stato grezzo, che è l'unica cosa che resta", () => {
  /* La tessera delle porte le righe non le marca. */
  const aperto = iDispositiviDiCasa(TESSERE, { "cover.cancello": { state: "open" } });
  assert.equal(di(aperto, "cover.cancello").acceso, true);
  assert.equal(di(aperto, "cover.cancello").stato, "Aperto");
  const chiuso = iDispositiviDiCasa(TESSERE, { "cover.cancello": { state: "closed" } });
  assert.equal(di(chiuso, "cover.cancello").acceso, false);
  /* E una serratura aperta è aperta come un cancello aperto. */
  const serratura = iDispositiviDiCasa(
    [{ key: "porte", doors: [{ entity: "lock.portone", name: "Portone" }] }],
    { "lock.portone": { state: "unlocked" } },
  );
  assert.equal(serratura[0].acceso, true);
});

test("«on» della tessera vince sullo stato grezzo: quel conto l'ha già fatto lei", () => {
  /* Un varco socchiuso, una tapparella a metà: la sezione sa cosa vuol dire
   * per lei, e rifare il conto qui vorrebbe dire due regole sulla stessa
   * cosa. */
  const dentro = iDispositiviDiCasa(TESSERE, { "cover.finestra": { state: "closed" } });
  assert.equal(di(dentro, "cover.finestra").acceso, true);
});

test("il «si vede ma non si comanda» viaggia com'è, senza essere inventato", () => {
  const dentro = iDispositiviDiCasa(
    [{ key: "luci", rows: [{ entity: "light.a", name: "A", on: true, comando: false }] }],
    {},
  );
  assert.equal(dentro[0].comando, false);
  /* Dove la tessera non si pronuncia non si mette un `true` di comodo: a
   * decidere è il nucleo, che sa se quel genere si commuta al buio. */
  assert.equal(iDispositiviDiCasa(TESSERE, {})[0].comando, undefined);
});

test("una riga senza entità non diventa un tasto muto", () => {
  assert.deepEqual(
    iDispositiviDiCasa([{ key: "luci", rows: [{ name: "Senza entità", on: true }] }], {}),
    [],
  );
});

test("le tessere che non ci sono non fanno cadere niente", () => {
  assert.deepEqual(iDispositiviDiCasa([], {}), []);
  assert.deepEqual(iDispositiviDiCasa(null, {}), []);
  assert.deepEqual(iDispositiviDiCasa([{ key: "luci" }], {}), []);
  assert.deepEqual(iDispositiviDiCasa([{ key: "luci", rows: "boh" }], {}), []);
});

test("una tessera col suffisso si trova lo stesso", () => {
  /* Due contatori vogliono dire `energia` ed `energia_zona_notte`, e la stessa
   * regola vale per le altre: si cerca il prefisso, non il nome esatto. */
  const dentro = iDispositiviDiCasa(
    [{ key: "luci_piano_di_sopra", rows: [{ entity: "light.a", name: "A", on: true }] }],
    {},
  );
  assert.equal(dentro.length, 1);
  assert.equal(dentro[0].genere, "luce");
});
