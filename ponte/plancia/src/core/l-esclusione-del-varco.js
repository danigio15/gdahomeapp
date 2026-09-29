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
 * scegliere. Qui l'interruttore lo vede chi configura, una casella per volta,
 * e se ne trovasse uno girato basta scriverci `-`. Una seconda casella
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

/* Le stesse, e qualcuna in piu', quando si cerca DENTRO un dispositivo.
 *
 * Li' la domanda e' un'altra: non «come si chiama l'interruttore di questo
 * contatto» ma «quale, fra gli interruttori che stanno sullo stesso
 * dispositivo del contatto, e' quello che esclude». La zona della centrale e'
 * gia' stata trovata dal registro, e basta riconoscere la parola: `bypass` di
 * Risco, Paradox, AlarmDecoder; `exclude` e `excluded` di chi traduce cosi';
 * `escludi`, `esclusione`, `esclusa` di chi l'ha chiamato all'italiana. La
 * parola deve stare intera — `bypass`, non `bypassaggio_caldaia` — e si guarda
 * sia l'identificativo sia il nome che si legge. */
const PAROLA_DEL_DISPOSITIVO =
  /(^|[^a-z0-9])(bypass|bypassed|exclude|excluded|esclusione|escludi|escluso|esclusa)($|[^a-z0-9])/i;

/**
 * L'interruttore d'esclusione che sta sullo STESSO dispositivo del contatto.
 *
 * E' la strada buona, e si prova per prima: Risco — e con lei le altre
 * centrali che Home Assistant conosce — mette ogni zona in un dispositivo suo,
 * col contatto e l'interruttore dell'esclusione dentro. Il registro lo dice
 * senza bisogno di indovinare niente dal nome, e regge anche chi i nomi li ha
 * cambiati tutti. `dispositivi` e' la mappa entita' → dispositivo che la
 * plancia si ricorda (`i-dispositivi-di-home-assistant.js`): qui non si chiede
 * niente a nessuno.
 *
 * Due interruttori con la parola giusta sullo stesso dispositivo non sono una
 * risposta: sono una domanda, e qui non si sceglie a caso quale zona lasciare
 * scoperta. Si torna vuoti, e decide il nome o chi configura.
 */
export function esclusioneDelDispositivo(entity, states = {}, dispositivi = null) {
  const id = pulito(entity);
  const suo = pulito(dispositivi?.[id]);
  if (!id || !suo) return "";
  const trovati = Object.keys(states || {}).filter((quale) => {
    if (quale === id || !puoEscludere(quale)) return false;
    if (pulito(dispositivi?.[quale]) !== suo) return false;
    const nome = pulito(states?.[quale]?.attributes?.friendly_name);
    return PAROLA_DEL_DISPOSITIVO.test(quale.split(".")[1]) || PAROLA_DEL_DISPOSITIVO.test(nome);
  });
  return trovati.length === 1 ? trovati[0] : "";
}

/**
 * L'interruttore che con ogni probabilita' esclude questo contatto.
 *
 * Prima il dispositivo, se il registro c'e' (vedi sopra); poi il nome.
 *
 * ── Perche' col nome cerca cosi' poco ────────────────────────────────────
 *
 * Si accettano due forme sole, e la parola d'esclusione deve essere una PAROLA
 * INTERA attaccata al nome del contatto: `porta_ingresso_bypass` o
 * `escludi_porta_ingresso`. La prima e' quella che pubblica Risco, la seconda
 * quella che scrive chi governa la centrale con le automazioni.
 *
 * La regola larga — «un interruttore che cominci come il contatto e abbia
 * `bypass` addosso» — sembrava piu' generosa e invece era pericolosa: per un
 * contatto che si chiama `binary_sensor.porta` avrebbe proposto
 * `switch.porta_cantina_bypass`, cioe' l'esclusione di un'ALTRA porta. Adesso
 * che quello che si trova si usa davvero (vedi `lInterruttoreDelVarco`) e' una
 * ragione in piu': una proposta sbagliata qui e' una finestra che resta
 * sorvegliata mentre chi ha premuto crede di averla esclusa, e un'altra esclusa
 * senza che nessuno l'abbia chiesto.
 */
export function esclusioneProposta(entity, states = {}, dispositivi = null) {
  const id = pulito(entity);
  const oggetto = id.split(".")[1] || "";
  if (!oggetto) return "";
  const dalDispositivo = esclusioneDelDispositivo(id, states, dispositivi);
  if (dalDispositivo) return dalDispositivo;
  const nomi = new Set();
  for (const dominio of DOMINI)
    for (const parola of PAROLE) {
      nomi.add(`${dominio}${oggetto}_${parola}`);
      nomi.add(`${dominio}${parola}_${oggetto}`);
    }
  return Object.keys(states || {}).find((quale) => nomi.has(quale) && puoEscludere(quale)) || "";
}

/* Quello che si scrive nella casella per dire «questo varco non ha
 * esclusione, non cercarla». Un trattino, come nelle caselle dei moduli di
 * carta: e' l'unico segno che non puo' essere un'entita'. */
export const NESSUNA_ESCLUSIONE = "-";

/**
 * L'interruttore che comanda davvero l'esclusione di questo varco.
 *
 * Fino alla prima versione (#136) valeva solo quello scritto a mano, e la
 * proposta restava in grigio nella casella. Ma chi l'ha chiesto l'ha detto
 * chiaro: «sono tutti binary sensor che gia' Home Assistant vede». Una centrale
 * Risco con trenta zone vuol dire trenta caselle da riempire con un nome che
 * Home Assistant sa gia', e una funzione che nessuno usa perche' costa mezz'ora
 * di configurazione.
 *
 * Quindi si usa quello che si trova, ma solo con le due prove forti: lo stesso
 * dispositivo nel registro, o il nome esatto che la centrale pubblica. La
 * casella resta, e vince sempre: ci si scrive un altro interruttore per
 * correggere, o `-` per dire che questo varco non si esclude da qui.
 *
 * `trovato` dice se l'interruttore l'ha trovato la plancia e non chi
 * configura: la scheda lo mostra, perche' una cosa che comanda un antifurto
 * deve potersi vedere prima di doverla scoprire.
 */
export function lInterruttoreDelVarco(entity, scritto, states = {}, dispositivi = null) {
  const mano = pulito(scritto);
  if (mano === NESSUNA_ESCLUSIONE) return { interruttore: "", trovato: false };
  if (mano) return { interruttore: mano, trovato: false };
  const trovato = esclusioneProposta(entity, states, dispositivi);
  return { interruttore: trovato, trovato: Boolean(trovato) };
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

/* Quanto restano sulla carta la domanda, l'annulla e il no della centrale.
 *
 * La domanda dura piu' di quella delle stanze (due secondi): li' si legge
 * «Spengo 3 luci?», qui si legge una parola sull'antifurto e si decide se
 * lasciare scoperta una finestra, e due secondi sono troppo pochi per farlo
 * senza fretta. L'annulla dura quanto quello delle stanze, cinque secondi. Il
 * no della centrale resta di piu', perche' va letto e capito. */
export const DURA_LA_DOMANDA_DELLO_SCUDO = 4000;
export const DURA_L_ANNULLA_DELLO_SCUDO = 5000;
export const DURA_L_ERRORE_DELLO_SCUDO = 9000;

/**
 * Cosa fa lo scudo premuto: chiede, manda, o niente.
 *
 * Le due direzioni non pesano uguale. Rimettere sotto sorveglianza una
 * finestra rende la casa piu' sicura, e si fa subito: una domanda li' sarebbe
 * un tocco in piu' a chi sta facendo la cosa giusta. Escluderla la rende meno
 * sicura, e allora il tocco chiede prima — sulla carta stessa, come «Spengo 3
 * luci?» nelle stanze — e dopo lascia un «Annulla» per qualche secondo.
 *
 * Il lucchetto vale anche qui, sui due lati: chi ha messo in sola lettura il
 * contatto, o l'interruttore della centrale, ha detto che da questa plancia
 * non si tocca. `siComanda` e' la stessa domanda che si fanno le luci.
 */
export function laMossaDelloScudo(riga, states = {}, siComanda = () => true) {
  const interruttore = pulito(riga?.esclusione);
  const comando = ilComandoDellEsclusione(interruttore, states);
  if (!comando) return { mossa: "niente", comando: null };
  if (!siComanda(interruttore) || !siComanda(pulito(riga?.entity)))
    return { mossa: "bloccato", comando: null };
  return { mossa: comando.service === "turn_on" ? "chiedi" : "manda", comando };
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
