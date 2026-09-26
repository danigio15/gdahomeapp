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
import { mettiInScena, oggetto, segno, t, telefono } from "./pezzi.js";

misuraIlPalco();

/* Il marchio di gdanav: quello vero, quello che sta dentro l'app
   (`ponte/app/assets/packages/gdanav_app/`). */
const GDANAV = "../../ponte/app/assets/packages/gdanav_app/assets/logo/gdanav.png";

/* ── Le schermate ─────────────────────────────────────────────────────────
 *
 * Sono **vere**: non disegni, non finte. Le scatta l'attrezzo dell'app
 *
 *   cd app && flutter test --update-goldens test/foto/unione_foto.dart
 *
 * che monta gli schermi veri — la barra, il menu, gdanav, i comandi in auto —
 * e li fotografa a 1170×2532. Finiscono in `collaudo/foto/unione/`, che la
 * repository non tiene: si rifanno con quel comando.
 *
 * L'unica cosa disegnata e' la **mappa**: e' nativa (MapLibre) e su un banco
 * di prova non c'e', quindi al suo posto gdanav disegna delle strade. Tutto
 * il resto di quello schermo — la ricerca, le mete, la scheda dell'auto — e'
 * quello che si vede sul telefono.
 */
const SCHERMATE = "../../collaudo/foto/unione";

/* Le fotografie sono 1170×2532: dentro una cornice larga 314 lo schermo viene
   alto 680, e la cornice 702. Da li' si scala. */
const unTelefono = (quale, alto) => `
  <div style="flex:0 0 auto">
    ${telefono({
      alto: 702,
      scala: alto / 702,
      barra: false,
      dentro: `<img src="${SCHERMATE}/${quale}.png" alt=""
                  style="display:block;width:100%;height:100%;object-fit:fill" />`,
    })}
  </div>`;

/* Quanto e' alto il telefono.
 *
 * Non «il piu' grande che ci sta»: il piu' grande che ci sta **insieme al
 * titolo e alla riga sotto**. Chiesto piu' alto, la sua scatola si stringe ma
 * il disegno no — il telefono e' un elemento flessibile come gli altri — e la
 * didascalia gli finisce sopra. Per questo sta in un involucro che non si
 * lascia stringere, e l'altezza e' contata su quello che resta. */
const ALTO = Number(new URLSearchParams(location.search).get("alto") || 1920);
const IN_PIEDI = ALTO > 1400;
const TELEFONO = IN_PIEDI ? 720 : 560;

/* Una carta con dentro una schermata.
 *
 * Su un palco quadrato di posto ce n'e' la meta': li' restano il titolo e la
 * fotografia, e l'occhiello e la riga sotto se ne vanno. Non e' una perdita —
 * il titolo dice gia' cosa si sta guardando — mentre una fotografia
 * rimpicciolita per far stare due righe di contorno non si legge piu', e una
 * schermata che non si legge tanto vale non metterla. */
const conLaSchermata = ({ occhiello, tinta, titolo, foto, sotto }) => `
  ${IN_PIEDI ? `<p class="occhiello" style="color:${tinta}">${occhiello}</p>` : ""}
  <h2 class="titolone piccolo">${titolo}</h2>
  ${unTelefono(foto, TELEFONO)}
  ${IN_PIEDI ? `<p class="sottotitolone" style="font-size:34px">${sotto}</p>` : ""}`;

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

  /* ── il navigatore, fotografato ─────────────────────────────────────── */
  {
    resta: 3.6,
    dentro: () =>
      conLaSchermata({
        occhiello: t("Nell'app", "In the app"),
        tinta: "#7dd3fc",
        titolo: t("Il navigatore,<br />dentro gdahome", "The navigator,<br />inside gdahome"),
        foto: "domani-gdanav",
        sotto: t(
          "In auto è quello che si apre salendo.",
          "In the car, it's what opens when you get in.",
        ),
      }),
  },

  /* ── l'auto, fotografata ────────────────────────────────────────────── */
  {
    resta: 3.6,
    dentro: () =>
      conLaSchermata({
        occhiello: t("L'auto", "Your car"),
        tinta: "#86efac",
        titolo: t("La tua auto<br />è già dentro", "Your car<br />is already in"),
        foto: "domani-gdanav-fonte",
        sotto: t(
          "Dalla plancia, in tempo reale. <b>Nessun codice, nessun QR.</b>",
          "From the dashboard, in real time. <b>No code, no QR.</b>",
        ),
      }),
  },

  /* ── i comandi, fotografati ─────────────────────────────────────────── */
  {
    resta: 3.6,
    dentro: () =>
      conLaSchermata({
        occhiello: t("Comandi", "Controls"),
        tinta: "#fcd34d",
        titolo: t("I comandi di casa,<br />sulla mappa", "Your home's controls,<br />on the map"),
        foto: "domani-comandi",
        sotto: t(
          "Fino a dodici tasti, premuti guidando.",
          "Up to twelve buttons, pressed while driving.",
        ),
      }),
  },

  /* ── la tessera nel menu ────────────────────────────────────────────── */
  {
    resta: 3.6,
    dentro: () =>
      conLaSchermata({
        occhiello: t("Nel menu", "In the menu"),
        tinta: "#7dd3fc",
        titolo: t("Sempre sott'occhio", "Always in sight"),
        foto: "domani-menu",
        sotto: t(
          "Batteria, chilometri, e due tasti: <b>a casa</b> o <b>al lavoro</b>.",
          "Battery, kilometres, and two buttons: <b>home</b> or <b>work</b>.",
        ),
      }),
  },

  /* ── quasi a casa  /* ── quasi a casa ───────────────────────────────────────────────────── */
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
