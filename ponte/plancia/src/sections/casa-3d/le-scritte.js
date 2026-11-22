/* «Casa 3D»: le scritte dei dispositivi sopra la scena, e i loro pallini.
 *
 * La regola — chi resta scritto per intero e chi diventa un pallino — sta in
 * `core/le-scritte-della-casa-3d.js`, ed e' aritmetica. Qui c'e' la mano che
 * la applica, la stessa per le due scene (la casa generata e il modello di
 * chi abita):
 *
 *   · il conto si rifa' quando la vista cambia, non a ogni fotogramma: con la
 *     telecamera che vola al massimo ogni `RITMO_MS`, e una volta ancora
 *     quando si ferma, cosi' l'ultima vista ha il suo conto. Fra un conto e
 *     l'altro le scritte seguono il loro dispositivo con la decisione di
 *     prima;
 *   · un pallino toccato dice il suo nome in una nuvoletta sopra di se', per
 *     un paio di secondi, mentre il tocco fa quello che ha sempre fatto.
 *
 * Il pallino non e' un altro elemento: e' lo stesso tasto con la classe
 * `c3-pallino`, che lo stringe all'icona. Cosi' i gesti che il tasto aveva —
 * il tocco, il trascinamento mentre si arreda — restano suoi.
 */
import {
  LATO_DEL_PALLINO,
  chiPrendeLaScritta,
  modoDeiNomi,
} from "../../core/le-scritte-della-casa-3d.js";

/* Ogni quanto, al massimo, si rifa' il conto mentre la vista si muove. */
const RITMO_MS = 140;
/* Quanto resta la nuvoletta col nome. */
const NOME_PER_MS = 2600;

export function creaLeScritte({ strato, perLeProve = false, richiedi = () => {} } = {}) {
  const S = {
    modo: "tutti",
    firma: "",
    alle: -Infinity,
    daRifare: true,
    timer: 0,
    decise: new WeakMap(),
    nome: null,
    nomeTimer: 0,
  };
  const nuvola = document.createElement("div");
  nuvola.className = "c3-nome-vola";
  nuvola.setAttribute("role", "status");
  nuvola.style.display = "none";
  strato?.appendChild(nuvola);

  const adesso = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  /* La misura della scritta piena: un pallino misurato e' un pallino, quindi
   * per misurarlo gli si toglie la classe un attimo. Si misura solo quando il
   * testo cambia. */
  function misura(Dv, el) {
    if (Dv.misura?.testo === el.textContent && Dv.misura.w) return Dv.misura;
    const era = el.classList.contains("c3-pallino");
    if (era) el.classList.remove("c3-pallino");
    Dv.misura = { testo: el.textContent, w: el.offsetWidth, h: el.offsetHeight };
    if (era) el.classList.add("c3-pallino");
    return Dv.misura;
  }

  /**
   * Mette le scritte di questo fotogramma.
   *
   * @param {Array<{Dv:object, el:HTMLElement, x:number, y:number,
   *   distanza:number, acceso:boolean, primo?:boolean, priorita?:number}>} visti
   * @param {string} firma la vista di adesso: telecamera, misure del palco,
   *   piano aperto. Cambiata, il conto va rifatto.
   * @param {Array<{x0:number, y0:number, x1:number, y1:number}>} ostacoli
   *   quello che sta gia' scritto e non si sposta (i nomi delle stanze).
   */
  function disponi(visti, firma, ostacoli = []) {
    for (const v of visti) {
      const m = misura(v.Dv, v.el);
      v.w = m.w;
      v.h = m.h;
    }
    const ora = adesso();
    if (firma !== S.firma) S.daRifare = true;
    const manca = perLeProve ? 0 : RITMO_MS - (ora - S.alle);
    if (S.daRifare && manca > 0 && !S.timer) {
      /* Troppo presto: si tiene la decisione di prima, e si torna fra poco a
       * fare il conto della vista dove la telecamera si sara' fermata. */
      S.timer = setTimeout(() => {
        S.timer = 0;
        richiedi();
      }, manca);
    }
    if (S.daRifare && manca <= 0) {
      const esiti = chiPrendeLaScritta(visti, { modo: S.modo, ostacoli });
      visti.forEach((v, i) => S.decise.set(v.Dv, esiti[i]));
      S.firma = firma;
      S.alle = ora;
      S.daRifare = false;
    }
    for (const v of visti) {
      /* Uno appena comparso non ha ancora un conto suo: pieno se il modo lo
       * vuole, e al prossimo conto si vedra'. */
      const d = S.decise.get(v.Dv) || {
        piena: S.modo === "tutti" || (S.modo === "accesi" && v.acceso) || Boolean(v.primo),
        dx: 0,
        dy: 0,
      };
      v.el.classList.toggle("c3-pallino", !d.piena);
      v.el.style.transform = `translate(${(v.x + d.dx).toFixed(1)}px,${(v.y + d.dy).toFixed(1)}px) translate(-50%,-100%)`;
      if (S.nome?.Dv === v.Dv) {
        const alto = d.piena ? v.h : LATO_DEL_PALLINO;
        nuvola.style.transform = `translate(${(v.x + d.dx).toFixed(1)}px,${(v.y + d.dy - alto - 6).toFixed(1)}px) translate(-50%,-100%)`;
      }
    }
    if (S.nome && !visti.some((v) => v.Dv === S.nome.Dv)) nuvola.style.display = "none";
    else if (S.nome) nuvola.style.display = "";
  }

  /** Un tasto toccato: se e' un pallino, dice il suo nome. */
  function toccato(Dv, el, testo) {
    if (!el?.classList.contains("c3-pallino") || !testo) return false;
    S.nome = { Dv };
    nuvola.textContent = testo;
    nuvola.style.display = "";
    clearTimeout(S.nomeTimer);
    S.nomeTimer = setTimeout(() => {
      S.nome = null;
      nuvola.style.display = "none";
    }, NOME_PER_MS);
    richiedi();
    return true;
  }

  return {
    /** La scelta del tasto «Nomi»: si rifa' il conto subito. */
    modo(m) {
      if (m === undefined) return S.modo;
      const nuovo = modoDeiNomi(m);
      if (nuovo !== S.modo) {
        S.modo = nuovo;
        S.daRifare = true;
        S.alle = -Infinity;
        richiedi();
      }
      return S.modo;
    },
    /** Qualcosa e' cambiato senza che la vista si muova (uno stato, un testo). */
    rifai() {
      S.daRifare = true;
    },
    disponi,
    toccato,
    distruggi() {
      clearTimeout(S.timer);
      clearTimeout(S.nomeTimer);
      nuvola.remove();
    },
  };
}

/* Il pallino e la nuvoletta. Il pallino e' il tasto stretto all'icona: il
 * testo resta dentro (si legge con un lettore di schermo, e il tasto si misura
 * da pieno) ma non si vede. */
export const STILE_DELLE_SCRITTE = `
  .c3-chip.c3-pallino{width:${LATO_DEL_PALLINO}px;height:${LATO_DEL_PALLINO}px;padding:0;overflow:hidden;color:transparent;font-size:0;
    display:grid;place-items:center;border-width:2px;box-shadow:0 2px 6px rgba(0,0,0,.35)}
  .c3-chip.c3-pallino::before{content:attr(data-ic);font-size:11px;line-height:1;color:#fff}
  .c3-nome-vola{position:absolute;left:0;top:0;z-index:5;pointer-events:none;white-space:nowrap;max-width:240px;overflow:hidden;text-overflow:ellipsis;
    padding:6px 10px;border-radius:10px;background:rgba(15,23,42,.92);border:1px solid rgba(148,163,184,.35);color:#e6edf7;
    font:700 11.5px 'Inter',system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.35)}
`;
