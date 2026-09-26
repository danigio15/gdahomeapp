/* Le novità di una versione, in mezzo minuto.
 *
 * Un film di servizio: esce a ogni versione che porta cose nuove, e dice
 * quelle. Non spiega cos'e' gdahome — quello lo fanno gli altri due — quindi
 * niente introduzione: la prima carta e' gia' il numero della versione, e la
 * seconda e' gia' una novita'.
 *
 * **Tutto in dissolvenza**: le carte stanno una sopra l'altra e si passano il
 * testimone sovrapponendosi. Come funziona sta in `dissolvenza.js`; qui c'e'
 * solo cosa dicono le carte, e quanto restano su.
 */

import { inDissolvenza, misuraIlPalco } from "./dissolvenza.js";
import { MARCHIO, mettiInScena, oggetto, segno, t } from "./pezzi.js";

misuraIlPalco();

/* ── Le carte ─────────────────────────────────────────────────────────────
 *
 * Quello che c'e' scritto qui viene dalle note della versione
 * (`ponte/CHANGELOG.md`), ma **non con le stesse parole**. Le note sono un
 * racconto e possono permetterselo; un video di trenta secondi no: chi guarda
 * ha due secondi per capire cosa fa una cosa nuova, e una frase da leggere due
 * volte e' una frase persa.
 *
 * Quindi qui si dice **cosa fa**, in una riga, con le parole che si userebbero
 * spiegandolo a voce: niente metafore, niente giri. Se una frase qui dice piu'
 * di quello che la versione fa, il video sta mentendo.
 */

const bollo = (disegno, tinta) => `
  <div class="disegno vetro" style="border-color:${tinta}55;background:${tinta}1c">
    ${oggetto(disegno, 72)}
  </div>`;

const CARTE = [
  /* ── l'apertura: il numero, e basta ─────────────────────────────────── */
  {
    resta: 2.5,
    dentro: () => `
      <img src="${MARCHIO}" width="150" height="150" style="border-radius:38px" alt="" />
      <p class="occhiello" style="color:#7dd3fc">${t("gdahome", "gdahome")}</p>
      <p class="versione">1.6.0</p>
      <p class="sottotitolone">${t("Cosa c'è di nuovo", "What's new")}</p>`,
  },

  /* ── Zigbee dall'app ────────────────────────────────────────────────── */
  {
    resta: 3.1,
    dentro: () => `
      ${bollo("prese", "#38bdf8")}
      <p class="occhiello" style="color:#7dd3fc">${t("Nuovo", "New")}</p>
      <h2 class="titolone">${t("Abbini i dispositivi<br />Zigbee dall'app", "Pair Zigbee devices<br />from the app")}</h2>
      <p class="sottotitolone">${t(
        "Senza aprire Home Assistant. Funziona con ZHA e Zigbee2MQTT, e <b>alla fine scegli in quale sezione mostrarlo</b>.",
        "Without opening Home Assistant. It works with ZHA and Zigbee2MQTT, and <b>at the end you choose which section it goes in</b>.",
      )}</p>`,
  },

  /* ── il volto o l'impronta ──────────────────────────────────────────── */
  {
    resta: 3.1,
    dentro: () => `
      ${bollo("sicurezza", "#4ade80")}
      <p class="occhiello" style="color:#86efac">${t("Nuovo", "New")}</p>
      <h2 class="titolone">${t("Sblocco con volto<br />o impronta", "Unlock with face<br />or fingerprint")}</h2>
      <p class="sottotitolone">${t(
        "Puoi proteggere l'app con il riconoscimento del telefono. <b>I dati biometrici restano sul dispositivo</b>, l'app riceve solo un sì o un no.",
        "You can protect the app with your phone's biometrics. <b>The biometric data stays on the device</b>; the app only gets a yes or a no.",
      )}</p>`,
  },

  /* ── l'energia a fasce ──────────────────────────────────────────────── */
  {
    resta: 3.1,
    dentro: () => `
      ${bollo("energia", "#fbbf24")}
      <p class="occhiello" style="color:#fcd34d">${t("Energia", "Energy")}</p>
      <h2 class="titolone">${t("Tariffe a<br />fasce orarie", "Time-of-use<br />tariffs")}</h2>
      <p class="sottotitolone">${t(
        "Imposti due o tre fasce, ognuna con orario e prezzo. <b>Il costo del mese viene calcolato fascia per fascia</b> sui consumi reali.",
        "Set two or three bands, each with its hours and price. <b>The monthly cost is calculated band by band</b> from your real consumption.",
      )}</p>`,
  },

  /* ── a che ora compri ───────────────────────────────────────────────── */
  {
    resta: 3.1,
    dentro: () => `
      ${bollo("agenda", "#a78bfa")}
      <p class="occhiello" style="color:#c4b5fd">${t("Energia · Analisi", "Energy · Analysis")}</p>
      <h2 class="titolone piccolo">${t("Consumi per<br />fascia oraria", "Consumption<br />by hour")}</h2>
      <p class="sottotitolone">${t(
        "Un grafico con le 24 ore del giorno mostra <b>quando prelevi più energia dalla rete</b>, e quanto ti costa ogni ora.",
        "A 24-hour chart shows <b>when you draw the most energy from the grid</b>, and what each hour costs you.",
      )}</p>`,
  },

  /* ── le stanze ──────────────────────────────────────────────────────── */
  {
    resta: 3.1,
    dentro: () => `
      ${bollo("stanze", "#38bdf8")}
      <p class="occhiello" style="color:#7dd3fc">${t("Stanze", "Rooms")}</p>
      <h2 class="titolone">${t("Stanze divise<br />per piano", "Rooms grouped<br />by floor")}</h2>
      <p class="sottotitolone">${t(
        "Ogni scheda mostra luci accese, prese, temperatura e aperture. <b>Spegni direttamente dall'elenco</b>, con una conferma prima.",
        "Each card shows lights on, sockets, temperature and openings. <b>Switch off straight from the list</b>, with a confirmation first.",
      )}</p>`,
  },

  /* ── chi non risponde ───────────────────────────────────────────────── */
  {
    resta: 3.1,
    dentro: () => `
      ${bollo("avvisi", "#fb7185")}
      <p class="occhiello" style="color:#fda4af">${t("Nuovo", "New")}</p>
      <h2 class="titolone">${t("Avviso dispositivi<br />non raggiungibili", "Offline device<br />warning")}</h2>
      <p class="sottotitolone">${t(
        "Quando un dispositivo smette di rispondere compare una scheda con <b>quali sono e da quanto tempo</b>. Sparisce quando tornano online.",
        "When a device stops responding, a card shows <b>which ones and for how long</b>. It disappears once they are back online.",
      )}</p>`,
  },

  /* ── le spicciole, tutte insieme ────────────────────────────────────── */
  {
    resta: 3.6,
    dentro: () => `
      <h2 class="titolone piccolo">${t("E poi", "And also")}</h2>
      <div class="spicciole">
        ${[
          [t("Serratura: apri, sblocca, chiudi", "Lock: open, unlock, lock"), "sicurezza"],
          [t("Comandi rapidi per ogni presa", "Quick controls for every socket"), "prese"],
          [t("Clima per singola stanza", "Climate per room"), "clima"],
          [t("Alette orizzontali del clima", "Horizontal louvres on climate"), "aria"],
          [t("Stato TV corretto, senza standby", "Correct TV state, no standby"), "media"],
          [t("Supporto friggitrice ad aria", "Air fryer support"), "elettrodomestici"],
        ]
          .map(([detto, disegno]) => `<div>${oggetto(disegno, 34)}<span>${detto}</span></div>`)
          .join("")}
      </div>
      <div class="riga-finale vetro" style="border-color:rgba(74,222,128,.45);color:#86efac;margin-top:10px">
        ${segno("spunta", 30, "#4ade80")} ${t("Avvio della plancia: 3 secondi invece di 13", "Dashboard start-up: 3 seconds instead of 13")}
      </div>`,
  },

  /* ── la chiusura ────────────────────────────────────────────────────── */
  {
    resta: 3.3,
    dentro: () => `
      <img src="${MARCHIO}" width="140" height="140" style="border-radius:34px" alt="" />
      <h2 class="titolone">${t("gdahome 1.6.0", "gdahome 1.6.0")}</h2>
      <p class="sottotitolone">${t(
        "Aggiorna l'add-on da Home Assistant: la nuova versione <b>arriva su tutti i telefoni abbinati</b>.",
        "Update the add-on from Home Assistant: the new version <b>reaches every paired phone</b>.",
      )}</p>
      <div class="riga-finale vetro" style="border-color:rgba(14,165,233,.45);color:#e6f2ff;font-family:'DejaVu Sans Mono',monospace">
        gdahome.org
      </div>
      <p class="sottotitolone" style="font-size:32px">${t(
        "Gratis, come sempre.",
        "Free, as always.",
      )}</p>`,
  },
];

const { contenuto, durata } = inDissolvenza(CARTE, {
  testata: "gdahome <b>1.6.0</b>",
});

mettiInScena([{ nome: "novita", durata, contenuto: () => contenuto }]);
