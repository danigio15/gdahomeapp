/* Il nome di una voce della barra non si taglia coi puntini.
 *
 * «Il nome deve leggersi»: su un iPhone la barra diceva «ELETTRO…» e
 * «GESTIONE…». Il foglio del tocco (legacy/dashboard-runtime-it.css) taglia
 * ancora coi puntini — e' vendorizzato e non si tocca — e la plancia lo batte
 * da navigation-section.js: il nome va a capo, si rimpicciolisce fino a nove
 * punti e mezzo, e una parola troppo lunga si spezza fra due sillabe.
 *
 * Qui i conti, senza browser: dove si spezzano le parole, quanto e' larga una
 * voce, quando un nome si rimpicciolisce e quando no. La barra disegnata la
 * guarda la prova e2e «il-nome-della-voce-si-legge-tutto».
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sorgente = new URL("../src/sections/navigation-section.js", import.meta.url);
const testo = await readFile(sorgente, "utf8");
const {
  TESTO_MINIMO,
  TESTO_DI_SERIE,
  VOCE_MINIMA,
  comeStaIlNome,
  disponiLeVoci,
  larghezzaPerRighe,
  sillabeDi,
  spezzaLaParola,
  tagliaAMeta,
} = await import(sorgente.href);

/* Una misura finta ma onesta: ogni lettera larga 0,68 del corpo, lo spazio
 * un terzo. E' la proporzione di un maiuscolo nero come quello della barra. */
const misuraCon = (px) => (s) =>
  [...s].reduce((somma, c) => somma + (c === " " ? px * 0.3 : px * 0.68), 0);

const spezza = (parola) => {
  const taglio = tagliaAMeta(parola);
  return taglio < 0 ? parola : `${parola.slice(0, taglio)}-${parola.slice(taglio)}`;
};

test("le parole si spezzano fra due sillabe, vicino a meta'", () => {
  assert.equal(spezza("Elettrodomestici"), "Elettro-domestici");
  assert.equal(spezza("Riscaldamento"), "Riscal-damento");
  assert.equal(spezza("Automazioni"), "Automa-zioni");
  assert.equal(spezza("Climatizzazione"), "Climatiz-zazione");
  assert.equal(spezza("Fotovoltaico"), "Fotovol-taico");
});

test("le regole delle sillabe: doppie, liquide, s impura, gruppi", () => {
  const pezzi = (parola) => {
    const lettere = [...parola];
    let prima = 0;
    const fuori = [];
    for (const taglio of sillabeDi(parola)) {
      fuori.push(lettere.slice(prima, taglio).join(""));
      prima = taglio;
    }
    fuori.push(lettere.slice(prima).join(""));
    return fuori.join("-");
  };
  /* Un pezzo di meno di tre lettere non si stacca: «e-lettro» no. */
  assert.equal(pezzi("elettrodomestici"), "elet-tro-do-me-stici");
  assert.equal(pezzi("pastasciutta"), "pasta-sciutta");
  assert.equal(pezzi("altalena"), "alta-lena");
  assert.equal(pezzi("acquario"), "acqua-rio");
  assert.equal(pezzi("climatizzazione"), "cli-ma-tiz-za-zione");
  /* Parole corte, sigle e cose che non sono parole non si toccano. */
  assert.deepEqual(sillabeDi("Home"), []);
  assert.deepEqual(sillabeDi("MiniPC2"), []);
  assert.deepEqual(sillabeDi("e-bike"), []);
});

test("una parola si spezza solo se e' troppo larga, e i pezzi solo se molto", () => {
  const largo = (p) => p.length > 9;
  assert.deepEqual(spezzaLaParola("Energia", largo), ["Energia"]);
  assert.deepEqual(
    spezzaLaParola("Elettrodomestici", largo, (p) => p.length > 14),
    ["Elettro", "domestici"],
  );
});

test("la larghezza minima per stare in due righe", () => {
  const gettoni = [
    { w: 50, dopo: 3 },
    { w: 30, dopo: 3 },
    { w: 25, dopo: 0 },
  ];
  assert.equal(larghezzaPerRighe(gettoni, 1), 111);
  /* «GESTIONE / DELLA CASA» costa 58, «GESTIONE DELLA / CASA» 83. */
  assert.equal(larghezzaPerRighe(gettoni, 2), 58);
  assert.equal(larghezzaPerRighe(gettoni, 3), 50);
});

test("un nome che sta su una riga resta su una riga", () => {
  const come = comeStaIlNome("Clima", misuraCon(10), 60);
  assert.equal(come.righe, 1);
  assert.deepEqual(come.parole, [["Clima"]]);
});

test("«Gestione della casa» va su due righe senza spezzare parole", () => {
  const come = comeStaIlNome("Gestione della casa", misuraCon(10), 52);
  assert.equal(come.righe, 2);
  assert.deepEqual(come.parole, [["Gestione"], ["della"], ["casa"]]);
});

test("«Elettrodomestici» si spezza in «Elettro / domestici»", () => {
  const come = comeStaIlNome("Elettrodomestici", misuraCon(10), 52);
  assert.equal(come.righe, 2);
  assert.deepEqual(come.parole, [["Elettro", "domestici"]]);
  assert.ok(come.larghezza < misuraCon(10)("Elettrodomestici"));
});

test("un nome lunghissimo va al massimo su tre righe", () => {
  const come = comeStaIlNome("Climatizzazione e riscaldamento centralizzato", misuraCon(10), 52);
  assert.ok(come.righe <= 3);
});

test("se le voci non ci stanno, i nomi lunghi si rimpiccioliscono, mai sotto il minimo", () => {
  const nomi = ["Home", "Energia", "Elettrodomestici", "Auto", "Gestione della casa", "Clima"];
  const larghe = disponiLeVoci(nomi, { misuraCon, riga: 1000, posto: 52 });
  assert.ok(larghe.every((voce) => voce.testo === TESTO_DI_SERIE));
  const somma = larghe.reduce((s, voce) => s + voce.larga, 0);
  const strette = disponiLeVoci(nomi, { misuraCon, riga: somma - 6, posto: 52 });
  assert.ok(strette.reduce((s, voce) => s + voce.larga, 0) <= somma - 6);
  assert.ok(strette.some((voce) => voce.testo < TESTO_DI_SERIE));
  assert.ok(strette.every((voce) => voce.testo >= TESTO_MINIMO));
  /* Solo quelle lunghe: un nome corto non ha niente da guadagnare. */
  assert.equal(strette.find((voce) => voce.nome === "Home").testo, TESTO_DI_SERIE);
  assert.ok(strette.every((voce) => voce.larga >= VOCE_MINIMA));
});

test("se non ci stanno nemmeno col nome al minimo, si torna alla misura piena e si scorre", () => {
  const nomi = Array.from({ length: 9 }, () => "Elettrodomestici");
  const voci = disponiLeVoci(nomi, { misuraCon, riga: 300, posto: 52 });
  assert.ok(voci.every((voce) => voce.testo === TESTO_DI_SERIE));
});

test("il foglio della barra non taglia piu' coi puntini", () => {
  assert.match(
    testo,
    /html body nav\.tabs\.bottom-nav-bar \.tab \.text\{text-overflow:clip!important\}/,
  );
  const blocco = testo.slice(
    testo.indexOf("@media not all and (min-width:768px) and (min-height:600px){"),
  );
  assert.match(
    blocco,
    /white-space:normal!important;overflow:visible!important;text-overflow:clip!important/,
  );
  assert.match(blocco, /min-width:var\(--dm-voce-larga,/);
  assert.match(blocco, /font-size:var\(--dm-voce-testo,/);
  /* Anche la voce aperta: il foglio del tocco le da' «flex: 0 0 auto» con un
   * selettore piu' pesante. */
  assert.match(blocco, /html body nav\.tabs\.bottom-nav-bar \.tab\.active\{/);
  assert.ok(TESTO_MINIMO >= 9.5, "sotto i nove punti e mezzo un nome non si legge");
});
