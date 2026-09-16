/* I pezzi che i due film si passano.
 *
 * Il video lungo e quelli per i social mostrano le stesse cose — il marchio,
 * il telefono, la plancia, i disegnini — e le mostrano **uguali**: sono lo
 * stesso prodotto, e un telefono disegnato in due modi diversi sarebbero due
 * prodotti diversi. Quindi stanno qui, in un posto solo.
 *
 * `STILI` sta qui per la stessa ragione: chi disegna un pezzo che ha bisogno
 * di un'animazione sua la scrive li' dentro, e il film se la ritrova nel
 * proprio foglio di stile senza sapere che esiste.
 */

/* Le animazioni che nascono mentre si disegna. Il film le raccoglie e le mette
   in pagina **dopo** aver disegnato le scene: prima non esistono ancora. */
export const STILI = [];

export const MARCHIO = "../../app/assets/marchio/gda.png";
export const oggetto = (nome, lato) =>
  `<img src="../../app/assets/oggetti/${nome}.svg" width="${lato}" height="${lato}" alt="" />`;

export const SEGNI = {
  casa: `<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>`,
  fulmine: `<path d="M11 21h-1l1-7H7.5c-.88 0-.33-.75-.31-.78C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.4 0 .62.19.4.66C12.97 17.55 11 21 11 21z"/>`,
  registro: `<path d="M4 4h16v2H4zm0 5h16v2H4zm0 5h10v2H4zm0 5h10v2H4z"/>`,
  orologio: `<path d="M13 3a9 9 0 00-9 9H1l4 4 4-4H6a7 7 0 117 7 6.9 6.9 0 01-4.9-2l-1.4 1.5A9 9 0 1013 3zm-1 5v5l4.3 2.6.7-1.2-3.5-2.1V8z"/>`,
  media: `<path d="M4 5h16v12H4zm2 14h12v2H6z"/>`,
  attrezzi: `<path d="M20 7h-5V4l-3 3-3-3v3H4v3h16zm0 5H4v3h5v3l3-3 3 3v-3h5z"/>`,
  ingranaggio: `<path d="M19.4 13a7.8 7.8 0 000-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 00-1.7-1l-.4-2.5h-3.9l-.4 2.5a7.6 7.6 0 00-1.7 1l-2.4-1-2 3.4L6.6 11a7.8 7.8 0 000 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.8 1.7 1l.4 2.5h3.9l.4-2.5c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.4-2.1-1.6zM12 15.5A3.5 3.5 0 1115.5 12 3.5 3.5 0 0112 15.5z"/>`,
  scatola: `<path d="M12 2l9 4.5v11L12 22l-9-4.5v-11zm0 2.3L5.6 7.5 12 10.7l6.4-3.2zM5 9.2v7l6 3v-7zm8 10l6-3v-7l-6 3z"/>`,
  ponte: `<path d="M2 11h2.2A8 8 0 0112 4a8 8 0 017.8 7H22v2h-3.4a10 10 0 00-13.2 0H2zM6 14v6h2v-6zm10 0v6h2v-6z"/>`,
  spunta: `<path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>`,
  telefono: `<path d="M7 1h10a2 2 0 012 2v18a2 2 0 01-2 2H7a2 2 0 01-2-2V3a2 2 0 012-2zm0 4v14h10V5z"/>`,
  nuvola: `<path d="M19.35 10.04A7.49 7.49 0 0012 4a7.48 7.48 0 00-6.64 4.04A6 6 0 006 20h13a5 5 0 00.35-9.96z"/>`,
  lucchetto: `<path d="M18 8h-1V6a5 5 0 00-10 0v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zM9 6a3 3 0 016 0v2H9zm3 12a2 2 0 110-4 2 2 0 010 4z"/>`,
  cerca: `<path d="M15.5 14h-.8l-.3-.3a6.5 6.5 0 10-.7.7l.3.3v.8l5 5 1.5-1.5zM10 14a4 4 0 114-4 4 4 0 01-4 4z"/>`,
  scarica: `<path d="M12 16l-6-6h4V3h4v7h4zM4 19h16v2H4z"/>`,
  puntini: `<path d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z"/>`,
  cuore: `<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/>`,
  calendario: `<path d="M7 2v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2V2h-2v2H9V2zm12 8v10H5V10z"/>`,
  mondo: `<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm6.9 6h-2.9a15.6 15.6 0 00-1.4-3.6A8 8 0 0118.9 8zM12 4c.8 1.1 1.4 2.5 1.8 4h-3.6c.4-1.5 1-2.9 1.8-4zM4.3 14a8 8 0 010-4h3.3a16.5 16.5 0 000 4zm.8 2h2.9c.3 1.3.8 2.5 1.4 3.6A8 8 0 015.1 16zm2.9-8H5.1a8 8 0 014.3-3.6A15.6 15.6 0 008 8zM12 20c-.8-1.1-1.4-2.5-1.8-4h3.6c-.4 1.5-1 2.9-1.8 4zm2.2-6H9.8a14.7 14.7 0 010-4h4.4a14.7 14.7 0 010 4zm.4 5.6c.6-1.1 1.1-2.3 1.4-3.6h2.9a8 8 0 01-4.3 3.6zM16.4 14a16.5 16.5 0 000-4h3.3a8 8 0 010 4z"/>`,
};

export const segno = (quale, lato = 20, colore = "currentColor") =>
  `<svg width="${lato}" height="${lato}" viewBox="0 0 24 24" fill="${colore}">${SEGNI[quale]}</svg>`;

/* ── Il telefono ──────────────────────────────────────────────────────── */

/* Il telefono, e quanto e' grande.
 *
 * La misura vera e' 314×636, che su un palco alto 720 arriva a toccare le
 * didascalie: chi lo chiama lo rimpicciolisce da fuori, con un involucro che
 * scala. Da fuori e non da dentro perche' l'animazione d'ingresso lavora
 * anche lei sul `transform`, e uno dei due cancellerebbe l'altro. */
export function telefono({ x, y, dentro, classe = "", stile = "", scala = 1 }) {
  const apparecchio = `<div class="telefono ${classe}" style="position:relative;left:0;top:0;${stile}">
    <div class="schermo">
      <div class="tacca"></div>
      <div class="stato-telefono"><span>9:41</span><span>▮▮▮ ⏶</span></div>
      ${dentro}
    </div>
  </div>`;
  /* Dove si mette: al punto che gli dicono, o in fila con gli altri se non
     glielo dicono. Nel secondo caso l'involucro prende la misura **scalata**,
     se no la fila gli lascia il posto per un telefono intero. */
  const posa =
    x === undefined
      ? `display:block;width:${Math.round(314 * scala)}px;height:${Math.round(636 * scala)}px`
      : `position:absolute;left:${x}px;top:${y}px`;
  return `<div style="${posa};transform:scale(${scala});transform-origin:top left">${apparecchio}</div>`;
}

export const tessera = (disegno, nome, valore, accesa = false, classi = "", tempi = "") => `
  <div class="${classi}" style="${tempi};background:${accesa ? "linear-gradient(150deg,#fff7e6,#ffedcc)" : "#fff"};
       border:1px solid ${accesa ? "rgba(245,158,11,.45)" : "rgba(15,23,42,.06)"};border-radius:15px;padding:10px 12px;height:88px;
       box-shadow:0 1px 3px rgba(15,23,42,.07)">
    ${oggetto(disegno, 26)}
    <div style="font-size:11px;color:#64748b;margin-top:6px">${nome}</div>
    <div style="font-size:14px;font-weight:700;color:#0f172a">${valore}</div>
  </div>`;

export const plancia = ({ accende = null } = {}) => `
  <div style="position:absolute;inset:34px 0 0;background:#f0f4f8;display:flex;flex-direction:column">
    <div style="padding:8px 16px 10px;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:21px;font-weight:800;letter-spacing:-.02em">Casa</div>
        <div style="font-size:12px;color:#64748b">Sereno · 21,4° · tutti a casa</div>
      </div>
      <img src="${MARCHIO}" width="30" height="30" style="border-radius:8px" alt="" />
    </div>
    <div style="flex:1;padding:0 14px;display:grid;grid-template-columns:1fr 1fr;gap:10px;align-content:start">
      <div style="position:relative">
        ${
          accende === null
            ? tessera("luci", "Luci", "3 accese")
            : `${tessera("luci", "Luci", "3 accese", false, "via", `--t2:${accende - 0.05}s`)}
        <div class="ap" style="--t:${accende}s;position:absolute;inset:0">${tessera("luci", "Luci", "4 accese", true)}</div>`
        }
      </div>
      ${tessera("clima", "Clima", "21,4°")}
      ${tessera("energia", "Energia", "1,24 kW")}
      ${tessera("sicurezza", "Sicurezza", "Inserita")}
      ${tessera("tapparelle", "Finestre", "Aperte 2")}
      ${tessera("telecamere", "Telecamere", "4")}
      ${tessera("media", "Media", "In pausa")}
      ${tessera("persone", "Persone", "Tutti a casa")}
    </div>
    <div style="height:58px;background:#fff;border-top:1px solid rgba(15,23,42,.07);display:flex;align-items:center;justify-content:space-around;padding:0 8px">
      ${["home", "luci", "clima", "energia", "impostazioni"]
        .map(
          (nome, i) =>
            `<div style="display:grid;place-items:center;gap:2px;${i === 0 ? "background:rgba(15,23,42,.06);border-radius:12px;padding:5px 12px" : "padding:5px 12px"}">${oggetto(nome, 22)}</div>`,
        )
        .join("")}
    </div>
  </div>`;

/* Il palco, e cosa vede chi filma.
 *
 * Prima si disegnano le scene — e' disegnandole che nascono le animazioni che
 * un film si fabbrica per conto suo, come il puntatore del film lungo — e
 * solo dopo si mette in pagina il foglio di stile che le contiene. Al
 * contrario, il puntatore non si muove.
 */
export function mettiInScena(SCENE) {
  const disegnate = SCENE.map(
    (s) => `<section class="scena" data-nome="${s.nome}">${s.contenuto()}</section>`,
  ).join("");

  const foglio = document.createElement("style");
  foglio.textContent = STILI.join("\n");
  document.head.appendChild(foglio);

  const palco = document.getElementById("palco");
  palco.innerHTML = disegnate;

  const sezioni = [...palco.querySelectorAll(".scena")];

  window.video = {
    /* L'elenco, per chi filma: nome e durata in secondi. */
    elenco: SCENE.map((s) => ({ nome: s.nome, durata: s.durata })),

    /* Mostra una scena sola. */
    vaiA(quale) {
      sezioni.forEach((sezione, i) => sezione.classList.toggle("in-scena", i === quale));
      return SCENE[quale].durata;
    },

    /* Porta l'orologio di tutte le animazioni allo stesso momento. E' questo
     che rende il filmato uguale a se stesso a ogni ripresa: non si aspetta
     che il tempo passi, glielo si dice. */
    vaiAlMomento(millisecondi) {
      for (const animazione of document.getAnimations()) animazione.currentTime = millisecondi;
    },

    /* L'ultimo momento in cui in questa scena si muove ancora qualcosa: dopo,
     chi filma riusa l'ultimo fotogramma invece di rifarlo uguale. */
    quandoSiFerma() {
      let ultimo = 0;
      for (const animazione of document.getAnimations()) {
        const tempi = animazione.effect.getComputedTiming();
        const fine = (tempi.delay || 0) + (tempi.activeDuration || 0);
        if (!Number.isFinite(fine)) return Infinity;
        if (fine > ultimo) ultimo = fine;
      }
      return ultimo;
    },

    /* Caratteri e immagini caricati: senza aspettarli, i primi fotogrammi
     escono con il carattere di ripiego e i buchi al posto dei disegni. */
    async pronta() {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map((figura) =>
          figura.complete
            ? Promise.resolve()
            : new Promise((fatto) => {
                figura.addEventListener("load", fatto, { once: true });
                figura.addEventListener("error", fatto, { once: true });
              }),
        ),
      );
      return true;
    },
  };
}
