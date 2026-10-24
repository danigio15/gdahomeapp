/* Le automazioni della casa: Quando · Solo se · Allora.
 *
 * «Quando succede qualcosa — un orario, una porta, un movimento, un valore,
 * chi arriva o esce — la casa fa da sola quello che le dici.» Le scrive chi
 * configura la plancia, e le esegue Home Assistant: la plancia le salva come
 * automazioni vere, e le traduce `core/automazioni-ha.js`.
 *
 * Questo file e' la forma comoda: la plancia lo importa per pulire quello
 * che salva e per raccontarlo («Si legge così: …»), il traduttore per sapere
 * quali servizi scegliere. I conti qui sotto — quando scatta un QUANDO, se
 * vale un SOLO SE — li faceva il motore dell'add-on, che non c'e' piu': ne
 * restano vivi il «prossimo» della plancia e i servizi delle azioni, e il
 * resto racconta la stessa regola che adesso scrive Home Assistant.
 *
 * Qui non c'e' DOM, non c'e' un filo e non c'e' un orologio.
 *
 * ── La forma ──────────────────────────────────────────────────────────────
 *
 *   { id, nome, attiva, quando: {tipo, …}, soloSe: [≤2], allora: [in ordine] }
 *
 * e il cronotermostato, che una frase sola non racconta: due temperature,
 * due giornate tipo e la finestra che lo spegne,
 *
 *   { id, nome, attiva, tipo: "crono", crono: {…} }
 *
 * e le due del Pianificatore: la **routine a orari** — a quell'ora fai
 * quelle cose, quei giorni, in quel periodo dell'anno —
 *
 *   { id, nome, attiva, tipo: "routine", routine: {giorni, periodo, passi},
 *     soloSe, tutte }
 *
 * e il **calendario a fasce** — quelle cose accese nelle fasce di ogni
 * giorno, spente fuori —
 *
 *   { id, nome, attiva, tipo: "fasce", fasce: {entita, giorni, periodo, fuori} }
 *
 * «Ultima volta» non sta qui: la sa Home Assistant (`last_triggered`), e il
 * ponte la dice alla plancia con l'elenco (`ponte/automazioni/stato`).
 *
 * ── Cosa la casa NON fa ───────────────────────────────────────────────────
 *
 * Le azioni sono un elenco chiuso, e ognuna diventa un servizio di Home
 * Assistant scelto qui — `light.turn_on`, `cover.close_cover` — e mai uno
 * scritto da chi salva. Le entita' devono essere del dominio giusto: una
 * «tapparella» che e' una serratura non si apre. Le serrature non si aprono
 * proprio, nemmeno passando da un'azione della plancia, e nemmeno le azioni
 * che la plancia fa confermare: una porta di casa che si apre da sola alle tre
 * di notte non e' una comodita'.
 */

const pulito = (valore) => String(valore ?? "").trim();

export const MINUTO = 60_000;
const ORA = 60 * MINUTO;
const GIORNO = 24 * ORA;

/* Dove stanno: nella configurazione della plancia, che viaggia fra i
 * dispositivi e che la casa legge dalla plancia principale. */
export const CHIAVE_AUTOMAZIONI = "cd_automazioni";

/* Quante se ne leggono in un elenco: quelle di Home Assistant possono essere
 * tante, e la plancia le mostra tutte. */
export const AUTOMAZIONI_AL_MASSIMO = 500;
/* Due condizioni bastano quasi sempre, e la pagina ne propone due; chi vuole
 * di piu' — «tutte» o «almeno una» — arriva a quattro. */
export const CONDIZIONI_AL_MASSIMO = 4;
export const AZIONI_AL_MASSIMO = 12;
export const ORARI_AL_MASSIMO = 4;
export const ENTITA_AL_MASSIMO = 10;
export const TERMOSTATI_AL_MASSIMO = 6;
export const FASCE_AL_MASSIMO = 6;
/* Un «aspetta» piu' lungo di dodici ore non e' un'attesa: e' un'altra
 * automazione a un altro orario. */
export const ASPETTA_AL_MASSIMO = 12 * 60;

export const QUANDO = Object.freeze([
  "orario",
  "apertura",
  "movimento",
  "valore",
  "persone",
  "antifurto",
  "elettrodomestico",
  /* I QUANDO generici, per chi vuole tutto Home Assistant e non solo le cose
   * di casa che la plancia conosce: un'entita' qualsiasi che cambia stato,
   * un attributo che cambia, un evento del bus (il tasto Zigbee che manda
   * `zha_event`), e un battito ogni N minuti. */
  "stato",
  "attributo",
  "evento",
  "ogni",
]);
export const SOLO_SE = Object.freeze([
  "notte",
  "fascia",
  "giorni",
  "casa",
  "stato",
  "valore",
  "uguale",
  "attributo",
  "sole",
]);
export const ALLORA = Object.freeze([
  "accendi",
  "spegni",
  "tapparella",
  "clima",
  "azione",
  "notifica",
  "aspetta",
  "imposta",
  "media",
  "aspettaChe",
  "servizio",
]);

/* Le modalita' di una automazione che riscatta mentre e' ancora in corso:
 * ricomincia da capo (il movimento che torna rimette i due minuti della
 * luce), ignora il nuovo scatto, o lo mette in coda dopo quello in corso. */
export const MODI = Object.freeze(["ricomincia", "ignora", "coda"]);

/* I domini che ogni azione accetta. «Accendi» vale per tutto quello che si
 * accende e per quello che si fa partire (uno script, una scena, un tasto);
 * «spegni» solo per quello che si spegne davvero. */
export const DOMINI = Object.freeze({
  accendi: Object.freeze([
    "light",
    "switch",
    "fan",
    "input_boolean",
    "automation",
    "humidifier",
    "media_player",
    "script",
    "scene",
    "button",
    "input_button",
  ]),
  spegni: Object.freeze([
    "light",
    "switch",
    "fan",
    "input_boolean",
    "automation",
    "humidifier",
    "media_player",
  ]),
  tapparella: Object.freeze(["cover"]),
  clima: Object.freeze(["climate"]),
  apertura: Object.freeze(["binary_sensor", "cover", "lock"]),
  movimento: Object.freeze(["binary_sensor"]),
  valore: Object.freeze(["sensor", "number", "input_number"]),
  persone: Object.freeze(["person", "device_tracker"]),
  antifurto: Object.freeze(["alarm_control_panel"]),
  elettrodomestico: Object.freeze(["sensor"]),
  finestre: Object.freeze(["binary_sensor"]),
  imposta: Object.freeze([
    "input_number",
    "number",
    "input_select",
    "select",
    "input_text",
    "text",
    "input_boolean",
  ]),
  media: Object.freeze(["media_player"]),
});

/* «Chiama un servizio di Home Assistant»: l'ALLORA per chi sa cosa fa, dietro
 * «Altro…». Si chiama col filo dell'add-on, che in Home Assistant puo' tutto,
 * e allora non tutto passa. Fuori restano:
 *  - quello che apre la casa o la lascia senza difese: le serrature che si
 *    aprono, l'antifurto che si disinserisce, il cancello del garage non e'
 *    qui perche' `cover` serve a tutte le tapparelle;
 *  - quello che spegne o riscrive Home Assistant stesso: riavvii, arresti,
 *    ricariche, il Supervisor, i backup, gli aggiornamenti, il recorder;
 *  - quello che esegue codice: comandi di shell, script Python.
 * Le notifiche e tutto il resto passano: e' la stessa porta che apre chi
 * amministra la configurazione, e quella la apre gia' solo lui. */
const DOMINI_CHIUSI = new Set([
  "hassio",
  "backup",
  "recorder",
  "shell_command",
  "command_line",
  "python_script",
  "pyscript",
  "hacs",
  "update",
  "system_log",
  "logger",
  "auth",
  "cloud",
  "homeassistant_alerts",
  "zha",
  "mqtt",
]);
const SERVIZI_CHIUSI = new Set([
  "lock.unlock",
  "lock.open",
  "alarm_control_panel.alarm_disarm",
  "homeassistant.restart",
  "homeassistant.stop",
  "homeassistant.reload_all",
  "homeassistant.reload_core_config",
  "homeassistant.reload_config_entry",
  "homeassistant.set_location",
  "homeassistant.save_persistent_states",
]);
const SERVIZIO_BUONO = /^([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)$/;

/** Se la casa accetta di chiamare `dominio.servizio` da sola. */
export function servizioPermesso(scritto) {
  const m = SERVIZIO_BUONO.exec(pulito(scritto).toLowerCase());
  if (!m) return false;
  if (DOMINI_CHIUSI.has(m[1]) || SERVIZI_CHIUSI.has(`${m[1]}.${m[2]}`)) return false;
  /* Le ricariche di qualunque integrazione, anche quelle scritte domani. */
  if (m[2] === "reload" || m[2].startsWith("reload_")) return false;
  return true;
}

const ENTITA_BUONA = /^[a-z_]+\.[a-z0-9_]+$/;
const ORA_BUONA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const dominioDi = (id) => pulito(id).split(".")[0];

function entitaDi(valore, domini = null) {
  const id = pulito(valore).toLowerCase().slice(0, 255);
  if (!ENTITA_BUONA.test(id)) return "";
  if (domini && !domini.includes(dominioDi(id))) return "";
  return id;
}

function elencoDiEntita(valore, domini, quante = ENTITA_AL_MASSIMO) {
  const elenco = Array.isArray(valore) ? valore : pulito(valore) ? [valore] : [];
  return [...new Set(elenco.map((v) => entitaDi(v, domini)).filter(Boolean))].slice(0, quante);
}

function numero(valore) {
  if (valore === null || valore === undefined || valore === "") return null;
  const n = Number(String(valore).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const fra = (n, min, max) => Math.max(min, Math.min(max, n));

function intero(valore, min, max, ripiego) {
  const n = numero(valore);
  return n === null ? ripiego : fra(Math.round(n), min, max);
}

function ora(valore, ripiego = "") {
  const testo = pulito(valore);
  if (ORA_BUONA.test(testo)) return testo;
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(testo);
  if (m && Number(m[1]) < 24 && Number(m[2]) < 60) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return ripiego;
}

export function minutiDi(testo) {
  const scritto = ora(testo);
  if (!scritto) return null;
  const [h, m] = scritto.split(":").map(Number);
  return h * 60 + m;
}

export const oraDiMinuti = (minuti) => {
  const m = ((Math.round(minuti) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

function giorniDi(valore) {
  return Array.isArray(valore) && valore.length === 7
    ? valore.map((g) => g === true)
    : [true, true, true, true, true, true, true];
}

function leggiJson(valore) {
  if (valore && typeof valore === "object") return valore;
  if (typeof valore !== "string") return null;
  try {
    return JSON.parse(valore);
  } catch (_errore) {
    return null;
  }
}

/** Lunedi' 0, domenica 6: l'ordine dei tasti L M M G V S D. */
export const giornoDellaSettimana = (istante) => (new Date(istante).getDay() + 6) % 7;

/* Le ore si contano sul calendario e non a millisecondi: il giorno del cambio
 * dell'ora dura ventitre' ore o venticinque, e «alle 7» resta alle 7. */
function alleOre(istante, piuGiorni, minuti) {
  const d = new Date(istante);
  d.setDate(d.getDate() + piuGiorni);
  d.setHours(Math.floor(minuti / 60), minuti % 60, 0, 0);
  return d.getTime();
}

const minutiDelGiorno = (istante) => {
  const d = new Date(istante);
  return d.getHours() * 60 + d.getMinutes();
};

/* ── pulire quello che arriva ───────────────────────────────────────────── */

export function quandoPulito(dato) {
  const d = dato && typeof dato === "object" ? dato : {};
  const tipo = QUANDO.includes(d.tipo) ? d.tipo : "orario";
  if (tipo === "orario") {
    const ore = [...new Set((Array.isArray(d.ore) ? d.ore : [d.ore]).map((o) => ora(o)))]
      .filter(Boolean)
      .slice(0, ORARI_AL_MASSIMO);
    const sole = ["alba", "tramonto"].includes(d.sole) ? d.sole : "";
    return {
      tipo,
      ore: ore.length || sole ? ore : ["07:00"],
      sole,
      scarto: intero(d.scarto, -180, 180, 0),
      giorni: giorniDi(d.giorni),
    };
  }
  if (tipo === "apertura")
    return {
      tipo,
      entita: elencoDiEntita(d.entita, DOMINI.apertura),
      verso: d.verso === "chiude" ? "chiude" : "apre",
    };
  if (tipo === "movimento")
    return {
      tipo,
      entita: elencoDiEntita(d.entita, DOMINI.movimento),
      verso: d.verso === "no" ? "no" : "si",
      minuti: intero(d.minuti, 1, 240, 5),
    };
  if (tipo === "valore")
    return {
      tipo,
      entita: entitaDi(d.entita, DOMINI.valore),
      verso: d.verso === "sotto" ? "sotto" : "sopra",
      soglia: numero(d.soglia) ?? 0,
    };
  if (tipo === "persone")
    return {
      tipo,
      verso: ["arriva", "esce", "tuttiFuori"].includes(d.verso) ? d.verso : "arriva",
      chi: elencoDiEntita(d.chi, DOMINI.persone),
    };
  if (tipo === "antifurto")
    return {
      tipo,
      entita: entitaDi(d.entita, DOMINI.antifurto),
      verso: ["inserito", "disinserito", "suona"].includes(d.verso) ? d.verso : "inserito",
    };
  if (tipo === "stato")
    return {
      tipo,
      entita: elencoDiEntita(d.entita),
      da: testoBreve(d.da),
      a: testoBreve(d.a),
      per: intero(d.per, 0, 240, 0),
    };
  if (tipo === "attributo")
    return {
      tipo,
      entita: entitaDi(d.entita),
      attributo: nomeDi(d.attributo),
      valore: testoBreve(d.valore),
    };
  if (tipo === "evento") return { tipo, evento: nomeDi(d.evento), filtro: filtroPulito(d.filtro) };
  if (tipo === "ogni") return { tipo, minuti: intero(d.minuti, 5, 1440, 30) };
  return {
    tipo,
    entita: entitaDi(d.entita, DOMINI.elettrodomestico),
    soglia: fra(numero(d.soglia) ?? 5, 0.5, 5000),
    minuti: intero(d.minuti, 1, 60, 3),
  };
}

/* Uno stato o un valore scritto a mano: corto, una riga. */
const testoBreve = (v) =>
  pulito(v)
    .replace(/[\r\n]+/g, " ")
    .slice(0, 80);
/* Il nome di un attributo o di un evento: lettere, cifre, sottolineature. */
const nomeDi = (v) =>
  pulito(v)
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 60);

/* Il filtro di un evento: coppie chiave = valore che i dati dell'evento devono
 * avere («command = on», «device_ieee = …»). Al piu' sei. */
function filtroPulito(v) {
  const fuori = {};
  const coppie = v && typeof v === "object" && !Array.isArray(v) ? Object.entries(v) : [];
  for (const [k, x] of coppie.slice(0, 6)) {
    const chiave = nomeDi(k);
    if (chiave) fuori[chiave] = testoBreve(x);
  }
  return fuori;
}

/* I dati di un servizio scritti a mano: un oggetto piatto o con un livello
 * sotto, al piu' venti campi, e niente che non sia JSON. */
function datiPuliti(v) {
  const letto = typeof v === "string" ? leggiJson(v) : v;
  if (!letto || typeof letto !== "object" || Array.isArray(letto)) return {};
  const fuori = {};
  for (const [k, x] of Object.entries(letto).slice(0, 20)) {
    const chiave = nomeDi(k);
    if (!chiave || chiave === "entity_id") continue;
    if (x === null || ["string", "number", "boolean"].includes(typeof x))
      fuori[chiave] = typeof x === "string" ? x.slice(0, 200) : x;
    else if (Array.isArray(x)) fuori[chiave] = x.slice(0, 20).filter((y) => typeof y !== "object");
    else if (typeof x === "object") fuori[chiave] = datiPuliti(JSON.stringify(x));
  }
  return fuori;
}

export function condizionePulita(dato) {
  const d = dato && typeof dato === "object" ? dato : {};
  if (!SOLO_SE.includes(d.tipo)) return null;
  const tipo = d.tipo;
  /* «Di notte» e' fra il tramonto e l'alba; con due orari scritti, fra
   * quelli: «è notte fra 23:00 e 06:00». */
  if (tipo === "notte") return { tipo, da: ora(d.da), a: ora(d.a) };
  if (tipo === "fascia") return { tipo, da: ora(d.da, "08:00"), a: ora(d.a, "20:00") };
  if (tipo === "giorni") return { tipo, giorni: giorniDi(d.giorni) };
  if (tipo === "casa") return { tipo, chi: d.chi === "nessuno" ? "nessuno" : "qualcuno" };
  if (tipo === "stato") {
    const entita = entitaDi(d.entita);
    return entita ? { tipo, entita, vale: d.vale === "spento" ? "spento" : "acceso" } : null;
  }
  if (tipo === "sole") return { tipo, posizione: d.posizione === "sotto" ? "sotto" : "sopra" };
  if (tipo === "uguale") {
    const entita = entitaDi(d.entita);
    return entita ? { tipo, entita, valore: testoBreve(d.valore), non: d.non === true } : null;
  }
  if (tipo === "attributo") {
    const entita = entitaDi(d.entita);
    return entita
      ? {
          tipo,
          entita,
          attributo: nomeDi(d.attributo),
          confronto: ["uguale", "sopra", "sotto"].includes(d.confronto) ? d.confronto : "uguale",
          valore: testoBreve(d.valore),
        }
      : null;
  }
  const entita = entitaDi(d.entita, DOMINI.valore);
  return entita
    ? {
        tipo,
        entita,
        verso: d.verso === "sotto" ? "sotto" : "sopra",
        soglia: numero(d.soglia) ?? 0,
      }
    : null;
}

/* «Accendi» e «spegni» valgono per ogni entita' che Home Assistant sa
 * accendere — la tendina propone le solite, la ricerca trova tutte le altre,
 * e quelle si comandano con `homeassistant.turn_on`. Mai le serrature e
 * l'antifurto: «accendi» una serratura vorrebbe dire aprirla. */
const MAI_SULLE_COSE = new Set(["lock", "alarm_control_panel"]);
const sulleCose = (valore) =>
  elencoDiEntita(valore).filter((e) => !MAI_SULLE_COSE.has(dominioDi(e)));

export function azionePulita(dato) {
  const d = dato && typeof dato === "object" ? dato : {};
  if (!ALLORA.includes(d.tipo)) return null;
  const tipo = d.tipo;
  if (tipo === "aspetta") return { tipo, minuti: intero(d.minuti, 1, ASPETTA_AL_MASSIMO, 2) };
  if (tipo === "notifica") {
    const testo = pulito(d.testo).slice(0, 160);
    return testo ? { tipo, testo } : null;
  }
  if (tipo === "azione") {
    const nome = pulito(d.nome).slice(0, 80);
    return nome ? { tipo, nome } : null;
  }
  /* Le azioni sulle cose prendono una o piu' entita': «accendi queste luci». */
  if (tipo === "accendi") {
    const entita = sulleCose(d.entita);
    if (!entita.length) return null;
    const livello = entita.some((e) => dominioDi(e) === "light")
      ? intero(d.livello, 1, 100, null)
      : null;
    return livello === null ? { tipo, entita } : { tipo, entita, livello };
  }
  if (tipo === "spegni") {
    const entita = sulleCose(d.entita).filter(
      (e) => !["script", "scene", "button", "input_button"].includes(dominioDi(e)),
    );
    return entita.length ? { tipo, entita } : null;
  }
  if (tipo === "tapparella") {
    const entita = elencoDiEntita(d.entita, DOMINI.tapparella);
    if (!entita.length) return null;
    const modo = ["apri", "chiudi", "posizione"].includes(d.modo) ? d.modo : "apri";
    return modo === "posizione"
      ? { tipo, entita, modo, posizione: intero(d.posizione, 0, 100, 50) }
      : { tipo, entita, modo };
  }
  if (tipo === "clima") {
    const entita = elencoDiEntita(d.entita, DOMINI.clima);
    if (!entita.length) return null;
    return d.modo === "spegni"
      ? { tipo, entita, modo: "spegni" }
      : { tipo, entita, modo: "temperatura", gradi: fra(numero(d.gradi) ?? 21, 5, 35) };
  }
  if (tipo === "imposta") {
    const entita = entitaDi(d.entita, DOMINI.imposta);
    return entita ? { tipo, entita, valore: testoBreve(d.valore) } : null;
  }
  if (tipo === "media") {
    const entita = elencoDiEntita(d.entita, DOMINI.media);
    if (!entita.length) return null;
    const comando = ["play", "pausa", "stop", "successivo", "volume", "sorgente"].includes(
      d.comando,
    )
      ? d.comando
      : "play";
    return comando === "volume"
      ? { tipo, entita, comando, valore: String(intero(d.valore, 0, 100, 30)) }
      : comando === "sorgente"
        ? { tipo, entita, comando, valore: testoBreve(d.valore) }
        : { tipo, entita, comando };
  }
  /* «Aspetta finche'…»: un'entita' che diventa uno stato, con un tempo
   * massimo. Passato quello si va avanti lo stesso: una luce che resta accesa
   * perche' un sensore non risponde e' peggio di una che si spegne. */
  if (tipo === "aspettaChe") {
    const entita = entitaDi(d.entita);
    return entita
      ? {
          tipo,
          entita,
          stato: testoBreve(d.stato) || "off",
          massimo: intero(d.massimo, 1, ASPETTA_AL_MASSIMO, 10),
        }
      : null;
  }
  const servizio = pulito(d.servizio).toLowerCase();
  if (!servizioPermesso(servizio)) return null;
  return { tipo, servizio, entita: elencoDiEntita(d.entita), dati: datiPuliti(d.dati) };
}

/* Le fasce di una giornata tipo: mezz'ore intere, ordinate, senza buchi fra
 * due fasce che si toccano. `[[390, 480], [1050, 1350]]` vuol dire dalle 6:30
 * alle 8 e dalle 17:30 alle 22:30. */
export function fascePulite(valore) {
  const mezzore = new Array(48).fill(false);
  for (const una of Array.isArray(valore) ? valore : []) {
    if (!Array.isArray(una) || una.length !== 2) continue;
    const da = fra(Math.round(Number(una[0]) / 30), 0, 48);
    const a = fra(Math.round(Number(una[1]) / 30), 0, 48);
    if (!Number.isFinite(da) || !Number.isFinite(a)) continue;
    for (let i = da; i < a; i += 1) mezzore[i] = true;
  }
  return fasceDalleMezzore(mezzore);
}

export function fasceDalleMezzore(mezzore) {
  const fasce = [];
  let inizio = -1;
  for (let i = 0; i <= 48; i += 1) {
    const piena = i < 48 && mezzore[i] === true;
    if (piena && inizio < 0) inizio = i;
    if (!piena && inizio >= 0) {
      fasce.push([inizio * 30, i * 30]);
      inizio = -1;
    }
  }
  return fasce.slice(0, FASCE_AL_MASSIMO);
}

export function mezzoreDelleFasce(fasce) {
  const mezzore = new Array(48).fill(false);
  for (const [da, a] of fascePulite(fasce))
    for (let i = da / 30; i < a / 30; i += 1) mezzore[i] = true;
  return mezzore;
}

export const CRONO_DI_SERIE = Object.freeze({
  termostati: Object.freeze([]),
  inCasa: 21,
  fuori: 18,
  feriali: Object.freeze([Object.freeze([360, 480]), Object.freeze([1020, 1320])]),
  festivi: Object.freeze([Object.freeze([480, 1320])]),
  finestre: Object.freeze([]),
  finestraSpegne: true,
});

export function cronoPulito(dato) {
  const d = dato && typeof dato === "object" ? dato : {};
  const gradi = (v, ripiego) => fra(Math.round((numero(v) ?? ripiego) * 2) / 2, 5, 30);
  return {
    termostati: elencoDiEntita(d.termostati, DOMINI.clima, TERMOSTATI_AL_MASSIMO),
    inCasa: gradi(d.inCasa, CRONO_DI_SERIE.inCasa),
    fuori: gradi(d.fuori, CRONO_DI_SERIE.fuori),
    feriali: fascePulite(d.feriali ?? CRONO_DI_SERIE.feriali),
    festivi: fascePulite(d.festivi ?? CRONO_DI_SERIE.festivi),
    finestre: elencoDiEntita(d.finestre, DOMINI.finestre),
    finestraSpegne: d.finestraSpegne !== false,
  };
}

/* ── il Pianificatore ─────────────────────────────────────────────────────
 *
 * «Creare delle routine su orari e periodi», e i calendari a fasce acceso
 * e spento. Il periodo e' fra due giorni dell'anno («dal 15 ottobre al 15
 * aprile»), e si ripete ogni anno, anche a cavallo di capodanno. */
export const PASSI_AL_MASSIMO = 8;
export const AZIONI_PER_PASSO = 6;
const GIORNO_DELL_ANNO = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function periodoPulito(valore) {
  const da = pulito(valore?.da);
  const a = pulito(valore?.a);
  return GIORNO_DELL_ANNO.test(da) && GIORNO_DELL_ANNO.test(a) && da !== a ? { da, a } : null;
}

/** Se `adesso` sta nel periodo (`null`: tutto l'anno). */
export function nelPeriodo(periodo, adesso) {
  if (!periodo) return true;
  const d = new Date(adesso);
  const oggi = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return periodo.da <= periodo.a
    ? oggi >= periodo.da && oggi <= periodo.a
    : oggi >= periodo.da || oggi <= periodo.a;
}

export function routinePulita(dato) {
  const d = dato && typeof dato === "object" ? dato : {};
  const viste = new Set();
  const passi = [];
  for (const p of Array.isArray(d.passi) ? d.passi : []) {
    const ora = pulito(p?.ora);
    if (!ORA_BUONA.test(ora) || viste.has(ora)) continue;
    viste.add(ora);
    passi.push({
      ora,
      allora: (Array.isArray(p.allora) ? p.allora : [])
        .map(azionePulita)
        .filter(Boolean)
        .slice(0, AZIONI_PER_PASSO),
    });
  }
  passi.sort((x, y) => x.ora.localeCompare(y.ora));
  return {
    giorni: giorniDi(d.giorni),
    periodo: periodoPulito(d.periodo),
    passi: passi.slice(0, PASSI_AL_MASSIMO),
  };
}

export const CALENDARIO_DI_SERIE = Object.freeze({
  feriale: Object.freeze([Object.freeze([390, 510]), Object.freeze([1050, 1350])]),
  festivo: Object.freeze([Object.freeze([480, 1380])]),
});

export function calendarioPulito(dato) {
  const d = dato && typeof dato === "object" ? dato : {};
  const giorni = [];
  for (let i = 0; i < 7; i += 1)
    giorni.push(
      fascePulite(
        Array.isArray(d.giorni) && Array.isArray(d.giorni[i])
          ? d.giorni[i]
          : i < 5
            ? CALENDARIO_DI_SERIE.feriale
            : CALENDARIO_DI_SERIE.festivo,
      ),
    );
  return {
    entita: elencoDiEntita(d.entita, DOMINI.accendi),
    giorni,
    periodo: periodoPulito(d.periodo),
    fuori: d.fuori === "lascia" ? "lascia" : "spegni",
  };
}

/* Gli id di Home Assistant: quelli che scrive la sua pagina sono cifre, ma
 * chi le scrive a mano ci mette quello che vuole. */
const ID_BUONO = /^[a-z0-9_-]{1,64}$/i;

/** Un'automazione, ripulita. `null` se non sta in piedi. */
export function automazionePulita(dato) {
  const d = dato && typeof dato === "object" && !Array.isArray(dato) ? dato : null;
  if (!d) return null;
  const id = ID_BUONO.test(pulito(d.id)) ? pulito(d.id) : "";
  if (!id) return null;
  const nome = pulito(d.nome).slice(0, 60);
  const attiva = d.attiva !== false;
  /* «Attiva fino al…» o «spenta fino al…»: la data in cui cambia da sola. */
  const data = /^\d{4}-\d{2}-\d{2}$/.test(pulito(d.scadenza?.data)) ? pulito(d.scadenza.data) : "";
  const scadenza = data
    ? { data, stato: d.scadenza?.stato === "attiva" ? "attiva" : "spenta" }
    : null;
  const extra = scadenza ? { scadenza } : {};
  if (d.tipo === "crono")
    return { id, nome, attiva, ...extra, tipo: "crono", crono: cronoPulito(d.crono) };
  if (d.tipo === "fasce")
    return { id, nome, attiva, ...extra, tipo: "fasce", fasce: calendarioPulito(d.fasce) };
  const soloSe = (Array.isArray(d.soloSe) ? d.soloSe : [])
    .map(condizionePulita)
    .filter(Boolean)
    .slice(0, CONDIZIONI_AL_MASSIMO);
  if (d.tipo === "routine")
    return {
      id,
      nome,
      attiva,
      ...extra,
      tipo: "routine",
      routine: routinePulita(d.routine),
      soloSe,
      tutte: d.tutte !== false,
    };
  const allora = (Array.isArray(d.allora) ? d.allora : [])
    .map(azionePulita)
    .filter(Boolean)
    .slice(0, AZIONI_AL_MASSIMO);
  return {
    id,
    nome,
    attiva,
    ...extra,
    tipo: "regola",
    quando: quandoPulito(d.quando),
    soloSe,
    /* «Tutte» le condizioni, o «almeno una». */
    tutte: d.tutte !== false,
    allora,
    modo: MODI.includes(d.modo) ? d.modo : "ricomincia",
    /* «Non piu' di una volta ogni X minuti». */
    pausa: intero(d.pausa, 0, 1440, 0),
  };
}

const chiaveDelGiornoDi = (istante) => {
  const d = new Date(istante);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Se un'automazione vale adesso: l'interruttore, e la data in cui cambia da
 * sola. «Spenta fino al 3 novembre» torna attiva il 3; «attiva fino al 3»
 * smette il 3. Una data passata non cambia piu' niente: vale l'interruttore.
 */
export function eAttivaAdesso(a, adesso) {
  if (!a?.attiva) return false;
  if (!a.scadenza) return true;
  const oggi = chiaveDelGiornoDi(adesso);
  if (a.scadenza.stato === "spenta") return oggi >= a.scadenza.data;
  return oggi < a.scadenza.data;
}

/** L'elenco salvato: l'array o il suo JSON, ripulito, senza id doppi. */
export function automazioniPulite(valore) {
  const letto = leggiJson(valore);
  const visti = new Set();
  const fuori = [];
  for (const una of Array.isArray(letto) ? letto : []) {
    const buona = automazionePulita(una);
    if (!buona || visti.has(buona.id)) continue;
    visti.add(buona.id);
    fuori.push(buona);
    if (fuori.length >= AUTOMAZIONI_AL_MASSIMO) break;
  }
  return fuori;
}

/** Un id nuovo, corto e leggibile. `caso` lo passano le prove. */
export function nuovoId(adesso = Date.now(), caso = Math.random()) {
  return `a${Math.floor(adesso).toString(36)}${Math.floor(caso * 1296)
    .toString(36)
    .padStart(2, "0")}`;
}

/** Un'automazione che si puo' salvare: ha un QUANDO completo e almeno un ALLORA. */
export function eCompleta(a) {
  if (!a) return false;
  if (a.tipo === "crono") return a.crono.termostati.length > 0;
  if (a.tipo === "fasce") return a.fasce.entita.length > 0;
  if (a.tipo === "routine")
    return a.routine.passi.some((p) => p.allora.some((x) => x.tipo !== "aspetta"));
  const q = a.quando;
  const serveEntita = ["apertura", "movimento", "stato"].includes(q.tipo)
    ? q.entita.length > 0
    : ["valore", "antifurto", "elettrodomestico"].includes(q.tipo)
      ? Boolean(q.entita)
      : q.tipo === "attributo"
        ? Boolean(q.entita && q.attributo)
        : q.tipo === "evento"
          ? Boolean(q.evento)
          : true;
  const faQualcosa = a.allora.some((x) => x.tipo !== "aspetta");
  return serveEntita && faQualcosa;
}

/* ── il sole ────────────────────────────────────────────────────────────── *
 *
 * L'alba e il tramonto si calcolano qui, dalla latitudine e dalla longitudine
 * della casa (quelle di `zone.home`, che Home Assistant tiene gia'): niente
 * servizi fuori casa. Se Home Assistant ha `sun.sun`, per il giorno che dice
 * vale la sua ora — e' la stessa che vede in tutta la casa. E' la formula
 * dell'alba di sempre (l'equazione del sorgere del sole): un minuto di scarto,
 * e per una tapparella un minuto non si vede. */

const RAD = Math.PI / 180;

function giulianoDi(ms) {
  return ms / GIORNO + 2440587.5;
}
const msDelGiuliano = (j) => Math.round((j - 2440587.5) * GIORNO);

/** Alba e tramonto del giorno locale di `giorno`, in millisecondi. `null` d'estate al Polo. */
export function albaETramonto(lat, lon, giorno) {
  const la = numero(lat);
  const lo = numero(lon);
  if (la === null || lo === null) return null;
  const mezzogiorno = new Date(giorno);
  mezzogiorno.setHours(12, 0, 0, 0);
  const n = Math.round(giulianoDi(mezzogiorno.getTime()) - 2451545.0 + 0.0008);
  const jStella = n - lo / 360;
  const M = (357.5291 + 0.98560028 * jStella) % 360;
  const C =
    1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const transito =
    2451545.0 + jStella + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinD = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const cosD = Math.cos(Math.asin(sinD));
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(la * RAD) * sinD) / (Math.cos(la * RAD) * cosD);
  if (cosW < -1 || cosW > 1) return null;
  const w = Math.acos(cosW) / RAD;
  return { alba: msDelGiuliano(transito - w / 360), tramonto: msDelGiuliano(transito + w / 360) };
}

const stessoGiorno = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

/**
 * Alba e tramonto di un giorno, per questa casa: `sun.sun` per il giorno che
 * dice, la formula con la posizione di `zone.home` per gli altri, e senza
 * posizione l'ora di `sun.sun` portata a quel giorno. `null` se non si sa.
 */
export function soleDelGiorno(statoDi, giorno) {
  const leggi = typeof statoDi === "function" ? statoDi : () => null;
  const casa = leggi("zone.home")?.attributes || {};
  const sole = leggi("sun.sun")?.attributes || {};
  const calcolato = albaETramonto(casa.latitude, casa.longitude, giorno);
  const daSole = (iso) => {
    const t = Date.parse(iso || "");
    if (!Number.isFinite(t)) return null;
    if (stessoGiorno(t, giorno)) return t;
    if (calcolato) return null;
    return alleOre(giorno, 0, minutiDelGiorno(t));
  };
  const alba = daSole(sole.next_rising) ?? calcolato?.alba ?? null;
  const tramonto = daSole(sole.next_setting) ?? calcolato?.tramonto ?? null;
  return alba !== null && tramonto !== null ? { alba, tramonto } : null;
}

/* ── che cosa vuol dire uno stato ───────────────────────────────────────── */

const SCONOSCIUTI = new Set(["", "unavailable", "unknown", "none"]);
const SPENTI = new Set([
  "off",
  "closed",
  "closing",
  "not_home",
  "away",
  "idle",
  "paused",
  "standby",
  "locked",
  "disarmed",
]);

export const statoNoto = (stato) => !SCONOSCIUTI.has(pulito(stato?.state).toLowerCase());
export const acceso = (stato) =>
  statoNoto(stato) && !SPENTI.has(pulito(stato?.state).toLowerCase());
const aCasa = (stato) => pulito(stato?.state).toLowerCase() === "home";

/* Lo stato che un «aspetta finche'…» aspetta: uno stato scritto («off»,
 * «closed») o una soglia («<60», «>25»), che serve all'umidita' che scende o
 * alla temperatura che sale — un numero preciso non arriverebbe mai. Uno
 * stato sconosciuto non soddisfa una soglia. */
export function eLoStatoAtteso(voluto, stato) {
  const v = pulito(voluto);
  const s = pulito(stato);
  const soglia = /^([<>])\s*(-?\d+(?:[.,]\d+)?)$/.exec(v);
  if (!soglia) return s === v;
  const letto = numero(s);
  if (letto === null || SCONOSCIUTI.has(s.toLowerCase())) return false;
  const limite = Number(soglia[2].replace(",", "."));
  return soglia[1] === "<" ? letto < limite : letto > limite;
}

function valoreNumerico(stato) {
  if (!statoNoto(stato)) return null;
  return numero(stato.state);
}

/* La potenza in watt, anche quando il sensore la dice in kilowatt. */
function watt(stato) {
  const n = valoreNumerico(stato);
  if (n === null) return null;
  return /^kw$/i.test(pulito(stato?.attributes?.unit_of_measurement)) ? n * 1000 : n;
}

function persone(stati, chi = []) {
  if (chi.length) return chi;
  return Object.keys(stati).filter((id) => dominioDi(id) === "person");
}

/* ── QUANDO ─────────────────────────────────────────────────────────────── */

/* Un orario mancato perche' la casa era spenta si recupera solo se e' appena
 * passato: le tapparelle che si aprono alle 11 perche' l'add-on si e'
 * riacceso alle 11 sono peggio di quelle rimaste chiuse. */
export const RECUPERO_DELL_ORARIO = 5 * MINUTO;

/* Quanto deve girare un elettrodomestico prima di dire che e' partito: un
 * picco di un secondo non e' un lavaggio. */
export const AVVIO_DELL_ELETTRODOMESTICO = 2 * MINUTO;

/** Gli istanti di un orario nel giorno di `istante` (con i giorni scelti). */
export function istantiDelGiorno(quando, istante, statoDi = null) {
  /* «Ogni N minuti», contati dalla mezzanotte: ogni 30 vuol dire alle 0:00,
   * alle 0:30, all'1:00… — si sa sempre quando viene il prossimo. */
  if (quando?.tipo === "ogni") {
    const fuori = [];
    for (let m = 0; m < 1440; m += quando.minuti) fuori.push(alleOre(istante, 0, m));
    return fuori;
  }
  if (!quando || quando.tipo !== "orario") return [];
  if (!quando.giorni[giornoDellaSettimana(istante)]) return [];
  if (quando.sole) {
    const sole = soleDelGiorno(statoDi, istante);
    if (!sole) return [];
    return [sole[quando.sole] + quando.scarto * MINUTO];
  }
  return quando.ore.map((o) => alleOre(istante, 0, minutiDi(o)));
}

/** Il prossimo istante di un orario dopo `adesso`, entro una settimana. */
export function prossimoIstante(quando, adesso, statoDi = null) {
  for (let i = 0; i <= 7; i += 1) {
    const giorno = alleOre(adesso, i, 12 * 60);
    const dopo = istantiDelGiorno(quando, giorno, statoDi)
      .filter((t) => t > adesso)
      .sort((a, b) => a - b);
    if (dopo.length) return dopo[0];
  }
  return null;
}

function sogliaPassata(verso, soglia, n) {
  return verso === "sopra" ? n > soglia : n < soglia;
}
/* L'isteresi: per riarmarsi il valore deve tornare indietro di un pezzo, non
 * di un decimo. «Sopra 70%» scatta a 70,1 e si riarma sotto 68,6. */
export const bandaDi = (soglia) => Math.max(0.5, Math.abs(soglia) * 0.02);
function rientrato(verso, soglia, n) {
  const banda = bandaDi(soglia);
  return verso === "sopra" ? n <= soglia - banda : n >= soglia + banda;
}

/**
 * Se il QUANDO scatta adesso.
 *
 * Si chiama a ogni cambio di stato che lo riguarda (`cambio`: `{id, prima,
 * dopo}`) e a ogni giro dell'orologio (`cambio` nullo). `traccia` e' quello
 * che si deve ricordare fra un giro e l'altro — il valore gia' sopra soglia,
 * la lavatrice che gira — e torna aggiornata: la si salva, e sopravvive a un
 * riavvio. `giroPrima` e' l'ultimo giro dell'orologio, per gli orari.
 */
export function valutaIlQuando(
  quando,
  { cambio = null, evento = null, stati = {}, adesso, giroPrima = null, traccia = {} } = {},
) {
  const t = { ...(traccia || {}) };
  const statoDi = (id) => stati[id] || null;
  const no = { scatta: false, traccia: t };
  if (!quando) return no;

  /* Un evento del bus di Home Assistant: il suo tipo, e i dati che il filtro
   * chiede, uguali come testo. Nient'altro lo fa scattare. */
  if (quando.tipo === "evento") {
    if (!evento || evento.tipo !== quando.evento) return no;
    const dati = evento.dati && typeof evento.dati === "object" ? evento.dati : {};
    const vale = Object.entries(quando.filtro || {}).every(
      ([k, v]) => !v || String(dati[k] ?? "") === v,
    );
    return { scatta: vale, traccia: t };
  }
  if (evento) return no;

  /* Un'entita' qualsiasi che cambia stato, da uno stato a un altro (tutti e
   * due facoltativi), e se si vuole «da almeno X minuti»: allora non scatta al
   * cambio, ma quando lo stato nuovo e' durato abbastanza. */
  if (quando.tipo === "stato") {
    const voluto = (s) => statoNoto(s) && (!quando.a || pulito(s?.state) === quando.a);
    if (cambio) {
      if (!quando.entita.includes(cambio.id)) return no;
      const prima = pulito(cambio.prima?.state);
      const dopo = pulito(cambio.dopo?.state);
      if (prima === dopo || !statoNoto(cambio.dopo)) return no;
      if (quando.da && prima !== quando.da) return no;
      if (!voluto(cambio.dopo)) {
        delete t[cambio.id];
        return no;
      }
      if (!quando.per) return { scatta: true, traccia: t };
      t[cambio.id] = { dal: adesso, fatto: false };
      return no;
    }
    if (!quando.per) return no;
    for (const id of quando.entita) {
      const attesa = t[id];
      if (!attesa || attesa.fatto) continue;
      if (!voluto(statoDi(id))) {
        delete t[id];
        continue;
      }
      if (adesso - attesa.dal >= quando.per * MINUTO) {
        t[id] = { ...attesa, fatto: true };
        return { scatta: true, traccia: t };
      }
    }
    return no;
  }

  /* Un attributo che cambia (la sorgente di un lettore, la modalita' di un
   * clima): al cambio, e se c'e' un valore scritto, solo quando diventa quello. */
  if (quando.tipo === "attributo") {
    if (!cambio || cambio.id !== quando.entita || !quando.attributo) return no;
    const leggi = (s) => {
      const v = s?.attributes?.[quando.attributo];
      return v === undefined || v === null
        ? ""
        : typeof v === "object"
          ? JSON.stringify(v)
          : String(v);
    };
    const prima = leggi(cambio.prima);
    const dopo = leggi(cambio.dopo);
    if (prima === dopo) return no;
    return { scatta: !quando.valore || dopo === quando.valore, traccia: t };
  }

  if (quando.tipo === "orario" || quando.tipo === "ogni") {
    if (cambio) return no;
    const da = Math.max(giroPrima ?? adesso - RECUPERO_DELL_ORARIO, adesso - RECUPERO_DELL_ORARIO);
    const candidati = [
      ...istantiDelGiorno(quando, adesso, statoDi),
      ...istantiDelGiorno(quando, adesso - GIORNO, statoDi),
    ]
      .filter((x) => x > da && x <= adesso && x > (t.fatto ?? 0))
      .sort((a, b) => b - a);
    if (!candidati.length) return no;
    t.fatto = candidati[0];
    return { scatta: true, traccia: t };
  }

  if (quando.tipo === "apertura") {
    if (!cambio || !quando.entita.includes(cambio.id)) return no;
    if (!statoNoto(cambio.prima) || !statoNoto(cambio.dopo)) return no;
    const prima = acceso(cambio.prima);
    const dopo = acceso(cambio.dopo);
    if (prima === dopo) return no;
    return { scatta: quando.verso === "apre" ? dopo : !dopo, traccia: t };
  }

  if (quando.tipo === "movimento") {
    if (quando.verso === "si") {
      if (!cambio || !quando.entita.includes(cambio.id)) return no;
      return {
        scatta: statoNoto(cambio.prima) && !acceso(cambio.prima) && acceso(cambio.dopo),
        traccia: t,
      };
    }
    /* Nessun movimento da X minuti: tutti fermi, e l'ultimo si e' fermato da
     * abbastanza. Si dice una volta per ogni silenzio: torna a valere dopo un
     * movimento nuovo. */
    const tutti = quando.entita.map(statoDi);
    if (!tutti.length || tutti.some((s) => !s || !statoNoto(s))) return no;
    if (tutti.some(acceso)) {
      delete t.per;
      return no;
    }
    const dal = Math.max(...tutti.map((s) => Number(s.dal) || 0));
    if (adesso - dal < quando.minuti * MINUTO || t.per === dal) return no;
    t.per = dal;
    return { scatta: true, traccia: t };
  }

  if (quando.tipo === "valore") {
    if (cambio && cambio.id !== quando.entita) return no;
    const n = valoreNumerico(statoDi(quando.entita));
    if (n === null) return no;
    const passata = sogliaPassata(quando.verso, quando.soglia, n);
    /* La prima lettura dice solo com'e': un valore gia' sopra quando la
     * regola nasce (o quando la casa si riaccende) non e' un passaggio. */
    if (t.armato === undefined) {
      t.armato = !passata;
      return no;
    }
    if (t.armato && passata) {
      t.armato = false;
      return { scatta: true, traccia: t };
    }
    if (!t.armato && rientrato(quando.verso, quando.soglia, n)) t.armato = true;
    return no;
  }

  if (quando.tipo === "persone") {
    if (!cambio || !DOMINI.persone.includes(dominioDi(cambio.id))) return no;
    if (!statoNoto(cambio.dopo)) return no;
    const chi = persone(stati, quando.chi);
    if (!chi.includes(cambio.id)) return no;
    const eraACasa = aCasa(cambio.prima);
    const eACasa = aCasa(cambio.dopo);
    if (eraACasa === eACasa || !statoNoto(cambio.prima)) return no;
    if (quando.verso === "arriva") return { scatta: eACasa, traccia: t };
    if (quando.verso === "esce") return { scatta: !eACasa, traccia: t };
    /* Tutti fuori: chi e' uscito era l'ultimo. */
    const altriACasa = chi.some((id) => id !== cambio.id && aCasa(statoDi(id)));
    return { scatta: eraACasa && !eACasa && !altriACasa, traccia: t };
  }

  if (quando.tipo === "antifurto") {
    if (!cambio || cambio.id !== quando.entita || !statoNoto(cambio.dopo)) return no;
    const prima = pulito(cambio.prima?.state);
    const dopo = pulito(cambio.dopo.state);
    if (prima === dopo) return no;
    if (quando.verso === "suona") return { scatta: dopo === "triggered", traccia: t };
    if (quando.verso === "disinserito") return { scatta: dopo === "disarmed", traccia: t };
    return { scatta: dopo.startsWith("armed_") && !prima.startsWith("armed_"), traccia: t };
  }

  /* L'elettrodomestico: sopra soglia per un paio di minuti vuol dire che e'
   * partito; poi sotto soglia per X minuti di fila vuol dire che ha finito. Le
   * pause del ciclo — l'ammollo, la lavatrice che si ferma a girare — durano
   * meno di X minuti, e non chiudono niente. */
  if (cambio && cambio.id !== quando.entita) return no;
  const w = watt(statoDi(quando.entita));
  if (w === null) return no;
  if (w > quando.soglia) {
    delete t.sottoDal;
    if (t.fase !== "gira") {
      t.sopraDal ??= adesso;
      if (adesso - t.sopraDal >= AVVIO_DELL_ELETTRODOMESTICO) {
        t.fase = "gira";
        delete t.sopraDal;
      }
    }
    return no;
  }
  delete t.sopraDal;
  if (t.fase !== "gira") return no;
  t.sottoDal ??= adesso;
  if (adesso - t.sottoDal < quando.minuti * MINUTO) return no;
  t.fase = "ferma";
  delete t.sottoDal;
  return { scatta: true, traccia: t };
}

/** Le entita' il cui cambio puo' far scattare questo QUANDO. */
export function entitaDelQuando(quando) {
  if (!quando) return [];
  if (["apertura", "movimento", "stato"].includes(quando.tipo)) return quando.entita;
  if (["valore", "antifurto", "elettrodomestico", "attributo"].includes(quando.tipo))
    return quando.entita ? [quando.entita] : [];
  return [];
}

/* ── SOLO SE ────────────────────────────────────────────────────────────── */

function dentroLaFascia(daMin, aMin, m) {
  if (daMin === aMin) return true;
  return daMin < aMin ? m >= daMin && m < aMin : m >= daMin || m < aMin;
}

/** Se e' notte: fra tramonto e alba, o fra i due orari scritti. */
export function eNotte(condizione, { adesso, statoDi = null } = {}) {
  const da = minutiDi(condizione?.da);
  const a = minutiDi(condizione?.a);
  if (da !== null && a !== null) return dentroLaFascia(da, a, minutiDelGiorno(adesso));
  const sole = soleDelGiorno(statoDi, adesso);
  /* Senza sole e senza orari: dalle 21 alle 6, che e' notte dappertutto. */
  if (!sole) return dentroLaFascia(21 * 60, 6 * 60, minutiDelGiorno(adesso));
  return adesso < sole.alba || adesso >= sole.tramonto;
}

export function condizioneVera(c, { stati = {}, adesso } = {}) {
  const statoDi = (id) => stati[id] || null;
  if (!c) return true;
  if (c.tipo === "notte") return eNotte(c, { adesso, statoDi });
  if (c.tipo === "fascia")
    return dentroLaFascia(minutiDi(c.da), minutiDi(c.a), minutiDelGiorno(adesso));
  if (c.tipo === "giorni") return c.giorni[giornoDellaSettimana(adesso)] === true;
  if (c.tipo === "casa") {
    const qualcuno = persone(stati).some((id) => aCasa(statoDi(id)));
    return c.chi === "nessuno" ? !qualcuno : qualcuno;
  }
  if (c.tipo === "stato") {
    const s = statoDi(c.entita);
    if (!s || !statoNoto(s)) return false;
    return c.vale === "spento" ? !acceso(s) : acceso(s);
  }
  /* Il sole sopra o sotto l'orizzonte: lo dice `sun.sun`, e senza lui il
   * conto dell'alba e del tramonto. */
  if (c.tipo === "sole") {
    const sun = pulito(statoDi("sun.sun")?.state);
    const sopra =
      sun === "above_horizon"
        ? true
        : sun === "below_horizon"
          ? false
          : !eNotte({}, { adesso, statoDi });
    return c.posizione === "sotto" ? !sopra : sopra;
  }
  /* «È in uno di questi stati»: si scrivono separati da virgole. */
  if (c.tipo === "uguale") {
    const s = statoDi(c.entita);
    if (!s) return false;
    const voluti = c.valore
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const dentro = voluti.includes(pulito(s.state));
    return c.non ? !dentro : dentro;
  }
  if (c.tipo === "attributo") {
    const v = statoDi(c.entita)?.attributes?.[c.attributo];
    if (v === undefined || v === null) return false;
    if (c.confronto === "uguale")
      return (typeof v === "object" ? JSON.stringify(v) : String(v)) === c.valore;
    const n = numero(v);
    const soglia = numero(c.valore);
    return n !== null && soglia !== null && sogliaPassata(c.confronto, soglia, n);
  }
  const n = valoreNumerico(statoDi(c.entita));
  return n !== null && sogliaPassata(c.verso, c.soglia, n);
}

/** Il SOLO SE: tutte le condizioni (di serie), o almeno una. Nessuna: vale. */
export function soloSeVale(condizioni, contesto, tutte = true) {
  const elenco = Array.isArray(condizioni) ? condizioni : [];
  if (!elenco.length) return true;
  return tutte
    ? elenco.every((c) => condizioneVera(c, contesto))
    : elenco.some((c) => condizioneVera(c, contesto));
}

/* ── ALLORA ─────────────────────────────────────────────────────────────── */

/* Le azioni della plancia che la casa sa far partire da sola: le stesse del
 * pannello a muro (`plancia-a-muro.js`, `eUnaScena`), senza le serrature e
 * senza quelle che la plancia fa confermare a chi preme. */
export function azioneDellaPlancia(azione) {
  if (!azione || ["builtin", "luci_group"].includes(azione.type) || azione.confirm === true)
    return null;
  const id = entitaDi(azione.entity);
  if (!id) return null;
  const d = dominioDi(id);
  if (d === "lock" || d === "alarm_control_panel") return null;
  if (d === "scene" || d === "script")
    return { domain: d, service: "turn_on", data: { entity_id: id } };
  if (d === "button" || d === "input_button")
    return { domain: d, service: "press", data: { entity_id: id } };
  if ((d === "select" || d === "input_select") && pulito(azione.option))
    return {
      domain: d,
      service: "select_option",
      data: { entity_id: id, option: pulito(azione.option) },
    };
  return { domain: "homeassistant", service: "toggle", data: { entity_id: id } };
}

/**
 * I servizi di un'azione: un elenco, perche' «clima a 21°» su un clima spento
 * sono due cose — accenderlo, poi dirgli la temperatura. `azioni` sono le
 * Azioni della plancia (`cd_quick_actions`), per nome.
 */
/* Le entita' di un'azione, divise per dominio: «accendi la luce e la presa»
 * sono due servizi, `light.turn_on` e `switch.turn_on`. Una sola entita'
 * resta una stringa, come Home Assistant la scrive di solito. */
function perDominio(entita) {
  const gruppi = new Map();
  for (const id of entita) {
    const d = dominioDi(id);
    if (!gruppi.has(d)) gruppi.set(d, []);
    gruppi.get(d).push(id);
  }
  return [...gruppi].map(([d, ids]) => [d, ids.length === 1 ? ids[0] : ids]);
}

export function serviziDellAzione(azione, { azioni = [], stati = {} } = {}) {
  const a = azionePulita(azione);
  if (!a) return [];
  if (a.tipo === "accendi")
    return perDominio(a.entita).map(([d, id]) => {
      if (d === "script" || d === "scene")
        return { domain: d, service: "turn_on", data: { entity_id: id } };
      if (d === "button" || d === "input_button")
        return { domain: d, service: "press", data: { entity_id: id } };
      const data = { entity_id: id };
      if (a.livello && d === "light") data.brightness_pct = a.livello;
      return { domain: DOMINI.accendi.includes(d) ? d : "homeassistant", service: "turn_on", data };
    });
  if (a.tipo === "spegni")
    return perDominio(a.entita).map(([d, id]) => ({
      domain: DOMINI.spegni.includes(d) ? d : "homeassistant",
      service: "turn_off",
      data: { entity_id: id },
    }));
  const id = Array.isArray(a.entita) && a.entita.length === 1 ? a.entita[0] : a.entita;
  if (a.tipo === "imposta") {
    const d = dominioDi(a.entita);
    if (d === "input_boolean")
      return [
        {
          domain: d,
          service: ["on", "true", "1", "si", "sì"].includes(a.valore.toLowerCase())
            ? "turn_on"
            : "turn_off",
          data: { entity_id: a.entita },
        },
      ];
    if (d === "input_select" || d === "select")
      return [
        { domain: d, service: "select_option", data: { entity_id: a.entita, option: a.valore } },
      ];
    if (d === "input_number" || d === "number") {
      const n = numero(a.valore);
      return n === null
        ? []
        : [{ domain: d, service: "set_value", data: { entity_id: a.entita, value: n } }];
    }
    return [{ domain: d, service: "set_value", data: { entity_id: a.entita, value: a.valore } }];
  }
  if (a.tipo === "media") {
    const servizio = {
      play: "media_play",
      pausa: "media_pause",
      stop: "media_stop",
      successivo: "media_next_track",
      volume: "volume_set",
      sorgente: "select_source",
    }[a.comando];
    const data = { entity_id: id };
    if (a.comando === "volume") data.volume_level = Number(a.valore) / 100;
    if (a.comando === "sorgente") data.source = a.valore;
    return [{ domain: "media_player", service: servizio, data }];
  }
  if (a.tipo === "servizio") {
    const [domain, service] = a.servizio.split(".");
    const data = { ...a.dati };
    if (a.entita.length) data.entity_id = a.entita.length === 1 ? a.entita[0] : a.entita;
    return [{ domain, service, data }];
  }
  if (a.tipo === "tapparella") {
    if (a.modo === "posizione")
      return [
        {
          domain: "cover",
          service: "set_cover_position",
          data: { entity_id: id, position: a.posizione },
        },
      ];
    return [
      {
        domain: "cover",
        service: a.modo === "chiudi" ? "close_cover" : "open_cover",
        data: { entity_id: id },
      },
    ];
  }
  if (a.tipo === "clima") {
    if (a.modo === "spegni")
      return [{ domain: "climate", service: "turn_off", data: { entity_id: id } }];
    const spenti = a.entita.filter((e) => pulito(stati[e]?.state) === "off");
    return [
      ...(spenti.length
        ? [
            {
              domain: "climate",
              service: "turn_on",
              data: { entity_id: spenti.length === 1 ? spenti[0] : spenti },
            },
          ]
        : []),
      {
        domain: "climate",
        service: "set_temperature",
        data: { entity_id: id, temperature: a.gradi },
      },
    ];
  }
  if (a.tipo === "azione") {
    const trovata = (Array.isArray(azioni) ? azioni : []).find((x) => pulito(x?.name) === a.nome);
    const servizio = azioneDellaPlancia(trovata);
    return servizio ? [servizio] : [];
  }
  return [];
}

/**
 * I passi di un ALLORA, nell'ordine: un servizio, una notifica o un'attesa.
 * E' quello che la casa esegue uno dopo l'altro, e che si ricorda su disco
 * mentre aspetta.
 */
export function passiDellAllora(allora, contesto = {}) {
  const passi = [];
  for (const una of Array.isArray(allora) ? allora : []) {
    const a = azionePulita(una);
    if (!a) continue;
    if (a.tipo === "aspetta") passi.push({ aspetta: a.minuti * MINUTO });
    else if (a.tipo === "aspettaChe")
      passi.push({ attendi: { entita: a.entita, stato: a.stato, per: a.massimo * MINUTO } });
    else if (a.tipo === "notifica") passi.push({ notifica: a.testo });
    else for (const servizio of serviziDellAzione(a, contesto)) passi.push({ servizio });
  }
  return passi;
}

/* ── il cronotermostato ─────────────────────────────────────────────────── */

/** Le fasce di oggi: Lun–Ven le feriali, Sab–Dom le festive. */
export const fasceDelGiorno = (crono, istante) =>
  giornoDellaSettimana(istante) >= 5 ? crono.festivi : crono.feriali;

export function cronoInFascia(crono, adesso) {
  const m = minutiDelGiorno(adesso);
  return fasceDelGiorno(crono, adesso).some(([da, a]) => m >= da && m < a);
}

/** La temperatura voluta adesso, o «spento» con la finestra aperta. */
export function cronoVoluto(crono, { adesso, stati = {} }) {
  const aperta = crono.finestraSpegne && crono.finestre.some((id) => acceso(stati[id] || null));
  if (aperta) return "spento";
  return cronoInFascia(crono, adesso) ? crono.inCasa : crono.fuori;
}

/**
 * Cosa deve fare il cronotermostato adesso.
 *
 * Si comanda **al passaggio**, non a ogni giro: all'inizio di una fascia, alla
 * fine, quando si apre o si chiude la finestra. In mezzo chi alza il
 * termostato a mano ha ragione lui fino al passaggio dopo — un
 * cronotermostato che rimette 18° ogni mezzo minuto e' una lotta, non un
 * aiuto. `traccia.voluto` dice cosa si e' gia' chiesto a ogni termostato; la
 * casa la aggiorna solo per i comandi andati a buon fine.
 */
export function cronoDecide(crono, { adesso, stati = {}, traccia = {} } = {}) {
  const c = cronoPulito(crono);
  const voluto = cronoVoluto(c, { adesso, stati });
  const gia = traccia?.voluto && typeof traccia.voluto === "object" ? traccia.voluto : {};
  const comandi = [];
  for (const id of c.termostati) {
    if (gia[id] === voluto) continue;
    const stato = stati[id] || null;
    if (voluto === "spento") {
      comandi.push({
        entita: id,
        voluto,
        servizi: [{ domain: "climate", service: "turn_off", data: { entity_id: id } }],
      });
      continue;
    }
    const modi = Array.isArray(stato?.attributes?.hvac_modes) ? stato.attributes.hvac_modes : [];
    const data = { entity_id: id, temperature: voluto };
    if (modi.includes("heat") && pulito(stato?.state) !== "heat") data.hvac_mode = "heat";
    comandi.push({
      entita: id,
      voluto,
      servizi: [{ domain: "climate", service: "set_temperature", data }],
    });
  }
  return { voluto, comandi };
}

/** Il prossimo passaggio del cronotermostato dopo `adesso`: `{alle, voluto}`. */
export function cronoProssimo(crono, adesso) {
  const c = cronoPulito(crono);
  for (let i = 0; i <= 7; i += 1) {
    const giorno = alleOre(adesso, i, 12 * 60);
    const stacchi = fasceDelGiorno(c, giorno)
      .flatMap(([da, a]) => [
        { alle: alleOre(giorno, 0, da), voluto: c.inCasa },
        { alle: a >= 1440 ? alleOre(giorno, 1, 0) : alleOre(giorno, 0, a), voluto: c.fuori },
      ])
      .filter((s) => s.alle > adesso)
      .sort((x, y) => x.alle - y.alle);
    if (stacchi.length) return stacchi[0];
  }
  return null;
}

/* ── che cosa succede dopo ──────────────────────────────────────────────── */

/**
 * Le prossime cose che la casa fara' da sola, in ordine: gli orari e i
 * passaggi dei cronotermostati. Gli altri QUANDO non hanno un'ora — una porta
 * si apre quando si apre — e qui non ci sono.
 */
export function prossimiEventi(automazioni, adesso, statoDi = null, quanti = 3) {
  const fuori = [];
  for (const a of automazioni || []) {
    if (!eAttivaAdesso(a, adesso)) continue;
    if (a.tipo === "crono") {
      if (!a.crono.termostati.length) continue;
      const p = cronoProssimo(a.crono, adesso);
      if (p) fuori.push({ id: a.id, alle: p.alle, crono: p.voluto });
      continue;
    }
    if (a.tipo === "routine" || a.tipo === "fasce") {
      const p = prossimoDelPianificatore(a, adesso);
      if (p !== null) fuori.push({ id: a.id, alle: p });
      continue;
    }
    if (a.quando?.tipo !== "orario" && a.quando?.tipo !== "ogni") continue;
    const alle = prossimoIstante(a.quando, adesso, statoDi);
    if (alle !== null) fuori.push({ id: a.id, alle });
  }
  return fuori.sort((x, y) => x.alle - y.alle).slice(0, quanti);
}

/**
 * Il prossimo momento in cui una routine o un calendario fanno qualcosa,
 * dopo `adesso`: un orario della routine, o un cambio di fascia, in un
 * giorno giusto e nel periodo. Si guarda una settimana e un giorno avanti,
 * poi fino a un anno per un periodo che deve ancora cominciare. `null` se
 * non c'e'.
 */
export function prossimoDelPianificatore(a, adesso) {
  const minuti = [];
  let periodo = null;
  let giornoBuono = () => true;
  if (a?.tipo === "routine") {
    periodo = a.routine.periodo;
    giornoBuono = (g) => a.routine.giorni[g];
    for (const p of a.routine.passi) {
      const [h, m] = p.ora.split(":").map(Number);
      minuti.push({ m: h * 60 + m });
    }
  } else if (a?.tipo === "fasce") {
    if (!a.fasce.entita.length) return null;
    periodo = a.fasce.periodo;
  } else return null;
  const base = new Date(adesso);
  base.setHours(0, 0, 0, 0);
  for (let giorno = 0; giorno < 370; giorno += 1) {
    const inizio = new Date(base);
    inizio.setDate(base.getDate() + giorno);
    if (!nelPeriodo(periodo, inizio.getTime())) continue;
    const g = (inizio.getDay() + 6) % 7;
    if (!giornoBuono(g)) continue;
    const oggi =
      a.tipo === "fasce"
        ? a.fasce.giorni[g].flatMap(([da, fine]) => [da, fine]).filter((m) => m < 1440)
        : minuti.map((x) => x.m);
    for (const m of [...oggi].sort((x, y) => x - y)) {
      const alle = inizio.getTime() + m * MINUTO;
      if (alle > adesso) return alle;
    }
  }
  return null;
}
