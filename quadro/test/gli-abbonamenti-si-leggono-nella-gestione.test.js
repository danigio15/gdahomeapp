/* «Abbonamenti e licenze» nella Gestione gdahome.
 *
 * Era la schermata «Abbonamenti» (1.10.0): «quanti abbonamenti fatti su Apple
 * e su Play Store, se sono mensili o annuali e quanti nel periodo di prova».
 * Poi «non capisco nulla sugli abbonamenti, sulle licenze»: e' diventata
 * «Abbonamenti e licenze», un posto solo per ogni licenza Premium — comprata
 * nell'app, regalata dal gestore, data da un installatore — con in cima i
 * numeri che contano (ognuno con la sua «i»), le case per piano, le entrate,
 * quello che arriva nei prossimi trenta giorni, «Come funziona», e una
 * tabella: casa, origine (col piano), stato, inizio, scade o rinnova,
 * importo previsto, importo reale, e il menu «⋯»; e i totali.
 *
 * I conti li fa il quadro e li provano le prove delle licenze
 * (`le-licenze.test.js`, «Gli abbonamenti»), e qui sotto `contaGliAbbonamenti`
 * caso per caso. Queste prove ritagliano dalla pagina i pezzi che disegnano la
 * sezione e li fanno girare con i dati che le manderebbe il quadro: si
 * controlla quello che ne esce, non le lettere del programma.
 *
 * ─── Un posto solo per abbonamento ───────────────────────────────────────
 *
 * Restano le regole che si erano imparate: ogni licenza sta in uno stato
 * solo; chi ha pagato e poi disdetto e' un **pagante** che non rinnova («vedo
 * che paganti hai ancora 0»); il ricorrente e' solo di chi rinnova; gli
 * acquisti di test stanno in fondo e in nessun numero; i numeri sono quelli
 * del quadro anche quando l'elenco e' tagliato; un quadro di prima, coi nomi
 * di prima («disdetti»), si legge ancora.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  contaGliAbbonamenti,
  ilGiornoDelPagamento,
  ilGruppoDellAbbonamento,
  loStatoDellAbbonamento,
  nonRinnova,
} from "../src/licenze.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const GESTORE = readFileSync(join(QUI, "..", "gestore", "index.html"), "utf8");

test("«Abbonamenti e licenze» sta nella barra subito dopo la Panoramica", () => {
  assert.match(
    GESTORE,
    /\["panoramica", "Panoramica", CONTI\.daGuardare\.length\],\s*\["abbonamenti", "Abbonamenti e licenze", 0\],/,
  );
  /* «Regali e codici» resta, ed e' da li' che si regala; le versioni
   * dell'app hanno la loro sezione. */
  assert.match(GESTORE, /\["licenze", "Regali e codici", 0\],/);
  assert.match(GESTORE, /\["versioni", "App sui telefoni", 0\],/);
  assert.match(GESTORE, /abbonamenti:\s*'<svg/);
  assert.match(GESTORE, /schermata === "abbonamenti"\s*\? gliAbbonamenti\(\)/);
  assert.match(GESTORE, /schermata === "versioni"\s*\? leVersioniDellApp\(\)/);
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

/* Un pezzo del programma di primo livello, dalla sua riga alla riga prima del
 * pezzo dopo: lo `<script>` e' formattato da prettier, e ogni pezzo di primo
 * livello comincia con sei spazi e una lettera (o il commento che lo
 * introduce). */
function ilPezzo(nome) {
  const righe = GESTORE.split("\n");
  const inizio = righe.findIndex(
    (riga) => riga.startsWith(`      ${nome} `) || riga.startsWith(`      ${nome}(`),
  );
  assert.ok(inizio >= 0, `nella pagina non c'e' piu' «${nome}»`);
  let fine = inizio + 1;
  while (fine < righe.length && !/^ {6}[A-Za-z/]/.test(righe[fine])) fine += 1;
  return righe.slice(inizio, fine).join("\n");
}

/* La pagina non si carica qui: si prende solo quello che serve alla sezione. */
function laFabbrica() {
  const pezzi = [
    "let ABBONAMENTI = null; let LICENZE = { accese: true, licenze: [], codici: [] }; let INSTALLATORI = []; let CONTI = { nomi: new Map(), tutte: [] };",
    `const testo = (cosa) => String(cosa).replace(/[&<>"']/g, (uno) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[uno]);`,
    "const plurale = (quanti, uno, molti) => `${quanti} ${quanti === 1 ? uno : molti}`;",
    'const numero = (n) => new Intl.NumberFormat("it-IT").format(Number(n) || 0);',
    'const daQuanto = () => "adesso";',
    ...[
      "const LO_STATO_DELLE_LICENZE",
      "const LE_ICONE",
      "const ilGiorno",
      "const ilGiornoCorto",
      "function conLArticolo",
      "function iSoldi",
      "function alMeseDetto",
      "function lIncassatoDetto",
      "function ilMeseDetto",
      "const GLI_STATI_DELLE_LICENZE",
      "const LE_FONTI_DELLE_LICENZE",
      "const I_FILTRI_DI_PRIMA",
      "const TRENTA_GIORNI",
      "function laScadenzaDellaRiga",
      "const LISTINO_GDAHOME",
      "function ilPrezzoDelPiano",
      "function gliImportiDelNegozio",
      "function laLicenzaInRiga",
      "function tutteLeLicenze",
      "function leLicenzeFiltrate",
      "const inOrdineDiData",
      "const ilSegnoDellaFonte",
      "const laFonteInChip",
      "const laCellaDellImporto",
      "function gliImportiInUnaRiga",
      "const laBolla",
      "function laRigaDellaLicenza",
      "function leSommeDelleLicenze",
      "const iSoldiInTutte",
      "const leVociDelPrevisto",
      "function leScadenzeDette",
      "function ilPrevistoDetto",
      "function laRigaDelleSomme",
      "function ilTotaleDelGruppo",
      "function ilTotaleDelleLicenze",
      "function leRigheDelleLicenze",
      "function scegliIlFiltroDelleLicenze",
      "function iContiDeiNegozi",
      "function leCasePerLicenza",
      "function iNumeriDelleLicenze",
      "function inArrivo",
      "function ilComeFunziona",
      "function ilGraficoDelleCase",
      "function leEntrate",
      "function iFiltriDelleLicenze",
      "function gliAbbonamenti",
      "const PRIMA_LA_LICENZA",
      "function laLicenza",
      "function laLicenzaDellaCasa",
    ].map(ilPezzo),
    `return {
       /* Le case, le licenze e gli abbonamenti come li manderebbe il quadro;
        * i conti di tutta la pagina come li fa \`iConti\`. */
       prepara: ({ abbonamenti, licenze = [], case: lista = [], installatori = [] }) => {
         ABBONAMENTI = abbonamenti;
         LICENZE = { accese: true, licenze, codici: [] };
         INSTALLATORI = installatori;
         const tutte = lista.map(([matricola, nome]) => ({
           matricola,
           nome,
           chi: "inst_0000000000000001",
           di: "Impianti Rossi",
           casa: {},
           licenza: laLicenza({
             licenze: licenze.filter((una) => una.sog === matricola && una.app === "gdahome"),
             abbonamenti: (abbonamenti?.elenco || []).filter((uno) => uno.sog === matricola),
           }),
         }));
         CONTI = { tutte, nomi: new Map(tutte.map((una) => [una.matricola, una.nome])) };
         Object.assign(LO_STATO_DELLE_LICENZE, { filtro: "tutte", fonte: "tutte", cerca: "", glossario: null });
         LO_STATO_DELLE_LICENZE.aperti = new Set();
         LO_STATO_DELLE_LICENZE.interi = new Set();
         LO_STATO_DELLE_LICENZE.espanse = new Set();
       },
       stato: LO_STATO_DELLE_LICENZE,
       scegliIlFiltroDelleLicenze,
       gliAbbonamenti,
       tutteLeLicenze,
       laLicenzaDellaCasa: (matricola) =>
         laLicenzaDellaCasa(matricola, CONTI.tutte.find((una) => una.matricola === matricola)?.licenza),
       conLArticolo,
       ilGiorno,
       ilGiornoCorto,
       ilMeseDetto,
     };`,
  ];
  // eslint-disable-next-line no-new-func
  return new Function(pezzi.join(";\n"))();
}

const PAGINA = laFabbrica();
const GIORNO = 24 * 60 * 60 * 1000;
const ORA = Date.now();

/* Una riga come la manda il quadro, con lo stato e il gruppo fatti da lui. */
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
  uno.stato = loStatoDellAbbonamento(uno);
  uno.gruppo = ilGruppoDellAbbonamento(uno);
  uno.nonRinnova = nonRinnova(uno);
  uno.pagatoIl = ilGiornoDelPagamento(uno, ORA);
  return uno;
};
const soloTesto = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ");

/* ─── Le case di prova: una per caso ───────────────────────────────────── */

const casa = (n) => `casa_${String(n).padStart(32, "0")}`;
const ROSSI = "inst_0000000000000001";
const NEGOZIO = {
  "Casa Rossi": riga({
    sog: casa(1),
    prezzo: 4.99,
    valuta: "EUR",
    periodo: ORA,
    pagato: ORA + 11 * GIORNO,
  }),
  "Casa Bianchi": riga({
    sog: casa(2),
    inizio: ORA - 120 * GIORNO,
    piattaforma: "android",
    piano: "annuale",
    prezzo: 49.99,
    valuta: "EUR",
    pagato: ORA + 200 * GIORNO,
  }),
  "Casa Ferrari": riga({
    sog: casa(3),
    prova: true,
    fuInProva: true,
    piano: "annuale",
    pagato: ORA + 9 * GIORNO,
  }),
  "Casa Esposito": riga({
    sog: casa(4),
    prova: true,
    fuInProva: true,
    rinnovo: false,
    pagato: ORA + 4 * GIORNO,
  }),
  "Casa Romano": riga({
    sog: casa(5),
    fuInProva: true,
    pagatoDopoLaProva: true,
    rinnovo: false,
    prezzo: 4.99,
    valuta: "EUR",
    periodo: ORA,
    pagato: ORA + 20 * GIORNO,
  }),
  "Casa Colombo": riga({
    sog: casa(6),
    vale: false,
    rinnovo: false,
    prezzo: 4.99,
    valuta: "EUR",
    pagato: ORA - 12 * GIORNO,
  }),
  "Casa Ricci": riga({
    sog: casa(7),
    vale: false,
    prezzo: 4.99,
    valuta: "EUR",
    finito: "acquisto-rimborsato",
  }),
  "Casa Gallo": riga({
    sog: casa(8),
    sandbox: true,
    vale: false,
    rinnovo: false,
    prezzo: 4.99,
    valuta: "EUR",
    pagato: ORA - 2 * GIORNO,
  }),
  "Casa Neri": riga({
    sog: casa(14),
    vale: false,
    prezzo: 4.99,
    valuta: "EUR",
    pagato: ORA + 15 * GIORNO,
  }),
};
const dalNegozio = (uno, piu = {}) => ({
  lic: uno.lic,
  app: uno.app,
  sog: uno.sog,
  origine: "negozio",
  scade: uno.pagato,
  revocata: null,
  vale: uno.vale,
  prova: uno.prova,
  nota: `${uno.piattaforma} · gdahome.premium`,
  ...piu,
});
const REGALI = [
  {
    lic: "lic_r1",
    app: "gdahome",
    sog: casa(9),
    origine: "regalo",
    scade: ORA + 300 * GIORNO,
    creata: ORA - 65 * GIORNO,
    revocata: null,
    vale: true,
    nota: "per la signora Marino",
  },
  {
    lic: "lic_r2",
    app: "gdahome",
    sog: casa(10),
    origine: "installatore",
    installatore: ROSSI,
    scade: ORA + 10 * GIORNO,
    creata: ORA - 20 * GIORNO,
    revocata: null,
    vale: true,
    nota: "",
  },
  {
    lic: "lic_r3",
    app: "gdahome",
    sog: casa(11),
    origine: "regalo",
    scade: ORA + 100 * GIORNO,
    revocata: ORA - GIORNO,
    vale: false,
    nota: "",
  },
  {
    lic: "lic_r4",
    app: "gdahome",
    sog: casa(12),
    origine: "regalo",
    scade: null,
    creata: ORA - 5 * GIORNO,
    revocata: null,
    vale: true,
    nota: "",
    codice: "GDA-AAAA-BBBB-CCCC",
  },
  {
    lic: "lic_r5",
    app: "gdanav",
    sog: `tel_${"1".repeat(32)}`,
    origine: "regalo",
    scade: ORA + 60 * GIORNO,
    revocata: null,
    vale: true,
    nota: "",
  },
];
const LE_CASE = [
  ...Object.entries(NEGOZIO).map(([nome, uno]) => [uno.sog, nome]),
  [casa(9), "Casa Marino"],
  [casa(10), "Casa Greco"],
  [casa(11), "Casa Conti"],
  [casa(12), "Casa Bruno"],
  [casa(13), "Casa Moretti"],
];
const ELENCO = Object.values(NEGOZIO);
const risposta = (righe, piu = {}) => ({
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
  ...piu,
});
const prepara = (abbonamenti = risposta(ELENCO)) =>
  PAGINA.prepara({
    abbonamenti,
    licenze: [
      ...ELENCO.map((uno) =>
        uno === NEGOZIO["Casa Neri"]
          ? dalNegozio(uno, { revocata: ORA - GIORNO, vale: false })
          : dalNegozio(uno),
      ),
      ...REGALI,
    ],
    case: LE_CASE,
    installatori: [{ chi: ROSSI, nome: "Impianti Rossi" }],
  });
const disegna = (filtro = "tutte", piu = {}) => {
  prepara();
  PAGINA.scegliIlFiltroDelleLicenze(filtro);
  Object.assign(PAGINA.stato, piu);
  return PAGINA.gliAbbonamenti();
};
const laRigaDi = (nome) => {
  prepara();
  const una = PAGINA.tutteLeLicenze().find((riga) => riga.nome === nome);
  assert.ok(una, `nessuna licenza per ${nome}`);
  return una;
};
const il = (quando) => PAGINA.conLArticolo("il", quando);
const al = (quando) => PAGINA.conLArticolo("al", quando);

test("ogni licenza dice di che casa e', da dove viene, come sta e quanto porta", () => {
  const come = (nome) => {
    const una = laRigaDi(nome);
    return [una.origine, una.stato, una.pastiglia, una.data.verbo, una.soldi]
      .join(" | ")
      .replace(/\u00a0/g, " ");
  };
  assert.equal(come("Casa Rossi"), "App Store | attiva | Attiva | rinnova | 4,99 €/mese");
  assert.equal(come("Casa Bianchi"), "Google Play | attiva | Attiva | rinnova | 49,99 €/anno");
  assert.equal(
    come("Casa Ferrari"),
    `App Store | prova | In prova fino ${al(ORA + 9 * GIORNO)} | fine prova | 0 €`,
  );
  assert.equal(come("Casa Esposito"), "App Store | nonrinnova | Non rinnova | termina | 0 €");
  assert.equal(come("Casa Romano"), "App Store | nonrinnova | Non rinnova | termina | 4,99 €/mese");
  assert.equal(come("Casa Colombo"), "App Store | finita | Scaduta | scaduta | 4,99 €/mese");
  assert.equal(come("Casa Ricci"), "App Store | finita | Rimborsata | rimborsata | 0 €");
  assert.equal(come("Casa Gallo"), "App Store | test | Test | test, finito | —");
  assert.equal(come("Casa Neri"), "App Store | finita | Revocata | revocata | 4,99 €/mese");
  assert.equal(come("Casa Marino"), "Regalo | attiva | Attiva | scade | Gratis");
  assert.equal(
    come("Casa Greco"),
    `Installatore | attiva | Termina ${il(ORA + 10 * GIORNO)} | scade | Gratis`,
  );
  assert.equal(come("Casa Conti"), "Regalo | finita | Revocata | revocata | Gratis");
  assert.equal(come("Casa Bruno"), "Regalo | attiva | Attiva | per sempre | Gratis");
  /* Il telefono di GdANav: la sua riga dice telefono, non casa. */
  const telefono = laRigaDi("Telefono · 11111111");
  assert.equal(telefono.sotto, "GdANav");
  assert.match(telefono.frase, /il telefono torna Base/);
});

test("aperta, ogni riga dice in una frase perche' e' in quello stato", () => {
  assert.equal(
    laRigaDi("Casa Romano").frase,
    `Ha disdetto: il periodo è già pagato, resta Premium fino ${al(ORA + 20 * GIORNO)} e poi la casa torna Base.`,
  );
  assert.equal(
    laRigaDi("Casa Esposito").frase,
    `Ha disdetto durante la prova gratuita: termina ${il(ORA + 4 * GIORNO)} senza pagare, poi la casa torna Base.`,
  );
  assert.match(
    laRigaDi("Casa Ferrari").frase,
    /comincia a pagare l'abbonamento annuale, se non disdice prima/,
  );
  assert.match(
    laRigaDi("Casa Rossi").frase,
    /^Paga e si rinnova da solo .*: il rinnovo lo fa Apple\.$/,
  );
  assert.match(laRigaDi("Casa Ricci").frase, /rimborsato il cliente/);
  assert.match(laRigaDi("Casa Neri").frase, /^Revocata da te /);
  assert.equal(laRigaDi("Casa Bruno").frase, "Regalata per sempre: non scade.");
  assert.match(laRigaDi("Casa Greco").fonteDetta, /^Licenza di Impianti Rossi, dal suo pacchetto/);
  assert.match(laRigaDi("Casa Bruno").fonteDetta, /^Regalo tuo · con un codice/);
  /* La frase si vede solo con la riga aperta. */
  prepara();
  const chiusa = PAGINA.gliAbbonamenti();
  assert.ok(!chiusa.includes("Ha disdetto: il periodo è già pagato"));
  PAGINA.stato.espanse.add(NEGOZIO["Casa Romano"].lic);
  assert.ok(soloTesto(PAGINA.gliAbbonamenti()).includes("Ha disdetto: il periodo è già pagato"));
});

/* ─── Da quando ───────────────────────────────────────────────────────────
 *
 * «Non mi piace perche' non vedo piu' la data di inizio»: la Gestione di
 * prima scriveva «dal 6 nov» sotto ogni abbonamento, la tabella nuova solo
 * «Scade o rinnova». Adesso c'e' la colonna «Inizio», con la parola giusta
 * per ogni fonte; sulla carta del telefono «dal 6 nov → 20 nov»; aperta, la
 * frase dice la data intera. */

test("ogni licenza dice da quando: comprato, prova, regalato, dato, riscattato", () => {
  const inizio = (nome) => {
    const una = laRigaDi(nome);
    return `${una.inizioVerbo} ${PAGINA.ilGiornoCorto(una.inizio)}`;
  };
  const corto = (giorni) => PAGINA.ilGiornoCorto(ORA - giorni * GIORNO);
  /* Dal negozio: quello che dice lui (`inizio`), l'acquisto o il primo
   * giorno della prova. */
  assert.equal(inizio("Casa Bianchi"), `comprato il ${corto(120)}`);
  assert.equal(inizio("Casa Rossi"), `comprato il ${corto(3)}`);
  assert.equal(inizio("Casa Ferrari"), `prova dal ${corto(3)}`);
  assert.equal(inizio("Casa Esposito"), `prova dal ${corto(3)}`, "disdetta in prova");
  /* Cominciato con la prova e poi pagato: non «comprato», da quando c'e'. */
  assert.equal(inizio("Casa Romano"), `dal ${corto(3)}`);
  /* I regali e gli installatori: quando la licenza e' fatta. */
  assert.equal(inizio("Casa Marino"), `regalato il ${corto(65)}`);
  assert.equal(inizio("Casa Greco"), `dato il ${corto(20)}`);
  assert.equal(inizio("Casa Bruno"), `riscattato il ${corto(5)}`);
  /* Senza data non si inventa: la colonna dice «—». */
  const telefono = laRigaDi("Telefono · 11111111");
  assert.equal(telefono.inizio, null);
  assert.equal(telefono.inizioDetto, "");

  /* La frase intera, con l'anno, e l'articolo che si elide. */
  const intero = (prep, giorni) =>
    PAGINA.conLArticolo(prep, ORA - giorni * GIORNO, PAGINA.ilGiorno);
  assert.equal(laRigaDi("Casa Bianchi").inizioDetto, `Comprato ${intero("il", 120)}`);
  assert.equal(
    laRigaDi("Casa Romano").inizioDetto,
    `Abbonato ${intero("dal", 3)}, cominciando con la prova gratuita`,
  );
  assert.equal(laRigaDi("Casa Marino").inizioDetto, `Regalata ${intero("il", 65)}`);
  assert.equal(laRigaDi("Casa Greco").inizioDetto, `Data da Impianti Rossi ${intero("il", 20)}`);
  assert.equal(laRigaDi("Casa Bruno").inizioDetto, `Codice riscattato ${intero("il", 5)}`);
  assert.match(intero("il", 3), /\d{4}$/, "la data intera ha l'anno");
});

test("l'inizio si vede: in colonna, «dal … →» sulla carta, e intero nella riga aperta", () => {
  prepara();
  const html = PAGINA.gliAbbonamenti();
  const bianchi = NEGOZIO["Casa Bianchi"];
  const suaRiga = html.match(
    new RegExp(`<li class="lic-riga[^"]*"[^>]*data-lic="${bianchi.lic}"[\\s\\S]*?</li>`),
  )[0];
  const giorno = PAGINA.ilGiornoCorto(ORA - 120 * GIORNO);
  /* La colonna, prima di «Scade o rinnova». */
  assert.ok(
    suaRiga.indexOf('class="lic-c-inizio"') < suaRiga.indexOf('class="lic-c-data'),
    "«Inizio» sta prima di «Scade o rinnova»",
  );
  assert.match(soloTesto(suaRiga), new RegExp(`comprato il ${giorno} `));
  /* La carta del telefono: «dal 6 nov → 2 dic» (la freccia la mette il CSS). */
  assert.match(suaRiga, /class="lic-c-data con-inizio con-data"/);
  assert.match(
    soloTesto(suaRiga),
    new RegExp(`${PAGINA.conLArticolo("dal", ORA - 120 * GIORNO)} rinnova`),
  );
  assert.match(GESTORE, /\.lic-c-data\.con-inizio\.con-data > b::before,/);
  /* Senza data d'inizio: «—», e niente «dal». */
  const tel = html.match(/<li class="lic-riga[^"]*"[^>]*data-lic="lic_r5"[\s\S]*?<\/li>/)[0];
  assert.match(tel, /<span class="lic-c-inizio"><b class="nessuna">—<\/b><\/span>/);
  assert.ok(!tel.includes("lic-dal"));
  /* Aperta: la frase dice anche da quando, con l'anno. */
  PAGINA.stato.espanse.add(bianchi.lic);
  assert.ok(
    soloTesto(PAGINA.gliAbbonamenti()).includes(
      `Comprato ${PAGINA.conLArticolo("il", ORA - 120 * GIORNO, PAGINA.ilGiorno)}.`,
    ),
  );
  /* Nella scheda della casa la riga e' la stessa, con il suo «dal». */
  assert.match(PAGINA.laLicenzaDellaCasa(casa(2)), /class="lic-dal"/);
});

test("in ogni gruppo l'ordine che serve: attive dalle ultime cominciate, prove e disdette da chi finisce prima", () => {
  prepara();
  const html = disegna("tutte", { aperti: new Set(["finita"]) });
  const nomi = (quale) => {
    const dentro = html.match(new RegExp(`data-gruppo="${quale}">([\\s\\S]*?)</section>`))[1];
    return [...dentro.matchAll(/<span class="lic-c-casa"><b[^>]*>([^<]+)<\/b>/g)].map(([, n]) => n);
  };
  /* Attive: chi ha appena comprato o ricevuto il regalo in cima; senza data
   * in fondo. */
  assert.deepEqual(nomi("attiva"), [
    "Casa Rossi",
    "Casa Bruno",
    "Casa Greco",
    "Casa Marino",
    "Casa Bianchi",
    "Telefono · 11111111",
  ]);
  /* Chi non rinnova: prima chi torna Base prima. */
  assert.deepEqual(nomi("nonrinnova"), ["Casa Esposito", "Casa Romano"]);
  /* Le finite: prima le finite da poco (la revocata ieri, poi la scaduta
   * dodici giorni fa). */
  const finite = nomi("finita");
  assert.ok(finite.indexOf("Casa Conti") < finite.indexOf("Casa Colombo"), finite.join(", "));
});

/* ─── Previsto, reale, e il totale ────────────────────────────────────────
 *
 * «Non vedo che tipo di abbonamento hanno, e voglio l'importo previsto, e
 * poi quando pagano sara' l'importo reale», e «alla fine voglio il totale
 * anche». Ogni abbonamento dice il piano; due colonne di soldi, previsto (dal
 * prezzo del piano) e reale (l'ultimo pagamento, col suo giorno); i totali
 * per gruppo e in fondo, che sono i numeri in cima. */

const ADESSO_PAGATO = ORA - 60 * 1000;
const PRIMA = ORA - 40 * GIORNO;
const SOLDI = {
  "Mensile Apple": riga({
    sog: casa(21),
    prezzo: 4.99,
    valuta: "EUR",
    periodo: ADESSO_PAGATO,
    pagato: ORA + 29 * GIORNO,
  }),
  "Annuale Uno": riga({
    sog: casa(22),
    piano: "annuale",
    prezzo: 49.99,
    valuta: "EUR",
    periodo: PRIMA,
    pagato: ORA + 325 * GIORNO,
  }),
  "Annuale Due": riga({
    sog: casa(23),
    piattaforma: "android",
    piano: "annuale",
    prezzo: 49.99,
    valuta: "EUR",
    periodo: PRIMA - 10 * GIORNO,
    pagato: ORA + 315 * GIORNO,
  }),
  "Prova Google": riga({
    sog: casa(24),
    piattaforma: "android",
    prova: true,
    fuInProva: true,
    prezzo: 4.99,
    valuta: "EUR",
    pagato: ORA + 5 * GIORNO,
  }),
  "Prova Apple": riga({
    sog: casa(25),
    piano: "",
    prova: true,
    fuInProva: true,
    pagato: ORA + 9 * GIORNO,
  }),
  "Disdetta Pagata": riga({
    sog: casa(26),
    rinnovo: false,
    prezzo: 4.99,
    valuta: "EUR",
    periodo: ADESSO_PAGATO,
    pagato: ORA + 29 * GIORNO,
  }),
  Rimborsata: riga({
    sog: casa(27),
    vale: false,
    prezzo: 4.99,
    valuta: "EUR",
    finito: "acquisto-rimborsato",
  }),
  "Di Test": riga({
    sog: casa(28),
    sandbox: true,
    prezzo: 4.99,
    valuta: "EUR",
    periodo: ADESSO_PAGATO,
  }),
};
const UN_REGALO = {
  lic: "lic_soldi_regalo",
  app: "gdahome",
  sog: casa(29),
  origine: "regalo",
  scade: ORA + 300 * GIORNO,
  creata: ORA - GIORNO,
  revocata: null,
  vale: true,
  nota: "",
};
const coiSoldi = (piu = {}) => {
  const elenco = Object.values(SOLDI);
  PAGINA.prepara({
    abbonamenti: risposta(elenco),
    licenze: [...elenco.map((uno) => dalNegozio(uno)), UN_REGALO],
    case: [...Object.entries(SOLDI).map(([nome, uno]) => [uno.sog, nome]), [casa(29), "Il Regalo"]],
  });
  Object.assign(PAGINA.stato, piu);
};
const laSuaRigaDiSoldi = (nome) => {
  coiSoldi();
  return PAGINA.tutteLeLicenze().find((riga) => riga.nome === nome);
};

test("ogni abbonamento dice il piano, anche in prova; se non si sa, lo dice", () => {
  assert.equal(laSuaRigaDiSoldi("Mensile Apple").pianoDetto, "Mensile");
  assert.equal(laSuaRigaDiSoldi("Annuale Uno").pianoDetto, "Annuale");
  assert.equal(laSuaRigaDiSoldi("Prova Google").pianoDetto, "Mensile");
  assert.equal(laSuaRigaDiSoldi("Prova Apple").pianoDetto, "piano non ancora noto");
  /* Nella cella dell'origine, sotto il negozio. */
  coiSoldi();
  const html = PAGINA.gliAbbonamenti();
  assert.match(
    html,
    /<span class="origine-nome">App Store<\/span><small class="origine-piano">Annuale<\/small>/,
  );
  assert.match(html, /<small class="origine-piano ignoto">piano non ancora noto<\/small>/);
  /* Un regalo non ha piano. */
  assert.equal(laSuaRigaDiSoldi("Il Regalo").pianoDetto, undefined);
});

test("importo previsto e importo reale, stato per stato, senza inventare prezzi", () => {
  const due = (nome) => {
    const una = laSuaRigaDiSoldi(nome);
    return [una.previsto.testo, una.previsto.sotto, una.reale.testo, una.reale.sotto]
      .join(" | ")
      .replace(/ /g, " ");
  };
  const il = (q) => PAGINA.conLArticolo("il", q);
  /* Paga e rinnova: il previsto dal piano, il reale col giorno. */
  assert.equal(due("Mensile Apple"), `4,99 €/mese |  | 4,99 € | pagato ${il(ADESSO_PAGATO)}`);
  assert.equal(due("Annuale Uno"), `49,99 €/anno |  | 49,99 € | pagato ${il(PRIMA)}`);
  /* In prova: il previsto e' futuro, il reale non c'e'. */
  const prova = laSuaRigaDiSoldi("Prova Google");
  assert.equal(prova.previsto.futuro, true);
  assert.equal(
    due("Prova Google"),
    `4,99 €/mese | ${PAGINA.conLArticolo("dal", ORA + 5 * GIORNO)} | — | in prova`.replace(
      / /g,
      " ",
    ),
  );
  /* Apple in prova senza prezzo e senza piano: un prezzo senza piano
   * sarebbe inventato. */
  assert.equal(due("Prova Apple"), "— | prezzo non ancora noto | — | in prova");
  /* Disdetta: il prezzo del piano, in grigio; non paghera' piu', ma ha pagato. */
  const disdetta = laSuaRigaDiSoldi("Disdetta Pagata");
  assert.equal(disdetta.previsto.spento, true);
  assert.equal(disdetta.previsto.conta, null);
  assert.equal(
    due("Disdetta Pagata"),
    `4,99 €/mese | non rinnova | 4,99 € | pagato ${il(ADESSO_PAGATO)}`,
  );
  assert.equal(due("Rimborsata"), "4,99 €/mese | rimborsato | rimborsato | 4,99 € restituiti");
  assert.equal(due("Di Test"), "4,99 €/mese | non conta | — | acquisto di test");
  assert.equal(due("Il Regalo"), "Gratis |  | — | ");
  /* Le due colonne nella tabella, e sulla carta in una riga sola. */
  coiSoldi();
  const html = PAGINA.gliAbbonamenti();
  assert.match(html, /<span class="lic-c-previsto futuro"><b>4,99 €\/mese<\/b>/);
  assert.match(
    soloTesto(html),
    /previsto 4,99 €\/mese dal(?: |l')\d+ \S+ · reale — /,
    "«previsto 4,99 €/mese · reale —» sulla carta",
  );
});

test("in prova con il piano ma senza prezzo: quello dello stesso piano, o il listino", () => {
  const conPrezzo = riga({
    sog: casa(41),
    piano: "annuale",
    prodotto: "gdahome_premium_annuale",
    prezzo: 47.99,
    valuta: "EUR",
    periodo: PRIMA,
    pagato: ORA + 300 * GIORNO,
  });
  const provaAnnuale = riga({
    sog: casa(42),
    piano: "annuale",
    prodotto: "gdahome_premium_annuale",
    prova: true,
    fuInProva: true,
    pagato: ORA + 9 * GIORNO,
  });
  const provaMensile = riga({
    sog: casa(43),
    piano: "mensile",
    prodotto: "gdahome_premium_mensile",
    prova: true,
    fuInProva: true,
    pagato: ORA + 9 * GIORNO,
  });
  const elenco = [conPrezzo, provaAnnuale, provaMensile];
  PAGINA.prepara({
    abbonamenti: risposta(elenco),
    licenze: elenco.map((uno) => dalNegozio(uno)),
    case: [
      [casa(41), "Paga"],
      [casa(42), "Prova Annuale"],
      [casa(43), "Prova Mensile"],
    ],
  });
  const righe = PAGINA.tutteLeLicenze();
  const di = (nome) => righe.find((una) => una.nome === nome);
  const dal = PAGINA.conLArticolo("dal", ORA + 9 * GIORNO);
  /* Lo stesso prodotto paga 47,99 €: quello. */
  assert.equal(di("Prova Annuale").previsto.testo.replace(/\s/g, " "), "47,99 €/anno");
  assert.equal(
    di("Prova Annuale").previsto.sotto.replace(/\s/g, " "),
    `${dal} · di listino`.replace(/\s/g, " "),
  );
  assert.equal(di("Prova Annuale").previsto.conta, "prova");
  /* Nessun mensile che paga: il listino di GdAHome. */
  assert.equal(di("Prova Mensile").previsto.testo.replace(/\s/g, " "), "4,99 €/mese");
  assert.equal(di("Prova Mensile").previsto.alMese, 4.99);
  /* Il reale resta quello del negozio: in prova non ha pagato. */
  assert.equal(di("Prova Mensile").reale.testo, "—");
  /* E nel totale delle prove conta, senza «senza prezzo». */
  const html = PAGINA.gliAbbonamenti();
  assert.doesNotMatch(soloTesto(html), /senza prezzo detto dal negozio/);
});

/* Il testo di una riga di totali. */
const ilTotale = (html, gruppo = null) => {
  const pezzo = gruppo
    ? html.match(new RegExp(`<div class="lic-somma" data-somma="${gruppo}">([\\s\\S]*?)</div>`))
    : html.match(/<div class="lic-somma lic-totale">([\s\S]*?)<\/div>/);
  assert.ok(pezzo, `nessun totale ${gruppo || "in fondo"}`);
  return soloTesto(pezzo[1]).trim();
};

/* I totali con gli spazi normali: i soldi si scrivono con lo spazio fisso. */
const piano = (testo) => testo.replace(/\s/g, " ");

test("i totali: il previsto e' quello che entra alle scadenze, il reale l'«Incassato»", () => {
  const elenco = Object.values(SOLDI);
  const conti = contaGliAbbonamenti(elenco, ORA);
  assert.deepEqual(conti.incassato, { EUR: 9.98 });
  coiSoldi();
  const html = PAGINA.gliAbbonamenti();
  const mese = PAGINA.ilMeseDetto(conti.inizioDelMese);
  const totale = piano(ilTotale(html));
  /* A scadenza ogni abbonamento col prezzo intero del suo piano: un annuale
   * porta 49,99 €, non 4,17 al mese. */
  assert.match(
    totale,
    /Previsto alle prossime scadenze: 1 mensile × 4,99 € \+ 2 annuali × 49,99 € = 104,97 €, dal .+ al .+?\./,
  );
  assert.doesNotMatch(totale, /al mese|\/mese|Ricorrente/);
  /* Le prove a parte, e quella senza prezzo detta. */
  assert.match(
    totale,
    /Le prove, se pagano alla fine: 1 mensile × 4,99 € = 4,99 €, .+; 1 abbonamento senza prezzo detto dal negozio, non contato\./,
  );
  /* Nella colonna: tutto quello che entra alle scadenze, prove comprese. */
  assert.match(totale, /109,96 € alle scadenze, prove comprese/);
  /* Il reale: il mese, come l'Incassato; e la somma degli ultimi pagamenti. */
  assert.ok(totale.includes(`Reale: 9,98 € pagati a ${mese}, come l'«Incassato» in cima.`), totale);
  assert.match(totale, /Ultimi pagamenti in elenco: 109,96 €/);
  assert.match(totale, new RegExp(`9,98 € a ${mese}$`));
  /* Il test non entra da nessuna parte. */
  assert.ok(!totale.includes("114,95"));
});

test("i totali per gruppo: attive, in prova, non rinnovano", () => {
  coiSoldi();
  const html = PAGINA.gliAbbonamenti();
  const mese = PAGINA.ilMeseDetto(contaGliAbbonamenti(Object.values(SOLDI), ORA).inizioDelMese);
  const attive = piano(ilTotale(html, "attiva"));
  assert.match(
    attive,
    /^Totale Attive Alle prossime scadenze: 1 mensile × 4,99 € \+ 2 annuali × 49,99 € = 104,97 €, dal /,
  );
  assert.match(attive, /104,97 € alle scadenze/);
  assert.match(
    attive,
    new RegExp(`Ultimi pagamenti in elenco: 104,97 €, di cui a ${mese} 4,99 €\\.`),
  );
  const prova = piano(ilTotale(html, "prova"));
  assert.match(
    prova,
    /^Totale In prova Se pagano alla fine della prova: 1 mensile × 4,99 € = 4,99 €/,
  );
  assert.match(prova, /4,99 € a fine prova — non hanno pagato/);
  const disdette = piano(ilTotale(html, "nonrinnova"));
  assert.match(disdette, /Non pagheranno più: niente previsto\./);
  assert.match(disdette, new RegExp(`— 4,99 € a ${mese}`));
  /* Le finite e i test non hanno totale. */
  assert.ok(!/data-somma="finita"|data-somma="test"/.test(html));
});

test("i totali seguono i filtri e la ricerca", () => {
  coiSoldi({ fonte: "regalo" });
  let totale = piano(ilTotale(PAGINA.gliAbbonamenti()));
  assert.match(
    totale,
    /^Totale delle licenze filtrate Previsto alle prossime scadenze: nessuno che paga e rinnova\./,
  );
  coiSoldi({ cerca: "annuale uno" });
  totale = piano(ilTotale(PAGINA.gliAbbonamenti()));
  assert.match(totale, /Previsto alle prossime scadenze: 1 annuale × 49,99 € = 49,99 €, il /);
  assert.match(totale, /Ultimi pagamenti in elenco: 49,99 €/);
  coiSoldi();
  PAGINA.scegliIlFiltroDelleLicenze("nonrinnova");
  totale = piano(ilTotale(PAGINA.gliAbbonamenti()));
  assert.match(totale, /Previsto alle prossime scadenze: nessuno che paga e rinnova\./);
  assert.match(totale, /Reale: 4,99 € pagati/);
});

test("il ricorrente si somma intero: due annuali sono 8,33 € al mese, non 8,34", () => {
  const due = [
    riga({ piano: "annuale", prezzo: 49.99, valuta: "EUR" }),
    riga({ piano: "annuale", prezzo: 49.99, valuta: "EUR" }),
  ];
  assert.deepEqual(contaGliAbbonamenti(due, ORA).alMese, { EUR: 8.33 });
  /* Il giorno del pagamento: niente in prova, rimborsato o di test. */
  assert.equal(ilGiornoDelPagamento(riga({ prova: true, periodo: ORA }), ORA), null);
  assert.equal(
    ilGiornoDelPagamento(riga({ finito: "acquisto-rimborsato", periodo: ORA }), ORA),
    null,
  );
  assert.equal(ilGiornoDelPagamento(riga({ sandbox: true, periodo: ORA }), ORA), null);
  assert.equal(ilGiornoDelPagamento(riga({ periodo: ORA - GIORNO }), ORA), ORA - GIORNO);
  /* Mai dopo adesso. */
  assert.equal(ilGiornoDelPagamento(riga({ periodo: ORA + GIORNO }), ORA), ORA);
});

/* I gruppi dell'elenco, in ordine, con quante righe si vedono. */
const iGruppi = (html) =>
  [
    ...html.matchAll(/<section class="lic-gruppo[^"]*" data-gruppo="(\w+)">([\s\S]*?)<\/section>/g),
  ].map(([, quale, dentro]) => `${quale}: ${(dentro.match(/class="lic-riga/g) || []).length}`);

test("la tabella e' a gruppi di stato: finite e test chiusi, e un filtro apre il suo", () => {
  const html = disegna();
  assert.deepEqual(iGruppi(html), [
    "attiva: 6",
    "prova: 1",
    "nonrinnova: 2",
    "finita: 0",
    "test: 0",
  ]);
  assert.match(html, /data-apri-gruppo="finita" aria-expanded="false"/);
  /* Le colonne della tabella. */
  assert.match(
    soloTesto(html),
    /Casa Origine Stato Inizio Scade o rinnova Importo previsto Importo reale/,
  );
  assert.deepEqual(iGruppi(disegna("finita")), ["finita: 4"]);
  /* I nomi di prima portano ancora al posto giusto. */
  for (const diPrima of ["disdetto", "disdetti", "nonrinnovano"])
    assert.deepEqual(iGruppi(disegna(diPrima)), ["nonrinnova: 2"]);
  assert.deepEqual(iGruppi(disegna("paganti")), ["attiva: 6"]);
  /* Aperti a mano, anche le finite e i test. */
  const aperte = disegna("tutte", { aperti: new Set(["finita", "test"]) });
  assert.deepEqual(iGruppi(aperte).slice(3), ["finita: 4", "test: 1"]);
});

test("si filtra per provenienza e si cerca per nome, negozio o installatore", () => {
  assert.deepEqual(iGruppi(disegna("tutte", { fonte: "regalo" })), ["attiva: 3", "finita: 0"]);
  assert.deepEqual(iGruppi(disegna("tutte", { fonte: "installatore" })), ["attiva: 1"]);
  /* «Google» e' Casa Bianchi, e l'acquisto fatto coi tester di Google. */
  assert.deepEqual(iGruppi(disegna("tutte", { cerca: "google" })), ["attiva: 1", "test: 1"]);
  assert.deepEqual(iGruppi(disegna("tutte", { cerca: "impianti rossi" })), ["attiva: 1"]);
  assert.match(
    soloTesto(disegna("tutte", { cerca: "zzz" })),
    /Nessuna licenza qui Nessuna corrisponde a «zzz»\./,
  );
  assert.match(
    soloTesto(disegna("prova", { fonte: "regalo" })),
    /Nessuna licenza qui Nessuna licenza in questo stato: 14 giorni gratis/,
  );
});

test("«Revoca» sta nel menu di ogni licenza che vale, e dice di chi e'", () => {
  const html = disegna("tutte", { aperti: new Set(["finita", "test"]) });
  const revoche = [
    ...html.matchAll(/<button type="button" class="voce-menu male" (data-revoca="[^"]+"[^>]*)>/g),
  ].map(([, attributi]) => attributi);
  /* Le valide: sei attive, una in prova, due che non rinnovano. */
  assert.equal(revoche.length, 9);
  assert.ok(
    revoche.some(
      (uno) =>
        uno.includes(`data-revoca="${NEGOZIO["Casa Rossi"].lic}"`) &&
        uno.includes("data-dal-negozio"),
    ),
  );
  assert.ok(
    revoche.some(
      (uno) =>
        uno.includes('data-revoca="lic_r5"') &&
        uno.includes('data-app="gdanav"') &&
        uno.includes("data-del-telefono"),
    ),
  );
  assert.ok(
    !revoche.some((uno) => uno.includes('data-revoca="lic_r3"')),
    "una revocata non si revoca",
  );
  assert.ok(!revoche.some((uno) => uno.includes(`data-revoca="${NEGOZIO["Casa Gallo"].lic}"`)));
  /* La spiegazione della revoca va nel menu, che la porta. */
  assert.match(html, /<span class="menu-tendina" data-spiega>/);
});

test("in cima i numeri: paganti, prove, chi non rinnova, ricorrente, incassato, case", () => {
  const letto = soloTesto(disegna());
  const mese = PAGINA.ilMeseDetto(ORA);
  /* Chi ha pagato e disdetto e' un pagante che non rinnova. */
  assert.match(letto, /Paganti i .* 3 di cui 1 non rinnova/);
  assert.ok(letto.includes(`In prova i`), letto);
  assert.ok(letto.includes(`2 la prima paga ${il(ORA + 9 * GIORNO)}`), letto);
  assert.ok(letto.includes(`Non rinnovano i`), letto);
  assert.ok(letto.includes(`2 la prima termina ${il(ORA + 4 * GIORNO)}`), letto);
  /* Il ricorrente e' solo di chi rinnova: 4,99 + 49,99/12. */
  assert.match(letto, /Ricorrente i .* ≈ 9,16 € \/mese da 2 paganti che rinnovano/);
  assert.ok(letto.includes(`9,98 € a ${mese} · 2 pagamenti`), letto);
  /* Le case: Premium da qualunque strada, e Base le altre. */
  assert.match(letto, /Case Premium i .* 8 \/14 6 case sono Base/);
  /* Ogni numero ha la sua «i», con la spiegazione lunga. */
  assert.match(letto, /Paganti i Clienti che hanno pagato il periodo in corso/);
  assert.match(letto, /Ricorrente i Quanto entra ogni mese se nessuno disdice/);
  /* E i test non entrano in nessun numero. */
  assert.doesNotMatch(letto, /Paganti i [^]*? 4 di cui/);
});

test("le case per piano, e le entrate dei prossimi trenta giorni", () => {
  const letto = soloTesto(disegna());
  for (const voce of [
    "Pagano un abbonamento 3",
    "In prova gratuita 2",
    "Regalo tuo 2",
    "Dagli installatori 1",
    "Base, gratis 6",
  ])
    assert.ok(letto.includes(voce), `manca «${voce}»`);
  assert.match(letto, /8 Premium su 14/);
  assert.match(
    letto,
    /Rinnovi nei prossimi 30 giorni 4,99 € 1 rinnovo · più 1 prova che può pagare/,
  );
  /* Lo storico non c'e', e si dice. */
  assert.match(letto, /Lo storico mese per mese non c'è/);
});

test("«In arrivo»: i prossimi trenta giorni in ordine, e cosa succede", () => {
  const html = disegna();
  const cose = [
    ...html.matchAll(
      /<b class="arrivo-casa">([^<]*)<\/b>\s*<span class="arrivo-cosa"><i[^>]*><\/i>([^<]*)<\/span>/g,
    ),
  ].map(([, chi, cosa]) => `${chi}: ${cosa.replace(/\u00a0/g, " ").replace(/&#39;/g, "'")}`);
  assert.deepEqual(cose, [
    "Casa Esposito: fine prova, senza pagare",
    "Casa Ferrari: fine prova: comincia a pagare",
    "Casa Greco: finisce la licenza dell'installatore",
    "Casa Rossi: si rinnova · 4,99 €/mese",
    "Casa Romano: termina: ha disdetto",
  ]);
  /* Sulla linea dei trenta giorni, un pallino per scadenza. */
  assert.equal((html.match(/class="lt-punto /g) || []).length, 5);
});

test("«Come funziona» dice le regole vere, in cinque carte chiuse finche' non servono", () => {
  const html = disegna();
  assert.match(html, /<details class="come-funziona" data-glossario>/);
  const letto = soloTesto(html);
  for (const regola of [
    "Base è gratis e non scade",
    "4,99 € al mese o 49,99 € all'anno",
    "14 giorni gratis, poi paga se non disdice",
    "3 giorni di margine",
    "Una revoca vale subito; una casa senza internet resta Premium al massimo otto giorni",
    "Ricorrente: quanto entra ogni mese se nessuno disdice",
  ])
    assert.ok(letto.includes(regola), `manca «${regola}»`);
  assert.equal((html.match(/<li>\s*<span class="tondino">/g) || []).length, 5);
});

test("i numeri sono quelli del quadro, anche quando l'elenco e' tagliato", () => {
  const tutta = risposta(ELENCO);
  prepara({ ...tutta, elenco: ELENCO.slice(0, 2) });
  const letto = soloTesto(PAGINA.gliAbbonamenti());
  assert.match(letto, /Paganti i .* 3 di cui 1 non rinnova/);
  assert.match(letto, /l'elenco mostra i primi 2: i numeri in cima li contano tutti e 9\./);
});

test("senza abbonamenti si dice, e i regali si vedono lo stesso", () => {
  prepara(null);
  const html = PAGINA.gliAbbonamenti();
  assert.match(html, /<b>Gli abbonamenti non sono arrivati<\/b>/);
  assert.match(soloTesto(html), /Casa Marino/);
});

test("un quadro di prima, senza i conti nuovi: chi ha pagato e disdetto e' fra i paganti", () => {
  /* Il quadro si aggiorna da main insieme alla pagina, ma una pagina gia'
   * aperta puo' ricevere i conti di prima per un giro. */
  const vecchi = {
    tutti: 3,
    paganti: 0,
    inProva: 1,
    disdetti: 2,
    disdettiInProva: 1,
    pagatiDisdetti: 1,
    primaFinePagatiDisdetti: ORA + 30 * GIORNO,
    finiti: 0,
    test: 0,
    alMese: {},
    incassato: {},
    pagamenti: 0,
  };
  const elenco = [
    {
      ...riga({ rinnovo: false, prezzo: 4.99, valuta: "EUR" }),
      gruppo: undefined,
      nonRinnova: undefined,
    },
  ];
  PAGINA.prepara({ abbonamenti: { accese: true, conti: vecchi, negozi: {}, elenco } });
  const letto = soloTesto(PAGINA.gliAbbonamenti());
  assert.match(letto, /Paganti i .* 1 di cui 1 non rinnova/);
  assert.match(letto, /In prova i .* 2 /);
  assert.match(letto, /Non rinnovano i .* 2 /);
});

test("nella scheda di una casa: Premium o Base, e perche'", () => {
  prepara();
  const romano = soloTesto(PAGINA.laLicenzaDellaCasa(casa(5)));
  assert.match(romano, /Questa casa è Premium Grazie a: App Store · abbonamento mensile\./);
  assert.match(romano, /GdAHome Premium Ha disdetto: il periodo è già pagato/);
  assert.match(romano, /Non rinnova/);
  const moretti = soloTesto(PAGINA.laLicenzaDellaCasa(casa(13)));
  assert.match(moretti, /Questa casa è Base Nessuna licenza: la casa usa GdAHome gratis/);
  const conti = soloTesto(PAGINA.laLicenzaDellaCasa(casa(11)));
  assert.match(conti, /Questa casa è Base .*L'ultima licenza: revocata\./);
  assert.match(conti, /Licenze finite · 1/);
});

/* ─── Chi ha pagato e poi ha disdetto ─────────────────────────────────────
 *
 * «Non mi trovo con gli incassi: uno ha finito il periodo gratuito, ha pagato
 * e poi ha disdetto — vedi che termina il 4 dicembre». La pagina diceva
 * «Paganti 0, nessuno ha ancora pagato» e «Incassi al mese 0 €». Poi «gia'
 * incassato» e «ricorrente» sono diventati due cose, ma «vedo che paganti hai
 * ancora 0»: chi ha pagato e disdetto e' un pagante che non rinnova. */

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

test("i conti: chi ha pagato e disdetto e' un pagante che non rinnova, caso per caso", () => {
  const c = contaGliAbbonamenti(Object.values(UN_CASO_PER_TIPO), NOVEMBRE);
  /* I gruppi: ognuno in uno solo, e sommano. */
  assert.equal(c.paganti, 2, "chi paga, e chi ha pagato e disdetto");
  assert.equal(c.pagantiRinnovano, 1);
  assert.equal(c.pagantiNonRinnovano, 1);
  assert.equal(c.primaFinePagantiNonRinnovano, g("2026-12-04T08:00:00.000Z"));
  assert.equal(c.inProva, 2, "la prova, e quella disdetta");
  assert.equal(c.proveNonRinnovano, 1);
  assert.equal(c.nonRinnovano, 2);
  assert.equal(c.finiti, 3);
  assert.equal(c.test, 1);
  assert.equal(c.paganti + c.inProva + c.finiti + c.test, c.tutti);
  /* I nomi di prima, per chi li legge ancora. */
  assert.equal(c.disdetti, 2);
  assert.equal(c.pagatiDisdetti, 1);
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

test("il caso dello screenshot da solo: 1 pagante che non rinnova, 4,99 € incassati", () => {
  const { pagatoEDisdetto, provaInCorso } = UN_CASO_PER_TIPO;
  const c = contaGliAbbonamenti([pagatoEDisdetto, provaInCorso], NOVEMBRE);
  assert.equal(c.paganti, 1, "paganti: non piu' 0");
  assert.equal(c.pagantiRinnovano, 0);
  assert.equal(c.pagantiNonRinnovano, 1);
  assert.deepEqual(c.alMese, {}, "nessuno rinnova: il ricorrente e' zero");
  assert.equal(c.hannoPagato, 1);
  assert.deepEqual(c.incassato, { EUR: 4.99 }, "e i 4,99 € li ha dati");
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
