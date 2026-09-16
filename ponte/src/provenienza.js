/* La provenienza della plancia: da dove viene, e se qualcuno l'ha toccata.
 *
 * La plancia sta sul disco di chi ha installato l'add-on, e chi ha installato
 * l'add-on e' amministratore della sua macchina: puo' aprirla e cambiarla. Non
 * c'e' modo di impedirglielo, e non e' quello che si sta cercando di fare.
 *
 * Quello che si cerca di fare e' un'altra cosa, ed e' possibile: **far si'
 * che una copia toccata lo dica**. Se qualcuno cambia la plancia e poi la
 * ripubblica come sua, o la lascia in giro modificata col marchio di qualcun
 * altro sopra, il ponte se ne accorge e lo scrive nella sua console. Chi la
 * riceve puo' vedere in due secondi se e' l'originale.
 *
 * Come funziona, in due pezzi:
 *
 *  - **le impronte.** `sigilla-la-plancia.mjs` scrive in `ORIGINE.json`
 *    l'impronta SHA-256 di ogni file della plancia, piu' un **sigillo**, che
 *    e' l'impronta della lista delle impronte. Il ponte le ricontrolla e dice
 *    quali file non tornano. Da sole bastano contro chi modifica; non contro
 *    chi rigenera anche `ORIGINE.json`.
 *
 *  - **la firma.** Il sigillo e' firmato Ed25519 con la chiave di chi
 *    pubblica. La chiave pubblica sta qui sotto, quella privata no. Chi
 *    rigenera `ORIGINE.json` puo' rifare le impronte e il sigillo, ma non la
 *    firma: una copia rimaneggiata resta «non firmata», e non c'e' modo di
 *    farla sembrare firmata senza la chiave privata.
 *
 * Quello che tutto questo **non** fa, ed e' giusto dirlo: non impedisce a
 * nessuno di modificare la sua copia e usarla. Chi vuole toglie anche questo
 * controllo, che sta nel codice come tutto il resto. Serve a rendere una
 * copia rimaneggiata **riconoscibile**, non impossibile — ed e' esattamente
 * quello che serve quando quello che si vuole difendere e' la paternita' del
 * lavoro, non l'incasso.
 */

import { createHash, verify } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

/* La chiave pubblica di chi pubblica l'add-on, in formato SPKI PEM.
 *
 * Vuota finche' non c'e' una chiave: allora la verifica dice «non firmata» e
 * si ferma alle impronte, invece di far finta che vada tutto bene. Si mette
 * qui con `strumenti/firma-la-plancia.mjs --chiave-pubblica`. */
export const CHIAVE_DI_CHI_PUBBLICA = "";

/* Quali cartelle fanno la plancia, e quali file dentro. Chi sigilla non ha un
 * elenco suo: chiama `leImpronte` qui sotto, e guarda esattamente questi. */
export const CARTELLE = ["legacy", "src", "avatars", "brands"];
const SUFFISSI = new Set([
  ".js",
  ".css",
  ".json",
  ".html",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".gif",
  ".ico",
  ".woff2",
  ".woff",
]);
const CARTELLE_ESCLUSE = new Set(["e2e", "tests", "__pycache__"]);

/* Quanti file si nominano, quando non tornano. Ottocento nomi in una console
 * non si leggono: se ne mostrano dieci e si dice quanti sono in tutto. */
const QUANTI_SE_NE_DICONO = 10;

export const STATO = Object.freeze({
  originale: "originale",
  modificata: "modificata",
  nonFirmata: "non-firmata",
  senzaOrigine: "senza-origine",
});

/* Il sigillo: un'impronta sola di tutte le impronte.
 *
 * E' quella che si firma. Firmare ottocento righe una per una non
 * aggiungerebbe niente: basta firmare la lista, e se una riga cambia il
 * sigillo cambia con lei. */
export function sigilloDi(impronte) {
  const righe = Object.keys(impronte)
    .sort()
    .map((nome) => `${nome} ${impronte[nome]}`)
    .join("\n");
  return createHash("sha256").update(righe).digest("hex");
}

export function improntaDi(byte) {
  return createHash("sha256").update(byte).digest("hex");
}

function* iFile(cartella, radice) {
  for (const nome of readdirSync(cartella).sort()) {
    const intero = join(cartella, nome);
    const dati = statSync(intero);
    if (dati.isDirectory()) {
      if (CARTELLE_ESCLUSE.has(nome)) continue;
      yield* iFile(intero, radice);
      continue;
    }
    if (!dati.isFile()) continue;
    if (!SUFFISSI.has(extname(nome).toLowerCase())) continue;
    yield relative(radice, intero).split("\\").join("/");
  }
}

/**
 * Le impronte dei file che stanno **adesso** in quella cartella.
 *
 * La camminata e' una sola perche' la fanno in due: chi sigilla, quando si e'
 * cambiato qualcosa nella plancia, e chi verifica, dentro ogni casa. Se
 * guardassero due insiemi diversi di file, il giorno che uno dei due cambiasse
 * idea su una cartella o su un suffisso la verifica direbbe «modificata» su
 * una plancia intatta — e a quel punto non vorrebbe piu' dire niente.
 */
export function leImpronte(cartella) {
  const trovate = {};
  for (const dentro of CARTELLE) {
    const da = join(cartella, dentro);
    if (!existsSync(da)) continue;
    for (const relativo of iFile(da, cartella)) {
      try {
        trovate[relativo] = improntaDi(readFileSync(join(cartella, relativo)));
      } catch (_errore) {
        /* Illeggibile: conta come mancante, che e' quello che e' per chi
         * deve servirlo. */
      }
    }
  }
  return trovate;
}

/* La firma regge? Senza chiave pubblica, o senza firma, la risposta e' no —
 * e chi chiama la distingue da «regge e non torna». */
export function firmaBuona(sigillo, firma, chiave = CHIAVE_DI_CHI_PUBBLICA) {
  if (!chiave || !firma) return false;
  try {
    return verify(null, Buffer.from(sigillo, "utf8"), chiave, Buffer.from(firma, "base64"));
  } catch (_errore) {
    /* Una chiave storta o una firma di un'altra forma: non regge, e non e'
     * un motivo per far cadere il ponte. */
    return false;
  }
}

/* Guarda la plancia sul disco e dice com'e' messa.
 *
 * Non solleva mai: una plancia che non c'e', un `ORIGINE.json` illeggibile,
 * un file sparito — sono tutte cose da **dire**, non da far cadere. Un ponte
 * che non parte perche' la sua provenienza non torna sarebbe un controllo che
 * fa danno a chi non ha fatto niente di male. */
export function guardaLaPlancia(cartella, { chiave = CHIAVE_DI_CHI_PUBBLICA } = {}) {
  let origine = null;
  try {
    origine = JSON.parse(readFileSync(join(cartella, "ORIGINE.json"), "utf8"));
  } catch (_errore) {
    return { stato: STATO.senzaOrigine, perche: "questa plancia non dice da dove viene" };
  }

  const attese = origine.impronte;
  const base = {
    versione: String(origine.versione || ""),
    commit: String(origine.commit || ""),
    portataIl: String(origine.portata_il || ""),
    file: Number(origine.file) || 0,
  };
  if (!attese || typeof attese !== "object") {
    return {
      ...base,
      stato: STATO.senzaOrigine,
      perche: "questa plancia non porta le impronte dei suoi file",
    };
  }

  const trovate = leImpronte(cartella);

  const cambiati = [];
  const mancanti = [];
  for (const nome of Object.keys(attese)) {
    const trovata = trovate[nome];
    if (trovata === undefined) mancanti.push(nome);
    else if (trovata !== attese[nome]) cambiati.push(nome);
  }
  const aggiunti = Object.keys(trovate).filter((nome) => !(nome in attese));

  const sigillo = sigilloDi(attese);
  const sigilloTorna = sigillo === String(origine.sigillo || "");
  const firmata = firmaBuona(sigillo, String(origine.firma || ""), chiave);

  /* L'ordine dei verdetti non e' casuale: prima quello che non torna, poi
   * quello che manca. Una plancia con tre file cambiati e' «modificata» anche
   * se e' firmata — anzi, soprattutto: vuol dire che qualcuno ha cambiato i
   * file **dopo** che erano stati firmati. */
  const inOrdine = [...cambiati, ...mancanti, ...aggiunti].sort();
  const quanti = inOrdine.length;
  if (quanti > 0 || !sigilloTorna) {
    return {
      ...base,
      stato: STATO.modificata,
      firmata,
      quanti,
      quali: inOrdine.slice(0, QUANTI_SE_NE_DICONO),
      cambiati: cambiati.length,
      mancanti: mancanti.length,
      aggiunti: aggiunti.length,
      perche: sigilloTorna
        ? `${quanti} file non tornano`
        : "la lista delle impronte non torna col suo sigillo",
    };
  }
  if (!firmata) {
    return {
      ...base,
      stato: STATO.nonFirmata,
      firmata: false,
      quanti: 0,
      quali: [],
      perche: chiave
        ? "i file tornano, ma questa copia non porta una firma valida"
        : "i file tornano; questo ponte non ha una chiave con cui verificare la firma",
    };
  }
  return { ...base, stato: STATO.originale, firmata: true, quanti: 0, quali: [] };
}

/* Il verdetto in una riga, per la console e per il registro. */
export function inDueParole(verdetto) {
  const che = verdetto.versione ? `Plancia ${verdetto.versione}` : "Plancia";
  switch (verdetto.stato) {
    case STATO.originale:
      return `${che}: originale, firma verificata`;
    case STATO.nonFirmata:
      return `${che}: i file tornano tutti, senza firma`;
    case STATO.modificata:
      return `${che}: modificata — ${verdetto.perche}`;
    default:
      return `${che}: ${verdetto.perche || "provenienza sconosciuta"}`;
  }
}
