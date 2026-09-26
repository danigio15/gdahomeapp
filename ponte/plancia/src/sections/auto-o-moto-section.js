/* Auto o moto, veicolo per veicolo (#75).
 *
 * «Sarebbe carino poter scegliere tra auto e moto.»
 *
 * La pagina Auto e' nata per un'automobile e lo dice dappertutto: il titolo,
 * il disegno, le caselle. Chi ha una moto elettrica ha esattamente le stesse
 * entita' — la colonnina, la batteria, l'autonomia, l'odometro — e le mappa
 * nella stessa scheda, ma la plancia continua a chiamarla «Auto» e a
 * chiedergli le portiere, i finestrini, il bagagliaio e il cofano. Sono
 * quattro caselle che su una moto non si riempiranno mai, e restano li' a far
 * sembrare la configurazione incompleta.
 *
 * Il mezzo NON e' il motore. Una moto puo' essere elettrica, a benzina o
 * ibrida come un'auto: sono due domande, e metterle sulla stessa tendina
 * vorrebbe dire sei voci per due cose che non c'entrano niente fra loro. Sono
 * due righe, una sotto l'altra, e il mezzo sta sopra perche' e' la domanda
 * piu' grossa: decide di cosa si sta parlando, il motore decide cosa fa.
 *
 * ── Cosa cambia, e cosa no ────────────────────────────────────────────────
 *
 * Cambia quello che si vede: il disegno nella riga dell'elenco, il titolo
 * della pagina, le parole della scheda, e le quattro caselle che spariscono.
 *
 * Non cambia niente di quello che c'e' sotto: le entita' sono le stesse
 * `dm.ev_*` di sempre, la ricarica si conta allo stesso modo, il profilo si
 * salva per la stessa strada. Una moto e' un veicolo con quattro domande in
 * meno, non un'altra sezione.
 *
 * ── Dove vive la scelta ───────────────────────────────────────────────────
 *
 * Nel profilo, accanto al motore, perche' in un garage possono starci una
 * moto e un'automobile e una risposta sola per tutte e due sarebbe falsa per
 * una delle due. Chi non ha nessun profilo — ha una moto sola e ha compilato
 * le `dm.ev_*` della plancia senza mai premere «Salva» — la scrive in
 * `cd_ev_mezzo`, che e' la casa che il motore ha gia' avuto per lo stesso
 * identico motivo.
 *
 * Le caselle nascoste NON si svuotano. Chi sceglie «Moto» per sbaglio e
 * torna indietro ritrova quello che aveva mappato: si nasconde una riga, non
 * si butta via un riferimento.
 */
import {
  MEZZI,
  MEZZO_DI_CASA_KEY,
  MEZZO_FIELD,
  VEHICLE_KEY_FIELD,
  eUnaMoto,
  mezzoDelVeicolo,
  updateVehicle,
} from "../core/vehicle-model.js";
import { EVENTO_VEICOLO_IN_SCHEDA, profiles, salvaAuto } from "./ev-section.js";
import { diChiParlaLaScheda } from "./auto-termica-section.js";
import { renderPageMastheads } from "./page-masthead-section.js";
import {
  clean,
  disegnoDiCasa,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_AUTO_O_MOTO__";
const state = (root[KEY] ||= { installed: false });

/* Le quattro caselle che una moto non ha.
 *
 * Non e' un elenco di comodo: e' la ragione per cui questa scelta serve. Una
 * moto non ha portiere ne' finestrini, non ha un bagagliaio e non ha un cofano
 * da aprire. Il resto — carburante, motore, allarme, posizione, pneumatici,
 * batteria di servizio — ce l'ha uguale a un'auto, e resta dov'e'. */
export const CASELLE_SENZA_MOTO = Object.freeze([
  "dm.ev_portiere",
  "dm.ev_finestrini",
  "dm.ev_bagagliaio",
  "dm.ev_cofano",
]);

/** Il disegno di un veicolo: la moto se l'ha dichiarato, se no l'automobile. */
export function disegnoDelVeicolo(car, misura = 34) {
  return disegnoDiCasa(eUnaMoto(car) ? "moto" : "ev", { misura, ripiego: "ev" });
}

/** Come si chiama un mezzo, nella scelta e nelle frasi. */
export function nomeDelMezzo(mezzo) {
  return mezzoDelVeicolo(mezzo) === "moto" ? t("Moto", "Motorcycle") : t("Auto", "Car");
}

/* ── la scelta, nella scheda ───────────────────────────────────────────── */

function laScelta() {
  return doc?.querySelector?.("#ed-body [data-ev-mezzo-riga]") || null;
}

/* La scelta dice del veicolo aperto: alla matita si riallinea, al «＋» torna
 * auto. Una scelta fatta e non ancora salvata non si riscrive sotto le dita —
 * e' la stessa regola della tendina del motore, e per la stessa ragione. */
function sincronizzaLaScelta() {
  const casella = laScelta();
  if (!casella) return false;
  const { chiave, auto, casa } = diChiParlaLaScheda();
  if (casella.dataset.dmPer !== chiave) {
    casella.dataset.dmPer = chiave;
    casella.dataset.dmMezzo = casa
      ? mezzoDelVeicolo(readJson(MEZZO_DI_CASA_KEY, ""))
      : mezzoDelVeicolo(auto?.[MEZZO_FIELD]);
  }
  const scelto = clean(casella.dataset.dmMezzo) || "auto";
  for (const voce of casella.querySelectorAll("[data-ev-mezzo]")) {
    const suo = voce.dataset.evMezzo === "moto" ? "moto" : "auto";
    const acceso = suo === (scelto === "moto" ? "moto" : "auto");
    voce.classList.toggle("on", acceso);
    voce.setAttribute("aria-checked", String(acceso));
  }
  return true;
}

/* Scegliere SCRIVE, come per il motore.
 *
 * Il tasto verde in fondo alla sezione salva le caselle, non questa scelta: se
 * la scelta aspettasse lui, chi la fa e poi salva la sezione se la vedrebbe
 * buttata via senza che nessuno glielo abbia detto. La bozza del «＋» e'
 * l'unica che aspetta, perche' il veicolo di cui parla non esiste ancora. */
export function scriviIlMezzo(valore) {
  const mezzo = mezzoDelVeicolo(valore);
  const { auto, casa } = diChiParlaLaScheda();
  const casella = laScelta();
  if (casella) casella.dataset.dmMezzo = mezzo;
  if (casa) {
    writeJsonIfChanged(MEZZO_DI_CASA_KEY, mezzo);
  } else if (auto) {
    const uid = clean(auto[VEHICLE_KEY_FIELD]);
    if (!uid) return false;
    if (mezzoDelVeicolo(auto[MEZZO_FIELD]) !== mezzo)
      salvaAuto(updateVehicle(profiles(), uid, { [MEZZO_FIELD]: mezzo }));
  }
  sincronizzaLaScelta();
  nascondiLeCaselleCheNonHa();
  decoraLElencoDeiVeicoli();
  renderPageMastheads();
  return true;
}

/** Il mezzo scritto nella scheda adesso: lo legge chi salva un veicolo nuovo. */
export function mezzoNellaScheda() {
  return mezzoDelVeicolo(laScelta()?.dataset?.dmMezzo || "");
}

/* La riga della scelta, sopra quella del motore.
 *
 * Si aggancia PRIMA della riga del motore quando c'e', e subito sotto il nome
 * quando non c'e' ancora: cosi' l'ordine non dipende da quale delle due mani
 * e' arrivata per prima. */
export function ensureLaSceltaDelMezzo() {
  const nome = doc?.getElementById?.("ed-evcar-name");
  const rigaNome = nome?.parentElement;
  if (!rigaNome) return false;
  let casella = laScelta();
  if (!casella) {
    casella = doc.createElement("label");
    casella.className = "ed-slot dm-mezzo";
    casella.dataset.evMezzoRiga = "true";
    casella.innerHTML = `<span class="ed-slot-lbl">${esc(t("Mezzo", "Vehicle kind"))}</span>
      <div class="dm-mezzo-scelta" role="radiogroup" aria-label="${esc(t("Mezzo", "Vehicle kind"))}">${MEZZI.map(
        (mezzo) =>
          `<button type="button" class="dm-mezzo-voce" role="radio" aria-checked="false" data-ev-mezzo="${esc(mezzo)}">${disegnoDiCasa(
            mezzo === "moto" ? "moto" : "ev",
            { misura: 30, ripiego: "ev" },
          )}<span>${esc(nomeDelMezzo(mezzo))}</span></button>`,
      ).join("")}</div>
      <small>${esc(
        t(
          "Cambia il disegno, il titolo della pagina e le caselle che si vedono. Una moto non ha portiere, finestrini, bagagliaio né cofano: quelle caselle spariscono, e quello che c'era scritto resta.",
          "It changes the drawing, the page title and the fields you see. A motorcycle has no doors, windows, boot or bonnet: those fields go away, and whatever was mapped to them stays.",
        ),
      )}</small>`;
  }
  /* Sempre sopra il motore, anche quando il guscio ridisegna la scheda e
   * rimette i figli al loro posto. */
  const motore = doc.querySelector("#ed-body [data-ev-tipo-riga]");
  if (motore) {
    if (motore.previousElementSibling !== casella) motore.before(casella);
  } else if (rigaNome.nextElementSibling !== casella) {
    rigaNome.after(casella);
  }
  sincronizzaLaScelta();
  nascondiLeCaselleCheNonHa();
  return true;
}

/* ── le caselle che una moto non ha ────────────────────────────────────── */

/* Si NASCONDE la riga, non si toglie.
 *
 * Toglierla vorrebbe dire ricostruirla al ritorno, e la scelta si cambia:
 * chi prova «Moto» e torna ad «Auto» deve ritrovare le sue quattro caselle
 * com'erano, con dentro quello che ci aveva messo. */
export function nascondiLeCaselleCheNonHa() {
  const corpo = doc?.getElementById?.("ed-body");
  if (!corpo) return 0;
  const moto = mezzoNellaScheda() === "moto";
  let toccate = 0;
  for (const ref of CASELLE_SENZA_MOTO) {
    const campo = corpo.querySelector(`.ed-slot-in[data-ref="${ref}"]`);
    const riga = campo?.closest(".ed-slot");
    if (!riga) continue;
    riga.classList.toggle("dm-senza-moto", moto);
    toccate += 1;
  }
  return toccate;
}

/* ── il disegno nella riga dell'elenco ─────────────────────────────────── */

/* Tre veicoli in elenco, tutti col loro nome e niente altro: per capire quale
 * e' quale bisogna leggere. Il disegno lo dice prima della parola, ed e'
 * l'unico posto in cui la scelta si vede senza aprire niente. */
export function decoraLElencoDeiVeicoli() {
  const corpo = doc?.getElementById?.("ed-body");
  if (!corpo || !doc.getElementById("ed-evcar-name")) return 0;
  const elenco = profiles();
  let disegnate = 0;
  for (const bottone of corpo.querySelectorAll('[data-act="use"]')) {
    const riga = bottone.closest(".ed-row");
    if (!riga) continue;
    const indice = Number.parseInt(bottone.dataset.idx || "-1", 10);
    const auto = Number.isFinite(indice) ? elenco[indice] : null;
    if (!auto) continue;
    let posto = riga.querySelector(":scope > .dm-veicolo-ic");
    if (!posto) {
      posto = doc.createElement("span");
      posto.className = "dm-veicolo-ic";
      riga.prepend(posto);
    }
    const quale = eUnaMoto(auto) ? "moto" : "ev";
    if (posto.dataset.dmMezzo !== quale) {
      posto.dataset.dmMezzo = quale;
      posto.innerHTML = disegnoDelVeicolo(auto, 34);
    }
    togliLEmojiDalNome(riga);
    disegnate += 1;
  }
  return disegnate;
}

/* E l'emoji che il guscio mette davanti al nome se ne va.
 *
 * Il documento vendorizzato scrive «\u{1F697} Leapmotor B10»: con il disegno accanto
 * diventano due immagini della stessa cosa nella stessa riga — e una delle due
 * e' l'emoji di sistema, che cambia faccia da un telefono all'altro e non
 * c'entra niente con la scocca blu notte che le sta a fianco. E' la stessa
 * cosa gia' detta per le altre sezioni: «le icone non sono stilizzate nello
 * stesso modo».
 *
 * Toglierla serve anche a un'altra cosa, piu' prosaica: su un telefono a
 * quattrocento pixel quei due caratteri erano la differenza fra «Leapmotor
 * B10» e «Leap…». Si toglie solo il prefisso, e solo se c'e': un nome che
 * comincia per emoji perche' l'ha voluto chi l'ha scritto non si tocca, e per
 * questo si guarda esattamente quella del guscio e non «un'emoji qualunque».
 *
 * Si rifa' a ogni giro perche' il guscio ridisegna l'elenco e la rimette. */
const EMOJI_DEL_GUSCIO = /^(?:\u{1F697}|\u{1F699}|\u{1F6FB})\uFE0F?\s+/u;

function togliLEmojiDalNome(riga) {
  const nome = riga.querySelector(":scope .ed-row-new");
  if (!nome) return false;
  const scritto = nome.textContent || "";
  if (!EMOJI_DEL_GUSCIO.test(scritto)) return false;
  nome.textContent = scritto.replace(EMOJI_DEL_GUSCIO, "");
  return true;
}

/* ── il foglio ─────────────────────────────────────────────────────────── */

function foglio() {
  installStyle(
    "dm-auto-o-moto-style",
    `
    #ed-body .dm-mezzo-scelta{display:grid!important;grid-template-columns:1fr 1fr!important;gap:9px!important}
    #ed-body .dm-mezzo-voce{display:flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;padding:10px 8px!important;border:1px solid var(--card-border,#dbe4ee)!important;border-radius:14px!important;background:var(--card-bg,#fff)!important;color:var(--text,#0f172a)!important;font-size:13px!important;font-weight:800!important;cursor:pointer!important}
    #ed-body .dm-mezzo-voce svg{display:block!important;width:30px!important;height:30px!important}
    #ed-body .dm-mezzo-voce.on{border-color:#0ea5e9!important;box-shadow:0 0 0 2px rgba(14,165,233,.25)!important;background:color-mix(in srgb,#0ea5e9 8%,transparent)!important}
    #ed-body .dm-veicolo-ic{flex:0 0 34px!important;line-height:0!important;margin-right:2px!important}
    #ed-body .dm-veicolo-ic svg{display:block!important;width:34px!important;height:34px!important}
    /* Il nome per intero, anche se va a capo.
     *
     * La riga tiene il disegno, l'interruttore, la matita e il cestino: su un
     * telefono restano un centinaio di pixel per la parola, e «Leapmotor B10»
     * usciva «Leapmot…». Un elenco in cui non si legge quale veicolo e' quale
     * non serve a niente — e' la stessa cosa gia' chiesta per i dispositivi
     * non collegati, «si vedono tutti, col nome intero». Una riga piu' alta
     * costa molto meno di un nome tagliato. */
    #ed-body .ed-row:has(>.dm-veicolo-ic) .ed-row-new,
    #ed-body .ed-row:has(>.dm-veicolo-ic) .ed-row-old{white-space:normal!important;overflow:visible!important;text-overflow:clip!important}
    #ed-body .ed-row:has(>.dm-veicolo-ic) .ed-row-new{line-height:1.25!important}
    #ed-body .ed-row:has(>.dm-veicolo-ic) .ed-row-old{line-height:1.3!important}
    #ed-body .ed-slot.dm-senza-moto{display:none!important}
    `,
  );
}

/* ── il giro ───────────────────────────────────────────────────────────── */

function onClick(event) {
  const voce = event.target?.closest?.("#ed-body [data-ev-mezzo]");
  if (!voce) return;
  event.preventDefault();
  scriviIlMezzo(voce.dataset.evMezzo);
}

function rifai() {
  ensureLaSceltaDelMezzo();
  decoraLElencoDeiVeicoli();
}

export function installAutoOMoto() {
  if (!doc || state.installed) return false;
  state.installed = true;
  foglio();
  doc.addEventListener("click", onClick);
  wrapFunction("apriConfigEntita", "__dmAutoOMoto", () => root.queueMicrotask?.(rifai));
  onEditorRedraw("__dmAutoOMoto", () => root.queueMicrotask?.(rifai));
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:editor-rendered",
    /* E soprattutto questo: la matita cambia il veicolo di cui parla la
     * scheda senza passare da un ridisegno, e la scelta deve riallinearsi a
     * lui. Senza, aprendo una moto si leggeva «Auto» — e un tocco su quella
     * risposta sbagliata la salvava sopra quella giusta. */
    EVENTO_VEICOLO_IN_SCHEDA,
  ])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(rifai));
  rifai();
  return true;
}

installAutoOMoto();
