/* La foto di una telecamera, rimpicciolita qui in casa.
 *
 * Dal campo, ancora: «Movimento · Ingresso» col riquadro dell'ora e niente
 * foto, su iPhone e su Android, con le telecamere 4K. Alla foto si chiede
 * `camera_proxy/<entita'>?width=1280`, ma la larghezza Home Assistant la
 * rispetta solo quando sa farlo: molte integrazioni la ignorano e mandano
 * l'istantanea intera, 3840 punti e uno o due megabyte, a ogni misura chiesta.
 * Il centralino ne tiene trecento KB, e la notifica partiva senza foto.
 *
 * Qui la si rimpicciolisce da soli, col JPEG di libjpeg-turbo (`djpeg` e
 * `cjpeg`, il pacchetto `libjpeg-turbo-utils` dell'add-on): `djpeg -scale`
 * la apre gia' ridotta di un ottavo alla volta — non decodifica tutti gli
 * otto milioni di punti per buttarne via sette — e `cjpeg` la richiude. Su un
 * Raspberry e' una frazione di secondo.
 *
 * Senza i due programmi (sul banco, o un add-on vecchio) torna `null`, e si
 * va avanti come prima, con le misure chieste a Home Assistant. */

import { spawn } from "node:child_process";

/* Fin dove si stringe: oltre i 1280 punti in una notifica non si vede niente
 * di piu', e sotto i 480 non si riconosce piu' chi c'e'. */
const LARGHEZZE = Object.freeze([1280, 960, 640, 480]);
const QUALITA = Object.freeze([78, 65]);

/* Per un programma che non risponde: la notifica non aspetta per sempre. */
const ATTESA = 8000;

/* Larghezza e altezza di un JPEG, lette dall'intestazione (SOFn). `null` se
 * non e' un JPEG o non si trova. */
export function misureDelJpeg(byte) {
  if (!Buffer.isBuffer(byte) || byte.length < 4 || byte[0] !== 0xff || byte[1] !== 0xd8)
    return null;
  let i = 2;
  while (i + 9 < byte.length) {
    if (byte[i] !== 0xff) {
      i += 1;
      continue;
    }
    const segno = byte[i + 1];
    /* Riempitivi e segni senza lunghezza. */
    if (segno === 0xff) {
      i += 1;
      continue;
    }
    if (segno === 0x01 || (segno >= 0xd0 && segno <= 0xd9)) {
      i += 2;
      continue;
    }
    const lungo = byte.readUInt16BE(i + 2);
    const cornice =
      segno >= 0xc0 && segno <= 0xcf && segno !== 0xc4 && segno !== 0xc8 && segno !== 0xcc;
    if (cornice) {
      const alta = byte.readUInt16BE(i + 5);
      const larga = byte.readUInt16BE(i + 7);
      return larga && alta ? { larga, alta } : null;
    }
    i += 2 + lungo;
  }
  return null;
}

/* `djpeg -scale m/8 | cjpeg -quality q`, coi byte dentro e fuori dai tubi.
 * `null` per qualunque cosa vada storta. */
function riduci(byte, { ottavi, qualita, avvia = spawn }) {
  return new Promise((risolvi) => {
    let finito = false;
    const fine = (valore) => {
      if (finito) return;
      finito = true;
      clearTimeout(scade);
      for (const p of [apri, chiudi]) {
        try {
          p?.kill?.();
        } catch (_errore) {
          /* Gia' finito. */
        }
      }
      risolvi(valore);
    };
    let apri;
    let chiudi;
    const scade = setTimeout(() => fine(null), ATTESA);
    scade.unref?.();
    try {
      apri = avvia("djpeg", ["-scale", `${ottavi}/8`, "-pnm"], {
        stdio: ["pipe", "pipe", "ignore"],
      });
      chiudi = avvia("cjpeg", ["-quality", String(qualita), "-optimize"], {
        stdio: ["pipe", "pipe", "ignore"],
      });
    } catch (_errore) {
      fine(null);
      return;
    }
    const pezzi = [];
    for (const p of [apri, chiudi]) {
      p.on("error", () => fine(null));
      p.stdin?.on?.("error", () => fine(null));
    }
    apri.stdout.pipe(chiudi.stdin);
    chiudi.stdout.on("data", (pezzo) => pezzi.push(pezzo));
    chiudi.on("close", (codice) =>
      fine(codice === 0 && pezzi.length ? Buffer.concat(pezzi) : null),
    );
    apri.stdin.end(byte);
  });
}

/* La foto sotto i [massimo] byte, larga al piu' 1280 punti: la piu' grande
 * che ci sta. `null` se non e' un JPEG, se non ci sta nemmeno piccola, o se i
 * programmi non ci sono. Il mini video (`i-filmati.js`) chiede [larghezze]
 * piu' piccole: i suoi fotogrammi sono venti, non uno. */
export async function rimpicciolisci(byte, { massimo, avvia = spawn, larghezze = LARGHEZZE } = {}) {
  const misure = misureDelJpeg(byte);
  if (!misure) return null;
  for (const larghezza of larghezze) {
    /* djpeg riduce di ottavi: il piu' grande che non supera la larghezza. */
    const ottavi = Math.max(1, Math.min(8, Math.floor((8 * larghezza) / misure.larga)));
    for (const qualita of QUALITA) {
      const fuori = await riduci(byte, { ottavi, qualita, avvia });
      /* Un programma che manca risponde subito di no: inutile provare oltre. */
      if (fuori === null) return null;
      if (fuori.length <= massimo) return fuori;
    }
  }
  return null;
}
