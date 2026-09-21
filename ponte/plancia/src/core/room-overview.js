/* Una stanza e tutto quello che ci sta dentro.
 *
 * «Sarebbe carino avere una sezione dove vedere le entita' raggruppate per
 * stanze, tipo una sezione divisa a pagine dove ogni pagina e' una stanza con
 * tutte le entita' della stessa.»
 *
 * La plancia sa gia' a che stanza appartiene ogni cosa: luci, clima, tapparelle,
 * elettrodomestici, telecamere, carichi la portano scritta addosso — `room_id`
 * per il modello canonico, il nome della stanza per chi arriva da una
 * configurazione piu' vecchia. Quello che mancava non era il dato: era il verso
 * in cui leggerlo. Ogni sezione lo legge per tipo — tutte le luci, tutte le
 * tapparelle — e nessuna lo legge per stanza.
 *
 * Qui si gira. Non si sposta niente e non si riscrive niente: si prende cio' che
 * c'e' e lo si raccoglie per stanza, con in coda un raccoglitore per le cose che
 * una stanza non ce l'hanno — che e' anche il modo di accorgersi di averla
 * dimenticata, senza andarla a cercare sezione per sezione.
 *
 * Il modulo e' puro: entra un oggetto, esce un oggetto. Niente DOM, niente
 * localStorage, niente stati letti di nascosto.
 */

const clean = (value) => String(value ?? "").trim();

const lower = (value) => clean(value).toLowerCase();

function slug(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** La chiave con cui una stanza si riconosce, comunque sia stata scritta. */
export const roomKey = (value) => slug(value).replace(/^room-/, "");

/* I tipi di cosa che una stanza puo' contenere, nell'ordine in cui si leggono.
 *
 * L'ordine non e' alfabetico ne' casuale: e' quello con cui si guarda una
 * stanza entrandoci. Prima che aria fa, poi se c'e' luce, poi com'e' messa la
 * finestra, e solo dopo gli oggetti. */
/* Le parole non stanno qui.
 *
 * Questo modulo e' puro e non sa che lingua si parla; il nome che ogni blocco
 * porta a schermo lo mette la sezione, insieme all'icona. Qui c'e' solo il
 * legame fra il blocco e la sezione da cui pesca. */
/* Dove sta scritto che un'entita' appartiene a una stanza, quando la sua
 * scheda non lo chiede. Una casella sola, `entita' -> stanza`: cambiare il
 * nome di una stanza non la rompe, perche' dentro ci va l'id. */
export const ROOM_ASSIGN_KEY = "cd_stanze_entita";

/* L'ordine delle stanze e' uno solo, e vale ovunque.
 *
 * Chi ordina le stanze in configurazione lo fa per una ragione: e' l'ordine in
 * cui gira per casa. Quell'ordine pero' arrivava solo alla pagina Stanze e
 * alle tendine. Le pagine che raggruppano per stanza — Luci, Tapparelle,
 * Elettrodomestici — se lo riscrivevano ognuna a modo suo: due in ordine
 * alfabetico, una nell'ordine in cui le cose erano state configurate. Il
 * bagnetto spostato in cima restava in fondo dappertutto, e l'ordinamento
 * sembrava non essere servito a niente.
 *
 * La domanda «quale stanza viene prima» ha una risposta sola, ed e' questa.
 * Le stanze che nessuno ha configurato — un nome scritto a mano su una luce,
 * o il gruppo «senza stanza» — vanno in fondo, dove stavano.
 */
export function roomOrderRank(rooms = []) {
  const posti = new Map();
  array(rooms)
    .map((room, index) => ({
      nome: clean(room?.name),
      posto: Number.isFinite(+room?.order) ? +room.order : index,
    }))
    .filter((voce) => voce.nome)
    .sort((sinistra, destra) => sinistra.posto - destra.posto)
    .forEach((voce, posizione) => {
      const chiave = roomKey(voce.nome);
      if (!posti.has(chiave)) posti.set(chiave, posizione);
    });
  return (nome) => {
    const posto = posti.get(roomKey(clean(nome)));
    return posto === undefined ? Number.MAX_SAFE_INTEGER : posto;
  };
}

export const ROOM_BLOCKS = Object.freeze([
  { key: "clima", section: "climate" },
  { key: "luci", section: "lights" },
  /* Le prese hanno la stanza addosso come le luci — «la sezione Prese non
   * viene riportata dentro Stanze» — e qui si leggono dall'altro lato. */
  { key: "prese", section: "prese" },
  { key: "coperture", section: "covers" },
  { key: "elettrodomestici", section: "appliances" },
  /* I lettori (#405).
   *
   * «I vari player presenti nelle stanze: attualmente appare un Playing
   *  generico, che se cliccato rimanda alla home della dashboard. Un'idea
   *  potrebbe essere avere la sezione Media Player nelle stanze invece che
   *  classificarli come Altro in questa stanza.»
   *
   * La stanza un lettore ce l'ha addosso: la sua scheda la chiede, come la
   * chiedono le luci e le telecamere. Mancava soltanto la riga qui, e senza
   * quella un lettore poteva arrivare in una stanza solo per assegnazione a
   * mano — cioe' nel mucchio dell'«Altro», dove il tocco non porta da nessuna
   * parte. Era lo stesso difetto che avevano le telecamere, corretto li' e
   * rimasto qui. */
  { key: "media", section: "media" },
  { key: "telecamere", section: "cameras" },
  { key: "carichi", section: "loads" },
  { key: "robot", section: "robots" },
  { key: "irrigazione", section: "irrigation" },
  /* Tutto il resto della casa.
   *
   * Le sezioni qui sopra la stanza ce l'hanno addosso perche' la loro scheda
   * la chiede. Ce ne sono altre che non la chiedono e non e' detto che
   * debbano: un sensore di allagamento, una sonda di temperatura, la finestra
   * di un avviso, la pompa della piscina. Senza di loro la pagina di una
   * stanza racconta meta' della stanza.
   *
   * Per quelle c'e' una assegnazione a mano, entita' per entita', che si fa
   * dalla riga in cui l'entita' e' gia' scritta — in qualunque scheda si
   * trovi. Sta in fondo perche' e' quello che avanza dopo aver guardato le
   * cose che una stanza ce l'hanno per mestiere. */
  { key: "altro", section: "assigned" },
]);

/* La stanza di una voce, comunque sia scritta.
 *
 * Il modello canonico scrive `room_id`; le configurazioni piu' vecchie — e
 * quelle scritte a mano — scrivono il nome nella casella `room`. Aspirapolvere e
 * zone d'irrigazione hanno solo quella. Si accettano tutte e tre, e si
 * risolvono contro l'elenco vero delle stanze: senza, «Salone» e «salone » sono
 * due stanze diverse, ed e' esattamente il modo in cui una sezione del genere
 * diventa inutile.
 */
export function roomRefOf(item = {}) {
  return clean(item.room_id || item.roomId || item.room || "");
}

/* L'entita' che identifica una voce, per riconoscerla in due elenchi diversi.
 *
 * Quasi tutte ne hanno una che comanda; una finestra che si apre a mano ha il
 * solo sensore del contatto. Serve qui perche' la stessa cosa arriva da due
 * parti — la sua scheda e l'assegnazione a mano — e sono due oggetti diversi
 * che parlano della stessa entita'. */
export function entityOf(item = {}) {
  return clean(
    item?.entity ||
      item?.entities?.[0] ||
      item?.contact ||
      item?.contact_entity ||
      item?.power ||
      item?.power_entity ||
      "",
  );
}

/**
 * I nomi che in questa casa appartengono a piu' di una stanza.
 *
 * «Posso creare bagno primo piano e bagno secondo piano e le entita' poi devono
 *  funzionare divise, non e' la stessa stanza.»
 *
 * Un nome ripetuto non identifica niente, e fingere che lo faccia e' il modo in
 * cui il bagno di sopra si prende le luci del bagno di sotto. Qui si dice
 * quali nomi sono in quella condizione, una volta per casa, cosi' chi assegna
 * lo sa senza doverselo richiedere per ogni voce.
 */
export function nomiRipetuti(rooms = []) {
  const quante = new Map();
  for (const room of Array.isArray(rooms) ? rooms : []) {
    /* Le due scritture di UNA stanza si contano una volta sola.
     *
     * Un nome si riconosce in due modi — minuscolo e sminuzzato — e su «Camera»
     * i due modi danno la stessa parola. Contandoli separatamente ogni stanza
     * faceva due, e una casa di stanze tutte diverse usciva da qui con ogni
     * nome dichiarato ripetuto: nessuna entita' assegnata per nome sarebbe piu'
     * arrivata da nessuna parte. */
    const sue = new Set([lower(room?.name), roomKey(room?.name)].filter(Boolean));
    for (const chiave of sue) quante.set(chiave, (quante.get(chiave) || 0) + 1);
  }
  return new Set([...quante.entries()].filter(([, volte]) => volte > 1).map(([chiave]) => chiave));
}

/**
 * Se questa voce appartiene a questa stanza.
 *
 * L'identificativo vince sempre: e' l'unica cosa che regge un rinominamento, ed
 * e' quello che la tendina delle stanze salva da tempo. Il NOME resta come
 * ripiego — mezza configurazione esistente e' scritta cosi', e le zone
 * d'irrigazione e gli aspirapolvere hanno solo quello — ma vale soltanto
 * quando e' il nome di UNA stanza sola.
 *
 * Con due stanze omonime la voce non va a nessuna delle due. Prima andava alla
 * prima, in silenzio, e questo file lo dava per scontato: «la prima che la
 * reclama se la tiene, e la seconda resta vuota». Su due bagni di due piani
 * diversi vuol dire mettere l'interruttore di sopra nella stanza di sotto —
 * uno spegne la luce sbagliata e non capisce perche'. Finire nel raccoglitore
 * di cio' che non ha stanza e' peggio esteticamente e meglio in tutto il
 * resto: si vede, e si va a correggerlo. Che due stanze si chiamino uguale
 * l'editor lo dice a parte, dove lo si sistema.
 *
 * `ripetuti` lo prepara `nomiRipetuti` una volta per casa. Senza — e chi chiama
 * da fuori puo' non averlo — si torna al comportamento di prima, che su una
 * casa senza omonimie e' identico.
 */
export function belongsToRoom(item, room, ripetuti = null) {
  const riferimento = roomRefOf(item);
  if (!riferimento) return false;
  const chiave = roomKey(riferimento);
  if (riferimento === clean(room?.id)) return true;
  if (Boolean(chiave) && chiave === roomKey(room?.id)) return true;
  /* Da qui in giu' si sta riconoscendo una stanza dal NOME. */
  if (ripetuti?.has(lower(riferimento)) || (chiave && ripetuti?.has(chiave))) return false;
  return (
    lower(riferimento) === lower(room?.name) || (Boolean(chiave) && chiave === roomKey(room?.name))
  );
}

/**
 * La stanza che un riferimento nomina, o `null`.
 *
 * Stessa regola di `belongsToRoom`, dal verso opposto: chi ha in mano un
 * riferimento e vuole sapere DI CHI sia, invece di chiederlo stanza per
 * stanza. L'identificativo vince; il nome vale solo se e' di una sola stanza,
 * e su un nome diviso in due torna `null` — che vuol dire «non si sa», e non
 * si sa davvero.
 *
 * Serve al piano di una stanza (il guscio lo chiede col nome) e alle tendine,
 * che su due omonime devono scrivere anche il piano per farle distinguere.
 */
export function stanzaDalRiferimento(riferimento, rooms = [], ripetuti = null) {
  const stanze = Array.isArray(rooms) ? rooms.filter(Boolean) : [];
  const cercato = clean(riferimento);
  if (!cercato || !stanze.length) return null;
  const chiave = roomKey(cercato);
  const perId = stanze.find(
    (room) => cercato === clean(room?.id) || (Boolean(chiave) && chiave === roomKey(room?.id)),
  );
  if (perId) return perId;
  const divisi = ripetuti || nomiRipetuti(stanze);
  if (divisi.has(lower(cercato)) || (chiave && divisi.has(chiave))) return null;
  return (
    stanze.find(
      (room) =>
        lower(cercato) === lower(room?.name) || (Boolean(chiave) && chiave === roomKey(room?.name)),
    ) || null
  );
}

const array = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

/* Le sonde di temperatura di una stanza, tutte, in un posto solo.
 *
 * La prima coppia vive addosso alla stanza (`temp`/`hum`, col nome in
 * `temp_name`); quelle oltre la prima stanno in
 * `metadata.temperature_entries`. Questo elenco lo leggevano in tre — il
 * trend, la pagina Stanze e il disegnatore delle card — ognuno col suo
 * appiattimento: erano due padroni per la stessa cosa, e infatti la pagina
 * Temperatura mostrava una sonda sola per quante ne fossero configurate.
 * Il modello sta qui, che e' puro; chi disegna lo chiede e basta. */
const PRIMARY_TEMPERATURE_ID = "primary";

export function normalizeTemperatureEntry(entry = {}, index = 0) {
  return {
    id: clean(entry.id) || `temperature-extra-${index + 1}`,
    name: clean(entry.name || entry.label),
    temp: clean(entry.temp || entry.temperature_entity || entry.entity),
    hum: clean(entry.hum || entry.humidity_entity),
  };
}

/**
 * L'umidita' di una sonda: quella scelta, o la gemella per nome — se esiste.
 *
 * Senza entita' scelta si prova la gemella `..._humidity` del sensore di
 * temperatura, che sui multisensore e' quasi sempre giusta. Ma SOLO se il
 * nome cambia davvero: su un id senza «_temperature» il `replace` restituisce
 * lo STESSO id, e allora si legge la temperatura una seconda volta e la si
 * stampa col «%» addosso.
 *
 * Era gia' successo sulle card (#242) ed era stato corretto li'; la stessa
 * riga senza guardia viveva in altri tre posti, e dal campo e' tornata dalla
 * finestra del widget (#379): «una stanza mostra una misura di umidita' pur
 * non essendoci nessun sensore associato — nella sezione Stanze la stessa
 * stanza non ce l'ha». Non c'era nessun sensore: c'era il termometro,
 * chiamato umidita'.
 *
 * Una risposta sola, qui, dove non ha dipendenze.
 */
export function humidityEntry(entry = {}) {
  const scelta = clean(entry?.hum || entry?.humidity_entity);
  if (scelta) return scelta;
  const temp = clean(entry?.temp || entry?.temperature_entity || entry?.entity);
  const gemella = temp.replace("_temperature", "_humidity");
  return gemella !== temp ? gemella : "";
}

/** Ogni associazione temperatura di una stanza canonica, primaria compresa. */
export function temperatureEntries(room = {}) {
  const entries = [];
  const primaryTemp = clean(room.temp);
  const primaryHum = clean(room.hum);
  if (primaryTemp || primaryHum) {
    entries.push({
      id: PRIMARY_TEMPERATURE_ID,
      name: clean(room.temp_name),
      temp: primaryTemp,
      hum: primaryHum,
    });
  }
  const extras = Array.isArray(room?.metadata?.temperature_entries)
    ? room.metadata.temperature_entries
    : [];
  extras
    .map(normalizeTemperatureEntry)
    .filter((entry) => entry.temp || entry.hum)
    .forEach((entry) => entries.push(entry));
  return entries;
}

/* Le luci arrivano in due forme.
 *
 * Il modello canonico ne fa un elenco di dispositivi con `room_id`; la
 * configurazione storica e' una mappa entita' → nome, con le stanze in una
 * mappa a parte. Chi chiama passa quello che ha, e qui si normalizza — perche'
 * a saperlo deve essere un posto solo. */
export function lightItems(lights, assignments = {}) {
  /* La stanza di una luce non sta sulla luce.
   *
   * Le altre sezioni scrivono la stanza sul dispositivo; le luci no: la
   * scheda Luci tiene le assegnazioni in una mappa a parte, entita' → stanza,
   * e il dispositivo canonico ne esce senza. Chi guarda solo il dispositivo
   * vede una luce senza stanza anche quando la stanza gliel'hanno data. */
  const stanzaDi = (entity, item) =>
    clean(item?.room_id || item?.roomId || item?.room) || clean(assignments?.[entity]);
  if (Array.isArray(lights))
    return lights.map((light) => {
      const entity = clean(light.entity || light.entities?.[0] || light.id);
      return { ...light, entity, room: stanzaDi(entity, light) };
    });
  return Object.entries(lights || {}).map(([entity, name]) => ({
    id: entity,
    entity: clean(entity),
    name: clean(name),
    room: stanzaDi(clean(entity)),
  }));
}

/* La stanza di un carico (#426).
 *
 * «In senza stanza appaiono tutti i vari carichi di stanze ed elettrodomestici,
 *  anche se questi sono correttamente assegnati alle stanze di riferimento.»
 *
 * Il blocco «Carichi» prometteva una stanza e nessun carico ne aveva una: la
 * scheda dei Carichi non la chiedeva. Cosi' il blocco restava vuoto in ogni
 * stanza e OGNI carico finiva nel raccoglitore — che serve ad accorgersi di
 * una dimenticanza e diventa inutile quando ci finisce dentro tutto.
 *
 * Adesso la scheda la chiede. E chi aveva gia' detto «cerchio = stanza» non
 * deve ridirlo: quella scelta e' gia' la risposta — quel cerchio E' quella
 * stanza — e vale come stanza del carico finche' non se ne sceglie un'altra. */
export function loadItems(loads) {
  return array(loads).map((load) => ({
    ...load,
    room_id: clean(load?.room_id || load?.roomId || load?.room || load?.metadata?.flow_room),
  }));
}

/* Le zone d'irrigazione stanno dentro un oggetto, non in un elenco. */
const irrigationZones = (irrigation) => array(irrigation?.zones ?? irrigation);

/**
 * Le stanze con dentro tutto quello che le appartiene, piu' il raccoglitore di
 * cio' che non appartiene a nessuna. Una stanza senza niente resta nell'elenco:
 * e' configurata, e sparire sarebbe sembrare cancellata.
 */
export function roomOverviewModel(input = {}) {
  const stanze = array(input.rooms)
    .map((room, index) => ({
      id: clean(room.id) || `room-${roomKey(room.name) || index + 1}`,
      name: clean(room.name) || `Stanza ${index + 1}`,
      icon: clean(room.icon),
      floor: clean(room.floor),
      temp: clean(room.temp),
      hum: clean(room.hum),
      /* Le sonde in piu' viaggiano con la stanza.
       *
       * Una stanza puo' avere piu' di una coppia di sensori — il comodino, il
       * termostato a muro, la sonda della veranda — e le associazioni oltre la
       * prima stanno in `metadata.temperature_entries`. Questa proiezione le
       * lasciava fuori, cosi' chi disegna la pagina Stanze poteva vedere solo
       * la prima coppia per quante ne fossero configurate: la pagina non aveva
       * modo di sapere che le altre esistevano. Il nome della prima sta in
       * `temp_name`, e senza di lui tre righe uguali non si distinguono. */
      temp_name: clean(room.temp_name),
      metadata: {
        temperature_entries: array(room?.metadata?.temperature_entries),
      },
      rgb: clean(room.rgb),
      order: Number.isFinite(+room.order) ? +room.order : index,
    }))
    .filter((room) => room.name)
    .sort((a, b) => a.order - b.order);

  const sorgenti = {
    climate: array(input.climate),
    lights: lightItems(input.lights, input.lightRooms),
    prese: array(input.prese),
    covers: array(input.covers),
    appliances: array(input.appliances),
    media: array(input.media),
    cameras: array(input.cameras),
    loads: loadItems(input.loads),
    robots: array(input.robots),
    irrigation: irrigationZones(input.irrigation),
    assigned: array(input.assigned),
  };

  /* I nomi che in questa casa ne identificano piu' di una: si contano una
   * volta sola, non per ogni voce di ogni blocco. */
  const ripetuti = nomiRipetuti(stanze);
  const assegnate = new Set();
  const entitaGiaViste = new Set();
  /* Una cosa sola compare una volta sola (#426).
   *
   * «Dopo l'aggiornamento che ha identificato i vari speaker nelle stanze,
   *  questi vengono duplicati: se si clicca quello sotto la sezione musica si
   *  va nella sezione corretta, se si seleziona quello sotto la voce altro in
   *  questa stanza si torna alla home della dashboard.»
   *
   * Lo stesso lettore arrivava da due parti: dalla sua scheda, che la stanza
   * la chiede da quando c'e' il blocco Musica, e dall'assegnazione a mano, che
   * era il modo di metterlo in stanza PRIMA che quel blocco esistesse. Due
   * oggetti diversi, la stessa entita': il confronto guardava l'oggetto, e
   * l'oggetto era diverso, quindi passavano tutti e due.
   *
   * Chi ha la stanza per mestiere viene prima — sa dove portare col tocco —
   * e l'assegnazione a mano, che a quel punto ripete, resta indietro. Vale
   * anche fra stanze diverse: la stessa entita' in due stanze non e' una
   * comodita', e' una bugia detta due volte. */
  const nuova = (item) => {
    if (assegnate.has(item)) return false;
    const entita = entityOf(item);
    if (entita && entitaGiaViste.has(entita)) return false;
    return true;
  };
  const segna = (item) => {
    assegnate.add(item);
    const entita = entityOf(item);
    if (entita) entitaGiaViste.add(entita);
  };
  const pagine = stanze.map((room) => {
    const blocchi = ROOM_BLOCKS.map((blocco) => {
      const voci = sorgenti[blocco.section].filter((item) => {
        if (!nuova(item)) return false;
        if (!belongsToRoom(item, room, ripetuti)) return false;
        segna(item);
        return true;
      });
      return { ...blocco, voci };
    });
    return {
      ...room,
      senzaStanza: false,
      blocchi,
      /* Il conteggio sulla pillola: quante cose ci sono, non quanti blocchi.
       * I sensori della stanza — temperatura e umidita' — non si contano: sono
       * la stanza, non una cosa dentro la stanza. */
      count: blocchi.reduce((totale, blocco) => totale + blocco.voci.length, 0),
    };
  });

  /* Cio' che una stanza non ce l'ha, ce l'ha ma punta a una stanza che non
   * esiste piu', oppure la nomina con un nome che due stanze si dividono. Non
   * e' un errore da nascondere: e' la sola occasione di accorgersene. */
  const orfane = ROOM_BLOCKS.map((blocco) => ({
    ...blocco,
    voci: sorgenti[blocco.section].filter((item) => {
      if (!nuova(item)) return false;
      segna(item);
      return true;
    }),
  }));
  const quanteOrfane = orfane.reduce((totale, blocco) => totale + blocco.voci.length, 0);
  if (quanteOrfane)
    pagine.push({
      id: "dm-senza-stanza",
      name: "",
      icon: "📦",
      floor: "",
      temp: "",
      hum: "",
      temp_name: "",
      metadata: { temperature_entries: [] },
      rgb: "",
      order: pagine.length,
      senzaStanza: true,
      blocchi: orfane,
      count: quanteOrfane,
    });

  return pagine;
}

/** La pagina scelta, o la prima che c'e'. */
export function pickRoomPage(pagine = [], scelta = "") {
  const chiave = clean(scelta);
  return pagine.find((pagina) => pagina.id === chiave) || pagine[0] || null;
}

/* Le entita' che una scena di stanza puo' accendere e spegnere.
 *
 * «Accendi tutto» in una stanza vuol dire la luce. Non il condizionatore, non
 * la tapparella: quelli hanno un verso loro — freddo o caldo, su o giu' — e
 * decidere al posto di chi guarda quale sia «acceso» sarebbe inventare. Le
 * prese comandate stanno dentro perche' sulla plancia sono luci a tutti gli
 * effetti: la sezione Luci accetta `switch.*` da sempre.
 */
export function roomSceneEntities(pagina = null) {
  const luci = pagina?.blocchi?.find((blocco) => blocco.key === "luci")?.voci || [];
  return luci
    .map((luce) => clean(luce.entity || luce.id))
    .filter((entity) => /^(light|switch)\./i.test(entity));
}

/** Quante ne sono accese, su quante ce ne sono. */
export function roomSceneSummary(pagina = null, states = {}) {
  const entita = roomSceneEntities(pagina);
  const accese = entita.filter((entity) => lower(states?.[entity]?.state) === "on").length;
  return { totale: entita.length, accese };
}
