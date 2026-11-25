/* La casa «in pianta»: ogni piano visto dall'alto, per i dispositivi dove il
 * 3D non c'e' (vedi `core/la-grafica-della-casa-3d.js`).
 *
 * Fa le stesse cose della scena in 3D con quello che c'e' in ogni browser:
 * una tela 2D per il piano (le stanze, i muri, le finestre, dalla stessa
 * griglia che usa il 3D) e sopra i dispositivi come tasti, col loro stato
 * vero e lo stesso tocco — la luce si accende, la tapparella sale, la
 * telecamera apre il video, il clima chiede la modalita'. Da «Esterno» si
 * scelgono i piani. Niente giro di fotogrammi: si ridisegna solo quando
 * cambia uno stato o la misura.
 *
 * Ha gli stessi comandi della scena (`apri`, `aggiornaStati`, `distruggi`,
 * …), cosi' chi la tiene non deve sapere quale delle due ha in mano. Arredare
 * resta del 3D: qui lo si dice. */
import {
  CELLA,
  DISPOSITIVI_3D,
  azioneDelTocco,
  espandiGriglia,
  statoDelDispositivo,
} from "../../core/casa-3d.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* I colori della pianta, chiari e scuri. Le stanze prendono il colore del loro
 * pavimento, schiarito o scurito; senza pavimento un colore della tavolozza. */
const TAVOLOZZA = ["#e8dcc6", "#d7e3ee", "#e3e8d5", "#efdcd6", "#dcd9ec", "#d9ece6", "#ece6d2", "#e0e0e0"];
const COLORI = {
  light: { muro: "#334155", finestra: "#38bdf8", porta: "#f1ece2", fuori: "#c9e6c3", mescola: 0.45, sfondo: [255, 255, 255] },
  dark: { muro: "#cbd5e1", finestra: "#38bdf8", porta: "#1e293b", fuori: "#1d3b2c", mescola: 0.72, sfondo: [15, 23, 42] },
};
/* Quanto puo' essere grande, al piu', la tela del piano (in pixel veri). */
const PIXEL_AL_MASSIMO = 2_400_000;
/* Sotto questa misura (in metri quadri) il nome della stanza non ci sta. */
const STANZA_CON_NOME_M2 = 3;

const rgb = (hex) => {
  const h = String(hex || "").replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h.slice(0, 6), 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [220, 220, 220];
};
const verso = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/**
 * Il piano pronto da disegnare: la griglia aperta, il riquadro dove c'e'
 * qualcosa (i bordi vuoti non rubano spazio), e dove scrivere i nomi.
 * Si fa una volta per piano.
 */
export function pianoDellaPianta(dati) {
  const W = dati.W | 0,
    H = dati.H | 0,
    passo = Number(dati.passo) || 0.05;
  const tipo = espandiGriglia(dati.griglia, W * H);
  let x0 = W,
    y0 = H,
    x1 = -1,
    y1 = -1;
  const conti = new Map();
  for (let i = 0; i < W * H; i++) {
    const t = tipo[i];
    if (t === CELLA.fuori) continue;
    const x = i % W,
      y = (i / W) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (t > 0) {
      const c = conti.get(t) || { n: 0, sx: 0, sy: 0, x0: x, x1: x, y0: y };
      c.n++;
      c.sx += x;
      c.sy += y;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      conti.set(t, c);
    }
  }
  if (x1 < 0) {
    x0 = y0 = 0;
    x1 = W - 1;
    y1 = H - 1;
  }
  const stanze = [];
  for (const s of dati.stanze || []) {
    const c = conti.get(s.id);
    if (!c) continue;
    let cx = Math.round(c.sx / c.n),
      cy = Math.round(c.sy / c.n);
    /* una stanza a L ha il baricentro fuori: la sua cella piu' vicina */
    if (tipo[cy * W + cx] !== s.id) {
      let meglio = Infinity;
      for (let i = 0; i < W * H; i++) {
        if (tipo[i] !== s.id) continue;
        const x = i % W,
          y = (i / W) | 0,
          d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d < meglio) [meglio, cx, cy] = [d, x, y];
      }
    }
    /* Il nome va in cima alla stanza, non in mezzo: in mezzo c'e' quasi sempre la
     * luce, e il suo tasto lo coprirebbe. */
    stanze.push({ id: s.id, nome: s.nome, cx: cx + 0.5, cy: cy + 0.5, nx: (c.x0 + c.x1 + 1) / 2, ny: c.y0, m2: c.n * passo * passo });
  }
  return { W, H, passo, tipo, x0, y0, x1, y1, stanze, dati };
}

/** Il colore di ogni cella, in un'immagine grande quanto il riquadro (un pixel per cella). */
export function coloriDelPiano(P, tema = "light") {
  const C = COLORI[tema] || COLORI.light;
  const largo = P.x1 - P.x0 + 1,
    alto = P.y1 - P.y0 + 1;
  const pixel = new Uint8ClampedArray(largo * alto * 4);
  const perStanza = new Map();
  (P.dati.stanze || []).forEach((s, i) => {
    const base = s.fuori ? rgb(C.fuori) : rgb(s.pavimento?.colore || TAVOLOZZA[i % TAVOLOZZA.length]);
    perStanza.set(s.id, s.fuori ? base : verso(base, C.sfondo, C.mescola));
  });
  const muro = rgb(C.muro),
    finestra = rgb(C.finestra),
    porta = rgb(C.porta),
    ignota = verso(rgb(TAVOLOZZA[0]), C.sfondo, C.mescola);
  for (let y = 0; y < alto; y++)
    for (let x = 0; x < largo; x++) {
      const t = P.tipo[(y + P.y0) * P.W + x + P.x0];
      const o = (y * largo + x) * 4;
      let c = null;
      if (t > 0) c = perStanza.get(t) || ignota;
      else if (t === CELLA.muro) c = muro;
      else if (t === CELLA.davanzale) c = finestra;
      else if (t === CELLA.porta) c = porta;
      if (!c) continue;
      pixel[o] = c[0];
      pixel[o + 1] = c[1];
      pixel[o + 2] = c[2];
      pixel[o + 3] = 255;
    }
  return { largo, alto, pixel };
}

/** Quanti pixel per cella perche' il riquadro stia in `w`×`h` (con un margine). */
export function scalaDelPiano(P, w, h, margine = 16) {
  const largo = P.x1 - P.x0 + 1,
    alto = P.y1 - P.y0 + 1;
  const s = Math.min((Math.max(0, w) - margine * 2) / largo, (Math.max(0, h) - margine * 2) / alto);
  return Math.max(0.5, Number.isFinite(s) ? s : 1);
}

/** Le luci accese di un piano, per le schede di «Esterno». */
function luciAccese(p, states) {
  return (p.dispositivi || []).filter((d) => d.k === "luce" && d.entity && ["on"].includes(states[d.entity]?.state)).length;
}

/**
 * La pianta dentro `contenitore`. Le opzioni sono quelle della scena:
 * { contenitore, casa, stati, italiano, quandoTocchi, quandoCambiVista,
 *   motivo, si3d }. `motivo` e' il perche' della pianta (gia' detto in
 * parole), `si3d` se si puo' tornare a provare il 3D.
 */
export function creaPianta(opzioni = {}) {
  const { contenitore, stati = () => ({}), italiano = true, quandoTocchi = () => {}, quandoCambiVista = () => {} } = opzioni;
  const L = (it, en) => (italiano ? it : en);
  const leggiStati = () => (typeof stati === "function" ? stati() : stati) || {};
  const casa = opzioni.casa || { piani: [], esterno: {} };
  const piani = (casa.piani || []).slice().sort((a, b) => b.livello - a.livello);
  installaLoStile();

  const palco = document.createElement("div");
  palco.className = "c3-pianta";
  palco.innerHTML = `<div class="c3-pianta-foglio"><canvas></canvas><div class="c3-pianta-nomi"></div><div class="c3-pianta-tasti"></div></div><div class="c3-pianta-piani"></div>${
    opzioni.motivo || opzioni.si3d
      ? `<div class="c3-pianta-nota">${opzioni.motivo ? `<span>${esc(opzioni.motivo)}</span>` : ""}${
          opzioni.si3d ? `<button type="button" class="c3-pianta-3d" data-c3s="vista3d">🧊 ${esc(L("Prova il 3D", "Try 3D"))}</button>` : ""
        }</div>`
      : ""
  }`;
  contenitore.appendChild(palco);
  const foglio = palco.querySelector(".c3-pianta-foglio");
  const tela = foglio.querySelector("canvas");
  const strNomi = foglio.querySelector(".c3-pianta-nomi");
  const strTasti = foglio.querySelector(".c3-pianta-tasti");
  const elenco = palco.querySelector(".c3-pianta-piani");

  const S = { vista: "esterno", stati: leggiStati(), morto: false, sospesa: false, pronti: new Map(), tasti: [], firma: "" };
  const tema = () => (palco.closest("[data-tema]")?.dataset.tema === "dark" ? "dark" : "light");
  const pronto = (p) => {
    if (!S.pronti.has(p.k)) S.pronti.set(p.k, pianoDellaPianta(p));
    return S.pronti.get(p.k);
  };

  /* Il tocco su un dispositivo: quello del 3D (vedi `tocca` in scena.js). */
  function tocca(d) {
    const entity = d.entity;
    if (!entity) return quandoTocchi({ pagina: "scollegato", k: d.k });
    if (d.k === "telecamera") return quandoTocchi({ pagina: "telecamera", entity });
    const azione = azioneDelTocco(d.k, entity, S.stati[entity]);
    if (String(entity).startsWith("climate.")) return quandoTocchi({ pagina: "clima", entity, azione });
    quandoTocchi(azione || { pagina: "entita", entity });
  }

  function tastoMarkup(d, i) {
    const st = statoDelDispositivo(d.k, S.stati[d.entity], italiano);
    const icona = DISPOSITIVI_3D[d.k]?.icona || "•";
    const nome = d.nome || S.stati[d.entity]?.attributes?.friendly_name || DISPOSITIVI_3D[d.k]?.nome?.[italiano ? 0 : 1] || "";
    const testo = String(st.testo || "").replace(icona, "").trim();
    return `<button type="button" class="c3-pd" data-i="${i}" data-tono="${esc(d.entity ? st.tono : "scollegato")}"
      aria-label="${esc(`${nome}${testo ? ": " + testo : ""}`)}"><span class="c3-pd-icona" aria-hidden="true">${icona}</span>${
        testo ? `<small>${esc(testo)}</small>` : ""
      }</button>`;
  }

  /* «Esterno»: i piani da scegliere, e le telecamere di fuori. */
  function disegnaEsterno() {
    foglio.hidden = true;
    elenco.hidden = false;
    const fuori = (casa.esterno?.telecamere || []).filter((d) => d.entity);
    S.tasti = fuori;
    elenco.innerHTML = `<p class="c3-pianta-invito">${esc(L("Tocca un piano per vederlo dall'alto", "Tap a floor to see it from above"))}</p>
      <div class="c3-pianta-schede">${piani
        .map((p) => {
          const accese = luciAccese(p, S.stati);
          const quanti = (p.dispositivi || []).filter((d) => d.entity).length;
          return `<button type="button" class="c3-pianta-scheda" data-piano="${esc(p.k)}"><b>${esc(p.nome)}</b><span>${
            accese ? `💡 ${accese} ${esc(accese === 1 ? L("accesa", "on") : L("accese", "on"))}` : esc(L("luci spente", "lights off"))
          } · ${quanti} ${esc(L("dispositivi", "devices"))}</span></button>`;
        })
        .join("")}</div>${
        fuori.length
          ? `<div class="c3-pianta-fuori"><b>${esc(L("Fuori", "Outside"))}</b><div>${fuori.map(tastoMarkup).join("")}</div></div>`
          : ""
      }`;
  }

  function disegnaPiano(p) {
    foglio.hidden = false;
    elenco.hidden = true;
    const P = pronto(p);
    const w = foglio.clientWidth,
      h = foglio.clientHeight;
    if (!w || !h) return;
    const s = scalaDelPiano(P, w, h);
    const largo = P.x1 - P.x0 + 1,
      alto = P.y1 - P.y0 + 1;
    const cssW = Math.round(largo * s),
      cssH = Math.round(alto * s);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const k = Math.min(dpr, Math.sqrt(PIXEL_AL_MASSIMO / Math.max(1, cssW * cssH)));
    const ox = Math.round((w - cssW) / 2),
      oy = Math.round((h - cssH) / 2);
    const firma = `${p.k}|${w}x${h}|${tema()}`;
    if (S.firma !== firma) {
      S.firma = firma;
      tela.width = Math.max(1, Math.round(cssW * k));
      tela.height = Math.max(1, Math.round(cssH * k));
      Object.assign(tela.style, { width: `${cssW}px`, height: `${cssH}px`, left: `${ox}px`, top: `${oy}px` });
      const img = coloriDelPiano(P, tema());
      const piccola = document.createElement("canvas");
      piccola.width = img.largo;
      piccola.height = img.alto;
      piccola.getContext("2d").putImageData(new ImageData(img.pixel, img.largo, img.alto), 0, 0);
      const g = tela.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, tela.width, tela.height);
      g.drawImage(piccola, 0, 0, tela.width, tela.height);
      strNomi.innerHTML = P.stanze
        .filter((x) => x.m2 >= STANZA_CON_NOME_M2)
        .map((x) => `<span style="left:${Math.round(ox + (x.nx - P.x0) * s)}px;top:${Math.round(oy + (x.ny - P.y0) * s) + 16}px">${esc(x.nome)}</span>`)
        .join("");
    }
    S.tasti = (p.dispositivi || []).slice();
    S.posto = (d) => ({
      x: Math.round(ox + (d.x / P.passo - P.x0) * s),
      y: Math.round(oy + (d.y / P.passo - P.y0) * s),
    });
    strTasti.innerHTML = S.tasti
      .map((d, i) => {
        const q = S.posto(d);
        return tastoMarkup(d, i).replace("<button ", `<button style="left:${q.x}px;top:${q.y}px" `);
      })
      .join("");
  }

  function disegna() {
    if (S.morto || S.sospesa) return;
    const p = S.vista === "esterno" ? null : piani.find((x) => x.k === S.vista);
    palco.dataset.vista = p ? "piano" : "esterno";
    if (p) disegnaPiano(p);
    else disegnaEsterno();
  }

  function alClic(ev) {
    const piano = ev.target.closest?.("[data-piano]");
    if (piano) {
      ev.stopPropagation();
      apri(piano.dataset.piano);
      return;
    }
    const tasto = ev.target.closest?.(".c3-pd");
    if (!tasto) return;
    ev.stopPropagation();
    const d = S.tasti[Number(tasto.dataset.i)];
    if (d) tocca(d);
  }
  palco.addEventListener("click", alClic);

  function apri(k) {
    const p = k === "esterno" ? null : piani.find((x) => x.k === k);
    if (k !== "esterno" && !p) return false;
    S.vista = p ? p.k : "esterno";
    disegna();
    try {
      quandoCambiVista(S.vista);
    } catch (_errore) {}
    return true;
  }
  function aggiornaStati(states) {
    S.stati = states || {};
    disegna();
  }
  function ridimensiona() {
    S.firma = "";
    disegna();
  }
  function sospendi(si) {
    const ferma = Boolean(si);
    if (S.sospesa === ferma) return;
    S.sospesa = ferma;
    if (!ferma) disegna();
  }
  function distruggi() {
    if (S.morto) return;
    S.morto = true;
    osservatore?.disconnect();
    palco.removeEventListener("click", alClic);
    palco.remove();
  }
  const osservatore = typeof ResizeObserver === "function" ? new ResizeObserver(() => ridimensiona()) : null;
  osservatore?.observe(foglio);

  /* Una casa di un piano solo si apre gia' dentro: fuori non c'e' niente da scegliere. */
  apri(piani.length === 1 && !(casa.esterno?.telecamere || []).some((d) => d.entity) ? piani[0].k : "esterno");

  return {
    pianta: true,
    aggiornaStati,
    apri,
    /* Arredare si fa nel 3D: qui niente da spostare. */
    arreda: () => {},
    distruggi,
    ridimensiona,
    sospendi,
    nomi: () => {},
    vista: () => S.vista,
  };
}

let stileMesso = false;
function installaLoStile() {
  if (stileMesso || document.getElementById("dm-casa3d-pianta-stile")) return;
  stileMesso = true;
  const st = document.createElement("style");
  st.id = "dm-casa3d-pianta-stile";
  st.textContent = `
  .c3-pianta{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;border-radius:inherit;
    background:var(--c3-morbido,#f8fafc);color:var(--c3-testo,#0a0e17)}
  .c3-pianta-nota{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 48px 12px;padding:8px 12px;border-radius:14px;
    background:color-mix(in srgb,var(--c3-accento,#0ea5e9) 12%,transparent);font-size:12.5px;font-weight:700;color:var(--c3-fioco,#64748b)}
  .c3-pianta-nota span{flex:1 1 220px}
  .c3-pianta-3d{flex:0 0 auto;padding:7px 12px;border-radius:999px;border:1px solid var(--c3-bordo,#e2e8f0);background:var(--c3-card,#fff);
    font-weight:800;font-size:12.5px;cursor:pointer}
  /* lo spazio in cima e' del tasto «Nomi», quello ai lati delle fasce ‹ › */
  .c3-pianta-foglio{position:relative;flex:1 1 auto;min-height:0;margin:44px 40px 0}
  .c3-pianta-foglio canvas{position:absolute;border-radius:6px;box-shadow:0 2px 14px rgba(15,23,42,.12)}
  .c3-pianta-nomi span{position:absolute;transform:translate(-50%,-50%);font-size:11px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;
    color:var(--c3-fioco,#64748b);white-space:nowrap;pointer-events:none;text-shadow:0 0 3px var(--c3-morbido,#fff)}
  .c3-pd{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:1px;min-width:42px;min-height:42px;
    padding:5px 6px;border-radius:14px;border:1px solid var(--c3-bordo,#e2e8f0);background:var(--c3-card,#fff);cursor:pointer;
    box-shadow:0 2px 8px rgba(15,23,42,.18);line-height:1}
  .c3-pianta-fuori .c3-pd{position:static;transform:none}
  .c3-pd-icona{font-size:20px;line-height:1}
  .c3-pd small{font-size:10px;font-weight:800;color:var(--c3-fioco,#64748b);white-space:nowrap;max-width:90px;overflow:hidden;text-overflow:ellipsis}
  .c3-pd[data-tono="luce"]{background:#fde68a;border-color:#f59e0b;box-shadow:0 0 0 5px rgba(253,224,71,.35),0 0 22px rgba(250,204,21,.7)}
  .c3-pd[data-tono="luce"] small{color:#92400e}
  .c3-pd[data-tono="clima"]{border-color:#38bdf8;box-shadow:0 0 0 4px rgba(56,189,248,.25)}
  .c3-pd[data-tono="allarme"],.c3-pd[data-tono="movimento"]{border-color:#ef4444;box-shadow:0 0 0 4px rgba(239,68,68,.25)}
  .c3-pd[data-tono="lavora"]{border-color:#a78bfa;box-shadow:0 0 0 4px rgba(167,139,250,.25)}
  .c3-pd[data-tono="ok"]{border-color:#22c55e}
  .c3-pd[data-tono="scollegato"]{opacity:.55;border-style:dashed}
  .c3-pianta-piani{flex:1 1 auto;overflow:auto;padding:56px 48px 18px}
  /* sul telefono le fasce ai lati non ci sono (stanno in cima): la pianta si prende la larghezza */
  @media (max-width:700px){
    .c3-pianta-foglio{margin:52px 6px 0}
    .c3-pianta-piani{padding:96px 14px 14px}
    .c3-pianta-nota{margin:0 10px 10px}
  }
  .c3-pianta-invito{margin:0 0 12px;font-size:13px;font-weight:700;color:var(--c3-fioco,#64748b)}
  .c3-pianta-schede{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}
  .c3-pianta-scheda{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:18px;border-radius:18px;text-align:left;cursor:pointer;
    border:1px solid var(--c3-bordo,#e2e8f0);background:var(--c3-card,#fff);box-shadow:0 1px 2px rgba(15,23,42,.05)}
  .c3-pianta-scheda b{font-family:'Oswald',system-ui,sans-serif;font-size:20px;letter-spacing:.5px;text-transform:uppercase}
  .c3-pianta-scheda span{font-size:12.5px;font-weight:700;color:var(--c3-fioco,#64748b)}
  .c3-pianta-fuori{margin-top:16px}
  .c3-pianta-fuori>b{display:block;margin-bottom:8px;font-size:12px;letter-spacing:.5px;text-transform:uppercase;color:var(--c3-fioco,#64748b)}
  .c3-pianta-fuori>div{display:flex;gap:8px;flex-wrap:wrap}
  `;
  document.head.appendChild(st);
}
