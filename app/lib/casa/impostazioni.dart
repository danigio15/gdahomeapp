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
    bool pannelloAMuro = false,
    Dispensa? dispensa,
  }) : _dispensa = dispensa ?? dispensaDiQuestoSistema(),
       // ignore: prefer_initializing_formals
       _pannelloAMuro = pannelloAMuro,
       /* Spenta di serie, su tutto: vedi [planciaLeggera]. */
       _planciaLeggera = false,
       _composizioneIbrida = android,
       // ignore: prefer_initializing_formals
       _sulTelefono = sulTelefono,
       _android = android;

  final Dispensa _dispensa;

  /// Sul pannello a muro (GdAHome Muro) i due interruttori che pesano sulla
  /// plancia stanno fermi sul modo piu' leggero, qualunque cosa ci sia
  /// scritta: un NSPanel Pro ha Android 8.1 e un chip grafico piccolo.
  final bool _pannelloAMuro;
  final bool _sulTelefono;
  final bool _android;
  final _cambiamenti = StreamController<void>.broadcast();

  bool _planciaLeggera;
  bool _composizioneIbrida;
  /* Spento di serie, e non e' pigrizia: acceso di nascosto vorrebbe dire che
   * chi aggiorna l'app si trova davanti una richiesta che non ha chiesto, su
   * un telefono che magari il volto non ce l'ha nemmeno registrato. */
  IlLucchetto _lucchetto = IlLucchetto.spento;
  bool _allegatiPubbliciCapiti = false;
  String? _novitaViste;

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
  ///
  /// Sul pannello a muro e' sempre accesa: i vetri sfocati e le animazioni
  /// continue erano quello che lo faceva andare a scatti.
  bool get planciaLeggera => _pannelloAMuro || _planciaLeggera;

  /// Su Android: il riquadro della plancia disegnato dal sistema per conto
  /// suo (composizione ibrida) invece che ridisegnato da Flutter a ogni
  /// fotogramma. Una plancia che si muove sempre pesa meno cosi'.
  ///
  /// Sul pannello a muro e' sempre spenta: prima di Android 10 la
  /// composizione ibrida copia ogni fotogramma dalla scheda video alla
  /// memoria e ritorno, e tiene occupato il filo da cui passano anche i
  /// comandi. Il riquadro disegnato da Flutter (`tessitura`) costa meno.
  bool get composizioneIbrida =>
      !_pannelloAMuro && _composizioneIbrida && _android;

  /// Vero su GdAHome Muro: i due interruttori qui sopra non si cambiano.
  bool get pannelloAMuro => _pannelloAMuro;

  /// Il volto e l'impronta davanti all'app: cosa e' acceso.
  IlLucchetto get lucchetto => _lucchetto;

  /// Se chi ha il telefono in mano ha gia' letto, e accettato, che le foto e
  /// i video di una segnalazione diventano pubblici su GitHub. Si chiede una
  /// volta sola, al primo allegato (`schermate/segnalazioni.dart`), e poi
  /// resta l'avviso accanto ai bottoni.
  bool get allegatiPubbliciCapiti => _allegatiPubbliciCapiti;

  /// L'ultima versione dell'app di cui si sono viste le novita': la scheda
  /// «Novità» compare quando l'app e' piu' nuova di questa
  /// (`casa/novita.dart`).
  ///
  /// `null` vuol dire mai scritta: un'app che arriva da una versione di prima
  /// della scheda, o un'installazione nuova — e quella la scrive subito chi
  /// apre l'app (`main.dart`), cosi' chi ha appena scaricato non si trova
  /// davanti le novita' di un'app che non ha mai visto.
  String? get novitaViste => _novitaViste;

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
          if (letto['allegati_pubblici_capiti'] is bool) {
            _allegatiPubbliciCapiti = letto['allegati_pubblici_capiti'] as bool;
          }
          final viste = letto['novita_viste'];
          if (viste is String && viste.isNotEmpty) _novitaViste = viste;
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
    bool? allegatiPubbliciCapiti,
    String? novitaViste,
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
    if (allegatiPubbliciCapiti != null &&
        allegatiPubbliciCapiti != _allegatiPubbliciCapiti) {
      _allegatiPubbliciCapiti = allegatiPubbliciCapiti;
      cambiato = true;
    }
    if (novitaViste != null &&
        novitaViste.isNotEmpty &&
        novitaViste != _novitaViste) {
      _novitaViste = novitaViste;
      cambiato = true;
    }
    if (!cambiato) return;
    _avvisa();
    await _dispensa.scrivi(
      jsonEncode({
        'plancia_leggera': _planciaLeggera,
        'composizione_ibrida': _composizioneIbrida,
        'lucchetto': _lucchetto.comeSiScrive,
        'allegati_pubblici_capiti': _allegatiPubbliciCapiti,
        if (_novitaViste != null) 'novita_viste': _novitaViste,
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
