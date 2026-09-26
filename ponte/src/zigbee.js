/* Un dispositivo Zigbee nuovo, dal telefono.
 *
 * «Vorrei poter abbinare un dispositivo zigbee direttamente dall'app, senza
 *  dover entrare in Home Assistant.»
 *
 * In Home Assistant una rete Zigbee la gestiscono due programmi diversi, e chi
 * ha una casa ne ha uno dei due: ZHA, che sta dentro Home Assistant, o
 * Zigbee2MQTT, che e' un add-on a parte e parla per posta. L'app non lo chiede
 * a nessuno: questo modulo guarda la casa e lo scopre, e la schermata cambia
 * da sola. La domanda «che rete hai» e' una domanda a cui la casa sa gia'
 * rispondere.
 *
 * ── Le tre cose che servono, e chi le sa fare ────────────────────────────
 *
 * APRIRE LA RETE. Una rete Zigbee non accetta ospiti a caso: si apre per
 * qualche minuto e poi si richiude da sola. Qui i due programmi non si
 * assomigliano per niente — ZHA ha un comando suo sul filo, Zigbee2MQTT vuole
 * un messaggio in una cassetta della posta — ed e' l'unica parte che cambia.
 *
 * SAPERE CHE E' ENTRATO QUALCUNO. Questa invece e' UNA SOLA, e vale per tutte
 * e quattro le reti: ZHA, Zigbee2MQTT, Matter e Thread. Un dispositivo che
 * entra in casa finisce nel registro dei dispositivi di Home Assistant, e il
 * registro annuncia chi arriva (`device_registry_updated`). Ascoltare quello
 * vuol dire non scrivere quattro ascoltatori che fanno la stessa cosa in
 * quattro modi — e vuol dire che una rete che oggi non c'e' funzionera' il
 * giorno che ci sara'.
 *
 * RICHIUDERE. Da sola dopo il tempo, o subito se chi guarda ha finito.
 *
 * ── Come si chiama la cassetta ───────────────────────────────────────────
 *
 * Zigbee2MQTT scrive e legge sotto un prefisso che si sceglie chi lo
 * installa. Di solito e' «zigbee2mqtt», ma non sempre — chi ha due antenne ne
 * ha due, e chi ha tradotto la sua configurazione l'ha chiamato altrimenti.
 * Darlo per scontato vuol dire un tasto che non fa niente in casa di qualcuno,
 * senza dire perche'.
 *
 * Allora non si da' per scontato: ci si mette in ascolto su `+/bridge/info` —
 * una sola domanda, con il carattere jolly — e si aspetta un attimo. Quel
 * messaggio Zigbee2MQTT lo lascia scritto nella cassetta (e' «retained»), per
 * cui chi si affaccia se lo trova gia' li'. Il prefisso e' la prima parola
 * dell'argomento da cui e' arrivato.
 *
 * Qui dentro la meta' che decide non tocca ne' la rete ne' l'orologio: entrano
 * le risposte di Home Assistant, escono i fatti. Il giro lo fa la classe in
 * fondo, come dappertutto nel ponte.
 */

/* Quali reti si sanno aprire. Il resto — Matter, Thread — entra in casa da
 * Home Assistant, e da qui si vede soltanto arrivare. */
export const NESSUNA = "";
export const ZHA = "zha";
export const Z2M = "zigbee2mqtt";

/* Per quanto si apre la rete. Quattro minuti sono il compromesso che usano
 * tutti: il tempo di scendere in garage a premere il tasto di una presa, e non
 * tanto da lasciare la porta aperta per una serata. */
export const QUANTO_RESTA_APERTA = 240;
export const AL_PIU_APERTA = 600;

/* Quanto si aspetta che la cassetta risponda. E' un messaggio gia' scritto che
 * arriva appena ci si affaccia: chi non risponde in due secondi non c'e'. */
export const ATTESA_DELLA_CASSETTA = 2000;

/* L'argomento con cui si chiede «chi c'e'»: il jolly prende qualunque
 * prefisso, e la risposta dice quale sia. */
export const DOVE_SI_CHIEDE = "+/bridge/info";

/* E lo stesso, un piano piu' sotto.
 *
 * In MQTT il `+` copre UN livello solo: `+/bridge/info` prende
 * «zigbee2mqtt/bridge/info» e non prendera' mai «casa/zigbee/bridge/info».
 * Che e' esattamente l'esempio scritto sopra `prefissoDellaCassetta`, la
 * funzione che legge il prefisso: lei un prefisso con le barre dentro lo sa
 * leggere benissimo, ma l'abbonamento non poteva fargliene arrivare uno.
 * Preparati per un caso che la domanda rendeva impossibile.
 *
 * Due domande e non `#`: `#` vorrebbe dire farsi mandare OGNI messaggio di
 * quella casa per due secondi — su un impianto vero sono migliaia, e per
 * leggerne uno. Due livelli coprono quello che si usa; chi annida il prefisso
 * piu' in fondo di cosi' non l'ha ancora fatto nessuno, e se succedera' si
 * aggiunge una riga a questo elenco. */
export const DOVE_SI_CHIEDE_ANCORA = "+/+/bridge/info";

/** Tutte le cassette a cui ci si affaccia, in un colpo solo. */
export const LE_CASSETTE = Object.freeze([DOVE_SI_CHIEDE, DOVE_SI_CHIEDE_ANCORA]);

const pulito = (valore) => String(valore ?? "").trim();

/**
 * Il prefisso di una cassetta, dall'argomento da cui e' arrivato un messaggio.
 *
 * «zigbee2mqtt/bridge/info» da' «zigbee2mqtt»; «casa/zigbee/bridge/info» da'
 * «casa/zigbee», perche' un prefisso puo' avere delle barre dentro e tagliare
 * alla prima vorrebbe dire scrivere nella cassetta sbagliata.
 */
export function prefissoDellaCassetta(argomento) {
  const testo = pulito(argomento);
  const coda = "/bridge/info";
  if (!testo.endsWith(coda)) return "";
  return testo.slice(0, -coda.length);
}

/**
 * Se fra le integrazioni di questa casa c'e' ZHA, e in che stato.
 *
 * Una voce caricata vuol dire che l'antenna c'e' e risponde. Una che c'e' ma
 * non e' caricata — l'antenna staccata, il programma in errore — non e' una
 * rete che si possa aprire: si risponde «non c'e'», perche' un tasto che non
 * fa niente e' peggio di un tasto che manca.
 */
export function ceZha(voci = []) {
  const sue = (Array.isArray(voci) ? voci : []).filter(
    (voce) => pulito(voce?.domain).toLowerCase() === ZHA,
  );
  if (!sue.length) return false;
  return sue.some((voce) => {
    const stato = pulito(voce?.state).toLowerCase();
    /* Le versioni piu' vecchie non dicono lo stato: chi non lo dice si
     * considera in piedi, che e' come si comportava prima. */
    return !stato || stato === "loaded";
  });
}

/**
 * Quale rete c'e' in questa casa.
 *
 * ZHA vince quando ci sono tutte e due, e non e' un capriccio: sta dentro Home
 * Assistant, quindi il comando arriva e la conferma torna dalla stessa porta,
 * mentre Zigbee2MQTT passa per la posta e ha un pezzo in piu' che puo'
 * mancare. In una casa con tutt'e due — rara, ma esiste — la strada piu' corta
 * e' quella giusta.
 */
export function laReteDiCasa({ zha = false, cassetta = "" } = {}) {
  if (zha) return { quale: ZHA, cassetta: "" };
  const prefisso = pulito(cassetta);
  if (prefisso) return { quale: Z2M, cassetta: prefisso };
  return { quale: NESSUNA, cassetta: "" };
}

/**
 * La riga che va nel registro dell'add-on, da quello che si e' visto.
 *
 * Sta qui, fuori dal giro, perche' e' la sola parte di questa storia che si
 * puo' provare senza una casa — ed e' la parte che conta: **una casa che ha
 * Zigbee e un ponte che non lo trova devono essere distinguibili da una casa
 * che Zigbee non ce l'ha**. Quando non si trova niente, la riga porta con se'
 * tutt'e due le ragioni — quella di ZHA e quella della posta — perche' chi
 * legge il registro non ha nessun altro posto dove andarle a prendere.
 */
export function comeSiDiceNelRegistro({ rete, verbale } = {}) {
  const quale = rete?.quale || NESSUNA;
  if (quale === ZHA) return { grave: false, riga: "la rete Zigbee di questa casa e' ZHA" };
  if (quale === Z2M) {
    return {
      grave: false,
      riga: `la rete Zigbee di questa casa e' Zigbee2MQTT, nella cassetta «${rete?.cassetta || ""}»`,
    };
  }
  const perche = [verbale?.zha, verbale?.posta].filter(Boolean).join("; ");
  return {
    grave: true,
    riga:
      "nessuna rete Zigbee: nell'app la voce «Zigbee» non comparira'" +
      (perche ? ` — ${perche}` : ""),
  };
}

/** Quanti secondi si tiene aperta: dentro i limiti, e mai a caso. */
export function perQuanto(secondi) {
  const quanti = Number(secondi);
  if (!Number.isFinite(quanti) || quanti <= 0) return QUANTO_RESTA_APERTA;
  return Math.min(AL_PIU_APERTA, Math.round(quanti));
}

/**
 * Il comando che apre la rete, per la rete che c'e'.
 *
 * E' l'unico punto in cui i due programmi non si assomigliano, ed e' scritto
 * qui — dove si puo' provare senza una casa — invece che dentro il giro.
 *
 * ZHA ha un comando suo sul filo. Zigbee2MQTT vuole un messaggio in una
 * cassetta, e glielo si imbuca col servizio `mqtt.publish` di Home Assistant:
 * il ponte non ha un cliente MQTT suo e non deve averlo — la casa ce l'ha
 * gia', ed e' configurato.
 */
export function comeSiApre({ quale, cassetta = "" }, secondi = QUANTO_RESTA_APERTA) {
  const quanto = perQuanto(secondi);
  if (quale === ZHA) return { type: "zha/permit", duration: quanto };
  if (quale === Z2M && cassetta)
    return {
      type: "call_service",
      domain: "mqtt",
      service: "publish",
      service_data: {
        topic: `${cassetta}/bridge/request/permit_join`,
        payload: JSON.stringify({ time: quanto }),
      },
    };
  return null;
}

/* Lo stesso ordine, ma per servizio.
 *
 * ZHA espone due strade per la stessa cosa, e sono due API diverse per
 * natura. `zha/permit` e' un comando sul filo: e' l'API INTERNA, quella che
 * usa il pannello di ZHA dentro Home Assistant, e cambia quando quel pannello
 * cambia. `zha.permit` e' un SERVIZIO: sta in Strumenti per sviluppatori →
 * Azioni, lo chiamano le automazioni di chiunque, ed e' la superficie
 * pubblica — quelle si rompono molto piu' di rado, perche' romperle
 * significa rompere le automazioni di tutti.
 *
 * Per questo il servizio si prova per PRIMO. Dal campo, su una casa
 * aggiornatissima: la scheda diceva «ZHA» — quindi ZHA c'era, e il ponte
 * l'aveva trovata — ma «Apri la rete» tornava indietro con `unknown_command`,
 * e la rete non si apriva. «Non mi fa aprire la rete.» Il comando sul filo
 * non c'era piu'.
 *
 * Quello sul filo resta come seconda strada, e non per scrupolo: su una casa
 * dove il servizio non c'e' — o dove chiamarlo non e' permesso — e' l'unica
 * che resta, ed e' quella con cui questa funzione ha funzionato finche' ha
 * funzionato.
 *
 * Il comando per posta di Zigbee2MQTT di strade ne ha una sola — passa gia'
 * per `mqtt.publish`, che e' un servizio — e qui torna `null`. */
export function comeSiApreColServizio({ quale }, secondi = QUANTO_RESTA_APERTA) {
  if (quale !== ZHA) return null;
  return {
    type: "call_service",
    domain: "zha",
    service: "permit",
    service_data: { duration: perQuanto(secondi) },
  };
}

/** E il ripiego per richiudere: lo stesso servizio, con zero. */
export function comeSiChiudeColServizio({ quale }) {
  if (quale !== ZHA) return null;
  return {
    type: "call_service",
    domain: "zha",
    service: "permit",
    service_data: { duration: 0 },
  };
}

/* Come si chiama una strada, quando la si deve nominare a qualcuno.
 *
 * Un servizio si chiama `dominio.servizio` — e' cosi' che lo si cerca in Home
 * Assistant — e un comando sul filo si chiama col suo tipo. Sta qui perche' lo
 * dicono in due: il registro dell'add-on e l'avviso sul telefono, e due modi
 * di chiamare la stessa cosa manderebbero a cercare due cose diverse. */
export const comeSiChiama = (comando) =>
  comando?.type === "call_service" ? `${comando.domain}.${comando.service}` : comando?.type || "";

/** Le strade per aprire, nell'ordine in cui si provano. */
export function leStradePerAprire(rete, secondi = QUANTO_RESTA_APERTA) {
  return [comeSiApreColServizio(rete, secondi), comeSiApre(rete, secondi)].filter(Boolean);
}

/** E quelle per richiudere, nello stesso ordine. */
export function leStradePerChiudere(rete) {
  return [comeSiChiudeColServizio(rete), comeSiChiude(rete)].filter(Boolean);
}

/* L'errore di quando Home Assistant non accetta il comando della rete.
 *
 * Ha un codice suo, e serve: l'app mostra un avviso diverso per ogni codice, e
 * finche' da qui usciva il `unknown_command` di Home Assistant l'app leggeva
 * «il ponte non sa fare questa cosa» e mandava ad aggiornare l'add-on. Dal
 * campo, con l'add-on aggiornato e la scheda ZHA piena in cima alla stessa
 * schermata: «da un messaggio di aggiornare ma in realta' e' tutto
 * aggiornato». Aveva ragione, e a sbagliare era il codice.
 *
 * `unknown_command` vuol dire «chi ha ricevuto questa domanda non la
 * conosce». Rilanciandolo al telefono si cambiava chi ha ricevuto la domanda:
 * quello era Home Assistant, non il ponte. */
export class ZigbeeNonAccettato extends Error {
  constructor(strade = [], detto = "") {
    const nomi = strade.map(comeSiChiama).filter(Boolean).join(" ne' ");
    /* Le parole di Home Assistant si portano dietro.
     *
     * Chi legge l'avviso sul telefono e' la stessa persona che deve capire
     * perche' la rete non si apre, e «non accetta» da solo non basta:
     * «unauthorized» e «unknown command» mandano a guardare due cose diverse.
     * Senza, l'unico posto dove leggerlo sarebbe il registro dell'add-on, che
     * chi ha il problema quasi mai va ad aprire. */
    super(
      `Home Assistant non accetta ${nomi || "il comando della rete Zigbee"}` +
        (detto ? ` (${detto})` : ""),
    );
    this.code = "zigbee_non_accettato";
  }
}

/* Quando un rifiuto vuol dire «questo comando qui non c'e'».
 *
 * Home Assistant risponde `unknown_command` per un comando sul filo che non
 * conosce, e `not_found` / `service_not_found` per un servizio che non ha.
 * Sono le tre facce della stessa cosa, e sono l'unica ragione per cui vale la
 * pena riprovare per un'altra strada: un rifiuto qualunque — la rete che non
 * si apre, il coordinatore staccato — riprovandolo darebbe solo lo stesso
 * rifiuto due volte e il doppio dell'attesa. */
const NON_CE_QUEL_COMANDO = new Set(["unknown_command", "not_found", "service_not_found"]);

export const eUnComandoCheNonCe = (errore) =>
  NON_CE_QUEL_COMANDO.has(String(errore?.code || "").trim());

/** E quello che la richiude subito: la stessa strada, con zero al posto del tempo. */
export function comeSiChiude({ quale, cassetta = "" }) {
  if (quale === ZHA) return { type: "zha/permit", duration: 0 };
  if (quale === Z2M && cassetta)
    return {
      type: "call_service",
      domain: "mqtt",
      service: "publish",
      service_data: {
        topic: `${cassetta}/bridge/request/permit_join`,
        payload: JSON.stringify({ time: 0 }),
      },
    };
  return null;
}

/**
 * Se questo annuncio del registro e' un dispositivo appena entrato.
 *
 * Il registro annuncia anche le modifiche e le cancellazioni, e un dispositivo
 * rinominato non e' un dispositivo nuovo: chi guarda la schermata dell'attesa
 * vedrebbe entrare qualcosa che era gia' in casa.
 *
 * ── La busta ───────────────────────────────────────────────────────────────
 *
 * Quello che arriva e' l'evento **come lo manda Home Assistant**, che i suoi
 * dati se li tiene in una busta:
 *
 *     { event_type: "device_registry_updated",
 *       data: { action: "create", device_id: "..." },
 *       origin, time_fired, context }
 *
 * Qui si leggeva `evento.action` e `evento.device_id`, cioe' fuori dalla
 * busta: sempre `undefined`, sempre «no», e **nessun dispositivo e' mai stato
 * annunciato** — ne' con Zigbee2MQTT ne' con ZHA. Dal campo: «il pairing lo fa
 * partire l'app, ma poi non vede che lo ha trovato».
 *
 * Lo stesso abbonamento, in `spegnimento.js`, la busta la apre
 * (`const dati = evento?.data`). Erano due letture della stessa cosa, e una
 * sola era giusta.
 */
/* ── Chi c'e' nella rete ───────────────────────────────────────────────────
 *
 * «Voglio vedere elenco completo dei dispositivi e poterli eliminare.»
 *
 * Le due reti l'elenco lo danno in due modi diversi, e non e' un dettaglio da
 * nascondere sotto al tappeto: ZHA risponde a una domanda sul filo, come fa
 * per tutto; Zigbee2MQTT invece lo tiene **scritto in una cassetta** —
 * `<prefisso>/bridge/devices`, un messaggio ritenuto, cioe' uno che il broker
 * consegna appena ti affacci, senza doverlo chiedere a nessuno. E' la stessa
 * cassetta da cui il ponte ha gia' imparato come si chiama la rete.
 *
 * Quello che esce di qui pero' e' una forma sola, perche' chi disegna non deve
 * sapere quale delle due reti ha in casa. Se lo sapesse, ogni schermata
 * andrebbe scritta due volte, e il giorno che una delle due cambia le due
 * schermate direbbero cose diverse.
 *
 * ── Cosa esce, e cosa no ─────────────────────────────────────────────────
 *
 * Esce l'anagrafe di un apparecchio: la sua targa, come si chiama, di che
 * marca e modello e', se fa da ponte per gli altri o sta in fondo a un ramo,
 * se va a corrente o a batteria, e quanto e' buono il collegamento. **Non
 * esce nessuno stato**: che cosa sta facendo adesso quella presa non e' roba
 * di questa porta.
 */

/* Perche' non e' andata, in una riga, per chi guarda una schermata.
 *
 * Il messaggio di `ZigbeeNonAccettato` dice gia' quali strade si sono provate
 * e cosa ha risposto l'ultima: e' quello che serve a capire. Per tutto il
 * resto vale il messaggio dell'errore, e per gli errori muti una frase che
 * almeno non e' vuota. */
const ilPerche = (errore) =>
  String(errore?.message || errore?.code || "").trim() || "non ha funzionato";

/** La targa di un apparecchio Zigbee, come la scrivono tutti e due: l'IEEE. */
const targa = (valore) =>
  String(valore ?? "")
    .trim()
    .toLowerCase();

/* Il tipo, in parole nostre. Sono tre e sono sempre quelli, in tutt'e due le
 * reti: chi tiene la rete, chi la ripete, e chi sta in fondo a un ramo. */
export const COORDINATORE = "coordinatore";
export const ROUTER = "router";
export const TERMINALE = "terminale";

function ilTipo(detto) {
  const scritto = String(detto ?? "")
    .trim()
    .toLowerCase();
  if (scritto.includes("coordinator")) return COORDINATORE;
  if (scritto.includes("router")) return ROUTER;
  return TERMINALE;
}

/* A corrente o a batteria.
 *
 * Non si indovina dal tipo: un router va sempre a corrente — e' il motivo per
 * cui puo' fare da ponte — ma un terminale puo' essere tutti e due, e sapere
 * quali vanno a batteria e' la meta' del mestiere quando una rete fa i
 * capricci. ZHA lo dice con `power_source`, Zigbee2MQTT con
 * `power_source` dentro la definizione. Chi non lo dice resta «non si sa», che
 * e' diverso da «a corrente». */
export function laPotenza(detto) {
  const scritto = String(detto ?? "")
    .trim()
    .toLowerCase();
  if (!scritto) return "";
  if (scritto.includes("battery")) return "batteria";
  if (scritto.includes("mains") || scritto.includes("dc source")) return "rete";
  return "";
}

/** Una riga dell'elenco di ZHA, nella forma di casa. */
export function laRigaDiZha(riga = {}) {
  const id = targa(riga?.ieee);
  if (!id) return null;
  return {
    id,
    nome: String(riga?.user_given_name || riga?.name || "").trim() || id,
    marca: String(riga?.manufacturer || "").trim(),
    modello: String(riga?.model || "").trim(),
    tipo: ilTipo(riga?.device_type),
    potenza: laPotenza(riga?.power_source),
    /* Da quando non si fa sentire, in millisecondi. ZHA scrive l'ultima volta
     * che l'ha sentito; chi non l'ha mai sentito resta «non si sa». */
    tace: null,
    quando: String(riga?.last_seen || "").trim(),
    /* Il dispositivo di Home Assistant, quando ZHA lo dice: e' il filo che
     * lega questa riga a quello che la plancia gia' conosce. */
    dispositivo: String(riga?.device_reg_id || "").trim(),
    /* Con chi parla. ZHA lo scrive quando la topologia e' stata guardata; se
     * non c'e', l'elenco vale lo stesso e la mappa non si disegna. */
    vicini: iVicini(riga?.neighbors),
  };
}

/** E una riga di Zigbee2MQTT, che di quelle cose ne sa qualcuna in piu'. */
export function laRigaDiZ2M(riga = {}) {
  const id = targa(riga?.ieee_address);
  if (!id) return null;
  const definizione = riga?.definition || {};
  return {
    id,
    nome: String(riga?.friendly_name || "").trim() || id,
    marca: String(definizione?.vendor || riga?.manufacturer || "").trim(),
    modello: String(definizione?.model || riga?.model_id || "").trim(),
    tipo: ilTipo(riga?.type),
    potenza: laPotenza(riga?.power_source),
    tace: null,
    quando: "",
    dispositivo: "",
    vicini: [],
  };
}

/* I vicini, come li scrive ZHA: chi e' e quanto si sentono. Quello che serve
 * a disegnare una mappa e nient'altro. */
function iVicini(detti) {
  if (!Array.isArray(detti)) return [];
  const fuori = [];
  for (const uno of detti) {
    const id = targa(uno?.ieee);
    if (!id) continue;
    const quanto = Number(uno?.lqi);
    fuori.push({ id, qualita: Number.isFinite(quanto) ? quanto : null });
  }
  return fuori;
}

/**
 * L'elenco intero, da come lo scrive la rete che c'e'.
 *
 * Ordinato per nome e non per targa: una targa non la riconosce nessuno, e
 * chi apre quella schermata cerca «la presa del garage».
 */
export function lElencoDellaRete(quale, detto) {
  const righe = Array.isArray(detto) ? detto : [];
  const come = quale === ZHA ? laRigaDiZha : laRigaDiZ2M;
  return righe
    .map((riga) => come(riga))
    .filter(Boolean)
    .sort((una, altra) => una.nome.localeCompare(altra.nome));
}

/** Come si chiede l'elenco a ZHA: una domanda sul filo, come le altre. */
export function comeSiChiedeLElenco({ quale } = {}) {
  return quale === ZHA ? { type: "zha/devices" } : null;
}

/** E la cassetta dove Zigbee2MQTT lo tiene gia' scritto. */
export function laCassettaDellElenco(cassetta) {
  const prefisso = String(cassetta ?? "").trim();
  return prefisso ? `${prefisso}/bridge/devices` : "";
}

/**
 * Come si toglie un apparecchio dalla rete.
 *
 * Non si «cancella»: si dice alla rete di lasciarlo andare. Quello che
 * succede dopo e' che Home Assistant se ne accorge e toglie anche le sue
 * entita' — e infatti la conferma non si legge da questa risposta, ma
 * dall'elenco riguardato dopo. La rinomina ha gia' insegnato cosa vale un
 * «si'» che nessuno ha controllato.
 */
export function comeSiElimina({ quale, cassetta = "" }, chi) {
  const id = targa(chi);
  if (!id) return null;
  if (quale === ZHA) return { type: "zha/remove", ieee: id };
  if (quale === Z2M && cassetta)
    return {
      type: "call_service",
      domain: "mqtt",
      service: "publish",
      service_data: {
        topic: `${cassetta}/bridge/request/device/remove`,
        /* `force` no, e non e' prudenza eccessiva: forzare toglie la riga
         * dalla cassetta senza che l'apparecchio lo sappia, e quello resta
         * appeso alla rete a cercare un coordinatore che non gli risponde
         * piu'. Si forza quando il garbato ha gia' fallito, e allora lo si
         * chiede per iscritto — non di nascosto, al primo tocco. */
        payload: JSON.stringify({ id, force: false }),
      },
    };
  return null;
}

/**
 * Come si dice a Zigbee2MQTT che quello adesso si chiama cosi'.
 *
 * ─── Perche' non basta rinominarlo in Home Assistant ─────────────────────
 *
 * Perche' sono due nomi, e chi guarda ne vede due. Il nome di Home Assistant
 * (`name_by_user`) e' un'etichetta che sta nel registro dei dispositivi; il
 * nome della rete (`friendly_name`) e' quello con cui Zigbee2MQTT lo chiama
 * nella sua cassetta, nella sua pagina e in ogni messaggio che manda. Finche'
 * si scriveva solo il primo, dal campo si vedeva questo: in Presenza «Presenza
 * salone», nell'elenco Zigbee e dentro Zigbee2MQTT `0x0cae5ffffec141a9`.
 * «Il nome del dispositivo non risulta modificato.» Giusto: non lo era.
 *
 * ─── Quello che costa ────────────────────────────────────────────────────
 *
 * Il nome della rete non e' un'etichetta: e' l'indirizzo della cassetta.
 * Cambiandolo, Zigbee2MQTT scrive su un'altra cassetta e Home Assistant rifa'
 * le entita' con identificativi nuovi — quelle di prima restano li' orfane, e
 * quello che le usava nella plancia va rimesso a posto.
 *
 * Non si nasconde e non si decide al posto di chi guarda: lo dice la schermata
 * prima di farlo, e chi preme sa cosa succede. Appena entrato non costa niente
 * — nessuno lo usa ancora — ed e' il momento in cui si rinomina quasi sempre.
 */
export function comeSiRinomina({ quale, cassetta = "" } = {}, chi, come) {
  const id = targa(chi);
  const nome = String(come ?? "").trim();
  if (quale !== Z2M || !cassetta || !id || !nome) return null;
  return {
    type: "call_service",
    domain: "mqtt",
    service: "publish",
    service_data: {
      topic: `${cassetta}/bridge/request/device/rename`,
      /* `from` con l'indirizzo e non col nome di adesso: l'indirizzo non
       * cambia mai, il nome e' proprio la cosa che si sta cambiando — e se
       * quello che abbiamo in mano fosse vecchio di un minuto, il rinomina
       * andrebbe a vuoto senza dirlo. */
      payload: JSON.stringify({ from: id, to: nome }),
    },
  };
}

/* Le cifre di un indirizzo IEEE, da qualunque forma arrivi.
 *
 * Le due reti lo scrivono in due modi — `0x0cae5ffffec141a9` per Zigbee2MQTT,
 * `0c:ae:5f:ff:fe:c1:41:a9` per il registro di Home Assistant — e sono lo
 * stesso indirizzo. Sedici cifre esadecimali: quelle si confrontano. */
export function leCifreDellaTarga(valore) {
  const pulite = String(valore ?? "")
    .toLowerCase()
    .replace(/0x/g, "")
    .replace(/[^0-9a-f]/g, "");
  return pulite.length >= 16 ? pulite.slice(-16) : "";
}

/**
 * Il dispositivo di Home Assistant che porta questo indirizzo.
 *
 * Zigbee2MQTT, al contrario di ZHA, nella sua cassetta il dispositivo di Home
 * Assistant non lo scrive: la riga esce con `dispositivo` vuoto, e senza quello
 * la scheda dell'elenco non puo' ne' rinominare ne' consegnare alla plancia —
 * su una casa Zigbee2MQTT quei due tasti non hanno mai funzionato.
 *
 * Il filo che lega le due cose c'e' gia', ed e' l'indirizzo: Home Assistant lo
 * scrive negli `identifiers` (`zigbee2mqtt_0x…`) o nelle `connections` (il
 * `mac`, coi due punti). Si guarda li'.
 */
export function ilDispositivoDellaTarga(dispositivi, chi) {
  const cerco = leCifreDellaTarga(chi);
  if (!cerco) return "";
  for (const uno of Array.isArray(dispositivi) ? dispositivi : []) {
    const pezzi = [...(uno?.identifiers ?? []), ...(uno?.connections ?? [])].flat();
    if (pezzi.some((pezzo) => leCifreDellaTarga(pezzo) === cerco)) return pulito(uno?.id);
  }
  return "";
}

/* E per servizio, dove il servizio c'e'. Stessa ragione di `comeSiApre`: il
 * servizio e' la superficie pubblica e si rompe molto piu' di rado del comando
 * interno, quindi si prova per primo. */
export function comeSiEliminaColServizio({ quale }, chi) {
  const id = targa(chi);
  if (quale !== ZHA || !id) return null;
  return { type: "call_service", domain: "zha", service: "remove", service_data: { ieee: id } };
}

/** Le strade per togliere uno, nell'ordine in cui si provano. */
export function leStradePerEliminare(rete, chi) {
  return [comeSiEliminaColServizio(rete, chi), comeSiElimina(rete, chi)].filter(Boolean);
}

/* ── La mappa ──────────────────────────────────────────────────────────────
 *
 * «Crea inoltre la possibilita' di mostrare la mappa di collegamento dei
 * dispositivi.»
 *
 * Chiedere a una rete Zigbee con chi parla ognuno **non e' una lettura**: e'
 * un giro di domande che il coordinatore fa a ogni ripetitore, uno alla volta,
 * e su una rete di venti cose ci mette da mezzo minuto a un minuto. Mentre lo
 * fa la rete e' occupata, e i comandi passano piu' lenti.
 *
 * Per questo la mappa non si disegna da sola quando si apre la schermata: la
 * si chiede, e chi la chiede lo sa. Aprire la sezione Zigbee non deve
 * rallentare le luci di casa.
 *
 * E per questo, quando si puo', si guarda quello che si sa gia': ZHA i vicini
 * se li tiene scritti dall'ultima volta che ha guardato, e vale la pena
 * mostrarli — con l'ora in cui sono stati visti — invece di far aspettare un
 * minuto chi voleva solo dare un'occhiata.
 *
 * Zigbee2MQTT no: nella cassetta dei dispositivi i vicini non ci sono affatto,
 * quindi li' una mappa senza chiedere non esiste, e si dice invece di
 * disegnarne una vuota.
 */

/* Quanto si aspetta la mappa. Un minuto e mezzo: su una rete grossa il giro
 * dei vicini ci mette un minuto buono, e scadere prima vorrebbe dire far
 * aspettare la gente per niente e poi dirle che non e' arrivata. */
export const ATTESA_DELLA_MAPPA = 90_000;

/** Le due cassette della mappa: dove si chiede, e dove risponde. */
export function leCassetteDellaMappa(cassetta) {
  const prefisso = pulito(cassetta);
  if (!prefisso) return null;
  return {
    chiedi: `${prefisso}/bridge/request/networkmap`,
    risponde: `${prefisso}/bridge/response/networkmap`,
  };
}

/**
 * Come si chiede alla rete di guardarsi.
 *
 * Su ZHA e' un comando che fa partire il giro; i vicini poi si leggono
 * dall'elenco, come sempre. Su Zigbee2MQTT e' un messaggio imbucato, e la
 * risposta torna in un'altra cassetta.
 *
 * `routes: false` e non true: i percorsi sono un'altra cosa — chi passa per
 * dove — e costano un secondo giro di domande. Qui serve chi vede chi.
 */
export function comeSiChiedeLaMappa({ quale, cassetta = "" } = {}) {
  if (quale === ZHA) return { type: "zha/topology/update" };
  const cassette = leCassetteDellaMappa(cassetta);
  if (quale === Z2M && cassette)
    return {
      type: "call_service",
      domain: "mqtt",
      service: "publish",
      service_data: {
        topic: cassette.chiedi,
        payload: JSON.stringify({ type: "raw", routes: false }),
      },
    };
  return null;
}

/**
 * Le righe, da come Zigbee2MQTT scrive la mappa.
 *
 * Lui la da' in due pezzi — i nodi da una parte, i collegamenti dall'altra —
 * e qui tornano insieme, perche' il resto di questo file ragiona per righe che
 * si portano dietro i propri vicini.
 */
export function leRigheDallaMappaDiZ2M(detto) {
  const dentro = detto?.data?.value || detto?.value || detto || {};
  const nodi = Array.isArray(dentro?.nodes) ? dentro.nodes : [];
  const fili = Array.isArray(dentro?.links) ? dentro.links : [];
  const righe = new Map();
  for (const nodo of nodi) {
    const id = pulito(nodo?.ieeeAddr).toLowerCase();
    if (!id) continue;
    righe.set(id, {
      id,
      nome: pulito(nodo?.friendlyName) || id,
      marca: "",
      modello: "",
      tipo: ilTipo(nodo?.type),
      potenza: "",
      tace: null,
      quando: "",
      dispositivo: "",
      vicini: [],
    });
  }
  for (const filo of fili) {
    const da = pulito(filo?.source?.ieeeAddr).toLowerCase();
    const a = pulito(filo?.target?.ieeeAddr).toLowerCase();
    if (!da || !a) continue;
    const quanto = Number(filo?.linkquality ?? filo?.lqi);
    const qualita = Number.isFinite(quanto) ? quanto : null;
    righe.get(da)?.vicini.push({ id: a, qualita });
  }
  return [...righe.values()].sort((una, altra) => una.nome.localeCompare(altra.nome));
}

export function eUnoNuovo(evento) {
  const dati = evento?.data;
  return pulito(dati?.action).toLowerCase() === "create" && Boolean(pulito(dati?.device_id));
}

/**
 * Come si chiama un dispositivo appena entrato, e da dove viene.
 *
 * Il nome che conta e' quello che gli ha dato chi lo guarda (`name_by_user`);
 * senza, quello che si e' presentato lui. Un dispositivo Zigbee appena entrato
 * di solito si chiama col suo modello — «TS0121» — ed e' proprio per questo che
 * il passo dopo chiede un nome.
 */
export function comeSiPresenta(dispositivo = {}, entita = []) {
  const nome = pulito(dispositivo.name_by_user) || pulito(dispositivo.name);
  return {
    id: pulito(dispositivo.id),
    nome,
    /* Marca e modello: sulla schermata del nome servono a far dire «ah, e'
     * quello» a chi ha appena premuto un tasto su una presa. */
    marca: pulito(dispositivo.manufacturer),
    modello: pulito(dispositivo.model),
    /* Da quale rete e' arrivato, quando si sa: un dispositivo entrato mentre
     * la rete Zigbee era aperta puo' comunque essere un Matter, e dirlo e'
     * meglio che lasciarlo credere. */
    tramite: pulito(dispositivo.primary_config_entry_domain),
    /* E cosa ha portato dentro.
     *
     * Senza questa riga il passo dopo non si puo' fare: il foglietto «Dove lo
     * metto?» della plancia decide la sezione dall'ENTITA' — una lampadina va
     * nelle Luci, un `binary_sensor` di porta nei Varchi — e di un dispositivo
     * senza entita' non sa dire niente. Qui invece arrivano tutte, e quale
     * delle sei decide lo sa la plancia, che le sue sezioni le conosce. */
    entita: (Array.isArray(entita) ? entita : [])
      .map(comeSiPresentaUnEntita)
      .filter((una) => una.entity),
  };
}

/**
 * Un'entita' del dispositivo, ridotta a quello che serve a decidere.
 *
 * Tre campi e non la riga intera del registro: quello che viaggia lo legge la
 * plancia per scegliere una sezione, e il resto — l'area, le opzioni, le
 * capacita' — non c'entra e non deve uscire di casa.
 *
 * La classe puo' essere stata cambiata a mano da chi ha la casa
 * (`device_class`) o essere quella con cui l'integrazione l'ha creata
 * (`original_device_class`). Si guardano tutte e due, in quest'ordine:
 * chi l'ha corretta a mano l'ha corretta per un motivo.
 */
export function comeSiPresentaUnEntita(voce) {
  /* Col punto interrogativo e non con un `= {}`: quel ripiego vale per
   * l'argomento che manca, non per uno che c'e' e vale `null`. Una riga nulla
   * nel registro — e da un elenco che arriva dalla rete ne puo' arrivare una —
   * faceva saltare l'intero elenco di chi e' entrato, cioe' proprio la cosa
   * che la schermata sta aspettando. */
  return {
    entity: pulito(voce?.entity_id),
    classe: pulito(voce?.device_class) || pulito(voce?.original_device_class),
    /* Diagnostica o configurazione: la plancia le salta, e sono quelle che su
     * una presa smart sono cinque su sei. */
    categoria: pulito(voce?.entity_category),
  };
}

/* ── il giro alla casa ───────────────────────────────────────────────────── */

/**
 * La rete Zigbee di questa casa, vista dal ponte.
 *
 * Tiene la risposta per un po': l'app la chiede ogni volta che apre la
 * schermata, e «che rete hai» non cambia mentre uno guarda. Cambia quando si
 * installa qualcosa, e allora basta riaprire l'app.
 */
export const QUANTO_SI_RICORDA = 60_000;

/* E quanto si ricorda il registro dei dispositivi di Home Assistant. Meno:
 * quello cambia quando ne entra o ne esce uno, ed e' proprio mentre si sta
 * guardando questa schermata che succede. */
export const QUANTO_SI_RICORDANO_I_DISPOSITIVI = 30_000;

/* Quanto si aspetta prima di riguardare, quando all'accensione non si trova
 * niente.
 *
 * All'accensione dell'add-on Home Assistant sta spesso ancora partendo, e
 * l'add-on di Zigbee2MQTT parte per conto suo — a volte dopo di noi. Una casa
 * che al primo colpo dice «nessuna» non e' una casa senza Zigbee: e' una casa
 * che non ha ancora finito di accendersi, e scriverlo nel registro una volta
 * sola vorrebbe dire dire una cosa falsa e non correggerla piu'. */
export const ATTESE = Object.freeze([30_000, 120_000]);

/* Quante volte si riguarda se il nome nuovo e' arrivato, e ogni quanto.
 *
 * Meno del togliere, e per una ragione: togliere e' un ordine che viaggia via
 * radio e aspetta che un apparecchio si svegli, rinominare e' una scrittura
 * che Zigbee2MQTT fa in casa sua. Quattro sguardi a un secondo bastano; di
 * piu' vorrebbe dire una rotellina che gira per niente. */
export const QUANTE_VOLTE_SI_GUARDA_IL_NOME = 4;
export const OGNI_QUANTO_SI_GUARDA_IL_NOME = 1000;

/* Quante volte si riguarda se e' uscito davvero, e ogni quanto.
 *
 * Togliere da una rete Zigbee non e' cancellare una riga da un elenco: e' un
 * ordine che viaggia via radio. Il coordinatore lo manda, l'apparecchio se ne
 * va, e l'elenco si riscrive DOPO — un secondo o due se e' a corrente e
 * sveglio, di piu' se dorme.
 *
 * Guardare subito vuol dire quasi sempre trovarcelo ancora, e annunciare «non
 * e' andata» di una cosa che stava andando benissimo. E' successo dal campo,
 * con un sensore SONOFF: «la rete ha accettato l'ordine ma quel dispositivo e'
 * ancora li'» — e un minuto dopo non c'era piu'.
 *
 * Otto sguardi a un secondo e mezzo fanno dodici secondi: abbastanza perche'
 * un apparecchio sveglio esca, poco abbastanza da non lasciare qualcuno con
 * una rotellina che gira senza fine. Chi dorme ci mette di piu' di cosi', e
 * per quello c'e' la frase. */
export const QUANTE_VOLTE_SI_RIGUARDA = 8;
export const OGNI_QUANTO_SI_RIGUARDA = 1500;

/* L'attesa fra un tentativo e l'altro.
 *
 * `unref` e' voluto: un ritentativo in coda non deve tenere sveglio un add-on
 * che si sta spegnendo. Sotto le prove costa che il giro finisca prima della
 * promessa, e per questo si sostituisce dal di fuori invece di togliere dal
 * codice vero una cosa che al codice vero serve. */
const ASPETTA = (quanto) =>
  new Promise((ok) => {
    const giro = setTimeout(ok, quanto);
    giro.unref?.();
  });

/* Quando dopo l'attesa e' ancora li'.
 *
 * Dire «non e' andata» e basta lascia chi legge davanti a un muro: ha premuto
 * «Toglilo», ha aspettato, e non sa se ha sbagliato lui, se e' rotto, o se
 * deve solo riprovare. Quasi sempre e' la terza — l'apparecchio dorme, e un
 * apparecchio che dorme l'ordine di uscire non lo sente finche' non si sveglia
 * — e allora si dice quella, e si dice come si sveglia. */
export function perCheNonEUscito() {
  const secondi = Math.round((QUANTE_VOLTE_SI_RIGUARDA * OGNI_QUANTO_SI_RIGUARDA) / 1000);
  return (
    `l'ordine e' partito, ma dopo ${secondi} secondi quel dispositivo e' ancora nell'elenco. ` +
    "Di solito vuol dire che dorme: se va a batteria, sveglialo — premi un tasto, apri e chiudi " +
    "il contatto — e riprova; se va a corrente, stacca e riattacca. Se esce da solo piu' tardi, " +
    "dall'elenco sparisce senza fare altro"
  );
}

export class Zigbee {
  constructor({ casa, registro = null, adesso = () => Date.now(), aspetta = ASPETTA } = {}) {
    this.casa = casa;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this.aspetta = aspetta;
    this._fermo = false;
    this._rete = null;
    this._reteChiestaIl = 0;
    /* I dispositivi entrati da quando si sta guardando. L'elenco e' di chi
     * guarda: si svuota quando si riapre la rete, perche' quello che e'
     * entrato ieri non e' quello che sta entrando adesso. */
    this._entrati = [];
    this._disdici = null;
    this._chiudiDaSola = null;
    this._apertaFinoA = 0;
    /* Il registro dei dispositivi di Home Assistant, e quando lo si e' letto:
     * serve a legare una riga di Zigbee2MQTT a quello che la plancia conosce. */
    this._dispositivi = null;
    this._dispositiviIl = 0;
  }

  /** Quale rete c'e'. La risposta si tiene un minuto. */
  async rete({ forza = false } = {}) {
    const ora = this.adesso();
    if (!forza && this._rete && ora - this._reteChiestaIl < QUANTO_SI_RICORDA) return this._rete;
    this._verbale = { zha: "", posta: "" };
    const zha = await this._ceZha();
    /* La cassetta si cerca solo se ZHA non c'e': con ZHA in casa la risposta
     * e' gia' decisa, e affacciarsi alla posta sarebbe un giro per niente. */
    const cassetta = zha ? "" : await this._cercaLaCassetta();
    this._rete = laReteDiCasa({ zha, cassetta });
    this._reteChiestaIl = ora;
    return this._rete;
  }

  /**
   * Cos'ha visto, l'ultima volta che ha guardato.
   *
   * Serve a una cosa sola, ed e' la ragione per cui esiste: **una casa che ha
   * Zigbee e un ponte che non lo trova erano indistinguibili da una casa che
   * Zigbee non ce l'ha**. In tutt'e due i casi la voce nel menu non compare, e
   * chi guarda non ha nessun modo di sapere quale dei due gli e' capitato.
   *
   * E' lo stesso guasto contro cui questo progetto ha gia' scritto tre volte:
   * quello muto. La console del ponte dice gia' perche' il centralino non
   * risponde e da dove viene la plancia; questa riga le sta accanto, e risponde
   * a «ho Zigbee in casa: perche' il tasto non c'e'?».
   *
   * Niente di segreto: il nome della cassetta e' un prefisso MQTT scelto da chi
   * ha installato, e sta nella scheda dell'add-on di Zigbee2MQTT.
   */
  comeEAndata() {
    const verbale = this._verbale || { zha: "", posta: "" };
    return {
      quale: this._rete?.quale || "",
      cassetta: this._rete?.cassetta || "",
      chiesto: this._reteChiestaIl || 0,
      zha: verbale.zha,
      posta: verbale.posta,
      cassette: [...LE_CASSETTE],
    };
  }

  /**
   * Lo scrive nel registro dell'add-on, all'accensione.
   *
   * La console lo diceva gia' — ma solo a chi ci fosse passato **dopo** che
   * qualcuno avesse aperto la schermata Zigbee nell'app. Finche' nessuno
   * chiedeva, `rete()` non partiva mai, `chiesto` restava a zero e il riquadro
   * della console stava nascosto. E chi quella schermata non ce l'ha — perche'
   * la voce nel menu non compare, che e' esattamente la domanda — non poteva
   * aprirla per scoprire perche' non compare. Un cerchio: il rimedio al
   * silenzio era muto anche lui.
   *
   * Il registro invece e' il primo posto dove si guarda quando una cosa non
   * c'e', ed e' dove il ponte dice gia' tutto il resto: se Home Assistant
   * risponde, quanti dispositivi sono abbinati, se il centralino ci conosce.
   * Questa riga sta li' in mezzo, e c'e' **sempre** — anche nelle case in cui
   * quella schermata non la aprira' mai nessuno.
   *
   * Non si aspetta il suo esito per accendere il ponte: sono due secondi di
   * posta, e una riga di registro non vale il ritardo di tutto il resto.
   */
  async dilloAlRegistro(attese = ATTESE) {
    let rete = await this.rete({ forza: true });
    for (const quanto of attese) {
      if (this._fermo || rete.quale !== NESSUNA) break;
      await this.aspetta(quanto);
      if (this._fermo) return rete;
      rete = await this.rete({ forza: true });
    }
    if (this._fermo) return rete;
    const { grave, riga } = comeSiDiceNelRegistro({ rete, verbale: this._verbale });
    if (grave) this.registro.attenzione(riga);
    else this.registro.info(riga);
    return rete;
  }

  /* Una riga del verbale.
   *
   * L'ultima scritta vince, e non la prima: le prime erano annunci — «mi
   * affaccio su…» — e coprivano il risultato, che e' l'unica cosa che chi
   * legge sta cercando. Una prova nuova l'ha trovato subito. */
  _scrivi(dove, cosa) {
    this._verbale ??= { zha: "", posta: "" };
    this._verbale[dove] = cosa;
  }

  async _ceZha() {
    try {
      const voci = await this.casa.chiedi({ type: "config_entries/get", domain: ZHA });
      const quante = Array.isArray(voci) ? voci.length : 0;
      const ce = ceZha(voci);
      this._scrivi(
        "zha",
        !quante
          ? "l'integrazione ZHA in questa casa non c'e'"
          : ce
            ? `ZHA c'e' ed e' in piedi (${quante} voci)`
            : `ZHA c'e' ma non e' caricata (${quante} voci): antenna staccata, o integrazione in errore`,
      );
      return ce;
    } catch (errore) {
      this._scrivi("zha", `Home Assistant non ha risposto su ZHA: ${errore?.message || errore}`);
      /* Una casa che non conosce quella domanda e' una casa senza ZHA: e'
       * Home Assistant stesso a rispondere, e se non sa rispondere quella
       * integrazione non c'e'. */
      return false;
    }
  }

  /**
   * Si affaccia alla posta e aspetta che qualcuno dica come si chiama.
   *
   * Due secondi, non di piu': il messaggio e' gia' scritto nella cassetta e
   * arriva subito. Chi non risponde in due secondi non c'e', e far aspettare
   * chi ha appena aperto una schermata e' il modo di farla sembrare rotta.
   */
  async _cercaLaCassetta() {
    const disdette = [];
    /* Quante domande non hanno ancora avuto risposta: la scadenza vale per
     * tutte insieme, ma se TUTTE falliscono — niente MQTT in questa casa — non
     * si sta li' due secondi ad aspettare nessuno. */
    let aperte = LE_CASSETTE.length;
    try {
      return await new Promise((risolvi) => {
        const scadenza = setTimeout(() => {
          this._scrivi(
            "posta",
            `nessuna cassetta: in ${ATTESA_DELLA_CASSETTA / 1000} secondi non ha risposto nessuno su ${LE_CASSETTE.join(" ne' su ")}`,
          );
          risolvi("");
        }, ATTESA_DELLA_CASSETTA);
        const basta = (prefisso) => {
          clearTimeout(scadenza);
          risolvi(prefisso);
        };
        for (const topic of LE_CASSETTE) {
          this.casa
            .ascoltaIl({ type: "mqtt/subscribe", topic }, (evento) => {
              const prefisso = prefissoDellaCassetta(evento?.topic);
              if (prefisso) {
                this._scrivi("posta", `la cassetta si chiama «${prefisso}», sentita su ${topic}`);
                basta(prefisso);
              }
            })
            .then(
              (smetti) => {
                disdette.push(smetti);
              },
              (errore) => {
                /* Niente MQTT in questa casa: nessuna cassetta, e non e' un
                 * guasto — e' una casa che Zigbee2MQTT non ce l'ha. */
                aperte -= 1;
                if (aperte <= 0)
                  this._scrivi(
                    "posta",
                    `nessuna cassetta: Home Assistant non fa ascoltare MQTT (${errore?.message || errore})`,
                  );
                if (aperte <= 0) basta("");
              },
            );
        }
      });
    } finally {
      for (const disdici of disdette) {
        try {
          await disdici?.();
        } catch (_errore) {
          /* L'abbonamento e' gia' morto col filo. */
        }
      }
    }
  }

  /** Com'e' messa adesso: per la schermata 1 e per il conto alla rovescia. */
  async stato() {
    const rete = await this.rete();
    const ora = this.adesso();
    const restano = this._apertaFinoA > ora ? Math.round((this._apertaFinoA - ora) / 1000) : 0;
    return {
      quale: rete.quale,
      aperta: restano > 0,
      restano,
      entrati: this._entrati.slice(),
    };
  }

  /**
   * Apre la rete, e da quel momento ascolta chi entra.
   *
   * L'ascolto parte PRIMA del comando, e non e' pignoleria: fra l'ordine e la
   * rete aperta passano dei millisecondi, e un dispositivo gia' in attesa
   * entra subito. Ascoltando dopo, quello si perderebbe — e chi guarda
   * vedrebbe il conto alla rovescia scorrere su un dispositivo che e' gia'
   * dentro.
   */
  async apri({ secondi = QUANTO_RESTA_APERTA } = {}) {
    const rete = await this.rete();
    const comando = comeSiApre(rete, secondi);
    if (!comando) return { fatto: false, perche: "questa casa non ha una rete Zigbee" };
    this._entrati = [];
    await this._ascolta();
    await this._ordina(leStradePerAprire(rete, secondi));
    const quanto = perQuanto(secondi);
    this._apertaFinoA = this.adesso() + quanto * 1000;
    clearTimeout(this._chiudiDaSola);
    /* La rete si richiude da sola: lo fa gia' il programma che la gestisce, e
     * questo timer serve solo a smettere di ascoltare e a far dire la verita'
     * allo stato. Senza, il ponte resterebbe in ascolto per sempre. */
    this._chiudiDaSola = setTimeout(() => this._scaduta(), quanto * 1000 + 1000);
    this._chiudiDaSola?.unref?.();
    this.registro.info(`zigbee: rete aperta per ${quanto}s (${rete.quale})`);
    return { fatto: true, quale: rete.quale, restano: quanto };
  }

  /** La richiude adesso. */
  async chiudi() {
    const rete = await this.rete();
    const comando = comeSiChiude(rete);
    this._scaduta();
    if (!comando) return { fatto: false, perche: "questa casa non ha una rete Zigbee" };
    await this._ordina(leStradePerChiudere(rete));
    this.registro.info("zigbee: rete richiusa");
    return { fatto: true };
  }

  /* L'ordine, per le strade che ci sono.
   *
   * Si provano in fila. Una strada che Home Assistant non ha — il comando
   * sconosciuto, il servizio che non esiste — non e' un guasto: e' solo
   * questa casa che quella strada non ce l'ha, e si passa alla prossima.
   * Qualunque altro rifiuto invece ferma tutto: se il coordinatore non
   * risponde, non risponde anche per la seconda strada, e chi ha premuto il
   * tasto aspetterebbe il doppio per lo stesso «no».
   *
   * Se nessuna strada c'e', l'errore che esce dice di chi e': non e' il ponte
   * a essere vecchio — il ponte questo comando lo conosce, l'ha appena
   * eseguito — e' Home Assistant che non lo accetta. Rilanciare
   * `unknown_command` cosi' com'era mandava chi legge ad aggiornare la cosa
   * sbagliata. */
  async _ordina(strade) {
    if (!strade.length) return null;
    let ultimo = "";
    for (const [quale, comando] of strade.entries()) {
      try {
        const fatto = await this.casa.chiedi(comando);
        if (quale > 0) this.registro.info(`zigbee: fatto con ${comeSiChiama(comando)}`);
        return fatto;
      } catch (errore) {
        if (!eUnComandoCheNonCe(errore)) throw errore;
        this.registro.info(
          `zigbee: questa casa non ha ${comeSiChiama(comando)}, provo la prossima`,
        );
        ultimo = String(errore?.message || errore?.code || "");
      }
    }
    throw new ZigbeeNonAccettato(strade, ultimo);
  }

  _scaduta() {
    clearTimeout(this._chiudiDaSola);
    this._chiudiDaSola = null;
    this._apertaFinoA = 0;
    const smetti = this._disdici;
    this._disdici = null;
    /* Si smette di ascoltare senza aspettare: chi ha chiuso la schermata non
     * deve stare fermo mentre il ponte saluta Home Assistant. */
    Promise.resolve()
      .then(() => smetti?.())
      .catch(() => {});
  }

  async _ascolta() {
    if (this._disdici) return;
    this._disdici = await this.casa.ascolta(
      "device_registry_updated",
      (evento) => this._entrato(evento),
      {
        onCaduto: () => {
          this._disdici = null;
        },
      },
    );
  }

  async _entrato(evento) {
    if (!eUnoNuovo(evento)) return;
    const id = pulito(evento.data?.device_id);
    if (this._entrati.some((uno) => uno.id === id)) return;
    let dispositivo = { id };
    try {
      const tutti = await this.casa.chiedi({ type: "config/device_registry/list" });
      const suo = (Array.isArray(tutti) ? tutti : []).find((uno) => pulito(uno?.id) === id);
      if (suo) dispositivo = suo;
    } catch (_errore) {
      /* Il nome non si sa: resta l'identificativo, e il passo dopo lo chiede
       * comunque. Meglio un dispositivo senza nome di un dispositivo perso. */
    }
    this._entrati.push(comeSiPresenta(dispositivo, await this._cosaHaPortato(id)));
    this.registro.info(`zigbee: e' entrato ${id}`);
  }

  /**
   * Le entita' che quel dispositivo ha creato entrando.
   *
   * Una presa smart ne pubblica cinque, un sensore di presenza tre: e' da
   * quelle che la plancia capisce cos'e' l'oggetto, e senza non si puo' fare
   * il passo che lo mette in una sezione.
   *
   * Il registro si chiede una volta per dispositivo entrato — non a ogni
   * domanda di stato, che ne arriva una al secondo — e se non risponde si
   * resta senza: il nome glielo si da' lo stesso, e la sezione si sceglie a
   * mano dalla plancia come si e' sempre fatto.
   */
  async _cosaHaPortato(id) {
    try {
      const tutte = await this.casa.chiedi({ type: "config/entity_registry/list" });
      return (Array.isArray(tutte) ? tutte : []).filter((una) => pulito(una?.device_id) === id);
    } catch (_errore) {
      return [];
    }
  }

  /**
   * Gli da' il nome che gli ha dato chi lo guarda (il passo 3).
   *
   * Il nome va nel registro di Home Assistant, dove lo vedono tutti — la
   * plancia, le automazioni, l'app — e non in un cassetto del ponte: un
   * dispositivo che si chiama «Presa lavatrice» nell'app e «TS0121» in casa
   * sarebbe lo stesso dispositivo con due nomi, che e' il modo in cui uno
   * smette di fidarsi di quello che legge.
   *
   * Si scrive in `name_by_user` e non in `name`: `name` e' come si e'
   * presentato lui, e sovrascriverlo vorrebbe dire perdere il modello —
   * l'unica cosa che dice cos'e' quell'oggetto quando fra un anno non ci si
   * ricorda piu'.
   */
  /**
   * Chi c'e' nella rete, tutto, in una forma sola.
   *
   * Le due reti rispondono in due modi — ZHA a una domanda, Zigbee2MQTT con
   * un messaggio gia' scritto in una cassetta — e chi disegna non deve
   * saperlo: se lo sapesse, ogni schermata andrebbe scritta due volte.
   *
   * Senza rete in casa torna un elenco vuoto e il perche'. Non si solleva: una
   * schermata che si apre su una casa senza Zigbee deve dire «qui non c'e'
   * niente», non rompersi.
   */
  async elenco() {
    const rete = await this.rete();
    if (rete.quale === NESSUNA)
      return { quale: NESSUNA, righe: [], perche: "in questa casa non c'e' una rete Zigbee" };
    try {
      const righe =
        rete.quale === ZHA ? await this._elencoDiZha() : await this._elencoDallaCassetta(rete);
      return { quale: rete.quale, righe: await this._colDispositivo(righe), perche: "" };
    } catch (errore) {
      this.registro?.info?.(`zigbee: l'elenco non si legge: ${errore?.message || errore}`);
      return { quale: rete.quale, righe: [], perche: ilPerche(errore) };
    }
  }

  /* Il dispositivo di Home Assistant, per le righe che non ce l'hanno.
   *
   * ZHA lo scrive da se' (`device_reg_id`); Zigbee2MQTT no, e le sue righe
   * uscivano con quel campo vuoto. Non e' un dettaglio: e' il filo che lega la
   * riga dell'elenco a quello che la plancia conosce, e senza, nella scheda di
   * un dispositivo, «rinominalo» e «mettilo nella plancia» non hanno su cosa
   * lavorare — su una casa Zigbee2MQTT quei due tasti non hanno mai funzionato.
   *
   * Il filo c'e' gia' ed e' l'indirizzo: si incrocia col registro. */
  async _colDispositivo(righe) {
    const elenco = Array.isArray(righe) ? righe : [];
    if (!elenco.some((una) => !pulito(una?.dispositivo))) return elenco;
    const tutti = await this._iDispositivi();
    if (!tutti.length) return elenco;
    return elenco.map((una) =>
      pulito(una?.dispositivo)
        ? una
        : { ...una, dispositivo: ilDispositivoDellaTarga(tutti, una?.id) },
    );
  }

  /* Il registro dei dispositivi, tenuto un attimo.
   *
   * L'elenco si richiede spesso — quando si toglie uno si riguarda nove volte
   * di fila — e il registro dei dispositivi in mezzo minuto non cambia. Senza
   * questa memoria, ogni sguardo sarebbe una domanda in piu' a Home Assistant
   * per rileggere le stesse righe. */
  async _iDispositivi() {
    const adesso = this.adesso();
    if (this._dispositivi && adesso - this._dispositiviIl < QUANTO_SI_RICORDANO_I_DISPOSITIVI)
      return this._dispositivi;
    try {
      const tutti = await this.casa.chiedi({ type: "config/device_registry/list" });
      this._dispositivi = Array.isArray(tutti) ? tutti : [];
    } catch (_errore) {
      /* Un registro che non risponde non e' un elenco perso: e' un elenco
       * senza il filo verso la plancia, che e' quello che c'era prima. */
      this._dispositivi = [];
    }
    this._dispositiviIl = adesso;
    return this._dispositivi;
  }

  async _elencoDiZha() {
    const detto = await this.casa.chiedi(comeSiChiedeLElenco({ quale: ZHA }));
    return lElencoDellaRete(ZHA, detto);
  }

  /* L'elenco di Zigbee2MQTT sta in una cassetta, ritenuto: chi si affaccia lo
   * riceve subito, senza chiedere niente a nessuno. Si aspetta quanto si
   * aspetta per sapere come si chiama la rete — se in quel tempo non arriva,
   * quella cassetta non e' scritta e l'elenco non c'e'. */
  async _elencoDallaCassetta(rete) {
    const topic = laCassettaDellElenco(rete.cassetta);
    if (!topic) return [];
    let smetti = null;
    try {
      return await new Promise((risolvi, rifiuta) => {
        const scadenza = setTimeout(
          () => rifiuta(new Error("la cassetta dell'elenco non risponde")),
          ATTESA_DELLA_CASSETTA,
        );
        this.casa
          .ascoltaIl({ type: "mqtt/subscribe", topic }, (evento) => {
            clearTimeout(scadenza);
            let detto = evento?.payload;
            if (typeof detto === "string") {
              try {
                detto = JSON.parse(detto);
              } catch (_errore) {
                detto = [];
              }
            }
            risolvi(lElencoDellaRete(Z2M, detto));
          })
          .then(
            (disdici) => {
              smetti = disdici;
            },
            (errore) => {
              clearTimeout(scadenza);
              rifiuta(errore);
            },
          );
      });
    } finally {
      try {
        await smetti?.();
      } catch (_errore) {
        /* L'abbonamento e' gia' morto col filo. */
      }
    }
  }

  /**
   * Toglie un apparecchio dalla rete, e poi guarda se e' andato via davvero.
   *
   * La conferma non si legge dalla risposta al comando: nessuna delle due reti
   * la da' per quello che e' successo dopo — ZHA risponde appena ha mandato
   * l'ordine, e Zigbee2MQTT risponde che ha imbucato il messaggio. Quello che
   * conta e' che nell'elenco quella riga non ci sia piu', e l'unico modo di
   * saperlo e' riguardarlo. La rinomina ha gia' insegnato quanto vale un «si'»
   * che nessuno ha controllato.
   */
  async elimina(chi) {
    const id = pulito(chi).toLowerCase();
    if (!id) return { fatto: false, perche: "quale dispositivo?" };
    const rete = await this.rete();
    const strade = leStradePerEliminare(rete, id);
    if (!strade.length)
      return { fatto: false, perche: "in questa casa non c'e' una rete Zigbee da cui toglierlo" };
    try {
      await this._ordina(strade);
    } catch (errore) {
      return { fatto: false, perche: ilPerche(errore) };
    }
    /* E adesso si guarda — ma non una volta sola, e non subito.
     *
     * L'ordine viaggia via radio e l'elenco si riscrive dopo: chiedendolo
     * nell'istante in cui si e' mandato l'ordine ci si trova ancora tutto come
     * prima, e si annuncia un fallimento che non c'e'. Si riguarda finche' non
     * e' uscito, o finche' non e' passato il tempo che ci mette uno sveglio. */
    let dopo = await this.elenco();
    for (
      let giro = 0;
      giro < QUANTE_VOLTE_SI_RIGUARDA && dopo.righe.some((una) => una.id === id);
      giro++
    ) {
      await this.aspetta(OGNI_QUANTO_SI_RIGUARDA);
      dopo = await this.elenco();
    }
    /* Se dopo tutto questo c'e' ancora, non e' andata — e si dice cosi',
     * invece di dire «fatto» su una cosa che non e' successa. Con dentro
     * l'unica cosa che chi sta li' col telefono in mano puo' fare. */
    if (dopo.righe.some((una) => una.id === id))
      return {
        fatto: false,
        perche: perCheNonEUscito(),
        righe: dopo.righe,
      };
    return { fatto: true, righe: dopo.righe };
  }

  /**
   * Il nome dentro Zigbee2MQTT. Torna `null` quando e' andata — o quando non
   * c'era niente da fare, che per ZHA e' sempre — e l'esito da dire quando no.
   *
   * Non ci si fida del «si'», come per il togliere: Zigbee2MQTT risponde di
   * aver ricevuto la domanda, non di averla fatta. L'unica conferma e'
   * ritrovare quel nome nella sua cassetta.
   */
  async _rinominaNellaRete(dispositivo, come) {
    const rete = await this.rete();
    if (rete.quale !== Z2M) return null;
    const suo = leCifreDellaTarga(
      [...(dispositivo?.identifiers ?? []), ...(dispositivo?.connections ?? [])]
        .flat()
        .find((pezzo) => leCifreDellaTarga(pezzo)) ?? "",
    );
    if (!suo)
      return {
        fatto: false,
        perche:
          "il nome e' cambiato in Home Assistant, ma di quel dispositivo non si sa " +
          "l'indirizzo Zigbee: dentro Zigbee2MQTT resta quello di prima",
      };
    /* L'indirizzo nella forma in cui lo scrive Zigbee2MQTT. */
    const targaSua = `0x${suo}`;
    const ordine = comeSiRinomina(rete, targaSua, come);
    if (!ordine)
      return {
        fatto: false,
        perche:
          "il nome e' cambiato in Home Assistant, ma a Zigbee2MQTT non si sa come dirlo: " +
          "dentro la rete resta quello di prima",
      };
    try {
      await this.casa.chiedi(ordine);
      /* Rinominato, Zigbee2MQTT rifa' le entita' e con loro il dispositivo:
       * quello che si ricordava non vale piu'. */
      this._dispositivi = null;
    } catch (errore) {
      return {
        fatto: false,
        perche: `il nome e' cambiato in Home Assistant, ma la rete non l'ha preso: ${ilPerche(errore)}`,
      };
    }
    let dopo = await this.elenco();
    for (
      let giro = 0;
      giro < QUANTE_VOLTE_SI_GUARDA_IL_NOME && !this._siChiama(dopo, targaSua, come);
      giro++
    ) {
      await this.aspetta(OGNI_QUANTO_SI_GUARDA_IL_NOME);
      dopo = await this.elenco();
    }
    if (this._siChiama(dopo, targaSua, come)) return null;
    return {
      fatto: false,
      perche:
        "il nome e' cambiato in Home Assistant ma non dentro Zigbee2MQTT: " +
        "di solito vuol dire che quel nome li' e' gia' di un altro",
    };
  }

  _siChiama(elenco, targaSua, come) {
    const cerco = leCifreDellaTarga(targaSua);
    return (elenco?.righe ?? []).some(
      (una) => leCifreDellaTarga(una.id) === cerco && pulito(una.nome) === come,
    );
  }

  /**
   * La mappa: chi parla con chi, disegnata.
   *
   * Senza `rifai` si mostra quello che la rete sa gia' — su ZHA sono i vicini
   * dell'ultima volta che ha guardato — e si apre subito. Con `rifai` si fa
   * partire il giro vero, che dura, e chi lo chiede lo sa.
   *
   * Su Zigbee2MQTT quello che si sa gia' non esiste: nella cassetta dei
   * dispositivi i vicini non ci sono. Li' senza `rifai` si dice, invece di
   * disegnare una mappa vuota che sembrerebbe una rete a pezzi.
   */
  async mappa({ rifai = false } = {}) {
    const rete = await this.rete();
    if (rete.quale === NESSUNA)
      return { quale: NESSUNA, righe: [], perche: "in questa casa non c'e' una rete Zigbee" };
    try {
      const righe =
        rete.quale === ZHA ? await this._mappaDiZha(rifai) : await this._mappaDiZ2M(rete, rifai);
      if (!righe.length)
        return {
          quale: rete.quale,
          righe: [],
          perche:
            rete.quale === Z2M && !rifai
              ? "questa rete i collegamenti non li tiene scritti: la mappa va chiesta"
              : "la rete non ha ancora guardato con chi parla ognuno",
        };
      /* Escono le righe coi loro vicini, e basta: a disegnare ci pensa
       * `mappa-zigbee.js`, che di rete non sa niente. Se il disegno lo facesse
       * questo file, i due moduli si importerebbero a vicenda — e chi tocca
       * una rete Zigbee non deve trascinarsi dietro un generatore di SVG. */
      return { quale: rete.quale, righe, perche: "" };
    } catch (errore) {
      this.registro?.info?.(`zigbee: la mappa non si legge: ${errore?.message || errore}`);
      return { quale: rete.quale, righe: [], perche: ilPerche(errore) };
    }
  }

  async _mappaDiZha(rifai) {
    if (rifai) {
      /* Il giro parte e basta: ZHA non risponde quando ha finito, scrive i
       * vicini man mano nel suo registro. Si aspetta un po' e si rilegge — e
       * se il giro non e' finito si vede quello che ha fatto finora, che e'
       * meglio di niente. */
      try {
        await this.casa.chiedi(comeSiChiedeLaMappa({ quale: ZHA }));
      } catch (errore) {
        if (!eUnComandoCheNonCe(errore)) throw errore;
        this.registro?.info?.(
          "zigbee: questa casa non sa rifare la topologia, mostro quella che c'e'",
        );
      }
    }
    return lElencoDellaRete(ZHA, await this.casa.chiedi(comeSiChiedeLElenco({ quale: ZHA })));
  }

  async _mappaDiZ2M(rete, rifai) {
    if (!rifai) return [];
    const cassette = leCassetteDellaMappa(rete.cassetta);
    if (!cassette) return [];
    let smetti = null;
    try {
      return await new Promise((risolvi, rifiuta) => {
        const scadenza = setTimeout(
          () => rifiuta(new Error("la rete non ha finito di guardarsi in un minuto e mezzo")),
          ATTESA_DELLA_MAPPA,
        );
        this.casa
          .ascoltaIl({ type: "mqtt/subscribe", topic: cassette.risponde }, (evento) => {
            clearTimeout(scadenza);
            let detto = evento?.payload;
            if (typeof detto === "string") {
              try {
                detto = JSON.parse(detto);
              } catch (_errore) {
                detto = null;
              }
            }
            risolvi(leRigheDallaMappaDiZ2M(detto));
          })
          .then(
            async (disdici) => {
              smetti = disdici;
              /* Si chiede DOPO essersi messi in ascolto: fra la domanda e
               * l'orecchio passano dei millisecondi, e una risposta che arriva
               * in mezzo si perde. E' la stessa ragione per cui si ascolta
               * prima di aprire la rete. */
              try {
                await this.casa.chiedi(comeSiChiedeLaMappa(rete));
              } catch (errore) {
                clearTimeout(scadenza);
                rifiuta(errore);
              }
            },
            (errore) => {
              clearTimeout(scadenza);
              rifiuta(errore);
            },
          );
      });
    } finally {
      try {
        await smetti?.();
      } catch (_errore) {
        /* L'abbonamento e' gia' morto col filo. */
      }
    }
  }

  async rinomina(id, nome) {
    const quale = pulito(id);
    const come = pulito(nome).slice(0, 80);
    if (!quale) return { fatto: false, perche: "quale dispositivo?" };
    if (!come) return { fatto: false, perche: "il nome e' vuoto" };
    const dispositivo = await this.casa.chiedi({
      type: "config/device_registry/update",
      device_id: quale,
      name_by_user: come,
    });
    /* E adesso si CONTROLLA, invece di fidarsi.
     *
     * Dal campo: «ho cambiato nome… in Home Assistant non ha cambiato il nome
     * in quello scelto», e la schermata intanto diceva «Adesso si chiama cosi',
     * e con quel nome lo vedono la plancia e Home Assistant». Una promessa non
     * verificata, e la peggiore specie: chi la legge smette di controllare.
     *
     * Home Assistant a un rifiuto risponde male e `chiedi` solleva — quella
     * strada e' coperta. Quello che non era coperto e' un «si'» che non ha
     * fatto quello che diceva: un `device_id` che esiste ma non e' quello che
     * uno guarda, un campo che quella versione non accetta. Si rilegge la
     * riga dalla risposta, e se il nome non e' quello si dice che non e'
     * andata — con dentro quello che Home Assistant ha davvero, che e'
     * l'unica cosa che poi fa capire perche'. */
    const scritto = pulito(dispositivo?.name_by_user);
    if (scritto !== come)
      return {
        fatto: false,
        perche: scritto
          ? `Home Assistant ha accettato ma quel dispositivo si chiama «${scritto}»`
          : "Home Assistant ha accettato senza scrivere il nome",
      };
    /* E adesso anche alla rete, che e' l'altro nome.
     *
     * Su ZHA non serve: la' il nome della rete E' il nome del dispositivo di
     * Home Assistant, e quello e' appena stato scritto. Su Zigbee2MQTT sono
     * due, e senza questo pezzo il secondo resta l'indirizzo per sempre. */
    const allaRete = await this._rinominaNellaRete(dispositivo, come);
    if (allaRete) return allaRete;
    /* E lo si aggiorna anche nell'elenco di chi sta guardando: la schermata
     * dopo mostra il nome nuovo senza dover richiedere tutto. */
    const suo = this._entrati.find((uno) => uno.id === quale);
    if (suo) suo.nome = come;
    /* Le entita' NON si richiedono: sono quelle raccolte quando e' entrato, e
     * un cambio di nome non ne crea e non ne toglie. Richiedere il registro
     * intero per rileggere una cosa che si sa gia' sarebbe un giro per
     * niente — e senza, chi risponde a questo comando perderebbe per strada
     * proprio quello che serve al passo dopo. */
    const risposta = comeSiPresenta(dispositivo || { id: quale, name_by_user: come });
    return {
      fatto: true,
      dispositivo: { ...risposta, entita: suo?.entita ?? risposta.entita },
    };
  }

  /** Smette di ascoltare e spegne il timer: serve a spegnere per bene. */
  spegni() {
    this._fermo = true;
    this._scaduta();
  }
}
