/* Capire le domande: l'italiano di chi parla alla casa (e l'inglese).
 *
 * «Che temperatura è presente in casa» mandato ad Assist di Home Assistant,
 * con l'agente di serie, tornava «Mi dispiace, non conosco nessuna area
 * chiamata è presente in casa». L'agente di serie capisce le frasi che ha
 * imparato, parola per parola; chi abita la casa ne dice altre — «ce» senza
 * apostrofo, «le luci» invece di «la luce», «quanti gradi» per dire la
 * temperatura — e ogni frase fuori dal suo elenco e' un «non ho capito».
 *
 * Qui la frase si capisce PRIMA di mandarla, con quello che la plancia sa gia'
 * della casa: le stanze, i nomi dei dispositivi, le persone. Non e' un modello
 * linguistico — e' un lessico, una manciata di regole e un confronto che
 * perdona gli errori di battitura — ma e' quello che serve a dieci domande su
 * dieci di quelle che si fanno alla casa.
 *
 * Il percorso di una frase:
 *
 *   normalizza   minuscole, niente accenti, «c'è»/«ce»/«c è» → «ce», gli
 *                apostrofi delle elisioni via («l'antifurto» → «antifurto»);
 *   parole       la frase in pezzi, ognuno con la sua radice («luci» e «luce»
 *                fanno «luc», «accese» e «acceso» fanno «acces»);
 *   concetti     il lessico: ogni concetto e' un insieme di forme — sinonimi,
 *                plurali, coniugazioni — e una parola lo tocca se e' una di
 *                quelle forme o le somiglia abbastanza (una lettera sbagliata
 *                su cinque, due su otto);
 *   cose         le stanze (quelle di Home Assistant e quelle della plancia),
 *                le persone, i nomi dei dispositivi, i numeri, i giorni;
 *   intento      la domanda vera: la temperatura in casa, chi c'e', le luci
 *                accese, spegni questo, apri quello.
 *
 * Il modulo e' puro: niente DOM e niente Home Assistant. Le risposte le scrive
 * `core/rispondere-alle-domande.js`.
 */

const pulito = (valore) => String(valore ?? "").trim();
const elenco = (valore) => (Array.isArray(valore) ? valore.filter(Boolean) : []);

/* ── la frase ripulita ───────────────────────────────────────────────────── */

/* Le parole che si scrivono in tanti modi e vogliono dire una cosa sola. Si
 * guardano DOPO aver tolto accenti e apostrofi, e prima delle radici. */
const RIPARAZIONI = new Map([
  ["com", "come"],
  ["dov", "dove"],
  ["qual", "quale"],
  ["cos", "cosa"],
  ["qlc", "qualcuno"],
  ["qlcn", "qualcuno"],
  ["xke", "perche"],
  ["xche", "perche"],
  ["nn", "non"],
  ["cm", "come"],
  ["tt", "tutte"],
  ["tutt", "tutte"],
  ["whats", "what"],
  ["wheres", "where"],
  ["whos", "who"],
  ["hows", "how"],
  ["isnt", "is"],
  ["arent", "are"],
  ["temp", "temperatura"],
  ["temperature", "temperature"],
]);

/**
 * La frase come la legge il resto del modulo: minuscola, senza accenti, senza
 * punteggiatura, con le elisioni sciolte e il «c'è» scritto sempre «ce».
 */
export function normalizza(testo) {
  let frase = String(testo ?? "")
    .toLowerCase()
    .replace(/[’‘`´ʼ]/g, "'")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  /* La virgola dei decimali resta un numero: «21,5 gradi». */
  frase = frase.replace(/(\d),(\d)/g, "$1.$2");
  /* «°c», «°», «%» restano attaccati al numero, il resto della punteggiatura
   * se ne va. */
  frase = frase.replace(/(\d)\s*°\s*c?\b/g, "$1 gradi ");
  frase = frase.replace(/°/g, " gradi ");
  frase = frase.replace(/(\d)\s*%/g, "$1 percento ");
  frase = frase.replace(/[^a-z0-9.'\s-]/g, " ");
  frase = frase.replace(/(^|\s)-+|-+(\s|$)/g, " ");
  frase = frase.replace(/\.(?!\d)/g, " ");
  frase = frase.replace(/'/g, " ");
  const pezzi = frase.split(/\s+/).filter(Boolean);
  const fuori = [];
  for (let i = 0; i < pezzi.length; i += 1) {
    const pezzo = pezzi[i];
    const dopo = pezzi[i + 1];
    /* «c'è», «c e», «cè» → «ce»; «c'era» → «cera»; «c'erano» → «cerano». */
    if (pezzo === "c" && dopo && /^(e|era|erano|eran|sono)$/.test(dopo)) {
      fuori.push(dopo === "sono" ? "ci" : `c${dopo}`);
      if (dopo === "sono") fuori.push("sono");
      i += 1;
      continue;
    }
    fuori.push(RIPARAZIONI.get(pezzo) || pezzo);
  }
  return fuori.join(" ");
}

/* Le parole che non portano significato: articoli, preposizioni, «e». */
const VUOTE = new Set(
  (
    "il lo la i gli le l un uno una un di a ad da in con su per tra fra del dello della dei degli " +
    "delle dell al allo alla ai agli alle all dal dallo dalla dai dagli dalle dall nel nello nella " +
    "nei negli nelle nell sul sullo sulla sui sugli sulle sull e ed o mi ti ci si me te ce se " +
    "the of on at to an and my your our me us it its is are be please per favore pf grazie"
  ).split(" "),
);

/** Le parole che si possono trascurare quando si confrontano i nomi. */
export const PAROLE_VUOTE = VUOTE;

/**
 * La radice di una parola: abbastanza per dire che «luci» e «luce», «accese»
 * e «acceso», «finestre» e «finestra», «lights» e «light» sono la stessa.
 */
export function radice(parola) {
  let r = pulito(parola);
  if (/^\d/.test(r)) return r;
  if (r.length > 4 && /[^s]s$/.test(r)) r = r.slice(0, -1);
  while (r.length > 3 && /[aeiou]$/.test(r)) r = r.slice(0, -1);
  return r;
}

/**
 * Quante modifiche servono per passare da una parola all'altra: una lettera
 * in piu', in meno, cambiata, o due lettere scambiate.
 */
export function distanza(a, b) {
  const x = String(a);
  const y = String(b);
  if (x === y) return 0;
  if (!x.length) return y.length;
  if (!y.length) return x.length;
  if (Math.abs(x.length - y.length) > 2) return 3;
  const d = [];
  for (let i = 0; i <= x.length; i += 1) d.push([i]);
  for (let j = 1; j <= y.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= x.length; i += 1)
    for (let j = 1; j <= y.length; j += 1) {
      const costo = x[i - 1] === y[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[x.length][y.length];
}

/* Quanti errori si perdonano: nessuno sotto le cinque lettere — «luce» e
 * «lune» non sono la stessa cosa — uno fino a sette, due da otto. */
function tolleranza(lunghezza) {
  if (lunghezza >= 8) return 2;
  if (lunghezza >= 5) return 1;
  return 0;
}

/** Due parole sono la stessa, con un errore di battitura perdonato. */
export function somiglia(a, b) {
  const x = pulito(a);
  const y = pulito(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (/\d/.test(x) || /\d/.test(y)) return false;
  const rx = radice(x);
  const ry = radice(y);
  if (rx === ry) return true;
  const tol = tolleranza(Math.min(x.length, y.length));
  if (!tol) return false;
  return distanza(rx, ry) <= tol || distanza(x, y) <= tol;
}

/* ── il lessico ──────────────────────────────────────────────────────────── */

/* Ogni concetto: le forme esatte (un'espressione per parola) e, a parte, le
 * parole lunghe di cui si perdona un errore di battitura. Le forme corte non
 * hanno errori perdonati: «sole» sbagliato e' «sale», non «sole». */
const LESSICO = {
  temperatura: {
    forme:
      /^(temperatur[ae]|temperatures?|gradi|grado|degrees?|termometr[oi]|thermometers?|celsius)$/,
    simili: ["temperatura", "temperature", "termometro"],
  },
  caldoFreddo: {
    forme:
      /^(caldo|calda|caldi|calde|caldissimo|freddo|fredda|freddi|fredde|fresco|fresca|hot|cold|warm|chilly|freezing)$/,
  },
  umidita: { forme: /^(umidita|umido|umida|humidity|humid|igrometr[oi])$/, simili: ["umidita"] },
  fuori: {
    forme: /^(fuori|esterno|esterna|esterni|esterne|outside|outdoor|outdoors)$/,
    simili: ["esterno", "outside"],
  },
  casa: {
    forme:
      /^(casa|home|house|dentro|interno|interna|inside|indoor|indoors|appartamento|abitazione)$/,
  },
  meteo: {
    forme:
      /^(meteo|tempo|piove|piovera|piovere|pioggia|piogge|piovoso|sole|soleggiato|sereno|nuvol\w*|neve|nevica|nevichera|vento|ventoso|temporal[ei]|grandine|nebbia|previsione|previsioni|ombrello|weather|rain|raining|rainy|forecast|snow|snowing|sunny|cloudy|umbrella|windy|storm|storms)$/,
    simili: ["previsioni", "pioggia", "temporale", "nuvoloso", "weather", "forecast"],
  },
  chi: {
    forme:
      /^(chi|qualcuno|qualcun|nessuno|persone|gente|who|anyone|anybody|someone|somebody|nobody|everyone|everybody|people)$/,
    simili: ["qualcuno", "nessuno"],
  },
  dove: { forme: /^(dove|where|posizione)$/ },
  quando: { forme: /^(quando|when)$/ },
  uscito: {
    forme:
      /^(uscit[oaie]|uscire|esce|partit[oaie]|andat[oaie]|andato|left|leave|gone|arrivat[oaie]|tornat[oaie]|rientrat[oaie]|arrived|came|back)$/,
    simili: ["uscito", "uscita", "arrivato", "tornato"],
  },
  luci: {
    forme:
      /^(luce|luci|lampad[ae]|lampadin[ae]|lampadari?o?|lampadari|faretti?|plafonier[ae]|led|strisci[ae]|lights?|lamps?|lumi|lume|abatjour|applique)$/,
    simili: ["lampada", "lampadina", "lampadario", "plafoniera"],
  },
  acceso: { forme: /^(acces[oaie]|on|lit|attiv[oaie]|funzion\w*|running|working)$/ },
  spento: { forme: /^(spent[oaie]|off)$/ },
  finestre: {
    forme: /^(finestr[ae]|finestrin[oi]|lucernari?o?|velux|windows?|portafinestr[ae])$/,
    simili: ["finestra", "finestre", "window"],
  },
  porte: { forme: /^(port[ae]|portone|portoncino|doors?|ingresso|varchi|varco)$/ },
  aperto: {
    forme: /^(apert[oaie]|open|opened|spalancat[oaie]|socchius[oaie]|aprono)$/,
    simili: ["aperta", "aperte"],
  },
  chiuso: { forme: /^(chius[oaie]|closed|shut)$/ },
  antifurto: {
    forme: /^(antifurto|antifurti|allarme|allarmi|alarm|alarms|centralina|centrale)$/,
    simili: ["antifurto", "allarme"],
  },
  energia: {
    forme:
      /^(energia|consum[oaie]|consumi|consumando|consumato|consumata|potenza|watt|kw|kilowatt|kwh|corrente|elettricita|elettrica|bolletta|prelievo|prelev\w*|rete|power|energy|usage|using|consumption|consuming|grid|electricity|uses|use)$/,
    simili: ["consumo", "consuma", "energia", "elettricita", "consumption"],
  },
  solare: {
    forme:
      /^(solare|solari|fotovoltaic[oi]|fotovoltaico|pannell[oi]|produzione|produc\w*|prodott[oa]|solar|pv|panels?|producing|production|produced|produce|generat\w*)$/,
    simili: ["fotovoltaico", "produzione", "pannelli", "solare"],
  },
  batteria: {
    forme: /^(batteri[ae]|accumul\w*|storage|powerwall|battery|batteries|pil[ae])$/,
    simili: ["batteria", "batterie", "accumulo"],
  },
  scarica: {
    forme:
      /^(scaric[ahe]|scarich[ei]|bass[ae]|low|sostitu\w*|cambiar\w*|esaurit[ae]|dead|replace|deboli|debole)$/,
  },
  auto: {
    forme: /^(auto|automobile|macchina|vettur[ae]|car|cars|ev|autonomia|range|veicol[oi])$/,
    simili: ["macchina", "autonomia", "automobile"],
  },
  elettrodomestici: {
    forme:
      /^(lavatric[ei]|lavastoviglie|asciugatric[ei]|asciugabiancheria|lavasciuga|forno|forni|friggitric[ei]|elettrodomestic[oi]|bucato|piatti|panni|washer|washing|dishwasher|dryer|oven|appliances?|laundry|dishes|programma|ciclo)$/,
    simili: ["lavatrice", "lavastoviglie", "asciugatrice", "elettrodomestici", "dishwasher"],
  },
  quantoManca: {
    forme:
      /^(manca|mancano|resta|restano|finisce|finira|finito|finita|left|remaining|done|finished)$/,
  },
  telecamera: {
    forme: /^(telecamer[ae]|videocamer[ae]|webcam|cam|videosorveglianza|ip-?cam|inquadratura)$/,
    simili: ["telecamera", "telecamere", "videocamera"],
  },
  mostra: {
    forme: /^(mostr\w*|fammi|fai|vedere|vedo|show|inquadr\w*|guarda|apri|open|display|see)$/,
  },
  calendario: {
    forme:
      /^(calendari?o?|calendari|impegn[oi]|appuntament[oi]|event[oi]|agenda|riunion[ei]|scadenz[ae]|calendar|events?|appointments?|meetings?|schedule|plans?)$/,
    simili: ["calendario", "impegni", "appuntamenti", "appuntamento", "calendar"],
  },
  rifiuti: {
    forme:
      /^(rifiut[oi]|spazzatura|immondizia|pattumiera|differenziata|indifferenziata|raccolta|bidon[ei]|sacchett[oi]|plastica|carta|vetro|organico|trash|garbage|waste|bins?|recycling|rubbish|ritiro|ritirano|ritira|butto|buttare|secco|umido|lattine)$/,
    simili: ["spazzatura", "immondizia", "differenziata", "indifferenziata", "rifiuti"],
  },
  /* Le parole che fanno di «umido», «carta» e «secco» un ritiro e non il
   * tempo o l'aria: «quando passa l'umido», «che si butta». */
  ritiro: {
    forme:
      /^(passa|passano|ritiro|ritirano|ritira|butto|buttare|butta|buttano|raccolta|porto|portare|portiamo|tocca|collection|pickup|collect|trash|bins?)$/,
  },
  aggiornamenti: {
    forme: /^(aggiornament[oi]|aggiornar\w*|aggiorna|updates?|upgrade|versione|versioni)$/,
    simili: ["aggiornamenti", "aggiornamento"],
  },
  offline: {
    forme:
      /^(offline|irraggiungibil[ei]|scollegat[oiae]|unavailable|disconness[oiae]|disponibil[ei]|rispond\w*|risposta|morti|responding|dead)$/,
    simili: ["irraggiungibili", "scollegati", "disponibili"],
  },
  tapparelle: {
    forme:
      /^(tapparell[ae]|persian[ae]|tend[ae]|tendin[ae]|serrand[ae]|avvolgibil[ei]|scur[oi]|oscurant[ei]|frangisole|venezian[ae]|blinds?|shutters?|curtains?|shades?|covers?|awnings?)$/,
    simili: ["tapparella", "tapparelle", "persiana", "persiane", "serranda"],
  },
  cancello: {
    forme: /^(cancell[oi]|garage|basculante|box|gates?|carrabile|pedonale)$/,
    simili: ["cancello"],
  },
  prese: {
    forme: /^(pres[ae]|spin[ae]|interruttor[ei]|plugs?|switch|switches|outlets?|sockets?)$/,
  },
  ventilatore: { forme: /^(ventilator[ei]|ventol[ae]|pale|fans?)$/, simili: ["ventilatore"] },
  media: {
    forme:
      /^(tv|televisor[ei]|television[ei]|televisione|musica|stereo|cass[ae]|speakers?|radio|music|soundbar|sonos)$/,
    simili: ["televisore", "televisione"],
  },
  clima: {
    forme:
      /^(riscaldament[oi]|termosifon[ei]|termostat[oi]|caldaia|clima|climatizzator[ei]|condizionator[ei]|condizionatore|split|pompa|heating|heater|thermostats?|ac|aircon|condizionamento|stufa|raffrescamento|cooling|condizionata)$/,
    simili: ["riscaldamento", "termostato", "climatizzatore", "condizionatore", "termosifone"],
  },
  serratura: {
    forme: /^(serratur[ae]|chiave|lock|locks|chiavistello|blindata|catenaccio|deadbolt)$/,
    simili: ["serratura"],
  },
  tutte: { forme: /^(tutt[eoia]|all|every|everything|ogni|qualsiasi|tutto)$/ },
  quanti: { forme: /^(quant[eoia]|how|many|much|numero|count)$/ },
  quali: { forme: /^(qual[ei]|which|what|che|cosa|cos)$/ },
  aiuto: {
    forme: /^(aiuto|help|aiutami|istruzioni|esempi|esempio|comandi|capabilities)$/,
  },
  saluto: {
    forme:
      /^(ciao|salve|buongiorno|buonasera|buonanotte|hey|ehi|hello|hi|hola|grazie|thanks|thank|thx|ok|okay|perfetto|bravo|brava|ottimo|great|nice)$/,
  },
  si: {
    forme:
      /^(si|sì|ok|okay|okey|conferma|confermo|confermi|certo|vai|procedi|fallo|esegui|yes|yep|yeah|sure|confirm|go|esatto|daje)$/,
  },
  no: { forme: /^(no|annulla|lascia|stop|niente|cancel|nope|nevermind|aspetta|ferma)$/ },
};

/* I verbi che comandano. Si guardano sulla parola intera, con i pronomi
 * attaccati che l'italiano ci mette: «spegnila», «accendile», «aprimelo». */
const VERBI = {
  accendi: /^(accend\w*|accenda|riaccend\w*)$/,
  attiva: /^(attiv[ai]\w*|abilit\w*)$/,
  spegni: /^(spegn\w*|speng\w*|spenga|disattiv\w*|disabilit\w*)$/,
  inverti: /^(invert\w*|commut\w*|toggle)$/,
  apri: /^(apri|aprire|apra|aprila|aprilo|aprili|aprimi|aprimelo|aprimela|apritela|open)$/,
  chiudi: /^(chiud\w*|close|shut)$/,
  alza: /^(alz\w*|solleva\w*|aument\w*|raise|increase)$/,
  abbassa: /^(abbass\w*|cala\w*|diminuisc\w*|diminui\w*|ridu\w*|ridurre|lower|decrease)$/,
  imposta:
    /^(impost\w*|metti|mettila|mettilo|mettere|regola|regolala|regolalo|setta|settala|set|porta|portala|portalo|porti)$/,
  ferma: /^(ferma|fermala|fermalo|fermale|fermare|stop)$/,
  inserisci: /^(inserisci|inseriscilo|inserire|inserisca|arm|arma|armare|armalo)$/,
  disinserisci:
    /^(disinserisci|disinseriscilo|disinserire|disinserisca|disarm|disarma|disarmalo|togli|toglilo)$/,
  sblocca: /^(sblocca|sbloccala|sbloccalo|sbloccare|sblocchi|unlock)$/,
  blocca: /^(blocca|bloccala|bloccalo|bloccare|blocchi|lock)$/,
};

/* Le forme dei verbi di cui si perdona una lettera sbagliata. */
const VERBI_SIMILI = {
  accendi: ["accendi", "accendere", "accendile", "accendila"],
  spegni: ["spegnere", "spegnile", "spegnila"],
  chiudi: ["chiudere", "chiudile", "chiudila"],
  abbassa: ["abbassa", "abbassare", "abbassale"],
  imposta: ["imposta", "impostare"],
};

/* Le frasi fatte di piu' parole: si guardano sulla frase intera. */
const FRASI = {
  accendi: /\b(turn on|switch on|turn (?:\w+ )+on|switch (?:\w+ )+on|accendi)\b/,
  spegni: /\b(turn off|switch off|shut off|turn (?:\w+ )+off|switch (?:\w+ )+off)\b/,
  apri: /\b(open up)\b/,
  blocca: /\b(chiudi a chiave|chiudere a chiave|chiudila a chiave|chiudilo a chiave|lock up)\b/,
  mostra:
    /\b(fammi vedere|fai vedere|fammela vedere|fammelo vedere|show me|let me see|voglio vedere|apri la telecamera|apri la videocamera)\b/,
  quantoManca:
    /\b(quanto manca|quanto resta|quanto ci mette|quando finisce|tempo rimanente|how long|time left)\b/,
  quantoTempo: /\b(quanto tempo|quanto ci vuole|da quanto tempo|how long)\b/,
  aiuto:
    /\b(cosa sai fare|che sai fare|cosa puoi fare|cosa posso (?:chiederti|dirti|chiedere|fare)|come funzioni|what can you do|what can i ask|how do you work)\b/,
  arieCondizionata: /\b(aria condizionata|air conditioning|pompa di calore|heat pump)\b/,
  nonRisponde:
    /\b(non rispond\w*|non funzion\w*|non (?:e|sono) disponibil\w*|non disponibil\w*|not responding|not available|offline|irraggiungibil\w*)\b/,
  inCasa: /\b(in casa|a casa|at home|is home|are home|home|dentro casa)\b/,
  fuoriCasa: /\b(fuori casa|non (?:e|sono) (?:in|a) casa|away|not home)\b/,
  energiaOggi: /\b(oggi|today|giornata|stamattina|da stamattina|this morning)\b/,
  quantiGradi:
    /\b(quanti gradi|che temperatura|how (?:hot|cold|warm)|what temperature|what s the temperature)\b/,
  chiCe:
    /\b(chi ce|ce qualcuno|ce nessuno|ci sono persone|e qualcuno|is anyone|is anybody|is someone|is somebody|who s home|who is home|who is at home|anyone home|anybody home)\b/,
  batterieBasse:
    /\b(batteri[ae] (?:scaric\w*|bass\w*|da cambiare|quasi scaric\w*|in esaurimento)|pile (?:scaric\w*|da cambiare)|low batter\w*|batteries? (?:low|to replace|running low))\b/,
  batteriaDiCasa:
    /\b(batteria di casa|batteria dell impianto|batteria del fotovoltaico|batteria dell accumulo|home battery|house battery|battery storage|accumulo)\b/,
  rifiutiDomanda:
    /\b(che (?:si )?(?:butta|passa|ritirano)|cosa (?:si )?(?:butta|passa|ritirano)|quando passa|porto fuori|portare fuori|metto fuori|put out|take out)\b/,
  produzione:
    /\b(quanto produce|quanto sta producendo|quanto ha prodotto|how much solar|solar production|is the sun)\b/,
};

/* ── la frase, pronta da interrogare ─────────────────────────────────────── */

/**
 * La frase pronta: le parole, le radici e due domande che il resto del modulo
 * le fa di continuo — «tocca questo concetto?», «c'e' questo verbo?».
 */
export function frase(testo) {
  const normale = normalizza(testo);
  const parole = normale ? normale.split(" ") : [];
  const radici = parole.map(radice);
  const cache = new Map();
  const tocca = (concetto) => {
    if (cache.has(concetto)) return cache.get(concetto);
    const voce = LESSICO[concetto];
    let si = false;
    if (voce) {
      si = parole.some((p) => voce.forme.test(p));
      if (!si && voce.simili)
        si = parole.some(
          (p) =>
            p.length >= 5 &&
            !VUOTE.has(p) &&
            /* La prima lettera giusta: «cancello» non e' «pannelli». */
            voce.simili.some(
              (s) => p[0] === s[0] && tolleranza(Math.min(p.length, s.length)) && somiglia(p, s),
            ),
        );
    }
    if (!si && FRASI[concetto]) si = FRASI[concetto].test(normale);
    cache.set(concetto, si);
    return si;
  };
  const verbo = (nome) =>
    parole.some((p) => VERBI[nome]?.test(p)) ||
    Boolean(FRASI[nome]?.test(normale)) ||
    /* Un errore di battitura sui verbi lunghi: «accnedi», «spefni». */
    parole.some(
      (p) => p.length >= 6 && elenco(VERBI_SIMILI[nome]).some((v) => distanza(p, v) <= 1),
    );
  return {
    testo: normale,
    parole,
    radici,
    /** Tocca il concetto? */
    tocca,
    /** C'e' quel verbo, coniugato o con un pronome attaccato? */
    verbo,
    /** Una frase fatta, o un'espressione qualsiasi sulla frase intera. */
    dice: (re) => (typeof re === "string" ? FRASI[re]?.test(normale) : re.test(normale)) || false,
    /** Le parole che contano: senza articoli, preposizioni, «e». */
    piene: parole.filter((p) => !VUOTE.has(p)),
  };
}

/* ── la lingua ───────────────────────────────────────────────────────────── */

const INGLESI = new Set(
  (
    "the is are what whats how who where when which turn switch lights light on off home house " +
    "weather tomorrow today temperature inside outside open close show me my any anyone someone " +
    "much many does do there please lock unlock arm disarm battery car doors windows of it " +
    "them all left running now tonight cameras garbage trash updates"
  ).split(" "),
);
const ITALIANE = new Set(
  (
    "il lo la le gli che di e ce cera sono quante quanti quale quali come dove chi quando casa " +
    "luce luci accese accesa spegni accendi apri chiudi tempo domani oggi fuori dentro in della " +
    "del nella nel sul una un per qualcuno nessuno tutte tutto finestre porte antifurto meteo " +
    "temperatura gradi mostrami fammi alza abbassa metti cosa ci si fa caldo freddo fresco " +
    "quanto quanta ho hai dimmi sono stanno dello degli nelle sulla"
  ).split(" "),
);

/**
 * In che lingua e' scritta la domanda: italiano o inglese, contando le parole
 * che sono solo dell'una o dell'altra. A pari merito vale quella della plancia
 * (se e' l'inglese), se no l'italiano.
 */
export function linguaDellaDomanda(testo, ripiego = "it") {
  const parole = normalizza(testo).split(" ").filter(Boolean);
  let it = 0;
  let en = 0;
  for (const p of parole) {
    if (ITALIANE.has(p) && !INGLESI.has(p)) it += 1;
    else if (INGLESI.has(p) && !ITALIANE.has(p)) en += 1;
  }
  if (en > it) return "en";
  if (it > en) return "it";
  return String(ripiego || "")
    .toLowerCase()
    .startsWith("en")
    ? "en"
    : "it";
}

/* ── le cose nella frase: i nomi ─────────────────────────────────────────── */

/** Le parole che contano di un nome, gia' come radici. */
export function paroleDelNome(nome) {
  return normalizza(nome)
    .split(" ")
    .filter((p) => p && !VUOTE.has(p));
}

/* Una parola del nome sta nella frase? Esatta, con la stessa radice, o con un
 * errore di battitura perdonato. I numeri devono essere esattamente quelli. */
function nellaFrase(parola, f) {
  return f.parole.some((p) => somiglia(p, parola));
}

/**
 * Quanto un nome sta nella frase: `tutte` se ci sono tutte le sue parole,
 * `quante` quelle trovate. Le parole da `trascurare` (la stanza, la categoria)
 * non contano ne' a favore ne' contro.
 */
export function nomeNellaFrase(nome, f, trascurare = []) {
  const parole = paroleDelNome(nome).filter((p) => !trascurare.some((t) => somiglia(t, p)));
  if (!parole.length) return { tutte: false, quante: 0, parole: 0 };
  const trovate = parole.filter((p) => nellaFrase(p, f)).length;
  return { tutte: trovate === parole.length, quante: trovate, parole: parole.length };
}

/* Le stanze che si chiamano in tanti modi. Il primo e' solo un'etichetta: un
 * nome di stanza che sta in un gruppo si trova con qualunque altro nome del
 * gruppo («sala» trova il «Soggiorno»). */
const STANZE_SINONIME = [
  ["soggiorno", "sala", "salotto", "salone", "living", "living room", "lounge", "sala da pranzo"],
  ["camera da letto", "camera", "stanza da letto", "camera matrimoniale", "letto", "bedroom"],
  ["cucina", "kitchen", "angolo cottura", "cucinotto"],
  ["bagno", "bathroom", "toilette", "servizi", "wc", "bagno principale"],
  ["studio", "ufficio", "office", "study"],
  ["ingresso", "entrata", "corridoio", "disimpegno", "hall", "hallway", "entrance"],
  ["cameretta", "camera dei bambini", "camera bimbi", "kids room", "nursery"],
  ["lavanderia", "laundry", "laundry room"],
  ["garage", "box", "autorimessa"],
  ["giardino", "garden", "cortile", "yard", "backyard"],
  ["terrazzo", "terrazza", "balcone", "balcony", "terrace"],
  ["taverna", "cantina", "seminterrato", "basement", "cellar"],
  ["mansarda", "soffitta", "sottotetto", "attic"],
  ["camera degli ospiti", "camera ospiti", "stanza degli ospiti", "guest room"],
];

/**
 * Due nomi per la stessa stanza? «Sala» e «Soggiorno» si', «Camera» e «Camera
 * da letto» si', «Cucina» e «Bagno» no. Senza maiuscole, accenti e articoli.
 */
export function stessaStanza(a, b) {
  const x = paroleDelNome(a).join(" ");
  const y = paroleDelNome(b).join(" ");
  if (!x || !y) return false;
  if (x === y) return true;
  return nomiDellaStanza(a).some((n) => paroleDelNome(n).join(" ") === y);
}

function nomiDellaStanza(nome) {
  const normale = paroleDelNome(nome).join(" ");
  const nomi = [nome];
  for (const gruppo of STANZE_SINONIME) {
    const forme = gruppo.map((g) => paroleDelNome(g).join(" "));
    if (forme.includes(normale)) nomi.push(...gruppo);
  }
  return nomi;
}

/**
 * La stanza di cui parla la frase, fra quelle che la casa ha: il nome che ci
 * sta tutto e con piu' parole vince — «camera degli ospiti» batte «camera».
 * `""` se la frase non nomina nessuna stanza.
 */
export function trovaStanza(f, aree = []) {
  let migliore = "";
  let punti = 0;
  for (const area of new Set(elenco(aree).map(pulito).filter(Boolean))) {
    for (const nome of nomiDellaStanza(area)) {
      const dove = nomeNellaFrase(nome, f);
      if (!dove.tutte) continue;
      /* Il nome vero vale piu' del sinonimo, a parita' di parole. */
      const valore = dove.parole * 10 + (nome === area ? 1 : 0);
      if (valore > punti) {
        punti = valore;
        migliore = area;
      }
    }
  }
  return migliore;
}

/** La persona di cui parla la frase, per nome. */
export function trovaPersona(f, persone = []) {
  let migliore = null;
  let punti = 0;
  for (const persona of elenco(persone)) {
    const dove = nomeNellaFrase(persona.nome || persona.name, f);
    if (dove.tutte && dove.parole > punti) {
      punti = dove.parole;
      migliore = persona;
    }
  }
  return migliore;
}

/* ── i numeri e i giorni ─────────────────────────────────────────────────── */

const NUMERI_A_PAROLE = {
  zero: 0,
  un: 1,
  uno: 1,
  una: 1,
  one: 1,
  a: 1,
  mezzo: 0.5,
  mezza: 0.5,
  half: 0.5,
  due: 2,
  two: 2,
  tre: 3,
  three: 3,
  quattro: 4,
  four: 4,
  cinque: 5,
  five: 5,
  sei: 6,
  six: 6,
  sette: 7,
  seven: 7,
  otto: 8,
  eight: 8,
  nove: 9,
  nine: 9,
  dieci: 10,
  ten: 10,
  venti: 20,
  ventuno: 21,
  ventidue: 22,
  ventitre: 23,
  ventiquattro: 24,
  diciotto: 18,
  diciannove: 19,
  trenta: 30,
  cinquanta: 50,
  cento: 100,
};

/**
 * I numeri della frase: i gradi («21 gradi», «di un grado», «di mezzo
 * grado»), la percentuale («al 50%», «50 per cento», «a meta'») e il primo
 * numero nudo. Se si dice «di» prima dei gradi e' un passo, non una meta:
 * «alza di 2 gradi» e «metti 21 gradi» sono due domande diverse.
 */
export function numeriDellaFrase(f) {
  const p = f.parole;
  let gradi = null;
  let passo = null;
  let percento = null;
  let numero = null;
  const valore = (parola) => {
    if (/^\d+(\.\d+)?$/.test(parola)) return Number(parola);
    return Object.hasOwn(NUMERI_A_PAROLE, parola) ? NUMERI_A_PAROLE[parola] : null;
  };
  for (let i = 0; i < p.length; i += 1) {
    const n = valore(p[i]);
    if (n === null) continue;
    const dopo = p[i + 1] || "";
    const prima = p[i - 1] || "";
    /* «a» e «un» da soli sono numeri solo davanti a «grado». */
    if (["a", "un", "una", "uno", "one"].includes(p[i]) && !/^(grad[oi]|degrees?)$/.test(dopo))
      continue;
    if (/^(grad[oi]|degrees?|celsius)$/.test(dopo)) {
      if (/^(di|by)$/.test(prima)) passo = n;
      else gradi = n;
      continue;
    }
    if (/^(percento|percent|per)$/.test(dopo)) {
      percento = n;
      continue;
    }
    if (/^(al|a|to)$/.test(prima) && n <= 100 && /^\d/.test(p[i])) {
      percento ??= n;
      numero ??= n;
      continue;
    }
    if (/^(di|by)$/.test(prima) && n <= 5) {
      passo ??= n;
      continue;
    }
    numero ??= n;
  }
  if (percento === null && /\b(a meta|half way|halfway|meta)\b/.test(f.testo)) percento = 50;
  return { gradi, passo, percento, numero };
}

const GIORNI_IT = ["domenica", "lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"];
const GIORNI_EN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Di quando parla la frase: `giorno` e' quanti giorni da oggi (0 oggi, 1
 * domani), `null` se non lo dice; `adesso` se lo dice esplicitamente;
 * `settimana` per «questa settimana», «nei prossimi giorni».
 */
export function quandoNellaFrase(f, adesso = Date.now()) {
  const t = f.testo;
  const fuori = { giorno: null, adesso: false, settimana: false, sera: false };
  if (/\b(dopodomani|day after tomorrow)\b/.test(t)) fuori.giorno = 2;
  else if (/\b(domani|domattina|tomorrow)\b/.test(t)) fuori.giorno = 1;
  else if (
    /\b(oggi|stamattina|stasera|stanotte|stamani|oggi pomeriggio|today|tonight|this (?:morning|afternoon|evening))\b/.test(
      t,
    )
  )
    fuori.giorno = 0;
  if (/\b(stasera|stanotte|tonight|this evening|sera)\b/.test(t)) fuori.sera = true;
  if (
    /\b(adesso|ora|attualmente|in questo momento|al momento|now|right now|currently|at the moment)\b/.test(
      t,
    )
  )
    fuori.adesso = true;
  if (/\b(settimana|prossimi giorni|weekend|fine settimana|week|next days)\b/.test(t))
    fuori.settimana = true;
  if (fuori.giorno === null) {
    const oggi = new Date(adesso).getDay();
    for (let g = 0; g < 7; g += 1) {
      const re = new RegExp(`\\b(${GIORNI_IT[g]}|${GIORNI_EN[g]})\\b`);
      if (re.test(t)) {
        fuori.giorno = (g - oggi + 7) % 7;
        break;
      }
    }
  }
  return fuori;
}

/* ── l'intento ───────────────────────────────────────────────────────────── */

/** Gli intenti che il modulo riconosce, per chi li vuole elencare. */
export const INTENTI = Object.freeze([
  "aiuto",
  "saluto",
  "conferma",
  "annulla",
  "codice",
  "telecamera",
  "antifurto_comando",
  "serratura_comando",
  "clima_imposta",
  "comando",
  "dove_e",
  "quando_uscito",
  "chi_in_casa",
  "rifiuti",
  "calendario",
  "aggiornamenti",
  "batterie_basse",
  "batteria_casa",
  "auto",
  "non_rispondono",
  "antifurto_stato",
  "solare",
  "energia",
  "elettrodomestici",
  "meteo",
  "temperatura_fuori",
  "temperatura_dentro",
  "umidita",
  "luci",
  "aperture",
  "tapparelle",
  "stato_dispositivo",
]);

/* La categoria di cose di cui parla un comando, e i domini che la fanno. */
const CATEGORIE = [
  ["cancello", ["cover", "lock", "switch", "button"]],
  ["telecamera", ["camera"]],
  ["luci", ["light"]],
  ["tapparelle", ["cover"]],
  ["clima", ["climate"]],
  ["ventilatore", ["fan"]],
  /* La presa prima della tv: «la presa della tv» e' la presa. */
  ["prese", ["switch", "input_boolean"]],
  ["media", ["media_player"]],
  ["serratura", ["lock"]],
];

/** La categoria della frase e i domini che le appartengono. */
export function categoriaDellaFrase(f) {
  for (const [nome, domini] of CATEGORIE) {
    if (nome === "clima" && f.dice("arieCondizionata")) return { categoria: nome, domini };
    if (f.tocca(nome)) return { categoria: nome, domini };
  }
  return { categoria: "", domini: [] };
}

/* Il verbo del comando, se la frase ne ha uno. L'ordine conta: «chiudi a
 * chiave» e' bloccare, non chiudere; «spegni» vince su «accendi» quando le
 * due cose stanno nella stessa frase fatta inglese. */
/* Le domande inglesi cominciano cosi': «are any windows open?» non e' un
 * comando, «can you open the gate?» si'. */
const DOMANDA_INGLESE =
  /^(are|is|any|which|what|whats|how|where|who|when|do|does|did|were|was|has|have|will|would|why)$/;

function verboDelComando(f) {
  if (DOMANDA_INGLESE.test(f.parole[0] || "") && !/\b(turn|switch)\b/.test(f.testo)) return "";
  if (f.verbo("blocca") && !f.verbo("sblocca")) return "blocca";
  if (f.verbo("sblocca")) return "sblocca";
  if (f.dice("spegni") || f.verbo("spegni")) return "spegni";
  if (f.dice("accendi") || f.verbo("accendi")) return "accendi";
  if (f.verbo("inverti")) return "inverti";
  if (f.verbo("disinserisci")) return "disinserisci";
  if (f.verbo("inserisci")) return "inserisci";
  if (f.verbo("attiva")) return "accendi";
  if (f.verbo("apri") || f.dice("apri")) return "apri";
  if (f.verbo("chiudi")) return "chiudi";
  if (f.verbo("alza")) return "alza";
  if (f.verbo("abbassa")) return "abbassa";
  if (f.verbo("ferma")) return "ferma";
  if (f.verbo("imposta")) return "imposta";
  return "";
}

/* Le categorie dette al plurale: «le luci» sono tutte quelle che servono, «la
 * luce» e' una. */
const PLURALI =
  /^(luci|lampade|tapparelle|persiane|tende|serrande|avvolgibili|prese|ventilatori|finestre|porte|lights|lamps|blinds|shutters|covers|curtains|plugs|switches|fans|windows|doors)$/;

/* Un pronome attaccato al verbo, o «it/them»: la cosa di cui si parlava. */
function conIlPronome(f) {
  return (
    f.parole.some(
      (p) =>
        /^(spegn|accend|apr|chiud|alz|abbass|ferm|sblocc|blocc|attiv|disattiv)\w*(la|le|lo|li|mela|melo|mele|meli|tela|tele)$/.test(
          p,
        ) && !/^(aprile)$/.test(p),
    ) ||
    /\b(turn (?:it|them) (?:on|off)|switch (?:it|them) (?:on|off)|open (?:it|them)|close (?:it|them))\b/.test(
      f.testo,
    )
  );
}

/* Un posto scritto con la maiuscola dopo «a», «ad», «in», «at»: «che tempo fa
 * a Roma», «weather in Paris». Se non e' una stanza, una persona o una cosa
 * della casa, la domanda e' per qualcun altro. */
function luogoLontano(testo, sapere) {
  const trovato = /(?:^|\s)(?:a|ad|in|at|for|di)\s+([A-ZÀ-Ý][a-zà-ÿ]{2,})/.exec(
    String(testo || ""),
  );
  if (!trovato) return false;
  const parola = trovato[1];
  if (/^(Casa|Home)$/i.test(parola)) return false;
  const conosciuti = [
    ...elenco(sapere.aree),
    ...elenco(sapere.persone).map((p) => p.nome || p.name),
    ...elenco(sapere.telecamere).map((t) => t.nome || t.name),
    ...elenco(sapere.entita).map((e) => e.nome),
  ];
  const f = frase(parola);
  return !conosciuti.some(
    (nome) => stessaStanza(nome, parola) || nomeNellaFrase(nome, f).quante > 0,
  );
}

/* La frase comincia come un seguito: «e in camera?», «e domani?», «and
 * outside?», «invece in cucina?». */
function eUnSeguito(f) {
  return (
    /^(e|ed|and|invece|anche|pure|what about|how about|e invece|e adesso|e ora)\b/.test(f.testo) ||
    f.parole.length <= 3
  );
}

/* Le domande di stato: «è accesa», «com'è», «è aperta». */
function eUnaDomandaDiStato(f) {
  return (
    f.tocca("acceso") ||
    f.tocca("spento") ||
    f.tocca("aperto") ||
    f.tocca("chiuso") ||
    /\b(come|stato|status|is|e|state)\b/.test(f.testo)
  );
}

/**
 * Cosa vuole sapere, o fare, chi ha scritto.
 *
 * `sapere` porta quello che serve per riconoscere le cose per nome: le stanze
 * (`aree`), le persone, le entita' (`entita`, con `nome` e `dominio`), le
 * telecamere. `memoria` e' la conversazione di prima: l'ultimo intento, la
 * stanza, le cose di cui si parlava, l'azione in attesa di conferma.
 *
 * Torna `null` quando la frase non e' una di quelle che si sanno capire: e'
 * il segno per passarla ad Assist.
 */
export function capisci(testo, sapere = {}, memoria = {}, opzioni = {}) {
  const f = frase(testo);
  if (!f.parole.length) return null;
  const adesso = Number(opzioni.adesso ?? sapere.adesso ?? Date.now());
  const lingua = linguaDellaDomanda(testo, opzioni.lingua || sapere.lingua || "it");
  const stanza = trovaStanza(f, sapere.aree);
  const persona = trovaPersona(f, sapere.persone);
  const quando = quandoNellaFrase(f, adesso);
  const numeri = numeriDellaFrase(f);
  const { categoria, domini } = categoriaDellaFrase(f);
  const verbo = verboDelComando(f);
  const base = {
    lingua,
    stanza,
    persona,
    quando,
    numeri,
    categoria,
    domini,
    verbo,
    tutte: f.tocca("tutte"),
    plurale: f.parole.some((p) => PLURALI.test(p)),
    fuori: (f.tocca("fuori") || /\b(all aperto|outdoors?)\b/.test(f.testo)) && !f.dice("fuoriCasa"),
    pronome: conIlPronome(f),
    testo: f.testo,
    seguito: false,
  };
  const con = (intento, resto = {}) => ({ ...base, intento, ...resto });
  const attesa = memoria?.inAttesa;

  /* 1. Una conferma, o un codice, a una domanda della casa. */
  if (attesa) {
    if (
      attesa.codice &&
      /^[a-z0-9]{3,12}$/i.test(pulito(testo).replace(/\s+/g, "")) &&
      !f.tocca("no")
    )
      return con("codice", { codice: pulito(testo).replace(/\s+/g, "") });
    if (f.parole.length <= 4 && f.tocca("si") && !f.tocca("no")) return con("conferma");
    if (f.parole.length <= 4 && f.tocca("no")) return con("annulla");
  }

  /* I costi non li sa nessuno qui: «quanto costa la luce» non e' «quante
   * luci sono accese», e una domanda su un posto lontano («che tempo fa a
   * Roma?») non e' il meteo di casa. Vanno ad Assist. */
  if (
    /\b(costa|costano|costo|costi|prezzo|bolletta|tariffa|spendo|spesa|cost|price|bill)\b/.test(
      f.testo,
    )
  )
    return null;
  if (luogoLontano(testo, sapere)) return null;

  /* 2. Le parole di cortesia e la domanda «cosa sai fare». */
  if (f.dice("aiuto") || (f.tocca("aiuto") && f.parole.length <= 4)) return con("aiuto");
  if (f.parole.length <= 3 && f.tocca("saluto") && !verbo) return con("saluto");

  /* 3. Le telecamere: «mostrami il cancello», «fammi vedere il giardino». */
  const telecamere = elenco(sapere.telecamere);
  const linguaCamera =
    f.parole.some((p) => /^(telecamer|videocamer|webcam|cam$)/.test(p)) ||
    (lingua === "en" && f.parole.some((p) => /^cameras?$/.test(p)));
  const vedere = f.dice("mostra") || f.parole.some((p) => /^(mostr|inquadr|show|display)/.test(p));
  if (vedere || linguaCamera) {
    const telecamera =
      migliorePerNome(f, telecamere, stanza) ||
      (stanza &&
        (telecamere.find((t) => stessaStanza(t.nome || t.name, stanza)) ||
          telecamere.find((t) => t.area && stessaStanza(t.area, stanza)))) ||
      null;
    if (telecamera || linguaCamera) return con("telecamera", { telecamera });
  }

  /* 4. L'antifurto da comandare. */
  if (f.tocca("antifurto") && /^(inserisci|accendi|disinserisci|spegni|imposta)$/.test(verbo)) {
    const disinserisci = verbo === "disinserisci" || verbo === "spegni";
    let modo = "away";
    if (/\b(notte|night|notturno)\b/.test(f.testo)) modo = "night";
    else if (/\b(casa|home|perimetral\w*|parziale|stay)\b/.test(f.testo)) modo = "home";
    return con("antifurto_comando", { azione: disinserisci ? "disarma" : "inserisci", modo });
  }

  /* 5. Le serrature: «chiudi a chiave la porta», «sblocca la porta». */
  if ((verbo === "blocca" || verbo === "sblocca") && !f.tocca("antifurto"))
    return con("serratura_comando", { azione: verbo });
  if (verbo === "apri" && f.tocca("serratura"))
    return con("serratura_comando", { azione: "sblocca" });

  /* 6. Il clima da regolare: «alza la temperatura in camera di 1 grado»,
   * «metti 21 gradi in sala», «abbassa il riscaldamento». */
  const parlaDiClima = f.tocca("temperatura") || categoria === "clima" || numeri.gradi !== null;
  if (parlaDiClima && /^(alza|abbassa|imposta)$/.test(verbo) && !f.tocca("tapparelle"))
    return con("clima_imposta", {
      direzione: verbo === "alza" ? 1 : verbo === "abbassa" ? -1 : 0,
      gradi: numeri.gradi ?? (verbo === "imposta" ? numeri.numero : null),
      passo: numeri.passo,
    });

  /* 7. Un comando: accendi, spegni, apri, chiudi, alza, abbassa, ferma. */
  if (verbo && !["inserisci", "disinserisci", "imposta"].includes(verbo)) {
    if (!(verbo === "apri" && f.tocca("telecamera"))) return con("comando", { azione: verbo });
  }

  /* 8. Le domande. Prima quelle con un nome di persona. */
  if (persona) {
    if (f.tocca("uscito") || (f.tocca("quando") && !f.tocca("dove")) || f.dice("quantoTempo"))
      return con("quando_uscito");
    return con("dove_e");
  }
  /* «chi c'è», «c'è qualcuno», «chi è a casa»: «chi» da solo non basta —
   * «chi ha vinto la partita?» non e' una domanda per la casa. */
  if (
    f.dice("chiCe") ||
    (f.tocca("chi") && (f.tocca("casa") || f.dice("inCasa"))) ||
    (/^(qualcuno|nessuno|persone|anyone|anybody|someone|somebody|nobody|everyone|everybody)$/.test(
      f.parole.find((p) => LESSICO.chi.forme.test(p)) || "",
    ) &&
      !verbo)
  )
    return con("chi_in_casa");

  /* I ritiri prima di tutto il resto: «umido», «carta» e «secco» sono anche
   * il tempo e l'aria, ma «quando passa l'umido» e' la raccolta. */
  const parlaDiRifiuti =
    f.dice("rifiutiDomanda") ||
    f.parole.some((p) =>
      /^(rifiut|spazzatur|immondizi|pattumier|differenziat|indifferenziat|bidon|trash|garbage|waste|rubbish|recycling)/.test(
        p,
      ),
    ) ||
    (f.tocca("rifiuti") && f.tocca("ritiro"));
  if (parlaDiRifiuti) return con("rifiuti");

  if (
    f.tocca("calendario") ||
    /\b(cosa (?:ho|devo fare)|what do i have|what s on|whats on)\b/.test(f.testo)
  )
    return con("calendario");
  if (f.tocca("aggiornamenti")) return con("aggiornamenti");
  if (
    f.dice("nonRisponde") ||
    f.parole.some((p) => /^(offline|irraggiungibil|scollegat|unavailable|disconness)/.test(p))
  )
    return con("non_rispondono");

  /* Le batterie: quelle dei sensori da cambiare, quella di casa, quella
   * dell'auto. */
  if (f.tocca("batteria")) {
    if (
      f.dice("batterieBasse") ||
      f.tocca("scarica") ||
      f.parole.some((p) => /^(pile|sensor)/.test(p))
    )
      return con("batterie_basse");
    if (f.tocca("auto")) return con("auto");
    return con("batteria_casa");
  }
  /* La lavatrice prima dell'auto: «washing machine» non e' una macchina. */
  if (f.tocca("elettrodomestici") && !f.parole.some((p) => /^(auto|car|macchina|vettura)$/.test(p)))
    return con("elettrodomestici");
  if (f.tocca("auto")) return con("auto");
  if (f.tocca("antifurto")) return con("antifurto_stato");

  /* Il sole che produce e la casa che consuma. */
  if (f.tocca("solare") || f.dice("produzione")) return con("solare");
  if (f.tocca("energia")) return con("energia");

  if (f.tocca("elettrodomestici") || (f.dice("quantoManca") && !f.tocca("meteo")))
    return con("elettrodomestici");

  /* Il tempo e la temperatura. «tempo» e' il meteo, ma non in «quanto
   * tempo manca». */
  const parlaDiMeteo = f.tocca("meteo") && !f.dice("quantoTempo") && !f.dice("quantoManca");
  const parlaDiTemperatura =
    f.tocca("temperatura") || f.dice("quantiGradi") || f.tocca("caldoFreddo");
  if (f.tocca("umidita") && !parlaDiRifiuti) return con("umidita");
  if (parlaDiTemperatura) {
    if (
      base.fuori ||
      (quando.giorno !== null && quando.giorno > 0) ||
      (parlaDiMeteo && !stanza && !f.tocca("casa"))
    )
      return quando.giorno !== null && quando.giorno > 0 ? con("meteo") : con("temperatura_fuori");
    return con("temperatura_dentro");
  }
  if (parlaDiMeteo) return con("meteo");

  /* Le luci, le aperture, le tapparelle. */
  if (categoria === "luci") return con("luci");
  if (
    f.tocca("finestre") ||
    f.tocca("porte") ||
    categoria === "cancello" ||
    (f.tocca("aperto") && !categoria)
  )
    return con("aperture");
  if (categoria === "tapparelle") return con("tapparelle");

  /* Un dispositivo per nome: «la lavatrice è accesa?», «com'è il pensile?». */
  const cosa = migliorePerNome(f, elenco(sapere.entita), stanza);
  if (cosa && eUnaDomandaDiStato(f)) return con("stato_dispositivo", { dispositivo: cosa });

  /* 9. Un seguito: «e in camera?», «e fuori?», «e domani?», «e Persona 2?».
   * Vale l'intento di prima con il pezzo nuovo. */
  const prima = memoria?.intento;
  if (prima && eUnSeguito(f)) {
    const seguito = { ...base, seguito: true };
    if (base.fuori && /^temperatura_dentro$/.test(prima))
      return { ...seguito, intento: "temperatura_fuori" };
    if (base.fuori && prima === "umidita") return { ...seguito, intento: "umidita", fuori: true };
    if (stanza && /^(temperatura_fuori|meteo)$/.test(prima))
      return { ...seguito, intento: "temperatura_dentro" };
    if (
      quando.giorno !== null &&
      quando.giorno > 0 &&
      /^(temperatura_fuori|temperatura_dentro)$/.test(prima)
    )
      return { ...seguito, intento: "meteo" };
    if (stanza || quando.giorno !== null || base.fuori || f.tocca("casa"))
      return {
        ...seguito,
        intento: prima,
        azione: memoria.azione || "",
        categoria: memoria.categoria || "",
        domini: elenco(memoria.domini),
        stanza,
        casa: f.tocca("casa"),
      };
  }
  return null;
}

/**
 * La cosa (entita' o telecamera) che la frase nomina meglio. Con una stanza,
 * vincono le cose di quella stanza; un nome che e' tutto categoria («Luce»)
 * conta solo se sta nella stanza giusta.
 */
export function migliorePerNome(f, voci = [], stanza = "") {
  const stanzaParole = stanza ? paroleDelNome(stanza) : [];
  let migliore = null;
  let punti = 0;
  for (const voce of elenco(voci)) {
    const nome = pulito(voce.nome || voce.name);
    if (!nome) continue;
    const dove = nomeNellaFrase(nome, f, stanzaParole);
    if (!dove.tutte || !dove.parole) continue;
    if (stanza && voce.area && pulito(voce.area).toLowerCase() !== stanza.toLowerCase()) {
      /* Fuori dalla stanza detta: conta solo se il nome ha parole sue. */
      if (dove.parole < 2) continue;
    }
    const valore = dove.parole * 10 + (stanza && voce.area === stanza ? 5 : 0);
    if (valore > punti) {
      punti = valore;
      migliore = voce;
    }
  }
  return migliore;
}
