/* «Casa 3D»: quanto si puo' chiedere a questo schermo, e cosa fare quando il
 * disegno cade.
 *
 * «Quando provo ad aprire la casa 3D inizia a caricare, per un attimo si vede
 * la foto del palazzo e poi diventa tutto nero. C'e' bisogno di un tablet con
 * una certa potenza?» Un po' si'. La scena chiedeva a ogni schermo il doppio
 * dei pixel (`devicePixelRatio` fino a 2), l'antialias, che li moltiplica
 * ancora per quattro, e un'ombra da 2048 per 2048. Su un tablet da muro con
 * lo schermo grande la sola tela erano piu' di cento megabyte di memoria
 * grafica: un tablet economico non li ha, e quando la memoria finisce il
 * browser si riprende il disegno (`webglcontextlost`) e la tela resta nera.
 *
 * Qui si decide, senza DOM e senza three, quanto chiedere:
 *
 *   · i pixel per punto: mai piu' di due; su uno schermo grande uno e mezzo,
 *     che a un metro dal muro non si distingue; con poca memoria uno. E in
 *     tutto non piu' di un tetto di pixel veri, oltre il quale si scende;
 *   · l'antialias e l'ombra piena solo dove c'e' memoria per tenerli;
 *   · dopo ogni caduta del disegno, un gradino piu' in basso: chi e' caduto
 *     una volta per la memoria ricadrebbe uguale.
 *
 * E cosa fare quando il disegno cade (`cosaFareDopoLaCaduta`): si aspetta
 * che il browser lo restituisca, e se non lo fa si rifa' la scena piu'
 * leggera — ma non per sempre. Dopo qualche caduta di fila la casa lo dice,
 * con un tasto per riprovare, invece di restare nera.
 *
 * Non tutte le cadute pero' sono colpa del dispositivo (`laCadutaConta`): il
 * telefono che passa a un'altra app, lo schermo che si spegne, e il browser
 * si riprende il disegno di una pagina che nessuno guarda. Quelle non si
 * contano e non alleggeriscono niente: al ritorno la casa e' quella di prima.
 *
 * E chi il disegno lo tiene ma lo muove a fatica (`fotogrammiLenti`): la
 * scena misura i suoi fotogrammi mentre vola, e se sono pochi scende di un
 * gradino (`lenta`) — prima i pixel, poi l'ombra.
 */

/* I pixel veri della tela, al massimo: con la memoria che dice il browser e
 * senza. Un tablet 1280×800 a schermo pieno sta sotto il primo tetto a uno e
 * mezzo; un computer con molta memoria ha il secondo. */
export const PIXEL_AL_MASSIMO = 2_600_000;
export const PIXEL_AL_MASSIMO_CON_MEMORIA = 4_200_000;

/* Da quanti punti CSS uno schermo e' «grande»: un tablet in orizzontale, un
 * computer. Sotto, un telefono: li' i due pixel per punto si vedono. */
export const SCHERMO_GRANDE = 500_000;

/* `navigator.deviceMemory` in gigabyte (il browser lo arrotonda: 0.25, 0.5,
 * 1, 2, 4, 8). Fino a POCA_MEMORIA si sta al minimo; fino a MEMORIA_MEDIA a
 * meta' strada. Chi non lo dice (Safari, Firefox) e' trattato come medio. */
export const POCA_MEMORIA = 2;
export const MEMORIA_MEDIA = 4;

/* I nuclei del processore (`navigator.hardwareConcurrency`). Un tablet da
 * muro economico ne ha quattro, e con la memoria media e' un dispositivo
 * debole lo stesso. Da soli non dicono niente: Safari ne dichiara quattro
 * anche per un iPhone, che la casa la regge benissimo — e infatti contano
 * solo insieme alla memoria, che Safari non dice. */
export const POCHI_NUCLEI = 4;

/* Quanti gradini si scende, al massimo, per i fotogrammi lenti. */
export const GRADINI_PER_LA_LENTEZZA = 4;

const numero = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** I gigabyte che il browser dice di avere, o `null` se non lo dice. */
export function memoriaDelDispositivo(nav) {
  try {
    const m = numero(nav?.deviceMemory);
    return m && m > 0 ? m : null;
  } catch (_errore) {
    return null;
  }
}

/** I nuclei che il browser dice di avere, o `null` se non lo dice. */
export function nucleiDelDispositivo(nav) {
  try {
    const n = numero(nav?.hardwareConcurrency);
    return n && n > 0 ? n : null;
  } catch (_errore) {
    return null;
  }
}

/**
 * Quanto chiedere alla scena su questo schermo.
 *
 * @param {{dpr?:number, larghezza?:number, altezza?:number,
 *   memoria?:number|null, cadute?:number, nuclei?:number|null,
 *   lenta?:number}} dati
 *   `dpr` il `devicePixelRatio`; `larghezza`, `altezza` la tela in punti CSS
 *   (zero se non si sa ancora); `memoria` i gigabyte del dispositivo
 *   (`memoriaDelDispositivo`); `cadute` quante volte il disegno e' gia' caduto
 *   su questa pagina; `nuclei` quelli del processore (`nucleiDelDispositivo`);
 *   `lenta` i gradini gia' scesi perche' i fotogrammi erano pochi
 *   (`fotogrammiLenti`).
 * @returns {{pixel:number, antialias:boolean, ombra:number, leggera:boolean}}
 *   `pixel` da passare a `setPixelRatio`; `ombra` il lato della mappa
 *   dell'ombra, zero se l'ombra non si disegna; `leggera` se si e' scesi
 *   sotto la qualita' piena.
 */
export function qualitaDellaCasa3D({
  dpr = 1,
  larghezza = 0,
  altezza = 0,
  memoria = null,
  cadute = 0,
  nuclei = null,
  lenta = 0,
} = {}) {
  const base = numero(dpr) && dpr > 0 ? dpr : 1;
  let pixel = Math.min(2, base);
  const mem = numero(memoria);
  const cpu = numero(nuclei);
  const poca =
    mem !== null &&
    (mem <= POCA_MEMORIA || (mem <= MEMORIA_MEDIA && cpu !== null && cpu <= POCHI_NUCLEI));
  const media = mem === null || mem <= MEMORIA_MEDIA;
  const giu = Math.max(0, Math.floor(numero(cadute) || 0));
  const area = Math.max(0, numero(larghezza) || 0) * Math.max(0, numero(altezza) || 0);

  if (poca || giu > 0) pixel = Math.min(pixel, 1);
  else if (area >= SCHERMO_GRANDE) pixel = Math.min(pixel, 1.5);
  /* Il tetto dei pixel veri: si scende fino a uno, non oltre — sotto uno la
   * casa si sgrana, e uno schermo cosi' grande ha la memoria per reggerlo. */
  const tetto = media ? PIXEL_AL_MASSIMO : PIXEL_AL_MASSIMO_CON_MEMORIA;
  if (area > 0 && area * pixel * pixel > tetto)
    pixel = Math.max(Math.min(1, pixel), Math.sqrt(tetto / area));
  const antialias = !poca && giu === 0;
  let ombra = giu >= 2 ? 512 : poca || giu === 1 ? 1024 : 2048;
  /* I gradini della lentezza, uno alla volta: prima i pixel (da due a uno e
   * mezzo, poi a uno), poi l'ombra — che e' un secondo disegno della casa a
   * ogni fotogramma — e solo in fondo sotto il pixel per punto: sgranata ma
   * che si muove, meglio di nitida e ferma. */
  const passi = Math.min(GRADINI_PER_LA_LENTEZZA, Math.max(0, Math.floor(numero(lenta) || 0)));
  for (let i = 0; i < passi; i++) {
    if (pixel > 1.5) pixel = 1.5;
    else if (pixel > 1) pixel = 1;
    else if (ombra > 0) ombra = 0;
    else pixel = Math.min(pixel, 0.75);
  }
  pixel = Math.round(pixel * 100) / 100;

  return {
    pixel,
    antialias,
    ombra,
    leggera: pixel < Math.min(2, base) || !antialias || ombra < 2048,
  };
}

/* Quanto si aspetta che il browser restituisca il disegno da solo. */
export const ATTESA_DEL_RITORNO_MS = 2500;
/* Quante cadute si sopportano nella finestra, prima di dirlo. */
export const CADUTE_AL_MASSIMO = 3;
export const FINESTRA_DELLE_CADUTE_MS = 5 * 60 * 1000;

/**
 * Il disegno e' caduto adesso: si riprova (piu' leggeri) o si smette?
 *
 * @param {number[]} prima i momenti (ms) delle cadute precedenti.
 * @param {number} adesso il momento di questa.
 * @returns {{azione:"riprova"|"basta", cadute:number[]}} `cadute` sono quelle
 *   da ricordare, questa compresa, senza quelle uscite dalla finestra.
 */
export function cosaFareDopoLaCaduta(prima = [], adesso = Date.now()) {
  const ora = numero(adesso) ?? 0;
  const cadute = (Array.isArray(prima) ? prima : [])
    .map(numero)
    .filter((t) => t !== null && ora - t < FINESTRA_DELLE_CADUTE_MS && t <= ora);
  cadute.push(ora);
  return { azione: cadute.length > CADUTE_AL_MASSIMO ? "basta" : "riprova", cadute };
}

/* Per quanto, dopo che la pagina e' tornata in vista (o poco prima che se ne
 * vada), una caduta e' ancora quella del telefono andato dietro: il browser
 * la dice quando gli pare, a volte al ritorno. */
export const GRAZIA_DEL_RITORNO_MS = 5000;

/**
 * Se una caduta del disegno e' di questo dispositivo che non ce la fa.
 *
 * Non lo e' quando la pagina non si vede — il telefono su un'altra app, lo
 * schermo spento: il browser si riprende la memoria grafica di chi sta
 * dietro, anche sul telefono migliore — e nemmeno subito dopo il ritorno.
 * Contate, quattro passaggi da un'app all'altra in cinque minuti facevano
 * dire alla casa «questo dispositivo non ha abbastanza memoria grafica».
 *
 * @param {{nascosta?:boolean, tornataIl?:number, adesso?:number}} dati
 *   `nascosta` se la pagina adesso non si vede (`document.hidden`);
 *   `tornataIl` quando e' tornata in vista l'ultima volta (zero: mai andata
 *   via); `adesso` il momento della caduta.
 */
export function laCadutaConta({ nascosta = false, tornataIl = 0, adesso = Date.now() } = {}) {
  if (nascosta === true) return false;
  const ora = numero(adesso) ?? 0;
  const tornata = numero(tornataIl) || 0;
  return !(tornata > 0 && ora >= tornata && ora - tornata < GRAZIA_DEL_RITORNO_MS);
}

/**
 * Le cadute da ricordare quando la pagina se ne va: senza quelle degli ultimi
 * istanti, che erano gia' il telefono che andava dietro (la caduta arriva a
 * volte un attimo prima che la pagina sappia di non vedersi piu').
 */
export function senzaLeCaduteDiAdesso(cadute = [], adesso = Date.now()) {
  const ora = numero(adesso) ?? 0;
  return (Array.isArray(cadute) ? cadute : [])
    .map(numero)
    .filter((t) => t !== null && !(t <= ora && ora - t < GRAZIA_DEL_RITORNO_MS));
}

/* Quanto si guarda prima di decidere: almeno questi fotogrammi di fila, e
 * almeno questo tempo. A sessanta al secondo sono una settantina di
 * fotogrammi; su un tablet che ne fa due al secondo bastano i primi, e non si
 * aspetta mezzo minuto per accorgersene. */
export const FOTOGRAMMI_DA_MISURARE = 8;
export const TEMPO_DA_MISURARE_MS = 1200;
/* Sotto quanti fotogrammi al secondo la casa «va a scatti», e sotto quanti
 * non si muove proprio: li' i gradini si scendono a due a due. */
export const FOTOGRAMMI_AL_SECONDO_MINIMI = 20;
export const FOTOGRAMMI_AL_SECONDO_DA_FERMI = 5;

/**
 * Se la scena si muove a fatica: gli intervalli (ms) fra fotogrammi di fila,
 * presi mentre la casa vola da una vista all'altra.
 *
 * Decide la mediana, non la media: un fotogramma lungo da solo — la pagina
 * che fa altro per un attimo — non e' un dispositivo lento.
 *
 * @returns {null|0|1|2} `null`: troppo poco per decidere, si continua a
 *   misurare; `0`: va bene cosi'; `1`, `2`: i gradini da scendere.
 */
export function fotogrammiLenti(intervalli = []) {
  const validi = (Array.isArray(intervalli) ? intervalli : [])
    .map(numero)
    .filter((t) => t !== null && t > 0);
  const tempo = validi.reduce((a, b) => a + b, 0);
  if (validi.length < FOTOGRAMMI_DA_MISURARE || tempo < TEMPO_DA_MISURARE_MS) return null;
  const ordinati = validi.slice().sort((a, b) => a - b);
  const mediana = ordinati[Math.floor(ordinati.length / 2)];
  if (mediana > 1000 / FOTOGRAMMI_AL_SECONDO_DA_FERMI) return 2;
  return mediana > 1000 / FOTOGRAMMI_AL_SECONDO_MINIMI ? 1 : 0;
}
