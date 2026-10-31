/* «Casa 3D»: pavimenti e pareti.
 *
 * I motivi si disegnano in un riquadro da 150 px che si ripete. Nel pavimento
 * della pianta 1 m sono 75 px, quindi un riquadro copre 2 m: le misure qui
 * sotto sono in scala (una mattonella 60×60 sono 45 px, un listone largo
 * 18 cm sono 13-14 px).
 *
 * Disegna su una tela del documento: si usa solo nella pagina, mai nelle
 * prove che girano senza documento.
 */

export const PAVIMENTI = Object.freeze([
  { k: "listoni", nome: ["Parquet a listoni", "Plank parquet"], colori: ["#d8b68a", "#c19a6b", "#9c7048", "#6b4a32", "#e7dccb", "#a39e93"], legno: true },
  { k: "spina", nome: ["Parquet a spina", "Herringbone"], colori: ["#d8b68a", "#c19a6b", "#9c7048", "#6b4a32", "#e7dccb", "#a39e93"], legno: true },
  { k: "gres60", nome: ["Gres 60×60", "Tiles 60×60"], colori: ["#eeeae3", "#d9cbb3", "#b9b3a8", "#9aa0a6", "#5b6168", "#2f3337"] },
  { k: "gres120", nome: ["Gres 120×60", "Tiles 120×60"], colori: ["#eeeae3", "#d9cbb3", "#b9b3a8", "#9aa0a6", "#5b6168", "#2f3337"] },
  { k: "marmo", nome: ["Effetto marmo", "Marble look"], colori: ["#f3f1ec", "#e9e4da", "#d8d2c8", "#2a2c30"], vena: true },
  { k: "cotto", nome: ["Cotto", "Terracotta"], colori: ["#b5653a", "#c27a4a", "#a5543a", "#d39a6a"] },
  { k: "esagonette", nome: ["Esagonette", "Hexagons"], colori: ["#eeeae3", "#9cae94", "#3b5b7a", "#1f2326", "#d9cbb3", "#c98b6b"] },
  { k: "cementine", nome: ["Cementine", "Cement tiles"], colori: ["#3b5b7a", "#9cae94", "#c98b6b", "#1f2326", "#b08a3e"] },
  { k: "mosaico", nome: ["Mosaico", "Mosaic"], colori: ["#3b82c4", "#5fa8a0", "#e7e1d6", "#1f2326", "#9cae94"] },
  { k: "scacchiera", nome: ["Scacchiera", "Checkerboard"], colori: ["#1f2326", "#3b5b7a", "#9cae94", "#b5653a"] },
  { k: "resina", nome: ["Resina", "Resin"], colori: ["#e9e6df", "#c9c6bf", "#8d9095", "#4a4f55", "#d8c3a5"] },
  { k: "moquette", nome: ["Moquette", "Carpet"], colori: ["#b8a99a", "#8d9095", "#4f6b55", "#2f3f57"] },
]);

export const PAVIMENTO_PER_CHIAVE = Object.freeze(Object.fromEntries(PAVIMENTI.map((p) => [p.k, p])));

/* I colori delle pareti: [nome, name, colore]. */
export const PARETI = Object.freeze([
  ["Bianco", "White", "#f4f1ea"],
  ["Panna", "Cream", "#efe4cf"],
  ["Grigio perla", "Pearl grey", "#d5d6d2"],
  ["Tortora", "Taupe", "#b8a99a"],
  ["Salvia", "Sage", "#b7c4ae"],
  ["Azzurro polvere", "Dusty blue", "#b9cad6"],
  ["Rosa cipria", "Powder pink", "#e2c2b8"],
  ["Ocra", "Ochre", "#d9b45c"],
  ["Terracotta", "Terracotta", "#c98b6b"],
  ["Verde bosco", "Forest green", "#4f6b55"],
  ["Blu notte", "Midnight blue", "#2f3f57"],
  ["Antracite", "Anthracite", "#4a4f55"],
]);

export const PARETE_DI_PARTENZA = "#f1ece2";

const scurisci = (hex, k) => {
  const n = parseInt(String(hex).slice(1), 16) || 0;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
/* Una variazione fissa, non a caso: lo stesso pavimento si ridisegna uguale. */
const varia = (hex, i, amp = 0.08) => scurisci(hex, 1 - amp + (((i * 9301 + 49297) % 233280) / 233280) * amp * 2);
const fuga = (p, colore = "rgba(0,0,0,.18)") => {
  p.strokeStyle = colore;
  p.lineWidth = 1;
};
/* Un numero «a caso» che si ripete uguale, per la grana. */
const grana = (i) => (((i * 16807) % 2147483647) / 2147483647 + 1) % 1;

/** Il riquadro del motivo `k` col colore `c` (e `c2` per i decori). */
export function riquadro(k, c = "#d9cbb3", c2 = "") {
  const n = 150;
  const cv = document.createElement("canvas");
  cv.width = cv.height = n;
  const p = cv.getContext("2d");
  switch (k) {
    case "listoni": {
      let i = 0;
      for (let y = 0; y < n; y += 15) {
        let x = -((y * 7) % 60);
        while (x < n) {
          const l = 70 + ((i * 37) % 50);
          p.fillStyle = varia(c, i++, 0.1);
          p.fillRect(x, y, l, 15);
          p.fillStyle = "rgba(60,35,15,.3)";
          p.fillRect(x, y, 1, 15);
          x += l;
        }
        p.fillStyle = "rgba(60,35,15,.28)";
        p.fillRect(0, y, n, 1);
      }
      break;
    }
    case "spina": {
      p.fillStyle = c;
      p.fillRect(0, 0, n, n);
      const w = 25, h = 10;
      let i = 0;
      for (let col = 0; col < n / w + 1; col++)
        for (let y = -w; y < n + w; y += h) {
          p.save();
          p.translate(col * w, y + (col % 2 ? 0 : h / 2));
          p.transform(1, col % 2 ? 0.45 : -0.45, 0, 1, 0, 0);
          p.fillStyle = varia(c, i++, 0.1);
          p.fillRect(0, 0, w, h);
          p.fillStyle = "rgba(60,35,15,.3)";
          p.fillRect(0, 0, w, 1);
          p.fillRect(0, 0, 1, h);
          p.restore();
        }
      break;
    }
    case "gres60":
    case "gres120": {
      const a = 45 * (k === "gres120" ? 2 : 1), b = 45;
      const sfalsa = (y) => (k === "gres120" && (y / b) % 2 ? -a / 2 : 0);
      let i = 0;
      for (let y = 0; y < n; y += b)
        for (let x = sfalsa(y); x < n; x += a) {
          p.fillStyle = varia(c, i++, 0.025);
          p.fillRect(x, y, a, b);
        }
      fuga(p);
      for (let y = 0; y <= n; y += b) {
        p.beginPath();
        p.moveTo(0, y);
        p.lineTo(n, y);
        p.stroke();
      }
      for (let y = 0; y < n; y += b)
        for (let x = sfalsa(y); x <= n; x += a) {
          p.beginPath();
          p.moveTo(x, y);
          p.lineTo(x, y + b);
          p.stroke();
        }
      break;
    }
    case "marmo": {
      p.fillStyle = c;
      p.fillRect(0, 0, n, n);
      const vena = c2 || (c === "#2a2c30" ? "#d8d2c8" : "#9a948a");
      for (let i = 0; i < 9; i++) {
        p.strokeStyle = vena;
        p.globalAlpha = 0.18 + (i % 3) * 0.08;
        p.lineWidth = 0.6 + (i % 3) * 0.7;
        p.beginPath();
        const y0 = (i * 41) % n;
        p.moveTo(-10, y0);
        p.bezierCurveTo(40, y0 - 30 + i * 3, 90, y0 + 35, 160, y0 + 10 - i * 2);
        p.stroke();
      }
      p.globalAlpha = 1;
      fuga(p, "rgba(0,0,0,.08)");
      for (const [x, y] of [[0, 0], [75, 0], [0, 75], [75, 75]]) p.strokeRect(x, y, 75, 75);
      break;
    }
    case "cotto": {
      p.fillStyle = "#e3d6c4";
      p.fillRect(0, 0, n, n);
      let i = 0;
      for (let y = 0; y < n; y += 25)
        for (let x = 0; x < n; x += 25) {
          p.fillStyle = varia(c, i++, 0.12);
          p.fillRect(x + 1.5, y + 1.5, 22, 22);
        }
      break;
    }
    case "esagonette": {
      p.fillStyle = "#d6d3cc";
      p.fillRect(0, 0, n, n);
      const r = 10, hx = r * Math.sqrt(3);
      let i = 0;
      for (let row = -1; row < n / (r * 1.5) + 1; row++)
        for (let col = -1; col < n / hx + 1; col++) {
          const cx = col * hx + (row % 2 ? hx / 2 : 0), cy = row * r * 1.5;
          p.beginPath();
          for (let a = 0; a < 6; a++) {
            const t = Math.PI / 6 + (a * Math.PI) / 3;
            p.lineTo(cx + Math.cos(t) * (r - 0.8), cy + Math.sin(t) * (r - 0.8));
          }
          p.closePath();
          p.fillStyle = c2 && (i * 7) % 11 === 0 ? c2 : varia(c, i, 0.05);
          i++;
          p.fill();
        }
      break;
    }
    case "cementine": {
      const t = 25;
      for (let y = 0; y < n; y += t)
        for (let x = 0; x < n; x += t) {
          p.fillStyle = "#efe9de";
          p.fillRect(x, y, t, t);
          p.fillStyle = c;
          for (const [dx, dy, a] of [[0, 0, 0], [t, 0, Math.PI / 2], [t, t, Math.PI], [0, t, -Math.PI / 2]]) {
            p.beginPath();
            p.moveTo(x + dx, y + dy);
            p.arc(x + dx, y + dy, t * 0.42, a, a + Math.PI / 2);
            p.fill();
          }
          p.fillStyle = c2 || "#b08a3e";
          p.beginPath();
          p.arc(x + t / 2, y + t / 2, t * 0.14, 0, Math.PI * 2);
          p.fill();
          p.strokeStyle = c;
          p.lineWidth = 1.2;
          p.beginPath();
          p.moveTo(x + t / 2, y + 3);
          p.lineTo(x + t - 3, y + t / 2);
          p.lineTo(x + t / 2, y + t - 3);
          p.lineTo(x + 3, y + t / 2);
          p.closePath();
          p.stroke();
          fuga(p, "rgba(0,0,0,.12)");
          p.strokeRect(x, y, t, t);
        }
      break;
    }
    case "mosaico": {
      p.fillStyle = "#e5e7eb";
      p.fillRect(0, 0, n, n);
      let i = 0;
      for (let y = 0; y < n; y += 5)
        for (let x = 0; x < n; x += 5) {
          p.fillStyle = c2 && (i * 13) % 7 === 0 ? c2 : varia(c, i, 0.16);
          i++;
          p.fillRect(x + 0.5, y + 0.5, 4.2, 4.2);
        }
      break;
    }
    case "scacchiera": {
      for (let y = 0; y < n; y += 25)
        for (let x = 0; x < n; x += 25) {
          p.fillStyle = ((x + y) / 25) % 2 ? c2 || "#f1ede4" : c;
          p.fillRect(x, y, 25, 25);
        }
      fuga(p, "rgba(0,0,0,.1)");
      for (let i = 0; i <= n; i += 25) {
        p.beginPath();
        p.moveTo(i, 0);
        p.lineTo(i, n);
        p.moveTo(0, i);
        p.lineTo(n, i);
        p.stroke();
      }
      break;
    }
    case "resina": {
      const gr = p.createLinearGradient(0, 0, n, n);
      gr.addColorStop(0, scurisci(c, 1.03));
      gr.addColorStop(1, scurisci(c, 0.96));
      p.fillStyle = gr;
      p.fillRect(0, 0, n, n);
      for (let i = 1; i <= 500; i++) {
        p.fillStyle = `rgba(0,0,0,${grana(i) * 0.03})`;
        p.fillRect(grana(i * 3) * n, grana(i * 7) * n, 3, 3);
      }
      break;
    }
    case "moquette": {
      p.fillStyle = c;
      p.fillRect(0, 0, n, n);
      for (let i = 1; i <= 2600; i++) {
        p.fillStyle = `rgba(${grana(i * 5) < 0.5 ? "0,0,0" : "255,255,255"},${grana(i) * 0.07})`;
        p.fillRect(grana(i * 3) * n, grana(i * 11) * n, 1.5, 1.5);
      }
      break;
    }
    default:
      p.fillStyle = c;
      p.fillRect(0, 0, n, n);
  }
  return cv;
}

/** La finitura di partenza di una stanza, dal suo nome (e se e' fuori). */
export function finituraDiPartenza(nome = "", fuori = false) {
  if (fuori || /cortile|terrazz|balcon|loggia|veranda|patio|terrace|balcony/i.test(nome)) return { tipo: "cotto", colore: "#c27a4a" };
  if (/box|garage|tecnic|cantina|lavanderia|laundry|cellar/i.test(nome)) return { tipo: "resina", colore: "#8d9095" };
  if (/bagno|wc|bath|toilet/i.test(nome)) return { tipo: "gres60", colore: "#d9cbb3" };
  if (/cucina|kitchen/i.test(nome)) return { tipo: "gres60", colore: "#eeeae3" };
  if (/ingresso|disimpegno|corridoio|ripostiglio|hall|entrance|corridor/i.test(nome)) return { tipo: "gres60", colore: "#e7e1d6" };
  return { tipo: "listoni", colore: "#c19a6b" };
}

/** La finitura di una stanza: quella scelta, o quella di partenza. */
export function finituraDellaStanza(s) {
  const f = s?.pavimento;
  if (f && PAVIMENTO_PER_CHIAVE[f.tipo]) return f;
  return finituraDiPartenza(s?.nome, s?.fuori);
}

/* Quanti pixel per metro: 75, come il riquadro. Una casa grande si rimpicciolisce
 * per stare in una tela da 2048 px, e il motivo con lei. */
const PIXEL_PER_METRO = 75;
const TELA_AL_MASSIMO = 2048;

/**
 * Il pavimento di un piano: ogni stanza col suo motivo, le porte col pavimento
 * della stanza accanto, il resto trasparente. `tipo` e' la griglia espansa.
 * Torna la tela (W×H celle in scala).
 */
export function pavimentoDellaPianta(piano, tipo, disegna = riquadro) {
  const { W, H, passo } = piano;
  const scala = Math.max(1, Math.min(PIXEL_PER_METRO * passo, TELA_AL_MASSIMO / Math.max(W, H)));
  const fattore = scala / (PIXEL_PER_METRO * passo);
  const out = document.createElement("canvas");
  out.width = Math.round(W * scala);
  out.height = Math.round(H * scala);
  const g = out.getContext("2d");
  const maschere = new Map();
  const segna = (id, i) => {
    if (!maschere.has(id)) maschere.set(id, new ImageData(W, H));
    maschere.get(id).data[i * 4 + 3] = 255;
  };
  for (let i = 0; i < W * H; i++) {
    const t = tipo[i];
    if (t > 0) segna(t, i);
    else if (t === -5) {
      const vicino = [i - 1, i + 1, i - W, i + W].map((j) => tipo[j]).find((x) => x > 0);
      if (vicino) segna(vicino, i);
    }
  }
  const perId = new Map((piano.stanze || []).map((s) => [s.id, s]));
  const maschera = document.createElement("canvas");
  maschera.width = W;
  maschera.height = H;
  const mg = maschera.getContext("2d");
  const strato = document.createElement("canvas");
  strato.width = out.width;
  strato.height = out.height;
  const s = strato.getContext("2d");
  for (const [id, msk] of maschere) {
    const f = finituraDellaStanza(perId.get(id) || { nome: "" });
    s.globalCompositeOperation = "source-over";
    s.clearRect(0, 0, strato.width, strato.height);
    const motivo = s.createPattern(disegna(f.tipo, f.colore, f.colore2 || ""), "repeat");
    if (motivo?.setTransform && typeof DOMMatrix === "function") {
      const m = new DOMMatrix().scaleSelf(fattore, fattore);
      if (f.diagonale) m.rotateSelf(45);
      motivo.setTransform(m);
    }
    s.fillStyle = motivo || f.colore;
    s.fillRect(0, 0, strato.width, strato.height);
    mg.clearRect(0, 0, W, H);
    mg.putImageData(msk, 0, 0);
    s.globalCompositeOperation = "destination-in";
    s.imageSmoothingEnabled = false;
    s.drawImage(maschera, 0, 0, strato.width, strato.height);
    g.drawImage(strato, 0, 0);
  }
  return out;
}
