/// Le impostazioni dell'app: poche, e tutte con un perche'.
///
/// Niente Flutter qui dentro: si prova senza uno schermo.
library;

import 'dart:async';
import 'dart:convert';

import 'dispensa/dispensa.dart';

class Impostazioni {
  Impostazioni({
    required bool sulTelefono,
    required bool android,
    Dispensa? dispensa,
  }) : _dispensa = dispensa ?? dispensaDiQuestoSistema(),
       /* Spenta di serie, su tutto: vedi [planciaLeggera]. */
       _planciaLeggera = false,
       _composizioneIbrida = android,
       _temaDellaPlancia = 'auto',
       _barraDellaPlancia = 'scomparsa',
       // ignore: prefer_initializing_formals
       _sulTelefono = sulTelefono,
       _android = android;

  final Dispensa _dispensa;
  final bool _sulTelefono;
  final bool _android;
  final _cambiamenti = StreamController<void>.broadcast();

  bool _planciaLeggera;
  bool _composizioneIbrida;

  /* Il tema e la barra della plancia.
   *
   * Nella dashboard stanno nella sua pagina Config, e non viaggiano col resto
   * della configurazione: sono di **questo dispositivo**, e la dashboard li
   * tiene apposta fuori dalle chiavi che si sincronizzano — il tablet in
   * cucina puo' stare sullo scuro mentre il telefono segue il sistema. Quando
   * la Config esce dalla plancia devono uscire con lei, se no si perdono; e
   * siccome sono del dispositivo li tiene l'app, e il servitore li scrive
   * nella pagina prima che parta. */
  String _temaDellaPlancia;
  String _barraDellaPlancia;
  bool _caricate = false;

  /// La plancia senza le sfocature dietro le tessere e senza le animazioni
  /// che non finiscono mai.
  ///
  /// **Spenta di serie**, dappertutto: la plancia si vede com'e' stata
  /// disegnata, animazioni comprese, e l'app deve reggerla cosi'. E' un
  /// interruttore per un telefono che proprio non ce la fa, e lo si accende
  /// a mano da «Come va l'app», sapendo che la plancia cambia aspetto.
  bool get planciaLeggera => _planciaLeggera;

  /// `auto`, `chiaro` o `scuro`. `auto` segue il tema del telefono.
  String get temaDellaPlancia => _temaDellaPlancia;

  /// `scomparsa` o `fissa`: come sta la barra in fondo alla plancia.
  String get barraDellaPlancia => _barraDellaPlancia;

  /// Su Android: il riquadro della plancia disegnato dal sistema per conto
  /// suo (composizione ibrida) invece che ridisegnato da Flutter a ogni
  /// fotogramma. Una plancia che si muove sempre pesa meno cosi'.
  bool get composizioneIbrida => _composizioneIbrida && _android;

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
          if (letto['tema_della_plancia'] is String) {
            _temaDellaPlancia = letto['tema_della_plancia'] as String;
          }
          if (letto['barra_della_plancia'] is String) {
            _barraDellaPlancia = letto['barra_della_plancia'] as String;
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
    String? temaDellaPlancia,
    String? barraDellaPlancia,
  }) async {
    var cambiato = false;
    if (planciaLeggera != null && planciaLeggera != _planciaLeggera) {
      _planciaLeggera = planciaLeggera;
      cambiato = true;
    }
    if (temaDellaPlancia != null && temaDellaPlancia != _temaDellaPlancia) {
      _temaDellaPlancia = temaDellaPlancia;
      cambiato = true;
    }
    if (barraDellaPlancia != null && barraDellaPlancia != _barraDellaPlancia) {
      _barraDellaPlancia = barraDellaPlancia;
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
        'tema_della_plancia': _temaDellaPlancia,
        'barra_della_plancia': _barraDellaPlancia,
      }),
    );
  }

  /// In due parole, per la diagnostica.
  String get riassunto => [
    if (_sulTelefono) 'telefono' else 'browser',
    if (planciaLeggera) 'plancia leggera' else 'plancia piena',
    if (_android) composizioneIbrida ? 'ibrida' : 'tessitura',
  ].join(', ');

  void _avvisa() {
    if (!_cambiamenti.isClosed) _cambiamenti.add(null);
  }

  Future<void> chiudi() async {
    if (!_cambiamenti.isClosed) await _cambiamenti.close();
  }
}
