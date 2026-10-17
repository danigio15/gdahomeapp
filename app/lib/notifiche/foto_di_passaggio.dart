/// L'istantanea di una telecamera, nella notifica elaborata.
///
/// Una foto non sta in una notifica: Google e Apple portano pochi chilobyte.
/// La casa la scatta, la chiude con la **stessa chiave delle notifiche** di
/// questo telefono ([chiaveDellaSpinta]) e la lascia al centralino per dieci
/// minuti, una lettura sola. Qui la si prende, la si apre, e va nella
/// notifica. Il centralino ha in mano un blocco di byte che non sa aprire.
///
/// Succede solo con le notifiche «elaborate»: con le semplici la casa non
/// manda nessuna foto.
///
/// La busta e' fatta come quella delle notifiche — un byte di versione,
/// dodici di nonce, il cifrato, sedici di marchio — con dati autenticati
/// suoi, `gdahome/foto/v1|telefono`: una busta di notifica non si apre come
/// foto, e il contrario.
///
/// Niente Flutter qui dentro: gira anche nel servizio che Android sveglia ad
/// app chiusa.
library;

import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:http/http.dart' as http;

import 'busta.dart';

const String etichettaDellaFoto = 'gdahome/foto/v1';
const int versioneDellaFoto = 1;

/// Piu' di cosi' non e' una nostra foto: il centralino non ne tiene di piu'.
const int fotoMassima = 300 * 1024;

/// Apre la busta di una foto. `null` se non si apre: un'altra chiave, un
/// altro telefono, byte toccati.
Future<Uint8List?> apriLaFoto({
  required String chiaveDelFilo,
  required String telefono,
  required List<int> busta,
}) async {
  if (busta.length < 1 + 12 + 16 || busta.length > fotoMassima) return null;
  if (busta[0] != versioneDellaFoto) return null;
  try {
    final chiara = await AesGcm.with256bits().decrypt(
      SecretBox(
        busta.sublist(13, busta.length - 16),
        nonce: busta.sublist(1, 13),
        mac: Mac(busta.sublist(busta.length - 16)),
      ),
      secretKey: await chiaveDellaSpinta(chiaveDelFilo, telefono),
      aad: utf8.encode('$etichettaDellaFoto|$telefono'),
    );
    return Uint8List.fromList(chiara);
  } catch (_) {
    return null;
  }
}

/// Prende la foto dal centralino e la apre. `null` se qualcosa non va: la
/// notifica arriva lo stesso, senza foto.
Future<Uint8List?> prendiLaFoto({
  required Uri dove,
  required String chiaveDelFilo,
  required String telefono,
  http.Client? cliente,
  Duration attesa = const Duration(seconds: 8),
}) async {
  final usa = cliente ?? http.Client();
  try {
    final risposta = await usa.get(dove).timeout(attesa);
    if (risposta.statusCode != 200) return null;
    return await apriLaFoto(
      chiaveDelFilo: chiaveDelFilo,
      telefono: telefono,
      busta: risposta.bodyBytes,
    );
  } catch (_) {
    return null;
  } finally {
    if (cliente == null) usa.close();
  }
}
