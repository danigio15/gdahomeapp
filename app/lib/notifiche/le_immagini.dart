/// L'immagine di una notifica, tenuta per la sua pagina.
///
/// «Quando si clicca sulla notifica venga aperta l'app con la visualizzazione
/// della stessa notifica.» La notifica elaborata porta un'immagine — la foto
/// della telecamera al momento del movimento, o la scheda disegnata — e la
/// foto il centralino la da' una volta sola: chi apre la pagina dopo non la
/// puo' richiedere. Allora la si tiene qui, sul telefono, col numero della
/// notifica, quando la si disegna (`postino.dart`) o quando l'iPhone la passa
/// all'app toccandola (`AppDelegate.swift`).
///
/// Nella cartella dell'app, che non va nelle copie; restano due giorni e al
/// piu' quaranta, poi si buttano. Nessuna lascia il telefono.
///
/// Niente Flutter qui dentro: gira anche nel servizio che Android sveglia ad
/// app chiusa.
library;

import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';

/// Quanto resta un'immagine, e quante se ne tengono al piu'.
const Duration vitaDelleImmagini = Duration(days: 2);
const int immaginiTenute = 40;

/// Il numero di una notifica e' base64url: altro non diventa un nome di file.
final _numeroBuono = RegExp(r'^[A-Za-z0-9_-]{4,64}$');

Future<Directory> _laCartella(Directory? cartella) async {
  final dove =
      cartella ??
      Directory(
        '${(await getApplicationSupportDirectory()).path}/immagini-notifiche',
      );
  await dove.create(recursive: true);
  return dove;
}

/// Tiene l'immagine della notifica [numero]. Non solleva mai: un'immagine
/// che non si scrive e' una pagina senza immagine, non una notifica persa.
Future<void> tieniLImmagine(
  String numero,
  Uint8List byte, {
  Directory? cartella,
  DateTime? adesso,
}) async {
  if (!_numeroBuono.hasMatch(numero) || byte.isEmpty) return;
  try {
    final dove = await _laCartella(cartella);
    await File('${dove.path}/$numero.img').writeAsBytes(byte, flush: true);
    await _pota(dove, adesso ?? DateTime.now());
  } catch (_) {
    /* Il disco pieno, una cartella che non si apre: niente immagine. */
  }
}

/// L'immagine della notifica [numero], se c'e'.
Future<Uint8List?> prendiLImmagine(String numero, {Directory? cartella}) async {
  if (!_numeroBuono.hasMatch(numero)) return null;
  try {
    final file = File('${(await _laCartella(cartella)).path}/$numero.img');
    if (!await file.exists()) return null;
    return await file.readAsBytes();
  } catch (_) {
    return null;
  }
}

Future<void> _pota(Directory dove, DateTime adesso) async {
  final file = <File, DateTime>{};
  await for (final uno in dove.list()) {
    if (uno is File && uno.path.endsWith('.img')) {
      file[uno] = (await uno.stat()).modified;
    }
  }
  final ordinati = file.keys.toList()
    ..sort((a, b) => file[b]!.compareTo(file[a]!));
  for (final (i, uno) in ordinati.indexed) {
    if (i >= immaginiTenute ||
        adesso.difference(file[uno]!) > vitaDelleImmagini) {
      try {
        await uno.delete();
      } catch (_) {
        /* Gia' tolta. */
      }
    }
  }
}
