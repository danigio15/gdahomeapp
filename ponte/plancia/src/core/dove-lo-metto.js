/* Dove va a finire un dispositivo appena entrato in casa (#54, passo 4).
 *
 * «Vorrei poter abbinare un dispositivo zigbee direttamente dall'app.»
 *
 * Abbinarlo e' meta' del lavoro: dopo, quel dispositivo e' in Home Assistant e
 * nella plancia non c'e'. Il passo che manca — metterlo in una sezione — non
 * lo puo' fare l'app, e la ragione e' precisa: le sezioni della plancia non
 * hanno tutte la stessa forma. Le luci sono una mappa entita' → nome con le
 * stanze in una mappa a parte; le prese sono un elenco di righe con la stanza
 * addosso; il clima e' un elenco con dentro anche di che tipo e'. Scrivere
 * quelle tre forme dall'app vorrebbe dire scriverle due volte, e il giorno che
 * una cambia ne cambierebbe una sola.
 *
 * Quindi a scrivere e' la plancia, con le sue regole. Qui c'e' la meta' che
 * decide — in che sezione va, e cosa ci finira' scritto — e si prova senza un
 * documento e senza un deposito. Il giro lo fa la sezione.
 *
 * ── «Te la propongo io» ──────────────────────────────────────────────────
 *
 * La proposta si fa dal dominio dell'entita' e dalla sua classe, che sono le
 * due cose che Home Assistant dice sempre. Una lampadina e' una lampadina: non
 * c'e' niente da indovinare, e chiedere a chi guarda «in che sezione la metto»
 * quando la risposta e' ovvia e' farsi ripetere quello che si sa gia'.
 *
 * Dove non e' ovvio — un sensore qualsiasi, un interruttore che non dice cosa
 * comanda — non si propone niente. Una proposta sbagliata costa piu' di una
 * proposta mancante: chi la accetta di fretta si ritrova il termometro fra le
 * prese, e per accorgersene deve passare dall'editor.
 */

import { nomeDellaSezione } from "./lelenco-delle-sezioni.js";

const pulito = (valore) => String(valore ?? "").trim();

/** Il dominio di un'entita': quello che sta prima del punto. */
export function dominioDi(entita) {
  const testo = pulito(entita);
  const punto = testo.indexOf(".");
  return punto > 0 ? testo.slice(0, punto).toLowerCase() : "";
}

/**
 * Le sezioni in cui un dispositivo nuovo puo' finire.
 *
 * `chiavi` sono i cassetti che la sezione tocca scrivendo una voce: servono a
 * chi disegna per dire cosa sta per succedere, e a chi scrive per sapere cosa
 * rileggere. `icona` e' quella che finira' addosso alla voce dove la sezione
 * ne vuole una.
 *
 * Il NOME invece non si scrive qui dove una scheda del Config ce l'ha gia':
 * si chiede a `nomeDellaSezione`, che e' dove quella parola sta. La scheda
 * delle tapparelle si chiama «Finestre» e quella dei contatti si chiama
 * «Varchi»: un foglietto che dicesse «Tapparelle» e «Porte e finestre»
 * manderebbe a cercare nel Config due schede che non esistono. Le due che una
 * scheda non ce l'hanno — le prese, che stanno dentro la Home, e le entita'
 * proprie — il nome se lo portano, in tutte e due le lingue: qui non si sa
 * che lingua si parla, e a scegliere e' chi disegna.
 */
const comeSiChiama = (chiave, it = "", en = "") => nomeDellaSezione(chiave) ?? { it, en };

export const LE_SEZIONI = Object.freeze([
  Object.freeze({
    chiave: "luci",
    ...comeSiChiama("luci"),
    icona: "💡",
    chiavi: ["cd_luci", "cd_luci_rooms"],
  }),
  /* Le prese non hanno una scheda nell'elenco delle sezioni: si vedono dentro
   * la Home, e il loro nome sta qui. */
  Object.freeze({
    chiave: "prese",
    ...comeSiChiama("prese", "Prese", "Sockets"),
    icona: "🔌",
    chiavi: ["cd_prese"],
  }),
  Object.freeze({
    chiave: "clima",
    ...comeSiChiama("clima"),
    icona: "❄️",
    chiavi: ["cd_clima_units"],
  }),
  Object.freeze({
    chiave: "tapparelle",
    ...comeSiChiama("tapparelle"),
    icona: "🪟",
    chiavi: ["cd_tapparelle"],
  }),
  /* Porte, finestre e serrature: una sola sezione, perche' la domanda che si
   * fa guardandole e' una sola — «e' aperto?». */
  Object.freeze({
    chiave: "varchi",
    ...comeSiChiama("varchi"),
    icona: "🚪",
    chiavi: ["cd_varchi"],
  }),
  /* I rilevatori di movimento e di occupazione: quelli che dicono se una
   * stanza e' occupata. */
  Object.freeze({
    chiave: "presenza",
    ...comeSiChiama("presenza"),
    icona: "🚶",
    chiavi: ["cd_presenza"],
  }),
  /* Le sonde di temperatura e di umidita' non vanno in un elenco: vanno
   * ADDOSSO a una stanza, che e' la quinta forma e la piu' diversa di tutte.
   * Senza una stanza scelta non c'e' dove metterle. */
  Object.freeze({
    chiave: "temp",
    ...comeSiChiama("temp"),
    icona: "🌡️",
    chiavi: ["cd_stanze"],
    vuoleLaStanza: true,
  }),
  /* «Una tua»: la sezione che accoglie quello che non ha una sezione sua. Non
   * e' un ripiego triste — e' dove uno mette le cose che vuole a portata di
   * mano — e infatti la si sceglie anche quando una proposta c'era.
   *
   * Non e' la scheda «Le tue sezioni», che e' un'altra cosa: quelle sono
   * pagine intere che uno si fabbrica, queste sono entita' appoggiate a una
   * pagina che c'e' gia'. E per quello la chiave qui e' `entita_mie` e non
   * `mie`: `mie` nell'elenco delle sezioni e' gia' presa, dall'altra —
   * chiedere il nome con quella avrebbe risposto «Le tue sezioni», che e'
   * sbagliato e non si vedeva. */
  Object.freeze({
    chiave: "entita_mie",
    it: "Le tue entità",
    en: "Your entities",
    icona: "⭐",
    chiavi: ["cd_entita_mie"],
  }),
]);

export const sezione = (chiave) =>
  LE_SEZIONI.find((voce) => voce.chiave === pulito(chiave)) || null;

/** Se quella sezione senza una stanza non sa dove mettere niente. */
export const vuoleLaStanza = (chiave) => Boolean(sezione(chiave)?.vuoleLaStanza);

/* ── quale entita' decide, quando ne arrivano sei ────────────────────────
 *
 * Su una rete Zigbee non entra un'entita': entra un DISPOSITIVO, e un
 * dispositivo ne porta dentro cinque o sei. Una presa smart pubblica
 * l'interruttore, la potenza, l'energia, la tensione e il segnale; un sensore
 * di presenza pubblica l'occupazione, la luce ambiente e la batteria.
 *
 * Solo una di quelle dice cos'e' quell'oggetto. Le altre sono numeri che
 * quell'oggetto racconta di se', e metterle in una sezione vorrebbe dire una
 * plancia con dentro sei voci per una presa — che e' peggio di nessuna voce,
 * perche' bisogna anche toglierle.
 */

/* Quello che un dispositivo dice di SE STESSO: batteria, segnale, tensione.
 * Non e' quello che fa, e non sceglie mai dove va il dispositivo. */
const RACCONTA_DI_SE = new Set([
  "battery",
  "signal_strength",
  "voltage",
  "current",
  "power_factor",
  "timestamp",
  "duration",
  "atmospheric_pressure",
]);

/* E i domini che Home Assistant crea per governare un dispositivo, non per
 * farne qualcosa: l'aggiornamento del firmware, il tasto «identificati», le
 * manopole di configurazione. */
const SERVE_A_GOVERNARLO = new Set(["update", "button", "event", "number", "select", "text"]);

/* Chi decide, in ordine: piu' e' su, piu' quella entita' dice cos'e'
 * l'oggetto. Una lampadina con un sensore di potenza resta una lampadina. */
const CHI_DECIDE = [
  "light",
  "climate",
  "cover",
  "lock",
  "vacuum",
  "fan",
  "switch",
  "binary_sensor",
  "sensor",
];

const classeDi = (voce) =>
  pulito(voce?.device_class ?? voce?.classe ?? voce?.attributes?.device_class).toLowerCase();

/** Se questa entita' puo' dire cos'e' il dispositivo, o racconta solo di se'. */
export function puoDecidere(voce = {}) {
  const dominio = dominioDi(voce.entity ?? voce.entita ?? voce);
  if (!dominio || SERVE_A_GOVERNARLO.has(dominio)) return false;
  /* Quello che Home Assistant stesso marca come diagnostica o configurazione:
   * l'ha gia' deciso lui, e non c'e' niente da indovinare. */
  const categoria = pulito(voce.entity_category ?? voce.categoria).toLowerCase();
  if (categoria === "diagnostic" || categoria === "config") return false;
  return !RACCONTA_DI_SE.has(classeDi(voce));
}

/**
 * Fra le entita' di un dispositivo, quella che dice cos'e'.
 *
 * Non la prima: la piu' alta in `CHI_DECIDE`. Una presa smart pubblica
 * l'interruttore e tre numeri, e l'ordine in cui arrivano non e' garantito —
 * prendere la prima vorrebbe dire che la stessa presa finisce fra le prese in
 * una casa e fra i sensori in un'altra.
 */
export function entitaPrincipale(entita = []) {
  const voci = (Array.isArray(entita) ? entita : [entita])
    .map((voce) => (typeof voce === "string" ? { entity: voce } : voce || {}))
    .filter((voce) => pulito(voce.entity ?? voce.entita));
  const candidate = voci.filter(puoDecidere);
  const scala = (voce) => {
    const posto = CHI_DECIDE.indexOf(dominioDi(voce.entity ?? voce.entita));
    return posto < 0 ? CHI_DECIDE.length : posto;
  };
  const scelta = candidate.slice().sort((una, altra) => scala(una) - scala(altra))[0];
  /* Un dispositivo fatto di sola diagnostica non ha un'entita' che decide, e
   * non e' un caso strano: un ripetitore Zigbee e' esattamente questo. Torna
   * la prima che c'e', cosi' chi disegna ha qualcosa da scrivere, e la
   * proposta restera' vuota — che e' la risposta giusta. */
  return scelta || voci[0] || null;
}

/* Le classi che dicono «questo e' una copertura»: una tapparella non e' una
 * tenda da sole, ma nella plancia stanno nella stessa sezione. */
const TAPPARELLE = new Set(["shutter", "blind", "curtain", "awning", "shade", "window"]);

/* «Questo e' una presa». */
const PRESE = new Set(["outlet", "socket"]);

/* «Questo e' un varco»: si apre e si chiude, e la domanda e' sempre la stessa. */
const VARCHI = new Set(["door", "window", "garage_door", "opening", "garage"]);

/* «Questo dice se c'e' qualcuno». */
const PRESENZA = new Set(["motion", "occupancy", "presence"]);

/* E le due letture che vanno addosso a una stanza invece che in un elenco. */
const DELLA_STANZA = new Set(["temperature", "humidity"]);

/**
 * In che sezione va, e perche'.
 *
 * Entra un dispositivo — con dentro le sue entita' — oppure una entita' sola.
 * Da una rete Zigbee arriva sempre la prima forma: sotto, la regola e' la
 * stessa, perche' a decidere e' comunque una entita' sola (vedi
 * `entitaPrincipale`).
 *
 * `null` vuol dire «non lo so», ed e' una risposta buona: chi guarda sceglie
 * da solo fra le sezioni, che e' meglio di una proposta tirata a indovinare.
 *
 * Il «perche'» non e' un ornamento. E' la frase che compare accanto alla
 * proposta — «e' una lampadina» — e serve a far dire «ah, ecco» invece di far
 * accettare al buio. Le parole non stanno qui: il nucleo non sa che lingua si
 * parla, e chi disegna le mette guardando `perche`.
 */
export function laSezioneGiusta(voce = {}) {
  /* Un elenco VUOTO non e' un dispositivo: e' un'entita' sola arrivata da chi
   * quell'elenco lo tiene sempre, anche quando non ha niente da metterci.
   * Prendendo comunque la strada del dispositivo si cercava chi decide dentro
   * il nulla, e non si proponeva mai niente — per tutto tranne i dispositivi
   * veri, che e' il caso che si prova meno. */
  const suoi = voce?.entities ?? voce?.entita;
  const quale = Array.isArray(suoi) && suoi.length ? entitaPrincipale(suoi) : voce;
  if (!quale) return null;
  const dominio = dominioDi(quale.entity ?? quale.entita ?? quale);
  const classe = classeDi(quale);

  if (dominio === "light")
    return { chiave: "luci", perche: "lampadina", entity: pulito(quale.entity) };
  if (dominio === "climate")
    return { chiave: "clima", perche: "clima", entity: pulito(quale.entity) };
  if (dominio === "cover")
    return {
      chiave: "tapparelle",
      perche: TAPPARELLE.has(classe) ? classe : "copertura",
      entity: pulito(quale.entity),
    };
  if (dominio === "lock")
    return { chiave: "varchi", perche: "serratura", entity: pulito(quale.entity) };
  if (dominio === "switch" && PRESE.has(classe))
    return { chiave: "prese", perche: "presa", entity: pulito(quale.entity) };
  if (dominio === "binary_sensor" && VARCHI.has(classe))
    return { chiave: "varchi", perche: classe, entity: pulito(quale.entity) };
  if (dominio === "binary_sensor" && PRESENZA.has(classe))
    return { chiave: "presenza", perche: classe, entity: pulito(quale.entity) };
  if (dominio === "sensor" && DELLA_STANZA.has(classe))
    return { chiave: "temp", perche: classe, entity: pulito(quale.entity) };
  /* Un `switch` che non dice cosa comanda puo' essere una presa, il relay di
   * una caldaia o l'abilitazione di un'automazione: proporre «prese» sarebbe
   * indovinare, e chi accetta di fretta si ritrova il relay della caldaia fra
   * le prese di casa. Lo stesso per un sensore che misura qualcosa che non ha
   * un posto suo — la qualita' dell'aria, la luce ambiente. */
  return null;
}

/**
 * Quante altre entita' porta dentro quel dispositivo, e quante contano.
 *
 * Serve a dirlo a chi guarda: una presa smart entra in casa con cinque
 * entita', e metterne una in una sezione non vuol dire che le altre quattro
 * siano sparite. Chi lo sa non va a cercarle credendo di averle perse.
 */
export function cosaAltroPorta(voce = {}, principale = "") {
  const tutte = Array.isArray(voce?.entities ?? voce?.entita) ? (voce.entities ?? voce.entita) : [];
  const scelta = pulito(principale);
  const voci = tutte
    .map((una) => (typeof una === "string" ? { entity: una } : una || {}))
    .filter((una) => pulito(una.entity) && pulito(una.entity) !== scelta);
  return {
    quante: voci.length,
    /* Quelle che potrebbero avere un posto loro: la temperatura di un sensore
     * di presenza, la potenza di una presa. Il resto e' batteria e segnale. */
    daMettere: voci
      .filter((una) => puoDecidere(una) && laSezioneGiusta(una))
      .map((una) => pulito(una.entity)),
  };
}

/**
 * Cosa ci finira' scritto, sezione per sezione.
 *
 * E' il riquadro «riempio io cosi'» del passo 4: prima di toccare la
 * configurazione si fa vedere cosa si sta per scrivere. Non e' una gentilezza
 * — e' l'unico momento in cui chi guarda puo' accorgersi che il nome e'
 * sbagliato o che la stanza non e' quella, e correggerlo costa un tocco
 * adesso e un giro nell'editor dopo.
 *
 * Esce un elenco di coppie e non un oggetto: l'ordine in cui si leggono e'
 * parte di quello che si sta dicendo, e un oggetto non lo garantisce.
 */
export function comeLoScrivo(quale, voce = {}) {
  const suo = sezione(quale);
  if (!suo) return [];
  const entita = pulito(voce.entity);
  const nome = pulito(voce.nome || voce.name) || entita;
  const stanza = pulito(voce.stanza);
  const righe = [
    { campo: "entity", valore: entita },
    { campo: "nome", valore: nome },
  ];
  /* La stanza la vogliono quasi tutte. Non il clima, che la sua unita' la
   * chiama gia' col nome della stanza. Una riga vuota non si scrive: dice
   * «non c'e' niente qui», che e' rumore. */
  if (suo.chiave !== "clima" && stanza) righe.push({ campo: "stanza", valore: stanza });
  /* L'icona la tengono le prese e le voci proprie: le altre la prendono dal
   * loro disegno, e scriverla li' non servirebbe a nessuno. */
  if (suo.chiave === "prese" || suo.chiave === "entita_mie")
    righe.push({ campo: "icona", valore: pulito(voce.icona) || suo.icona });
  return righe;
}

/**
 * La voce da scrivere, nella forma che quella sezione vuole.
 *
 * Tre forme diverse per tre sezioni diverse, ed e' proprio il motivo per cui
 * questo passo vive nella plancia. Escono i cassetti da riscrivere gia'
 * pieni: chi chiama li salva e basta, e qui non si tocca niente.
 *
 * `dentro` e' quello che c'e' adesso nei cassetti di quella sezione. Una voce
 * che c'e' gia' non si aggiunge una seconda volta — un dispositivo riabbinato
 * tiene la sua entita' — e si aggiorna invece, perche' chi rifa' il giro sta
 * correggendo qualcosa, non creando un doppione.
 */
export function laVoceDaScrivere(quale, voce = {}, dentro = {}) {
  const suo = sezione(quale);
  const entita = pulito(voce.entity);
  if (!suo || !entita) return null;
  const nome = pulito(voce.nome || voce.name) || entita;
  const stanza = pulito(voce.stanza_id || voce.room_id);

  if (suo.chiave === "luci") {
    const luci = { ...(dentro.cd_luci || {}) };
    luci[entita] = nome;
    const fuori = { cd_luci: luci };
    /* La stanza di una luce non sta sulla luce: sta in una mappa a parte, ed
     * e' l'unica sezione fatta cosi'. Senza stanza non si scrive la riga —
     * una mappa con dentro una stringa vuota e' una stanza chiamata «». */
    if (stanza) fuori.cd_luci_rooms = { ...(dentro.cd_luci_rooms || {}), [entita]: stanza };
    return fuori;
  }

  if (suo.chiave === "prese") {
    const prese = Array.isArray(dentro.cd_prese) ? [...dentro.cd_prese] : [];
    const nuova = {
      entity: entita,
      name: nome,
      icon: pulito(voce.icona) || suo.icona,
      room_id: stanza,
    };
    const dove = prese.findIndex((riga) => pulito(riga?.entity) === entita);
    if (dove >= 0) prese[dove] = { ...prese[dove], ...nuova };
    else prese.push(nuova);
    return { cd_prese: prese };
  }

  if (suo.chiave === "clima") {
    const unita = Array.isArray(dentro.cd_clima_units) ? [...dentro.cd_clima_units] : [];
    const nuova = { name: nome, entity: entita, type: "clima" };
    const dove = unita.findIndex((riga) => pulito(riga?.entity) === entita);
    if (dove >= 0) unita[dove] = { ...unita[dove], ...nuova };
    else unita.push(nuova);
    return { cd_clima_units: unita };
  }

  if (suo.chiave === "tapparelle") {
    const tapparelle = Array.isArray(dentro.cd_tapparelle) ? [...dentro.cd_tapparelle] : [];
    const nuova = { entity: entita, name: nome, room_id: stanza };
    const dove = tapparelle.findIndex((riga) => pulito(riga?.entity) === entita);
    if (dove >= 0) tapparelle[dove] = { ...tapparelle[dove], ...nuova };
    else tapparelle.push(nuova);
    return { cd_tapparelle: tapparelle };
  }

  /* Porte, finestre e serrature, e i rilevatori di presenza: due cassetti
   * fatti allo stesso modo, e sono la QUARTA forma. Non un elenco di righe:
   * un foglietto di correzioni — «questa e' un varco anche se Home Assistant
   * non lo dice», «questa no» — piu' i nomi che uno gli ha dato. Aggiungere
   * vuol dire scrivere nella colonna «aggiunte» e togliere da «escluse», che
   * e' il modo di cambiare idea su qualcosa che si era scartato. */
  if (suo.chiave === "varchi" || suo.chiave === "presenza") {
    const cassetto = suo.chiavi[0];
    const dato = dentro[cassetto] && typeof dentro[cassetto] === "object" ? dentro[cassetto] : {};
    const dentroGia = Array.isArray(dato.aggiunte) ? dato.aggiunte : [];
    const escluse = (Array.isArray(dato.escluse) ? dato.escluse : []).filter(
      (una) => pulito(una) !== entita,
    );
    const aggiunte = dentroGia.some((una) => pulito(una) === entita)
      ? [...dentroGia]
      : [...dentroGia, entita];
    return {
      [cassetto]: {
        ...dato,
        escluse,
        aggiunte,
        nomi: { ...(dato.nomi && typeof dato.nomi === "object" ? dato.nomi : {}), [entita]: nome },
      },
    };
  }

  /* La temperatura e l'umidita' sono la QUINTA forma, e la piu' diversa: non
   * vanno in un elenco, vanno ADDOSSO a una stanza. Senza una stanza scelta
   * non c'e' dove metterle, e chi chiama se lo sente dire invece di scrivere
   * a vuoto.
   *
   * La prima sonda di una stanza va nelle caselle di sempre (`temp`, `hum`),
   * che sono quelle che leggono tutti; dalla seconda in poi va nell'elenco
   * delle sonde in piu', che la stanza ha da quando una stanza puo' avere il
   * comodino e il termostato a muro. */
  if (suo.chiave === "temp") {
    if (!stanza) return null;
    const stanze = Array.isArray(dentro.cd_stanze) ? [...dentro.cd_stanze] : [];
    const dove = stanze.findIndex((una) => pulito(una?.id) === stanza);
    if (dove < 0) return null;
    const sua = { ...stanze[dove] };
    const umidita = pulito(voce.classe || voce.device_class).toLowerCase() === "humidity";
    const casella = umidita ? "hum" : "temp";
    if (!pulito(sua[casella])) {
      sua[casella] = entita;
      if (!umidita && !pulito(sua.temp_name)) sua.temp_name = nome;
    } else {
      const extra = Array.isArray(sua.metadata?.temperature_entries)
        ? [...sua.metadata.temperature_entries]
        : [];
      const gia = extra.findIndex(
        (una) => pulito(una?.temp) === entita || pulito(una?.hum) === entita,
      );
      const riga = { id: `temperature-extra-${extra.length + 1}`, name: nome, [casella]: entita };
      if (gia >= 0) extra[gia] = { ...extra[gia], ...riga };
      else extra.push(riga);
      sua.metadata = { ...(sua.metadata || {}), temperature_entries: extra };
    }
    stanze[dove] = sua;
    return { cd_stanze: stanze };
  }

  const mie = Array.isArray(dentro.cd_entita_mie) ? [...dentro.cd_entita_mie] : [];
  const nuova = {
    entity: entita,
    nome,
    icona: pulito(voce.icona) || suo.icona,
    /* In quale pagina compare. Senza, la voce esiste e non si vede da nessuna
     * parte: «home» e' la pagina che tutti guardano, ed e' dove uno si
     * aspetta di trovare quello che ha appena aggiunto. */
    sezione: pulito(voce.dove) || "home",
    room_id: stanza,
  };
  const dove = mie.findIndex((riga) => pulito(riga?.entity) === entita);
  if (dove >= 0) mie[dove] = { ...mie[dove], ...nuova };
  else mie.push(nuova);
  return { cd_entita_mie: mie };
}
