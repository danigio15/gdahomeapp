/// Le notifiche di una casa, chieste al suo ponte sul filo.
///
/// Tutto passa dal filo cifrato che il telefono ha gia' aperto con la casa, e
/// col suo segno: e' cosi' che la casa sa che le impostazioni, il gettone di
/// Firebase e il tasto premuto sotto una notifica sono **di questo telefono**,
/// e di nessun altro.
///
/// Niente Flutter qui dentro: si prova contro un ponte finto.
library;

import 'dart:convert';

import '../casa/cassaforte.dart';
import '../ponte/filo.dart';
import 'modello.dart';

class Notifiche {
  Notifiche(this._filo);

  final Filo _filo;

  Future<StatoDelleNotifiche> stato() async => StatoDelleNotifiche.leggi(
    await _filo.risultato({'type': 'ponte/notifiche/stato'}),
  );

  /// Dice alla casa dove mandarle: il gettone di Firebase di questo telefono.
  Future<StatoDelleNotifiche> registra({
    required String gettone,
    required String piattaforma,
    required String lingua,
  }) async => StatoDelleNotifiche.leggi(
    await _filo.risultato({
      'type': 'ponte/notifiche/registra',
      'gettone': gettone,
      'piattaforma': piattaforma,
      'lingua': lingua,
    }),
  );

  /// Non mandarle piu' a questo telefono.
  Future<void> togli() => _filo.risultato({'type': 'ponte/notifiche/togli'});

  Future<ImpostazioniDelleNotifiche> imposta(
    ImpostazioniDelleNotifiche impostazioni,
  ) async {
    final detto = await _filo.risultato({
      'type': 'ponte/notifiche/imposta',
      'impostazioni': impostazioni.inJson(),
    });
    return ImpostazioniDelleNotifiche.leggi(
      detto is Map ? detto['impostazioni'] : null,
    );
  }

  /// Una notifica di prova. Con [evento], quella di quel tipo, come
  /// arriverebbe su questo telefono — semplice o elaborata. Un ponte di prima
  /// l'evento non lo guarda e ne manda una qualunque.
  Future<void> prova({String? evento}) =>
      _filo.risultato({'type': 'ponte/notifiche/prova', 'evento': ?evento});

  Future<NotificaPersonalizzata?> salva(NotificaPersonalizzata regola) async {
    final detto = await _filo.risultato({
      'type': 'ponte/notifiche/personalizzata/salva',
      'regola': regola.inJson(),
    });
    return NotificaPersonalizzata.leggi(detto is Map ? detto['regola'] : null);
  }

  Future<void> togliLaPersonalizzata(String id) => _filo.risultato({
    'type': 'ponte/notifiche/personalizzata/togli',
    'regola': id,
  });

  /// Un tasto premuto sotto una notifica: la casa esegue quello che aveva
  /// preparato per questo telefono, una volta sola.
  Future<void> premi(String notifica, String tasto) => _filo.risultato({
    'type': 'ponte/notifiche/azione',
    'notifica': notifica,
    'azione': tasto,
  });
}

/// L'ultima risposta del ponte, per casa: la pagina si apre subito con
/// quella, e poi si rinfresca. Sta nella cassaforte come tutto quello che
/// riguarda una casa.
class CopiaDelleNotifiche {
  CopiaDelleNotifiche(this._cassaforte);

  final Cassaforte _cassaforte;

  static String _chiave(String casa) => 'notifiche_$casa';

  Future<StatoDelleNotifiche?> leggi(String casa) async {
    final scritto = await _cassaforte.leggi(_chiave(casa));
    if (scritto == null) return null;
    try {
      return StatoDelleNotifiche.leggi(jsonDecode(scritto));
    } catch (_) {
      return null;
    }
  }

  Future<void> scrivi(String casa, StatoDelleNotifiche stato) =>
      _cassaforte.scrivi(_chiave(casa), jsonEncode(stato.inJson()));

  Future<void> dimentica(String casa) => _cassaforte.cancella(_chiave(casa));
}

/// Le notifiche gia' viste, per non mostrarne una due volte: Firebase puo'
/// consegnare due volte la stessa, e chi registrasse una busta la potrebbe
/// rigiocare. L'identificativo sta dentro la busta, e una busta toccata non
/// si apre.
class NotificheViste {
  NotificheViste(this._cassaforte, {this.quante = 200});

  final Cassaforte _cassaforte;
  final int quante;
  static const _chiave = 'notifiche_viste';

  /// `true` se e' nuova, e da adesso e' vista.
  Future<bool> segna(String id) async {
    final scritto = await _cassaforte.leggi(_chiave);
    var viste = <String>[];
    if (scritto != null) {
      try {
        viste = [
          for (final una in jsonDecode(scritto) as List)
            if (una is String) una,
        ];
      } catch (_) {
        viste = [];
      }
    }
    if (viste.contains(id)) return false;
    viste.add(id);
    if (viste.length > quante) viste = viste.sublist(viste.length - quante);
    await _cassaforte.scrivi(_chiave, jsonEncode(viste));
    return true;
  }
}
