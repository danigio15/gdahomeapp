/// Il cruscotto di chi installa: se questa casa e' la sua.
///
/// E' la gemella di `LaConsole`, e funziona allo stesso modo: **a decidere se
/// la voce esiste e' il ponte, non l'app**. Nelle opzioni dell'add-on c'e' un
/// interruttore — `installatore` — e chi non ce l'ha acceso non vede nessuna
/// voce. Una porta che non si apre e' peggio di una porta che non c'e'.
///
/// ─── Cosa NON c'e' qui dentro ─────────────────────────────────────────────
///
/// La chiave della flotta. Non passa da questa richiesta, non sta nelle opzioni
/// dell'add-on e non finisce sul disco di nessuna casa: la chiede il cruscotto
/// quando si apre, e resta nel browser di chi la digita.
///
/// E' una differenza che conta. L'interruttore dice soltanto «questo Home
/// Assistant e' di chi installa», che e' un'informazione innocua anche se
/// qualcuno la legge. La chiave invece aprirebbe l'elenco degli impianti di un
/// installatore — cioe' i clienti di qualcuno — e quella non si lascia in giro.
///
/// ─── E il cruscotto non si rifa' qui ──────────────────────────────────────
///
/// La voce **apre** il cruscotto che esiste gia', sul quadro. Rifarlo in
/// Flutter vorrebbe dire un terzo posto dove stanno le stesse regole — cos'e'
/// una casa offline, cosa vuol dire «da guardare» — e tre posti che dicono la
/// stessa cosa prima o poi ne dicono tre diverse.
///
/// ─── E la gestione ────────────────────────────────────────────────────────
///
/// Stessa domanda, stessa risposta, e per un pezzo mancava: il ponte fabbrica
/// gia' la voce «Gestione» nella barra di Home Assistant, e nell'app non
/// c'era proprio — non era rotta, non era mai stata fatta. Adesso il ponte
/// dice tutt'e due in una risposta sola: sono la stessa domanda fatta a chi la
/// sa, e due giri sul filo per due campi sarebbero due giri.
library;

import '../ponte/filo.dart';

/// Quello che il ponte risponde: se questa casa e' di chi installa, e dove si
/// apre il suo cruscotto.
class IlCruscotto {
  const IlCruscotto(this._filo);

  final Filo _filo;

  /// Dove si aprono il cruscotto e la gestione, o stringa vuota per chi non li
  /// ha.
  ///
  /// Se il ponte non conosce il comando — uno vecchio, di prima — la risposta
  /// e' no per tutt'e due, ed e' quella giusta: una voce che non si sa aprire
  /// non si disegna.
  Future<({String cruscotto, String gestione})> dove() async {
    try {
      final detto = await _filo.risultato({'type': 'ponte/quadro/stato'});
      if (detto is! Map) return _niente;
      return (
        cruscotto: detto['installatore'] == true ? _soloHttps(detto['dove']) : '',
        gestione: detto['gestore'] == true ? _soloHttps(detto['doveGestione']) : '',
      );
    } catch (_) {
      return _niente;
    }
  }
}

const _niente = (cruscotto: '', gestione: '');

/// Solo `https`, e per lo stesso motivo di tutto il resto: di la' c'e' l'elenco
/// degli impianti di qualcuno.
String _soloHttps(Object? dove) =>
    dove is String && dove.startsWith('https://') ? dove : '';
