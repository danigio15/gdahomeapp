/* Le luci di casa sul tablet a muro: quando la scena delle luci prende il
 * riposo, quando il tablet si sveglia per guardarle accendersi, e quale tocco
 * non sveglia.
 *
 * Il disegno e' quello del riquadro in Home (`core/scena-delle-luci.js` e
 * `sections/la-scena-delle-luci.js`); il pannello a muro lo mette in due
 * posti: a tutto schermo sul riposo, al posto della scena generica, e in una
 * fascia in fondo alla prima pagina, coi tocchi. Qui ci sono solo le
 * decisioni, senza DOM e senza orologio che non sia quello che si passa.
 *
 * ── Il momento dell'accensione ────────────────────────────────────────────
 *
 * Quando le luci passano da tutte spente ad accese col tablet a riposo — di
 * solito le accende l'orario, al tramonto — il tablet si sveglia per qualche
 * secondo: lo schermo torna pieno, l'orologio si fa da parte e si guarda la
 * cascata delle lampadine. Poi torna a riposo da solo. Una volta per sera, e
 * mai col buio della notte del pannello: chi dorme non vuole lo schermo che
 * si accende in corridoio. Non e' un risveglio vero: il pannello resta a
 * riposo, il sensore di presenza e i tocchi fanno quello che facevano.
 */
import { inFesta } from "./feste.js";

/** Quanto dura il momento dell'accensione, in millisecondi. */
export const DURATA_DEL_MOMENTO = 20 * 1000;

/* Le fasi del cielo (`faseDelCielo` in `core/scena-delle-luci.js`) che sono
 * «sera»: dal tramonto in poi, finche' non si passa la mezzanotte. */
const FASI_DI_SERA = Object.freeze(["tramonto", "sera", "notte"]);

const contaLuci = (config) => (Array.isArray(config?.luci) ? config.luci.length : 0);

/**
 * Se il riposo del tablet mostra la scena delle luci invece di quella
 * generica: nel momento `vigilia` di `momentoDelMuro`, e solo se ci sono luci
 * configurate. Il conto alla rovescia e i fuochi restano loro.
 */
export function luciSulRiposo(momento, config) {
  return momento === "vigilia" && contaLuci(config) > 0;
}

/** Se la fascia delle luci va sulla prima pagina del tablet sveglio. */
export function luciSullaPlancia(adesso, config) {
  return contaLuci(config) > 0 && inFesta(adesso);
}

/** La sera di un momento, per ricordare che il momento c'e' gia' stato. */
export function seraDi(adesso = new Date()) {
  const d = adesso instanceof Date ? adesso : new Date(adesso);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Se adesso comincia il momento dell'accensione.
 *
 * Entra:
 *  - `prima`: quante luci erano accese al giro prima (`null` se non si
 *    sapeva: al primo giro, o con gli stati non ancora arrivati);
 *  - `accese`, `note`: quante sono accese adesso, e di quante si sa lo stato;
 *  - `riposo`: se il pannello e' a riposo;
 *  - `conLeLuci`: se il riposo mostra la scena delle luci (`luciSulRiposo`);
 *  - `notte`: se e' la notte del pannello (lo schermo nero o al minimo);
 *  - `fase`, `mattina`: il cielo di adesso;
 *  - `adesso`, e `fatta`: la sera in cui il momento c'e' gia' stato.
 *
 * Esce `{ mostra, sera }`: se mostrarlo, e la sera da ricordare.
 */
export function momentoDellAccensione({
  prima = null,
  accese = 0,
  note = 0,
  riposo = false,
  conLeLuci = false,
  notte = false,
  fase = "",
  mattina = false,
  adesso = new Date(),
  fatta = "",
} = {}) {
  const no = { mostra: false, sera: fatta };
  /* Da tutte spente ad accese: un giro senza stati non conta. */
  if (prima !== 0 || !(accese > 0) || !(note > 0)) return no;
  if (!riposo || !conLeLuci || notte) return no;
  if (mattina || !FASI_DI_SERA.includes(fase)) return no;
  const sera = seraDi(adesso);
  if (!sera || sera === fatta) return no;
  return { mostra: true, sera };
}

/**
 * Quale riposo nel tempo delle scene, dato il momento (`momentoDelMuro`), lo
 * stile scelto per il riposo (gia' passato da `stileDelRiposo`, che senza
 * foto da' il cielo) e la configurazione delle luci:
 *
 *  - `conto` e `fuochi` passano sopra tutto, come sempre;
 *  - con la «Cornice foto» scelta (e delle foto) restano le foto di chi abita
 *    la casa, con la neve e gli auguri sopra: `cornice`;
 *  - altrimenti la scena delle luci (`luci`), o senza luci quella di sempre
 *    (`vigilia`);
 *  - fuori, `""`: il riposo di tutto l'anno.
 */
export function riposoDelleFeste({ momento = null, stile = "orologio", config = null } = {}) {
  if (momento === "conto" || momento === "fuochi") return momento;
  if (momento !== "vigilia") return "";
  if (stile === "foto") return "cornice";
  return luciSulRiposo(momento, config) ? "luci" : "vigilia";
}

/* La neve che cade sul riposo, sopra la scena delle luci e sopra le foto:
 * poche decine di fiocchi, che si vedono ma non coprono. */
export function fiocchiSulRiposo(larghezza = 1280) {
  return Number(larghezza) < 700 ? 34 : 54;
}

/* I tocchi sul riposo che fanno la loro cosa senza svegliare il pannello:
 * «Spegni tutte», piccolo, in un angolo della scena. Tutto il resto del
 * riposo sveglia, come sempre. */
export const TOCCHI_CHE_NON_SVEGLIANO = Object.freeze(["luci-quiete"]);

/** Se un tocco su questo bersaglio (il suo `data-mu-fa`) sveglia il pannello. */
export function ilToccoSveglia({ riposo = false, fa = "" } = {}) {
  return !(riposo && TOCCHI_CHE_NON_SVEGLIANO.includes(String(fa || "")));
}
