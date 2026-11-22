/* I disegni delle feste: le lampadine, la ghirlanda, la neve, la Vigilia, il
 * conto alla rovescia e i fuochi.
 *
 * Sono tutti su `canvas`, e stanno qui insieme perche' li usano due posti: la
 * plancia di ogni dispositivo (`feste-section.js`: la ghirlanda nella testata,
 * la neve sulla pagina, le lucine sul riquadro delle luci di Natale) e il
 * tablet a muro al riposo (`plancia-a-muro-section.js`: la Vigilia, il conto,
 * i fuochi). Questo file non sa niente di nessuno dei due: riceve una tela e
 * disegna. Non si installa e non ascolta niente.
 *
 * ── Perche' canvas e non CSS ──────────────────────────────────────────────
 *
 * Una lampadina «bokeh» e' un alone che si somma alla luce delle altre: due
 * lampadine vicine fanno una macchia piu' chiara, non due cerchi uno sopra
 * l'altro. Lo fa il `lighter` della tela, e in CSS si otterrebbe solo con
 * cento elementi sfocati — che su un tablet economico e' proprio il modo di
 * rallentare la plancia. Sulla tela ogni cosa ferma si disegna una volta;
 * quello che si muove (la neve, i fuochi) si ridisegna su una tela sua,
 * trasparente, sopra quella ferma.
 *
 * ── Il passo e la nitidezza ───────────────────────────────────────────────
 *
 * Trenta fotogrammi al secondo al massimo, e la densita' dei pixel tenuta a
 * due: un tablet da cento euro con lo schermo a tre volte farebbe nove volte
 * i pixel di uno normale per una neve che non si vedrebbe piu' bella. Chi ha
 * chiesto meno movimento (`prefers-reduced-motion`) vede un fotogramma solo,
 * fermo: la decorazione c'e', il movimento no. E con la pagina nascosta
 * (`document.hidden`) non gira niente.
 *
 * I disegni della scena vengono dal prototipo approvato: le stesse funzioni
 * (`alone`, `lampadina`, `pino`, `crinale`), con lo stesso seme per i numeri
 * a caso, cosi' la scena e' sempre la stessa scena e non cambia a ogni
 * ridisegno.
 */

/* ── la tela ─────────────────────────────────────────────────────────────── */

export const PIXEL_AL_MASSIMO = 2;
export const FOTOGRAMMI_AL_SECONDO = 30;

/** La densita' dei pixel con cui disegnare: quella dello schermo, fino a due. */
export function densita(finestra = globalThis) {
  const d = Number(finestra?.devicePixelRatio) || 1;
  return Math.max(1, Math.min(PIXEL_AL_MASSIMO, d));
}

/**
 * Prepara una tela larga `w` e alta `h` punti CSS: la dimensione vera in
 * pixel, e il contesto gia' scalato. Se la tela era gia' di quella misura
 * non si tocca la dimensione (toccarla la svuota) e si pulisce soltanto.
 */
export function preparaLaTela(tela, w, h, finestra = globalThis) {
  const d = densita(finestra);
  const larga = Math.max(1, Math.round(w * d));
  const alta = Math.max(1, Math.round(h * d));
  if (tela.width !== larga) tela.width = larga;
  if (tela.height !== alta) tela.height = alta;
  const x = tela.getContext("2d");
  if (!x) return null;
  x.setTransform(d, 0, 0, d, 0, 0);
  x.clearRect(0, 0, w, h);
  return x;
}

/* I numeri a caso, sempre gli stessi: un generatore lineare col seme. */
export function aCaso(seme = 11) {
  let s = seme;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── le lampadine ────────────────────────────────────────────────────────── */

/** Un alone: luce piena al centro che si spegne verso il bordo. */
export function alone(x, px, py, r, rgb, a) {
  const g = x.createRadialGradient(px, py, 0, px, py, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.35, `rgba(${rgb},${a * 0.35})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g;
  x.beginPath();
  x.arc(px, py, r, 0, Math.PI * 2);
  x.fill();
}

/** Una lampadina calda: l'alone largo, quello stretto e il filamento bianco. */
export function lampadina(x, px, py, rgb, r) {
  x.save();
  x.globalCompositeOperation = "lighter";
  alone(x, px, py, r * 7, rgb, 0.55);
  alone(x, px, py, r * 2.2, rgb, 0.9);
  x.fillStyle = "rgba(255,255,255,.95)";
  x.beginPath();
  x.arc(px, py, r * 0.6, 0, Math.PI * 2);
  x.fill();
  x.restore();
}

/* I due colori delle lampadine dello stile elegante: l'oro caldo, e una su
 * tre piu' chiara, quasi bianca. */
const ORO = "255,190,95";
const ORO_CHIARO = "255,232,180";

/**
 * La ghirlanda dorata lungo il bordo alto della testata: un filo d'oro a
 * festoni, e le lampadine appese lungo ogni festone.
 *
 * Sul tema chiaro l'alone delle lampadine su un fondo bianco quasi non si
 * vede: il filo resta, e la lampadina si disegna anche col suo punto pieno,
 * che sul bianco e' quello che si legge. Sul tema scuro l'alone basta.
 */
export function disegnaLaGhirlanda(x, w, { chiaro = true } = {}) {
  const passo = w < 600 ? 110 : 160;
  const quanti = Math.max(2, Math.round((w - 40) / passo));
  const largo = (w - 40) / quanti;
  const giu = w < 600 ? 18 : 26;
  const punti = [];
  x.save();
  x.strokeStyle = chiaro ? "rgba(176,129,46,.85)" : "rgba(214,170,84,.7)";
  x.lineWidth = 1.4;
  x.beginPath();
  for (let s = 0; s < quanti; s += 1) {
    const x0 = 20 + s * largo;
    const x1 = x0 + largo;
    const meta = (x0 + x1) / 2;
    x.moveTo(x0, 4);
    x.quadraticCurveTo(meta, giu + 4, x1, 4);
    for (let k = 1; k < 6; k += 1) {
      const t = k / 6;
      const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * meta + t * t * x1;
      const py = (1 - t) * (1 - t) * 4 + 2 * (1 - t) * t * (giu + 4) + t * t * 4;
      punti.push([px, py]);
    }
  }
  x.stroke();
  x.restore();
  punti.forEach(([px, py], i) => {
    const colore = i % 3 ? ORO : ORO_CHIARO;
    if (chiaro) {
      x.save();
      x.fillStyle = i % 3 ? "rgba(232,164,62,.95)" : "rgba(246,200,110,.95)";
      x.beginPath();
      x.arc(px, py + 4, 2.3, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }
    lampadina(x, px, py + 4, colore, 2.1);
  });
}

/** Le lucine sul bordo alto del riquadro delle luci di Natale. */
export function disegnaLeLucine(x, w, { fino = w } = {}) {
  for (let px = 8, i = 0; px < fino - 4; px += 19, i += 1)
    lampadina(x, px, 7 + Math.sin(i * 0.6) * 3, i % 4 ? "255,196,110" : "255,236,190", 1.3);
}

/* ── la neve della plancia ──────────────────────────────────────────────── */

/* Un fiocco gia' disegnato, con il suo filo d'ombra: disegnarlo ogni volta col
 * `shadowBlur` costa dieci volte tanto, e i fiocchi sono tutti uguali. */
function fioccoPronto(raggio, documento) {
  const lato = Math.ceil((raggio + 6) * 2);
  const tela = documento.createElement("canvas");
  tela.width = lato * 2;
  tela.height = lato * 2;
  const x = tela.getContext("2d");
  if (!x) return null;
  x.scale(2, 2);
  x.shadowColor = "rgba(30,58,138,.4)";
  x.shadowBlur = 4;
  x.fillStyle = "rgba(222,234,255,.97)";
  x.beginPath();
  x.arc(lato / 2, lato / 2, raggio, 0, Math.PI * 2);
  x.fill();
  return { tela, lato };
}

/**
 * La neve leggera della plancia: pochi fiocchi azzurrini con un filo d'ombra,
 * che si vedono anche sul bianco del tema chiaro. Cadono piano, ondeggiano un
 * poco, e quando escono in fondo rientrano in cima.
 */
export class NeveLeggera {
  constructor({ quanti = 46, documento = globalThis.document, caso = aCaso(29) } = {}) {
    this.caso = caso;
    this.fiocchi = [];
    this.quanti = quanti;
    this.pronti = [1.5, 2.3, 3.3].map((r) => fioccoPronto(r, documento)).filter(Boolean);
    this.w = 0;
    this.h = 0;
  }

  misura(w, h) {
    const prima = this.w;
    this.w = w;
    this.h = h;
    if (!this.fiocchi.length || !prima) {
      this.fiocchi = Array.from({ length: this.quanti }, () => this._nuovo(true));
    }
  }

  _nuovo(ovunque) {
    const c = this.caso;
    const quale = Math.floor(c() * this.pronti.length);
    return {
      x: c() * this.w,
      y: ovunque ? c() * this.h : -10,
      quale,
      /* I fiocchi grandi cadono un po' piu' in fretta: sono «piu' vicini». */
      v: 14 + quale * 9 + c() * 10,
      fase: c() * Math.PI * 2,
      onda: 6 + c() * 12,
      a: 0.7 + c() * 0.3,
    };
  }

  /** Avanza di `dt` secondi. */
  passo(dt) {
    for (const f of this.fiocchi) {
      f.y += f.v * dt;
      f.fase += dt * 0.6;
      if (f.y > this.h + 10) Object.assign(f, this._nuovo(false));
    }
  }

  disegna(x) {
    x.clearRect(0, 0, this.w, this.h);
    for (const f of this.fiocchi) {
      const pronto = this.pronti[f.quale];
      if (!pronto) continue;
      x.globalAlpha = f.a;
      x.drawImage(
        pronto.tela,
        f.x + Math.sin(f.fase) * f.onda - pronto.lato / 2,
        f.y - pronto.lato / 2,
        pronto.lato,
        pronto.lato,
      );
    }
    x.globalAlpha = 1;
  }
}

/* ── il giro dei fotogrammi ─────────────────────────────────────────────── */

/**
 * Un giro di fotogrammi a trenta al secondo, che si ferma quando la pagina
 * non si vede e riparte quando torna. `fotogramma(dt, adesso)` disegna; se
 * torna `false` il giro si ferma da solo. Con `fermo` (meno movimento) si
 * disegna un fotogramma solo.
 */
export function giraIFotogrammi(fotogramma, { finestra = globalThis, fermo = false } = {}) {
  const documento = finestra.document;
  let richiesta = 0;
  let prima = 0;
  let spento = false;
  const intervallo = 1000 / FOTOGRAMMI_AL_SECONDO;
  const giro = (adesso) => {
    richiesta = 0;
    if (spento) return;
    if (documento?.hidden) return;
    const dt = prima ? adesso - prima : intervallo;
    if (dt >= intervallo - 2) {
      prima = adesso;
      if (fotogramma(Math.min(dt, 100) / 1000, adesso) === false) return;
    }
    richiesta = finestra.requestAnimationFrame?.(giro) || 0;
  };
  const riparti = () => {
    if (spento || richiesta || documento?.hidden || fermo) return;
    prima = 0;
    richiesta = finestra.requestAnimationFrame?.(giro) || 0;
  };
  const allaVista = () => riparti();
  if (fermo) fotogramma(0, finestra.performance?.now?.() || 0);
  else riparti();
  documento?.addEventListener?.("visibilitychange", allaVista);
  return {
    ferma() {
      spento = true;
      if (richiesta) finestra.cancelAnimationFrame?.(richiesta);
      richiesta = 0;
      documento?.removeEventListener?.("visibilitychange", allaVista);
    },
    riparti,
  };
}

/* ── la Vigilia sul tablet ──────────────────────────────────────────────── */

/* La scena e' disegnata su un foglio di 1280×800, la misura del tablet da
 * dieci pollici in orizzontale. Su un altro schermo si ingrandisce quanto
 * serve a coprirlo e si tiene attaccata a destra e in basso: l'albero e la
 * baita stanno a destra, e in verticale il cielo a sinistra e' quello che si
 * puo' perdere — ci sta sopra l'orologio. */
const FOGLIO_W = 1280;
const FOGLIO_H = 800;

function sulFoglio(x, w, h) {
  const s = Math.max(w / FOGLIO_W, h / FOGLIO_H);
  x.translate(w - FOGLIO_W * s, h - FOGLIO_H * s);
  x.scale(s, s);
}

function stelle(x, caso, n, alto = 0.65) {
  for (let i = 0; i < n; i += 1) {
    const px = caso() * FOGLIO_W;
    const py = Math.pow(caso(), 1.4) * FOGLIO_H * alto;
    const r = caso() * 1.2 + 0.2;
    const a = 0.25 + caso() * 0.75;
    x.fillStyle = `rgba(255,255,255,${a})`;
    x.beginPath();
    x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
    if (r > 1.15) {
      x.save();
      x.globalCompositeOperation = "lighter";
      alone(x, px, py, 8, "200,220,255", 0.35);
      x.restore();
    }
  }
}

function crinale(x, punti, colore) {
  x.fillStyle = colore;
  x.beginPath();
  x.moveTo(0, FOGLIO_H);
  for (const [a, b] of punti) x.lineTo(a, b);
  x.lineTo(FOGLIO_W, FOGLIO_H);
  x.closePath();
  x.fill();
}

function pino(x, cx, base, h, colore, neve) {
  const piani = 5;
  for (let i = 0; i < piani; i += 1) {
    const w = h * 0.42 * (1 - (i / piani) * 0.75);
    const yb = base - ((i * h) / piani) * 0.85;
    const yt = yb - (h / piani) * 1.5;
    x.fillStyle = colore;
    x.beginPath();
    x.moveTo(cx - w, yb);
    x.lineTo(cx, yt);
    x.lineTo(cx + w, yb);
    x.closePath();
    x.fill();
    x.fillStyle = neve;
    x.beginPath();
    x.moveTo(cx - w, yb);
    x.quadraticCurveTo(cx - w * 0.5, yb - 3, cx, yt + (yb - yt) * 0.25);
    x.quadraticCurveTo(cx - w * 0.3, yb - (yb - yt) * 0.15, cx - w, yb);
    x.fill();
  }
  x.fillStyle = colore;
  x.fillRect(cx - h * 0.03, base, h * 0.06, h * 0.08);
}

/**
 * Il fondo della Vigilia: il cielo, l'aurora tenue, le stelle, la luna, i
 * monti, il bosco innevato, il campo, la baita con le finestre calde e il fumo
 * dal camino, l'albero con le sue luci e la stella. E' fermo: si disegna una
 * volta, e la neve che cade sta su un'altra tela sopra.
 */
export function disegnaLaVigilia(x, w, h) {
  const caso = aCaso(11);
  x.save();
  let g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#030816");
  g.addColorStop(0.4, "#081634");
  g.addColorStop(0.72, "#14305e");
  g.addColorStop(1, "#25497f");
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  sulFoglio(x, w, h);
  /* L'aurora: sette macchie sfocate, verdi e azzurre, appena. */
  x.save();
  x.globalCompositeOperation = "lighter";
  x.filter = "blur(30px)";
  for (let i = 0; i < 7; i += 1) {
    const cx = 300 + i * 130;
    const cy = 170 + Math.sin(i) * 40;
    const a = x.createRadialGradient(cx, cy, 0, cx, cy, 190);
    a.addColorStop(0, i % 2 ? "rgba(56,189,148,.16)" : "rgba(56,140,220,.14)");
    a.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = a;
    x.fillRect(0, 0, FOGLIO_W, 500);
  }
  x.restore();
  stelle(x, caso, 320, 0.7);
  /* La luna, una falce. */
  x.save();
  x.globalCompositeOperation = "lighter";
  alone(x, 1110, 120, 160, "200,215,255", 0.25);
  x.restore();
  x.fillStyle = "#f4f1e6";
  x.beginPath();
  x.arc(1110, 120, 30, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = "rgba(8,22,52,.92)";
  x.beginPath();
  x.arc(1124, 112, 27, 0, Math.PI * 2);
  x.fill();
  crinale(
    x,
    [
      [0, 520],
      [120, 470],
      [230, 500],
      [380, 430],
      [520, 490],
      [650, 450],
      [800, 500],
      [930, 440],
      [1080, 495],
      [1200, 460],
      [1280, 480],
    ],
    "#1d3866",
  );
  crinale(
    x,
    [
      [0, 560],
      [160, 530],
      [300, 560],
      [470, 520],
      [640, 565],
      [820, 530],
      [1000, 560],
      [1160, 535],
      [1280, 555],
    ],
    "#2a4b80",
  );
  for (let i = 0; i < 34; i += 1) {
    const cx = i * 40 + caso() * 30 - 10;
    const alto = 60 + caso() * 50;
    pino(x, cx, 600 + caso() * 14, alto, "#10243f", "rgba(220,232,250,.55)");
  }
  /* Il campo di neve, con un'ombra morbida in basso. */
  g = x.createLinearGradient(0, 600, 0, 800);
  g.addColorStop(0, "#c9d8ee");
  g.addColorStop(1, "#eef4fc");
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(0, 640);
  x.bezierCurveTo(300, 600, 540, 650, 820, 618);
  x.bezierCurveTo(1020, 598, 1180, 630, 1280, 620);
  x.lineTo(1280, 800);
  x.lineTo(0, 800);
  x.fill();
  g = x.createLinearGradient(0, 680, 0, 800);
  g.addColorStop(0, "rgba(140,170,215,.35)");
  g.addColorStop(1, "rgba(140,170,215,0)");
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(0, 720);
  x.bezierCurveTo(400, 680, 700, 740, 1280, 700);
  x.lineTo(1280, 800);
  x.lineTo(0, 800);
  x.fill();
  for (let i = 0; i < 120; i += 1) {
    x.fillStyle = `rgba(255,255,255,${0.4 + caso() * 0.6})`;
    x.beginPath();
    x.arc(caso() * 1280, 640 + caso() * 160, caso() * 1.1, 0, Math.PI * 2);
    x.fill();
  }
  /* La baita: le pareti, il tetto innevato, il camino, le finestre accese. */
  const bx = 760;
  const by = 610;
  x.fillStyle = "#2b1d14";
  x.fillRect(bx, by - 58, 120, 58);
  x.fillStyle = "#3a271a";
  x.fillRect(bx + 86, by - 96, 14, 40);
  x.fillStyle = "#e9f0fa";
  x.beginPath();
  x.moveTo(bx - 16, by - 52);
  x.lineTo(bx + 60, by - 104);
  x.lineTo(bx + 136, by - 52);
  x.lineTo(bx + 126, by - 46);
  x.lineTo(bx + 60, by - 90);
  x.lineTo(bx - 6, by - 46);
  x.fill();
  for (const wx of [bx + 18, bx + 76]) {
    x.fillStyle = "#ffc46b";
    x.fillRect(wx, by - 40, 24, 20);
    lampadina(x, wx + 12, by - 30, "255,170,80", 5);
  }
  x.save();
  x.globalCompositeOperation = "lighter";
  alone(x, bx + 60, by + 6, 90, "255,170,80", 0.22);
  x.restore();
  x.save();
  x.filter = "blur(6px)";
  for (let i = 0; i < 6; i += 1) {
    x.fillStyle = `rgba(200,210,230,${0.18 - i * 0.025})`;
    x.beginPath();
    x.arc(bx + 93 + i * 10, by - 110 - i * 22, 10 + i * 4, 0, Math.PI * 2);
    x.fill();
  }
  x.restore();
  /* L'albero grande, a sei piani con la neve sui rami. */
  const ax = 1080;
  const ay = 690;
  x.fillStyle = "#2a1a0e";
  x.fillRect(ax - 9, ay - 16, 18, 26);
  const piani = 6;
  for (let i = 0; i < piani; i += 1) {
    const largo = 118 * (1 - (i / piani) * 0.8);
    const yb = ay - 14 - i * 52;
    const yt = yb - 82;
    g = x.createLinearGradient(ax - largo, 0, ax + largo, 0);
    g.addColorStop(0, "#0b3b25");
    g.addColorStop(0.55, "#145c36");
    g.addColorStop(1, "#0a311f");
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(ax - largo, yb);
    x.quadraticCurveTo(ax - largo * 0.4, yb - 14, ax, yt);
    x.quadraticCurveTo(ax + largo * 0.4, yb - 14, ax + largo, yb);
    x.quadraticCurveTo(ax, yb + 10, ax - largo, yb);
    x.fill();
    x.fillStyle = "rgba(235,242,252,.75)";
    x.beginPath();
    x.moveTo(ax - largo, yb);
    x.quadraticCurveTo(ax - largo * 0.5, yb - 6, ax - largo * 0.15, yb - 16);
    x.quadraticCurveTo(ax - largo * 0.55, yb - 2, ax - largo, yb);
    x.fill();
  }
  for (let k = 0; k < 5; k += 1) {
    const y0 = ay - 40 - k * 58;
    const largo = 110 * (1 - (k * 58 + 20) / 330);
    for (let j = 0; j <= 10; j += 1) {
      const t = j / 10;
      lampadina(
        x,
        ax - largo + t * 2 * largo,
        y0 - t * 26 + Math.sin(t * Math.PI) * 10,
        j % 3 ? "255,196,110" : "255,236,190",
        1.6,
      );
    }
  }
  /* La stella in cima, coi suoi raggi. */
  x.save();
  x.globalCompositeOperation = "lighter";
  alone(x, ax, ay - 345, 70, "255,214,120", 0.45);
  x.restore();
  x.fillStyle = "#ffe08a";
  x.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 ? 7 : 18;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    x.lineTo(ax + Math.cos(a) * r, ay - 345 + Math.sin(a) * r);
  }
  x.fill();
  x.save();
  x.globalCompositeOperation = "lighter";
  x.strokeStyle = "rgba(255,230,160,.35)";
  x.lineWidth = 1;
  for (let i = 0; i < 8; i += 1) {
    const a = (i * Math.PI) / 4;
    x.beginPath();
    x.moveTo(ax, ay - 345);
    x.lineTo(ax + Math.cos(a) * 48, ay - 345 + Math.sin(a) * 48);
    x.stroke();
  }
  x.restore();
  x.restore();
  /* La vignetta, sullo schermo intero. */
  const v = x.createRadialGradient(
    w / 2,
    h * 0.475,
    Math.min(w, h) * 0.375,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.67,
  );
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,8,.55)");
  x.fillStyle = v;
  x.fillRect(0, 0, w, h);
}

/* Un fiocco sfocato gia' pronto, per lo strato vicino della neve della scena. */
function fioccoSfocato(raggio, documento) {
  const lato = Math.ceil(raggio * 2 + 12);
  const tela = documento.createElement("canvas");
  tela.width = lato;
  tela.height = lato;
  const x = tela.getContext("2d");
  if (!x) return null;
  x.filter = "blur(2.5px)";
  x.fillStyle = "rgba(255,255,255,1)";
  x.beginPath();
  x.arc(lato / 2, lato / 2, raggio, 0, Math.PI * 2);
  x.fill();
  return { tela, lato };
}

/**
 * La neve della scena, a tre profondita': tanti fiocchi piccoli e lenti in
 * fondo, meno fiocchi medi, e pochi fiocchi grandi e sfocati davanti, che
 * passano in fretta come vicini all'obiettivo.
 */
export class NeveATreStrati {
  constructor({ w, h, documento = globalThis.document, quanti = 340, caso = aCaso(5) } = {}) {
    this.w = w;
    this.h = h;
    this.caso = caso;
    this.sfocato = fioccoSfocato(4.5, documento);
    const strati = [
      [quanti, 1.1, 0.55, 22],
      [Math.round(quanti * 0.45), 2.2, 0.75, 40],
      [Math.round(quanti * 0.12), 4.5, 0.6, 70],
    ];
    this.fiocchi = [];
    strati.forEach(([n, r, a, v], strato) => {
      for (let i = 0; i < n; i += 1)
        this.fiocchi.push({
          strato,
          x: caso() * w,
          y: caso() * h,
          r: r * (0.6 + caso() * 0.8),
          a: a * (0.5 + caso() * 0.5),
          v: v * (0.7 + caso() * 0.6),
          fase: caso() * Math.PI * 2,
        });
    });
  }

  passo(dt) {
    for (const f of this.fiocchi) {
      f.y += f.v * dt;
      f.fase += dt * (0.4 + f.strato * 0.2);
      if (f.y > this.h + 12) {
        f.y = -12;
        f.x = this.caso() * this.w;
      }
    }
  }

  disegna(x) {
    x.clearRect(0, 0, this.w, this.h);
    for (const f of this.fiocchi) {
      const px = f.x + Math.sin(f.fase) * (4 + f.strato * 6);
      if (f.strato === 2 && this.sfocato) {
        x.globalAlpha = f.a;
        const lato = this.sfocato.lato * (f.r / 4.5);
        x.drawImage(this.sfocato.tela, px - lato / 2, f.y - lato / 2, lato, lato);
        continue;
      }
      x.globalAlpha = 1;
      x.fillStyle = `rgba(255,255,255,${f.a})`;
      x.beginPath();
      x.arc(px, f.y, f.r, 0, Math.PI * 2);
      x.fill();
    }
    x.globalAlpha = 1;
  }
}

/* ── il conto alla rovescia ─────────────────────────────────────────────── */

/** Il fondo del conto: il cielo viola scuro, le stelle, le macchie d'oro. */
export function disegnaIlFondoDelConto(x, w, h) {
  const caso = aCaso(11);
  const g = x.createRadialGradient(w / 2, h * 0.46, 0, w / 2, h * 0.46, Math.max(w, h) * 0.7);
  g.addColorStop(0, "#1a1540");
  g.addColorStop(0.55, "#0b0920");
  g.addColorStop(1, "#03030a");
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  for (let i = 0; i < Math.round((w * h) / 7300); i += 1) {
    const r = caso() * 1.2 + 0.2;
    x.fillStyle = `rgba(255,255,255,${0.25 + caso() * 0.75})`;
    x.beginPath();
    x.arc(caso() * w, caso() * h, r, 0, Math.PI * 2);
    x.fill();
  }
  const raggio = Math.min(w, h) * 0.375;
  x.save();
  x.globalCompositeOperation = "lighter";
  for (let i = 0; i < 46; i += 1) {
    const px = caso() * w;
    const py = caso() * h;
    const r = 6 + caso() * 26;
    if (Math.hypot(px - w / 2, py - h * 0.49) < raggio + 64) continue;
    x.filter = `blur(${r > 20 ? 5 : 2}px)`;
    alone(x, px, py, r, "255,205,120", 0.12 + caso() * 0.18);
  }
  x.restore();
}

/**
 * L'anello dei secondi: sessanta tacche attorno al numero, e un arco d'oro
 * lungo quanto i secondi che restano nel minuto. Nell'ultimo minuto le tacche
 * accese sono quelle che mancano alla mezzanotte; la lampadina in cima e' la
 * mezzanotte.
 */
export function disegnaLAnello(x, w, h, secondi) {
  const cx = w / 2;
  const cy = h * 0.49;
  const R = Math.min(w, h) * 0.295;
  const quanti = Math.max(0, Math.min(60, secondi));
  x.clearRect(0, 0, w, h);
  x.lineWidth = 2;
  x.strokeStyle = "rgba(255,255,255,.08)";
  x.beginPath();
  x.arc(cx, cy, R, 0, Math.PI * 2);
  x.stroke();
  for (let i = 0; i < 60; i += 1) {
    const a = -Math.PI / 2 + (i / 60) * Math.PI * 2;
    const accesa = i >= 60 - Math.ceil(quanti);
    const fuori = R + (i % 5 ? 22 : 28);
    x.strokeStyle = accesa ? "rgba(255,214,140,.95)" : "rgba(255,255,255,.14)";
    x.lineWidth = i % 5 ? 1.5 : 3;
    x.beginPath();
    x.moveTo(cx + Math.cos(a) * (R + 14), cy + Math.sin(a) * (R + 14));
    x.lineTo(cx + Math.cos(a) * fuori, cy + Math.sin(a) * fuori);
    x.stroke();
  }
  if (quanti > 0) {
    const da = -Math.PI / 2 - Math.PI * 2 * (quanti / 60);
    x.save();
    x.globalCompositeOperation = "lighter";
    x.filter = "blur(10px)";
    x.lineWidth = 14;
    x.strokeStyle = "rgba(255,190,90,.55)";
    x.beginPath();
    x.arc(cx, cy, R, da, -Math.PI / 2);
    x.stroke();
    x.restore();
    const g = x.createLinearGradient(cx - R, cy - R, cx + R, cy);
    g.addColorStop(0, "#fff3c4");
    g.addColorStop(1, "#e8a838");
    x.strokeStyle = g;
    x.lineWidth = 5;
    x.lineCap = "round";
    x.beginPath();
    x.arc(cx, cy, R, da, -Math.PI / 2);
    x.stroke();
    x.lineCap = "butt";
  }
  lampadina(x, cx, cy - R, "255,220,150", 3);
}

/* ── i fuochi ───────────────────────────────────────────────────────────── */

const COLORI_DEI_FUOCHI = [
  "255,120,190",
  "255,205,110",
  "130,180,255",
  "190,140,255",
  "110,230,190",
];

/** Il fondo dei fuochi: il cielo, le stelle, la citta' coi suoi lumi, l'acqua. */
export function disegnaIlFondoDeiFuochi(x, w, h) {
  const caso = aCaso(11);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#04020c");
  g.addColorStop(0.55, "#0e0828");
  g.addColorStop(1, "#1c1146");
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  x.save();
  sulFoglio(x, w, h);
  stelle(x, caso, 110, 0.8);
  const citta = [
    [0, 640],
    [60, 640],
    [60, 600],
    [120, 600],
    [120, 620],
    [170, 620],
    [170, 570],
    [200, 560],
    [230, 570],
    [230, 630],
    [300, 630],
    [300, 590],
    [360, 590],
    [360, 640],
    [430, 640],
    [430, 560],
    [470, 540],
    [510, 560],
    [510, 640],
    [580, 640],
    [580, 610],
    [640, 610],
    [640, 575],
    [700, 575],
    [700, 640],
    [760, 640],
    [760, 590],
    [820, 590],
    [820, 530],
    [850, 520],
    [880, 530],
    [880, 640],
    [950, 640],
    [950, 600],
    [1020, 600],
    [1020, 625],
    [1090, 625],
    [1090, 580],
    [1150, 580],
    [1150, 640],
    [1280, 640],
  ];
  x.fillStyle = "#0a0618";
  x.beginPath();
  x.moveTo(0, 800);
  for (const [a, b] of citta) x.lineTo(a, b);
  x.lineTo(1280, 800);
  x.fill();
  for (let i = 0; i < 160; i += 1) {
    const px = caso() * 1280;
    const py = 560 + caso() * 80;
    if (caso() < 0.6) {
      x.fillStyle = `rgba(255,${(190 + caso() * 50) | 0},120,${0.35 + caso() * 0.5})`;
      x.fillRect(px, py, 2, 3);
    }
  }
  const acqua = x.createLinearGradient(0, 660, 0, 800);
  acqua.addColorStop(0, "#120a2c");
  acqua.addColorStop(1, "#05030e");
  x.fillStyle = acqua;
  x.fillRect(0, 660, 1280, 140);
  x.restore();
}

/* Un'esplosione gia' scoppiata, ferma: quella del prototipo. Serve a chi ha
 * chiesto meno movimento, che i fuochi li vede lo stesso — fermi. */
export function disegnaUnFuocoFermo(x, cx, cy, R, rgb, n, caso = aCaso(7)) {
  x.save();
  x.globalCompositeOperation = "lighter";
  alone(x, cx, cy, R * 1.2, rgb, 0.18);
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 + caso() * 0.08;
    const rr = R * (0.72 + caso() * 0.28);
    const ex = cx + Math.cos(a) * rr;
    const ey = cy + Math.sin(a) * rr + (rr * rr) / 1400;
    const sx = cx + Math.cos(a) * rr * 0.2;
    const sy = cy + Math.sin(a) * rr * 0.2;
    const g = x.createLinearGradient(sx, sy, ex, ey);
    g.addColorStop(0, `rgba(${rgb},0)`);
    g.addColorStop(0.7, `rgba(${rgb},.55)`);
    g.addColorStop(1, "rgba(255,255,255,.95)");
    x.strokeStyle = g;
    x.lineWidth = 1.3;
    x.beginPath();
    x.moveTo(sx, sy);
    x.quadraticCurveTo(cx + Math.cos(a) * rr * 0.7, cy + Math.sin(a) * rr * 0.7, ex, ey);
    x.stroke();
    alone(x, ex, ey, 6, rgb, 0.9);
  }
  x.restore();
}

/* Una scintilla gia' disegnata per colore: l'alone e il punto bianco. */
function scintillaPronta(rgb, documento) {
  const lato = 24;
  const tela = documento.createElement("canvas");
  tela.width = lato;
  tela.height = lato;
  const x = tela.getContext("2d");
  if (!x) return null;
  alone(x, lato / 2, lato / 2, lato / 2, rgb, 0.9);
  x.fillStyle = "rgba(255,255,255,.95)";
  x.beginPath();
  x.arc(lato / 2, lato / 2, 1.4, 0, Math.PI * 2);
  x.fill();
  return tela;
}

/**
 * I fuochi animati: ogni tanto ne scoppia uno in alto, si apre a raggiera con
 * le scie, cade piano e si spegne; nel frattempo i brillantini d'oro e
 * d'argento scendono. Partono gia' a meta' — al primo fotogramma ce ne sono
 * gia' quattro aperti — perche' chi guarda il tablet a mezzanotte non deve
 * aspettare un cielo vuoto.
 */
export class Fuochi {
  constructor({ w, h, documento = globalThis.document, caso = aCaso(13) } = {}) {
    this.w = w;
    this.h = h;
    this.caso = caso;
    this.scoppi = [];
    this.prossimo = 0.4;
    this.pronte = new Map(COLORI_DEI_FUOCHI.map((c) => [c, scintillaPronta(c, documento)]));
    /* Dove comincia l'acqua: il fondo e' disegnato sul foglio, e il foglio e'
     * attaccato in basso. */
    const scala = Math.max(w / FOGLIO_W, h / FOGLIO_H);
    this.acqua = h - 140 * scala;
    this.grande = Math.max(w, h) / FOGLIO_W;
    this.brillantini = Array.from({ length: 90 }, (_, i) => ({
      x: caso() * w,
      y: caso() * h * 0.8,
      giro: caso() * 6,
      v: 18 + caso() * 30,
      oro: i % 2 === 0,
      lungo: 6 + caso() * 3,
    }));
    /* Le cinque del primo fotogramma, dove le aveva il disegno approvato:
     * ai lati e in alto, attorno alla scritta e mai sopra. */
    [
      [0.15, 0.21, 150, 0],
      [0.84, 0.19, 170, 1],
      [0.5, 0.12, 95, 2],
      [0.33, 0.31, 80, 3],
      [0.67, 0.33, 88, 4],
    ].forEach(([px, py, R, c], i) =>
      this.scoppia(px * w, py * h, R * this.grande, COLORI_DEI_FUOCHI[c], 0.9 + i * 0.35),
    );
  }

  /* Un posto nel cielo che non copra la scritta: ai lati fino a un terzo
   * dell'altezza, in mezzo solo in alto e piu' piccoli. */
  _posto() {
    const c = this.caso;
    const lato = c();
    if (lato < 0.38) return [0.08 + c() * 0.24, 0.12 + c() * 0.2, 125 + c() * 65];
    if (lato < 0.76) return [0.68 + c() * 0.24, 0.12 + c() * 0.2, 125 + c() * 65];
    return [0.38 + c() * 0.24, 0.08 + c() * 0.06, 75 + c() * 35];
  }

  scoppia(cx, cy, R, rgb, eta = 0) {
    const n = Math.round(60 + R / 2.5);
    const scintille = [];
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 + this.caso() * 0.08;
      scintille.push({ a, v: R * (0.72 + this.caso() * 0.28) });
    }
    this.scoppi.push({ cx, cy, R, rgb, eta, durata: 3.4 + this.caso() * 0.8, scintille });
  }

  passo(dt) {
    this.prossimo -= dt;
    if (this.prossimo <= 0) {
      const c = this.caso;
      const [px, py, R] = this._posto();
      this.scoppia(
        px * this.w,
        py * this.h,
        R * this.grande,
        COLORI_DEI_FUOCHI[Math.floor(c() * COLORI_DEI_FUOCHI.length)],
      );
      this.prossimo = 0.4 + c() * 0.5;
    }
    for (const s of this.scoppi) s.eta += dt;
    this.scoppi = this.scoppi.filter((s) => s.eta < s.durata);
    for (const b of this.brillantini) {
      b.y += b.v * dt;
      b.giro += dt * 2;
      if (b.y > this.acqua) {
        b.y = -10;
        b.x = this.caso() * this.w;
      }
    }
  }

  disegna(x) {
    x.clearRect(0, 0, this.w, this.h);
    x.save();
    x.globalCompositeOperation = "lighter";
    for (const s of this.scoppi) {
      /* Si apre in fretta e rallenta, resta, poi cade piano e si spegne. Nei
       * primi istanti cresce anche la luce: aperta a zero, tutte le scintille
       * starebbero nello stesso punto e farebbero una macchia bianca. */
      const t = s.eta / s.durata;
      const aperto = 1 - Math.pow(1 - Math.min(1, s.eta / 0.9), 3);
      const luce = Math.min(1, s.eta / 0.3) * (t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.45));
      const cade = s.eta * s.eta * 7;
      alone(x, s.cx, s.cy + cade * 0.5, s.R * 1.2, s.rgb, 0.16 * luce);
      /* Le scie in due passate, come un tratto che sfuma verso il centro:
       * una fioca da vicino al centro, una piu' viva fino alla punta. Tutte le
       * scie di uno scoppio in un tracciato solo — e' la cosa che costa di
       * meno su un tablet. */
      const punte = [];
      for (const [da, a, alfa] of [
        [0.18, 0.62, 0.16],
        [0.62, 1, 0.5],
      ]) {
        x.strokeStyle = `rgba(${s.rgb},${alfa * luce})`;
        x.lineWidth = 1.3;
        x.beginPath();
        for (const sc of s.scintille) {
          const rr = sc.v * aperto;
          const curva = (k) => (rr * k * (rr * k)) / 1400 + cade * k;
          x.moveTo(s.cx + Math.cos(sc.a) * rr * da, s.cy + Math.sin(sc.a) * rr * da + curva(da));
          const ex = s.cx + Math.cos(sc.a) * rr * a;
          const ey = s.cy + Math.sin(sc.a) * rr * a + curva(a);
          x.lineTo(ex, ey);
          if (a === 1) punte.push(ex, ey);
        }
        x.stroke();
      }
      const pronta = this.pronte.get(s.rgb);
      if (pronta) {
        x.globalAlpha = luce;
        for (let i = 0; i < punte.length; i += 2)
          x.drawImage(pronta, punte[i] - 6, punte[i + 1] - 6, 12, 12);
        x.globalAlpha = 1;
      }
      /* Il riflesso nell'acqua: qualche striscia del suo colore, sotto. */
      x.fillStyle = `rgba(${s.rgb},${0.1 * luce})`;
      for (let i = 0; i < 9; i += 1) {
        const larga = s.R * (0.5 - i * 0.03);
        x.fillRect(
          s.cx - larga / 2 + Math.sin(i * 1.7 + s.eta) * 12,
          this.acqua + 10 + i * 9,
          larga,
          2,
        );
      }
    }
    x.restore();
    for (const b of this.brillantini) {
      x.save();
      x.translate(b.x, b.y);
      x.rotate(b.giro);
      x.fillStyle = b.oro ? "rgba(255,215,130,.85)" : "rgba(230,235,255,.8)";
      x.fillRect(-3, -1, b.lungo, 2.4);
      x.restore();
    }
  }
}

/** I fuochi fermi, per chi ha chiesto meno movimento. */
export function disegnaIFuochiFermi(x, w, h) {
  const caso = aCaso(11);
  const s = Math.max(w, h) / FOGLIO_W;
  [
    [0.15, 0.21, 150, 0, 110],
    [0.84, 0.19, 170, 1, 120],
    [0.5, 0.12, 95, 2, 80],
    [0.33, 0.31, 80, 3, 60],
    [0.67, 0.33, 88, 4, 60],
  ].forEach(([px, py, R, c, n]) =>
    disegnaUnFuocoFermo(x, px * w, py * h, R * s, COLORI_DEI_FUOCHI[c], n, caso),
  );
}
