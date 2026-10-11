/// Togliere da una foto o da un video quello che dice dove e' stato fatto.
///
/// Gli allegati di una segnalazione finiscono su GitHub, in una repository
/// pubblica, e restano nella storia di git anche dopo la chiusura. Una foto
/// del telefono porta dentro, oltre ai punti, le sue note: la posizione GPS,
/// il modello del telefono, l'ora. Il selettore del sistema la riduce ma
/// **non** le toglie: su Android `image_picker` ricopia apposta le note della
/// foto originale in quella ridotta, posizione compresa, e su iOS fa lo
/// stesso.
///
/// Qui si tolgono a mano, senza pacchetti e senza ridisegnare niente: si
/// buttano i pezzi del file che contengono le note e si lasciano i punti
/// come sono.
///
///  - **JPEG**: via i segmenti APP1 (EXIF e XMP), APP13 (IPTC) e i commenti.
///    Dell'EXIF si salva solo l'orientamento, rimesso in un EXIF nuovo di
///    una voce sola: senza, una foto fatta col telefono in piedi si
///    vedrebbe coricata.
///  - **PNG**: via i pezzi `eXIf`, `tEXt`, `zTXt` e `iTXt`.
///  - **WebP**: via i pezzi `EXIF` e `XMP `, e spenti i loro bit in `VP8X`.
///  - **MP4, MOV, 3GP**: le note stanno nelle scatole `udta` e `meta` (la
///    posizione di Android in `©xyz`, quella dell'iPhone in
///    `com.apple.quicktime.location.ISO6709`). Non si tolgono: si
///    **ribattezzano** `free`, che ogni lettore salta, e si riempiono di
///    zeri. Togliere byte vorrebbe dire spostare il video, e riscrivere tutti
///    gli indirizzi che puntano dentro `mdat`; ribattezzare non sposta
///    niente.
///
/// Un file che non si riconosce, o che non torna, esce com'e' entrato: meglio
/// la foto con le note che nessuna foto. Per questo l'avviso accanto ai
/// bottoni resta, anche per i video: HEIC e WebM non si toccano.
library;

import 'dart:typed_data';

/// Lo stesso file senza le note che dicono dove e chi. Non cambia [byte].
Uint8List senzaPosizione(Uint8List byte) {
  try {
    if (_jpeg(byte)) return _jpegPulito(byte) ?? byte;
    if (_png(byte)) return _pngPulito(byte) ?? byte;
    if (_webp(byte)) return _webpPulito(byte) ?? byte;
    if (_scatole(byte)) return _videoPulito(byte) ?? byte;
  } catch (_) {
    /* Un file storto, che finisce prima di quanto dice: com'e'. */
  }
  return byte;
}

bool _jpeg(Uint8List b) =>
    b.length > 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF;

bool _png(Uint8List b) =>
    b.length > 8 &&
    b[0] == 0x89 &&
    _ascii(b, 1, 3) == 'PNG' &&
    b[4] == 0x0D &&
    b[5] == 0x0A &&
    b[6] == 0x1A &&
    b[7] == 0x0A;

bool _webp(Uint8List b) =>
    b.length > 12 && _ascii(b, 0, 4) == 'RIFF' && _ascii(b, 8, 4) == 'WEBP';

bool _scatole(Uint8List b) => b.length > 12 && _ascii(b, 4, 4) == 'ftyp';

String _ascii(Uint8List b, int da, int quanti) =>
    String.fromCharCodes(b.sublist(da, da + quanti));

/* ─── JPEG ──────────────────────────────────────────────────────────────── */

Uint8List? _jpegPulito(Uint8List b) {
  final fuori = BytesBuilder(copy: false)..add(b.sublist(0, 2));
  var orientamento = 1;
  var tolto = false;
  var exifMesso = false;
  var i = 2;
  while (i < b.length) {
    if (b[i] != 0xFF) return null;
    final segno = b[i + 1];
    /* Riempitivo: piu' 0xFF di fila prima del segno. */
    if (segno == 0xFF) {
      i += 1;
      continue;
    }
    /* L'inizio dei punti, o la fine: da qui in poi si copia e basta. */
    if (segno == 0xDA || segno == 0xD9) {
      if (!exifMesso && orientamento != 1) {
        fuori.add(_exifConLOrientamento(orientamento));
      }
      fuori.add(b.sublist(i));
      return tolto ? fuori.takeBytes() : null;
    }
    if (segno == 0x01 || (segno >= 0xD0 && segno <= 0xD7)) {
      fuori.add(b.sublist(i, i + 2));
      i += 2;
      continue;
    }
    final lungo = (b[i + 2] << 8) | b[i + 3];
    final fine = i + 2 + lungo;
    if (lungo < 2 || fine > b.length) return null;
    final segmento = b.sublist(i, fine);
    if (segno == 0xE1) {
      /* APP1: EXIF o XMP. Dell'EXIF si tiene a mente l'orientamento. */
      if (lungo >= 8 && _ascii(segmento, 4, 6) == 'Exif\x00\x00') {
        orientamento = _orientamentoDellExif(segmento, 10) ?? orientamento;
      }
      tolto = true;
    } else if (segno == 0xED || segno == 0xFE) {
      /* APP13 (IPTC, che puo' dire il posto) e i commenti. */
      tolto = true;
    } else {
      /* APP0 (JFIF), APP2 (il profilo dei colori), APP14 (Adobe), le
       * tabelle: servono a vedere la foto, si tengono. L'EXIF nuovo va
       * subito dopo il JFIF, dove starebbe quello vecchio. */
      if (!exifMesso && segno != 0xE0 && orientamento != 1) {
        fuori.add(_exifConLOrientamento(orientamento));
        exifMesso = true;
      }
      fuori.add(segmento);
    }
    i = fine;
  }
  return null;
}

/* L'orientamento (la voce 0x0112) dal primo elenco dell'EXIF, che comincia
 * a [tiff] dentro [s]. `null` se non c'e' o non torna. */
int? _orientamentoDellExif(Uint8List s, int tiff) {
  final ordine = _ascii(s, tiff, 2);
  final Endian verso;
  if (ordine == 'II') {
    verso = Endian.little;
  } else if (ordine == 'MM') {
    verso = Endian.big;
  } else {
    return null;
  }
  final dati = ByteData.sublistView(s);
  final elenco = tiff + dati.getUint32(tiff + 4, verso);
  final voci = dati.getUint16(elenco, verso);
  for (var n = 0; n < voci; n += 1) {
    final voce = elenco + 2 + n * 12;
    if (dati.getUint16(voce, verso) != 0x0112) continue;
    final valore = dati.getUint16(voce + 8, verso);
    return valore >= 1 && valore <= 8 ? valore : null;
  }
  return null;
}

/* Un EXIF di una voce sola: l'orientamento. */
Uint8List _exifConLOrientamento(int orientamento) => Uint8List.fromList([
  0xFF, 0xE1, 0x00, 0x22, // APP1, 34 byte
  ...'Exif'.codeUnits, 0x00, 0x00,
  ...'MM'.codeUnits, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08, // TIFF, big-endian
  0x00, 0x01, // una voce
  0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, // 0x0112, SHORT, 1
  0x00, orientamento, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, // nessun altro elenco
]);

/* ─── PNG ───────────────────────────────────────────────────────────────── */

const _pezziDaTogliereDelPng = {'eXIf', 'tEXt', 'zTXt', 'iTXt'};

Uint8List? _pngPulito(Uint8List b) {
  final dati = ByteData.sublistView(b);
  final fuori = BytesBuilder(copy: false)..add(b.sublist(0, 8));
  var tolto = false;
  var i = 8;
  while (i + 12 <= b.length) {
    final lungo = dati.getUint32(i);
    final tipo = _ascii(b, i + 4, 4);
    final fine = i + 12 + lungo;
    if (fine > b.length) return null;
    if (_pezziDaTogliereDelPng.contains(tipo)) {
      tolto = true;
    } else {
      fuori.add(b.sublist(i, fine));
    }
    i = fine;
    if (tipo == 'IEND') break;
  }
  if (i < b.length) fuori.add(b.sublist(i));
  return tolto ? fuori.takeBytes() : null;
}

/* ─── WebP ──────────────────────────────────────────────────────────────── */

Uint8List? _webpPulito(Uint8List b) {
  final dati = ByteData.sublistView(b);
  final fuori = BytesBuilder(copy: false)..add(b.sublist(0, 12));
  var tolto = false;
  var i = 12;
  while (i + 8 <= b.length) {
    final tipo = _ascii(b, i, 4);
    final lungo = dati.getUint32(i + 4, Endian.little);
    final fine = i + 8 + lungo + (lungo.isOdd ? 1 : 0);
    if (fine > b.length) return null;
    if (tipo == 'EXIF' || tipo == 'XMP ') {
      tolto = true;
    } else {
      final pezzo = Uint8List.fromList(b.sublist(i, fine));
      /* In VP8X i bit che dicono «c'e' l'EXIF» (8) e «c'e' l'XMP» (4). */
      if (tipo == 'VP8X' && pezzo.length > 8) pezzo[8] &= ~0x0C;
      fuori.add(pezzo);
    }
    i = fine;
  }
  if (!tolto) return null;
  final pulito = fuori.takeBytes();
  ByteData.sublistView(pulito).setUint32(4, pulito.length - 8, Endian.little);
  return pulito;
}

/* ─── MP4, MOV, 3GP ─────────────────────────────────────────────────────── */

/* L'XMP di Adobe, in una scatola `uuid` col suo numero. */
const _uuidDellXmp = [
  0xBE, 0x7A, 0xCF, 0xCB, 0x97, 0xA9, 0x42, 0xE8, //
  0x9C, 0x71, 0x99, 0x94, 0x91, 0xE3, 0xAF, 0xAC,
];

Uint8List? _videoPulito(Uint8List entrato) {
  final b = Uint8List.fromList(entrato);
  final dati = ByteData.sublistView(b);
  var tolto = false;

  /* Il nome diventa `free`, e quello che c'era dentro diventa zeri: un
   * lettore la salta, e chi apre il file a mano non ci trova piu' niente. */
  void ribattezza(int dove, int testa, int fine) {
    b.setRange(dove + 4, dove + 8, 'free'.codeUnits);
    b.fillRange(dove + testa, fine, 0);
    tolto = true;
  }

  /* Le scatole fra [da] e [a], e per ognuna cosa farne. */
  void gira(
    int da,
    int a,
    void Function(int dove, String tipo, int testa, int fine) ogni,
  ) {
    var i = da;
    while (i + 8 <= a) {
      var lungo = dati.getUint32(i);
      var testa = 8;
      if (lungo == 1) {
        /* La misura lunga, a 64 bit: `getUint64` nel browser non c'e', e
         * oltre i quattro gigabyte un allegato non ci arriva comunque. */
        if (i + 16 > a || dati.getUint32(i + 8) != 0) return;
        lungo = dati.getUint32(i + 12);
        testa = 16;
      } else if (lungo == 0) {
        lungo = a - i;
      }
      if (lungo < testa || i + lungo > a) return;
      ogni(i, _ascii(b, i + 4, 4), testa, i + lungo);
      i += lungo;
    }
  }

  bool note(String tipo) => tipo == 'udta' || tipo == 'meta';

  gira(0, b.length, (dove, tipo, testa, fine) {
    if (note(tipo)) return ribattezza(dove, testa, fine);
    if (tipo == 'uuid' && dove + testa + 16 <= fine) {
      final numero = b.sublist(dove + testa, dove + testa + 16);
      var xmp = true;
      for (var n = 0; n < 16; n += 1) {
        if (numero[n] != _uuidDellXmp[n]) xmp = false;
      }
      if (xmp) ribattezza(dove, testa, fine);
      return;
    }
    if (tipo != 'moov') return;
    gira(dove + testa, fine, (dove, tipo, testa, fine) {
      if (note(tipo)) return ribattezza(dove, testa, fine);
      if (tipo != 'trak') return;
      gira(dove + testa, fine, (dove, tipo, testa, fine) {
        if (note(tipo)) ribattezza(dove, testa, fine);
      });
    });
  });
  return tolto ? b : null;
}
