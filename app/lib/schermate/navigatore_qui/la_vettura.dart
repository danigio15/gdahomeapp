/// La vettura della plancia, per il navigatore: l'auto della sezione Auto e i
/// suoi dati, in tempo reale, a gdanav.
///
/// gdanav ha la sua fonte «gdahome» (`SorgenteGdahome`): senza codice e senza
/// QR, perche' la casa qui e' gia' collegata. Questo file la riempie.
///
/// **Quale auto.** Quella attiva della sezione Auto: la configurazione della
/// plancia sta nel ponte (`dashboardmodern/config/get`, lo stesso comando con
/// cui la pagina la rilegge), con l'elenco delle auto (`cd_ev_cars`), quella
/// scelta (`cd_ev_car_active`) e, per ognuna, quale sensore dice cosa
/// (`ov`: `dm.ev_batteria_auto` → `sensor.zoe_battery`). Le regole sono quelle
/// della pagina — `pickVehicle` e `resolveEntity` — e sono ripetute qui
/// perche' qui la pagina non c'e': il navigatore deve sapere dell'auto anche
/// quando nessuno ha aperto la plancia.
///
/// **I dati.** Gli stati di Home Assistant che il filo tiene gia' aggiornati
/// (`StatoDellaCasa`): a ogni cambiamento si rilegge la batteria, l'autonomia,
/// la carica e la posizione, e se qualcosa e' cambiato va a gdanav.
library;

import 'dart:async';
import 'dart:convert';

import 'package:gdanav_app/gdanav_app.dart';

import '../../casa/collegamento.dart';
import '../../casa/entita.dart';

/// La vettura come la racconta la configurazione della plancia.
class LaVettura {
  const LaVettura({required this.auto, required this.sensori});

  /// Nome, marca, modello e batteria, per gdanav.
  final AutoDiGdahome auto;

  /// Per ogni casella `dm.ev_*` il sensore di Home Assistant che la riempie.
  final Map<String, String> sensori;

  /// Le caselle della batteria, nell'ordine in cui le guarda la plancia
  /// (`BATTERY_REFS` in `ev-section.js`).
  static const batteria = ['dm.ev_batteria_auto', 'dm.ev_battery', 'dm.ev_soc'];
  static const autonomia = 'dm.ev_autonomia';
  static const statoRicarica = 'dm.ev_stato_ricarica';
  static const cavo = 'dm.ev_cavo_collegato';
  static const potenzaRicarica = [
    'dm.ev_potenza_ricarica',
    'dm.ev_charge_power',
  ];
  static const posizione = 'dm.ev_posizione';
  static const odometro = 'dm.ev_odometro';
  static const temperaturaEsterna = 'dm.ev_temperatura_esterna';

  /// L'auto attiva dai valori della configurazione (`snapshot.values`), o
  /// `null` se nella plancia di auto elettriche non ce n'e'.
  ///
  /// Le termiche restano fuori: gdanav naviga le elettriche, e il carburante
  /// non e' una batteria.
  static LaVettura? daiValori(Map<String, dynamic> valori) {
    final elenco = _json(valori['cd_ev_cars']);
    final vive = _json(valori['cd_entity_overrides']);
    final auto = elenco is List
        ? elenco.whereType<Map<dynamic, dynamic>>().toList()
        : const <Map<dynamic, dynamic>>[];
    final scelta = _scelta(auto, _testo(_json(valori['cd_ev_car_active'])));
    final sensori = <String, String>{
      if (vive is Map)
        for (final MapEntry(:key, :value) in vive.entries)
          if (value is String && value.isNotEmpty) '$key': value,
    };
    if (scelta == null) {
      /* Senza profili la plancia usa la mappa viva da sola: se c'e' una
       * batteria, l'auto c'e', senza nome. */
      if (!batteria.any(sensori.containsKey)) return null;
      return LaVettura(
        auto: AutoDiGdahome(kwh: _numero(_json(valori['cd_ev_kwh']))),
        sensori: sensori,
      );
    }
    if (_testo(scelta['tipo']) == 'termica') return null;
    final suoi = scelta['ov'] ?? scelta['overrides'];
    if (suoi is Map) {
      for (final MapEntry(:key, :value) in suoi.entries) {
        if (value is String && value.isNotEmpty) sensori['$key'] = value;
      }
    }
    /* I campi di prima, che la pagina legge ancora. */
    for (final vecchio in ['battery_entity', 'soc_entity']) {
      final e = _testo(scelta[vecchio]);
      if (e.isNotEmpty) sensori.putIfAbsent(batteria.first, () => e);
    }
    return LaVettura(
      auto: AutoDiGdahome(
        nome: _testo(scelta['name']),
        marca: _testo(scelta['brand']),
        modello: _testo(scelta['model'] ?? scelta['vehicle_model']),
        kwh: _numero(scelta['kwh']) ?? _numero(_json(valori['cd_ev_kwh'])),
      ),
      sensori: sensori,
    );
  }

  /// La lettura di adesso, dagli stati della casa; `null` se la batteria non
  /// si sa (senza batteria gdanav non ha niente da farci).
  StatoAuto? lettura(Entita? Function(String id) stato) {
    Entita? di(String casella) {
      final id = sensori[casella];
      if (id == null || id.startsWith('dm.')) return null;
      final e = stato(id);
      return e == null || e.muta ? null : e;
    }

    Entita? laBatteria;
    for (final c in batteria) {
      laBatteria = di(c);
      if (laBatteria != null && double.tryParse(laBatteria.stato) != null) {
        break;
      }
      laBatteria = null;
    }
    final b = laBatteria;
    if (b == null) return null;
    final dove = di(posizione);
    final potenza = [for (final c in potenzaRicarica) di(c)]
        .nonNulls
        .firstOrNull;
    final kw = _kw(potenza);
    return StatoAuto(
      sorgente: TipoSorgente.gdahome,
      letto: b.aggiornataIl ?? b.cambiataIl ?? DateTime.now(),
      batteria: double.parse(b.stato).clamp(0, 100).toDouble(),
      autonomiaKm: _km(di(autonomia)),
      inCarica: inCarica(
        di(statoRicarica)?.stato,
        cavo: di(cavo)?.stato,
        kw: kw,
      ),
      potenzaCaricaKw: kw,
      latitudine: _numero(dove?.attributi['latitude']),
      longitudine: _numero(dove?.attributi['longitude']),
      odometroKm: _km(di(odometro)),
      temperaturaEsternaC: _gradi(di(temperaturaEsterna)),
    );
  }

  /// Se l'auto sta caricando, con le parole della pagina
  /// (`codiceDellaRicarica` in `stato-della-ricarica.js`): la «C» e basta.
  /// `null` se nessuno lo dice.
  static bool? inCarica(String? stato, {String? cavo, double? kw}) {
    final grezzo = (stato ?? '').trim();
    final spazi = grezzo.replaceAll('_', ' ');
    final carica = kw != null && kw > 0.01;
    if (RegExp(r'^[cCdD]$').hasMatch(grezzo)) return true;
    if (RegExp(r'^[aAbBfF]$').hasMatch(grezzo)) return false;
    if (!RegExp(
      r'^(unknown|unavailable|none|)$',
      caseSensitive: false,
    ).hasMatch(grezzo)) {
      bool c(String re) => RegExp(re, caseSensitive: false).hasMatch(spazi);
      if (c(r'\b(error|errore|fault|guast|fehler|failure|failed)\b')) {
        return false;
      }
      if (c(
        r'\b(disconnect\w*|scollegat\w*|staccat\w*|unplug\w*|not[ _-]?connected|no[ _-]?vehicle|no[ _-]?car)\b',
      )) {
        return false;
      }
      if (c(
        r'\b(not[ _-]?charging|non in carica|discharg\w*|charg\w* (complete|finished|done|stopped|paused)|complete|finished|done|stopped|paused|suspended\w*|waiting|ready|pronta|attesa)\b',
      )) {
        return false;
      }
      if (c(
        r'\b(charging|in carica|ricarica in corso|ricaricando|l[äa]dt|laden|cargando|en charge)\b',
      )) {
        return true;
      }
      if (c(
        r'\b(connected|collegat\w*|plugged|plug|attaccat\w*|occupied|preparing)\b',
      )) {
        return carica;
      }
      if (RegExp(
        r'^(on|true|1|active|attiv[ao])$',
        caseSensitive: false,
      ).hasMatch(grezzo)) {
        return true;
      }
      if (RegExp(
        r'^(off|false|0|idle|none|available|free|libero|nessuno|standby|inactive)$',
        caseSensitive: false,
      ).hasMatch(grezzo)) {
        return false;
      }
    }
    if (carica) return true;
    if (RegExp(
      r'^(off|false|0|not_home|disconnected|unplugged)$',
      caseSensitive: false,
    ).hasMatch(cavo ?? '')) {
      return false;
    }
    return kw == null ? null : false;
  }

  /* ── Le unita' ──────────────────────────────────────────────────────── */

  static double? _km(Entita? e) {
    final n = _numero(e?.stato);
    if (n == null) return null;
    return switch ((e!.unita ?? '').toLowerCase()) {
      'mi' => n * 1.609344,
      'm' => n / 1000,
      _ => n,
    };
  }

  static double? _kw(Entita? e) {
    final n = _numero(e?.stato);
    if (n == null) return null;
    return switch ((e!.unita ?? '').toLowerCase()) {
      'w' => n / 1000,
      'mw' => n * 1000,
      _ => n,
    };
  }

  static double? _gradi(Entita? e) {
    final n = _numero(e?.stato);
    if (n == null) return null;
    return (e!.unita ?? '').contains('F') ? (n - 32) * 5 / 9 : n;
  }

  /* ── La configurazione ──────────────────────────────────────────────── */

  /// `pickVehicle` della pagina: per uid, poi per posizione, se no la prima.
  static Map<dynamic, dynamic>? _scelta(
    List<Map<dynamic, dynamic>> auto,
    String scelta,
  ) {
    if (auto.isEmpty) return null;
    if (scelta.isEmpty) return auto.first;
    for (final a in auto) {
      if (_testo(a['uid']) == scelta) return a;
    }
    final i = int.tryParse(scelta);
    if (i != null && i >= 0 && i < auto.length) return auto[i];
    return auto.first;
  }

  /// I valori della configurazione sono testo, e spesso JSON dentro il testo.
  static Object? _json(Object? v) {
    if (v is! String) return v;
    try {
      return jsonDecode(v);
    } on FormatException {
      return v;
    }
  }

  static String _testo(Object? v) => v == null ? '' : '$v'.trim();

  static double? _numero(Object? v) => switch (v) {
    final num n => n.toDouble(),
    final String s => double.tryParse(s.trim().replaceAll(',', '.')),
    _ => null,
  };
}

/// Tiene la fonte gdahome di gdanav al passo con la casa: rilegge la
/// configurazione quando il filo si riapre (e ogni tanto, se qualcuno ha
/// cambiato auto nella plancia), e a ogni cambiamento degli stati manda la
/// lettura nuova.
class IlFiloDellaVettura {
  IlFiloDellaVettura(this.collegamento, this.fonte);

  final Collegamento collegamento;
  final SorgenteGdahome fonte;

  /// Ogni quanto si rilegge la configurazione anche senza motivi: un'auto
  /// cambiata nella plancia non avvisa nessuno.
  static const ogni = Duration(minutes: 5);

  LaVettura? _vettura;
  StatoAuto? _mandata;
  final _ascolti = <StreamSubscription<void>>[];
  Timer? _orologio;
  bool _dentro = false;
  bool _spento = false;

  void avvia() {
    _ascolti
      ..add(collegamento.cambiamenti.listen((_) => _comeVa()))
      ..add(collegamento.entitaCambiate.listen((_) => _aggiorna()));
    _orologio = Timer.periodic(ogni, (_) => _rileggi());
    _comeVa();
  }

  void ferma() {
    _spento = true;
    for (final a in _ascolti) {
      a.cancel();
    }
    _ascolti.clear();
    _orologio?.cancel();
    fonte.collegamento(false);
  }

  void _comeVa() {
    final dentro = collegamento.dentro;
    fonte.collegamento(dentro);
    if (dentro && !_dentro) unawaited(_rileggi());
    _dentro = dentro;
  }

  Future<void> _rileggi() async {
    final filo = collegamento.filo;
    if (filo == null || !collegamento.dentro || _spento) return;
    try {
      final profilo = collegamento.planciaScelta;
      final risposta = await filo.risultato({
        'type': 'dashboardmodern/config/get',
        'profile': profilo.isEmpty ? 'primary' : profilo,
      });
      final valori = risposta is Map ? risposta['snapshot'] : null;
      if (_spento || valori is! Map || valori['values'] is! Map) return;
      _vettura = LaVettura.daiValori(
        Map<String, dynamic>.from(valori['values'] as Map),
      );
      fonte.descrivi(_vettura?.auto);
      await collegamento.serveLaCasa();
      _aggiorna();
    } catch (_) {
      /* La configurazione non e' arrivata: resta quella di prima, e si
       * riprova alla prossima riapertura del filo o fra cinque minuti. */
    }
  }

  void _aggiorna() {
    final v = _vettura;
    final stato = collegamento.stato;
    if (v == null || stato == null || _spento) return;
    final l = v.lettura((id) => stato[id]);
    if (l == null || _uguale(l, _mandata)) return;
    _mandata = l;
    fonte.manda(l);
  }

  static bool _uguale(StatoAuto a, StatoAuto? b) =>
      b != null &&
      a.letto == b.letto &&
      a.batteria == b.batteria &&
      a.autonomiaKm == b.autonomiaKm &&
      a.inCarica == b.inCarica &&
      a.potenzaCaricaKw == b.potenzaCaricaKw &&
      a.latitudine == b.latitudine &&
      a.longitudine == b.longitudine &&
      a.odometroKm == b.odometroKm &&
      a.temperaturaEsternaC == b.temperaturaEsternaC;
}
