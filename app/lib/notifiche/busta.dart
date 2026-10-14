/// La busta di una notifica, aperta sul telefono.
///
/// La casa chiude ogni notifica con una chiave che hanno solo lei e questo
/// telefono (`ponte/src/spinta.js`), e la manda a Firebase passando dal
/// centralino. Nessuno dei due la puo' leggere: arriva qui un blocco di byte,
/// e solo qui diventa «antifurto scattato · ingresso».
///
/// La chiave non e' nuova: si ricava dalla **chiave del filo**, quella che il
/// telefono ha ricevuto abbinandosi e che al centralino non e' mai passata,
/// con HKDF e un'etichetta sua. Il conto e' lo stesso di Node, byte per byte,
/// e le prove lo controllano con una busta fatta dal ponte vero
/// (`test/notifiche/busta_test.dart`).
///
/// Niente Flutter qui dentro: questa parte gira anche nel servizio che
/// Android sveglia quando arriva una notifica ad app chiusa.
library;

import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

const String etichettaDellaSpinta = 'gdahome/spinta/v1';
const int versioneDellaSpinta = 1;

/// La busta non si apre: non e' per questo telefono, o qualcuno l'ha toccata.
class SpintaGuasta implements Exception {
  const SpintaGuasta(this.perche);
  final String perche;
  @override
  String toString() => perche;
}

final _hkdf = Hkdf(hmac: Hmac.sha256(), outputLength: 32);

Uint8List _daEsadecimale(String testo) {
  if (!RegExp(r'^[0-9a-fA-F]{64}$').hasMatch(testo)) {
    throw const SpintaGuasta('la chiave del filo non è buona');
  }
  final byte = Uint8List(32);
  for (var i = 0; i < 32; i += 1) {
    byte[i] = int.parse(testo.substring(i * 2, i * 2 + 2), radix: 16);
  }
  return byte;
}

/// La chiave delle notifiche di un telefono: la stessa di
/// `chiaveDellaSpinta` nel ponte.
Future<SecretKey> chiaveDellaSpinta(String chiaveDelFilo, String telefono) =>
    _hkdf.deriveKey(
      secretKey: SecretKey(_daEsadecimale(chiaveDelFilo)),
      nonce: utf8.encode(etichettaDellaSpinta),
      info: utf8.encode('$etichettaDellaSpinta|$telefono'),
    );

/// Apre una busta e torna quello che c'e' dentro. Solleva [SpintaGuasta] se
/// non si apre: con un'altra chiave, per un altro telefono, toccata.
Future<Map<String, dynamic>> apriLaSpinta({
  required String chiaveDelFilo,
  required String telefono,
  required String busta,
}) async {
  final Uint8List tutto;
  try {
    tutto = base64.decode(busta);
  } catch (_) {
    throw const SpintaGuasta('non è base64');
  }
  if (tutto.length < 1 + 12 + 16) {
    throw const SpintaGuasta('busta troppo corta');
  }
  if (tutto[0] != versioneDellaSpinta) {
    throw const SpintaGuasta('versione sconosciuta');
  }
  final List<int> dentro;
  try {
    dentro = await AesGcm.with256bits().decrypt(
      SecretBox(
        tutto.sublist(13, tutto.length - 16),
        nonce: tutto.sublist(1, 13),
        mac: Mac(tutto.sublist(tutto.length - 16)),
      ),
      secretKey: await chiaveDellaSpinta(chiaveDelFilo, telefono),
      aad: utf8.encode('$etichettaDellaSpinta|$telefono'),
    );
  } on SpintaGuasta {
    rethrow;
  } catch (_) {
    throw const SpintaGuasta('la busta non si apre');
  }
  final letto = jsonDecode(utf8.decode(dentro));
  if (letto is! Map<String, dynamic>) {
    throw const SpintaGuasta('dentro non c\'è una notifica');
  }
  return letto;
}
