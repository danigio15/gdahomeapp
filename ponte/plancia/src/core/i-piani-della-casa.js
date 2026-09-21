/* I piani della casa: ordine, nome, segno, e le stanze che ci stanno (#17).
 *
 * «Home assistant non mi interessa, mi interessa gestire in maniera puntuale i
 *  piani nella dashboard. Anche perche' posso creare bagno primo piano e bagno
 *  secondo piano e le entita' poi devono funzionare divise, non e' la stessa
 *  stanza.»
 *
 * I piani c'erano gia', ma come elenco di nomi in fondo alla scheda Stanze:
 * si aggiungevano e si cancellavano, e basta. Non si potevano ordinare — e
 * l'ordine e' quello con cui si sale le scale, quindi decide la pagina Stanze,
 * le scene delle luci e le tapparelle — non si potevano rinominare, e il
 * cestino toglieva il piano alle sue stanze senza dire quante fossero.
 *
 * ── Un piano si chiama col suo nome ───────────────────────────────────────
 *
 * Le stanze portano il piano come TESTO (`room.floor`), e i segni stanno in
 * una mappa con lo stesso testo come chiave (`cd_floor_icons`). Dare un
 * identificativo ai piani sarebbe piu' pulito in astratto e romperebbe ogni
 * configurazione che esiste: il nome resta l'identita'. Il prezzo lo paga la
 * rinomina, che deve riscrivere le stanze e la mappa dei segni — ed e'
 * esattamente quello che fa `rinominaIlPiano`, invece di lasciarlo fare a
 * mano a chi ha sbagliato una lettera.
 *
 * Qui non si legge e non si scrive niente: entrano i piani salvati, le stanze
 * e i segni, ed escono i piani salvati, le stanze e i segni. Il deposito ce
 * l'ha la sezione, come dappertutto nel nucleo.
 */

const pulito = (valore) => String(valore ?? "").trim();

/* Dove stanno scritti. I nomi li dichiara il modulo che sa cosa c'e' dentro;
 * a leggerli e a scriverli sono le sezioni. */
export const CHIAVE_PIANI = "cd_floors";
export const CHIAVE_SEGNI_DEI_PIANI = "cd_floor_icons";

/** Il segno di un piano che non ne ha scelto uno. */
export const SEGNO_DI_SERIE = "🏢";

/** Quanti piani si possono tenere. Oltre non e' una casa, e' un condominio. */
export const QUANTI_PIANI = 12;

const elenco = (valore) => (Array.isArray(valore) ? valore : []);

/** I nomi dei piani, senza doppioni e senza vuoti, nell'ordine in cui stanno. */
export function nomiDeiPiani(salvati) {
  const visti = new Set();
  const fuori = [];
  for (const voce of elenco(salvati)) {
    const nome = pulito(voce);
    if (!nome || visti.has(nome)) continue;
    visti.add(nome);
    fuori.push(nome);
  }
  return fuori;
}

/** Il segno scelto per un piano, o quello di serie. */
export function segnoDelPiano(segni, nome) {
  const suo = pulito(segni?.[pulito(nome)]);
  return suo || SEGNO_DI_SERIE;
}

/**
 * I piani della casa, in ordine, con dentro le loro stanze.
 *
 * L'ordine e' quello DICHIARATO: i piani che compaiono solo addosso a una
 * stanza — perche' qualcuno li ha scritti a mano prima che questa scheda
 * esistesse — vanno in fondo, nell'ordine in cui si incontrano. Non si
 * inventa un alfabeto: un ordine alfabetico metterebbe la mansarda prima del
 * piano terra, ed e' il contrario di come si sale le scale.
 *
 * Un piano dichiarato e rimasto senza stanze resta nell'elenco: e' stato
 * creato, e sparire sarebbe sembrare cancellato. `dichiarato` dice quale sia
 * quale, cosi' chi disegna puo' dirlo.
 */
export function iPianiDellaCasa(salvati, stanze = [], segni = {}) {
  const dichiarati = nomiDeiPiani(salvati);
  const ordine = new Map(dichiarati.map((nome, indice) => [nome, indice]));
  const dentro = new Map(dichiarati.map((nome) => [nome, []]));
  for (const stanza of elenco(stanze)) {
    const nome = pulito(stanza?.floor);
    if (!nome) continue;
    if (!dentro.has(nome)) {
      dentro.set(nome, []);
      ordine.set(nome, dichiarati.length + ordine.size);
    }
    dentro.get(nome).push(stanza);
  }
  return [...dentro.entries()]
    .sort((una, altra) => ordine.get(una[0]) - ordine.get(altra[0]))
    .map(([nome, sue]) => ({
      nome,
      segno: segnoDelPiano(segni, nome),
      /* Se il segno e' suo o e' quello di serie: un piano a cui nessuno ha
       * scelto un'icona non deve sembrare un piano che ha scelto il palazzo. */
      suo: Boolean(pulito(segni?.[nome])),
      stanze: sue,
      dichiarato: ordine.get(nome) < dichiarati.length,
    }));
}

/** Le stanze a cui nessuno ha ancora detto il piano. */
export function stanzeSenzaPiano(stanze = []) {
  return elenco(stanze).filter((stanza) => stanza && !pulito(stanza.floor));
}

/**
 * Un piano sale o scende di un posto.
 *
 * Solo fra i piani DICHIARATI: quelli che esistono solo addosso a una stanza
 * non hanno un posto nell'elenco salvato, e spostarli vorrebbe dire prima
 * dichiararli. Chi disegna li dichiara al primo tocco — e' una riga sola — e
 * qui si resta su una regola sola.
 *
 * Fuori dai bordi non succede niente, e non e' un errore: e' il tasto del
 * primo piano premuto verso l'alto, che va disattivato ma non deve rompere
 * niente se qualcuno ci arriva lo stesso.
 */
export function spostaIlPiano(salvati, nome, verso) {
  const nomi = nomiDeiPiani(salvati);
  const quale = pulito(nome);
  const dove = nomi.indexOf(quale);
  const passo = Number(verso) < 0 ? -1 : 1;
  const meta = dove + passo;
  if (dove < 0 || meta < 0 || meta >= nomi.length) return nomi;
  nomi[dove] = nomi[meta];
  nomi[meta] = quale;
  return nomi;
}

/* Perche' una rinomina o una creazione non si puo' fare. Chi disegna le
 * traduce in una frase; qui restano parole sole, che si provano. */
export const NOME_VUOTO = "vuoto";
export const NOME_GIA_PRESO = "gia-preso";
export const PIANO_SCONOSCIUTO = "sconosciuto";
export const TROPPI_PIANI = "troppi";

/**
 * Un piano cambia nome, e si porta dietro tutto quello che era suo.
 *
 * Le stanze ce l'hanno addosso come testo e i segni stanno in una mappa con lo
 * stesso testo come chiave: rinominare senza riscrivere tutte e due vorrebbe
 * dire lasciare le stanze su un piano che non esiste piu' e il segno appeso a
 * un nome morto. Per questo la rinomina restituisce TUTTE E TRE le cose, e chi
 * chiama le salva insieme.
 *
 * Due piani con lo stesso nome sarebbero un piano solo scritto due volte: si
 * rifiuta invece di fonderli, perche' fondere due piani sposta delle stanze e
 * nessuno l'ha chiesto. Cambiare le maiuscole allo stesso nome si puo': non e'
 * un doppione, e' la correzione che uno sta facendo.
 */
export function rinominaIlPiano(salvati, stanze, segni, vecchio, nuovo) {
  const nomi = nomiDeiPiani(salvati);
  const prima = pulito(vecchio);
  const dopo = pulito(nuovo);
  if (!dopo) return { errore: NOME_VUOTO };
  const dove = nomi.indexOf(prima);
  if (dove < 0 && !elenco(stanze).some((stanza) => pulito(stanza?.floor) === prima))
    return { errore: PIANO_SCONOSCIUTO };
  if (dopo !== prima && nomi.includes(dopo)) return { errore: NOME_GIA_PRESO };

  const fuori = dove < 0 ? [...nomi, dopo] : nomi.map((nome) => (nome === prima ? dopo : nome));
  const spostate = elenco(stanze).map((stanza) =>
    pulito(stanza?.floor) === prima ? { ...stanza, floor: dopo } : stanza,
  );
  const segniNuovi = { ...(segni || {}) };
  if (prima !== dopo && segniNuovi[prima] !== undefined) {
    segniNuovi[dopo] = segniNuovi[prima];
    delete segniNuovi[prima];
  }
  return {
    piani: fuori,
    stanze: spostate,
    segni: segniNuovi,
    quante: spostate.filter((stanza) => pulito(stanza?.floor) === dopo).length,
  };
}

/**
 * Un piano nuovo, in fondo all'elenco.
 *
 * In fondo e non in cima perche' una casa si costruisce dal basso: il piano
 * terra c'e' gia' quando si aggiunge il primo, e il primo quando si aggiunge
 * la mansarda. Chi vuole un altro ordine ha le frecce.
 */
export function aggiungiIlPiano(salvati, nome) {
  const nomi = nomiDeiPiani(salvati);
  const quale = pulito(nome);
  if (!quale) return { errore: NOME_VUOTO };
  if (nomi.includes(quale)) return { errore: NOME_GIA_PRESO };
  if (nomi.length >= QUANTI_PIANI) return { errore: TROPPI_PIANI };
  return { piani: [...nomi, quale] };
}

/**
 * Un piano se ne va, e le sue stanze restano senza piano.
 *
 * Non si cancellano le stanze: cancellare un piano vuol dire «questo piano non
 * esiste», non «queste stanze non esistono», e chi tocca un cestino in fondo a
 * un elenco di piani non si aspetta di perdere il salone. `quante` dice quante
 * ne restano scoperte, cosi' chi disegna lo puo' chiedere PRIMA invece di
 * farlo scoprire dopo.
 */
export function cancellaIlPiano(salvati, stanze, segni, nome) {
  const quale = pulito(nome);
  const nomi = nomiDeiPiani(salvati).filter((voce) => voce !== quale);
  const scoperte = [];
  const rimaste = elenco(stanze).map((stanza) => {
    if (pulito(stanza?.floor) !== quale) return stanza;
    scoperte.push(stanza);
    const senza = { ...stanza };
    delete senza.floor;
    return senza;
  });
  const segniNuovi = { ...(segni || {}) };
  delete segniNuovi[quale];
  return { piani: nomi, stanze: rimaste, segni: segniNuovi, quante: scoperte.length };
}

/** Il segno di un piano cambia. Vuoto lo toglie e riporta quello di serie. */
export function segnaIlPiano(segni, nome, segno) {
  const quale = pulito(nome);
  const fuori = { ...(segni || {}) };
  if (!quale) return fuori;
  const scelto = pulito(segno);
  if (scelto) fuori[quale] = scelto;
  else delete fuori[quale];
  return fuori;
}

/**
 * Le stanze rimesse in fila per piano, nell'ordine dei piani.
 *
 * Serve perche' la scheda del Config e la pagina Stanze raccontino la stessa
 * cosa, e per una ragione meno visibile e piu' seria: le frecce ▲▼ di ogni
 * stanza il guscio le numera dalla posizione nel DOCUMENTO. Raggruppare le
 * righe a schermo senza toccare l'elenco salvato vorrebbe dire una matita che
 * apre la stanza sbagliata e una freccia che ne sposta un'altra — due
 * padroni per lo stesso ordine, e nessuno dei due che lo sa.
 *
 * Dentro un piano l'ordine resta quello che c'era: le frecce continuano a
 * voler dire «su» e «giu'» dentro il proprio piano, che e' l'unica cosa che
 * possano voler dire una volta che i piani esistono.
 *
 * E' stabile e idempotente: rifarla su un elenco gia' in ordine restituisce lo
 * stesso ordine, quindi chi salva solo quando cambia non salva mai due volte.
 */
export function ordinaLeStanzePerPiano(stanze, salvati) {
  const dichiarati = nomiDeiPiani(salvati);
  const dove = new Map(dichiarati.map((nome, indice) => [nome, indice]));
  const conosciuti = new Map(dove);
  const posto = (stanza) => {
    const piano = pulito(stanza?.floor);
    /* Senza piano si va in fondo: sono le stanze a cui nessuno l'ha ancora
     * detto, e stanno in fondo all'elenco come le cose da sistemare. */
    if (!piano) return Number.MAX_SAFE_INTEGER;
    if (!conosciuti.has(piano)) conosciuti.set(piano, dichiarati.length + conosciuti.size);
    return conosciuti.get(piano);
  };
  return elenco(stanze)
    .map((stanza, indice) => ({ stanza, indice, posto: posto(stanza) }))
    .sort((una, altra) => una.posto - altra.posto || una.indice - altra.indice)
    .map((voce) => voce.stanza);
}

/** Se due elenchi di stanze sono nello stesso ordine. */
export function stessoOrdine(une, altre) {
  const prime = elenco(une);
  const seconde = elenco(altre);
  if (prime.length !== seconde.length) return false;
  return prime.every((stanza, indice) => stanza === seconde[indice]);
}
