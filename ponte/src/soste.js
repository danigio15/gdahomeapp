/* Le soste di ricarica di un viaggio in auto elettrica: i conti, e basta.
 *
 * «Arrivo a Milano con la carica che ho, o mi devo fermare? E dove?» La casa
 * sa la strada (OSRM, `viaggi.js`) e sa le colonnine rapide d'Italia
 * (`colonnine.js`); qui si cammina lungo la strada consumando la batteria, e
 * quando non basta piu' ci si ferma alla colonnina rapida piu' avanti che si
 * raggiunge:
 *
 *   - si parte con la carica detta (adesso, l'obiettivo della carica di
 *     stanotte, o piena) e si consuma a chilometri: i kWh ogni 100 km
 *     dell'auto, o 17 se non si sanno;
 *   - alla meta si vuole arrivare con la carica minima scelta (di serie il
 *     15%);
 *   - ci si ferma alla colonnina buona piu' avanti, ma a una colonnina non ci
 *     si arriva MAI sotto il 10%: sotto, una coda o una colonnina guasta
 *     lasciano a piedi;
 *   - le colonnine buone sono quelle con una presa almeno della potenza scelta
 *     (50, 100 o 150 kW) entro un corridoio dalla strada (2 km);
 *   - a ogni sosta si ricarica fino all'80%: oltre, la carica rallenta e
 *     conviene ripartire;
 *   - quanto dura: l'energia che manca divisa per la potenza che passa davvero
 *     — la minore fra quella della colonnina e quella che l'auto accetta (150
 *     kW se non si sa), un terzo oltre l'80% — piu' quattro minuti per
 *     parcheggiare e attaccare il cavo.
 *
 * Senza colonnine — l'archivio non c'e', o non c'e' una rapida nel tratto —
 * la sosta si dice a chilometro, dove la carica scende alla minima scelta, e
 * su una colonnina della potenza scelta: «Sosta intorno al km 268 · circa 31
 * min». In viaggio gdanav guarda quali sono libere e la sistema lui.
 *
 * Le tappe dell'utente restano dove sono, con le loro soste: si contano nei
 * tempi (li fa chi disegna, con la durata della strada) e non spostano la
 * batteria. Gli orari qui non ci sono: si danno i chilometri, e l'ora la fa la
 * pagina, che sa a che ora si parte e quanto ci vuole.
 *
 * Puro: niente rete, niente disco, niente orologio.
 */

/* Le scelte che la pagina offre, e quelle di serie. */
export const MINIME_ALL_ARRIVO = Object.freeze([10, 15, 20, 30]);
export const MINIMA_ALL_ARRIVO_DI_SERIE = 15;
export const POTENZE_DELLE_COLONNINE = Object.freeze([50, 100, 150]);
export const POTENZA_DELLE_COLONNINE_DI_SERIE = 100;

/* Quello che non si sa dell'auto. La capacita' e' la stessa che assume la
 * plancia (`CAPACITA_DI_SERIE` di `il-tempo-della-ricarica.js`). */
export const CAPACITA_DI_SERIE = 70;
export const CONSUMO_DI_SERIE = 17;
export const POTENZA_DELL_AUTO_DI_SERIE = 150;

/* Le regole della sosta. */
export const MAI_SOTTO = 10;
export const FINO_A = 80;
export const MINUTI_FISSI = 4;
export const CORRIDOIO_KM = 2;

/* Piu' di cosi' non si cammina: un viaggio da venti soste e' un errore. */
const SOSTE_AL_PIU = 20;

const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "" || typeof valore === "boolean")
    return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

const entro = (n, minimo, massimo) => n !== null && n >= minimo && n <= massimo;

/* ── la strada come linea ──────────────────────────────────────────────── */

const RAGGIO_KM = 6371.0088;
const rad = (gradi) => (gradi * Math.PI) / 180;

/** I chilometri fra due punti [lon, lat], in linea d'aria. */
export function distanzaKm(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * RAGGIO_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** I punti buoni di una linea [[lon, lat], …], come numeri. */
export function lineaBuona(linea) {
  return (Array.isArray(linea) ? linea : [])
    .filter(
      (p) => Array.isArray(p) && entro(numero(p[0]), -180, 180) && entro(numero(p[1]), -90, 90),
    )
    .map((p) => [Number(p[0]), Number(p[1])]);
}

/**
 * I chilometri progressivi della linea, punto per punto. Con `kmTotali` (quelli
 * che dice OSRM, sulle strade vere) si riscalano: la linea semplificata taglia
 * le curve e misura un po' meno.
 */
export function chilometriDellaLinea(linea, kmTotali = null) {
  const progressivi = [0];
  for (let i = 1; i < linea.length; i += 1)
    progressivi.push(progressivi[i - 1] + distanzaKm(linea[i - 1], linea[i]));
  const misurati = progressivi[progressivi.length - 1] || 0;
  const totali = numero(kmTotali);
  const scala = misurati > 0 && totali !== null && totali > 0 ? totali / misurati : 1;
  return progressivi.map((km) => km * scala);
}

/** Il punto [lon, lat] a `km` dalla partenza, lungo la linea. */
export function puntoAlKm(linea, progressivi, km) {
  if (!linea.length) return null;
  if (km <= 0) return linea[0];
  for (let i = 1; i < linea.length; i += 1) {
    if (progressivi[i] < km) continue;
    const tratto = progressivi[i] - progressivi[i - 1];
    const f = tratto > 0 ? (km - progressivi[i - 1]) / tratto : 0;
    return [
      linea[i - 1][0] + (linea[i][0] - linea[i - 1][0]) * f,
      linea[i - 1][1] + (linea[i][1] - linea[i - 1][1]) * f,
    ];
  }
  return linea[linea.length - 1];
}

/**
 * Dove cade un punto sulla linea: a quanti chilometri dalla partenza (`km`) e
 * quanto e' lontano dalla strada (`scostoKm`). Si guarda tratto per tratto in
 * un piano locale, che a qualche chilometro di distanza e' esatto quanto
 * serve. `null` se la linea non c'e'.
 */
export function sullaLinea(linea, progressivi, lat, lon) {
  if (linea.length < 2) return null;
  let meglio = null;
  const kx = 111.32 * Math.cos(rad(lat));
  const ky = 110.574;
  for (let i = 1; i < linea.length; i += 1) {
    const x1 = (linea[i - 1][0] - lon) * kx;
    const y1 = (linea[i - 1][1] - lat) * ky;
    const dx = (linea[i][0] - lon) * kx - x1;
    const dy = (linea[i][1] - lat) * ky - y1;
    const lungo = dx * dx + dy * dy;
    const f = lungo > 0 ? Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / lungo)) : 0;
    const scosto = Math.hypot(x1 + dx * f, y1 + dy * f);
    if (meglio && scosto >= meglio.scostoKm) continue;
    meglio = {
      km: progressivi[i - 1] + (progressivi[i] - progressivi[i - 1]) * f,
      scostoKm: scosto,
    };
  }
  return meglio;
}

/* ── l'auto ────────────────────────────────────────────────────────────── */

/**
 * L'auto come arriva dalla pagina, ripulita: `null` se non sta in piedi (senza
 * la carica di partenza non si fa nessun conto).
 *
 *   batteria      la carica alla partenza, in %
 *   kwh           la capacita' della batteria (di serie 70)
 *   consumo       kWh ogni 100 km (di serie 17)
 *   kwMax         la potenza massima che l'auto accetta in corrente continua,
 *                 se si sa (`null` altrimenti)
 *   minimaArrivo  la carica minima alla meta (10, 15, 20, 30; di serie 15)
 *   kwColonnine   la potenza minima delle colonnine (50, 100, 150; di serie
 *                 100)
 */
export function autoPulita(dato) {
  if (!dato || typeof dato !== "object") return null;
  const batteria = numero(dato.batteria);
  if (!entro(batteria, 0, 100)) return null;
  const kwh = numero(dato.kwh);
  const consumo = numero(dato.consumo);
  const kwMax = numero(dato.kwMax);
  const minima = numero(dato.minimaArrivo);
  const colonnine = numero(dato.kwColonnine);
  return {
    batteria,
    kwh: entro(kwh, 5, 250) ? kwh : CAPACITA_DI_SERIE,
    consumo: entro(consumo, 5, 60) ? consumo : CONSUMO_DI_SERIE,
    kwMax: entro(kwMax, 3, 1000) ? kwMax : null,
    minimaArrivo: MINIME_ALL_ARRIVO.includes(minima) ? minima : MINIMA_ALL_ARRIVO_DI_SERIE,
    kwColonnine: POTENZE_DELLE_COLONNINE.includes(colonnine)
      ? colonnine
      : POTENZA_DELLE_COLONNINE_DI_SERIE,
  };
}

/** Quanti minuti per andare da `da`% ad `a`% su una colonnina da `kw`. */
export function minutiDiRicarica(da, a, kwh, kw, kwMax = null) {
  const tetto = Math.max(
    1,
    Math.min(kw || POTENZA_DELLE_COLONNINE_DI_SERIE, kwMax ?? POTENZA_DELL_AUTO_DI_SERIE),
  );
  const sotto = (Math.max(0, Math.min(a, FINO_A) - da) / 100) * kwh;
  const sopra = (Math.max(0, a - Math.max(da, FINO_A)) / 100) * kwh;
  const ore = sotto / tetto + sopra / (tetto / 3);
  return Math.round(ore * 60) + MINUTI_FISSI;
}

/* ── le soste ──────────────────────────────────────────────────────────── */

const tondo = (n, cifre = 0) => Math.round(n * 10 ** cifre) / 10 ** cifre;

/**
 * Le soste del viaggio.
 *
 *   kmTotali   la lunghezza della strada
 *   auto       quella di `autoPulita`
 *   colonnine  le colonnine vicino alla strada, ognuna con `km` (dove cade
 *              lungo la strada), `scostoKm`, `kw` (la presa piu' potente),
 *              `nome`, `operatore`, `lat`, `lon` — quelle di `colonnine.js`
 *   linea      la strada [[lon, lat], …], per mettere sulla cartina le soste
 *              a chilometro
 *
 * Torna `{ soste, arrivo, ricaricaMin }`: le soste in ordine, ognuna
 * `{ km, nome, operatore, kw, lat, lon, da, a, min }` (nome vuoto e `kw` 0
 * per una sosta a chilometro), la carica alla meta in % e i minuti di
 * ricarica in tutto. `null` se l'auto o la strada non stanno in piedi.
 */
export function calcolaLeSoste({ kmTotali, auto, colonnine = [], linea = [] } = {}) {
  const lunga = numero(kmTotali);
  const a = autoPulita(auto);
  if (!a || lunga === null || lunga <= 0 || lunga > 20000) return null;
  const kmPerPunto = a.kwh / a.consumo;
  const comoda = Math.max(a.minimaArrivo, MAI_SOTTO);
  const buone = (Array.isArray(colonnine) ? colonnine : [])
    .filter(
      (c) =>
        entro(numero(c?.km), 0, lunga) &&
        entro(numero(c.lat), -90, 90) &&
        entro(numero(c.lon), -180, 180) &&
        (numero(c.scostoKm) ?? Infinity) <= CORRIDOIO_KM &&
        (numero(c.kw) ?? 0) >= a.kwColonnine,
    )
    .sort((x, y) => x.km - y.km);
  const strada = lineaBuona(linea);
  const progressivi = chilometriDellaLinea(strada, lunga);
  const soste = [];
  let km = 0;
  let carica = a.batteria;
  while (soste.length < SOSTE_AL_PIU) {
    if (carica - (lunga - km) / kmPerPunto >= a.minimaArrivo - 1e-9) break;
    const finoComodo = km + (carica - comoda) * kmPerPunto;
    const finoAlMassimo = km + (carica - MAI_SOTTO) * kmPerPunto;
    /* La piu' avanti che si raggiunge senza scendere sotto il 10%. */
    let colonnina = null;
    for (const c of buone) if (c.km > km + 0.5 && c.km <= finoAlMassimo) colonnina = c;
    /* Senza colonnine si dice dove la carica arriva alla minima scelta:
     * una colonnina vera la trova gdanav, li' intorno. */
    const dove = colonnina ? colonnina.km : Math.max(km, Math.min(finoComodo, lunga));
    const arrivaCon = Math.max(0, carica - (dove - km) / kmPerPunto);
    const riparteCon = Math.max(FINO_A, arrivaCon);
    const kw = colonnina ? numero(colonnina.kw) : a.kwColonnine;
    const punto = colonnina
      ? [numero(colonnina.lon), numero(colonnina.lat)]
      : puntoAlKm(strada, progressivi, dove);
    soste.push({
      km: tondo(dove),
      nome: colonnina ? String(colonnina.nome || "") : "",
      operatore: colonnina ? String(colonnina.operatore || "") : "",
      kw: colonnina ? tondo(kw) : 0,
      lat: punto ? tondo(punto[1], 5) : null,
      lon: punto ? tondo(punto[0], 5) : null,
      da: tondo(arrivaCon),
      a: tondo(riparteCon),
      min: minutiDiRicarica(arrivaCon, riparteCon, a.kwh, kw, a.kwMax),
    });
    /* Una sosta che non manda avanti — l'auto che parte gia' sotto la
     * carica comoda, e l'80% che non basta nemmeno a una colonnina — non si
     * ripete all'infinito: la si dice una volta, e si va. */
    if (dove <= km && carica >= FINO_A) break;
    km = dove;
    carica = riparteCon;
  }
  const arrivo = carica - (lunga - km) / kmPerPunto;
  return {
    soste,
    arrivo: tondo(arrivo),
    ricaricaMin: soste.reduce((somma, s) => somma + s.min, 0),
  };
}
