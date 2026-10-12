/* La Config e' di chi la casella «Utente admin» nomina.
 *
 * «Ho messo il mio nome in Utente admin, e l'utente della revisione — che in
 * Home Assistant non amministra — apre la Config e la cambia lo stesso.»
 *
 * La regola sta in `core/chi-configura.js`, con il perche' dei tre buchi che
 * la lasciavano passare. Qui c'e' il lavoro di tutti i giorni, cioe' le porte:
 *
 *  - **chi guarda.** Si chiede al ponte con le parole di Home Assistant
 *    (`auth/current_user`). Nell'app e' l'unico che lo sa: risponde con
 *    l'utente a cui e' intestato il telefono — non con l'add-on, che e' con
 *    chi Home Assistant crede di parlare — e dice lui se la Config gli si apre.
 *    Dentro Home Assistant risponde lo stesso, con chi l'ingress dice che sta
 *    guardando. Nel pannello dell'integrazione, dove il ponte non c'e', la
 *    stessa domanda arriva a Home Assistant, che con la sessione di chi guarda
 *    risponde giusto: li' il confronto col nome lo si fa qui.
 *  - **le porte della Config.** Sono parecchie, ed e' per questo che una
 *    linguetta nascosta non bastava: la linguetta stessa, che l'app tocca da
 *    fuori anche quando non si vede (la voce «Configurazione plancia» del
 *    menu, e `#gdahome-config` nell'indirizzo); l'ingranaggio in cima; il
 *    cartello della plancia vuota; il menu della plancia con il suo «Reset
 *    totale». Chi non puo' trova la linguetta e l'ingranaggio spariti, e se ci
 *    arriva lo stesso — da un tocco dell'app, da un indirizzo — la Config non
 *    si apre e gli si dice perche'.
 *  - **il nome dov'era.** Chi aveva gia' riempito la casella l'aveva scritta
 *    nel deposito del suo dispositivo (`cd_connection`): appena la
 *    configurazione condivisa arriva, quel nome passa in `cd_branding`, dove
 *    lo vedono anche gli altri vetri e il ponte. Una volta sola, e solo se
 *    nella plancia la casella non c'e' ancora.
 *
 * Il lucchetto vero pero' sta nel ponte: un salvataggio di chi non e'
 * nominato lo rifiuta lui (`ponte/src/commissioni.js`). Quello che si fa qui
 * e' non mostrare una porta che poi non si apre.
 */
import {
  amministratoriScritti,
  nomiPuliti,
  siApreLaConfig,
} from "../core/chi-configura.js";
import {
  chiediAHomeAssistant,
  clean,
  doc,
  installStyle,
  readJson,
  root,
  senzaCadere,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_CHI_CONFIGURA__";
const state = (root[KEY] ||= {
  installed: false,
  /* La risposta di chi ospita la pagina: `{id, name, is_admin,
   * gdahome_config?}`. `null` finche' non e' arrivata. */
  chiSono: null,
  inVolo: false,
  tentativi: 0,
  riprova: 0,
  avvisatoIl: 0,
  travasato: false,
  /* Se la configurazione condivisa e' gia' arrivata: prima, il deposito del
   * browser puo' essere ancora quello di un'altra volta, e il nome di prima
   * non si travasa su una copia vecchia. */
  ripristinata: false,
});

/* Le funzioni del guscio che aprono la Config, o la cancellano tutta. */
const PORTE = Object.freeze(["apriConfigEntita", "apriSetupWizard", "wzResetAll"]);
const SEGNO = "__dmSoloChiConfigura";
const CLASSE = "dm-config-riservata";
const DOMANDE_AL_MASSIMO = 8;

function profilo() {
  return clean(root.__DASHBOARDMODERN_PROFILE__) || "primary";
}

/* I nomi della casella, dove stanno adesso o dove stavano prima. */
export function amministratoriDiQuestaPlancia() {
  return amministratoriScritti({
    branding: readJson("cd_branding", null) ?? cdCfgSicuro("cd_branding"),
    collegamento: readJson("cd_connection", null),
    config: root.DASHBOARD_CONFIG,
  });
}

function cdCfgSicuro(chiave) {
  try {
    return typeof root.cdCfg === "function" ? root.cdCfg(chiave) : null;
  } catch (_error) {
    return null;
  }
}

/* Chi sta guardando, quando si sa: la risposta di chi ospita la pagina, se
 * c'e'; se no quello che ne sa la pagina — l'identificativo che il pannello le
 * consegna, e il nome che Home Assistant ha in mano. */
function utenteCheGuarda() {
  const detto = state.chiSono;
  if (detto && (clean(detto.id) || clean(detto.name)))
    return { id: clean(detto.id), name: clean(detto.name) };
  const id = clean(root.__DASHBOARDMODERN_UTENTE__);
  let name = "";
  try {
    name = clean(typeof root.getCurrentHassUser === "function" ? root.getCurrentHassUser() : "");
  } catch (_error) {
    name = "";
  }
  return id || name ? { id, name } : null;
}

/** Se a chi guarda la Config si apre. La usa anche il guscio
 * (`updateEditButtonVisibility`), cosi' la regola e' una. */
export function puoConfigurare() {
  const dalPonte = state.chiSono?.gdahome_config;
  return siApreLaConfig({
    amministratori: amministratoriDiQuestaPlancia(),
    utente: utenteCheGuarda(),
    dalPonte: typeof dalPonte === "boolean" ? dalPonte : null,
  });
}

/* ─── Chi sono ───────────────────────────────────────────────────────────── */

/* La domanda al ponte. Si fa solo dove la pagina e' ospitata — il suo
 * WebSocket va al ponte o al pannello — e si riprova qualche volta, perche'
 * appena aperta la pagina il filo puo' non esserci ancora. Un no non si
 * ripete: un ponte di ieri che non la conosce non la conoscera' fra un
 * secondo. */
function chiediChiSono({ ancora = false } = {}) {
  if (!root.__DASHBOARDMODERN_HOSTED__ || state.inVolo) return;
  if (state.chiSono && !ancora) return;
  if (state.tentativi >= DOMANDE_AL_MASSIMO && !ancora) return;
  state.tentativi += 1;
  state.inVolo = true;
  chiediAHomeAssistant({ type: "auth/current_user", profile: profilo() })
    .then((risposta) => {
      if (risposta && typeof risposta === "object") {
        state.chiSono = {
          id: clean(risposta.id),
          name: clean(risposta.name),
          is_admin: risposta.is_admin === true,
          ...(typeof risposta.gdahome_config === "boolean"
            ? { gdahome_config: risposta.gdahome_config }
            : {}),
        };
      }
    })
    .catch((errore) => {
      /* Il filo non c'era ancora: si riprova fra poco. Un rifiuto vero no. */
      if (/socket|msgId|timeout/.test(String(errore?.message || ""))) riprovaFraPoco();
    })
    .finally(() => {
      state.inVolo = false;
      if (state.ripristinata) travasa();
      applica();
    });
}

function riprovaFraPoco() {
  if (state.riprova || state.tentativi >= DOMANDE_AL_MASSIMO) return;
  state.riprova = root.setTimeout?.(() => {
    state.riprova = 0;
    chiediChiSono();
  }, 1500);
}

/* ─── Le porte ───────────────────────────────────────────────────────────── */

function avvisa() {
  const adesso = Date.now();
  /* L'app la Config la chiede toccando la linguetta, e ritocca per qualche
   * secondo finche' la pagina non risponde: un avviso per ogni tocco
   * sarebbero cento avvisi. */
  if (adesso - state.avvisatoIl < 4000) return;
  state.avvisatoIl = adesso;
  if (!doc?.body) return;
  let cartello = doc.getElementById("dm-config-riservata-avviso");
  if (!cartello) {
    cartello = doc.createElement("div");
    cartello.id = "dm-config-riservata-avviso";
    cartello.setAttribute("role", "status");
    doc.body.append(cartello);
  }
  cartello.textContent = t(
    "La configurazione di questa plancia è riservata al suo amministratore.",
    "This dashboard's configuration is reserved for its administrator.",
  );
  cartello.classList.add("dm-si-vede");
  root.clearTimeout?.(state.cartello);
  state.cartello = root.setTimeout?.(() => cartello.classList.remove("dm-si-vede"), 3200);
}

/* Un tocco sulla linguetta della Config, di un dito o di un programma: si
 * ascolta in cattura sul documento, che e' il primo posto dove passa, e la
 * linguetta il suo ascoltatore non lo sente nemmeno. */
export function sulTocco(evento) {
  const voce = evento.target?.closest?.('.tab[data-tab="config"]');
  if (!voce || puoConfigurare()) return;
  evento.preventDefault?.();
  evento.stopImmediatePropagation?.();
  avvisa();
}

/* Le funzioni del guscio che aprono la Config, avvolte da una domanda. Si
 * avvolgono una volta sola, e quello che le altre sezioni ci hanno appeso
 * sopra resta — `Object.assign` si porta dietro i loro segni. */
export function chiudiLePorte() {
  for (const nome of PORTE) {
    const sua = root[nome];
    if (typeof sua !== "function" || sua[SEGNO]) continue;
    function soloAChiPuo(...argomenti) {
      if (!puoConfigurare()) {
        avvisa();
        return undefined;
      }
      return sua.apply(this, argomenti);
    }
    Object.assign(soloAChiPuo, sua);
    soloAChiPuo[SEGNO] = true;
    soloAChiPuo.__dmPrevious = sua;
    root[nome] = soloAChiPuo;
  }
}

/* Linguetta e ingranaggio nascosti a chi non puo', e la Config chiusa se era
 * gia' aperta — per esempio perche' la risposta del ponte e' arrivata dopo
 * che la pagina si era aperta da sola sull'indirizzo. */
export function applica() {
  if (!doc?.body) return;
  const puo = puoConfigurare();
  doc.body.classList.toggle(CLASSE, !puo);
  try {
    root.updateEditButtonVisibility?.();
  } catch (_error) {}
  if (puo) return;
  try {
    doc.getElementById("editor-modal")?.remove?.();
  } catch (_error) {}
  const aperta = doc.getElementById("page-config");
  if (aperta?.classList?.contains("active")) {
    try {
      doc.querySelector('.tab[data-tab="home"]')?.click?.();
    } catch (_error) {}
  }
}

/* ─── Il nome dov'era ───────────────────────────────────────────────────── */

function travasa() {
  if (state.travasato) return;
  const branding = readJson("cd_branding", null);
  if (branding && typeof branding === "object" && Array.isArray(branding.admin_users)) {
    state.travasato = true;
    return;
  }
  const vecchi = nomiPuliti(readJson("cd_connection", null)?.admin_users);
  if (!vecchi.length) {
    state.travasato = true;
    return;
  }
  /* Lo scrive solo chi la Config la puo' aprire: per chiunque altro il ponte
   * direbbe di no, e una scrittura rifiutata resterebbe in sospeso. */
  if (!puoConfigurare()) return;
  state.travasato = true;
  const fuori = branding && typeof branding === "object" ? { ...branding } : {};
  fuori.admin_users = vecchi.slice(0, 1);
  writeJsonIfChanged("cd_branding", fuori);
}

function installaLoStile() {
  installStyle(
    "dm-config-riservata-style",
    `
      /* Chi non puo' non vede la porta: la linguetta in fondo e l'ingranaggio
         in cima. Il guscio la linguetta la nasconde gia' da se'; questa riga
         c'e' perche' qualcuno la rimette a vista con un !important suo. */
      html body.${CLASSE} #tab-config,
      html body.${CLASSE} .tab[data-tab="config"],
      html body.${CLASSE} header .dm-editor-entry{display:none!important}
      #dm-config-riservata-avviso{
        position:fixed;left:50%;bottom:calc(88px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%) translateY(12px);max-width:min(92vw,420px);
        padding:11px 16px;border-radius:14px;background:rgba(15,23,42,.94);color:#f8fafc;
        font-size:13px;font-weight:700;line-height:1.4;text-align:center;z-index:100001;
        opacity:0;pointer-events:none;transition:opacity .2s ease,transform .2s ease
      }
      #dm-config-riservata-avviso.dm-si-vede{opacity:1;transform:translateX(-50%) translateY(0)}
      @media(prefers-reduced-motion:reduce){#dm-config-riservata-avviso{transition:none}}
    `,
  );
}

export function installLaConfigEDiChiLaAmministra() {
  if (!doc || state.installed) return false;
  state.installed = true;
  root.dmPuoConfigurare = puoConfigurare;
  installaLoStile();
  doc.addEventListener("click", sulTocco, true);
  chiudiLePorte();
  const ancora = () => {
    chiudiLePorte();
    chiediChiSono();
    applica();
  };
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:states-ready", "pageshow"])
    root.addEventListener?.(evento, ancora);
  /* La configurazione arrivata puo' aver cambiato la casella: si richiede la
   * risposta al ponte, e il nome di prima passa dove deve stare. */
  root.addEventListener?.("dashboardmodern:persistence-restored", () => {
    state.ripristinata = true;
    chiudiLePorte();
    travasa();
    chiediChiSono({ ancora: true });
    applica();
  });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", ancora, { once: true });
  else ancora();
  return true;
}

senzaCadere(installLaConfigEDiChiLaAmministra);
