/* Il codice a quadretti, scritto qui.
 *
 * ─── Perche' un QR ────────────────────────────────────────────────────────
 *
 * Otto lettere si battono in venti secondi, e in quei venti secondi si
 * sbagliano. Un QR si inquadra in tre, e — la parte che conta — puo' portarne
 * molte di piu': il codice lungo che ci sta dentro non lo indovina nessuno,
 * mentre otto lettere, se qualcuno si mettesse in mezzo mentre un telefono
 * nuovo si abbina, sarebbero poche.
 *
 * ─── Perche' scritto a mano ───────────────────────────────────────────────
 *
 * Perche' l'add-on non ha dipendenze, e la ragione non e' l'orgoglio: e' che
 * il Supervisor lo costruisce sul posto, su un Raspberry, e ogni pacchetto in
 * piu' e' una cosa che un giorno non si scarica, non si compila, o cambia
 * sotto ai piedi. La presa WebSocket e la cifratura sono gia' scritte qui;
 * questo e' lo stesso mestiere.
 *
 * ─── Come si fa a sapere che e' giusto ────────────────────────────────────
 *
 * Un encoder QR sbagliato **non si vede**: fa un quadrato che sembra un QR e
 * che nessun telefono legge. Quindi non ci si fida di quello che sembra:
 * le tabelle qui sotto sono state **estratte** da un'implementazione di
 * riferimento invece che ricopiate — e' li' che si sbaglia — e le prove
 * confrontano la matrice, quadretto per quadretto, con quella che produce
 * quella stessa implementazione.
 *
 * ─── Cosa fa, e cosa non fa ───────────────────────────────────────────────
 *
 * Solo quello che serve: modo byte, correzione **M**, versioni da 1 a 15.
 * Sono fino a 412 byte, e quello che ci mettiamo dentro ne occupa un
 * centinaio. Le altre trentacinque versioni e gli altri tre modi sarebbero
 * codice che non gira mai — cioe' codice che non si accorge di essere rotto.
 */

/* Da `rs_blocks(versione, M)`: per ogni blocco, [codeword totali, di dati]. */
const BLOCCHI = {
  1: [[26, 16]],
  2: [[44, 28]],
  3: [[70, 44]],
  4: [
    [50, 32],
    [50, 32],
  ],
  5: [
    [67, 43],
    [67, 43],
  ],
  6: [
    [43, 27],
    [43, 27],
    [43, 27],
    [43, 27],
  ],
  7: [
    [49, 31],
    [49, 31],
    [49, 31],
    [49, 31],
  ],
  8: [
    [60, 38],
    [60, 38],
    [61, 39],
    [61, 39],
  ],
  9: [
    [58, 36],
    [58, 36],
    [58, 36],
    [59, 37],
    [59, 37],
  ],
  10: [
    [69, 43],
    [69, 43],
    [69, 43],
    [69, 43],
    [70, 44],
  ],
  11: [
    [80, 50],
    [81, 51],
    [81, 51],
    [81, 51],
    [81, 51],
  ],
  12: [
    [58, 36],
    [58, 36],
    [58, 36],
    [58, 36],
    [58, 36],
    [58, 36],
    [59, 37],
    [59, 37],
  ],
  13: [
    [59, 37],
    [59, 37],
    [59, 37],
    [59, 37],
    [59, 37],
    [59, 37],
    [59, 37],
    [59, 37],
    [60, 38],
  ],
  14: [
    [64, 40],
    [64, 40],
    [64, 40],
    [64, 40],
    [65, 41],
    [65, 41],
    [65, 41],
    [65, 41],
    [65, 41],
  ],
  15: [
    [65, 41],
    [65, 41],
    [65, 41],
    [65, 41],
    [65, 41],
    [66, 42],
    [66, 42],
    [66, 42],
    [66, 42],
    [66, 42],
  ],
};

/* Dove vanno i quadrati di allineamento, per versione. */
const ALLINEAMENTI = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
  11: [6, 30, 54],
  12: [6, 32, 58],
  13: [6, 34, 62],
  14: [6, 26, 46, 66],
  15: [6, 26, 48, 70],
};

const VERSIONE_MASSIMA = 15;

/* ─── Il campo di Galois ─────────────────────────────────────────────────── */

const ESPONENTI = new Uint8Array(256);
const LOGARITMI = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    ESPONENTI[i] = x;
    LOGARITMI[x] = i;
    x <<= 1;
    /* Il polinomio primitivo del QR: quando si sfora, si riporta. */
    if (x & 0x100) x ^= 0x11d;
  }
}

const perGalois = (a, b) =>
  a === 0 || b === 0 ? 0 : ESPONENTI[(LOGARITMI[a] + LOGARITMI[b]) % 255];

/* Il polinomio che genera i codici di correzione: (x-1)(x-a)(x-a²)… */
function generatore(quanti) {
  let poli = [1];
  for (let i = 0; i < quanti; i += 1) {
    const nuovo = new Array(poli.length + 1).fill(0);
    for (let j = 0; j < poli.length; j += 1) {
      nuovo[j] ^= poli[j];
      nuovo[j + 1] ^= perGalois(poli[j], ESPONENTI[i]);
    }
    poli = nuovo;
  }
  return poli;
}

/* I byte di correzione di un blocco: il resto della divisione. */
function correzione(dati, quanti) {
  const gen = generatore(quanti);
  const resto = new Array(dati.length + quanti).fill(0);
  for (let i = 0; i < dati.length; i += 1) resto[i] = dati[i];

  for (let i = 0; i < dati.length; i += 1) {
    const primo = resto[i];
    if (primo === 0) continue;
    for (let j = 0; j < gen.length; j += 1) {
      resto[i + j] ^= perGalois(gen[j], primo);
    }
  }
  return resto.slice(dati.length);
}

/* ─── Il BCH delle informazioni di servizio ──────────────────────────────── */

/* Quanti bit ci vogliono per scrivere un numero. */
function quantiBit(valore) {
  let quanti = 0;
  while (valore) {
    quanti += 1;
    valore >>>= 1;
  }
  return quanti;
}

/* Il resto della divisione fra polinomi a un bit per coefficiente: si allinea
 * il generatore col bit piu' alto che e' rimasto e si sottrae, finche' non
 * resta qualcosa di piu' corto del generatore. */
function bch(valore, generatore_) {
  const lungo = quantiBit(generatore_);
  let resto = valore;
  while (quantiBit(resto) >= lungo) {
    resto ^= generatore_ << (quantiBit(resto) - lungo);
  }
  return resto;
}

function informazioneDelFormato(maschera) {
  /* Correzione M vuol dire `00`, e poi i tre bit della maschera. */
  const dati = (0b00 << 3) | maschera;
  const resto = bch(dati << 10, 0x537);
  return ((dati << 10) | resto) ^ 0x5412;
}

function informazioneDellaVersione(versione) {
  const resto = bch(versione << 12, 0x1f25);
  return (versione << 12) | resto;
}

/* ─── Quanto ci sta ──────────────────────────────────────────────────────── */

const quantiDati = (versione) => BLOCCHI[versione].reduce((somma, [, dati]) => somma + dati, 0);

const bitDelConteggio = (versione) => (versione <= 9 ? 8 : 16);

/* La versione piu' piccola in cui ci sta. */
function versionePer(quantiByte) {
  for (let v = 1; v <= VERSIONE_MASSIMA; v += 1) {
    const disponibili = quantiDati(v) * 8 - 4 - bitDelConteggio(v);
    if (quantiByte * 8 <= disponibili) return v;
  }
  throw new TroppoLungo(
    `${quantiByte} byte non ci stanno in un QR fino alla versione ${VERSIONE_MASSIMA}`,
  );
}

export class TroppoLungo extends Error {}

/* ─── I dati ─────────────────────────────────────────────────────────────── */

function codewordDeiDati(byte, versione) {
  const bit = [];
  const scrivi = (valore, quanti) => {
    for (let i = quanti - 1; i >= 0; i -= 1) bit.push((valore >> i) & 1);
  };

  scrivi(0b0100, 4); /* modo byte */
  scrivi(byte.length, bitDelConteggio(versione));
  for (const uno of byte) scrivi(uno, 8);

  const quante = quantiDati(versione);
  /* Il terminatore: fino a quattro zeri, o meno se non c'e' posto. */
  const avanza = quante * 8 - bit.length;
  scrivi(0, Math.min(4, avanza));
  while (bit.length % 8 !== 0) bit.push(0);

  const codeword = [];
  for (let i = 0; i < bit.length; i += 8) {
    let byte_ = 0;
    for (let j = 0; j < 8; j += 1) byte_ = (byte_ << 1) | bit[i + j];
    codeword.push(byte_);
  }
  /* E poi si riempie, alternando questi due, che sono quelli che dice la
   * norma: due valori qualunque farebbero un QR che si legge lo stesso, ma
   * non sarebbe piu' quello che si aspetta chi lo legge. */
  const tappi = [0xec, 0x11];
  for (let i = 0; codeword.length < quante; i += 1) codeword.push(tappi[i % 2]);
  return codeword;
}

/* I blocchi si mescolano: cosi' un graffio che rovina una zona rovina un
 * pezzetto di ognuno, invece di distruggerne uno per intero. */
function tutteLeCodeword(byte, versione) {
  const dati = codewordDeiDati(byte, versione);
  const blocchi = [];
  let da = 0;
  for (const [totale, quantiDati_] of BLOCCHI[versione]) {
    const suoi = dati.slice(da, da + quantiDati_);
    da += quantiDati_;
    blocchi.push({ dati: suoi, correzione: correzione(suoi, totale - quantiDati_) });
  }

  const fuori = [];
  const piuLunghi = Math.max(...blocchi.map((uno) => uno.dati.length));
  for (let i = 0; i < piuLunghi; i += 1) {
    for (const blocco of blocchi) {
      if (i < blocco.dati.length) fuori.push(blocco.dati[i]);
    }
  }
  const piuCorrezione = Math.max(...blocchi.map((uno) => uno.correzione.length));
  for (let i = 0; i < piuCorrezione; i += 1) {
    for (const blocco of blocchi) {
      if (i < blocco.correzione.length) fuori.push(blocco.correzione[i]);
    }
  }
  return fuori;
}

/* ─── La matrice ─────────────────────────────────────────────────────────── */

const LE_MASCHERE = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (_i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

function matriceVuota(lato) {
  return {
    quadretti: Array.from({ length: lato }, () => new Array(lato).fill(null)),
    servizio: Array.from({ length: lato }, () => new Array(lato).fill(false)),
    lato,
  };
}

function metti(m, riga, colonna, nero, diServizio = true) {
  m.quadretti[riga][colonna] = nero;
  if (diServizio) m.servizio[riga][colonna] = true;
}

function disegnaIlServizio(m, versione) {
  const lato = m.lato;

  /* I tre quadratoni negli angoli, con la loro cornice bianca. */
  const mirino = (riga, colonna) => {
    for (let i = -1; i <= 7; i += 1) {
      for (let j = -1; j <= 7; j += 1) {
        const r = riga + i;
        const c = colonna + j;
        if (r < 0 || r >= lato || c < 0 || c >= lato) continue;
        const dentro =
          (i >= 0 && i <= 6 && (j === 0 || j === 6)) ||
          (j >= 0 && j <= 6 && (i === 0 || i === 6)) ||
          (i >= 2 && i <= 4 && j >= 2 && j <= 4);
        metti(m, r, c, dentro);
      }
    }
  };
  mirino(0, 0);
  mirino(0, lato - 7);
  mirino(lato - 7, 0);

  /* I due righelli tratteggiati. */
  for (let i = 8; i < lato - 8; i += 1) {
    metti(m, 6, i, i % 2 === 0);
    metti(m, i, 6, i % 2 === 0);
  }

  /* I quadratini di allineamento, tranne dove pesterebbero i mirini. */
  const dove = ALLINEAMENTI[versione];
  for (const riga of dove) {
    for (const colonna of dove) {
      const suUnMirino =
        (riga <= 8 && colonna <= 8) ||
        (riga <= 8 && colonna >= lato - 9) ||
        (riga >= lato - 9 && colonna <= 8);
      if (suUnMirino) continue;
      for (let i = -2; i <= 2; i += 1) {
        for (let j = -2; j <= 2; j += 1) {
          metti(m, riga + i, colonna + j, Math.max(Math.abs(i), Math.abs(j)) !== 1);
        }
      }
    }
  }

  /* I posti dove andranno le informazioni di servizio: si segnano come presi
   * — cosi' i dati non ci finiscono sopra e la maschera non li tocca — ma si
   * lasciano bianchi. Ci si scrive dopo, a maschera scelta, perche' quello che
   * ci va dentro dipende proprio dalla maschera. */
  for (let i = 0; i <= 8; i += 1) {
    if (i !== 6) {
      metti(m, 8, i, false);
      metti(m, i, 8, false);
    }
  }
  for (let i = 0; i < 8; i += 1) {
    metti(m, 8, lato - 1 - i, false);
    metti(m, lato - 1 - i, 8, false);
  }

  if (versione >= 7) {
    for (let i = 0; i < 6; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        metti(m, i, lato - 11 + j, false);
        metti(m, lato - 11 + j, i, false);
      }
    }
  }
}

function scriviLaVersione(m, versione) {
  if (versione < 7) return;
  const bit = informazioneDellaVersione(versione);
  const lato = m.lato;
  for (let i = 0; i < 18; i += 1) {
    const nero = ((bit >> i) & 1) === 1;
    const riga = Math.floor(i / 3);
    const colonna = (i % 3) + lato - 11;
    m.quadretti[riga][colonna] = nero;
    m.quadretti[colonna][riga] = nero;
  }
}

function scriviIlFormato(m, maschera) {
  const bit = informazioneDelFormato(maschera);
  const lato = m.lato;

  /* Il quadretto sempre nero: uno solo, in mezzo a niente, e c'e' sempre. */
  m.quadretti[lato - 8][8] = true;

  for (let i = 0; i < 15; i += 1) {
    const nero = ((bit >> i) & 1) === 1;

    /* La prima copia, intorno al mirino in alto a sinistra. */
    if (i < 6) m.quadretti[i][8] = nero;
    else if (i < 8) m.quadretti[i + 1][8] = nero;
    else if (i === 8) m.quadretti[8][7] = nero;
    else m.quadretti[8][14 - i] = nero;

    /* La seconda, spezzata fra gli altri due: se l'angolo si rovina, questa
     * resta. */
    if (i < 8) m.quadretti[8][lato - 1 - i] = nero;
    else m.quadretti[lato - 15 + i][8] = nero;
  }
}

/* I dati salgono e scendono a serpentina, due colonne per volta, da destra.
 *
 * Alla fine, in certe versioni, avanzano tre o sette quadretti che nessuna
 * codeword riempie: restano bianchi qui e poi la maschera se li prende come
 * tutti gli altri. Non e' una svista da riempire — e' quello che dice la
 * norma, e chi legge quei quadretti non li guarda nemmeno. */
function scriviIDati(m, codeword) {
  const lato = m.lato;
  const bit = [];
  for (const byte of codeword) {
    for (let i = 7; i >= 0; i -= 1) bit.push((byte >> i) & 1);
  }

  let quale = 0;
  let versoLAlto = true;
  for (let colonna = lato - 1; colonna > 0; colonna -= 2) {
    /* La colonna del righello verticale non conta come colonna. */
    if (colonna === 6) colonna -= 1;
    for (let passo = 0; passo < lato; passo += 1) {
      const riga = versoLAlto ? lato - 1 - passo : passo;
      for (let quanto = 0; quanto < 2; quanto += 1) {
        const c = colonna - quanto;
        if (m.servizio[riga][c]) continue;
        m.quadretti[riga][c] = quale < bit.length ? bit[quale] === 1 : false;
        quale += 1;
      }
    }
    versoLAlto = !versoLAlto;
  }
}

function mascherata(m, quale) {
  const lato = m.lato;
  const fuori = matriceVuota(lato);
  for (let i = 0; i < lato; i += 1) {
    for (let j = 0; j < lato; j += 1) {
      fuori.servizio[i][j] = m.servizio[i][j];
      const nero = m.quadretti[i][j];
      fuori.quadretti[i][j] = m.servizio[i][j] || !LE_MASCHERE[quale](i, j) ? nero : !nero;
    }
  }
  return fuori;
}

/* Quanto e' brutta: quattro regole, e vince la meno brutta. Non e' estetica —
 * un QR con troppe righe uguali o troppo sbilanciato si legge male. */
function bruttezza(m) {
  const lato = m.lato;
  const q = m.quadretti;
  let punti = 0;

  /* Uno: file di cinque o piu' dello stesso colore. */
  for (let i = 0; i < lato; i += 1) {
    for (const perRiga of [true, false]) {
      let quanti = 1;
      for (let j = 1; j < lato; j += 1) {
        const questo = perRiga ? q[i][j] : q[j][i];
        const prima = perRiga ? q[i][j - 1] : q[j - 1][i];
        if (questo === prima) {
          quanti += 1;
        } else {
          if (quanti >= 5) punti += quanti - 2;
          quanti = 1;
        }
      }
      if (quanti >= 5) punti += quanti - 2;
    }
  }

  /* Due: quadrati due per due dello stesso colore. */
  for (let i = 0; i < lato - 1; i += 1) {
    for (let j = 0; j < lato - 1; j += 1) {
      const a = q[i][j];
      if (a === q[i][j + 1] && a === q[i + 1][j] && a === q[i + 1][j + 1]) punti += 3;
    }
  }

  /* Tre: disegni che somigliano a un mirino — scuro, chiaro, tre scuri,
   * chiaro, scuro — con quattro chiari attaccati da una parte. Chi legge i
   * mirini li cerca esattamente cosi', e trovarne uno finto in mezzo ai dati
   * lo manda fuori strada.
   *
   * Si guarda una finestra di undici e si confrontano due disegni, quello coi
   * quattro chiari prima e quello coi quattro chiari dopo. Contarli a parte
   * non e' pignoleria: un disegno che ha i quattro chiari da tutte e due le
   * parti vale ottanta, e chi conta quaranta una volta sola sceglie ogni
   * tanto una maschera diversa. */
  const MIRINO_COI_CHIARI_PRIMA = [
    false,
    false,
    false,
    false,
    true,
    false,
    true,
    true,
    true,
    false,
    true,
  ];
  const MIRINO_COI_CHIARI_DOPO = [
    true,
    false,
    true,
    true,
    true,
    false,
    true,
    false,
    false,
    false,
    false,
  ];
  const somiglia = (prendi) => {
    for (let i = 0; i + 11 <= lato; i += 1) {
      for (const disegno of [MIRINO_COI_CHIARI_PRIMA, MIRINO_COI_CHIARI_DOPO]) {
        let uguale = true;
        for (let j = 0; j < 11; j += 1) {
          if (prendi(i + j) !== disegno[j]) {
            uguale = false;
            break;
          }
        }
        if (uguale) punti += 40;
      }
    }
  };
  for (let i = 0; i < lato; i += 1) {
    somiglia((j) => q[i][j]);
    somiglia((j) => q[j][i]);
  }

  /* Quattro: troppo nero o troppo bianco. */
  let neri = 0;
  for (let i = 0; i < lato; i += 1) {
    for (let j = 0; j < lato; j += 1) if (q[i][j]) neri += 1;
  }
  const percento = (neri * 100) / (lato * lato);
  punti += Math.floor(Math.abs(percento - 50) / 5) * 10;

  return punti;
}

/* Si provano tutte e otto e si tiene la meno brutta.
 *
 * Si conta sul disegno **senza** le informazioni di servizio: formato,
 * versione e quadretto sempre nero sono ancora bianchi, e ci si scrive dopo.
 * Non e' una scorciatoia. La norma non dice se la conta vada fatta sul
 * disegno finito o su quello ancora nudo, e le implementazioni fanno la
 * seconda; la differenza cambia la maschera scelta in qualche caso — un QR
 * buono uguale, ma diverso. Fra «buono uguale» e «identico al riferimento» si
 * sceglie identico, perche' identico e' l'unica cosa che una prova sa
 * guardare.
 */
function menoBrutta(base) {
  let scelta = 0;
  let suaBruttezza = Infinity;
  for (let quale = 0; quale < 8; quale += 1) {
    const quanto = bruttezza(mascherata(base, quale));
    if (quanto < suaBruttezza) {
      suaBruttezza = quanto;
      scelta = quale;
    }
  }
  return scelta;
}

/* ─── Quello che si usa da fuori ─────────────────────────────────────────── */

/* Torna la matrice: `true` e' un quadretto nero.
 *
 * `maschera` serve solo alle prove: fissarla permette di confrontare quadretto
 * per quadretto con l'implementazione di riferimento tutte e otto le maschere,
 * invece della sola che la bruttezza sceglie. */
export function qr(testo, { maschera = null } = {}) {
  const byte = [...Buffer.from(String(testo), "utf8")];
  const versione = versionePer(byte.length);
  const lato = versione * 4 + 17;

  const base = matriceVuota(lato);
  disegnaIlServizio(base, versione);
  scriviIDati(base, tutteLeCodeword(byte, versione));

  const scelta = maschera === null ? menoBrutta(base) : maschera;
  const fuori = mascherata(base, scelta);
  scriviLaVersione(fuori, versione);
  scriviIlFormato(fuori, scelta);
  return fuori.quadretti;
}

/* Il titolo finisce dentro un attributo, e da li' potrebbe uscirne. Non
 * succede — quello che ci mettiamo lo scriviamo noi — ma una funzione che
 * costruisce del markup si difende da sola, cosi' resta vera anche il giorno
 * che qualcuno le passa qualcos'altro. */
const perUnAttributo = (testo) =>
  String(testo)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* Lo stesso, disegnato.
 *
 * Un solo tracciato per tutti i quadretti neri invece di mille rettangoli:
 * una pagina con dentro mille elementi il browser la disegna piano, e questo
 * QR sta su una scheda che si ridisegna a ogni battito.
 */
export function qrInSvg(testo, { bordo = 4, titolo = "Codice di abbinamento" } = {}) {
  const quadretti = qr(testo);
  const lato = quadretti.length + bordo * 2;

  const pezzi = [];
  for (let i = 0; i < quadretti.length; i += 1) {
    for (let j = 0; j < quadretti.length; j += 1) {
      if (quadretti[i][j]) pezzi.push(`M${j + bordo} ${i + bordo}h1v1h-1z`);
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lato} ${lato}"`,
    ` role="img" aria-label="${perUnAttributo(titolo)}" shape-rendering="crispEdges">`,
    `<rect width="${lato}" height="${lato}" fill="#fff"/>`,
    `<path d="${pezzi.join("")}" fill="#000"/>`,
    "</svg>",
  ].join("");
}
