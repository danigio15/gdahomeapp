/// L'acqua calda: scaldabagni e caldaie.
///
/// Sono due macchine che si guardano per una domanda sola — «c'e' acqua
/// calda?» — e la rispondono in due modi diversi. Uno scaldabagno la dice con
/// la temperatura dell'acqua e con quanto manca all'obiettivo; una caldaia con
/// il **salto** fra mandata e ritorno, perche' due numeri vicini su una
/// caldaia accesa vogliono dire che l'acqua gira senza scaldare niente.
///
/// La pressione e' l'unica cosa di tutto questo che ogni tanto chiede di
/// alzarsi dal divano: sotto il bar il pressostato blocca la caldaia, e
/// accorgersene dalla Home e' meglio che accorgersene da una doccia fredda.
///
/// Le regole vengono da `scaldabagno-model.js` e `impianti-termici.js`.
library;

import 'configurazione.dart';
import 'numeri.dart';
import 'tessere.dart';

/* ─── Lo scaldabagno ─────────────────────────────────────────────────────── */

/// Da dove parte la corsa verso l'acqua calda, quando nessuno dichiara un
/// minimo: quindici gradi e' l'acqua di rete di una casa italiana — non e'
/// esatto per nessuno, ma e' onesto per tutti.
const num baseDellAcqua = 15;

/// Quanto vicino all'obiettivo si smette di dire «sta scaldando»: sotto il
/// mezzo grado la resistenza si sta gia' spegnendo da sola.
const num _tolleranza = 0.5;

final _accesiScaldabagno = RegExp(
  r'^(on|true|1|heat|heating|eco|performance|high_demand|electric|gas|heat_pump)$',
  caseSensitive: false,
);
final _spentiScaldabagno = RegExp(
  r'^(off|false|0|standby|idle|none)$',
  caseSensitive: false,
);

/// Acceso, spento, o non lo sappiamo.
bool? accesoDalloStato(String? stato) {
  final valore = pulito(stato);
  if (_accesiScaldabagno.hasMatch(valore)) return true;
  if (_spentiScaldabagno.hasMatch(valore)) return false;
  return null;
}

/// Cosa sta facendo uno scaldabagno.
enum StatoDelloScaldabagno { spento, scalda, pronto, ignoto }

/// Quanto manca all'acqua calda, da 0 a 1.
///
/// `null` quando non si sa: senza obiettivo non c'e' una corsa da misurare, e
/// una barra piena a caso e' peggio di nessuna barra.
double? quotaVersoObiettivo(num? temperatura, num? obiettivo, [num? base]) {
  if (temperatura == null || obiettivo == null) return null;
  final fondo = base ?? baseDellAcqua;
  final corsa = obiettivo - fondo;
  /* Un obiettivo sotto il fondo non e' una corsa: e' un fondo sbagliato, e
   * l'unica risposta onesta e' «o ci sei o non ci sei». */
  if (corsa <= 0) return temperatura >= obiettivo ? 1 : 0;
  return ((temperatura - fondo) / corsa).clamp(0, 1).toDouble();
}

/// La lettura di uno scaldabagno: cosa dicono adesso le sue caselle.
class LetturaDelloScaldabagno {
  const LetturaDelloScaldabagno({
    required this.nome,
    required this.entita,
    required this.comandabile,
    required this.acceso,
    required this.temperatura,
    required this.obiettivo,
    required this.potenza,
    required this.energia,
    required this.quota,
    required this.stato,
    required this.caselle,
  });

  final String nome;
  final String entita;

  /// Cosa si puo' premere: l'interruttore se c'e', se no l'entita' intera
  /// quando e' un `water_heater`, che si accende e si spegne da se'.
  final String comandabile;
  final bool? acceso;
  final num? temperatura;
  final num? obiettivo;
  final num? potenza;
  final num? energia;
  final double? quota;
  final StatoDelloScaldabagno stato;

  /// Le entita' che questa riga tiene d'occhio, per l'interruttore «nel
  /// widget»: basta che una sia rimasta dentro perche' la riga parli.
  final List<String> caselle;
}

bool eUnoScaldabagnoDiCasa(String entita) => RegExp(
  r'^water_heater\.[a-z0-9_]+$',
  caseSensitive: false,
).hasMatch(pulito(entita));

/// Le letture di tutti gli scaldabagni configurati.
List<LetturaDelloScaldabagno> lettureDegliScaldabagni(
  ConfigurazioneDellaPlancia config,
  Leggi leggi,
) => [
  for (final riga in config.scaldabagni) _letturaDelloScaldabagno(riga, leggi),
];

LetturaDelloScaldabagno _letturaDelloScaldabagno(
  Scaldabagno riga,
  Leggi leggi,
) {
  final principale = leggi(riga.entita);
  final attributi = principale?.attributi ?? const {};
  /* L'entita' di Home Assistant risponde per prima, e le caselle sciolte
   * riempiono solo quello che lei non dice: il dato dell'apparecchio e' quello
   * che l'apparecchio dichiara di se'. */
  final temperatura =
      comeNumero(attributi['current_temperature']) ??
      comeNumero(leggi(riga.temperatura)?.stato);
  final obiettivo =
      comeNumero(attributi['temperature']) ??
      comeNumero(leggi(riga.obiettivo)?.stato) ??
      /* L'obiettivo puo' stare su un termostato, e li' e' un attributo. */
      comeNumero(leggi(riga.obiettivo)?.attributi['temperature']);
  final acceso =
      accesoDalloStato(leggi(riga.interruttore)?.stato) ??
      (principale == null ? null : accesoDalloStato(principale.stato));
  final stato = acceso == false
      ? StatoDelloScaldabagno.spento
      : (acceso == null && temperatura == null)
      ? StatoDelloScaldabagno.ignoto
      : (temperatura == null || obiettivo == null)
      ? (acceso == true
            ? StatoDelloScaldabagno.scalda
            : StatoDelloScaldabagno.ignoto)
      : temperatura >= obiettivo - _tolleranza
      ? StatoDelloScaldabagno.pronto
      : StatoDelloScaldabagno.scalda;
  return LetturaDelloScaldabagno(
    nome: riga.nome.isNotEmpty
        ? riga.nome
        : pulito(attributi['friendly_name']).isNotEmpty
        ? pulito(attributi['friendly_name'])
        : riga.entita,
    entita: riga.entita,
    comandabile: riga.interruttore.isNotEmpty
        ? riga.interruttore
        : eUnoScaldabagnoDiCasa(riga.entita)
        ? riga.entita
        : '',
    acceso: acceso,
    temperatura: temperatura,
    obiettivo: obiettivo,
    potenza: comeNumero(leggi(riga.potenza)?.stato),
    energia: comeNumero(leggi(riga.energia)?.stato),
    quota: quotaVersoObiettivo(
      temperatura,
      obiettivo,
      comeNumero(attributi['min_temp']),
    ),
    stato: stato,
    caselle: riga.caselle,
  );
}

/* ─── La caldaia ─────────────────────────────────────────────────────────── */

final _accesiCaldaia = RegExp(
  r'^(on|true|1|heat|heating|burning|flame|dhw|attiva|attivo)$',
  caseSensitive: false,
);
final _spentiCaldaia = RegExp(
  r'^(off|false|0|idle|standby|none|ferma|fermo)$',
  caseSensitive: false,
);

bool? accesoDellaCaldaia(String? stato) {
  final valore = pulito(stato);
  if (_accesiCaldaia.hasMatch(valore)) return true;
  if (_spentiCaldaia.hasMatch(valore)) return false;
  return null;
}

/// La pressione di un impianto domestico sta fra un bar e mezzo e due e mezzo;
/// sotto l'uno il pressostato blocca tutto.
const num pressioneMinima = 1;
const num pressioneMassima = 3;

/// Come sta la pressione, quando c'e' un manometro.
enum VerdettoDellaPressione { bassa, buona, alta, ignota }

VerdettoDellaPressione verdettoDellaPressione(num? bar) {
  if (bar == null) return VerdettoDellaPressione.ignota;
  if (bar < pressioneMinima) return VerdettoDellaPressione.bassa;
  if (bar > 2.5) return VerdettoDellaPressione.alta;
  return VerdettoDellaPressione.buona;
}

/// Una valvola di riciclo: sono quelle che smistano l'acqua fra il
/// riscaldamento e il sanitario, e da come stanno si capisce dove va il calore.
class ValvolaDiRiciclo {
  const ValvolaDiRiciclo(this.entita, this.aperta);

  final String entita;
  final bool? aperta;
}

/// La lettura di una caldaia: cosa dicono adesso le sue caselle.
class LetturaDellaCaldaia {
  const LetturaDellaCaldaia({
    required this.nome,
    required this.uscita,
    required this.interruttore,
    required this.interruttoreAcceso,
    required this.valvole,
    required this.inFunzione,
    required this.acceso,
    required this.fiamma,
    required this.mandata,
    required this.ritorno,
    required this.acquaCalda,
    required this.pressione,
    required this.modulazione,
  });

  final String nome;

  /// Cosa c'e' all'altro capo del tubo: `radiatori` o `boiler`.
  final String uscita;
  final String interruttore;
  final bool? interruttoreAcceso;
  final List<ValvolaDiRiciclo> valvole;

  /// In funzione se brucia o se e' accesa; a riposo se lo sappiamo e non lo e';
  /// niente se nessuno l'ha mappata.
  final bool? inFunzione;
  final bool? acceso;
  final bool? fiamma;
  final num? mandata;
  final num? ritorno;
  final num? acquaCalda;
  final num? pressione;
  final num? modulazione;

  /// La differenza fra mandata e ritorno: la misura che dice se l'impianto
  /// sta davvero cedendo calore.
  num? get salto {
    if (mandata == null || ritorno == null) return null;
    return ((mandata! - ritorno!) * 10).round() / 10;
  }

  bool get lavora => fiamma == true || acceso == true;
}

/// Le letture di tutte le caldaie configurate.
List<LetturaDellaCaldaia> lettureDelleCaldaie(
  ConfigurazioneDellaPlancia config,
  Leggi leggi,
) => [for (final riga in config.caldaie) _letturaDellaCaldaia(riga, leggi)];

LetturaDellaCaldaia _letturaDellaCaldaia(Caldaia riga, Leggi leggi) {
  final fiamma = accesoDellaCaldaia(leggi(riga.fiamma)?.stato);
  final acceso = accesoDellaCaldaia(leggi(riga.stato)?.stato);
  return LetturaDellaCaldaia(
    nome: riga.nome,
    uscita: riga.uscita,
    interruttore: riga.interruttore,
    interruttoreAcceso: accesoDellaCaldaia(leggi(riga.interruttore)?.stato),
    valvole: [
      for (final entita in [riga.valvola, riga.valvola2])
        if (entita.isNotEmpty)
          ValvolaDiRiciclo(entita, accesoDellaCaldaia(leggi(entita)?.stato)),
    ],
    inFunzione: fiamma == true || acceso == true
        ? true
        : fiamma == false || acceso == false
        ? false
        : null,
    /* La fiamma accesa e' gia' una caldaia accesa: chi mappa solo il
     * bruciatore non deve mappare anche uno stato per vederla viva. */
    acceso: acceso ?? (fiamma == true ? true : null),
    fiamma: fiamma,
    mandata: comeNumero(leggi(riga.mandata)?.stato),
    ritorno: comeNumero(leggi(riga.ritorno)?.stato),
    acquaCalda: comeNumero(leggi(riga.acquaCalda)?.stato),
    pressione: comeNumero(leggi(riga.pressione)?.stato),
    modulazione: comeNumero(leggi(riga.modulazione)?.stato),
  );
}

/* ─── Le tessere ─────────────────────────────────────────────────────────── */

/// Le due tessere dell'acqua calda, nell'ordine della Home.
List<Tessera> tessereTermiche(ConfigurazioneDellaPlancia config, Leggi leggi) =>
    [?_scaldabagno(config, leggi), ?_caldaia(config, leggi)];

Tessera? _scaldabagno(ConfigurazioneDellaPlancia config, Leggi leggi) {
  final letture = lettureDegliScaldabagni(
    config,
    leggi,
  ).where((una) => una.caselle.any(config.widget.dentro)).toList();
  if (letture.isEmpty) return null;

  final piuDiUno = letture.length > 1;
  String suo(LetturaDelloScaldabagno una, int posto, String testo) {
    if (!piuDiUno) return testo;
    final nome = una.nome.isNotEmpty ? una.nome : 'Scaldabagno ${posto + 1}';
    return '$nome · $testo';
  }

  final righe = <Riga>[];
  for (final (posto, una) in letture.indexed) {
    if (una.comandabile.isNotEmpty) {
      righe.add(
        Riga(
          simbolo: '🔌',
          nome: suo(una, posto, 'Resistenza'),
          entita: una.comandabile,
          acceso: una.acceso == true,
          valore: una.acceso == true ? 'Acceso' : 'Spento',
          /* Un interruttore, non una scritta — salvo che quella entita' sia
           * fra quelle che si guardano e basta. */
          comando: config.siComanda(una.comandabile),
        ),
      );
    }
    void misura(
      String simbolo,
      String testo,
      String entita,
      num? valore,
      int cifre,
      String unita,
    ) {
      if (valore == null) return;
      righe.add(
        Riga(
          simbolo: simbolo,
          nome: suo(una, posto, testo),
          entita: entita.isNotEmpty ? entita : una.entita,
          grezzo: valore,
          valore: '${numero(valore, cifre: cifre)}$unita',
        ),
      );
    }

    misura('🌡️', 'Acqua adesso', una.entita, una.temperatura, 1, '°');
    misura('🎯', 'Obiettivo', una.entita, una.obiettivo, 1, '°');
    misura('⚡', 'Consumo', una.entita, una.potenza, 0, ' W');
    misura('📈', 'Oggi', una.entita, una.energia, 1, ' kWh');
  }
  if (righe.isEmpty) return null;

  /* Chi parla in grande: la prima riga che ha una temperatura dell'acqua. Se
   * nessuno ce l'ha — c'e' solo il rele' — parla l'interruttore. */
  final testa = letture.firstWhere(
    (una) => una.temperatura != null,
    orElse: () => letture.first,
  );
  final acceso = letture.any((una) => una.acceso == true);
  final scalda = letture.any(
    (una) => una.stato == StatoDelloScaldabagno.scalda,
  );
  final didascalia = switch (testa.stato) {
    StatoDelloScaldabagno.spento => 'Spento',
    StatoDelloScaldabagno.pronto => 'Acqua pronta',
    StatoDelloScaldabagno.scalda =>
      testa.obiettivo == null
          ? 'Sta scaldando'
          : 'Scalda verso ${numero(testa.obiettivo, cifre: 0)}°',
    StatoDelloScaldabagno.ignoto => '',
  };
  return Tessera(
    chiave: 'scaldabagno',
    colore: '#ea580c',
    etichetta: 'Scaldabagno',
    simbolo: '🚿',
    valore: testa.temperatura != null
        ? '${numero(testa.temperatura)}°'
        : acceso
        ? 'Acceso'
        : 'Spento',
    didascalia: didascalia,
    /* L'anello dice quanto manca all'acqua calda, che e' la sola cosa per cui
     * si guarda uno scaldabagno. */
    anello: testa.quota == null ? null : (testa.quota! * 100).round(),
    // Si accende mentre la resistenza lavora, non quando ha finito.
    attiva: scalda,
    righe: righe,
  );
}

Tessera? _caldaia(ConfigurazioneDellaPlancia config, Leggi leggi) {
  final caldaie = config.caldaie;
  if (caldaie.isEmpty) return null;
  if (!caldaie.any((una) => una.caselle.any(config.widget.dentro))) return null;
  final letture = lettureDelleCaldaie(config, leggi);
  if (letture.isEmpty) return null;
  /* Con piu' di una caldaia parla quella che ha qualcosa da dire — quella
   * accesa, se ce n'e' una. */
  final testa = letture.firstWhere(
    (una) => una.lavora,
    orElse: () => letture.first,
  );
  final pressione = verdettoDellaPressione(testa.pressione);
  final piuDiUna = letture.length > 1;

  final righe = <Riga>[];
  for (final (posto, una) in letture.indexed) {
    final riga = caldaie[posto];
    String suo(String testo) {
      if (!piuDiUna) return testo;
      final nome = una.nome.isNotEmpty ? una.nome : 'Caldaia ${posto + 1}';
      return '$nome · $testo';
    }

    if (riga.fiamma.isNotEmpty || riga.stato.isNotEmpty) {
      righe.add(
        Riga(
          simbolo: '🔥',
          nome: suo('Bruciatore'),
          entita: riga.fiamma.isNotEmpty ? riga.fiamma : riga.stato,
          acceso: una.lavora,
          valore: una.lavora ? 'Acceso' : 'Spento',
        ),
      );
    }
    void misura(
      String simbolo,
      String testo,
      String entita,
      num? valore,
      int cifre,
      String unita,
    ) {
      if (valore == null) return;
      righe.add(
        Riga(
          simbolo: simbolo,
          nome: suo(testo),
          entita: entita,
          grezzo: valore,
          valore: '${numero(valore, cifre: cifre)}$unita',
        ),
      );
    }

    misura('🌡️', 'Mandata', riga.mandata, una.mandata, 1, '°');
    misura('🌡️', 'Ritorno', riga.ritorno, una.ritorno, 1, '°');
    misura('🚿', 'Acqua calda', riga.acquaCalda, una.acquaCalda, 1, '°');
    misura('📊', 'Pressione', riga.pressione, una.pressione, 1, ' bar');
    misura('📶', 'Modulazione', riga.modulazione, una.modulazione, 0, '%');
  }
  if (righe.isEmpty) return null;

  final didascalia = pressione == VerdettoDellaPressione.bassa
      ? 'Pressione bassa: rabbocca'
      : testa.salto != null
      ? 'Salto ${numero(testa.salto)}°'
      : testa.lavora
      ? 'Bruciatore acceso'
      : 'Bruciatore spento';
  return Tessera(
    chiave: 'caldaia',
    colore: '#ef4444',
    etichetta: 'Caldaia',
    simbolo: '🔥',
    valore: testa.mandata != null
        ? '${numero(testa.mandata)}°'
        : testa.lavora
        ? 'Accesa'
        : 'Spenta',
    didascalia: didascalia,
    anello: testa.modulazione?.round(),
    attiva: testa.lavora,
    /* Una pressione sotto il minimo e' l'unica cosa di questa macchina che
     * chiede di fare qualcosa. */
    allarme: pressione == VerdettoDellaPressione.bassa,
    righe: righe,
  );
}
