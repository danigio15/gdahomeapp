/* Come sta questa casa, dalle entita' che Home Assistant ha gia'.
 *
 * Tre domande che nessuno fa, e che chi ha installato l'impianto vorrebbe
 * sentirsi dire prima che a chiederlo sia il cliente: cosa non risponde piu',
 * quali batterie stanno finendo, e da quanto non si fa un backup.
 *
 * Tutte e tre si leggono dallo stesso `get_states` che `aggiornamenti.js` fa
 * gia' ogni dieci secondi — li' dentro si tengono le entita' `update.` e si
 * butta il resto. Qui il resto serve, e non costa niente in piu': quella
 * domanda si fa sulla rete di casa, dove un megabyte e mezzo non lo sente
 * nessuno.
 *
 * ─── Perche' entita' e non dispositivi ───────────────────────────────────
 *
 * Un dispositivo con cinque sensori, quando sparisce, qui conta cinque. E'
 * impreciso e si e' scelto lo stesso, per adesso: raggrupparle vorrebbe dire
 * chiedere anche il registro delle entita' — `config/entity_registry/list`,
 * un'altra domanda e un'altra cache — e il numero serve a far suonare una
 * spia, non a riempire un verbale. Percio' si chiamano **entita'** anche qui
 * dentro e nella cartolina: un numero impreciso con il nome giusto si legge
 * per quello che e', uno con il nome sbagliato mente.
 *
 * ─── Perche' `unavailable` e non `unknown` ────────────────────────────────
 *
 * `unavailable` vuol dire «Home Assistant non riesce a parlarci»: la presa
 * staccata, il nodo Zigbee sparito, l'integrazione caduta. `unknown` vuol
 * dire «ci parlo e non me lo ha ancora detto», ed e' normalissimo: un sensore
 * appena riavviato sta li' finche' non arriva la prima misura. Contarli
 * insieme vorrebbe dire una spia rossa a ogni riavvio di Home Assistant.
 */

import { createHash } from "node:crypto";

/** Sotto quale carica una batteria si conta fra quelle da cambiare. */
export const BATTERIA_SCARICA = 20;

/* Quante impronte si mandano al massimo. Servono a dire «gli stessi di ieri»,
 * e per quello ne bastano poche: una casa con quaranta entita' sparite ha un
 * guaio che si vede dal numero, non dall'elenco. */
export const IMPRONTE_MASSIME = 12;

/* Le entita' che dicono se un backup e' stato fatto, e quando. Le fa
 * l'integrazione `backup` di Home Assistant, che c'e' di serie. */
const QUANDO_IL_BACKUP = new Set([
  "sensor.backup_last_successful_automatic_backup",
  "sensor.backup_last_attempted_automatic_backup",
]);

const GIORNO = 24 * 60 * 60 * 1000;

const numero = (valore) => {
  const letto = Number(valore);
  return Number.isFinite(letto) ? letto : null;
};

/* Un'entita' che non risponde. Non e' un elenco di stati «brutti»: e' quello
 * solo, e il motivo sta in cima al file. */
const nonRisponde = (stato) => String(stato?.state ?? "") === "unavailable";

/**
 * Quattro cifre per un'entita', con il sale di questa casa.
 *
 * Servono al quadro dell'installatore a dire «e' lo stesso di ieri» oppure «e'
 * un altro» — cioe' a distinguere un dispositivo morto da una rete che balla —
 * e a niente di piu'. Il nome dell'entita' **non esce da qui**: `binary_sensor.
 * camera_di_marco_finestra` dice chi abita in questa casa e in quale stanza
 * dorme, e quello non e' un dato da mandare a nessuno.
 *
 * Il sale nasce in `/data` alla prima accensione e non si muove: senza, la
 * stessa entita' darebbe la stessa impronta in tutte le case del mondo, e
 * quattro cifre di sha256 si girano in un pomeriggio con un elenco di nomi
 * plausibili.
 */
export function impronta(sale, entita) {
  return createHash("sha256")
    .update(`${String(sale ?? "")}:${String(entita ?? "")}`, "utf8")
    .digest("hex")
    .slice(0, 4);
}

/**
 * Quante entita' ci sono, e quante non rispondono.
 *
 * @param {Array} stati quello che torna `get_states`
 * @param {object} opzioni `sale` per le impronte, `quante` per il tetto
 */
export function leEntita(stati, { sale = "", quante = IMPRONTE_MASSIME } = {}) {
  const dentro = Array.isArray(stati) ? stati : [];
  const sparite = dentro.filter(nonRisponde);
  return {
    totali: dentro.length,
    sparite: sparite.length,
    /* In ordine, e non nell'ordine in cui Home Assistant le ha elencate: due
     * cartoline di fila con le stesse entita' sparite devono dare le stesse
     * quattro cifre nello stesso posto, se no il quadro vede cambiare
     * qualcosa che non e' cambiato. */
    impronte: sparite
      .map((uno) => impronta(sale, uno?.entity_id))
      .sort()
      .slice(0, quante),
  };
}

/**
 * Le batterie: quante sono sotto la soglia, e quanto sta messa la peggiore.
 *
 * Si guardano le entita' che **dichiarano** di essere una carica
 * (`device_class: battery`) e che portano una percentuale. Un sensore che dice
 * `battery` in percento e' una batteria; uno che si chiama «batteria» e basta
 * puo' essere qualunque cosa, e indovinare dal nome vuol dire contare fra le
 * batterie la temperatura del box batterie del fotovoltaico.
 *
 * `piuBassa` e' `null` quando in questa casa non ce n'e' nessuna, che non e'
 * la stessa cosa di «sono tutte al cento».
 */
export function leBatterie(stati, { scarica = BATTERIA_SCARICA } = {}) {
  const dentro = Array.isArray(stati) ? stati : [];
  const cariche = [];
  for (const uno of dentro) {
    if (uno?.attributes?.device_class !== "battery") continue;
    if (uno?.attributes?.unit_of_measurement !== "%") continue;
    /* Una batteria che non risponde non e' una batteria scarica: e' un
     * dispositivo sparito, e lo conta gia' `leEntita`. Contarla anche qui
     * vorrebbe dire due spie per un guaio solo. */
    if (nonRisponde(uno)) continue;
    const quanto = numero(uno.state);
    if (quanto === null || quanto < 0 || quanto > 100) continue;
    cariche.push(quanto);
  }
  return {
    scariche: cariche.filter((una) => una <= scarica).length,
    piuBassa: cariche.length ? Math.min(...cariche) : null,
  };
}

/**
 * Da quanti giorni non si fa un backup.
 *
 * `null` vuol dire due cose diverse, e vanno tenute diverse: o l'entita' non
 * c'e' — Home Assistant vecchio, o backup mai configurato — o c'e' e dice che
 * un backup non e' mai riuscito. Il primo caso e' `null`, il secondo e'
 * `null` anche lui, e chi legge la cartolina non li distingue: e' una perdita
 * accettabile, perche' in tutti e due i casi la risposta all'installatore e'
 * la stessa — in questa casa il backup non gira.
 */
export function ilBackup(stati, { adesso = () => Date.now() } = {}) {
  const dentro = Array.isArray(stati) ? stati : [];
  let ultimo = null;
  for (const uno of dentro) {
    if (!QUANDO_IL_BACKUP.has(String(uno?.entity_id ?? ""))) continue;
    const quando = Date.parse(String(uno?.state ?? ""));
    if (Number.isNaN(quando)) continue;
    if (ultimo === null || quando > ultimo) ultimo = quando;
  }
  if (ultimo === null) return { giorniFa: null };
  /* Arrotondato per difetto: un backup di venti ore fa e' «oggi», non
   * «ieri». */
  return { giorniFa: Math.max(0, Math.floor((adesso() - ultimo) / GIORNO)) };
}
