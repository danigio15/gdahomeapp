/* Il campanello del pannello a muro, come un videocitofono vero.
 *
 * «Vorrei che col campanello Ring il tablet a muro facesse come un
 * videocitofono: si accende, suona, e mi fa vedere chi c'e' a tutto schermo
 * come una chiamata.» Il pannello il campanello lo sentiva gia': si svegliava
 * e apriva la finestra del citofono. Mancavano tre cose — il suono, lo schermo
 * acceso anche quando era spento, e la faccia di una chiamata in arrivo — e
 * dopo lo squillo, il ricordo di chi ha suonato.
 *
 * Qui ci sono le regole, senza DOM e senza orologio: chi chiama dice che ora
 * e'. Le parole le mette la sezione (`plancia-a-muro-section.js`), il suono lo
 * fa `sections/il-suono-del-campanello.js` con le note scritte qui.
 */

const pulito = (valore) => String(valore ?? "").trim();

/* ── le scelte di una pagina Ingresso ─────────────────────────────────────── */

/** I suoni che il tablet sa fare. «Nessuno» vuol dire solo lo schermo. */
export const SUONI_DEL_CAMPANELLO = Object.freeze(["dindon", "classico", "ding", "nessuno"]);
export const SUONO_DI_SERIE = "dindon";
export const VOLUME_DI_SERIE = 70;

/**
 * Le scelte del campanello di una pagina Ingresso, ripulite.
 *
 * Di serie lo schermo si accende quando suona e resta acceso (di notte al
 * minimo): e' quello che fa un videocitofono, e chi ha messo un campanello
 * su un tablet a muro lo vuole cosi'. «Parla» invece si accende a mano:
 * nessuno puo' sapere dallo stato di Home Assistant se quel campanello
 * l'audio nei due versi ce l'ha, e un tasto che non fa niente e' peggio di
 * nessun tasto.
 */
export function opzioniDelCampanello(ingresso = {}) {
  const dentro = ingresso && typeof ingresso === "object" ? ingresso : {};
  const suono = pulito(dentro.suono);
  const volume = Number(dentro.volume);
  const vero = (valore, ripiego) => (typeof valore === "boolean" ? valore : ripiego);
  return {
    suono: SUONI_DEL_CAMPANELLO.includes(suono) ? suono : SUONO_DI_SERIE,
    volume: Number.isFinite(volume)
      ? Math.min(100, Math.max(0, Math.round(volume)))
      : VOLUME_DI_SERIE,
    accendiSchermo: vero(dentro.accendiSchermo, true),
    tieniAcceso: vero(dentro.tieniAcceso, true),
    parla: vero(dentro.parla, false),
  };
}

/**
 * Se il tablet deve tenere lo schermo acceso.
 *
 * Basta una pagina Ingresso con un campanello e la scelta accesa: un
 * campanello che suona su uno schermo spento non lo vede nessuno. Senza
 * campanello il tablet fa come prima, e lo spegnimento resta del sistema.
 */
export function schermoSempreAcceso(muro) {
  return (Array.isArray(muro?.pagine) ? muro.pagine : []).some(
    (pagina) =>
      pagina?.modello === "ingresso" &&
      pulito(pagina.ingresso?.campanello) &&
      opzioniDelCampanello(pagina.ingresso).tieniAcceso,
  );
}

/* ── che cosa puo' fare da campanello ─────────────────────────────────────
 *
 * «Cosa si aspetta di entita'?» Due famiglie, perche' Home Assistant dice
 * uno squillo in due modi:
 *
 *  - «a ora»: un `event.*` (il citofono di molte marche), un `button.*` o un
 *    `input_button.*`. Lo stato e' l'ora dell'ultima pressione: ogni ora
 *    nuova e' uno squillo. «unknown» e «unavailable» non sono un'ora.
 *  - «acceso»: un `binary_sensor.*`, un `input_boolean.*` o uno `switch.*`
 *    che si accende quando suona. Suona il passaggio a «on».
 *
 * Il resto (un sensore qualunque, una luce) non e' un campanello: un sensore
 * che cambia valore ogni minuto aprirebbe il citofono ogni minuto. */
export const CAMPANELLI_A_ORA = Object.freeze(["event", "button", "input_button"]);
export const CAMPANELLI_ACCESI = Object.freeze(["binary_sensor", "input_boolean", "switch"]);
export const DOMINI_DEL_CAMPANELLO = Object.freeze([...CAMPANELLI_A_ORA, ...CAMPANELLI_ACCESI]);

const dominioDi = (id) => pulito(id).split(".")[0];
const senzaValore = (valore) => {
  const v = pulito(valore);
  return !v || v === "unknown" || v === "unavailable";
};

/** «ora», «acceso», o "" per un'entita' che non sa fare da campanello. */
export function tipoDelCampanello(id) {
  const dominio = dominioDi(id);
  if (CAMPANELLI_A_ORA.includes(dominio)) return "ora";
  if (CAMPANELLI_ACCESI.includes(dominio)) return "acceso";
  return "";
}

/**
 * Se il passaggio da `prima` a `ora` e' uno squillo.
 *
 * `prima` e' quello che il tablet si ricorda (`ricordoDelCampanello`):
 * `undefined` vuol dire «non l'ho mai visto», e il primo sguardo non suona —
 * o ogni riavvio del tablet aprirebbe il citofono. "" vuol dire «l'ho visto,
 * ma non aveva ancora un'ora»: un `event.*` appena creato e' «unknown», e la
 * sua prima pressione deve suonare.
 */
export function campanelloSuona(id, prima, ora) {
  if (prima === undefined || senzaValore(ora)) return false;
  const adesso = pulito(ora);
  if (adesso === pulito(prima)) return false;
  const tipo = tipoDelCampanello(id);
  if (tipo === "ora") return true;
  if (tipo === "acceso") return adesso === "on";
  return false;
}

/**
 * Quello da ricordare dopo aver visto `ora`.
 *
 * Un campanello che cade («unavailable») e torna con la stessa ora di prima
 * non ha suonato: il tablet tiene l'ultima ora vera e lascia passare il buco.
 * Visto per la prima volta senza valore, si ricorda "" (visto, niente ora).
 */
export function ricordoDelCampanello(prima, ora) {
  if (senzaValore(ora)) return prima === undefined ? "" : prima;
  return pulito(ora);
}

/* ── il suono ─────────────────────────────────────────────────────────────── */

/**
 * Le note di un giro di suono: frequenza in Hz, quando comincia e quanto dura,
 * in secondi dall'inizio del giro. `giro` e' ogni quanto il giro ricomincia.
 *
 * Sono campane, non bip: chi le suona aggiunge gli armonici e lascia morire la
 * nota piano, come un metallo colpito. Le frequenze sono quelle di un
 * campanello di casa — il «din don» e' una terza maggiore che scende, mi-do.
 */
export const NOTE_DEI_SUONI = Object.freeze({
  dindon: Object.freeze({
    giro: 3.2,
    note: Object.freeze([
      Object.freeze({ frequenza: 659.25, inizio: 0, durata: 1.3 }),
      Object.freeze({ frequenza: 523.25, inizio: 0.6, durata: 1.8 }),
    ]),
  }),
  /* Il campanello a martelletto: tanti colpi fitti sulla stessa campana. */
  classico: Object.freeze({
    giro: 2.6,
    note: Object.freeze(
      Array.from({ length: 10 }, (_, i) =>
        Object.freeze({ frequenza: 1318.5, inizio: i * 0.085, durata: 0.22 }),
      ),
    ),
  }),
  ding: Object.freeze({
    giro: 2.8,
    note: Object.freeze([Object.freeze({ frequenza: 1046.5, inizio: 0, durata: 1.6 })]),
  }),
  nessuno: Object.freeze({ giro: 0, note: Object.freeze([]) }),
});

/** Le note di quel suono; quelle di serie se il nome non si conosce. */
export function noteDelSuono(suono) {
  return NOTE_DEI_SUONI[pulito(suono)] || NOTE_DEI_SUONI[SUONO_DI_SERIE];
}

/* ── lo squillo ───────────────────────────────────────────────────────────── */

/* Quanto suona: trenta secondi, come una chiamata che nessuno prende. Dopo, la
 * finestra resta aperta e dice quando ha suonato. */
export const SQUILLO_MS = 30_000;

/**
 * In che fase e' lo squillo: `squilla` finche' non e' passato il tempo o
 * qualcuno ha toccato «Silenzia», poi `dopo`. Senza squillo, niente.
 */
export function faseDelloSquillo(squillo, adesso) {
  const quando = Number(squillo?.quando);
  if (!Number.isFinite(quando) || quando <= 0) return { fase: "", trascorsi: 0 };
  const trascorsi = Math.max(0, Number(adesso) - quando);
  const squilla = !squillo.silenziato && trascorsi < SQUILLO_MS;
  return { fase: squilla ? "squilla" : "dopo", trascorsi };
}

/* Quanto resta aperta da sola una finestra del pannello: cinque minuti.
 *
 * Dal campo: «metterci un timeout di tipo 5 minuti massimi, che la pagina
 * popup che si apre con il video e i pulsanti "parla", "cancellino" si
 * chiude da sola. Altrimenti se non la chiudi te rimane aperto quel popup e
 * non rispetta piu' lo screensaver impostato, e nemmeno il movimento di un
 * sensore che ritorna sulla home». Il riposo non arriva mai sopra una
 * finestra aperta — e' giusto, mentre qualcuno la usa — ma una finestra che
 * nessuno tocca da cinque minuti non la sta usando nessuno. */
export const FINESTRA_SOLA_MS = 5 * 60_000;

/**
 * Se la finestra aperta va chiusa: nessuno l'ha toccata da
 * [FINESTRA_SOLA_MS], contando dall'ultimo tocco vero e — per il citofono —
 * dallo squillo. Un sensore di presenza non conta: chi passa davanti al
 * tablet non sta guardando il citofono.
 */
export function finestraDaChiudere(finestra, ultimoTocco, adesso) {
  if (!finestra) return false;
  const dallo = Math.max(
    Number(ultimoTocco) || 0,
    Number(finestra.suonato) || 0,
    Number(finestra.aperta) || 0,
  );
  return Number(adesso) - dallo >= FINESTRA_SOLA_MS;
}

/** Quanto dura, come lo scrive un telefono in chiamata: «0:08», «1:24». */
export function durataScritta(ms) {
  const secondi = Math.max(0, Math.floor(Number(ms) / 1000) || 0);
  return `${Math.floor(secondi / 60)}:${String(secondi % 60).padStart(2, "0")}`;
}

/**
 * Quanto tempo fa, nella misura piu' grande che abbia senso: secondi sotto il
 * minuto, minuti sotto l'ora, ore sotto i due giorni, poi giorni. Il numero e
 * l'unita' restano separati: le parole le mette chi scrive.
 */
export function quantoFa(ms) {
  const secondi = Math.max(0, Math.floor(Number(ms) / 1000) || 0);
  if (secondi < 60) return { numero: secondi, unita: "s" };
  const minuti = Math.floor(secondi / 60);
  if (minuti < 60) return { numero: minuti, unita: "min" };
  const ore = Math.floor(minuti / 60);
  if (ore < 48) return { numero: ore, unita: "h" };
  return { numero: Math.floor(ore / 24), unita: "giorni" };
}

/* ── gli ultimi squilli ───────────────────────────────────────────────────── */

/* Quanti se ne ricordano: tre si vedono, due in piu' coprono quelli che
 * arrivano mentre la finestra e' gia' aperta. */
export const SQUILLI_RICORDATI = 5;

/* Due squilli dello stesso campanello cosi' vicini sono lo stesso dito che
 * insiste: un evento Ring ne manda anche due per pressione. */
const STESSO_SQUILLO_MS = 5_000;

/* Un'istantanea salvata e' un'immagine piccola: oltre, nella memoria del
 * tablet non ci sta e non serve. */
const FOTO_MASSIMA = 200_000;

/** Gli ultimi squilli ripuliti: il piu' recente in cima. */
export function storiaPulita(salvata, massimo = SQUILLI_RICORDATI) {
  const voci = Array.isArray(salvata) ? salvata : [];
  return voci
    .map((voce) => ({
      quando: Number(voce?.quando),
      entita: pulito(voce?.entita),
      pagina: Number.isInteger(voce?.pagina) ? voce.pagina : 0,
      immagine: pulito(voce?.immagine).length <= FOTO_MASSIMA ? pulito(voce?.immagine) : "",
    }))
    .filter((voce) => Number.isFinite(voce.quando) && voce.quando > 0)
    .sort((a, b) => b.quando - a.quando)
    .slice(0, massimo);
}

/**
 * Gli ultimi squilli con questo in cima.
 *
 * Lo stesso campanello che risuona dopo un attimo non fa una riga nuova: e'
 * lo stesso squillo, e la storia direbbe tre volte la stessa persona.
 */
export function conLoSquillo(storia, squillo, massimo = SQUILLI_RICORDATI) {
  const prima = storiaPulita(storia, massimo);
  const nuovo = storiaPulita([squillo], 1)[0];
  if (!nuovo) return prima;
  const ultimo = prima[0];
  if (
    ultimo &&
    ultimo.entita === nuovo.entita &&
    Math.abs(nuovo.quando - ultimo.quando) < STESSO_SQUILLO_MS
  )
    return prima;
  return storiaPulita([nuovo, ...prima], massimo);
}

/** La storia con l'istantanea di quello squillo, appena la si ha. */
export function conLaFoto(storia, quando, immagine) {
  return storiaPulita(storia).map((voce) =>
    voce.quando === Number(quando) ? { ...voce, immagine: pulito(immagine) } : voce,
  );
}
