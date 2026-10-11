/// Le note che dicono dove e' stata fatta una foto o un video: si tolgono
/// prima che l'allegato parta per una repository pubblica.
library;

import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/senza_posizione.dart';

List<int> _ascii(String testo) => testo.codeUnits;

List<int> _u16(int n) => [n >> 8 & 0xFF, n & 0xFF];

List<int> _u32(int n) => [
  n >> 24 & 0xFF,
  n >> 16 & 0xFF,
  n >> 8 & 0xFF,
  n & 0xFF,
];

List<int> _u32le(int n) => _u32(n).reversed.toList();

/* Un segmento JPEG: il segno, la lunghezza, il contenuto. */
List<int> _segmento(int segno, List<int> dentro) => [
  0xFF,
  segno,
  ..._u16(dentro.length + 2),
  ...dentro,
];

/* Un EXIF little-endian come quello di un Android: l'orientamento, il
 * modello, e il puntatore all'elenco del GPS con la latitudine. */
List<int> _exifDelTelefono(int orientamento) {
  final tiff = BytesBuilder();
  void u16(int n) => tiff.add([n & 0xFF, n >> 8 & 0xFF]);
  void u32(int n) => tiff.add(_u32le(n));
  tiff.add(_ascii('II'));
  u16(0x2A);
  u32(8);
  u16(2); // due voci
  u16(0x0112); // orientamento
  u16(3);
  u32(1);
  u16(orientamento);
  u16(0);
  u16(0x8825); // dov'e' l'elenco del GPS
  u16(4);
  u32(1);
  u32(8 + 2 + 24 + 4);
  u32(0);
  u16(1); // l'elenco del GPS: una voce
  u16(0x0001);
  u16(2);
  u32(2);
  tiff.add(_ascii('N'));
  tiff.add([0, 0, 0]);
  u32(0);
  tiff.add(_ascii('POSIZIONE-SEGRETA'));
  return [..._ascii('Exif'), 0, 0, ...tiff.takeBytes()];
}

/* I punti: qui non importa cosa siano, importa che restino uguali. */
final _punti = [0xFF, 0xDA, ..._u16(4), 1, 2, 9, 9, 9, 9, 0xFF, 0xD9];

Uint8List _jpeg({required int orientamento, bool jfif = true}) =>
    Uint8List.fromList([
      0xFF,
      0xD8,
      if (jfif)
        ..._segmento(0xE0, [..._ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
      ..._segmento(0xE1, _exifDelTelefono(orientamento)),
      ..._segmento(0xE1, [
        ..._ascii('http://ns.adobe.com/xap/1.0/'),
        0,
        ..._ascii('<x:xmpmeta>POSIZIONE-SEGRETA</x:xmpmeta>'),
      ]),
      ..._segmento(0xED, _ascii('Photoshop 3.0 POSIZIONE-SEGRETA')),
      ..._segmento(0xFE, _ascii('POSIZIONE-SEGRETA')),
      ..._segmento(0xE2, _ascii('ICC_PROFILE colori')),
      ..._segmento(0xDB, List.filled(65, 1)),
      ..._punti,
    ]);

bool _contiene(Uint8List byte, String testo) =>
    String.fromCharCodes(byte).contains(testo);

/* Le scatole di un MP4. */
List<int> _scatola(String tipo, List<int> dentro) => [
  ..._u32(dentro.length + 8),
  ..._ascii(tipo),
  ...dentro,
];

void main() {
  group('JPEG', () {
    test('via EXIF, XMP, IPTC e commenti; i punti restano uguali', () {
      final prima = _jpeg(orientamento: 1);
      final dopo = senzaPosizione(prima);
      expect(_contiene(dopo, 'POSIZIONE-SEGRETA'), isFalse);
      expect(_contiene(dopo, 'Exif'), isFalse);
      /* Quello che serve a vederla resta: il JFIF, i colori, le tabelle. */
      expect(_contiene(dopo, 'JFIF'), isTrue);
      expect(_contiene(dopo, 'ICC_PROFILE'), isTrue);
      expect(dopo.sublist(dopo.length - _punti.length), _punti);
      expect(dopo.sublist(0, 2), [0xFF, 0xD8]);
      /* E non si tocca quello che e' entrato. */
      expect(_contiene(prima, 'POSIZIONE-SEGRETA'), isTrue);
    });

    test('l\'orientamento resta, in un EXIF di una voce sola', () {
      for (final jfif in [true, false]) {
        final dopo = senzaPosizione(_jpeg(orientamento: 6, jfif: jfif));
        expect(_contiene(dopo, 'POSIZIONE-SEGRETA'), isFalse);
        final exif = String.fromCharCodes(dopo).indexOf('Exif');
        expect(exif, greaterThan(0));
        /* Subito dopo il JFIF, se c'e'; se no subito dopo l'inizio. */
        expect(dopo.sublist(exif - 4, exif - 2), [0xFF, 0xE1]);
        if (!jfif) expect(exif - 4, 2);
        final tiff = exif + 6;
        expect(String.fromCharCodes(dopo.sublist(tiff, tiff + 2)), 'MM');
        final dati = ByteData.sublistView(dopo);
        expect(dati.getUint16(tiff + 8), 1); // una voce
        expect(dati.getUint16(tiff + 10), 0x0112);
        expect(dati.getUint16(tiff + 18), 6);
        expect(dopo.sublist(dopo.length - _punti.length), _punti);
      }
    });

    test('una foto gia\' pulita esce com\'e\'', () {
      final pulita = Uint8List.fromList([
        0xFF,
        0xD8,
        ..._segmento(0xDB, List.filled(65, 1)),
        ..._punti,
      ]);
      expect(identical(senzaPosizione(pulita), pulita), isTrue);
    });

    test('una foto storta esce com\'e\'', () {
      final storta = Uint8List.fromList(_jpeg(orientamento: 1).sublist(0, 30));
      expect(identical(senzaPosizione(storta), storta), isTrue);
    });
  });

  test('PNG: via eXIf e i testi, il resto uguale', () {
    List<int> pezzo(String tipo, List<int> dentro) => [
      ..._u32(dentro.length),
      ..._ascii(tipo),
      ...dentro,
      0,
      0,
      0,
      0, // il controllo: qui non lo guarda nessuno
    ];
    final ihdr = pezzo('IHDR', List.filled(13, 1));
    final idat = pezzo('IDAT', [1, 2, 3]);
    final iend = pezzo('IEND', []);
    final prima = Uint8List.fromList([
      0x89,
      ..._ascii('PNG'),
      0x0D,
      0x0A,
      0x1A,
      0x0A,
      ...ihdr,
      ...pezzo('eXIf', _ascii('MM POSIZIONE-SEGRETA')),
      ...pezzo('tEXt', _ascii('Location\x00POSIZIONE-SEGRETA')),
      ...idat,
      ...iend,
    ]);
    final dopo = senzaPosizione(prima);
    expect(_contiene(dopo, 'POSIZIONE-SEGRETA'), isFalse);
    expect(dopo, [...prima.sublist(0, 8), ...ihdr, ...idat, ...iend]);
  });

  test('WebP: via EXIF e XMP, spenti i loro bit, rifatta la misura', () {
    List<int> pezzo(String tipo, List<int> dentro) => [
      ..._ascii(tipo),
      ..._u32le(dentro.length),
      ...dentro,
      if (dentro.length.isOdd) 0,
    ];
    final corpo = [
      ..._ascii('WEBP'),
      ...pezzo('VP8X', [0x0C | 0x10, 0, 0, 0, 1, 0, 0, 1, 0, 0]),
      ...pezzo('VP8 ', [1, 2, 3, 4, 5]),
      ...pezzo('EXIF', _ascii('MM POSIZIONE-SEGRETA')),
      ...pezzo('XMP ', _ascii('<x>POSIZIONE-SEGRETA</x>')),
    ];
    final prima = Uint8List.fromList([
      ..._ascii('RIFF'),
      ..._u32le(corpo.length),
      ...corpo,
    ]);
    final dopo = senzaPosizione(prima);
    expect(_contiene(dopo, 'POSIZIONE-SEGRETA'), isFalse);
    final dati = ByteData.sublistView(dopo);
    expect(dati.getUint32(4, Endian.little), dopo.length - 8);
    /* Il bit dell'alfa (0x10) resta, quelli dell'EXIF e dell'XMP no. */
    expect(dopo[20], 0x10);
    expect(_contiene(dopo, 'VP8 '), isTrue);
  });

  group('video', () {
    test('udta e meta diventano free: niente si sposta', () {
      final ftyp = _scatola('ftyp', [..._ascii('isom'), 0, 0, 2, 0]);
      final mdat = _scatola('mdat', List.filled(40, 7));
      final prima = Uint8List.fromList([
        ...ftyp,
        ...mdat,
        ..._scatola('moov', [
          ..._scatola('mvhd', List.filled(20, 0)),
          ..._scatola('trak', [
            ..._scatola('tkhd', List.filled(20, 0)),
            ..._scatola('meta', _ascii('POSIZIONE-TRACCIA')),
          ]),
          ..._scatola('udta', [
            ..._scatola('©xyz', _ascii('+45.4642+009.1900/')),
          ]),
          ..._scatola('meta', _ascii('location.ISO6709')),
        ]),
      ]);
      final dopo = senzaPosizione(prima);
      expect(dopo.length, prima.length);
      /* Le stesse scatole, negli stessi posti: cambia solo il nome. */
      final testo = String.fromCharCodes(dopo);
      expect(testo.contains('udta'), isFalse);
      expect(testo.contains('meta'), isFalse);
      expect('free'.allMatches(testo), hasLength(3));
      /* E dentro non c'e' piu' niente: la posizione non si legge nemmeno
       * aprendo il file a mano. */
      expect(testo.contains('+45.4642'), isFalse);
      expect(testo.contains('ISO6709'), isFalse);
      expect(testo.contains('POSIZIONE-TRACCIA'), isFalse);
      expect(dopo.sublist(0, ftyp.length + mdat.length), [...ftyp, ...mdat]);
      expect(testo.contains('mvhd'), isTrue);
      expect(testo.contains('tkhd'), isTrue);
      /* Quello che e' entrato non si tocca. */
      expect(String.fromCharCodes(prima).contains('udta'), isTrue);
    });

    test('un video senza note esce com\'e\'', () {
      final pulito = Uint8List.fromList([
        ..._scatola('ftyp', [..._ascii('isom'), 0, 0, 2, 0]),
        ..._scatola('moov', _scatola('mvhd', List.filled(20, 0))),
      ]);
      expect(identical(senzaPosizione(pulito), pulito), isTrue);
    });
  });

  test('un file che non si riconosce esce com\'e\'', () {
    final boh = Uint8List.fromList(_ascii('niente di noto, qui'));
    expect(identical(senzaPosizione(boh), boh), isTrue);
    final vuoto = Uint8List(0);
    expect(identical(senzaPosizione(vuoto), vuoto), isTrue);
  });
}
