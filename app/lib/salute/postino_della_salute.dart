/// Chi porta la salute a casa: legge, manda, ricorda le scelte.
///
/// **Quando.** Appena il filo con la casa si apre — l'app che si apre, o che
/// torna davanti — e poi ogni quarto d'ora finche' l'app e' aperta. Mai piu'
/// spesso di cosi': le misure di un orologio non cambiano ogni minuto, e da
/// fuori casa ogni messaggio passa dal centralino. Ad app chiusa no: i
/// sistemi non lasciano leggere Salute o Health Connect a un'app che dorme
/// senza permessi in piu', e quei permessi si chiedono solo quando serviranno.
///
/// **Cosa.** Solo le misure scelte nella pagina «Salute», solo le ultime, e
/// solo alla casa di questo filo. Il ponte accetta le misure solo da un
/// telefono intestato a chi e' entrato, e ognuno scrive le sue
/// (`ponte/src/il-corpo-dal-telefono.js`).
library;

import 'dart:async';

import '../casa/dispensa/dispensa.dart';
import '../ponte/filo.dart';
import 'il_corpo.dart';
import 'lettore.dart';

/// Ogni quanto si manda, al massimo.
const ogniQuanto = Duration(minutes: 15);

class PostinoDellaSalute {
  PostinoDellaSalute({
    required this.lettore,
    Dispensa? dispensa,
    DateTime Function()? adesso,
  }) : _dispensa = dispensa ?? dispensaDiQuestoSistema(nome: 'salute.json'),
       _adesso = adesso ?? DateTime.now;

  /// Quello dell'app: c'e' dopo [accendi] in `main.dart`.
  static PostinoDellaSalute? istanza;

  final LettoreDellaSalute lettore;
  final Dispensa _dispensa;
  final DateTime Function() _adesso;
  final _cambiamenti = StreamController<void>.broadcast();

  ScelteDellaSalute _scelte = const ScelteDellaSalute();
  bool _caricate = false;
  bool _mandando = false;
  Map<MisuraDelCorpo, Lettura> _ultimeLette = const {};
  String? _ultimoGuasto;
  Timer? _giro;

  ScelteDellaSalute get scelte => _scelte;
  Map<MisuraDelCorpo, Lettura> get ultimeLette => _ultimeLette;

  /// L'ultimo «non ha funzionato», per la pagina. `null` se e' andata.
  String? get ultimoGuasto => _ultimoGuasto;
  Stream<void> get cambiamenti => _cambiamenti.stream;

  Future<ScelteDellaSalute> carica() async {
    if (_caricate) return _scelte;
    _scelte = ScelteDellaSalute.daQuelloCheCEra(await _dispensa.leggi());
    _caricate = true;
    _avvisa();
    return _scelte;
  }

  Future<void> _salva(ScelteDellaSalute scelte) async {
    _scelte = scelte;
    _avvisa();
    await _dispensa.scrivi(scelte.comeSiScrive);
  }

  void _avvisa() {
    if (!_cambiamenti.isClosed) _cambiamenti.add(null);
  }

  /// Accende: chiede il permesso al sistema e manda subito.
  Future<bool> accendi(Filo? filo, ScelteDellaSalute scelte) async {
    await carica();
    _daSpegnere = false;
    final risposto = await lettore.chiediIlPermesso(scelte.misure);
    if (!risposto) return false;
    await _salva(scelte.con(acceso: true));
    await manda(filo, subito: true);
    return true;
  }

  /// Cambia nome o misure: se e' acceso, chiede il permesso per quelle nuove
  /// e manda subito, cosi' la casa toglie quelle tolte.
  Future<void> cambia(Filo? filo, ScelteDellaSalute scelte) async {
    await carica();
    final nuove = scelte.misure.difference(_scelte.misure);
    if (scelte.acceso && nuove.isNotEmpty) {
      await lettore.chiediIlPermesso(nuove);
    }
    await _salva(scelte);
    if (scelte.acceso) await manda(filo, subito: true);
  }

  /// Spegne: la casa cancella i sensori, e qui non si manda piu' niente.
  Future<void> spegni(Filo? filo) async {
    await carica();
    await _salva(_scelte.con(acceso: false));
    _ultimeLette = const {};
    _daSpegnere = true;
    await _diglieloAllaCasa(filo);
    _avvisa();
  }

  /* «Spegni» che non e' arrivato — filo giu', casa lontana — si ridice la
   * prossima volta che il filo c'e'. E se l'app si chiude prima, il ponte
   * cancella comunque le misure di un telefono staccato dalla casa. */
  bool _daSpegnere = false;

  Future<void> _diglieloAllaCasa(Filo? filo) async {
    if (!_daSpegnere || filo == null || !filo.dentro) return;
    try {
      await filo.risultato({'type': 'ponte/salute/spegni'});
      _daSpegnere = false;
    } catch (_) {}
  }

  /// Se questa casa e' Premium: la salute dal telefono e' di GdAHome
  /// Premium. Senza, non si legge e non si manda niente — il ponte
  /// direbbe comunque di no (`premium-richiesto`) — ma spegnere si puo'.
  bool Function() sbloccata = () => true;

  /// Manda, se e' ora: acceso, filo aperto, e un quarto d'ora dall'ultima.
  Future<void> forseManda(Filo? filo) async {
    await carica();
    if (!sbloccata()) {
      await _diglieloAllaCasa(filo);
      return;
    }
    if (!_scelte.acceso) {
      await _diglieloAllaCasa(filo);
      return;
    }
    final ultimo = _scelte.ultimoInvio;
    if (ultimo != null && _adesso().difference(ultimo) < ogniQuanto) return;
    await manda(filo);
  }

  /// Legge e manda. Torna quante misure sono andate, o `null` se non e'
  /// andata.
  Future<int?> manda(Filo? filo, {bool subito = false}) async {
    if (_mandando || !_scelte.acceso || !sbloccata()) return null;
    if (filo == null || !filo.dentro) return null;
    _mandando = true;
    try {
      final lette = await lettore.leggi(_scelte.misure, adesso: _adesso());
      _ultimeLette = lette;
      await filo.risultato({
        'type': 'ponte/salute/misure',
        if (_scelte.persona.isNotEmpty) 'persona': _scelte.persona,
        'misure': perIlPonte(lette, _scelte.misure),
      });
      _ultimoGuasto = null;
      await _salva(_scelte.con(ultimoInvio: _adesso()));
      return lette.length;
    } catch (errore) {
      _ultimoGuasto = '$errore';
      _avvisa();
      return null;
    } finally {
      _mandando = false;
    }
  }

  /// Segue un filo: manda quando si apre, e ogni quarto d'ora.
  void segui(Filo? Function() ilFilo, Stream<void> cambiamenti) {
    _ascolto?.cancel();
    _ascolto = cambiamenti.listen((_) => unawaited(forseManda(ilFilo())));
    _giro?.cancel();
    _giro = Timer.periodic(ogniQuanto, (_) => unawaited(forseManda(ilFilo())));
    unawaited(forseManda(ilFilo()));
  }

  StreamSubscription<void>? _ascolto;

  void ferma() {
    _giro?.cancel();
    _giro = null;
    _ascolto?.cancel();
    _ascolto = null;
  }
}
