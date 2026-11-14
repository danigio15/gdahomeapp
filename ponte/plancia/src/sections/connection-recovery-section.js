/* Rientrare nell'app non deve lasciare la plancia a "CONNECTING…".
 *
 * Su iPhone il sistema butta via la pagina dell'app quando passi ad altro: al
 * rientro il pannello di Home Assistant la ricostruisce da zero. Il runtime
 * apre la presa verso Home Assistant una volta sola, all'avvio, e se
 * quell'unico tentativo non va a buon fine non ne prova altri:
 *
 *     try { ws = new WebSocket(...); } catch(e) { return; }
 *
 * Quel `return` e' un vicolo cieco. Sulla pagina appena ricostruita il ponte
 * verso il frontend ospite puo' non essere ancora pronto, il costruttore della
 * presa salta, e la plancia resta con la scritta che sta nel documento appena
 * aperto — "CONNECTING…" — con i gradi a "--" e i riquadri vuoti. Chiudere e
 * riaprire l'app la sistema, perche' e' un avvio nuovo in cui il ponte fa in
 * tempo: e' esattamente cio' che raccontava chi l'ha segnalata.
 *
 * Qui non si apre nessuna presa: si richiama `connect()`, quello del runtime,
 * quando la plancia non e' connessa — al rientro dall'altra app, al ritorno
 * della rete, quando l'app dice che il suo filo con la casa c'e' di nuovo, e
 * intanto a intervalli che si allargano. Da connessi non resta acceso niente.
 *
 * «Con l'ultimo aggiornamento quando riapro l'app resta il puntino rosso,
 * devo fare refresh della plancia.» Il pallino restava rosso per tre buchi,
 * tutti di questa sezione:
 *
 *  - **una presa aperta e muta non si cambiava mai.** `connect()` non apre
 *    niente sopra una presa aperta, ed e' giusto per una presa che lavora; ma
 *    dentro l'app la presa si apre verso il servitore del telefono, e
 *    `auth_ok` arriva solo quando c'e' il filo con la casa. Una presa aperta
 *    da un lato che dall'altro non c'era piu' — il telefono sospeso si
 *    riprende le sue prese — restava li': aperta, senza `auth_ok`, senza
 *    chiusura, e ogni giro diceva «c'e' gia' una presa». Rossa per sempre;
 *  - **l'attesa non ripartiva da capo a una caduta.** Mentre si riprova la
 *    scala si allunga fino a trenta secondi, e una chiusura arrivata in quel
 *    mentre chiedeva due secondi a un timer che ne aveva gia' trenta: l'app
 *    rifa' il filo piu' volte al rientro (la sveglia, la strada di casa,
 *    l'orologio che chiede lo stato), e ogni volta la presa si chiudeva e la
 *    plancia restava ad aspettare il suo turno a filo gia' tornato;
 *  - **nessuno le diceva che il filo era tornato.** Lo sa l'app: adesso lo
 *    dice (`gdahome:filo`, `schermate/plancia_vera.dart`), e la plancia si
 *    ricollega subito invece di indovinare quando. E una presa che sembra
 *    collegata si prova con un `ping`: se non risponde, il pallino torna
 *    rosso e la presa si rifa' — il pallino dice come sta la presa davvero.
 */
import {
  doc,
  english,
  lexicalGlobal,
  root,
  scriviTestoSeCambia,
  t,
  senzaCadere,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_CONNECTION_RECOVERY__";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  timer: 0,
  attempts: 0,
  lastTry: 0,
  /* Il timer del guscio che questa sezione ha spento, contato. */
  legacyTimersCancelled: 0,
  /* Quando l'app ha detto l'ultima volta che il filo c'e'. */
  filoProntoIl: 0,
  /* Mentre e' vero, connect() puo' sostituire una presa aperta e muta. */
  sostituisciLaMuta: false,
  /* Le prese date per morte dalla prova del `ping`. */
  preseMute: 0,
});

/** Prima riprova, e il tetto oltre il quale l'attesa non cresce piu'. */
const FIRST_DELAY = 2000;
const MAX_DELAY = 30000;
/** Due tentativi non si accavallano mai piu' stretti di cosi'. */
export const MIN_GAP_MS = 4000;
/** Una presa che sta ancora aprendosi dopo tutto questo e' una presa ferma. */
export const STALE_CONNECTING_MS = 8000;
/** L'attesa fissa con cui il runtime richiamava connect() dopo una chiusura. */
export const LEGACY_RECONNECT_DELAY_MS = 5000;
/* Una presa aperta che in tutto questo non ha detto `auth_ok` e' muta.
 *
 * Dentro l'app la cucitura aspetta il filo con la casa al piu' venti secondi
 * (`app/lib/plancia/cucitura.dart`, `attesaDelFilo`) e poi chiude lei: oltre,
 * dall'altra parte non c'e' piu' nessuno a chiuderla. */
export const STALE_OPEN_MS = 25000;
/** Detto dall'app che il filo c'e', una presa muta ha ancora questo per dire
 * `auth_ok`: la cucitura lo manda appena trova il filo. */
export const FILO_GRACE_MS = 1500;
/** Per quanto vale «il filo e' tornato» detto dall'app. */
export const FILO_FRESCO_MS = 10000;
/** Quanto si aspetta una risposta al `ping` di prova: piu' dei sei secondi
 * che il filo dell'app si da' al risveglio (`Filo.pazienzaAlRisveglio`), perche'
 * da fuori il `pong` puo' fare la fila dietro gli stati. */
export const PROBE_TIMEOUT_MS = 8000;
/** L'avviso dell'app: il suo filo con la casa c'e' (di nuovo). */
export const EVENTO_DEL_FILO = "gdahome:filo";

function legacyConnect() {
  const candidate = root.connect ?? lexicalGlobal("connect");
  return typeof candidate === "function" ? candidate : null;
}

function socketConstant(name, fallback) {
  const value = root.WebSocket?.[name];
  return typeof value === "number" ? value : fallback;
}

/* Un padrone solo per la riconnessione.
 *
 * Il runtime, alla chiusura della presa, arma `setTimeout(connect, 5000)`;
 * e `connect()` apre una presa nuova senza chiudere la vecchia. Con questa
 * sezione che riprova per conto suo — deve, perche' il primo tentativo del
 * runtime puo' saltare senza nessuna chiusura da cui ripartire — dopo una
 * caduta si arrivava a due giri che chiamavano connect(): due prese aperte in
 * parallelo, due sottoscrizioni agli stati, e ognuna che alla sua chiusura
 * ne riarmava un'altra.
 *
 * Qui il padrone e' questa sezione, e il timer del runtime non nasce: la
 * chiusura della presa passa di qui, e il `setTimeout` da cinque secondi con
 * dentro `connect` viene lasciato cadere prima di essere armato. Al suo
 * posto si arma la scala di questa sezione (2, 4, 8… 30 s, e subito al
 * rientro). E `connect()` non apre mai una presa sopra una viva: se quella
 * che c'e' e' aperta non fa niente; se sta ancora aprendosi da poco la
 * lascia finire; se e' ferma la chiude prima di aprirne un'altra. Una presa
 * sostituita che si chiude non dice piu' niente: il pallino e i gestori in
 * attesa sono della presa nuova. */
function adoptSocket(socket) {
  if (!socket || typeof socket !== "object" || socket.__dmRecoveryOwned) return false;
  socket.__dmRecoveryOwned = true;
  socket.__dmOpenedAt = Date.now();
  /* Qualunque cosa arrivi dice che la presa e' viva: e' la risposta alla
   * prova del `ping` (vedi `verificaLaPresa`). Non si legge niente — un
   * `get_states` da un megabyte non si apre due volte — si guarda solo che
   * sia arrivato. */
  const legacyMessage = socket.onmessage;
  if (typeof legacyMessage === "function") {
    socket.onmessage = function ownedMessage(event) {
      if (socket.__dmProva) {
        root.clearTimeout?.(socket.__dmProva);
        socket.__dmProva = 0;
      }
      return legacyMessage.call(this, event);
    };
  }
  const legacyClose = socket.onclose;
  if (typeof legacyClose !== "function") return false;
  socket.onclose = function ownedClose(event) {
    if (socket.__dmProva) {
      root.clearTimeout?.(socket.__dmProva);
      socket.__dmProva = 0;
    }
    /* Una presa che non e' piu' quella corrente e' stata sostituita da
     * connect(): la sua chiusura non riguarda nessuno. */
    if (socket.__dmSuperseded || (lexicalGlobal("ws") ?? root.ws) !== socket) return undefined;
    /* Era collegata davvero, prima di chiudersi: e' una caduta, non l'ennesimo
     * tentativo andato a vuoto, e l'attesa riparte da capo. */
    const eraSu = connectionUp();
    const originalSetTimeout = root.setTimeout;
    const record = (root.__DASHBOARDMODERN_LEGACY_RECONNECT__ ||= {
      timer: 0,
      callback: null,
      args: [],
      captured: false,
      cancelled: false,
    });
    function droppingSetTimeout(handler, delay, ...rest) {
      if (Number(delay) === LEGACY_RECONNECT_DELAY_MS && handler === root.connect) {
        record.captured = true;
        record.cancelled = true;
        record.timer = 0;
        record.callback = null;
        record.args = [];
        state.legacyTimersCancelled += 1;
        return 0;
      }
      return originalSetTimeout.call(root, handler, delay, ...rest);
    }
    root.setTimeout = droppingSetTimeout;
    try {
      return legacyClose.call(this, event);
    } finally {
      if (root.setTimeout === droppingSetTimeout) root.setTimeout = originalSetTimeout;
      if (eraSu) riparti(FIRST_DELAY);
      else watch(FIRST_DELAY);
    }
  };
  return true;
}

export function installConnectOwner() {
  const current = root.connect;
  if (typeof current !== "function" || current.__dmConnectionRecovery) return false;
  function connectOwned(...args) {
    const previous = lexicalGlobal("ws") ?? root.ws;
    if (previous && typeof previous === "object") {
      const readyState = previous.readyState;
      /* Aperta e collegata: non si tocca. Aperta e muta si lascia stare lo
       * stesso — la cucitura sta aspettando il filo — tranne quando chi
       * chiama ha deciso che e' muta davvero (`reconnectDecision`). */
      if (readyState === socketConstant("OPEN", 1) && (connectionUp() || !state.sostituisciLaMuta))
        return undefined;
      const fresh = Date.now() - (Number(previous.__dmOpenedAt) || 0) < STALE_CONNECTING_MS;
      if (readyState === socketConstant("CONNECTING", 0) && fresh) return undefined;
      if (readyState !== socketConstant("CLOSED", 3)) {
        previous.__dmSuperseded = true;
        try {
          previous.close();
        } catch (_error) {}
      }
    }
    const result = current.apply(this, args);
    adoptSocket(lexicalGlobal("ws") ?? root.ws);
    return result;
  }
  Object.assign(connectOwned, current);
  connectOwned.__dmConnectionRecovery = true;
  connectOwned.__dmPrevious = current;
  root.connect = connectOwned;
  /* La presa che il runtime ha aperto all'avvio, prima che questa sezione
   * esistesse: anche la sua chiusura passa di qui. */
  adoptSocket(lexicalGlobal("ws") ?? root.ws);
  return true;
}

/* Connessa vuol dire autenticata, non "la presa esiste".
 *
 * Il pallino prende la classe quando Home Assistant risponde `auth_ok` e la
 * perde alla chiusura: e' l'unico segnale che dice se i dati arrivano davvero,
 * ed e' scritto dal runtime, non da qui. */
export function connectionUp(scope = doc) {
  return Boolean(scope?.getElementById?.("live-dot")?.classList?.contains("connected"));
}

/** Lo stato della presa del runtime, `null` quando non ce n'e' una. */
export function socketReadyState() {
  const value = lexicalGlobal("ws")?.readyState;
  return typeof value === "number" ? value : null;
}

/** Da quanto c'e' la presa del runtime, in millisecondi; zero se non si sa. */
function socketAge() {
  const nata = Number(lexicalGlobal("ws")?.__dmOpenedAt) || 0;
  return nata ? Date.now() - nata : 0;
}

/* Se valga la pena richiamare connect(), e perche'.
 *
 * Separata dal resto perche' e' l'unico punto dove si decide qualcosa: il
 * contorno legge il documento e guarda l'orologio, questa no. */
export function reconnectDecision({
  up,
  readyState,
  sinceLastTry,
  connecting = 0,
  open = 1,
  sinceOpen = 0,
  filoPronto = false,
  eager = false,
}) {
  if (up) return { retry: false, reason: "connessa" };
  /* Aperta e senza `auth_ok`. Di solito e' la cucitura dell'app che aspetta
   * il filo con la casa, e lo manda appena c'e': si aspetta. Ma se l'app ha
   * detto che il filo c'e' e la presa tace lo stesso, o se tace da piu' di
   * quanto la cucitura aspetti mai, dall'altra parte non c'e' nessuno: e'
   * muta, e si cambia. Prima qui si diceva sempre «c'e' gia' una presa», e
   * una presa cosi' teneva il pallino rosso per sempre. */
  if (readyState === open) {
    if (sinceOpen >= STALE_OPEN_MS || (filoPronto && sinceOpen >= FILO_GRACE_MS)) {
      return { retry: true, reason: "presa muta" };
    }
    return { retry: false, reason: "aspetta la casa" };
  }
  if (readyState === connecting && sinceLastTry < STALE_CONNECTING_MS) {
    return { retry: false, reason: "sta gia' provando" };
  }
  /* Chi ha appena riaperto l'app non aspetta il turno.
   *
   * La pausa fra due tentativi serve a non impilare prese mentre nessuno
   * guarda. Al rientro qualcuno sta guardando lo schermo adesso: la prova si fa
   * subito, e l'unico freno che resta e' quello che conta davvero — non
   * aprirne una seconda sopra una che si sta ancora aprendo. */
  if (!eager && sinceLastTry < MIN_GAP_MS) return { retry: false, reason: "troppo presto" };
  return { retry: true, reason: readyState == null ? "nessuna presa" : "presa ferma" };
}

/* La scritta dice cosa sta succedendo.
 *
 * Il documento nasce con "CONNECTING…" e nessuno la riscrive finche' la presa
 * non si apre: chi guarda non ha modo di distinguere "sto provando adesso" da
 * "sono fermo qui da dieci minuti". Da connessi non si tocca niente: quella
 * scritta appartiene al runtime. */
function announceRetry() {
  const label = doc?.getElementById("conn-text");
  if (!label || connectionUp()) return false;
  const text = t("Riconnessione…", "Reconnecting…");
  scriviTestoSeCambia(label, text);
  return true;
}

export function attemptReconnect({ force = false, eager = false } = {}) {
  const decision = reconnectDecision({
    up: connectionUp(),
    readyState: socketReadyState(),
    sinceLastTry: Date.now() - state.lastTry,
    connecting: root.WebSocket?.CONNECTING ?? 0,
    open: root.WebSocket?.OPEN ?? 1,
    sinceOpen: socketAge(),
    filoPronto: Date.now() - state.filoProntoIl < FILO_FRESCO_MS,
    eager,
  });
  if (!force && !decision.retry) return false;
  const connect = legacyConnect();
  if (!connect) return false;
  state.lastTry = Date.now();
  state.attempts += 1;
  announceRetry();
  state.sostituisciLaMuta = decision.reason === "presa muta";
  try {
    connect();
  } catch (_error) {
    return false;
  } finally {
    state.sostituisciLaMuta = false;
  }
  return true;
}

/* La scala riparte da capo: il timer che c'era, magari a trenta secondi, si
 * butta, e se ne arma uno al primo gradino. */
function riparti(delay = FIRST_DELAY) {
  if (state.timer) {
    root.clearTimeout?.(state.timer);
    state.timer = 0;
  }
  return watch(delay);
}

/* La presa sembra collegata: lo e'?
 *
 * Si manda un `ping` — Home Assistant e il ponte rispondono `pong`, e dentro
 * l'app passa dalla cucitura e dal filo fino alla casa — e qualunque cosa
 * torni entro qualche secondo dice che la presa e' viva. Se non torna niente,
 * il pallino verde mentiva: si spegne, la presa si lascia, e se ne apre una
 * nuova. Solo sulle prese vere del browser: il ponte del pannello di Home
 * Assistant (`legacy/bridge-socket.js`) vive nella stessa pagina e cade
 * insieme alla connessione del pannello, che lo dice da se'. */
export function verificaLaPresa() {
  const socket = lexicalGlobal("ws") ?? root.ws;
  if (!socket || typeof socket !== "object" || !connectionUp()) return false;
  if (socket.readyState !== socketConstant("OPEN", 1) || socket.__dmProva) return false;
  if (!socket.__dmRecoveryOwned || eIlPonteDelPannello(socket)) return false;
  try {
    socket.send(JSON.stringify({ id: 1_900_000_000 + (state.preseMute % 1000), type: "ping" }));
  } catch (_error) {
    return false;
  }
  socket.__dmProva = root.setTimeout?.(() => {
    socket.__dmProva = 0;
    if ((lexicalGlobal("ws") ?? root.ws) !== socket || socket.__dmSuperseded) return;
    state.preseMute += 1;
    /* Il pallino dice com'e', subito: la presa nuova lo riaccende col suo
     * `auth_ok`. */
    doc?.getElementById?.("live-dot")?.classList?.remove("connected");
    socket.__dmSuperseded = true;
    try {
      socket.close();
    } catch (_error) {}
    attemptReconnect({ force: true, eager: true });
    riparti(FIRST_DELAY);
  }, PROBE_TIMEOUT_MS);
  return true;
}

/* Il ponte del pannello (`legacy/bridge-socket.js`) si riconosce dal suo modo
 * di cadere: lui non va provato. */
function eIlPonteDelPannello(socket) {
  return typeof socket?._lineaCaduta === "function";
}

/* L'app dice che il suo filo con la casa c'e' (`schermate/plancia_vera.dart`):
 * dopo una sospensione, una caduta, un filo rifatto.
 *
 * Da collegati si prova che la presa sia viva; da scollegati ci si ricollega
 * adesso, senza aspettare il turno: una presa aperta e muta ha un attimo per
 * dire `auth_ok` — la cucitura lo manda appena trova il filo — e poi si
 * cambia. Il ricollegamento rifa' tutto quello che fa un avvio: `get_states`
 * e la sottoscrizione agli stati, che sono del runtime al suo `auth_ok`. */
export function filoTornato() {
  state.filoProntoIl = Date.now();
  if (connectionUp()) return verificaLaPresa();
  state.attempts = 0;
  const fatto = attemptReconnect({ eager: true });
  riparti(FILO_GRACE_MS);
  return fatto;
}

/* Un solo timer, e solo mentre serve. */
function watch(delay = FIRST_DELAY) {
  if (!doc || state.timer) return false;
  state.timer = root.setTimeout?.(() => {
    state.timer = 0;
    if (connectionUp()) {
      state.attempts = 0;
      return;
    }
    attemptReconnect();
    watch(Math.min(MAX_DELAY, Math.max(FIRST_DELAY, delay * 2)));
  }, Math.max(0, delay));
  return Boolean(state.timer);
}

/* Il rientro azzera l'attesa: chi ha appena riaperto l'app la sta guardando.
 * Da collegati si guarda che la presa sia viva davvero. */
function resume() {
  if (connectionUp()) {
    verificaLaPresa();
    return false;
  }
  state.attempts = 0;
  attemptReconnect({ eager: true });
  riparti(FIRST_DELAY);
  return true;
}

/* Nel browser l'app sta fuori dal riquadro, di un'altra origine: bussa con
 * un messaggio (`app/lib/schermate/riquadro/sul_web.dart`). */
function dalMessaggio(event) {
  if (event?.data?.gdahome === "filo") filoTornato();
}

export function installConnectionRecoverySection() {
  if (!doc) return false;
  installConnectOwner();
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener("visibilitychange", () => {
      if (doc.visibilityState === "visible") resume();
    });
    for (const event of ["pageshow", "focus", "online", "dashboardmodern:legacy-ready"]) {
      root.addEventListener?.(event, resume);
    }
    root.addEventListener?.(EVENTO_DEL_FILO, filoTornato);
    root.addEventListener?.("message", dalMessaggio);
    /* Il guscio dichiara le sue funzioni anche dopo di noi, nella plancia
     * ospitata: il padrone di connect() si prende appena c'e'. */
    root.addEventListener?.("dashboardmodern:legacy-ready", installConnectOwner);
  }
  watch(FIRST_DELAY);
  state.installed = true;
  return true;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installConnectionRecoverySection, { once: true });
} else if (doc) {
  senzaCadere(installConnectionRecoverySection);
}
