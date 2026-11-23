/* Dove sta ogni cosa, su ogni orologio.
 *
 * Gli Amazfit sono tanti: tondi da 360 a 480, quadrati da 320×380 a 432×514,
 * coi lati arrotondati. Qui non c'e' un pixel pensato per uno solo: tutto si
 * scrive in misure di disegno — 480 di larghezza per il tondo, 390 per il
 * quadrato, come dice `platforms` in `app.json` — e si porta allo schermo
 * vero moltiplicando per la sua larghezza. In altezza il quadrato si prende
 * quello che ha: un 320×380 e' piu' alto, in proporzione, di un 390×450.
 *
 * E i testi non vanno da bordo a bordo: su un tondo il bordo si stringe salendo
 * e scendendo, su un quadrato si arrotonda negli angoli. Ogni riga di testo
 * prende solo la corda che lo schermo ha a quell'altezza (`corda`).
 *
 * E' puro apposta — niente `@zos` — perche' le stesse misure le usano le
 * pagine, le prove (`test/misure.test.js`, che controlla che niente esca dallo
 * schermo su ogni forma) e i disegni di controllo
 * (`strumenti/disegna-le-misure.mjs`).
 */

/* Le forme degli Amazfit con Zepp OS 3 e oltre, dall'elenco dei modelli di
 * zeus. `angolo` e' il raggio degli angoli dei quadrati. */
export const LE_FORME = Object.freeze([
  { nome: "tondo-360", larghezza: 360, altezza: 360, tondo: true, modelli: "Active Edge" },
  { nome: "tondo-416", larghezza: 416, altezza: 416, tondo: true, modelli: "Falcon" },
  { nome: "tondo-454", larghezza: 454, altezza: 454, tondo: true, modelli: "Cheetah, T-Rex Ultra" },
  {
    nome: "tondo-466",
    larghezza: 466,
    altezza: 466,
    tondo: true,
    modelli: "GTR 4, Active 2, T-Rex 3 Pro 44",
  },
  {
    nome: "tondo-480",
    larghezza: 480,
    altezza: 480,
    tondo: true,
    modelli: "Balance, Cheetah Pro, T-Rex 3",
  },
  {
    nome: "quadrato-320x380",
    larghezza: 320,
    altezza: 380,
    tondo: false,
    angolo: 69,
    modelli: "Bip 5 Core, Bip 5 Unity",
  },
  {
    nome: "quadrato-390x450",
    larghezza: 390,
    altezza: 450,
    tondo: false,
    angolo: 86,
    modelli: "GTS 4, Active, Bip 6",
  },
  {
    nome: "quadrato-432x514",
    larghezza: 432,
    altezza: 514,
    tondo: false,
    angolo: 106,
    modelli: "Bip Max",
  },
]);

/* Il raggio degli angoli quando il modello non lo dice: poco meno di un
 * quarto della larghezza, come i quadrati che lo dicono. */
const ANGOLO_IN_PROPORZIONE = 0.225;

/* Il margine dal bordo, in misure di disegno: lo spessore di un dito che
 * tocca il bordo dell'orologio senza toccare il tasto. */
const MARGINE = 14;

export function loSchermo({ larghezza, altezza, tondo, angolo = null }) {
  const W = Math.round(larghezza);
  const H = Math.round(altezza ?? larghezza);
  const disegno = tondo ? 480 : 390;
  const k = W / disegno;
  const a = tondo ? W / 2 : Math.round(angolo ?? W * ANGOLO_IN_PROPORZIONE);
  const px = (v) => Math.round(v * k);

  /* La parte di riga che lo schermo mostra fra `y` e `y + h`, meno il
   * margine: dove si puo' scrivere senza che il bordo mangi le lettere. */
  function corda(y, h, margine = MARGINE) {
    const m = px(margine);
    if (tondo) {
      const R = W / 2;
      const dy = Math.max(Math.abs(y - H / 2), Math.abs(y + h - H / 2));
      const mezza = dy >= R ? 0 : Math.sqrt(R * R - dy * dy);
      const x = Math.ceil(W / 2 - mezza + m);
      return { x, w: Math.max(0, W - 2 * x) };
    }
    let rientro = 0;
    for (const bordo of [y, y + h]) {
      const dentro = bordo < a ? a - bordo : bordo > H - a ? bordo - (H - a) : 0;
      if (dentro > 0)
        rientro = Math.max(rientro, a - Math.sqrt(Math.max(0, a * a - dentro * dentro)));
    }
    const x = Math.ceil(rientro + m);
    return { x, w: Math.max(0, W - 2 * x) };
  }

  /* Se un punto sta dentro lo schermo. */
  function dentro(x, y) {
    if (tondo) return (x - W / 2) ** 2 + (y - H / 2) ** 2 <= (W / 2) ** 2 + 0.5;
    if (x < -0.5 || y < -0.5 || x > W + 0.5 || y > H + 0.5) return false;
    const cx = x < a ? a : x > W - a ? W - a : x;
    const cy = y < a ? a : y > H - a ? H - a : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= a * a + 0.5;
  }

  return { W, H, k, px, tondo: Boolean(tondo), angolo: a, corda, dentro, altezzaDiDisegno: H / k };
}

/* ─── I pezzi ──────────────────────────────────────────────────────────────
 *
 * Ogni pezzo e' un oggetto con la sua forma: `riquadro` (con `r`, il raggio
 * degli angoli), `cerchio` (`cx`, `cy`, `r`), `testo` (con `grande`, la
 * misura delle lettere, e `allinea`), `interruttore`, `arco`. Le pagine li
 * disegnano coi widget di Zepp; le prove ne guardano i bordi. */

function testo(
  s,
  {
    y,
    h,
    grande,
    allinea = "centro",
    margine = MARGINE,
    x = null,
    w = null,
    righe = 1,
    colore = "testo",
  },
) {
  const span = x == null ? s.corda(y, h, margine) : { x, w };
  return {
    tipo: "testo",
    x: span.x,
    y,
    w: span.w,
    h,
    grande: s.px(grande),
    allinea,
    righe,
    colore,
  };
}

/* La prima pagina: il titolo, quattro riquadri, e di quando e' la casa. */
export function laCasa(s) {
  const { px } = s;
  const titolo = testo(s, { y: px(s.tondo ? 34 : 22), h: px(44), grande: 32, colore: "ambra" });
  const spazio = px(12);
  const margine = px(s.tondo ? 72 : 18);
  const cima = px(s.tondo ? 110 : 92);
  const w = Math.floor((s.W - 2 * margine - spazio) / 2);
  /* Sul quadrato i riquadri si prendono l'altezza che c'e', fino a un tetto:
   * un Bip 5 e' piu' alto, in proporzione, di un GTS 4. */
  const h = s.tondo ? px(135) : Math.min(px(150), Math.floor((s.H - cima - px(64) - spazio) / 2));
  const riquadri = [0, 1, 2, 3].map((i) => {
    const x = margine + (i % 2) * (w + spazio);
    const y = cima + Math.floor(i / 2) * (h + spazio);
    const sotto = Math.round(h * 0.28);
    return {
      fondo: { tipo: "riquadro", x, y, w, h, r: px(28) },
      segno: {
        tipo: "cerchio",
        cx: x + Math.round(w / 2),
        cy: y + Math.round(h * 0.28),
        r: px(24),
      },
      nome: testo(s, {
        x: x + px(6),
        w: w - px(12),
        y: y + Math.round(h * 0.5),
        h: px(30),
        grande: 22,
      }),
      det: testo(s, {
        x: x + px(6),
        w: w - px(12),
        y: y + h - sotto,
        h: px(24),
        grande: 17,
        colore: "tenue",
      }),
    };
  });
  const fondoDellaGriglia = cima + 2 * h + spazio;
  const piede = testo(s, { y: fondoDellaGriglia + px(12), h: px(26), grande: 17, colore: "tenue" });
  return { titolo, riquadri, piede };
}

/* Un elenco che scorre: le luci, i cancelli, le azioni. Le righe sotto lo
 * schermo ci arrivano scorrendo. */
export function laLista(s, quante, { conInterruttore = true, conDettaglio = true } = {}) {
  const { px } = s;
  const titolo = testo(s, { y: px(s.tondo ? 34 : 22), h: px(44), grande: 32, colore: "ambra" });
  const sotto = testo(s, { y: px(s.tondo ? 80 : 66), h: px(28), grande: 19, colore: "tenue" });
  const x = px(s.tondo ? 50 : 16);
  /* Sul quadrato, a destra, il posto della barra che scorre. */
  const w = s.W - x - px(s.tondo ? 50 : 22);
  const h = px(88);
  const cima = px(s.tondo ? 116 : 104);
  const spazio = px(10);
  const righe = [];
  for (let i = 0; i < quante; i += 1) {
    const y = cima + i * (h + spazio);
    const destra = conInterruttore ? px(92) : px(20);
    const scritta = x + px(80);
    righe.push({
      fondo: { tipo: "riquadro", x, y, w, h, r: Math.round(h / 2) },
      segno: { tipo: "cerchio", cx: x + px(42), cy: y + Math.round(h / 2), r: px(27) },
      nome: testo(s, {
        x: scritta,
        w: x + w - destra - scritta,
        y: conDettaglio ? y + px(14) : y + Math.round((h - px(32)) / 2),
        h: px(32),
        grande: 21,
        allinea: "sinistra",
      }),
      det: conDettaglio
        ? testo(s, {
            x: scritta,
            w: x + w - destra - scritta,
            y: y + px(48),
            h: px(24),
            grande: 17,
            allinea: "sinistra",
            colore: "tenue",
          })
        : null,
      interruttore: conInterruttore
        ? {
            tipo: "interruttore",
            x: x + w - px(80),
            y: y + Math.round((h - px(36)) / 2),
            w: px(64),
            h: px(36),
          }
        : null,
    });
  }
  return { titolo, sotto, righe, primaRiga: cima, passo: h + spazio };
}

/* Una luce sola: l'arco della luminosita', il numero, meno e piu', e il
 * tasto per spegnerla. */
export function laLuce(s) {
  const { px } = s;
  const cx = Math.round(s.W / 2);
  const tondo = s.tondo;
  const cy = tondo ? Math.round(s.H / 2) : px(218);
  const spessore = px(tondo ? 16 : 18);
  const r = tondo ? Math.round(s.W / 2 - px(18)) : px(146);
  /* Il nome sta dentro l'arco: il margine e' quello dell'arco e del suo
   * spessore, non quello del bordo. */
  const nome = testo(s, {
    y: px(tondo ? 74 : 22),
    h: px(30),
    grande: 21,
    margine: tondo ? 36 : MARGINE,
  });
  /* Sul quadrato l'anello e' piu' stretto: il numero un po' piu' piccolo,
   * per stare dentro senza toccarlo. */
  const cifra = tondo
    ? testo(s, { y: cy - px(104), h: px(104), grande: 80, x: cx - px(110), w: px(220) })
    : testo(s, { y: cy - px(96), h: px(92), grande: 70, x: cx - px(100), w: px(200) });
  const etichetta = testo(s, {
    y: cy + px(tondo ? 0 : -4),
    h: px(26),
    grande: 18,
    colore: "tenue",
    x: cx - px(110),
    w: px(220),
  });
  const lato = px(tondo ? 72 : 64);
  const yTondi = cy + px(tondo ? 28 : 44);
  const dentro = tondo ? px(70) : px(118);
  const meno = {
    tipo: "riquadro",
    x: dentro,
    y: yTondi,
    w: lato,
    h: lato,
    r: Math.round(lato / 2),
  };
  const piu = {
    tipo: "riquadro",
    x: s.W - dentro - lato,
    y: yTondi,
    w: lato,
    h: lato,
    r: Math.round(lato / 2),
  };
  const hTasto = px(tondo ? 66 : 76);
  const wTasto = px(tondo ? 200 : 270);
  const tasto = {
    tipo: "riquadro",
    x: Math.round((s.W - wTasto) / 2),
    y: s.H - px(tondo ? 44 : 18) - hTasto,
    w: wTasto,
    h: hTasto,
    r: Math.round(hTasto / 2),
  };
  return {
    arco: { tipo: "arco", cx, cy, r, spessore, da: -135, a: 135 },
    nome,
    cifra,
    etichetta,
    meno,
    piu,
    tasto,
  };
}

/* «Fatto» o «Non è partito»: il bollo, la parola, il perche', e Riprova. */
export function lEsito(s) {
  const { px } = s;
  const cx = Math.round(s.W / 2);
  const cy = px(s.tondo ? 150 : 128);
  const bollo = { tipo: "cerchio", cx, cy, r: px(62) };
  const titolo = testo(s, { y: cy + px(76), h: px(54), grande: 42 });
  const perche = testo(s, {
    y: cy + px(134),
    h: px(56),
    grande: 19,
    colore: "tenue",
    righe: 2,
    margine: s.tondo ? 40 : MARGINE,
  });
  const hTasto = px(70);
  const wTasto = px(220);
  const tasto = {
    tipo: "riquadro",
    x: Math.round((s.W - wTasto) / 2),
    y: Math.min(cy + px(200), s.H - px(s.tondo ? 54 : 22) - hTasto),
    w: wTasto,
    h: hTasto,
    r: Math.round(hTasto / 2),
  };
  return { bollo, titolo, perche, tasto };
}

/* L'orologio non ancora collegato: cosa fare, sul telefono. */
export function lAbbinamento(s) {
  const { px } = s;
  const cx = Math.round(s.W / 2);
  const cy = px(s.tondo ? 140 : 110);
  const bollo = { tipo: "cerchio", cx, cy, r: px(46) };
  const titolo = testo(s, { y: cy + px(58), h: px(44), grande: 30, colore: "ambra" });
  const spiega = testo(s, {
    y: cy + px(108),
    h: px(120),
    grande: 19,
    righe: 4,
    margine: s.tondo ? 30 : MARGINE,
  });
  return { bollo, titolo, spiega };
}

/* Tutti i pezzi di una pagina, in fila: per le prove e per i disegni. */
export function iPezzi(pagina) {
  const fuori = [];
  const visita = (cosa) => {
    if (!cosa) return;
    if (Array.isArray(cosa)) return cosa.forEach(visita);
    if (typeof cosa === "object" && typeof cosa.tipo === "string") fuori.push(cosa);
    else if (typeof cosa === "object") Object.values(cosa).forEach(visita);
  };
  visita(pagina);
  return fuori;
}
