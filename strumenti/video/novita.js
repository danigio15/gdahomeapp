/* Le novità di una versione, in mezzo minuto.
 *
 * Un film di servizio: esce a ogni versione che porta cose nuove, e dice
 * quelle. Non spiega cos'e' gdahome — quello lo fanno gli altri due — quindi
 * niente introduzione: la prima carta e' gia' il numero della versione, e la
 * seconda e' gia' una novita'.
 *
 * **Tutto in dissolvenza.** Le carte stanno una sopra l'altra (`novita.html`)
 * e si passano il testimone sovrapponendosi: mentre una svanisce, l'altra e'
 * gia' a meta' strada. Un film di sole scritte che sbattono da una all'altra
 * stanca in dieci secondi; le stesse scritte che si sciolgono l'una
 * nell'altra si guardano fino in fondo.
 *
 * I tempi non si scrivono a mano: ogni carta dice **quanto resta**, e da li'
 * si contano l'inizio e la fine di tutte. Cambiare una durata in mezzo non
 * costringe a rifare i conti di quelle dopo.
 */

import { MARCHIO, mettiInScena, oggetto, segno, STILI, t } from "./pezzi.js";

/* Il palco, come per i social: quadrato per il feed, in piedi per TikTok. */
const misure = new URLSearchParams(location.search);
const dimmi = (nome, difetto) => misure.get(nome) ?? difetto;
const radice = document.documentElement.style;
radice.setProperty("--alto", `${dimmi("alto", 1920)}px`);
radice.setProperty("--su", `${dimmi("su", 90)}px`);
radice.setProperty("--giu", `${dimmi("giu", 90)}px`);

/* Quanto dura una dissolvenza, e di quanto le due carte si sovrappongono.
 *
 * Mezzo secondo e' la misura che si sente come «sfuma» invece che come
 * «cambia»; un quarto di sovrapposizione e' quello che toglie il buio in
 * mezzo senza che le due scritte si leggano insieme. */
const DISSOLVENZA = 0.55;
const SOVRAPPOSTE = 0.3;

/* Il respiro: la carta cresce di un filo mentre sta su. Fermo, un testo
   grande sembra una diapositiva; cosi' sembra ripreso. */
STILI.push(`@keyframes respiro{from{transform:scale(1)}to{transform:scale(1.045)}}`);

/* La barra che avanza: quanto manca alla fine, senza numeri. */
STILI.push(`@keyframes avanza{from{width:0}to{width:100%}}`);

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

/* ── I tempi ──────────────────────────────────────────────────────────────
 *
 * Ogni carta comincia a comparire mentre quella prima sta ancora svanendo: il
 * suo inizio e' la fine della precedente **meno** la sovrapposizione. Contati
 * qui una volta, invece che scritti a mano nove volte. */
let orologio = 0;
const CONTENUTO = CARTE.map(({ resta, dentro }) => {
  const da = orologio;
  const viaA = da + DISSOLVENZA + resta;
  orologio = viaA + DISSOLVENZA - SOVRAPPOSTE;
  return `
    <div class="carta-novita" style="
         opacity:0;
         animation:appari ${DISSOLVENZA}s ${da}s ease both,
                   sparisci ${DISSOLVENZA}s ${viaA}s ease forwards,
                   respiro ${(viaA - da + DISSOLVENZA).toFixed(2)}s ${da}s linear both">
      ${dentro()}
    </div>`;
}).join("");

/* Un attimo di coda dopo l'ultima dissolvenza: un film che finisce sull'ultimo
   fotogramma della sfumatura sembra tagliato. */
const DURATA = Number((orologio + SOVRAPPOSTE + 0.4).toFixed(2));

/* La testata e la barra stanno su dalla seconda carta all'ultima: sulla prima
   il numero e' gia' grande in mezzo allo schermo, e sull'ultima c'e' di nuovo.
   Ripeterlo li' sarebbe dirlo due volte nello stesso fotogramma. */
const ENTRA_LA_TESTATA = Number((CARTE[0].resta + DISSOLVENZA).toFixed(2));
const ESCE_LA_TESTATA = Number((DURATA - CARTE[CARTE.length - 1].resta - 1).toFixed(2));

const CORNICE = `
  <div class="testata ap via" style="--t:${ENTRA_LA_TESTATA}s;--t2:${ESCE_LA_TESTATA}s">
    <img src="${MARCHIO}" width="44" height="44" style="border-radius:12px" alt="" />
    <span>gdahome <b>1.6.0</b></span>
  </div>
  <div class="barra ap via" style="--t:${ENTRA_LA_TESTATA}s;--t2:${ESCE_LA_TESTATA}s">
    <div style="animation:avanza ${(ESCE_LA_TESTATA - ENTRA_LA_TESTATA).toFixed(2)}s ${ENTRA_LA_TESTATA}s linear both"></div>
  </div>`;

mettiInScena([{ nome: "novita", durata: DURATA, contenuto: () => CONTENUTO + CORNICE }]);
