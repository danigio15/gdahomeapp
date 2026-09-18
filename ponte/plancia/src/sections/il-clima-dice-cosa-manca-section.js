/* «Inserisci nome ed entità climate valida» su un'entità valida (#10).
 *
 * «Sto provando a configurare il Trial Hisense ma ogni qualvolta che seleziono
 *  l'entità "climate.condizionatore_sala" mi da questo errore "Inserisci nome
 *  ed entità climate valida". Non so se sbaglio io ma non riesco a farlo
 *  andare.»
 *
 * Non sbagliava lui. Il controllo del guscio e' uno solo per due cose:
 *
 *     if (!name || !ent.includes('.')) alert('Inserisci nome ed entità climate valida');
 *
 * e `climate.condizionatore_sala` il punto ce l'ha. Quello che mancava era il
 * NOME — la casella sopra, che chi arriva li' per scegliere un condizionatore
 * non guarda — e il messaggio dava la colpa all'entita', cioe' all'unica cosa
 * che era giusta. Chi lo legge rilegge l'entita' dieci volte e non trova
 * niente, perche' non c'e' niente da trovare.
 *
 * Due cure, e la prima vale piu' della seconda.
 *
 * ── Il nome, se non c'e', lo sappiamo ──────────────────────────────────────
 *
 * Il nome di quel condizionatore Home Assistant ce l'ha: si chiama
 * «Condizionatore Sala», e sta nel `friendly_name` dell'entita' appena scelta.
 * Chiederlo a chi sta configurando vuol dire chiedergli di ribattere una cosa
 * che la casa ha gia' detto. Allora si scrive da solo, appena l'entita' e'
 * scelta e finche' la casella e' vuota: chi lo vuole diverso lo cambia, e la
 * sua parola vince — questa non lo tocca piu'.
 *
 * ── E se manca davvero, si dice cosa manca ─────────────────────────────────
 *
 * Restano i casi in cui il nome non si puo' indovinare — un'entita' che non
 * c'e' fra gli stati, una casella svuotata apposta — e li' il messaggio dice
 * una cosa sola: quale delle due caselle e', e la mette a fuoco. «Nome ed
 * entita'» era una frase che descriveva il controllo, non il problema.
 */
import { clean, doc, onEditorRedraw, root, t } from "./shared.js";
import { allStates } from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

const KEY = "__DASHBOARDMODERN_CLIMA_COSA_MANCA__";
const state = (root[KEY] ||= { installed: false });

const CAMPO_NOME = "ed-cl-name";
const CAMPO_ENTITA = "ed-cl-ent";

/* Un'entita' intera: `dominio.nome`. E' la stessa regola del guscio — il
 * punto — scritta per quello che vuol dire. */
const ENTITA_INTERA = /^[a-z_]+\.[a-z0-9_]+$/i;

function campo(id) {
  return doc?.getElementById?.(id) || null;
}

function valore(id) {
  return clean(campo(id)?.value);
}

/** Il nome che Home Assistant da' a quell'entita', o «». */
export function nomeProposto(entity, states = allStates()) {
  const id = clean(entity);
  if (!ENTITA_INTERA.test(id)) return "";
  const detto = clean(nomeDaHomeAssistant(id, states));
  /* Quando non lo conosce, `nomeDaHomeAssistant` torna l'id stesso: un nome
   * uguale all'entity_id non e' un nome, e' la stessa cosa scritta due volte. */
  return !detto || detto === id ? "" : detto;
}

/**
 * Cosa manca davvero, guardando le due caselle.
 *
 * Torna `"entita"`, `"nome"`, o `""` quando si puo' salvare. Il nome proposto
 * conta come nome: se si sa, la casella la riempiamo noi.
 */
export function cosaMancaAlClima({ nome, entita, proposto } = {}) {
  if (!ENTITA_INTERA.test(clean(entita))) return "entita";
  if (!clean(nome) && !clean(proposto)) return "nome";
  return "";
}

function avvisa(quale) {
  const dove = quale === "entita" ? CAMPO_ENTITA : CAMPO_NOME;
  const detto =
    quale === "entita"
      ? t(
          "Scegli l'entità del clima: è quella che comincia per climate.",
          "Choose the climate entity: it is the one starting with climate.",
        )
      : t("Dai un nome all'unità: è quello che si legge sulla card.", "Name the unit: it is what the card shows.");
  try {
    campo(dove)?.focus?.();
  } catch (_errore) {}
  if (typeof root.edToast === "function") root.edToast(`⚠️ ${detto}`);
  else root.alert?.(detto);
}

/* Il nome si propone appena l'entita' e' scritta o scelta, e solo su una
 * casella vuota: chi ne ha messo uno suo non se lo vede cambiare sotto le
 * dita. */
function proponiIlNome() {
  const casella = campo(CAMPO_NOME);
  if (!casella || clean(casella.value)) return false;
  const proposto = nomeProposto(valore(CAMPO_ENTITA));
  if (!proposto) return false;
  casella.value = proposto;
  return true;
}

function onInput(event) {
  if (event.target?.id !== CAMPO_ENTITA) return;
  proponiIlNome();
}

/* Il guscio controlla le stesse due cose dopo di noi: quando qui si passa,
 * di la' si passa. Questo giro serve a fermarsi PRIMA del suo messaggio, che
 * dice la cosa sbagliata. */
function aggancia() {
  const originale = root.edAddClima;
  if (typeof originale !== "function" || originale.__dmClimaCosaManca) return false;
  function dicendoCosaManca(...args) {
    const entita = valore(CAMPO_ENTITA);
    const manca = cosaMancaAlClima({
      nome: valore(CAMPO_NOME),
      entita,
      proposto: nomeProposto(entita),
    });
    if (manca) {
      avvisa(manca);
      return undefined;
    }
    proponiIlNome();
    return originale.apply(this, args);
  }
  Object.assign(dicendoCosaManca, originale);
  dicendoCosaManca.__dmClimaCosaManca = true;
  dicendoCosaManca.__dmPrevious = originale;
  root.edAddClima = dicendoCosaManca;
  return true;
}

export function installClimaCosaManca() {
  if (!doc || state.installed) return false;
  state.installed = true;
  doc.addEventListener("input", onInput);
  doc.addEventListener("change", onInput);
  const installa = () => aggancia();
  onEditorRedraw("__dmClimaCosaManca", () => root.queueMicrotask?.(installa));
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(installa));
  installa();
  return true;
}
