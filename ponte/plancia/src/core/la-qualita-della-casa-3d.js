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

/**
 * Quanto chiedere alla scena su questo schermo.
 *
 * @param {{dpr?:number, larghezza?:number, altezza?:number,
 *   memoria?:number|null, cadute?:number}} dati
 *   `dpr` il `devicePixelRatio`; `larghezza`, `altezza` la tela in punti CSS
 *   (zero se non si sa ancora); `memoria` i gigabyte del dispositivo
 *   (`memoriaDelDispositivo`); `cadute` quante volte il disegno e' gia' caduto
 *   su questa pagina.
 * @returns {{pixel:number, antialias:boolean, ombra:number, leggera:boolean}}
 *   `pixel` da passare a `setPixelRatio`; `ombra` il lato della mappa
 *   dell'ombra; `leggera` se si e' scesi sotto la qualita' piena.
 */
export function qualitaDellaCasa3D({
  dpr = 1,
  larghezza = 0,
  altezza = 0,
  memoria = null,
  cadute = 0,
} = {}) {
  const base = numero(dpr) && dpr > 0 ? dpr : 1;
  let pixel = Math.min(2, base);
  const mem = numero(memoria);
  const poca = mem !== null && mem <= POCA_MEMORIA;
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
  pixel = Math.round(pixel * 100) / 100;

  const antialias = !poca && giu === 0;
  const ombra = giu >= 2 ? 512 : poca || giu === 1 ? 1024 : 2048;
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
