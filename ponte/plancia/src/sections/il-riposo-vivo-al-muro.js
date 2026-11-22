/* Il riposo vivo del tablet a muro: il cielo di casa e la cornice delle foto.
 *
 * Il pannello (`plancia-a-muro-section.js`, `riposo()`) decide quale stile va
 * sul riposo e passa quello che sa gia' pronto — l'ora, la data, la riga col
 * tempo e la casa, gli avvisi, la scena del cielo calcolata dal nucleo
 * (`core/il-riposo-vivo.js`). Qui ci sono il disegno e il giro che lo muove:
 *
 *  - il CIELO su due tele: dietro il fondo fermo (il colore del cielo, il
 *    sole o la luna nella sua fase, le stelle, le colline lontane), che si
 *    ridipinge solo quando la scena cambia davvero; davanti quello che si
 *    muove (le nuvole, la pioggia, la neve, la nebbia, qualche stella che
 *    brilla), a pochi fotogrammi al secondo;
 *  - la CORNICE: le foto di casa a tutto schermo, una sull'altra in
 *    dissolvenza, ognuna con un avvicinamento lentissimo (il «Ken Burns»).
 *    Il movimento lo fa il browser con una transizione CSS, non un giro di
 *    fotogrammi.
 *
 * Tutto e' leggero apposta: i tablet a muro sono economici e accesi giorno e
 * notte. Le tele vanno a meta' della densita' dello schermo, i fotogrammi si
 * fermano quando la pagina non si vede, e con «riduci animazioni» il cielo e'
 * un'immagine ferma e le foto cambiano senza muoversi.
 *
 * Il pannello si ridisegna rattoppando il suo markup (`rattoppaSeCambia`):
 * le tele e la cornice hanno un `data-mu-vivo` col loro nome, e il pannello
 * le tiene com'erano (`teleDelRiposoVivo`) invece di rifarle a ogni battito.
 */
import {
  chiarezza,
  fotogrammiDelCielo,
  mescola,
  movimentoDellaFoto,
  fotoSuccessiva,
} from "../core/il-riposo-vivo.js";
import { indirizzoDellaFoto } from "./le-foto-del-riposo.js";
import { clean, doc, esc, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_RIPOSO_VIVO__";
const state = (root[KEY] ||= {
  scena: null,
  giro: null,
  firmaDelMoto: "",
  cornice: null,
  fotoDaMostrare: [],
  ogni: 60,
});

const menoMovimento = () => Boolean(root.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

const maiuscola = (testo) => {
  const s = clean(testo);
  return s ? s[0].toLocaleUpperCase() + s.slice(1) : "";
};

/* ── il markup ──────────────────────────────────────────────────────────── */

/**
 * Il riposo «Cielo di casa».
 *
 * `cose`: `{ ora, lungo, scena, riga, sotto, avvisi, pila, deriva: {x, y},
 * minimo }` — `riga` e `sotto` sono il markup del pannello (il tempo, la
 * casa, l'antifurto, l'assistente), gia' scritto e gia' pulito.
 */
export function riposoDelCielo(cose) {
  const s = cose.scena;
  state.scena = s;
  const d = cose.deriva || { x: 0, y: 0 };
  const c = s.colori;
  return `<div class="mu-riposo mu-vivo mu-cielo${cose.minimo ? " minimo" : ""}" data-mu-fa="sveglia" data-mu-vivo-stile="cielo" data-mu-vivo-fase="${esc(s.fase)}" style="--c-alto:${esc(c.alto)};--c-medio:${esc(c.medio)};--c-basso:${esc(c.basso)}">
    <canvas class="mu-vivo-tela" data-mu-vivo="cielo-fondo" aria-hidden="true"></canvas>
    <canvas class="mu-vivo-tela" data-mu-vivo="cielo-moto" aria-hidden="true"></canvas>
    <div class="mu-deriva mu-vivo-blocco" style="--dx:${d.x.toFixed(3)};--dy:${d.y.toFixed(3)}">
      ${cose.avvisi ? `<div class="mu-avvisi">${cose.avvisi}</div>` : ""}
      <div class="mu-vivo-ora">${esc(cose.ora)}</div>
      <div class="mu-vivo-data">${esc(maiuscola(cose.lungo))}${cose.pila || ""}</div>
      ${cose.riga || ""}
      ${cose.sotto || ""}
    </div>
  </div>`;
}

/**
 * Il riposo «Cornice foto».
 *
 * `cose`: `{ ora, lungo, meteo, foto: [id…], ogni, avvisi, pila, deriva,
 * minimo }` — `meteo` e' il markup corto del tempo (disegno, gradi, parola).
 * Le foto le mette il giro (`animaIlRiposoVivo`), non il markup: la cornice
 * resta la stessa da un battito all'altro.
 */
export function riposoDellaCornice(cose) {
  state.fotoDaMostrare = Array.isArray(cose.foto) ? cose.foto.slice() : [];
  state.ogni = Number(cose.ogni) || 60;
  const d = cose.deriva || { x: 0, y: 0 };
  return `<div class="mu-riposo mu-vivo mu-cornice${cose.minimo ? " minimo" : ""}" data-mu-fa="sveglia" data-mu-vivo-stile="foto">
    <div class="mu-cornice-foto" data-mu-vivo="cornice" aria-hidden="true"></div>
    <div class="mu-cornice-velo" aria-hidden="true"></div>
    <div class="mu-deriva mu-cornice-blocco" style="--dx:${d.x.toFixed(3)};--dy:${d.y.toFixed(3)}">
      ${cose.avvisi ? `<div class="mu-avvisi">${cose.avvisi}</div>` : ""}
      <div class="mu-cornice-ora">${esc(cose.ora)}</div>
      <div class="mu-cornice-data"><span>${esc(maiuscola(cose.lungo))}</span>${
        cose.meteo ? `<span class="mu-cornice-punto" aria-hidden="true">·</span>${cose.meteo}` : ""
      }${cose.pila || ""}</div>
    </div>
  </div>`;
}

/** Nel ridisegno del pannello, le tele e la cornice restano quelle che sono. */
export function teleDelRiposoVivo(vecchio, nuovo) {
  const nome = vecchio?.dataset?.muVivo;
  return Boolean(nome) && nome === nuovo?.dataset?.muVivo;
}

/* ── le tele ────────────────────────────────────────────────────────────── */

/* Meta' della densita' dello schermo basta a un cielo: e' sfumato, e la tela
 * da riempire a ogni fotogramma e' quattro volte piu' piccola. Il fondo, che
 * si dipinge una volta, puo' stare un poco piu' fitto. */
function preparaLaTela(tela, w, h, densita) {
  const larga = Math.max(1, Math.round(w * densita));
  const alta = Math.max(1, Math.round(h * densita));
  if (tela.width !== larga) tela.width = larga;
  if (tela.height !== alta) tela.height = alta;
  tela.style.width = `${w}px`;
  tela.style.height = `${h}px`;
  const x = tela.getContext("2d");
  if (!x) return null;
  x.setTransform(densita, 0, 0, densita, 0, 0);
  x.clearRect(0, 0, w, h);
  return x;
}

const densitaDelFondo = () => Math.min(1.5, Math.max(1, Number(root.devicePixelRatio) || 1));
const densitaDelMoto = () => Math.min(1, Math.max(0.5, (Number(root.devicePixelRatio) || 1) / 2));

/* I numeri a caso, sempre gli stessi: le stelle non cambiano posto a ogni
 * ridisegno. */
function aCaso(seme = 11) {
  let s = seme;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rgba = (esa, a) => {
  const s = esa.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
};

/* La luna nella sua fase: il disco spento appena visibile, poi la parte
 * illuminata — dal bordo acceso fino al terminatore, che e' mezza ellisse. */
export function disegnaLaLuna(x, cx, cy, r, luna) {
  const velo = 1 - 0.6 * (luna.velata || 0);
  const alone = x.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 5);
  alone.addColorStop(0, `rgba(226,232,255,${(0.22 * velo * (0.3 + luna.illuminata)).toFixed(3)})`);
  alone.addColorStop(1, "rgba(226,232,255,0)");
  x.fillStyle = alone;
  x.beginPath();
  x.arc(cx, cy, r * 5, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = `rgba(190,200,225,${(0.1 * velo).toFixed(3)})`;
  x.beginPath();
  x.arc(cx, cy, r, 0, Math.PI * 2);
  x.fill();
  if (luna.illuminata < 0.01) return;
  const destra = luna.crescente;
  const rx = r * Math.abs(Math.cos(2 * Math.PI * luna.fase));
  const gibbosa = luna.illuminata > 0.5;
  x.fillStyle = `rgba(246,243,230,${(0.96 * velo).toFixed(3)})`;
  x.beginPath();
  /* Il bordo acceso: la meta' destra crescendo, la sinistra calando. */
  x.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, !destra);
  /* Il terminatore, dal basso all'alto: verso il lato acceso per la falce,
   * verso quello spento per la gibbosa. In senso antiorario passa a destra. */
  const versoDestra = gibbosa ? !destra : destra;
  x.ellipse(cx, cy, Math.max(0.01, rx), r, 0, Math.PI / 2, -Math.PI / 2, versoDestra);
  x.closePath();
  x.fill();
  /* Qualche macchia, appena: una luna tutta liscia sembra un lampione. */
  x.save();
  x.clip();
  x.fillStyle = `rgba(150,150,140,${(0.18 * velo).toFixed(3)})`;
  for (const [dx, dy, k] of [
    [-0.3, -0.25, 0.28],
    [0.2, 0.1, 0.22],
    [-0.05, 0.38, 0.16],
    [0.35, -0.35, 0.12],
  ]) {
    x.beginPath();
    x.arc(cx + dx * r, cy + dy * r, k * r, 0, Math.PI * 2);
    x.fill();
  }
  x.restore();
}

/* Le colline lontane in fondo: due file, piu' scure davanti. Danno al cielo
 * un orizzonte senza disegnare una casa che non e' la loro. */
function colline(x, w, h, colore, altezza, seme) {
  const caso = aCaso(seme);
  const onde = [0, 1, 2].map(() => ({
    k: 1 + caso() * 3,
    f: caso() * Math.PI * 2,
    a: 0.3 + caso() * 0.7,
  }));
  x.fillStyle = colore;
  x.beginPath();
  x.moveTo(0, h);
  for (let i = 0; i <= 64; i += 1) {
    const px = (i / 64) * w;
    let y = 0;
    for (const o of onde) y += Math.sin((i / 64) * Math.PI * 2 * o.k + o.f) * o.a;
    x.lineTo(px, h - altezza * (0.62 + 0.16 * y));
  }
  x.lineTo(w, h);
  x.closePath();
  x.fill();
}

/** Il fondo fermo del cielo: colori, stelle, sole o luna, foschia, colline. */
export function disegnaIlFondoDelCielo(x, w, h, s) {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, s.colori.alto);
  g.addColorStop(0.55, s.colori.medio);
  g.addColorStop(1, s.colori.basso);
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  const corto = Math.min(w, h);
  if (s.stelle > 0.02) {
    const caso = aCaso(42);
    const quante = Math.round(((w * h) / 2600) * s.stelle);
    for (let i = 0; i < quante; i += 1) {
      const px = caso() * w;
      const py = Math.pow(caso(), 1.35) * h * 0.78;
      const r = caso() * 1.1 + 0.25;
      x.fillStyle = `rgba(255,255,255,${((0.2 + caso() * 0.75) * s.stelle).toFixed(3)})`;
      x.beginPath();
      x.arc(px, py, r, 0, Math.PI * 2);
      x.fill();
    }
  }
  if (s.sole) {
    const cx = s.sole.x * w;
    const cy = s.sole.y * h;
    const basso = s.altezza < 12;
    const caldo = basso ? "#ffb86b" : "#fff6d8";
    const velo = 1 - (s.sole.velato || 0);
    const alone = x.createRadialGradient(cx, cy, 0, cx, cy, corto * (basso ? 0.75 : 0.55));
    alone.addColorStop(0, rgba(caldo, 0.55 * velo));
    alone.addColorStop(0.25, rgba(caldo, 0.2 * velo));
    alone.addColorStop(1, rgba(caldo, 0));
    x.fillStyle = alone;
    x.fillRect(0, 0, w, h);
    x.fillStyle = rgba(basso ? "#ffd9a0" : "#fffdf3", 0.95 * velo);
    x.beginPath();
    x.arc(cx, cy, corto * 0.04, 0, Math.PI * 2);
    x.fill();
  }
  if (s.luna) disegnaLaLuna(x, s.luna.x * w, s.luna.y * h, corto * 0.055, s.luna);
  /* La foschia sull'orizzonte. */
  const foschia = x.createLinearGradient(0, h * 0.6, 0, h);
  foschia.addColorStop(0, rgba(s.colori.basso, 0));
  foschia.addColorStop(1, rgba(s.colori.basso, 0.55));
  x.fillStyle = foschia;
  x.fillRect(0, h * 0.6, w, h * 0.4);
  const notte = chiarezza(s.colori.alto) < 0.12;
  const lontane = mescola(
    mescola(s.colori.basso, s.colori.alto, 0.55),
    "#000000",
    notte ? 0.55 : 0.32,
  );
  const vicine = mescola(lontane, "#000000", notte ? 0.5 : 0.35);
  colline(x, w, h, lontane, h * 0.15, 7);
  colline(x, w, h, vicine, h * 0.09, 19);
}

/* ── quello che si muove ────────────────────────────────────────────────── */

/* Una nuvola, disegnata una volta su una tela sua: qualche sbuffo morbido,
 * piu' chiaro in alto. Poi si sposta e basta. */
function unaNuvola(documento, larga, colore, alfa, caso) {
  const tela = documento.createElement("canvas");
  const alta = Math.round(larga * 0.5);
  tela.width = Math.round(larga);
  tela.height = alta;
  const x = tela.getContext("2d");
  if (!x) return null;
  const sbuffi = 6 + Math.floor(caso() * 4);
  for (let i = 0; i < sbuffi; i += 1) {
    const t = (i + 0.5) / sbuffi;
    const cx = larga * (0.2 + 0.6 * t + (caso() - 0.5) * 0.06);
    const cy = alta * (0.6 - 0.14 * Math.sin(Math.PI * t) + (caso() - 0.5) * 0.06);
    /* Lo sbuffo resta dentro la sua tela: uno tagliato dal bordo farebbe un
     * gradino dritto in mezzo al cielo. */
    const r = Math.min(
      larga * (0.1 + 0.12 * Math.sin(Math.PI * t) + caso() * 0.05),
      cx - 1,
      larga - cx - 1,
      cy - 1,
      alta - cy - 1,
    );
    const g = x.createRadialGradient(cx, cy - r * 0.2, r * 0.1, cx, cy, r);
    g.addColorStop(0, rgba(colore, alfa));
    g.addColorStop(0.6, rgba(colore, alfa * 0.6));
    g.addColorStop(1, rgba(colore, 0));
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
  }
  return tela;
}

function unaBandaDiNebbia(documento, larga, alta, colore) {
  const tela = documento.createElement("canvas");
  tela.width = Math.round(larga);
  tela.height = Math.round(alta);
  const x = tela.getContext("2d");
  if (!x) return null;
  const g = x.createLinearGradient(0, 0, 0, alta);
  g.addColorStop(0, rgba(colore, 0));
  g.addColorStop(0.5, rgba(colore, 0.34));
  g.addColorStop(1, rgba(colore, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, larga, alta);
  /* Sfrangiata ai lati, perche' due copie una accanto all'altra non si vedano. */
  const lati = x.createLinearGradient(0, 0, larga, 0);
  lati.addColorStop(0, "rgba(0,0,0,0.6)");
  lati.addColorStop(0.5, "rgba(0,0,0,0)");
  lati.addColorStop(1, "rgba(0,0,0,0.6)");
  x.globalCompositeOperation = "destination-out";
  x.fillStyle = lati;
  x.fillRect(0, 0, larga, alta);
  return tela;
}

/**
 * Le cose che si muovono nel cielo: nuvole, pioggia, neve, nebbia, stelle
 * che brillano. Quante e di che colore lo dice la scena; `passo` le sposta,
 * `disegna` le mette sulla tela davanti.
 */
export class CieloCheSiMuove {
  constructor({ w, h, scena, documento = doc }) {
    this.w = w;
    this.h = h;
    this.t = 0;
    const caso = aCaso(97);
    const s = scena;
    const scala = Math.max(0.5, w / 1280);
    const notte = s.fase === "notte";
    const tramonto = s.fase === "alba" || s.fase === "tramonto";
    /* Il colore delle nuvole: bianche di giorno, grigie se e' coperto,
     * scaldate al tramonto, blu scuro di notte. */
    let colore = mescola("#ffffff", "#9aa3b2", Math.max(0, s.copre - 0.3));
    if (tramonto) colore = mescola(colore, s.colori.basso, 0.45);
    if (notte) colore = mescola(s.colori.medio, "#8090b0", 0.35);
    const alfa = notte ? 0.42 : 0.78;
    const veloce = s.vento ? 3.5 : 1;
    this.nuvole = [];
    for (let i = 0; i < s.nuvole; i += 1) {
      const larga = (300 + caso() * 320) * scala;
      const tela = unaNuvola(documento, larga, colore, alfa, caso);
      if (!tela) continue;
      this.nuvole.push({
        tela,
        x: caso() * (w + larga) - larga,
        y: h * (0.04 + caso() * 0.46),
        v: (3 + caso() * 5) * scala * veloce,
      });
    }
    this.gocce = [];
    const quanteGocce = s.pioggia === 2 ? 170 : s.pioggia ? 90 : 0;
    for (let i = 0; i < quanteGocce; i += 1)
      this.gocce.push({
        x: caso() * w,
        y: caso() * h,
        l: (12 + caso() * 16) * scala,
        v: (520 + caso() * 260) * scala,
      });
    this.fiocchi = [];
    const quantiFiocchi = s.neve ? Math.round(70 * Math.min(2, (w * h) / (1280 * 800))) : 0;
    for (let i = 0; i < quantiFiocchi; i += 1)
      this.fiocchi.push({
        x: caso() * w,
        y: caso() * h,
        r: (1 + caso() * 2.2) * scala,
        v: (18 + caso() * 30) * scala,
        f: caso() * Math.PI * 2,
      });
    this.nebbia = [];
    if (s.nebbia) {
      const coloreNebbia = notte ? "#7c8aa6" : "#e4e8ee";
      for (let i = 0; i < 3; i += 1) {
        const tela = unaBandaDiNebbia(documento, w, h * (0.22 + caso() * 0.12), coloreNebbia);
        if (tela)
          this.nebbia.push({
            tela,
            x: caso() * w,
            y: h * (0.35 + i * 0.18),
            v: (5 + caso() * 6) * scala,
          });
      }
    }
    this.brillano = [];
    if (s.stelle > 0.2)
      for (let i = 0; i < 14; i += 1)
        this.brillano.push({
          x: caso() * w,
          y: Math.pow(caso(), 1.3) * h * 0.7,
          r: 0.8 + caso() * 0.9,
          a: s.stelle,
          w: 0.6 + caso() * 1.4,
          f: caso() * Math.PI * 2,
        });
    this.vento = s.vento ? 0.35 : 0.12;
  }

  passo(dt) {
    this.t += dt;
    const { w, h } = this;
    for (const n of this.nuvole) {
      n.x += n.v * dt;
      if (n.x > w) n.x = -n.tela.width;
    }
    for (const g of this.gocce) {
      g.y += g.v * dt;
      g.x -= g.v * this.vento * dt;
      if (g.y > h) {
        g.y = -g.l;
        g.x = Math.random() * (w + 60);
      }
      if (g.x < -20) g.x += w + 40;
    }
    for (const f of this.fiocchi) {
      f.y += f.v * dt;
      f.x += Math.sin(this.t * 0.8 + f.f) * 10 * dt;
      if (f.y > h + 4) {
        f.y = -4;
        f.x = Math.random() * w;
      }
    }
    for (const b of this.nebbia) {
      b.x += b.v * dt;
      if (b.x > w) b.x -= w;
    }
  }

  disegna(x) {
    const { w, h } = this;
    x.clearRect(0, 0, w, h);
    for (const s of this.brillano) {
      const a = s.a * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.t * s.w + s.f)));
      x.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      x.beginPath();
      x.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      x.fill();
    }
    for (const n of this.nuvole) x.drawImage(n.tela, n.x, n.y);
    for (const b of this.nebbia) {
      x.drawImage(b.tela, b.x, b.y);
      x.drawImage(b.tela, b.x - w, b.y);
    }
    if (this.gocce.length) {
      x.strokeStyle = "rgba(214,226,244,0.36)";
      x.lineWidth = 1.2;
      x.beginPath();
      for (const g of this.gocce) {
        x.moveTo(g.x, g.y);
        x.lineTo(g.x - g.l * this.vento, g.y + g.l);
      }
      x.stroke();
    }
    if (this.fiocchi.length) {
      x.fillStyle = "rgba(255,255,255,0.86)";
      for (const f of this.fiocchi) {
        x.beginPath();
        x.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        x.fill();
      }
    }
  }
}

/* Un giro di fotogrammi a `fps` fotogrammi al secondo, fermo a pagina
 * nascosta. Con `fermo` si disegna una volta e basta. */
function giraAdagio(fotogramma, { fps = 5, finestra = root, fermo = false } = {}) {
  const documento = finestra.document;
  let richiesta = 0;
  let prima = 0;
  let spento = false;
  const intervallo = 1000 / Math.max(1, fps);
  const giro = (adesso) => {
    richiesta = 0;
    if (spento || documento?.hidden) return;
    const dt = prima ? adesso - prima : intervallo;
    if (dt >= intervallo - 4) {
      prima = adesso;
      fotogramma(Math.min(dt, 400) / 1000);
    }
    richiesta = finestra.requestAnimationFrame?.(giro) || 0;
  };
  const riparti = () => {
    if (spento || richiesta || documento?.hidden || fermo) return;
    prima = 0;
    richiesta = finestra.requestAnimationFrame?.(giro) || 0;
  };
  fotogramma(0);
  if (!fermo) riparti();
  documento?.addEventListener?.("visibilitychange", riparti);
  return {
    ferma() {
      spento = true;
      if (richiesta) finestra.cancelAnimationFrame?.(richiesta);
      richiesta = 0;
      documento?.removeEventListener?.("visibilitychange", riparti);
    },
  };
}

/* ── il giro ────────────────────────────────────────────────────────────── */

export function fermaIlRiposoVivo() {
  state.giro?.ferma();
  state.giro = null;
  state.firmaDelMoto = "";
  fermaLaCornice();
}

/**
 * Dopo ogni disegno del pannello: se sul riposo c'e' il cielo si dipinge il
 * fondo (solo se la scena e' cambiata) e si fa girare quello che si muove; se
 * c'e' la cornice si fanno passare le foto. Se non c'e' nessuno dei due, si
 * ferma tutto.
 */
export function animaIlRiposoVivo(nodo) {
  const riposo = nodo?.querySelector?.(".mu-riposo.mu-vivo");
  if (!riposo) {
    if (state.giro || state.cornice) fermaIlRiposoVivo();
    return false;
  }
  if (riposo.dataset.muVivoStile === "foto") {
    state.giro?.ferma();
    state.giro = null;
    state.firmaDelMoto = "";
    return animaLaCornice(riposo);
  }
  fermaLaCornice();
  return animaIlCielo(riposo);
}

function animaIlCielo(riposo) {
  const s = state.scena;
  const fondo = riposo.querySelector('canvas[data-mu-vivo="cielo-fondo"]');
  const moto = riposo.querySelector('canvas[data-mu-vivo="cielo-moto"]');
  const w = Math.round(riposo.clientWidth);
  const h = Math.round(riposo.clientHeight);
  if (!s || !fondo || !moto || !w || !h) return false;
  /* Al minimo di notte, o con meno movimento, il cielo e' un'immagine ferma. */
  const fermo = menoMovimento() || riposo.classList.contains("minimo");
  const misura = `${w}x${h}`;
  const firmaDelFondo = `${s.firma}|${misura}`;
  if (fondo.dataset.dipinta !== firmaDelFondo) {
    const x = preparaLaTela(fondo, w, h, densitaDelFondo());
    if (!x) return false;
    disegnaIlFondoDelCielo(x, w, h, s);
    fondo.dataset.dipinta = firmaDelFondo;
  }
  const fps = fotogrammiDelCielo(s);
  const firmaDelMoto = [
    s.fase,
    s.nuvole,
    s.pioggia,
    s.neve,
    s.nebbia,
    s.stelle > 0.2,
    s.vento,
    misura,
    fermo,
    fps,
  ].join("|");
  if (
    state.firmaDelMoto === firmaDelMoto &&
    moto.dataset.dipinta === firmaDelMoto &&
    (state.giro || !fps)
  )
    return true;
  state.giro?.ferma();
  state.giro = null;
  state.firmaDelMoto = firmaDelMoto;
  moto.dataset.dipinta = firmaDelMoto;
  const densita = densitaDelMoto();
  const x = preparaLaTela(moto, w, h, densita);
  if (!x) return false;
  if (!fps) return true;
  const cielo = new CieloCheSiMuove({ w, h, scena: s, documento: doc });
  /* Ferma, la pioggia e la neve stanno a meta' strada, come in una foto. */
  if (fermo) cielo.passo(0.4);
  state.giro = giraAdagio(
    (dt) => {
      cielo.passo(dt);
      cielo.disegna(x);
    },
    { fps, finestra: root, fermo },
  );
  return true;
}

/* ── la cornice ─────────────────────────────────────────────────────────── */

const DISSOLVENZA = 2.4;

function fermaLaCornice() {
  const c = state.cornice;
  if (!c) return;
  root.clearTimeout?.(c.timer);
  doc?.removeEventListener?.("visibilitychange", c.allaVista);
  state.cornice = null;
}

function animaLaCornice(riposo) {
  const posto = riposo.querySelector('[data-mu-vivo="cornice"]');
  if (!posto) return false;
  const fermo = menoMovimento() || riposo.classList.contains("minimo");
  let c = state.cornice;
  if (c && c.posto !== posto) {
    fermaLaCornice();
    c = null;
  }
  if (c) {
    c.fermo = fermo;
    /* La foto che si vede e' stata tolta: si passa alla dopo, subito. */
    if (c.attuale && !state.fotoDaMostrare.includes(c.attuale)) prossima(c, 0);
    return true;
  }
  c = {
    posto,
    fermo,
    attuale: "",
    giro: 0,
    timer: 0,
    allaVista: () => {
      if (doc.hidden) {
        root.clearTimeout?.(c.timer);
        c.timer = 0;
      } else if (!c.timer && state.cornice === c) prossima(c, 1500);
    },
  };
  state.cornice = c;
  doc?.addEventListener?.("visibilitychange", c.allaVista);
  /* Una foto c'e' gia' (il pannello si e' ridisegnato tenendo la cornice):
   * si continua da li'. */
  const gia = posto.querySelector("img[data-mu-foto]");
  if (gia) {
    c.attuale = gia.dataset.muFoto;
    prossima(c, state.ogni * 1000);
  } else prossima(c, 0);
  return true;
}

function prossima(c, fra) {
  root.clearTimeout?.(c.timer);
  c.timer = root.setTimeout?.(() => {
    c.timer = 0;
    if (state.cornice !== c || doc?.hidden) return;
    mostraLaProssima(c).catch(() => {});
  }, fra);
}

async function mostraLaProssima(c, tentativi = 0) {
  const ids = state.fotoDaMostrare;
  const dopo = fotoSuccessiva(ids, c.attuale, c.giro);
  if (!dopo) return;
  c.giro = dopo.giro;
  const url = await indirizzoDellaFoto(dopo.nome);
  if (state.cornice !== c) return;
  if (!url) {
    /* Una foto che non si legge si salta; se non se ne legge nessuna si
     * riprova fra un po', senza girare a vuoto. */
    c.attuale = dopo.nome;
    if (tentativi + 1 < ids.length) return mostraLaProssima(c, tentativi + 1);
    prossima(c, 60_000);
    return;
  }
  const img = doc.createElement("img");
  img.className = "mu-foto";
  img.alt = "";
  img.decoding = "async";
  img.dataset.muFoto = dopo.nome;
  img.src = url;
  try {
    await img.decode?.();
  } catch (_errore) {
    /* Si mostra lo stesso: decode non c'e' dappertutto. */
  }
  if (state.cornice !== c) return;
  const vecchie = [...c.posto.querySelectorAll("img[data-mu-foto]")];
  const durata = state.ogni + DISSOLVENZA + 2;
  if (c.fermo) {
    img.style.opacity = "1";
    c.posto.append(img);
    for (const v of vecchie) v.remove();
  } else {
    const { da, a } = movimentoDellaFoto(dopo.nome);
    const posa = (p) => `translate(${p.x}%, ${p.y}%) scale(${p.scala})`;
    img.style.opacity = vecchie.length ? "0" : "1";
    img.style.transform = posa(da);
    c.posto.append(img);
    /* Il browser deve vedere la posa di partenza prima di quella d'arrivo. */
    img.getBoundingClientRect();
    img.style.transition = `opacity ${DISSOLVENZA}s ease, transform ${durata}s linear`;
    img.style.opacity = "1";
    img.style.transform = posa(a);
    root.setTimeout?.(
      () => {
        for (const v of vecchie) if (v.isConnected) v.remove();
      },
      DISSOLVENZA * 1000 + 200,
    );
  }
  c.attuale = dopo.nome;
  prossima(c, state.ogni * 1000);
}

/* ── stile ──────────────────────────────────────────────────────────────── */

/** Il foglio del riposo vivo: `muro` e' il selettore del pannello. */
export function stileDelRiposoVivo(muro) {
  return `
${muro} .mu-riposo.mu-vivo{display:block;overflow:hidden;color:#fff;font-family:"Inter Display",Inter,sans-serif}
${muro} .mu-riposo.mu-cielo{background:linear-gradient(180deg,var(--c-alto,#0b1430) 0%,var(--c-medio,#16213f) 55%,var(--c-basso,#26304f) 100%)}
${muro} .mu-riposo.mu-cornice{background:#05070b}
${muro} .mu-vivo-tela{position:absolute;left:0;top:0;pointer-events:none}
${muro} .mu-vivo-blocco{gap:6px;text-shadow:0 2px 18px rgba(4,12,32,.38),0 1px 2px rgba(4,12,32,.3)}
${muro} .mu-vivo-ora{font-weight:200;font-size:min(220px,27vh,19vw);letter-spacing:-.025em;line-height:.92;font-variant-numeric:tabular-nums}
${muro} .mu-vivo-data{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px 16px;margin-top:8px;
  font-family:Inter,sans-serif;font-size:22px;font-weight:400;letter-spacing:.02em;color:rgba(255,255,255,.9)}
${muro} .mu-vivo-blocco .mu-pila{color:rgba(255,255,255,.85)}
${muro} .mu-vivo-blocco .mu-riposo-riga{color:rgba(255,255,255,.92);font-family:Inter,sans-serif;font-weight:600}
${muro} .mu-vivo-blocco .mu-riposo-riga .mu-attenzione{color:#fde68a}
${muro} .mu-vivo-blocco .mu-riposo-aree{color:rgba(255,255,255,.9)}
${muro} .mu-vivo-blocco .mu-riposo-aree b{color:#fff}
${muro} .mu-vivo-blocco .mu-tocca{color:rgba(255,255,255,.75);opacity:1}
${muro} .mu-vivo-blocco .mu-riposo-consiglio{text-shadow:none}
/* La cornice: le foto una sull'altra, il velo in basso per leggere l'ora. */
${muro} .mu-cornice-foto{position:absolute;inset:0;overflow:hidden}
${muro} .mu-cornice-foto .mu-foto{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;will-change:transform,opacity;
  transform-origin:50% 50%;backface-visibility:hidden}
${muro} .mu-cornice-velo{position:absolute;left:0;right:0;bottom:0;height:46%;pointer-events:none;
  background:linear-gradient(0deg,rgba(0,0,0,.58) 0%,rgba(0,0,0,.28) 45%,rgba(0,0,0,0) 100%)}
${muro} .mu-riposo.mu-cornice .mu-cornice-blocco{left:5.5%;top:auto;bottom:7%;align-items:flex-start;gap:4px;max-width:min(88%,900px);
  transform:translate(calc(var(--dx,0) * 22px),calc(var(--dy,0) * 14px));text-shadow:0 2px 14px rgba(0,0,0,.45)}
${muro} .mu-cornice-blocco .mu-avvisi{margin:0 0 12px}
${muro} .mu-cornice-ora{font-weight:300;font-size:76px;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
${muro} .mu-cornice-data{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;font-family:Inter,sans-serif;font-size:19px;
  font-weight:500;color:rgba(255,255,255,.92)}
${muro} .mu-cornice-data>span{display:inline-flex;align-items:center;gap:8px}
${muro} .mu-cornice-punto{opacity:.6}
${muro} .mu-cornice-data .mu-pila{margin-left:8px;color:rgba(255,255,255,.85)}
${muro}[data-compatto="1"] .mu-vivo-data{font-size:16px}
${muro}[data-compatto="1"] .mu-cornice-ora{font-size:52px}
${muro}[data-compatto="1"] .mu-cornice-data{font-size:14px}
/* Di notte, al minimo: appena visibile, sul nero. */
${muro} .mu-riposo.minimo{background:#000}
/* Con la luce e non con l'opacita': il blocco entra con un'animazione
 * d'opacita' («mu-appari»), che vincerebbe. */
${muro} .mu-riposo.minimo>*{filter:brightness(.24)}
${muro} .mu-riposo.mu-vivo.minimo>.mu-vivo-tela,${muro} .mu-riposo.mu-vivo.minimo>.mu-cornice-foto{filter:brightness(.16)}
@media (prefers-reduced-motion:reduce){${muro} .mu-cornice-foto .mu-foto{transition:none!important}}
`;
}
