/* Niente esce dallo schermo, su nessun Amazfit.
 *
 * Non c'e' un orologio su cui guardare, e allora si guarda con i conti: per
 * ogni forma che zeus conosce (`LE_FORME` in `utils/disposizione.js`) si
 * prendono i pezzi di ogni pagina — riquadri, tasti, cerchi, l'arco del
 * dimmer, i testi con le parole vere che ci vanno dentro — e se ne
 * controllano i bordi punto per punto contro lo schermo: il cerchio del
 * tondo, gli angoli arrotondati del quadrato.
 *
 * Per i testi si stima quanto sono larghi: ogni lettera poco piu' di mezza
 * misura (0,58), le maiuscole un po' di piu'. E' una stima prudente per il
 * carattere dell'orologio; dove una parola puo' essere lunga quanto vuole
 * (il nome di una luce) l'orologio la tronca coi puntini, e allora si
 * controlla solo il riquadro.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  iPezzi,
  LE_FORME,
  lAbbinamento,
  laCasa,
  laLista,
  laLuce,
  lEsito,
  loSchermo,
} from "../utils/disposizione.js";

const LARGHEZZA_DI_UNA_LETTERA = 0.58;
const LARGHEZZA_DI_UNA_MAIUSCOLA = 0.68;
const INTERLINEA = 1.28;

/* Quanto e' larga una parola scritta a quella misura, a stima. */
function quantoELarga(parola, grande) {
  let em = 0;
  for (const lettera of parola) {
    em +=
      lettera === lettera.toUpperCase() && /\p{L}/u.test(lettera)
        ? LARGHEZZA_DI_UNA_MAIUSCOLA
        : LARGHEZZA_DI_UNA_LETTERA;
  }
  return em * grande;
}

/* I punti del bordo di un pezzo, da guardare uno per uno. */
function iBordi(pezzo, parola = null) {
  const punti = [];
  const giro = (cx, cy, r, da = 0, a = 360) => {
    for (let g = da; g <= a; g += 7.5) {
      const rad = ((g - 90) * Math.PI) / 180;
      punti.push([cx + r * Math.cos(rad), cy + r * Math.sin(rad)]);
    }
  };
  if (pezzo.tipo === "cerchio") giro(pezzo.cx, pezzo.cy, pezzo.r);
  if (pezzo.tipo === "riquadro") {
    const r = Math.min(pezzo.r || 0, pezzo.w / 2, pezzo.h / 2);
    giro(pezzo.x + r, pezzo.y + r, r, 270, 360);
    giro(pezzo.x + pezzo.w - r, pezzo.y + r, r, 0, 90);
    giro(pezzo.x + pezzo.w - r, pezzo.y + pezzo.h - r, r, 90, 180);
    giro(pezzo.x + r, pezzo.y + pezzo.h - r, r, 180, 270);
  }
  if (pezzo.tipo === "interruttore") {
    punti.push(
      [pezzo.x, pezzo.y],
      [pezzo.x + pezzo.w, pezzo.y],
      [pezzo.x, pezzo.y + pezzo.h],
      [pezzo.x + pezzo.w, pezzo.y + pezzo.h],
    );
  }
  if (pezzo.tipo === "arco") {
    giro(pezzo.cx, pezzo.cy, pezzo.r + pezzo.spessore / 2, pezzo.da, pezzo.a);
  }
  if (pezzo.tipo === "testo") {
    /* La scatola delle lettere, non quella del widget: dove finiscono
     * davvero le parole. Senza parola, tutto il riquadro. */
    const larga = parola == null ? pezzo.w : Math.min(pezzo.w, quantoELarga(parola, pezzo.grande));
    const alta = Math.min(pezzo.h, pezzo.grande * INTERLINEA * pezzo.righe);
    const x = pezzo.allinea === "sinistra" ? pezzo.x : pezzo.x + (pezzo.w - larga) / 2;
    const y = pezzo.y + (pezzo.h - alta) / 2;
    punti.push([x, y], [x + larga, y], [x, y + alta], [x + larga, y + alta]);
  }
  return punti;
}

function tuttoDentro(schermo, pezzo, dove, parola = null) {
  for (const [x, y] of iBordi(pezzo, parola)) {
    assert.ok(
      schermo.dentro(x, y),
      `${dove}: (${Math.round(x)}, ${Math.round(y)}) esce dallo schermo`,
    );
  }
}

/* Una parola che deve starci intera, senza puntini e senza andare a capo
 * oltre le righe che ha. */
function ciSta(pezzo, parola, dove) {
  const righe = Math.ceil(quantoELarga(parola, pezzo.grande) / pezzo.w);
  assert.ok(
    righe <= pezzo.righe,
    `${dove}: «${parola}» vuole ${righe} righe, ne ha ${pezzo.righe}`,
  );
  assert.ok(
    pezzo.grande * INTERLINEA * righe <= pezzo.h + 1,
    `${dove}: «${parola}» non ci sta in altezza`,
  );
}

/* Le lettere, sul piu' piccolo degli orologi, devono ancora leggersi. */
const LETTERE_MINIME = 13;
/* E un tasto si deve poter premere col dito. */
const DITO = 44;

for (const forma of LE_FORME) {
  const schermo = loSchermo(forma);
  const sul = (pagina) => `${forma.nome}, ${pagina}`;

  test(`${forma.nome}: la casa coi quattro riquadri sta tutta nello schermo`, () => {
    const casa = laCasa(schermo);
    tuttoDentro(schermo, casa.titolo, sul("titolo"), "CASA");
    ciSta(casa.titolo, "CASA", sul("titolo"));
    const nomi = ["Luci", "Azioni", "Cancelli", "La casa"];
    const sotto = ["3 accese", "4 pronte", "Tutti chiusi", "Produzione 3,2 kW"];
    casa.riquadri.forEach((r, i) => {
      tuttoDentro(schermo, r.fondo, sul(`riquadro ${nomi[i]}`));
      tuttoDentro(schermo, r.segno, sul(`segno ${nomi[i]}`));
      ciSta(r.nome, nomi[i], sul(`nome ${nomi[i]}`));
      tuttoDentro(schermo, r.nome, sul(`nome ${nomi[i]}`), nomi[i]);
      tuttoDentro(schermo, r.det, sul(`dettaglio ${nomi[i]}`));
      assert.ok(r.fondo.h >= DITO * 1.5 && r.fondo.w >= DITO * 1.5, sul("riquadro troppo piccolo"));
    });
    ciSta(casa.riquadri[1].det, "Tutti chiusi", sul("dettaglio"));
    tuttoDentro(schermo, casa.piede, sul("piede"), "Aggiornato adesso");
    ciSta(casa.piede, "Aggiornato adesso", sul("piede"));
    for (const pezzo of iPezzi(casa)) {
      if (pezzo.tipo === "testo")
        assert.ok(pezzo.grande >= LETTERE_MINIME, sul(`lettere di ${pezzo.grande}`));
    }
  });

  test(`${forma.nome}: le luci, le righe che si vedono senza scorrere stanno nello schermo`, () => {
    const lista = laLista(schermo, 6);
    tuttoDentro(schermo, lista.titolo, sul("titolo"), "CANCELLI");
    ciSta(lista.titolo, "CANCELLI", sul("titolo"));
    tuttoDentro(schermo, lista.sotto, sul("sotto"), "Tocca per farla partire");
    ciSta(lista.sotto, "Tocca per farla partire", sul("sotto"));
    const visibili = lista.righe.filter((riga) => riga.fondo.y + riga.fondo.h <= schermo.H);
    assert.ok(visibili.length >= 2, sul("almeno due righe senza scorrere"));
    for (const [i, riga] of visibili.entries()) {
      tuttoDentro(schermo, riga.fondo, sul(`riga ${i + 1}`));
      tuttoDentro(schermo, riga.segno, sul(`segno della riga ${i + 1}`));
      tuttoDentro(schermo, riga.interruttore, sul(`interruttore della riga ${i + 1}`));
      tuttoDentro(schermo, riga.nome, sul(`nome della riga ${i + 1}`));
      ciSta(riga.det, "Accesa · 75%", sul("dettaglio della riga"));
      assert.ok(riga.fondo.h >= DITO, sul("riga troppo bassa per il dito"));
    }
    /* Il nome di una luce si legge per almeno dieci lettere prima dei
     * puntini: «Lampada lettura» deve stare. */
    ciSta(lista.righe[0].nome, "Lampada lett", sul("nome della riga"));
    /* Le righe sotto lo schermo, portate al centro scorrendo, ci stanno. */
    for (const riga of lista.righe) {
      const su = Math.round(schermo.H / 2 - riga.fondo.h / 2) - riga.fondo.y;
      tuttoDentro(schermo, { ...riga.fondo, y: riga.fondo.y + su }, sul("riga scorsa al centro"));
    }
  });

  test(`${forma.nome}: le azioni senza interruttore stanno nello schermo`, () => {
    const lista = laLista(schermo, 5, { conInterruttore: false, conDettaglio: false });
    for (const riga of lista.righe.filter((uno) => uno.fondo.y + uno.fondo.h <= schermo.H)) {
      tuttoDentro(schermo, riga.fondo, sul("azione"));
      ciSta(riga.nome, "Arrivo a casa", sul("nome dell'azione"));
    }
  });

  test(`${forma.nome}: la luce col dimmer sta nello schermo`, () => {
    const luce = laLuce(schermo);
    tuttoDentro(schermo, luce.arco, sul("arco"));
    tuttoDentro(schermo, luce.nome, sul("nome"));
    ciSta(luce.nome, "Faretti soggiorno", sul("nome della luce"));
    ciSta(luce.cifra, "100%", sul("numero"));
    tuttoDentro(schermo, luce.cifra, sul("numero"), "100%");
    ciSta(luce.etichetta, "LUMINOSITÀ", sul("etichetta"));
    for (const tasto of [luce.meno, luce.piu, luce.tasto]) {
      tuttoDentro(schermo, tasto, sul("tasto"));
      assert.ok(tasto.h >= DITO, sul("tasto troppo piccolo"));
    }
    /* Meno e piu' stanno dentro l'arco, e non sotto il numero. */
    const r = luce.arco.r - luce.arco.spessore / 2;
    for (const tasto of [luce.meno, luce.piu]) {
      const cx = tasto.x + tasto.w / 2;
      const cy = tasto.y + tasto.h / 2;
      assert.ok(
        Math.hypot(cx - luce.arco.cx, cy - luce.arco.cy) + tasto.w / 2 <= r,
        sul("tasto sull'arco"),
      );
      assert.ok(tasto.y >= luce.etichetta.y + luce.etichetta.h - 1, sul("tasto sull'etichetta"));
    }
    assert.ok(luce.tasto.y >= luce.meno.y + luce.meno.h, sul("Spegni sopra meno e piu'"));
    /* Il numero sta dentro l'arco; il nome anche, sul tondo, e sul quadrato
     * sopra l'arco, senza toccarlo. */
    if (!schermo.tondo) {
      assert.ok(
        luce.nome.y + luce.nome.h <= luce.arco.cy - luce.arco.r - luce.arco.spessore / 2,
        sul("nome sull'arco"),
      );
    }
    for (const [pezzo, parola] of [
      ...(schermo.tondo ? [[luce.nome, "Faretti soggiorno"]] : []),
      [luce.cifra, "100%"],
    ]) {
      for (const [x, y] of iBordi(pezzo, parola)) {
        assert.ok(
          Math.hypot(x - luce.arco.cx, y - luce.arco.cy) <= r,
          sul(`«${parola}» sull'arco`),
        );
      }
    }
  });

  test(`${forma.nome}: «Fatto», «Non è partito» e il collegamento stanno nello schermo`, () => {
    const esito = lEsito(schermo);
    tuttoDentro(schermo, esito.bollo, sul("bollo"));
    for (const parola of ["Fatto", "Non è partito"]) {
      ciSta(esito.titolo, parola, sul("esito"));
      tuttoDentro(schermo, esito.titolo, sul("esito"), parola);
    }
    ciSta(esito.perche, "La casa non risponde. Il telefono è vicino?", sul("perche'"));
    tuttoDentro(schermo, esito.perche, sul("perche'"));
    tuttoDentro(schermo, esito.tasto, sul("Riprova"));
    assert.ok(esito.tasto.y >= esito.perche.y + esito.perche.h, sul("Riprova sul perche'"));

    const abbina = lAbbinamento(schermo);
    tuttoDentro(schermo, abbina.bollo, sul("bollo del collegamento"));
    ciSta(abbina.titolo, "Collega la casa", sul("titolo del collegamento"));
    tuttoDentro(schermo, abbina.titolo, sul("titolo del collegamento"), "Collega la casa");
    ciSta(
      abbina.spiega,
      "Sul telefono apri Zepp › GdAHome e scrivi il codice della scheda GdAHome in Home Assistant.",
      sul("spiegazione"),
    );
    tuttoDentro(schermo, abbina.spiega, sul("spiegazione"));
  });
}

test("le forme sono quelle che zeus costruisce, e i quadrati hanno gli angoli", () => {
  assert.deepEqual(
    LE_FORME.map((forma) => `${forma.larghezza}x${forma.altezza}`),
    ["360x360", "416x416", "454x454", "466x466", "480x480", "320x380", "390x450", "432x514"],
  );
  for (const forma of LE_FORME.filter((uno) => !uno.tondo)) assert.ok(forma.angolo > 0);
});
