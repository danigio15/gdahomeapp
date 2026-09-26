/* Escludere un varco dall'antifurto, senza uscire dalla plancia (#136).
 *
 * «Nei varchi che ho inserito, che sono i sensori del mio allarme Risco, sono
 * tutti dei binary sensor che gia' Home Assistant vede mi da' la possibilita'
 * di disabilitare. Possiamo farlo anche qui?»
 *
 * Chi ha una centrale vera fa questa cosa di continuo: la finestra del bagno
 * resta aperta di notte, e prima di inserire l'antifurto quella zona la si
 * ESCLUDE. Non e' una porta aperta da chiudere — e' una porta che si vuole
 * lasciare aperta, dicendo alla centrale di non guardarla. Chi l'ha chiesto ce
 * l'ha gia' in Home Assistant: le integrazioni delle centrali — Risco per
 * prima — accanto a ogni contatto pubblicano un interruttore che fa esattamente
 * questo. In gdahome non si arrivava: si vedeva la porta aperta e basta, e per
 * escluderla bisognava uscire dalla plancia.
 *
 * ── Cos'e' un'esclusione, e cosa non e' ──────────────────────────────────
 *
 * Non e' il contatto, e non e' il varco. E' un INTERRUTTORE a parte, che la
 * centrale pubblica e che vive di vita sua: acceso vuol dire «questa non la
 * guardo». Il contatto continua a dire la verita' — aperta e' aperta anche
 * quando e' esclusa — ed e' il motivo per cui il conto degli aperti qui non si
 * tocca: una finestra esclusa e' una finestra aperta, e dirla chiusa sarebbe la
 * bugia tranquillizzante che questa pagina evita da sempre.
 *
 * ── Acceso vuol dire escluso ─────────────────────────────────────────────
 *
 * Una convenzione sola, e dichiarata: l'interruttore acceso e' il varco
 * escluso. E' il verso di tutti i `bypass` che le centrali pubblicano, ed e'
 * anche l'unico che si legge senza pensarci. Non c'e' un giro-il-segno come per
 * i contatti (`verso-aperture.js`): quello esiste perche' meta' dei contatti
 * porta-finestra del mondo sono cablati all'incontrario e non c'era modo di
 * scegliere. Qui l'interruttore lo scrive chi configura, una casella per volta,
 * e se ne trovasse uno girato basta che non lo metta. Una seconda casella
 * «questo e' al contrario» sarebbe una domanda in piu' a tutti per un caso che
 * nessuno ha ancora avuto.
 *
 * ── E chi non risponde non si comanda ────────────────────────────────────
 *
 * Un interruttore `unavailable` non e' un'esclusione spenta: e' un'esclusione
 * che non si sa. Li' non si disegna nessun tasto, per la stessa regola per cui
 * la fila dei comandi di un lettore mostra solo quelli che il lettore sa
 * eseguire davvero (#132): un tasto che chiama un servizio che non arriva da
 * nessuna parte e' un tasto rotto, e da fuori non si distingue da uno che
 * funziona.
 *
 * Nessun DOM qui dentro, e nessuna parola: solo chi e' escluso e cosa mandare.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** Il campo, nella riga del varco, che tiene l'interruttore d'esclusione. */
export const CAMPO_ESCLUSIONE = "esclusione";

/* I due domini che sanno fare un'esclusione.
 *
 * `switch.` e' quello che pubblicano le centrali; `input_boolean.` e' quello
 * che si fa in casa chi la centrale la governa con le automazioni. Sono anche
 * gli unici due che accettano `turn_on`, `turn_off` e `toggle` con questo
 * significato: un `binary_sensor` racconta e basta, e metterlo qui vorrebbe
 * dire un tasto che non comanda niente. */
const DOMINI = Object.freeze(["switch.", "input_boolean."]);

/** Se questa entita' puo' fare da interruttore d'esclusione. */
export function puoEscludere(entity) {
  const id = pulito(entity);
  return DOMINI.some((dominio) => id.startsWith(dominio)) && id.split(".")[1]?.length > 0;
}

/* Le parole con cui si chiama questo interruttore. `bypass` la usano le
 * integrazioni delle centrali; le altre sono per chi se l'e' fatto in casa in
 * italiano. */
const PAROLE = Object.freeze(["bypass", "esclusione", "escludi", "escluso"]);

/**
 * L'interruttore che con ogni probabilita' esclude questo contatto.
 *
 * Serve a non far battere a mano un identificativo che la centrale ha gia'
 * scritto: si propone, non si decide. Chi configura lo vede nella casella e lo
 * cancella se non e' quello — e finche' non salva, non esiste.
 *
 * ── Perche' cerca cosi' poco ──────────────────────────────────────────────
 *
 * Si accettano due forme sole, e la parola d'esclusione deve essere una PAROLA
 * INTERA attaccata al nome del contatto: `porta_ingresso_bypass` o
 * `escludi_porta_ingresso`. La prima e' quella che pubblica Risco, la seconda
 * quella che scrive chi governa la centrale con le automazioni.
 *
 * La regola larga — «un interruttore che cominci come il contatto e abbia
 * `bypass` addosso» — sembrava piu' generosa e invece era pericolosa: per un
 * contatto che si chiama `binary_sensor.porta` avrebbe proposto
 * `switch.porta_cantina_bypass`, cioe' l'esclusione di un'ALTRA porta, pronta a
 * essere salvata da chi si fida della proposta. Una proposta sbagliata qui non
 * e' una comodita' in meno: e' una finestra che resta sorvegliata mentre chi ha
 * premuto crede di averla esclusa, e un'altra esclusa senza che nessuno
 * l'abbia chiesto. Meglio far scrivere una casella a mano.
 */
export function esclusioneProposta(entity, states = {}) {
  const id = pulito(entity);
  const oggetto = id.split(".")[1] || "";
  if (!oggetto) return "";
  const nomi = new Set();
  for (const dominio of DOMINI)
    for (const parola of PAROLE) {
      nomi.add(`${dominio}${oggetto}_${parola}`);
      nomi.add(`${dominio}${parola}_${oggetto}`);
    }
  return Object.keys(states || {}).find((quale) => nomi.has(quale) && puoEscludere(quale)) || "";
}

/* Muti sono muti, qui come nei contatti. */
const MUTI = new Set(["unavailable", "unknown", "none", ""]);

/**
 * Come sta l'esclusione di questo varco.
 *
 * `"escluso"` quando l'interruttore e' acceso, `"sorvegliato"` quando e'
 * spento, e `""` quando non c'e' interruttore o non risponde — che non e'
 * «sorvegliato»: e' «non lo so», ed e' la differenza fra dire a chi inserisce
 * l'antifurto una cosa vera e una rassicurante.
 */
export function comeStaLEsclusione(interruttore, states = {}) {
  const id = pulito(interruttore);
  if (!puoEscludere(id)) return "";
  const grezzo = pulito(states?.[id]?.state).toLowerCase();
  if (MUTI.has(grezzo)) return "";
  if (grezzo === "on" || grezzo === "true") return "escluso";
  if (grezzo === "off" || grezzo === "false") return "sorvegliato";
  return "";
}

/**
 * Il comando che gira l'esclusione, o `null` se non c'e' niente da girare.
 *
 * Si manda `turn_on` o `turn_off`, non `toggle`: `toggle` su uno stato che non
 * si e' letto bene fa il contrario di quello che chi preme si aspetta, e su un
 * antifurto il contrario e' «ho lasciato scoperta una porta credendo di
 * escluderla». Sapendo com'e' adesso si dice dove deve andare.
 */
export function ilComandoDellEsclusione(interruttore, states = {}) {
  const id = pulito(interruttore);
  const come = comeStaLEsclusione(id, states);
  if (!come) return null;
  return {
    domain: id.split(".")[0],
    service: come === "escluso" ? "turn_off" : "turn_on",
    data: { entity_id: id },
  };
}

/**
 * Il conto delle esclusioni, fra le righe dei varchi.
 *
 * E' la meta' che conta davvero di questa segnalazione: poter escludere serve
 * a poco se poi, davanti al tastierino, non si vede che c'e' una porta
 * esclusa. Chi inserisce l'antifurto deve saperlo prima, non scoprirlo dopo.
 */
export function contoDelleEsclusioni(righe = []) {
  const escluse = (Array.isArray(righe) ? righe : []).filter(
    (riga) => pulito(riga?.esclusione) && riga?.escluso === "escluso",
  );
  return {
    esclusi: escluse.length,
    nomi: escluse.map((riga) => pulito(riga?.name)).filter(Boolean),
  };
}
