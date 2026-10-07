/// I gettoni di prova, firmati con la coppia **di prova** di
/// `docs/LICENZE.md`. Non e' una prova: la usano le prove.
///
/// Quella coppia non va mai in un file di produzione: qui sta perche' le
/// prove devono poter firmare come il quadro, e la chiave vera il quadro non
/// la da' a nessuno.
library;

import 'dart:convert';

import 'package:cryptography/cryptography.dart';

const chiaveDiProva = '6P9sdqQtlHcmH7Ve_SgzmyJmxJS28CNORRJJfjI3rnI';
const privataDiProva = 'Q2Iu3eKMxw3Y1GS9MypZjXvjPfHB959KImNldY80xr0';

/// Un'altra chiave, per il gettone firmato da chi non e' il quadro.
const privataSbagliata = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';

const casaDiProva = 'casa_0123456789abcdef0123456789abcdef';

String _b64(List<int> byte) => base64Url.encode(byte).replaceAll('=', '');

/// Firma un gettone come il quadro. I campi mancanti hanno un valore buono:
/// una licenza gdahome di negozio, per [casaDiProva], che vale sette giorni.
Future<String> firmaUnGettone({
  String app = 'gdahome',
  String sog = casaDiProva,
  String origine = 'negozio',
  DateTime? scade,
  bool perSempre = false,
  DateTime? fino,
  DateTime? emesso,
  int v = 1,
  bool prova = false,
  DateTime? pagato,
  String privata = privataDiProva,
}) async {
  final adesso = DateTime.now();
  final payload = {
    'v': v,
    'app': app,
    'sog': sog,
    'lic': 'lic_9f2c',
    'origine': origine,
    'scade': perSempre
        ? null
        : (scade ?? adesso.add(const Duration(days: 30)))
              .millisecondsSinceEpoch,
    'fino':
        (fino ?? adesso.add(const Duration(days: 7))).millisecondsSinceEpoch,
    'emesso': (emesso ?? adesso).millisecondsSinceEpoch,
    if (prova) 'prova': true,
    'pagato': ?pagato?.millisecondsSinceEpoch,
  };
  final primo = _b64(utf8.encode(jsonEncode(payload)));
  final coppia = await Ed25519().newKeyPairFromSeed(
    base64Url.decode(base64Url.normalize(privata)),
  );
  final firma = await Ed25519().sign(ascii.encode(primo), keyPair: coppia);
  return '$primo.${_b64(firma.bytes)}';
}
