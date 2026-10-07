/* La pagina dei lettori multimediali (#269).
 *
 * «Sarebbe carino una sezione dedicata ai dispositivi Media Player… sarebbe
 * figo se lo sfondo fosse l'anteprima di ciò che viene riprodotto (la
 * copertina del disco).»
 *
 * Un lettore è l'unica cosa della casa che ha una faccia sua, e la faccia la
 * manda Home Assistant: la copertina del disco. Qui è lei a fare la card —
 * grande e sfocata dietro, netta e quadrata davanti — e il resto ci sta sopra.
 * Le altre pagine disegnano quello che raccontano; questa lo mostra e basta.
 *
 * I tasti che compaiono sono quelli che il lettore sa eseguire davvero: Home
 * Assistant lo dice in `supported_features`, e disegnare «brano precedente»
 * su una radio vorrebbe dire un tasto che non fa niente — che da fuori è un
 * tasto rotto.
 *
 * La voce nella barra compare solo quando un lettore è configurato: portare a
 * una pagina vuota è peggio che non offrirla.
 */
import {
  CHIAVE_MEDIA,
  comandoDelLettore,
  ilTastoCentrale,
  letturaDelLettore,
  lettureDeiLettori,
  lettoriConfigurati,
  orologio,
  posizioneOra,
} from "../core/media-player.js";
import {
  ilComandoPerSuonare,
  ilFiloDallaRadice,
  ilFiloDopo,
  ilFiloFinoA,
  ilPassoDiAdesso,
  laCartella,
  laDomandaPerSfogliare,
} from "../core/sfoglia-i-media.js";
import { comandoDelDispositivo } from "../core/comandi-accanto.js";
import { disegnoDelCatalogo } from "../core/catalogo-disegni.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import {
  comandoDelTelecomando,
  entitaDaRiconoscere,
  tastiDelTelecomando,
} from "../core/telecomando.js";
import {
  EVENTO_PIATTAFORME,
  piattaformeConosciute,
  scopriLePiattaforme,
} from "./di-chi-e-unentita-section.js";
import { registraPaginaARuntime, renderPageMastheads } from "./page-masthead-section.js";
import {
  activeLocale,
  allStates,
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  t,
} from "./shared.js";
import { segnoDaValoreHtml } from "../core/segni-del-catalogo.js";

const KEY = "__DASHBOARDMODERN_MEDIA_PLAYER__";
const STYLE_ID = "dm-media-player-style";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  firma: "",
  battito: 0,
  aperto: "",
  sfoglia: null,
});

export const MEDIA_TAB = "media";
export const PAGINA_MEDIA = "page-media";

export { CHIAVE_MEDIA };

/* ── cosa c'è da guardare ─────────────────────────────────────────────── */

function configurazione() {
  return readJson(CHIAVE_MEDIA, []);
}

function funzioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[MEDIA_TAB] === false);
}

function letture() {
  return lettureDeiLettori(
    configurazione(),
    allStates(),
    root.resolveEntity || ((v) => v),
    piattaformeConosciute(),
  );
}

/* Di che integrazione sono le TV e i loro telecomandi (#132).
 *
 * Il nome dei tasti lo decide l'integrazione, e lo stato di un'entità non la
 * dice: la sa il registro di Home Assistant, e la domanda è quella che la
 * pagina Server fa già per le sue macchine — una volta per entità, e la
 * risposta si tiene. Qui si chiedono solo i lettori e i loro telecomandi.
 *
 * E si chiedono solo quando Home Assistant li ha già mandati: prima degli
 * stati la presa non è ancora aperta, e la domanda cadrebbe nel vuoto. Chi
 * non ha avuto risposta si richiede non prima di un minuto: un filo che cade
 * non deve diventare una domanda a ogni cambio di stato della casa. */
const RICHIEDI_DOPO_MS = 60 * 1000;

function imparaLeTv(voci) {
  const chieste = (state.chieste ||= new Map());
  const conosciute = piattaformeConosciute();
  const states = allStates();
  const adesso = Date.now();
  const risolvi = (valore) => {
    try {
      return clean(root.resolveEntity?.(valore) || valore);
    } catch (_errore) {
      return clean(valore);
    }
  };
  const risolte = voci.map((voce) => ({
    entity: risolvi(voce?.entity),
    telecomando: voce?.telecomando ? risolvi(voce.telecomando) : "",
  }));
  const mancanti = entitaDaRiconoscere(risolte, states).filter(
    (entity) =>
      states?.[entity] &&
      !(entity in conosciute) &&
      adesso - (chieste.get(entity) || 0) > RICHIEDI_DOPO_MS,
  );
  if (!mancanti.length) return;
  for (const entity of mancanti) chieste.set(entity, adesso);
  scopriLePiattaforme(mancanti);
}

/* ── la pagina e la sua voce nella barra ──────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

function ensurePagina() {
  if (!doc) return null;
  let pagina = doc.getElementById(PAGINA_MEDIA);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = PAGINA_MEDIA;
  pagina.innerHTML = `<div class="dm-mp-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

function apri(voce) {
  for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
  for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
  voce.classList.add("active");
  ensurePagina()?.classList.add("active");
  try {
    renderPageMastheads();
  } catch (_error) {}
  root.scrollTo?.({ top: 0, behavior: "instant" });
  schedule();
}

function ensureVoce() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${MEDIA_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = MEDIA_TAB;
  voce.id = `tab-${MEDIA_TAB}`;
  /* Questa e' una voce della barra, e il posto segue la regola della barra. */
  voce.innerHTML = `<span class="icon">${oggettoWidget("media", "", `nav-${MEDIA_TAB}`)}</span><span class="text">${esc(
    t("Musica", "Media"),
  )}</span>`;
  /* Dopo le Luci: la musica sta con le cose del salotto, non con gli impianti.
   * Se le Luci non ci sono, prima di Config invece che in fondo a caso. */
  const luci = barra.querySelector('.tab[data-tab="luci"]');
  const config = barra.querySelector('.tab[data-tab="config"]');
  if (luci) luci.after(voce);
  else if (config) config.before(voce);
  else barra.append(voce);
  voce.addEventListener("click", () => apri(voce));
  return voce;
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function sottotitolo(righe) {
  const suona = righe.filter((riga) => riga.suona).length;
  if (suona)
    return suona === 1
      ? t("1 in riproduzione", "1 playing")
      : `${suona} ${t("in riproduzione", "playing")}`;
  return t("Nessuno in riproduzione", "Nothing playing");
}

export function parolaDiStatoDelLettore(riga) {
  if (riga.muto) return t("Non risponde", "Not reporting");
  if (riga.suona) return t("In riproduzione", "Playing");
  if (riga.inPausa) return t("In pausa", "Paused");
  if (riga.spento) return t("Spento", "Off");
  return t("Fermo", "Idle");
}

/* Cosa sta suonando, in due righe: sopra il pezzo, sotto chi lo suona.
 *
 * Quando non c'è un titolo si dice la sorgente o l'applicazione — «Spotify»,
 * «Radio Deejay» — che è comunque un'informazione. Inventare «Sconosciuto»
 * non lo è. */
export function titoloDelLettore(riga) {
  return riga.titolo || riga.sorgente || riga.applicazione || parolaDiStatoDelLettore(riga);
}

export function sottoDelLettore(riga) {
  const pezzi = [riga.artista, riga.album].filter(Boolean);
  if (pezzi.length) return pezzi.join(" · ");
  if (riga.titolo && riga.applicazione) return riga.applicazione;
  /* Quando non c'e' niente in riproduzione il titolo e' gia' la parola di
   * stato: ripeterla qui sotto vorrebbe dire «Spento / Spento», che sembra un
   * errore di stampa. Meglio l'entita', che almeno dice quale cassa e'. */
  return riga.entity;
}

function tastoMarkup(riga, comando, etichetta, glifo, acceso = false) {
  return `<button type="button" class="dm-mp-tasto" data-dm-mp="${esc(comando)}"
    data-dm-mp-entity="${esc(riga.entity)}" data-acceso="${acceso}"
    aria-label="${esc(etichetta)}">${glifo}</button>`;
}

/* I glifi dei comandi: triangoli e barrette, disegnati qui e non presi da una
 * famiglia di simboli. Sono le forme che qualunque lettore ha da cinquant'anni
 * e non c'è niente da inventare — ma vanno disegnate, o su ogni telefono il
 * «play» sarebbe un triangolo diverso. */
const GLIFI = Object.freeze({
  precedente: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M18.5 6.4v11.2a.8.8 0 0 1-1.24.67l-8.4-5.6a.8.8 0 0 1 0-1.34l8.4-5.6a.8.8 0 0 1 1.24.67Z" fill="currentColor"/></svg>`,
  successivo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5.5v13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M5.5 6.4v11.2a.8.8 0 0 0 1.24.67l8.4-5.6a.8.8 0 0 0 0-1.34l-8.4-5.6a.8.8 0 0 0-1.24.67Z" fill="currentColor"/></svg>`,
  suona: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 4.9v14.2a.9.9 0 0 0 1.38.76l11-7.1a.9.9 0 0 0 0-1.52l-11-7.1a.9.9 0 0 0-1.38.76Z" fill="currentColor"/></svg>`,
  pausa: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.6" y="4.8" width="4.2" height="14.4" rx="1.6" fill="currentColor"/><rect x="13.2" y="4.8" width="4.2" height="14.4" rx="1.6" fill="currentColor"/></svg>`,
  spegni: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6v7.6" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><path d="M6.9 6.7a7.2 7.2 0 1 0 10.2 0" stroke="currentColor" stroke-width="2.1" fill="none" stroke-linecap="round"/></svg>`,
  /* Accendi e spegni portano lo stesso segno, perche' il segno
   * dell'alimentazione e' uno solo: quello che cambia e' cosa c'e' scritto
   * sotto le dita e cosa succede premendo. */
  accendi: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6v7.6" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><path d="M6.9 6.7a7.2 7.2 0 1 0 10.2 0" stroke="currentColor" stroke-width="2.1" fill="none" stroke-linecap="round"/></svg>`,
  muto: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.4h3.4L12 5.2v13.6L7.4 14.6H4Z" fill="currentColor"/><path d="m16 9.6 4.4 4.8M20.4 9.6 16 14.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  voce: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.4h3.4L12 5.2v13.6L7.4 14.6H4Z" fill="currentColor"/><path d="M15.6 9.2a4 4 0 0 1 0 5.6M18.3 6.8a7.6 7.6 0 0 1 0 10.4" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg>`,
  /* Sfogliare: una fila di righe con la nota in fondo. E' il segno delle
   * raccolte — una scaletta — e non la lente della ricerca, perche' qui non si
   * cerca per nome: si scende dentro quello che il lettore ha da offrire. */
  sfoglia: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.4 6.6h11.2M4.4 11h11.2M4.4 15.4h6.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19.4 8.6v7.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="17.5" cy="16.4" r="2" fill="currentColor"/></svg>`,
  /* Il volume un passo alla volta (#132): la cassa col meno e col piu'. */
  abbassa: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.6 9.4H7L11.6 5.2v13.6L7 14.6H3.6Z" fill="currentColor"/><path d="M15 12h5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>`,
  alza: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.6 9.4H7L11.6 5.2v13.6L7 14.6H3.6Z" fill="currentColor"/><path d="M15 12h5.4M17.7 9.3v5.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>`,
  /* Il telecomando (#132): le quattro frecce, indietro, la casa, il menu. */
  su: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 14.6 12 9.1l5.5 5.5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  giu: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 9.4 12 14.9l5.5-5.5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sinistra: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.6 6.5 9.1 12l5.5 5.5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  destra: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.4 6.5 14.9 12l-5.5 5.5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  indietro: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.6 4.6 10 9 14.4" stroke="currentColor" stroke-width="2.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.2 10h9.3a4.9 4.9 0 0 1 0 9.8H11" stroke="currentColor" stroke-width="2.1" fill="none" stroke-linecap="round"/></svg>`,
  home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.4 11.4 12 4.9l7.6 6.5" stroke="currentColor" stroke-width="2.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.8 9.8v9.3h10.4V9.8" stroke="currentColor" stroke-width="2.1" fill="none" stroke-linejoin="round"/><path d="M10.3 19.1v-4.6h3.4v4.6" stroke="currentColor" stroke-width="2.1" fill="none" stroke-linejoin="round"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
});

/* I comandi di un lettore, in una riga.
 *
 * Li disegna questo modulo e li ascolta questo modulo — il gestore sta sul
 * documento, non sulla pagina — cosi' gli stessi tasti funzionano anche dentro
 * la finestra della tessera in Home, che e' l'altro posto da cui si comanda la
 * musica. Un secondo disegno con un secondo gestore vorrebbe dire due modi di
 * mettere in pausa, e prima o poi due modi diversi. */
/* Come si chiama il tasto centrale, quando c'e'. Il nucleo dice quale dei tre
 * e', qui si scrive la parola e si sceglie il segno. */
const NOMI_DEL_CENTRO = {
  accendi: () => t("Accendi", "Turn on"),
  pausa: () => t("Pausa", "Pause"),
  suona: () => t("Riproduci", "Play"),
};

export function comandiMediaMarkup(riga) {
  /* Quale tasto centrale, o nessuno: il perche' sta in `ilTastoCentrale`.
   * Su un televisore che di pausa non ne ha, in mezzo alla fila non c'e'
   * niente — meglio del triangolo che chiamava un servizio che non fa nulla. */
  const centro = ilTastoCentrale(riga);
  return `<div class="dm-mp-comandi">
    ${riga.puo.precedente ? tastoMarkup(riga, "precedente", t("Brano precedente", "Previous track"), GLIFI.precedente) : ""}
    ${centro ? tastoMarkup(riga, "centro", NOMI_DEL_CENTRO[centro](), GLIFI[centro]) : ""}
    ${riga.puo.successivo ? tastoMarkup(riga, "successivo", t("Brano successivo", "Next track"), GLIFI.successivo) : ""}
    ${
      /* Scegliere cosa suonare, dove prima si poteva solo alzare il volume a
       * quello che suonava gia'. Il tasto c'e' solo se quel lettore sa
       * elencare la sua libreria E ricevere un brano: le due bandiere stanno
       * insieme in «puo.sfoglia», e il perche' e' scritto nel nucleo. */
      riga.puo.sfoglia
        ? tastoMarkup(riga, "sfoglia", t("Scegli cosa suonare", "Choose what to play"), GLIFI.sfoglia)
        : ""
    }
    ${riga.puo.spegni && !riga.spento ? tastoMarkup(riga, "spegni", t("Spegni", "Turn off"), GLIFI.spegni) : ""}
  </div>`;
}

function copertinaMarkup(riga) {
  if (riga.copertina)
    return `<img class="dm-mp-arte" alt="" aria-hidden="true" loading="lazy">
      <img class="dm-mp-fondo" alt="" aria-hidden="true" loading="lazy">`;
  return `<span class="dm-mp-arte dm-mp-arte-vuota" aria-hidden="true">${
    riga.icona ? segnoDaValoreHtml(riga.icona, { ripiego: "speaker" }) : oggettoWidget("media", "", `mp-${riga.entity}`)
  }</span>`;
}

function barraMarkup(riga) {
  const punto = posizioneOra(riga);
  if (!punto) return "";
  return `<div class="dm-mp-tempo">
    <span class="dm-mp-ora" data-dm-mp-ora>${esc(orologio(punto.secondi))}</span>
    <span class="dm-mp-barra"><i data-dm-mp-avanza style="transform:scaleX(${punto.quota.toFixed(
      4,
    )})"></i></span>
    <span class="dm-mp-ora">${esc(orologio(punto.durata))}</span>
  </div>`;
}

function volumeMarkup(riga) {
  /* Chi il volume lo sa solo alzare e abbassare — quasi tutte le TV (#132) —
   * ha i due tasti col meno e col piu', dove chi lo sa mettere a un numero ha
   * il cursore. Prima non aveva niente: il passo lo dichiarava, e la scheda
   * guardava solo il numero. Da spenta non ci sono, come il telecomando. */
  const aPassi = riga.puo.passiVolume && !riga.puo.volume && !riga.spento && !riga.muto;
  if (!riga.puo.volume && !riga.puo.muto && !aPassi) return "";
  const percento = Math.round((riga.volume ?? 0) * 100);
  return `<div class="dm-mp-volume">
    ${aPassi ? tastoMarkup(riga, "abbassa", t("Abbassa il volume", "Volume down"), GLIFI.abbassa) : ""}
    ${
      riga.puo.muto
        ? tastoMarkup(
            riga,
            "muto",
            riga.mutato ? t("Riattiva l'audio", "Unmute") : t("Silenzia", "Mute"),
            riga.mutato ? GLIFI.muto : GLIFI.voce,
            riga.mutato,
          )
        : ""
    }
    ${aPassi ? tastoMarkup(riga, "alza", t("Alza il volume", "Volume up"), GLIFI.alza) : ""}
    ${
      riga.puo.volume
        ? `<input type="range" class="dm-mp-slider" min="0" max="100" step="1"
             value="${percento}" data-dm-mp-volume="${esc(riga.entity)}"
             aria-label="${esc(t("Volume", "Volume"))}">
           <span class="dm-mp-percento" data-dm-mp-percento>${percento}%</span>`
        : ""
    }
  </div>`;
}

function sorgenteMarkup(riga) {
  if (!riga.puo.sorgente || riga.sorgenti.length < 2) return "";
  return `<label class="dm-mp-sorgente"><span>${esc(t("Sorgente", "Source"))}</span>
    <select data-dm-mp-sorgente="${esc(riga.entity)}">${riga.sorgenti
      .map(
        (nome) =>
          `<option value="${esc(nome)}"${nome === riga.sorgente ? " selected" : ""}>${esc(
            nome,
          )}</option>`,
      )
      .join("")}</select></label>`;
}

/* Quello che l'integrazione pubblica accanto al lettore (#451).
 *
 * «Le TV dove vanno messe?» Nella scheda dei lettori — ma una TV di
 * SmartThings porta con sé un interruttore per l'alimentazione, una tendina
 * per la sorgente, e dei sensori che dicono il canale, il volume, il consumo.
 * I comandi si toccano, le letture si guardano: due file, come sul robot. */
function comandiAccantoMarkup(riga) {
  const voci = Array.isArray(riga.comandi) ? riga.comandi : [];
  if (!voci.length) return "";
  const tendine = voci
    .filter((voce) => voce.genere === "tendina" && voce.opzioni.length)
    .map(
      (voce) =>
        `<label class="dm-mp-sorgente"><span>${esc(voce.name)}</span>
      <select data-dm-mp-tendina="${esc(voce.entity)}"${voce.available ? "" : " disabled"}>${voce.opzioni
        .map(
          (opzione) =>
            `<option value="${esc(opzione)}"${opzione === voce.scelta ? " selected" : ""}>${esc(opzione)}</option>`,
        )
        .join("")}</select></label>`,
    )
    .join("");
  const tasti = voci
    .filter((voce) => voce.genere !== "tendina")
    .map(
      (voce) =>
        `<button type="button" class="dm-mp-cmd" data-dm-mp-cmd="${esc(voce.entity)}"${
          voce.genere === "interruttore" ? ` aria-pressed="${voce.acceso === true}"` : ""
        }${voce.available ? "" : " disabled"}>${esc(voce.name)}</button>`,
    )
    .join("");
  return `${tendine}${tasti ? `<div class="dm-mp-cmds">${tasti}</div>` : ""}`;
}

function lettureAccantoMarkup(riga) {
  const voci = Array.isArray(riga.letture) ? riga.letture : [];
  if (!voci.length) return "";
  return `<div class="dm-mp-letture">${voci
    .map(
      (lettura) =>
        `<span class="dm-mp-lettura" data-dm-mp-lettura="${esc(lettura.entity)}" title="${esc(lettura.entity)}">
      ${lettura.disegno ? `<i aria-hidden="true">${disegnoDelCatalogo(lettura.disegno, 20)}</i>` : ""}
      <small>${esc(lettura.name)}</small><b>${esc(lettura.testo)}</b>
    </span>`,
    )
    .join("")}</div>`;
}

/* Il telecomando della TV (#132).
 *
 * «Sarebbe possibile usarle anche qua per spegnerle, accenderle ed usare il
 * loro telecomando virtuale se disponibile?» Sta sotto la card, largo quanto
 * lei: la croce con OK in mezzo, e sotto i tasti che una TV ha e una cassa no
 * — indietro, la schermata iniziale, il menu, i canali. Ci sono solo quelli
 * che l'integrazione di quella TV sa ricevere, e solo a TV accesa: il perche'
 * sta in `core/telecomando.js`.
 *
 * I tasti sono quelli della card, non una famiglia nuova: gli stessi quadrati
 * dei comandi del brano, e OK col colore del tasto in mezzo. */
const NOMI_DEI_TASTI = Object.freeze({
  su: () => t("Freccia su", "Arrow up"),
  giu: () => t("Freccia giù", "Arrow down"),
  sinistra: () => t("Freccia a sinistra", "Arrow left"),
  destra: () => t("Freccia a destra", "Arrow right"),
  ok: () => t("Conferma", "Confirm"),
  indietro: () => t("Indietro", "Back"),
  home: () => t("Schermata iniziale della TV", "TV home screen"),
  menu: () => t("Menu della TV", "TV menu"),
  canale_meno: () => t("Canale precedente", "Previous channel"),
  canale_piu: () => t("Canale successivo", "Next channel"),
});

/* «OK» e «CH» si scrivono cosi' su ogni telecomando del mondo, e cosi' restano. */
function segnoDelTasto(tasto) {
  if (tasto === "ok") return "OK";
  if (tasto === "canale_meno") return `<span class="dm-mp-ch">CH</span><b>−</b>`;
  if (tasto === "canale_piu") return `<span class="dm-mp-ch">CH</span><b>+</b>`;
  return GLIFI[tasto] || "";
}

function tastoDelTelecomando(riga, tasto) {
  const canale = tasto === "canale_meno" || tasto === "canale_piu";
  return `<button type="button" class="dm-mp-tasto${canale ? " dm-mp-tasto-ch" : ""}"
    data-dm-tele="${esc(tasto)}" data-dm-tele-lettore="${esc(riga.entity)}"
    aria-label="${esc(NOMI_DEI_TASTI[tasto]())}">${segnoDelTasto(tasto)}</button>`;
}

export function telecomandoMarkup(riga) {
  const tasti = new Set(tastiDelTelecomando(riga?.telecomando));
  if (!tasti.size) return "";
  const quali = (elenco) => elenco.filter((tasto) => tasti.has(tasto));
  const croce = quali(["su", "sinistra", "ok", "destra", "giu"]);
  const navigare = quali(["indietro", "home", "menu"]);
  const canali = quali(["canale_meno", "canale_piu"]);
  const tutti = (elenco) => elenco.map((tasto) => tastoDelTelecomando(riga, tasto)).join("");
  return `<div class="dm-mp-tele" data-dm-mp-tele="${esc(riga.entity)}">
    ${croce.length ? `<div class="dm-mp-croce">${tutti(croce)}</div>` : ""}
    ${
      navigare.length || canali.length
        ? `<div class="dm-mp-tele-fila">${tutti(navigare)}${
            canali.length ? `<span class="dm-mp-tele-canali">${tutti(canali)}</span>` : ""
          }</div>`
        : ""
    }
  </div>`;
}

/* Cosa deve cambiare perche' una card si rifaccia.
 *
 * Sta in una funzione sola perche' le card disegnate sono due: quelle della
 * pagina Musica e quella dentro la finestra di un lettore solo (#460). Due
 * elenchi di cose da guardare diventerebbero due elenchi diversi al primo
 * campo aggiunto, e una delle due card resterebbe indietro. */
function firmaDelLettore(riga) {
  return [
    riga.entity,
    riga.nome,
    riga.stato,
    riga.titolo,
    riga.artista,
    riga.album,
    riga.sorgente,
    riga.sorgenti.join("~"),
    riga.mutato,
    Math.round((riga.volume ?? 0) * 100),
    Math.round(riga.durata ?? 0),
    Boolean(riga.copertina),
    Object.values(riga.puo).join(""),
    /* Quello che sta accanto (#451): i comandi con la loro scelta, le letture
     * col loro numero. La card e' piccola e si rifa' intera, come gia' fa
     * quando cambia il brano. */
    (riga.comandi || [])
      .map(
        (voce) =>
          `${voce.entity}:${voce.name}:${voce.available}:${voce.acceso}:${voce.scelta}:${voce.opzioni.join("/")}`,
      )
      .join("+"),
    (riga.letture || []).map((lettura) => `${lettura.entity}:${lettura.testo}`).join("+"),
    /* Il telecomando (#132): compare quando si viene a sapere di che
     * integrazione e' la TV, e se ne va quando la TV si spegne. */
    riga.telecomando
      ? `${riga.telecomando.via}:${riga.telecomando.entity}:${riga.telecomando.piattaforma}`
      : "",
  ].join("|");
}

function cardMarkup(riga) {
  /* «Ha una copertina» sta scritto sulla card e non si deduce con `:has()`:
   * quella regola sui WebView di qualche telefono non c'e', e la card sarebbe
   * rimasta col testo scuro sopra il fondale scuro. */
  return `<article class="dm-mp-card" data-dm-mp-card="${esc(riga.entity)}"
    data-arte="${Boolean(riga.copertina)}"
    data-suona="${riga.suona}" data-muta="${riga.muto}" data-spento="${riga.spento}">
    <div class="dm-mp-arte-box">${copertinaMarkup(riga)}</div>
    <div class="dm-mp-testo">
      <span class="dm-mp-dove">${esc(riga.nome)}${
        riga.stato ? ` · ${esc(parolaDiStatoDelLettore(riga))}` : ""
      }</span>
      <strong class="dm-mp-titolo">${esc(titoloDelLettore(riga))}</strong>
      <span class="dm-mp-sotto">${esc(sottoDelLettore(riga))}</span>
      ${barraMarkup(riga)}
      ${comandiMediaMarkup(riga)}
      ${volumeMarkup(riga)}
      ${sorgenteMarkup(riga)}
      ${comandiAccantoMarkup(riga)}
      ${lettureAccantoMarkup(riga)}
    </div>
    ${telecomandoMarkup(riga)}
  </article>`;
}

/* La copertina si posa dopo, e solo quando cambia.
 *
 * L'indirizzo che manda Home Assistant è firmato e cambia a ogni brano: se lo
 * si riscrivesse a ogni giro di stati, il browser rifarebbe la richiesta e la
 * card lampeggerebbe fra un'immagine e la successiva uguale. */
function posaLeCopertine(nodo, righe) {
  for (const riga of righe) {
    const card = nodo.querySelector(`[data-dm-mp-card="${CSS.escape(riga.entity)}"]`);
    if (!card) continue;
    for (const arte of card.querySelectorAll("img.dm-mp-arte,img.dm-mp-fondo")) {
      if (!riga.copertina) continue;
      if (arte.dataset.dmMpSrc === riga.copertina) continue;
      arte.dataset.dmMpSrc = riga.copertina;
      arte.src = riga.copertina;
    }
  }
}

/* Il tempo che passa non lo manda nessuno.
 *
 * Home Assistant dice a che secondo era il brano quando l'ha misurato, e poi
 * tace finché non cambia qualcos'altro: senza un battito la barra resta ferma
 * su un pezzo che invece va avanti. Il battito c'è solo mentre questa pagina è
 * davanti e qualcosa sta suonando, e muore appena una delle due cose smette. */
function ferma() {
  if (state.battito) {
    root.clearInterval?.(state.battito);
    state.battito = 0;
  }
}

function batti(righe) {
  const aperta = state.aperto ? letturaDiUnLettore(state.aperto) : null;
  const serve =
    (paginaAperta() && righe.some((riga) => riga.suona && posizioneOra(riga))) ||
    Boolean(aperta?.suona && posizioneOra(aperta));
  if (!serve) {
    ferma();
    return;
  }
  if (state.battito) return;
  state.battito = root.setInterval?.(() => {
    if (!paginaAperta() && !state.aperto) {
      ferma();
      return;
    }
    avanzaIlTempo();
  }, 1000);
}

function avanzaIlTempo() {
  /* Le card disegnate sono in due posti: la pagina Musica e la finestra di un
   * lettore solo. La barra del tempo avanza in tutti e due, o nella finestra
   * resterebbe ferma su un brano che invece va avanti. */
  const dove = [
    doc?.querySelector?.(`#${PAGINA_MEDIA} .dm-mp-wrap`),
    doc?.getElementById?.(POPUP_ID),
  ].filter(Boolean);
  if (!dove.length) return;
  for (const riga of letture()) avanzaLaBarra(dove, riga);
  if (state.aperto) {
    const aperta = letturaDiUnLettore(state.aperto);
    if (aperta) avanzaLaBarra(dove, aperta);
  }
}

function avanzaLaBarra(dove, riga) {
  const punto = posizioneOra(riga);
  if (!punto) return;
  for (const nodo of dove) {
    const card = nodo.querySelector(`[data-dm-mp-card="${CSS.escape(riga.entity)}"]`);
    if (!card) continue;
    const ora = card.querySelector("[data-dm-mp-ora]");
    const avanza = card.querySelector("[data-dm-mp-avanza]");
    const scritto = orologio(punto.secondi);
    if (ora && ora.textContent !== scritto) ora.textContent = scritto;
    if (avanza) avanza.style.transform = `scaleX(${punto.quota.toFixed(4)})`;
  }
}

function paginaAperta() {
  return Boolean(doc?.getElementById?.(PAGINA_MEDIA)?.classList?.contains("active"));
}

export function renderMediaPlayer() {
  if (!doc) return false;
  const configurati = lettoriConfigurati(configurazione());
  const accesa = funzioneAccesa();
  const voce =
    configurati.length && accesa
      ? ensureVoce()
      : doc.querySelector(`.tab[data-tab="${MEDIA_TAB}"]`);
  if (voce) voce.style.display = configurati.length && accesa ? "" : "none";
  const pagina = configurati.length ? ensurePagina() : doc.getElementById(PAGINA_MEDIA);
  if (!pagina) return false;
  imparaLeTv(configurati);
  const righe = letture();
  registraPaginaARuntime(PAGINA_MEDIA, {
    /* Il viola e il rosa della musica: le uniche due tinte che nella plancia
     * non sono ancora di nessuno, ed è giusto così — questa pagina non parla
     * di corrente né di acqua. */
    tint: ["139,92,246", "236,72,153"],
    it: ["Musica", sottotitolo(righe)],
    en: ["Media", sottotitolo(righe)],
  });
  const nodo = pagina.querySelector(".dm-mp-wrap");
  if (!nodo) return false;
  const firma = [activeLocale(), ...righe.map(firmaDelLettore)].join("§");
  if (state.firma !== firma || !nodo.querySelector(".dm-mp-card")) {
    state.firma = firma;
    nodo.innerHTML = righe.length
      ? righe.map(cardMarkup).join("")
      : `<div class="dm-mp-vuoto">${esc(
          t("Nessun lettore configurato.", "No media player configured."),
        )}</div>`;
  }
  posaLeCopertine(nodo, righe);
  avanzaIlTempo();
  batti(righe);
  return true;
}

/* ── la finestra di un lettore solo (#460) ───────────────────────
 *
 * «Il lettore che ho messo fra le Azioni rapide mostra solo la copertina di
 * sfondo, il simbolo della cassa in mezzo e il nome dell'apparecchio. Dovrebbe
 * dire il brano, l'artista, e avere i tre puntini in alto a destra che aprono
 * una finestra con tutti i comandi.»
 *
 * I tre puntini aprono questa. E dentro non c'è un secondo lettore disegnato da
 * capo: c'è la STESSA card della pagina Musica, con i suoi comandi, il suo
 * volume, la sua sorgente e quello che l'integrazione pubblica accanto. Il
 * disegno è uno solo e chi lo ascolta è il gestore che sta sul documento,
 * quindi i tasti funzionano qui come funzionano di là — che è la ragione per
 * cui quel gestore sta sul documento e non sulla pagina.
 */
const POPUP_ID = "dm-mp-popup";

/**
 * La lettura di un lettore solo.
 *
 * Se quel lettore è fra quelli configurati si usa la sua voce — così la card
 * porta anche i comandi e le letture che gli sono stati messi accanto (#451);
 * se non lo è, si legge lo stesso, con quello che Home Assistant dice di lui.
 */
export function letturaDiUnLettore(entity, states = allStates()) {
  const cercato = clean(entity);
  if (!cercato) return null;
  const risolvi = root.resolveEntity || ((valore) => valore);
  const scritta = (valore) => {
    try {
      return clean(risolvi(valore) || valore);
    } catch (_errore) {
      return clean(valore);
    }
  };
  const voce = lettoriConfigurati(configurazione()).find(
    (riga) => scritta(riga.entity) === cercato,
  );
  return letturaDelLettore(voce || { entity: cercato }, states, risolvi, piattaformeConosciute());
}

function popupDelLettore() {
  if (!doc?.body) return null;
  const gia = doc.getElementById(POPUP_ID);
  if (gia) return gia;
  const host = doc.createElement("div");
  host.id = POPUP_ID;
  host.hidden = true;
  /* Fuori dalla card si chiude, come in tutte le altre finestre della
   * plancia: il tocco sul fondo è il gesto che tutti provano per primo. */
  host.addEventListener("click", (evento) => {
    if (evento.target === host || evento.target?.closest?.("[data-dm-mp-chiudi]"))
      chiudiIlLettore();
  });
  doc.body.append(host);
  return host;
}

/** Apre la finestra di un lettore. Torna `false` se non c'è niente da aprire. */
export function apriIlLettore(entity) {
  const riga = letturaDiUnLettore(entity);
  if (!riga) return false;
  state.aperto = riga.entity;
  return disegnaIlLettoreAperto();
}

/** Richiude la finestra. Torna `false` se non era aperta. */
export function chiudiIlLettore() {
  if (!state.aperto) return false;
  state.aperto = "";
  const host = doc?.getElementById?.(POPUP_ID);
  if (host) {
    host.hidden = true;
    host.innerHTML = "";
    delete host.dataset.dmMpFirma;
  }
  /* E chiudendo si rifa' il conto: se la pagina Musica non e' davanti, il
   * battito non ha piu' niente da far avanzare e si ferma subito invece di
   * arrivare al giro dopo. */
  batti(letture());
  return true;
}

/* Si ridisegna solo quando cambia qualcosa: la finestra resta aperta mentre il
 * brano va avanti, e riscriverla a ogni giro di stati vorrebbe dire strapparla
 * di sotto al dito di chi sta muovendo il volume. */
function disegnaIlLettoreAperto() {
  if (!state.aperto) return false;
  /* Una TV messa fra le Azioni rapide e non nella pagina Musica ha il suo
   * telecomando anche qui (#132): di lei si chiede come delle altre. */
  imparaLeTv([...lettoriConfigurati(configurazione()), { entity: state.aperto }]);
  const riga = letturaDiUnLettore(state.aperto);
  const host = popupDelLettore();
  if (!host || !riga) return chiudiIlLettore();
  const firma = `${activeLocale()}§${firmaDelLettore(riga)}`;
  if (host.dataset.dmMpFirma !== firma || !host.querySelector(".dm-mp-card")) {
    host.dataset.dmMpFirma = firma;
    host.innerHTML = `<div class="dm-mp-popup-box" role="dialog" aria-modal="true">
      <button type="button" class="dm-mp-popup-chiudi" data-dm-mp-chiudi
        aria-label="${esc(t("Chiudi", "Close"))}">✕</button>
      ${cardMarkup(riga)}
    </div>`;
  }
  if (host.hidden) host.hidden = false;
  posaLeCopertine(host, [riga]);
  /* Il tempo che passa non lo manda nessuno — sta scritto sopra `batti`, e
   * vale qui quanto nella pagina Musica. A rimettere in moto il battito fin
   * qui era il solo disegno di quella pagina: chi apre la finestra dai tre
   * puntini di un'azione rapida quella pagina non la sta guardando, e i
   * secondi e la barra restavano fermi su un brano che invece andava avanti,
   * finche' non passava di li' un evento di stato per tutt'altra ragione. */
  batti(letture());
  return true;
}

/* ── scegliere cosa suonare ────────────────────────────────────────────────
 *
 * «Con Sonos e Music Assistant, dalla plancia non si riesce a scegliere cosa
 * suonare.» Vero: la scheda Musica sapeva la pausa, il brano avanti, il
 * volume e la sorgente, e sono tutte cose che si fanno a qualcosa che
 * qualcun altro ha fatto partire. Per accendere la musica si prendeva un
 * altro telefono.
 *
 * Questa finestra e' l'albero che il lettore stesso dichiara — su Music
 * Assistant le playlist, gli artisti, le radio; su Sonos le stazioni e le
 * liste salvate — e si scende dentro come in una cartella. Il nucleo
 * «sfoglia-i-media.js» prepara le domande e mette in ordine le risposte;
 * qui c'e' solo il disegno, i tocchi, e il filo per risalire.
 *
 * Non e' disegnata dentro la card: una libreria dentro una tessera larga 280
 * punti sarebbe un elenco da due righe. E non si ridisegna col battito degli
 * stati, o l'elenco si strapperebbe di sotto al dito di chi sta scorrendo.
 */
const SFOGLIO_ID = "dm-sf-popup";

function sfoglio() {
  state.sfoglia ||= {
    entity: "",
    nome: "",
    filo: [],
    voci: [],
    carica: false,
    errore: "",
    nonMostrate: 0,
    /* A che domanda stiamo aspettando risposta: chi tocca due cartelle di
     * fila non deve vedersi arrivare il contenuto della prima. */
    giro: 0,
  };
  return state.sfoglia;
}

function finestraDelloSfoglio() {
  if (!doc?.body) return null;
  const gia = doc.getElementById(SFOGLIO_ID);
  if (gia) return gia;
  const host = doc.createElement("div");
  host.id = SFOGLIO_ID;
  host.hidden = true;
  host.addEventListener("click", (evento) => {
    if (evento.target === host || evento.target?.closest?.("[data-dm-sf-chiudi]"))
      chiudiLoSfoglio();
  });
  doc.body.append(host);
  return host;
}

/** Apre la finestra su un lettore. Torna «false» se non c'e' niente da aprire. */
export function apriLoSfoglio(entity) {
  const riga = letturaDiUnLettore(entity);
  /* Un lettore che non sa elencare niente non ha una libreria da aprire: il
   * tasto non c'e', e se ci si arriva da un'altra parte non si apre il vuoto. */
  if (!riga?.puo?.sfoglia) return false;
  const suo = sfoglio();
  suo.entity = riga.entity;
  suo.nome = riga.nome;
  suo.filo = ilFiloDallaRadice(t("Da ascoltare", "To play"));
  suo.voci = [];
  suo.errore = "";
  suo.nonMostrate = 0;
  chiediLaCartella();
  return true;
}

/** Richiude la finestra. Torna «false» se non era aperta. */
export function chiudiLoSfoglio() {
  if (!state.sfoglia?.entity) return false;
  state.sfoglia = null;
  const host = doc?.getElementById?.(SFOGLIO_ID);
  if (host) {
    host.hidden = true;
    host.innerHTML = "";
  }
  return true;
}

/* La domanda, e la risposta che arriva dopo.
 *
 * Il giro serve a una cosa sola: chi tocca una cartella e poi subito un'altra
 * riceve due risposte, e quella lenta puo' arrivare per ultima. Senza il giro
 * la finestra finirebbe col contenuto della cartella sbagliata, che e' la
 * peggiore delle bugie perche' sembra vera.
 */
async function chiediLaCartella() {
  const suo = sfoglio();
  const passo = ilPassoDiAdesso(suo.filo);
  const domanda = laDomandaPerSfogliare(suo.entity, { id: passo.id, tipo: passo.tipo });
  if (!domanda) return chiudiLoSfoglio();
  const giro = (suo.giro += 1);
  suo.carica = true;
  suo.errore = "";
  disegnaLoSfoglio();
  let risposta = null;
  let guaio = "";
  try {
    /* Dodici secondi e non otto: la libreria di Music Assistant sta su un
     * server che a sua volta interroga Spotify, e la prima apertura di una
     * casa grande ci mette piu' di un socket che risponde da solo. */
    risposta = await chiediAHomeAssistant(domanda, 12000);
  } catch (errore) {
    guaio = clean(errore?.message);
  }
  /* Un'altra cartella e' stata chiesta nel frattempo, o la finestra e' stata
   * chiusa e riaperta su un altro lettore: questa risposta non riguarda piu'
   * quello che si sta guardando. */
  if (suo.giro !== giro || state.sfoglia !== suo) return true;
  suo.carica = false;
  if (guaio) {
    suo.voci = [];
    suo.nonMostrate = 0;
    suo.errore = parolaDelGuaio(guaio);
  } else {
    const cartella = laCartella(risposta);
    suo.voci = cartella.voci;
    suo.nonMostrate = cartella.nonMostrate;
    suo.errore = "";
    /* Come si chiama la cartella lo dice Home Assistant, e lo dice solo
     * quando risponde: il nome del passo si scrive adesso, non prima. */
    const dove = ilPassoDiAdesso(suo.filo);
    if (cartella.titolo) dove.titolo = cartella.titolo;
  }
  disegnaLoSfoglio();
  return true;
}

/* Cosa e' andato storto, detto a chi guarda.
 *
 * Il messaggio di Home Assistant e' la sola spiegazione vera — «Media not
 * found», «Unknown media type» — e passa cosi' com'e'. Le tre parole che
 * inventa l'attrezzo del socket invece non dicono niente a nessuno, e quelle
 * si traducono. */
function parolaDelGuaio(guaio) {
  if (guaio === "timeout")
    return t("Il lettore non ha risposto.", "The player did not answer.");
  if (guaio === "socket" || guaio === "msgId")
    return t("Manca il collegamento a Home Assistant.", "No connection to Home Assistant.");
  return guaio || t("Non si riesce a leggere la libreria.", "The library cannot be read.");
}

/* I segni delle voci: una cartella, una nota, delle onde.
 *
 * Tre e non dodici. Home Assistant ha una «media_class» per ogni cosa —
 * album, artista, podcast, stagione, canale — e disegnarle tutte vorrebbe
 * dire dodici segni che nessuno impara. Quello che conta e' se la riga porta
 * altrove, se si ascolta, o se e' una cosa che trasmette e basta. */
const SEGNI_DELLE_VOCI = Object.freeze({
  cartella: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.6 7.4a2 2 0 0 1 2-2h3.1l1.8 2h8a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" fill="currentColor" opacity=".9"/></svg>`,
  nota: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.4 4.2v10.3" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><path d="M17.4 4.2c0 2.3 1.2 3 3 3.4" stroke="currentColor" stroke-width="2.1" fill="none" stroke-linecap="round"/><circle cx="14.6" cy="15.6" r="3.3" fill="currentColor"/></svg>`,
  onde: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.4" fill="currentColor"/><path d="M7.9 7.9a5.8 5.8 0 0 0 0 8.2M16.1 16.1a5.8 5.8 0 0 0 0-8.2M5.1 5.1a9.8 9.8 0 0 0 0 13.8M18.9 18.9a9.8 9.8 0 0 0 0-13.8" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`,
});

const CLASSI_CHE_TRASMETTONO = new Set(["channel", "podcast", "tv_show", "episode"]);

function segnoDellaVoce(voce) {
  if (voce.sfogliabile) return SEGNI_DELLE_VOCI.cartella;
  return CLASSI_CHE_TRASMETTONO.has(voce.classe)
    ? SEGNI_DELLE_VOCI.onde
    : SEGNI_DELLE_VOCI.nota;
}

/* Una miniatura dentro un «url()» di CSS, e non dentro un «img».
 *
 * Un «img» che non carica lascia l'icona rotta del browser; un fondo che non
 * carica non si vede, e sotto resta il segno della voce. Le miniature
 * arrivano da Spotify, da TuneIn, da chi le manda: una su venti non c'e'
 * piu'. Le virgolette e le parentesi si codificano, perche' sono le sole
 * cose che, dentro «url()», uscirebbero dal loro posto. */
function fondoDellaMiniatura(url) {
  const pulito = clean(url);
  if (!pulito) return "";
  return pulito.replace(/["'()\\\s]/g, (carattere) => encodeURIComponent(carattere));
}

function voceMarkup(voce, indice, puoAccodare) {
  const segno = segnoDellaVoce(voce);
  const fondo = fondoDellaMiniatura(voce.miniatura);
  const dove = voce.sfogliabile ? "apri" : "suona";
  return `<div class="dm-sf-voce">
    <button type="button" class="dm-sf-riga" data-dm-sf="${dove}" data-dm-sf-voce="${indice}">
      <span class="dm-sf-mini"${fondo ? ` style="background-image:url(${fondo})"` : ""}>${segno}</span>
      <span class="dm-sf-nome">${esc(voce.titolo)}</span>
      ${voce.sfogliabile ? `<span class="dm-sf-freccia" aria-hidden="true">›</span>` : ""}
    </button>
    ${
      /* Il triangolo accanto c'e' solo dove serve: una playlist si apre E si
       * suona, e senza il tasto a parte l'unico modo di farla partire intera
       * sarebbe entrarci e scegliere il primo brano. Su un artista, che si
       * apre e non si suona, il triangolo non compare. */
      voce.sfogliabile && voce.suonabile
        ? `<button type="button" class="dm-sf-tasto" data-dm-sf="suona" data-dm-sf-voce="${indice}"
            aria-label="${esc(t("Riproduci", "Play"))}">${GLIFI.suona}</button>`
        : ""
    }
    ${
      voce.suonabile && puoAccodare
        ? `<button type="button" class="dm-sf-tasto dm-sf-coda" data-dm-sf="coda" data-dm-sf-voce="${indice}"
            aria-label="${esc(t("Metti in coda", "Add to queue"))}">+</button>`
        : ""
    }
  </div>`;
}

function filoMarkup(filo) {
  if (filo.length < 2) return "";
  return `<nav class="dm-sf-filo" aria-label="${esc(t("Dove siamo", "Where we are"))}">${filo
    .map(
      (passo, indice) =>
        `${indice ? `<i aria-hidden="true">›</i>` : ""}<button type="button" data-dm-sf="filo"
          data-dm-sf-passo="${indice}"${indice === filo.length - 1 ? ` aria-current="true"` : ""}>${esc(
          passo.titolo || t("Da ascoltare", "To play"),
        )}</button>`,
    )
    .join("")}</nav>`;
}

function corpoDelloSfoglio(suo) {
  if (suo.carica)
    return `<p class="dm-sf-nota" role="status">${esc(t("Sto guardando…", "Looking…"))}</p>`;
  if (suo.errore)
    return `<p class="dm-sf-nota dm-sf-guaio" role="alert">${esc(suo.errore)}</p>`;
  if (!suo.voci.length)
    return `<p class="dm-sf-nota">${esc(t("Qui non c'è niente.", "Nothing here."))}</p>`;
  const puoAccodare = letturaDiUnLettore(suo.entity)?.puo?.accoda === true;
  return `<div class="dm-sf-elenco">${suo.voci
    .map((voce, indice) => voceMarkup(voce, indice, puoAccodare))
    .join("")}</div>${
    suo.nonMostrate ? `<p class="dm-sf-nota">${esc(quanteNeMancano(suo.nonMostrate))}</p>` : ""
  }`;
}

/* Quante voci sono rimaste fuori, al singolare quando e' una.
 *
 * «E altre 1 che non stanno in questo elenco» e' una frase che nessuno
 * scriverebbe, e si legge come un guasto del programma piu' che come
 * un'informazione. */
function quanteNeMancano(quante) {
  if (quante === 1)
    return t("E un'altra che non sta in questo elenco.", "And one more that does not fit this list.");
  return t(
    `E altre ${quante} che non stanno in questo elenco.`,
    `And ${quante} more that do not fit this list.`,
  );
}

function disegnaLoSfoglio() {
  const suo = state.sfoglia;
  if (!suo?.entity) return false;
  const host = finestraDelloSfoglio();
  if (!host) return false;
  const passo = ilPassoDiAdesso(suo.filo);
  host.innerHTML = `<div class="dm-sf-box" role="dialog" aria-modal="true"
    aria-label="${esc(t("Scegli cosa suonare", "Choose what to play"))}">
    <header class="dm-sf-testa">
      ${
        suo.filo.length > 1
          ? `<button type="button" class="dm-sf-tondo" data-dm-sf="filo"
              data-dm-sf-passo="${suo.filo.length - 2}"
              aria-label="${esc(t("Indietro", "Back"))}">‹</button>`
          : `<span class="dm-sf-tondo dm-sf-tondo-vuoto" aria-hidden="true">${GLIFI.sfoglia}</span>`
      }
      <span class="dm-sf-dove">
        <strong>${esc(passo.titolo || t("Da ascoltare", "To play"))}</strong>
        <small>${esc(suo.nome || suo.entity)}</small>
      </span>
      <button type="button" class="dm-sf-tondo" data-dm-sf-chiudi
        aria-label="${esc(t("Chiudi", "Close"))}">✕</button>
    </header>
    ${filoMarkup(suo.filo)}
    ${corpoDelloSfoglio(suo)}
  </div>`;
  if (host.hidden) host.hidden = false;
  return true;
}

/* Il tocco su una voce.
 *
 * Aprire cambia cartella; suonare chiude la finestra, perche' la commissione
 * e' finita e sotto c'e' la card che adesso dice quel brano; accodare la
 * lascia aperta, perche' chi mette in coda ne mette tre.
 */
function tocca(comando, nodo) {
  const suo = state.sfoglia;
  if (!suo?.entity) return;
  root.navigator?.vibrate?.(8);
  if (comando === "filo") {
    suo.filo = ilFiloFinoA(suo.filo, Number(nodo.dataset.dmSfPasso));
    chiediLaCartella();
    return;
  }
  const voce = suo.voci[Number(nodo.dataset.dmSfVoce)];
  if (!voce) return;
  if (comando === "apri") {
    suo.filo = ilFiloDopo(suo.filo, voce);
    chiediLaCartella();
    return;
  }
  const comandato = ilComandoPerSuonare(suo.entity, voce, comando === "coda" ? "coda" : "subito");
  if (!comandato) return;
  chiamaHa(comandato.domain, comandato.service, comandato.data);
  if (comando === "coda") {
    /* Il segno che e' andata: la coda non si vede da nessuna parte — ne' nella
     * card ne' nello stato — e un tasto che non risponde si preme due volte. */
    nodo.dataset.dmSfFatto = "1";
    root.setTimeout?.(() => delete nodo.dataset.dmSfFatto, 1400);
    return;
  }
  chiudiLoSfoglio();
}

/* ── i comandi ────────────────────────────────────────────────────────── */

async function chiamaHa(dominio, servizio, payload) {
  try {
    if (typeof root.dmCallHaService === "function")
      return await root.dmCallHaService(dominio, servizio, payload);
    if (typeof root.callService === "function")
      return await root.callService(dominio, servizio, payload);
    return await (root.hass || root._hass)?.callService?.(dominio, servizio, payload);
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] media player", errore);
    return undefined;
  }
}

/* Il lettore che sta sotto un tasto.
 *
 * Fra quelli configurati se c'e'; altrimenti si legge lo stesso. Dalla
 * finestra di un lettore solo (#460) si comanda anche una cassa messa fra le
 * Azioni rapide che nella scheda Musica non c'e', e li' dentro «non lo
 * conosco» finiva per voler dire «e' spento»: il tasto centrale chiamava
 * `turn_on` su una cassa che stava suonando, e il muto invertiva il nulla. */
function letturaDi(entity) {
  return letture().find((riga) => riga.entity === entity) || letturaDiUnLettore(entity);
}

/* Il comando accanto a cui appartiene quell'entità, come sta adesso. */
function comandoAccantoDi(entity) {
  for (const riga of letture())
    for (const voce of riga.comandi || []) if (voce.entity === entity) return voce;
  return null;
}

function onClick(event) {
  /* La finestra che sfoglia la libreria: sta prima di tutto, perche' quando e'
   * aperta i tocchi sono suoi. */
  const dentroLoSfoglio = event.target?.closest?.("[data-dm-sf]");
  if (dentroLoSfoglio) {
    event.preventDefault();
    tocca(clean(dentroLoSfoglio.dataset.dmSf), dentroLoSfoglio);
    return;
  }
  /* Un comando accanto (#451): si preme, si accende o si inverte, secondo cosa
   * è. Sta prima dei tasti del lettore perché è un tasto suo, non del brano. */
  const accanto = event.target?.closest?.("[data-dm-mp-cmd]");
  if (accanto) {
    event.preventDefault();
    const voce = comandoAccantoDi(clean(accanto.dataset.dmMpCmd));
    if (!voce) return;
    root.navigator?.vibrate?.(8);
    if (voce.genere === "interruttore")
      accanto.setAttribute("aria-pressed", String(voce.acceso !== true));
    const servizio = comandoDelDispositivo(voce);
    if (servizio) chiamaHa(servizio.domain, servizio.service, servizio.data);
    return;
  }
  /* Un tasto del telecomando (#132): va al telecomando di quella TV, col nome
   * che la sua integrazione gli da'. Si rilegge adesso e non si prende dal
   * disegno: la TV spenta nel frattempo il telecomando non ce l'ha piu'. */
  const tele = event.target?.closest?.("[data-dm-tele]");
  if (tele) {
    event.preventDefault();
    const riga = letturaDi(clean(tele.dataset.dmTeleLettore));
    const servizio = comandoDelTelecomando(riga?.telecomando, clean(tele.dataset.dmTele));
    if (!servizio) return;
    root.navigator?.vibrate?.(8);
    chiamaHa(servizio.domain, servizio.service, servizio.data);
    return;
  }
  const tasto = event.target?.closest?.("[data-dm-mp]");
  if (!tasto) return;
  event.preventDefault();
  const entity = clean(tasto.dataset.dmMpEntity);
  const comando = clean(tasto.dataset.dmMp);
  if (!entity.includes(".")) return;
  root.navigator?.vibrate?.(8);
  /* Sfogliare non e' un servizio: e' una finestra. Sta qui e non piu' in
   * basso perche' «comandoDelLettore» per questo tasto non ha niente da dare,
   * e piu' in basso un servizio vuoto esce senza fare nulla. */
  if (comando === "sfoglia") {
    apriLoSfoglio(entity);
    return;
  }
  const riga = letturaDi(entity);
  const servizio = comandoDelLettore(comando, riga);
  if (!servizio) return;
  if (comando === "muto") {
    chiamaHa("media_player", "volume_mute", {
      entity_id: entity,
      is_volume_muted: !(riga?.mutato === true),
    });
    return;
  }
  chiamaHa("media_player", servizio, { entity_id: entity });
}

function onInput(event) {
  const cursore = event.target?.closest?.("[data-dm-mp-volume]");
  if (!cursore) return;
  const percento = Math.min(100, Math.max(0, Number(cursore.value) || 0));
  const scritta = cursore.parentElement?.querySelector("[data-dm-mp-percento]");
  if (scritta) scritta.textContent = `${percento}%`;
  chiamaHa("media_player", "volume_set", {
    entity_id: clean(cursore.dataset.dmMpVolume),
    volume_level: percento / 100,
  });
}

function onChange(event) {
  /* Una tendina accanto (#451): la scelta va alla sua entità, non al lettore. */
  const accanto = event.target?.closest?.("[data-dm-mp-tendina]");
  if (accanto) {
    const voce = comandoAccantoDi(clean(accanto.dataset.dmMpTendina));
    const servizio = voce && comandoDelDispositivo(voce, accanto.value);
    if (servizio) chiamaHa(servizio.domain, servizio.service, servizio.data);
    return;
  }
  const tendina = event.target?.closest?.("[data-dm-mp-sorgente]");
  if (!tendina) return;
  chiamaHa("media_player", "select_source", {
    entity_id: clean(tendina.dataset.dmMpSorgente),
    source: clean(tendina.value),
  });
}

/* ── impianto ─────────────────────────────────────────────────────────── */

function schedule() {
  if (state.frame) return;
  state.frame =
    root.requestAnimationFrame?.(() => {
      state.frame = 0;
      try {
        renderMediaPlayer();
        /* La finestra di un lettore solo si ridisegna qui e non dentro
         * `renderMediaPlayer`: quella esce presto quando non c'e' nessun
         * lettore configurato, e un lettore messo fra le Azioni rapide puo'
         * benissimo non esserlo. */
        disegnaIlLettoreAperto();
      } catch (errore) {
        root.console?.warn?.("[DashboardModern] media player", errore);
      }
    }) || 0;
}

export function ridisegnaMediaPlayer() {
  state.firma = "";
  schedule();
}

function installStyles() {
  installStyle(
    STYLE_ID,
    `
      #${PAGINA_MEDIA} .dm-mp-wrap{display:grid;gap:14px;padding:0 4px 26px}
      .dm-mp-vuoto{
        padding:26px 18px;border-radius:20px;text-align:center;
        color:var(--text-dim,#64748b);
        background:var(--card-background-color,#fff);border:1px solid var(--card-border,#e2e8f0)}
      /* La card è la copertina: davanti quadrata e netta, dietro grande e
         sfocata a fare da fondo. È la richiesta, e sotto ci sta tutto il
         resto — che quindi si scrive in bianco su scuro. */
      .dm-mp-card{
        position:relative;overflow:hidden;isolation:isolate;
        display:grid;grid-template-columns:auto minmax(0,1fr);gap:16px;align-items:center;
        padding:16px;border-radius:24px;
        background:var(--card-background-color,#fff);border:1px solid var(--card-border,#e2e8f0);
        box-shadow:0 18px 40px -30px rgba(2,6,23,.55)}
      .dm-mp-card[data-muta="true"]{opacity:.6}
      .dm-mp-arte-box{position:relative;width:104px;height:104px;flex:0 0 104px}
      .dm-mp-arte{
        position:relative;z-index:1;width:104px;height:104px;border-radius:18px;object-fit:cover;
        background:var(--bg-sculpted,#f0f4f8);
        box-shadow:0 14px 28px -14px rgba(2,6,23,.6)}
      .dm-mp-arte-vuota{display:grid;place-items:center;font-size:34px}
      .dm-mp-arte-vuota .dm-oggetto{width:56px;height:56px}
      /* Il fondo: la stessa immagine, larga quanto la card, sfocata e scura.
         Non si anima e non si muove — è un fondale, non un effetto. */
      .dm-mp-fondo{
        position:absolute;inset:-40%;z-index:0;width:180%;height:180%;
        object-fit:cover;filter:blur(26px) saturate(1.25);opacity:.5;
        pointer-events:none}
      .dm-mp-card[data-arte="true"]::after{
        content:"";position:absolute;inset:0;z-index:0;pointer-events:none;
        background:linear-gradient(105deg,rgba(2,6,23,.82),rgba(2,6,23,.52))}
      .dm-mp-card[data-arte="true"] .dm-mp-arte-box,
      .dm-mp-card[data-arte="true"] .dm-mp-testo{position:relative;z-index:2}
      .dm-mp-card[data-arte="true"] .dm-mp-titolo,
      .dm-mp-card[data-arte="true"] .dm-mp-ora,
      .dm-mp-card[data-arte="true"] .dm-mp-percento{color:#f8fafc}
      .dm-mp-card[data-arte="true"] .dm-mp-dove,
      .dm-mp-card[data-arte="true"] .dm-mp-sotto,
      .dm-mp-card[data-arte="true"] .dm-mp-sorgente>span{color:rgba(248,250,252,.78)}
      /* I tasti secondari si spengono sul fondale; quello centrale no — e' il
         tasto che si cerca, e sulla copertina deve restare il suo colore. */
      .dm-mp-card[data-arte="true"] .dm-mp-tasto:not([data-dm-mp="centro"]){
        color:#f8fafc;background:rgba(248,250,252,.14);border-color:rgba(248,250,252,.24)}
      /* La colonna è dichiarata, e non lasciata all'«auto».

         Una griglia senza colonne scritte se ne fa una implicita larga quanto il
         figlio più largo, e i figli qui dentro sono una tendina con dentro «Dolby
         Digital Plus 5.1» e un nome di entità lungo una riga: su un telefono la
         colonna veniva 220px dove ce n'erano 162, e siccome la card taglia quello
         che esce («overflow:hidden», che le serve per il fondale sfocato) il di
         più spariva — senza modo di andarlo a prendere, perché la pagina non
         scorre di lato. «minmax(0,1fr)» dice che quella colonna non può crescere
         oltre lo spazio che ha, e il testo lungo si accorcia o va a capo come
         ognuno di questi pezzi sa già fare. */
      .dm-mp-testo{display:grid;grid-template-columns:minmax(0,1fr);gap:5px;min-width:0}
      .dm-mp-dove{
        font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;
        color:var(--text-dim,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dm-mp-titolo{
        font-family:'Oswald',sans-serif;font-size:19px;font-weight:700;line-height:1.15;
        color:var(--text,#0f172a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dm-mp-sotto{
        font-size:12px;font-weight:600;color:var(--text-dim,#64748b);
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dm-mp-tempo{display:flex;align-items:center;gap:9px;margin-top:4px}
      .dm-mp-ora{
        font-size:10.5px;font-weight:700;color:var(--text-dim,#64748b);
        font-variant-numeric:tabular-nums;flex:0 0 auto}
      .dm-mp-barra{
        flex:1 1 auto;height:4px;border-radius:999px;overflow:hidden;
        background:color-mix(in srgb,currentColor 18%,transparent)}
      .dm-mp-barra>i{
        display:block;height:100%;width:100%;transform-origin:left center;
        background:linear-gradient(90deg,#8b5cf6,#ec4899)}
      .dm-mp-comandi{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}
      .dm-mp-tasto{
        display:grid;place-items:center;width:40px;height:40px;padding:0;
        border-radius:14px;cursor:pointer;color:var(--text,#0f172a);
        background:var(--bg-sculpted,#f0f4f8);border:1px solid var(--card-border,#e2e8f0)}
      .dm-mp-tasto svg{width:21px;height:21px}
      .dm-mp-tasto[data-dm-mp="centro"]{
        width:48px;height:48px;color:#fff;border-color:transparent;
        background:linear-gradient(135deg,#8b5cf6,#ec4899)}
      .dm-mp-tasto[data-dm-mp="centro"] svg{width:24px;height:24px}
      .dm-mp-tasto[data-acceso="true"]{color:#f97316}
      /* Il telecomando della TV (#132): sotto la card e largo quanto lei, sopra
         il fondale come il resto. I tasti sono i quadrati dei comandi del
         brano, un po' piu' grandi perche' si premono a colpo sicuro; OK ha il
         colore del tasto in mezzo, ed e' tondo come su ogni telecomando. */
      .dm-mp-tele{
        grid-column:1/-1;position:relative;z-index:2;
        display:grid;justify-items:center;gap:12px;
        padding-top:14px;border-top:1px solid var(--divider-color,#e2e8f0)}
      .dm-mp-croce{
        display:grid;grid-template-columns:repeat(3,52px);grid-template-rows:repeat(3,52px);gap:8px}
      .dm-mp-croce>[data-dm-tele="su"]{grid-area:1/2}
      .dm-mp-croce>[data-dm-tele="sinistra"]{grid-area:2/1}
      .dm-mp-croce>[data-dm-tele="ok"]{grid-area:2/2}
      .dm-mp-croce>[data-dm-tele="destra"]{grid-area:2/3}
      .dm-mp-croce>[data-dm-tele="giu"]{grid-area:3/2}
      .dm-mp-croce>.dm-mp-tasto{width:52px;height:52px;border-radius:16px}
      .dm-mp-croce>.dm-mp-tasto svg{width:25px;height:25px}
      .dm-mp-croce>.dm-mp-tasto[data-dm-tele="ok"],
      .dm-mp-card[data-arte="true"] .dm-mp-croce>.dm-mp-tasto[data-dm-tele="ok"]{
        border-radius:50%;color:#fff;border-color:transparent;
        background:linear-gradient(135deg,#8b5cf6,#ec4899);
        font:inherit;font-size:15px;font-weight:900;letter-spacing:.06em}
      .dm-mp-tele-fila{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px}
      .dm-mp-tele-canali{display:flex;gap:8px;margin-left:10px}
      .dm-mp-tasto-ch{align-content:center;gap:1px}
      .dm-mp-tasto-ch>.dm-mp-ch{font-size:9px;font-weight:900;letter-spacing:.08em;line-height:1;opacity:.72}
      .dm-mp-tasto-ch>b{font-size:17px;font-weight:900;line-height:1}
      .dm-mp-card[data-arte="true"] .dm-mp-tele{border-top-color:rgba(248,250,252,.18)}
      .dm-mp-volume{display:flex;align-items:center;gap:10px;margin-top:8px}
      .dm-mp-slider{flex:1 1 auto;min-width:0;accent-color:#8b5cf6}
      .dm-mp-percento{
        font-size:10.5px;font-weight:800;color:var(--text-dim,#64748b);
        font-variant-numeric:tabular-nums;flex:0 0 34px;text-align:right}
      /* Etichetta e tendina sulla stessa riga finché ci stanno, e quando non
         ci stanno la tendina va a capo e si prende la riga intera.

         Tenute affiancate per forza, un nome lungo — «Formato di ingresso del
         segnale», che è il nome che ci mette l'integrazione, non uno scelto qui —
         si impilava su tre righe e alla tendina restavano cento pixel: dentro ci
         si leggeva «No input co», e il resto non si raggiungeva in nessun modo,
         perché una tendina non si scorre di lato. */
      .dm-mp-sorgente{
        display:flex;align-items:center;flex-wrap:wrap;gap:9px;row-gap:4px;margin-top:8px}
      /* Quello che sta accanto (#451): i tasti dell'integrazione e le sue
         letture, sotto i comandi del brano. */
      .dm-mp-cmds{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      .dm-mp-cmd{
        padding:6px 11px;border-radius:999px;cursor:pointer;font:inherit;font-size:11.5px;
        font-weight:800;border:1px solid var(--divider-color,#dbe4ee);
        background:var(--card-bg,#fff);color:var(--text,#0f172a)}
      .dm-mp-cmd[aria-pressed="true"]{
        border-color:#8b5cf6;background:color-mix(in srgb,#8b5cf6 16%,transparent);color:#6d28d9}
      .dm-mp-cmd[disabled]{opacity:.45;cursor:default}
      .dm-mp-letture{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      .dm-mp-lettura{
        display:inline-flex;align-items:center;gap:7px;min-width:0;padding:5px 9px;
        border-radius:11px;border:1px solid var(--divider-color,#dbe4ee);
        background:var(--surface-2,#f8fafc)}
      .dm-mp-lettura>i{flex:0 0 auto;display:grid;place-items:center;line-height:0}
      .dm-mp-lettura>small{
        min-width:0;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
        color:var(--text-dim,#94a3b8)}
      .dm-mp-lettura>b{font-size:12px;font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap}
      .dm-mp-card[data-arte="true"] .dm-mp-cmd{
        border-color:rgba(255,255,255,.28);background:rgba(15,23,42,.34);color:#f8fafc}
      .dm-mp-card[data-arte="true"] .dm-mp-lettura{
        border-color:rgba(255,255,255,.22);background:rgba(15,23,42,.3)}
      .dm-mp-card[data-arte="true"] .dm-mp-lettura>small{color:rgba(248,250,252,.72)}
      .dm-mp-card[data-arte="true"] .dm-mp-lettura>b{color:#f8fafc}
      .dm-mp-sorgente>span{
        font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
        color:var(--text-dim,#64748b)}
      .dm-mp-sorgente select{
        flex:1 1 150px;min-width:0;padding:7px 10px;border-radius:11px;font-size:12px;font-weight:700;
        color:var(--text,#0f172a);
        background:var(--card-background-color,#fff);border:1px solid var(--card-border,#e2e8f0)}
      /* La finestra di un lettore solo (#460): il fondo sfocato e la card in
         mezzo, come le altre finestre della plancia. Dentro non c'e' niente di
         nuovo da vestire — e' la card della pagina Musica. */
      /* Chiusa vuol dire chiusa: un display:grid scritto su un identificativo
         batte la regola del browser che nasconde quello che porta l'attributo
         «hidden», e la finestra richiusa restava un velo a tutto schermo davanti
         alla plancia — invisibile e impenetrabile. Lo dice la prova che la
         richiude toccando fuori. */
      #dm-mp-popup[hidden]{display:none!important}
      #dm-mp-popup{
        position:fixed;inset:0;z-index:2600;display:grid;place-items:center;
        padding:18px;background:rgba(2,6,23,.62);
        backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}
      #dm-mp-popup .dm-mp-popup-box{
        position:relative;width:min(560px,100%);max-height:88vh;overflow:auto}
      #dm-mp-popup .dm-mp-card{width:100%}
      #dm-mp-popup .dm-mp-popup-chiudi{
        position:absolute;top:10px;right:10px;z-index:3;
        display:grid;place-items:center;width:34px;height:34px;padding:0;
        border-radius:50%;cursor:pointer;font:inherit;font-size:15px;font-weight:900;
        color:var(--text,#0f172a);background:var(--card-background-color,#fff);
        border:1px solid var(--card-border,#e2e8f0);
        box-shadow:0 8px 20px -12px rgba(2,6,23,.6)}
      #dm-mp-popup .dm-mp-card[data-arte="true"]+.dm-mp-popup-chiudi,
      #dm-mp-popup .dm-mp-popup-box:has(.dm-mp-card[data-arte="true"]) .dm-mp-popup-chiudi{
        color:#f8fafc;background:rgba(15,23,42,.62);border-color:rgba(248,250,252,.28)}
      /* La finestra che sfoglia la libreria. Il velo e il riquadro sono quelli
         della finestra di un lettore solo — e' la stessa plancia — ma dentro
         c'e' un elenco che scorre, non una card, e l'altezza la decide lo
         schermo: su un telefono la libreria di Music Assistant ha centinaia di
         righe e la finestra deve stare dove sta, col solo elenco che si muove. */
      #dm-sf-popup[hidden]{display:none!important}
      #dm-sf-popup{
        position:fixed;inset:0;z-index:2700;display:grid;place-items:center;
        padding:18px;background:rgba(2,6,23,.66);
        backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}
      #dm-sf-popup .dm-sf-box{
        display:flex;flex-direction:column;min-height:0;
        width:min(480px,100%);max-height:min(78vh,620px);
        padding:12px 12px 8px;border-radius:24px;
        background:var(--card-background-color,#fff);border:1px solid var(--card-border,#e2e8f0);
        box-shadow:0 26px 60px -30px rgba(2,6,23,.7)}
      .dm-sf-testa{
        display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;
        padding:2px 2px 10px}
      .dm-sf-dove{display:grid;grid-template-columns:minmax(0,1fr);text-align:center}
      .dm-sf-dove>strong{
        font-size:14.5px;font-weight:900;color:var(--text,#0f172a);
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dm-sf-dove>small{
        font-size:11px;font-weight:700;color:var(--text-dim,#64748b);
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dm-sf-tondo{
        display:grid;place-items:center;width:34px;height:34px;padding:0;
        border-radius:50%;cursor:pointer;font:inherit;font-size:17px;font-weight:900;line-height:1;
        color:var(--text,#0f172a);background:var(--bg-sculpted,#f1f5f9);
        border:1px solid var(--card-border,#e2e8f0)}
      .dm-sf-tondo>svg{width:18px;height:18px}
      .dm-sf-tondo-vuoto{cursor:default;color:var(--text-dim,#94a3b8);background:transparent;border-color:transparent}
      /* Le briciole di pane scorrono di lato invece di andare a capo: dentro
         una libreria si scende di quattro o cinque passi, e un filo che si
         impila su tre righe si mangia l'elenco che sta sotto. */
      .dm-sf-filo{
        display:flex;align-items:center;gap:4px;flex:0 0 auto;
        overflow-x:auto;scrollbar-width:none;padding:0 2px 8px}
      .dm-sf-filo::-webkit-scrollbar{display:none}
      .dm-sf-filo>i{color:var(--text-dim,#cbd5e1);font-style:normal;font-weight:900}
      .dm-sf-filo>button{
        flex:0 0 auto;max-width:120px;padding:4px 9px;border-radius:9px;cursor:pointer;
        font:inherit;font-size:11px;font-weight:800;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        color:var(--text-dim,#64748b);background:var(--bg-sculpted,#f1f5f9);
        border:1px solid transparent}
      .dm-sf-filo>button[aria-current="true"]{color:var(--text,#0f172a);background:transparent}
      .dm-sf-elenco{
        flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;
        display:grid;gap:5px;padding:0 2px 4px}
      .dm-sf-voce{display:flex;align-items:center;gap:5px}
      .dm-sf-riga{
        flex:1 1 auto;
        display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:11px;align-items:center;
        min-width:0;padding:7px 9px;border-radius:14px;cursor:pointer;text-align:left;
        font:inherit;color:var(--text,#0f172a);
        background:var(--bg-sculpted,#f8fafc);border:1px solid var(--card-border,#e2e8f0)}
      .dm-sf-mini{
        display:grid;place-items:center;width:42px;height:42px;flex:0 0 42px;
        border-radius:11px;overflow:hidden;color:var(--text-dim,#94a3b8);
        background-color:var(--card-background-color,#fff);
        background-size:cover;background-position:center;
        border:1px solid var(--card-border,#e2e8f0)}
      /* Quando la miniatura c'e', il segno dietro non deve trasparire da sopra:
         la copertina non e' un fondo, e' l'immagine. */
      .dm-sf-mini[style]>svg{display:none}
      .dm-sf-mini>svg{width:21px;height:21px}
      .dm-sf-nome{
        min-width:0;font-size:13.5px;font-weight:800;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dm-sf-freccia{color:var(--text-dim,#cbd5e1);font-weight:900;font-size:17px;line-height:1}
      .dm-sf-tasto{
        display:grid;place-items:center;width:38px;height:38px;flex:0 0 38px;padding:0;
        border-radius:12px;cursor:pointer;font:inherit;font-size:17px;font-weight:900;line-height:1;
        color:var(--text,#0f172a);background:var(--bg-sculpted,#f1f5f9);
        border:1px solid var(--card-border,#e2e8f0)}
      .dm-sf-tasto>svg{width:15px;height:15px}
      /* Che e' andata: la coda non si vede in nessuno stato, e un tasto che non
         risponde si preme due volte. */
      .dm-sf-coda[data-dm-sf-fatto]{color:#fff;background:#16a34a;border-color:#16a34a}
      .dm-sf-nota{
        flex:0 0 auto;margin:0;padding:14px 10px;text-align:center;
        font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
      .dm-sf-guaio{color:#dc2626}
      @media(max-width:420px){
        #dm-sf-popup{padding:10px}
        #dm-sf-popup .dm-sf-box{max-height:86vh;border-radius:20px}
        .dm-sf-mini{width:38px;height:38px;flex-basis:38px}
      }
      @media(max-width:560px){
        .dm-mp-card{grid-template-columns:auto minmax(0,1fr);gap:12px;padding:13px}
        .dm-mp-arte-box,.dm-mp-arte{width:82px;height:82px;flex-basis:82px}
        .dm-mp-titolo{font-size:16.5px}
        .dm-mp-tasto{width:37px;height:37px}
        .dm-mp-tasto[data-dm-mp="centro"]{width:44px;height:44px}
      }
    `,
  );
}

export function installMediaPlayer() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  doc.addEventListener("input", onInput);
  doc.addEventListener("change", onChange);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  /* Quando si viene a sapere di che integrazione e' una TV, il suo telecomando
   * puo' comparire (#132). */
  root.addEventListener?.(EVENTO_PIATTAFORME, ridisegnaMediaPlayer);
  /* Chi cambia pagina spegne o riaccende il battito: la barra del tempo non
   * deve correre dietro a una pagina che nessuno sta guardando. */
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.(".tab[data-tab]")) root.queueMicrotask?.(schedule);
  });
  doc.addEventListener("keydown", (evento) => {
    /* Le finestre sono due, e una sta sopra l'altra: Escape chiude quella che
     * si sta guardando. Chiuderle entrambe vorrebbe dire che chi torna
     * indietro dalla libreria perde anche il lettore da cui l'ha aperta. */
    if (evento.key !== "Escape") return;
    if (!chiudiLoSfoglio()) chiudiIlLettore();
  });
  root.addEventListener?.("pagehide", ferma);
  schedule();
  return true;
}
