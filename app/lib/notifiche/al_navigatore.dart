/// Le notifiche della casa anche nel navigatore, mentre si guida.
///
/// Ogni notifica che il postino apre e mostra sul telefono (`postino.dart`)
/// arriva anche a gdanav, che in guida la fa diventare un avviso sopra la
/// mappa — sul telefono, su Android Auto e su CarPlay (`GestoreCasaInGuida`
/// in gdanav). Sono **le stesse** che arrivano al telefono: le preferenze
/// delle notifiche (quali eventi, le ore di silenzio, «solo da fuori casa»)
/// le applica gia' la casa prima di mandarle. Nel navigatore se ne sceglie in
/// piu' solo se vederle in guida, e quali categorie.
///
/// ## Il filo
///
/// La busta si apre dove arriva: con l'app aperta nel pezzo di Dart
/// dell'app, ma su Android con l'app in sottofondo — in macchina, col
/// telefono in tasca e Android Auto acceso — Firebase sveglia **un altro**
/// pezzo di Dart, in un altro motore. Il navigatore sta nel primo. Fra i due
/// c'e' [IsolateNameServer]: il navigatore, quando si accende, apre una porta
/// col nome [nomeDellaPorta] ([ascoltaLeNotifiche]); chi apre una busta, da
/// qualunque parte, la cerca e ci lascia la notifica ([mandaAlNavigatore]).
/// Se la porta non c'e' — il navigatore spento — non succede niente.
///
/// La notifica viaggia come testo JSON: fra due motori passano solo cose
/// semplici.
///
/// ## Il ritorno
///
/// Un tasto premuto su un avviso nel navigatore («Apri cancello» dopo il
/// «Si'») torna qui ([toccoDalNavigatore]) e diventa il tocco del tasto della
/// notifica: passa dal postino alla home, dietro il velo del lucchetto, come
/// quando lo si preme dalla tendina (`dietro_il_velo.dart`). Niente scorciatoie.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:isolate';
import 'dart:ui' show IsolateNameServer;

import 'package:flutter/foundation.dart';

import 'consegna.dart';
import 'modello.dart';

/// Il nome della porta del navigatore.
const nomeDellaPorta = 'gdahome/notifiche-al-navigatore';

/// La notifica come la vuole il navigatore: quella della busta, piu' il nome
/// della casa (`_casa`) e il suo id (`_casa_id`, per il ritorno). `null` se
/// e' scaduta: arrivata tardi, i tasti non valgono piu' e in guida non serve.
@visibleForTesting
Map<String, Object?>? perIlNavigatore(NotificaDaMostrare quale) {
  if (quale.scaduta) return null;
  return {...quale.grezza, '_casa': quale.casa.nome, '_casa_id': quale.casa.id};
}

/// Lascia la notifica al navigatore, se e' acceso (in questo motore o in un
/// altro). Non fa mai fallire chi la chiama.
void mandaAlNavigatore(NotificaDaMostrare quale) {
  try {
    final dati = perIlNavigatore(quale);
    if (dati == null) return;
    IsolateNameServer.lookupPortByName(nomeDellaPorta)?.send(jsonEncode(dati));
  } catch (_) {
    /* Il navigatore non c'e', o la notifica non si scrive: resta sul
     * telefono come sempre. */
  }
}

StreamController<Map<String, Object?>>? _arrivate;

/// Apre la porta del navigatore e ne da' le notifiche. Una sola per l'app:
/// chiamata di nuovo, torna lo stesso flusso.
Stream<Map<String, Object?>> ascoltaLeNotifiche() {
  final gia = _arrivate;
  if (gia != null) return gia.stream;
  final arrivate = _arrivate =
      StreamController<Map<String, Object?>>.broadcast();
  final porta = ReceivePort('notifiche al navigatore');
  /* Una porta rimasta di un avvio di prima (il riavvio a caldo) non vale
   * piu': si toglie, e si mette questa. */
  IsolateNameServer.removePortNameMapping(nomeDellaPorta);
  IsolateNameServer.registerPortWithName(porta.sendPort, nomeDellaPorta);
  porta.listen((messaggio) {
    if (leggiDalFilo(messaggio) case final n?) arrivate.add(n);
  });
  return arrivate.stream;
}

/// Quello che arriva sulla porta: il JSON di una notifica. `null` se non lo
/// e'.
@visibleForTesting
Map<String, Object?>? leggiDalFilo(Object? messaggio) {
  if (messaggio is! String) return null;
  try {
    final letto = jsonDecode(messaggio);
    return letto is Map<String, dynamic> ? letto : null;
  } catch (_) {
    return null;
  }
}

/// Il tasto premuto su un avviso del navigatore, come tocco del tasto della
/// notifica. `null` se la notifica non si rilegge o il tasto non e' suo.
ToccoDellaNotifica? toccoDalNavigatore(
  Map<String, Object?> notifica,
  String tasto,
) {
  final casa = notifica['_casa_id'];
  if (casa is! String || casa.isEmpty) return null;
  final grezza = <String, dynamic>{
    for (final MapEntry(:key, :value) in notifica.entries)
      if (!key.startsWith('_')) key: value,
  };
  final letta = NotificaArrivata.leggi(grezza);
  if (letta == null || !letta.tasti.any((uno) => uno.id == tasto)) {
    return null;
  }
  return ToccoDellaNotifica(casa: casa, notifica: letta, tasto: tasto);
}
