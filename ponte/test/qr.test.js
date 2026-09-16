/* Le prove del QR code.
 *
 * Un encoder QR sbagliato non si vede: fa un quadrato che sembra un QR e che
 * nessun telefono legge. Non c'e' modo di guardarlo e dire «e' giusto» —
 * quindi qui non si guarda, si confronta. I vettori in `qr-riferimento.js`
 * vengono da `qrcode`, la libreria Python che sta dentro mezzo mondo, e sono
 * l'impronta della matrice quadretto per quadretto: se un giorno il nostro
 * disegno si scosta anche di un solo quadretto, questa prova diventa rossa.
 *
 * I vettori li rifa' `strumenti/qr-riferimento.py`, a mano, e solo quando si
 * mette le mani in `qr.js`. Le prove non hanno bisogno ne' di Python ne' di
 * rete: leggono un file e basta.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { qr, qrInSvg, TroppoLungo } from "../src/qr.js";
import { VETTORI, IL_DISEGNO_PICCOLO, IL_DISEGNO_CON_LA_VERSIONE } from "./qr-riferimento.js";

const righe = (matrice) => matrice.map((r) => r.map((q) => (q ? "1" : "0")).join(""));
const impronta = (matrice) =>
  createHash("sha256").update(righe(matrice).join("\n")).digest("hex").slice(0, 16);
const disegno = (matrice) => matrice.map((r) => r.map((q) => (q ? "#" : ".")).join("")).join("\n");

/* ─── Il confronto col riferimento ───────────────────────────────────────── */

test("ogni matrice combacia col riferimento, con tutte e otto le maschere", () => {
  for (const vettore of VETTORI) {
    const come = `«${vettore.testo.slice(0, 24)}» (${vettore.testo.length} lettere)`;
    for (let maschera = 0; maschera < 8; maschera += 1) {
      assert.equal(
        impronta(qr(vettore.testo, { maschera })),
        vettore.impronte[maschera + 1],
        `${come}, maschera ${maschera}`,
      );
    }
  }
});

test("la maschera che sceglie e' quella che sceglie il riferimento", () => {
  /* La bruttezza non cambia se un QR si legge: cambia **quale** degli otto QR
   * buoni esce. Ma e' proprio la parte che si sbaglia in silenzio, perche' il
   * risultato sembra giusto lo stesso. */
  for (const vettore of VETTORI) {
    assert.equal(
      impronta(qr(vettore.testo)),
      vettore.impronte[0],
      `«${vettore.testo.slice(0, 24)}»: doveva scegliere la maschera ${vettore.maschera}`,
    );
  }
});

test("la versione e' la piu' piccola in cui ci sta, come dice il riferimento", () => {
  for (const vettore of VETTORI) {
    const lato = qr(vettore.testo).length;
    assert.equal((lato - 17) / 4, vettore.versione, `«${vettore.testo.slice(0, 24)}»`);
  }
});

test("i due disegni interi, quadretto per quadretto", () => {
  /* Le impronte dicono «e' cambiato qualcosa» e non dicono altro. Questi due
   * si leggono a occhio: un mirino storto si vede in tre secondi. */
  assert.equal(disegno(qr(IL_DISEGNO_PICCOLO.testo)), IL_DISEGNO_PICCOLO.disegno);
  assert.equal(disegno(qr(IL_DISEGNO_CON_LA_VERSIONE.testo)), IL_DISEGNO_CON_LA_VERSIONE.disegno);
});

test("i vettori coprono tutte e quindici le versioni", () => {
  /* Una prova sulla prova: se qualcuno un giorno rigenera i vettori con meno
   * casi, il buco si vede subito invece che il giorno che non si legge. */
  const viste = new Set(VETTORI.map((v) => v.versione));
  for (let v = 1; v <= 15; v += 1) assert.equal(viste.has(v), true, `manca la versione ${v}`);
});

/* ─── Che sia un QR, e non un quadrato qualunque ─────────────────────────── */

const unMirino = (matrice, riga, colonna) => {
  for (let i = 0; i < 7; i += 1) {
    for (let j = 0; j < 7; j += 1) {
      const bordo = i === 0 || i === 6 || j === 0 || j === 6;
      const cuore = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      assert.equal(
        matrice[riga + i][colonna + j],
        bordo || cuore,
        `il mirino in ${riga},${colonna} e' storto in ${i},${j}`,
      );
    }
  }
};

test("ci sono i tre mirini, i righelli e il quadretto sempre nero", () => {
  for (const testo of ["gdahome", "a".repeat(300)]) {
    const m = qr(testo);
    const lato = m.length;
    unMirino(m, 0, 0);
    unMirino(m, 0, lato - 7);
    unMirino(m, lato - 7, 0);

    for (let i = 8; i < lato - 8; i += 1) {
      assert.equal(m[6][i], i % 2 === 0, `il righello di sopra sbaglia in ${i}`);
      assert.equal(m[i][6], i % 2 === 0, `il righello di lato sbaglia in ${i}`);
    }
    assert.equal(m[lato - 8][8], true, "il quadretto sempre nero non c'e'");
  }
});

test("nessun quadretto resta indeciso", () => {
  /* Un `null` in mezzo vuol dire un posto che non ha scritto nessuno: chi
   * legge ci vede quello che gli pare. */
  for (const testo of ["a", "gdahome", "x".repeat(122), "y".repeat(412)]) {
    for (const riga of qr(testo)) {
      for (const quadretto of riga) assert.equal(typeof quadretto, "boolean");
    }
  }
});

test("la matrice e' quadrata e della misura giusta", () => {
  const m = qr("gdahome");
  assert.equal(m.length, 21);
  for (const riga of m) assert.equal(riga.length, 21);
});

/* ─── I bordi ────────────────────────────────────────────────────────────── */

test("gli accenti e le emoji contano in byte, non in lettere", () => {
  /* Quattrocentododici lettere ci stanno; quattrocentododici emoji no, e chi
   * conta le lettere se ne accorge solo quando il QR esce sbagliato. */
  const emoji = "\u{1f3e0}"; // quattro byte l'una
  /* Cento emoji sono quattrocento byte: ci stanno per un pelo, nella versione
   * piu' grande che sappiamo fare. Chi contasse le lettere direbbe «cento» e
   * sceglierebbe una versione da niente, e il QR uscirebbe monco. */
  assert.equal(qr(emoji.repeat(100)).length, 15 * 4 + 17);
  assert.doesNotThrow(() => qr(emoji.repeat(103))); // quattrocentododici in punto
  assert.throws(() => qr(emoji.repeat(104)), TroppoLungo);
});

test("quello che non ci sta lo dice, invece di disegnare un QR rotto", () => {
  assert.doesNotThrow(() => qr("a".repeat(412)));
  assert.throws(() => qr("a".repeat(413)), TroppoLungo);
  assert.throws(() => qr("a".repeat(413)), /413/);
});

test("lo stesso testo fa sempre lo stesso disegno", () => {
  assert.equal(impronta(qr("gdahome")), impronta(qr("gdahome")));
});

/* ─── Il disegno per la console ──────────────────────────────────────────── */

test("l'SVG ha dentro il QR, col suo bordo bianco", () => {
  const svg = qrInSvg("gdahome");
  /* Quattro quadretti di bordo per parte: senza, chi legge non trova i
   * mirini, e il QR non si legge nemmeno se e' perfetto. */
  assert.match(svg, /viewBox="0 0 29 29"/);
  assert.match(svg, /<rect width="29" height="29" fill="#fff"\/>/);
  assert.equal((svg.match(/<path /g) || []).length, 1, "un tracciato solo, non mille rettangoli");
  const quanti = (svg.match(/M\d+ \d+h1v1h-1z/g) || []).length;
  const neri = qr("gdahome").flat().filter(Boolean).length;
  assert.equal(quanti, neri);
});

test("il bordo si puo' togliere, e il titolo finisce nell'etichetta", () => {
  assert.match(qrInSvg("a", { bordo: 0 }), /viewBox="0 0 21 21"/);
  assert.match(qrInSvg("a", { titolo: "Inquadrami" }), /aria-label="Inquadrami"/);
});

test("un titolo con dentro le virgolette non esce dall'attributo", () => {
  const svg = qrInSvg("a", { titolo: '"><script>alert(1)</script>' });
  assert.equal(svg.includes("<script>"), false);
  assert.match(svg, /aria-label="&quot;&gt;&lt;script&gt;/);
});
