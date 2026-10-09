/* Cosa sta suonando in casa (#269).
 *
 * «Sarebbe carino una sezione dedicata ai dispositivi Media Player… sarebbe
 * figo se lo sfondo fosse l'anteprima di ciò che viene riprodotto (la
 * copertina del disco).»
 *
 * Un lettore multimediale è l'unica cosa della casa che ha una faccia sua: il
 * disco che sta girando. Tutto il resto — la temperatura, i watt, una porta
 * aperta — sono numeri e parole, e la plancia li disegna; qui invece
 * l'immagine c'è già, la manda Home Assistant, ed è quella che dice cosa sta
 * succedendo meglio di qualunque scritta.
 *
 * Questo modulo è puro: entrano le voci configurate e gli stati, escono le
 * letture. In particolare esce che cosa quel lettore SA fare — Home Assistant
 * lo dice in un numero, `supported_features`, e da lì si decide quali tasti
 * disegnare. Un tasto «brano precedente» su una radio non è un dettaglio
 * grafico: è un tasto che non fa niente, e chi lo preme pensa sia rotto.
 */

import { comandiDelDispositivo, elencoComandi } from "./comandi-accanto.js";
import { elencoLetture, lettureDelDispositivo, lettureRiconosciute } from "./letture-accanto.js";
import { eUnTelecomando, telecomandoDelLettore } from "./telecomando.js";

const pulito = (valore) => String(valore ?? "").trim();

export const CHIAVE_MEDIA = "cd_media_player";

/* Quello che Home Assistant impacchetta dentro `supported_features`.
 *
 * Sono i valori di `MediaPlayerEntityFeature`, e non cambiano: sono parte del
 * protocollo, non una convenzione di questa plancia. Qui ci sono solo quelli
 * che si guardano — gli altri esistono e non servono a chi disegna dei tasti. */
export const SA = Object.freeze({
  PAUSA: 1,
  CERCA: 2,
  VOLUME: 4,
  MUTO: 8,
  PRECEDENTE: 16,
  SUCCESSIVO: 32,
  ACCENDI: 128,
  SPEGNI: 256,
  PASSI_VOLUME: 1024,
  SORGENTE: 2048,
  FERMA: 4096,
  SUONA: 16384,
  /* Sfogliare quello che c'e' da ascoltare, e metterlo in coda.
   *
   * «Con Sonos e Music Assistant, dalla plancia non si riesce a scegliere
   * cosa suonare.» Non si riusciva perche' non c'era: la scheda muoveva il
   * volume, la sorgente e la pausa di qualcosa che qualcun altro aveva fatto
   * partire. Chi accende la musica lo fa da un'altra app, e poi torna qui per
   * abbassarla.
   *
   * Sono le ultime due bandiere di `MediaPlayerEntityFeature` che servono a
   * dei tasti: `BROWSE_MEDIA` dice che quel lettore sa elencare cosa ha da
   * offrire, `MEDIA_ENQUEUE` che sa mettere in coda invece di interrompere. */
  SFOGLIA: 131072,
  ACCODA: 2097152,
});

const STATI_VIVI = new Set(["playing", "paused", "buffering", "idle", "on", "standby"]);

/* Cosa dice lo stato di un lettore, nelle tre parole della card di un
 * elettrodomestico: in funzione, standby, spento.
 *
 * «La TV e' accesa e risulta dall'integrazione, ma risulta spenta nella
 * scheda» (#354). La scheda di un televisore legge lo stato come quello di
 * una lavatrice — una parola di un sensore, un interruttore — e un
 * `media_player` non e' ne' l'uno ne' l'altro: il suo stato dice gia' tutto,
 * nella lingua dei lettori. `on`, `playing`, `paused`, `idle` e `buffering`
 * sono un televisore acceso, qualunque cosa stia facendo; `standby` e' acceso
 * ma a riposo, che e' quello che la parola vuol dire; `off` e' spento. Quello
 * che non risponde — `unknown`, `unavailable`, niente — non dice niente, e lo
 * si lascia dire a chi guarda anche i watt. */
export function modoDelLettore(stato) {
  const grezzo = pulito(stato).toLowerCase();
  if (!grezzo || grezzo === "unknown" || grezzo === "unavailable") return "";
  if (grezzo === "off") return "off";
  if (grezzo === "standby") return "standby";
  return STATI_VIVI.has(grezzo) ? "running" : "";
}

/** Una voce configurata, ripulita. Senza entità non è una voce. */
export function normalizzaLettore(stored, indice = 0) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  return {
    id: pulito(dato.id) || `lettore-${indice + 1}`,
    entity: pulito(dato.entity),
    nome: pulito(dato.nome || dato.name),
    icona: pulito(dato.icona || dato.icon),
    room_id: pulito(dato.room_id || dato.room),
    /* Quello che l'integrazione pubblica accanto al lettore (#451).
     *
     * «Le TV dove vanno messe?» — nella scheda dei lettori, perché per Home
     * Assistant una TV è un `media_player` come uno speaker. Quello che la
     * scheda non copriva è il resto che un'integrazione come SmartThings porta
     * con sé: l'interruttore dell'alimentazione, il canale, la sorgente, il
     * volume, il consumo. Sono entità a parte, e sono le stesse due liste che
     * hanno il robot e gli elettrodomestici. */
    comandi: elencoComandi(dato.comandi ?? dato.commands),
    letture: elencoLetture(dato.letture ?? dato.readings),
    /* Il telecomando della TV (#132): il `remote.*` che riceve le frecce.
     * Può mancare — LG webOS le prende dal lettore, e il telecomando che porta
     * il nome della TV si trova da solo. */
    telecomando: eUnTelecomando(dato.telecomando) ? pulito(dato.telecomando) : "",
  };
}

/** I lettori configurati, nell'ordine in cui sono stati messi. */
export function lettoriConfigurati(stored) {
  const righe = Array.isArray(stored) ? stored : [];
  return righe.map((riga, i) => normalizzaLettore(riga, i)).filter((riga) => riga.entity);
}

/** Le entità da tenere d'occhio: serve a chi decide se ridisegnare. */
export function entitaDeiLettori(stored) {
  const viste = new Set();
  for (const riga of lettoriConfigurati(stored)) {
    viste.add(riga.entity);
    /* Anche quelle accanto (#451): se il canale cambia e nessuno le guarda, la
     * scheda resta ferma su quello di prima. */
    for (const voce of [...riga.comandi, ...riga.letture]) viste.add(voce);
  }
  return [...viste];
}

const numero = (valore) => {
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

/** Un istante ISO in millisecondi, o null se non è un istante. */
export function istante(valore) {
  const testo = pulito(valore);
  if (!testo) return null;
  const quando = Date.parse(testo);
  return Number.isFinite(quando) ? quando : null;
}

/**
 * Cosa dice un lettore adesso.
 *
 * `muto` vuol dire che Home Assistant non lo conosce o non risponde — una cosa
 * diversa da «spento», che invece è una risposta.
 *
 * `piattaforme` dice di che integrazione è ogni entità, ed è quello che serve
 * al telecomando (#132): senza, la TV ha i suoi tasti e le frecce no.
 */
export function letturaDelLettore(
  voce,
  states = {},
  resolve = (valore) => valore,
  piattaforme = {},
) {
  const risolvi = (valore) => {
    const grezza = pulito(valore);
    try {
      return pulito(resolve(grezza)) || grezza;
    } catch (_error) {
      return grezza;
    }
  };
  const entity = pulito(voce?.entity);
  const risolta = risolvi(entity);
  const stato = states?.[risolta] || states?.[entity] || null;
  const grezzo = pulito(stato?.state).toLowerCase();
  const attributi = stato?.attributes || {};
  const muto = !stato || grezzo === "" || grezzo === "unavailable" || grezzo === "unknown";
  const bandiere = Number(attributi.supported_features) || 0;
  const sa = (bandiera) => Boolean(bandiere & bandiera);
  const volume = numero(attributi.volume_level);
  return {
    id: voce?.id || entity,
    entity: risolta || entity,
    nome: pulito(voce?.nome) || pulito(attributi.friendly_name) || entity,
    icona: pulito(voce?.icona),
    room_id: pulito(voce?.room_id),
    muto,
    stato: grezzo,
    acceso: !muto && STATI_VIVI.has(grezzo),
    suona: grezzo === "playing" || grezzo === "buffering",
    inPausa: grezzo === "paused",
    fermo: grezzo === "idle" || grezzo === "on" || grezzo === "standby",
    spento: grezzo === "off",
    titolo: pulito(attributi.media_title),
    artista: pulito(attributi.media_artist || attributi.media_album_artist),
    album: pulito(attributi.media_album_name || attributi.media_series_title),
    applicazione: pulito(attributi.app_name),
    copertina: pulito(attributi.entity_picture),
    volume: volume === null ? null : Math.min(1, Math.max(0, volume)),
    mutato: attributi.is_volume_muted === true,
    sorgente: pulito(attributi.source),
    sorgenti: (Array.isArray(attributi.source_list) ? attributi.source_list : [])
      .map(pulito)
      .filter(Boolean),
    durata: numero(attributi.media_duration),
    posizione: numero(attributi.media_position),
    posizioneAggiornata: istante(attributi.media_position_updated_at),
    puo: {
      pausa: sa(SA.PAUSA) || sa(SA.SUONA),
      precedente: sa(SA.PRECEDENTE),
      successivo: sa(SA.SUCCESSIVO),
      volume: sa(SA.VOLUME),
      passiVolume: sa(SA.PASSI_VOLUME),
      muto: sa(SA.MUTO),
      sorgente: sa(SA.SORGENTE),
      accendi: sa(SA.ACCENDI),
      spegni: sa(SA.SPEGNI),
      /* Sfogliare e far partire. Sono due bandiere e vanno insieme:
       * un lettore che sa elencare la sua libreria ma non sa ricevere un
       * brano apre una finestra da cui non si esce con niente, e un elenco
       * che non si puo' toccare e' la stessa cosa di un tasto rotto. */
      suona: sa(SA.SUONA),
      sfoglia: sa(SA.SFOGLIA) && sa(SA.SUONA),
      /* La coda la sa solo chi ce l'ha: su un Chromecast «accoda» sostituisce
       * quello che sta suonando, e chi lo premeva perdeva il brano. */
      accoda: sa(SA.ACCODA) && sa(SA.SUONA),
    },
    /* Quello che sta accanto (#451): l'interruttore dell'alimentazione, la
     * tendina della sorgente di SmartThings, il canale, il volume, il
     * consumo. Entità a parte, scelte da chi configura. */
    comandi: comandiDelDispositivo(voce, states),
    letture: lettureDelDispositivo(voce, states),
    /* Le frecce, OK, indietro, i canali (#132) — solo a TV accesa, e solo
     * quelli che la sua integrazione sa ricevere. In standby la TV risponde ma
     * lo schermo è spento: una freccia lì non muove niente. */
    telecomando: telecomandoDelLettore(
      {
        entity: risolta || entity,
        telecomando: voce?.telecomando ? risolvi(voce.telecomando) : "",
        acceso: !muto && STATI_VIVI.has(grezzo) && grezzo !== "standby",
      },
      states,
      piattaforme,
    ),
  };
}

/* Il lettore che nasce da un dispositivo di Home Assistant (#451).
 *
 * «Io farei una sezione Tv anche perché per esempio samsung ha una sua
 * integrazione che si potrebbe importare. SmartThings. Il forno Samsung per
 * esempio prende tutte le entità come elettrodomestico.» È la stessa strada
 * degli elettrodomestici e del robot: si sceglie il dispositivo e le caselle si
 * compilano da sole. Un lettore è fatto di tre pezzi — l'entità che suona, i
 * comandi che l'integrazione pubblica accanto, e le letture che dicono e basta.
 *
 * Le entità di servizio non entrano fra i comandi: quelle che Home Assistant
 * marca `config` o `diagnostic` sono le impostazioni del dispositivo, non i
 * tasti che uno vuole sulla scheda.
 */
export function bindLettoreToDevice({
  device = {},
  entities = [],
  states = {},
  indice = 0,
  precedente = {},
} = {}) {
  const elenco = (Array.isArray(entities) ? entities : []).filter(
    (voce) => voce && !voce.disabled && pulito(voce.entity_id).includes("."),
  );
  const dominio = (voce) => pulito(voce.entity_id).split(".")[0];
  const suo = elenco.find((voce) => dominio(voce) === "media_player");

  const comandi = elencoComandi(
    elenco
      .filter((voce) => !["config", "diagnostic"].includes(pulito(voce.category)))
      .map((voce) => pulito(voce.entity_id)),
  );

  /* Il telecomando dello stesso dispositivo (#132): il registro lo sa per
   * certo, e scriverlo qui vuol dire non doverlo indovinare dopo. */
  const remoto = elenco.find((voce) => dominio(voce) === "remote");

  const nato = {
    ...normalizzaLettore(precedente, indice),
    nome: pulito(precedente.nome) || pulito(device.name),
    entity: pulito(suo?.entity_id) || pulito(precedente.entity),
    comandi: comandi.length ? comandi : elencoComandi(precedente.comandi),
    telecomando:
      pulito(remoto?.entity_id) ||
      (eUnTelecomando(precedente.telecomando) ? pulito(precedente.telecomando) : ""),
  };
  /* Le letture sono quelle DI QUEL dispositivo — l'elenco arriva dal registro
   * di Home Assistant, ed è esatto — lette però sullo stato vero, perché è lì
   * che stanno le unità e i nomi. Indovinarle dal nome sbagliava in tutt'e due
   * i versi: lasciava fuori una lettura chiamata in un altro modo, e prendeva
   * dentro l'aiutante di qualcun altro che comincia uguale. */
  const letture = lettureRiconosciute(
    nato,
    states,
    elenco.map((voce) => pulito(voce.entity_id)),
  );
  nato.letture = letture.length ? letture : elencoLetture(precedente.letture);
  return nato;
}

/** Le letture di tutti i lettori configurati. */
export function lettureDeiLettori(stored, states = {}, resolve, piattaforme = {}) {
  return lettoriConfigurati(stored).map((voce) =>
    letturaDelLettore(voce, states, resolve, piattaforme),
  );
}

/**
 * A che punto è il brano, adesso.
 *
 * Home Assistant manda la posizione e l'istante in cui l'ha misurata: mentre
 * suona il tempo continua a scorrere senza che arrivi un nuovo stato, e una
 * barra ferma su un brano che va avanti è peggio di nessuna barra. In pausa
 * invece la posizione è quella e resta quella.
 */
export function posizioneOra(lettura, adesso = Date.now()) {
  const durata = lettura?.durata;
  const posizione = lettura?.posizione;
  if (!Number.isFinite(durata) || durata <= 0 || !Number.isFinite(posizione)) return null;
  let secondi = posizione;
  if (lettura.suona && Number.isFinite(lettura.posizioneAggiornata))
    secondi += Math.max(0, (adesso - lettura.posizioneAggiornata) / 1000);
  const dentro = Math.min(durata, Math.max(0, secondi));
  return { secondi: dentro, durata, quota: durata ? dentro / durata : 0 };
}

/** Minuti e secondi, come li scrive qualunque lettore. */
export function orologio(secondi) {
  if (!Number.isFinite(secondi) || secondi < 0) return "";
  const tutti = Math.floor(secondi);
  const ore = Math.floor(tutti / 3600);
  const minuti = Math.floor((tutti % 3600) / 60);
  const resto = tutti % 60;
  const due = (n) => String(n).padStart(2, "0");
  return ore ? `${ore}:${due(minuti)}:${due(resto)}` : `${minuti}:${due(resto)}`;
}

/**
 * Che faccia ha il tasto centrale adesso, o niente (#132).
 *
 * «Ho collegato le TV a Home Assistant, sarebbe possibile usarle anche qua per
 * spegnerle, accenderle?» Si poteva già — il tasto centrale su un lettore
 * spento chiama `turn_on` — ma diceva «Riproduci» e portava il triangolo della
 * musica, e su un televisore spento quel triangolo non si legge come «accendi»:
 * si legge come un tasto che riprenderà qualcosa, e chi non sa cosa riprenderà
 * non lo preme.
 *
 * E c'è il caso peggiore. Un televisore che dichiara di saper solo accendersi,
 * spegnersi e cambiare sorgente — cioè quasi tutti — di pausa non ne ha, e su
 * quello, da acceso, il triangolo chiamava `media_play_pause`: un servizio che
 * non dà errore e non fa niente. Un tasto rotto, che è esattamente quello che
 * la testa di `media-player-section.js` dice di non voler disegnare mai. La
 * regola c'era e il tasto centrale ne era fuori.
 *
 * Quindi qui si decide, e si decide con quello che il lettore ha dichiarato:
 *
 *  · spento e sa accendersi  → `accendi`, col segno dell'alimentazione;
 *  · acceso e sa la pausa    → `pausa` o `suona`, come prima;
 *  · tutto il resto          → niente, e in mezzo alla fila non c'è nulla.
 *
 * Il terzo caso non lascia scoperto niente: un televisore acceso che non sa
 * mettersi in pausa lo si spegne col tasto accanto, che c'è già.
 */
export function ilTastoCentrale(lettura) {
  if (!lettura) return "";
  if (lettura.spento) return lettura.puo?.accendi ? "accendi" : "";
  if (!lettura.puo?.pausa) return "";
  return lettura.suona ? "pausa" : "suona";
}

/* Quanto si sposta il volume a ogni tocco del meno e del piu': un punto.
 *
 * Il cursore va bene per arrivare lontano, e male per l'ultimo ritocco: col
 * dito sopra, tra il 18 e il 22 non c'e' modo di fermarsi sul 20. I due tasti
 * fanno quel pezzo, uno alla volta. */
export const PASSO_DEL_VOLUME = 0.01;

/**
 * Il volume dopo un tocco: `verso` e' 1 per alzare, -1 per abbassare. Sempre
 * fra 0 e 1, e arrotondato al punto: `0.07 + 0.01` in virgola mobile non fa
 * `0.08`, e il numero scritto accanto al cursore direbbe 8 quando e' 7,999.
 */
export function volumeDopoIlPasso(volume, verso) {
  const adesso = Number.isFinite(Number(volume)) ? Number(volume) : 0;
  const dopo = adesso + Math.sign(Number(verso) || 0) * PASSO_DEL_VOLUME;
  return Math.min(1, Math.max(0, Math.round(dopo * 100) / 100));
}

/**
 * Il servizio da chiamare per il comando chiesto.
 *
 * Il tasto centrale è uno solo e fa tre cose diverse a seconda di com'è messo
 * il lettore: acceso e fermo si fa suonare, spento si accende. Chiamare
 * `media_play_pause` su un lettore spento non dà errore e non fa niente — che
 * da fuori è un tasto rotto.
 */
export function comandoDelLettore(comando, lettura) {
  if (comando === "centro") {
    if (!lettura || lettura.spento) return "turn_on";
    return "media_play_pause";
  }
  if (comando === "precedente") return "media_previous_track";
  if (comando === "successivo") return "media_next_track";
  if (comando === "muto") return "volume_mute";
  if (comando === "volume") return "volume_set";
  /* Un passo alla volta, per chi il volume non lo sa mettere a un numero
   * (#132): quasi tutte le TV, che sanno solo alzarlo e abbassarlo. */
  if (comando === "alza") return "volume_up";
  if (comando === "abbassa") return "volume_down";
  if (comando === "sorgente") return "select_source";
  if (comando === "spegni") return "turn_off";
  if (comando === "accendi") return "turn_on";
  return "";
}
