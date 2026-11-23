/* Le feste sul tablet a muro, al riposo: la Vigilia, il conto alla rovescia,
 * i fuochi.
 *
 * Il riposo del pannello (`plancia-a-muro-section.js`, `riposo()`) di solito
 * e' l'orologio grande che si sposta piano su un fondo scuro. Dentro le feste
 * (`momentoDelMuro` in `core/feste.js`) diventa una scena:
 *
 *  - la VIGILIA: il cielo d'inverno con l'aurora, la luna, i monti, il bosco
 *    innevato, la baita con le finestre accese e l'albero con le luci; la
 *    neve cade a tre profondita'. In alto a sinistra l'orologio sottile con
 *    «BUONE FESTE» in oro, la data, e tre pastiglie di vetro — il tempo
 *    fuori, i gradi in casa, fino a quando restano accese le luci di Natale;
 *  - il 31 dicembre dalle 23:00, il CONTO alla rovescia a tutto schermo,
 *    anche di notte: «2026 → 2027», l'anello d'oro dei secondi, il numero
 *    grande;
 *  - dall'1 gennaio a mezzanotte per dieci minuti, i FUOCHI, con «Buon
 *    anno» e l'anno in oro. Poi il riposo torna quello delle feste.
 *
 * ── Chi fa cosa ───────────────────────────────────────────────────────────
 *
 * Qui ci sono il disegno (il markup dei tre riposi) e il giro che li anima.
 * Le cose della casa — l'ora, il meteo, la temperatura, le finestre aperte —
 * le sa il pannello, e le passa gia' pronte: questo file non legge gli stati
 * se non per le luci di Natale, e non importa il pannello, che importa lui.
 *
 * Il pannello si ridisegna rattoppando il suo markup (`rattoppaSeCambia`):
 * le tele hanno un `data-mu-feste` col nome della scena, e il pannello le
 * tiene com'erano (`teleDaTenere`) invece di rifarle e svuotarle a ogni giro
 * del battito. La scena ferma si dipinge una volta per misura dello schermo;
 * si muove solo la tela davanti.
 *
 * ── La deriva ─────────────────────────────────────────────────────────────
 *
 * Il riposo normale sposta il suo blocco un poco ogni minuto
 * (`derivaDelRiposo`), perche' niente resti acceso sempre negli stessi
 * pixel. Sulla Vigilia il blocco sta in alto a sinistra, e si sposta lo
 * stesso: di qualche decina di pixel attorno al suo posto, con gli stessi due
 * numeri.
 */
import {
  annoNuovo,
  contoAllaRovescia,
  festePulite,
  giornoConUnNome,
  intervalloDelGiorno,
  momentoDelMuro,
  oraDi,
} from "../core/feste.js";
import {
  Fuochi,
  NeveATreStrati,
  NeveLeggera,
  disegnaIFuochiFermi,
  disegnaIlFondoDeiFuochi,
  disegnaIlFondoDelConto,
  disegnaLAnello,
  disegnaLaVigilia,
  giraIFotogrammi,
  preparaLaTela,
} from "./disegni-delle-feste.js";
import { fiocchiSulRiposo } from "../core/le-luci-al-muro.js";
import { annuncioDelleLuci, luciQuiete, neveSulRiposo, scenaSulRiposo } from "./le-luci-al-muro.js";
import { clean, doc, esc, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_FESTE_AL_MURO__";
const state = (root[KEY] ||= { giro: null, scena: "", misura: "", motore: null });

const menoMovimento = () => Boolean(root.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

/** Quale scena delle feste va sul riposo adesso, o `""`. */
export function scenaDelleFeste(adesso = new Date()) {
  return momentoDelMuro(adesso) || "";
}

/** Il conto e i fuochi passano sopra il nero della notte; la Vigilia no. */
export const passaSopraLaNotte = (scena) => scena === "conto" || scena === "fuochi";

/* Il giorno con il nome suo, scritto in oro accanto alla data. */
const GIORNI_COL_NOME = () => ({
  vigilia: t("la Vigilia", "Christmas Eve"),
  natale: t("Natale", "Christmas Day"),
  "santo-stefano": t("Santo Stefano", "Boxing Day"),
  "san-silvestro": t("San Silvestro", "New Year's Eve"),
  capodanno: t("Capodanno", "New Year's Day"),
  epifania: t("l'Epifania", "Epiphany"),
});

/* Il glifo del tempo sulla pastiglia: e' vetro piccolo, e un disegno del
 * catalogo li' dentro si perderebbe. */
const GLIFI_DEL_METEO = {
  sunny: "☀️",
  "clear-night": "🌙",
  partlycloudy: "⛅",
  cloudy: "☁️",
  rainy: "🌧️",
  pouring: "🌧️",
  fog: "🌫️",
  snowy: "❄️",
  "snowy-rainy": "🌨️",
  hail: "🌨️",
  lightning: "⛈️",
  "lightning-rainy": "⛈️",
  windy: "💨",
};

const maiuscola = (testo) => {
  const s = clean(testo);
  return s ? s[0].toLocaleUpperCase() + s.slice(1) : "";
};

/* La pastiglia delle luci di Natale: fino a quando restano accese, o a che
 * ora si accendono stasera. Niente se non ce ne sono. */
function pastigliaDelleLuci(feste, states, adesso) {
  const config = festePulite(feste);
  if (!config.luci.length) return "";
  const accese = config.luci.some((l) => clean(states?.[l.entity]?.state) === "on");
  if (accese)
    return `🎄 ${esc(t("Luci accese fino alle", "Lights on until"))} <b>${esc(config.spegni.ora)}</b>`;
  const oggi = intervalloDelGiorno(
    config,
    adesso,
    states?.["sun.sun"]?.attributes?.next_setting || null,
  );
  if (oggi && adesso.getTime() < oggi.inizio)
    return `🎄 ${esc(t("Luci alle", "Lights at"))} <b>${esc(oraDi(oggi.inizio))}</b>`;
  return "";
}

/**
 * Il riposo della Vigilia.
 *
 * `cose`: quello che il pannello sa e passa pronto —
 * `{ ora, lungo, meteo: {gradi, condizione, parola}, casa: {testo, dove},
 *    aperte: {quante, parola}, avvisi, pila, feste, states, deriva: {x, y},
 *    fioco, momento }`.
 *
 * Con delle luci in configurazione, dietro l'orologio non c'e' la baita: c'e'
 * la scena delle luci di casa, con le luci nello stato vero
 * (`le-luci-al-muro.js`), e in un angolo «Spegni tutte», che non sveglia.
 * `momento` e' il momento dell'accensione: l'orologio si fa da parte.
 */
export function riposoDellaVigilia(cose, adesso = new Date()) {
  const nome = GIORNI_COL_NOME()[giornoConUnNome(adesso)] || "";
  const pastiglie = [];
  const m = cose.meteo;
  if (m && (m.gradi || m.parola))
    pastiglie.push(
      `${esc(GLIFI_DEL_METEO[m.condizione] || "🌡️")} ${m.gradi ? `<b>${esc(m.gradi)}</b> ` : ""}${esc(maiuscola(m.parola))}`,
    );
  if (cose.casa?.testo) pastiglie.push(`🏠 <b>${esc(cose.casa.testo)}</b> ${esc(cose.casa.dove)}`);
  const luci = pastigliaDelleLuci(cose.feste, cose.states, adesso);
  const quellaDelleLuci = luci ? pastiglie.length : -1;
  if (luci) pastiglie.push(luci);
  if (cose.aperte?.quante)
    pastiglie.push(`🪟 <b>${cose.aperte.quante}</b> ${esc(cose.aperte.parola)}`);
  const d = cose.deriva || { x: 0, y: 0 };
  const config = festePulite(cose.feste);
  const conLeLuci = config.luci.length > 0;
  const sotto = conLeLuci
    ? `${scenaSulRiposo()}${cose.fioco ? "" : neveSulRiposo()}`
    : `<canvas class="mu-feste-fondo" data-mu-feste="vigilia" aria-hidden="true"></canvas>
    <canvas class="mu-feste-moto" data-mu-feste="vigilia-neve" aria-hidden="true"></canvas>`;
  const classi = `${conLeLuci ? " mu-feste-luci" : ""}${conLeLuci && cose.momento ? " mu-luci-momento" : ""}${cose.fioco ? " fioco" : ""}`;
  return `<div class="mu-riposo mu-feste${classi}" data-mu-fa="sveglia" data-mu-scena="${conLeLuci ? "luci" : "vigilia"}">
    ${sotto}
    <div class="mu-deriva mu-feste-blocco" style="--dx:${d.x.toFixed(3)};--dy:${d.y.toFixed(3)}">
      ${cose.avvisi ? `<div class="mu-avvisi">${cose.avvisi}</div>` : ""}
      <div class="mu-feste-cap mu-feste-oro">${esc(t("Buone feste", "Happy holidays"))}</div>
      <div class="mu-feste-ora">${esc(cose.ora)}</div>
      <div class="mu-feste-data">${esc(maiuscola(cose.lungo))}${
        nome
          ? `<span class="mu-feste-punto" aria-hidden="true">·</span><span class="mu-feste-oro">${esc(nome)}</span>`
          : ""
      }${cose.pila || ""}</div>
      ${pastiglie.length ? `<div class="mu-feste-pastiglie">${pastiglie.map((p, i) => `<span class="mu-feste-pastiglia"${i === quellaDelleLuci ? " data-mu-pastiglia-luci" : ""}>${p}</span>`).join("")}</div>` : ""}
    </div>
    ${conLeLuci ? `${annuncioDelleLuci()}${luciQuiete(config, cose.states, d)}` : ""}
  </div>`;
}

/**
 * La cornice con le foto di casa, nel tempo delle scene: le foto restano
 * quelle scelte, e sopra ci sono la neve che cade, gli auguri in oro sopra
 * l'ora e, con delle luci accese, «Spegni tutte». Di notte al minimo niente
 * neve. Torna i pezzi che `riposoDellaCornice` mette al loro posto.
 */
export function festaSullaCornice({ feste = null, states = {}, deriva, minimo = false } = {}) {
  const config = festePulite(feste);
  return {
    cap: `<div class="mu-feste-cap mu-feste-oro mu-cornice-feste">${esc(t("Buone feste", "Happy holidays"))}</div>`,
    neve: minimo ? "" : neveSulRiposo(),
    dopo: config.luci.length ? luciQuiete(config, states, deriva) : "",
  };
}

/* Quello che dice il conto in questo momento: nell'ultimo minuto i secondi,
 * prima i minuti e i secondi. */
export function numeroDelConto(adesso = new Date()) {
  const conto = contoAllaRovescia(adesso);
  if (!conto) return { numero: "", lungo: false, secondi: 0, parola: "" };
  const restano = Math.ceil(conto.mancano / 1000);
  if (restano <= 60)
    return {
      numero: String(restano),
      lungo: false,
      secondi: restano,
      parola: t("Secondi al nuovo anno", "Seconds to the new year"),
    };
  const minuti = Math.floor((restano - 1) / 60);
  const secondi = restano - minuti * 60;
  return {
    numero: `${minuti}:${String(secondi % 60).padStart(2, "0")}`,
    lungo: true,
    secondi,
    parola: t("Minuti al nuovo anno", "Minutes to the new year"),
  };
}

/** Il riposo del conto alla rovescia, l'ultima ora dell'anno. */
export function riposoDelConto(adesso = new Date()) {
  const anno = annoNuovo(adesso);
  const n = numeroDelConto(adesso);
  return `<div class="mu-riposo mu-feste mu-feste-conto" data-mu-fa="sveglia" data-mu-scena="conto">
    <canvas class="mu-feste-fondo" data-mu-feste="conto" aria-hidden="true"></canvas>
    <canvas class="mu-feste-moto" data-mu-feste="conto-anello" aria-hidden="true"></canvas>
    <div class="mu-feste-anni mu-feste-cap"><span>${anno - 1}</span><span class="mu-feste-oro">→</span><span class="mu-feste-oro">${anno}</span></div>
    <div class="mu-feste-numero mu-feste-oro${n.lungo ? " lungo" : ""}" data-mu-feste-numero role="timer">${esc(n.numero)}</div>
    <div class="mu-feste-parola" data-mu-feste-parola>${esc(n.parola)}</div>
    <div class="mu-feste-sotto"><span class="mu-feste-pastiglia">🥂 ${esc(t("A mezzanotte:", "At midnight:"))} <b>${esc(
      t("i fuochi e gli auguri", "fireworks and best wishes"),
    )}</b></span></div>
  </div>`;
}

/** Il riposo dei fuochi, i primi dieci minuti dell'anno. */
export function riposoDeiFuochi(adesso = new Date()) {
  return `<div class="mu-riposo mu-feste mu-feste-fuochi" data-mu-fa="sveglia" data-mu-scena="fuochi">
    <canvas class="mu-feste-fondo" data-mu-feste="fuochi" aria-hidden="true"></canvas>
    <canvas class="mu-feste-moto" data-mu-feste="fuochi-moto" aria-hidden="true"></canvas>
    <div class="mu-feste-auguri">
      <div class="mu-feste-cap">${esc(t("Buon anno", "Happy new year"))}</div>
      <div class="mu-feste-anno mu-feste-oro">${annoNuovo(adesso)}</div>
      <div class="mu-feste-dedica">${esc(t("Tanti auguri da GdAHome", "Best wishes from GdAHome"))}</div>
    </div>
  </div>`;
}

/** Nel ridisegno del pannello, le tele delle feste restano quelle che sono. */
export function teleDaTenere(vecchio, nuovo) {
  const scena = vecchio?.dataset?.muFeste;
  return vecchio?.nodeName === "CANVAS" && Boolean(scena) && scena === nuovo?.dataset?.muFeste;
}

/* ── il giro ────────────────────────────────────────────────────────────── */

export function fermaLeFeste() {
  state.giro?.ferma();
  state.giro = null;
  state.scena = "";
  state.misura = "";
  state.motore = null;
}

/**
 * Dopo ogni disegno del pannello: se sul riposo c'e' una scena delle feste,
 * si dipinge il suo fondo (una volta per misura) e si fa girare quello che si
 * muove; se non c'e', si ferma tutto. `ridisegna` e' il disegno del pannello,
 * per quando la scena deve cambiare (la mezzanotte).
 */
export function animaLeFeste(nodo, { ridisegna = () => {} } = {}) {
  const riposo = nodo?.querySelector?.(".mu-riposo[data-mu-scena]");
  if (!riposo) {
    if (state.giro) fermaLeFeste();
    return false;
  }
  const scena = riposo.dataset.muScena;
  /* La scena delle luci la mette il pannello; qui, sopra di lei e sopra le
   * foto della cornice, solo la neve leggera. */
  if (scena === "luci" || scena === "foto") return nevicaSulRiposo(riposo, scena);
  const fondo = riposo.querySelector("canvas.mu-feste-fondo");
  const moto = riposo.querySelector("canvas.mu-feste-moto");
  const w = Math.round(riposo.clientWidth);
  const h = Math.round(riposo.clientHeight);
  if (!fondo || !moto || !w || !h) return false;
  const fermo = menoMovimento();
  /* Di notte, fioca, la Vigilia resta senza neve che cade. */
  const fioca = riposo.classList.contains("fioco");
  const misura = `${scena}|${w}x${h}|${fermo}|${fioca}`;
  /* Una tela tenuta dal rattoppo ha ancora il suo disegno: si rifa' solo se
   * cambia la scena o la misura, o se e' nata adesso (larghezza 300, quella
   * che il browser da' a una tela nuova). */
  const nuova = fondo.dataset.dipinta !== misura;
  if (!nuova && state.misura === misura && state.giro) return true;
  fermaLeFeste();
  state.scena = scena;
  state.misura = misura;
  for (const tela of [fondo, moto]) {
    tela.style.width = `${w}px`;
    tela.style.height = `${h}px`;
  }
  const xf = preparaLaTela(fondo, w, h, root);
  const xm = preparaLaTela(moto, w, h, root);
  if (!xf || !xm) return false;
  if (scena === "vigilia") disegnaLaVigilia(xf, w, h);
  else if (scena === "conto") disegnaIlFondoDelConto(xf, w, h);
  else if (scena === "fuochi") {
    disegnaIlFondoDeiFuochi(xf, w, h);
    if (fermo) disegnaIFuochiFermi(xf, w, h);
  }
  fondo.dataset.dipinta = misura;
  if (scena === "vigilia" && fioca) return true;
  if (scena === "vigilia") {
    const neve = new NeveATreStrati({ w, h, documento: doc, quanti: Math.round((w * h) / 3000) });
    state.motore = neve;
    state.giro = giraIFotogrammi(
      (dt) => {
        neve.passo(dt);
        neve.disegna(xm);
      },
      { finestra: root, fermo },
    );
  } else if (scena === "conto") {
    /* Il conto non e' un'animazione: e' un orologio, e gira anche per chi ha
     * chiesto meno movimento. Si ridisegna solo quando cambia il secondo. */
    let ultimo = -1;
    const numero = riposo.querySelector("[data-mu-feste-numero]");
    const parola = riposo.querySelector("[data-mu-feste-parola]");
    state.giro = giraIFotogrammi(
      () => {
        const adesso = new Date();
        /* Passata la mezzanotte la scena e' un'altra: la dice il pannello. */
        if (momentoDelMuro(adesso) !== "conto") {
          ridisegna();
          return false;
        }
        const n = numeroDelConto(adesso);
        const secondo = Math.floor(adesso.getTime() / 1000);
        if (secondo === ultimo) return true;
        ultimo = secondo;
        if (numero && numero.textContent !== n.numero) numero.textContent = n.numero;
        numero?.classList.toggle("lungo", n.lungo);
        if (parola && parola.textContent !== n.parola) parola.textContent = n.parola;
        disegnaLAnello(xm, w, h, n.secondi);
        return true;
      },
      { finestra: root, fermo: false },
    );
  } else if (scena === "fuochi") {
    if (fermo) return true;
    const fuochi = new Fuochi({ w, h, documento: doc });
    state.motore = fuochi;
    state.giro = giraIFotogrammi(
      (dt) => {
        if (momentoDelMuro(new Date()) !== "fuochi") {
          ridisegna();
          return false;
        }
        fuochi.passo(dt);
        fuochi.disegna(xm);
        return true;
      },
      { finestra: root, fermo },
    );
  }
  return true;
}

/* La neve leggera del riposo: una tela, poche decine di fiocchi, il solo
 * giro di fotogrammi del riposo. Ferma (un fotogramma) con meno movimento. */
function nevicaSulRiposo(riposo, scena) {
  const tela = riposo.querySelector('canvas[data-mu-feste="neve"]');
  const w = Math.round(riposo.clientWidth);
  const h = Math.round(riposo.clientHeight);
  if (!tela || !w || !h) {
    if (state.giro) fermaLeFeste();
    return true;
  }
  const fermo = menoMovimento();
  const misura = `${scena}|neve|${w}x${h}|${fermo}`;
  if (tela.dataset.dipinta === misura && state.misura === misura && state.giro) return true;
  fermaLeFeste();
  state.scena = scena;
  state.misura = misura;
  tela.style.width = `${w}px`;
  tela.style.height = `${h}px`;
  const x = preparaLaTela(tela, w, h, root);
  if (!x) return false;
  tela.dataset.dipinta = misura;
  const neve = new NeveLeggera({ quanti: fiocchiSulRiposo(w), documento: doc });
  neve.misura(w, h);
  state.motore = neve;
  state.giro = giraIFotogrammi(
    (dt) => {
      neve.passo(dt);
      neve.disegna(x);
    },
    { finestra: root, fermo },
  );
  return true;
}

/* ── stile ──────────────────────────────────────────────────────────────── */

/** Il foglio delle feste del pannello: `muro` e' il selettore del pannello. */
export function stileDelleFesteAlMuro(muro) {
  return `
${muro} .mu-riposo.mu-feste{display:block;background:#030816;color:#fff;overflow:hidden;
  font-family:"Inter Display",Inter,sans-serif}
${muro} .mu-riposo.mu-feste.fioco>*{filter:brightness(.55)}
${muro} .mu-feste-fondo,${muro} .mu-feste-moto{position:absolute;left:0;top:0;pointer-events:none}
${muro} .mu-feste-oro{background:linear-gradient(180deg,#fff7d6 0%,#f5d27a 45%,#c9952e 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent}
${muro} .mu-feste-cap{font-family:Inter,sans-serif;font-weight:600;font-size:15px;letter-spacing:7px;text-transform:uppercase}
/* La Vigilia: il blocco in alto a sinistra, e la deriva attorno al suo posto. */
${muro} .mu-riposo.mu-feste .mu-feste-blocco{left:6.5%;top:12%;align-items:flex-start;gap:0;max-width:min(88%,1000px);
  transform:translate(calc(var(--dx,0) * 26px),calc(var(--dy,0) * 20px))}
${muro} .mu-feste-blocco .mu-avvisi{margin:0 0 16px}
${muro} .mu-feste-ora{margin-top:14px;font-weight:200;font-size:min(200px,25vh,16vw);letter-spacing:-.02em;line-height:.9;
  text-shadow:0 20px 60px rgba(0,0,10,.5);font-variant-numeric:tabular-nums}
${muro} .mu-feste-data{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;margin-top:16px;
  font-family:Inter,sans-serif;font-size:24px;font-weight:400;color:rgba(255,255,255,.82)}
${muro} .mu-feste-punto{opacity:.55}
${muro} .mu-feste-data .mu-feste-oro{font-weight:600}
${muro} .mu-feste-data .mu-pila{margin-left:10px;font-size:16px}
${muro} .mu-feste-pastiglie{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
${muro} .mu-feste-pastiglia{display:inline-flex;align-items:center;gap:8px;padding:11px 18px;border-radius:999px;
  background:rgba(255,255,255,.09);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);
  border:1px solid rgba(255,255,255,.16);font-family:Inter,sans-serif;font-weight:500;font-size:17px;
  color:rgba(255,255,255,.92);white-space:nowrap}
${muro} .mu-feste-pastiglia b{font-weight:700}
${muro}[data-compatto="1"] .mu-feste-data{font-size:16px;margin-top:10px}
${muro}[data-compatto="1"] .mu-feste-pastiglie{margin-top:14px;gap:8px}
${muro}[data-compatto="1"] .mu-feste-pastiglia{font-size:13px;padding:7px 12px}
${muro}[data-verso="verticale"] .mu-riposo.mu-feste .mu-feste-blocco{top:8%}
/* Il conto alla rovescia. */
${muro} .mu-feste-conto .mu-feste-anni{position:absolute;left:0;right:0;top:6.8%;display:flex;justify-content:center;gap:28px;
  color:rgba(255,255,255,.55)}
${muro} .mu-feste-numero{position:absolute;left:0;right:0;top:49%;transform:translateY(-52%);text-align:center;
  font-weight:200;font-size:min(250px,31vh,30vw);letter-spacing:-.03em;line-height:1;
  font-variant-numeric:tabular-nums;filter:drop-shadow(0 0 50px rgba(255,190,90,.35))}
${muro} .mu-feste-numero.lungo{font-size:min(170px,21vh,20vw)}
${muro} .mu-feste-parola{position:absolute;left:0;right:0;top:67.5%;text-align:center;font-family:Inter,sans-serif;
  font-size:17px;letter-spacing:6px;color:rgba(255,255,255,.7);font-weight:500;text-transform:uppercase}
${muro} .mu-feste-sotto{position:absolute;left:0;right:0;bottom:5%;display:flex;justify-content:center;padding:0 16px}
/* I fuochi. */
${muro} .mu-feste-auguri{position:absolute;left:0;right:0;top:40%;text-align:center}
${muro} .mu-feste-auguri .mu-feste-cap{color:rgba(255,255,255,.8)}
${muro} .mu-feste-anno{margin-top:6px;font-weight:200;font-size:min(190px,24vh,22vw);letter-spacing:-.03em;line-height:1;
  filter:drop-shadow(0 0 40px rgba(255,190,90,.45))}
${muro} .mu-feste-dedica{margin-top:10px;font-family:Inter,sans-serif;font-size:18px;color:rgba(255,255,255,.75);letter-spacing:1px}
`;
}
