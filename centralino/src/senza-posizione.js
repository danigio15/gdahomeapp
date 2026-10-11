/* Una foto JPEG senza le note che dicono dove e' stata fatta.
 *
 * Gli allegati delle segnalazioni si committano in una repository pubblica
 * (`segnalazioni.js`, `mettiFile`) e restano nella storia di git anche dopo
 * la chiusura. L'app le note le toglie gia' da sola
 * (`app/lib/casa/senza_posizione.dart`); qui si rifa' lo stesso per le foto
 * che arrivano da un'app vecchia o dalla finestra della plancia, che non lo
 * fanno.
 *
 * Solo il JPEG, che e' quello che fanno i telefoni, e solo togliendo pezzi
 * interi: via i segmenti APP1 (EXIF e XMP), APP13 (IPTC) e i commenti; i
 * punti restano byte per byte come sono. Dell'EXIF si salva l'orientamento,
 * rimesso in un EXIF nuovo di una voce sola: senza, una foto fatta col
 * telefono in piedi si vedrebbe coricata.
 *
 * Una foto che non torna esce com'e' entrata: meglio la foto con le note che
 * nessuna foto. */

const ascii = (byte, da, quanti) => String.fromCharCode(...byte.subarray(da, da + quanti));

/* L'orientamento (la voce 0x0112) dal primo elenco dell'EXIF, che comincia a
 * `tiff` dentro `segmento`. `null` se non c'e' o non torna. */
function orientamentoDellExif(segmento, tiff) {
  const ordine = ascii(segmento, tiff, 2);
  if (ordine !== "II" && ordine !== "MM") return null;
  const piccolo = ordine === "II";
  const dati = new DataView(segmento.buffer, segmento.byteOffset, segmento.byteLength);
  const elenco = tiff + dati.getUint32(tiff + 4, piccolo);
  const voci = dati.getUint16(elenco, piccolo);
  for (let n = 0; n < voci; n += 1) {
    const voce = elenco + 2 + n * 12;
    if (dati.getUint16(voce, piccolo) !== 0x0112) continue;
    const valore = dati.getUint16(voce + 8, piccolo);
    return valore >= 1 && valore <= 8 ? valore : null;
  }
  return null;
}

/* Un EXIF di una voce sola: l'orientamento. Big-endian, 34 byte. */
export function exifConLOrientamento(orientamento) {
  return Uint8Array.from([
    0xff, 0xe1, 0x00, 0x22,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // «Exif»
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // «MM», 42, il primo elenco
    0x00, 0x01, // una voce
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, // 0x0112, SHORT, 1
    0x00, orientamento, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, // nessun altro elenco
  ]); // prettier-ignore
}

function pulisci(byte) {
  const pezzi = [byte.subarray(0, 2)];
  let orientamento = 1;
  let tolto = false;
  let exifMesso = false;
  const metti = () => {
    if (exifMesso || orientamento === 1) return;
    pezzi.push(exifConLOrientamento(orientamento));
    exifMesso = true;
  };
  let i = 2;
  while (i + 1 < byte.length) {
    if (byte[i] !== 0xff) return null;
    const segno = byte[i + 1];
    /* Riempitivo: piu' 0xFF di fila prima del segno. */
    if (segno === 0xff) {
      i += 1;
      continue;
    }
    /* L'inizio dei punti, o la fine: da qui in poi si copia e basta. */
    if (segno === 0xda || segno === 0xd9) {
      metti();
      pezzi.push(byte.subarray(i));
      return tolto ? pezzi : null;
    }
    if (segno === 0x01 || (segno >= 0xd0 && segno <= 0xd7)) {
      pezzi.push(byte.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > byte.length) return null;
    const lungo = (byte[i + 2] << 8) | byte[i + 3];
    const fine = i + 2 + lungo;
    if (lungo < 2 || fine > byte.length) return null;
    const segmento = byte.subarray(i, fine);
    if (segno === 0xe1) {
      /* APP1: EXIF o XMP. Dell'EXIF si tiene a mente l'orientamento. */
      if (lungo >= 8 && ascii(segmento, 4, 6) === "Exif\0\0") {
        orientamento = orientamentoDellExif(segmento, 10) ?? orientamento;
      }
      tolto = true;
    } else if (segno === 0xed || segno === 0xfe) {
      /* APP13 (IPTC, che puo' dire il posto) e i commenti. */
      tolto = true;
    } else {
      /* APP0 (JFIF), APP2 (i colori), APP14 (Adobe), le tabelle: servono a
       * vedere la foto, si tengono. L'EXIF nuovo va dopo il JFIF. */
      if (segno !== 0xe0) metti();
      pezzi.push(segmento);
    }
    i = fine;
  }
  return null;
}

/* Lo stesso JPEG senza EXIF (tranne l'orientamento), XMP, IPTC e commenti.
 * Se non c'e' niente da togliere, o il file non torna, torna `byte` stesso. */
export function jpegSenzaPosizione(byte) {
  if (!(byte instanceof Uint8Array) || byte.length < 4) return byte;
  if (byte[0] !== 0xff || byte[1] !== 0xd8) return byte;
  let pezzi;
  try {
    pezzi = pulisci(byte);
  } catch (_errore) {
    /* Un elenco che punta fuori dal file: com'e'. */
    return byte;
  }
  if (!pezzi) return byte;
  const fuori = new Uint8Array(pezzi.reduce((somma, uno) => somma + uno.length, 0));
  let dove = 0;
  for (const uno of pezzi) {
    fuori.set(uno, dove);
    dove += uno.length;
  }
  return fuori;
}
