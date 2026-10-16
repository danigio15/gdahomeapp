/* Le macchine del server e la rete di casa (#382).
 *
 * «Volevo chiedere se nei prossimi aggiornamenti si può aggiungere i controlli
 * del server proxmox dove gira HA con tutti i suoi container e controllare lo
 * stato del fritbox e i suoi ripeter.»
 *
 * Sono due elenchi, e li dichiara Home Assistant senza che nessuno debba
 * scriverli a mano:
 *
 *   · le MACCHINE — le VM e i container di Proxmox — sono `binary_sensor` con
 *     `device_class: running`, ed è l'integrazione Proxmox VE a metterceli;
 *   · la RETE — il router e i suoi ripetitori — sono `binary_sensor` con
 *     `device_class: connectivity`, ed è l'integrazione FritzBox (come ogni
 *     altra integrazione di rete) a metterceli.
 *
 * La classe da sola però non basta, ed è il difetto che questa parte corregge:
 * «la sezione mini pc porta in automatico tutte queste entità sotto che non si
 * eliminano e che non c'entrano nulla con quella sezione». `running` lo mette
 * Proxmox, ma anche la lavatrice, la stampante e il tagliaerba; `connectivity`
 * lo mette il FritzBox, ma anche ogni telefono, ogni tracker e ogni presa
 * Wi-Fi. In una casa vera sono decine, e toglierle una per una è un lavoro che
 * non finisce mai — appena si aggiunge un dispositivo, ricomincia.
 *
 * Quello che distingue un container dal ferro da stiro non sta nello stato:
 * sta in CHI ha creato l'entità. La classe dice di che tipo è, l'integrazione
 * dice di che cosa parla, e solo la seconda risponde alla domanda «è roba del
 * mio server?». Lo stato non la porta — la porta il registro di Home
 * Assistant, e la plancia se la fa dire dal comando `integrations/catalog`.
 *
 * Quindi: due classi per trovare i candidati, e le integrazioni scelte per
 * adottarli. Si spuntano una volta — «Proxmox VE», «FritzBox» — invece di
 * escludere trenta entità una alla volta, e un container nuovo entra da solo
 * mentre una lavatrice nuova resta fuori da sola. Finché non si è scelto
 * niente non si adotta niente: una sezione vuota si riempie in un gesto, una
 * piena di roba d'altri si svuota in trenta.
 *
 * Resta tutto il resto della configurazione, che serve a correggere: togliere
 * quello che non c'entra anche dentro un'integrazione scelta, aggiungere a
 * mano quello che nessuno ha etichettato, dare un nome leggibile a
 * «pve_qemu_103».
 *
 * Il COMANDO è la parte delicata. Un container si accende e si spegne solo se
 * Home Assistant offre qualcosa che sappia farlo, e nessuno può dedurlo dal
 * sensore: qui si guarda se esiste un interruttore o una coppia di pulsanti
 * che si chiamano come lui, e solo allora si offrono i tasti. Se non c'è, si
 * mostra lo stato e basta — un tasto che non fa niente è peggio di nessun
 * tasto.
 */

import { conLaRiga, conLeRighe, righeDichiarate, senzaLaRiga } from "./elenco-dichiarato.js";
import {
  eUnaLettura,
  elencoLetture,
  lettureDelDispositivo,
  lettureVicine,
} from "./letture-accanto.js";

const clean = (valore) => String(valore ?? "").trim();

/** Dove si scrive la configurazione. */
export const CHIAVE_MACCHINE = "cd_macchine";

/** Le due famiglie, con la classe che Home Assistant usa per dichiararle.
 *
 * `glifo` e' il nome di un disegno del catalogo di casa, non un'emoji (#74):
 * la scatola e le tacche del segnale cambiavano faccia da un telefono
 * all'altro, e una tacca di segnale come «rete» diceva meno di un router. E'
 * solo il punto di partenza: il disegno vero lo sceglie chi configura. */
export const FAMIGLIE = Object.freeze({
  macchine: { classe: "running", glifo: "server" },
  rete: { classe: "connectivity", glifo: "router" },
});

const MUTI = new Set(["unavailable", "unknown", "none", ""]);
/* Le parole che vogliono dire «in linea» quando la regola e' quella di tutti.
 *
 * Le prime sei sono quelle di sempre, e parlano la lingua dei `binary_sensor`.
 * Le altre sono quelle di un sensore qualunque che fa da sorvegliante (#177):
 * «ho un sistema di ping esterno» scrive `online` e `offline`, oppure `up` e
 * `down`, in un `sensor.*` — e con le sole sei la riga diceva «Assente» di un
 * apparecchio che rispondeva. Sono le stesse che gli «Altri nodi» capivano
 * gia': la stessa parola non vuol dire due cose in due schede. */
const ACCESI = new Set([
  "on",
  "true",
  "home",
  "connected",
  "running",
  "open",
  "online",
  "up",
  "connesso",
  "reachable",
  "raggiungibile",
]);

/**
 * La configurazione, ripulita: integrazioni scelte, escluse, aggiunte, nomi.
 *
 * `integrazioni` sono i domini da cui si adotta — `proxmoxve`, `fritz` — e
 * l'elenco vuoto vuol dire «nessuna»: è la differenza fra una sezione che
 * aspetta una spunta e una che si riempie di tutta la casa.
 */
export function normalizzaMacchine(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const integrazioni = (Array.isArray(dato.integrazioni) ? dato.integrazioni : [])
    .map(clean)
    .filter(Boolean);
  const escluse = (Array.isArray(dato.escluse) ? dato.escluse : [])
    .map(clean)
    .filter((entity) => entity.includes("."));
  const aggiunte = {};
  for (const [entity, famiglia] of Object.entries(
    dato.aggiunte && typeof dato.aggiunte === "object" ? dato.aggiunte : {},
  )) {
    const id = clean(entity);
    const quale = clean(famiglia);
    if (id.includes(".") && FAMIGLIE[quale]) aggiunte[id] = quale;
  }
  const nomi = {};
  for (const [entity, nome] of Object.entries(
    dato.nomi && typeof dato.nomi === "object" ? dato.nomi : {},
  )) {
    const id = clean(entity);
    const scritto = clean(nome);
    if (id.includes(".") && scritto) nomi[id] = scritto;
  }
  return {
    integrazioni: [...new Set(integrazioni)].sort(),
    escluse: [...new Set(escluse)],
    aggiunte,
    nomi,
  };
}

/**
 * Le entità di cui bisogna sapere l'integrazione prima di decidere.
 *
 * Sono i `binary_sensor` con una delle due classi: quelli e nessun altro. La
 * plancia ne chiede il registro in una volta sola — chiederlo per tutta la
 * casa sarebbe leggere migliaia di righe per guardarne trenta.
 */
export function candidateDaChiedere(states = {}) {
  const classi = new Set(Object.values(FAMIGLIE).map((dato) => dato.classe));
  return Object.entries(states || {})
    .filter(
      ([entity, stato]) =>
        clean(entity).startsWith("binary_sensor.") &&
        classi.has(clean(stato?.attributes?.device_class)),
    )
    .map(([entity]) => clean(entity));
}

/**
 * A quale famiglia appartiene questa entità: `"macchine"`, `"rete"` o `""`.
 *
 * Lo dicono in tre: la classe che Home Assistant le ha dato, l'integrazione da
 * cui arriva — `piattaforme[entity]`, che viene dal registro — e chi ha la
 * casa. Una esclusa non è di nessuna famiglia; una aggiunta a mano è di quella
 * che le si è detta, anche se Home Assistant non la dichiara e anche se la sua
 * integrazione non è fra le scelte; tutte le altre entrano solo se la classe e
 * l'integrazione dicono di sì tutte e due.
 *
 * Integrazione sconosciuta vuol dire fuori: finché il registro non ha
 * risposto, la plancia non tira a indovinare. Meglio una fascia che compare un
 * attimo dopo che una piena di roba da togliere.
 */
export function famigliaDi(entity, stato, config, piattaforme) {
  const id = clean(entity);
  const scelte = normalizzaMacchine(config);
  if (scelte.escluse.includes(id)) return "";
  if (scelte.aggiunte[id]) return scelte.aggiunte[id];
  if (!id.startsWith("binary_sensor.")) return "";
  const dominio = clean(piattaforme?.[id]);
  if (!dominio || !scelte.integrazioni.includes(dominio)) return "";
  const classe = clean(stato?.attributes?.device_class);
  for (const [famiglia, dato] of Object.entries(FAMIGLIE))
    if (dato.classe === classe) return famiglia;
  return "";
}

/**
 * Le integrazioni fra cui scegliere, con quante entità porterebbe ognuna.
 *
 * È il menù dell'editor: «Proxmox VE — 12 macchine», «FritzBox — 4 di rete».
 * Si contano i candidati veri, quelli che quella spunta adotterebbe davvero,
 * perché un numero che promette più di quello che arriva è peggio di nessun
 * numero. Le escluse a mano non si contano: sono già state guardate e messe
 * fuori.
 */
export function integrazioniDaScegliere(
  states = {},
  piattaforme,
  config,
  nomi = {},
  dispositivi = [],
) {
  const scelte = normalizzaMacchine(config);
  const conti = new Map();
  /* I server che non dichiarano l'acceso non porterebbero nessun candidato, e
   * senza candidati non comparivano qui: non c'era modo di spuntarli. Il loro
   * conto sono le macchine, cioe' i dispositivi che non dipendono da nessun
   * altro — il NAS si', la telecamera appesa al NAS no. */
  for (const dispositivo of dispositivi || []) {
    if (!dispositivo || clean(dispositivo.via_device)) continue;
    const domini = Array.isArray(dispositivo.integrations)
      ? dispositivo.integrations.map(clean)
      : [clean(dispositivo.integration)];
    for (const dominio of domini) {
      if (!SERVER_PER_DISPOSITIVO.has(dominio)) continue;
      const riga = conti.get(dominio) || { dominio, nome: "", macchine: 0, rete: 0, totale: 0 };
      riga.macchine += 1;
      riga.totale += 1;
      conti.set(dominio, riga);
    }
  }
  for (const entity of candidateDaChiedere(states)) {
    if (scelte.escluse.includes(entity)) continue;
    const dominio = clean(piattaforme?.[entity]);
    if (!dominio) continue;
    const classe = clean(states[entity]?.attributes?.device_class);
    const famiglia = Object.keys(FAMIGLIE).find((quale) => FAMIGLIE[quale].classe === classe);
    if (!famiglia) continue;
    const riga = conti.get(dominio) || { dominio, nome: "", macchine: 0, rete: 0, totale: 0 };
    riga[famiglia] += 1;
    riga.totale += 1;
    conti.set(dominio, riga);
  }
  return [...conti.values()]
    .map((riga) => ({
      ...riga,
      nome: clean(nomi?.[riga.dominio]) || riga.dominio,
      scelta: scelte.integrazioni.includes(riga.dominio),
    }))
    .sort((a, b) => b.totale - a.totale || a.nome.localeCompare(b.nome));
}

/* ── DA DOVE VIENE LO STATO (#177) ────────────────────────────────────────
 *
 * «Lo stato di ogni apparecchio me lo da' un sensore del mio sistema di ping.»
 * La regola di tutti — le parole di `ACCESI` — basta quasi sempre. Quando non
 * basta e' perche' quel sistema parla una lingua sua (`attivo`, `ok`, `200`)
 * oppure mette lo stato in un attributo e lascia nello stato qualcos'altro: e
 * allora lo dice chi configura, riga per riga. La regola sta nella riga, nel
 * campo `stato`:
 *
 *   · `modo` — `"auto"` (la regola di tutti) o `"mio"` (quella scritta qui);
 *   · `attributo` — cosa guardare: vuoto e' lo stato dell'entita', altrimenti
 *     il nome di uno dei suoi attributi;
 *   · `inLinea` — le parole che vogliono dire «in linea»;
 *   · `altrimenti` — cosa vuol dire tutto il resto: `"giu"` (assente) o
 *     `"muto"` (non risponde).
 *
 * `unavailable` e `unknown` restano muti in tutt'e due i modi: e' Home
 * Assistant a non sapere, e una regola scritta a mano non lo fa sapere di
 * piu'. Una riga senza il campo e' in automatico: chi aveva gia' configurato
 * non deve fare niente. */
export const MODI_DELLO_STATO = Object.freeze(["auto", "mio"]);
export const ALTRIMENTI_DELLO_STATO = Object.freeze(["giu", "muto"]);

/* Le parole si confrontano senza maiuscole e senza spazi intorno: «Online» e
 * «online » sono la stessa risposta. */
const parolaPulita = (valore) => clean(valore).toLowerCase();

/** La regola di una riga, ripulita. Senza niente di scritto e' l'automatico. */
export function regolaDelloStato(grezza) {
  const dato = grezza && typeof grezza === "object" && !Array.isArray(grezza) ? grezza : {};
  const parole = (Array.isArray(dato.inLinea) ? dato.inLinea : [])
    .map(parolaPulita)
    .filter((parola) => parola && !MUTI.has(parola));
  return {
    modo: dato.modo === "mio" ? "mio" : "auto",
    attributo: clean(dato.attributo),
    inLinea: [...new Set(parole)],
    altrimenti: dato.altrimenti === "muto" ? "muto" : "giu",
  };
}

/** La regola da scrivere nella riga, o `null` per l'automatico che nessuno ha
 * mai toccato: un campo vuoto nel salvataggio sarebbe rumore. */
export function regolaScritta(grezza) {
  const regola = regolaDelloStato(grezza);
  return regola.modo === "mio" || regola.attributo || regola.inLinea.length ? regola : null;
}

/* Le parole da cui parte chi passa a «Scelgo io»: quella che il sensore dice
 * adesso, se l'automatico la capisce gia', e poi le piu' comuni. Si parte da
 * una regola che da' lo stesso esito di prima, non da una vuota che dipinge
 * tutto di rosso al primo tocco. */
export function paroleDiPartenza(stato) {
  const adesso = parolaPulita(stato?.state);
  const prime = ACCESI.has(adesso) ? [adesso] : [];
  return [...new Set([...prime, "online", "on", "up"])];
}

/**
 * Il valore che la regola guarda adesso, scritto come si confronta.
 *
 * `null` quando l'entita' non c'e' fra gli stati. `muto` quando e' Home
 * Assistant a non sapere (`unavailable`, `unknown`): in quel caso nemmeno un
 * attributo si guarda, perche' quello che resta scritto li' e' l'ultima cosa
 * saputa, non quella di adesso.
 */
export function valoreDelloStato(stato, grezza) {
  if (!stato) return null;
  const dello = parolaPulita(stato.state);
  if (MUTI.has(dello)) return { valore: dello, muto: true };
  const regola = regolaDelloStato(grezza);
  if (regola.modo !== "mio" || !regola.attributo) return { valore: dello, muto: false };
  const attributo = stato.attributes?.[regola.attributo];
  const valore =
    attributo === null || attributo === undefined || typeof attributo === "object"
      ? ""
      : parolaPulita(attributo);
  return { valore, muto: MUTI.has(valore) };
}

/* Come sta: `"su"`, `"giu"` o `""` quando non risponde. Un container che non
 * risponde non è un container fermo — potrebbe essere il server a essere giù,
 * e dire «fermo» sarebbe una diagnosi inventata.
 *
 * Senza regola, o con la regola in automatico, e' quello di sempre con le
 * parole in piu' di `ACCESI`. Con la regola scritta (#177) contano le sue
 * parole, e quello che non e' fra quelle dice quello che ha scelto chi
 * configura. */
export function comeSta(stato, grezza) {
  const letto = valoreDelloStato(stato, grezza);
  if (!letto || letto.muto) return "";
  const regola = regolaDelloStato(grezza);
  if (regola.modo !== "mio") return ACCESI.has(letto.valore) ? "su" : "giu";
  if (regola.inLinea.includes(letto.valore)) return "su";
  return regola.altrimenti === "muto" ? "" : "giu";
}

/* Il nome dell'oggetto dentro l'entity_id, senza il suo dominio. */
const oggetto = (entity) => clean(entity).split(".").slice(1).join(".");

/**
 * I comandi di una macchina, se Home Assistant ne offre.
 *
 * Si cerca qualcosa che si chiami come lei: un `switch` con lo stesso nome
 * d'oggetto, oppure la coppia di pulsanti `_start` / `_stop` che l'integrazione
 * Proxmox crea accanto al sensore. Il nome del sensore spesso finisce per
 * `_status` o `_running`: quella coda si toglie prima di confrontare, perché
 * il pulsante non ce l'ha.
 *
 * Niente si inventa: se l'entità non esiste fra gli stati, il tasto non esce.
 */
export function comandiDellaMacchina(entity, states = {}) {
  const nome = oggetto(entity).replace(/_(status|state|running|acceso)$/i, "");
  if (!nome) return null;
  const c1 = `switch.${nome}`;
  if (states[c1]) return { tipo: "switch", entity: c1 };
  const avvia = `button.${nome}_start`;
  const ferma = `button.${nome}_stop`;
  if (states[avvia] && states[ferma]) return { tipo: "button", avvia, ferma };
  return null;
}

/**
 * Le integrazioni che raccontano una macchina senza dichiararne l'acceso (#411).
 *
 * Dal campo: «fra le vm riconoscere in automatico il synology, per evitare la
 * configurazione manuale». Synology DSM pubblica CPU, memoria, dischi, volumi,
 * temperatura — e nessun `binary_sensor` con `device_class: running`. Le due
 * classi non la trovano, quindi non compariva nemmeno fra le integrazioni da
 * spuntare: non c'era proprio modo di farla entrare, se non aggiungendo a mano
 * un'entita' alla volta. Ed e' esattamente la configurazione manuale che la
 * segnalazione chiede di evitare.
 *
 * Il patto della sezione resta quello: a dire se una cosa e' roba del server e'
 * l'integrazione, non il nome dell'entita'. Solo che per queste l'integrazione
 * non lo dichiara in nessuna classe, e allora lo si dichiara qui — un elenco
 * corto, di domini che sono un server o un NAS e basta. Aggiungerne un altro e'
 * una riga; indovinarlo dai nomi sarebbe la mezza casa adottata di prima.
 *
 * Queste si adottano per DISPOSITIVO, non per entita': il registro di Home
 * Assistant i dispositivi ce li ha, ed e' il fatto che manca.
 */
export const SERVER_PER_DISPOSITIVO = Object.freeze(new Set(["synology_dsm", "qnap", "glances"]));

/**
 * Quali di quelle si adottano adesso: quelle spuntate, e basta.
 *
 * Chi si fa da parte non e' l'integrazione: e' il singolo DISPOSITIVO che una
 * riga ce l'ha gia' — vedi `giaContatoPerClasse` qui sotto. Guardando
 * l'integrazione intera bastava un solo `connectivity` — un accessorio, un
 * processo di Glances — perche' tutti i NAS di quella marca sparissero dalla
 * pagina, lasciando in piedi soltanto la riga di quell'accessorio.
 */
export function integrazioniPerDispositivo(states = {}, piattaforme, config) {
  const scelte = normalizzaMacchine(config);
  return scelte.integrazioni.filter((dominio) => SERVER_PER_DISPOSITIVO.has(dominio));
}

/* L'entita' che da' il nome alla riga: si preferisce quella che parla dello
 * stato della macchina, e in mancanza la prima in ordine. Serve un nome fermo,
 * perche' e' quello che si scrive in `escluse` e in `nomi`: se cambiasse a
 * ogni lettura, togliere una riga non la toglierebbe. */
function rappresentanteDi(entita = []) {
  const ordinate = [...new Set(entita.map(clean).filter((id) => id.includes(".")))].sort();
  return ordinate.find((id) => /_(status|state|uptime)$/i.test(id)) || ordinate[0] || "";
}

/* Se questo dispositivo una riga ce l'ha gia' dalla strada delle classi.
 *
 * E' il «farsi da parte» detto per dispositivo e non per integrazione: quello
 * che conta e' se QUESTO server ha un `running` o un `connectivity` che entra
 * in fascia da solo, non se ce l'ha un accessorio della stessa marca. */
function giaContatoPerClasse(entita = [], states = {}, config, piattaforme) {
  return entita.some((id) => famigliaDi(id, states?.[id], config, piattaforme));
}

/* Come sta un dispositivo: acceso se almeno una delle sue entita' risponde.
 *
 * Un NAS spento — o staccato dalla rete — in Home Assistant non e' «off»: e'
 * `unavailable` su tutta la riga, perche' non c'e' piu' nessuno a rispondere.
 * Dire «fermo» sarebbe una diagnosi inventata, come per i container: si dice
 * che non risponde, ed e' quello che si sa. */
function comeStaIlDispositivo(entita = [], states = {}) {
  for (const id of entita) if (comeSta(states[id])) return "su";
  return "";
}

/**
 * Una riga per macchina, quando l'integrazione non dichiara nessun `running`.
 *
 * Si guardano i dispositivi, non le entita'. Un dispositivo che non dipende da
 * nessun altro — `via_device` vuoto — e' la macchina: il NAS, il router. Quelli
 * che gli sono appesi sono i suoi accessori — la telecamera della Surveillance
 * Station, il ripetitore — e in un elenco di macchine sarebbero rumore.
 *
 * Nessun tasto: un NAS non si accende da remoto, e spegnerlo con un tocco non
 * e' una cosa da offrire senza che nessuno l'abbia chiesta. Si dice come sta.
 */
export function macchineDeiDispositivi({
  dispositivi = [],
  entita = {},
  states = {},
  config,
  piattaforme = null,
} = {}) {
  const scelte = normalizzaMacchine(config);
  const senza = new Set(integrazioniPerDispositivo(states, piattaforme, config));
  if (!senza.size) return [];
  const righe = [];
  for (const dispositivo of dispositivi || []) {
    if (!dispositivo || clean(dispositivo.via_device)) continue;
    const domini = Array.isArray(dispositivo.integrations)
      ? dispositivo.integrations.map(clean)
      : [clean(dispositivo.integration)];
    if (!domini.some((dominio) => senza.has(dominio))) continue;
    const suoi = (entita[clean(dispositivo.id)] || []).map(clean).filter(Boolean);
    /* Se una sua entita' arriva gia' in fascia dalla strada delle classi, la
     * riga c'e': quella dice acceso e spento, questa solo «risponde», e due
     * righe per lo stesso NAS sarebbero lo stesso server elencato due volte. */
    if (giaContatoPerClasse(suoi, states, config, piattaforme)) continue;
    const rappresentante = rappresentanteDi(suoi);
    if (!rappresentante || scelte.escluse.includes(rappresentante)) continue;
    righe.push({
      entity: rappresentante,
      famiglia: "macchine",
      name: scelte.nomi[rappresentante] || clean(dispositivo.name) || rappresentante,
      glifo: FAMIGLIE.macchine.glifo,
      stato: comeStaIlDispositivo(suoi, states),
      comandi: null,
      dispositivo: clean(dispositivo.id),
    });
  }
  return righe;
}

/* ── L'ELENCO DICHIARATO (#74) ────────────────────────────────────────────
 *
 * La regola sta in `elenco-dichiarato.js`, ed e' la stessa dei Varchi, della
 * Presenza e delle Batterie. Qui la riga porta un campo in piu', `famiglia`:
 * una macchina e la rete stanno in due fasce diverse, e quale delle due lo
 * decide chi configura invece di dedurlo dalla classe.
 */
export { conLaRiga, conLeRighe, righeDichiarate, senzaLaRiga };

/** I campi in piu' che le righe delle macchine si portano dietro.
 *
 * `letture` sono le «Altre letture» della riga (#177): «ho un sistema di ping
 * esterno che per ogni apparecchio mi da' online, latenza, uptime, pacchetti
 * persi, ultima volta visto». L'entita' della riga dice solo se c'e' o non
 * c'e'; il resto sta in altri sensori accanto, e chi configura li sceglie uno
 * per uno, come per il robot, la TV e gli elettrodomestici. Passano da qui per
 * nome, come `famiglia`: un campo che non sta in questo elenco non arriva al
 * salvataggio, e le letture scelte sparirebbero alla prima riapertura.
 *
 * `stato` e' la regola che dice da dove vengono il «su» e il «giu» della riga
 * (#177): vedi `regolaDelloStato` qui sopra. Una riga che non ce l'ha e' in
 * automatico. */
export const CAMPI_IN_PIU = Object.freeze(["famiglia", "letture", "stato"]);

/** Le letture di una riga, ripulite: la regola e' quella di tutte le schede. */
export function lettureDellaRiga(riga) {
  return elencoLetture(riga?.letture);
}

/* Le code che dicono «e' su» invece di dire di chi si parla.
 *
 * `binary_sensor.nas_online` e `sensor.nas_latenza` sono lo stesso NAS, ma il
 * primo porta in coda la domanda a cui risponde. Per riconoscere i sensori
 * accanto si confronta la parte che resta, che e' il nome dell'apparecchio. */
const CODA_DELLO_STATO =
  /_(status|state|running|online|connection|connectivity|connesso|ping|reachable|raggiungibile|acceso)$/i;
const PAROLE_DELLO_STATO =
  /\s+(status|state|running|online|connection|connectivity|connesso|ping|reachable|raggiungibile|acceso)$/i;

/**
 * Le letture da proporre per una riga: i sensori che stanno accanto alla sua
 * entita'.
 *
 * Un sistema di ping chiama le sue entita' tutte allo stesso modo —
 * `binary_sensor.router_online`, `sensor.router_latency`,
 * `sensor.router_packet_loss` — e Proxmox fa lo stesso con la CPU e la memoria
 * di un container. Si propone quello che comincia come l'entita' della riga
 * senza la sua coda di stato, oppure il cui nome comincia col nome della riga.
 * L'ordine e quello che non si ripropone (le gia' scelte, l'entita' stessa) lo
 * decide `lettureVicine`, che e' la regola di tutte le «Altre letture».
 */
export function lettureProposteDellaMacchina(riga = {}, states = {}) {
  const entity = clean(riga?.entity);
  const radice = oggetto(entity).replace(CODA_DELLO_STATO, "");
  const nomi = [
    clean(riga?.name),
    clean(states?.[entity]?.attributes?.friendly_name).replace(PAROLE_DELLO_STATO, ""),
  ]
    .map((nome) => nome.toLowerCase())
    .filter((nome) => nome.length >= 2);
  if (!radice && !nomi.length) return [];
  const candidate = [];
  for (const [id, stato] of Object.entries(states || {})) {
    if (id === entity || !eUnaLettura(id)) continue;
    const suo = oggetto(id);
    const suoNome = clean(stato?.attributes?.friendly_name).toLowerCase();
    if (
      (radice && suo.startsWith(`${radice}_`)) ||
      nomi.some((nome) => suoNome.startsWith(`${nome} `))
    )
      candidate.push(id);
  }
  return lettureVicine({ entity, name: riga?.name, letture: riga?.letture }, states, candidate);
}

/** La configurazione senza le righe: e' quella su cui gira il rilevamento. */
function senzaLeRighe(config) {
  const dato = config && typeof config === "object" && !Array.isArray(config) ? config : {};
  const { righe: _via, ...resto } = dato;
  return resto;
}

/**
 * Le macchine che il rilevamento proporrebbe adesso.
 *
 * Serve a due cose, ed e' la stessa risposta: il ripiego di chi non ha mai
 * dichiarato niente, e quello che scrive il tasto «prendi quelle che Home
 * Assistant ha trovato». Le integrazioni spuntate contano ancora, ed e' il
 * loro mestiere: da quali marche si adotta. Quello che cambia e' che adesso
 * decidono cosa viene PROPOSTO, non cosa si vede — perche' quello che si vede
 * e' quello che uno ha scritto.
 */
export function macchineDaImportare(
  states = {},
  config,
  nomeDi = (entity) => entity,
  piattaforme = null,
  registro = {},
) {
  const elenchi = macchineERete(states, senzaLeRighe(config), nomeDi, piattaforme, registro);
  return [...elenchi.macchine, ...elenchi.rete].map((riga) => ({
    entity: riga.entity,
    name: riga.name,
    icon: FAMIGLIE[riga.famiglia]?.glifo || FAMIGLIE.macchine.glifo,
    famiglia: riga.famiglia,
  }));
}

/**
 * Gli elenchi: le macchine e la rete, letti e ordinati.
 *
 * Prima quello che è giù — è la ragione per cui uno apre questa pagina — poi i
 * muti, e in fondo quello che va. Dentro ogni gruppo, per nome.
 */
export function macchineERete(
  states = {},
  config,
  nomeDi = (entity) => entity,
  piattaforme = null,
  { dispositivi = [], entita = {} } = {},
) {
  const scelte = normalizzaMacchine(config);
  const elenchi = { macchine: [], rete: [] };
  const dichiarate = righeDichiarate(config, CAMPI_IN_PIU);
  if (dichiarate) {
    /* Una riga cominciata e non finita — c'e' il nome, manca l'entita' — sta
     * nella scheda e lo dice, ma qui non ci va: nel conto di quante sono giu'
     * sarebbe una macchina inventata. */
    for (const riga of dichiarate.filter((voce) => voce.entity)) {
      const famiglia = FAMIGLIE[riga.famiglia] ? riga.famiglia : "macchine";
      const name = clean(riga.name) || clean(nomeDi(riga.entity)) || riga.entity;
      const letture = lettureDellaRiga(riga);
      elenchi[famiglia].push({
        entity: riga.entity,
        famiglia,
        name,
        glifo: clean(riga.icon) || FAMIGLIE[famiglia].glifo,
        stato: comeSta(states?.[riga.entity], riga.stato),
        comandi: famiglia === "macchine" ? comandiDellaMacchina(riga.entity, states) : null,
        /* Le altre letture, gia' scritte (#177): il nome senza quello della
         * riga davanti — «NAS Latenza» sotto «NAS» e' «Latenza» — e il valore
         * con la sua unita'. Le scrive la stessa regola delle altre schede,
         * cosi' 12 ms e 3 giorni si leggono uguali dappertutto. */
        letture,
        valori: letture.length
          ? lettureDelDispositivo({ entity: riga.entity, name, letture }, states)
          : [],
      });
    }
    const peso = (riga) => (riga.stato === "giu" ? 0 : riga.stato === "" ? 1 : 2);
    for (const famiglia of Object.keys(elenchi))
      elenchi[famiglia].sort((a, b) => peso(a) - peso(b) || a.name.localeCompare(b.name));
    return elenchi;
  }
  /* I server che non dichiarano l'acceso entrano da qui, con la stessa forma
   * di riga: da questo punto in poi sono macchine come le altre — stesso
   * ordine, stesso conto, stessa fascia. */
  elenchi.macchine.push(
    ...macchineDeiDispositivi({ dispositivi, entita, states, config, piattaforme }),
  );
  for (const [entity, stato] of Object.entries(states || {})) {
    const famiglia = famigliaDi(entity, stato, config, piattaforme);
    if (!famiglia) continue;
    elenchi[famiglia].push({
      entity,
      famiglia,
      name: scelte.nomi[entity] || clean(nomeDi(entity)) || entity,
      glifo: FAMIGLIE[famiglia].glifo,
      stato: comeSta(stato),
      comandi: famiglia === "macchine" ? comandiDellaMacchina(entity, states) : null,
    });
  }
  const peso = (riga) => (riga.stato === "giu" ? 0 : riga.stato === "" ? 1 : 2);
  for (const famiglia of Object.keys(elenchi))
    elenchi[famiglia].sort((a, b) => peso(a) - peso(b) || a.name.localeCompare(b.name));
  return elenchi;
}

/** Il conto di un elenco: quanti su, quanti giù, quanti non rispondono. */
export function contoDelleMacchine(righe = []) {
  const tutte = Array.isArray(righe) ? righe : [];
  const su = tutte.filter((riga) => riga?.stato === "su");
  const muti = tutte.filter((riga) => !clean(riga?.stato));
  return {
    su: su.length,
    giu: tutte.length - su.length - muti.length,
    muti: muti.length,
    totale: tutte.length,
    fermi: tutte.filter((riga) => riga?.stato === "giu").map((riga) => clean(riga.name)),
  };
}

/** Se c'è qualcosa da mostrare in almeno una delle due famiglie. */
export function macchineConfigurate(states = {}, config, piattaforme = null, dai = {}) {
  const elenchi = macchineERete(states, config, undefined, piattaforme, dai);
  return elenchi.macchine.length > 0 || elenchi.rete.length > 0;
}
