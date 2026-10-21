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
import '../../plancia/cucitura.dart' show laPlanciaHaScritto;
import '../../ponte/errori.dart' show ComandoRifiutato;
import '../../ponte/filo.dart' show Filo;
import 'le_persone.dart';

/// La vettura come la racconta la configurazione della plancia.
class LaVettura {
  const LaVettura({
    required this.auto,
    required this.sensori,
    this.vicini = const [],
  });

  /// Nome, marca, modello e batteria, per gdanav.
  final AutoDiGdahome auto;

  /// Per ogni casella `dm.ev_*` il sensore di Home Assistant che la riempie.
  final Map<String, String> sensori;

  /// Gli altri sensori dello stesso dispositivo della batteria, dal registro
  /// di Home Assistant ([IlFiloDellaVettura]).
  ///
  /// «Dice che i dati non arrivano, ma su Home Assistant ci sono e su gdahome
  /// ho integrato tutto.» La temperatura della batteria, la velocita' e la
  /// potenza in uso la plancia non le chiede — non hanno una casella — e la
  /// temperatura di fuori una casella ce l'ha, ma l'auto importata prima
  /// che esistesse non l'ha riempita. Le caselle restano le prime a parlare;
  /// dove tacciono si guarda fra i sensori dell'auto stessa, riconoscendoli
  /// dalla classe e dal nome come fa la plancia quando importa l'auto.
  final List<String> vicini;

  /// La stessa vettura, coi sensori del suo dispositivo.
  LaVettura coiVicini(List<String> vicini) =>
      LaVettura(auto: auto, sensori: sensori, vicini: vicini);

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
  static const temperaturaBatteria = 'dm.ev_temperatura_batteria';
  static const velocita = 'dm.ev_velocita';
  static const potenzaInUso = 'dm.ev_potenza_istantanea';

  /// Le caselle del consumo, coi nomi del contratto delle sorelle
  /// (`docs/DATI-AUTO.md` di GdAAuto, che le riempie da sola).
  static const capacitaBatteria = 'dm.ev_capacita_batteria';
  static const energiaResidua = 'dm.ev_energia_residua';
  static const consumoMedio = 'dm.ev_consumo_medio';
  static const potenzaClima = 'dm.ev_potenza_riscaldatore';
  static const climaAcceso = 'dm.ev_clima';
  static const comandoClima = 'dm.ev_comando_clima';
  static const batteriaInRiscaldamento = 'dm.ev_batteria_in_riscaldamento';
  static const temperaturaInterna = 'dm.ev_temperatura_interna';

  /// Il sensore della batteria, se e' mappato: da lui si trova il dispositivo.
  String? get sensoreDellaBatteria {
    for (final c in batteria) {
      final id = sensori[c];
      if (id != null && !id.startsWith('dm.')) return id;
    }
    return null;
  }

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
  ///
  /// [adesso] per le prove: l'ora di adesso, per non credere a un orologio
  /// dell'auto che sta nel futuro.
  StatoAuto? lettura(Entita? Function(String id) stato, {DateTime? adesso}) {
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
    final mappati = {...sensori.values};
    final accanto = [
      for (final id in vicini)
        if (!mappati.contains(id)) ?di0(stato, id),
    ];
    Entita? oDaVicino(String casella, bool Function(Entita) prova) =>
        di(casella) ?? accanto.where(prova).firstOrNull;
    /* Per l'ora solo i sensori del dispositivo dell'auto: una posizione
     * mappata dal telefono si aggiorna ogni minuto, e non dice niente di
     * quanto e' fresca la batteria. */
    final delDispositivo = [
      for (final id in vicini)
        if (id != b.id) ?stato(id),
    ].where((e) => !e.muta).toList();
    return StatoAuto(
      sorgente: TipoSorgente.gdahome,
      letto: quandoLAutoHaParlato(
        b,
        delDispositivo,
        adesso: adesso ?? DateTime.now(),
      ),
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
      temperaturaEsternaC: _gradi(oDaVicino(temperaturaEsterna, eDiFuori)),
      temperaturaBatteriaC: _gradi(
        oDaVicino(temperaturaBatteria, eDellaBatteria),
      ),
      velocitaKmh: _kmh(oDaVicino(velocita, eVelocita)),
      potenzaKw: _kw(oDaVicino(potenzaInUso, ePotenzaInUso)),
    );
  }

  /// Il sensore di una casella, se e' mappato e risponde.
  Entita? _entita(Entita? Function(String id) stato, String casella) {
    final id = sensori[casella];
    if (id == null || id.startsWith('dm.')) return null;
    final e = stato(id);
    return e == null || e.muta ? null : e;
  }

  /// L'auto con la capacita' detta dal suo sensore, quando nella plancia non
  /// e' scritta: lo scritto vince, ma una casella vuota non vuol dire piu'
  /// «non lo so» quando l'auto lo sa (`capacitaDellaBatteria` della pagina).
  AutoDiGdahome autoConLaCapacita(Entita? Function(String id) stato) {
    if (auto.kwh != null) return auto;
    final kwh = _kwh(_entita(stato, capacitaBatteria));
    if (kwh == null) return auto;
    return AutoDiGdahome(
      nome: auto.nome,
      marca: auto.marca,
      modello: auto.modello,
      kwh: kwh,
    );
  }

  /// I dati del consumo per gdanav, coi nomi del contratto delle sorelle:
  /// solo quelli che ci sono. Un dato che manca lascia il conto com'era.
  Map<String, Object> datiDelConsumo(Entita? Function(String id) stato) {
    final fuori = <String, Object>{};
    void metti(String nome, Object? valore) {
      if (valore != null) fuori[nome] = valore;
    }

    metti('energia_kwh', _kwh(_entita(stato, energiaResidua)));
    metti('capacita_kwh', auto.kwh ?? _kwh(_entita(stato, capacitaBatteria)));
    metti('consumo_medio_kwh100', _kwh100(_entita(stato, consumoMedio)));
    metti('potenza_clima_w', _w(_entita(stato, potenzaClima)));
    metti(
      'clima_acceso',
      _acceso(_entita(stato, climaAcceso)) ??
          _acceso(_entita(stato, comandoClima)),
    );
    metti(
      'batteria_in_riscaldamento',
      _acceso(_entita(stato, batteriaInRiscaldamento)),
    );
    metti('temperatura_interna_c', _gradi(_entita(stato, temperaturaInterna)));
    return fuori;
  }

  /// Quanto e' vecchia davvero la lettura: «Da gdahome · 2 h fa» quando ABRP,
  /// con la stessa auto, diceva «2 min».
  ///
  /// La batteria da sola non lo sa dire. Home Assistant sposta la sua ora
  /// (`last_updated`) solo quando il valore cambia: un'auto ferma al 63% per
  /// due ore resta «di due ore fa» anche se l'integrazione l'ha riletta un
  /// minuto fa, e `subscribe_entities` le riletture uguali non le manda.
  /// Allora, nell'ordine:
  ///  1. il sensore dell'auto che dice quando l'auto ha mandato i dati
  ///     (`timestamp`, «Ultimo aggiornamento del veicolo», «last vehicle
  ///     update»): e' l'ora vera della lettura;
  ///  2. se no, quello di quando l'integrazione ha riletto («last
  ///     successful refresh», «ultimo aggiornamento cloud»);
  ///  3. se no, il piu' recente fra i sensori dello stesso dispositivo: sono
  ///     letti tutti insieme, e se uno e' cambiato la lettura e' di allora.
  /// Mai prima della batteria stessa, e mai nel futuro.
  static DateTime quandoLAutoHaParlato(
    Entita batteria,
    List<Entita> altri, {
    required DateTime adesso,
  }) {
    var letto = batteria.aggiornataIl ?? batteria.cambiataIl ?? adesso;
    DateTime? piuTardi(DateTime? a, DateTime? b) =>
        a == null ? b : (b == null || a.isAfter(b) ? a : b);
    final futuro = adesso.add(const Duration(minutes: 5));
    DateTime? dalSensore(int quanto) {
      DateTime? migliore;
      for (final e in altri) {
        if (oraDellAuto(e) != quanto) continue;
        final t = DateTime.tryParse(e.stato);
        if (t != null && !t.isAfter(futuro)) migliore = piuTardi(migliore, t);
      }
      return migliore;
    }

    final dichiarata = dalSensore(2) ?? dalSensore(1);
    if (dichiarata != null) return piuTardi(letto, dichiarata)!;
    for (final e in altri) {
      final t = e.aggiornataIl;
      if (t != null && !t.isAfter(futuro)) letto = piuTardi(letto, t)!;
    }
    return letto;
  }

  /// Un sensore che dice l'ora dei dati dell'auto: 2 se dice quando ha
  /// parlato l'auto, 1 se quando l'integrazione ha riletto, 0 se non e' uno
  /// di questi (la fine della carica, l'ultimo messaggio, il piano).
  static int oraDellAuto(Entita e) {
    if (_classe(e) != 'timestamp') return 0;
    if (_dice(
      e,
      r'(charg|ricaric|\bcarica\b|messag|\bplan\w*|\bpiano\b|finish|\bfine\b|\bstart\w*|\binizio\b)',
    )) {
      return 0;
    }
    final aggiornato = _dice(
      e,
      r'(update|updated|aggiornament\w*|refresh\w*|last seen|data time|sync\w*)',
    );
    if (!aggiornato) return 0;
    return _dice(e, r'\b(vehicle|veicolo|car|auto)\b') ? 2 : 1;
  }

  static Entita? di0(Entita? Function(String id) stato, String id) {
    final e = stato(id);
    return e == null || e.muta || _numero(e.stato) == null ? null : e;
  }

  /* ── I sensori riconosciuti dal dispositivo ────────────────────────────
   *
   * Le stesse prove della plancia quando importa un'auto
   * (`auto-device-binding.js`): la classe di Home Assistant, o l'unita', e le
   * parole del nome. */

  static String _parole(Entita e) => '${e.id} ${e.nome}'.replaceAll('_', ' ');
  static bool _dice(Entita e, String re) =>
      RegExp(re, caseSensitive: false).hasMatch(_parole(e));
  static String _classe(Entita e) => '${e.attributi['device_class'] ?? ''}';

  /// Una temperatura, dalla classe o dall'unita'.
  static bool eGradi(Entita e) => _gradiDi(e);

  static bool _gradiDi(Entita e) =>
      _classe(e) == 'temperature' ||
      RegExp(r'°\s?[CF]').hasMatch(e.unita ?? '');

  /// La temperatura di fuori: «outside», «outdoor», «esterna», ...
  ///
  /// Mai quella dell'abitacolo: «interior», «cabin», «interna» dicono 23 °C
  /// col clima acceso anche a dicembre, e per il consumo sarebbe una bugia.
  /// Senza la temperatura di fuori dall'auto gdanav prende quella del meteo.
  static bool eDiFuori(Entita e) =>
      _gradiDi(e) &&
      _dice(
        e,
        r'\b(outside|outdoor|outdoors|external|exterior|ambient|environment|esterna|esterno|ambiente|au(ss|ß)en\w*|ext[ée]rieur\w*)\b',
      ) &&
      !eDellAbitacolo(e);

  /// La temperatura dentro l'auto: non e' quella di fuori, e non si usa.
  static bool eDellAbitacolo(Entita e) =>
      _gradiDi(e) &&
      _dice(
        e,
        r'\b(interior|inside|indoor|cabin|abitacolo|interna|interno|innen\w*|habitacle|int[ée]rieur\w*)\b',
      );

  /// La temperatura della batteria di trazione, non di quella da 12 volt.
  /// «Battery min temperature», «Temperatura minima batteria», «BMS», «cell
  /// temperature», «pack».
  static bool eDellaBatteria(Entita e) =>
      _gradiDi(e) &&
      _dice(
        e,
        r'\b(battery|batteria|pack|hv|akku|batterie|bater[ií]a|bms|cell|cells|cella|celle|accumulatore|traction|trazione)\b',
      ) &&
      !_dice(e, r'\b(12\s?v|aux|ausiliaria|servizi)\b') &&
      !eDellAbitacolo(e) &&
      !eDiFuori(e);

  /// La velocita' dell'auto: la classe o l'unita' delle velocita', non il
  /// vento.
  static bool eVelocita(Entita e) =>
      (_classe(e) == 'speed' ||
          RegExp(
            r'^(km/h|mph|m/s)$',
            caseSensitive: false,
          ).hasMatch(e.unita ?? '')) &&
      !_dice(e, r'\b(wind|vento)\b');

  /// La potenza che l'auto usa adesso: una potenza che non parla di carica.
  static bool ePotenzaInUso(Entita e) =>
      (_classe(e) == 'power' ||
          RegExp(r'^(w|kw)$', caseSensitive: false).hasMatch(e.unita ?? '')) &&
      !_dice(
        e,
        r'(charg|ricaric|carica|lade|recharge|wallbox|plug|solar|sole)',
      );

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

  static double? _kmh(Entita? e) {
    final n = _numero(e?.stato);
    if (n == null) return null;
    return switch ((e!.unita ?? '').toLowerCase()) {
      'mph' => n * 1.609344,
      'm/s' => n * 3.6,
      _ => n,
    };
  }

  static double? _gradi(Entita? e) {
    final n = _numero(e?.stato);
    if (n == null) return null;
    return (e!.unita ?? '').contains('F') ? (n - 32) * 5 / 9 : n;
  }

  static double? _kwh(Entita? e) {
    final n = _numero(e?.stato);
    if (n == null || n <= 0) return null;
    return switch ((e!.unita ?? '').toLowerCase()) {
      'wh' => n / 1000,
      'mwh' => n * 1000,
      _ => n,
    };
  }

  static double? _w(Entita? e) {
    final n = _numero(e?.stato);
    if (n == null) return null;
    return switch ((e!.unita ?? '').toLowerCase()) {
      'kw' => n * 1000,
      'mw' => n * 1000000,
      _ => n,
    };
  }

  /// Il consumo in kWh ogni 100 km, dall'unita' dello stato; fuori da 5-60
  /// non sta in piedi (`consumoMisurato` della pagina).
  static double? _kwh100(Entita? e) {
    final n = _numero(e?.stato);
    if (n == null || n <= 0) return null;
    const miglio = 1.609344;
    final v = switch ((e!.unita ?? '').toLowerCase().replaceAll(' ', '')) {
      '' || 'kwh/100km' => n,
      'kwh/100mi' => n / miglio,
      'wh/km' => n / 10,
      'wh/mi' => n / 10 / miglio,
      'km/kwh' => 100 / n,
      'mi/kwh' => 100 / (n * miglio),
      _ => null,
    };
    return v == null || v < 5 || v > 60 ? null : v;
  }

  static bool? _acceso(Entita? e) =>
      switch ((e?.stato ?? '').trim().toLowerCase()) {
        'on' || 'true' || '1' => true,
        'off' || 'false' || '0' => false,
        _ => null,
      };

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

/// Tiene la fonte gdahome di gdanav al passo con la casa.
///
/// I dati dell'auto arrivano a ogni cambiamento dei suoi sensori, subito, e
/// solo di quelli ([_abbonati]). L'auto stessa — quale, e di che modello —
/// sta nella configurazione della plancia, e il ponte non avvisa quando
/// cambia: la si rilegge
/// - **subito**, quando la plancia dentro l'app la scrive (un'auto cambiata
///   nella sezione Auto: `laPlanciaHaScritto`, dalla cucitura);
/// - quando il filo si riapre, quando si torna nell'app e quando si apre il
///   navigatore ([rileggi], dalla schermata);
/// - e ogni minuto, per quello che si cambia da un altro telefono o dal
///   browser.
class IlFiloDellaVettura {
  IlFiloDellaVettura(this.collegamento, this.fonte, {this.persone});

  final Collegamento collegamento;
  final SorgenteGdahome fonte;

  /// Le persone della plancia sulla mappa di gdanav (`le_persone.dart`): lo
  /// stesso filo, la stessa configurazione, lo stesso abbonamento.
  final GestorePersone? persone;
  List<PersonaDellaPlancia> _diCasa = const [];

  /// Ogni quanto si rilegge la configurazione anche senza motivi: un'auto
  /// cambiata dal browser o da un altro telefono non avvisa nessuno.
  static const ogni = Duration(minutes: 1);

  LaVettura? _vettura;
  StatoAuto? _mandata;
  final _ascolti = <StreamSubscription<void>>[];
  Timer? _orologio;
  bool _dentro = false;
  bool _spento = false;

  /// Gli stati dei sensori dell'auto, dal loro abbonamento.
  final _valori = <String, Entita>{};
  StreamSubscription<Map<String, dynamic>>? _abbonamento;
  Filo? _filoAbbonato;
  String _abbonatiA = '';

  /// Un ponte che `subscribe_entities` non lo lascia passare: allora gli
  /// stati si prendono come prima, tutti.
  bool _comePrima = false;

  void avvia() {
    _chiediDa(chiediAllaCasa);
    _comandiDa(comandoAllaCasa);
    _ascolti
      ..add(collegamento.cambiamenti.listen((_) => _comeVa()))
      ..add(collegamento.entitaCambiate.listen((_) => _aggiorna()))
      ..add(laPlanciaHaScritto.listen((_) => rileggi()));
    _orologio = Timer.periodic(ogni, (_) => rileggi());
    _comeVa();
  }

  void ferma() {
    _spento = true;
    for (final a in _ascolti) {
      a.cancel();
    }
    _ascolti.clear();
    _orologio?.cancel();
    unawaited(_abbonamento?.cancel());
    _abbonamento = null;
    fonte.collegamento(false);
    _chiediDa(null);
    _comandiDa(null);
  }

  /// Un comando di gdanav per la casa (i viaggi pianificati,
  /// `ponte/viaggi/…`, e `ponte/auto/ricariche-di-casa`), sul filo di adesso. La casa sa chi chiede: ognuno
  /// legge e scrive solo i suoi viaggi. Senza filo, un errore che gdanav
  /// dice in parole.
  Future<Object?> comandoAllaCasa(Map<String, Object?> comando) async {
    final filo = collegamento.filo;
    final tipo = comando['type'];
    // Solo i viaggi, e l'ultima ricarica a casa dell'auto (il costo vero del
    // viaggio in elettrico): gdanav non manda altro alla casa da qui.
    if (tipo is! String ||
        !(tipo.startsWith('ponte/viaggi/') ||
            tipo == 'ponte/auto/ricariche-di-casa')) {
      throw ArgumentError.value(
        tipo,
        'type',
        'gdanav chiede alla casa solo i viaggi e le ricariche di casa',
      );
    }
    if (filo == null || !collegamento.dentro || _spento) {
      throw StateError('la casa non è collegata');
    }
    return filo.risultato(Map<String, dynamic>.of(comando));
  }

  /// Dice a gdanav come mandare un comando alla casa
  /// (`SorgenteGdahome.chiedi`): per nome, come [_chiediDa].
  void _comandiDa(Future<Object?> Function(Map<String, Object?>)? come) {
    try {
      (fonte as dynamic).chiedi = come;
    } on NoSuchMethodError {
      /* gdanav di prima: niente pianificatore nella casa. */
    }
  }

  /// Dice a gdanav come chiedere dati freschi (`SorgenteGdahome.aggiorna`).
  ///
  /// Per nome e non per tipo: gdanav arriva dalla sua repository a un commit
  /// fissato in pubspec.lock, e un gdanav di prima questo campo non ce l'ha.
  /// Con quello si va avanti come prima, senza richieste.
  void _chiediDa(Future<void> Function()? come) {
    try {
      (fonte as dynamic).aggiorna = come;
    } on NoSuchMethodError {
      /* gdanav di prima: i dati arrivano quando l'auto li aggiorna. */
    }
  }

  void _comeVa() {
    final dentro = collegamento.dentro;
    fonte.collegamento(dentro);
    if (dentro && !_dentro) unawaited(rileggi());
    _dentro = dentro;
  }

  /// Rilegge la configurazione della plancia: quale auto, e con quali
  /// sensori. Se nel frattempo l'auto e' cambiata, gdanav lo sa adesso.
  Future<void> rileggi() async {
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
      final tutti = Map<String, dynamic>.from(valori['values'] as Map);
      var vettura = LaVettura.daiValori(tutti);
      if (vettura != null) {
        vettura = vettura.coiVicini(await _viciniDi(filo, vettura));
      }
      _vettura = vettura;
      if (persone != null) _diCasa = lePersoneDallaPlancia(tutti);
      fonte.descrivi(_vettura?.autoConLaCapacita(_statoDi));
      await _abbonati(filo);
      _aggiorna();
    } catch (_) {
      /* La configurazione non e' arrivata: resta quella di prima, e si
       * riprova alla prossima occasione, al piu' fra un minuto. */
    }
  }

  /// I sensori dello stesso dispositivo della batteria ([LaVettura.vicini]).
  ///
  /// Il registro si chiede una volta per batteria, non a ogni rilettura: la
  /// risposta e' pesante, e un dispositivo non cambia sensori ogni minuto.
  Future<List<String>> _viciniDi(Filo filo, LaVettura vettura) async {
    final batteria = vettura.sensoreDellaBatteria;
    if (batteria == null) return const [];
    if (batteria == _viciniDella) return _vicini;
    try {
      final r = await filo.risultato({
        'type': 'config/entity_registry/list_for_display',
      });
      final elenco = r is Map ? r['entities'] : null;
      if (elenco is! List) return const [];
      String? dispositivo;
      for (final e in elenco) {
        if (e is Map && e['ei'] == batteria) dispositivo = '${e['di'] ?? ''}';
      }
      final prefisso = prefissoDellAuto(batteria);
      _vicini = [
        for (final e in elenco)
          if (e is Map &&
              '${e['ei'] ?? ''}'.startsWith('sensor.') &&
              e['ei'] != batteria &&
              (dispositivo != null && dispositivo.isNotEmpty
                  ? '${e['di'] ?? ''}' == dispositivo
                  /* Una batteria senza dispositivo (un sensore modello, un
                   * MQTT senza device): i sensori col suo stesso nome
                   * davanti, «sensor.b10_…». */
                  : prefisso != null &&
                        '${e['ei']}'.startsWith('sensor.$prefisso')))
            '${e['ei']}',
      ];
      _viciniDella = batteria;
      return _vicini;
    } catch (_) {
      /* Un registro che non risponde non toglie niente: restano le caselle. */
      return const [];
    }
  }

  String? _viciniDella;
  List<String> _vicini = const [];

  /// «sensor.b10_battery» → «b10_»: il nome dell'auto davanti ai suoi
  /// sensori. `null` quando davanti c'e' una parola qualsiasi («battery_»,
  /// «ev_», «car_»), che prenderebbe i sensori di mezza casa.
  static String? prefissoDellAuto(String batteria) {
    final nome = batteria.split('.').last;
    final i = nome.indexOf('_');
    if (i < 2) return null;
    final primo = nome.substring(0, i);
    const generici = {
      'battery',
      'batteria',
      'ev',
      'car',
      'auto',
      'my',
      'la',
      'il',
      'the',
      'vehicle',
      'veicolo',
      'state',
      'stato',
      'soc',
      'level',
      'livello',
    };
    return generici.contains(primo) ? null : '${primo}_';
  }

  /* ── Dati freschi, quando gdanav li chiede ─────────────────────────────
   *
   * In viaggio ogni minuto, all'avvio, tornando nell'app: gdanav chiede
   * (`SorgenteGdahome.aggiorna`) e qui si fa rileggere l'auto
   * all'integrazione con `homeassistant.update_entity`, come fa il pulsante
   * «Aggiorna» e come fa l'integrazione gdanav. Prima da gdahome non si
   * chiedeva mai niente: i dati arrivavano quando l'integrazione dell'auto
   * aggiornava da se', e «Da gdahome · 2 h fa» restava li'. */

  /// Non piu' spesso di cosi': le integrazioni dei costruttori passano da
  /// un cloud che non ama essere svegliato ogni secondo.
  static const chiediAlPiuOgni = Duration(seconds: 30);
  DateTime _chiestoIl = DateTime(0);

  Future<void> chiediAllaCasa() async {
    final filo = collegamento.filo;
    final v = _vettura;
    if (filo == null || !collegamento.dentro || v == null || _spento) return;
    final adesso = DateTime.now();
    if (adesso.difference(_chiestoIl) < chiediAlPiuOgni) return;
    _chiestoIl = adesso;
    final ids = <String>{
      for (final id in v.sensori.values)
        if (!id.startsWith('dm.')) id,
    }.toList()..sort();
    if (ids.isEmpty) return;
    await filo.risultato({
      'type': 'call_service',
      'domain': 'homeassistant',
      'service': 'update_entity',
      'target': {'entity_id': ids},
    }, entro: const Duration(seconds: 25));
  }

  /* ── Le temperature, quando l'auto dorme ───────────────────────────────
   *
   * Molte integrazioni (Leapmotor fra queste) dicono la temperatura di fuori
   * e della batteria solo con l'auto sveglia: ferma, il sensore diventa
   * «unknown» e la temperatura «non arriva». Una temperatura di un'ora fa
   * vale ancora per il consumo: la si tiene fino a [ricordoTemperature]. */
  static const ricordoTemperature = Duration(hours: 2);
  final _temperature = <String, Entita>{};

  Entita? _conRicordo(String id, Entita? e) {
    if (e != null && !e.muta) {
      if (LaVettura.eGradi(e)) _temperature[id] = e;
      return e;
    }
    final prima = _temperature[id];
    final quando = prima?.aggiornataIl;
    if (prima != null &&
        quando != null &&
        DateTime.now().difference(quando) <= ricordoTemperature) {
      return prima;
    }
    return e;
  }

  /// Si abbona ai sensori dell'auto, e a nient'altro.
  ///
  /// `subscribe_entities` coi loro nomi da' prima il loro stato di adesso,
  /// poi solo quello che cambia, in forma stretta. Prima qui si chiedeva
  /// tutta la casa (`serveLaCasa`): un `get_states` da un megabyte e mezzo, e
  /// poi ogni cambiamento di ogni entita', a ogni collegamento e anche senza
  /// un'auto. Da fuori casa passava tutto dal centralino, e due volte,
  /// perche' la plancia gli stati se li chiede per conto suo.
  ///
  /// Dopo una caduta il filo rifa' l'abbonamento da solo, e Home Assistant
  /// rimanda lo stato di adesso: quello che e' cambiato nel frattempo arriva
  /// cosi'.
  Future<void> _abbonati(Filo filo) async {
    final ids = <String>{
      for (final id in _vettura?.sensori.values ?? const <String>[])
        if (!id.startsWith('dm.')) id,
      ...?_vettura?.vicini,
      for (final p in _diCasa) ...[
        p.entita,
        if (p.indirizzo.isNotEmpty) p.indirizzo,
      ],
    }.toList()..sort();
    final quali = ids.join(',');
    if (identical(filo, _filoAbbonato) && quali == _abbonatiA) return;
    await _abbonamento?.cancel();
    _abbonamento = null;
    _valori.clear();
    _filoAbbonato = filo;
    _abbonatiA = quali;
    if (ids.isEmpty) return;
    if (_comePrima) {
      await collegamento.serveLaCasa();
      return;
    }
    try {
      final flusso = await filo.sottoscrivi({
        'type': 'subscribe_entities',
        'entity_ids': ids,
      });
      if (_spento) return;
      /* Se l'abbonamento muore, al prossimo giro (`rileggi`, ogni minuto) si
       * rifa': prima l'errore si ingoiava e restavano i valori di prima. */
      void rifaiAlProssimoGiro([Object? _]) {
        if (identical(_filoAbbonato, filo)) _filoAbbonato = null;
      }

      _abbonamento = flusso.listen(
        _cambiate,
        onError: rifaiAlProssimoGiro,
        onDone: rifaiAlProssimoGiro,
      );
    } on ComandoRifiutato {
      _comePrima = true;
      await collegamento.serveLaCasa();
    } catch (_) {
      /* Il filo e' caduto mentre si chiedeva: al prossimo giro si riprova. */
      _filoAbbonato = null;
    }
  }

  /// Un messaggio dell'abbonamento: `a` le entita' con lo stato intero, `c`
  /// quello che e' cambiato, `r` quelle che non ci sono piu'.
  void _cambiate(Map<String, dynamic> evento) {
    if (evento['a'] case final Map aggiunte) {
      for (final MapEntry(:key, :value) in aggiunte.entries) {
        if (Entita.daStretta('$key', value) case final e?) _valori['$key'] = e;
      }
    }
    if (evento['c'] case final Map cambi) {
      for (final MapEntry(:key, :value) in cambi.entries) {
        final prima = _valori['$key'];
        if (prima != null) _valori['$key'] = prima.conIlCambio(value);
      }
    }
    if (evento['r'] case final List tolte) {
      for (final id in tolte) {
        _valori.remove('$id');
      }
    }
    _aggiorna();
  }

  void _aggiorna() {
    if (_spento) return;
    /* I suoi sensori dall'abbonamento; e se qualcun altro ha gia' chiesto
     * tutta la casa (l'elenco dei dispositivi, un ponte di prima), anche da
     * li'. */
    Entita? stato(String id) => _statoDi(id);
    persone?.aggiorna([for (final p in _diCasa) ?sullaMappa(p, stato)]);
    final v = _vettura;
    if (v == null) return;
    fonte.descrivi(v.autoConLaCapacita(stato));
    _mandaIlConsumo(v.datiDelConsumo(stato));
    final l = v.lettura(stato);
    if (l == null || _uguale(l, _mandata)) return;
    _mandata = l;
    fonte.manda(l);
  }

  /// Lo stato di un sensore: dall'abbonamento, o dalla casa intera se
  /// qualcun altro l'ha gia' chiesta, con il ricordo delle temperature.
  Entita? _statoDi(String id) =>
      _conRicordo(id, _valori[id] ?? collegamento.stato?[id]);

  /* ── I dati del consumo, a gdanav ──────────────────────────────────────
   *
   * L'energia che resta, la capacita' vera, il consumo misurato, il clima:
   * gdanav li usa al posto delle sue stime (`docs/DATI-AUTO.md` di GdAAuto).
   * `StatoAuto` non ha dove metterli, e vanno alla fonte accanto alla
   * lettura, coi nomi del contratto. Il gdanav di prima non li prende: si
   * prova una volta, e se non c'e' dove si smette. */
  bool _consumoSenzaPosto = false;
  String _consumoMandato = '';

  void _mandaIlConsumo(Map<String, Object> dati) {
    if (_consumoSenzaPosto) return;
    final firma = jsonEncode(dati);
    if (firma == _consumoMandato) return;
    _consumoMandato = firma;
    try {
      (fonte as dynamic).datiDelConsumo = dati;
    } on NoSuchMethodError {
      _consumoSenzaPosto = true;
    }
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
      a.temperaturaEsternaC == b.temperaturaEsternaC &&
      a.temperaturaBatteriaC == b.temperaturaBatteriaC &&
      a.velocitaKmh == b.velocitaKmh &&
      a.potenzaKw == b.potenzaKw;
}
