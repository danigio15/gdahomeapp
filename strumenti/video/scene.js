/* Le scene del video, una per una.
 *
 * Il disegno sta qui e non nel documento per una ragione sola: la finestra di
 * Home Assistant compare in cinque scene di fila, e cinque copie a mano dello
 * stesso pezzo di markup sarebbero cinque posti dove correggere lo stesso
 * refuso. Qui la finestra e' una funzione, e cambia in un punto solo.
 *
 * Ogni scena dichiara **quanto dura** e cosa contiene. Chi filma
 * (`rendi.mjs`) legge `window.video`: gli chiede l'elenco, gli dice quale
 * mostrare, e poi gli sposta l'orologio avanti di un fotogramma per volta.
 */

const SCENE = [];
const STILI = [];

/* Una scena: un nome, quanto dura in secondi, e il suo contenuto. */
function scena(nome, durata, contenuto) {
  SCENE.push({ nome, durata, contenuto });
}

/* ── I disegnini ──────────────────────────────────────────────────────── */

const SEGNI = {
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
  mondo: `<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm6.9 6h-2.9a15.6 15.6 0 00-1.4-3.6A8 8 0 0118.9 8zM12 4c.8 1.1 1.4 2.5 1.8 4h-3.6c.4-1.5 1-2.9 1.8-4zM4.3 14a8 8 0 010-4h3.3a16.5 16.5 0 000 4zm.8 2h2.9c.3 1.3.8 2.5 1.4 3.6A8 8 0 015.1 16zm2.9-8H5.1a8 8 0 014.3-3.6A15.6 15.6 0 008 8zM12 20c-.8-1.1-1.4-2.5-1.8-4h3.6c-.4 1.5-1 2.9-1.8 4zm2.2-6H9.8a14.7 14.7 0 010-4h4.4a14.7 14.7 0 010 4zm.4 5.6c.6-1.1 1.1-2.3 1.4-3.6h2.9a8 8 0 01-4.3 3.6zM16.4 14a16.5 16.5 0 000-4h3.3a8 8 0 010 4z"/>`,
};

const segno = (quale, lato = 20, colore = "currentColor") =>
  `<svg width="${lato}" height="${lato}" viewBox="0 0 24 24" fill="${colore}">${SEGNI[quale]}</svg>`;

/* Il puntatore che si muove.
 *
 * Le tappe sono in secondi dall'inizio della scena, e diventano percentuali di
 * un'animazione sola: una per tutto il giro, cosi' le due proprieta' che si
 * muovono non si accavallano mai.
 *
 * L'animazione finisce **all'ultimo movimento**, non alla fine della scena: le
 * tappe in coda che tengono fermo il puntatore dove sta gia' si buttano, e a
 * tenercelo ci pensa `both`. Non e' una pignoleria — finche' un'animazione e'
 * in corso la scena per chi filma non e' ferma, e le scene dentro Home
 * Assistant, che hanno il puntatore dal primo all'ultimo secondo, si
 * riprendevano tutte fotogramma per fotogramma. */
function puntatore(nome, tappe) {
  const utili = [...tappe];
  const uguali = (a, b) => a.x === b.x && a.y === b.y && (a.o ?? 1) === (b.o ?? 1);
  while (utili.length > 1 && uguali(utili[utili.length - 1], utili[utili.length - 2])) utili.pop();

  const lunga = Math.max(utili[utili.length - 1].t, 0.001);
  const gradi = utili
    .map((tappa) => {
      const quando = ((tappa.t / lunga) * 100).toFixed(3);
      const andatura = tappa.dritto ? "linear" : "cubic-bezier(.45,.05,.2,1)";
      return `${quando}%{left:${tappa.x}px;top:${tappa.y}px;opacity:${tappa.o ?? 1};animation-timing-function:${andatura}}`;
    })
    .join("");
  STILI.push(`@keyframes ${nome}{${gradi}}`);
  return `<svg class="puntatore" viewBox="0 0 22 30" style="animation:${nome} ${lunga}s both">
    <path d="M2 1l17.5 13.4-8 .7 4.4 8.9-3.6 1.8-4.4-8.9L2 22.6z" fill="#fff" stroke="#0b1220" stroke-width="1.7" stroke-linejoin="round"/>
  </svg>`;
}

/* Il cerchietto del clic, dove il puntatore si ferma. */
const tocco = (x, y, t) => `<div class="tocco" style="left:${x}px;top:${y}px;--t:${t}s"></div>`;

/* Il cartello in alto a sinistra. */
const cartello = (numero, titolo, sotto, t = 0.15) => `
  <div class="cartello en" style="--t:${t}s">
    <div class="numero">${numero}</div>
    <div>
      <h2>${titolo}</h2>
      ${sotto ? `<p class="sotto">${sotto}</p>` : ""}
    </div>
  </div>`;

/* Le righe in basso: ognuna arriva quando tocca a lei e se ne va quando
   arriva la prossima. */
function didascalia(righe) {
  const dentro = righe
    .map((riga) => {
      const classi = `riga ap${riga.t2 !== undefined ? " via" : ""}`;
      const tempi = `--t:${riga.t}s${riga.t2 !== undefined ? `;--t2:${riga.t2}s` : ""}`;
      return `<div class="${classi}" style="${tempi}"><p class="${riga.piccola ? "piccola" : ""}">${riga.testo}</p></div>`;
    })
    .join("");
  return `<div class="didascalia">${dentro}</div>`;
}

/* ── La finestra di Home Assistant ────────────────────────────────────── */

const VOCI = [
  ["casa", "Panoramica"],
  ["fulmine", "Energia"],
  ["registro", "Registro"],
  ["orologio", "Cronologia"],
  ["media", "Media"],
];

/* La barra laterale. `scelta` e' la voce accesa; `gdahome` la aggiunge in
   fondo, come succede quando l'add-on parte. */
function barraLato({ scelta = "", gdahome = null, extra = "" } = {}) {
  const voci = VOCI.map(
    ([disegno, nome]) =>
      `<div class="voce${scelta === nome ? " scelta" : ""}">${segno(disegno)}<span>${nome}</span></div>`,
  ).join("");
  /* `null` vuol dire «non c'e' ancora»; la stringa vuota vuol dire «c'e', e
     senza animazione»: sono due cose diverse, e distinguerle costa questa
     riga. */
  const nostra =
    gdahome === null
      ? ""
      : `<div class="voce nostra ${gdahome}" style="--t:var(--t-gdahome,0s)">${segno("ponte")}<span>gdahome</span></div>`;
  return `<div class="barra-lato">
      <div class="marca"><div class="tondo">${segno("casa", 16, "#fff")}</div>Home Assistant</div>
      ${voci}
      ${nostra}
      <div style="height:14px"></div>
      <div class="voce">${segno("attrezzi")}<span>Strumenti</span></div>
      <div class="voce${scelta === "Impostazioni" ? " scelta" : ""}">${segno("ingranaggio")}<span>Impostazioni</span></div>
      ${extra}
    </div>`;
}

function finestraHa({ titolo, corpo, lato = {}, testataDestra = "" }) {
  return `<div class="ha">
    ${barraLato(lato)}
    <div>
      <div class="testata"><span>${titolo}</span>${testataDestra}</div>
      <div class="corpo">${corpo}</div>
    </div>
  </div>`;
}

/* ── Il telefono ──────────────────────────────────────────────────────── */

/* Il telefono, e quanto e' grande.
 *
 * La misura vera e' 314×636, che su un palco alto 720 arriva a toccare le
 * didascalie: chi lo chiama lo rimpicciolisce da fuori, con un involucro che
 * scala. Da fuori e non da dentro perche' l'animazione d'ingresso lavora
 * anche lei sul `transform`, e uno dei due cancellerebbe l'altro. */
function telefono({ x, y, dentro, classe = "", stile = "", scala = 1 }) {
  const apparecchio = `<div class="telefono ${classe}" style="position:relative;left:0;top:0;${stile}">
    <div class="schermo">
      <div class="tacca"></div>
      <div class="stato-telefono"><span>9:41</span><span>▮▮▮ ⏶</span></div>
      ${dentro}
    </div>
  </div>`;
  return `<div style="position:absolute;left:${x}px;top:${y}px;transform:scale(${scala});transform-origin:top left">${apparecchio}</div>`;
}

const MARCHIO = "../../app/assets/marchio/gda.png";
const oggetto = (nome, lato) =>
  `<img src="../../app/assets/oggetti/${nome}.svg" width="${lato}" height="${lato}" alt="" />`;

/* ══ 1. Apertura ═══════════════════════════════════════════════════════ */

scena(
  "apertura",
  8,
  () => `
  <div style="position:absolute;left:50%;top:196px;transform:translateX(-50%);width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(14,165,233,.34),transparent 65%);opacity:0;animation:alone-c 1.5s .1s ease-out forwards"></div>
  <img class="cr-c" src="${MARCHIO}" width="148" height="148" alt=""
       style="--t:.1s;position:absolute;left:50%;top:118px;border-radius:33px;box-shadow:0 24px 60px rgba(0,0,0,.55)" />
  <div class="en" style="--t:.55s;position:absolute;left:0;right:0;top:294px;text-align:center;font-size:76px;font-weight:800;letter-spacing:-.03em">gdahome</div>
  <div class="en" style="--t:.85s;position:absolute;left:0;right:0;top:392px;text-align:center;font-size:27px;color:var(--tenue);font-weight:500">La casa in una plancia, sul telefono</div>
  <div class="en" style="--t:1.15s;position:absolute;left:0;right:0;top:452px;display:flex;justify-content:center;gap:10px">
    <span class="vetro" style="padding:9px 18px;font-size:16px;color:#cfe0f5">un add-on di Home Assistant</span>
    <span class="vetro" style="padding:9px 18px;font-size:16px;color:#cfe0f5">+ un'app per Android e iPhone</span>
  </div>
  ${didascalia([
    { t: 1.9, t2: 4.4, testo: "Una casa in Home Assistant, e un telefono." },
    { t: 4.6, testo: "Nel mezzo due cose da installare: <b>un add-on</b> e <b>l'app</b>." },
  ])}`,
);

/* ══ 2. I tre pezzi ════════════════════════════════════════════════════ */

const pezzo = (x, t, tinta, disegno, titolo, testo, coda) => `
  <div class="vetro pezzo en" style="--t:${t}s;position:absolute;left:${x}px;top:158px;width:340px;height:344px">
    <div class="figura ${tinta}">${disegno}</div>
    <h3>${titolo}</h3>
    <p>${testo}</p>
    <div style="position:absolute;left:24px;right:24px;bottom:22px;padding-top:14px;border-top:1px solid rgba(255,255,255,.1);
                font-size:14px;color:#7f93b0">${coda}</div>
  </div>`;

scena(
  "i-tre-pezzi",
  11,
  () => `
  ${cartello(1, "Cos'è", "tre pezzi, e uno solo si installa")}
  ${pezzo(
    98,
    0.5,
    "",
    segno("ponte", 30, "#38bdf8"),
    "L'add-on",
    "Si chiama <b style='color:#cfe0f5'>gdahome</b> e sta dentro Home Assistant. È lui che fa entrare il telefono: da dentro e da fuori casa.",
    "Si installa dal negozio degli add-on",
  )}
  ${pezzo(
    470,
    0.8,
    "ambra",
    segno("telefono", 30, "#fbbf24"),
    "L'app",
    "Android e iPhone. Si abbina <b style='color:#cfe0f5'>inquadrando un quadretto</b>: nessun indirizzo, nessuna password di Home Assistant.",
    "Un bottone solo, alla prima accensione",
  )}
  ${pezzo(
    842,
    1.1,
    "verde",
    segno("casa", 30, "#4ade80"),
    "La plancia",
    "La home dell'app: ventitré sezioni, quelle vere della dashboard. <b style='color:#cfe0f5'>La porta l'add-on</b>, e si configura dal telefono.",
    "È DashboardModern, con la sua licenza",
  )}
  <div class="ap" style="--t:1.9s;position:absolute;left:98px;top:534px;right:98px;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent)"></div>
  <div class="ap" style="--t:2.1s;position:absolute;left:0;right:0;top:556px;text-align:center;font-size:19px;color:#7f93b0">
    L'add-on si installa una volta sola, e da lì arrivano sia l'app che la plancia.
  </div>
  ${didascalia([
    { t: 2.0, t2: 6.2, testo: "Tre pezzi, e in Home Assistant se ne installa <b>uno solo</b>." },
    { t: 6.4, testo: "La plancia arriva insieme all'add-on: nient'altro da mettere." },
  ])}`,
);

/* ══ 3. Come ci si arriva ══════════════════════════════════════════════ */

const STRADA_VICINA = "M262,330 L964,330";
const STRADA_LONTANA = "M262,318 C420,150 700,120 860,196 C930,230 950,268 962,306";

STILI.push(`@keyframes scorri{from{offset-distance:0%}to{offset-distance:100%}}`);

const pallino = (strada, ritardo, tinta) => `
  <div style="position:absolute;left:0;top:0;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;border-radius:50%;
              background:${tinta};box-shadow:0 0 12px ${tinta};opacity:0;
              offset-path:path('${strada}');offset-rotate:0deg;
              animation:scorri 1.9s ${ritardo}s linear 3 both,
                        appari .2s ${ritardo}s linear forwards,
                        sparisci .3s ${(ritardo + 5.7).toFixed(2)}s linear forwards"></div>`;

scena(
  "come-ci-si-arriva",
  14,
  () => `
  ${cartello(2, "Come ci si arriva", "in casa, e da fuori")}

  <svg style="position:absolute;inset:0" width="1280" height="720" fill="none">
    <path d="${STRADA_LONTANA}" stroke="rgba(245,158,11,.42)" stroke-width="2.5" stroke-dasharray="7 7"/>
    <path d="${STRADA_VICINA}" stroke="rgba(14,165,233,.45)" stroke-width="2.5"/>
  </svg>
  ${pallino(STRADA_VICINA, 1.6, "#38bdf8")}
  ${pallino(STRADA_VICINA, 2.2, "#38bdf8")}
  ${pallino(STRADA_LONTANA, 5.9, "#fbbf24")}
  ${pallino(STRADA_LONTANA, 6.5, "#fbbf24")}

  <!-- il telefono -->
  <div class="vetro cr" style="--t:.4s;position:absolute;left:112px;top:272px;width:150px;height:118px;display:grid;place-items:center;gap:6px;align-content:center">
    ${segno("telefono", 32, "#fbbf24")}
    <div style="font-size:16px;font-weight:600">L'app</div>
  </div>

  <!-- il centralino -->
  <div class="vetro cr" style="--t:5.4s;position:absolute;left:748px;top:120px;width:196px;height:112px;display:grid;place-items:center;gap:4px;align-content:center">
    ${segno("nuvola", 30, "#fbbf24")}
    <div style="font-size:16px;font-weight:600">Il centralino</div>
    <div style="font-size:13px;color:var(--tenue)">instrada, e non legge</div>
  </div>

  <!-- la casa -->
  <div class="vetro cr" style="--t:.7s;position:absolute;left:964px;top:250px;width:204px;height:162px;display:grid;place-items:center;gap:5px;align-content:center">
    ${segno("casa", 32, "#38bdf8")}
    <div style="font-size:17px;font-weight:700">Home Assistant</div>
    <div style="font-size:14px;color:var(--tenue);text-align:center;line-height:1.35">con dentro<br/>l'add-on gdahome</div>
  </div>

  <div class="ap" style="--t:1.5s;position:absolute;left:452px;top:338px;font-size:15px;color:#7dd3fc;font-weight:600">in casa: dritto, sul Wi-Fi</div>
  <div class="ap" style="--t:5.8s;position:absolute;left:392px;top:140px;font-size:15px;color:#fcd34d;font-weight:600">da fuori: è la casa che chiama</div>

  <div style="position:absolute;left:112px;top:514px;right:112px;display:flex;gap:14px">
    <div class="vetro ap" style="--t:9.9s;flex:1;padding:15px 18px;display:flex;gap:11px;align-items:center;font-size:17px;color:#dbe7f7">${segno("lucchetto", 22, "#4ade80")} Nessuna porta aperta sul router</div>
    <div class="vetro ap" style="--t:10.1s;flex:1;padding:15px 18px;display:flex;gap:11px;align-items:center;font-size:17px;color:#dbe7f7">${segno("mondo", 22, "#4ade80")} Nessuna VPN da installare</div>
    <div class="vetro ap" style="--t:10.3s;flex:1;padding:15px 18px;display:flex;gap:11px;align-items:center;font-size:17px;color:#dbe7f7">${segno("spunta", 22, "#4ade80")} Cifrato punta a punta</div>
  </div>

  ${didascalia([
    {
      t: 1.4,
      t2: 5.3,
      testo: "In casa il telefono va dritto: la casa la trova da solo sul Wi-Fi.",
    },
    { t: 5.6, t2: 9.7, testo: "Da fuori <b>è la casa che chiama</b>, e il telefono arriva da lì." },
    { t: 10.6, testo: "Sul router non si tocca niente. Il centralino instrada e non può leggere." },
  ])}`,
);

/* ══ 3. L'add-on, dal negozio ══════════════════════════════════════════
 *
 * Cinque scene di fila dentro la stessa finestra: la strada vera, quella
 * scritta in COME_PROVARLA.md — Impostazioni, Add-on, il negozio, gli
 * Archivi, l'indirizzo, Installa, Avvia.
 */

/* Una riga della pagina Impostazioni. */
const rigaImpostazioni = (y, disegno, titolo, sotto, evidente = false) => `
  <div class="carta" style="position:absolute;left:18px;right:18px;top:${y}px;height:62px;display:flex;align-items:center;gap:14px;${
    evidente ? "box-shadow:0 0 0 2px #03a9f4,0 4px 14px rgba(3,169,244,.25)" : ""
  }">
    <div style="width:38px;height:38px;border-radius:10px;background:rgba(3,169,244,.12);display:grid;place-items:center;color:#0288d1">${disegno}</div>
    <div><h4>${titolo}</h4><p>${sotto}</p></div>
  </div>`;

const PANORAMICA = `
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
    ${["Soggiorno", "Cucina", "Camera", "Clima", "Energia", "Sicurezza"]
      .map(
        (nome) => `<div class="carta" style="height:118px">
          <h4>${nome}</h4>
          <p style="margin-top:8px">—</p>
          <div style="margin-top:14px;height:8px;border-radius:4px;background:#eceff3"></div>
          <div style="margin-top:8px;height:8px;width:60%;border-radius:4px;background:#eceff3"></div>
        </div>`,
      )
      .join("")}
  </div>`;

const IMPOSTAZIONI = `
  ${rigaImpostazioni(0, segno("scatola", 22), "Dispositivi e servizi", "Integrazioni, dispositivi, entità")}
  ${rigaImpostazioni(74, segno("attrezzi", 22), "Automazioni e scene", "Automazioni, scene, script, aiutanti")}
  ${rigaImpostazioni(148, segno("scatola", 22), "Add-on", "Il negozio, e quelli installati", true)}
  ${rigaImpostazioni(222, segno("casa", 22), "Aree, etichette e zone", "Come è fatta la casa")}
  ${rigaImpostazioni(296, segno("ingranaggio", 22), "Sistema", "Rete, archivi di sicurezza, aggiornamenti")}`;

scena("verso-le-impostazioni", 9, () => {
  const prima = finestraHa({ titolo: "Panoramica", corpo: PANORAMICA, lato: {} });
  const dopo = finestraHa({
    titolo: "Impostazioni",
    corpo: IMPOSTAZIONI,
    lato: { scelta: "Impostazioni" },
  });
  return `
  ${cartello(3, "L'add-on, dal negozio", "Impostazioni → Add-on")}
  <div class="via" style="--t2:2.75s">${prima}</div>
  <div class="ap" style="--t:2.8s">${dopo}</div>
  ${puntatore("p4a", [
    { t: 0.2, x: 700, y: 660, o: 0 },
    { t: 0.7, x: 690, y: 600, o: 1 },
    { t: 2.3, x: 196, y: 412 },
    { t: 2.9, x: 196, y: 412, dritto: true },
    { t: 4.9, x: 700, y: 348 },
    { t: 6.4, x: 700, y: 348, dritto: true },
    { t: 9, x: 700, y: 348, dritto: true },
  ])}
  ${tocco(196, 412, 2.45)}
  ${tocco(700, 348, 5.05)}
  ${didascalia([
    { t: 0.9, t2: 3.1, testo: "In Home Assistant: <b>Impostazioni</b>." },
    { t: 3.3, t2: 6.6, testo: "Poi <b>Add-on</b>." },
    { t: 6.8, testo: "Da qui si apre il negozio degli add-on." },
  ])}`;
});

/* ── Il negozio ───────────────────────────────────────────────────────── */

const cartaNegozio = (nome, testo, tinta = "#03a9f4", classi = "", stile = "") => `
  <div class="carta ${classi}" style="height:104px;display:flex;gap:12px;align-items:flex-start;${stile}">
    <div style="flex:0 0 auto;width:40px;height:40px;border-radius:10px;background:${tinta}1f;border:1px solid ${tinta}55;display:grid;place-items:center;color:${tinta}">${segno("scatola", 22, tinta)}</div>
    <div><h4>${nome}</h4><p>${testo}</p></div>
  </div>`;

const UFFICIALI = `
    ${cartaNegozio("File editor", "Un editor per i file di configurazione")}
    ${cartaNegozio("Terminal &amp; SSH", "Un terminale, dentro Home Assistant")}
    ${cartaNegozio("Samba share", "Le cartelle di casa, sulla rete")}
    ${cartaNegozio("Mosquitto broker", "Il broker MQTT")}
    ${cartaNegozio("Studio Code Server", "Visual Studio Code, nel browser")}
    ${cartaNegozio("ESPHome", "I dispositivi fatti in casa")}`;

const negozio = ({ conGdahome = false, evidenzia = false } = {}) => `
  ${
    conGdahome
      ? `<div class="cr" style="--t:.35s">
          <p class="titolo-negozio">gdahome ${evidenzia ? '<span style="font-size:11px;font-weight:700;color:#0288d1;background:rgba(3,169,244,.12);padding:3px 8px;border-radius:20px">NUOVO</span>' : ""}</p>
          <div class="griglia-negozio" style="margin-bottom:16px">
            ${cartaNegozio(
              "gdahome",
              "La plancia e l'app di gdahome, per questa casa: da dentro e da fuori, senza che nessun segreto di Home Assistant finisca sul telefono.",
              "#0ea5e9",
              "",
              evidenzia ? "box-shadow:0 0 0 2px #0ea5e9,0 8px 22px rgba(14,165,233,.3)" : "",
            )}
          </div>
        </div>`
      : ""
  }
  <p class="titolo-negozio">Add-on ufficiali di Home Assistant</p>
  <div class="griglia-negozio">${UFFICIALI}</div>`;

scena("il-negozio", 11, () => {
  const pagina = finestraHa({
    titolo: "Add-on",
    corpo: `
      <div class="carta" style="height:78px;display:flex;align-items:center;gap:14px">
        <div style="width:40px;height:40px;border-radius:10px;background:rgba(3,169,244,.12);display:grid;place-items:center">${segno("scatola", 22, "#0288d1")}</div>
        <div><h4>Nessun add-on installato</h4><p>Gli add-on si prendono dal negozio.</p></div>
      </div>
      <div style="position:absolute;right:26px;bottom:24px" class="bottone-ha">${segno("scarica", 18, "#fff")} Negozio degli add-on</div>`,
    lato: { scelta: "Impostazioni" },
  });
  const store = finestraHa({
    titolo: "Negozio degli add-on",
    corpo: negozio(),
    lato: { scelta: "Impostazioni" },
    testataDestra: `<div class="tre-punti">${segno("puntini", 20)}</div>`,
  });
  return `
  ${cartello(3, "L'add-on, dal negozio", "il negozio, e i tre puntini")}
  <div class="via" style="--t2:2.7s">${pagina}</div>
  <div class="ap" style="--t:2.75s">${store}</div>
  ${puntatore("p4b", [
    { t: 0, x: 700, y: 348, o: 1 },
    { t: 1.9, x: 1020, y: 552 },
    { t: 2.5, x: 1020, y: 552, dritto: true },
    { t: 5.2, x: 1136, y: 121 },
    { t: 11, x: 1136, y: 121, dritto: true },
  ])}
  ${tocco(1020, 552, 2.35)}
  ${tocco(1136, 121, 5.4)}
  ${didascalia([
    { t: 0.7, t2: 3.0, testo: "In fondo alla pagina: <b>Negozio degli add-on</b>." },
    { t: 3.2, t2: 6.2, testo: "Qui dentro ci sono gli add-on che Home Assistant conosce già." },
    {
      t: 6.4,
      testo: "gdahome non è tra quelli: si aggiunge il suo archivio, dai <b>tre puntini</b>.",
    },
  ])}`;
});

/* ── Gli archivi, e l'indirizzo da incollare ──────────────────────────── */

const INDIRIZZO = "https://github.com/danigio15/gdahomeapp";
/* Quanto e' lungo, in caratteri: e' la larghezza della casella mentre si
 * scrive, ed e' anche il numero di passi dell'animazione. Si conta, non si
 * scrive: contato a mano faceva 38 invece di 39, e l'ultima lettera restava
 * fuori dalla casella — l'indirizzo nel video finiva «gdahomeap». */
const QUANTO_E_LUNGO = INDIRIZZO.length;

scena("gli-archivi", 10.6, () => {
  const tendina = `
    <div class="tendina cr via" style="--t:.05s;--t2:1.85s">
      <div>Controlla gli aggiornamenti</div>
      <div class="acceso">Archivi</div>
      <div>Ricarica</div>
    </div>`;
  const finestrella = `
    <div class="ap via" style="--t:1.95s;--t2:8.65s;position:absolute;left:108px;top:92px;width:1064px;height:500px;border-radius:16px;background:rgba(6,12,22,.42)"></div>
    <div class="finestrella cr-cc" style="--t:2.0s;left:640px;top:342px">
      <h3>Gestisci gli archivi degli add-on</h3>
      <p>Un archivio è un indirizzo di GitHub: da lì Home Assistant prende gli add-on e i loro aggiornamenti.</p>
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0 14px;border-top:1px solid #eceff3">
        <div style="width:34px;height:34px;border-radius:9px;background:#f1f4f8;display:grid;place-items:center;color:#5a6b7d">${segno("scatola", 18)}</div>
        <div style="flex:1"><h4 style="font-size:14px;margin:0">Home Assistant Community Add-ons</h4><p style="font-size:12px;color:#8e99a6;margin:0">github.com/hassio-addons/repository</p></div>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <div class="casella" style="flex:1">
          <span class="testo-scritto" style="width:${QUANTO_E_LUNGO}ch;animation:scrivi 2.2s 4.1s steps(${QUANTO_E_LUNGO},end) both">${INDIRIZZO}</span><span class="cursore-testo ap via" style="--t:3.85s;--t2:6.5s"></span>
        </div>
        <div class="bottone-ha" style="padding:11px 22px">Aggiungi</div>
      </div>
    </div>`;
  const store = finestraHa({
    titolo: "Negozio degli add-on",
    corpo: `${negozio()}${tendina}`,
    lato: { scelta: "Impostazioni" },
    testataDestra: `<div class="tre-punti">${segno("puntini", 20)}</div>`,
  });
  return `
  ${cartello(3, "L'add-on, dal negozio", "Archivi → l'indirizzo → Aggiungi")}
  <div class="via" style="--t2:8.7s">${store}${finestrella}</div>
  ${puntatore("p4c", [
    { t: 0, x: 1136, y: 121, o: 1 },
    { t: 1.4, x: 1049, y: 222 },
    { t: 2.2, x: 1049, y: 222, dritto: true },
    { t: 3.3, x: 584, y: 406 },
    { t: 3.9, x: 584, y: 406, dritto: true },
    { t: 4.5, x: 700, y: 452 },
    { t: 7.3, x: 700, y: 452, dritto: true },
    { t: 8.0, x: 845, y: 412 },
    { t: 8.6, x: 845, y: 412, dritto: true },
    { t: 10.6, x: 845, y: 412, dritto: true },
  ])}
  ${tocco(1049, 222, 1.55)}
  ${tocco(584, 406, 3.55)}
  ${tocco(845, 412, 8.2)}
  ${didascalia([
    { t: 0.5, t2: 2.6, testo: "Dai tre puntini: <b>Archivi</b>." },
    { t: 2.8, t2: 6.9, testo: "Si incolla l'indirizzo della repository, e basta questo." },
    { t: 7.4, testo: "<b>Aggiungi</b>, e si chiude." },
  ])}`;
});

/* ── L'add-on che compare ─────────────────────────────────────────────── */

scena("gdahome-nel-negozio", 8.5, () => {
  const store = finestraHa({
    titolo: "Negozio degli add-on",
    corpo: negozio({ conGdahome: true, evidenzia: true }),
    lato: { scelta: "Impostazioni" },
    testataDestra: `<div class="tre-punti">${segno("puntini", 20)}</div>`,
  });
  return `
  ${cartello(3, "L'add-on, dal negozio", "compare gdahome")}
  ${store}
  ${puntatore("p4d", [
    { t: 0, x: 962, y: 434, o: 1 },
    { t: 2.4, x: 470, y: 252 },
    { t: 3.4, x: 470, y: 252, dritto: true },
    { t: 8.5, x: 470, y: 252, dritto: true },
  ])}
  ${tocco(470, 252, 3.0)}
  ${didascalia([
    {
      t: 0.7,
      t2: 4.0,
      testo: "Nel negozio compare una sezione <b>gdahome</b>, con dentro l'add-on.",
    },
    { t: 4.2, testo: "Si apre, e si installa come tutti gli altri." },
  ])}`;
});

/* ── Installa, e avvia ────────────────────────────────────────────────── */

STILI.push(`.voce-nuova{opacity:0;height:0;padding-top:0;padding-bottom:0;overflow:hidden;
  animation:apri-voce .5s var(--t-gdahome,0s) cubic-bezier(.2,.8,.2,1) forwards}
@keyframes apri-voce{from{opacity:0;height:0;padding-top:0;padding-bottom:0}
  to{opacity:1;height:38px;padding-top:9px;padding-bottom:9px}}`);

scena("installa-e-avvia", 14, () => {
  const scheda = `
    <div class="carta" style="position:absolute;left:18px;right:18px;top:0;padding:18px 20px">
      <div style="display:flex;align-items:center;gap:14px">
        <img src="${MARCHIO}" width="52" height="52" style="border-radius:13px" alt="" />
        <div style="flex:1">
          <h4 style="font-size:21px">gdahome</h4>
          <p>La plancia e l'app di gdahome, per questa casa: da dentro e da fuori, senza che nessun segreto di Home Assistant finisca sul telefono.</p>
        </div>
        <div style="text-align:right">
          <p style="font-size:12px">versione</p>
          <h4 style="font-size:16px">1.4.25</h4>
        </div>
      </div>
      <div style="margin-top:16px;display:flex;gap:10px;align-items:center">
        <div class="bottone-ha via" style="--t2:2.35s;animation:premuto .3s 2.1s ease both,sparisci .2s 2.35s ease forwards">${segno("scarica", 18, "#fff")} Installa</div>
        <div class="bottone-ha verde ap via" style="--t:6.7s;--t2:8.75s">Avvia</div>
        <div class="ap via" style="--t:6.7s;--t2:8.85s;font-size:13px;color:#6b7785">Installato · nella barra laterale dopo l'avvio</div>
        <div class="ap" style="--t:8.9s;display:flex;align-items:center;gap:8px;font-size:14px;color:#16a34a;font-weight:600">
          <span style="width:9px;height:9px;border-radius:50%;background:#16a34a;display:inline-block"></span> In esecuzione
        </div>
      </div>
    </div>

    <!-- l'installazione in corso -->
    <div class="carta ap via" style="--t:2.5s;--t2:6.6s;position:absolute;left:18px;right:18px;top:172px;padding:16px 20px">
      <h4>Installazione in corso…</h4>
      <div style="margin-top:12px;height:8px;border-radius:5px;background:#e8ecf1;overflow:hidden">
        <div style="height:100%;width:0;border-radius:5px;background:#03a9f4;animation:riempi 3.7s 2.7s linear forwards"></div>
      </div>
      <p style="margin-top:12px">La prima volta ci mette qualche minuto: Home Assistant non se lo scarica già pronto, <b>se lo costruisce sul posto</b>. Le volte dopo è immediato.</p>
    </div>

    <!-- installato -->
    <div class="carta ap" style="--t:6.7s;position:absolute;left:18px;right:18px;top:172px;padding:16px 20px">
      <h4>Configurazione</h4>
      <p style="margin-top:8px">Da fuori casa · acceso — la casa chiama il centralino, e sul router non si apre niente.</p>
      <p style="margin-top:6px">Codice di abbinamento · 5 minuti · fino a 10 telefoni</p>
      <p class="ap" style="--t:9.3s;margin-top:12px;color:#0288d1;font-weight:600">Nella barra laterale è comparsa la console: <b>gdahome</b>.</p>
    </div>`;
  return `
  <div style="--t-gdahome:8.95s">
    ${cartello(3, "L'add-on, dal negozio", "Installa, poi Avvia")}
    ${finestraHa({
      titolo: "gdahome",
      corpo: scheda,
      lato: { scelta: "Impostazioni", gdahome: "voce-nuova" },
    })}
  </div>
  ${puntatore("p4e", [
    { t: 0, x: 470, y: 252, o: 1 },
    { t: 1.7, x: 424, y: 300 },
    { t: 2.4, x: 424, y: 300, dritto: true },
    { t: 7.9, x: 416, y: 300 },
    { t: 8.6, x: 416, y: 300, dritto: true },
    { t: 10.4, x: 196, y: 360 },
    { t: 14, x: 196, y: 360, dritto: true },
  ])}
  ${tocco(424, 300, 2.05)}
  ${tocco(416, 300, 8.5)}
  ${didascalia([
    { t: 0.6, t2: 2.7, testo: "<b>Installa</b>." },
    {
      t: 2.9,
      t2: 6.5,
      testo: "La prima volta ci mette qualche minuto: se lo costruisce sul posto.",
    },
    { t: 6.9, t2: 9.0, testo: "Poi <b>Avvia</b>." },
    { t: 9.2, testo: "E nella barra laterale compare <b>gdahome</b>: è la sua console." },
  ])}`;
});

/* ══ 4. Il codice ══════════════════════════════════════════════════════ */

const CONSOLE = ({ conCodice = false } = {}) => `
  <div style="max-width:620px;margin:0 auto">
    <div style="display:flex;align-items:center;gap:12px">
      <img src="${MARCHIO}" width="40" height="40" style="border-radius:10px" alt="" />
      <div>
        <h4 style="font-size:20px;margin:0">gdahome</h4>
        <p style="font-size:12px;margin:0">La casa risponde · nessun telefono abbinato</p>
      </div>
    </div>
    <div class="carta" style="margin-top:14px;padding:16px 18px">
      <h4>Abbinare un telefono</h4>
      <p style="margin-bottom:12px">Apri gdahome sul telefono e inquadra il quadretto. Vale una volta sola e per pochi minuti.</p>
      ${
        conCodice
          ? `<div class="cr" style="--t:2.6s;text-align:center">
               <img src="quadretto.svg" width="176" height="176" style="border-radius:10px;border:1px solid #e3e6ea;background:#fff" alt="" />
               <p style="margin:8px 0 4px">Scade fra 4:58</p>
               <p style="font-family:'DejaVu Sans Mono',monospace;font-size:17px;letter-spacing:.1em;color:#212121;margin:0 0 12px">K7QM-3PDX-9WTB-46HZ</p>
             </div>
             <div class="bottone-ha vuoto ap" style="--t:2.6s;padding:9px 16px">Annulla</div>`
          : `<div class="bottone-ha" style="animation:premuto .3s 2.0s ease both">Fabbrica un codice</div>`
      }
    </div>
  </div>`;

scena(
  "il-codice",
  11,
  () => `
  ${cartello(4, "Il codice", "un quadretto, e cinque minuti")}
  <div class="via" style="--t2:2.5s">
    ${finestraHa({ titolo: "gdahome", corpo: CONSOLE(), lato: { gdahome: "scelta" } })}
  </div>
  <div class="ap" style="--t:2.55s">
    ${finestraHa({ titolo: "gdahome", corpo: CONSOLE({ conCodice: true }), lato: { gdahome: "scelta" } })}
  </div>
  ${puntatore("p5a", [
    { t: 0, x: 196, y: 360, o: 1 },
    { t: 1.5, x: 480, y: 292 },
    { t: 2.3, x: 480, y: 292, dritto: true },
    { t: 3.6, x: 900, y: 470 },
    { t: 11, x: 900, y: 470, dritto: true },
  ])}
  ${tocco(480, 292, 1.95)}
  ${didascalia([
    { t: 0.6, t2: 3.0, testo: "Dalla console: <b>Fabbrica un codice</b>." },
    { t: 3.2, t2: 6.8, testo: "Esce un quadretto, e vale cinque minuti." },
    { t: 7.0, testo: "Sotto ci sono le stesse cose in lettere, per chi non può inquadrare." },
  ])}`,
);

/* ── Il telefono che inquadra ─────────────────────────────────────────── */

const SCHERMATA_ABBINA = `
  <div style="padding:22px 20px 0;text-align:center">
    <img src="${MARCHIO}" width="58" height="58" style="border-radius:14px;margin-top:16px" alt="" />
    <h3 style="font-size:23px;margin:16px 0 8px;font-weight:700">Colleghiamo la casa</h3>
    <p style="font-size:14px;line-height:1.5;color:#475569;margin:0 24px">
      In Home Assistant apri <b>gdahome</b> dalla barra laterale e fabbrica un codice.
    </p>
    <div style="margin-top:26px;background:#0ea5e9;color:#fff;border-radius:14px;padding:15px;font-size:16px;font-weight:600">
      Inquadra il codice
    </div>
    <p style="margin-top:16px;font-size:13px;color:#0284c7;font-weight:600">Non puoi inquadrarlo? Scrivilo a mano</p>
    <p style="margin-top:64px;font-size:12px;color:#64748b;line-height:1.45">
      Non ti verrà mai chiesta la password<br />di Home Assistant, né un gettone.
    </p>
  </div>`;

const SCHERMATA_FOTOCAMERA = `
  <div style="position:absolute;inset:0;background:#0b1220">
    <div style="position:absolute;left:50%;top:236px;transform:translate(-50%,-50%);width:186px;height:186px;border-radius:16px;background:#fff;display:grid;place-items:center">
      <img src="quadretto.svg" width="168" height="168" alt="" />
    </div>
    <div style="position:absolute;left:46px;top:132px;width:200px;height:208px">
      ${[
        "left:0;top:0;border-left:4px solid #0ea5e9;border-top:4px solid #0ea5e9;border-radius:12px 0 0 0",
        "right:0;top:0;border-right:4px solid #0ea5e9;border-top:4px solid #0ea5e9;border-radius:0 12px 0 0",
        "left:0;bottom:0;border-left:4px solid #0ea5e9;border-bottom:4px solid #0ea5e9;border-radius:0 0 0 12px",
        "right:0;bottom:0;border-right:4px solid #0ea5e9;border-bottom:4px solid #0ea5e9;border-radius:0 0 12px 0",
      ]
        .map((dove) => `<div style="position:absolute;width:38px;height:38px;${dove}"></div>`)
        .join("")}
    </div>
    <p style="position:absolute;left:0;right:0;top:390px;text-align:center;color:#cbd5e1;font-size:15px">Inquadra il quadretto</p>
  </div>`;

const SCHERMATA_COLLEGATA = `
  <div style="position:absolute;inset:34px 0 0;background:#f0f4f8;display:grid;place-items:center;align-content:center;gap:10px">
    <div style="width:86px;height:86px;border-radius:50%;background:rgba(22,163,74,.14);border:2px solid rgba(22,163,74,.5);display:grid;place-items:center">
      ${segno("spunta", 44, "#16a34a")}
    </div>
    <h3 style="font-size:22px;margin:12px 0 0;font-weight:700">Casa collegata</h3>
    <p style="font-size:14px;color:#475569;margin:0;text-align:center;line-height:1.5">Il telefono ha un segno suo,<br />solo per questa casa.</p>
  </div>`;

scena(
  "inquadra",
  11.5,
  () => `
  ${cartello(4, "Il codice", "si inquadra, e la casa è collegata")}

  <div class="carta cr" style="--t:.3s;position:absolute;left:206px;top:152px;width:296px;text-align:center;padding:20px">
    <h4 style="font-size:15px">La console, dentro Home Assistant</h4>
    <img src="quadretto.svg" width="196" height="196" style="margin-top:14px;border:1px solid #e3e6ea;border-radius:10px" alt="" />
    <p style="font-family:'DejaVu Sans Mono',monospace;font-size:15px;letter-spacing:.08em;color:#212121;margin-top:12px">K7QM-3PDX-9WTB-46HZ</p>
  </div>

  <svg style="position:absolute;left:528px;top:262px" width="240" height="80" fill="none">
    <path class="ap" style="--t:2.6s" d="M6 40 H196" stroke="rgba(14,165,233,.6)" stroke-width="2.5" stroke-dasharray="8 8"/>
    <path class="ap" style="--t:2.6s" d="M188 32 L206 40 L188 48 Z" fill="rgba(14,165,233,.85)"/>
  </svg>

  ${telefono({
    x: 802,
    y: 74,
    scala: 0.82,
    classe: "cr",
    stile: "--t:.6s",
    dentro: `
      <div class="via" style="--t2:2.7s">${SCHERMATA_ABBINA}</div>
      <div class="ap via" style="--t:2.75s;--t2:7.2s">${SCHERMATA_FOTOCAMERA}</div>
      <div class="ap" style="--t:7.25s">${SCHERMATA_COLLEGATA}</div>`,
  })}

  <div style="position:absolute;left:206px;top:486px;width:340px">
    <div class="spunta ap" style="--t:8.4s;font-size:16px"><span class="segno">${segno("spunta", 14, "#4ade80")}</span> Nessun indirizzo da sapere</div>
    <div class="spunta ap" style="--t:8.7s;font-size:16px;margin-top:10px"><span class="segno">${segno("spunta", 14, "#4ade80")}</span> Nessuna password di Home Assistant</div>
    <div class="spunta ap" style="--t:9.0s;font-size:16px;margin-top:10px"><span class="segno">${segno("spunta", 14, "#4ade80")}</span> Si stacca con un bottone, dalla console</div>
  </div>

  ${didascalia([
    { t: 1.0, t2: 3.0, testo: "Sul telefono c'è un bottone solo: <b>Inquadra il codice</b>." },
    {
      t: 3.2,
      t2: 7.3,
      testo: "Dentro il quadretto c'è anche <b>dove sta la casa</b>: non serve saperlo.",
    },
    { t: 7.5, testo: "Fatto. Da qui in poi il telefono entra da solo, in casa e fuori." },
  ])}`,
);

/* ══ 5. La plancia ═════════════════════════════════════════════════════ */

const tessera = (disegno, nome, valore, accesa = false, classi = "", tempi = "") => `
  <div class="${classi}" style="${tempi};background:${accesa ? "linear-gradient(150deg,#fff7e6,#ffedcc)" : "#fff"};
       border:1px solid ${accesa ? "rgba(245,158,11,.45)" : "rgba(15,23,42,.06)"};border-radius:15px;padding:10px 12px;height:88px;
       box-shadow:0 1px 3px rgba(15,23,42,.07)">
    ${oggetto(disegno, 26)}
    <div style="font-size:11px;color:#64748b;margin-top:6px">${nome}</div>
    <div style="font-size:14px;font-weight:700;color:#0f172a">${valore}</div>
  </div>`;

const PLANCIA = `
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
        ${tessera("luci", "Luci", "3 accese", false, "via", "--t2:5.05s")}
        <div class="ap" style="--t:5.1s;position:absolute;inset:0">${tessera("luci", "Luci", "4 accese", true)}</div>
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

scena(
  "la-plancia",
  13,
  () => `
  ${cartello(5, "La plancia", "la home dell'app")}
  ${telefono({ x: 150, y: 106, scala: 0.76, classe: "cr", stile: "--t:.3s", dentro: PLANCIA })}
  ${tocco(206, 258, 4.7)}

  <div style="position:absolute;left:490px;top:150px;right:84px">
    <div class="vetro en" style="--t:1.0s;padding:20px 22px">
      <h3 style="margin:0 0 6px;font-size:21px;font-weight:700">È quella vera</h3>
      <p style="margin:0;font-size:17px;line-height:1.5;color:var(--tenue)">Non una copia somigliante: è la plancia di DashboardModern, dentro l'app, con le sue tessere e le sue ventitré sezioni.</p>
    </div>
    <div class="vetro en" style="--t:1.35s;padding:20px 22px;margin-top:14px">
      <h3 style="margin:0 0 6px;font-size:21px;font-weight:700">I file li ha l'add-on</h3>
      <p style="margin:0;font-size:17px;line-height:1.5;color:var(--tenue)">In Home Assistant non si installa nessuna integrazione: la plancia la porta il ponte, e si aggiorna con lui.</p>
    </div>
    <div class="vetro en" style="--t:1.7s;padding:20px 22px;margin-top:14px">
      <h3 style="margin:0 0 6px;font-size:21px;font-weight:700">Si configura dal telefono</h3>
      <p style="margin:0;font-size:17px;line-height:1.5;color:var(--tenue)">E quello che configuri lo vedono uguale tutti i telefoni di casa, perché sta nel ponte e non sul telefono.</p>
    </div>
  </div>

  ${didascalia([
    { t: 2.4, t2: 5.0, testo: "La home dell'app è la plancia." },
    { t: 5.2, t2: 8.6, testo: "Le luci, il clima, l'energia: si toccano da qui." },
    { t: 8.8, testo: "In Home Assistant non c'è niente da installare: la porta l'add-on." },
  ])}`,
);

/* ══ 6. L'app ══════════════════════════════════════════════════════════
 *
 * La pagina del negozio e' **finta, e lo dice**: l'app sui negozi non c'e'
 * ancora — nel README sta fra le cose da fare. Il modo che funziona oggi e'
 * la scena dopo, e le due stanno una di fila all'altra apposta. */

const minaturaPlancia = `
  <div style="width:96px;height:190px;border-radius:12px;overflow:hidden;border:1px solid #dfe4ea;position:relative;background:#f0f4f8">
    <div style="position:absolute;left:0;top:0;width:292px;height:580px;transform:scale(.329);transform-origin:top left">
      <div style="position:relative;width:292px;height:614px">${PLANCIA}</div>
    </div>
  </div>`;

const NEGOZIO_TELEFONO = `
  <div style="position:absolute;inset:34px 0 0;background:#fff;color:#202124">
    <div style="display:flex;align-items:center;gap:10px;padding:8px 14px 12px">
      <span style="font-size:18px;color:#5f6368">←</span>
      <div style="flex:1;background:#f1f3f4;border-radius:20px;padding:8px 14px;font-size:13px;color:#3c4043">gdahome</div>
      ${segno("cerca", 18, "#5f6368")}
    </div>
    <div style="display:flex;gap:14px;padding:6px 16px 0">
      <img src="${MARCHIO}" width="62" height="62" style="border-radius:14px" alt="" />
      <div style="padding-top:2px">
        <div style="font-size:19px;font-weight:700;line-height:1.15">gdahome</div>
        <div style="font-size:13px;color:#01875f;font-weight:600;margin-top:3px">danigio15</div>
        <div style="font-size:11px;color:#5f6368;margin-top:2px">Nessun acquisto in-app</div>
      </div>
    </div>
    <div style="display:flex;margin:14px 16px 0;text-align:center">
      ${[
        ["Casa", "Categoria"],
        ["3+", "Età"],
        ["Open", "Licenza"],
      ]
        .map(
          ([grande, piccolo], i) =>
            `<div style="flex:1;${i < 2 ? "border-right:1px solid #e8eaed" : ""}">
               <div style="font-size:13px;font-weight:700">${grande}</div>
               <div style="font-size:10px;color:#5f6368;margin-top:2px">${piccolo}</div>
             </div>`,
        )
        .join("")}
    </div>

    <!-- Installa → in corso → Apri -->
    <div style="position:relative;height:44px;margin:16px 16px 0">
      <div class="via" style="--t2:3.05s;position:absolute;inset:0;background:#01875f;color:#fff;border-radius:22px;display:grid;place-items:center;font-size:15px;font-weight:600;animation:premuto .3s 2.8s ease both,sparisci .2s 3.05s ease forwards">Installa</div>
      <div class="ap via" style="--t:3.1s;--t2:8.0s;position:absolute;inset:0;display:grid;place-items:center;gap:6px;align-content:center">
        <div style="font-size:12px;color:#5f6368">Download in corso…</div>
        <div style="width:190px;height:4px;border-radius:3px;background:#e8eaed;overflow:hidden">
          <div style="height:100%;width:0;background:#01875f;animation:riempi 4.4s 3.3s linear forwards"></div>
        </div>
      </div>
      <div class="ap" style="--t:8.05s;position:absolute;inset:0;background:#01875f;color:#fff;border-radius:22px;display:grid;place-items:center;font-size:15px;font-weight:600">Apri</div>
    </div>

    <div style="display:flex;gap:10px;padding:18px 16px 0">
      ${minaturaPlancia}${minaturaPlancia}
      <div style="width:96px;height:190px;border-radius:12px;border:1px solid #dfe4ea;background:#0b1220;display:grid;place-items:center">
        <img src="${MARCHIO}" width="42" height="42" style="border-radius:11px" alt="" />
      </div>
    </div>
    <div style="padding:18px 16px 0">
      <div style="font-size:14px;font-weight:700">Informazioni sull'app</div>
      <p style="margin:6px 0 0;font-size:11.5px;line-height:1.5;color:#5f6368">
        La casa come una plancia: luci, clima, energia, sicurezza, telecamere. Serve una casa
        con Home Assistant e l'add-on gdahome — l'app da sola non sa dove andare.
      </p>
    </div>
  </div>`;

scena(
  "dal-negozio-del-telefono",
  15,
  () => `
  ${cartello(6, "L'app", "dal negozio del telefono")}
  <div class="ap" style="--t:.2s;position:absolute;right:64px;top:38px;display:flex;align-items:center;gap:10px;
       background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.45);border-radius:12px;padding:10px 16px">
    ${segno("scarica", 18, "#fbbf24")}
    <span style="font-size:15px;color:#fcd34d;font-weight:600">Anteprima: sui negozi non c'è ancora</span>
  </div>

  ${telefono({ x: 150, y: 106, scala: 0.76, classe: "cr", stile: "--t:.35s", dentro: NEGOZIO_TELEFONO })}
  ${tocco(268, 384, 2.75)}

  <div style="position:absolute;left:490px;top:180px;right:84px">
    <div class="vetro en" style="--t:1.1s;padding:22px 24px">
      <h3 style="margin:0 0 8px;font-size:22px;font-weight:700">Come sarà</h3>
      <p style="margin:0;font-size:17px;line-height:1.55;color:var(--tenue)">Si cerca <b style="color:#cfe0f5">gdahome</b> nel negozio del telefono, si preme <b style="color:#cfe0f5">Installa</b>, e si apre. Da lì c'è un bottone solo: inquadra il codice.</p>
    </div>
    <div class="vetro en" style="--t:1.45s;padding:22px 24px;margin-top:16px;border-color:rgba(245,158,11,.35)">
      <h3 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fcd34d">Come è adesso</h3>
      <p style="margin:0;font-size:17px;line-height:1.55;color:var(--tenue)">Sul Play Store l'app <b style="color:#fcd34d">non è ancora pubblicata</b>: nel piano è l'ultima riga della fase 1. Intanto si apre dal browser, ed è qui sotto. <b style="color:#fcd34d">Per iOS: prossimamente.</b></p>
    </div>
  </div>

  ${didascalia([
    {
      t: 2.2,
      t2: 4.6,
      testo: "Quando sarà pubblicata sarà questa la strada: cercarla e premere <b>Installa</b>.",
    },
    { t: 4.8, t2: 9.4, testo: "Nessun file da passare, nessun permesso strano da concedere." },
    { t: 9.6, testo: "Oggi però sui negozi non c'è: intanto si apre dal browser." },
  ])}`,
);

/* ══ 7. Come si prova oggi ═════════════════════════════════════════════
 *
 * Una strada sola, quella che funziona senza installare niente. L'apk da
 * scaricare a mano stava qui e non ci sta piu': e' roba da chi prova, non da
 * chi guarda un video per capire cos'e'. Dell'iPhone si dice quello che c'e'
 * da dire, cioe' quando. */

const passo = (numero, testo) => `
  <div style="display:flex;align-items:center;gap:12px;margin-top:14px">
    <div style="flex:0 0 auto;width:28px;height:28px;border-radius:9px;background:rgba(14,165,233,.16);
                border:1px solid rgba(14,165,233,.4);display:grid;place-items:center;
                font-size:14px;font-weight:800;color:#38bdf8">${numero}</div>
    <div style="font-size:18px;color:#dbe7f7">${testo}</div>
  </div>`;

scena(
  "come-si-prova-oggi",
  11.5,
  () => `
  ${cartello(7, "Intanto, oggi", "senza installare niente")}

  <div class="vetro en" style="--t:.4s;position:absolute;left:240px;top:160px;width:800px;padding:26px 30px 30px">
    <h3 style="margin:0;font-size:24px;font-weight:700">Dal browser</h3>
    <p style="margin:6px 0 0;font-size:17px;color:var(--tenue)">
      L'indirizzo lo dà l'add-on, e non c'è niente da scaricare.
    </p>
    ${passo(1, "In Home Assistant, barra laterale → <b style='color:#fff'>gdahome</b>")}
    ${passo(2, "Scheda «gdahome in un browser» → <b style='color:#fff'>Apri gdahome</b>")}
    <div style="margin-top:22px;padding-top:18px;border-top:1px solid rgba(255,255,255,.1);
                font-size:16px;line-height:1.5;color:#7f93b0">
      È la stessa app del telefono, e si adatta da sola allo schermo: computer, tablet o telefono.
      Ci arriva solo chi è già entrato in Home Assistant.
    </div>
  </div>

  <div class="ap" style="--t:1.6s;position:absolute;left:0;right:0;top:494px;display:flex;justify-content:center">
    <div class="vetro" style="display:flex;align-items:center;gap:12px;padding:14px 24px;border-color:rgba(245,158,11,.4)">
      ${segno("telefono", 22, "#fbbf24")}
      <span style="font-size:20px;color:#fcd34d;font-weight:600">Per iOS: prossimamente</span>
    </div>
  </div>

  ${didascalia([
    {
      t: 1.4,
      t2: 6.0,
      testo:
        "Intanto l'app si apre <b>dal browser</b>, e non si installa niente: l'indirizzo lo dà l'add-on.",
    },
    { t: 6.2, testo: "È la stessa app, su qualunque schermo. <b>Per iOS: prossimamente.</b>" },
  ])}`,
);

/* ══ 8. Chiusura ═══════════════════════════════════════════════════════ */

scena(
  "chiusura",
  9.5,
  () => `
  <img class="cr" src="${MARCHIO}" width="104" height="104" alt=""
       style="--t:.1s;position:absolute;left:50%;top:104px;transform:translateX(-50%);border-radius:24px;box-shadow:0 20px 50px rgba(0,0,0,.5)" />
  <div class="en" style="--t:.4s;position:absolute;left:0;right:0;top:228px;text-align:center;font-size:44px;font-weight:800;letter-spacing:-.02em">gdahome</div>

  <div class="en-c" style="--t:.8s;position:absolute;left:50%;top:306px;text-align:center">
    <div style="font-size:17px;color:var(--tenue);margin-bottom:10px">L'archivio da incollare in Home Assistant</div>
    <div class="vetro" style="padding:16px 30px;font-family:'DejaVu Sans Mono',monospace;font-size:24px;color:#e6f2ff;border-color:rgba(14,165,233,.4)">
      https://github.com/danigio15/gdahomeapp
    </div>
  </div>

  <div class="en" style="--t:1.15s;position:absolute;left:0;right:0;top:432px;text-align:center;font-size:18px;color:var(--tenue)">
    Impostazioni → Add-on → Negozio degli add-on → i tre puntini → <b style="color:#cfe0f5">Archivi</b>
  </div>

  <div class="ap" style="--t:1.5s;position:absolute;left:50%;top:492px;transform:translateX(-50%);display:flex;gap:12px">
    <span class="vetro" style="padding:9px 18px;font-size:15px;color:#cfe0f5">521 prove, senza rete e senza telefono</span>
    <span class="vetro" style="padding:9px 18px;font-size:15px;color:#cfe0f5">codice aperto</span>
  </div>

  ${didascalia([
    { t: 2.4, t2: 6.2, testo: "Un indirizzo da incollare, e un quadretto da inquadrare." },
    { t: 6.4, testo: "<b>github.com/danigio15/gdahomeapp</b>" },
  ])}`,
);

/* ══ Il palco, e cosa vede chi filma ═══════════════════════════════════ */

/* Prima si disegnano le scene — e' disegnandole che nascono le animazioni
   del puntatore, una per scena — e solo dopo si mette in pagina il foglio di
   stile che le contiene. Al contrario, il puntatore non si muove. */
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
