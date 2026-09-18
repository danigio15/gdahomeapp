/* Come sta la casa, in una riga sotto il meteo (#356, #357).
 *
 * «Una barra sotto la parte meteo che mostra le indicazioni principali. Icona
 * + organico. Lampadina con luci accese. Tapparella con tapparelle aperte
 * ecc.»
 *
 * Il titolo della richiesta diceva «Raccolta Differenziata», ma il corpo
 * chiedeva un'altra cosa: non una scheda in piu', una RIGA. Chi passa davanti
 * alla plancia guarda il meteo e poi vuole sapere, senza toccare niente, se
 * stasera esce l'organico, se e' rimasta una luce accesa, se una finestra e'
 * aperta. Le tessere lo dicono gia', ma una tessera occupa mezzo schermo e va
 * cercata: qui bastano una pastiglia e due parole.
 *
 * Questo modulo non legge nessuna entita'. Le tessere della Home hanno gia'
 * fatto quel lavoro — quali luci esistono, quali sono accese, quando passa il
 * ritiro — e rifarlo qui vorrebbe dire due conti sugli stessi stati, che prima
 * o poi non tornano uguali. Entrano i modelli delle tessere cosi' come sono,
 * esce l'elenco delle pastiglie da mostrare; le parole per dirle stanno nella
 * sezione, come in tutto il nucleo.
 *
 * La posta (#357) e' l'unica voce che non viene da una tessera: e' un contatto
 * sulla cassetta, e nessun'altra parte della plancia lo guarda. Nemmeno qui lo
 * si legge — arriva gia' letto — ma qui sta la regola che conta: «deve restare
 * visibile finche' uno non l'ha vista». Un lampo di due secondi mentre non si
 * guarda non serve a niente.
 */

const pulito = (valore) => String(valore ?? "").trim();

/* Le voci della barra, nell'ordine in cui si vedono.
 *
 * Prima quello che e' successo — la posta e' arrivata, il ritiro e' domani,
 * l'antifurto sta suonando — poi quello che e' rimasto acceso. Chi passa
 * davanti alla plancia legge da sinistra, e la prima pastiglia e' la notizia.
 *
 * `tessera` e' la chiave del modello della Home da cui la voce prende il suo
 * conto, ed e' anche la tessera che si apre toccando la pastiglia. La posta
 * non ne ha una: e' roba sua.
 */
export const VOCI_DELLA_BARRA = Object.freeze([
  Object.freeze({ chiave: "posta", tessera: "" }),
  Object.freeze({ chiave: "rifiuti", tessera: "rifiuti" }),
  Object.freeze({ chiave: "sicurezza", tessera: "sicurezza" }),
  /* Le porte e i varchi aperti, subito dopo l'antifurto (#482).
   *
   * «Sotto al meteo non appare l'allert dei varchi aperti. Ho finestre aperte
   * ma non vengono conteggiate. Nella card varchi tutto regolare.» La card era
   * regolare davvero: la fascia queste due voci non le aveva mai avute, quindi
   * non c'era un conto sbagliato da correggere ma una pastiglia da fare.
   *
   * Stanno prima delle luci e non dopo, perche' un varco aperto e' una
   * notizia, non una cosa rimasta accesa: e' la stessa ragione per cui le loro
   * tessere diventano rosse mentre quella delle luci resta gialla. E stanno
   * dopo l'antifurto, che e' la notizia piu' grossa delle tre. */
  Object.freeze({ chiave: "porte", tessera: "porte" }),
  Object.freeze({ chiave: "varchi", tessera: "varchi" }),
  Object.freeze({ chiave: "luci", tessera: "luci" }),
  Object.freeze({ chiave: "tapparelle", tessera: "tapparelle" }),
  Object.freeze({ chiave: "clima", tessera: "clima" }),
  Object.freeze({ chiave: "prese", tessera: "prese" }),
  Object.freeze({ chiave: "media", tessera: "media" }),
  /* Le due misure stanno in fondo, e non e' un dettaglio (#461).
   *
   * «Sarebbe possibile inserire temperatura e umidita' di sensori personali?
   * Io ho un sensore esterno all'abitazione con cui mi regolo con i clima
   * interni.» Sono due letture, non due notizie: non succedono, ci sono
   * sempre. Chi legge la fascia da sinistra deve trovare per prima la cosa
   * che e' successa — la posta, il ritiro, l'antifurto — e queste due dopo,
   * dove si guardano quando si vogliono. Aprono la tessera Temperature, che
   * e' dove la stessa domanda ha la risposta lunga. */
  Object.freeze({ chiave: "temperatura", tessera: "temperatura" }),
  Object.freeze({ chiave: "umidita", tessera: "temperatura" }),
  /* E la pioggia, per chi ha una stazione meteo (#478).
   *
   * «Sarebbe utile vedere il rain rate e la pioggia caduta nella giornata.»
   * Sono due letture come le altre due, e stanno nello stesso posto: sotto il
   * meteo, che e' dove uno le cerca. Una tessera non ce l'hanno — la pioggia
   * caduta non e' una sezione — quindi la pastiglia si guarda e basta. */
  Object.freeze({ chiave: "pioggia", tessera: "" }),
  Object.freeze({ chiave: "pioggiaOggi", tessera: "" }),
]);

const NOTE = new Set(VOCI_DELLA_BARRA.map((voce) => voce.chiave));

/* Ogni pastiglia porta la tinta della SUA tessera: sono la stessa notizia detta
 * due volte, una in breve e una per esteso, e due colori diversi per lo stesso
 * fatto sono due fatti. La posta una tessera non ce l'ha — nasce da un
 * contatto, non da una sezione — e tiene il blu degli avvisi. */
export const TINTA_POSTA = "#2563eb";

/* Le due misure una tessera ce l'hanno — Temperature — ma la sua tinta parla
 * delle stanze di casa, e queste due parlano di un sensore scelto a mano, che
 * spesso e' fuori. Portano il colore della cosa che misurano: il caldo e
 * l'acqua. */
export const TINTA_TEMPERATURA = "#f97316";
export const TINTA_UMIDITA = "#0ea5e9";
/* La pioggia e' l'acqua che cade: il blu dell'umidita' sarebbe la stessa cosa
 * detta due volte, e queste due pastiglie stanno accanto a quella. */
export const TINTA_PIOGGIA = "#4f46e5";

/* Le voci che non vengono da una tessera ma da un sensore scelto: quale
 * disegno portano e di che colore. Il valore lo legge la sezione — questo
 * modulo non guarda nessuna entita' — e arriva gia' letto, come la posta. */
const MISURE = Object.freeze({
  temperatura: Object.freeze({ icona: "🌡️", mdi: "mdi:thermometer", tinta: TINTA_TEMPERATURA }),
  umidita: Object.freeze({ icona: "💧", mdi: "mdi:water-percent", tinta: TINTA_UMIDITA }),
  pioggia: Object.freeze({ icona: "🌧️", mdi: "mdi:weather-pouring", tinta: TINTA_PIOGGIA }),
  pioggiaOggi: Object.freeze({ icona: "☔", mdi: "mdi:weather-rainy", tinta: TINTA_PIOGGIA }),
});

/* Quante ne sono accese, aperte, in funzione.
 *
 * Il conto lo ha gia' fatto la tessera: le luci accese stanno in `on`, le
 * aperture in `open`, le casse che suonano in `suonano`. Qui si legge quel
 * campo e basta — rifiltrare le righe vorrebbe dire scrivere una seconda volta
 * la regola di cosa conta come «accesa», e due regole sulla stessa cosa
 * divergono al primo caso strano: una presa che non risponde, una tapparella
 * socchiusa che in casa conta chiusa.
 */
const ACCESE = Object.freeze({
  luci: "on",
  tapparelle: "open",
  clima: "on",
  prese: "on",
  media: "suonano",
  /* Le due voci dei passaggi (#482). Anche loro portano le righe aperte nel
   * modello, e anche qui vale la regola di sopra: si legge il campo, non si
   * rifiltrano le righe. */
  porte: "open",
  varchi: "open",
});

/** La configurazione della barra, ripulita: quali voci si vedono e la cassetta. */
export function normalizzaBarra(salvato) {
  const dato = salvato && typeof salvato === "object" && !Array.isArray(salvato) ? salvato : {};
  const scelte = dato.voci && typeof dato.voci === "object" ? dato.voci : {};
  const voci = {};
  /* Di serie ci sono tutte: una voce che non ha niente da dire non si vede
   * comunque, quindi partire con tutte accese non riempie niente di inutile e
   * fa trovare la barra gia' fatta a chi non apre mai la configurazione. */
  for (const voce of VOCI_DELLA_BARRA) voci[voce.chiave] = scelte[voce.chiave] !== false;
  return {
    voci,
    posta: pulito(dato.posta),
    /* I due sensori scelti a mano. Vuoti di serie: una misura che nessuno ha
     * indicato non si indovina, e senza la pastiglia non c'e'. */
    temperatura: pulito(dato.temperatura),
    umidita: pulito(dato.umidita),
    /* I due della pioggia (#478): quanto sta venendo giu' adesso e quanto ne
     * e' caduta oggi. Sono gli stessi che legge l'irrigazione, e si scrivono
     * qui una volta sola: chiederli due volte vorrebbe dire due caselle che
     * possono discordare sulla stessa stazione meteo. */
    pioggia: pulito(dato.pioggia),
    pioggiaOggi: pulito(dato.pioggiaOggi),
    /* L'ora da cui la pastiglia dei rifiuti guarda a domani (#565). Vuota di
     * serie: la fascia resta quella di prima per chi non ha chiesto niente. */
    rifiutiDalleOre: normalizzaOraDelRitiro(dato.rifiutiDalleOre),
  };
}

/* I ritiri che riguardano adesso: oggi o domani, non fra sei giorni.
 *
 * Sono i due momenti in cui la risposta serve — stasera metto fuori qualcosa,
 * o domattina — ed e' la stessa soglia con cui si accende la tessera dei
 * rifiuti.
 *
 * TUTTI quelli del giorno piu' vicino, non il primo che capita: «sotto il meteo
 * esce sempre solo il primo rifiuto, quindi se c'e' vetro e organico esce solo
 * vetro» (#567). Chi stasera deve mettere fuori due bidoni deve vederli tutti e
 * due — sapere di uno solo e' peggio che non sapere niente, perche' si esce con
 * la sensazione di aver fatto.
 *
 * Il giorno piu' vicino e basta, pero': se oggi c'e' qualcosa, domani non e'
 * ancora una notizia. Cosi' la fascia porta i bidoni di UNA uscita, che e' il
 * numero che sta in mano a chi scende le scale. */
const QUANDO_VICINO = Object.freeze(["oggi", "domani"]);

/* Dopo l'ora scelta la giornata, per la fascia, e' finita (#565).
 *
 * «Preferirei che la pillola sotto la barra del meteo mostrasse i rifiuti che
 * devo uscire la sera, non quelli che passano a ritirare il giorno stesso» —
 * e poi, da un'altra persona: «magari si potrebbe far vedere l'odierno fino a
 * una certa ora, dopo di che si passa alla visualizzazione del giorno dopo».
 *
 * Il bidone si mette fuori la sera prima. Un ritiro delle sette di mattina,
 * alle otto di sera non e' piu' una notizia: e' una cosa gia' successa, e la
 * pastiglia che la ripete fa credere che ci sia ancora qualcosa da fare. Ma la
 * stessa pastiglia, alle sei di mattina, e' l'ultimo avviso utile a chi il
 * bidone non l'ha messo fuori: percio' non si sostituisce un giorno con
 * l'altro, si dichiara a che ora quella giornata e' finita.
 *
 * E dopo quell'ora si guarda SOLO a domani: se domani non passa nessuno, non
 * c'e' nessuna pastiglia. Tornare a quella di oggi sarebbe rimettere in mano a
 * chi legge la cosa gia' fatta, che e' esattamente quello che si voleva
 * togliere.
 *
 * Vuoto vuol dire «come e' sempre stato»: chi la configurazione non l'apre non
 * si trova la fascia cambiata sotto il naso. */
const QUANDO_DOPO = Object.freeze(["domani"]);

export function normalizzaOraDelRitiro(valore) {
  const testo = pulito(valore);
  if (!testo) return "";
  const numero = Number(testo);
  if (!Number.isInteger(numero) || numero < 0 || numero > 23) return "";
  return String(numero);
}

/** I giorni a cui guardare adesso, data l'ora del passaggio. */
export function giorniDelRitiro(oraDelPassaggio, adesso = new Date()) {
  const ora = normalizzaOraDelRitiro(oraDelPassaggio);
  if (!ora) return QUANDO_VICINO;
  const istante = adesso instanceof Date && !Number.isNaN(adesso.getTime()) ? adesso : new Date();
  return istante.getHours() >= Number(ora) ? QUANDO_DOPO : QUANDO_VICINO;
}

function ritiriVicini(modello, giorni = QUANDO_VICINO) {
  const righe = Array.isArray(modello?.rows) ? modello.rows : [];
  for (const quando of giorni) {
    const dellaGiornata = righe.filter((riga) => riga?.quando === quando);
    if (dellaGiornata.length) return dellaGiornata;
  }
  return [];
}

/**
 * Le pastiglie da mostrare, in ordine.
 *
 * `modelli` sono i modelli delle tessere della Home, quelli veri, prima che le
 * preferenze ne nascondano qualcuna: chi nasconde la tessera delle luci perche'
 * gli basta la riga non deve perdere anche la riga.
 *
 * Esce solo quello che ha qualcosa da dire: zero luci accese, nessuna
 * pastiglia. Una barra che dice «0 luci accese» occupa spazio per non dire
 * niente.
 */
export function pastiglieDellaCasa(modelli, { barra, posta, misure, adesso } = {}) {
  const config = normalizzaBarra(barra);
  const giorni = giorniDelRitiro(config.rifiutiDalleOre, adesso);
  const perChiave = new Map(
    (Array.isArray(modelli) ? modelli : [])
      .filter((modello) => modello && NOTE.has(pulito(modello.key)))
      .map((modello) => [pulito(modello.key), modello]),
  );
  const fuori = [];
  for (const voce of VOCI_DELLA_BARRA) {
    if (!config.voci[voce.chiave]) continue;
    if (voce.chiave === "posta") {
      if (posta?.arrivata)
        fuori.push({
          chiave: "posta",
          icona: "📬",
          mdi: "mdi:email",
          tinta: TINTA_POSTA,
          avviso: true,
        });
      continue;
    }
    const misura = MISURE[voce.chiave];
    if (misura) {
      const letta = misure?.[voce.chiave];
      /* Un sensore che non risponde non scrive «—»: la pastiglia non c'e', come
       * per tutte le altre voci che non hanno niente da dire. */
      if (!Number.isFinite(Number(letta?.valore))) continue;
      fuori.push({
        chiave: voce.chiave,
        tessera: voce.tessera,
        icona: misura.icona,
        mdi: misura.mdi,
        tinta: misura.tinta,
        valore: Number(letta.valore),
        unita: pulito(letta.unita),
        nome: pulito(letta.nome),
      });
      continue;
    }
    const modello = perChiave.get(voce.chiave);
    if (!modello) continue;
    if (voce.chiave === "rifiuti") {
      /* Due righe che sulla fascia si **leggono uguali** sono un bidone solo.
       *
       * La pastiglia porta tre cose: il segno, il nome e il giorno. Se quelle
       * tre tornano uguali, la seconda non aggiunge niente — dice due volte la
       * stessa cosa («Indicazione rifiuti sulla pastiglia doppia»: «Vetro
       * OGGI» e «Vetro OGGI»), e lo fa prendendo il posto della notizia che
       * stava accanto.
       *
       * Non si tocca la configurazione di nessuno: chi ha due sensori per lo
       * stesso bidone li tiene, e nell'elenco della tessera ci sono tutti e
       * due col loro nome. Qui si toglie la pastiglia doppia, che e' una cosa
       * scritta, non una cosa configurata. */
      const giaScritte = new Set();
      for (const riga of ritiriVicini(modello, giorni)) {
        const comeSiLegge = [
          pulito(riga.glyph),
          pulito(riga.name).toLowerCase(),
          pulito(riga.quando),
        ].join("|");
        if (giaScritte.has(comeSiLegge)) continue;
        giaScritte.add(comeSiLegge);
        fuori.push({
          chiave: "rifiuti",
          /* Una pastiglia per bidone, quindi la chiave non basta piu' a dire
           * quale: chi disegna riconosce le pastiglie da `id`, e due «rifiuti»
           * con lo stesso id sarebbero la stessa pastiglia disegnata due volte. */
          id: `rifiuti:${pulito(riga.entity) || pulito(riga.name) || pulito(riga.glyph)}`,
          tessera: voce.tessera,
          icona: pulito(riga.glyph) || pulito(modello.icon) || "♻️",
          tinta: pulito(modello.accent),
          quando: riga.quando,
          nome: pulito(riga.name),
        });
      }
      continue;
    }
    if (voce.chiave === "sicurezza") {
      /* Disinserito non e' una notizia: la pastiglia dice che l'antifurto e'
       * inserito, o che sta suonando. */
      if (!modello.armed && !modello.triggered) continue;
      fuori.push({
        chiave: "sicurezza",
        tessera: voce.tessera,
        icona: pulito(modello.icon) || "🛡️",
        tinta: pulito(modello.accent),
        valore: pulito(modello.value),
        avviso: Boolean(modello.triggered),
      });
      continue;
    }
    const righe = modello[ACCESE[voce.chiave]];
    const conto = Array.isArray(righe) ? righe.length : 0;
    if (conto < 1) continue;
    fuori.push({
      chiave: voce.chiave,
      tessera: voce.tessera,
      icona: pulito(modello.icon),
      tinta: pulito(modello.accent),
      conto,
      /* Se quel conto sono motori e non contatti (#31).
       *
       * «Nella scheda il titolo tapparelle e' corretto, mentre in quei piccoli
       *  popup che si aprono sopra dice finestre aperte.» Il numero che la
       * tessera delle Finestre porta e' due cose diverse a seconda della casa —
       * i motori alzati dove non c'e' un solo contatto sull'anta, le finestre
       * aperte dove ci sono — e la tessera cambia parola di conseguenza dalla
       * #442. Qui arrivava solo il numero, e la parola era sempre la seconda.
       *
       * Viene dal modello e non si ricalcola: rifare il conto di cosa c'e'
       * dentro la sezione vorrebbe dire due regole sulla stessa cosa, che e'
       * esattamente quello che questo modulo non fa. */
      soloMotori: modello.soloMotori === true,
      /* Cio' che e' acceso, una voce per riga: il nome e l'entita'.
       *
       * Il nome finisce nel titolo della pastiglia — non ci starebbe dentro —
       * e serve a chi si ferma sopra col dito o ascolta il lettore di schermo.
       * L'entita' serve all'elenco che si apre toccandola: «devi mostrare solo
       * quelli accesi e non una replica del popup widget». Le due cose vengono
       * dalla stessa riga e viaggiano insieme: due elenchi della stessa
       * lampadina — uno di nomi, uno di entita' — sarebbero due elenchi da
       * tenere allineati. */
      voci: righe
        .map((riga) => ({ entity: pulito(riga?.entity), name: pulito(riga?.name) }))
        .filter((voce) => voce.name || voce.entity),
    });
  }
  /* Ogni pastiglia ha un'identita', e per quasi tutte e' la propria chiave: di
   * luci accese ce n'e' una sola. I rifiuti sono l'eccezione — un bidone per
   * pastiglia — e se la scrivono da se'. Chi disegna riconosce le pastiglie da
   * qui: due che si chiamassero uguale sarebbero la stessa, e una delle due
   * rinascerebbe a ogni giro. */
  return fuori.map((pastiglia) =>
    pastiglia.id ? pastiglia : { ...pastiglia, id: pastiglia.chiave },
  );
}

/* ── la cassetta della posta (#357) ──────────────────────────────────────── */

/**
 * Il passo della cassetta: cosa dice adesso, cosa se ne ricordava.
 *
 * «Animazione quando arriva Posta attivato da un sensore contact.» Il contatto
 * scatta quando il postino apre lo sportello e torna a riposo quando lo
 * richiude: l'apertura dura pochi secondi, e in quei pochi secondi non c'e'
 * nessuno davanti alla plancia. Guardare soltanto com'e' adesso vorrebbe dire
 * non accorgersene mai.
 *
 * La memoria serve a questo, e sono due numeri: com'era l'ultima volta che si
 * e' guardato, e da quando stava cosi'. Home Assistant dice `last_changed`,
 * cioe' il momento in cui lo stato e' diventato quello che e': una cassetta
 * chiusa che dichiara un momento PIU' RECENTE di quello che ci ricordavamo si
 * e' aperta e richiusa mentre non guardavamo. Non serve stare a vedere — si
 * legge dopo, ed e' esattamente il caso che conta.
 *
 * `memoria` e' `{ aperto, cambiatoIl, arrivo, vista }`; `lettura` e'
 * `{ aperto, cambiatoIl }`, oppure niente quando la cassetta non e'
 * configurata o l'entita' non risponde. L'orologio non si tocca: chi chiama
 * passa i momenti gia' letti.
 */
export function passoDellaPosta(memoria, lettura) {
  const prima = memoria && typeof memoria === "object" ? memoria : {};
  const vista = Number(prima.vista) || 0;
  const primaAperto = typeof prima.aperto === "boolean" ? prima.aperto : null;
  const primaCambiatoIl = Number(prima.cambiatoIl) || 0;
  const primaArrivo = Number(prima.arrivo) || 0;
  const quando = Number(lettura?.cambiatoIl);
  if (!lettura || !Number.isFinite(quando))
    return {
      arrivata: primaArrivo > 0 && primaArrivo > vista,
      arrivo: primaArrivo,
      memoria: prima,
      cambiata: false,
    };

  const aperto = Boolean(lettura.aperto);
  let arrivo = primaArrivo;
  if (primaAperto === null) {
    /* Il primo sguardo: di prima non si sa niente. Una cassetta aperta adesso
     * e' posta che aspetta; una chiusa non racconta il suo passato, e
     * annunciarla vorrebbe dire salutare con «e' arrivata la posta» chiunque
     * finisca di configurare il sensore. */
    if (aperto) arrivo = quando;
  } else if (aperto && (!primaAperto || quando > primaCambiatoIl)) {
    arrivo = quando;
  } else if (!aperto && !primaAperto && quando > primaCambiatoIl) {
    arrivo = quando;
  }

  const dopo = { aperto, cambiatoIl: quando, arrivo, vista };
  return {
    arrivata: arrivo > 0 && arrivo > vista,
    arrivo,
    memoria: dopo,
    cambiata:
      dopo.aperto !== primaAperto ||
      dopo.cambiatoIl !== primaCambiatoIl ||
      dopo.arrivo !== primaArrivo,
  };
}

/** «L'ho ritirata»: la pastiglia torna a riposo fino al prossimo arrivo. */
export function postaRitirata(memoria, adesso) {
  const prima = memoria && typeof memoria === "object" ? memoria : {};
  /* Non basta segnare adesso: se l'orologio del dispositivo e' indietro
   * rispetto a quello di Home Assistant, «adesso» sarebbe piu' vecchio
   * dell'arrivo e la pastiglia resterebbe li' a ripetere la stessa cosa. */
  return { ...prima, vista: Math.max(Number(adesso) || 0, Number(prima.arrivo) || 0) };
}
