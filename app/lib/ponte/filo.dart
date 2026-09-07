/// Il filo: il collegamento vivo fra l'app e la casa.
///
/// Sul filo si parla il **protocollo di Home Assistant**, non un protocollo
/// nostro: il ponte si presenta come Home Assistant apposta. La conseguenza
/// pratica e' che questa classe funziona identica puntata a un ponte o puntata
/// dritta a un Home Assistant, e nessuno dei due lati e' incastrato con
/// l'altro.
///
/// Le tre cose che questa classe fa e che sembrano dettagli ma non lo sono:
///
///  - **la riconnessione**. Un telefono passa dal Wi-Fi al 4G, entra in
///    ascensore, si mette in tasca. Il filo cade continuamente, ed e' normale:
///    quello che non deve succedere e' che l'app se ne accorga.
///  - **le sottoscrizioni che risalgono da sole**. Dopo una caduta, Home
///    Assistant non si ricorda di niente. Chi si era sottoscritto agli eventi
///    smetterebbe di ricevere per sempre, in silenzio, che e' il peggiore dei
///    modi di rompersi. Qui le sottoscrizioni vengono rifatte.
///  - **le richieste in attesa che muoiono subito**. Una richiesta partita
///    prima della caduta non avra' mai risposta: farla fallire adesso e'
///    meglio che lasciare l'app ferma a girare una rotella.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:web_socket_channel/web_socket_channel.dart';

import 'errori.dart';
import 'indirizzo.dart';

enum StatoDelFilo {
  /// Mai aperto, o chiuso apposta.
  spento,

  /// Sta bussando, o sta aspettando prima di ribussare.
  chiamando,

  /// Dentro: la stretta di mano e' andata.
  dentro,
}

/// Come si apre il canale. Sostituibile nelle prove.
typedef ApriIlCanale = WebSocketChannel Function(Uri dove);

/// Dove bussare, chiesto *adesso*.
///
/// E' una funzione e non un indirizzo, ed e' li' che sta il funzionamento
/// fuori casa. L'indirizzo si ricalcola **a ogni tentativo**: chi esce dal
/// portone perde il filo sull'indirizzo di rete locale, e al tentativo dopo la
/// sonda risponde con quello di fuori. Nessuno tocca niente, e la casa e'
/// sempre la stessa istanza.
typedef TrovaLApprodo = Future<IndirizzoDelPonte> Function();

WebSocketChannel _canaleVero(Uri dove) => WebSocketChannel.connect(dove);

class Filo {
  Filo({
    required TrovaLApprodo approdo,
    required this.segno,
    ApriIlCanale? apri,
    this.attesaMassima = const Duration(seconds: 30),
    this.attesaDellaRisposta = const Duration(seconds: 20),
  }) : _trovaLApprodo = approdo,
       _apri = apri ?? _canaleVero;

  /// Un filo verso un indirizzo solo, che non cambia mai.
  ///
  /// Serve alle prove e a chi punta dritto a un Home Assistant senza ponte.
  Filo.fisso({
    required IndirizzoDelPonte indirizzo,
    required String segno,
    ApriIlCanale? apri,
    Duration attesaMassima = const Duration(seconds: 30),
    Duration attesaDellaRisposta = const Duration(seconds: 20),
  }) : this(
         approdo: (() async => indirizzo),
         segno: segno,
         apri: apri,
         attesaMassima: attesaMassima,
         attesaDellaRisposta: attesaDellaRisposta,
       );

  final TrovaLApprodo _trovaLApprodo;
  final String segno;
  final ApriIlCanale _apri;

  /// Oltre questa non si aspetta di piu' fra un tentativo e l'altro.
  final Duration attesaMassima;

  /// Quanto vive una richiesta senza risposta.
  final Duration attesaDellaRisposta;

  final _stato = StreamController<StatoDelFilo>.broadcast();
  final _inAttesa = <int, Completer<Map<String, dynamic>>>{};
  final _sottoscrizioni = <int, _Sottoscrizione>{};

  WebSocketChannel? _canale;
  IndirizzoDelPonte? _approdo;
  StreamSubscription<dynamic>? _ascolto;
  Completer<void>? _stretta;
  Timer? _riprova;
  int _prossimoId = 1;
  int _tentativi = 0;
  bool _spentoApposta = false;
  StatoDelFilo _adesso = StatoDelFilo.spento;

  /// Come sta il filo, adesso e mano a mano che cambia.
  Stream<StatoDelFilo> get stato => _stato.stream;
  StatoDelFilo get statoAdesso => _adesso;
  bool get dentro => _adesso == StatoDelFilo.dentro;

  /// Su quale indirizzo si e' entrati, l'ultima volta che si e' entrati.
  /// Serve a dire a schermo se si sta passando da dentro casa o da fuori.
  IndirizzoDelPonte? get approdoAdesso => _approdo;

  /// Apre il filo e torna quando la stretta di mano e' andata.
  ///
  /// Tre esiti, e sono tre cose diverse per chi guarda lo schermo:
  ///
  ///  - **torna**: si e' dentro;
  ///  - **[SegnoRifiutato]**: il telefono e' stato staccato dalla console, e
  ///    non si riprova perche' riprovare non cambierebbe niente;
  ///  - **[PonteIrraggiungibile]**: non si trova la casa. Arriva **appena** il
  ///    primo giro di ricerca ha finito, con la spiegazione di chi ha cercato,
  ///    non dopo [entro] con una spiegazione nostra; [entro] resta come rete
  ///    di sicurezza per il caso in cui un indirizzo risponda ma poi la
  ///    stretta di mano non finisca mai. I tentativi *continuano* per conto
  ///    loro — un telefono che rientra in casa si ricollega da solo — ma chi
  ///    aspettava ha una risposta invece di una rotella che gira per sempre.
  Future<void> apri({Duration entro = const Duration(seconds: 25)}) {
    if (dentro) return Future.value();
    if (_stretta != null && !_stretta!.isCompleted) return _stretta!.future;
    _spentoApposta = false;
    _tentativi = 0;
    final stretta = Completer<void>();
    _stretta = stretta;
    unawaited(_bussa());
    return stretta.future.timeout(
      entro,
      onTimeout: () =>
          throw const PonteIrraggiungibile('il ponte non risponde'),
    );
  }

  Future<void> _bussa() async {
    _cambia(StatoDelFilo.chiamando);

    final IndirizzoDelPonte dove;
    try {
      dove = await _trovaLApprodo();
    } catch (errore) {
      /* Nessun indirizzo risponde. I tentativi vanno avanti — il telefono puo'
       * essere in galleria, e fra un minuto no — ma **la prima volta chi
       * aspetta lo viene a sapere subito**, e con la spiegazione vera.
       *
       * Senza questo, chi apre l'app su una casa spenta guarda una rotella per
       * venticinque secondi e poi legge «il ponte non risponde», che e' la
       * nostra scadenza e non un motivo. Chi cerca la casa sa molto di piu':
       * sa se manca l'indirizzo pubblico, o se non risponde nessuno dei due. */
      final primaVolta = _tentativi == 0;
      _caduto('non trovo la casa da nessuna parte');
      if (primaVolta) {
        final stretta = _stretta;
        if (stretta != null && !stretta.isCompleted) {
          stretta.completeError(
            errore is ErroreDelPonte
                ? errore
                : PonteIrraggiungibile('non trovo la casa da nessuna parte'),
          );
        }
      }
      return;
    }
    /* Fra la domanda e la risposta l'app puo' essere stata chiusa, o l'utente
     * puo' aver cambiato casa. */
    if (_spentoApposta) return;

    try {
      final canale = _apri(dove.filo);
      _canale = canale;
      _approdo = dove;
      /* Il canale racconta i suoi guai in tre posti, non in uno: lo stream,
       * `ready` e `done`. Quello che conta e' `stream`, ed e' li' che si
       * decide; gli altri due vanno comunque *guardati*, perche' un futuro che
       * fallisce senza che nessuno lo guardi in Dart e' un errore non gestito
       * che salta fuori altrove — dentro una prova che non c'entra niente, o
       * in mano all'utente. */
      unawaited(canale.ready.catchError((Object _) {}));
      unawaited(canale.sink.done.catchError((Object _) => null));
      _ascolto = canale.stream.listen(
        _arrivato,
        onError: (Object errore) => _caduto('il filo si e\' interrotto'),
        onDone: () => _caduto('il filo si e\' chiuso'),
        cancelOnError: false,
      );
    } catch (_) {
      _caduto('non riesco ad aprire il filo');
    }
  }

  /* ─── Quello che arriva ────────────────────────────────────────────────── */

  void _arrivato(dynamic grezzo) {
    final Map<String, dynamic> detto;
    try {
      final letto = jsonDecode(
        grezzo is String ? grezzo : utf8.decode(grezzo as List<int>),
      );
      if (letto is! Map<String, dynamic>) return;
      detto = letto;
    } catch (_) {
      /* Roba che non e' JSON non e' Home Assistant: si lascia perdere invece
       * di far cadere il filo per colpa di un byte. */
      return;
    }

    switch (detto['type']) {
      case 'auth_required':
        _manda({'type': 'auth', 'access_token': segno});
      case 'auth_ok':
        _entrato();
      case 'auth_invalid':
        _segnoNonVale(
          detto['message'] as String? ?? 'il segno non e\' piu\' valido',
        );
      case 'result':
        _risposta(detto);
      case 'event':
        _evento(detto);
      case 'pong':
        break;
    }
  }

  void _entrato() {
    _tentativi = 0;
    _cambia(StatoDelFilo.dentro);
    if (_stretta != null && !_stretta!.isCompleted) _stretta!.complete();
    _rifaiLeSottoscrizioni();
  }

  void _risposta(Map<String, dynamic> detto) {
    final id = detto['id'];
    if (id is! int) return;
    final chiAspetta = _inAttesa.remove(id);
    if (chiAspetta == null || chiAspetta.isCompleted) return;
    if (detto['success'] == true) {
      chiAspetta.complete(detto);
      return;
    }
    final male = detto['error'];
    final messaggio = male is Map ? male['message'] as String? : null;
    final codice = male is Map ? male['code'] as String? : null;
    chiAspetta.completeError(
      ComandoRifiutato(
        messaggio ?? 'Home Assistant ha rifiutato il comando',
        codice: codice,
      ),
    );
  }

  void _evento(Map<String, dynamic> detto) {
    final id = detto['id'];
    if (id is! int) return;
    final sottoscritta = _sottoscrizioni[id];
    if (sottoscritta == null || sottoscritta.uscita.isClosed) return;
    final evento = detto['event'];
    if (evento is Map<String, dynamic>) sottoscritta.uscita.add(evento);
  }

  /* ─── I comandi ────────────────────────────────────────────────────────── */

  /// Manda un comando e aspetta la risposta.
  Future<Map<String, dynamic>> chiedi(Map<String, dynamic> comando) {
    if (!dentro) {
      return Future.error(const FiloCaduto('il filo non e\' aperto'));
    }
    final id = _prossimoId++;
    final chiAspetta = Completer<Map<String, dynamic>>();
    _inAttesa[id] = chiAspetta;
    _manda({...comando, 'id': id});

    /* Una richiesta senza risposta non resta appesa per sempre: Home Assistant
     * puo' non rispondere a un comando che non conosce, e senza questa
     * scadenza l'app aspetterebbe fino alla prossima caduta del filo. */
    return chiAspetta.future.timeout(
      attesaDellaRisposta,
      onTimeout: () {
        _inAttesa.remove(id);
        throw const FiloCaduto('Home Assistant non ha risposto in tempo');
      },
    );
  }

  /// Il risultato del comando, gia' spacchettato.
  Future<dynamic> risultato(Map<String, dynamic> comando) async =>
      (await chiedi(comando))['result'];

  /// Si sottoscrive, e resta sottoscritto anche dopo una caduta del filo.
  ///
  /// Chiudere lo stream che torna dice a Home Assistant di smettere.
  Future<Stream<Map<String, dynamic>>> sottoscrivi(
    Map<String, dynamic> comando,
  ) async {
    final risposta = await chiedi(comando);
    final id = risposta['id'] as int;
    final sottoscritta = _Sottoscrizione(
      comando: comando,
      uscita: StreamController.broadcast(),
    );
    _sottoscrizioni[id] = sottoscritta;
    sottoscritta.uscita.onCancel = () async {
      if (sottoscritta.uscita.hasListener) return;
      _sottoscrizioni.remove(id);
      if (dentro) {
        /* Un `unsubscribe_events` su un filo caduto non serve a niente, e la
         * sua risposta non arriverebbe mai. */
        unawaited(
          chiedi({'type': 'unsubscribe_events', 'subscription': id})
              .catchError((_) => <String, dynamic>{}),
        );
      }
      await sottoscritta.uscita.close();
    };
    return sottoscritta.uscita.stream;
  }

  /// Dopo una riconnessione Home Assistant non si ricorda di niente: le
  /// sottoscrizioni si rifanno, e prendono un numero nuovo.
  void _rifaiLeSottoscrizioni() {
    if (_sottoscrizioni.isEmpty) return;
    final vecchie = Map<int, _Sottoscrizione>.from(_sottoscrizioni);
    _sottoscrizioni.clear();
    for (final sottoscritta in vecchie.values) {
      chiedi(sottoscritta.comando).then(
        (risposta) => _sottoscrizioni[risposta['id'] as int] = sottoscritta,
        onError: (Object errore) {
          if (!sottoscritta.uscita.isClosed) {
            sottoscritta.uscita.addError(errore);
          }
        },
      );
    }
  }

  void _manda(Map<String, dynamic> cosa) {
    final canale = _canale;
    if (canale == null) return;
    try {
      canale.sink.add(jsonEncode(cosa));
    } catch (_) {
      _caduto('non riesco a scrivere sul filo');
    }
  }

  /* ─── Quando cade ──────────────────────────────────────────────────────── */

  void _caduto(String perche) {
    _stacca();
    /* Le richieste in volo muoiono: la loro risposta non arrivera' mai. Ma chi
     * sta aspettando di *entrare* no — il filo sta per ribussare, e se
     * riesce quella attesa si scioglie da sola. Farla fallire a ogni caduta
     * vorrebbe dire che un telefono che si riconnette da solo risulta comunque
     * fallito a chi aveva chiamato `apri`. */
    _faFallireLeRichieste(FiloCaduto(perche), ancheLaStretta: false);
    if (_spentoApposta) {
      _cambia(StatoDelFilo.spento);
      return;
    }
    _cambia(StatoDelFilo.chiamando);

    final quanto = _quantoAspettare();
    _tentativi += 1;

    _riprova?.cancel();
    _riprova = Timer(quanto, () {
      if (_spentoApposta) return;
      unawaited(_bussa());
    });
  }

  /// Quanto si aspetta prima del prossimo tentativo.
  ///
  /// Raddoppia a ogni buca — un secondo, due, quattro — e si ferma alla
  /// [attesaMassima]. Il caso dentro non e' un vezzo: senza, tutti i telefoni
  /// di casa ribussano nello stesso millesimo dopo un riavvio del router, e il
  /// ponte prende una martellata invece di qualche richiesta.
  Duration _quantoAspettare() {
    final quanto = min(
      attesaMassima.inMilliseconds,
      1000 * (1 << min(_tentativi, 5)),
    );
    return Duration(
      milliseconds: quanto ~/ 2 + Random().nextInt(quanto ~/ 2 + 1),
    );
  }

  /// Il segno non vale: non si riprova, perche' non cambierebbe niente.
  void _segnoNonVale(String perche) {
    _spentoApposta = true;
    _stacca();
    final errore = SegnoRifiutato(perche);
    _faFallireLeRichieste(errore);
    if (_stretta != null && !_stretta!.isCompleted) {
      _stretta!.completeError(errore);
    }
    _cambia(StatoDelFilo.spento);
  }

  void _faFallireLeRichieste(
    ErroreDelPonte errore, {
    bool ancheLaStretta = true,
  }) {
    final appese = List.of(_inAttesa.values);
    _inAttesa.clear();
    for (final chiAspetta in appese) {
      if (!chiAspetta.isCompleted) chiAspetta.completeError(errore);
    }
    if (!ancheLaStretta) return;
    final stretta = _stretta;
    if (stretta != null && !stretta.isCompleted) stretta.completeError(errore);
  }

  void _stacca() {
    _approdo = null;
    _ascolto?.cancel();
    _ascolto = null;
    try {
      _canale?.sink.close();
    } catch (_) {
      /* Gia' chiusa. */
    }
    _canale = null;
  }

  void _cambia(StatoDelFilo nuovo) {
    if (_adesso == nuovo) return;
    _adesso = nuovo;
    if (!_stato.isClosed) _stato.add(nuovo);
  }

  /// Chiude il filo e non riprova piu'.
  Future<void> chiudi() async {
    _spentoApposta = true;
    _riprova?.cancel();
    _riprova = null;
    _stacca();
    _faFallireLeRichieste(const FiloCaduto('il filo e\' stato chiuso'));
    /* Prima si prende la lista e si svuota la mappa, poi si chiude.
     * Chiudere una sottoscrizione fa scattare il suo `onCancel`, che si toglie
     * dalla mappa: farlo mentre la si sta scorrendo la rompe a meta'. */
    final aperte = List.of(_sottoscrizioni.values);
    _sottoscrizioni.clear();
    for (final sottoscritta in aperte) {
      if (!sottoscritta.uscita.isClosed) await sottoscritta.uscita.close();
    }
    _cambia(StatoDelFilo.spento);
    await _stato.close();
  }
}

class _Sottoscrizione {
  _Sottoscrizione({required this.comando, required this.uscita});
  final Map<String, dynamic> comando;
  final StreamController<Map<String, dynamic>> uscita;
}
