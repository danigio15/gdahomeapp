/// Le impostazioni dell'app: poche, e tutte con un perche'.
///
/// Niente Flutter qui dentro: si prova senza uno schermo.
library;

import 'dart:async';
import 'dart:convert';

import '../parole.dart';
import 'dispensa/dispensa.dart';
import 'il_lucchetto.dart';

class Impostazioni {
  Impostazioni({
    required bool sulTelefono,
    required bool android,
    Dispensa? dispensa,
  }) : _dispensa = dispensa ?? dispensaDiQuestoSistema(),
       /* Spenta di serie, su tutto: vedi [planciaLeggera]. */
       _planciaLeggera = false,
       _composizioneIbrida = android,
       // ignore: prefer_initializing_formals
       _sulTelefono = sulTelefono,
       _android = android;

  final Dispensa _dispensa;
  final bool _sulTelefono;
  final bool _android;
  final _cambiamenti = StreamController<void>.broadcast();

  bool _planciaLeggera;
  bool _composizioneIbrida;
  /* Spento di serie, e non e' pigrizia: acceso di nascosto vorrebbe dire che
   * chi aggiorna l'app si trova davanti una richiesta che non ha chiesto, su
   * un telefono che magari il volto non ce l'ha nemmeno registrato. */
  IlLucchetto _lucchetto = IlLucchetto.spento;

  /* Il tema, la tavolozza e la barra della plancia qui non ci sono, e ci
   * sono stati.
   *
   * Sono tre comandi della pagina Config della plancia — «su questo
   * dispositivo», lo scrive lei — e la pagina se li tiene nel deposito
   * locale del riquadro, che dura. Tenerli anche qui voleva dire due
   * padroni: l'app li riscriveva nella pagina a ogni caricamento, e la
   * scelta fatta dalle tessere della dashboard spariva. Adesso la pagina si
   * apre dal menu e i suoi comandi sono i suoi. Vedi
   * `plancia/premesse.dart`. */
  bool _caricate = false;

  /// La plancia senza le sfocature dietro le tessere e senza le animazioni
  /// che non finiscono mai.
  ///
  /// **Spenta di serie**, dappertutto: la plancia si vede com'e' stata
  /// disegnata, animazioni comprese, e l'app deve reggerla cosi'. E' un
  /// interruttore per un telefono che proprio non ce la fa, e lo si accende
  /// a mano da «Come va l'app», sapendo che la plancia cambia aspetto.
  bool get planciaLeggera => _planciaLeggera;

  /// Su Android: il riquadro della plancia disegnato dal sistema per conto
  /// suo (composizione ibrida) invece che ridisegnato da Flutter a ogni
  /// fotogramma. Una plancia che si muove sempre pesa meno cosi'.
  bool get composizioneIbrida => _composizioneIbrida && _android;

  /// Il volto e l'impronta davanti all'app: cosa e' acceso.
  IlLucchetto get lucchetto => _lucchetto;

  bool get sulTelefono => _sulTelefono;
  bool get android => _android;
  bool get caricate => _caricate;

  /// Scatta quando qualcosa cambia.
  Stream<void> get cambiamenti => _cambiamenti.stream;

  /// Legge quello che c'era: si chiama una volta, all'avvio.
  Future<void> carica() async {
    try {
      final testo = await _dispensa.leggi();
      if (testo != null && testo.isNotEmpty) {
        final letto = jsonDecode(testo);
        if (letto is Map) {
          if (letto['plancia_leggera'] is bool) {
            _planciaLeggera = letto['plancia_leggera'] as bool;
          }
          if (letto['composizione_ibrida'] is bool) {
            _composizioneIbrida = letto['composizione_ibrida'] as bool;
          }
          if (letto['lucchetto'] != null) {
            _lucchetto = IlLucchetto.daQuelloCheCEra(letto['lucchetto']);
          }
        }
      }
    } catch (_) {
      /* Un file storto vale come nessun file. */
    }
    _caricate = true;
    _avvisa();
  }

  Future<void> metti({
    bool? planciaLeggera,
    bool? composizioneIbrida,
    IlLucchetto? lucchetto,
  }) async {
    var cambiato = false;
    if (lucchetto != null) {
      _lucchetto = lucchetto;
      cambiato = true;
    }
    if (planciaLeggera != null && planciaLeggera != _planciaLeggera) {
      _planciaLeggera = planciaLeggera;
      cambiato = true;
    }
    if (composizioneIbrida != null &&
        composizioneIbrida != _composizioneIbrida) {
      _composizioneIbrida = composizioneIbrida;
      cambiato = true;
    }
    if (!cambiato) return;
    _avvisa();
    await _dispensa.scrivi(
      jsonEncode({
        'plancia_leggera': _planciaLeggera,
        'composizione_ibrida': _composizioneIbrida,
        'lucchetto': _lucchetto.comeSiScrive,
      }),
    );
  }

  /// In due parole, per la diagnostica.
  String get riassunto => [
    if (_sulTelefono) 'telefono' else 'browser',
    if (planciaLeggera)
      inLingua(it: 'plancia leggera', en: 'light dashboard')
    else
      inLingua(it: 'plancia piena', en: 'full dashboard'),
    if (_android) composizioneIbrida ? 'ibrida' : 'tessitura',
    if (_lucchetto.acceso) inLingua(it: 'lucchetto', en: 'lock'),
  ].join(', ');

  void _avvisa() {
    if (!_cambiamenti.isClosed) _cambiamenti.add(null);
  }

  Future<void> chiudi() async {
    if (!_cambiamenti.isClosed) await _cambiamenti.close();
  }
}
