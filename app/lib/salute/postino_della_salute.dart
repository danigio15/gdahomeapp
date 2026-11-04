/// Chi porta la salute a casa: legge, manda, ricorda le scelte.
///
/// **Quando.** Appena il filo con la casa si apre — l'app che si apre, o che
/// torna davanti — e poi ogni quarto d'ora finche' l'app e' aperta. Mai piu'
/// spesso di cosi': le misure di un orologio non cambiano ogni minuto, e da
/// fuori casa ogni messaggio passa dal centralino. E anche ad app chiusa,
/// quando il telefono la sveglia ([mandaDaChiusa], `ad_app_chiusa.dart`),
/// con lo stesso quarto d'ora.
///
/// **Cosa.** Solo le misure scelte nella pagina «Salute», solo le ultime, e
/// solo alla casa di questo filo. Il ponte accetta le misure solo da un
/// telefono intestato a chi e' entrato, e ognuno scrive le sue
/// (`ponte/src/il-corpo-dal-telefono.js`).
library;

import 'dart:async';

import '../casa/dispensa/dispensa.dart';
import '../ponte/errori.dart';
import '../ponte/filo.dart';
import 'il_corpo.dart';
import 'lettore.dart';

/// Ogni quanto si manda, al massimo.
const ogniQuanto = Duration(minutes: 15);

/// Com'e' finita una sveglia ad app chiusa ([PostinoDellaSalute.mandaDaChiusa]).
enum ComeEAndataDaChiusa {
  /// Mandata alla casa.
  mandata,

  /// La salute e' spenta, o l'invio ad app chiusa, o la casa non e' Premium:
  /// non si legge niente.
  spenta,

  /// Meno di un quarto d'ora dall'ultimo invio, o un invio gia' in corso.
  presto,

  /// Il telefono e' bloccato: Salute non si lascia leggere finche' non si
  /// sblocca. Si riprova alla prossima sveglia.
  bloccato,

  /// La casa non si e' raggiunta.
  senzaCasa,

  /// Salute non ha dato niente: non si manda un messaggio vuoto.
  vuota,

  /// La casa ha detto di no (niente Premium, telefono non intestato).
  rifiutata,
}

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
  bool _letto = false;
  GuastoDellaSalute? _ultimoGuasto;
  Timer? _giro;

  ScelteDellaSalute get scelte => _scelte;
  Map<MisuraDelCorpo, Lettura> get ultimeLette => _ultimeLette;

  /// Se Salute o Health Connect sono gia' stati letti almeno una volta: solo
  /// dopo una lettura una misura senza valore vuol dire «non ce l'ha».
  bool get letto => _letto;

  /// Adesso, per chi scrive «1 nov» accanto a una misura vecchia.
  DateTime get adesso => _adesso();

  /// Perche' l'ultimo invio non e' andato, per la pagina. `null` se e'
  /// andato, o se non si e' ancora provato.
  GuastoDellaSalute? get ultimoGuasto => _ultimoGuasto;
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

  /// Accende: chiede il permesso al sistema e manda subito. `false` solo se
  /// il sistema non ha risposto al permesso; se e' la casa a dire di no
  /// resta acceso — riprovera' — e il perche' sta in [ultimoGuasto].
  Future<bool> accendi(Filo? filo, ScelteDellaSalute scelte) async {
    await carica();
    _daSpegnere = false;
    final risposto = await lettore.chiediIlPermesso(scelte.misure);
    if (!risposto) return false;
    await _salva(scelte.con(acceso: true).tutteViste());
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
    await _salva(scelte.acceso ? scelte.tutteViste() : scelte);
    if (scelte.acceso) await manda(filo, subito: true);
  }

  /// Spegne: la casa cancella i sensori, e qui non si manda piu' niente.
  Future<void> spegni(Filo? filo) async {
    await carica();
    await _salva(_scelte.con(acceso: false));
    _ultimeLette = const {};
    _letto = false;
    _ultimoGuasto = null;
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

  /// Se l'app sta davanti a qualcuno. Il giro del quarto d'ora e il filo che
  /// si apre mandano **solo** cosi': un'app partita da sola — svegliata da
  /// Salute, da CarPlay, da una notifica — chiederebbe permessi a nessuno e,
  /// col telefono bloccato, leggerebbe Salute vuota. Ad app chiusa manda
  /// [mandaDaChiusa], che sa come comportarsi. Lo mette `main.dart`.
  Future<bool> Function() davanti = () async => true;

  /// Manda, se e' ora: acceso, filo aperto, e un quarto d'ora dall'ultima.
  Future<void> forseManda(Filo? filo) async {
    await carica();
    if (!await davanti()) return;
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
      /* Le misure nuove dell'app, accese da sole: il permesso non c'e'
       * ancora, e senza Salute le tace. Si chiede una volta, qui, con l'app
       * davanti. */
      final daChiedere = _scelte.daChiedere;
      if (daChiedere.isNotEmpty) {
        await lettore.chiediIlPermesso(daChiedere);
        await _salva(_scelte.tutteViste());
      }
      /* Il permesso di leggere ad app chiusa (Android), una volta sola e
       * con l'app davanti: anche chi aveva acceso la Salute prima che ci
       * fosse lo trova chiesto qui, al primo invio. */
      if (_scelte.adAppChiusa && !_scelte.chiestoDaChiusa) {
        await lettore.chiediIlPermessoDaChiusa();
        await _salva(_scelte.con(chiestoDaChiusa: true));
      }
      final lette = await lettore.leggi(_scelte.misure, adesso: _adesso());
      _ultimeLette = lette;
      _letto = true;
      _avvisa();
      /* Niente di letto, con delle misure scelte: un messaggio vuoto
       * farebbe cancellare alla casa tutti i sensori, per una lettura
       * andata a vuoto (il permesso tolto, Salute che non risponde). Si
       * tiene quello che la casa ha, e la pagina dice cosa manca. */
      if (lette.isEmpty && _scelte.misure.isNotEmpty) return 0;
      await filo.risultato({
        'type': 'ponte/salute/misure',
        if (_scelte.persona.isNotEmpty) 'persona': _scelte.persona,
        'misure': perIlPonte(lette, _scelte.misure),
      });
      _ultimoGuasto = null;
      await _salva(_scelte.con(ultimoInvio: _adesso(), ultimoDaChiusa: false));
      return lette.length;
    } on ComandoRifiutato catch (no) {
      _ultimoGuasto = GuastoDellaSalute.daCodice(no.codice);
      _avvisa();
      return null;
    } catch (_) {
      _ultimoGuasto = GuastoDellaSalute.casaNonRisponde;
      _avvisa();
      return null;
    } finally {
      _mandando = false;
    }
  }

  /// Ad app chiusa: il telefono ha svegliato l'app per un dato nuovo in
  /// Salute (iPhone) o per il giro di Android, e nessuno sta guardando.
  ///
  /// Come [forseManda], con tre differenze:
  /// - **niente permessi da chiedere**: non c'e' nessuno a cui chiederli.
  ///   Una misura accesa ma ancora senza permesso ([ScelteDellaSalute.daChiedere])
  ///   aspetta l'app aperta;
  /// - **niente messaggio vuoto**: se Salute non da' niente, non si manda;
  /// - **le misure non lette restano a casa** (`aggiungi`): una lettura
  ///   andata storta in tasca non deve cancellare i sensori in Home
  ///   Assistant. A toglierle ci pensa l'invio ad app aperta, che manda
  ///   l'elenco intero.
  Future<ComeEAndataDaChiusa> mandaDaChiusa(Filo? filo) async {
    await carica();
    if (!_scelte.acceso || !_scelte.adAppChiusa || !sbloccata()) {
      return ComeEAndataDaChiusa.spenta;
    }
    final ultimo = _scelte.ultimoInvio;
    if (_mandando ||
        (ultimo != null && _adesso().difference(ultimo) < ogniQuanto)) {
      return ComeEAndataDaChiusa.presto;
    }
    if (filo == null || !filo.dentro) return ComeEAndataDaChiusa.senzaCasa;
    _mandando = true;
    try {
      final misure = _scelte.misure.difference(_scelte.daChiedere);
      final lette = await lettore.leggi(misure, adesso: _adesso());
      if (lette.isEmpty) return ComeEAndataDaChiusa.vuota;
      _ultimeLette = lette;
      _letto = true;
      _avvisa();
      await filo.risultato({
        'type': 'ponte/salute/misure',
        if (_scelte.persona.isNotEmpty) 'persona': _scelte.persona,
        'misure': perIlPonte(lette, misure),
        'aggiungi': true,
      });
      _ultimoGuasto = null;
      await _salva(_scelte.con(ultimoInvio: _adesso(), ultimoDaChiusa: true));
      return ComeEAndataDaChiusa.mandata;
    } on ComandoRifiutato catch (no) {
      _ultimoGuasto = GuastoDellaSalute.daCodice(no.codice);
      _avvisa();
      return ComeEAndataDaChiusa.rifiutata;
    } catch (_) {
      return ComeEAndataDaChiusa.senzaCasa;
    } finally {
      _mandando = false;
    }
  }

  /// Accende o spegne l'invio ad app chiusa.
  Future<void> cambiaAdAppChiusa(bool si) async {
    await carica();
    if (si && _scelte.acceso) await lettore.chiediIlPermessoDaChiusa();
    await _salva(
      _scelte.con(adAppChiusa: si, chiestoDaChiusa: si ? true : null),
    );
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
