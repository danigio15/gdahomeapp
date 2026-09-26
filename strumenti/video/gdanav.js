/* gdanav, il navigatore dentro gdahome: la presentazione.
 *
 * Mezzo minuto per dire quattro cose e una data: cos'è, che l'auto ci arriva
 * da sola, che i comandi di casa si premono dalla mappa, che avvicinandosi a
 * casa lo propone lui — e che a breve arriva sui negozi, a pagamento.
 *
 * Quello che c'è scritto qui viene dalle note della 1.6.9
 * (`ponte/CHANGELOG.md`), detto come lo si direbbe a voce: cosa fa, in una
 * riga. Niente numeri inventati — il prezzo non c'è perché non è deciso, e
 * scriverne uno qui sarebbe un impegno preso da un video.
 */

import { inDissolvenza, misuraIlPalco } from "./dissolvenza.js";
import { mettiInScena, oggetto, segno, t } from "./pezzi.js";

misuraIlPalco();

/* Il marchio di gdanav: quello vero, quello che sta dentro l'app
   (`ponte/app/assets/packages/gdanav_app/`). */
const GDANAV = "../../ponte/app/assets/packages/gdanav_app/assets/logo/gdanav.png";

const bollo = (disegno, tinta) => `
  <div class="disegno vetro" style="border-color:${tinta}55;background:${tinta}1c">
    ${oggetto(disegno, 72)}
  </div>`;

const CARTE = [
  /* ── chi è ──────────────────────────────────────────────────────────── */
  {
    resta: 2.9,
    dentro: () => `
      <img class="marchio-gdanav" src="${GDANAV}" width="180" height="180" alt="" />
      <h2 class="titolone">gdanav</h2>
      <p class="sottotitolone">${t(
        "Il navigatore per l'auto elettrica, <b>dentro gdahome</b>.",
        "The navigator for your electric car, <b>inside gdahome</b>.",
      )}</p>`,
  },

  /* ── in macchina ────────────────────────────────────────────────────── */
  {
    resta: 3.2,
    dentro: () => `
      ${bollo("macchine", "#38bdf8")}
      <p class="occhiello" style="color:#7dd3fc">${t("In auto", "In the car")}</p>
      <h2 class="titolone">${t("In Android Auto<br />parte lui", "On Android Auto<br />it starts up")}</h2>
      <p class="sottotitolone">${t(
        "La mappa davanti, e la casa dietro un tasto. Sul telefono è una voce del menu di gdahome: <b>niente da installare in più</b>.",
        "The map up front, your home behind one button. On the phone it's an item in the gdahome menu: <b>nothing extra to install</b>.",
      )}</p>`,
  },

  /* ── l'auto ─────────────────────────────────────────────────────────── */
  {
    resta: 3.2,
    dentro: () => `
      ${bollo("ev", "#4ade80")}
      <p class="occhiello" style="color:#86efac">${t("L'auto", "Your car")}</p>
      <h2 class="titolone">${t("La tua auto<br />è già dentro", "Your car<br />is already in")}</h2>
      <p class="sottotitolone">${t(
        "Batteria, autonomia, ricarica e posizione arrivano dalla sezione Auto della plancia, in tempo reale. <b>Nessun codice, nessun QR.</b>",
        "Battery, range, charging and position come from the dashboard's Car section, in real time. <b>No code, no QR.</b>",
      )}</p>`,
  },

  /* ── i comandi ──────────────────────────────────────────────────────── */
  {
    resta: 3.2,
    dentro: () => `
      ${bollo("azioni", "#fbbf24")}
      <p class="occhiello" style="color:#fcd34d">${t("Comandi", "Controls")}</p>
      <h2 class="titolone piccolo">${t("I comandi di casa,<br />sulla mappa", "Your home's controls,<br />on the map")}</h2>
      <p class="sottotitolone">${t(
        "Fino a dodici tasti: cancello, luci, scene, serrature. <b>Li scegli sul telefono e li premi guidando</b>, con la conferma dove serve.",
        "Up to twelve buttons: gate, lights, scenes, locks. <b>You pick them on the phone and press them while driving</b>, with a confirmation where it matters.",
      )}</p>`,
  },

  /* ── quasi a casa ───────────────────────────────────────────────────── */
  {
    resta: 3.2,
    dentro: () => `
      ${bollo("varchi", "#a78bfa")}
      <p class="occhiello" style="color:#c4b5fd">${t("All'arrivo", "On arrival")}</p>
      <h2 class="titolone">${t("«Quasi a casa»", "«Almost home»")}</h2>
      <p class="sottotitolone">${t(
        "Avvicinandoti, l'auto propone il comando che hai scelto — il cancello, il garage — con <b>«Fallo» o «Non ora»</b>. La distanza la decidi tu.",
        "As you get close, the car offers the control you chose — the gate, the garage — with <b>«Do it» or «Not now»</b>. You set the distance.",
      )}</p>`,
  },

  /* ── quando, e a che condizioni ─────────────────────────────────────── */
  {
    resta: 3.8,
    dentro: () => `
      <p class="occhiello" style="color:#fcd34d">${t("Disponibilità", "Availability")}</p>
      <h2 class="titolone">${t("A breve su<br />Android e iOS", "Coming soon to<br />Android and iOS")}</h2>
      <p class="sottotitolone">${t(
        "gdanav arriva su Google Play e su App Store. <b>Sarà un'app a pagamento.</b>",
        "gdanav is coming to Google Play and the App Store. <b>It will be a paid app.</b>",
      )}</p>
      <div style="display:flex;gap:16px;margin-top:6px">
        <span class="riga-finale vetro" style="font-size:30px;border-color:rgba(56,189,248,.45);color:#cfe0f5">
          ${segno("telefono", 26, "#7dd3fc")} Android
        </span>
        <span class="riga-finale vetro" style="font-size:30px;border-color:rgba(56,189,248,.45);color:#cfe0f5">
          ${segno("telefono", 26, "#7dd3fc")} iOS
        </span>
      </div>`,
  },

  /* ── la chiusura ────────────────────────────────────────────────────── */
  {
    resta: 3.2,
    dentro: () => `
      <img class="marchio-gdanav" src="${GDANAV}" width="150" height="150" alt="" />
      <h2 class="titolone piccolo">${t("gdanav, dentro gdahome", "gdanav, inside gdahome")}</h2>
      <p class="sottotitolone">${t(
        "La casa e l'auto nella stessa app.",
        "Your home and your car in the same app.",
      )}</p>
      <div class="riga-finale vetro" style="border-color:rgba(14,165,233,.45);color:#e6f2ff;font-family:'DejaVu Sans Mono',monospace">
        gdahome.org
      </div>`,
  },
];

const { contenuto, durata } = inDissolvenza(CARTE, {
  testata: "<b>gdanav</b> · dentro gdahome",
  marchio: GDANAV,
});

mettiInScena([{ nome: "gdanav", durata, contenuto: () => contenuto }]);
