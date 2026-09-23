/* I dispositivi scollegati: chi non risponde, e chi si è deciso di non sentire.
 *
 * La tessera «Dispositivi non connessi» (#33) compare da sola quando qualcosa
 * smette di rispondere, e finché resta muta va benissimo così. Il guaio è
 * quando dice il vero su una cosa che non interessa — «fra i non connessi
 * finiscono dispositivi che funzionano» — perché allora l'avviso si impara a
 * ignorare, e un avviso che si ignora è peggio di nessun avviso.
 *
 * Capita per due ragioni, e tutte e due sono vere. Un'entità che non c'è più —
 * un'integrazione tolta, un'entità rinominata — resta scritta in
 * configurazione e resta `unavailable` per sempre: è una configurazione da
 * correggere, non un dispositivo da andare a premere. E poi ci sono le cose
 * che si spengono apposta: la presa dell'albero di Natale a gennaio, la
 * telecamera del cantiere finito.
 *
 * Perciò serve un posto dove vedere l'elenco e toglierne una riga. Questo
 * modulo è la regola di quell'elenco, ed è la stessa che legge la tessera
 * della Home: un secondo elenco sarebbe una seconda verità, e il giorno che si
 * scostano non si sa quale delle due guardare.
 *
 * ── Dove si scrive che una riga non si vuole più vedere ─────────────────
 *
 * Nell'elenco che c'era già: `cd_widgets.excluded`, con la voce scritta col
 * nome della tessera davanti — `nonrisponde|switch.presa_giardino`. Vale per
 * questa tessera e basta, e non tocca la stessa presa dove sta configurata.
 * La regola di quelle voci sta in `fuori-dai-widget.js`; qui si usa.
 *
 * Non si inventa una chiave nuova, e non è pigrizia: una chiave che tiene un
 * elenco di identificativi nudi verrebbe riletta da `entitaConfigurate`, che
 * cammina dentro tutte le chiavi di configurazione e raccoglie tutto quello
 * che ha la forma di un'entità. Messa da parte una presa, quella presa
 * tornerebbe «configurata» e quindi di nuovo nell'elenco: un giro che si morde
 * la coda. Le voci con la tessera davanti quella forma non ce l'hanno.
 *
 * ── Quello che questo modulo non fa ─────────────────────────────────────
 *
 * Non tiene la storia. L'elenco è chi non risponde ADESSO, come la tessera:
 * un dispositivo tornato in linea esce da solo, e da qui non lo si può mettere
 * da parte finché non torna a mancare. È voluto — si mette da parte quello che
 * dà fastidio, mentre dà fastidio — e tiene la sezione grande quanto il guaio
 * invece di farla crescere per sempre.
 *
 * ── E si torna indietro ─────────────────────────────────────────────────
 *
 * «Non vedo i dispositivi e non c'è nulla per poter inserire nuovamente i
 * dispositivi.»
 *
 * Il cestino era a senso unico, e c'era scritto: «Dall'avviso non tornano». Il
 * ragionamento era che si mette da parte quello che dà fastidio, e quello che
 * dà fastidio non lo si rivuole. Ma si preme anche per sbaglio, e si preme per
 * provare: uno tocca il cestino su quattro righe per vedere cosa fa, e resta
 * con una sezione vuota e nessun modo di riempirla. Una scelta che non si può
 * disfare costa molto di più di quanto valga tenere corto l'elenco.
 *
 * Quindi `rimettiInElenco` è l'esatto contrario di `mettiDaParte`, e le righe
 * messe da parte si vedono col loro tasto. L'elenco resta grande quanto il
 * guaio lo stesso: quello che torna nell'avviso ci torna solo se è ancora
 * muto, perché l'avviso lo rifà `chiNonRispondePerDispositivo` da capo.
 *
 * È puro: entrano le entità configurate, gli stati e l'elenco delle escluse;
 * esce cosa mostrare.
 */
import { chiNonRispondePerDispositivo } from "./chi-non-risponde.js";
import {
  escluseDellaTessera,
  leggiLaVoce,
  rimettiNellaTessera,
  togliDallaTessera,
} from "./fuori-dai-widget.js";

const pulito = (valore) => String(valore ?? "").trim();

/** Il nome con cui questa tessera si firma dentro `cd_widgets.excluded`. */
export const TESSERA_SCOLLEGATI = "nonrisponde";

/**
 * Chi non risponde adesso, e chi è stato messo da parte.
 *
 * `adesso` è quello che la tessera mostra e che la sezione elenca col cestino.
 * `messiDaParte` sono le righe tolte da qui: si vedono lo stesso, in fondo e
 * senza cestino, perché una scelta che non si può nemmeno rileggere è una
 * scelta che uno non sa più di avere fatto.
 *
 * Di ognuna si dice se in questa casa esiste ancora. È la differenza fra le
 * due cose che finiscono in questo elenco: un dispositivo vero che si è deciso
 * di non sentire, e un'entità che non c'è più — che invece è configurazione da
 * ripulire, e adesso si vede che lo è.
 */
export function iDispositiviScollegati({
  configurate = [],
  states = {},
  escluse = [],
  nomeDi = null,
  di = null,
  nomi = null,
} = {}) {
  const fuori = escluseDellaTessera(escluse, TESSERA_SCOLLEGATI);
  /* `entitaConfigurate` torna un insieme, non un elenco: si srotola. Ma un
   * `null` non si srotola affatto, e da quassu' arriva anche quello — la
   * scheda lo passa quando la lettura della configurazione e' andata storta,
   * che e' il momento in cui l'ultima cosa da fare e' cadere. */
  const tutte = Array.isArray(configurate)
    ? configurate
    : configurate && typeof configurate[Symbol.iterator] === "function"
      ? [...configurate]
      : [];
  /* Per dispositivo, non per entita': un'asciugatrice che risponde non e' un
   * dispositivo non connesso solo perche' tace la sua serratura bambini. La
   * regola sta in `chi-non-risponde.js` ed e' la stessa del ponte, cioe' la
   * stessa che vede il cruscotto dell'installatore. Senza le mappe dei registri
   * torna da se' riga per riga, come prima. */
  const adesso = chiNonRispondePerDispositivo(
    tutte.filter((entity) => !fuori.has(pulito(entity))),
    states,
    { nomeDi, di, nomi },
  );
  /* Solo le voci firmate da questa tessera. Una voce nuda tiene un'entità
   * fuori da TUTTE le tessere, e l'ha scritta un altro interruttore: dirla
   * qui, in una sezione che parla di questa tessera, direbbe che l'ha messa da
   * parte chi non l'ha messa. */
  const viste = new Set();
  const sciolte = [];
  for (const voce of Array.isArray(escluse) ? escluse : []) {
    const letta = leggiLaVoce(voce);
    if (letta?.chiave !== TESSERA_SCOLLEGATI) continue;
    const entity = pulito(letta.entita);
    if (!entity || viste.has(entity)) continue;
    viste.add(entity);
    let nome = "";
    try {
      nome = pulito(nomeDi?.(entity));
    } catch (_errore) {
      nome = "";
    }
    const stato = states?.[entity];
    sciolte.push({
      entity,
      nome: nome || pulito(stato?.attributes?.friendly_name) || entity,
      /* Se in questa casa esiste ancora. Senza stato non è «offline»: è
       * un'entità che Home Assistant non ha proprio, cioè configurazione
       * rimasta indietro. */
      cE: Boolean(stato),
    });
  }
  return {
    adesso,
    messiDaParte: perDispositivo(sciolte, di, nomi).sort((una, altra) =>
      una.nome.localeCompare(altra.nome),
    ),
  };
}

/* Anche qui per dispositivo, e per la stessa ragione delle righe vive: quello
 * che si è messo da parte era un dispositivo, e ritrovarselo spezzato in
 * quattro entità vorrebbe dire quattro tasti per rimettere a posto una cosa
 * sola — e tre righe che restano lì a dire che il lavoro non è finito.
 *
 * Quello che si scrive restano entità, come prima: queste righe le tengono
 * tutte, e il tasto le rimette tutte insieme. Senza le mappe dei registri
 * ognuna resta per conto suo, com'era prima che i dispositivi si sapessero. */
function perDispositivo(sciolte, di, nomi) {
  const diChiE = di && typeof di === "object" ? di : {};
  if (!Object.keys(diChiE).length) return sciolte.map((una) => ({ ...una, entita: [una.entity] }));
  const nomeDelDispositivo = nomi && typeof nomi === "object" ? nomi : {};
  const insieme = new Map();
  const fuori = [];
  for (const una of sciolte) {
    const suo = pulito(diChiE[una.entity]);
    if (!suo) {
      fuori.push({ ...una, entita: [una.entity] });
      continue;
    }
    const gia = insieme.get(suo);
    if (gia) {
      gia.entita.push(una.entity);
      /* Il dispositivo c'è ancora se ce n'è almeno una: è lui che si cerca,
       * non la singola entità. */
      gia.cE = gia.cE || una.cE;
    } else {
      insieme.set(suo, {
        entity: `dispositivo:${suo}`,
        dispositivo: suo,
        nome: pulito(nomeDelDispositivo[suo]) || una.nome,
        cE: una.cE,
        entita: [una.entity],
      });
    }
  }
  return [...fuori, ...insieme.values()];
}

/* L'elenco delle escluse con dentro anche queste. Non toglie mai niente.
 *
 * Una riga adesso e' un dispositivo, e un dispositivo ha piu' entita' mute:
 * metterlo da parte vuol dire metterle da parte tutte, se no tornerebbe al
 * giro dopo per quelle rimaste. Ma quello che si scrive restano **entita'**, e
 * non dispositivi: cosi' le voci gia' scritte da prima continuano a valere, e
 * una casa che i registri non li ha — dove non si raggruppa — si comporta
 * uguale. */
export const mettiDaParte = (escluse, entita) =>
  (Array.isArray(entita) ? entita : [entita]).reduce(
    (elenco, una) => togliDallaTessera(elenco, TESSERA_SCOLLEGATI, una),
    escluse,
  );

/* E l'elenco senza queste: il contrario esatto di qui sopra.
 *
 * Toglie solo le voci firmate da questa tessera. La stessa entità può essere
 * fuori anche da un'altra — o fuori da tutte, con una voce nuda scritta da un
 * altro interruttore — e quelle non sono di questa sezione: rimettere un
 * dispositivo nell'avviso dei non connessi non vuol dire rimetterlo in Home. */
export const rimettiInElenco = (escluse, entita) =>
  (Array.isArray(entita) ? entita : [entita]).reduce(
    (elenco, una) => rimettiNellaTessera(elenco, TESSERA_SCOLLEGATI, una),
    escluse,
  );
