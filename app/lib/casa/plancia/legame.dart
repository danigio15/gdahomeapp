/// L'apparecchio che arriva da un'integrazione, gia' compilato.
///
/// «Ho una lavatrice Hoover, uso l'integrazione hOn e mi espone tutti i dati:
/// dalla sezione voglio prendere le integrazioni, cosi' ogni elettrodomestico
/// avra' sicuramente tutte le sue informazioni.» Scegliere il dispositivo e
/// poi ribattere a mano venti identificativi nelle venti caselle giuste —
/// sapendo gia' quale sia il tempo rimanente e quale la fase — non e' una cosa
/// che si chiede a qualcuno.
///
/// Qui sta la parte che ragiona: dato un dispositivo di Home Assistant con le
/// sue entita', dire di che apparecchio si tratta, in che stanza sta, quale
/// entita' fa da potenza, quale da tempo rimanente, quale da tasto
/// acceso/spento. Niente schermo, niente filo: dati dentro, dati fuori — cosi'
/// si prova su una lavatrice di hOn finta senza accendere niente.
///
/// E' il porto in Dart di `core/appliance-device-binding.js` della plancia, e
/// deve restare tale: se qui si indovinasse in un altro modo, la stessa
/// lavatrice verrebbe configurata in due modi diversi a seconda di dove la si
/// tocca, e una delle due sembrerebbe sbagliata.
///
/// Gli indizi si leggono in tre posti: l'identificativo dell'entita', il suo
/// nome e la chiave di traduzione. La terza e' la piu' fedele — hOn chiama
/// `remaining_time` il tempo che manca in qualunque lingua sia Home Assistant
/// — e per questo pesa quanto le altre due messe insieme.
library;

import '../catalogo/catalogo.dart';
import '../entita.dart';
import 'apparecchio.dart';
import 'carichi.dart' show campiScelti;

/* ─── Le parole ridotte all'osso ─────────────────────────────────────────── */

String _pulito(Object? valore) => '${valore ?? ''}'.trim();
String _basso(Object? valore) => _pulito(valore).toLowerCase();
String _dominioDi(String id) => _basso(id).split('.').first;

final _accenti = RegExp('[̀-ͯ]');
final _nonLettere = RegExp(r'[^a-z0-9]+');

/// Un nome ridotto all'osso, per confrontarne due: minuscolo, senza accenti,
/// senza separatori.
///
/// Serve a riconoscere l'interruttore che porta il nome del dispositivo, che
/// e' una cosa che le integrazioni fanno tutte e che nessuna lista di parole
/// puo' sapere in anticipo.
String nomeRidotto(Object? valore) => _basso(valore)
    .replaceAll(_accenti, '')
    .replaceAll(_nonLettere, ' ')
    .trim();

/* ─── Un'entita', come la legge chi indovina ─────────────────────────────── */

/// Quello che serve per indovinare a cosa serve un'entita'.
///
/// Nella plancia questi campi arrivano da due parti — il registro di Home
/// Assistant e gli attributi dello stato — e ogni regola le mette insieme al
/// volo. Qui si mettono insieme una volta sola, quando la riga si costruisce:
/// il ponte le ha gia' unite nel catalogo, e per i sensori che stanno fuori da
/// un dispositivo le unisce [DaLeggere.dallEntita]. Il risultato e' lo stesso,
/// e ogni regola diventa una riga sola invece di tre.
class DaLeggere {
  const DaLeggere({
    required this.id,
    this.nome = '',
    this.chiaveDiTraduzione = '',
    this.unita = '',
    this.classe = '',
    this.classeDiStato = '',
    this.categoria = '',
    this.spenta = false,
  });

  /// Da una riga del catalogo delle integrazioni.
  factory DaLeggere.dalCatalogo(EntitaDelDispositivo una) => DaLeggere(
    id: una.id,
    nome: una.nome,
    chiaveDiTraduzione: una.chiaveDiTraduzione,
    unita: una.unita,
    classe: una.classe,
    classeDiStato: una.classeDiStato,
    categoria: una.categoria,
    spenta: una.spenta,
  );

  /// Da un'entita' della casa, che di registro non sa niente: quello che si
  /// sa sta negli attributi del suo stato.
  factory DaLeggere.dallEntita(Entita una) => DaLeggere(
    id: una.id,
    nome: '${una.attributi['friendly_name'] ?? ''}',
    unita: '${una.attributi['unit_of_measurement'] ?? ''}',
    classe: '${una.attributi['device_class'] ?? ''}',
    classeDiStato: '${una.attributi['state_class'] ?? ''}',
  );

  final String id;
  final String nome;
  final String chiaveDiTraduzione;
  final String unita;
  final String classe;
  final String classeDiStato;

  /// `config` o `diagnostic`: entita' di servizio.
  final String categoria;

  final bool spenta;
}

/// Le parole di un'entita', come le cerca ogni regola.
///
/// La chiave di traduzione ci finisce **due volte**, ed e' voluto: e' l'unico
/// indizio che non cambia con la lingua di Home Assistant, e chi cerca una
/// parola in inglese su una casa italiana trova solo quella.
String indiziDi(DaLeggere una) {
  final pezzi = [
    _basso(una.id).split('.').skip(1).join('.'),
    _basso(una.nome),
    _basso(una.chiaveDiTraduzione),
    _basso(una.chiaveDiTraduzione),
  ];
  return ' ${pezzi.join(' ').replaceAll(RegExp(r'[_\-./]+'), ' ')} ';
}

const _unitaDellEnergia = {'kwh', 'wh', 'mwh'};
const _unitaDellaPotenza = {'w', 'kw'};

bool _eEnergia(DaLeggere una) =>
    _unitaDellEnergia.contains(_basso(una.unita)) ||
    _basso(una.classe) == 'energy';
bool _ePotenza(DaLeggere una) =>
    _unitaDellaPotenza.contains(_basso(una.unita)) ||
    _basso(una.classe) == 'power';

final _diOggi = RegExp(r'\b(today|daily|oggi|giorno|giornalier[ao]|day)\b');
final _diQuestoMese = RegExp(r'\b(month|monthly|mese|mensile)\b');
final _diQuestAnno = RegExp(r'\b(year|yearly|annual|anno|annuale)\b');
final _delCiclo = RegExp(
  r'\b(cycle|ciclo|current|corrente|last|ultimo|program|programma|run)\b',
);
final _delTotale = RegExp(
  r'\b(total|totale|lifetime|meter|contatore|consumption|consumo|cumulative)\b',
);
final _diRitardo = RegExp(r'\b(delay|delayed|ritard[oa]|start in|timer)\b');

/// Le entita' che parlano della radio invece che dell'apparecchio.
final _soloDiagnostica = RegExp(
  r'\b(rssi|signal|wifi|ip|mac|firmware|version|uptime|battery)\b',
);

/* ─── I ruoli ────────────────────────────────────────────────────────────── */

/// Quello che una regola sa oltre all'entita': com'e' fatto il resto.
class _Contesto {
  const _Contesto({this.nomeDelDispositivo = ''});
  final String nomeDelDispositivo;
}

/// Un ruolo: la casella da riempire, e quanto vale ogni indizio.
class _Ruolo {
  const _Ruolo(this.chiave, this.punteggio, {this.soloFreddo = false});

  final String chiave;
  final int? Function(DaLeggere una, String indizi, _Contesto contesto)
  punteggio;

  /// Vale solo per gli apparecchi che tengono il freddo.
  final bool soloFreddo;
}

/// I ruoli, **in ordine di assegnazione**.
///
/// Un'entita' presa da un ruolo non viene offerta ai successivi, e i ruoli
/// piu' stretti stanno prima: il «contatore totale» e' l'ultimo a scegliere
/// fra le energie, non il primo — altrimenti si prenderebbe quella di oggi.
final _ruoli = <_Ruolo>[
  _Ruolo('power_entity', (una, indizi, _) {
    if (_dominioDi(una.id) != 'sensor' || !_ePotenza(una)) return null;
    var punti = 10;
    if (RegExp(r'\b(power|potenza|watt)\b').hasMatch(indizi)) punti += 3;
    if (RegExp(
      r'\b(voltage|current|apparent|reactive|factor|tension|amper)\b',
    ).hasMatch(indizi)) {
      punti -= 3;
    }
    if (_basso(una.categoria) == 'diagnostic') punti -= 5;
    return punti;
  }),
  _Ruolo('daily_energy_entity', (una, indizi, _) {
    if (_dominioDi(una.id) != 'sensor' || !_eEnergia(una)) return null;
    return _diOggi.hasMatch(indizi) ? 10 : null;
  }),
  _Ruolo('monthly_energy_entity', (una, indizi, _) {
    if (_dominioDi(una.id) != 'sensor' || !_eEnergia(una)) return null;
    return _diQuestoMese.hasMatch(indizi) ? 10 : null;
  }),
  _Ruolo('last_energy_entity', (una, indizi, _) {
    if (_dominioDi(una.id) != 'sensor' || !_eEnergia(una)) return null;
    if (_diQuestAnno.hasMatch(indizi) || _delTotale.hasMatch(indizi)) {
      return null;
    }
    return _delCiclo.hasMatch(indizi) ? 8 : null;
  }),
  _Ruolo('total_energy_entity', (una, indizi, _) {
    if (_dominioDi(una.id) != 'sensor' || !_eEnergia(una)) return null;
    if (_diQuestAnno.hasMatch(indizi) || _delCiclo.hasMatch(indizi)) {
      return null;
    }
    var punti = 2;
    final quale = _basso(una.classeDiStato);
    if (quale == 'total_increasing') {
      punti += 6;
    } else if (quale == 'total') {
      punti += 4;
    }
    if (_delTotale.hasMatch(indizi)) punti += 4;
    return punti;
  }),
  _Ruolo('state_entity', (una, indizi, _) {
    final dominio = _dominioDi(una.id);
    if (dominio == 'binary_sensor') {
      return RegExp(
            r'\b(running|active|working|operating|in funzione|attiv[oa])\b',
          ).hasMatch(indizi)
          ? 4
          : null;
    }
    if (dominio != 'sensor' || _basso(una.unita).isNotEmpty) return null;
    if (RegExp(
      r'\b(remote|door|connection|connectivity|lock|error|fault)\b',
    ).hasMatch(indizi)) {
      return null;
    }
    if (RegExp(
      r'\b(machine (state|status)|machine_(state|status)|operation (state|status))\b',
    ).hasMatch(indizi)) {
      return 9;
    }
    if (RegExp(r'\b(program (phase|status)|phase|fase)\b').hasMatch(indizi)) {
      return 8;
    }
    if (RegExp(r'\b(status|stato|state|mode|modalita)\b').hasMatch(indizi)) {
      return 5;
    }
    return null;
  }),
  _Ruolo('remaining_entity', (una, indizi, _) {
    if (_dominioDi(una.id) != 'sensor' || _diRitardo.hasMatch(indizi)) {
      return null;
    }
    if (!RegExp(
      r'\b(remaining|remain|rimanente|rimanenti|left|end time|finish|fine)\b',
    ).hasMatch(indizi)) {
      return null;
    }
    var punti = 8;
    final unita = _basso(una.unita);
    if (const ['min', 'minutes', 's', 'h', 'sec'].contains(unita)) punti += 3;
    if (const ['duration', 'timestamp'].contains(_basso(una.classe))) {
      punti += 2;
    }
    return punti;
  }),
  _Ruolo('cycle_duration_entity', (una, indizi, _) {
    if (_dominioDi(una.id) != 'sensor' || _diRitardo.hasMatch(indizi)) {
      return null;
    }
    if (RegExp(r'\b(remaining|elapsed|trascors[oa])\b').hasMatch(indizi)) {
      return null;
    }
    if (!RegExp(
      r'\b(duration|durata|total time|program time|cycle time)\b',
    ).hasMatch(indizi)) {
      return null;
    }
    return const ['min', 'minutes', 's', 'h'].contains(_basso(una.unita))
        ? 9
        : 6;
  }),
  _Ruolo('temperature_entity', soloFreddo: true, (una, indizi, _) {
    if (_dominioDi(una.id) != 'sensor') return null;
    if (_basso(una.classe) != 'temperature' &&
        !_basso(una.unita).contains('°')) {
      return null;
    }
    if (RegExp(
      r'\b(target|setpoint|obiettivo|desired|set)\b',
    ).hasMatch(indizi)) {
      return null;
    }
    var punti = 6;
    if (RegExp(
      r'\b(fridge|frigo|refrigerator|frigorifero|cooler)\b',
    ).hasMatch(indizi)) {
      punti += 4;
    }
    if (RegExp(r'\b(freezer|congelatore)\b').hasMatch(indizi)) punti -= 2;
    if (RegExp(
      r'\b(ambient|room|ambiente|external|esterna)\b',
    ).hasMatch(indizi)) {
      punti -= 3;
    }
    return punti;
  }),
  _Ruolo('temperature_entity_2', soloFreddo: true, (una, indizi, _) {
    if (_dominioDi(una.id) != 'sensor') return null;
    if (_basso(una.classe) != 'temperature' &&
        !_basso(una.unita).contains('°')) {
      return null;
    }
    if (RegExp(
      r'\b(target|setpoint|obiettivo|desired|set)\b',
    ).hasMatch(indizi)) {
      return null;
    }
    if (RegExp(
      r'\b(ambient|room|ambiente|external|esterna)\b',
    ).hasMatch(indizi)) {
      return null;
    }
    return RegExp(r'\b(freezer|congelatore)\b').hasMatch(indizi) ? 10 : 3;
  }),
  /* Il tasto acceso/spento, che e' il piu' difficile da indovinare.
   *
   * Una lavatrice connessa espone dieci interruttori — pausa, prelavaggio,
   * acquaplus, un risciacquo in piu', due, il vapore, le ore notturne — e uno
   * solo accende la macchina. Le liste di parole sotto sono utili ma parlano
   * una lingua: su una casa italiana «Pausa» non e' `pause` e «Prelavaggio»
   * non e' `prewash`, e tutti gli interruttori finivano a pari punteggio, col
   * tasto scelto in pratica a sorte.
   *
   * Il segnale che non dipende dalla lingua e' un altro: l'interruttore
   * principale porta il nome del dispositivo. hOn chiama «Lavatrice» quello
   * della lavatrice, Home Connect chiama «Forno» quello del forno; le opzioni
   * del programma no, quelle hanno il loro nome. Vale piu' di ogni parola,
   * quindi pesa piu' di ogni parola. */
  _Ruolo('control_entity', (una, indizi, contesto) {
    final dominio = _dominioDi(una.id);
    if (!const [
      'switch',
      'light',
      'fan',
      'input_boolean',
    ].contains(dominio)) {
      return null;
    }
    var punti = dominio == 'switch' ? 6 : 3;
    final suo = nomeRidotto(una.nome);
    final del = nomeRidotto(contesto.nomeDelDispositivo);
    if (suo.isNotEmpty && del.isNotEmpty && suo == del) punti += 9;
    if (RegExp(
      r'\b(wash|start|run|power|on off|onoff|main|operation|dry|cook|oven|dish|'
      r'remote start|working|avvio|avvia|accensione|accendi|marcia|funzionamento)\b',
    ).hasMatch(indizi)) {
      punti += 5;
    }
    if (RegExp(
      r'\b(pause|child lock|lock|eco|steam|delay|extra|silent|anti|dose|dosage|'
      r'led|light|buzzer|sound|remote control|keep fresh|night|standby|auto)\b',
    ).hasMatch(indizi)) {
      punti -= 4;
    }
    /* Le stesse, come le scrive un Home Assistant in italiano. Radici e non
     * parole intere: «risciacquo» e «risciacqui» sono la stessa opzione. */
    if (RegExp(
      r'(pausa|prelavagg|risciacqu|vapore|acquaplus|ammollo|notturn|notte|'
      r'blocco|bambin|antipieg|stiro|detersiv|ritard|sporco|silenzios|'
      r'centrifug|temperatur|programm|efficienz|capacit|carico|lingua|igien|hygiene)',
    ).hasMatch(indizi)) {
      punti -= 4;
    }
    if (_pulito(una.categoria).isNotEmpty) punti -= 6;
    return punti;
  }),
  _Ruolo('alert_entity', (una, indizi, _) {
    if (_dominioDi(una.id) != 'binary_sensor') return null;
    if (_basso(una.classe) == 'problem') return 9;
    return RegExp(
          r'\b(error|errore|fault|guasto|problem|problema|anomal|alarm|allarme)\b',
        ).hasMatch(indizi)
        ? 6
        : null;
  }),
  _Ruolo('last_start_entity', (una, indizi, _) {
    if (_dominioDi(una.id) != 'sensor' || _diRitardo.hasMatch(indizi)) {
      return null;
    }
    if (!RegExp(
      r'\b(start time|started|last start|avvio|begin|inizio)\b',
    ).hasMatch(indizi)) {
      return null;
    }
    return _basso(una.classe) == 'timestamp' ? 9 : 5;
  }),
  _Ruolo('last_cost_entity', (una, indizi, _) {
    if (_dominioDi(una.id) != 'sensor') return null;
    if (!RegExp(r'\b(cost|costo)\b').hasMatch(indizi)) return null;
    return RegExp(r'€|eur|\$|£').hasMatch(_basso(una.unita)) ? 9 : 4;
  }),
];

/// Le caselle che il motore sa riempire, nell'ordine in cui le riempie.
final leCaselleDelLegame = List<String>.unmodifiable(
  _ruoli.map((uno) => uno.chiave),
);

/// Gli apparecchi che tengono il freddo: solo per loro la temperatura e' una
/// barra della tessera al posto della potenza. Su una lavatrice la
/// «temperatura» e' quella del programma, e una barra al posto dei watt non
/// racconta niente.
const _tengonoIlFreddo = {'frigo', 'congelatore'};

/// Le entita' che si possono proporre: accese in Home Assistant, e non quelle
/// che parlano della radio invece che dell'apparecchio.
List<DaLeggere> _proponibili(List<DaLeggere> entita) => [
  for (final una in entita)
    if (una.id.contains('.') &&
        !una.spenta &&
        !_soloDiagnostica.hasMatch(indiziDi(una)))
      una,
];

/// Propone, per ogni casella, l'entita' del dispositivo che la fa.
///
/// Torna solo le caselle trovate. Un'entita' serve una casella sola; a pari
/// punteggio vince quella con l'identificativo piu' corto, che di solito e' la
/// piu' semplice — `energy_total` prima di `energy_total_water`.
Map<String, String> proponiLeCaselle(
  List<DaLeggere> entita, {
  String tipo = '',
  String nomeDelDispositivo = '',
}) {
  final freddo = _tengonoIlFreddo.contains(_basso(tipo));
  final contesto = _Contesto(nomeDelDispositivo: nomeDelDispositivo);
  final prese = <String>{};
  final proposta = <String, String>{};
  final quali = _proponibili(entita);
  for (final ruolo in _ruoli) {
    if (ruolo.soloFreddo && !freddo) continue;
    DaLeggere? migliore;
    int? quanto;
    for (final una in quali) {
      if (prese.contains(una.id)) continue;
      final punti = ruolo.punteggio(una, indiziDi(una), contesto);
      if (punti == null || punti <= 0) continue;
      if (migliore == null ||
          punti > quanto! ||
          (punti == quanto && una.id.length < migliore.id.length)) {
        migliore = una;
        quanto = punti;
      }
    }
    if (migliore == null) continue;
    prese.add(migliore.id);
    proposta[ruolo.chiave] = migliore.id;
  }
  return proposta;
}

/* ─── I parenti che stanno fuori dal dispositivo ─────────────────────────── */

/// Le caselle che si possono riempire con un'entita' che sta fuori.
const _caselleDiFuori = [
  'power_entity',
  'daily_energy_entity',
  'monthly_energy_entity',
  'total_energy_entity',
];

/// I sensori che stanno fuori dal dispositivo ma parlano di lui.
///
/// La lavatrice di chi ha chiesto questa funzione e' **due** dispositivi, non
/// uno: hOn porta il programma, la fase, il tempo rimanente e i comandi, e una
/// presa Zigbee sotto la macchina porta i watt e il contatore. Sono due voci
/// diverse nel registro di Home Assistant, e nessuna delle due, da sola,
/// riempie una tessera. In mezzo ci sono anche i sensori che uno si costruisce
/// da se' — `sensor.energia_oggi_lavatrice` — che non stanno su nessun
/// dispositivo perche' sono aiutanti.
///
/// Si cercano solo per le caselle rimaste vuote, e solo quelle dei numeri:
/// potenza ed energia. Il comando no, mai — pescare un interruttore per nome
/// vuol dire prima o poi accendere l'apparecchio del vicino di scaffale. E si
/// cercano solo fra le entita' che portano il nome del dispositivo scritto
/// dentro, che e' l'unica parentela verificabile senza chiedere a nessuno.
Map<String, String> parentiFuoriDalDispositivo({
  required String nomeDelDispositivo,
  required Iterable<Entita> casa,
  Iterable<String> escludi = const [],
  List<String> caselle = _caselleDiFuori,
}) {
  /* Parole di almeno quattro lettere: «tv» dentro un identificativo lo trova
   * ovunque. */
  final pezzi = [
    for (final uno in nomeRidotto(nomeDelDispositivo).split(' '))
      if (uno.length >= 4) uno,
  ];
  if (pezzi.isEmpty) return const {};
  final gia = {
    for (final uno in escludi)
      if (_pulito(uno).isNotEmpty) _pulito(uno),
  };
  final parenti = <DaLeggere>[];
  for (final una in casa) {
    if (!una.id.startsWith('sensor.') || gia.contains(una.id)) continue;
    final riga = DaLeggere.dallEntita(una);
    final parole = nomeRidotto('${riga.id} ${riga.nome}');
    if (pezzi.every(parole.contains)) parenti.add(riga);
  }
  if (parenti.isEmpty) return const {};

  final presi = <String>{};
  final trovati = <String, String>{};
  for (final chiave in caselle) {
    final ruolo = _ruoli.where((uno) => uno.chiave == chiave).firstOrNull;
    if (ruolo == null) continue;
    DaLeggere? migliore;
    int? quanto;
    for (final una in parenti) {
      if (presi.contains(una.id)) continue;
      final punti = ruolo.punteggio(una, indiziDi(una), const _Contesto());
      if (punti == null || punti <= 0) continue;
      if (migliore == null ||
          punti > quanto! ||
          (punti == quanto && una.id.length < migliore.id.length)) {
        migliore = una;
        quanto = punti;
      }
    }
    if (migliore == null) continue;
    presi.add(migliore.id);
    trovati[chiave] = migliore.id;
  }
  return trovati;
}

/* ─── Che apparecchio e' ─────────────────────────────────────────────────── */

/// Il catalogo degli apparecchi della plancia: la chiave, e come si chiama.
///
/// E' l'elenco di `APPLIANCE_CATALOG`, nello stesso ordine: chi sceglie il
/// tipo a mano deve trovare le stesse voci che trova nella Config, e chi lo
/// fa indovinare deve ottenere una chiave che la plancia sa disegnare.
const catalogoDegliApparecchi = <(String, String)>[
  ('lavatrice', 'Lavatrice'),
  ('lavastoviglie', 'Lavastoviglie'),
  ('asciugatrice', 'Asciugatrice'),
  ('forno', 'Forno'),
  ('microonde', 'Microonde'),
  ('frigo', 'Frigorifero'),
  ('congelatore', 'Congelatore'),
  ('piano_cottura', 'Piano cottura'),
  ('cappa', 'Cappa'),
  ('ferro', 'Ferro da stiro'),
  ('aspirapolvere', 'Aspirapolvere'),
  ('robot', 'Robot aspirapolvere'),
  ('condizionatore', 'Condizionatore'),
  ('ventilatore', 'Ventilatore'),
  ('scaldabagno', 'Scaldabagno'),
  /* Il boiler d'accumulo non e' lo scaldabagno a muro: e' il cilindrone a
   * pavimento del solare termico. La chiave e' «accumulo» perche' «boiler» da
   * sola e' da sempre l'altro nome dello scaldabagno. */
  ('accumulo', 'Boiler'),
  ('tv', 'TV'),
  ('caffe', 'Caffettiera'),
  ('tostapane', 'Tostapane'),
  ('bollitore', 'Bollitore'),
  ('friggitrice', 'Friggitrice ad aria'),
  ('generico', 'Altro'),
];

final _chiaviDegliApparecchi = {
  for (final uno in catalogoDegliApparecchi) uno.$1,
};

/// Come si chiama un tipo, per chi guarda. Una chiave che il catalogo non
/// conosce si mostra com'e': meglio una parola strana che una casella vuota.
String comeSiChiamaIlTipo(String chiave) =>
    catalogoDegliApparecchi
        .where((uno) => uno.$1 == chiave)
        .map((uno) => uno.$2)
        .firstOrNull ??
    chiave;

/// Gli indizi che stanno nel nome, nel modello e nella marca.
final _tipiDalNome = <(String, RegExp)>[
  ('lavatrice', RegExp(r'\b(washer dryer|lavasciuga)\b')),
  ('asciugatrice', RegExp(r'\b(dryer|tumble|asciugatrice|asciug)\b')),
  (
    'lavatrice',
    RegExp(r'\b(washing machine|washer|washing|lavatrice|lavatr|wash)\b'),
  ),
  (
    'lavastoviglie',
    RegExp(r'\b(dishwasher|dish|lavastoviglie|lavastov)\b'),
  ),
  ('forno', RegExp(r'\b(oven|forno|cooker)\b')),
  ('microonde', RegExp(r'\b(microwave|microonde)\b')),
  ('congelatore', RegExp(r'\b(freezer|congelatore)\b')),
  ('frigo', RegExp(r'\b(fridge|refrigerator|frigorifero|frigo|cooler)\b')),
  (
    'piano_cottura',
    RegExp(r'\b(hob|cooktop|induction|piano cottura|induzione)\b'),
  ),
  ('cappa', RegExp(r'\b(hood|cappa|extractor)\b')),
  ('caffe', RegExp(r'\b(coffee|caffe|espresso)\b')),
  (
    'condizionatore',
    RegExp(
      r'\b(air conditioner|air conditioning|conditioner|condizionatore|clima|ac unit)\b',
    ),
  ),
  ('robot', RegExp(r'\b(robot|vacuum|aspirapolvere)\b')),
  ('scaldabagno', RegExp(r'\b(water heater|scaldabagno|boiler)\b')),
  ('tv', RegExp(r'\b(tv|television|televisore)\b')),
  ('bollitore', RegExp(r'\b(kettle|bollitore)\b')),
  ('friggitrice', RegExp(r'\b(air fryer|fryer|friggitrice)\b')),
  ('ferro', RegExp(r'\b(iron|ferro da stiro)\b')),
  ('ventilatore', RegExp(r'\b(fan|ventilatore)\b')),
];

/// Gli indizi che stanno nelle entita': quando il nome non dice niente —
/// «HW-2431» — lo dicono le sue caselle.
final _tipiDalleEntita = <(String, RegExp)>[
  ('asciugatrice', RegExp(r'\b(dry level|dryness|drying|tumble)\b')),
  (
    'lavatrice',
    RegExp(r'\b(spin speed|spin|rinse|detergent|softener|prewash|wash)\b'),
  ),
  (
    'lavastoviglie',
    RegExp(r'\b(rinse aid|salt|tabs|half load|dishwasher)\b'),
  ),
  ('forno', RegExp(r'\b(oven|preheat|cavity|meat probe)\b')),
  ('frigo', RegExp(r'\b(fridge|refrigerator|super cool|freezer)\b')),
];

/// Che apparecchio e', letto dal nome, dal modello e dalle sue entita'.
String indovinaIlTipo({
  String nome = '',
  String modello = '',
  String marca = '',
  List<DaLeggere> entita = const [],
}) {
  final parole =
      ' ${[nome, modello, marca].map(_basso).join(' ').replaceAll(RegExp(r'[_\-./]+'), ' ')} ';
  for (final (chiave, quale) in _tipiDalNome) {
    if (quale.hasMatch(parole) && _chiaviDegliApparecchi.contains(chiave)) {
      return chiave;
    }
  }
  final indizi = entita.map(indiziDi).join(' ');
  for (final (chiave, quale) in _tipiDalleEntita) {
    if (quale.hasMatch(indizi) && _chiaviDegliApparecchi.contains(chiave)) {
      return chiave;
    }
  }
  return 'generico';
}

/// La stanza della plancia che porta lo stesso nome dell'area di Home
/// Assistant.
String stanzaPerArea(String area, List<Apparecchio> stanze) {
  final voluta = _basso(area).replaceAll(_accenti, '');
  if (voluta.isEmpty) return '';
  for (final una in stanze) {
    if (_basso(una.nome).replaceAll(_accenti, '') == voluta) {
      return una.id.isNotEmpty ? una.id : una.nome;
    }
  }
  return '';
}

/* ─── Il legame ──────────────────────────────────────────────────────────── */

/// Le caselle che dicono da quale dispositivo viene un apparecchio.
const caselleDelDispositivo = [
  'device_id',
  'integration',
  'integration_name',
  'device_name',
  'device_manufacturer',
  'device_model',
];

/// Com'e' andata: cosa si e' riempito, e cosa si e' lasciato com'era.
class ComEAndata {
  const ComEAndata({required this.riempite, required this.tenute});

  /// Le caselle che erano vuote e adesso hanno dentro un'entita'.
  final List<String> riempite;

  /// Le caselle che c'erano gia': non si toccano mai. Chi ha scritto a mano
  /// ha detto l'ultima parola, e un motore che indovina non gliela toglie.
  final List<String> tenute;
}

/// Collega un apparecchio a un dispositivo: scrive il legame, propone il tipo,
/// la stanza e le entita' delle caselle — **senza toccare quello che chi
/// configura ha gia' scritto a mano**.
ComEAndata collegaAlDispositivo(
  Apparecchio quale, {
  required Dispositivo dispositivo,
  required List<EntitaDelDispositivo> entita,
  Integrazione? integrazione,
  List<Apparecchio> stanze = const [],
  Map<String, String> fuori = const {},
}) {
  final righe = [for (final una in entita) DaLeggere.dalCatalogo(una)];

  /* Chi collega un dispositivo ha detto tutto, comprese le caselle lasciate
   * vuote: la passata che indovina le entita' dal nome dell'apparecchio —
   * «Lavatrice» prende ogni `sensor.lavatrice_*` della casa — riempirebbe
   * l'elenco con tutto il dispositivo, e il dettaglio mostrerebbe venti righe
   * invece delle cinque della tessera. */
  final appunti = Map<String, dynamic>.from(
    quale.dentro['metadata'] is Map
        ? Map<String, dynamic>.from(quale.dentro['metadata'] as Map)
        : <String, dynamic>{},
  )..[campiScelti] = true;
  quale.metti('metadata', appunti);

  quale.metti('device_id', _pulito(dispositivo.id));
  final dominio = _pulito(integrazione?.dominio ?? dispositivo.integrazione);
  quale.metti('integration', dominio);
  quale.metti(
    'integration_name',
    _pulito(integrazione?.nome).isNotEmpty ? _pulito(integrazione?.nome) : dominio,
  );
  quale.metti('device_name', _pulito(dispositivo.nome));
  quale.metti('device_manufacturer', _pulito(dispositivo.marca));
  quale.metti('device_model', _pulito(dispositivo.modello));

  /* Le entita' accese: quelle spente in Home Assistant non hanno uno stato da
   * mostrare, e il numero deve essere lo stesso che il menu ha promesso. */
  quale.metti('device_entities', <String>[
    ...{
      for (final una in entita)
        if (!una.spenta && _pulito(una.id).isNotEmpty) _pulito(una.id),
    },
  ]);

  if (quale.nome.isEmpty) quale.metti('name', _pulito(dispositivo.nome));

  final tipoAdesso = _basso(
    _pulito(quale.dentro['visual_key']).isNotEmpty
        ? quale.dentro['visual_key']
        : (_pulito(quale.dentro['device_type']).isNotEmpty
              ? quale.dentro['device_type']
              : quale.dentro['icon']),
  );
  if (tipoAdesso.isEmpty ||
      tipoAdesso == 'generico' ||
      tipoAdesso == 'appliance') {
    final tipo = indovinaIlTipo(
      nome: dispositivo.nome,
      modello: dispositivo.modello,
      marca: dispositivo.marca,
      entita: righe,
    );
    quale.metti('icon', tipo);
    quale.metti('visual_key', tipo);
    quale.metti('device_type', tipo);
    quale.metti('visual_type', 'asset');
  }

  if (_pulito(quale.dentro['room_id']).isEmpty) {
    final stanza = stanzaPerArea(dispositivo.stanza, stanze);
    if (stanza.isNotEmpty) {
      final trovata = stanze
          .where((una) => una.id == stanza || una.nome == stanza)
          .firstOrNull;
      if (trovata != null) {
        quale.mettiLaStanza(trovata);
      } else {
        quale.metti('room_id', stanza);
      }
    }
  }

  final proposta = proponiLeCaselle(
    righe,
    tipo: '${quale.dentro['visual_key'] ?? ''}',
    nomeDelDispositivo: dispositivo.nome,
  );
  /* I parenti di fuori riempiono solo dove il dispositivo non arriva. */
  for (final voce in fuori.entries) {
    if (!proposta.containsKey(voce.key) && voce.value.isNotEmpty) {
      proposta[voce.key] = voce.value;
    }
  }

  final riempite = <String>[];
  final tenute = <String>[];
  for (final voce in proposta.entries) {
    if (_pulito(quale.dentro[voce.key]).isNotEmpty) {
      tenute.add(voce.key);
      continue;
    }
    quale.metti(voce.key, voce.value);
    riempite.add(voce.key);
  }

  final totale = _pulito(quale.dentro['total_energy_entity']);
  if (totale.isNotEmpty) {
    if (_pulito(quale.dentro['history_entity']).isEmpty) {
      quale.metti('history_entity', totale);
    }
    if (_pulito(quale.dentro['report_entity']).isEmpty) {
      quale.metti('report_entity', totale);
    }
  }
  if (_pulito(quale.dentro['energy_entity']).isEmpty) {
    final quale2 = totale.isNotEmpty
        ? totale
        : (_pulito(quale.dentro['monthly_energy_entity']).isNotEmpty
              ? _pulito(quale.dentro['monthly_energy_entity'])
              : _pulito(quale.dentro['daily_energy_entity']));
    if (quale2.isNotEmpty) quale.metti('energy_entity', quale2);
  }

  /* Lo specchio piatto delle entita': quello che la plancia legge quando non
   * vuole sapere in che casella stanno.
   *
   * Si scrive **diritto**, e non con `metti`: quello lo ricalcolerebbe dalle
   * otto caselle che il modello dichiara, e le caselle di un dispositivo sono
   * tredici. Il tempo rimanente e la fase non finirebbero nell'elenco, e la
   * plancia le vedrebbe scomparire da tutto quello che legge l'elenco invece
   * dei campi. */
  final gia = quale.dentro['entities'];
  quale.dentro['entities'] = <String>[
    ...{
      if (gia is List)
        for (final uno in gia)
          if (uno is String && uno.contains('.'))
            uno
          else if (uno is Map && '${uno['entity'] ?? uno['entity_id'] ?? ''}'.contains('.'))
            '${uno['entity'] ?? uno['entity_id']}',
      for (final chiave in leCaselleDelLegame)
        if (_pulito(quale.dentro[chiave]).contains('.'))
          _pulito(quale.dentro[chiave]),
    },
  ];

  return ComEAndata(riempite: riempite, tenute: tenute);
}

/// Toglie il legame e basta: le caselle restano come sono.
///
/// E' voluto. Chi scollega vuole smettere di seguire il dispositivo, non
/// buttare via la configurazione che si e' ritrovato addosso — e se la
/// volesse buttare, le caselle sono li' e si svuotano a mano.
void scollega(Apparecchio quale) {
  for (final chiave in caselleDelDispositivo) {
    quale.dentro.remove(chiave);
  }
  quale.dentro.remove('device_entities');
}

/// Da quale dispositivo viene, in una riga: «hOn · Hoover HW-2431 · 24 entita'».
String etichettaDelLegame(Apparecchio quale) {
  final integrazione = _pulito(quale.dentro['integration_name']).isNotEmpty
      ? _pulito(quale.dentro['integration_name'])
      : _pulito(quale.dentro['integration']);
  final chiLaFa = [
    _pulito(quale.dentro['device_manufacturer']),
    _pulito(quale.dentro['device_model']),
  ].where((uno) => uno.isNotEmpty).join(' ');
  final elenco = quale.dentro['device_entities'];
  final quante = elenco is List ? elenco.length : 0;
  return [
    if (integrazione.isNotEmpty) integrazione,
    if (chiLaFa.isNotEmpty) chiLaFa,
    if (quante > 0) quante == 1 ? '1 entita\'' : '$quante entita\'',
  ].join(' · ');
}

/// L'entita' principale, quella che la plancia comanda.
///
/// Il motore che indovina non la scrive, ed e' giusto cosi': nella dashboard
/// si collegano elettrodomestici e carichi, che di entita' principale non ne
/// hanno — hanno caselle. Qui l'integrazione si puo' aprire anche da una luce
/// o da una tapparella, e quelle invece **sono** una sola entita': senza
/// questa riga si collegherebbe il dispositivo e la luce resterebbe muta.
void mettiLEntitaPrincipale(
  Apparecchio quale,
  List<EntitaDelDispositivo> entita, {
  List<String> domini = const [],
}) {
  if (quale.entita.isNotEmpty || entita.isEmpty) return;
  for (final una in entita) {
    if (una.spenta) continue;
    final dominio = una.id.split('.').first;
    if (domini.isNotEmpty && !domini.contains(dominio)) continue;
    quale.metti('entity', una.id);
    return;
  }
  /* Nessuna del dominio giusto: meglio la prima che niente — chi apre la
   * scheda la vede scritta e la cambia, invece di trovare una casella vuota
   * e non sapere che il dispositivo era quello. */
  if (domini.isEmpty) quale.metti('entity', entita.first.id);
}

/// C'e' un dispositivo dietro questo apparecchio?
bool eCollegato(Apparecchio quale) =>
    _pulito(quale.dentro['device_id']).isNotEmpty;

/// Le integrazioni **che hanno dispositivi da mostrare**, in ordine di nome.
///
/// Un'integrazione senza dispositivi con entita' non e' una voce di menu: e'
/// un vicolo cieco con dentro scritto «niente».
List<(Integrazione, List<Dispositivo>)> integrazioniConDispositivi(
  IlCatalogo catalogo,
) {
  final dispositivi = [
    for (final uno in catalogo.dispositivi)
      if (uno.quanteEntita > 0) uno,
  ];
  final fuori = <(Integrazione, List<Dispositivo>)>[];
  for (final una in catalogo.integrazioni) {
    final suoi = [
      for (final uno in dispositivi)
        if (uno.integrazione == una.dominio) uno,
    ];
    if (suoi.isEmpty) continue;
    fuori.add((una, suoi));
  }
  fuori.sort((prima, dopo) => _basso(prima.$1.nome).compareTo(_basso(dopo.$1.nome)));
  return fuori;
}
