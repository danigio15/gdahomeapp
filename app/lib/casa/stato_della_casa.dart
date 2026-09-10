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
  StatoDellaCasa(
    this._filo, {
    this.respiro = const Duration(milliseconds: 300),
  });

  final Filo _filo;
  final _entita = <String, Entita>{};
  final _cambiamenti = StreamController<void>.broadcast();

  /// Quanto passa, al minimo, fra un avviso e l'altro.
  ///
  /// Una casa vera cambia decine di volte al secondo — i contatori di
  /// energia, i sensori di movimento, i lettori che avanzano — e ogni evento
  /// avvisava chi disegna, che ridisegnava tutto: l'app andava a scatti e
  /// basta. Gli eventi si prendono tutti, ma chi disegna si avvisa al piu'
  /// tre volte al secondo: il primo cambiamento passa subito, gli altri si
  /// accodano in un avviso solo. Nessuno vede la differenza fra trecento
  /// millisecondi e zero; tutti vedono un'app che scatta.
  final Duration respiro;

  StreamSubscription<Map<String, dynamic>>? _ascolto;
  StreamSubscription<StatoDelFilo>? _guardaIlFilo;
  bool _pieno = false;
  DateTime? _ultimoAvviso;
  Timer? _avvisoInSospeso;

  /* ─── Quanto ci mette un cambiamento ad arrivare ────────────────────────
   *
   * «I dati arrivano con circa un minuto di ritardo, non sono immediati.»
   *
   * Un minuto e' tanto, e la domanda vera e' **dove** sta: se un cambiamento
   * ci mette un minuto a percorrere la strada — telefono, centralino, ponte,
   * Home Assistant — o se Home Assistant quel valore lo scopre un minuto
   * dopo, perche' l'integrazione che lo porta interroga il dispositivo una
   * volta al minuto. Sono due guai diversi e uno solo dei due e' nostro.
   *
   * La risposta sta dentro l'evento. Home Assistant ci scrive **quando** lo
   * stato e' cambiato (`last_changed`): se all'arrivo quell'ora e' di un
   * minuto fa, il minuto se l'e' preso la strada; se e' di adesso, la strada
   * e' immediata e il minuto sta a monte — e a monte non ci arriviamo, ma
   * almeno si smette di cercarlo dalla parte sbagliata.
   *
   * Si tiene poco: gli ultimi cento eventi, il tipico e il peggiore. Un
   * elenco lungo qui dentro sarebbe memoria buttata per un numero che si
   * guarda una volta ogni tanto. */
  static const int _quantiRitardi = 100;
  final _ritardi = <int>[];

  /// Quanti cambiamenti si sono misurati.
  int get quantiRitardi => _ritardi.length;

  /// Quanto ci mette **di solito** un cambiamento ad arrivare, dal momento in
  /// cui Home Assistant dice che e' successo. `null` finche' non ne e'
  /// arrivato nemmeno uno.
  ///
  /// E' la mediana e non la media: basta un evento arrivato dopo un risveglio
  /// del telefono — mezzo minuto di ritardo, e non e' colpa di nessuno — per
  /// spostare una media di parecchio e far sembrare lenta una strada che non
  /// lo e'.
  Duration? get ritardoSolito {
    if (_ritardi.isEmpty) return null;
    final ordinati = List<int>.from(_ritardi)..sort();
    return Duration(milliseconds: ordinati[ordinati.length ~/ 2]);
  }

  /// Il peggiore degli ultimi cento.
  Duration? get ritardoPeggiore => _ritardi.isEmpty
      ? null
      : Duration(
          milliseconds: _ritardi.reduce((uno, due) => uno > due ? uno : due),
        );

  void _misuraIlRitardo(Entita quale) {
    /* `last_updated` e non `last_changed`: un sensore che ripete lo stesso
     * numero non sposta il secondo, e misurarlo direbbe «un'ora di ritardo»
     * per un evento arrivato in un millesimo. */
    final quando = quale.aggiornataIl;
    if (quando == null) return;
    final quanto = DateTime.now().difference(quando).inMilliseconds;
    /* Negativo vuol dire che l'orologio del telefono e quello di casa non
     * vanno d'accordo: un numero cosi' non racconta niente sulla strada, e
     * messo in mezzo agli altri li sporcherebbe. */
    if (quanto < 0) return;
    _ritardi.add(quanto);
    if (_ritardi.length > _quantiRitardi) _ritardi.removeAt(0);
  }

  /// Scatta quando qualcosa e' cambiato, senza dire cosa: chi disegna
  /// ridisegna. Al piu' una volta ogni [respiro].
  Stream<void> get cambiamenti => _cambiamenti.stream;

  /// `true` quando la prima lettura completa e' arrivata.
  bool get pieno => _pieno;

  int get quante => _entita.length;

  Entita? operator [](String id) => _entita[id];

  /* L'elenco ordinato e i gruppi si tengono da parte finche' niente cambia.
   *
   * Erano il conto piu' caro dell'app, e nessuno se n'era accorto: la
   * schermata dei dispositivi chiedeva le entita' di ogni dominio, e ognuna
   * di quelle domande **riordinava tutta la casa**. Trenta domini per
   * tremila entita' fa trenta ordinamenti da tremila, con due parole nuove
   * per ogni confronto — qualche milione di parole buttate a ogni
   * ridisegno, e i ridisegni arrivavano con gli eventi. Il dito scorreva e
   * la lista restava indietro, e sembrava colpa della lista. */
  List<Entita>? _ordinate;
  Map<String, List<Entita>>? _raggruppate;

  void _cambiate() {
    _ordinate = null;
    _raggruppate = null;
  }

  List<Entita> tutte() {
    final gia = _ordinate;
    if (gia != null) return gia;
    final elenco = _entita.values.toList();
    /* La chiave si calcola una volta per entita', non a ogni confronto. */
    final chiavi = <String, String>{
      for (final una in elenco) una.id: una.nome.toLowerCase(),
    };
    elenco.sort((una, altra) => chiavi[una.id]!.compareTo(chiavi[altra.id]!));
    _ordinate = elenco;
    return elenco;
  }

  List<Entita> delDominio(String dominio) => perDominio()[dominio] ?? const [];

  /// Le entita' divise per dominio, ognuna nel suo gruppo e in ordine.
  ///
  /// Un giro solo per tutta la casa, e il risultato si tiene: chiederle
  /// dominio per dominio costava un ordinamento per domanda.
  Map<String, List<Entita>> perDominio() {
    final gia = _raggruppate;
    if (gia != null) return gia;
    final gruppi = <String, List<Entita>>{};
    for (final una in tutte()) {
      (gruppi[una.dominio] ??= <Entita>[]).add(una);
    }
    _raggruppate = gruppi;
    return gruppi;
  }

  /// I domini presenti, e quante entita' ha ognuno.
  Map<String, int> domini() => {
    for (final gruppo in perDominio().entries) gruppo.key: gruppo.value.length,
  };

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
    _cambiate();
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
      if (_entita.remove(id) != null) {
        _cambiate();
        _avvisa();
      }
      return;
    }
    /* L'ordine si rifa' solo quando cambia **quali** entita' ci sono, o come
     * si chiamano: un valore che cambia — ed e' quello che cambia dieci
     * volte al secondo — lascia l'ordine dov'e'. Chi disegna una riga si
     * prende l'entita' viva dal suo identificativo, non quella di quando
     * l'ordine e' stato fatto. */
    _misuraIlRitardo(nuova);
    final vecchia = _entita[nuova.id];
    _entita[nuova.id] = nuova;
    if (vecchia == null || vecchia.nome != nuova.nome) _cambiate();
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
    if (_cambiamenti.isClosed) return;
    final adesso = DateTime.now();
    final ultimo = _ultimoAvviso;
    final passato = ultimo == null ? respiro : adesso.difference(ultimo);
    if (passato >= respiro) {
      _ultimoAvviso = adesso;
      _cambiamenti.add(null);
      return;
    }
    /* Troppo presto: si avvisa alla fine del respiro, una volta per tutti
     * quelli che arrivano nel frattempo. */
    _avvisoInSospeso ??= Timer(respiro - passato, () {
      _avvisoInSospeso = null;
      if (_cambiamenti.isClosed) return;
      _ultimoAvviso = DateTime.now();
      _cambiamenti.add(null);
    });
  }

  Future<void> stacca() async {
    _avvisoInSospeso?.cancel();
    _avvisoInSospeso = null;
    await _ascolto?.cancel();
    await _guardaIlFilo?.cancel();
    _ascolto = null;
    _guardaIlFilo = null;
    if (!_cambiamenti.isClosed) await _cambiamenti.close();
  }
}
