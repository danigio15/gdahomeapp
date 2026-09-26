/* La plancia configurata da lontano: le regole che valgono da tutt'e due le
 * parti.
 *
 * Dalla 1.5.9.13 chi installa puo' rimettere mano alla plancia di una casa dal
 * suo cruscotto — se quella casa gliel'ha permesso con la casella
 * `quadro_configurazione`, che e' un terzo interruttore e non sta dentro la
 * manutenzione. La strada e' quella dei due verbi di `lavori.js`: la casa
 * bussa, e nella risposta trova cosa fare. Solo che qui la cosa da fare e'
 * grossa — una configurazione puo' pesare megabyte, e un rapporto ne porta
 * 256 KiB — quindi viaggia su una porta sua, sempre a iniziativa della casa:
 * `POST /plancia` per mandare com'e' fatta adesso, `GET /plancia/<profilo>`
 * per ritirare quella che l'installatore ha scritto.
 *
 * ─── Configurare, non guardare ───────────────────────────────────────────
 *
 * E' la regola che tiene in piedi il permesso. Una plancia configurata e'
 * fatta di sezioni, stanze, entita' e disposizione: quello viaggia. Quello
 * che **non** viaggia mai sono le immagini — i flussi delle telecamere, le
 * istantanee, i gettoni con cui si aprono — e non per una promessa: perche'
 * la configurazione salvata non li contiene (i `cameraUrls` della pagina
 * sono indirizzi temporanei del browser, e non si salvano), e perche' qui
 * sotto c'e' il setaccio che li toglierebbe comunque.
 *
 * Il setaccio lavora in tutt'e due i versi. In uscita — `senzaFlussi` — una
 * stringa che sembra un indirizzo di flusso o porta un gettone esce vuota:
 * l'installatore vede che il campo c'e', non cosa dice. In entrata —
 * `haFlussi` — una configurazione che ne contiene uno si **rifiuta**, e il
 * rapporto del minuto dopo dice perche': da lontano si sceglie quale
 * telecamera va in quale stanza, non dove sta il suo flusso.
 */

import { Configurazione } from "./configurazione.js";

/** Quante plance puo' avere una casa: le stesse di `plance.js`. */
export const PROFILI_AL_MASSIMO = 8;

/** Quanto puo' pesare una configurazione, in byte: come `configurazione.js`. */
export const PLANCIA_MASSIMA = 8 * 1024 * 1024;

/* Un flusso si riconosce dallo schema — rtsp, rtmp, srt, webrtc, mjpeg —
 * ovunque stia nel testo, e non solo in testa: dentro una plancia i valori
 * sono testi JSON, e «rtsp://» ci sta in mezzo. Poi ci sono i flussi che
 * passano da http: una lista HLS, un mjpeg, la via di un server di flussi.
 * E i gettoni, che aprono quello che il flusso non dice. */
const FLUSSO = /\b(?:rtsps?|rtmps?|srt|webrtc|mjpe?g):\/\//i;
const FLUSSO_HTTP =
  /\bhttps?:\/\/[^\s"'<>]*(?:\.m3u8|\/mjpe?g|\/api\/(?:stream|ws|webrtc|frame)|\/stream\.)/i;
const GETTONE = /(?:^|[?&#;])(?:access_token|auth_sig|authsig|auth|token|signature)=/i;

export function eUnFlusso(valore) {
  if (typeof valore !== "string") return false;
  return FLUSSO.test(valore) || FLUSSO_HTTP.test(valore) || GETTONE.test(valore);
}

/* Quello che un testo JSON ha dentro, se e' un testo JSON con dentro qualcosa
 * su cui valga la pena guardare: un oggetto o un elenco. */
function dentro(testo) {
  if (typeof testo !== "string") return undefined;
  const pulito = testo.trim();
  if (!pulito.startsWith("{") && !pulito.startsWith("[")) return undefined;
  try {
    const letto = JSON.parse(pulito);
    return letto && typeof letto === "object" ? letto : undefined;
  } catch (_errore) {
    return undefined;
  }
}

export function haFlussi(valori) {
  if (typeof valori === "string") {
    /* Prima si guarda se e' un testo JSON: un flusso in mezzo a un elenco
     * e' un flusso di quell'elemento, non dell'elenco intero. */
    const suo = dentro(valori);
    return suo ? haFlussi(suo) : eUnFlusso(valori);
  }
  if (Array.isArray(valori)) return valori.some((uno) => haFlussi(uno));
  if (valori && typeof valori === "object")
    return Object.values(valori).some((uno) => haFlussi(uno));
  return false;
}

/* La stessa cosa senza i flussi: al loro posto una stringa vuota, cosi' la
 * telecamera resta al suo posto e il suo indirizzo resta in casa. Un testo
 * JSON si riscrive solo se dentro c'era un flusso: quello che non cambia
 * resta uguale lettera per lettera, che e' quello che permette di dire
 * «e' gia' cosi'». */
export function senzaFlussi(valori) {
  if (typeof valori === "string") {
    const suo = dentro(valori);
    if (suo) return haFlussi(suo) ? JSON.stringify(senzaFlussi(suo)) : valori;
    return eUnFlusso(valori) ? "" : valori;
  }
  if (Array.isArray(valori)) return valori.map((uno) => senzaFlussi(uno));
  if (valori && typeof valori === "object") {
    return Object.fromEntries(
      Object.entries(valori).map(([chiave, uno]) => [chiave, senzaFlussi(uno)]),
    );
  }
  return valori;
}

/* Con che chiave si riconosce lo stesso elemento in due elenchi: la
 * telecamera e' la sua entita', una tessera il suo id. Senza, vale il posto. */
const CHIAVI_DI_IDENTITA = ["entity", "entity_id", "id", "key", "name"];

function gemello(uno, indice, correnti) {
  if (uno && typeof uno === "object" && !Array.isArray(uno)) {
    for (const chiave of CHIAVI_DI_IDENTITA) {
      const valore = uno[chiave];
      if (valore === undefined || valore === null || valore === "") continue;
      const trovato = correnti.find(
        (altro) => altro && typeof altro === "object" && altro[chiave] === valore,
      );
      if (trovato) return trovato;
    }
  }
  return correnti[indice];
}

/* I flussi di casa rimessi al loro posto in una configurazione arrivata dal
 * quadro.
 *
 * Il quadro i flussi non li ha mai avuti — sono partiti da qui come stringhe
 * vuote — quindi quello che riscrive li porta vuoti, e scriverlo com'e'
 * vorrebbe dire cancellare a chi ci abita l'indirizzo di ogni telecamera al
 * primo salvataggio da lontano. Dove il quadro ha lasciato vuoto e in casa,
 * nello stesso punto, c'era un flusso, resta quello di casa; tutto il resto
 * e' come l'ha scritto lui. Gli elementi di un elenco si riconoscono per
 * entita' o id, cosi' una telecamera spostata di posto si porta dietro il
 * suo flusso. Quello che non cambia resta la stessa cosa, lettera per
 * lettera. */
export function conIFlussiDiCasa(nuovi, correnti) {
  if (typeof nuovi === "string") {
    const suoi = dentro(nuovi);
    const diCasa = dentro(correnti);
    if (suoi && diCasa) {
      const rimessi = conIFlussiDiCasa(suoi, diCasa);
      return rimessi === suoi ? nuovi : JSON.stringify(rimessi);
    }
    if (nuovi === "" && !diCasa && eUnFlusso(correnti)) return correnti;
    return nuovi;
  }
  if (Array.isArray(nuovi)) {
    if (!Array.isArray(correnti)) return nuovi;
    let cambiato = false;
    const esito = nuovi.map((uno, indice) => {
      const rimesso = conIFlussiDiCasa(uno, gemello(uno, indice, correnti));
      if (rimesso !== uno) cambiato = true;
      return rimesso;
    });
    return cambiato ? esito : nuovi;
  }
  if (nuovi && typeof nuovi === "object") {
    if (!correnti || typeof correnti !== "object" || Array.isArray(correnti)) return nuovi;
    let cambiato = false;
    const esito = {};
    for (const [chiave, uno] of Object.entries(nuovi)) {
      const rimesso = conIFlussiDiCasa(uno, correnti[chiave]);
      if (rimesso !== uno) cambiato = true;
      esito[chiave] = rimesso;
    }
    return cambiato ? esito : nuovi;
  }
  return nuovi;
}

export const profiloBuono = (profilo) => Configurazione.profiloBuono(profilo);

/** Quanto pesano questi valori una volta scritti: e' il numero che si confronta col tetto. */
export const quantoPesa = (valori) => Buffer.byteLength(JSON.stringify(valori ?? null), "utf8");

/* ─── Quello che il quadro puo' scrivere ─────────────────────────────────
 *
 * Una configurazione arrivata da lontano finisce dentro la plancia di ogni
 * telefono e di ogni pagina di questa casa. La plancia i testi li scrive con
 * le sue cautele; qui c'e' la seconda, prima di scrivere: si accettano le
 * chiavi che la plancia usa davvero, di grandezze da configurazione, e testi
 * che non somigliano a un pezzo di pagina. Quello che non torna non si
 * ripulisce in silenzio — si rifiuta, e il rapporto dice perche', come per i
 * flussi. */

/* Le chiavi della plancia: `cd_…`, `dm_…`, `dashboardmodern…` — le stesse che
 * la plancia tiene per sue (`OWN_STORAGE_PREFIXES`). */
const CHIAVE_DELLA_PLANCIA = /^(?:cd_|dm_|dashboardmodern)[A-Za-z0-9_.:-]{0,120}$/;
export const CHIAVI_DA_LONTANO = 256;
export const VALORE_DA_LONTANO = 2 * 1024 * 1024;
export const TOTALE_DA_LONTANO = 8 * 1024 * 1024;

/* Quello che in un testo della plancia non ha motivo di esserci: l'inizio di
 * un pezzo di markup, un indirizzo che esegue, un attributo che reagisce. Un
 * `>` da solo o un `< 5` in una nota non sono markup, e passano. */
const COME_UNA_PAGINA = /<\s*[a-z!/?]|javascript\s*:|vbscript\s*:|\bon[a-z]+\s*=/i;

function testoSospetto(valore, profondita = 0) {
  if (profondita > 40) return "una configurazione troppo annidata";
  if (typeof valore === "string") {
    /* Un testo JSON si guarda dentro: li' le lettere possono essere scritte
     * con `\u003c`, e fuori non si vedrebbero. */
    const suo = dentro(valore);
    if (suo) return testoSospetto(suo, profondita + 1);
    return COME_UNA_PAGINA.test(valore) ? "un testo con dentro del markup o del programma" : null;
  }
  if (Array.isArray(valore)) {
    for (const uno of valore) {
      const no = testoSospetto(uno, profondita + 1);
      if (no) return no;
    }
    return null;
  }
  if (valore && typeof valore === "object") {
    for (const [chiave, uno] of Object.entries(valore)) {
      if (COME_UNA_PAGINA.test(chiave)) return "un nome con dentro del markup o del programma";
      const no = testoSospetto(uno, profondita + 1);
      if (no) return no;
    }
  }
  return null;
}

/**
 * Se una configurazione arrivata dal quadro si puo' scrivere.
 *
 * Torna `null` se si', o il perche' di un no, in parole da rapporto.
 */
export function nonSiScriveDaLontano(valori) {
  if (!valori || typeof valori !== "object" || Array.isArray(valori))
    return "non e' una configurazione";
  const chiavi = Object.keys(valori);
  if (chiavi.length > CHIAVI_DA_LONTANO) return "troppe voci in quella configurazione";
  let totale = 0;
  for (const chiave of chiavi) {
    if (!CHIAVE_DELLA_PLANCIA.test(chiave))
      return `una voce che la plancia non conosce (${chiave.slice(0, 40)})`;
    const valore = valori[chiave];
    const pesa = Buffer.byteLength(
      typeof valore === "string" ? valore : JSON.stringify(valore ?? null),
      "utf8",
    );
    if (pesa > VALORE_DA_LONTANO) return `la voce ${chiave} e' troppo grande`;
    totale += pesa;
    if (totale > TOTALE_DA_LONTANO) return "quella configurazione e' troppo grande";
    const no = testoSospetto(valore);
    if (no) return `la voce ${chiave} conteneva ${no}`;
  }
  return null;
}
