/* Il locale caldaia ha tre macchine, non una (#253).
 *
 * La pagina si chiamava «Solare termico» e disegnava un impianto solo:
 * pannello sul tetto, pompa, accumulo. Ma l'acqua calda in casa la fanno tre
 * macchine diverse, e quasi nessuno ne ha una sola. Chi ha il fotovoltaico e
 * lo scaldabagno apriva questa pagina e ci trovava un pannello che non ha; chi
 * ha solare e caldaia insieme — il caso piu' comune — ne vedeva una sola.
 *
 * Adesso in configurazione si spunta quello che si ha: solare termico,
 * scaldabagno, caldaia, uno o tutti e tre. Con uno solo la pagina e' quella di
 * sempre, senza niente in piu' da capire. Con due o tre compare in alto la
 * fila delle linguette, la stessa che la pagina Clima usa per Freddo e Caldo:
 * un gesto che chi usa la plancia conosce gia'.
 *
 * Il disegno del solare NON si tocca: e' del suo modulo, ed e' un pixel che ha
 * gia' un padrone. Le due scene nuove nascono accanto, nello stesso linguaggio
 * — assonometria a 2:1, tubi con l'anima chiara, targhette scure coi numeri —
 * e si accendono a turno. Ognuna e' un fratello della scena vecchia, mai un
 * suo inquilino.
 *
 * Qui non si scrive niente in Home Assistant: si legge, si disegna, e
 * l'interruttore chiama il servizio che chiamava gia' la tessera.
 *
 * Poi e' arrivata la quarta, la stufa a pellet (#183), con una scena sua e un
 * quadro di comandi: accesa e spenta, l'obiettivo, la potenza, il
 * ventilatore. Anche quelli chiamano il servizio e basta, col gesto
 * dell'interruttore della caldaia: un tocco, nessuna conferma.
 */
import {
  BRICIOLA_SEZIONE,
  BRICIOLE_TERMICHE,
  CHIAVE_CALDAIA,
  CHIAVE_IMPIANTI,
  CHIAVE_SOLARE_SCELTO,
  CHIAVE_SOLARI,
  CHIAVE_STUFE,
  ETICHETTE_TERMICHE,
  FASI_STUFA,
  NOME_SEZIONE,
  TITOLI_TERMICI,
  comandoAccensione,
  comandoLivello,
  comandoObiettivo,
  entitaDelleCaldaie,
  entitaDelleStufe,
  impiantiScelti,
  impiantiSolari,
  lettureCaldaie,
  lettureStufe,
  livelloConValore,
  nomeDelSolare,
  overridesPerSolare,
  pelletScarso,
  prossimoLivello,
  prossimoObiettivo,
  serbatoiDellaCaldaia,
  servonoLinguette,
  tabAttiva,
  verdettoPressione,
} from "../core/impianti-termici.js";
import { laMisuraDallUnita } from "../core/le-unita-della-corrente.js";
import { parolaDiStato } from "./le-parole-di-home-assistant.js";
import {
  SCALDABAGNI_KEY,
  lettureScaldabagni,
  quotaVersoObiettivo,
} from "../core/scaldabagno-model.js";
import { registraTitoloDiPagina, renderPageMastheads } from "./page-masthead-section.js";
import {
  allStates,
  chiamaServizio,
  clean,
  doc,
  esc,
  formatNumber,
  installStyle,
  readJson,
  root,
  siComanda,
  t,
  wrapFunction,
  writeJsonIfChanged,
  senzaCadere,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_IMPIANTI_TERMICI__";
const STYLE_ID = "dm-impianti-termici-style";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  tab: "",
  firma: "",
  quale: {},
  richieste: {},
});

const PAGINA = "page-boiler";

/* ── cosa c'e' in casa ─────────────────────────────────────────────────── */

function scaldabagniConfigurati() {
  const stored = readJson(SCALDABAGNI_KEY, []);
  return Array.isArray(stored) && stored.length > 0;
}

function caldaiaConfigurata() {
  return entitaDelleCaldaie(readJson(CHIAVE_CALDAIA, {})).length > 0;
}

function stufaConfigurata() {
  return entitaDelleStufe(readJson(CHIAVE_STUFE, [])).length > 0;
}

/* Il solare risulta configurato se qualcuna delle sue caselle e' mappata: e'
 * l'indizio che serve a chi arriva da una plancia in cui questa domanda non
 * esisteva ancora, e che non deve perdere la pagina che vedeva ieri. */
function solareConfigurato() {
  const mappature = readJson("cd_entity_overrides", {});
  if (!mappature || typeof mappature !== "object") return false;
  return Object.keys(mappature).some(
    (chiave) => chiave.startsWith("dm.boiler_") && clean(mappature[chiave]),
  );
}

export function impiantiDiCasa() {
  return impiantiScelti(readJson(CHIAVE_IMPIANTI, null), {
    solare: solareConfigurato(),
    scaldabagno: scaldabagniConfigurati(),
    caldaia: caldaiaConfigurata(),
    stufa: stufaConfigurata(),
  });
}

/* ── le linguette ──────────────────────────────────────────────────────── */

function stripMarkup(scelti, attiva) {
  return scelti
    .map(
      (tipo) => `<button type="button" class="dm-it-tab" data-dm-it-tab="${esc(tipo)}"
        aria-pressed="${tipo === attiva}"${tipo === attiva ? ' data-on="true"' : ""}>
        <span class="dm-it-tab-ic" aria-hidden="true">${ICONE[tipo] || ""}</span>
        <span>${esc(t(...ETICHETTE_TERMICHE[tipo]))}</span>
      </button>`,
    )
    .join("");
}

const ICONE = Object.freeze({
  solare:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.4M12 19v2.4M21.4 12H19M5 12H2.6M18.7 5.3l-1.7 1.7M7 17l-1.7 1.7M18.7 18.7 17 17M7 7 5.3 5.3"/></svg>',
  scaldabagno:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.8" width="10" height="16.4" rx="5"/><path d="M9.4 12.6h5.2"/><path d="M9.2 21.2v1.2M14.8 21.2v1.2"/><path d="M12 6.2v3"/></svg>',
  caldaia:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.4" y="3.4" width="17.2" height="13.2" rx="2.6"/><path d="M7.4 20.4v-3.8M16.6 20.4v-3.8"/><path d="M12 7.2c1.5 1.5 2.2 2.7 2.2 3.8a2.2 2.2 0 0 1-4.4 0c0-.7.3-1.3.8-1.9.1.7.5 1.1 1 1.2-.2-1.1 0-2.2.4-3.1Z"/></svg>',
  /* La stufa (#183): il corpo in piedi, il vetro col fuoco dentro e la canna
   * che sale — la caldaia e' una scatola appesa, questa sta sul pavimento. */
  stufa:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9.6 6V2.4"/><rect x="5" y="6" width="14" height="13.6" rx="2.6"/><rect x="8.1" y="9.1" width="7.8" height="7.2" rx="1.4"/><path d="M12 10.9c.9.9 1.3 1.6 1.3 2.3a1.3 1.3 0 0 1-2.6 0c0-.6.4-1.1.8-1.5"/><path d="M7.4 19.6v2M16.6 19.6v2"/></svg>',
});

/* ── le due scene nuove ────────────────────────────────────────────────── */

/* Una targhetta: le stesse dei numeri del solare — fondo scuro, cifre grandi,
 * etichetta piccola sopra — perche' e' cosi' che questa pagina dice i numeri e
 * inventarne un'altra forma vorrebbe dire due lingue nella stessa stanza. */
function targhetta(etichetta, valore, unita, colore, extra = "") {
  return `<div class="dm-it-plate"${extra}>
    <span class="dm-it-plate-lbl">${esc(etichetta)}</span>
    <b class="dm-it-plate-val" style="color:${colore}">${esc(valore)}<i>${esc(unita)}</i></b>
  </div>`;
}

const NUMERO = (valore, cifre = 1) => formatNumber(valore, cifre);

/* Una targhetta senza numero non si disegna.
 *
 * «Prevedi anche il semplice utilizzo senza sonde di temperatura: deve essere
 * libero di scelta.» Chi ha solo il rele' dello scaldabagno, o solo lo stato
 * della caldaia, non ha temperature da mostrare — e cinque targhette con «--»
 * non sono una scheda spoglia: sono cinque promesse non mantenute. Le caselle
 * che non ci sono non lasciano un buco: lasciano posto. */
function nodoTarghetta(
  posizione,
  etichetta,
  valore,
  unita,
  colore,
  cifre = 1,
  extra = "",
  classe = "",
) {
  if (valore == null) return "";
  /* Watt e wattora salgono di scala al migliaio, come in tutta la plancia: una
   * targhetta che dice «1211 W» accanto a un cerchio che dice «1,21 kW» sono
   * due unita' per la stessa cosa. Gradi, litri e per cento restano come
   * sono — multipli qui non ne hanno. */
  const salita = laMisuraDallUnita(valore, unita, { decimali: cifre });
  /* Il nome in coda serve al telefono: le posizioni sono scritte in linea, e
   * per spostare un nodo su uno schermo stretto ci vuole qualcosa che il
   * vestito sappia chiamare per nome. */
  return `<div class="dm-it-nodo dm-it-nodo-plate ${classe}" style="${posizione}">
    ${targhetta(
      etichetta,
      salita ? salita.numero : NUMERO(valore, cifre),
      salita ? ` ${salita.unita}` : unita,
      colore,
      extra,
    )}
  </div>`;
}

function scenaScaldabagno(letture) {
  if (!letture.length)
    return `<div class="dm-it-vuoto">${esc(
      t(
        "Nessuno scaldabagno configurato: aggiungilo dalla scheda Solare della configurazione.",
        "No water heater configured: add one from the Solar tab in settings.",
      ),
    )}</div>`;
  const unita = letture[0];
  /* Il livello dell'acqua calda nel serbatoio: e' la stessa quota della
   * tessera in Home, e disegnarla qui col riempimento e' il modo piu' diretto
   * di dire «quanto manca» senza scrivere una percentuale.
   *
   * Chi non ha sonde quella quota non ce l'ha, e un serbatoio disegnato vuoto
   * direbbe «non c'e' acqua calda» — che e' un'affermazione, non un'assenza di
   * dati. Senza sonde il serbatoio si riempie tutto e parla il colore: caldo
   * mentre la resistenza lavora, acciaio quando e' ferma. */
  const conSonde = unita.quota != null;
  const quota = conSonde ? Math.round(unita.quota * 100) : 100;
  const acceso = unita.acceso === true;
  const comando = clean(unita.comandabile);
  return `<div class="dm-it-scena" data-dm-it-scena="scaldabagno" data-acceso="${acceso}"
      data-sonde="${conSonde}">
    <svg class="dm-it-tubi" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
      <path class="dm-it-tubo" d="M 548 244 L 640 244 L 700 214 L 700 58"/>
      <path class="dm-it-tubo-int" d="M 548 244 L 640 244 L 700 214 L 700 58"/>
      <path class="dm-it-flusso dm-it-flusso-caldo" d="M 548 244 L 640 244 L 700 214 L 700 58"/>
      <path class="dm-it-tubo" d="M 486 386 L 400 386 L 340 416 L 340 552"/>
      <path class="dm-it-tubo-int" d="M 486 386 L 400 386 L 340 416 L 340 552"/>
      <path class="dm-it-flusso dm-it-flusso-freddo" d="M 340 552 L 340 416 L 400 386 L 486 386"/>
    </svg>

    <div class="dm-it-nodo" style="left:52%;top:52%">
      <div class="dm-it-tank">
        <span class="dm-it-tank-cap" aria-hidden="true"></span>
        <span class="dm-it-tank-acqua" style="height:${quota}%"></span>
        <span class="dm-it-tank-vetro" aria-hidden="true"></span>
        <span class="dm-it-resistenza" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="dm-it-tank-base" aria-hidden="true"></span>
      </div>
      <span class="dm-it-nome">${esc(unita.name || t("Scaldabagno", "Water heater"))}</span>
    </div>

    ${nodoTarghetta("left:16%;top:28%", t("Acqua adesso", "Water now"), unita.temperatura, "°C", "#f97316")}
    ${nodoTarghetta("left:16%;top:64%", t("Obiettivo", "Target"), unita.obiettivo, "°C", "#38bdf8")}
    ${nodoTarghetta("left:85%;top:28%", t("Consumo", "Power"), unita.potenza, " W", "#a78bfa", 0)}
    ${nodoTarghetta("left:85%;top:64%", t("Oggi", "Today"), unita.energia, " kWh", "#34d399")}

    <div class="dm-it-nodo" style="left:52%;top:88%">
      ${
        comando && siComanda(comando)
          ? `<button type="button" class="dm-it-interruttore" data-dm-it-toggle="${esc(comando)}"
              data-on="${acceso}" aria-pressed="${acceso}">
              <span class="dm-it-interruttore-ic" aria-hidden="true">⏻</span>
              <span>${esc(acceso ? t("Resistenza accesa", "Element on") : t("Resistenza spenta", "Element off"))}</span>
            </button>`
          : `<span class="dm-it-etichetta" data-on="${acceso}">${esc(
              acceso ? t("Resistenza accesa", "Element on") : t("Resistenza spenta", "Element off"),
            )}</span>`
      }
    </div>
  </div>`;
}

/* Quale macchina di questo tipo si sta guardando.
 *
 * Quella scelta l'ultima volta se c'e' ancora; altrimenti la prima. Chi
 * cancella la caldaia che stava guardando non deve restare su una scena
 * vuota. */
function macchinaScelta(tipo, righe) {
  if (!righe.length) return "";
  const salvata = clean(state.quale?.[tipo]);
  return righe.some((riga) => riga.id === salvata) ? salvata : righe[0].id;
}

/* Gli impianti solari, che possono essere più d'uno.
 *
 * Quello che la scena disegna è sempre l'impianto scritto nelle mappature
 * `dm.boiler_*`: passare a un altro vuol dire scriverci il suo. Nessuno
 * intercetta niente — la scena del guscio continua a leggere l'unico posto che
 * ha sempre letto, e legge l'impianto che si sta guardando. */
function impiantiSolariDiCasa() {
  return impiantiSolari(
    readJson(CHIAVE_SOLARI, []),
    readJson("cd_entity_overrides", {}),
    clean(root.localStorage?.getItem?.(CHIAVE_SOLARE_SCELTO)),
  );
}

function passaAlSolare(id) {
  const lista = impiantiSolariDiCasa();
  const scelto = lista.find((riga) => riga.id === clean(id));
  if (!scelto || scelto.corrente) return false;
  /* L'impianto che esce di scena si porta via le sue caselle: sono quelle che
   * stanno nelle mappature adesso, e senza rimetterle in elenco andrebbero
   * perse alla prima scrittura di quello che entra. */
  const prima = lista.map((riga) => ({ id: riga.id, nome: riga.nome, caselle: riga.caselle }));
  writeJsonIfChanged(CHIAVE_SOLARI, prima);
  root.localStorage?.setItem?.(CHIAVE_SOLARE_SCELTO, scelto.id);
  const prossime = overridesPerSolare(readJson("cd_entity_overrides", {}), scelto);
  writeJsonIfChanged("cd_entity_overrides", prossime);
  /* Il guscio tiene la sua copia in memoria, ed è quella che il proxy degli
   * stati consulta a ogni lettura. */
  try {
    root.cdApplyCanonicalOverrides?.(prossime);
  } catch (_error) {}
  try {
    root.render?.();
  } catch (_error) {}
  return true;
}

function filaDegliSolari(lista) {
  if (lista.length < 2) return "";
  return `<div class="dm-it-quali" role="tablist">${lista
    .map(
      (
        riga,
        indice,
      ) => `<button type="button" class="dm-it-quale" data-dm-it-solare="${esc(riga.id)}"
        role="tab" aria-selected="${riga.corrente === true}"${riga.corrente ? ' data-on="true"' : ""}
        >${esc(nomeDelSolare(riga, indice, [t("Solare termico", "Solar thermal"), ""]))}</button>`,
    )
    .join("")}</div>`;
}

function filaDelleMacchine(righe, scelta) {
  if (righe.length < 2) return "";
  return `<div class="dm-it-quali" role="tablist">${righe
    .map(
      (
        riga,
        indice,
      ) => `<button type="button" class="dm-it-quale" data-dm-it-quale="${esc(riga.id)}"
        role="tab" aria-selected="${riga.id === scelta}"${riga.id === scelta ? ' data-on="true"' : ""}
        >${esc(clean(riga.name) || `${t("Macchina", "Unit")} ${indice + 1}`)}</button>`,
    )
    .join("")}</div>`;
}

/* Le elettrovalvole di riciclo, sul tubo (#274).
 *
 * «Non mostra le elettrovalvole di riciclo»: sono quelle che smistano l'acqua
 * fra il riscaldamento e il sanitario, e da come stanno si capisce dove sta
 * andando il calore — che è metà di quello che si viene a guardare qui. Una
 * valvola che nessuno ha mappato non compare: non è una valvola chiusa, è una
 * valvola che non c'è. */
function valvoleMarkup(lettura) {
  const valvole = Array.isArray(lettura.valvole) ? lettura.valvole : [];
  if (!valvole.length) return "";
  const posti = ["left:50%;top:62%", "left:50%;top:24%"];
  return valvole
    .map(
      (valvola, indice) => `<div class="dm-it-nodo" style="${posti[indice] || posti[0]}">
      <span class="dm-it-valvola" data-aperta="${valvola.acceso === true}" aria-hidden="true"><i></i></span>
      <span class="dm-it-nome">${esc(
        indice === 0
          ? t("Elettrovalvola", "Solenoid valve")
          : t("Elettrovalvola 2", "Solenoid valve 2"),
      )}</span>
      <span class="dm-it-valvola-stato">${esc(
        valvola.acceso === true
          ? t("Aperta", "Open")
          : valvola.acceso === false
            ? t("Chiusa", "Closed")
            : /* Un trattino non è una parola da tradurre. */ "—",
      )}</span>
    </div>`,
    )
    .join("");
}

/* ── quello che si vede di una caldaia a pellet (#346) ──────────────────
 *
 * «Nella sezione caldaia vorrei inserire: temperatura caldaia, temperatura
 * alta e bassa del boiler, temperatura fumi, comando ventilatore fumi,
 * ossigeno residuo, livello riempimento pellet, temperatura mandata
 * calcolata.»
 *
 * Ognuna di queste letture compare SOLO se qualcuno l'ha mappata: la scena
 * della caldaia e' la stessa di prima — la scocca, l'oblo', i due tubi — e
 * queste ci si aggiungono attorno. Chi ha una caldaia a gas non vede niente
 * di nuovo, perche' non ha niente di nuovo da vedere. */

/* La combustione, accanto alla fiamma.
 *
 * Fumi, ossigeno e ventilatore stanno vicino all'oblo' perche' e' della
 * fiamma che parlano: quanto calore se ne va per il camino, quanta aria
 * avanza, quanto tira l'aspiratore. Il ventilatore dice una percentuale se
 * l'entita' ne ha una, e altrimenti acceso o spento — quale delle due lo
 * decide la lettura, non chi configura. */
function combustioneMarkup(lettura) {
  const ventilatore = lettura.ventilatore;
  const soffio =
    ventilatore?.percento != null
      ? `${NUMERO(ventilatore.percento, 0)}%`
      : ventilatore?.acceso === true
        ? t("Acceso", "On")
        : ventilatore?.acceso === false
          ? t("Spento", "Off")
          : null;
  const righe = [
    [t("Fumi", "Flue gas"), lettura.fumi == null ? null : `${NUMERO(lettura.fumi, 0)}°`],
    [t("Ossigeno", "Oxygen"), lettura.ossigeno == null ? null : `${NUMERO(lettura.ossigeno, 1)}%`],
    [t("Ventilatore", "Fan"), soffio],
  ].filter(([, valore]) => valore != null);
  if (!righe.length) return "";
  return `<div class="dm-it-nodo dm-it-nodo-fuoco" style="left:11%;top:46%">
    <div class="dm-it-fuoco">${righe
      .map(
        ([etichetta, valore]) => `<span class="dm-it-fuoco-riga">
          <span class="dm-it-fuoco-lbl">${esc(etichetta)}</span>
          <b class="dm-it-fuoco-val">${esc(valore)}</b>
        </span>`,
      )
      .join("")}</div>
  </div>`;
}

/* Il serbatoio del pellet: un riempimento, non un numero.
 *
 * «Livello riempimento pellet» e' la lettura che si guarda per sapere se si
 * deve ordinare: un serbatoio disegnato la dice a colpo d'occhio meglio di
 * una percentuale scritta, e sotto la soglia diventa rosso. Chi legge in
 * chili — una bilancia sotto il silo — non ha una quota da riempire: quel
 * numero e' quello che e', e disegnare mezzo serbatoio sarebbe inventarselo. */
function pelletMarkup(lettura) {
  /* Con due serbatoi (#182) la scena li mette affiancati; con uno solo resta
   * il disegno di sempre, nello stesso posto e con le stesse parole — chi ha
   * un serbatoio solo non deve accorgersi di niente. Uno solo e' il primo, o
   * il secondo quando e' l'unico che risponde. */
  const serbatoi = serbatoiDellaCaldaia(lettura);
  if (serbatoi.length > 1) return dueSerbatoiMarkup(serbatoi);
  const solo = serbatoi[0] || { pellet: null, chili: null };
  const quota = solo.pellet;
  if (quota == null)
    return nodoTarghetta(
      "left:11%;top:80%",
      t("Pellet", "Pellet"),
      solo.chili,
      " kg",
      "#d97706",
      0,
      "",
      "dm-it-nodo-pellet",
    );
  const pieno = Math.max(0, Math.min(100, quota));
  const scritta = `${t("Pellet", "Pellet")} ${NUMERO(quota, 0)}%`;
  return `<div class="dm-it-nodo dm-it-nodo-pellet" style="left:11%;top:80%">
    <div class="dm-it-pellet" data-scarso="${pelletScarso(quota) === true}" role="img"
      aria-label="${esc(scritta)}">
      <span class="dm-it-pellet-liv" style="height:${pieno}%"></span>
    </div>
    <span class="dm-it-nome">${esc(scritta)}</span>
  </div>`;
}

/* I due serbatoi (#182), affiancati in un nodo solo.
 *
 * «Ce n'e' una ma la utilizzo gia'. E me ne servirebbe una seconda.» Sono due
 * misure della stessa scorta, e la scena le tiene vicine come le due sonde del
 * boiler: «Pellet 1» e «Pellet 2», ognuno col suo riempimento e il suo numero
 * dentro. Diventano rossi uno per uno — quello che sta finendo e' quello da
 * riempire, e un serbatoio pieno accanto non lo deve coprire. Uno in chili
 * resta un numero anche qui: non si disegna una quota che nessuno ha dato. */
function dueSerbatoiMarkup(serbatoi) {
  const disegni = serbatoi.map((serbatoio, indice) => {
    const nome = `${t("Pellet", "Pellet")} ${indice + 1}`;
    if (serbatoio.pellet == null)
      return `<div class="dm-it-serbatoio">
        <div class="dm-it-pellet dm-it-pellet-chili" role="img"
          aria-label="${esc(`${nome}: ${NUMERO(serbatoio.chili, 0)} kg`)}">
          <b class="dm-it-pellet-cifra">${esc(NUMERO(serbatoio.chili, 0))}<i>kg</i></b>
        </div>
        <span class="dm-it-nome">${esc(nome)}</span>
      </div>`;
    const pieno = Math.max(0, Math.min(100, serbatoio.pellet));
    const cifra = `${NUMERO(serbatoio.pellet, 0)}%`;
    return `<div class="dm-it-serbatoio">
      <div class="dm-it-pellet" data-scarso="${serbatoio.scarso}" role="img"
        aria-label="${esc(`${nome}: ${cifra}`)}">
        <span class="dm-it-pellet-liv" style="height:${pieno}%"></span>
        <b class="dm-it-pellet-cifra">${esc(cifra)}</b>
      </div>
      <span class="dm-it-nome" data-scarso="${serbatoio.scarso}">${esc(nome)}</span>
    </div>`;
  });
  return `<div class="dm-it-nodo dm-it-nodo-serbatoi" style="left:12%;top:79%">
    <div class="dm-it-serbatoi">${disegni.join("")}</div>
  </div>`;
}

/* Le due sonde dell'accumulo sanitario, sul serbatoio.
 *
 * «Temperatura alta e bassa del boiler»: sono due numeri di una cosa sola, e
 * stanno addosso al disegno del serbatoio invece che in due targhette in giro
 * per la scena. L'alta si scalda per prima e la bassa per ultima: le due
 * insieme dicono quanta acqua calda e' rimasta. */
function sondeBoilerMarkup(lettura) {
  const righe = [
    [t("Alto", "Top"), lettura.boilerAlto],
    [t("Basso", "Bottom"), lettura.boilerBasso],
  ].filter(([, valore]) => valore != null);
  if (!righe.length) return "";
  return `<span class="dm-it-sonde">${righe
    .map(
      ([etichetta, valore]) =>
        `<span class="dm-it-sonda">${esc(etichetta)}<b>${esc(NUMERO(valore, 0))}°</b></span>`,
    )
    .join("")}</span>`;
}

/* L'interruttore e lo stato, in fondo alla scena (#274).
 *
 * «Non permette accensione/spegnimento della caldaia, non mostra lo stato
 * standby/in funzione.» Lo stato lo si dice sempre — prima compariva solo per
 * chi non aveva né sonde né pressione — e il tasto compare a chi ha mappato un
 * interruttore: senza, sarebbe un tasto che non comanda niente. */
/* Le parole che non dicono niente: non sono una fase, sono un'assenza. */
const STATI_MUTI = new Set(["", "unavailable", "unknown", "none", "null"]);

function interruttoreMarkup(lettura) {
  const lavora = lettura.inFunzione;
  /* Una centralina a pellet racconta il suo ciclo per fasi, e ogni tanto ne
   * dice una che non sappiamo tradurre in «lavora» o «riposa» — un guasto, un
   * autotest (#346). Scriverla com'e' e' l'unica risposta onesta: dire «stato
   * non mappato» a chi lo stato l'ha mappato eccome sarebbe una bugia. */
  const parola = clean(lettura.statoTesto);
  const grezzo = STATI_MUTI.has(parola.toLowerCase()) ? "" : parola;
  const stato = `<span class="dm-it-stato-caldaia" data-lavora="${lavora === true}">${esc(
    lavora === true
      ? t("In funzione", "Running")
      : lavora === false
        ? t("A riposo", "Standby")
        : grezzo || t("Stato non mappato", "State not mapped"),
  )}</span>`;
  const tasto = clean(lettura.interruttore)
    ? `<button type="button" class="dm-it-lev-caldaia" data-dm-it-caldaia="${esc(
        lettura.interruttore,
      )}" role="switch" aria-checked="${lettura.interruttoreAcceso === true}"
      aria-label="${esc(t("Accendi o spegni la caldaia", "Turn the boiler on or off"))}"><i></i></button>`
    : "";
  return `<div class="dm-it-comandi-caldaia">${stato}${tasto}</div>`;
}

function scenaCaldaia(lettura) {
  if (!lettura)
    return `<div class="dm-it-vuoto">${esc(
      t(
        "Nessuna caldaia configurata: aggiungila dalla scheda Gestione termica della configurazione.",
        "No boiler configured: add one from the Thermal management tab in settings.",
      ),
    )}</div>`;
  const acceso = lettura.acceso === true || lettura.fiamma === true;
  const pressione = verdettoPressione(lettura.pressione);
  const salto = lettura.salto;
  /* Chi ha mappato solo lo stato — «prevedi anche il semplice utilizzo senza
   * sonde» — ha una caldaia che dice acceso e spento, e basta. Quella e' una
   * scheda legittima: la scocca, la fiamma, il circuito che si scalda. Le
   * targhette dei gradi non ci sono perche' non ci sono i gradi, non perche'
   * qualcuno ha sbagliato a configurare. */
  const conSonde = lettura.mandata != null || lettura.ritorno != null;
  /* La fiamma nell'oblo' segue il bruciatore quando qualcuno l'ha mappato; chi
   * ha mappato solo lo stato non ha un bruciatore da leggere, e allora e' lo
   * stato a dire se la macchina lavora — dipingere l'oblo' spento sopra una
   * caldaia accesa direbbe il contrario di quello che si sa. */
  const brucia = lettura.fiamma === true || (lettura.fiamma == null && lettura.acceso === true);
  return `<div class="dm-it-scena" data-dm-it-scena="caldaia" data-acceso="${acceso}"
      data-fiamma="${brucia}" data-sonde="${conSonde}">
    <svg class="dm-it-tubi" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
      <path class="dm-it-tubo" d="M 300 296 L 640 296 L 720 336 L 800 336"/>
      <path class="dm-it-tubo-int" d="M 300 296 L 640 296 L 720 336 L 800 336"/>
      <path class="dm-it-flusso dm-it-flusso-caldo" d="M 300 296 L 640 296 L 720 336 L 800 336"/>
      <path class="dm-it-tubo" d="M 300 384 L 660 384 L 700 364 L 800 364"/>
      <path class="dm-it-tubo-int" d="M 300 384 L 660 384 L 700 364 L 800 364"/>
      <path class="dm-it-flusso dm-it-flusso-freddo" d="M 800 364 L 700 364 L 660 384 L 300 384"/>
    </svg>

    <div class="dm-it-nodo" style="left:26%;top:48%">
      <div class="dm-it-caldaia">
        <span class="dm-it-caldaia-testa" aria-hidden="true"></span>
        <span class="dm-it-oblo" aria-hidden="true"><i class="dm-it-fiamma"></i></span>
        ${
          lettura.mandata == null
            ? ""
            : `<span class="dm-it-caldaia-display" aria-hidden="true"><b>${esc(NUMERO(lettura.mandata, 0))}</b></span>`
        }
        <span class="dm-it-caldaia-piede" aria-hidden="true"></span>
      </div>
      <span class="dm-it-nome">${esc(lettura.name || t("Caldaia", "Boiler"))}</span>
    </div>

    <div class="dm-it-nodo" style="left:84%;top:59%">
      ${
        /* «Richiesta di visualizzare o radiatore o boiler» (#274): la scena
         * disegnava sempre un radiatore, e chi ha una caldaia che serve solo
         * l'accumulo ci vedeva un termosifone che non ha. */
        lettura.uscita === "boiler"
          ? `<div class="dm-it-accumulo" aria-hidden="true"><i></i></div>`
          : `<div class="dm-it-radiatore" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>`
      }
      <span class="dm-it-nome">${esc(
        lettura.uscita === "boiler" ? t("Boiler", "Tank") : t("Impianto", "Circuit"),
      )}</span>
      ${sondeBoilerMarkup(lettura)}
    </div>

    ${valvoleMarkup(lettura)}
    ${interruttoreMarkup(lettura)}

    ${nodoTarghetta("left:64%;top:20%", t("Mandata", "Flow"), lettura.mandata, "°C", "#f43f5e")}
    ${nodoTarghetta("left:64%;top:80%", t("Ritorno", "Return"), lettura.ritorno, "°C", "#38bdf8")}
    ${nodoTarghetta(
      "left:26%;top:14%",
      t("Pressione", "Pressure"),
      lettura.pressione,
      " bar",
      pressione === "bassa" ? "#f43f5e" : pressione === "alta" ? "#f59e0b" : "#34d399",
      1,
      pressione ? ` data-dm-it-pressione="${pressione}"` : "",
    )}
    ${nodoTarghetta("left:26%;top:84%", t("Acqua calda", "Hot water"), lettura.acquaCalda, "°C", "#fb923c")}

    ${nodoTarghetta(
      "left:44%;top:12%",
      t("Corpo caldaia", "Boiler body"),
      lettura.temperaturaCaldaia,
      "°C",
      "#fb7185",
      0,
      "",
      "dm-it-nodo-corpo",
    )}
    ${combustioneMarkup(lettura)}
    ${pelletMarkup(lettura)}
    ${
      /* L'obiettivo che la centralina si e' data, accanto alla mandata vera:
       * i due numeri uno sopra l'altro dicono se la caldaia ci sta
       * arrivando. */
      lettura.mandataCalcolata == null
        ? ""
        : `<div class="dm-it-nodo" style="left:64%;top:31%">
            <span class="dm-it-obiettivo">${esc(t("Calcolata", "Calculated"))}
              <b>${esc(NUMERO(lettura.mandataCalcolata, 0))}°</b>
            </span>
          </div>`
    }

    ${
      salto == null
        ? ""
        : `<div class="dm-it-nodo" style="left:57%;top:41%">
            <span class="dm-it-salto" data-cede="${salto >= 3}">
              ${esc(t("Salto", "Delta"))} <b>${esc(NUMERO(salto))}°</b>
            </span>
          </div>`
    }

    ${
      pressione === "bassa"
        ? `<div class="dm-it-allarme">${esc(
            t(
              "Pressione sotto il minimo: la caldaia puo' bloccarsi.",
              "Pressure below minimum: the boiler may lock out.",
            ),
          )}</div>`
        : ""
    }
  </div>`;
}

/* ── la stufa a pellet (#183) ───────────────────────────────────────────
 *
 * «E' possibile inserire una scheda per inserire i dati delle stufe a
 * pellet?»
 *
 * La stufa sta in piedi in mezzo alla scena, nella stessa lingua della
 * caldaia: il corpo chiaro, il vetro scuro col fuoco dietro, la canna fumaria
 * che sale con la sua targhetta, il serbatoio accanto, la stanza che scalda.
 * Il fuoco c'e' solo quando brucia, e cresce con la potenza; nello spegnimento
 * resta la brace. L'aria calda esce dalla griglia tanto piu' svelta quanto piu'
 * gira il ventilatore.
 *
 * I comandi stanno in un quadro a parte, a destra sul computer e sotto la
 * scena sul telefono: accesa e spenta, l'obiettivo, la potenza, il
 * ventilatore. Ognuno compare solo se c'e' qualcosa da comandare, e un «+» in
 * cima alla scala e' spento prima di premerlo invece che dopo. */

/* La parola della fase: quella della pagina se la fase si riconosce, la
 * parola della stufa com'e' se non la si riconosce — come la caldaia con una
 * fase che non conosce — e accesa o spenta quando una fase non c'e'. */
function parolaDellaFase(lettura) {
  if (lettura.fase) return t(...FASI_STUFA[lettura.fase]);
  const grezza = clean(lettura.statoTesto);
  if (grezza && !STATI_MUTI.has(grezza.toLowerCase())) return grezza;
  if (lettura.acceso === true) return t("Accesa", "On");
  if (lettura.acceso === false) return t("Spenta", "Off");
  return t("Stato non mappato", "State not mapped");
}

/* Quanto e' alto il fuoco: piccolo mentre si accende, basso quando modula,
 * e nel lavoro tanto piu' alto quanto piu' alta e' la potenza. Senza potenza
 * mappata, la meta' giusta. */
function altezzaDelFuoco(lettura) {
  if (lettura.fase === "accensione") return 0.55;
  if (lettura.fase === "modulazione") return 0.7;
  const potenza = lettura.potenza;
  if (potenza?.livello != null && potenza.quanti)
    return Math.round((0.62 + 0.5 * Math.min(1, potenza.livello / potenza.quanti)) * 100) / 100;
  return 0.9;
}

/* Il ventilatore gira, e quanto. Il disegno dell'aria calda e la ventola del
 * quadro usano la stessa misura: un giro lungo a velocita' uno, corto alla
 * cinque. Senza ventilatore mappato l'aria esce mentre la stufa brucia, a
 * velocita' media — la convezione c'e' comunque. */
function ventoDellaStufa(lettura) {
  const ventola = lettura.ventilatore;
  if (!ventola) return { gira: lettura.brucia === true, durata: 1.4 };
  const fermo =
    ventola.acceso === false ||
    ventola.valore === 0 ||
    (ventola.modo === "interruttore" && ventola.acceso !== true);
  if (fermo) return { gira: false, durata: 1.4 };
  const quota =
    ventola.livello != null && ventola.quanti ? Math.min(1, ventola.livello / ventola.quanti) : 0.5;
  return { gira: true, durata: Math.round((2 - 1.4 * quota) * 100) / 100 };
}

function disegnoStufa(lettura) {
  const potenza = lettura.potenza;
  /* Sul display si legge la potenza a cui brucia, come su quello vero. */
  const display = lettura.brucia && potenza?.livello != null ? `P${potenza.livello}` : "";
  return `<div class="dm-it-stufa">
    <span class="dm-it-stufa-piano" aria-hidden="true">${
      display ? `<i class="dm-it-stufa-display">${esc(display)}</i>` : ""
    }</span>
    <span class="dm-it-stufa-griglia" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    <span class="dm-it-stufa-porta" aria-hidden="true">
      <span class="dm-it-stufa-vetro">
        <i class="dm-it-stufa-brace"></i>
        <i class="dm-it-stufa-lingua"></i><i class="dm-it-stufa-lingua"></i><i class="dm-it-stufa-lingua"></i>
      </span>
      <i class="dm-it-stufa-maniglia"></i>
    </span>
    <span class="dm-it-stufa-cassetto" aria-hidden="true"></span>
    <span class="dm-it-stufa-piedi" aria-hidden="true"><i></i><i></i></span>
  </div>`;
}

/* Il serbatoio della stufa: lo stesso disegno di quello della caldaia.
 *
 * In percentuale si riempie, in chili e' una targhetta, e col solo
 * `binary_sensor` di «pellet in esaurimento» la quota non si inventa: il
 * serbatoio resta del colore dell'acciaio finche' va tutto bene, e diventa
 * rosso e quasi vuoto quando il sensore scatta. */
function pelletDellaStufaMarkup(lettura) {
  const posto = "left:12%;top:71%";
  const classe = "dm-it-nodo dm-it-nodo-pellet-stufa";
  if (lettura.pelletAvviso) {
    if (lettura.pelletScarso == null) return "";
    const scarso = lettura.pelletScarso === true;
    const scritta = scarso
      ? t("Pellet in esaurimento", "Pellet running low")
      : t("Pellet a posto", "Pellet OK");
    return `<div class="${classe}" style="${posto}">
      <div class="dm-it-pellet dm-it-pellet-avviso" data-scarso="${scarso}" role="img"
        aria-label="${esc(scritta)}"><span class="dm-it-pellet-liv" style="height:${scarso ? 14 : 100}%"></span></div>
      <span class="dm-it-nome" data-scarso="${scarso}">${esc(scritta)}</span>
    </div>`;
  }
  if (lettura.pellet == null)
    return nodoTarghetta(
      posto,
      t("Pellet", "Pellet"),
      lettura.pelletChili,
      " kg",
      "#d97706",
      0,
      "",
      "dm-it-nodo-pellet-stufa",
    );
  const scarso = pelletScarso(lettura.pellet) === true;
  const pieno = Math.max(0, Math.min(100, lettura.pellet));
  const scritta = `${t("Pellet", "Pellet")} ${NUMERO(lettura.pellet, 0)}%`;
  return `<div class="${classe}" style="${posto}">
    <div class="dm-it-pellet" data-scarso="${scarso}" role="img" aria-label="${esc(scritta)}">
      <span class="dm-it-pellet-liv" style="height:${pieno}%"></span>
    </div>
    <span class="dm-it-nome" data-scarso="${scarso}">${esc(scritta)}</span>
  </div>`;
}

/* La fascia rossa dell'allarme.
 *
 * Un allarme di una stufa non e' una lettura fra le altre: vuol dire che si e'
 * fermata, o che non riesce a partire, e di solito c'e' da andare a guardarla.
 * Si dice col testo che la stufa ha scritto — «Mancata accensione», «A01» — e
 * quando il sensore dice solo «acceso», si manda a guardare il display. */
function allarmeDellaStufaMarkup(lettura) {
  if (!lettura?.allarme?.attivo) return "";
  const testo =
    clean(lettura.allarme.testo) ||
    t("Guarda il display della stufa.", "Check the stove's display.");
  return `<div class="dm-it-stufa-allarme" role="alert">
    <span class="dm-it-stufa-allarme-ic" aria-hidden="true">⚠</span>
    <span class="dm-it-stufa-allarme-parole">
      <b>${esc(t("Allarme della stufa", "Stove alarm"))}</b>
      <span class="dm-it-stufa-allarme-testo">${esc(testo)}</span>
    </span>
  </div>`;
}

/* I pallini di un livello: tanti quanti i suoi scatti, accesi fino al suo. */
function pallini(livello) {
  if (!livello?.quanti) return "";
  const acceso = Math.max(0, Math.min(livello.quanti, Number(livello.livello) || 0));
  return `<span class="dm-it-stufa-punti" aria-hidden="true">${Array.from(
    { length: livello.quanti },
    (_voce, indice) => `<i data-on="${indice < acceso}"></i>`,
  ).join("")}</span>`;
}

/* Il valore di un livello, scritto: il numero, la scelta, la percentuale. Una
 * scelta passa dalle parole di Home Assistant — `auto` e' «Automatico» — e
 * quella che non si conosce, «P3» o «high», resta com'e'. */
function scrittaDelLivello(livello) {
  if (!livello || livello.disponibile === false) return "—";
  if (livello.modo === "percento") return `${NUMERO(livello.valore ?? 0, 0)}%`;
  if (livello.modo === "interruttore")
    return livello.acceso === true ? t("Acceso", "On") : t("Spento", "Off");
  if (livello.valore === null || livello.valore === undefined || livello.valore === "") return "—";
  if (typeof livello.valore === "number") return NUMERO(livello.valore, livello.passo < 1 ? 1 : 0);
  return parolaDiStato(livello.valore);
}

/* La ventola del quadro: gira quando gira quella vera, e allo stesso passo
 * dell'aria calda della scena. */
function ventola(vento) {
  const pala = "M12 10.2C10.3 9.4 9.5 6.9 10.4 5c.8-1.6 3.1-1.5 3.6.3.5 1.9-.4 3.9-2 4.9Z";
  return `<svg class="dm-it-stufa-ventola" viewBox="0 0 24 24" aria-hidden="true"
    data-gira="${vento.gira}" style="--dm-it-giro:${vento.durata}s">
    <circle class="dm-it-stufa-ventola-anello" cx="12" cy="12" r="10.6"/>
    <g class="dm-it-stufa-ventola-pale">
      <path d="${pala}"/><path d="${pala}" transform="rotate(120 12 12)"/>
      <path d="${pala}" transform="rotate(240 12 12)"/><circle cx="12" cy="12" r="1.9"/>
    </g>
  </svg>`;
}

/* Una riga del quadro: il nome, il «−», il valore, il «+».
 *
 * I due tasti dicono gia' prima del tocco se c'e' un passo da fare: in cima e
 * in fondo alla scala si spengono, e chi non puo' comandare quell'entita' —
 * quelle che si guardano e basta — li trova spenti tutti e due. */
function rigaDelQuadro(campo, etichetta, valore, { giu, su, nomi }) {
  return `<div class="dm-it-stufa-riga" data-dm-it-stufa-riga="${esc(campo)}">
    <span class="dm-it-stufa-lbl">${esc(etichetta)}</span>
    <span class="dm-it-stufa-regola">
      <button type="button" class="dm-it-stufa-passo" data-dm-it-stufa-passo="${esc(campo)}"
        data-verso="-1" aria-label="${esc(nomi[0])}"${giu ? "" : " disabled"}>−</button>
      <span class="dm-it-stufa-val">${valore}</span>
      <button type="button" class="dm-it-stufa-passo" data-dm-it-stufa-passo="${esc(campo)}"
        data-verso="1" aria-label="${esc(nomi[1])}"${su ? "" : " disabled"}>+</button>
    </span>
  </div>`;
}

function quadroDellaStufa(lettura) {
  const righe = [];
  const comando = clean(lettura.comando);
  /* In testa la fase, e accanto il tasto che accende e spegne.
   *
   * Lo stato lo dice gia' la fase, qui a sinistra: il tasto dice quello che
   * fa. Con la parola dello stato si leggeva «Spenta» due volte di fila su una
   * stufa spenta — due modi di dire la stessa cosa, e nessuno che dicesse cosa
   * succede a premere. Il colore resta quello della pagina: arancio vuol dire
   * accesa, come la resistenza dello scaldabagno. */
  const acceso = lettura.acceso === true;
  const tasto =
    comando && siComanda(comando)
      ? `<button type="button" class="dm-it-interruttore dm-it-stufa-accendi"
          data-dm-it-stufa-accendi="${!acceso}" data-on="${acceso}">
          <span class="dm-it-interruttore-ic" aria-hidden="true">⏻</span>
          <span>${esc(acceso ? t("Spegni", "Turn off") : t("Accendi", "Turn on"))}</span>
        </button>`
      : "";
  righe.push(`<div class="dm-it-stufa-testa">
    <span class="dm-it-stufa-fase" data-fase="${esc(lettura.fase || "")}"
      data-brucia="${lettura.brucia}">${esc(parolaDellaFase(lettura))}</span>${tasto}
  </div>`);
  if (lettura.obiettivo != null) {
    const libero = siComanda(lettura.clima);
    righe.push(
      rigaDelQuadro(
        "obiettivo",
        t("Obiettivo", "Target"),
        `<b>${esc(NUMERO(lettura.obiettivo, 1))}</b><span class="dm-it-stufa-unita">°C</span>`,
        {
          giu: libero && prossimoObiettivo(lettura, -1) !== null,
          su: libero && prossimoObiettivo(lettura, 1) !== null,
          nomi: [
            t("Abbassa l'obiettivo", "Lower the target"),
            t("Alza l'obiettivo", "Raise the target"),
          ],
        },
      ),
    );
  }
  if (lettura.potenza) {
    const libero = siComanda(lettura.potenza.entity);
    righe.push(
      rigaDelQuadro(
        "potenza",
        t("Potenza", "Power level"),
        `${pallini(lettura.potenza)}<b>${esc(scrittaDelLivello(lettura.potenza))}</b>`,
        {
          giu: libero && prossimoLivello(lettura.potenza, -1) !== null,
          su: libero && prossimoLivello(lettura.potenza, 1) !== null,
          nomi: [
            t("Abbassa la potenza", "Lower the power"),
            t("Alza la potenza", "Raise the power"),
          ],
        },
      ),
    );
  }
  if (lettura.ventilatore) {
    const libero = siComanda(lettura.ventilatore.entity);
    righe.push(
      rigaDelQuadro(
        "ventilatore",
        t("Ventilatore", "Fan"),
        `${ventola(ventoDellaStufa(lettura))}<b>${esc(scrittaDelLivello(lettura.ventilatore))}</b>`,
        {
          giu: libero && prossimoLivello(lettura.ventilatore, -1) !== null,
          su: libero && prossimoLivello(lettura.ventilatore, 1) !== null,
          nomi: [
            t("Rallenta il ventilatore", "Slow the fan down"),
            t("Accelera il ventilatore", "Speed the fan up"),
          ],
        },
      ),
    );
  }
  return `<div class="dm-it-stufa-pannello" data-dm-it-stufa="${esc(lettura.id)}" role="group"
    aria-label="${esc(t("Comandi della stufa", "Stove controls"))}">${righe.join("")}</div>`;
}

function scenaStufa(lettura) {
  if (!lettura)
    return `<div class="dm-it-vuoto">${esc(
      t(
        "Nessuna stufa configurata: aggiungila dalla scheda Gestione termica della configurazione.",
        "No stove configured: add one from the Thermal management tab in settings.",
      ),
    )}</div>`;
  const vento = ventoDellaStufa(lettura);
  /* La canna parte da dietro la stufa e sale: il primo tratto e' coperto dal
   * corpo, cosi' esce dal piano qualunque sia l'altezza a cui lo schermo
   * disegna la stufa. Il fumo sale solo quando brucia. */
  const canna = "M 300 300 L 300 92 L 360 62 L 360 -20";
  /* L'aria calda va dalla griglia della stufa alla stanza: parte da dietro il
   * corpo e finisce dietro la targhetta della stanza. Le strade sono due
   * perche' sul telefono la targhetta sta altrove — in colonna a destra — e
   * una curva sola finirebbe nel vuoto. Senza la temperatura della stanza non
   * c'e' una targhetta dove l'aria arrivi, e la curva non si disegna. */
  const aria =
    lettura.temperatura == null
      ? ""
      : [
          ["computer", "M 300 248 C 430 248 470 300 550 300"],
          ["telefono", "M 300 216 C 450 216 640 228 750 228"],
        ]
          .map(
            ([dove, strada]) => `<path class="dm-it-aria-scia dm-it-aria-${dove}" d="${strada}"/>
          <path class="dm-it-aria-calda dm-it-aria-${dove}" d="${strada}"/>`,
          )
          .join("");
  return `${allarmeDellaStufaMarkup(lettura)}<div class="dm-it-scena" data-dm-it-scena="stufa"
      data-acceso="${lettura.acceso === true}" data-brucia="${lettura.brucia === true}"
      data-brace="${lettura.brace === true}" data-fase="${esc(lettura.fase || "")}"
      data-aria="${vento.gira}" data-allarme="${lettura.allarme?.attivo === true}"
      style="--dm-it-fuoco:${altezzaDelFuoco(lettura)};--dm-it-aria:${vento.durata}s">
    <svg class="dm-it-tubi" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
      <path class="dm-it-canna" d="${canna}"/>
      <path class="dm-it-canna-int" d="${canna}"/>
      <path class="dm-it-flusso dm-it-flusso-fumo" d="${canna}"/>
      ${aria}
    </svg>

    <div class="dm-it-nodo dm-it-nodo-stufa" style="left:30%;top:55%">
      ${disegnoStufa(lettura)}
      <span class="dm-it-nome">${esc(lettura.name || t("Stufa a pellet", "Pellet stove"))}</span>
    </div>

    ${pelletDellaStufaMarkup(lettura)}
    ${nodoTarghetta("left:46%;top:17%", t("Fumi", "Flue gas"), lettura.fumi, "°C", "#f97316", 0, "", "dm-it-nodo-fumi")}
    ${nodoTarghetta("left:55%;top:50%", t("Stanza", "Room"), lettura.temperatura, "°C", "#fbbf24", 1, "", "dm-it-nodo-stanza")}
  </div>${quadroDellaStufa(lettura)}`;
}

/* ── i comandi della stufa ──────────────────────────────────────────────
 *
 * Il tocco chiama il servizio come lo chiama l'interruttore della caldaia
 * (#274): subito, senza chiedere conferma, e senza aspettare. Quello che si e'
 * chiesto pero' si ricorda per qualche secondo: fra il tocco e lo stato nuovo
 * passa un secondo, a volte tre, e chi preme «+» due volte di fila vuole due
 * passi — senza questa memoria il secondo tocco partirebbe dallo stato vecchio
 * e chiederebbe di nuovo lo stesso numero. Intanto la scena mostra gia' il
 * valore chiesto; quando lo stato lo raggiunge, o quando passa il tempo,
 * torna a parlare la stufa. */
const ATTESA_RICHIESTA = 6000;

function conLeRichieste(lettura) {
  if (!lettura) return lettura;
  const fuori = { ...lettura };
  const richiesta = (campo, reale, applica) => {
    const chiave = `${lettura.id}|${campo}`;
    const voce = state.richieste?.[chiave];
    if (!voce) return;
    if (voce.valore === reale || Date.now() > voce.fino) {
      delete state.richieste[chiave];
      return;
    }
    applica(voce.valore);
  };
  const livelloLetto = (livello) =>
    livello?.modo === "interruttore"
      ? livello.acceso === true
        ? "on"
        : livello.acceso === false
          ? "off"
          : null
      : livello?.valore;
  richiesta("acceso", lettura.acceso, (valore) => {
    fuori.acceso = valore;
  });
  richiesta("obiettivo", lettura.obiettivo, (valore) => {
    fuori.obiettivo = valore;
  });
  for (const campo of ["potenza", "ventilatore"])
    richiesta(campo, livelloLetto(lettura[campo]), (valore) => {
      fuori[campo] = livelloConValore(lettura[campo], valore);
    });
  return fuori;
}

function stufeDiCasa(states = allStates(), resolve = root.resolveEntity || ((value) => value)) {
  return lettureStufe(readJson(CHIAVE_STUFE, []), states, resolve).map(conLeRichieste);
}

function comandaLaStufa(tasto) {
  const id = clean(tasto.closest("[data-dm-it-stufa]")?.dataset?.dmItStufa);
  const lettura = stufeDiCasa().find((riga) => riga.id === id);
  if (!lettura) return;
  let campo = "";
  let valore = null;
  let comando = null;
  if (tasto.hasAttribute("data-dm-it-stufa-accendi")) {
    campo = "acceso";
    valore = tasto.dataset.dmItStufaAccendi === "true";
    comando = comandoAccensione(lettura, valore);
  } else {
    campo = clean(tasto.dataset.dmItStufaPasso);
    const verso = Number(tasto.dataset.verso) || 0;
    if (campo === "obiettivo") {
      valore = prossimoObiettivo(lettura, verso);
      comando = comandoObiettivo(lettura, verso);
    } else if (campo === "potenza" || campo === "ventilatore") {
      valore = prossimoLivello(lettura[campo], verso);
      comando = comandoLivello(lettura[campo], verso);
    }
  }
  if (!comando || valore === null) return;
  root.navigator?.vibrate?.(8);
  chiamaServizio(comando);
  state.richieste = { ...(state.richieste || {}) };
  state.richieste[`${id}|${campo}`] = { valore, fino: Date.now() + ATTESA_RICHIESTA };
  state.firma = "";
  renderImpiantiTermici();
  /* Se lo stato non arriva, allo scadere si ridisegna quello che dice la
   * stufa: un valore chiesto e mai confermato non resta sullo schermo. */
  root.setTimeout?.(() => {
    state.firma = "";
    renderImpiantiTermici();
  }, ATTESA_RICHIESTA + 200);
}

/* ── il disegno della pagina ───────────────────────────────────────────── */

function pagina() {
  return doc?.getElementById(PAGINA) || null;
}

function contenitore(page) {
  return page.querySelector(".boiler-dashboard") || page;
}

/* Il guscio della scena legacy: si accende solo quando la linguetta aperta e'
 * quella del solare, e non si tocca in nessun altro modo. */
function scenaLegacy(page) {
  return page.querySelector(".synoptic-stage");
}

export function renderImpiantiTermici() {
  const page = pagina();
  if (!page) return false;
  const scelti = impiantiDiCasa();
  const attiva = tabAttiva(scelti, state.tab);
  state.tab = attiva;

  const box = contenitore(page);
  const states = allStates();
  const resolve = root.resolveEntity || ((value) => value);

  /* La firma tiene fuori i ridisegni inutili: questa passata gira a ogni
   * evento di stato, e rifare il markup a ogni giro butterebbe via le
   * transizioni delle scene a meta' corsa. */
  const letture =
    attiva === "scaldabagno"
      ? lettureScaldabagni(readJson(SCALDABAGNI_KEY, []), states, resolve)
      : [];
  const caldaie =
    attiva === "caldaia" ? lettureCaldaie(readJson(CHIAVE_CALDAIA, {}), states, resolve) : [];
  /* Le stufe (#183) entrano nella firma con le richieste ancora in volo: il
   * valore appena chiesto cambia la scena, e la cambia di nuovo quando arriva
   * o scade. */
  const stufe = attiva === "stufa" ? stufeDiCasa(states, resolve) : [];
  /* Quale delle macchine di questo tipo si sta guardando: la scelta e' per
   * tipo, cosi' passando da Caldaia a Scaldabagno e tornando indietro non si
   * torna sempre alla prima. */
  const quali = attiva === "caldaia" ? caldaie : attiva === "stufa" ? stufe : letture;
  const scelta = macchinaScelta(attiva, quali);
  const solari = attiva === "solare" ? impiantiSolariDiCasa() : [];
  const firma = JSON.stringify([scelti, attiva, letture, caldaie, stufe, scelta, solari]);
  if (firma === state.firma) return true;
  state.firma = firma;

  /* ── la fila delle linguette ── */
  const testata = page.querySelector(".boiler-header") || box;
  let strip = box.querySelector(":scope > .dm-it-strip");
  if (servonoLinguette(scelti)) {
    if (!strip) {
      strip = doc.createElement("div");
      strip.className = "dm-it-strip";
      testata.after(strip);
    }
    const nuovo = stripMarkup(scelti, attiva);
    if (strip.innerHTML !== nuovo) {
      strip.innerHTML = nuovo;
      /* La prima volta che compaiono le linguette il titolo va gia' allineato
       * alla macchina aperta, non a quella della tabella. */
      try {
        renderPageMastheads();
      } catch (_error) {}
    }
  } else if (strip) {
    strip.remove();
  }

  /* ── le scene ──
   *
   * Quando si guarda una macchina che non e' il solare, tutto quello che la
   * pagina disegna per il solare esce di scena: non solo il sinottico, ma
   * anche la fascia dello stato in testata, la riga delle misure (ΔT solare,
   * pressione del circuito primario) e la griglia dei nove comandi. Sono
   * numeri e tasti di un impianto che in quel momento non si sta guardando, e
   * lasciarli sotto una caldaia vorrebbe dire attribuirle cose che non ha. */
  const altrove = Boolean(attiva) && attiva !== "solare";
  if (page.dataset.dmItAltrove !== String(altrove)) page.dataset.dmItAltrove = String(altrove);
  const legacy = scenaLegacy(page);
  if (legacy) legacy.hidden = altrove;

  /* Con più di un impianto solare, la fila dei nomi sopra la scena: è lo
   * stesso gesto delle caldaie, e la scena sotto è sempre quella — cambia
   * l'impianto che le sta dando i numeri. */
  let filaSolare = box.querySelector(":scope > .dm-it-quali-solare");
  if (attiva === "solare" && solari.length > 1) {
    if (!filaSolare) {
      filaSolare = doc.createElement("div");
      filaSolare.className = "dm-it-quali-solare";
      if (legacy) legacy.before(filaSolare);
      else box.prepend(filaSolare);
    }
    filaSolare.hidden = false;
    const markup = filaDegliSolari(solari);
    if (filaSolare.innerHTML !== markup) filaSolare.innerHTML = markup;
  } else if (filaSolare) {
    filaSolare.hidden = true;
  }

  let mia = box.querySelector(":scope > .dm-it-stage");
  if (attiva && attiva !== "solare") {
    if (!mia) {
      mia = doc.createElement("div");
      mia.className = "dm-it-stage";
      if (legacy) legacy.after(mia);
      else box.append(mia);
    }
    mia.hidden = false;
    /* Con piu' macchine dello stesso tipo, la fila dei nomi sopra la scena:
     * «ho due caldaie, una per la zona giorno e una per la zona notte» (#281).
     * Con una sola non compare — un selettore fra una cosa sola e' un tasto
     * che non sceglie niente. E vale per tutti e due i tipi: gli scaldabagni
     * erano gia' una lista in configurazione, ma la pagina ne disegnava uno. */
    const dentro = quali.find((riga) => riga.id === scelta) || quali[0] || null;
    const scena =
      attiva === "caldaia"
        ? scenaCaldaia(dentro)
        : attiva === "stufa"
          ? scenaStufa(dentro)
          : scenaScaldabagno(dentro ? [dentro] : []);
    const markup = filaDelleMacchine(quali, scelta) + scena;
    if (mia.dataset.dmItTipo !== attiva || mia.innerHTML !== markup) {
      mia.dataset.dmItTipo = attiva;
      mia.innerHTML = markup;
    }
    /* Due serbatoi (#182) sul telefono chiedono una mensola in fondo al
     * palco, e a dirlo e' il palco, perche' e' lui che si allunga. Con un
     * serbatoio solo l'attributo non c'e', come prima. */
    const mensola = attiva === "caldaia" && serbatoiDellaCaldaia(dentro).length > 1 ? "2" : "";
    if ((mia.dataset.dmItSerbatoi || "") !== mensola) {
      if (mensola) mia.dataset.dmItSerbatoi = mensola;
      else delete mia.dataset.dmItSerbatoi;
    }
  } else if (mia) {
    mia.hidden = true;
  }
  return true;
}

/* Il nome che la sezione porta in giro: nella barra in basso e nella scheda
 * della configurazione.
 *
 * Il guscio scrive «Solare Termico» in tutti e due i posti, e quel nome e' di
 * una delle tre macchine: chi ha solo la caldaia trovava la sua dentro una
 * voce che parla di pannelli. Il nome scelto a mano da chi configura vince
 * comunque — `cd_section_names` — perche' una preferenza esplicita batte
 * sempre un valore di serie. */
function nomeScelto() {
  const nomi = readJson("cd_section_names", {});
  return nomi && typeof nomi === "object" ? clean(nomi.solar) : "";
}

export function rinominaLaSezione() {
  if (nomeScelto()) return false;
  const nome = t(...NOME_SEZIONE);
  let fatto = false;
  const voce = doc?.querySelector?.('nav.tabs .tab[data-tab="boiler"] .text');
  if (voce && clean(voce.textContent) !== nome) {
    voce.textContent = nome;
    fatto = true;
  }
  /* Nella configurazione la linguetta porta disegno e parola in due caselle
   * separate: si riscrive la parola, non tutta la linguetta, o si porterebbe
   * via il disegno. */
  const linguetta = doc?.querySelector?.('.ed-tab[data-tab="sez3"] .dm-beta4-tab-label');
  if (linguetta && clean(linguetta.textContent) !== nome) {
    linguetta.textContent = nome;
    fatto = true;
  }
  const nuda = doc?.querySelector?.('.ed-tab[data-tab="sez3"]:not(:has(.dm-beta4-tab-label))');
  if (nuda && !clean(nuda.textContent).includes(nome)) {
    nuda.textContent = `🌞 ${nome}`;
    fatto = true;
  }
  return fatto;
}

function schedule() {
  if (state.frame) return;
  state.frame =
    root.requestAnimationFrame?.(() => {
      state.frame = 0;
      try {
        renderImpiantiTermici();
        rinominaLaSezione();
      } catch (error) {
        root.console?.warn?.("[DashboardModern] impianti termici", error);
      }
    }) || 0;
}

function onClick(event) {
  /* L'interruttore della caldaia (#274): chiama il servizio e basta, senza
   * ridisegnare — il ridisegno arriva col cambio di stato, e allora o conferma
   * o corregge. Ridisegnare adesso rileggerebbe lo stato vecchio. */
  const caldaia = event.target?.closest?.("[data-dm-it-caldaia]");
  if (caldaia) {
    event.preventDefault();
    const entity = clean(caldaia.dataset.dmItCaldaia);
    const dominio = entity.split(".")[0];
    if (!dominio) return;
    root.navigator?.vibrate?.(8);
    const acceso = caldaia.getAttribute("aria-checked") === "true";
    caldaia.setAttribute("aria-checked", acceso ? "false" : "true");
    try {
      root.dmCallHaService?.(dominio, "toggle", { entity_id: entity }) ??
        root.callService?.({ domain: dominio, service: "toggle", data: { entity_id: entity } });
    } catch (_error) {}
    return;
  }
  /* I comandi della stufa (#183): accesa e spenta, l'obiettivo, la potenza,
   * il ventilatore. Senza conferma, come l'interruttore della caldaia. */
  const stufa = event.target?.closest?.("[data-dm-it-stufa-accendi],[data-dm-it-stufa-passo]");
  if (stufa) {
    event.preventDefault();
    if (!stufa.disabled) comandaLaStufa(stufa);
    return;
  }
  const solare = event.target?.closest?.("[data-dm-it-solare]");
  if (solare) {
    event.preventDefault();
    if (passaAlSolare(clean(solare.dataset.dmItSolare))) {
      state.firma = "";
      renderImpiantiTermici();
    }
    return;
  }
  const quale = event.target?.closest?.("[data-dm-it-quale]");
  if (quale) {
    event.preventDefault();
    const tipo = tabAttiva(impiantiDiCasa(), state.tab);
    if (tipo) {
      state.quale = { ...(state.quale || {}), [tipo]: clean(quale.dataset.dmItQuale) };
      state.firma = "";
      renderImpiantiTermici();
    }
    return;
  }
  const tab = event.target?.closest?.("[data-dm-it-tab]");
  if (tab) {
    event.preventDefault();
    state.tab = clean(tab.dataset.dmItTab);
    /* La firma si azzera a mano: cambiando linguetta cambia tutto, e il
     * confronto di prima direbbe «uguale» finche' non cambia uno stato. */
    state.firma = "";
    renderImpiantiTermici();
    /* E l'intestazione va rifatta subito: il nome della pagina e' cambiato, e
     * lei si ridisegna sui suoi eventi — nessuno dei quali e' un tocco su una
     * linguetta che non esisteva quando li ha scelti. */
    try {
      renderPageMastheads();
    } catch (_error) {}
    return;
  }
  const toggle = event.target?.closest?.("[data-dm-it-toggle]");
  if (toggle) {
    event.preventDefault();
    const entity = clean(toggle.dataset.dmItToggle);
    if (!entity) return;
    /* Lo stesso gesto della tessera in Home: si chiama il servizio che la
     * plancia chiama gia', non uno nuovo. */
    try {
      root.toggle?.(entity) ?? root.cdToggleEntity?.(entity);
    } catch (_error) {}
    state.firma = "";
    root.setTimeout?.(() => renderImpiantiTermici(), 400);
  }
}

function installStyles() {
  installStyle(
    STYLE_ID,
    `
    /* ── la fila delle linguette ────────────────────────────────────────
     * Stessa forma del selettore Freddo/Caldo della pagina Clima: chi usa la
     * plancia quel gesto lo conosce gia', e imparare due volte la stessa cosa
     * e' una cosa in piu' da imparare. */
    #${PAGINA} .dm-it-strip{
      display:flex;gap:6px;padding:6px;margin:0 0 20px;border-radius:18px;
      background:var(--bg-sculpted,#f0f4f8);border:1px solid var(--card-border,#e2e8f0)}
    #${PAGINA} .dm-it-tab{
      flex:1 1 0;display:inline-flex;align-items:center;justify-content:center;gap:8px;
      padding:12px 14px;border:0;border-radius:14px;background:transparent;cursor:pointer;
      font:inherit;font-size:12.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
      color:#3d4d66;transition:background .25s ease,color .25s ease,box-shadow .25s ease}
    #${PAGINA} .dm-it-tab-ic{display:grid;place-items:center;flex:0 0 auto}

    /* ── la fila delle macchine dello stesso tipo ────────────────────────
     * Piu' piccola delle linguette qui sopra, perche' e' una scelta dentro
     * una scelta: prima che macchina, poi quale delle sue. */
    /* Le elettrovalvole, l'interruttore e lo stato (#274). */
    #${PAGINA} .dm-it-valvola{
      display:grid;place-items:center;width:34px;height:34px;border-radius:11px;
      background:var(--card-bg,#fff);border:2px solid var(--card-border,#e2e8f0)}
    #${PAGINA} .dm-it-valvola>i{
      width:14px;height:14px;border-radius:50%;background:#cbd5e1;transition:background .2s ease}
    #${PAGINA} .dm-it-valvola[data-aperta="true"]{border-color:#34d399}
    #${PAGINA} .dm-it-valvola[data-aperta="true"]>i{background:#34d399}
    #${PAGINA} .dm-it-valvola-stato{
      display:block;margin-top:2px;font-size:10px;font-weight:800;letter-spacing:.05em;
      text-transform:uppercase;color:var(--text-dim,#64748b)}
    #${PAGINA} .dm-it-comandi-caldaia{
      position:absolute;left:50%;bottom:10px;transform:translateX(-50%);
      display:flex;align-items:center;gap:10px;z-index:3}
    #${PAGINA} .dm-it-stato-caldaia{
      padding:5px 12px;border-radius:999px;font-size:11px;font-weight:800;
      letter-spacing:.06em;text-transform:uppercase;
      background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);
      color:var(--text-dim,#64748b)}
    #${PAGINA} .dm-it-stato-caldaia[data-lavora="true"]{
      border-color:rgba(249,115,22,.5);color:#ea580c}
    #${PAGINA} .dm-it-lev-caldaia{
      width:52px;height:30px;border-radius:999px;border:1px solid var(--card-border,#e2e8f0);
      background:var(--card-bg,#fff);cursor:pointer;padding:0;position:relative}
    #${PAGINA} .dm-it-lev-caldaia>i{
      position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;
      background:#cbd5e1;transition:transform .18s ease,background .18s ease}
    #${PAGINA} .dm-it-lev-caldaia[aria-checked="true"]{border-color:rgba(249,115,22,.55)}
    #${PAGINA} .dm-it-lev-caldaia[aria-checked="true"]>i{transform:translateX(22px);background:#f97316}
    /* L'accumulo all'uscita, per chi ha scelto il boiler invece dei radiatori. */
    #${PAGINA} .dm-it-accumulo{
      width:46px;height:66px;border-radius:16px;position:relative;
      background:linear-gradient(180deg,#f8fafc,#e2e8f0);
      border:2px solid var(--card-border,#cbd5e1)}
    #${PAGINA} .dm-it-accumulo>i{
      position:absolute;left:6px;right:6px;bottom:6px;height:40%;border-radius:10px;
      background:linear-gradient(180deg,rgba(251,146,60,.85),rgba(249,115,22,.95))}
    #${PAGINA} .dm-it-quali{
      display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}
    /* La stessa fila, sopra la scena del guscio invece che dentro la nostra. */
    #${PAGINA} .dm-it-quali-solare{margin:0 0 12px}
    #${PAGINA} .dm-it-quali-solare .dm-it-quali{margin:0}
    /* La fila dei nomi sta sopra la scena anche per il dito (#281, dal
       campo: «vedo i due tab relativi alle due caldaie ma non mi fa
       selezionare il secondo»). La scena e' assoluta e copre tutto il palco,
       fila compresa: i nomi si vedevano attraverso il suo fondo trasparente,
       ma il tocco arrivava alla scena e non a loro. Rialzata sopra i nodi
       — che arrivano a quattro — e staccata dal bordo tondo del palco, si
       tocca e si legge. */
    #${PAGINA} .dm-it-stage>.dm-it-quali{
      position:relative;z-index:6;margin:0;padding:14px 18px 0}
    #${PAGINA} .dm-it-quale{
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      border-radius:999px;padding:7px 14px;font:inherit;font-size:12px;font-weight:800;
      color:var(--text-dim,#64748b);cursor:pointer;
      transition:background .2s ease,color .2s ease,border-color .2s ease}
    #${PAGINA} .dm-it-quale:hover{border-color:#fb923c}
    #${PAGINA} .dm-it-quale[data-on="true"]{
      background:linear-gradient(135deg,#fb923c,#ea580c);border-color:transparent;color:#fff;
      box-shadow:0 6px 16px -8px rgba(234,88,12,.8)}
    #${PAGINA} .dm-it-tab:hover{background:rgba(255,255,255,.7)}
    #${PAGINA} .dm-it-tab[data-on="true"]{
      background:linear-gradient(135deg,#fb923c,#ea580c);color:#fff;
      box-shadow:0 8px 20px -8px rgba(234,88,12,.75)}

    /* ── il palco delle scene nuove ─────────────────────────────────────
     * Stessa misura, stesso raggio e stessa ombra del palco del solare: sono
     * la stessa stanza vista da tre porte. */
    #${PAGINA} .dm-it-stage{
      position:relative;width:100%;height:600px;margin-bottom:20px;overflow:hidden;
      border-radius:32px;border:1px solid var(--card-border,#e2e8f0);
      background:
        radial-gradient(120% 90% at 88% 6%,rgba(251,146,60,.16),transparent 58%),
        radial-gradient(90% 80% at 6% 96%,rgba(56,189,248,.14),transparent 60%),
        var(--card-bg,#fff);
      box-shadow:inset 0 0 35px rgba(0,0,0,.03),var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    #${PAGINA} .dm-it-stage[hidden]{display:none!important}
    /* Fuori dal solare esce di scena tutto quello che il solare si porta
       dietro: la fascia dello stato, le sue misure, i suoi nove comandi. */
    #${PAGINA}[data-dm-it-altrove="true"] .synoptic-stage,
    #${PAGINA}[data-dm-it-altrove="true"] .boiler-stats-row,
    #${PAGINA}[data-dm-it-altrove="true"] .b-controls-grid,
    #${PAGINA}[data-dm-it-altrove="true"] .dm-st-live{display:none!important}
    #${PAGINA} .dm-it-scena{position:absolute;inset:0}
    #${PAGINA} .dm-it-vuoto{
      position:absolute;inset:0;display:grid;place-items:center;padding:40px;text-align:center;
      color:var(--text-dim,#64748b);font-size:14px;font-weight:700}

    /* I tubi: fondo spesso e anima chiara, come quelli del solare. */
    #${PAGINA} .dm-it-tubi{position:absolute;inset:0;width:100%;height:100%}
    #${PAGINA} .dm-it-tubo{fill:none;stroke:#e2e8f0;stroke-width:22;stroke-linecap:round;stroke-linejoin:round}
    #${PAGINA} .dm-it-tubo-int{fill:none;stroke:#f8fafc;stroke-width:14;stroke-linecap:round;stroke-linejoin:round}
    #${PAGINA} .dm-it-flusso{
      fill:none;stroke-width:9;stroke-linecap:round;opacity:0;
      stroke-dasharray:26 210;transition:opacity .5s ease}
    #${PAGINA} .dm-it-flusso-caldo{stroke:#f43f5e}
    #${PAGINA} .dm-it-flusso-freddo{stroke:#3b82f6}
    /* La cometa scorre solo quando la macchina lavora: un tubo che pulsa su un
       impianto fermo direbbe una cosa che non sta succedendo. */
    #${PAGINA} .dm-it-scena[data-acceso="true"] .dm-it-flusso{
      opacity:.9;animation:dmItCometa 2.6s linear infinite}
    @keyframes dmItCometa{from{stroke-dashoffset:236}to{stroke-dashoffset:0}}

    #${PAGINA} .dm-it-nodo{
      position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;
      align-items:center;gap:10px;z-index:4}
    #${PAGINA} .dm-it-nome{
      font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;
      color:var(--text-dim,#64748b);background:rgba(255,255,255,.95);padding:5px 12px;
      border-radius:12px;box-shadow:0 5px 12px rgba(0,0,0,.06);white-space:nowrap}

    /* Le targhette: le stesse dei numeri del solare. */
    #${PAGINA} .dm-it-plate{
      display:grid;gap:2px;padding:10px 16px;border-radius:14px;min-width:112px;
      background:linear-gradient(160deg,#1e293b,#0b1220);
      box-shadow:0 14px 30px -14px rgba(15,23,42,.8),inset 0 1px 0 rgba(255,255,255,.09)}
    #${PAGINA} .dm-it-plate-lbl{
      font-size:9.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#94a3b8}
    #${PAGINA} .dm-it-plate-val{
      font-family:'Oswald',sans-serif;font-size:27px;font-weight:500;line-height:1;
      font-variant-numeric:tabular-nums}
    #${PAGINA} .dm-it-plate-val i{font-style:normal;font-size:.52em;margin-left:2px;opacity:.85}
    #${PAGINA} .dm-it-plate[data-dm-it-pressione="bassa"]{
      box-shadow:0 14px 30px -14px rgba(244,63,94,.8),inset 0 0 0 1.5px rgba(244,63,94,.55);
      animation:dmItBattito 2.4s ease-in-out infinite}
    @keyframes dmItBattito{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}

    /* ── lo scaldabagno: il serbatoio in piedi ──────────────────────────
     * L'acqua calda sale dal fondo, e l'altezza del riempimento e' quanto
     * manca all'obiettivo: la stessa quota dell'anello in Home, disegnata
     * invece che scritta. */
    #${PAGINA} .dm-it-tank{
      position:relative;width:132px;height:216px;border-radius:58px/34px;overflow:hidden;
      background:linear-gradient(100deg,#f8fafc,#dbe3ec 46%,#9aa9bb);
      box-shadow:0 26px 46px -22px rgba(15,23,42,.55),inset 0 0 0 1px rgba(148,163,184,.55)}
    #${PAGINA} .dm-it-tank-acqua{
      position:absolute;left:0;right:0;bottom:0;
      background:linear-gradient(to top,#ea580c,#fb923c 62%,#fbbf24);
      opacity:.92;transition:height 1.4s cubic-bezier(.16,1,.3,1),background 1s ease}
    /* Senza sonde il serbatoio non ha un livello da mostrare: si riempie tutto
       e parla il colore — caldo mentre la resistenza lavora, acciaio quando e'
       ferma. Un serbatoio disegnato vuoto direbbe «non c'e' acqua calda», che
       e' un'affermazione e non un'assenza di dati. */
    #${PAGINA} .dm-it-scena[data-sonde="false"] .dm-it-tank-acqua{
      background:linear-gradient(to top,#94a3b8,#cbd5e1)}
    #${PAGINA} .dm-it-scena[data-sonde="false"][data-acceso="true"] .dm-it-tank-acqua{
      background:linear-gradient(to top,#ea580c,#fb923c 62%,#fbbf24)}
    #${PAGINA} .dm-it-tank-vetro{
      position:absolute;inset:0;pointer-events:none;
      background:linear-gradient(105deg,rgba(255,255,255,.72) 0 16%,rgba(255,255,255,0) 34%,
        rgba(255,255,255,0) 74%,rgba(15,23,42,.14) 100%)}
    #${PAGINA} .dm-it-tank-cap{
      position:absolute;top:0;left:0;right:0;height:26px;border-radius:58px/26px;
      background:linear-gradient(180deg,#f1f5f9,#cbd5e1);box-shadow:inset 0 -2px 4px rgba(15,23,42,.14)}
    #${PAGINA} .dm-it-tank-base{
      position:absolute;bottom:0;left:0;right:0;height:18px;
      background:linear-gradient(180deg,rgba(15,23,42,.16),rgba(15,23,42,.32))}
    /* La resistenza: tre spire che si accendono quando lavora. */
    #${PAGINA} .dm-it-resistenza{
      position:absolute;left:22px;right:22px;bottom:46px;display:grid;gap:7px}
    #${PAGINA} .dm-it-resistenza i{
      display:block;height:5px;border-radius:3px;background:rgba(15,23,42,.32);
      transition:background .6s ease,box-shadow .6s ease}
    #${PAGINA} .dm-it-scena[data-acceso="true"] .dm-it-resistenza i{
      background:#fde68a;box-shadow:0 0 14px 3px rgba(251,191,36,.8)}

    /* ── la caldaia: la scocca a muro, l'oblo' e la fiamma ─────────────── */
    #${PAGINA} .dm-it-caldaia{
      position:relative;width:186px;height:196px;border-radius:20px;
      background:linear-gradient(150deg,#ffffff,#e2e8f0 58%,#c3ccd8);
      box-shadow:0 28px 50px -24px rgba(15,23,42,.55),inset 0 0 0 1px rgba(148,163,184,.5)}
    #${PAGINA} .dm-it-caldaia-testa{
      position:absolute;top:14px;left:16px;right:16px;height:34px;border-radius:11px;
      background:linear-gradient(180deg,#f8fafc,#dbe3ec);box-shadow:inset 0 -2px 4px rgba(15,23,42,.1)}
    #${PAGINA} .dm-it-caldaia-display{
      position:absolute;top:20px;right:26px;padding:3px 9px;border-radius:7px;
      background:#0b1220;color:#38bdf8;font-family:'Oswald',sans-serif;font-size:15px;
      font-variant-numeric:tabular-nums;line-height:1.4}
    #${PAGINA} .dm-it-oblo{
      position:absolute;left:50%;top:62%;transform:translate(-50%,-50%);
      width:96px;height:82px;border-radius:14px;display:grid;place-items:end center;
      background:radial-gradient(120% 120% at 50% 120%,#1f2937,#0b1220);
      box-shadow:inset 0 0 0 3px rgba(148,163,184,.5),inset 0 8px 18px rgba(0,0,0,.6);
      overflow:hidden}
    #${PAGINA} .dm-it-fiamma{
      display:block;width:34px;height:0;margin-bottom:12px;border-radius:50% 50% 44% 44%;
      background:linear-gradient(to top,#f59e0b,#fb923c 46%,#fde68a);
      opacity:0;transition:height .7s ease,opacity .7s ease}
    #${PAGINA} .dm-it-scena[data-fiamma="true"] .dm-it-fiamma{
      height:46px;opacity:1;animation:dmItFiamma 1.5s ease-in-out infinite;
      box-shadow:0 0 26px 8px rgba(251,146,60,.55)}
    @keyframes dmItFiamma{
      0%,100%{transform:scaleY(1) scaleX(1)}50%{transform:scaleY(1.16) scaleX(.92)}}
    #${PAGINA} .dm-it-caldaia-piede{
      position:absolute;bottom:-10px;left:26px;right:26px;height:10px;border-radius:0 0 8px 8px;
      background:linear-gradient(180deg,#cbd5e1,#94a3b8)}

    /* Il radiatore in fondo al circuito: dice dove va a finire il calore. */
    #${PAGINA} .dm-it-radiatore{
      display:flex;gap:5px;padding:12px 11px;border-radius:12px;
      background:linear-gradient(150deg,#f8fafc,#dbe3ec);
      box-shadow:0 18px 34px -18px rgba(15,23,42,.5),inset 0 0 0 1px rgba(148,163,184,.45)}
    #${PAGINA} .dm-it-radiatore i{
      display:block;width:11px;height:74px;border-radius:6px;
      background:linear-gradient(180deg,#e2e8f0,#b6c2d2);transition:background .8s ease}
    #${PAGINA} .dm-it-scena[data-acceso="true"] .dm-it-radiatore i{
      background:linear-gradient(180deg,#fdba74,#f97316)}

    /* ── la caldaia a pellet (#346) ─────────────────────────────────────
       La combustione accanto alla fiamma, il serbatoio in basso a sinistra e
       le due sonde addosso al disegno del boiler: tre pezzi nuovi nella
       stessa lingua della scena — fondo chiaro, etichetta piccola sopra le
       cifre, cifre in Oswald. */
    #${PAGINA} .dm-it-fuoco{
      display:grid;gap:5px;padding:10px 13px;border-radius:14px;min-width:104px;
      background:rgba(255,255,255,.96);
      box-shadow:0 10px 24px -14px rgba(15,23,42,.55),inset 0 0 0 1px rgba(148,163,184,.35)}
    #${PAGINA} .dm-it-fuoco-riga{
      display:flex;align-items:baseline;justify-content:space-between;gap:10px}
    #${PAGINA} .dm-it-fuoco-lbl{
      font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;
      color:var(--text-dim,#64748b)}
    #${PAGINA} .dm-it-fuoco-val{
      font-family:'Oswald',sans-serif;font-size:16px;line-height:1;
      font-variant-numeric:tabular-nums;color:#c2410c}
    /* Il serbatoio del pellet: si riempie dal basso come il boiler dello
       scaldabagno, e sotto la soglia cambia colore — e' l'unica cosa di
       questa pagina che manda a ordinare qualcosa. */
    #${PAGINA} .dm-it-pellet{
      position:relative;width:48px;height:92px;border-radius:11px;overflow:hidden;
      background:linear-gradient(180deg,#f8fafc,#e2e8f0);
      box-shadow:0 14px 28px -18px rgba(15,23,42,.5),inset 0 0 0 2px rgba(148,163,184,.5)}
    #${PAGINA} .dm-it-pellet-liv{
      position:absolute;left:0;right:0;bottom:0;
      background:linear-gradient(180deg,#f59e0b,#b45309);
      transition:height 1.2s cubic-bezier(.16,1,.3,1),background .6s ease}
    #${PAGINA} .dm-it-pellet[data-scarso="true"] .dm-it-pellet-liv{
      background:linear-gradient(180deg,#fb7185,#b91c1c)}
    /* Le due sonde del boiler, addosso al serbatoio. */
    #${PAGINA} .dm-it-sonde{
      display:grid;gap:3px;padding:7px 11px;border-radius:11px;background:rgba(255,255,255,.96);
      box-shadow:0 8px 20px -12px rgba(15,23,42,.5),inset 0 0 0 1px rgba(148,163,184,.35)}
    #${PAGINA} .dm-it-sonda{
      display:flex;align-items:baseline;justify-content:space-between;gap:10px;
      font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
      color:var(--text-dim,#64748b)}
    #${PAGINA} .dm-it-sonda b{
      font-family:'Oswald',sans-serif;font-size:13.5px;color:#ea580c;
      font-variant-numeric:tabular-nums}
    /* L'obiettivo della centralina, sotto la mandata vera. */
    #${PAGINA} .dm-it-obiettivo{
      padding:6px 13px;border-radius:999px;font-size:10.5px;font-weight:800;letter-spacing:.06em;
      text-transform:uppercase;color:#0369a1;background:rgba(255,255,255,.96);
      box-shadow:0 8px 20px -10px rgba(15,23,42,.5),inset 0 0 0 1px rgba(56,189,248,.45)}
    #${PAGINA} .dm-it-obiettivo b{
      font-family:'Oswald',sans-serif;font-size:14px;margin-left:4px}

    #${PAGINA} .dm-it-salto{
      padding:7px 14px;border-radius:999px;font-size:11.5px;font-weight:800;letter-spacing:.06em;
      text-transform:uppercase;color:#64748b;background:rgba(255,255,255,.96);
      box-shadow:0 8px 20px -10px rgba(15,23,42,.5),inset 0 0 0 1px rgba(148,163,184,.35)}
    #${PAGINA} .dm-it-salto b{font-family:'Oswald',sans-serif;font-size:15px;margin-left:4px}
    #${PAGINA} .dm-it-salto[data-cede="true"]{color:#c2410c;background:#fff7ed;
      box-shadow:0 8px 20px -10px rgba(234,88,12,.55),inset 0 0 0 1px rgba(251,146,60,.5)}

    #${PAGINA} .dm-it-allarme{
      position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:6;
      padding:9px 16px;border-radius:12px;background:#fef2f2;color:#b91c1c;
      font-size:12.5px;font-weight:800;box-shadow:0 10px 24px -12px rgba(185,28,28,.7)}

    #${PAGINA} .dm-it-interruttore{
      display:inline-flex;align-items:center;gap:9px;padding:11px 18px;border-radius:999px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);cursor:pointer;
      font:inherit;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
      color:#3d4d66;box-shadow:0 10px 24px -14px rgba(15,23,42,.6);
      transition:background .3s ease,color .3s ease,box-shadow .3s ease}
    #${PAGINA} .dm-it-interruttore[data-on="true"]{
      background:linear-gradient(135deg,#fb923c,#ea580c);color:#fff;border-color:transparent;
      box-shadow:0 12px 26px -12px rgba(234,88,12,.8)}
    #${PAGINA} .dm-it-etichetta{
      padding:8px 15px;border-radius:999px;background:rgba(255,255,255,.95);
      font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#64748b;
      box-shadow:0 8px 20px -12px rgba(15,23,42,.5)}
    #${PAGINA} .dm-it-etichetta[data-on="true"]{color:#c2410c}

    /* ── i due serbatoi della caldaia (#182) ─────────────────────────────
       Affiancati in un nodo solo, col numero dentro il disegno: sono due
       misure della stessa scorta, e stanno vicine come le due sonde del
       boiler. Il nome sotto dice quale e', e si fa rosso con lui. */
    #${PAGINA} .dm-it-serbatoi{display:flex;align-items:flex-end;gap:14px}
    #${PAGINA} .dm-it-serbatoio{display:flex;flex-direction:column;align-items:center;gap:10px}
    #${PAGINA} .dm-it-pellet-cifra{
      position:absolute;left:0;right:0;top:7px;z-index:1;text-align:center;
      font-family:'Oswald',sans-serif;font-size:14px;font-weight:500;line-height:1;
      font-variant-numeric:tabular-nums;color:#334155}
    #${PAGINA} .dm-it-pellet-cifra i{font-style:normal;font-size:.7em;margin-left:1px}
    /* In chili non c'e' una quota da riempire: il serbatoio e' color
       acciaio, e il numero sta in mezzo. */
    #${PAGINA} .dm-it-pellet-chili{background:linear-gradient(180deg,#cbd5e1,#94a3b8)}
    #${PAGINA} .dm-it-pellet-chili .dm-it-pellet-cifra{top:50%;transform:translateY(-50%);color:#fff}
    #${PAGINA} .dm-it-nome[data-scarso="true"]{color:#b91c1c}
    /* Il serbatoio della stufa col solo avviso (#183): la quota non si sa.
       Finche' il sensore tace e' pieno e color acciaio, senza numeri; quando
       scatta prende il rosso del pellet scarso. */
    #${PAGINA} .dm-it-pellet-avviso[data-scarso="false"] .dm-it-pellet-liv{
      background:linear-gradient(180deg,#cbd5e1,#94a3b8)}

    /* ── la stufa a pellet (#183) ──────────────────────────────────────
       In piedi sul pavimento invece che appesa al muro: un corpo di
       ceramica chiara, il piano e la cornice del vetro in ghisa, il fuoco
       dietro il vetro. Le parti stanno in percentuale del corpo, cosi' sul
       telefono basta stringere lui. */
    #${PAGINA} .dm-it-stufa{
      position:relative;width:172px;height:244px;border-radius:28px 28px 14px 14px;
      background:linear-gradient(100deg,#fffaf2,#f1e7d8 46%,#d6c6ae);
      box-shadow:0 30px 52px -26px rgba(15,23,42,.6),inset 0 0 0 1px rgba(168,148,120,.45)}
    #${PAGINA} .dm-it-stufa-piano{
      position:absolute;top:-3%;left:-4%;right:-4%;height:10%;border-radius:12px;
      display:flex;align-items:center;justify-content:flex-end;padding:0 12px;
      background:linear-gradient(180deg,#4b5563,#1f2937);
      box-shadow:0 6px 12px -6px rgba(15,23,42,.6),inset 0 1px 0 rgba(255,255,255,.18)}
    #${PAGINA} .dm-it-stufa-display{
      font-style:normal;font-family:'Oswald',sans-serif;font-size:11px;line-height:1;
      padding:3px 6px;border-radius:5px;background:#0b1220;color:#fb923c;letter-spacing:.04em}
    #${PAGINA} .dm-it-stufa-griglia{
      position:absolute;top:12.5%;left:20%;right:20%;height:4.5%;display:flex;gap:6%}
    #${PAGINA} .dm-it-stufa-griglia i{
      flex:1;border-radius:3px;background:rgba(31,41,55,.42);box-shadow:inset 0 1px 1px rgba(0,0,0,.25)}
    #${PAGINA} .dm-it-stufa-porta{
      position:absolute;top:21%;left:11%;right:11%;height:54%;border-radius:16px;
      background:linear-gradient(160deg,#374151,#111827);
      box-shadow:0 10px 20px -12px rgba(15,23,42,.7),inset 0 1px 0 rgba(255,255,255,.12)}
    #${PAGINA} .dm-it-stufa-vetro{
      position:absolute;inset:8%;border-radius:10px;overflow:hidden;
      background:radial-gradient(120% 90% at 50% 112%,#1f2937,#0b0f19 70%);
      box-shadow:inset 0 0 0 2px rgba(148,163,184,.35),inset 0 10px 22px rgba(0,0,0,.65);
      transition:background .8s ease}
    #${PAGINA} .dm-it-scena[data-brucia="true"] .dm-it-stufa-vetro{
      background:radial-gradient(120% 90% at 50% 112%,#7c2d12,#1c0d06 62%,#0b0f19)}
    /* Il riflesso del vetro, sopra il fuoco. */
    #${PAGINA} .dm-it-stufa-vetro::after{
      content:"";position:absolute;inset:0;pointer-events:none;
      background:linear-gradient(125deg,rgba(255,255,255,.16) 0 18%,rgba(255,255,255,0) 32%)}
    #${PAGINA} .dm-it-stufa-maniglia{
      position:absolute;right:-4px;top:30%;width:6px;height:30%;border-radius:4px;
      background:linear-gradient(90deg,#9ca3af,#4b5563)}
    #${PAGINA} .dm-it-stufa-cassetto{
      position:absolute;top:80%;left:24%;right:24%;height:3.4%;border-radius:4px;
      background:rgba(31,41,55,.3);box-shadow:inset 0 1px 2px rgba(0,0,0,.25)}
    #${PAGINA} .dm-it-stufa-piedi{
      position:absolute;bottom:-5%;left:12%;right:12%;height:5%;display:flex;
      justify-content:space-between}
    #${PAGINA} .dm-it-stufa-piedi i{
      width:16%;border-radius:0 0 6px 6px;background:linear-gradient(180deg,#4b5563,#1f2937)}
    /* Il fuoco: tre lingue che crescono con la potenza. Spente finche' la
       stufa non brucia: una fiamma su una stufa ferma direbbe una cosa che
       non sta succedendo. */
    #${PAGINA} .dm-it-stufa-lingua{
      position:absolute;bottom:12%;left:20%;width:24%;height:calc(58% * var(--dm-it-fuoco,.9));
      border-radius:50% 50% 42% 42% / 64% 64% 36% 36%;transform-origin:50% 100%;
      background:linear-gradient(to top,#f97316,#fb923c 40%,#fde68a);
      opacity:0;transform:scaleY(.2);transition:opacity .8s ease,transform .8s ease,height .8s ease}
    #${PAGINA} .dm-it-stufa-lingua:nth-child(3){left:37%;width:26%;height:calc(74% * var(--dm-it-fuoco,.9))}
    #${PAGINA} .dm-it-stufa-lingua:nth-child(4){left:56%}
    #${PAGINA} .dm-it-scena[data-brucia="true"] .dm-it-stufa-lingua{
      opacity:1;transform:scaleY(1);animation:dmItLingua 1.4s ease-in-out infinite alternate;
      filter:drop-shadow(0 0 9px rgba(251,146,60,.75))}
    #${PAGINA} .dm-it-scena[data-brucia="true"] .dm-it-stufa-lingua:nth-child(3){
      animation-duration:1.1s;animation-delay:-.45s}
    #${PAGINA} .dm-it-scena[data-brucia="true"] .dm-it-stufa-lingua:nth-child(4){animation-delay:-.8s}
    @keyframes dmItLingua{
      0%{transform:scaleY(.86) scaleX(1.04) skewX(-3deg)}100%{transform:scaleY(1.1) scaleX(.92) skewX(4deg)}}
    /* Il braciere: sotto la fiamma quando brucia, da solo e piu' scuro nello
       spegnimento — la brace che si raffredda. */
    #${PAGINA} .dm-it-stufa-brace{
      position:absolute;left:14%;right:14%;bottom:7%;height:9%;border-radius:8px;
      background:radial-gradient(60% 120% at 50% 100%,#fdba74,#c2410c 60%,#431407);
      opacity:0;transition:opacity .8s ease}
    #${PAGINA} .dm-it-scena[data-brucia="true"] .dm-it-stufa-brace{
      opacity:.95;box-shadow:0 0 18px 6px rgba(249,115,22,.45)}
    #${PAGINA} .dm-it-scena[data-brace="true"] .dm-it-stufa-brace{
      opacity:.85;animation:dmItBrace 3s ease-in-out infinite}
    @keyframes dmItBrace{0%,100%{filter:brightness(.7)}50%{filter:brightness(1.15)}}
    /* L'aria calda che va dalla griglia alla stanza: una scia tenue e i
       granelli che la percorrono, tanto piu' svelti quanto piu' gira il
       ventilatore. Il tratto non si stira col palco — sul computer e' piu'
       largo che alto — se no i granelli diventerebbero ovali. */
    #${PAGINA} .dm-it-aria-scia,#${PAGINA} .dm-it-aria-calda{
      fill:none;stroke-linecap:round;vector-effect:non-scaling-stroke;opacity:0;
      transition:opacity .6s ease}
    #${PAGINA} .dm-it-aria-scia{stroke:#fdba74;stroke-width:14}
    #${PAGINA} .dm-it-aria-calda{stroke:#f97316;stroke-width:5;stroke-dasharray:1 15}
    #${PAGINA} .dm-it-aria-telefono{display:none}
    #${PAGINA} .dm-it-scena[data-aria="true"] .dm-it-aria-scia{opacity:.32}
    #${PAGINA} .dm-it-scena[data-aria="true"] .dm-it-aria-calda{
      opacity:.9;animation:dmItAria var(--dm-it-aria,1.4s) linear infinite}
    @keyframes dmItAria{from{stroke-dashoffset:32}to{stroke-dashoffset:0}}
    /* La canna fumaria: acciaio scuro, non il tubo chiaro dell'acqua. Il fumo
       sale solo mentre la stufa brucia. */
    #${PAGINA} .dm-it-canna{
      fill:none;stroke:#64748b;stroke-width:20;stroke-linecap:round;stroke-linejoin:round}
    #${PAGINA} .dm-it-canna-int{
      fill:none;stroke:#94a3b8;stroke-width:11;stroke-linecap:round;stroke-linejoin:round}
    #${PAGINA} .dm-it-scena[data-dm-it-scena="stufa"] .dm-it-flusso-fumo{
      stroke:#f1f5f9;stroke-width:7;stroke-dasharray:16 96;opacity:0;animation:none}
    #${PAGINA} .dm-it-scena[data-dm-it-scena="stufa"][data-brucia="true"] .dm-it-flusso-fumo{
      opacity:.9;animation:dmItFumo 3.2s linear infinite}
    @keyframes dmItFumo{from{stroke-dashoffset:112}to{stroke-dashoffset:0}}

    /* Il quadro dei comandi: a destra della scena sul computer, sotto la
       scena sul telefono. Ogni riga e' il nome, il «−», il valore e il «+». */
    #${PAGINA} .dm-it-stufa-pannello{
      position:absolute;right:28px;top:50%;transform:translateY(-50%);z-index:5;
      width:336px;display:grid;gap:10px;padding:14px;border-radius:24px;
      background:rgba(255,255,255,.94);border:1px solid var(--card-border,#e2e8f0);
      box-shadow:0 26px 50px -30px rgba(15,23,42,.6)}
    #${PAGINA} .dm-it-stufa-testa{
      display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 2px 4px}
    #${PAGINA} .dm-it-stufa-fase{
      display:inline-flex;align-items:center;gap:8px;min-width:0;padding:8px 13px;
      border-radius:999px;border:1px solid var(--card-border,#e2e8f0);
      background:var(--bg-sculpted,#f0f4f8);color:var(--text-dim,#64748b);
      font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #${PAGINA} .dm-it-stufa-fase::before{
      content:"";flex:0 0 auto;width:8px;height:8px;border-radius:50%;background:#cbd5e1}
    #${PAGINA} .dm-it-stufa-fase[data-brucia="true"]{
      color:#c2410c;background:#fff7ed;border-color:rgba(249,115,22,.45)}
    #${PAGINA} .dm-it-stufa-fase[data-brucia="true"]::before{
      background:#f97316;box-shadow:0 0 0 4px rgba(249,115,22,.18)}
    #${PAGINA} .dm-it-stufa-fase[data-fase="spegnimento"]{color:#b45309}
    #${PAGINA} .dm-it-stufa-fase[data-fase="spegnimento"]::before{background:#f59e0b}
    #${PAGINA} .dm-it-stufa-fase[data-fase="allarme"]{
      color:#b91c1c;background:#fef2f2;border-color:rgba(220,38,38,.45)}
    #${PAGINA} .dm-it-stufa-fase[data-fase="allarme"]::before{background:#dc2626}
    #${PAGINA} .dm-it-stufa-accendi{flex:0 0 auto;min-height:46px;padding:0 18px}
    #${PAGINA} .dm-it-stufa-riga{
      display:flex;align-items:center;justify-content:space-between;gap:10px;
      padding:8px 8px 8px 14px;border-radius:16px;background:var(--bg-sculpted,#f0f4f8)}
    #${PAGINA} .dm-it-stufa-lbl{
      min-width:0;font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
      color:var(--text-dim,#64748b);overflow:hidden;text-overflow:ellipsis}
    #${PAGINA} .dm-it-stufa-regola{display:flex;align-items:center;gap:6px;flex:0 0 auto}
    #${PAGINA} .dm-it-stufa-passo{
      width:44px;height:44px;flex:0 0 auto;display:grid;place-items:center;padding:0;
      border-radius:14px;border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      cursor:pointer;font:inherit;font-size:22px;font-weight:700;line-height:1;color:#3d4d66;
      box-shadow:0 6px 14px -10px rgba(15,23,42,.55);transition:transform .12s ease,opacity .2s ease}
    #${PAGINA} .dm-it-stufa-passo:active{transform:scale(.94)}
    #${PAGINA} .dm-it-stufa-passo:disabled{opacity:.35;cursor:default;box-shadow:none}
    #${PAGINA} .dm-it-stufa-val{
      min-width:96px;display:flex;align-items:center;justify-content:center;gap:7px;
      font-family:'Oswald',sans-serif;font-variant-numeric:tabular-nums;color:#1e293b}
    #${PAGINA} .dm-it-stufa-val b{font-size:20px;font-weight:500;line-height:1}
    #${PAGINA} .dm-it-stufa-unita{font-size:12px;opacity:.75;margin-left:-5px}
    #${PAGINA} .dm-it-stufa-punti{display:flex;gap:4px}
    #${PAGINA} .dm-it-stufa-punti i{width:8px;height:8px;border-radius:50%;background:#cbd5e1}
    #${PAGINA} .dm-it-stufa-punti i[data-on="true"]{
      background:linear-gradient(135deg,#fb923c,#ea580c);box-shadow:0 0 6px rgba(234,88,12,.45)}
    #${PAGINA} .dm-it-stufa-ventola{width:26px;height:26px;flex:0 0 auto;color:#94a3b8}
    #${PAGINA} .dm-it-stufa-ventola-anello{fill:none;stroke:currentColor;stroke-width:1.6;opacity:.4}
    #${PAGINA} .dm-it-stufa-ventola-pale{fill:currentColor;transform-origin:12px 12px}
    #${PAGINA} .dm-it-stufa-ventola[data-gira="true"]{color:#ea580c}
    #${PAGINA} .dm-it-stufa-ventola[data-gira="true"] .dm-it-stufa-ventola-pale{
      animation:dmItGiro var(--dm-it-giro,1.4s) linear infinite}
    @keyframes dmItGiro{to{transform:rotate(360deg)}}
    /* La fascia rossa dell'allarme: in fondo alla scena, larga quanto il
       disegno. Un allarme di una stufa vuol dire andare a guardarla. */
    #${PAGINA} .dm-it-stufa-allarme{
      position:absolute;left:24px;right:388px;bottom:20px;z-index:7;
      display:flex;align-items:center;gap:14px;padding:12px 18px;border-radius:16px;
      background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;
      box-shadow:0 16px 32px -16px rgba(185,28,28,.85)}
    #${PAGINA} .dm-it-stufa-allarme-ic{
      flex:0 0 auto;display:grid;place-items:center;width:38px;height:38px;border-radius:50%;
      background:rgba(255,255,255,.18);font-size:19px;line-height:1}
    #${PAGINA} .dm-it-stufa-allarme-parole{display:grid;gap:2px;min-width:0}
    #${PAGINA} .dm-it-stufa-allarme b{
      font-size:10.5px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;opacity:.85}
    #${PAGINA} .dm-it-stufa-allarme-testo{
      font-size:16px;font-weight:800;line-height:1.25;overflow-wrap:anywhere}

    /* ── tema scuro ─────────────────────────────────────────────────────── */
    html[data-theme="dark"] #${PAGINA} .dm-it-tubo{stroke:#26324b}
    html[data-theme="dark"] #${PAGINA} .dm-it-tubo-int{stroke:#141d31}
    html[data-theme="dark"] #${PAGINA} .dm-it-nome,
    html[data-theme="dark"] #${PAGINA} .dm-it-etichetta,
    html[data-theme="dark"] #${PAGINA} .dm-it-fuoco,
    html[data-theme="dark"] #${PAGINA} .dm-it-sonde,
    html[data-theme="dark"] #${PAGINA} .dm-it-obiettivo,
    html[data-theme="dark"] #${PAGINA} .dm-it-salto{
      background:rgba(20,29,49,.95);color:#93a5c0}
    html[data-theme="dark"] #${PAGINA} .dm-it-pellet{
      background:linear-gradient(180deg,#1b2439,#111a2c)}
    html[data-theme="dark"] #${PAGINA} .dm-it-tab{color:#b9c7dc}
    html[data-theme="dark"] #${PAGINA} .dm-it-strip{background:#0c1322;border-color:#26324b}
    html[data-theme="dark"] #${PAGINA} .dm-it-pellet-cifra{color:#e2e8f0}
    html[data-theme="dark"] #${PAGINA} .dm-it-pellet-chili .dm-it-pellet-cifra{color:#0f172a}
    html[data-theme="dark"] #${PAGINA} .dm-it-nome[data-scarso="true"]{color:#fca5a5}
    /* La stufa al buio: la ceramica un tono sotto, perche' un bianco pieno su
       un palco scuro abbaglia, e la canna un acciaio che si veda ancora. */
    html[data-theme="dark"] #${PAGINA} .dm-it-stufa{
      background:linear-gradient(100deg,#ece4d6,#d2c5b2 46%,#a99780);
      box-shadow:0 30px 52px -26px rgba(0,0,0,.85),inset 0 0 0 1px rgba(255,255,255,.1)}
    html[data-theme="dark"] #${PAGINA} .dm-it-canna{stroke:#475569}
    html[data-theme="dark"] #${PAGINA} .dm-it-canna-int{stroke:#64748b}
    html[data-theme="dark"] #${PAGINA} .dm-it-stufa-pannello{
      background:rgba(20,29,49,.95);border-color:#26324b;box-shadow:0 26px 50px -30px rgba(0,0,0,.9)}
    html[data-theme="dark"] #${PAGINA} .dm-it-stufa-riga{background:#0f172a}
    html[data-theme="dark"] #${PAGINA} .dm-it-stufa-passo{background:#1b2439;border-color:#2c3a55;color:#e2e8f0}
    html[data-theme="dark"] #${PAGINA} .dm-it-stufa-val{color:#e2e8f0}
    html[data-theme="dark"] #${PAGINA} .dm-it-stufa-lbl{color:#93a5c0}
    html[data-theme="dark"] #${PAGINA} .dm-it-stufa-punti i{background:#334155}
    html[data-theme="dark"] #${PAGINA} .dm-it-stufa-punti i[data-on="true"]{
      background:linear-gradient(135deg,#fb923c,#ea580c)}
    html[data-theme="dark"] #${PAGINA} .dm-it-stufa-fase{background:#0f172a;border-color:#26324b;color:#93a5c0}
    html[data-theme="dark"] #${PAGINA} .dm-it-stufa-fase[data-brucia="true"]{
      background:rgba(249,115,22,.12);border-color:rgba(249,115,22,.45);color:#fdba74}
    html[data-theme="dark"] #${PAGINA} .dm-it-stufa-fase[data-fase="allarme"]{
      background:rgba(220,38,38,.14);color:#fca5a5}
    html[data-theme="dark"] #${PAGINA} .dm-it-stufa-accendi:not([data-on="true"]){
      background:#1b2439;border-color:#2c3a55;color:#cbd5e1}

    /* ── telefono: il palco si accorcia e le targhette rientrano ────────── */
    @media (max-width:768px){
      #${PAGINA} .dm-it-stage{height:470px;border-radius:24px}
      #${PAGINA} .dm-it-tank{width:104px;height:168px}
      #${PAGINA} .dm-it-caldaia{width:146px;height:158px}
      #${PAGINA} .dm-it-plate{min-width:88px;padding:8px 12px}
      #${PAGINA} .dm-it-plate-val{font-size:21px}
      #${PAGINA} .dm-it-radiatore i{height:54px;width:8px}
      /* Sul telefono il palco e' stretto: la combustione e il serbatoio
         rientrano invece di uscire dal bordo sinistro. */
      /* Su uno schermo stretto le nove letture si darebbero di gomito: i
         pezzi nuovi vanno dove c'e' posto — la fascia libera al centro a
         destra, l'angolo in basso, la spalla della targhetta di mandata.
         Le posizioni sono scritte in linea e solo un !important le puo'
         scavalcare; il palco resta quello, cambiano di posto loro. */
      #${PAGINA} .dm-it-nodo-corpo{left:78%!important;top:7%!important}
      #${PAGINA} .dm-it-nodo-fuoco{left:62%!important;top:60%!important}
      #${PAGINA} .dm-it-nodo-pellet{left:82%!important;top:90%!important}
      #${PAGINA} .dm-it-nodo-pellet .dm-it-nome{font-size:9px;padding:4px 9px}
      #${PAGINA} .dm-it-fuoco{min-width:64px;padding:7px 9px;gap:3px}
      /* In colonna invece che in riga: il pannello si stringe della meta' e
         sta nella fascia libera senza salire sopra il serbatoio. */
      #${PAGINA} .dm-it-fuoco-riga{flex-direction:column;align-items:flex-start;gap:0}
      #${PAGINA} .dm-it-fuoco-val{font-size:13px}
      #${PAGINA} .dm-it-fuoco-lbl{font-size:8.5px;letter-spacing:.5px}
      #${PAGINA} .dm-it-pellet{width:36px;height:66px}
      #${PAGINA} .dm-it-sonde{padding:5px 8px}
      #${PAGINA} .dm-it-sonda b{font-size:12px}
      #${PAGINA} .dm-it-tab{font-size:11px;padding:10px 8px;letter-spacing:.04em}
      #${PAGINA} .dm-it-tab span:last-child{display:none}
      #${PAGINA} .dm-it-tab-ic{transform:scale(1.25)}
      /* I due serbatoi (#182) sul telefono non hanno un angolo libero: in
         quello in basso a destra, dove sta il serbatoio da solo, due non ci
         stanno accanto a Ritorno, e quello in basso a sinistra e' dell'acqua
         calda. Il palco allora si allunga di una mensola: la scena resta alta
         quanto prima — le altre letture non si spostano di un pixel —, i
         serbatoi stanno sotto, in mezzo, e lo stato con la leva scende in
         fondo, dove sta sempre. L'avviso della pressione bassa scende con
         loro, sopra la leva come prima: non sulla mensola. */
      #${PAGINA} .dm-it-stage[data-dm-it-serbatoi="2"]{height:578px}
      #${PAGINA} .dm-it-stage[data-dm-it-serbatoi="2"]>.dm-it-scena{bottom:108px}
      #${PAGINA} .dm-it-stage[data-dm-it-serbatoi="2"] .dm-it-nodo-serbatoi{
        left:50%!important;top:calc(100% + 12px)!important}
      #${PAGINA} .dm-it-stage[data-dm-it-serbatoi="2"] .dm-it-comandi-caldaia{bottom:-98px}
      #${PAGINA} .dm-it-stage[data-dm-it-serbatoi="2"] .dm-it-allarme{bottom:-98px}
      #${PAGINA} .dm-it-serbatoi{gap:10px}
      #${PAGINA} .dm-it-serbatoio{gap:7px}
      #${PAGINA} .dm-it-nodo-serbatoi .dm-it-nome{font-size:9px;padding:4px 9px}
      #${PAGINA} .dm-it-pellet-cifra{font-size:11.5px;top:5px}
      /* La stufa (#183): il palco si allunga quanto serve, perche' sotto la
         scena viene il quadro dei comandi; la scena resta un'altezza sua, e
         le letture fanno colonna a destra della stufa. */
      #${PAGINA} .dm-it-stage[data-dm-it-tipo="stufa"]{height:auto;min-height:220px}
      #${PAGINA} .dm-it-stage[data-dm-it-tipo="stufa"]>.dm-it-scena{position:relative;inset:auto;height:336px}
      #${PAGINA} .dm-it-stage[data-dm-it-tipo="stufa"]>.dm-it-vuoto{position:relative;inset:auto;min-height:220px}
      #${PAGINA} .dm-it-stufa{width:128px;height:182px;border-radius:22px 22px 11px 11px}
      #${PAGINA} .dm-it-stufa-piano{padding:0 8px;border-radius:9px}
      #${PAGINA} .dm-it-stufa-display{font-size:9px;padding:2px 4px}
      #${PAGINA} .dm-it-stufa-porta{border-radius:12px}
      #${PAGINA} .dm-it-aria-computer{display:none}
      #${PAGINA} .dm-it-aria-telefono{display:inline}
      #${PAGINA} .dm-it-nodo-fumi{left:75%!important;top:12%!important}
      #${PAGINA} .dm-it-nodo-stanza{left:75%!important;top:38%!important}
      #${PAGINA} .dm-it-nodo-pellet-stufa{left:75%!important;top:70%!important}
      #${PAGINA} .dm-it-nodo-pellet-stufa .dm-it-nome{font-size:9.5px;padding:4px 10px}
      #${PAGINA} .dm-it-stufa-pannello{
        position:static;transform:none;width:auto;margin:0 12px 14px;padding:12px;border-radius:20px}
      #${PAGINA} .dm-it-stufa-passo{width:48px;height:48px;border-radius:15px}
      #${PAGINA} .dm-it-stufa-val{min-width:84px}
      #${PAGINA} .dm-it-stufa-allarme{position:static;margin:14px 12px 0}
    }
    @media (prefers-reduced-motion:reduce){
      #${PAGINA} .dm-it-flusso,#${PAGINA} .dm-it-fiamma,#${PAGINA} .dm-it-plate{animation:none!important}
      #${PAGINA} .dm-it-stufa-lingua,#${PAGINA} .dm-it-stufa-brace,#${PAGINA} .dm-it-aria-calda,
      #${PAGINA} .dm-it-stufa-ventola-pale{animation:none!important}
    }
    `,
  );
}

export function installImpiantiTermiciSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  /* Il nome della pagina lo scrive l'intestazione, che resta il suo padrone:
   * qui le si dice soltanto quale macchina si sta guardando adesso. */
  registraTitoloDiPagina(PAGINA, () => {
    const scelti = impiantiDiCasa();
    const attiva = tabAttiva(scelti, state.tab);
    /* Con le linguette il titolo torna a essere il nome della sezione: a dire
     * quale macchina si sta guardando ci pensa la linguetta accesa, e ripetere
     * lo stesso nome due volte a due centimetri di distanza e' rumore. Senza
     * linguette il titolo e' l'unica cosa che lo dice, e allora lo dice. */
    if (servonoLinguette(scelti))
      return { title: t(...NOME_SEZIONE), subtitle: t(...BRICIOLA_SEZIONE) };
    if (!attiva) return { title: t(...NOME_SEZIONE), subtitle: t(...BRICIOLA_SEZIONE) };
    return {
      title: t(...TITOLI_TERMICI[attiva]),
      subtitle: t(...BRICIOLE_TERMICHE[attiva]),
    };
  });
  rinominaLaSezione();
  /* «Appena apro si legge Solare, poi cambia in Gestione termica.»
   *
   * La linguetta della configurazione la scrive il guscio quando costruisce il
   * pannello, e col nome vecchio: rinominarla al primo ridisegno vuol dire
   * lasciarla vedere per un attimo com'era. `apriConfigEntita` e' il momento
   * esatto in cui quel pannello esiste e nessuno l'ha ancora guardato — si
   * riscrive li', prima che venga disegnato, e il cambio non si vede piu'. */
  wrapFunction("apriConfigEntita", "__dmImpiantiRinomina", () => rinominaLaSezione());
  doc.addEventListener("click", onClick);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:states-ready",
    "dashboardmodern:persistence-restored",
    "pageshow",
  ]) {
    root.addEventListener?.(evento, schedule);
  }
  /* Il cambio pagina passa da un tasto della barra: quando si entra qui la
   * scena va disegnata, e nessun evento di stato lo annuncia. */
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.("[data-tab],[data-page],.tab")) root.setTimeout?.(schedule, 0);
    },
    true,
  );
  schedule();
  return true;
}

senzaCadere(installImpiantiTermiciSection);
