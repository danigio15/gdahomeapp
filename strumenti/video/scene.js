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

import { MARCHIO, mettiInScena, oggetto, plancia, segno, STILI, t, telefono } from "./pezzi.js";

const SCENE = [];

/* Una scena: un nome, quanto dura in secondi, e il suo contenuto. */
function scena(nome, durata, contenuto) {
  SCENE.push({ nome, durata, contenuto });
}

/* ── I disegnini ──────────────────────────────────────────────────────── */

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
  ["casa", "Panoramica", "Overview"],
  ["fulmine", "Energia", "Energy"],
  ["registro", "Registro", "Logbook"],
  ["orologio", "Cronologia", "History"],
  ["media", "Media", "Media"],
];

/* La barra laterale. `scelta` e' la voce accesa; `gdahome` la aggiunge in
   fondo, come succede quando l'add-on parte. */
function barraLato({ scelta = "", gdahome = null, extra = "" } = {}) {
  const voci = VOCI.map(
    ([disegno, nome, inglese]) =>
      `<div class="voce${scelta === nome ? " scelta" : ""}">${segno(disegno)}<span>${t(nome, inglese)}</span></div>`,
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
      <div class="voce">${segno("attrezzi")}<span>${t("Strumenti", "Developer tools")}</span></div>
      <div class="voce${scelta === "Impostazioni" ? " scelta" : ""}">${segno("ingranaggio")}<span>${t("Impostazioni", "Settings")}</span></div>
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

/* ══ 1. Apertura ═══════════════════════════════════════════════════════ */

scena(
  "apertura",
  8,
  () => `
  <div style="position:absolute;left:50%;top:196px;transform:translateX(-50%);width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(14,165,233,.34),transparent 65%);opacity:0;animation:alone-c 1.5s .1s ease-out forwards"></div>
  <img class="cr-c" src="${MARCHIO}" width="148" height="148" alt=""
       style="--t:.1s;position:absolute;left:50%;top:118px;border-radius:33px;box-shadow:0 24px 60px rgba(0,0,0,.55)" />
  <div class="en" style="--t:.55s;position:absolute;left:0;right:0;top:294px;text-align:center;font-size:76px;font-weight:800;letter-spacing:-.03em">gdahome</div>
  <div class="en" style="--t:.85s;position:absolute;left:0;right:0;top:392px;text-align:center;font-size:27px;color:var(--tenue);font-weight:500">${t("La casa in una plancia, sul telefono", "Your home as one screen, on your phone")}</div>
  <div class="en" style="--t:1.15s;position:absolute;left:0;right:0;top:452px;display:flex;justify-content:center;gap:10px">
    <span class="vetro" style="padding:9px 18px;font-size:16px;color:#cfe0f5">${t("un add-on di Home Assistant", "a Home Assistant add-on")}</span>
    <span class="vetro" style="padding:9px 18px;font-size:16px;color:#cfe0f5">${t("+ un'app per Android e iPhone", "+ an app for Android and iPhone")}</span>
  </div>
  ${didascalia([
    {
      t: 1.9,
      t2: 4.4,
      testo: t(
        "Una casa in Home Assistant, e un telefono.",
        "A home in Home Assistant, and a phone.",
      ),
    },
    {
      t: 4.6,
      testo: t(
        "Nel mezzo due cose da installare: <b>un add-on</b> e <b>l'app</b>.",
        "In between, two things to install: <b>an add-on</b> and <b>the app</b>.",
      ),
    },
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
  ${cartello(1, t("Cos'è", "What it is"), t("tre pezzi, e uno solo si installa", "three pieces, and only one gets installed"))}
  ${pezzo(
    98,
    0.5,
    "",
    segno("ponte", 30, "#38bdf8"),
    t("L'add-on", "The add-on"),
    t(
      "Si chiama <b style='color:#cfe0f5'>gdahome</b> e sta dentro Home Assistant. È lui che fa entrare il telefono: da dentro e da fuori casa.",
      "It's called <b style='color:#cfe0f5'>gdahome</b> and lives inside Home Assistant. It's what lets the phone in: at home and away.",
    ),
    t("Si installa dal negozio degli add-on", "Installed from the add-on store"),
  )}
  ${pezzo(
    470,
    0.8,
    "ambra",
    segno("telefono", 30, "#fbbf24"),
    t("L'app", "The app"),
    t(
      "Android e iPhone. Si abbina <b style='color:#cfe0f5'>inquadrando un QR code</b>: nessun indirizzo, nessuna password di Home Assistant.",
      "Android and iPhone. It pairs by <b style='color:#cfe0f5'>scanning a QR code</b>: no address, no Home Assistant password.",
    ),
    t("Un bottone solo, alla prima accensione", "One button, the first time you open it"),
  )}
  ${pezzo(
    842,
    1.1,
    "verde",
    segno("casa", 30, "#4ade80"),
    t("La plancia", "The dashboard"),
    t(
      "La home dell'app: ventitré sezioni, quelle vere della dashboard. <b style='color:#cfe0f5'>La porta l'add-on</b>, e si configura dal telefono.",
      "The app's home: twenty-three sections, the real dashboard ones. <b style='color:#cfe0f5'>The add-on brings it</b>, and you set it up from the phone.",
    ),
    t("È DashboardModern, con la sua licenza", "It's DashboardModern, with its own licence"),
  )}
  <div class="ap" style="--t:1.9s;position:absolute;left:98px;top:534px;right:98px;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent)"></div>
  <div class="ap" style="--t:2.1s;position:absolute;left:0;right:0;top:556px;text-align:center;font-size:19px;color:#7f93b0">
    ${t(
      "L'add-on si installa una volta sola, e da lì arrivano sia l'app che la plancia.",
      "The add-on is installed once, and both the app and the dashboard come from it.",
    )}
  </div>
  ${didascalia([
    {
      t: 2.0,
      t2: 6.2,
      testo: t(
        "Tre pezzi, e in Home Assistant se ne installa <b>uno solo</b>.",
        "Three pieces, and in Home Assistant you install <b>only one</b>.",
      ),
    },
    {
      t: 6.4,
      testo: t(
        "La plancia arriva insieme all'add-on: nient'altro da mettere.",
        "The dashboard comes with the add-on: nothing else to put in.",
      ),
    },
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
  ${cartello(2, t("Come ci si arriva", "How you get in"), t("in casa, e da fuori", "at home, and away"))}

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
    <div style="font-size:16px;font-weight:600">${t("L'app", "The app")}</div>
  </div>

  <!-- il centralino -->
  <div class="vetro cr" style="--t:5.4s;position:absolute;left:748px;top:120px;width:196px;height:112px;display:grid;place-items:center;gap:4px;align-content:center">
    ${segno("nuvola", 30, "#fbbf24")}
    <div style="font-size:16px;font-weight:600">${t("Il centralino", "The relay")}</div>
    <div style="font-size:13px;color:var(--tenue)">${t("instrada, e non legge", "it routes, it can't read")}</div>
  </div>

  <!-- la casa -->
  <div class="vetro cr" style="--t:.7s;position:absolute;left:964px;top:250px;width:204px;height:162px;display:grid;place-items:center;gap:5px;align-content:center">
    ${segno("casa", 32, "#38bdf8")}
    <div style="font-size:17px;font-weight:700">Home Assistant</div>
    <div style="font-size:14px;color:var(--tenue);text-align:center;line-height:1.35">${t("con dentro<br/>l'add-on gdahome", "with the gdahome<br/>add-on inside")}</div>
  </div>

  <div class="ap" style="--t:1.5s;position:absolute;left:452px;top:338px;font-size:15px;color:#7dd3fc;font-weight:600">${t("in casa: dritto, sul Wi-Fi", "at home: straight over Wi-Fi")}</div>
  <div class="ap" style="--t:5.8s;position:absolute;left:392px;top:140px;font-size:15px;color:#fcd34d;font-weight:600">${t("da fuori: è la casa che chiama", "away: the home calls out")}</div>

  <div style="position:absolute;left:112px;top:514px;right:112px;display:flex;gap:14px">
    <div class="vetro ap" style="--t:9.9s;flex:1;padding:15px 18px;display:flex;gap:11px;align-items:center;font-size:17px;color:#dbe7f7">${segno("lucchetto", 22, "#4ade80")} ${t("Nessuna porta aperta sul router", "No ports opened on your router")}</div>
    <div class="vetro ap" style="--t:10.1s;flex:1;padding:15px 18px;display:flex;gap:11px;align-items:center;font-size:17px;color:#dbe7f7">${segno("mondo", 22, "#4ade80")} ${t("Nessuna VPN da installare", "No VPN to install")}</div>
    <div class="vetro ap" style="--t:10.3s;flex:1;padding:15px 18px;display:flex;gap:11px;align-items:center;font-size:17px;color:#dbe7f7">${segno("spunta", 22, "#4ade80")} ${t("Cifrato punta a punta", "End-to-end encrypted")}</div>
  </div>

  ${didascalia([
    {
      t: 1.4,
      t2: 5.3,
      testo: t(
        "In casa il telefono va dritto: la casa la trova da solo sul Wi-Fi.",
        "At home the phone goes straight there: it finds the house by itself over Wi-Fi.",
      ),
    },
    {
      t: 5.6,
      t2: 9.7,
      testo: t(
        "Da fuori <b>è la casa che chiama</b>, e il telefono arriva da lì.",
        "From away <b>it's the home that calls out</b>, and the phone comes in that way.",
      ),
    },
    {
      t: 10.6,
      testo: t(
        "Sul router non si tocca niente. Il centralino instrada e non può leggere.",
        "Nothing changes on your router. The relay routes, and it cannot read.",
      ),
    },
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
    ${[
      ["Soggiorno", "Living room"],
      ["Cucina", "Kitchen"],
      ["Camera", "Bedroom"],
      ["Clima", "Climate"],
      ["Energia", "Energy"],
      ["Sicurezza", "Security"],
    ]
      .map(
        ([nome, inglese]) => `<div class="carta" style="height:118px">
          <h4>${t(nome, inglese)}</h4>
          <p style="margin-top:8px">—</p>
          <div style="margin-top:14px;height:8px;border-radius:4px;background:#eceff3"></div>
          <div style="margin-top:8px;height:8px;width:60%;border-radius:4px;background:#eceff3"></div>
        </div>`,
      )
      .join("")}
  </div>`;

const IMPOSTAZIONI = `
  ${rigaImpostazioni(0, segno("scatola", 22), t("Dispositivi e servizi", "Devices & services"), t("Integrazioni, dispositivi, entità", "Integrations, devices, entities"))}
  ${rigaImpostazioni(74, segno("attrezzi", 22), t("Automazioni e scene", "Automations & scenes"), t("Automazioni, scene, script, aiutanti", "Automations, scenes, scripts, helpers"))}
  ${rigaImpostazioni(148, segno("scatola", 22), t("Add-on", "Add-ons"), t("Il negozio, e quelli installati", "The store, and the ones installed"), true)}
  ${rigaImpostazioni(222, segno("casa", 22), t("Aree, etichette e zone", "Areas, labels & zones"), t("Come è fatta la casa", "How the home is laid out"))}
  ${rigaImpostazioni(296, segno("ingranaggio", 22), t("Sistema", "System"), t("Rete, archivi di sicurezza, aggiornamenti", "Network, backups, updates"))}`;

scena("verso-le-impostazioni", 9, () => {
  const prima = finestraHa({ titolo: t("Panoramica", "Overview"), corpo: PANORAMICA, lato: {} });
  const dopo = finestraHa({
    titolo: t("Impostazioni", "Settings"),
    corpo: IMPOSTAZIONI,
    lato: { scelta: "Impostazioni" },
  });
  return `
  ${cartello(3, t("L'add-on, dal negozio", "The add-on, from the store"), t("Impostazioni → Add-on", "Settings → Add-ons"))}
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
    {
      t: 0.9,
      t2: 3.1,
      testo: t("In Home Assistant: <b>Impostazioni</b>.", "In Home Assistant: <b>Settings</b>."),
    },
    { t: 3.3, t2: 6.6, testo: t("Poi <b>Add-on</b>.", "Then <b>Add-ons</b>.") },
    {
      t: 6.8,
      testo: t("Da qui si apre il negozio degli add-on.", "From here you open the add-on store."),
    },
  ])}`;
});

/* ── Il negozio ───────────────────────────────────────────────────────── */

const cartaNegozio = (nome, testo, tinta = "#03a9f4", classi = "", stile = "") => `
  <div class="carta ${classi}" style="height:104px;display:flex;gap:12px;align-items:flex-start;${stile}">
    <div style="flex:0 0 auto;width:40px;height:40px;border-radius:10px;background:${tinta}1f;border:1px solid ${tinta}55;display:grid;place-items:center;color:${tinta}">${segno("scatola", 22, tinta)}</div>
    <div><h4>${nome}</h4><p>${testo}</p></div>
  </div>`;

const UFFICIALI = `
    ${cartaNegozio("File editor", t("Un editor per i file di configurazione", "An editor for the configuration files"))}
    ${cartaNegozio("Terminal &amp; SSH", t("Un terminale, dentro Home Assistant", "A terminal, inside Home Assistant"))}
    ${cartaNegozio("Samba share", t("Le cartelle di casa, sulla rete", "The home folders, on the network"))}
    ${cartaNegozio("Mosquitto broker", t("Il broker MQTT", "The MQTT broker"))}
    ${cartaNegozio("Studio Code Server", t("Visual Studio Code, nel browser", "Visual Studio Code, in the browser"))}
    ${cartaNegozio("ESPHome", t("I dispositivi fatti in casa", "The devices you build yourself"))}`;

const negozio = ({ conGdahome = false, evidenzia = false } = {}) => `
  ${
    conGdahome
      ? `<div class="cr" style="--t:.35s">
          <p class="titolo-negozio">gdahome ${evidenzia ? '<span style="font-size:11px;font-weight:700;color:#0288d1;background:rgba(3,169,244,.12);padding:3px 8px;border-radius:20px">${t("NUOVO", "NEW")}</span>' : ""}</p>
          <div class="griglia-negozio" style="margin-bottom:16px">
            ${cartaNegozio(
              "gdahome",
              t(
                "La plancia e l'app di gdahome, per questa casa: da dentro e da fuori, senza che nessun segreto di Home Assistant finisca sul telefono.",
                "The gdahome dashboard and app, for this home: from inside and from away, without a single Home Assistant secret ending up on the phone.",
              ),
              "#0ea5e9",
              "",
              evidenzia ? "box-shadow:0 0 0 2px #0ea5e9,0 8px 22px rgba(14,165,233,.3)" : "",
            )}
          </div>
        </div>`
      : ""
  }
  <p class="titolo-negozio">${t("Add-on ufficiali di Home Assistant", "Official Home Assistant add-ons")}</p>
  <div class="griglia-negozio">${UFFICIALI}</div>`;

scena("il-negozio", 11, () => {
  const pagina = finestraHa({
    titolo: t("Add-on", "Add-ons"),
    corpo: `
      <div class="carta" style="height:78px;display:flex;align-items:center;gap:14px">
        <div style="width:40px;height:40px;border-radius:10px;background:rgba(3,169,244,.12);display:grid;place-items:center">${segno("scatola", 22, "#0288d1")}</div>
        <div><h4>${t("Nessun add-on installato", "No add-ons installed")}</h4><p>${t("Gli add-on si prendono dal negozio.", "Add-ons come from the store.")}</p></div>
      </div>
      <div style="position:absolute;right:26px;bottom:24px" class="bottone-ha">${segno("scarica", 18, "#fff")} ${t("Negozio degli add-on", "Add-on store")}</div>`,
    lato: { scelta: "Impostazioni" },
  });
  const store = finestraHa({
    titolo: t("Negozio degli add-on", "Add-on store"),
    corpo: negozio(),
    lato: { scelta: "Impostazioni" },
    testataDestra: `<div class="tre-punti">${segno("puntini", 20)}</div>`,
  });
  return `
  ${cartello(3, t("L'add-on, dal negozio", "The add-on, from the store"), t("il negozio, e i tre puntini", "the store, and the three dots"))}
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
    {
      t: 0.7,
      t2: 3.0,
      testo: t(
        "In fondo alla pagina: <b>Negozio degli add-on</b>.",
        "At the bottom of the page: <b>Add-on store</b>.",
      ),
    },
    {
      t: 3.2,
      t2: 6.2,
      testo: t(
        "Qui dentro ci sono gli add-on che Home Assistant conosce già.",
        "In here are the add-ons Home Assistant already knows about.",
      ),
    },
    {
      t: 6.4,
      testo: t(
        "gdahome non è tra quelli: si aggiunge il suo archivio, dai <b>tre puntini</b>.",
        "gdahome isn't one of them: you add its repository, from the <b>three dots</b>.",
      ),
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
      <div>${t("Controlla gli aggiornamenti", "Check for updates")}</div>
      <div class="acceso">${t("Archivi", "Repositories")}</div>
      <div>${t("Ricarica", "Reload")}</div>
    </div>`;
  const finestrella = `
    <div class="ap via" style="--t:1.95s;--t2:8.65s;position:absolute;left:108px;top:92px;width:1064px;height:500px;border-radius:16px;background:rgba(6,12,22,.42)"></div>
    <div class="finestrella cr-cc" style="--t:2.0s;left:640px;top:342px">
      <h3>${t("Gestisci gli archivi degli add-on", "Manage add-on repositories")}</h3>
      <p>${t("Un archivio è un indirizzo di GitHub: da lì Home Assistant prende gli add-on e i loro aggiornamenti.", "A repository is a GitHub address: that's where Home Assistant takes add-ons and their updates from.")}</p>
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0 14px;border-top:1px solid #eceff3">
        <div style="width:34px;height:34px;border-radius:9px;background:#f1f4f8;display:grid;place-items:center;color:#5a6b7d">${segno("scatola", 18)}</div>
        <div style="flex:1"><h4 style="font-size:14px;margin:0">Home Assistant Community Add-ons</h4><p style="font-size:12px;color:#8e99a6;margin:0">github.com/hassio-addons/repository</p></div>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <div class="casella" style="flex:1">
          <span class="testo-scritto" style="width:${QUANTO_E_LUNGO}ch;animation:scrivi 2.2s 4.1s steps(${QUANTO_E_LUNGO},end) both">${INDIRIZZO}</span><span class="cursore-testo ap via" style="--t:3.85s;--t2:6.5s"></span>
        </div>
        <div class="bottone-ha" style="padding:11px 22px">${t("Aggiungi", "Add")}</div>
      </div>
    </div>`;
  const store = finestraHa({
    titolo: t("Negozio degli add-on", "Add-on store"),
    corpo: `${negozio()}${tendina}`,
    lato: { scelta: "Impostazioni" },
    testataDestra: `<div class="tre-punti">${segno("puntini", 20)}</div>`,
  });
  return `
  ${cartello(3, t("L'add-on, dal negozio", "The add-on, from the store"), t("Archivi → l'indirizzo → Aggiungi", "Repositories → the address → Add"))}
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
    {
      t: 0.5,
      t2: 2.6,
      testo: t("Dai tre puntini: <b>Archivi</b>.", "From the three dots: <b>Repositories</b>."),
    },
    {
      t: 2.8,
      t2: 6.9,
      testo: t(
        "Si incolla l'indirizzo della repository, e basta questo.",
        "You paste the repository address, and that's all it takes.",
      ),
    },
    { t: 7.4, testo: t("<b>Aggiungi</b>, e si chiude.", "<b>Add</b>, and close it.") },
  ])}`;
});

/* ── L'add-on che compare ─────────────────────────────────────────────── */

scena("gdahome-nel-negozio", 8.5, () => {
  const store = finestraHa({
    titolo: t("Negozio degli add-on", "Add-on store"),
    corpo: negozio({ conGdahome: true, evidenzia: true }),
    lato: { scelta: "Impostazioni" },
    testataDestra: `<div class="tre-punti">${segno("puntini", 20)}</div>`,
  });
  return `
  ${cartello(3, t("L'add-on, dal negozio", "The add-on, from the store"), t("compare gdahome", "gdahome shows up"))}
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
      testo: t(
        "Nel negozio compare una sezione <b>gdahome</b>, con dentro l'add-on.",
        "A <b>gdahome</b> section appears in the store, with the add-on inside.",
      ),
    },
    {
      t: 4.2,
      testo: t(
        "Si apre, e si installa come tutti gli altri.",
        "Open it, and install it like any other.",
      ),
    },
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
          <p>${t("La plancia e l'app di gdahome, per questa casa: da dentro e da fuori, senza che nessun segreto di Home Assistant finisca sul telefono.", "The gdahome dashboard and app, for this home: from inside and from away, without a single Home Assistant secret ending up on the phone.")}</p>
        </div>
        <div style="text-align:right">
          <p style="font-size:12px">${t("versione", "version")}</p>
          <h4 style="font-size:16px">1.4.25</h4>
        </div>
      </div>
      <div style="margin-top:16px;display:flex;gap:10px;align-items:center">
        <div class="bottone-ha via" style="--t2:2.35s;animation:premuto .3s 2.1s ease both,sparisci .2s 2.35s ease forwards">${segno("scarica", 18, "#fff")} ${t("Installa", "Install")}</div>
        <div class="bottone-ha verde ap via" style="--t:6.7s;--t2:8.75s">${t("Avvia", "Start")}</div>
        <div class="ap via" style="--t:6.7s;--t2:8.85s;font-size:13px;color:#6b7785">${t("Installato · nella barra laterale dopo l'avvio", "Installed · in the sidebar once started")}</div>
        <div class="ap" style="--t:8.9s;display:flex;align-items:center;gap:8px;font-size:14px;color:#16a34a;font-weight:600">
          <span style="width:9px;height:9px;border-radius:50%;background:#16a34a;display:inline-block"></span> ${t("In esecuzione", "Running")}
        </div>
      </div>
    </div>

    <!-- l'installazione in corso -->
    <div class="carta ap via" style="--t:2.5s;--t2:6.6s;position:absolute;left:18px;right:18px;top:172px;padding:16px 20px">
      <h4>${t("Installazione in corso…", "Installing…")}</h4>
      <div style="margin-top:12px;height:8px;border-radius:5px;background:#e8ecf1;overflow:hidden">
        <div style="height:100%;width:0;border-radius:5px;background:#03a9f4;animation:riempi 3.7s 2.7s linear forwards"></div>
      </div>
      <p style="margin-top:12px">${t("La prima volta ci mette qualche minuto: Home Assistant non se lo scarica già pronto, <b>se lo costruisce sul posto</b>. Le volte dopo è immediato.", "The first time takes a few minutes: Home Assistant doesn't download it ready-made, <b>it builds it on the spot</b>. After that it's instant.")}</p>
    </div>

    <!-- installato -->
    <div class="carta ap" style="--t:6.7s;position:absolute;left:18px;right:18px;top:172px;padding:16px 20px">
      <h4>${t("Configurazione", "Configuration")}</h4>
      <p style="margin-top:8px">${t("Da fuori casa · acceso — la casa chiama il centralino, e sul router non si apre niente.", "Access from away · on — the home calls the relay, and nothing is opened on the router.")}</p>
      <p style="margin-top:6px">${t("Codice di abbinamento · 5 minuti · fino a 10 telefoni", "Pairing code · 5 minutes · up to 10 phones")}</p>
      <p class="ap" style="--t:9.3s;margin-top:12px;color:#0288d1;font-weight:600">${t("Nella barra laterale è comparsa la console: <b>gdahome</b>.", "The console has appeared in the sidebar: <b>gdahome</b>.")}</p>
    </div>`;
  return `
  <div style="--t-gdahome:8.95s">
    ${cartello(3, t("L'add-on, dal negozio", "The add-on, from the store"), t("Installa, poi Avvia", "Install, then Start"))}
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
    { t: 0.6, t2: 2.7, testo: t("<b>Installa</b>.", "<b>Install</b>.") },
    {
      t: 2.9,
      t2: 6.5,
      testo: t(
        "La prima volta ci mette qualche minuto: se lo costruisce sul posto.",
        "The first time takes a few minutes: it builds it on the spot.",
      ),
    },
    { t: 6.9, t2: 9.0, testo: t("Poi <b>Avvia</b>.", "Then <b>Start</b>.") },
    {
      t: 9.2,
      testo: t(
        "E nella barra laterale compare <b>gdahome</b>: è la sua console.",
        "And <b>gdahome</b> appears in the sidebar: that's its console.",
      ),
    },
  ])}`;
});

/* ══ 4. Il codice ══════════════════════════════════════════════════════ */

const CONSOLE = ({ conCodice = false } = {}) => `
  <div style="max-width:620px;margin:0 auto">
    <div style="display:flex;align-items:center;gap:12px">
      <img src="${MARCHIO}" width="40" height="40" style="border-radius:10px" alt="" />
      <div>
        <h4 style="font-size:20px;margin:0">gdahome</h4>
        <p style="font-size:12px;margin:0">${t("La casa risponde · nessun telefono abbinato", "The home is answering · no phone paired")}</p>
      </div>
    </div>
    <div class="carta" style="margin-top:14px;padding:16px 18px">
      <h4>${t("Abbinare un telefono", "Pair a phone")}</h4>
      <p style="margin-bottom:12px">${t("Apri gdahome sul telefono e inquadra il QR code. Vale una volta sola e per pochi minuti.", "Open gdahome on your phone and scan the QR code. It works once, and only for a few minutes.")}</p>
      ${
        conCodice
          ? `<div class="cr" style="--t:2.6s;text-align:center">
               <img src="qrcode.svg" width="176" height="176" style="border-radius:10px;border:1px solid #e3e6ea;background:#fff" alt="" />
               <p style="margin:8px 0 4px">${t("Scade fra 4:58", "Expires in 4:58")}</p>
               <p style="font-family:'DejaVu Sans Mono',monospace;font-size:17px;letter-spacing:.1em;color:#212121;margin:0 0 12px">K7QM-3PDX-9WTB-46HZ</p>
             </div>
             <div class="bottone-ha vuoto ap" style="--t:2.6s;padding:9px 16px">${t("Annulla", "Cancel")}</div>`
          : `<div class="bottone-ha" style="animation:premuto .3s 2.0s ease both">${t("Fabbrica un codice", "Make a code")}</div>`
      }
    </div>
  </div>`;

scena(
  "il-codice",
  11,
  () => `
  ${cartello(4, t("Il codice", "The code"), t("un QR code, e cinque minuti", "a QR code, and five minutes"))}
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
    {
      t: 0.6,
      t2: 3.0,
      testo: t(
        "Dalla console: <b>Fabbrica un codice</b>.",
        "From the console: <b>Make a code</b>.",
      ),
    },
    {
      t: 3.2,
      t2: 6.8,
      testo: t(
        "Esce un QR code, e vale cinque minuti.",
        "Out comes a QR code, good for five minutes.",
      ),
    },
    {
      t: 7.0,
      testo: t(
        "Sotto ci sono le stesse cose in lettere, per chi non può inquadrare.",
        "Underneath, the same thing in letters, for anyone who can't scan.",
      ),
    },
  ])}`,
);

/* ── Il telefono che inquadra ─────────────────────────────────────────── */

const SCHERMATA_ABBINA = `
  <div style="padding:22px 20px 0;text-align:center">
    <img src="${MARCHIO}" width="58" height="58" style="border-radius:14px;margin-top:16px" alt="" />
    <h3 style="font-size:23px;margin:16px 0 8px;font-weight:700">${t("Colleghiamo la casa", "Let's connect your home")}</h3>
    <p style="font-size:14px;line-height:1.5;color:#475569;margin:0 24px">
      ${t(
        "In Home Assistant apri <b>gdahome</b> dalla barra laterale e fabbrica un codice.",
        "In Home Assistant open <b>gdahome</b> from the sidebar and make a code.",
      )}
    </p>
    <div style="margin-top:26px;background:#0ea5e9;color:#fff;border-radius:14px;padding:15px;font-size:16px;font-weight:600">
      ${t("Inquadra il codice", "Scan the code")}
    </div>
    <p style="margin-top:16px;font-size:13px;color:#0284c7;font-weight:600">${t("Non puoi inquadrarlo? Scrivilo a mano", "Can't scan it? Type it instead")}</p>
    <p style="margin-top:64px;font-size:12px;color:#64748b;line-height:1.45">
      ${t(
        "Non ti verrà mai chiesta la password<br />di Home Assistant, né un gettone.",
        "You will never be asked for your Home<br />Assistant password, or for a token.",
      )}
    </p>
  </div>`;

const SCHERMATA_FOTOCAMERA = `
  <div style="position:absolute;inset:0;background:#0b1220">
    <div style="position:absolute;left:50%;top:236px;transform:translate(-50%,-50%);width:186px;height:186px;border-radius:16px;background:#fff;display:grid;place-items:center">
      <img src="qrcode.svg" width="168" height="168" alt="" />
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
    <p style="position:absolute;left:0;right:0;top:390px;text-align:center;color:#cbd5e1;font-size:15px">${t("Inquadra il QR code", "Scan the QR code")}</p>
  </div>`;

const SCHERMATA_COLLEGATA = `
  <div style="position:absolute;inset:34px 0 0;background:#f0f4f8;display:grid;place-items:center;align-content:center;gap:10px">
    <div style="width:86px;height:86px;border-radius:50%;background:rgba(22,163,74,.14);border:2px solid rgba(22,163,74,.5);display:grid;place-items:center">
      ${segno("spunta", 44, "#16a34a")}
    </div>
    <h3 style="font-size:22px;margin:12px 0 0;font-weight:700">${t("Casa collegata", "Home connected")}</h3>
    <p style="font-size:14px;color:#475569;margin:0;text-align:center;line-height:1.5">${t("Il telefono ha un segno suo,<br />solo per questa casa.", "The phone has a mark of its own,<br />just for this home.")}</p>
  </div>`;

scena(
  "inquadra",
  11.5,
  () => `
  ${cartello(4, t("Il codice", "The code"), t("si inquadra, e la casa è collegata", "scan it, and the home is connected"))}

  <div class="carta cr" style="--t:.3s;position:absolute;left:206px;top:152px;width:296px;text-align:center;padding:20px">
    <h4 style="font-size:15px">${t("La console, dentro Home Assistant", "The console, inside Home Assistant")}</h4>
    <img src="qrcode.svg" width="196" height="196" style="margin-top:14px;border:1px solid #e3e6ea;border-radius:10px" alt="" />
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
    <div class="spunta ap" style="--t:8.4s;font-size:16px"><span class="segno">${segno("spunta", 14, "#4ade80")}</span> ${t("Nessun indirizzo da sapere", "No address to know")}</div>
    <div class="spunta ap" style="--t:8.7s;font-size:16px;margin-top:10px"><span class="segno">${segno("spunta", 14, "#4ade80")}</span> ${t("Nessuna password di Home Assistant", "No Home Assistant password")}</div>
    <div class="spunta ap" style="--t:9.0s;font-size:16px;margin-top:10px"><span class="segno">${segno("spunta", 14, "#4ade80")}</span> ${t("Si stacca con un bottone, dalla console", "Unpaired with one button, from the console")}</div>
  </div>

  ${didascalia([
    {
      t: 1.0,
      t2: 3.0,
      testo: t(
        "Sul telefono c'è un bottone solo: <b>Inquadra il codice</b>.",
        "On the phone there's one button: <b>Scan the code</b>.",
      ),
    },
    {
      t: 3.2,
      t2: 7.3,
      testo: t(
        "Dentro il QR code c'è anche <b>dove sta la casa</b>: non serve saperlo.",
        "The QR code also carries <b>where the home is</b>: no need to know it.",
      ),
    },
    {
      t: 7.5,
      testo: t(
        "Fatto. Da qui in poi il telefono entra da solo, in casa e fuori.",
        "Done. From now on the phone gets in by itself, at home and away.",
      ),
    },
  ])}`,
);

/* ══ 5. La plancia ═════════════════════════════════════════════════════ */

scena(
  "la-plancia",
  13,
  () => `
  ${cartello(5, t("La plancia", "The dashboard"), t("la home dell'app", "the app's home"))}
  ${telefono({ x: 150, y: 106, scala: 0.76, classe: "cr", stile: "--t:.3s", dentro: plancia({ accende: 5.1 }) })}
  ${tocco(206, 258, 4.7)}

  <div style="position:absolute;left:490px;top:150px;right:84px">
    <div class="vetro en" style="--t:1.0s;padding:20px 22px">
      <h3 style="margin:0 0 6px;font-size:21px;font-weight:700">${t("È quella vera", "It's the real one")}</h3>
      <p style="margin:0;font-size:17px;line-height:1.5;color:var(--tenue)">${t("Non una copia somigliante: è la plancia di DashboardModern, dentro l'app, con le sue tessere e le sue ventitré sezioni.", "Not a lookalike: it's the DashboardModern dashboard, inside the app, with its own tiles and its twenty-three sections.")}</p>
    </div>
    <div class="vetro en" style="--t:1.35s;padding:20px 22px;margin-top:14px">
      <h3 style="margin:0 0 6px;font-size:21px;font-weight:700">${t("I file li ha l'add-on", "The add-on holds the files")}</h3>
      <p style="margin:0;font-size:17px;line-height:1.5;color:var(--tenue)">${t("In Home Assistant non si installa nessuna integrazione: la plancia la porta il ponte, e si aggiorna con lui.", "No integration to install in Home Assistant: the bridge carries the dashboard, and updates it along with itself.")}</p>
    </div>
    <div class="vetro en" style="--t:1.7s;padding:20px 22px;margin-top:14px">
      <h3 style="margin:0 0 6px;font-size:21px;font-weight:700">${t("Si configura dal telefono", "You set it up from the phone")}</h3>
      <p style="margin:0;font-size:17px;line-height:1.5;color:var(--tenue)">${t("E quello che configuri lo vedono uguale tutti i telefoni di casa, perché sta nel ponte e non sul telefono.", "And what you set up looks the same on every phone in the house, because it lives in the bridge, not on the phone.")}</p>
    </div>
  </div>

  ${didascalia([
    {
      t: 2.4,
      t2: 5.0,
      testo: t("La home dell'app è la plancia.", "The app's home is the dashboard."),
    },
    {
      t: 5.2,
      t2: 8.6,
      testo: t(
        "Le luci, il clima, l'energia: si toccano da qui.",
        "Lights, climate, energy: you touch them from here.",
      ),
    },
    {
      t: 8.8,
      testo: t(
        "In Home Assistant non c'è niente da installare: la porta l'add-on.",
        "Nothing to install in Home Assistant: the add-on brings it.",
      ),
    },
  ])}`,
);

/* ══ 6. L'app ══════════════════════════════════════════════════════════
 *
 * La pagina del negozio e' **finta, e lo dice**: l'app su Google Play non c'e'
 * ancora — nel README sta fra le cose da fare. Il modo che funziona oggi e'
 * la scena dopo, e le due stanno una di fila all'altra apposta. */

const minaturaPlancia = `
  <div style="width:96px;height:190px;border-radius:12px;overflow:hidden;border:1px solid #dfe4ea;position:relative;background:#f0f4f8">
    <div style="position:absolute;left:0;top:0;width:292px;height:580px;transform:scale(.329);transform-origin:top left">
      <div style="position:relative;width:292px;height:614px">${plancia()}</div>
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
        <div style="font-size:11px;color:#5f6368;margin-top:2px">${t("Nessun acquisto in-app", "No in-app purchases")}</div>
      </div>
    </div>
    <div style="display:flex;margin:14px 16px 0;text-align:center">
      ${[
        [t("Casa", "Home"), t("Categoria", "Category")],
        ["3+", t("Età", "Rated")],
        ["Open", t("Licenza", "Licence")],
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
      <div class="via" style="--t2:3.05s;position:absolute;inset:0;background:#01875f;color:#fff;border-radius:22px;display:grid;place-items:center;font-size:15px;font-weight:600;animation:premuto .3s 2.8s ease both,sparisci .2s 3.05s ease forwards">${t("Installa", "Install")}</div>
      <div class="ap via" style="--t:3.1s;--t2:8.0s;position:absolute;inset:0;display:grid;place-items:center;gap:6px;align-content:center">
        <div style="font-size:12px;color:#5f6368">${t("Download in corso…", "Downloading…")}</div>
        <div style="width:190px;height:4px;border-radius:3px;background:#e8eaed;overflow:hidden">
          <div style="height:100%;width:0;background:#01875f;animation:riempi 4.4s 3.3s linear forwards"></div>
        </div>
      </div>
      <div class="ap" style="--t:8.05s;position:absolute;inset:0;background:#01875f;color:#fff;border-radius:22px;display:grid;place-items:center;font-size:15px;font-weight:600">${t("Apri", "Open")}</div>
    </div>

    <div style="display:flex;gap:10px;padding:18px 16px 0">
      ${minaturaPlancia}${minaturaPlancia}
      <div style="width:96px;height:190px;border-radius:12px;border:1px solid #dfe4ea;background:#0b1220;display:grid;place-items:center">
        <img src="${MARCHIO}" width="42" height="42" style="border-radius:11px" alt="" />
      </div>
    </div>
    <div style="padding:18px 16px 0">
      <div style="font-size:14px;font-weight:700">${t("Informazioni sull'app", "About this app")}</div>
      <p style="margin:6px 0 0;font-size:11.5px;line-height:1.5;color:#5f6368">
        ${t(
          "La casa come una plancia: luci, clima, energia, sicurezza, telecamere. Serve una casa con Home Assistant e l'add-on gdahome — l'app da sola non sa dove andare.",
          "Your home as one dashboard: lights, climate, energy, security, cameras. It needs a home running Home Assistant and the gdahome add-on — on its own the app has nowhere to go.",
        )}
      </p>
    </div>
  </div>`;

scena(
  "dal-negozio-del-telefono",
  15,
  () => `
  ${cartello(6, t("L'app", "The app"), t("dal Play Store", "from the Play Store"))}
  <div class="ap" style="--t:.2s;position:absolute;right:64px;top:38px;display:flex;align-items:center;gap:10px;
       background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.45);border-radius:12px;padding:10px 16px">
    ${segno("calendario", 18, "#fbbf24")}
    <span style="font-size:15px;color:#fcd34d;font-weight:600">${t("Su Google Play dal 30 settembre", "On Google Play from 30 September")}</span>
  </div>

  ${telefono({ x: 150, y: 106, scala: 0.76, classe: "cr", stile: "--t:.35s", dentro: NEGOZIO_TELEFONO })}
  ${tocco(268, 384, 2.75)}

  <div style="position:absolute;left:490px;top:180px;right:84px">
    <div class="vetro en" style="--t:1.1s;padding:22px 24px">
      <h3 style="margin:0 0 8px;font-size:22px;font-weight:700">${t("Come sarà", "How it will be")}</h3>
      <p style="margin:0;font-size:17px;line-height:1.55;color:var(--tenue)">${t('Si cerca <b style="color:#cfe0f5">gdahome</b> su Google Play, si preme <b style="color:#cfe0f5">Installa</b>, e si apre. Da lì c\'è un bottone solo: inquadra il codice.', 'You search for <b style="color:#cfe0f5">gdahome</b> on Google Play, press <b style="color:#cfe0f5">Install</b>, and open it. From there one button: scan the code.')}</p>
    </div>
    <div class="vetro en" style="--t:1.45s;padding:22px 24px;margin-top:16px;border-color:rgba(245,158,11,.35)">
      <h3 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fcd34d">${t("Come è adesso", "How it is today")}</h3>
      <p style="margin:0;font-size:17px;line-height:1.55;color:var(--tenue)">${t('Sul Play Store l\'app arriva il <b style="color:#fcd34d">30 settembre</b>, e per ora è l\'unico negozio. Fino a quel giorno si apre dal browser, ed è qui sotto. <b style="color:#fcd34d">Per iOS: in fase di sviluppo.</b>', 'The app lands on the Play Store on <b style="color:#fcd34d">30 September</b>, and for now that\'s the only store. Until then it opens in the browser, right below. <b style="color:#fcd34d">For iOS: in development.</b>')}</p>
    </div>
  </div>

  ${didascalia([
    {
      t: 2.2,
      t2: 4.6,
      testo: t(
        "Quando sarà pubblicata sarà questa la strada: cercarla e premere <b>Installa</b>.",
        "Once it's published this is the way: search for it and press <b>Install</b>.",
      ),
    },
    {
      t: 4.8,
      t2: 9.4,
      testo: t(
        "Nessun file da passare, nessun permesso strano da concedere.",
        "No file to sideload, no odd permission to grant.",
      ),
    },
    {
      t: 9.6,
      testo: t(
        "Fino a quel giorno si apre dal browser, e non si installa niente.",
        "Until that day it opens in the browser, and nothing gets installed.",
      ),
    },
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
  ${cartello(7, t("Intanto, oggi", "Meanwhile, today"), t("senza installare niente", "with nothing to install"))}

  <div class="vetro en" style="--t:.4s;position:absolute;left:240px;top:160px;width:800px;padding:26px 30px 30px">
    <h3 style="margin:0;font-size:24px;font-weight:700">${t("Dal browser", "From the browser")}</h3>
    <p style="margin:6px 0 0;font-size:17px;color:var(--tenue)">
      ${t(
        "L'indirizzo lo dà l'add-on, e non c'è niente da scaricare.",
        "The add-on gives you the address, and there's nothing to download.",
      )}
    </p>
    ${passo(1, t("In Home Assistant, barra laterale → <b style='color:#fff'>gdahome</b>", "In Home Assistant, sidebar → <b style='color:#fff'>gdahome</b>"))}
    ${passo(2, t("Scheda «gdahome in un browser» → <b style='color:#fff'>Apri gdahome</b>", "The «gdahome in a browser» card → <b style='color:#fff'>Open gdahome</b>"))}
    <div style="margin-top:22px;padding-top:18px;border-top:1px solid rgba(255,255,255,.1);
                font-size:16px;line-height:1.5;color:#7f93b0">
      ${t(
        "È la stessa app del telefono, e si adatta da sola allo schermo: computer, tablet o telefono. Ci arriva solo chi è già entrato in Home Assistant.",
        "It's the same app as on the phone, and it fits the screen by itself: computer, tablet or phone. Only someone already signed in to Home Assistant can reach it.",
      )}
    </div>
  </div>

  <div class="ap" style="--t:1.6s;position:absolute;left:0;right:0;top:494px;display:flex;justify-content:center">
    <div class="vetro" style="display:flex;align-items:center;gap:12px;padding:14px 24px;border-color:rgba(245,158,11,.4)">
      ${segno("telefono", 22, "#fbbf24")}
      <span style="font-size:20px;color:#fcd34d;font-weight:600">${t("Per iOS: in fase di sviluppo", "For iOS: in development")}</span>
    </div>
  </div>

  ${didascalia([
    {
      t: 1.4,
      t2: 6.0,
      testo: t(
        "Intanto l'app si apre <b>dal browser</b>, e non si installa niente: l'indirizzo lo dà l'add-on.",
        "Meanwhile the app opens <b>in the browser</b>, with nothing to install: the add-on gives you the address.",
      ),
    },
    {
      t: 6.2,
      testo: t(
        "È la stessa app, su qualunque schermo. <b>Per iOS: in fase di sviluppo.</b>",
        "Same app, on any screen. <b>For iOS: in development.</b>",
      ),
    },
  ])}`,
);

/* ══ 8. Quanto costa ═══════════════════════════════════════════════════
 *
 * La scena che mancava, e non e' una scena di contorno: un progetto gratis
 * che non lo dice sembra un progetto in prova, e uno che lo dice senza dire
 * come si tiene in piedi sembra un progetto che fra un anno non c'e' piu'. */

scena(
  "quanto-costa",
  11.5,
  () => `
  ${cartello(8, t("Quanto costa", "What it costs"), t("niente — e deve restare così", "nothing — and it has to stay that way"))}

  <div style="position:absolute;left:98px;top:176px;width:520px">
    <div class="en" style="--t:.3s;font-size:62px;font-weight:900;letter-spacing:-.03em;
         background:linear-gradient(120deg,#7dd3fc 10%,#fcd34d 90%);-webkit-background-clip:text;
         background-clip:text;color:transparent">${t("Tutto gratis", "All free")}</div>
    <div class="spunta ap" style="--t:.9s;margin-top:24px"><span class="segno">${segno("spunta", 14, "#4ade80")}</span> ${t("L'add-on, la plancia e l'app", "The add-on, the dashboard and the app")}</div>
    <div class="spunta ap" style="--t:1.1s;margin-top:14px"><span class="segno">${segno("spunta", 14, "#4ade80")}</span> ${t("La casa da fuori, senza abbonamenti", "Your home from away, with no subscription")}</div>
    <div class="spunta ap" style="--t:1.3s;margin-top:14px"><span class="segno">${segno("spunta", 14, "#4ade80")}</span> ${t("Tutte le case e tutti i telefoni che vuoi", "As many homes and phones as you like")}</div>
    <div class="spunta ap" style="--t:1.5s;margin-top:14px"><span class="segno">${segno("spunta", 14, "#4ade80")}</span> ${t("Le segnalazioni e la chat di assistenza", "Reports and the support chat")}</div>
    <p class="ap" style="--t:1.8s;margin-top:22px;font-size:17px;color:#7f93b0">
      ${t("Nessun account da fare, nessun limite a pagamento.", "No account to create, no paywalled limits.")}
    </p>
  </div>

  <div class="vetro en" style="--t:.6s;position:absolute;left:662px;top:176px;width:520px;padding:30px 32px;border-color:rgba(245,158,11,.35)">
    <h3 style="margin:0 0 10px;font-size:26px;font-weight:700;color:#fcd34d">${t("Gratis non vuol dire finito", "Free doesn't mean finished")}</h3>
    <p style="margin:0;font-size:17px;line-height:1.55;color:var(--tenue)">
      ${t(
        "Gli aiutanti, lo Zigbee, il mago delle automazioni: il piano è scritto e va avanti finché c'è chi lo tiene in piedi. <b style=\"color:#cfe0f5\">Ogni sostegno è una riga di quel piano che diventa vera</b> — e quello che c'è oggi resta gratis comunque.",
        'Helpers, Zigbee, the automation wizard: the plan is written down, and it moves as long as someone keeps it alive. <b style="color:#cfe0f5">Every sponsorship is one line of that plan coming true</b> — and what\'s here today stays free either way.',
      )}
    </p>
    <div class="vetro ap" style="--t:1.9s;margin-top:20px;display:flex;align-items:center;gap:12px;
         padding:14px 20px;border-color:rgba(245,158,11,.45);border-radius:999px">
      ${segno("cuore", 22, "#fb7185")}
      <span style="font-size:18px;font-weight:700;color:#fcd34d">${t("Sostieni il progetto su GitHub Sponsors", "Support the project on GitHub Sponsors")}</span>
    </div>
    <p class="ap" style="--t:2.2s;margin:18px 0 0;font-size:17px;line-height:1.5;color:#dbe7f7">
      ${t(
        "<b>Chi può, sostiene. Chi non può, lo usa lo stesso</b> — ed è sostenendolo che resta gratis per tutti e due.",
        "<b>Those who can, chip in. Those who can't, use it all the same</b> — and it's the chipping in that keeps it free for both.",
      )}
    </p>
  </div>

  ${didascalia([
    {
      t: 1.8,
      t2: 6.0,
      testo: t(
        "L'add-on, la plancia, l'app, la casa da fuori: <b>tutto gratis</b>, senza abbonamenti.",
        "The add-on, the dashboard, the app, your home from away: <b>all free</b>, no subscription.",
      ),
    },
    {
      t: 6.2,
      testo: t(
        "E <b>gratis non vuol dire finito</b>: chi dà una mano su <b>GitHub Sponsors</b> decide quanto in là si arriva.",
        "And <b>free doesn't mean finished</b>: whoever chips in on <b>GitHub Sponsors</b> decides how far this goes.",
      ),
    },
  ])}`,
);

/* ══ 9. Chiusura ═══════════════════════════════════════════════════════ */

scena(
  "chiusura",
  9.5,
  () => `
  <img class="cr" src="${MARCHIO}" width="104" height="104" alt=""
       style="--t:.1s;position:absolute;left:50%;top:104px;transform:translateX(-50%);border-radius:24px;box-shadow:0 20px 50px rgba(0,0,0,.5)" />
  <div class="en" style="--t:.4s;position:absolute;left:0;right:0;top:228px;text-align:center;font-size:44px;font-weight:800;letter-spacing:-.02em">gdahome</div>

  <div class="en-c" style="--t:.8s;position:absolute;left:50%;top:306px;text-align:center">
    <div style="font-size:17px;color:var(--tenue);margin-bottom:10px">${t("L'archivio da incollare in Home Assistant", "The repository to paste into Home Assistant")}</div>
    <div class="vetro" style="padding:16px 30px;font-family:'DejaVu Sans Mono',monospace;font-size:24px;color:#e6f2ff;border-color:rgba(14,165,233,.4)">
      https://github.com/danigio15/gdahomeapp
    </div>
  </div>

  <div class="en" style="--t:1.15s;position:absolute;left:0;right:0;top:432px;text-align:center;font-size:18px;color:var(--tenue)">
    ${t(
      'Impostazioni → Add-on → Negozio degli add-on → i tre puntini → <b style="color:#cfe0f5">Archivi</b>',
      'Settings → Add-ons → Add-on store → the three dots → <b style="color:#cfe0f5">Repositories</b>',
    )}
  </div>

  <div class="ap" style="--t:1.5s;position:absolute;left:50%;top:492px;transform:translateX(-50%);display:flex;gap:12px">
    <span class="vetro" style="padding:9px 18px;font-size:15px;color:#cfe0f5">${t("tutto gratis", "all free")}</span>
    <span class="vetro" style="padding:9px 18px;font-size:15px;color:#cfe0f5">${t("codice aperto", "open source")}</span>
    <span class="vetro" style="padding:9px 18px;font-size:15px;color:#fcd34d;border-color:rgba(245,158,11,.4)">${t("sostienilo su GitHub Sponsors", "support it on GitHub Sponsors")}</span>
  </div>

  ${didascalia([
    {
      t: 2.4,
      t2: 6.2,
      testo: t(
        "Un indirizzo da incollare, e un QR code da inquadrare.",
        "One address to paste, and one QR code to scan.",
      ),
    },
    { t: 6.4, testo: "<b>github.com/danigio15/gdahomeapp</b>" },
  ])}`,
);

/* Il palco, e cosa vede chi filma: sta in `pezzi.js`, perche' e' identico
   nei due film. */
mettiInScena(SCENE);
