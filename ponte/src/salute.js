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
 * ─── Il nome, e perche' adesso esce ──────────────────────────────────────
 *
 * Qui dentro c'era un'impronta: quattro cifre ricavate dal nome con un sale
 * di questa casa, che dicevano «e' lo stesso di ieri» oppure «e' un altro» e
 * niente piu'. Era la scelta giusta finche' il quadro serviva a far suonare
 * una spia. Non regge nel momento in cui quella spia deve servire a
 * **ripararlo**: davanti a dodici pastiglie `#00a7` chi ha montato l'impianto
 * sa che dodici cose non rispondono e non sa da dove cominciare, e va a
 * finire che telefona a chi ci abita per farsi leggere i nomi — cioe' quei
 * nomi escono lo stesso, per telefono, e nel frattempo il quadro non e'
 * servito a niente.
 *
 * Percio' adesso esce il nome, e **solo di quelli che non rispondono**. Non e'
 * una cosa che si puo' nascondere a chi ci abita: sta scritto nella casella
 * dell'add-on prima che lui incolli il codice, e sta nel rapporto che legge
 * parola per parola nella scheda «Il quadro». Chi non lo vuole non incolla il
 * codice, e non parte niente.
 *
 * ─── Il dispositivo, non le sue entita' ──────────────────────────────────
 *
 * Un termostato che se ne va porta giu' cinque entita', e cinque righe
 * «Termostato salotto Temperatura», «… Umidita'», «… Batteria» dicono una
 * cosa sola scritta cinque volte. Percio' si raggruppa per dispositivo, con i
 * due registri di Home Assistant, e si manda il nome del dispositivo. I
 * registri sono facoltativi: se non rispondono si manda il nome
 * dell'entita', che e' meno bello e non e' sbagliato.
 *
 * Il conto invece resta in entita', ed e' voluto: `giu` sono le entita' che
 * non rispondono, `dispositivi` quanti apparecchi sono. Due numeri diversi
 * per due domande diverse.
 *
 * ─── Perche' `unavailable` e non `unknown` ────────────────────────────────
 *
 * `unavailable` vuol dire «Home Assistant non riesce a parlarci»: la presa
 * staccata, il nodo Zigbee sparito, l'integrazione caduta. `unknown` vuol
 * dire «ci parlo e non me lo ha ancora detto», ed e' normalissimo: un sensore
 * appena riavviato sta li' finche' non arriva la prima misura. Contarli
 * insieme vorrebbe dire una spia rossa a ogni riavvio di Home Assistant.
 */

/** Sotto quale carica una batteria si conta fra quelle da cambiare. */
export const BATTERIA_SCARICA = 20;

/* Quanti nomi si mandano al massimo.
 *
 * Non e' prudenza, e' leggibilita': una casa con quaranta dispositivi giu' ha
 * un guaio che si vede dal numero — e `dispositivi` quel numero lo dice tutto
 * — mentre quaranta pastiglie in fila non le legge nessuno. Dodici stanno in
 * tre righe e bastano a capire **di che roba si tratta**. */
export const NOMI_MASSIMI = 12;

/* Le entita' che dicono se un backup e' stato fatto, e quando. Le fa
 * l'integrazione `backup` di Home Assistant, che c'e' di serie. */
const QUANDO_IL_BACKUP = new Set([
  "sensor.backup_last_successful_automatic_backup",
  "sensor.backup_last_attempted_automatic_backup",
]);

const GIORNO = 24 * 60 * 60 * 1000;

const elenco = (che) => (Array.isArray(che) ? che : []);

const pulito = (valore) => (valore == null ? "" : String(valore).trim());

const numero = (valore) => {
  const letto = Number(valore);
  return Number.isFinite(letto) ? letto : null;
};

/* Un'entita' che non risponde. Non e' un elenco di stati «brutti»: e' quello
 * solo, e il motivo sta in cima al file. */
const nonRisponde = (stato) => String(stato?.state ?? "") === "unavailable";

/* Il nome di un dispositivo, o di un'entita' che dispositivo non ne ha.
 *
 * Il nome che ha messo chi ci abita batte quello di fabbrica: una presa
 * ribattezzata «Frigo» la si trova, `Shelly Plus Plug S-6A3F` no. */
function ilNomeDelDispositivo(riga) {
  return pulito(riga?.name_by_user) || pulito(riga?.name);
}

/* Come si chiama questa entita', quando un dispositivo non ce l'ha o i
 * registri non hanno risposto. `friendly_name` e' quello che si legge nella
 * plancia; senza, si prende la coda dell'identificativo, che almeno e'
 * leggibile — `sensor.pompa_calore` diventa «pompa calore». */
function ilNomeDellEntita(stato) {
  const detto = pulito(stato?.attributes?.friendly_name);
  if (detto) return detto;
  const quale = pulito(stato?.entity_id);
  return quale.split(".").slice(1).join(".").replace(/_/g, " ").trim() || quale;
}

/**
 * I nomi di cosa non risponde, uno per dispositivo.
 *
 * Senza registri risponde lo stesso, con i nomi delle entita': un rapporto
 * con una riga in piu' del dovuto e' meglio di un rapporto senza la riga.
 *
 * In ordine, e non nell'ordine in cui Home Assistant li ha elencati: due
 * rapporti di fila con le stesse cose giu' devono dare la stessa fila nello
 * stesso posto, se no il quadro vede muoversi qualcosa che e' fermo.
 *
 * @param {Array} giu gli stati che non rispondono
 * @param {object} registri `dispositivi` ed `entita`, come li da' Home Assistant
 */
export function iNomi(giu, registri = null) {
  const diChiE = new Map();
  for (const riga of elenco(registri?.entita)) {
    const quale = pulito(riga?.entity_id);
    const suo = pulito(riga?.device_id);
    if (quale && suo) diChiE.set(quale, suo);
  }
  const comeSiChiama = new Map();
  for (const riga of elenco(registri?.dispositivi)) {
    const quale = pulito(riga?.id);
    const come = ilNomeDelDispositivo(riga);
    if (quale && come) comeSiChiama.set(quale, come);
  }
  /* Un `Set`, e non un elenco: e' qui che cinque entita' di un termostato
   * diventano una riga sola. */
  const nomi = new Set();
  for (const uno of elenco(giu)) {
    const suo = diChiE.get(pulito(uno?.entity_id));
    const come = (suo && comeSiChiama.get(suo)) || ilNomeDellEntita(uno);
    if (come) nomi.add(come);
  }
  return [...nomi].sort((una, altra) => una.localeCompare(altra, "it"));
}

/**
 * Quante entita' ci sono, quante non rispondono, e come si chiamano.
 *
 * `giu` conta le **entita'**, `dispositivi` gli **apparecchi**: un termostato
 * che se ne va fa cinque e uno. `nomi` e' tagliato a `quante`, e quando taglia
 * si vede dal confronto con `dispositivi` — chi disegna dice «e altri tre»
 * invece di far sparire il numero vero.
 *
 * @param {Array} stati quello che torna `get_states`
 * @param {object} opzioni `registri` per i nomi dei dispositivi, `quante` per il tetto
 */
export function leEntita(stati, { quante = NOMI_MASSIMI, registri = null } = {}) {
  const dentro = elenco(stati);
  const giu = dentro.filter(nonRisponde);
  const nomi = iNomi(giu, registri);
  return {
    totali: dentro.length,
    giu: giu.length,
    dispositivi: nomi.length,
    nomi: nomi.slice(0, quante),
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
     * dispositivo che non risponde, e lo conta gia' `leEntita`. Contarla qui
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
 * `null` anche lui, e chi legge il rapporto non li distingue: e' una perdita
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
