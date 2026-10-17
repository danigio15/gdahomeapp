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

test("senza paganti: 0 paganti, 0 €, e quando arriva il primo incasso", () => {
  const html = PAGINA.disegna(risposta(SENZA_PAGANTI));
  const letto = soloTesto(html);
  const fine = PAGINA.conLArticolo("il", ORA + 13 * GIORNO);
  assert.match(letto, /Paganti 0 nessuno ha ancora pagato/);
  assert.match(letto, /In prova gratuita 1 non hanno ancora pagato: pagano a fine prova/);
  assert.ok(letto.includes(`la prima finisce ${fine}`));
  assert.match(
    letto,
    /Disdetti 1 restano Premium fino alla scadenza, poi finiscono 1 era ancora in prova: non pagherà/,
  );
  assert.match(letto, /Incassi al mese 0 € nessun pagante ancora/);
  assert.ok(letto.includes(`il primo incasso possibile ${fine}, a fine prova`));
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
  assert.match(letto, /Paganti 3 hanno pagato e si rinnovano da soli 1 mensile · 2 annuali/);
  assert.match(letto, /Incassi al mese ≈ 12,91 € \/mese da 3 paganti, IVA compresa/);
  assert.match(letto, /App Store ≈ 3,75 € · Google Play ≈ 9,16 €/);
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
