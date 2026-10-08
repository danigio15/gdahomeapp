/// Se la casa e' Premium, detto allo schermo dell'auto.
///
/// «Si e' attivato Android Auto anche non avendo il Premium.» Era vero: la
/// casa in auto — i dispositivi, i tasti rapidi, il cancello «quasi a casa» —
/// non guardava mai la licenza, e da una casa Base si apriva tutta. In auto
/// la casa e' una funzione Premium (`docs/LICENZE.md`), come il navigatore.
///
/// Il servizio dell'auto e' Kotlin (e Swift su CarPlay) e la licenza la sa il
/// Dart: qui c'e' il biglietto che il Dart lascia all'auto, nella stessa
/// cartella privata della fotografia. Dice due cose: se la casa in uso e'
/// Premium, e **fino a quando** — il primo momento in cui il suo gettone smette
/// di valere. L'auto lo rilegge a ogni schermata e a ogni tasto, e sbaglia
/// sempre dalla parte chiusa: un biglietto che manca, storto o scaduto vuol
/// dire Base. Cosi' un abbonamento finito si chiude anche se l'app non si
/// riapre piu': il biglietto scade con il gettone, al massimo in otto giorni.
///
/// Chi lo legge dall'altra parte: `auto/LaLicenzaInAuto.kt` e
/// `ios/Runner/LaCasaInCarPlay.swift`. Il nome del file e i due campi devono
/// restare gli stessi nei tre posti.
library;

import 'dart:convert';

/// Il file del biglietto, accanto alla fotografia.
const String nomeDellaLicenza = 'gdahome-auto-licenza.json';

/// Il biglietto da scrivere: [premium] e [fino] (`null` = senza scadenza, come
/// quando le licenze in questa app sono spente).
String laLicenzaScritta({required bool premium, DateTime? fino}) => jsonEncode({
  'premium': premium,
  'fino': premium ? fino?.millisecondsSinceEpoch : null,
});

/// Se il biglietto dice Premium adesso. Non solleva mai: tutto quello che non
/// e' un biglietto giusto e ancora valido vale «no».
bool laLicenzaVale(String? scritto, {required int adesso}) {
  if (scritto == null || scritto.isEmpty || scritto.length > 1024) return false;
  final Object? letto;
  try {
    letto = jsonDecode(scritto);
  } catch (_) {
    return false;
  }
  if (letto is! Map || letto['premium'] != true) return false;
  final fino = letto['fino'];
  if (fino == null) return true;
  return fino is int && fino > adesso;
}
