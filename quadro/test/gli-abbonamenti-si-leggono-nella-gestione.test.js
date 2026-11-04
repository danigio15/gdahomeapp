/* La schermata «Abbonamenti» della Gestione gdahome (1.10.0).
 *
 * «Nella sezione Gestione gdahome creami un'altra parte dove mi devi dire
 * quanti abbonamenti fatti su Apple e su Play Store, se sono mensili o annuali
 * e quanti nel periodo di prova.» I conti li fa il quadro e li provano le
 * prove delle licenze (`le-licenze.test.js`, «Gli abbonamenti»); questa tiene
 * ferma la pagina: la voce nella barra, da dove prende i numeri, e le cose
 * che deve dire a chi la legge.
 *
 * ─── Una categoria sola per abbonamento ──────────────────────────────────
 *
 * La prima versione diceva «Attivi 2 · In prova gratuita 2 · Disdetti 1» con
 * due abbonamenti in tutto: le prove e i disdetti stavano anche fra gli
 * attivi, e non si capiva chi avesse pagato. Adesso ognuno sta in un posto
 * solo — paganti, in prova gratuita, disdetti, finiti, acquisti di test — e
 * gli stessi nomi e numeri tornano nei riquadri, nel conto, nelle linguette e
 * nelle righe. Queste prove ritagliano `gliAbbonamenti()` dalla pagina e la
 * fanno girare con i dati che le manderebbe il quadro: si controlla quello
 * che ne esce, non le lettere del programma.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { contaGliAbbonamenti } from "../src/licenze.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const GESTORE = readFileSync(join(QUI, "..", "gestore", "index.html"), "utf8");

/* La voce delle licenze si chiama «Regali e codici» dalla Gestione a sezioni:
 * dentro ci sono i regali e i codici, e quello che si compra sta qui accanto,
 * in «Abbonamenti». */
test("la voce «Abbonamenti» sta nella barra, dopo «Regali e codici»", () => {
  assert.match(
    GESTORE,
    /\["licenze", "Regali e codici", 0\],\s*\["abbonamenti", "Abbonamenti", 0\],/,
  );
  assert.match(GESTORE, /abbonamenti:\s*'<svg/);
  assert.match(GESTORE, /schermata === "abbonamenti"\s*\? gliAbbonamenti\(\)/);
});

test("i numeri vengono dal quadro, e se non arrivano si tiene quello che c'era", () => {
  assert.match(GESTORE, /ABBONAMENTI = await chiedi\("\/abbonamenti"\);/);
  assert.match(GESTORE, /<b>Gli abbonamenti non sono arrivati<\/b>/);
});

test("le date si scrivono in italiano: «l'8 ott», «dall'1 nov»", () => {
  assert.match(GESTORE, /const elisa = giorno === 1 \|\| giorno === 8 \|\| giorno === 11;/);
  assert.match(GESTORE, /dal: \["dal ", "dall'"\]/);
});

/* ─── La pagina, fatta girare ─────────────────────────────────────────── */

/* Il pezzo che comincia con `apre` e finisce quando le graffe tornano a pari. */
function ritaglia(apre) {
  const da = GESTORE.indexOf(apre);
  assert.ok(da >= 0, `nella pagina non c'e' piu' «${apre}»`);
  const primaGraffa = GESTORE.indexOf("{", da);
  let profondita = 0;
  for (let i = primaGraffa; i < GESTORE.length; i += 1) {
    if (GESTORE[i] === "{") profondita += 1;
    else if (GESTORE[i] === "}") {
      profondita -= 1;
      if (profondita === 0) return GESTORE.slice(da, i + 1);
    }
  }
  throw new Error(`«${apre}» non si chiude`);
}

/* La pagina non si carica qui: si prende solo quello che serve alla scheda. */
function laFabbrica() {
  const pezzi = [
    "let ABBONAMENTI = null; let FILTRO_ABBONAMENTI = 'tutti';",
    "const CONTI = { nomi: new Map(), tutte: [] };",
    `const testo = (cosa) => String(cosa).replace(/[&<>"']/g, (uno) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[uno]);`,
    "const plurale = (quanti, uno, molti) => `${quanti} ${quanti === 1 ? uno : molti}`;",
    'const numero = (n) => new Intl.NumberFormat("it-IT").format(Number(n) || 0);',
    ritaglia("const LE_ICONE ="),
    ritaglia("const ilGiornoCorto ="),
    ritaglia("function conLArticolo"),
    ritaglia("function iSoldi"),
    ritaglia("function alMeseDetto"),
    ritaglia("function lIncassatoDetto"),
    ritaglia("function ilMeseDetto"),
    ritaglia("const LE_CATEGORIE_DEGLI_ABBONAMENTI ="),
    ritaglia("const I_FILTRI_DI_PRIMA ="),
    ritaglia("function laCategoria"),
    ritaglia("function laFraseDellaRiga"),
    ritaglia("const IL_FILTRO_VUOTO ="),
    ritaglia("function gliAbbonamenti"),
    `return {
       disegna: (abbonamenti, filtro = "tutti") => {
         ABBONAMENTI = abbonamenti;
         FILTRO_ABBONAMENTI = filtro;
         return gliAbbonamenti();
       },
       laFraseDellaRiga,
       laCategoria,
       conLArticolo,
       ilMeseDetto,
     };`,
  ];
  // eslint-disable-next-line no-new-func
  return new Function(pezzi.join(";\n"))();
}

const PAGINA = laFabbrica();
const GIORNO = 24 * 60 * 60 * 1000;
const ORA = Date.now();

/* Una riga come la manda il quadro, con lo stato fatto come lo fa lui. */
let contatore = 0;
const riga = (fatta) => {
  contatore += 1;
  const uno = {
    lic: `lic_${contatore}`,
    app: "gdahome",
    sog: `casa_${String(contatore).padStart(8, "0")}aaaaaaaaaaaaaaaaaaaaaaaa`,
    piattaforma: "ios",
    piano: "mensile",
    prezzo: null,
    valuta: "",
    rinnovo: true,
    sandbox: false,
    inizio: ORA - 3 * GIORNO,
    pagato: ORA + 10 * GIORNO,
    vale: true,
    prova: false,
    fuInProva: false,
    pagatoDopoLaProva: false,
    finito: null,
    ...fatta,
  };
  uno.stato = !uno.vale
    ? "scaduto"
    : uno.rinnovo === false
      ? "disdetto"
      : uno.prova
        ? "prova"
        : "attivo";
  return uno;
};
const risposta = (righe) => ({
  accese: true,
  conti: contaGliAbbonamenti(righe, ORA),
  negozi: {
    ios: contaGliAbbonamenti(
      righe.filter((uno) => uno.piattaforma === "ios"),
      ORA,
    ),
    android: contaGliAbbonamenti(
      righe.filter((uno) => uno.piattaforma === "android"),
      ORA,
    ),
  },
  prove: righe.filter((uno) => uno.sandbox).length,
  elenco: righe,
});
const soloTesto = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");

/* Quella dello screenshot: una prova, una disdetta in prova, due di test. */
const SENZA_PAGANTI = [
  riga({ prova: true, piano: "annuale", pagato: ORA + 13 * GIORNO }),
  riga({ prova: true, rinnovo: false, pagato: ORA + 13 * GIORNO }),
  riga({ sandbox: true, piano: "annuale", prezzo: 44.99, valuta: "EUR" }),
  riga({
    sandbox: true,
    piattaforma: "android",
    piano: "annuale",
    prezzo: 49.99,
    valuta: "EUR",
    rinnovo: false,
    vale: false,
  }),
];

const MESE = PAGINA.ilMeseDetto(Date.now());

test("senza paganti: 0 paganti, 0 €, e quando arriva il primo incasso", () => {
  const html = PAGINA.disegna(risposta(SENZA_PAGANTI));
  const letto = soloTesto(html).replace(/\u00a0/g, " ");
  const fine = PAGINA.conLArticolo("il", ORA + 13 * GIORNO);
  assert.match(letto, /Paganti 0 nessuno ha ancora pagato/);
  assert.match(letto, /In prova gratuita 1 non hanno ancora pagato: pagano a fine prova/);
  assert.ok(letto.includes(`la prima finisce ${fine}`));
  assert.match(letto, /Disdetti 1 1 in prova: finisce senza pagare/);
  assert.ok(
    letto.includes(
      `Incassi 0 € nessun incasso a ${MESE} ricorrente: 0 € al mese, nessuno rinnova prossimo incasso possibile ${fine}, a fine prova`,
    ),
    letto,
  );
  /* Non c'e' piu' il numero che contava tutto insieme. */
  assert.doesNotMatch(letto, /Attivi/);
});

test("il conto sotto i riquadri fa la somma, e i test non contano", () => {
  const letto = soloTesto(PAGINA.disegna(risposta(SENZA_PAGANTI)));
  assert.match(
    letto,
    /4 abbonamenti = 0 paganti \+ 1 in prova gratuita \+ 1 disdetto \+ 2 acquisti di test \(non contano\)/,
  );
});

test("le linguette hanno gli stessi nomi e numeri; «Finiti» solo se ce n'e'", () => {
  const html = PAGINA.disegna(risposta(SENZA_PAGANTI));
  const linguette = [...html.matchAll(/data-filtro-abbonamenti="(\w+)"[^>]*>(.*?)<\/button>/g)].map(
    ([, quale, dentro]) => `${quale}: ${soloTesto(dentro).trim()}`,
  );
  assert.deepEqual(linguette, [
    "tutti: Tutti 4",
    "paganti: Paganti 0",
    "prova: In prova gratuita 1",
    "disdetti: Disdetti 1",
    "test: Acquisti di test 2",
  ]);
});

test("ogni riga dice se ha pagato, con la pastiglia della sua categoria", () => {
  const fine = PAGINA.conLArticolo("il", ORA + 13 * GIORNO);
  const al = PAGINA.conLArticolo("al", ORA + 13 * GIORNO);
  const f = PAGINA.laFraseDellaRiga;
  assert.equal(
    f(riga({ prova: true, pagato: ORA + 13 * GIORNO })),
    `Prova gratuita fino ${al}, poi si rinnova`,
  );
  assert.equal(
    f(
      riga({
        prova: true,
        piano: "annuale",
        prezzo: 44.99,
        valuta: "EUR",
        pagato: ORA + 13 * GIORNO,
      }),
    ).replace(/\s/g, " "),
    `Prova gratuita fino ${al}, poi si rinnova a 44,99 €/anno`,
  );
  assert.equal(
    f(riga({ prova: true, rinnovo: false, pagato: ORA + 13 * GIORNO })),
    `Disdetto durante la prova: finisce ${fine} senza pagare`,
  );
  assert.equal(
    f(riga({ rinnovo: false, pagato: ORA + 13 * GIORNO })),
    `Disdetto: ha pagato fino ${al}, poi finisce`,
  );
  assert.equal(f(riga({ pagato: ORA + 13 * GIORNO })), `Pagato fino ${al}, poi si rinnova`);
  assert.equal(
    f(riga({ vale: false, pagato: ORA - 13 * GIORNO })),
    `Finito ${PAGINA.conLArticolo("il", ORA - 13 * GIORNO)}`,
  );
  assert.equal(f(riga({ vale: false, finito: "acquisto-rimborsato" })), "Rimborsato");

  const html = PAGINA.disegna(risposta(SENZA_PAGANTI));
  const pastiglie = [...html.matchAll(/<span class="pastiglia ([\w-]+)">([^<]*)<\/span>/g)].map(
    ([, tinta, parola]) => `${tinta} ${parola}`,
  );
  assert.deepEqual(pastiglie.slice(0, 4), [
    "c-pro prova gratuita",
    "c-dis disdetto",
    "c-tes test",
    "c-tes test",
  ]);
});

test("gli acquisti di test stanno in fondo, sotto una riga a parte", () => {
  const html = PAGINA.disegna(risposta(SENZA_PAGANTI));
  const sotto = html.indexOf('class="sotto-test"');
  assert.ok(sotto > 0);
  assert.ok(html.indexOf("App Store (TestFlight)") > sotto);
  assert.ok(html.indexOf("Google Play (tester)") > sotto);
  assert.match(
    soloTesto(html),
    /Acquisti di test TestFlight e tester di Google: sono nostri, non entrano in nessun numero sopra/,
  );
});

test("una linguetta vuota dice perche'", () => {
  const letto = soloTesto(PAGINA.disegna(risposta(SENZA_PAGANTI), "paganti"));
  assert.match(
    letto,
    /Nessun abbonamento qui Nessuno ha ancora pagato: chi è in prova gratuita passa qui quando la prova finisce\./,
  );
  /* E la Panoramica, che manda ancora coi nomi di prima, arriva giusta. */
  const disdetti = PAGINA.disegna(risposta(SENZA_PAGANTI), "disdetto");
  assert.match(disdetti, /data-filtro-abbonamenti="disdetti" aria-pressed="true"/);
});

test("con i paganti: quanti, mensili e annuali, e gli incassi solo loro", () => {
  const righe = [
    riga({ prova: true, pagato: ORA + 3 * GIORNO }),
    riga({ piano: "annuale", prezzo: 44.99, valuta: "EUR" }),
    riga({ piattaforma: "android", prezzo: 4.99, valuta: "EUR" }),
    riga({ piattaforma: "android", piano: "annuale", prezzo: 49.99, valuta: "EUR" }),
    riga({ prezzo: 4.99, valuta: "EUR", rinnovo: false }),
    riga({ prezzo: 4.99, valuta: "EUR", vale: false, pagato: ORA - 5 * GIORNO }),
    riga({ sandbox: true, prezzo: 4.99, valuta: "EUR" }),
  ];
  const letto = soloTesto(PAGINA.disegna(risposta(righe))).replace(/ /g, " ");
  const fine = PAGINA.conLArticolo("il", ORA + 10 * GIORNO);
  assert.ok(
    letto.includes(
      `Paganti 3 hanno pagato e si rinnovano da soli 1 mensile · 2 annuali in più 1 ha pagato e disdetto (finisce ${fine})`,
    ),
    letto,
  );
  /* Il ricorrente e' solo di chi rinnova: il disdetto non c'e'. */
  assert.match(letto, /ricorrente: ≈ 12,91 €\/mese da 3 che rinnovano/);
  assert.match(letto, /App Store 1 pagante · ≈ 3,75 € al mese/);
  assert.match(letto, /Google Play 2 paganti · ≈ 9,16 € al mese/);
  assert.match(
    letto,
    /7 abbonamenti = 3 paganti \+ 1 in prova gratuita \+ 1 disdetto \+ 1 finito \+ 1 acquisto di test/,
  );
  assert.match(letto, /Finiti 1/);
});

test("i numeri sono quelli del quadro, anche quando l'elenco e' tagliato", () => {
  const righe = [riga({}), riga({}), riga({ prova: true })];
  const tagliata = { ...risposta(righe), elenco: righe.slice(0, 1) };
  const letto = soloTesto(PAGINA.disegna(tagliata));
  assert.match(letto, /Paganti 2/);
  assert.match(letto, /3 abbonamenti = 2 paganti/);
  assert.match(letto, /Nell'elenco ci sono i primi 1: i numeri sopra li contano tutti e 3\./);
});

test("gli importi dicono cosa sono, e le categorie si spiegano in una frase", () => {
  const letto = soloTesto(PAGINA.disegna(risposta(SENZA_PAGANTI)));
  assert.match(letto, /Paganti : hanno pagato e si rinnovano\./);
  assert.match(letto, /In prova gratuita : non hanno ancora pagato/);
  assert.match(letto, /Gli importi sono quelli che pagano i clienti, IVA compresa/);
  assert.match(letto, /App Store Connect e nella Play Console/);
  /* Nei conti negozio per negozio, ancora tutto. */
  for (const parola of [
    "paganti",
    "in prova gratuita",
    "disdetti: finiscono a scadenza",
    "finiti negli ultimi 30 giorni",
    "prove finite che sono passate a pagamento",
    "al mese, quello che pagano i clienti",
  ])
    assert.ok(letto.includes(parola), `manca «${parola}»`);
});

/* ─── Chi ha pagato e poi ha disdetto ─────────────────────────────────────
 *
 * «Non mi trovo con gli incassi: uno ha finito il periodo gratuito, ha pagato
 * e poi ha disdetto — vedi che termina il 4 dicembre». La pagina diceva
 * «Paganti 0, nessuno ha ancora pagato» e «Incassi al mese 0 €»: chi ha
 * disdetto stava solo fra i disdetti, e gli incassi erano solo il ricorrente
 * di chi rinnova. Adesso «gia' incassato» e «ricorrente» sono due cose: chi
 * ha pagato e disdetto conta nel primo e non nel secondo. */

const NOVEMBRE = Date.parse("2026-11-04T10:00:00.000Z");
const g = (quando) => Date.parse(quando);

/* Una riga per caso, con l'ora ferma al 4 novembre: i conti sono puri. */
const UN_CASO_PER_TIPO = {
  /* In prova: non ha pagato, paga il 9 novembre se non disdice. */
  provaInCorso: riga({
    prova: true,
    fuInProva: true,
    prezzo: null,
    pagato: g("2026-11-09T08:00:00.000Z"),
  }),
  /* Ha finito la prova e paga: App Store dice il giorno della transazione. */
  pagaDopoLaProva: riga({
    fuInProva: true,
    pagatoDopoLaProva: true,
    prezzo: 4.99,
    valuta: "EUR",
    periodo: g("2026-11-02T09:00:00.000Z"),
    pagato: g("2026-12-02T09:00:00.000Z"),
  }),
  /* Quello dello screenshot: prova finita, pagato, disdetto, finisce il 4 dic. */
  pagatoEDisdetto: riga({
    fuInProva: true,
    pagatoDopoLaProva: true,
    rinnovo: false,
    prezzo: 4.99,
    valuta: "EUR",
    pagato: g("2026-12-04T08:00:00.000Z"),
  }),
  /* Disdetto in prova: finisce senza pagare. */
  disdettoInProva: riga({
    prova: true,
    fuInProva: true,
    rinnovo: false,
    pagato: g("2026-11-12T08:00:00.000Z"),
  }),
  /* Un acquisto di test: paga per finta, non conta da nessuna parte. */
  diTest: riga({
    sandbox: true,
    prezzo: 4.99,
    valuta: "EUR",
    periodo: g("2026-11-03T08:00:00.000Z"),
    pagato: g("2026-12-03T08:00:00.000Z"),
  }),
  /* Finito: ha pagato ottobre e non ha rinnovato. */
  scadutoPagato: riga({
    vale: false,
    rinnovo: false,
    prezzo: 4.99,
    valuta: "EUR",
    pagato: g("2026-11-01T08:00:00.000Z"),
  }),
  /* Finito alla fine della prova, senza pagare. */
  scadutoInProva: riga({
    vale: false,
    rinnovo: false,
    prova: true,
    fuInProva: true,
    pagato: g("2026-11-02T08:00:00.000Z"),
  }),
  /* Rimborsato: i soldi sono tornati indietro, non e' un incasso. */
  rimborsato: riga({
    vale: false,
    prezzo: 4.99,
    valuta: "EUR",
    finito: "acquisto-rimborsato",
    periodo: g("2026-11-01T12:00:00.000Z"),
    pagato: g("2026-12-01T12:00:00.000Z"),
  }),
};

test("i conti distinguono il gia' incassato dal ricorrente, caso per caso", () => {
  const c = contaGliAbbonamenti(Object.values(UN_CASO_PER_TIPO), NOVEMBRE);
  /* Le categorie: ognuno in un posto solo, come prima. */
  assert.equal(c.paganti, 1, "paganti: solo chi rinnova");
  assert.equal(c.inProva, 1);
  assert.equal(c.disdetti, 2);
  assert.equal(c.finiti, 3);
  assert.equal(c.test, 1);
  assert.equal(c.paganti + c.inProva + c.disdetti + c.finiti + c.test, c.tutti);
  /* Fra i disdetti, chi ha pagato e chi era in prova. */
  assert.equal(c.pagatiDisdetti, 1);
  assert.equal(c.primaFinePagatiDisdetti, g("2026-12-04T08:00:00.000Z"));
  assert.equal(c.disdettiInProva, 1);
  /* Hanno pagato almeno una volta: chi paga, chi ha pagato e disdetto, chi
   * ha pagato ottobre ed e' finito. Non la prova, non il rimborso, non il test. */
  assert.equal(c.hannoPagato, 3);
  /* Il ricorrente e' solo di chi rinnova. */
  assert.deepEqual(c.alMese, { EUR: 4.99 });
  /* Incassati a novembre: chi paga dopo la prova (il 2) e chi ha pagato e
   * disdetto (il 4, la scadenza meno un mese). Non ottobre, non il test, non
   * il rimborso. */
  assert.equal(c.inizioDelMese, g("2026-10-31T23:00:00.000Z"), "mezzanotte a Roma");
  assert.equal(c.pagamenti, 2);
  assert.deepEqual(c.incassato, { EUR: 9.98 });
  /* Il prossimo: la prova che finisce il 9, prima del rinnovo del 2 dicembre. */
  assert.deepEqual(c.prossimoIncasso, {
    quando: g("2026-11-09T08:00:00.000Z"),
    perche: "fine-prova",
  });
});

test("il caso dello screenshot da solo: 0 paganti, 1 ha pagato, 4,99 € incassati", () => {
  const { pagatoEDisdetto, provaInCorso } = UN_CASO_PER_TIPO;
  const c = contaGliAbbonamenti([pagatoEDisdetto, provaInCorso], NOVEMBRE);
  assert.equal(c.paganti, 0);
  assert.deepEqual(c.alMese, {}, "nessuno rinnova: il ricorrente e' zero");
  assert.equal(c.pagatiDisdetti, 1);
  assert.equal(c.hannoPagato, 1);
  assert.deepEqual(c.incassato, { EUR: 4.99 }, "ma i 4,99 € li ha dati");
  /* Alle 06:28 del 4 novembre la scadenza meno un mese (le 08:00) e' ancora
   * da venire, ma la prova e' finita e il mese e' pagato: si conta. */
  const presto = contaGliAbbonamenti([pagatoEDisdetto], g("2026-11-04T06:28:00.000Z"));
  assert.deepEqual(presto.incassato, { EUR: 4.99 });
  /* A dicembre quel pagamento e' di novembre: non e' piu' «del mese». */
  const dicembre = contaGliAbbonamenti([pagatoEDisdetto], g("2026-12-01T10:00:00.000Z"));
  assert.deepEqual(dicembre.incassato, {});
  assert.equal(dicembre.pagamenti, 0);
});

test("il mese e' quello di Roma: le 00:30 del primo sono gia' il mese nuovo", () => {
  /* Il 31 ottobre alle 23:30 UTC a Roma e' gia' l'1 novembre (CET, +1). */
  const pagato = riga({
    prezzo: 4.99,
    valuta: "EUR",
    periodo: g("2026-10-31T23:30:00.000Z"),
    pagato: g("2026-11-30T23:30:00.000Z"),
  });
  assert.deepEqual(contaGliAbbonamenti([pagato], NOVEMBRE).incassato, { EUR: 4.99 });
  /* E a fine marzo, con l'ora legale, il primo del mese e' ancora CET. */
  const marzo = contaGliAbbonamenti([], g("2027-03-31T10:00:00.000Z"));
  assert.equal(marzo.inizioDelMese, g("2027-02-28T23:00:00.000Z"));
});

/* La pagina, con i numeri dello screenshot: 5 in prova, 4 disdetti (uno ha
 * pagato 4,99 € e finisce fra un mese, tre erano in prova), 3 finiti e 2
 * acquisti di test. L'ora e' quella vera: il pagamento e' di adesso. */
const DELLO_SCREENSHOT = () => [
  ...Array.from({ length: 5 }, (_, i) =>
    riga({ prova: true, fuInProva: true, pagato: ORA + (5 + i) * GIORNO }),
  ),
  riga({
    fuInProva: true,
    pagatoDopoLaProva: true,
    rinnovo: false,
    prezzo: 4.99,
    valuta: "EUR",
    periodo: ORA,
    pagato: ORA + 30 * GIORNO,
  }),
  ...Array.from({ length: 3 }, (_, i) =>
    riga({ prova: true, fuInProva: true, rinnovo: false, pagato: ORA + (2 + i) * GIORNO }),
  ),
  ...Array.from({ length: 3 }, (_, i) =>
    riga({
      vale: false,
      rinnovo: false,
      prova: true,
      fuInProva: true,
      pagato: ORA - (40 + i) * GIORNO,
    }),
  ),
  riga({ sandbox: true, prezzo: 4.99, valuta: "EUR", periodo: ORA }),
  riga({ sandbox: true, piattaforma: "android", piano: "annuale", prezzo: 49.99, valuta: "EUR" }),
];

test("la pagina: Paganti non dice «nessuno ha pagato», Incassi dice 4,99 €", () => {
  const letto = soloTesto(PAGINA.disegna(risposta(DELLO_SCREENSHOT()))).replace(/\u00a0/g, " ");
  const fine = ORA + 30 * GIORNO;
  const prossimo = PAGINA.conLArticolo("il", ORA + 5 * GIORNO);
  assert.doesNotMatch(letto, /nessuno ha ancora pagato/);
  assert.ok(
    letto.includes(
      `Paganti 0 0 che rinnovano 1 ha pagato e disdetto (finisce ${PAGINA.conLArticolo("il", fine)})`,
    ),
    letto,
  );
  assert.ok(
    letto.includes(
      `Disdetti 4 1 dopo aver pagato: Premium fino ${PAGINA.conLArticolo("al", fine)}, poi finisce 3 in prova: finiscono senza pagare`,
    ),
    letto,
  );
  assert.ok(
    letto.includes(
      `Incassi 4,99 € 1 pagamento a ${MESE}, IVA compresa ricorrente: 0 € al mese, nessuno rinnova prossimo incasso possibile ${prossimo}, a fine prova`,
    ),
    letto,
  );
  assert.match(letto, /In prova gratuita 5 .*1 prova su 4 passata a pagamento/);
  assert.match(
    letto,
    /14 abbonamenti = 0 paganti \+ 5 in prova gratuita \+ 4 disdetti \+ 3 finiti \+ 2 acquisti di test/,
  );
  /* Il negozio dice anche lui quello che ha incassato. */
  assert.ok(letto.includes(`App Store 0 paganti · 4,99 € incassati a ${MESE}`), letto);
});

test("la linguetta Paganti vuota dice dov'e' chi ha pagato", () => {
  const letto = soloTesto(PAGINA.disegna(risposta(DELLO_SCREENSHOT()), "paganti"));
  assert.ok(
    letto.includes(
      `Nessun abbonamento qui Nessuno che rinnova: 1 ha pagato e disdetto (finisce ${PAGINA.conLArticolo("il", ORA + 30 * GIORNO)}), e sta fra i Disdetti.`,
    ),
    letto,
  );
});
