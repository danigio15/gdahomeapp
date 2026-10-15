/// Le chiavi delle notifiche, lasciate all'estensione dell'iPhone.
///
/// Sull'iPhone la notifica arriva con la frase di riserva — «gdahome: nuova
/// notifica» — e il testo vero chiuso nella busta. Per mostrarlo subito, e
/// non solo toccandola, la busta la apre un pezzo nativo dell'app,
/// l'estensione delle notifiche (`ios/NotificheService`), mentre la notifica
/// arriva. L'estensione non e' l'app: non legge il suo portachiavi.
///
/// Quello che le si lascia e' **solo la chiave delle notifiche** di ogni casa
/// ([chiaveDellaSpinta]): quella che apre le buste e basta. La chiave del filo,
/// che apre la casa, resta dov'era. Le chiavi vanno in un posto del
/// portachiavi condiviso solo con l'estensione, leggibili dopo il primo sblocco
/// e **solo su questo telefono**: niente copie di iCloud.
///
/// Si riscrive l'elenco intero ogni volta: una casa tolta esce da li', e la
/// sua busta torna a mostrare la frase di riserva.
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../casa/casa_conosciuta.dart';
import 'busta.dart';

const _canale = MethodChannel('gdahome/notifiche-iphone');

/* L'ultimo elenco lasciato: il collegamento cambia spesso, le case di rado, e
 * il portachiavi si riscrive solo quando l'elenco e' un altro. */
String? _lasciato;

/// Lascia all'estensione le chiavi delle notifiche di queste case. Fuori
/// dall'iPhone non fa niente.
Future<void> lasciaLeChiaviAllEstensione(Iterable<CasaConosciuta> case_) async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.iOS) return;
  try {
    final chiavi = await chiaviPerLEstensione(case_);
    final adesso = jsonEncode(chiavi);
    if (adesso == _lasciato) return;
    await _canale.invokeMethod<void>('chiavi', chiavi);
    _lasciato = adesso;
  } catch (_) {
    /* Un'app senza l'estensione, o il portachiavi che dice di no: le notifiche
     * restano con la frase di riserva, come prima. */
  }
}

/// Telefono → `{k: chiave delle notifiche, n: nome della casa, c: casa}`.
@visibleForTesting
Future<Map<String, Map<String, String>>> chiaviPerLEstensione(
  Iterable<CasaConosciuta> case_,
) async {
  final chiavi = <String, Map<String, String>>{};
  for (final casa in case_) {
    final telefono = casa.identificativo, chiaveDelFilo = casa.chiave;
    if (telefono == null || chiaveDelFilo == null) continue;
    final chiave = await chiaveDellaSpinta(chiaveDelFilo, telefono);
    final byte = await chiave.extractBytes();
    chiavi[telefono] = {
      'k': byte.map((b) => b.toRadixString(16).padLeft(2, '0')).join(),
      'n': casa.nome,
      'c': casa.id,
    };
  }
  return chiavi;
}
