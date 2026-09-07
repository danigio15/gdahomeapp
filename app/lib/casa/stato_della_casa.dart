/// Lo stato della casa, tenuto aggiornato dal filo.
///
/// Si prende tutto una volta con `get_states`, e da li' in poi si aggiorna a
/// pezzi con gli eventi `state_changed`. E' come lo fa Home Assistant, ed e'
/// l'unico modo che regge: una casa con duemila entita' non si puo' richiedere
/// intera ogni volta che cambia una luce.
///
/// Non c'e' un import di Flutter qui dentro, ed e' voluto: questa classe si
/// prova per intero senza uno schermo.
library;

import 'dart:async';

import '../ponte/filo.dart';
import 'entita.dart';

class StatoDellaCasa {
  StatoDellaCasa(this._filo);

  final Filo _filo;
  final _entita = <String, Entita>{};
  final _cambiamenti = StreamController<void>.broadcast();

  StreamSubscription<Map<String, dynamic>>? _ascolto;
  StreamSubscription<StatoDelFilo>? _guardaIlFilo;
  bool _pieno = false;

  /// Scatta a ogni cambiamento, senza dire cosa: chi disegna ridisegna.
  Stream<void> get cambiamenti => _cambiamenti.stream;

  /// `true` quando la prima lettura completa e' arrivata.
  bool get pieno => _pieno;

  int get quante => _entita.length;

  Entita? operator [](String id) => _entita[id];

  List<Entita> tutte() {
    final elenco = _entita.values.toList();
    elenco.sort(
      (una, altra) =>
          una.nome.toLowerCase().compareTo(altra.nome.toLowerCase()),
    );
    return elenco;
  }

  List<Entita> delDominio(String dominio) =>
      tutte().where((una) => una.dominio == dominio).toList();

  /// I domini presenti, e quante entita' ha ognuno.
  Map<String, int> domini() {
    final conto = <String, int>{};
    for (final una in _entita.values) {
      conto[una.dominio] = (conto[una.dominio] ?? 0) + 1;
    }
    return conto;
  }

  /// Si attacca al filo: legge tutto, poi resta in ascolto.
  Future<void> attacca() async {
    await _leggiTutto();
    _ascolto = (await _filo.sottoscrivi({
      'type': 'subscribe_events',
      'event_type': 'state_changed',
    })).listen(_cambiata);

    /* Dopo una riconnessione il filo rifa' la sottoscrizione da solo, ma di
     * quello che e' successo mentre era giu' non sa niente: quelle entita'
     * resterebbero ferme a un valore vecchio per sempre. Quindi si rilegge
     * tutto. */
    _guardaIlFilo = _filo.stato.listen((stato) {
      if (stato == StatoDelFilo.dentro && _pieno) unawaited(_leggiTutto());
    });
  }

  Future<void> _leggiTutto() async {
    final letto = await _filo.risultato({'type': 'get_states'});
    if (letto is! List) return;
    _entita.clear();
    for (final grezza in letto) {
      final una = Entita.leggi(grezza);
      if (una != null) _entita[una.id] = una;
    }
    _pieno = true;
    _avvisa();
  }

  void _cambiata(Map<String, dynamic> evento) {
    final dati = evento['data'];
    if (dati is! Map) return;
    final id = dati['entity_id'];
    if (id is! String) return;

    final nuova = Entita.leggi(dati['new_state']);
    if (nuova == null) {
      /* `new_state` vuoto vuol dire che l'entita' e' stata tolta da Home
       * Assistant: va tolta anche di qui, o resta a schermo per sempre. */
      if (_entita.remove(id) != null) _avvisa();
      return;
    }
    _entita[nuova.id] = nuova;
    _avvisa();
  }

  /// Accende, spegne, o inverte. Torna quando Home Assistant ha risposto.
  Future<void> comanda(
    String servizio,
    String suChe, {
    Map<String, dynamic>? con,
  }) => _filo.chiedi({
    'type': 'call_service',
    'domain': suChe.split('.').first,
    'service': servizio,
    'target': {'entity_id': suChe},
    if (con != null) 'service_data': con,
  });

  void _avvisa() {
    if (!_cambiamenti.isClosed) _cambiamenti.add(null);
  }

  Future<void> stacca() async {
    await _ascolto?.cancel();
    await _guardaIlFilo?.cancel();
    _ascolto = null;
    _guardaIlFilo = null;
    if (!_cambiamenti.isClosed) await _cambiamenti.close();
  }
}
