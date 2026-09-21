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
 * ─── Un dispositivo e' un dispositivo ────────────────────────────────────
 *
 * Si guardano **solo le entita' che appartengono a un dispositivo vero**:
 * quelli che in Home Assistant stanno in «Dispositivi e integrazioni», Zigbee
 * compreso. Tutto il resto no.
 *
 * Qui c'era un guasto, e in una casa vera si vedeva cosi':
 *
 *     I DISPOSITIVI NON COLLEGATI
 *     Aggiornamento package elettrodomestici · Automazioni Elettrodomestici 1
 *     Avvio Ritardato Conteggio Elettrodomestici · Avviso accensione lavatrice
 *     … e altri 170
 *
 * Centottanta «dispositivi non collegati» in una casa che ne ha una
 * quarantina. Non erano dispositivi: erano aiutanti, automazioni, sensori
 * template, `input_boolean` — roba che un dispositivo non ce l'ha e non lo
 * deve avere. Ci finivano perche' quando un'entita' non aveva un dispositivo
 * si ripiegava sul suo nome, e quella riga di ripiego era la maggioranza.
 *
 * Un numero cosi' non e' impreciso, e' **inservibile**: chi lo legge non ha
 * modo di sapere quali delle centottanta righe siano un guasto, e smette di
 * guardarle tutte.
 *
 * Un termostato che se ne va porta giu' cinque entita', e cinque righe
 * «Termostato salotto Temperatura», «… Umidita'», «… Batteria» dicono una
 * cosa sola scritta cinque volte. Percio' si raggruppa per dispositivo e si
 * manda il nome del dispositivo.
 *
 * I tre numeri parlano tutti della stessa popolazione — le entita' di un
 * dispositivo — se no «8 entita' su 214» metterebbe insieme due conti fatti
 * su due insiemi diversi. `totali` sono quelle che un dispositivo ce l'hanno,
 * `giu` quelle di quelle che non rispondono, `dispositivi` quanti apparecchi
 * sono.
 *
 * ─── E senza i registri non si indovina ──────────────────────────────────
 *
 * I due registri di Home Assistant dicono quali entita' appartengono a un
 * dispositivo, e senza di loro la domanda non si puo' fare. Allora non si
 * risponde: tutti e tre i numeri escono `null`, che il quadro sa gia'
 * disegnare — «questa casa non lo dice», grigio, e non fa suonare niente.
 * Ripiegare sui nomi delle entita' e' proprio la cosa che ha prodotto le
 * centottanta righe.
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
 * Erano **dodici**, e la ragione scritta qui era la leggibilita': dodici
 * pastiglie stanno in tre righe, il numero vero lo dice `dispositivi`, e
 * quaranta pastiglie in fila non le legge nessuno.
 *
 * Sbagliato, e lo dice chi installa: «non escono i nomi completi dei
 * dispositivi nel cruscotto installatore, inoltre li deve mostrare tutti, non
 * con la scritta “e altri…” ma senza poterli leggere». Quaranta pastiglie non
 * si leggono di colpo, e' vero — ma non e' quello che ci si fa: ci si va a
 * cercare dentro. Chi installa guarda quel riquadro per sapere **quali** cose
 * sono giu', perche' da li' decide se prendere la macchina: quaranta nomi che
 * si possono scorrere valgono, «e altri 31» non vale niente. Il conto lo
 * sapeva gia', gli mancavano i nomi.
 *
 * Quindi il tetto resta, ma smette di essere una scelta di impaginazione e
 * diventa quello che i tetti devono essere: una guardia contro un rapporto che
 * cresce senza fine. Questo foglio parte **ogni minuto**; duecento nomi sono
 * qualche chilobyte e li copre qualunque casa vera — la piu' grossa che
 * abbiamo visto ne aveva quarantatre'. Se un giorno taglia davvero, chi
 * disegna se ne accorge dal confronto con `dispositivi` e scrive «e altri
 * tre», che e' il caso per cui quella scritta esiste. */
export const NOMI_MASSIMI = 200;

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
  const quali = iDispositivi(registri);
  if (!quali) return [];
  /* Un `Set`, e non un elenco: e' qui che cinque entita' di un termostato
   * diventano una riga sola. */
  const nomi = new Set();
  for (const uno of elenco(giu)) {
    const suo = quali.diChiE(pulito(uno?.entity_id));
    if (!suo) continue;
    /* Il dispositivo c'e' e il suo nome e' vuoto: qui il ripiego sul nome
     * dell'entita' ci sta, perche' la domanda «e' un dispositivo?» ha gia'
     * avuto risposta si'. */
    const come = quali.comeSiChiama(suo) || ilNomeDellEntita(uno);
    if (come) nomi.add(come);
  }
  return [...nomi].sort((una, altra) => una.localeCompare(altra, "it"));
}

/**
 * I due registri, letti una volta: da un'entita' al nome del suo dispositivo.
 *
 * Torna `null` quando i registri non ci sono — e chi chiama non indovina.
 * Un'entita' che un dispositivo non ce l'ha torna stringa vuota, e non e' un
 * caso raro: aiutanti, automazioni, sensori template, scene e gruppi stanno
 * tutti li'.
 */
function iDispositivi(registri) {
  const righeE = elenco(registri?.entita);
  const righeD = elenco(registri?.dispositivi);
  if (!righeE.length || !righeD.length) return null;

  /* I dispositivi per primi: il nome ci va anche se e' vuoto, perche' quello
   * che conta qui e' **esserci**. Un'entita' che punta a un dispositivo che
   * nel registro non c'e' piu' non e' di un dispositivo. */
  const comeSiChiama = new Map();
  for (const riga of righeD) {
    const quale = pulito(riga?.id);
    if (quale) comeSiChiama.set(quale, ilNomeDelDispositivo(riga));
  }
  const diChiE = new Map();
  for (const riga of righeE) {
    const quale = pulito(riga?.entity_id);
    const suo = pulito(riga?.device_id);
    if (quale && suo && comeSiChiama.has(suo)) diChiE.set(quale, suo);
  }
  return {
    /* Di che dispositivo e' questa entita', o stringa vuota. E' anche il modo
     * di chiedere «questa e' di un dispositivo?». */
    diChiE: (entita) => diChiE.get(entita) || "",
    /* Come si chiama quel dispositivo, o stringa vuota se il nome non ce l'ha. */
    comeSiChiama: (suo) => comeSiChiama.get(suo) || "",
  };
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
  const quali = iDispositivi(registri);
  /* Senza i registri non si sa quali entita' siano di un dispositivo, e non si
   * indovina: tre `null`, che il quadro disegna «questa casa non lo dice». */
  if (!quali) return { totali: null, giu: null, dispositivi: null, nomi: [] };

  const dentro = elenco(stati).filter((uno) => quali.diChiE(pulito(uno?.entity_id)));
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
