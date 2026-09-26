/* La pagina dei varchi: chi è aperto adesso, e chi no (#367, #377).
 *
 * «Almeno a colpo d'occhio so quante finestre sono aperte in questo momento»
 * (#367) e «una sezione porte … magari che la card principale come per le luci
 * mostri solo il numero di porte aperte» (#377).
 *
 * In cima c'è la risposta, grande: quante ne sono aperte — o «Tutto chiuso»,
 * che è la risposta che si spera. Sotto, una carta per contatto: verde chiusa,
 * rossa aperta, e smorta quella che non risponde, perché un sensore muto non è
 * una finestra chiusa.
 *
 * Qui non si comanda l'infisso. Un contatto dice come sta e basta: le serrature
 * e i relè stanno in «Apri porte/cancelli», le tapparelle in Finestre. Tenere
 * separato il guardare dall'aprire è il motivo per cui questa pagina si può
 * aprire cento volte al giorno senza paura di toccare qualcosa.
 *
 * ── L'unica cosa che si comanda, e perché (#136) ──────────────────────────
 *
 * Lo scudo. «Nei varchi che ho inserito, che sono i sensori del mio allarme
 * Risco … mi dà la possibilità di disabilitare. Possiamo farlo anche qui?»
 *
 * Non contraddice la regola di sopra, la precisa: lo scudo non tocca il varco,
 * tocca l'ANTIFURTO. Non apre e non chiude niente — dice alla centrale di non
 * guardare quella finestra, che è quello che si fa quando la si vuole lasciare
 * aperta apposta di notte. Premerlo per sbaglio non apre una porta: rende una
 * porta sorvegliata, o non sorvegliata, e in tutti e due i casi lo si vede
 * scritto sulla carta e contato in cima alla pagina.
 *
 * Ed è qui e non altrove perché qui c'è l'elenco: chi deve escludere una
 * finestra la cerca dove la vede, non in un'altra pagina. Lo scudo compare solo
 * sulle righe a cui qualcuno ha scritto l'interruttore nella scheda Varchi —
 * senza quello non c'è, perché un tasto che chiama un servizio che non esiste è
 * un tasto rotto (#132).
 */
import { CHIAVE_VERSI, insiemeInvertiti } from "../core/verso-aperture.js";
import {
  CHIAVE_VARCHI,
  contoDeiVarchi,
  varchiConLeFinestre,
  varchiConfigurati,
  varchiDiCasa,
} from "../core/varchi-di-casa.js";
import { contoDelleEsclusioni, ilComandoDellEsclusione } from "../core/l-esclusione-del-varco.js";
import { prossimoCambioDelDaQuando, quantoTempoInParole } from "../core/da-quanto.js";
import {
  allStates,
  chiamaServizio,
  clean,
  disegnoDiCasa,
  doc,
  esc,
  installStyle,
  paginaVisibile,
  quandoSiCambiaPagina,
  readJson,
  root,
  t,
} from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

const KEY = "__DASHBOARDMODERN_VARCHI__";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "", sveglia: 0 });

export const VARCHI_PAGE_ID = "page-varchi";
export const VARCHI_TAB = "varchi";

/* ── cosa c'è da guardare ─────────────────────────────────────────────── */

/* La configurazione, coi contatti dichiarati nelle Finestre dentro.
 *
 * Li aggiungeva solo la tessera della Home, e qui non si vedevano: la stessa
 * casa aveva due elenchi di varchi a seconda di dove la si guardava. Adesso
 * l'elenco e' uno, e lo compone `varchiConLeFinestre`. */
function configurazione() {
  return varchiConLeFinestre(
    readJson(CHIAVE_VARCHI, {}),
    root.getTapparelle?.() || readJson("cd_tapparelle", []),
  );
}

function girati() {
  return insiemeInvertiti(readJson(CHIAVE_VERSI, {}));
}

/** I varchi di casa, letti adesso. */
export function varchiInPlancia() {
  const states = allStates();
  return varchiDiCasa(states, configurazione(), girati(), (entity) =>
    nomeDaHomeAssistant(entity, states),
  );
}

/** Se c'è almeno un contatto da mostrare. */
export function ciSonoVarchi() {
  return varchiConfigurati(allStates(), configurazione());
}

/* ── la pagina e la sua voce nella barra ──────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

export function ensureVarchiPage() {
  if (!doc) return null;
  let pagina = doc.getElementById(VARCHI_PAGE_ID);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = VARCHI_PAGE_ID;
  pagina.innerHTML = `<div class="dm-varchi-wrap" id="varchi-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

export function ensureVarchiTab() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${VARCHI_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  /* Accanto alle Finestre: sono la stessa domanda di casa — cosa è aperto —
   * e chi la fa la cerca lì. */
  const dopo =
    barra.querySelector('.tab[data-tab="tapparelle"]') ||
    barra.querySelector('.tab[data-tab="security"]') ||
    barra.querySelector('.tab[data-tab="home"]');
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = VARCHI_TAB;
  voce.id = `tab-${VARCHI_TAB}`;
  voce.innerHTML = `<span class="icon">🚪</span><span class="text">${esc(t("Varchi", "Openings"))}</span>`;
  voce.addEventListener("click", () => {
    for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
    for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
    voce.classList.add("active");
    ensureVarchiPage()?.classList.add("active");
    const testata = doc.querySelector("header");
    if (testata) testata.style.display = "none";
    root.scrollTo?.({ top: 0, behavior: "instant" });
    if (root.navigator?.vibrate) root.navigator.vibrate(5);
    schedule();
  });
  if (dopo) dopo.after(voce);
  else barra.append(voce);
  return voce;
}

/* La voce si governa da sé, come i Rifiuti e le Allerte. */
function sezioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[VARCHI_TAB] === false);
}

function accendiLaVoce() {
  const voce = ensureVarchiTab();
  if (!voce) return;
  const serve = ciSonoVarchi() && sezioneAccesa();
  if (serve) voce.style.removeProperty("display");
  else voce.style.setProperty("display", "none", "important");
  const pagina = doc.getElementById(VARCHI_PAGE_ID);
  if (!serve && pagina?.classList.contains("active"))
    doc.querySelector('.tab[data-tab="home"]')?.click();
}

/* ── le parole ────────────────────────────────────────────────────────── */

/** La parola di un varco: aperta, chiusa, o «non risponde». */
export function parolaDelVarco(riga) {
  if (riga?.stato === "aperto") return t("Aperto", "Open");
  if (riga?.stato === "chiuso") return t("Chiuso", "Closed");
  return t("Non risponde", "Not answering");
}

/** La risposta grande in cima: quanti sono aperti, o che è tutto chiuso. */
export function titoloDeiVarchi(conto) {
  if (!conto?.totale) return t("Nessun contatto trovato", "No contact found");
  if (!conto.aperti) return t("Tutto chiuso", "All closed");
  return conto.aperti === 1
    ? t("1 aperto", "1 open")
    : t(`${conto.aperti} aperti`, `${conto.aperti} open`);
}

/* ── il disegno ───────────────────────────────────────────────────────── */

/* Da quando sta così, invece dell'identificativo (#406).
 *
 * «Sarebbe importante avere nei tasti relativi ai varchi più informazioni,
 *  tipo l'ultima apertura o cambio stato; volendo il nome del sensore nella
 *  maschera varchi potrebbe essere obsoleto.»
 *
 * Ha ragione: sotto il nome c'era `binary_sensor.porta_cantina`, che è la cosa
 * che serve a chi CONFIGURA — e infatti nella scheda del Config resta — ma non
 * a chi guarda. Chi guarda vuole sapere da quanto quella finestra è aperta,
 * che è la differenza fra «l'ho lasciata aperta stamattina» e «si è appena
 * aperta».
 *
 * Senza un istante non si scrive niente: una porta senza storia non è una
 * porta appena aperta, e inventare «da poco» sarebbe una bugia. E quella riga
 * resta vuota, non torna l'identificativo: «nei popup dei dispositivi accesi
 * mi devi togliere la riga sotto al nome, non voglio vedere il nome entità» —
 * e poi «sì fallo anche nelle pagine». Vale qui come vale là, e non manca
 * niente a chi guarda: lo stato in parole sta già in fondo alla riga
 * («Aperto», «Chiuso», «Non risponde»). L'identificativo resta dov'è utile,
 * cioè nella scheda Varchi della configurazione. */
/* La scritta, in parole. Sta separata dal markup perche' la legge anche la
 * firma del ridisegno: e' l'unico pezzo di questa pagina che cambia da solo,
 * col passare del tempo, e chi decide se ridisegnare deve poterlo guardare. */
function daQuandoTesto(riga) {
  if (riga.da === null || riga.da === undefined) return "";
  const minuti = Math.max(0, (Date.now() - riga.da) / 60000);
  /* «appena adesso» non vuole il «da» davanti: sarebbe «aperto da appena
   * adesso», che non lo dice nessuno. */
  if (minuti < 1)
    return `${riga.stato === "aperto" ? t("Aperto", "Open") : riga.stato === "chiuso" ? t("Chiuso", "Closed") : t("Fermo", "Still")} ${quantoTempoInParole(0)}`;
  const parola =
    riga.stato === "aperto"
      ? t("Aperto da", "Open for")
      : riga.stato === "chiuso"
        ? t("Chiuso da", "Closed for")
        : t("Fermo da", "Still for");
  return `${parola} ${quantoTempoInParole(minuti)}`;
}

function daQuandoMarkup(riga) {
  if (riga.da === null || riga.da === undefined) return "";
  return `<small>${esc(daQuandoTesto(riga))}</small>`;
}

/* Due scudi, non un colore solo (#136).
 *
 * Quello sbarrato e' «esclusa»: si legge anche in bianco e nero, e anche da chi
 * i colori non li distingue. Il colore da solo avrebbe detto la stessa cosa
 * soltanto a chi lo vede, e questa e' l'unica informazione della pagina che
 * riguarda se una porta e' sorvegliata o no. */
const SCUDI = Object.freeze({
  sorvegliato:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.2 5 6v5.3c0 4.3 2.9 8.3 7 9.5 4.1-1.2 7-5.2 7-9.5V6l-7-2.8Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9.2 12.1 2 2 3.6-3.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  escluso:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.2 5 6v5.3c0 4.3 2.9 8.3 7 9.5 4.1-1.2 7-5.2 7-9.5V6l-7-2.8Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M6.4 5.2 17.6 19.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
});

/* Lo scudo c'e' solo se c'e' qualcosa da premere: un interruttore scritto, e
 * che risponde. Un varco senza esclusione resta una carta da guardare, e un
 * interruttore muto non si comanda — vedi `l-esclusione-del-varco.js`. */
function scudoMarkup(riga) {
  if (!clean(riga.esclusione) || !clean(riga.escluso)) return "";
  const giu = riga.escluso === "escluso";
  const parola = t("Esclusione dall'antifurto", "Alarm bypass");
  /* Nessuna parola sul tasto, e non per far spazio.
   *
   * «Escluso» c'era gia' nel vocabolario — lo dice la VMC del recupero di calore
   * — e riusarlo qui avrebbe scritto in tredici lingue la parola
   * dell'AERAZIONE addosso a una zona d'allarme: in tedesco «umgangen» invece di
   * «uberbruckt», in spagnolo «derivado» invece di «anulado». Una chiave in meno
   * da tradurre pagata con una parola sbagliata in tredici lingue non e' un
   * affare. Lo stato lo dicono lo scudo sbarrato, il tratteggio della carta, e
   * il conto in cima — che ha parole sue, scritte per l'antifurto. */
  return `<button type="button" class="dm-varco-scudo" data-dm-varco-scudo="${esc(riga.entity)}"
    aria-pressed="${giu}" aria-label="${esc(parola)}" title="${esc(parola)}">
    ${giu ? SCUDI.escluso : SCUDI.sorvegliato}
  </button>`;
}

function rigaMarkup(riga) {
  return `<article class="dm-varco" data-varco="${esc(riga.stato || "muto")}"
    data-escluso="${riga.escluso === "escluso"}">
    <span class="dm-varco-ic" aria-hidden="true">${disegnoDiCasa(riga.glifo, { misura: 30, ripiego: "door" })}</span>
    <div class="dm-varco-testo">
      <strong>${esc(riga.name)}</strong>
      ${daQuandoMarkup(riga)}
    </div>
    <div class="dm-varco-coda">
      <b class="dm-varco-stato">${esc(parolaDelVarco(riga))}</b>
      ${scudoMarkup(riga)}
    </div>
  </article>`;
}

function vuotoMarkup() {
  return `<div class="dm-varchi-vuoto">
    <strong>${esc(t("Nessun contatto trovato", "No contact found"))}</strong>
    <span>${esc(
      t(
        "Un contatto porta-finestra lo dichiara Home Assistant da sé e compare qui senza configurare niente. Se il tuo non viene trovato, aggiungilo dalla scheda Varchi della configurazione.",
        "Home Assistant declares a door or window contact itself and it appears here with nothing to configure. If yours is not found, add it from the Openings tab in the settings.",
      ),
    )}</span>
  </div>`;
}

function testaMarkup(conto, esclusioni) {
  const stato = conto.aperti ? "aperti" : conto.totale ? "chiusi" : "vuoto";
  const sotto = [
    conto.chiusi
      ? conto.chiusi === 1
        ? t("1 chiuso", "1 closed")
        : t(`${conto.chiusi} chiusi`, `${conto.chiusi} closed`)
      : "",
    conto.muti
      ? conto.muti === 1
        ? t("1 non risponde", "1 not answering")
        : t(`${conto.muti} non rispondono`, `${conto.muti} not answering`)
      : "",
    /* Quante sono escluse dall'antifurto (#136). Sta qui e non sulla sola carta
     * perche' e' la cosa che chi sta per inserire l'antifurto deve sapere PRIMA
     * di inserirlo: una finestra esclusa e' una finestra che la centrale non
     * guardera', e scoprirlo dopo non serve a niente. */
    esclusioni?.esclusi
      ? esclusioni.esclusi === 1
        ? t("1 escluso", "1 bypassed")
        : t(`${esclusioni.esclusi} esclusi`, `${esclusioni.esclusi} bypassed`)
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `<div class="dm-varchi-testa" data-stato="${esc(stato)}">
    <small>${esc(t("In questo momento", "Right now"))}</small>
    <strong>${esc(titoloDeiVarchi(conto))}</strong>
    ${conto.nomi.length ? `<span class="dm-varchi-nomi">${esc(conto.nomi.join(" · "))}</span>` : ""}
    ${sotto ? `<span class="dm-varchi-sotto">${esc(sotto)}</span>` : ""}
  </div>`;
}

function dipingi() {
  const pagina = ensureVarchiPage();
  const dove = pagina?.querySelector?.("#varchi-wrap");
  if (!dove) return;
  /* A pagina chiusa non si disegna: la voce nella barra si accende comunque,
   * ed è l'unica cosa che si vede da fuori. */
  if (!paginaVisibile(VARCHI_PAGE_ID)) return;
  const righe = varchiInPlancia();
  if (!righe.length) {
    if (state.firma !== "vuoto") {
      state.firma = "vuoto";
      dove.innerHTML = vuotoMarkup();
    }
    return;
  }
  const conto = contoDeiVarchi(righe);
  /* Nella firma ci va anche quello che si LEGGE, non solo quello che c'e'.
   *
   * «Aperto da 5 minuti» lo scrive l'orologio, non lo stato: finche' il
   * contatto non si muove le righe sono identiche, la firma pure, e quel «5
   * minuti» restava scritto per ore su una plancia appesa al muro. Adesso la
   * scritta fa parte della firma, e quando cambia la pagina si ridisegna. */
  const esclusioni = contoDelleEsclusioni(righe);
  const firma = JSON.stringify([righe, righe.map(daQuandoTesto), t("Aperto", "Open")]);
  if (state.firma !== firma || !dove.firstElementChild) {
    state.firma = firma;
    dove.innerHTML = `${testaMarkup(conto, esclusioni)}
      <div class="dm-varchi-elenco">${righe.map(rigaMarkup).join("")}</div>`;
  }
  svegliamiQuandoCambia(righe);
}

/* Una sveglia sola, al momento in cui la prima scritta cambiera'.
 *
 * Non e' un battito che gira: e' un appuntamento, preso dopo aver disegnato e
 * disdetto a ogni ridisegno. A pagina chiusa non si prende — `dipingi` esce
 * prima — e chi riapre la pagina passa comunque di qui. */
function svegliamiQuandoCambia(righe) {
  if (state.sveglia) {
    root.clearTimeout?.(state.sveglia);
    state.sveglia = 0;
  }
  const fra = prossimoCambioDelDaQuando(righe, Date.now());
  if (fra == null) return;
  state.sveglia =
    root.setTimeout?.(() => {
      state.sveglia = 0;
      schedule();
    }, Math.max(1000, fra)) || 0;
}

/* Lo scudo premuto (#136).
 *
 * Si rilegge l'elenco adesso invece di fidarsi di quello disegnato: fra il
 * disegno e il dito puo' essere passato un ridisegno, e mandare `turn_off` a un
 * interruttore che nel frattempo si e' spento vorrebbe dire lasciare
 * sorvegliata una porta che chi ha premuto crede esclusa. Chi non trova la riga,
 * o trova un interruttore che non risponde, non manda niente: e' la stessa
 * regola per cui il tasto non si disegna. */
function premiLoScudo(entity) {
  const riga = varchiInPlancia().find((quale) => quale.entity === clean(entity));
  const comando = riga && ilComandoDellEsclusione(riga.esclusione, allStates());
  if (!comando) return;
  chiamaServizio(comando);
  if (root.navigator?.vibrate) root.navigator.vibrate(8);
}

function ascoltaLoScudo() {
  const pagina = ensureVarchiPage();
  if (!pagina || pagina.dataset.dmVarchiScudo === "si") return;
  pagina.dataset.dmVarchiScudo = "si";
  pagina.addEventListener("click", (evento) => {
    const scudo = evento.target?.closest?.("[data-dm-varco-scudo]");
    if (!scudo) return;
    evento.preventDefault();
    premiLoScudo(scudo.dataset.dmVarcoScudo);
  });
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      accendiLaVoce();
      /* Qui e non all'installazione: la pagina si crea accanto all'ultima
       * sorella, e all'avvio quella sorella puo' non esserci ancora.
       * `ensureVarchiPage` tornerebbe `null`, l'ascolto non si attaccherebbe
       * mai, e lo scudo sarebbe un tasto morto per tutta la sessione. Il
       * cartello sul nodo fa si' che si attacchi una volta sola. */
      ascoltaLoScudo();
      dipingi();
    } catch (error) {
      root.console?.warn?.("[DashboardModern] varchi", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

export function renderVarchi() {
  state.firma = "";
  schedule();
}

function installStyles() {
  const P = `#${VARCHI_PAGE_ID}`;
  installStyle(
    "dm-varchi-section-style",
    `
    ${P} .dm-varchi-wrap{display:grid;gap:14px;padding:0 0 24px}
    ${P} .dm-varchi-vuoto{display:grid;gap:6px;padding:22px 18px;text-align:center;
      border:1px dashed var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff)}
    ${P} .dm-varchi-vuoto strong{font-size:14px;font-weight:900}
    ${P} .dm-varchi-vuoto span{font-size:12px;font-weight:700;color:var(--secondary-text-color,#64748b)}

    /* La risposta grande: quanti sono aperti adesso. */
    ${P} .dm-varchi-testa{
      display:grid;gap:4px;padding:20px 22px;border-radius:22px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    ${P} .dm-varchi-testa small{
      font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;
      color:var(--text-dim,#64748b)}
    ${P} .dm-varchi-testa strong{font-size:30px;font-weight:900;line-height:1.05;color:var(--text,#0f172a)}
    ${P} .dm-varchi-testa[data-stato="aperti"] strong{color:#dc2626}
    ${P} .dm-varchi-testa[data-stato="chiusi"] strong{color:#15803d}
    ${P} .dm-varchi-nomi{font-size:13px;font-weight:800;color:var(--text,#0f172a)}
    ${P} .dm-varchi-sotto{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}

    ${P} .dm-varchi-elenco{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr));gap:10px}

    /* La carta di un varco: il colore lo dice prima della parola. */
    ${P} .dm-varco{
      display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:12px;
      padding:14px 16px;border-radius:18px;
      border:1px solid color-mix(in srgb,var(--dm-varco,#94a3b8) 42%,transparent);
      background:color-mix(in srgb,var(--dm-varco,#94a3b8) 10%,var(--card-bg,#fff))}
    ${P} .dm-varco[data-varco="aperto"]{--dm-varco:#dc2626}
    ${P} .dm-varco[data-varco="chiuso"]{--dm-varco:#16a34a}
    ${P} .dm-varco[data-varco="muto"]{--dm-varco:#94a3b8}
    ${P} .dm-varco-ic{
      display:grid;place-items:center;width:44px;height:44px;border-radius:14px;font-size:20px;
      background:color-mix(in srgb,var(--dm-varco,#94a3b8) 22%,transparent)}
    /* Il disegno del catalogo al posto dell'emoji (#74): la casella resta
       quella, cambia quello che ci sta dentro. */
    ${P} .dm-varco-ic .dm-catalogo-art{display:grid;place-items:center;line-height:0}
    ${P} .dm-varco-ic svg{display:block;width:30px;height:30px}
    ${P} .dm-varco-testo{display:grid;gap:2px;min-width:0}
    /* Il nome su due righe, e la pastiglia che gli lascia il posto.
     *
     * Su una riga sola, con «NON RISPONDE» accanto che si prende novanta
     * pixel, di un nome di casa vera restavano sei lettere: «Leapmo…»,
     * «Sensore Port…». E sono nomi che si somigliano — quattro contatti
     * «Sensore Porta/finestra ...» diventano quattro card identiche, che e'
     * peggio di un nome tagliato: e' un nome che non dice piu' quale.
     *
     * Due righe bastano quasi sempre, e la pastiglia dello stato va a capo
     * anche lei invece di mangiarsi la colonna del nome. */
    ${P} .dm-varco-testo strong{font-size:14px;font-weight:900;color:var(--text,#0f172a);
      display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;
      overflow:hidden;overflow-wrap:anywhere;line-height:1.25}
    ${P} .dm-varco-testo small{font-size:10.5px;font-weight:700;color:var(--text-dim,#64748b);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-varco-stato{
      font-size:11px;font-weight:900;letter-spacing:.03em;text-transform:uppercase;
      max-width:74px;text-align:right;line-height:1.25;
      color:color-mix(in srgb,var(--dm-varco,#94a3b8) 78%,var(--text,#0f172a))}

    /* Lo scudo dell'antifurto (#136): sotto la parola dello stato, non al posto
       suo. Sono due cose diverse — com'e' la finestra, e se la centrale la
       guarda — e una carta che le dicesse nella stessa casella farebbe credere
       che siano la stessa. */
    ${P} .dm-varco-coda{display:grid;justify-items:end;gap:6px}
    ${P} .dm-varco-scudo{
      display:flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;cursor:pointer;
      border:1px solid color-mix(in srgb,var(--dm-varco,#94a3b8) 45%,transparent);
      background:var(--card-bg,#fff);color:var(--text-dim,#64748b);
      font-size:10px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;
      -webkit-tap-highlight-color:transparent}
    ${P} .dm-varco-scudo svg{display:block;width:17px;height:17px}
    ${P} .dm-varco-scudo[aria-pressed="true"]{
      border-color:#f59e0b;background:color-mix(in srgb,#f59e0b 16%,var(--card-bg,#fff));color:#b45309}
    /* Una carta esclusa lo dice anche da lontano, senza leggere: il tratteggio
       vuol dire «questa la centrale non la guarda». */
    ${P} .dm-varco[data-escluso="true"]{border-style:dashed;border-color:#f59e0b}

    @media(max-width:520px){${P} .dm-varchi-elenco{grid-template-columns:1fr}}
    `,
  );
}

export function installVarchi() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensureVarchiPage();
  ensureVarchiTab();
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmVarchi) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmVarchi = true;
    avvolta.__dmPrevious = precedente;
    root[nome] = avvolta;
  }
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  quandoSiCambiaPagina(schedule);
  schedule();
  return true;
}

installVarchi();
