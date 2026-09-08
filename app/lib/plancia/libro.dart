/// Il libro degli impegni: quello che non sta negli stati.
///
/// Tutta la plancia si disegna con `get_states` e basta. L'agenda no: lo stato
/// di un `calendar.*` dice soltanto se c'e' qualcosa in corso, e quello di un
/// `todo.*` soltanto quante voci restano. Gli appuntamenti e le cose da fare
/// vivono dentro Home Assistant e si chiedono coi servizi — `calendar.get_events`
/// e `todo.get_items` — che rispondono davvero solo se glielo si chiede con
/// `return_response`.
///
/// Passano dal ponte come qualunque altro comando: il ponte non guarda dentro
/// ai messaggi, quindi non c'e' niente da aggiungergli.
///
/// Chiedere costa un giro di rete per ogni calendario e per ogni lista, e le
/// risposte non cambiano da un secondo all'altro: si leggono all'apertura e poi
/// ogni tanto, non a ogni battito della casa.
library;

import 'dart:async';

import '../ponte/errori.dart';
import '../ponte/filo.dart';
import 'agenda.dart';
import 'configurazione.dart';

/// Ogni quanto si torna a chiedere: un appuntamento aggiunto sul telefono di
/// qualcun altro compare entro qualche minuto, e nessuno se ne lamenta.
const Duration ogniQuanto = Duration(minutes: 10);

class LibroDegliImpegni {
  LibroDegliImpegni(this._filo);

  final Filo _filo;
  final _cambiamenti = StreamController<void>.broadcast();

  List<Impegno> _impegni = const [];
  List<Cosa> _cose = const [];
  bool _inArrivo = false;
  DateTime? _lette;

  /// Scatta quando c'e' qualcosa di nuovo da disegnare.
  Stream<void> get cambiamenti => _cambiamenti.stream;

  List<Impegno> get impegni => _impegni;
  List<Cosa> get cose => _cose;

  /// `true` mentre la prima lettura e' per strada: la tessera lo dice invece
  /// di scrivere «niente in programma» su un'agenda che non ha ancora letto.
  bool get inArrivo => _inArrivo;

  /// Le cose di una lista sola, per disegnarla per conto suo.
  List<Cosa> dellaLista(String entita) =>
      _cose.where((una) => una.lista == entita).toList();

  /// Legge tutto quello che la configurazione dice di guardare.
  ///
  /// Se non c'e' niente da guardare non chiede niente: una casa senza
  /// calendari non deve pagare un giro di rete per scoprirlo ogni volta.
  Future<void> leggi(
    ConfigurazioneDellaPlancia config, {
    DateTime? adesso,
    bool forza = false,
  }) async {
    final calendari = config.calendari.map((uno) => uno.entita).toList();
    final liste = config.liste.map((una) => una.entita).toList();
    if (calendari.isEmpty && liste.isEmpty) {
      _impegni = const [];
      _cose = const [];
      return;
    }
    final ora = adesso ?? DateTime.now();
    if (!forza && _lette != null && ora.difference(_lette!) < ogniQuanto) {
      return;
    }
    _inArrivo = true;
    _avvisa();
    final impegni = <Impegno>[];
    final cose = <Cosa>[];
    for (final entita in calendari) {
      impegni.addAll(await _impegniDi(entita, ora));
    }
    for (final entita in liste) {
      cose.addAll(await _coseDi(entita));
    }
    _impegni = ordinaGliImpegni(impegni);
    _cose = cose;
    _lette = ora;
    _inArrivo = false;
    _avvisa();
  }

  Future<List<Impegno>> _impegniDi(String entita, DateTime da) async {
    final risposta = await _chiedi('calendar', 'get_events', entita, {
      'start_date_time': _scritto(da),
      'end_date_time': _scritto(da.add(const Duration(days: giorniAvanti))),
    });
    return impegniDallaRisposta(risposta, entita);
  }

  Future<List<Cosa>> _coseDi(String entita) async {
    final risposta = await _chiedi('todo', 'get_items', entita, const {});
    return coseDallaRisposta(risposta, entita);
  }

  /// Un servizio che risponde. Quando non risponde — servizio mancante,
  /// entita' sparita — si torna a mani vuote invece che con un errore in
  /// mezzo al disegno: un calendario rotto non deve portarsi via l'agenda.
  Future<Object?> _chiedi(
    String dominio,
    String servizio,
    String entita,
    Map<String, dynamic> dati,
  ) async {
    try {
      return await _filo.risultato({
        'type': 'call_service',
        'domain': dominio,
        'service': servizio,
        'target': {'entity_id': entita},
        if (dati.isNotEmpty) 'service_data': dati,
        'return_response': true,
      });
    } on ErroreDelPonte {
      return null;
    }
  }

  /// L'istante come lo vuole Home Assistant: senza fuso, ora locale.
  static String _scritto(DateTime quando) =>
      '${quando.year.toString().padLeft(4, '0')}-'
      '${quando.month.toString().padLeft(2, '0')}-'
      '${quando.day.toString().padLeft(2, '0')} '
      '${quando.hour.toString().padLeft(2, '0')}:'
      '${quando.minute.toString().padLeft(2, '0')}:'
      '${quando.second.toString().padLeft(2, '0')}';

  /* ─── Quello che si puo' cambiare da qui ──────────────────────────────── */

  /// Spunta o rimette una voce, e rilegge quella lista.
  Future<void> spunta(String lista, Cosa cosa, {required bool fatta}) async {
    await _filo.risultato({
      'type': 'call_service',
      'domain': 'todo',
      'service': 'update_item',
      'target': {'entity_id': lista},
      'service_data': {
        'item': cosa.uid.isNotEmpty ? cosa.uid : cosa.titolo,
        'status': fatta ? 'completed' : 'needs_action',
      },
    });
    final fresche = await _coseDi(lista);
    _cose = [
      ..._cose.where((una) => una.lista != lista),
      ...fresche,
    ];
    _avvisa();
  }

  void _avvisa() {
    if (!_cambiamenti.isClosed) _cambiamenti.add(null);
  }

  Future<void> chiudi() async {
    if (!_cambiamenti.isClosed) await _cambiamenti.close();
  }
}
