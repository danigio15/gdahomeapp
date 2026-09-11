/// La cucitura: il WebSocket della plancia, cucito sul filo dell'app.
///
/// La plancia crede di parlare con Home Assistant. Non ci parla: parla con
/// questo, che rinumera i suoi messaggi, li manda sul filo, e le rimanda le
/// risposte coi numeri che si aspetta. Home Assistant vuole numeri sempre
/// crescenti su un filo, e due contatori non possono spartirsene uno — e' il
/// motivo per cui questa classe esiste invece di lasciar passare i messaggi
/// come sono.
///
/// Non sa **come** i messaggi arrivino e partano. Sul telefono e' un WebSocket
/// vero, aperto dal servitore su 127.0.0.1; nel browser un server non c'e' e i
/// messaggi passano fra due pagine. La rinumerazione e' la stessa, e una
/// seconda copia della stessa aritmetica e' il modo migliore per ritrovarsi
/// con due comportamenti diversi e nessuno che se ne accorge.
library;

import 'dart:async';
import 'dart:convert';

import '../ponte/errori.dart';
import '../ponte/filo.dart';

/// Quanto si aspetta che il filo torni su prima di dire alla pagina che non
/// c'e' verso. Venti secondi sono il tempo di una riconnessione dopo un
/// cambio di rete; oltre, meglio un no che una pagina che aspetta.
const attesaDelFilo = Duration(seconds: 20);

/// Il filo, **quando e' dentro**. Aspetta una riconnessione in corso, ma non
/// per sempre: `null` quando non c'e' verso.
///
/// Questa funzione e' la differenza fra una plancia che si collega e una che
/// lampeggia. Il filo puo' esserci senza essere su — la pagina si apre mentre
/// l'app sta ancora bussando — e chi prende quel filo e dice `auth_ok` manda
/// la plancia a chiedere gli stati su un filo che non c'e': la pagina si
/// trova la porta chiusa al primo messaggio, diventa rossa, e riprova fra
/// cinque secondi. Per sempre, se il filo e' ballerino.
Future<Filo?> filoPronto(
  Filo? Function() trova, {
  Duration entro = attesaDelFilo,
}) async {
  final fine = DateTime.now().add(entro);
  while (true) {
    final filo = trova();
    if (filo != null && filo.dentro) return filo;
    if (DateTime.now().isAfter(fine)) return null;
    if (filo == null) {
      /* Non c'e' ancora nessun filo da guardare: si riguarda fra un attimo. */
      await Future<void>.delayed(const Duration(milliseconds: 250));
      continue;
    }
    /* C'e' ma non e' dentro: si aspetta che lo dica lui, invece di guardare
     * l'orologio. */
    final resta = fine.difference(DateTime.now());
    try {
      await filo.stato
          .firstWhere((stato) => stato == StatoDelFilo.dentro)
          .timeout(resta < Duration.zero ? Duration.zero : resta);
    } catch (_) {
      /* Scaduto, o il filo e' stato chiuso: si riguarda dall'inizio. */
    }
  }
}

/// I comandi di Home Assistant che dopo la risposta continuano a mandare
/// eventi con lo stesso numero. Per questi l'instradamento resta; per tutti
/// gli altri si toglie appena arriva la risposta, se no un telefono che tiene
/// la plancia aperta per giorni si porterebbe dietro un numero per ogni
/// comando mai mandato.
const cheContinuano = {
  'subscribe_events',
  'subscribe_trigger',
  'render_template',
  'history/stream',
  'camera/webrtc/offer',
  'camera/web_rtc_offer',
};

/// Dove va quello che la cucitura manda alla pagina, e come la si chiude.
abstract interface class VersoLaPagina {
  /// `false` quando la pagina non c'e' piu': si smette di scriverle.
  bool get aperta;

  void manda(String testo);

  Future<void> chiudi();
}

class Cucitura {
  Cucitura(this._verso, this._trovaIlFilo);

  final VersoLaPagina _verso;

  /// Il filo, quando c'e'. Si chiede al momento di entrare, e non prima:
  /// la pagina puo' aprirsi mentre l'app sta ancora cercando la casa.
  final Future<Filo?> Function() _trovaIlFilo;

  final _numeri = <int, int>{};
  final _finita = Completer<void>();

  Filo? _filo;
  StreamSubscription<StatoDelFilo>? _guardaIlFilo;
  bool _dentro = false;

  /// Quando la pagina se n'e' andata o il filo e' caduto.
  Future<void> get finita => _finita.future;

  Future<void> avvia() {
    unawaited(_entra());
    return _finita.future;
  }

  /// Un messaggio dalla pagina.
  Future<void> dallaPagina(String grezzo) async {
    final Map<String, dynamic> detto;
    try {
      final letto = jsonDecode(grezzo);
      if (letto is! Map<String, dynamic>) return;
      detto = letto;
    } catch (_) {
      return;
    }

    /* Un `auth` che arriva lo stesso si lascia cadere: qui non c'e' niente da
     * autenticare — il filo lo e' gia'. */
    if (!_dentro || detto['type'] == 'auth') return;

    final filo = _filo;
    if (filo == null || !filo.dentro) {
      await chiudi();
      return;
    }

    final suo = detto['id'];
    if (suo is! int) return;
    final tipo = detto['type'];
    final messaggio = Map<String, dynamic>.of(detto)..remove('id');

    if (tipo == 'unsubscribe_events') {
      final quale = messaggio['subscription'];
      final mio = quale is int ? _numeri.remove(quale) : null;
      if (mio != null) {
        messaggio['subscription'] = mio;
        filo.dimentica(mio);
      }
    }

    try {
      late final int mio;
      mio = filo.instrada(messaggio, (risposta) {
        _mandaTesto(risposta.conNumero(suo));
        if (continua('$tipo')) return;
        filo.dimentica(mio);
        _numeri.remove(suo);
      });
      _numeri[suo] = mio;
    } on FiloCaduto {
      await chiudi();
    }
  }

  static bool continua(String tipo) =>
      cheContinuano.contains(tipo) || tipo.startsWith('subscribe_');

  Future<void> _entra() async {
    final filo = await _trovaIlFilo();
    if (_finita.isCompleted) return;
    if (filo == null) {
      _manda({'type': 'auth_invalid', 'message': 'la casa non risponde'});
      await chiudi();
      return;
    }
    _filo = filo;
    _dentro = true;
    _guardaIlFilo = filo.stato.listen((stato) {
      if (stato != StatoDelFilo.dentro) unawaited(chiudi());
    });
    /* `auth_ok` e basta, appena il filo c'e': e' quello che la plancia
     * ospitata aspetta, e non manda nessun `auth`. */
    _manda({'type': 'auth_ok', 'ha_version': 'gdahome'});
  }

  void _manda(Map<String, dynamic> cosa) => _mandaTesto(jsonEncode(cosa));

  void _mandaTesto(String testo) {
    if (!_verso.aperta) return;
    try {
      _verso.manda(testo);
    } catch (_) {
      /* Chiusa fra il controllo e la scrittura. */
    }
  }

  /// La pagina se n'e' andata.
  void laPaginaSeNEAndata() {
    dimenticaTutto();
    if (!_finita.isCompleted) _finita.complete();
  }

  /// Si chiude da questa parte: il filo e' caduto, o il servitore si spegne.
  Future<void> chiudi() async {
    dimenticaTutto();
    try {
      await _verso.chiudi();
    } catch (_) {
      /* Gia' chiusa. */
    }
    if (!_finita.isCompleted) _finita.complete();
  }

  /// Si smette, **senza dire niente alla pagina**.
  ///
  /// Serve quando la pagina di prima non c'e' piu' — si e' ricaricata, o si e'
  /// aperta un'altra — e al suo posto c'e' una pagina nuova che sta per avere
  /// la sua cucitura. Dirle di chiudere vorrebbe dire chiudere il WebSocket
  /// **della nuova**, che nel browser vive nello stesso posto: cinque secondi
  /// di pallino rosso per una pagina che era gia' pronta.
  Future<void> abbandona() async {
    dimenticaTutto();
    _dentro = false;
    if (!_finita.isCompleted) _finita.complete();
  }

  void dimenticaTutto() {
    unawaited(_guardaIlFilo?.cancel());
    _guardaIlFilo = null;
    final filo = _filo;
    if (filo != null) {
      for (final mio in _numeri.values) {
        filo.dimentica(mio);
      }
    }
    _numeri.clear();
  }
}
