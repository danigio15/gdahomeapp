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
/// una casa muta, cosa vuol dire «da guardare», quando un collaudo e' chiuso —
/// e tre posti che dicono la stessa cosa prima o poi ne dicono tre diverse.
library;

import '../ponte/filo.dart';

/// Quello che il ponte risponde: se questa casa e' di chi installa, e dove si
/// apre il suo cruscotto.
class IlCruscotto {
  const IlCruscotto(this._filo);

  final Filo _filo;

  /// Se da questa casa si guarda una flotta di impianti.
  ///
  /// Se il ponte non conosce il comando — uno vecchio, di prima — la risposta
  /// e' no, ed e' quella giusta: una voce che non si sa aprire non si disegna.
  Future<String> dove() async {
    try {
      final detto = await _filo.risultato({'type': 'ponte/quadro/stato'});
      if (detto is! Map) return '';
      if (detto['installatore'] != true) return '';
      final dove = detto['dove'];

      /// Solo `https`, e per lo stesso motivo di tutto il resto: di la' c'e'
      /// l'elenco degli impianti di qualcuno.
      if (dove is! String || !dove.startsWith('https://')) return '';
      return dove;
    } catch (_) {
      return '';
    }
  }
}
