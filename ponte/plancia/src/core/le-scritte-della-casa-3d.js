/* «Casa 3D»: le scritte dei dispositivi che non si coprono.
 *
 * «Le scritte dei dispositivi nella Casa 3D sono troppe e si sovrappongono.»
 * Ogni dispositivo messo nella casa ha il suo tasto sopra la scena, con lo
 * stato scritto dentro: «💡 accesa 80%», «21,4°», «in funzione». In una
 * stanza con tre luci, il termostato e la tapparella sono cinque scritte in
 * un palmo, e guardando il piano di taglio dieci stanze diventano una pila.
 * Prima i tasti che si toccavano salivano uno sopra l'altro: non si coprivano
 * piu', ma facevano delle torri che coprivano la casa.
 *
 * Adesso, a ogni disegno, quando due scritte si toccano sullo schermo resta
 * piena quella piu' vicina alla telecamera, e l'altra diventa un pallino con
 * l'icona: si tocca lo stesso, e al tocco dice il suo nome. E c'e' un tasto,
 * «Nomi», con tre scelte che restano su quel dispositivo:
 *
 *   · «Tutti»       — ogni dispositivo la sua scritta, se c'e' posto;
 *   · «Solo accesi» — le scritte piene solo per chi e' acceso (una luce, un
 *                     movimento, una finestra aperta), gli altri pallini;
 *   · «Nessuno»     — solo pallini.
 *
 * Di serie «Tutti»: chi non tocca niente ha gia' la casa sgombra, perche' le
 * scritte che si coprono diventano pallini da sole.
 *
 * Qui non c'e' DOM e non c'e' three: si ragiona su rettangoli sullo schermo.
 * La scena li misura e li proietta, chiede a `chiPrendeLaScritta` chi resta
 * pieno, e applica. Il conto e' fatto su una griglia di celle, cosi' cento
 * dispositivi non sono diecimila paragoni: ogni scritta guarda solo quelle
 * che le stanno vicine.
 */

/* Le tre scelte del tasto «Nomi», nell'ordine in cui il tasto le gira. */
export const MODI_DEI_NOMI = Object.freeze(["tutti", "accesi", "nessuno"]);
export const NOMI_DI_SERIE = "tutti";

/* Dove si ricorda la scelta. E' di questo dispositivo, non della casa — il
 * tablet a muro e il telefono vogliono cose diverse, come per le fasce ai
 * lati — e quindi sta nel browser, non nel config. */
export const CHIAVE_NOMI_CASA3D = "dm_casa3d_nomi";

/* Il lato del pallino, e l'aria che due cose sullo schermo si lasciano. */
export const LATO_DEL_PALLINO = 22;
export const STACCO = 3;

/* Il lato delle celle della griglia: piu' o meno una scritta corta. */
const CELLA = 48;

/** La scelta pulita: quello che non e' una delle tre vale quella di serie. */
export function modoDeiNomi(scritto) {
  const v = String(scritto ?? "")
    .trim()
    .toLowerCase();
  return MODI_DEI_NOMI.includes(v) ? v : NOMI_DI_SERIE;
}

/** La scelta dopo questa: il tasto le gira in tondo. */
export function modoDopo(modo) {
  const i = MODI_DEI_NOMI.indexOf(modoDeiNomi(modo));
  return MODI_DEI_NOMI[(i + 1) % MODI_DEI_NOMI.length];
}

/* Dove cercare un posto per un pallino che cade su qualcosa: lo stesso punto,
 * poi i giri intorno, dal piu' stretto al piu' largo — prima sopra e ai lati,
 * sotto per ultimo, perche' sotto c'e' il dispositivo. Il nome di una stanza e'
 * largo, e un pallino caduto in mezzo deve poterne uscire. Un pallino che non
 * trova posto nemmeno a quattro passi resta dove sta: meglio due cose
 * accostate che un pallino lontano dal suo dispositivo. */
const PASSI_AL_MASSIMO = 4;
function postiDelPallino(lato, stacco) {
  const s = lato + stacco;
  const posti = [];
  for (let j = -PASSI_AL_MASSIMO; j <= 1; j++)
    for (let i = -PASSI_AL_MASSIMO; i <= PASSI_AL_MASSIMO; i++) posti.push([i, j]);
  const peso = ([i, j]) => i * i + j * j + (j > 0 ? 2.5 : 0);
  return posti
    .sort((a, b) => peso(a) - peso(b) || Math.abs(a[0]) - Math.abs(b[0]) || b[0] - a[0])
    .map(([i, j]) => [i * s, j * s]);
}

/* La griglia: ogni rettangolo messo si scrive in tutte le celle che tocca. */
function creaGriglia() {
  const celle = new Map();
  const giro = (r, fai) => {
    const cx0 = Math.floor(r.x0 / CELLA);
    const cx1 = Math.floor(r.x1 / CELLA);
    const cy0 = Math.floor(r.y0 / CELLA);
    const cy1 = Math.floor(r.y1 / CELLA);
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) if (fai(`${cx},${cy}`) === true) return true;
    return false;
  };
  return {
    metti(r) {
      giro(r, (k) => {
        const qui = celle.get(k);
        if (qui) qui.push(r);
        else celle.set(k, [r]);
      });
    },
    tocca(r, stacco) {
      return giro(r, (k) =>
        (celle.get(k) || []).some(
          (m) =>
            r.x0 < m.x1 + stacco &&
            m.x0 < r.x1 + stacco &&
            r.y0 < m.y1 + stacco &&
            m.y0 < r.y1 + stacco,
        ),
      );
    },
  };
}

const numero = (v, altrimenti = 0) => (Number.isFinite(Number(v)) ? Number(v) : altrimenti);

/**
 * Chi resta scritto per intero, e chi diventa un pallino.
 *
 * @param {Array<{x:number, y:number, w:number, h:number, distanza?:number,
 *   acceso?:boolean, primo?:boolean, priorita?:number}>} voci
 *   una per dispositivo sullo schermo. `x`,`y` e' il punto dove la scritta si
 *   appoggia: in mezzo, sul suo lato di sotto (la scena la disegna sopra il
 *   dispositivo). `w`,`h` le misure della scritta piena. `distanza` dalla
 *   telecamera: vince il piu' vicino. `primo` passa davanti a tutti (quello
 *   scelto mentre si arreda); `priorita` passa davanti a parita' di scelta (un
 *   allarme, un movimento acceso).
 * @param {{modo?:string, lato?:number, stacco?:number,
 *   ostacoli?:Array<{x0:number, y0:number, x1:number, y1:number}>}} opzioni
 *   `ostacoli` sono le cose gia' scritte che non si spostano — i nomi delle
 *   stanze — e che le scritte dei dispositivi non devono coprire.
 * @returns {Array<{piena:boolean, dx:number, dy:number}>} nello stesso ordine
 *   delle voci. `dx`,`dy` spostano il pallino quando il suo punto e' occupato;
 *   una scritta piena non si sposta mai.
 */
export function chiPrendeLaScritta(voci, opzioni = {}) {
  const elenco = Array.isArray(voci) ? voci : [];
  const modo = modoDeiNomi(opzioni.modo);
  const lato = numero(opzioni.lato, LATO_DEL_PALLINO);
  const stacco = numero(opzioni.stacco, STACCO);
  const vuolePiena = (v) =>
    Boolean(v?.primo) || modo === "tutti" || (modo === "accesi" && Boolean(v?.acceso));
  /* Chi sceglie per primo: lo scelto, poi chi vuole la scritta piena, poi chi
   * ha qualcosa da gridare, poi il piu' vicino. A parita', l'ordine di
   * arrivo: lo stesso giro da' sempre la stessa risposta, e le scritte non
   * ballano fra un disegno e l'altro. */
  const ordine = elenco
    .map((v, i) => ({
      i,
      primo: v?.primo ? 1 : 0,
      piena: vuolePiena(v) ? 1 : 0,
      priorita: numero(v?.priorita),
      distanza: numero(v?.distanza, Infinity),
    }))
    .sort(
      (a, b) =>
        b.primo - a.primo ||
        b.piena - a.piena ||
        b.priorita - a.priorita ||
        a.distanza - b.distanza ||
        a.i - b.i,
    );
  const griglia = creaGriglia();
  /* I nomi delle stanze stanno gia' sullo schermo: dicono dove si e', e un
   * «78%» sopra «SOGGIORNO» li rende illeggibili. Le scritte dei dispositivi
   * gli girano intorno. */
  for (const o of Array.isArray(opzioni.ostacoli) ? opzioni.ostacoli : []) {
    const r = { x0: numero(o?.x0), y0: numero(o?.y0), x1: numero(o?.x1), y1: numero(o?.y1) };
    if (r.x1 > r.x0 && r.y1 > r.y0) griglia.metti(r);
  }
  const posti = postiDelPallino(lato, stacco);
  const esito = new Array(elenco.length);
  for (const o of ordine) {
    const v = elenco[o.i] || {};
    const x = numero(v.x);
    const y = numero(v.y);
    if (o.piena) {
      const w = Math.max(0, numero(v.w));
      const h = Math.max(0, numero(v.h));
      const r = { x0: x - w / 2, x1: x + w / 2, y0: y - h, y1: y };
      /* Lo scelto resta pieno anche se cade su qualcosa: e' quello che si sta
       * spostando, e i comandi gli stanno appoggiati sopra. */
      if (o.primo || !griglia.tocca(r, stacco)) {
        griglia.metti(r);
        esito[o.i] = { piena: true, dx: 0, dy: 0 };
        continue;
      }
    }
    let scelto = posti[0];
    let r = null;
    for (const posto of posti) {
      const prova = {
        x0: x + posto[0] - lato / 2,
        x1: x + posto[0] + lato / 2,
        y0: y + posto[1] - lato,
        y1: y + posto[1],
      };
      if (!griglia.tocca(prova, stacco)) {
        scelto = posto;
        r = prova;
        break;
      }
    }
    if (!r) r = { x0: x - lato / 2, x1: x + lato / 2, y0: y - lato, y1: y };
    griglia.metti(r);
    esito[o.i] = { piena: false, dx: scelto[0], dy: scelto[1] };
  }
  return esito;
}
