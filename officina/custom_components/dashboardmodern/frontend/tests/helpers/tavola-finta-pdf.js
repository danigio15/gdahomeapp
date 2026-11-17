/* Una tavola finta per le prove della pianta dal PDF: fatta come quelle vere
 * (una pianta A3 a 1:50 di un architetto) e con nomi inventati, scritta a mano
 * in PDF. Muri a contorno con il retino, tramezzi, porte ad arco tratteggiate,
 * finestre, un balcone col parapetto, l'ascensore (il riquadro con le
 * diagonali), le altre unita' a tratto e punto, le scale, le quote con le
 * tacche e i loro numeri, il cartiglio, il titolo con «scala 1:50» e i nomi
 * delle stanze coi metri quadri.
 *
 * La usano la prova in Node (`la-pianta-dal-pdf.test.js`) e quella nel
 * browser (`e2e/la-casa-3d.spec.js`). */

import { letteraDelModello } from "../../src/core/scritte-disegnate.js";

const H_PAGINA = 1191; // A3 verticale, in punti
const W_PAGINA = 842;

/* `scala`: quella del disegno; `scritta`: quella scritta sul foglio (di
 * solito la stessa); `testoDisegnato`: le scritte come figure, senza testo;
 * `senzaQuote`: le righe di quota restano, i loro numeri no. */
export function tavolaFinta({
  scala = 50,
  scritta = scala,
  testoDisegnato = false,
  senzaQuote = false,
} = {}) {
  const K = (1000 / scala) * (72 / 25.4); // punti per metro
  const OX = 150,
    OY = 220;
  const P = (x, y) => [OX + x * K, H_PAGINA - (OY + y * K)];
  const f = (v) => v.toFixed(2);
  const out = [];
  const penna = (rgb, w) => out.push(`${rgb.map(f).join(" ")} RG ${f(w)} w`);
  const riga = (x0, y0, x1, y1) => {
    const [a, b] = P(x0, y0),
      [c, d] = P(x1, y1);
    out.push(`${f(a)} ${f(b)} m ${f(c)} ${f(d)} l S`);
  };
  /* in punti della pagina, y verso il basso */
  const rigaPt = (x0, y0, x1, y1) =>
    out.push(`${f(x0)} ${f(H_PAGINA - y0)} m ${f(x1)} ${f(H_PAGINA - y1)} l S`);

  /* i muri: rettangoli, coi varchi */
  const muri = [];
  const muro = (x0, y0, x1, y1, varchi = []) => {
    const oriz = x1 - x0 >= y1 - y0;
    let pezzi = [[oriz ? x0 : y0, oriz ? x1 : y1]];
    for (const [v0, v1] of varchi)
      pezzi = pezzi.flatMap(([a, b]) =>
        v1 <= a || v0 >= b
          ? [[a, b]]
          : [...(v0 > a ? [[a, v0]] : []), ...(v1 < b ? [[v1, b]] : [])],
      );
    for (const [a, b] of pezzi) muri.push(oriz ? [a, y0, b, y1] : [x0, a, x1, b]);
  };
  // fuori: 30 cm
  muro(0, 0, 10, 0.3, [
    [1.5, 3.0],
    [4.0, 5.4],
    [7.0, 8.4],
  ]);
  muro(0, 7.7, 10, 8, [
    [4.0, 4.9],
    [8.0, 9.2],
  ]);
  muro(0, 0.3, 0.3, 7.7, [[5.5, 6.5]]);
  muro(9.7, 0.3, 10, 7.7);
  // tramezzi: 10 cm
  muro(6.0, 0.3, 6.1, 4.5, [[3.0, 3.8]]);
  muro(0.3, 4.5, 9.7, 4.6, [[4.0, 4.8]]);
  muro(3.0, 4.6, 3.1, 7.7, [[5.0, 5.8]]);
  muro(6.0, 4.6, 6.1, 6.0);
  muro(6.1, 5.9, 7.6, 6.0, [[6.4, 7.2]]);
  muro(7.6, 4.6, 7.7, 7.7, [[6.4, 7.2]]);
  // l'ascensore, fuori dalla casa: muri da 20 cm e le due diagonali
  muro(10, 5.0, 11.6, 5.2);
  muro(10, 6.4, 11.6, 6.6);
  muro(11.4, 5.2, 11.6, 6.4);

  /* il retino: righe a 45 gradi ogni 0,6 mm di foglio, dentro ogni muro */
  penna([0.6, 0.6, 0.6], 0.24);
  const passoRetino = 0.6 / ((1000 / scala) * 1); // in metri: 0,6 mm di foglio
  for (const [x0, y0, x1, y1] of muri)
    for (let c = x0 - (y1 - y0); c < x1; c += passoRetino) {
      // la retta x - y = c - y0 dentro il rettangolo
      const a = [Math.max(x0, c), y0 + Math.max(x0, c) - c];
      const b = [Math.min(x1, c + (y1 - y0)), y0 + Math.min(x1, c + (y1 - y0)) - c];
      if (b[0] - a[0] > 1e-4) riga(a[0], a[1], b[0], b[1]);
    }
  /* il contorno dei muri */
  penna([0, 0, 0], 0.84);
  for (const [x0, y0, x1, y1] of muri) {
    riga(x0, y0, x1, y0);
    riga(x1, y0, x1, y1);
    riga(x1, y1, x0, y1);
    riga(x0, y1, x0, y0);
  }
  riga(10, 5.2, 11.4, 6.4);
  riga(10, 6.4, 11.4, 5.2);

  /* le finestre: due righe nel varco, nel mezzo del muro */
  penna([0.46, 0.46, 0.46], 0.24);
  const finestra = (x0, y0, x1, y1) => {
    if (y1 - y0 < x1 - x0)
      for (const d of [-0.04, 0.04]) riga(x0, (y0 + y1) / 2 + d, x1, (y0 + y1) / 2 + d);
    else for (const d of [-0.04, 0.04]) riga((x0 + x1) / 2 + d, y0, (x0 + x1) / 2 + d, y1);
  };
  finestra(1.5, 0, 3.0, 0.3);
  finestra(4.0, 0, 5.4, 0.3); // la portafinestra sul balcone
  finestra(7.0, 0, 8.4, 0.3);
  finestra(0, 5.5, 0.3, 6.5);
  finestra(8.0, 7.7, 9.2, 8);

  /* le porte: l'anta aperta e l'arco a trattini, dalla cerniera c, chiusa
   * verso u, aperta verso v */
  penna([0, 0, 0], 0.24);
  const porta = (cx, cy, [ux, uy], [vx, vy], r) => {
    const giro = (r * Math.PI) / 2;
    for (let s = 0; s < giro; s += 0.15) {
      const t0 = s / r,
        t1 = Math.min(giro, s + 0.1) / r;
      const p = (t) => [
        cx + r * (Math.cos(t) * ux + Math.sin(t) * vx),
        cy + r * (Math.cos(t) * uy + Math.sin(t) * vy),
      ];
      const [a, b] = p(t0),
        [c, d] = p(t1);
      riga(a, b, c, d);
    }
    // l'anta: un rettangolino lungo quanto la porta
    const [ax, ay] = [cx + vx * r, cy + vy * r];
    riga(cx, cy, ax, ay);
    riga(cx + ux * 0.04, cy + uy * 0.04, ax + ux * 0.04, ay + uy * 0.04);
  };
  porta(4.0, 4.5, [1, 0], [0, -1], 0.8); // soggiorno
  porta(6.1, 3.0, [0, 1], [1, 0], 0.8); // camera
  porta(3.0, 5.0, [0, 1], [-1, 0], 0.8); // bagno
  porta(6.4, 6.0, [1, 0], [0, 1], 0.8); // ripostiglio
  porta(7.7, 6.4, [0, 1], [1, 0], 0.8); // cameretta
  porta(4.0, 7.7, [1, 0], [0, -1], 0.9); // l'ingresso

  /* il balcone: il parapetto a due righe sottili */
  for (const d of [0, 0.05]) {
    riga(0 + d, -1.4 + d, 6.0 - d, -1.4 + d);
    riga(0 + d, -1.4 + d, 0 + d, 0);
    riga(6.0 - d, -1.4 + d, 6.0 - d, 0);
  }
  /* le scale del condominio: i gradini, a destra */
  for (let y = 0.6; y < 4.4; y += 0.3) riga(10.3, y, 11.6, y);
  riga(10.3, 0.6, 10.3, 4.2);

  /* le altre unita': righe a tratto e punto, spesse */
  penna([0, 0, 0], 1.08);
  const trattoPunto = (x0, y0, x1, y1) => {
    const l = Math.hypot(x1 - x0, y1 - y0),
      ux = (x1 - x0) / l,
      uy = (y1 - y0) / l;
    for (let s = 0; s < l; s += 0.4) {
      const e = Math.min(l, s + 0.22);
      riga(x0 + ux * s, y0 + uy * s, x0 + ux * e, y0 + uy * e);
      const p = Math.min(l, s + 0.3);
      riga(
        x0 + ux * p,
        y0 + uy * p,
        x0 + ux * Math.min(l, p + 0.02),
        y0 + uy * Math.min(l, p + 0.02),
      );
    }
  };
  trattoPunto(-0.05, -1.5, -0.05, 9);
  trattoPunto(-2.2, 0, -0.05, 0);
  trattoPunto(-2.2, 8, -0.05, 8);

  /* le quote: righe grigie con le tacche piene in cima, anche in mezzo
   * alle stanze */
  penna([0.33, 0.33, 0.33], 0.24);
  const tacche = [];
  const quota = (x0, y0, x1, y1) => {
    riga(x0, y0, x1, y1);
    tacche.push([x0, y0], [x1, y1]);
  };
  quota(0.3, 2.0, 6.0, 2.0);
  quota(6.1, 1.2, 9.7, 1.2);
  quota(-0.8, 0, -0.8, 8);
  quota(0, -2.0, 10, -2.0);
  quota(1.5, 6.0, 1.5, 7.7);
  /* il cartiglio: la cornice e le righe, con la penna delle quote */
  for (const y of [1000, 1030, 1060, 1090, 1120, 1150]) rigaPt(40, y, 802, y);
  rigaPt(40, 1000, 40, 1150);
  rigaPt(802, 1000, 802, 1150);
  rigaPt(400, 1090, 400, 1150);
  out.push(`${[0.33, 0.33, 0.33].map(f).join(" ")} rg`);
  for (const [x, y] of tacche) {
    const [a, b] = P(x, y),
      s = 1.6;
    out.push(
      `${f(a - s)} ${f(b - s)} m ${f(a - s + 0.8)} ${f(b - s)} l ${f(a + s)} ${f(b + s)} l ${f(a + s - 0.8)} ${f(b + s)} l h f`,
    );
  }

  /* le scritte */
  out.push("0 0 0 rg");
  const scrittaPt = (x, yGiu, testo, corpo) => {
    if (!testoDisegnato) {
      out.push(`BT /F1 ${corpo} Tf ${f(x)} ${f(H_PAGINA - yGiu)} Td (${testo}) Tj ET`);
      return;
    }
    /* disegnata: ogni lettera un percorso di quadratini pieni */
    const cap = corpo * 0.72;
    let cx = x;
    for (const c of testo) {
      if (c === " ") {
        cx += cap * 0.6;
        continue;
      }
      const L = letteraDelModello(c);
      if (!L) continue;
      const h = L.h * cap,
        w = L.a * h,
        top = yGiu - cap + L.t * cap;
      const quadri = L.quadratini.map(
        ([a, b, c2, d]) =>
          `${f(cx + a * w)} ${f(H_PAGINA - (top + d * h))} ${f((c2 - a) * w + 0.01)} ${f((d - b) * h + 0.01)} re`,
      );
      out.push(`${quadri.join(" ")} f`);
      cx += w + cap * 0.18;
    }
  };
  const scrittaM = (x, y, testo, corpo = 9) => {
    const [a, b] = P(x, y);
    scrittaPt(a, H_PAGINA - b, testo, corpo);
  };
  scrittaPt(60, 60, "PIANTA PIANO PRIMO", 14);
  scrittaPt(60, 80, `scala 1:${scritta}`, 14);
  const stanza = (x, y, nome, mq) => {
    scrittaM(x, y, nome);
    if (mq) scrittaM(x, y + 0.35, `${mq} mq`);
  };
  stanza(2.0, 3.0, "SOGGIORNO", "23,94");
  stanza(7.2, 2.6, "CAMERA", "15,12");
  stanza(0.8, 6.8, "BAGNO", "8,37");
  stanza(3.8, 6.6, "INGRESSO", "11,71");
  stanza(6.3, 5.0, "RIP.", "1,95");
  stanza(7.9, 5.4, "CAMERETTA", "6,20");
  stanza(2.4, -0.8, "BALCONE", "");
  scrittaM(-1.9, 4.0, "Altra U.I.", 11);
  if (!senzaQuote) {
    scrittaM(2.9, 1.9, "5.70", 6);
    scrittaM(7.7, 1.1, "3.60", 6);
    scrittaM(4.7, -2.1, "10.00", 6);
  }
  scrittaPt(60, 1020, "Committente: Mario Rossi - Via delle Prove 1", 8);
  scrittaPt(60, 1110, "Tavola 03", 8);
  scrittaPt(420, 1110, `Scala 1:${scritta}`, 8);

  return pdfDa(out.join("\n"));
}

/* Un PDF di una pagina, col suo contenuto, scritto a mano. */
function pdfDa(contenuto) {
  const oggetti = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W_PAGINA} ${H_PAGINA}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${Buffer.byteLength(contenuto)} >>\nstream\n${contenuto}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const posti = [];
  oggetti.forEach((o, i) => {
    posti.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${oggetti.length + 1}\n0000000000 65535 f \n`;
  for (const p of posti) pdf += `${String(p).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${oggetti.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

/** Le aree vere delle stanze della tavola, in metri quadri. */
export const AREE_DELLA_TAVOLA = Object.freeze({
  Soggiorno: 23.94,
  Camera: 15.12,
  Bagno: 8.37,
  Ingresso: 11.71,
  "Rip.": 1.95,
  Cameretta: 6.2,
});
