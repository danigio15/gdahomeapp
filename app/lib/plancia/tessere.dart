/// Le tessere della Home: una per sezione, col numero che conta.
///
/// Sono la stessa cosa dei widget della plancia web, rifatti qui con le stesse
/// regole — quali sezioni fanno tessera, cosa va scritto in grande, cosa in
/// didascalia, quando una tessera e' accesa e quando chiede attenzione. Le
/// regole vengono da `home-widgets-section.js` di DashboardModern, e dove
/// questo file dice una cosa diversa da quello, ha torto questo file.
///
/// Ogni tessera legge la configurazione della sua sezione e lo stato vivo
/// delle entita'. Non c'e' Flutter: si prova con la casa demo.
library;

import '../casa/entita.dart';
import 'configurazione.dart';
import 'numeri.dart';
import 'rilevate.dart';
import 'termico.dart';

/// Come si legge lo stato di un'entita' adesso.
typedef Leggi = Entita? Function(String entita);

/// Una riga dentro una tessera: il nome, cosa dice, e — per chi conta — il
/// dato grezzo accanto al testo.
class Riga {
  const Riga({
    required this.nome,
    this.entita = '',
    this.valore = '',
    this.acceso,
    this.grezzo,
    this.simbolo = '',
    this.comando = false,
    this.daQuando,
    this.stanza = '',
  });

  final String nome;
  final String entita;
  final String valore;
  final bool? acceso;
  final num? grezzo;
  final String simbolo;

  /// `true` quando la riga ha un interruttore da premere.
  final bool comando;
  final DateTime? daQuando;
  final String stanza;

  @override
  String toString() => 'Riga($nome: $valore)';
}

/// La misura in fondo alla tessera: una batteria che si riempie, i segmenti
/// di «quanti su quanti», una barra, o niente.
enum Misura { nessuna, batteria, punti, barra }

class Tessera {
  const Tessera({
    required this.chiave,
    required this.colore,
    required this.etichetta,
    required this.valore,
    this.didascalia = '',
    this.anello,
    this.attiva,
    this.allarme = false,
    this.righe = const [],
    this.simbolo = '',
    this.quante,
  });

  /// `luci`, `clima`, `tapparelle`… oppure `custom-0`, `evidenza-1`.
  final String chiave;

  /// Il colore della sezione, come `#rrggbb`.
  final String colore;
  final String etichetta;

  /// Il numero grande, con la sua unita' attaccata: «21,8°», «7,66 kW»,
  /// oppure una parola: «Inserito».
  final String valore;
  final String didascalia;

  /// Quanto e' attiva, da 0 a 100. `null` quando una quota non ha senso.
  final int? anello;

  /// Detto dal modello quando l'anello non dice «accesa»: l'auto alla presa,
  /// la pompa che gira.
  final bool? attiva;

  /// Chiede attenzione: una finestra aperta, l'allarme scattato.
  final bool allarme;
  final List<Riga> righe;

  /// Il simbolo scelto da chi ha fatto la tessera (avvisi ed evidenze).
  final String simbolo;

  /// Quante cose racconta, quando non sono le righe a dirlo.
  final int? quante;

  bool get accesa => allarme || (attiva ?? (anello != null && anello! > 0));

  /// Il numero da una parte, l'unita' dall'altra. Una parola resta intera.
  (String, String) get valoreDiviso {
    final pezzi = RegExp(r'^([-+]?\d[\d.,\s]*)\s*(.*)$')
        .firstMatch(valore.trim());
    if (pezzi == null) return (valore.trim(), '');
    return (pezzi.group(1)!.trim(), pezzi.group(2)!.trim());
  }

  int? get _quota => anello?.clamp(0, 100);

  Misura get misura {
    if (_quota == null) return Misura.nessuna;
    if (chiave == 'ev') return Misura.batteria;
    if (righe.length >= 2) return Misura.punti;
    return Misura.barra;
  }

  int get segmenti => righe.length.clamp(0, 6);

  int get segmentiAccesi {
    final quota = _quota ?? 0;
    final minimo = quota > 0 ? 1 : 0;
    final accesi = (quota / 100 * segmenti).round();
    return (accesi < minimo ? minimo : accesi).clamp(0, segmenti);
  }

  /// Per ordine e visibilita' gli avvisi contano insieme sotto `custom`, le
  /// evidenze sotto `evidenza`, gli impianti sotto `energia`.
  String get famiglia {
    if (chiave.startsWith('custom-')) return 'custom';
    if (chiave.startsWith('evidenza-')) return 'evidenza';
    if (chiave.startsWith('energia')) return 'energia';
    return chiave;
  }

  @override
  String toString() => 'Tessera($chiave $valore «$didascalia»)';
}

/// Le tessere della Home, nell'ordine in cui vanno mostrate.
///
/// Vuota finche' la plancia non e' configurata: su una plancia appena nata le
/// tessere degli avvisi comparirebbero da sole, con dentro la casa di
/// qualcun altro.
List<Tessera> tessereDellaHome(
  ConfigurazioneDellaPlancia config,
  Leggi leggi, {
  DateTime? adesso,
  Map<String, DateTime>? tenute,
  Elenco? elenco,
}) {
  if (!config.configurata) return const [];
  final c = _Contesto(config, leggi, adesso ?? DateTime.now(), tenute ?? {});
  final tutte = <Tessera?>[
    ..._evidenze(c),
    _luci(c),
    _clima(c),
    _tapparelle(c),
    _sicurezza(c),
    _telecamere(c),
    ..._energia(c),
    _elettrodomestici(c),
    _temperatura(c),
    _ev(c),
    _robot(c),
    _solare(c),
    ...tessereTermiche(config, leggi),
    _ups(c),
    _minipc(c),
    _piscina(c),
    _prese(c),
    _media(c),
    _irrigazione(c),
    /* Le rilevate stanno in coda, dove le mette la plancia web: sono avvisi
     * che nascono da soli, e chi non ne ha in casa non le vede mai. */
    if (elenco != null) ...tessereRilevate(config, leggi, elenco),
    ..._avvisi(c),
  ];
  return _conLePreferenze(tutte.whereType<Tessera>().toList(), config.widget);
}

/// L'ordine scelto prima, poi quello naturale; le tessere nascoste non escono.
List<Tessera> _conLePreferenze(
  List<Tessera> tessere,
  PreferenzeDeiWidget preferenze,
) {
  int posto(Tessera t) {
    final indice = preferenze.ordine.indexOf(t.famiglia);
    if (indice >= 0) return indice;
    return preferenze.ordine.length + tessere.indexOf(t);
  }

  final visibili = tessere
      .where((t) => !preferenze.nascoste.contains(t.famiglia))
      .toList();
  visibili.sort((a, b) => posto(a).compareTo(posto(b)));
  return visibili;
}

/// La riga sotto il titolo «Widget»: quante sezioni, e quali chiedono
/// attenzione — coi nomi, perche' «2 chiedono attenzione» sopra otto tessere
/// obbliga a guardarle tutte.
String intestazioneDeiWidget(List<Tessera> tessere) {
  final quante = tessere.length;
  final sezioni = quante == 1 ? '1 sezione' : '$quante sezioni';
  final avvisi = tessere.where((t) => t.allarme).toList();
  if (avvisi.isEmpty) return '$sezioni · tutto tranquillo';
  final nomi = avvisi.map((t) => t.etichetta).join(', ');
  final attenzione = avvisi.length == 1
      ? '1 chiede attenzione'
      : '${avvisi.length} chiedono attenzione';
  return '$sezioni · $attenzione: $nomi';
}

/// Cosa e' acceso, per nome: «Faretti soggiorno · Strip TV», o il ripiego.
String _nomiAccesi(Iterable<Riga> righe, String ripiego) {
  final nomi = righe.map((r) => r.nome).where((n) => n.isNotEmpty).toList();
  return nomi.isEmpty ? ripiego : nomi.join(' · ');
}

int _quota(int accese, int totale) =>
    totale == 0 ? 0 : (accese / totale * 100).round();

/* ─── Il contesto: la configurazione e la casa, letti insieme ───────────── */

final _muti = RegExp(r'^(unknown|unavailable|none|)$', caseSensitive: false);
final _accesi = RegExp(
  r'^(on|true|1|running|attiva|attivo|open|aperta|heat|heating)$',
  caseSensitive: false,
);
final _spenti = RegExp(
  r'^(off|false|0|idle|ferma|fermo|closed|chiusa|standby)$',
  caseSensitive: false,
);

class _Contesto {
  _Contesto(this.config, this._leggi, this.adesso, this.tenute)
    : preferenze = config.widget;

  final ConfigurazioneDellaPlancia config;
  final Leggi _leggi;
  final DateTime adesso;
  final Map<String, DateTime> tenute;
  final PreferenzeDeiWidget preferenze;

  /// Lo stato di un'entita', o di quella dietro un riferimento `dm.…`.
  Entita? stato(String id) {
    final chiave = pulito(id);
    if (chiave.isEmpty) return null;
    final diretta = _leggi(chiave);
    if (diretta != null) return diretta;
    final risolta = chiave.startsWith('dm.') ? config.entita(chiave) : null;
    return risolta == null ? null : _leggi(risolta);
  }

  num? numeroDi(String id) => comeNumero(stato(id)?.stato);

  String testo(String id) => pulito(stato(id)?.stato).toLowerCase();

  bool dentro(String entita) => preferenze.dentro(entita);

  /// L'entita' dietro un riferimento, se la casella la lascia passare.
  ({String entita, num? valore, String stato})? riferimento(String rif) {
    final risolta = config.entita(rif);
    if (risolta == null || !dentro(risolta)) return null;
    return (
      entita: risolta,
      valore: comeNumero(_leggi(risolta)?.stato),
      stato: pulito(_leggi(risolta)?.stato),
    );
  }

  /// Il nome di un'entita' come lo legge una persona.
  String nome(String id) {
    final amichevole = pulito(stato(id)?.attributi['friendly_name']);
    if (amichevole.isNotEmpty) return amichevole;
    final coda = id.split('.').skip(1).join('.').replaceAll('_', ' ').trim();
    if (coda.isEmpty) return id;
    return coda[0].toUpperCase() + coda.substring(1);
  }

  /// I watt di un'entita', qualunque unita' dichiari.
  num? watt(String id) => _wattDi(stato(id));

  /// Una riga qualunque, da un'entita' qualunque: un numero con la sua
  /// unita', un acceso/spento, o lo stato cosi' com'e'. Chi non sa dire
  /// niente non fa riga.
  Riga? rigaDaEntita(String entita, [String simbolo = '•']) {
    final chiave = pulito(entita);
    if (chiave.isEmpty) return null;
    final letto = stato(chiave);
    final grezzo = pulito(letto?.stato);
    if (_muti.hasMatch(grezzo)) return null;
    final nomeSuo = nome(chiave);
    final valore = comeNumero(grezzo);
    if (valore != null) {
      final unita = pulito(letto?.attributi['unit_of_measurement']);
      final cifre = valore == valore.roundToDouble() || valore.abs() >= 100
          ? 0
          : 1;
      return Riga(
        simbolo: simbolo,
        nome: _senzaLaParolaDellUnita(nomeSuo, unita),
        entita: chiave,
        grezzo: valore,
        valore:
            '${numero(valore, cifre: cifre)}${unita.isEmpty ? '' : ' $unita'}',
      );
    }
    if (_accesi.hasMatch(grezzo)) {
      return Riga(
        simbolo: simbolo,
        nome: nomeSuo,
        entita: chiave,
        acceso: true,
        daQuando: letto?.cambiataIl,
        valore: 'Acceso',
      );
    }
    if (_spenti.hasMatch(grezzo)) {
      return Riga(
        simbolo: simbolo,
        nome: nomeSuo,
        entita: chiave,
        acceso: false,
        daQuando: letto?.cambiataIl,
        valore: 'Spento',
      );
    }
    return Riga(
      simbolo: simbolo,
      nome: nomeSuo,
      entita: chiave,
      valore: grezzo,
    );
  }
}

/// «Temperatura Pannello solare Temperature» diventa «Temperatura Pannello
/// solare»: la parola che il numero dice gia' non si ripete.
String _senzaLaParolaDellUnita(String nome, String unita) {
  if (unita.isEmpty) return nome;
  final parole = {
    '°C': ['temperature', 'temperatura'],
    '%': ['humidity', 'umidita', 'umidità', 'battery', 'batteria'],
    'W': ['power', 'potenza'],
    'kWh': ['energy', 'energia'],
  };
  for (final parola in parole[unita] ?? const <String>[]) {
    final coda = RegExp('\\s+$parola\$', caseSensitive: false);
    if (coda.hasMatch(nome) && nome.trim().split(RegExp(r'\s+')).length > 1) {
      return nome.replaceFirst(coda, '').trim();
    }
  }
  return nome;
}

const _fattoriDiPotenza = {
  'w': 1,
  'kw': 1000,
  'mw': 1000000,
  'watt': 1,
  'watts': 1,
};

num? _wattDi(Entita? letto) {
  if (letto == null) return null;
  final valore = comeNumero(letto.stato);
  if (valore == null) return null;
  final unita = pulito(letto.attributi['unit_of_measurement']);
  if (unita.isEmpty) return valore;
  final fattore = _fattoriDiPotenza[unita.toLowerCase().replaceAll(' ', '')];
  return fattore == null ? valore : valore * fattore;
}

/* ─── Le luci ───────────────────────────────────────────────────────────── */

Tessera? _luci(_Contesto c) {
  final gruppi = c.config.gruppiDiLuci();
  final righe = <Riga>[
    for (final gruppo in gruppi)
      for (final entita in gruppo.entita)
        if (c.dentro(entita))
          Riga(
            entita: entita,
            stanza: gruppo.stanza,
            nome: gruppo.nome(entita),
            acceso: c.testo(entita) == 'on',
            comando: c.config.siComanda(entita),
          ),
  ];
  if (righe.isEmpty) return null;
  final accese = righe.where((r) => r.acceso == true).toList();
  return Tessera(
    chiave: 'luci',
    colore: '#f59e0b',
    etichetta: 'Luci',
    valore: '${accese.length}',
    didascalia: _nomiAccesi(accese, '${accese.length} accese'),
    anello: _quota(accese.length, righe.length),
    righe: righe,
  );
}

/* ─── Il clima ──────────────────────────────────────────────────────────── */

/// Una riga del Clima da una unita' configurata.
class RigaDelClima {
  const RigaDelClima({
    required this.entita,
    required this.nome,
    required this.accesa,
    required this.modo,
    required this.ambiente,
    required this.obiettivo,
    required this.modi,
    required this.ventole,
    required this.ventola,
    required this.minima,
    required this.massima,
    required this.passo,
    required this.umidita,
    required this.azione,
    required this.tipo,
  });

  final String entita;
  final String nome;
  final bool accesa;
  final String modo;
  final num? ambiente;
  final num? obiettivo;
  final List<String> modi;
  final List<String> ventole;
  final String ventola;
  final num minima;
  final num massima;
  final num passo;
  final num? umidita;
  final String azione;
  final String tipo;

  Riga get riga => Riga(
    entita: entita,
    nome: nome,
    acceso: accesa,
    grezzo: ambiente,
    valore: ambiente == null ? modo : '${numero(ambiente, cifre: 1)}°',
  );
}

RigaDelClima? rigaDelClima(UnitaClima unita, Leggi leggi) {
  if (unita.entita.isEmpty) return null;
  final letto = leggi(unita.entita);
  final grezzo = pulito(letto?.stato).toLowerCase();
  final attributi = letto?.attributi ?? const {};
  List<String> elenco(Object? valori) => valori is List
      ? [
          for (final v in valori)
            if (pulito(v).isNotEmpty) pulito(v),
        ]
      : const [];
  return RigaDelClima(
    entita: unita.entita,
    nome: unita.nome.isNotEmpty ? unita.nome : unita.entita,
    accesa:
        letto != null &&
        grezzo != 'off' &&
        grezzo != 'unavailable' &&
        grezzo != 'unknown',
    modo: grezzo,
    ambiente: comeNumero(attributi['current_temperature']),
    obiettivo: comeNumero(attributi['temperature']),
    modi: elenco(attributi['hvac_modes']),
    ventole: elenco(attributi['fan_modes']),
    ventola: pulito(attributi['fan_mode']),
    minima: comeNumero(attributi['min_temp']) ?? 7,
    massima: comeNumero(attributi['max_temp']) ?? 35,
    passo: comeNumero(attributi['target_temp_step']) ?? 0.5,
    umidita: comeNumero(attributi['current_humidity']),
    azione: pulito(attributi['hvac_action']),
    tipo: unita.tipo,
  );
}

Tessera? _clima(_Contesto c) {
  final righe = <RigaDelClima>[
    for (final unita in c.config.unitaClima)
      if (c.dentro(unita.entita))
        if (rigaDelClima(unita, c.stato) case final riga?) riga,
  ];
  if (righe.isEmpty) return null;
  final accese = righe.where((r) => r.accesa).toList();
  final ambienti = righe.map((r) => r.ambiente).whereType<num>().toList();
  final media = ambienti.isEmpty
      ? null
      : ambienti.reduce((a, b) => a + b) / ambienti.length;
  final scelta = c.preferenze.sorgenti['clima'] ?? '';
  final sola = scelta.isEmpty
      ? null
      : righe.where((r) => r.entita == scelta).firstOrNull;
  final String valore;
  if (sola != null) {
    valore = sola.ambiente == null
        ? (sola.accesa ? 'Accesa' : 'Spenta')
        : '${numero(sola.ambiente, cifre: 1)}°';
  } else {
    valore = media == null ? '${accese.length}' : '${numero(media, cifre: 1)}°';
  }
  return Tessera(
    chiave: 'clima',
    colore: '#0ea5e9',
    etichetta: 'Clima',
    valore: valore,
    didascalia: sola != null
        ? '${sola.nome} · ${sola.accesa ? 'accesa' : 'spenta'}'
        : _nomiAccesi(accese.map((r) => r.riga), '${accese.length} accese'),
    anello: _quota(accese.length, righe.length),
    righe: righe.map((r) => r.riga).toList(),
  );
}

/* ─── Le finestre ───────────────────────────────────────────────────────── */

Tessera? _tapparelle(_Contesto c) {
  final coperture = c.config.coperture;
  if (coperture.isEmpty) return null;
  final righe = <Riga>[];
  for (final una in coperture) {
    if (una.soloFinestra) {
      for (final (entita, grata) in [
        (una.contatto, false),
        (una.inferriata, true),
      ]) {
        if (entita.isEmpty || !c.dentro(entita)) continue;
        final nomeSuo = una.nome.isNotEmpty ? una.nome : entita;
        final grezzo = c.testo(entita);
        final aperta =
            grezzo == 'on' || grezzo == 'open' || grezzo == 'opening';
        righe.add(
          Riga(
            entita: entita,
            nome: grata ? '$nomeSuo · Inferriata' : nomeSuo,
            acceso: una.invertita ? !aperta : aperta,
            valore: aperta ? 'Aperta' : 'Chiusa',
            stanza: una.stanzaId,
          ),
        );
      }
      continue;
    }
    final entita = una.entita;
    if (entita.isEmpty || !c.dentro(entita)) continue;
    final letto = c.stato(entita);
    final grezzo = pulito(letto?.stato).toLowerCase();
    var posizione = comeNumero(letto?.attributi['current_position']);
    if (posizione != null && una.invertita) posizione = 100 - posizione;
    final aperta =
        grezzo == 'opening' ||
        (posizione != null ? posizione > 0 : grezzo == 'open');
    righe.add(
      Riga(
        entita: entita,
        nome: una.nome.isNotEmpty ? una.nome : entita,
        acceso: aperta,
        grezzo: posizione?.round(),
        valore: posizione == null
            ? (aperta ? 'Aperta' : 'Chiusa')
            : '${posizione.round()}%',
        comando: c.config.siComanda(entita),
        stanza: una.stanzaId,
      ),
    );
  }
  if (righe.isEmpty) return null;
  final aperte = righe.where((r) => r.acceso == true).toList();
  return Tessera(
    chiave: 'tapparelle',
    colore: '#8b5cf6',
    etichetta: 'Finestre',
    valore: '${aperte.length}',
    didascalia: _nomiAccesi(aperte, '${aperte.length} aperte'),
    anello: _quota(aperte.length, righe.length),
    righe: righe,
  );
}

/* ─── La sicurezza ──────────────────────────────────────────────────────── */

const riferimentoDellaCentrale = 'dm.security_centrale_allarme';

Tessera? _sicurezza(_Contesto c) {
  final centrale = c.stato(riferimentoDellaCentrale);
  final porte = c.config.porte.where((p) => c.dentro(p.entita)).toList();
  if (centrale == null && porte.isEmpty) return null;
  final grezzo = pulito(centrale?.stato).toLowerCase();
  final scattato = grezzo == 'triggered' || grezzo == 'pending';
  final inserito = grezzo.startsWith('armed');
  final valore = centrale == null
      ? '—'
      : scattato
      ? 'Allarme!'
      : inserito
      ? 'Inserito'
      : 'Disinserito';
  return Tessera(
    chiave: 'sicurezza',
    colore: scattato ? '#e11d48' : '#10b981',
    etichetta: 'Sicurezza',
    allarme: scattato,
    valore: valore,
    didascalia: porte.isEmpty
        ? ''
        : (porte.first.nome.isNotEmpty ? porte.first.nome : porte.first.entita),
    anello: inserito || scattato ? 100 : 0,
    righe: [
      for (final porta in porte)
        Riga(
          entita: porta.entita,
          nome: porta.nome.isNotEmpty ? porta.nome : porta.entita,
          valore: _statoDellaPorta(c.testo(porta.entita)),
          simbolo: porta.icona,
        ),
    ],
  );
}

String _statoDellaPorta(String grezzo) => switch (grezzo) {
  'locked' => 'Chiusa a chiave',
  'unlocked' => 'Sbloccata',
  'open' => 'Aperta',
  'opening' => 'In apertura',
  'closing' => 'In chiusura',
  'closed' => 'Chiusa',
  _ => 'Tocca per aprire',
};

/* ─── Le telecamere ─────────────────────────────────────────────────────── */

Tessera? _telecamere(_Contesto c) {
  final righe = [
    for (final cam in c.config.telecamere)
      if (c.dentro(cam.entita))
        Riga(
          entita: cam.entita,
          nome: cam.nome.isNotEmpty ? cam.nome : cam.entita,
          stanza: cam.stanzaId,
        ),
  ];
  if (righe.isEmpty) return null;
  return Tessera(
    chiave: 'telecamere',
    colore: '#0284c7',
    etichetta: 'Telecamere',
    valore: '${righe.length}',
    didascalia: righe.first.nome,
    righe: righe,
  );
}

/* ─── L'energia ─────────────────────────────────────────────────────────── */

const _gruppiDellEnergia = [
  ('house', 'Casa', 'dm.energy_potenza_consumo_casa'),
  ('solar', 'Solare', 'dm.energy_potenza_fotovoltaico'),
  ('grid', 'Rete', 'dm.energy_potenza_scambio_rete'),
  ('battery', 'Batteria', 'dm.energy_potenza_batteria'),
];

class _LetturaDellImpianto {
  _LetturaDellImpianto(this.righe, this.casa, this.oggi);
  final List<({String gruppo, String nome, num? watt, num? carica})> righe;
  final num? casa;
  final num? oggi;
}

_LetturaDellImpianto _letturaDellImpianto(
  _Contesto c,
  Impianto impianto,
  bool primo,
) {
  Map<String, String> gruppo(String nome) => switch (nome) {
    'house' => impianto.casa,
    'solar' => impianto.solare,
    'grid' => impianto.rete,
    _ => impianto.batteria,
  };
  final righe = <({String gruppo, String nome, num? watt, num? carica})>[];
  num? casa;
  for (final (chiave, nome, rif) in _gruppiDellEnergia) {
    final entita = pulito(gruppo(chiave)['power']);
    final wattLetti = c.watt(entita.isNotEmpty ? entita : (primo ? rif : ''));
    if (chiave == 'house') casa = wattLetti;
    if (wattLetti != null) {
      righe.add((gruppo: chiave, nome: nome, watt: wattLetti, carica: null));
    }
  }
  final socEntita = pulito(impianto.batteria['soc']);
  final carica = c.numeroDi(
    socEntita.isNotEmpty
        ? socEntita
        : (primo ? 'dm.energy_stato_carica_batteria' : ''),
  );
  if (carica != null) {
    final indice = righe.indexWhere((r) => r.gruppo == 'battery');
    if (indice >= 0) {
      righe[indice] = (
        gruppo: 'battery',
        nome: 'Batteria',
        watt: righe[indice].watt,
        carica: carica,
      );
    } else {
      righe.add((
        gruppo: 'battery',
        nome: 'Batteria',
        watt: null,
        carica: carica,
      ));
    }
  }
  final oggiEntita = pulito(impianto.casa['daily_energy']);
  final oggi = c.numeroDi(
    oggiEntita.isNotEmpty
        ? oggiEntita
        : (primo ? 'dm.energy_consumo_casa_oggi' : ''),
  );
  return _LetturaDellImpianto(righe, casa, oggi);
}

Tessera? _tesseraEnergia(
  _LetturaDellImpianto lettura, {
  String chiave = 'energia',
  String etichetta = 'Energia',
}) {
  if (lettura.casa == null && lettura.righe.isEmpty) return null;
  return Tessera(
    chiave: chiave,
    colore: '#f97316',
    etichetta: etichetta,
    valore: watt(lettura.casa),
    didascalia: lettura.oggi == null
        ? 'potenza di casa'
        : 'Oggi ${numero(lettura.oggi, cifre: 1)} kWh',
    righe: [
      for (final r in lettura.righe)
        Riga(
          nome: r.nome,
          grezzo: r.watt ?? r.carica,
          valore: r.watt != null
              ? watt(r.watt)
              : '${numero(r.carica, cifre: 0)}%',
        ),
    ],
  );
}

List<Tessera> _energia(_Contesto c) {
  final impianti = c.config.impianti;
  if (impianti.isEmpty) return const [];
  final configurati = [
    for (final i in impianti)
      if (i.posto == 0 || i.configurato) i,
  ];
  final letture = [
    for (final i in configurati) _letturaDellImpianto(c, i, i.posto == 0),
  ];
  if (configurati.length < 2) {
    final sola = letture.isEmpty
        ? _LetturaDellImpianto(const [], null, null)
        : letture.first;
    return [if (_tesseraEnergia(sola) case final t?) t];
  }
  if (c.config.unaTesseraPerImpianto) {
    return [
      for (var i = 0; i < configurati.length; i += 1)
        if (_tesseraEnergia(
              letture[i],
              chiave: i == 0 || configurati[i].id == 'impianto'
                  ? 'energia'
                  : 'energia_${configurati[i].id}',
              etichetta: configurati[i].etichetta(),
            )
            case final t?)
          t,
    ];
  }
  /* Una sola, con la somma: chi ha unito due appartamenti ha una casa sola.
   * Sommare due `null` non fa zero, fa «non lo sappiamo». */
  num? somma(Iterable<num?> valori) {
    final veri = valori.whereType<num>().toList();
    return veri.isEmpty ? null : veri.reduce((a, b) => a + b);
  }

  final perGruppo = <String, ({num? watt, num? carica, int quante})>{};
  for (final lettura in letture) {
    for (final r in lettura.righe) {
      final voce = perGruppo[r.gruppo] ?? (watt: null, carica: null, quante: 0);
      perGruppo[r.gruppo] = (
        watt: r.watt == null ? voce.watt : (voce.watt ?? 0) + r.watt!,
        carica: r.carica == null ? voce.carica : (voce.carica ?? 0) + r.carica!,
        quante: voce.quante + (r.carica == null ? 0 : 1),
      );
    }
  }
  final righe = [
    for (final (chiave, nome, _) in _gruppiDellEnergia)
      if (perGruppo[chiave] case final v?
          when v.watt != null || v.carica != null)
        (
          gruppo: chiave,
          nome: nome,
          watt: v.watt,
          carica: v.quante > 0 ? v.carica! / v.quante : null,
        ),
  ];
  final unita = _LetturaDellImpianto(
    righe,
    somma(letture.map((l) => l.casa)),
    somma(letture.map((l) => l.oggi)),
  );
  return [if (_tesseraEnergia(unita) case final t?) t];
}

/* ─── Gli elettrodomestici ──────────────────────────────────────────────── */

String _senzaSeparatori(Object? valore) =>
    pulito(valore).toLowerCase().replaceAll(RegExp(r'[\s_\-.]+'), '');

const _paroleCheLavorano = {
  'running',
  'run',
  'inuse',
  'active',
  'started',
  'start',
  'inprogress',
  'operating',
  'working',
  'aborting',
  'cancelling',
  'ending',
  'washing',
  'wash',
  'mainwash',
  'prewash',
  'rinse',
  'rinsing',
  'spin',
  'spinning',
  'spinrinse',
  'drying',
  'dry',
  'tumbling',
  'tumble',
  'steam',
  'soak',
  'soaking',
  'airwash',
  'refresh',
  'weighting',
  'weightsensing',
  'sensing',
  'detecting',
  'heating',
  'heat',
  'preheat',
  'preheating',
  'cooking',
  'baking',
  'roasting',
  'grilling',
  'boiling',
  'cooling',
  'cool',
  'freezing',
  'defrosting',
  'playing',
  'cleaning',
  'opening',
  'open',
  'infunzione',
  'incorso',
  'avviato',
  'attivo',
  'funzionamento',
  'lavaggio',
  'prelavaggio',
  'risciacquo',
  'centrifuga',
  'asciugatura',
  'ammollo',
  'riscaldamento',
  'cottura',
  'raffreddamento',
  'inlavaggio',
};
const _paroleCheAspettano = {
  'standby',
  'pause',
  'paused',
  'pausing',
  'hold',
  'onhold',
  'rinsehold',
  'suspended',
  'scheduled',
  'programmed',
  'delayedstart',
  'delayed',
  'waitingtostart',
  'waiting',
  'queued',
  'error',
  'errore',
  'guasto',
  'dooropen',
  'doorisopen',
  'setprogram',
  'selected',
  'inpausa',
  'pausa',
  'sospeso',
  'programmato',
  'avvioritardato',
  'inattesa',
  'attesa',
  'portaaperta',
  'differita',
};
const _paroleCheStannoFerme = {
  'off',
  'poweroff',
  'poweredoff',
  'poweroffed',
  'closed',
  'stopped',
  'stop',
  'idle',
  'ready',
  'readytostart',
  'inactive',
  'initial',
  'sleep',
  'none',
  'nostate',
  'notconnected',
  'disconnected',
  'end',
  'ended',
  'finish',
  'finished',
  'complete',
  'completed',
  'done',
  'programended',
  'endprogrammed',
  'programmeended',
  'drycomplete',
  'abort',
  'aborted',
  'spento',
  'fermo',
  'pronta',
  'pronto',
  'inattivo',
  'finito',
  'terminato',
  'completato',
  'fine',
  'concluso',
  'scollegato',
};

/// Cosa dice una parola di stato: `running`, `standby`, `off` o niente.
String letturaDelloStato(Object? valore) {
  final parola = _senzaSeparatori(valore);
  if (parola.isEmpty) return '';
  if (_paroleCheLavorano.contains(parola)) return 'running';
  if (_paroleCheAspettano.contains(parola)) return 'standby';
  if (_paroleCheStannoFerme.contains(parola)) return 'off';
  return '';
}

final _nomeDiStato = RegExp(
  r'(?:^|[._-])(state|status|phase|fase)(?:[._-]|$)',
  caseSensitive: false,
);
final _nomeDiAttivita = RegExp(
  r'(?:^|[._-])(running|active|activity|operating|working)(?:[._-]|$)',
  caseSensitive: false,
);

/// Come sta un elettrodomestico adesso: `running`, `standby`, `off` o
/// `unavailable`, e i suoi watt.
({String modo, num? watt}) modoDellElettrodomestico(
  Elettrodomestico e,
  Leggi leggi, {
  DateTime? adesso,
  Map<String, DateTime>? tenute,
}) {
  String unita(String id) =>
      pulito(leggi(id)?.attributi['unit_of_measurement'])
          .toLowerCase()
          .replaceAll(' ', '');
  final potenza = RegExp(r'^(w|kw|mw|watt|watts)$').hasMatch(unita(e.potenza))
      ? e.potenza
      : '';
  final controllo =
      RegExp(r'^(switch|light|input_boolean|fan)\.').hasMatch(e.controllo)
      ? e.controllo
      : '';
  var statoEnt = e.statoEntita.isNotEmpty && leggi(e.statoEntita) != null
      ? e.statoEntita
      : '';
  if (statoEnt.isEmpty) {
    for (final id in e.entita) {
      if (!RegExp(r'^(sensor|binary_sensor)\.').hasMatch(id) ||
          !_nomeDiStato.hasMatch(id)) {
        continue;
      }
      if (letturaDelloStato(leggi(id)?.stato).isNotEmpty) {
        statoEnt = id;
        break;
      }
    }
  }
  if (statoEnt.isEmpty) {
    for (final id in e.entita) {
      if (id.startsWith('binary_sensor.') &&
          _nomeDiAttivita.hasMatch(id) &&
          const [
            'on',
            'off',
          ].contains(pulito(leggi(id)?.stato).toLowerCase())) {
        statoEnt = id;
        break;
      }
    }
  }
  final grezzi = comeNumero(leggi(potenza)?.stato);
  final wattLetti = grezzi == null
      ? null
      : unita(potenza) == 'kw'
      ? grezzi * 1000
      : unita(potenza) == 'mw'
      ? grezzi * 1000000
      : grezzi;
  final statoControllo = pulito(leggi(controllo)?.stato).toLowerCase();
  final statoDetto = pulito(leggi(statoEnt)?.stato).toLowerCase();
  final nonDisponibile = [potenza, controllo, statoEnt]
      .where((id) => id.isNotEmpty)
      .any(
        (id) => const [
          'unknown',
          'unavailable',
        ].contains(pulito(leggi(id)?.stato).toLowerCase()),
      );
  final attivitaBinaria =
      statoEnt.startsWith('binary_sensor.') &&
      _nomeDiAttivita.hasMatch(statoEnt);
  final detto = statoEnt.isEmpty ? '' : letturaDelloStato(statoDetto);
  final lavoraDetto =
      detto == 'running' || (attivitaBinaria && statoDetto == 'on');
  final aspettaDetto = detto == 'standby';
  final spentoDetto =
      statoEnt.isNotEmpty &&
      (detto == 'off' || (attivitaBinaria && statoDetto == 'off'));
  final accesoGenerico = statoDetto == 'on' || statoControllo == 'on';
  final sopraAvvio = wattLetti != null && wattLetti >= e.sogliaAvvio;
  final String campionato;
  if (nonDisponibile && wattLetti == null) {
    campionato = 'unavailable';
  } else if (spentoDetto && !sopraAvvio) {
    campionato = 'off';
  } else if (lavoraDetto || sopraAvvio) {
    campionato = 'running';
  } else if (aspettaDetto ||
      accesoGenerico ||
      (wattLetti != null && wattLetti >= e.sogliaAttesa)) {
    campionato = 'standby';
  } else {
    campionato = 'off';
  }
  /* Il ritardo di fine ciclo: la lavatrice non sparisce durante una pausa
   * del programma. Si tiene «in funzione» per i minuti dati, a meno che
   * qualcuno non dica spento chiaro e tondo. */
  final ora = adesso ?? DateTime.now();
  final chiave = e.id.isNotEmpty
      ? e.id
      : (potenza.isNotEmpty ? potenza : controllo);
  var modo = campionato;
  if (tenute != null && e.ritardoDiFine > 0 && chiave.isNotEmpty) {
    final spentoChiaro =
        spentoDetto || (controllo.isNotEmpty && statoControllo == 'off');
    if (campionato == 'running') {
      tenute[chiave] = ora;
    } else if (!spentoChiaro &&
        tenute[chiave] != null &&
        ora.difference(tenute[chiave]!).inSeconds < e.ritardoDiFine * 60) {
      modo = 'running';
    } else {
      tenute.remove(chiave);
    }
  }
  return (modo: modo, watt: wattLetti);
}

Tessera? _elettrodomestici(_Contesto c) {
  final righe = <Riga>[];
  for (final e in c.config.elettrodomestici) {
    if (!e.abilitato || !c.dentro(e.prima)) continue;
    final lettura = modoDellElettrodomestico(
      e,
      c.stato,
      adesso: c.adesso,
      tenute: c.tenute,
    );
    final nomeSuo = e.nome.isNotEmpty ? e.nome : c.nome(e.prima);
    righe.add(
      Riga(
        entita: e.prima,
        nome: nomeSuo,
        acceso: lettura.modo == 'running',
        grezzo: lettura.watt,
        valore: switch (lettura.modo) {
          'running' => 'In funzione',
          'standby' => 'Standby',
          'unavailable' => 'Non disponibile',
          _ => 'Spento',
        },
        simbolo: e.tipo,
        stanza: e.stanzaId,
      ),
    );
  }
  if (righe.isEmpty) return null;
  final inFunzione = righe.where((r) => r.acceso == true).toList();
  return Tessera(
    chiave: 'elettrodomestici',
    colore: '#06b6d4',
    etichetta: 'Elettrodomestici',
    valore: '${inFunzione.length}',
    didascalia: _nomiAccesi(inFunzione, 'in funzione'),
    anello: _quota(inFunzione.length, righe.length),
    righe: righe,
  );
}

/* ─── La temperatura ────────────────────────────────────────────────────── */

Tessera? _temperatura(_Contesto c) {
  final righe =
      <({String nome, String entita, num temperatura, num? umidita})>[];
  for (final stanza in c.config.stanze) {
    if (stanza.temperatura.isEmpty || !c.dentro(stanza.temperatura)) continue;
    final temperatura = c.numeroDi(stanza.temperatura);
    if (temperatura == null) continue;
    final umiditaEnt = stanza.umidita.isNotEmpty
        ? stanza.umidita
        : stanza.temperatura.replaceAll('_temperature', '_humidity');
    righe.add((
      nome: stanza.nome.isNotEmpty ? stanza.nome : stanza.id,
      entita: stanza.temperatura,
      temperatura: temperatura,
      umidita: c.numeroDi(umiditaEnt),
    ));
  }
  if (righe.isEmpty) return null;
  final media =
      righe.map((r) => r.temperatura).reduce((a, b) => a + b) / righe.length;
  final umidita = righe.map((r) => r.umidita).whereType<num>().toList();
  final umiditaMedia = umidita.isEmpty
      ? null
      : (umidita.reduce((a, b) => a + b) / umidita.length).round();
  final scelta = c.preferenze.sorgenti['temperatura'] ?? '';
  final sola = scelta.isEmpty
      ? null
      : righe.where((r) => r.entita == scelta).firstOrNull;
  return Tessera(
    chiave: 'temperatura',
    colore: '#ef4444',
    etichetta: 'Temperatura',
    valore: '${numero(sola?.temperatura ?? media, cifre: 1)}°',
    didascalia: sola != null
        ? [
            sola.nome,
            if (sola.umidita != null) 'Umidità ${sola.umidita!.round()}%',
          ].join(' · ')
        : umiditaMedia == null
        ? ''
        : 'Umidità $umiditaMedia%',
    righe: [
      for (final r in righe)
        Riga(
          nome: r.nome,
          entita: r.entita,
          grezzo: r.temperatura,
          valore:
              '${numero(r.temperatura, cifre: 1)}°${r.umidita == null ? '' : ' · ${r.umidita!.round()}%'}',
        ),
    ],
  );
}

/* ─── L'auto ────────────────────────────────────────────────────────────── */

const _riferimentiDellaBatteria = [
  'dm.ev_batteria_auto',
  'dm.ev_battery',
  'dm.ev_soc',
];

final _spinaNo = RegExp(
  r'(not[\s_-]*charging|dis[\s_-]*connect|un[\s_-]*plug|no[nt]?[\s_-]*(in[\s_-]*)?carica|no[nt]?[\s_-]*colleg|scolleg|staccat|no[\s_-]*vehicle|not[\s_-]*connect)',
);
final _spinaSi = RegExp(r'(charging|carica|plug|connect|conness|colleg)');

/// Se l'auto e' attaccata alla presa, leggendo lo stato della ricarica.
/// «not_charging» contiene «charging» e dice il contrario: prima le
/// negazioni. Le lettere singole sono la norma IEC 61851 di evcc.
bool autoAllaPresa(String stato) {
  final testo = pulito(stato).toLowerCase();
  if (testo.isEmpty) return false;
  if (RegExp(r'^[a-f]$').hasMatch(testo)) {
    return testo == 'b' || testo == 'c' || testo == 'd';
  }
  if (_spinaNo.hasMatch(testo)) return false;
  return _spinaSi.hasMatch(testo);
}

class _LetturaDellaVettura {
  _LetturaDellaVettura({
    required this.nome,
    required this.percentuale,
    required this.carburante,
    required this.km,
    required this.ricarica,
    required this.altre,
  });
  final String nome;
  final num? percentuale;
  final bool carburante;
  final num? km;
  final String ricarica;
  final List<Riga> altre;
}

_LetturaDellaVettura? _letturaDellaVettura(
  _Contesto c,
  Map<String, String> caselle,
  String nome, {
  bool aBenzina = false,
}) {
  final visti = <String>{};
  ({num? valore, String stato})? misura(String rif) {
    final entita = pulito(caselle[rif]);
    if (entita.isEmpty || !c.dentro(entita)) return null;
    visti.add(entita);
    return (
      valore: comeNumero(c.stato(entita)?.stato),
      stato: pulito(c.stato(entita)?.stato),
    );
  }

  ({num? valore, String stato})? carica;
  var serbatoio = false;
  if (aBenzina) {
    carica = misura('dm.ev_carburante');
    serbatoio = carica != null;
  }
  if (carica == null) {
    for (final rif in _riferimentiDellaBatteria) {
      carica = misura(rif);
      if (carica != null) break;
    }
  }
  if (carica == null) {
    carica = misura('dm.ev_carburante');
    serbatoio = carica != null;
  }
  final autonomia = misura('dm.ev_autonomia');
  final stato = misura('dm.ev_stato_ricarica');
  if (carica == null && autonomia == null) return null;
  final altre = <Riga>[];
  final riferimenti = caselle.keys.where((k) => k.startsWith('dm.ev_')).toList()
    ..sort();
  for (final rif in riferimenti) {
    final entita = pulito(caselle[rif]);
    if (entita.isEmpty || visti.contains(entita) || !c.dentro(entita)) continue;
    final riga = c.rigaDaEntita(entita, _simboloEv(rif));
    if (riga == null) continue;
    visti.add(entita);
    altre.add(riga);
  }
  return _LetturaDellaVettura(
    nome: nome,
    percentuale: carica?.valore == null ? null : carica!.valore!.clamp(0, 100),
    carburante: serbatoio,
    km: autonomia?.valore,
    ricarica: stato?.stato ?? '',
    altre: altre,
  );
}

String _simboloEv(String rif) {
  for (final (prova, simbolo) in [
    (RegExp('soc|batteria'), '🔋'),
    (RegExp('autonomia|odometro|km'), '🛣️'),
    (RegExp('cavo|stato_ricarica|modalita'), '🔌'),
    (RegExp('energia|potenza|power|prelievo|tensione'), '⚡'),
    (RegExp('temperatura'), '🌡️'),
    (RegExp('solare'), '☀️'),
  ]) {
    if (prova.hasMatch(rif)) return simbolo;
  }
  return '🚗';
}

List<Riga> _righeDellaVettura(_LetturaDellaVettura l, bool conIlNome) {
  final prefisso = conIlNome && l.nome.isNotEmpty ? '${l.nome} · ' : '';
  return [
    if (l.percentuale != null)
      Riga(
        simbolo: l.carburante ? '⛽' : '🔋',
        nome: '$prefisso${l.carburante ? 'Carburante' : 'Carica'}',
        grezzo: l.percentuale,
        valore: '${l.percentuale!.round()}%',
      ),
    if (l.km != null)
      Riga(
        simbolo: '🛣️',
        nome: '${prefisso}Autonomia',
        grezzo: l.km,
        valore: '${numero(l.km, cifre: 0)} km',
      ),
    if (l.ricarica.isNotEmpty)
      Riga(
        simbolo: '🔌',
        nome: '${prefisso}Ricarica',
        acceso: autoAllaPresa(l.ricarica),
        valore: autoAllaPresa(l.ricarica) ? 'In carica' : 'Scollegata',
      ),
    for (final riga in l.altre)
      prefisso.isEmpty
          ? riga
          : Riga(
              simbolo: riga.simbolo,
              nome: '$prefisso${riga.nome}',
              entita: riga.entita,
              valore: riga.valore,
              acceso: riga.acceso,
              grezzo: riga.grezzo,
            ),
  ];
}

Tessera? _ev(_Contesto c) {
  final vetture = c.config.vetture;
  final profilate = <_LetturaDellaVettura>[];
  for (var i = 0; i < vetture.length; i += 1) {
    final v = vetture[i];
    final nomeSuo = v.nome.isNotEmpty
        ? v.nome
        : (v.modello.isNotEmpty ? v.modello : 'Auto ${i + 1}');
    final lettura = _letturaDellaVettura(
      c,
      v.caselle,
      nomeSuo,
      aBenzina: v.tipo == 'termica',
    );
    if (lettura != null) profilate.add(lettura);
  }
  final letture = profilate.isNotEmpty
      ? profilate
      : [if (_letturaDellaVettura(c, c.config.caselle, '') case final l?) l];
  if (letture.isEmpty) return null;
  final piu = letture.length > 1;
  final righe = [for (final l in letture) ..._righeDellaVettura(l, piu)];
  if (righe.isEmpty) return null;
  final cariche = letture.map((l) => l.percentuale).whereType<num>().toList();
  final percentuale = cariche.isEmpty
      ? null
      : cariche.reduce((a, b) => a < b ? a : b);
  final chilometri = letture.map((l) => l.km).whereType<num>().toList();
  final primaKm = chilometri.isEmpty
      ? null
      : chilometri.reduce((a, b) => a < b ? a : b);
  final didascalia = piu
      ? letture
            .map(
              (l) =>
                  '${l.nome}${l.percentuale == null ? '' : ' ${l.percentuale!.round()}%'}',
            )
            .join(' · ')
      : percentuale != null && primaKm != null
      ? '${numero(primaKm, cifre: 0)} km'
      : '';
  return Tessera(
    chiave: 'ev',
    colore: '#06b6d4',
    etichetta: 'Auto',
    valore: percentuale == null
        ? '${numero(primaKm, cifre: 0)} km'
        : '${percentuale.round()}%',
    didascalia: didascalia,
    anello: percentuale?.round(),
    attiva: letture.any((l) => autoAllaPresa(l.ricarica)),
    quante: letture.length,
    righe: righe,
  );
}

/* ─── I robot ───────────────────────────────────────────────────────────── */

const statiDelRobot = {
  'cleaning': 'Sta pulendo',
  'mowing': 'Sta tagliando',
  'returning': 'Torna alla base',
  'docked': 'Alla base',
  'idle': 'In attesa',
  'paused': 'In pausa',
  'error': 'Errore',
  'unavailable': 'Non raggiungibile',
  'unknown': 'Sconosciuto',
};

Tessera? _robot(_Contesto c) {
  final viste =
      <
        ({
          String nome,
          String entita,
          String stato,
          num? batteria,
          bool alLavoro,
          bool inCarica,
        })
      >[];
  for (final robot in c.config.robot) {
    if (robot.entita.isEmpty || !c.dentro(robot.entita)) continue;
    final letto = c.stato(robot.entita);
    final grezzo = pulito(letto?.stato).toLowerCase();
    final stato = letto == null
        ? 'unavailable'
        : (statiDelRobot.containsKey(grezzo) ? grezzo : 'unknown');
    final separata = robot.batteria.isNotEmpty
        ? c.numeroDi(robot.batteria)
        : null;
    final batteria = separata ?? comeNumero(letto?.attributi['battery_level']);
    viste.add((
      nome: robot.nome.isNotEmpty ? robot.nome : c.nome(robot.entita),
      entita: robot.entita,
      stato: stato,
      batteria: batteria,
      alLavoro: grezzo == 'cleaning' || grezzo == 'mowing',
      inCarica: grezzo == 'docked' && batteria != null && batteria < 100,
    ));
  }
  if (viste.isEmpty) return null;
  final attivi = viste.where((v) => v.alLavoro).toList();
  final cariche = viste.map((v) => v.batteria).whereType<num>().toList();
  final piuScarico = cariche.isEmpty
      ? null
      : cariche.reduce((a, b) => a < b ? a : b);
  return Tessera(
    chiave: 'robot',
    colore: '#7c3aed',
    etichetta: 'Robot',
    valore: attivi.isNotEmpty
        ? '${attivi.length}'
        : piuScarico == null
        ? '${viste.length}'
        : '${piuScarico.round()}%',
    didascalia: attivi.isNotEmpty
        ? 'al lavoro'
        : piuScarico == null
        ? 'configurati'
        : 'carica più bassa',
    anello: attivi.isNotEmpty ? null : piuScarico?.round(),
    attiva: attivi.isNotEmpty,
    righe: [
      for (final v in viste)
        Riga(
          simbolo: v.stato == 'mowing'
              ? '🌱'
              : v.alLavoro
              ? '🧹'
              : v.inCarica
              ? '🔌'
              : '🤖',
          nome: v.nome,
          entita: v.entita,
          acceso: v.alLavoro,
          grezzo: v.batteria,
          valore: v.batteria == null
              ? statiDelRobot[v.stato]!
              : '${statiDelRobot[v.stato]!} · ${v.batteria!.round()}%',
        ),
    ],
  );
}

/* ─── Il solare termico ─────────────────────────────────────────────────── */

const _caselleDelSolare = [
  ('dm.boiler_sonda_temperatura_1', '🌡️', '°', 1, false),
  ('dm.boiler_sonda_temperatura_2', '🌡️', '°', 1, false),
  ('dm.boiler_sonda_temperatura_3', '🌡️', '°', 1, false),
  ('dm.boiler_temperatura', '🌡️', '°', 1, false),
  ('dm.boiler_delta_temperatura', '📐', '°', 1, false),
  ('dm.boiler_pressione_acqua', '💧', ' bar', 1, false),
  ('dm.boiler_potenza_resistenza_boiler', '⚡', ' W', 0, false),
  ('dm.boiler_potenza', '⚡', ' W', 0, false),
  ('dm.boiler_stato_pompa_solare', '🔄', '', 0, true),
  ('dm.boiler_sensore_pompa_solare', '🔄', '', 0, true),
  ('dm.boiler_pompa_solare', '🔄', '', 0, true),
  ('dm.boiler_centralina_solare_termico', '🎛️', '', 0, true),
  ('dm.boiler_interruttore_solare_termico', '🔌', '', 0, true),
  ('dm.boiler_interruttore_boiler', '🔌', '', 0, true),
  ('dm.boiler_valvola_di_sicurezza', '🛡️', '', 0, true),
];

Tessera? _solare(_Contesto c) {
  final righe = <Riga>[];
  final visti = <String>{};
  num? primaSonda;
  bool? pompa;
  for (final (rif, simbolo, unita, cifre, acceso) in _caselleDelSolare) {
    final dato = c.riferimento(rif);
    if (dato == null || visti.contains(dato.entita)) continue;
    if (acceso) {
      if (_muti.hasMatch(dato.stato)) continue;
      final attivo = _accesi.hasMatch(dato.stato);
      if (pompa == null && rif.contains('pompa')) pompa = attivo;
      visti.add(dato.entita);
      righe.add(
        Riga(
          simbolo: simbolo,
          nome: c.nome(dato.entita),
          entita: dato.entita,
          acceso: attivo,
          daQuando: c.stato(dato.entita)?.cambiataIl,
          valore: attivo ? 'Acceso' : 'Spento',
        ),
      );
      continue;
    }
    if (dato.valore == null) continue;
    if (primaSonda == null && rif.startsWith('dm.boiler_sonda')) {
      primaSonda = dato.valore;
    }
    visti.add(dato.entita);
    righe.add(
      Riga(
        simbolo: simbolo,
        nome: c.nome(dato.entita),
        entita: dato.entita,
        grezzo: dato.valore,
        valore: '${numero(dato.valore, cifre: cifre)}$unita',
      ),
    );
  }
  if (righe.isEmpty) return null;
  final inGrande = primaSonda != null
      ? '${numero(primaSonda, cifre: 1)}°'
      : pompa != null
      ? (pompa ? 'Acceso' : 'Spento')
      : righe.first.valore;
  return Tessera(
    chiave: 'solare',
    colore: '#f59e0b',
    etichetta: 'Solare termico',
    valore: inGrande,
    didascalia: pompa == null
        ? ''
        : (pompa ? 'Pompa in funzione' : 'Pompa ferma'),
    attiva: pompa ?? false,
    righe: righe,
  );
}

/* ─── La continuita' ────────────────────────────────────────────────────── */

const _inLinea = {'ol', 'online', 'on_line', 'mains', 'utility'};
const _aBatteria = {
  'ob',
  'onbatt',
  'onbattery',
  'on_battery',
  'battery',
  'backup',
};
const _scarica = {'lb', 'lowbatt', 'low_battery'};

List<String> _sigle(String stato) =>
    pulito(stato)
        .toLowerCase()
        .split(RegExp(r'[\s,|/]+'))
        .where((s) => s.isNotEmpty)
        .toList();

/// Cosa dice lo stato dell'UPS: rete presente, assente, o non si sa.
bool? reteDalloStato(String stato) {
  final pezzi = _sigle(stato);
  if (pezzi.isEmpty) return null;
  if (pezzi.any(_aBatteria.contains)) return false;
  if (pezzi.any(_inLinea.contains)) return true;
  if (pezzi.contains('on') || pezzi.contains('true')) return true;
  if (pezzi.contains('off') || pezzi.contains('false')) return false;
  return null;
}

class LetturaDellUps {
  const LetturaDellUps({
    required this.nome,
    required this.rete,
    required this.batteria,
    required this.carico,
    required this.autonomia,
    required this.tensione,
    required this.potenza,
    required this.temperatura,
    required this.scarica,
  });
  final String nome;
  final bool? rete;
  final num? batteria;
  final num? carico;
  final num? autonomia;
  final num? tensione;
  final num? potenza;
  final num? temperatura;
  final bool scarica;
  bool get allarme => rete == false || scarica;
}

LetturaDellUps letturaDellUps(Ups ups, Leggi leggi) {
  Entita? letto(String rif) => rif.isEmpty ? null : leggi(rif);
  final statoEnt = letto(ups.stato);
  final reteEnt = letto(ups.rete);
  final dallaCasella = reteEnt == null ? null : reteDalloStato(reteEnt.stato);
  final girata = dallaCasella == null
      ? null
      : (ups.invertita ? !dallaCasella : dallaCasella);
  final rete =
      girata ?? (statoEnt == null ? null : reteDalloStato(statoEnt.stato));
  final batteria = comeNumero(letto(ups.batteria)?.stato);
  final scarica =
      (statoEnt != null && _sigle(statoEnt.stato).any(_scarica.contains)) ||
      (batteria != null && batteria < 20);
  return LetturaDellUps(
    nome: ups.nome,
    rete: rete,
    batteria: batteria,
    carico: comeNumero(letto(ups.carico)?.stato),
    autonomia: comeNumero(letto(ups.autonomia)?.stato),
    tensione: comeNumero(letto(ups.tensione)?.stato),
    potenza: comeNumero(letto(ups.potenza)?.stato),
    temperatura: comeNumero(letto(ups.temperatura)?.stato),
    scarica: scarica,
  );
}

Tessera? _ups(_Contesto c) {
  final gruppi = c.config.ups
      .where((u) => u.entita.isNotEmpty && u.entita.any(c.dentro))
      .toList();
  if (gruppi.isEmpty) return null;
  final letti = [
    for (final g in gruppi) (config: g, lettura: letturaDellUps(g, c.stato)),
  ];
  final conIlNome = letti.length > 1;
  final righe = <Riga>[];
  for (final voce in letti) {
    final prefisso = conIlNome && voce.config.nome.isNotEmpty
        ? '${voce.config.nome} · '
        : '';
    final l = voce.lettura;
    if (l.rete != null) {
      righe.add(
        Riga(
          simbolo: '🔌',
          nome: '${prefisso}Rete',
          acceso: l.rete,
          valore: l.rete! ? 'Presente' : 'Assente',
        ),
      );
    }
    if (l.batteria != null) {
      righe.add(
        Riga(
          simbolo: '🔋',
          nome: '${prefisso}Batteria',
          grezzo: l.batteria,
          valore: '${numero(l.batteria, cifre: 0)}%',
        ),
      );
    }
    if (l.carico != null) {
      righe.add(
        Riga(
          simbolo: '⚡',
          nome: '${prefisso}Carico',
          grezzo: l.carico,
          valore: '${numero(l.carico, cifre: 0)}%',
        ),
      );
    }
    if (l.autonomia != null) {
      righe.add(
        Riga(
          simbolo: '⏱️',
          nome: '${prefisso}Autonomia',
          grezzo: l.autonomia,
          valore: '${numero(l.autonomia, cifre: 0)} min',
        ),
      );
    }
    if (l.tensione != null) {
      righe.add(
        Riga(
          simbolo: '〰️',
          nome: '${prefisso}Tensione',
          grezzo: l.tensione,
          valore: '${numero(l.tensione, cifre: 0)} V',
        ),
      );
    }
    if (l.potenza != null) {
      righe.add(
        Riga(
          simbolo: '⚡',
          nome: '${prefisso}Potenza',
          grezzo: l.potenza,
          valore: '${numero(l.potenza, cifre: 0)} W',
        ),
      );
    }
    if (l.temperatura != null) {
      righe.add(
        Riga(
          simbolo: '🌡️',
          nome: '${prefisso}Temperatura',
          grezzo: l.temperatura,
          valore: '${numero(l.temperatura, cifre: 1)}°',
        ),
      );
    }
  }
  if (righe.isEmpty) return null;
  /* Il peggiore comanda: chi va a batteria, poi chi e' scarico, poi chi ha
   * meno carica. */
  int peso(LetturaDellUps l) =>
      (l.rete == false
              ? 0
              : l.scarica
              ? 1
              : 2) *
          1000 +
      (l.batteria ?? 100).round();
  letti.sort((a, b) => peso(a.lettura).compareTo(peso(b.lettura)));
  final capofila = letti.first;
  final l = capofila.lettura;
  final aBatteria = l.rete == false;
  String diChi(String testo) => conIlNome && capofila.config.nome.isNotEmpty
      ? '${capofila.config.nome} · $testo'
      : testo;
  final String didascalia;
  if (aBatteria) {
    didascalia = diChi(
      l.batteria != null
          ? 'Va a batteria · ${numero(l.batteria, cifre: 0)}%'
          : 'Va a batteria',
    );
  } else if (l.rete == true) {
    if (l.scarica) {
      didascalia = diChi('Batteria scarica');
    } else if (l.carico != null) {
      didascalia = diChi(
        'Rete presente · carico ${numero(l.carico, cifre: 0)}%',
      );
    } else {
      didascalia = conIlNome
          ? '${letti.length} gruppi in rete'
          : 'Rete presente';
    }
  } else {
    didascalia = diChi('Non risponde');
  }
  return Tessera(
    chiave: 'ups',
    colore: '#0ea5e9',
    etichetta: 'Continuità',
    valore: aBatteria && l.autonomia != null
        ? '${numero(l.autonomia, cifre: 0)} min'
        : l.batteria != null
        ? '${numero(l.batteria, cifre: 0)}%'
        : l.rete == true
        ? 'In rete'
        : 'A batteria',
    didascalia: didascalia,
    anello: l.batteria?.round(),
    attiva: aBatteria,
    allarme: letti.any((v) => v.lettura.allarme),
    righe: righe,
  );
}

/* ─── Il MiniPC ─────────────────────────────────────────────────────────── */

const _caselleDelMinipc = [
  ('dm.server_cpu', 'cpu', 'CPU', '🧠', '%', 0, false),
  ('dm.server_ram', 'ram', 'RAM', '📊', '%', 0, false),
  ('dm.server_disco', 'disco', 'Disco', '💽', '%', 0, false),
  ('dm.server_temperatura_cpu', '', 'Temperatura CPU', '🌡️', '°', 1, false),
  ('dm.server_temperature', '', 'Temperatura', '🌡️', '°', 1, false),
  ('dm.server_potenza_raspberry_server', '', 'Potenza', '⚡', ' W', 0, false),
  ('dm.server_speedtest_download', '', 'Download', '⬇️', ' Mb/s', 0, false),
  ('dm.server_speedtest_upload', '', 'Upload', '⬆️', ' Mb/s', 0, false),
  ('dm.server_ping_internet', '', 'Ping', '📡', ' ms', 0, false),
  ('dm.server_stato_internet', '', 'Internet', '🌐', '', 0, true),
  (
    'dm.server_raggiungibilita_google',
    '',
    'Rete raggiungibile',
    '🌐',
    '',
    0,
    true,
  ),
];

Tessera? _minipc(_Contesto c) {
  final righe = <Riga>[];
  final visti = <String>{};
  num? carico;
  final quote = <String, Riga>{};
  for (final (rif, chiave, nome, simbolo, unita, cifre, acceso)
      in _caselleDelMinipc) {
    final dato = c.riferimento(rif);
    if (dato == null || visti.contains(dato.entita)) continue;
    if (acceso) {
      if (_muti.hasMatch(dato.stato)) continue;
      visti.add(dato.entita);
      final attivo = _accesi.hasMatch(dato.stato);
      righe.add(
        Riga(
          simbolo: simbolo,
          nome: c.nome(dato.entita),
          entita: dato.entita,
          acceso: attivo,
          valore: attivo ? 'Attivo' : 'Assente',
        ),
      );
      continue;
    }
    if (dato.valore == null) continue;
    visti.add(dato.entita);
    if (chiave == 'cpu' && carico == null) carico = dato.valore;
    final riga = Riga(
      simbolo: simbolo,
      nome: nome,
      entita: dato.entita,
      grezzo: dato.valore,
      valore: '${numero(dato.valore, cifre: cifre)}$unita',
    );
    if (chiave.isNotEmpty) quote[chiave] = riga;
    righe.add(riga);
  }
  if (righe.isEmpty) return null;
  return Tessera(
    chiave: 'minipc',
    colore: '#334155',
    etichetta: 'MiniPC',
    valore: carico != null
        ? '${numero(carico, cifre: 0)}%'
        : righe.first.valore,
    didascalia: [
      for (final k in const ['ram', 'disco'])
        if (quote[k] case final r?) '${r.nome} ${r.valore}',
    ].join(' · '),
    anello: carico?.round(),
    righe: righe,
  );
}

/* ─── La piscina ────────────────────────────────────────────────────────── */

Tessera? _piscina(_Contesto c) {
  final piscina = c.config.piscina;
  if (piscina == null) return null;
  final vasche = piscina.vasche;
  final piuDiUna = vasche.length > 1;
  final righe = <Riga>[];
  final visti = <String>{};
  for (var i = 0; i < vasche.length; i += 1) {
    final vasca = vasche[i];
    String etichetta(String testo) => piuDiUna
        ? '${pulito(vasca['name']).isNotEmpty ? pulito(vasca['name']) : 'Piscina ${i + 1}'} · $testo'
        : testo;
    for (final (chiave, testo, simbolo, unita) in [
      ('tempEnt', 'Acqua', '🌡️', '°'),
      ('phEnt', 'pH', '🧪', ''),
      ('clEnt', 'Cloro', '💧', ''),
    ]) {
      final entita = pulito(vasca[chiave]);
      if (entita.isEmpty || visti.contains(entita) || !c.dentro(entita)) {
        continue;
      }
      final valore = c.numeroDi(entita);
      if (valore == null) continue;
      visti.add(entita);
      righe.add(
        Riga(
          simbolo: simbolo,
          nome: etichetta(testo),
          entita: entita,
          grezzo: valore,
          valore: '${numero(valore, cifre: 1)}$unita',
        ),
      );
    }
    for (final (chiave, simbolo) in [
      ('pumpEnt', '🔄'),
      ('heatEnt', '🔥'),
      ('lightEnt', '💡'),
    ]) {
      final entita = pulito(vasca[chiave]);
      if (entita.isEmpty || visti.contains(entita) || !c.dentro(entita)) {
        continue;
      }
      final riga = c.rigaDaEntita(entita, simbolo);
      if (riga == null) continue;
      visti.add(entita);
      righe.add(
        Riga(
          simbolo: riga.simbolo,
          nome: etichetta(riga.nome),
          entita: entita,
          acceso: riga.acceso,
          valore: riga.valore,
          comando: c.config.siComanda(entita),
        ),
      );
    }
  }
  if (righe.isEmpty) return null;
  final testa =
      righe.where((r) => r.nome == 'Acqua').firstOrNull ?? righe.first;
  final compagna =
      righe.where((r) => r.nome == 'pH' && r != testa).firstOrNull ??
      righe.where((r) => r != testa).firstOrNull;
  return Tessera(
    chiave: 'piscina',
    colore: '#0ea5e9',
    etichetta: 'Piscina',
    valore: testa.valore,
    didascalia: compagna == null ? '' : '${compagna.nome} ${compagna.valore}',
    righe: righe,
  );
}

/* ─── Le prese ──────────────────────────────────────────────────────────── */

Tessera? _prese(_Contesto c) {
  final prese = c.config.prese.where((p) => p.entita.isNotEmpty).toList();
  if (prese.isEmpty) return null;
  final righe = <Riga>[];
  for (final presa in prese) {
    if (!c.dentro(presa.entita)) continue;
    final letto = c.stato(presa.entita);
    if (letto == null) continue;
    final grezzo = pulito(letto.stato).toLowerCase();
    final disponibile = grezzo != 'unavailable' && grezzo != 'unknown';
    righe.add(
      Riga(
        simbolo: presa.icona,
        nome: presa.etichetta,
        entita: presa.entita,
        acceso: grezzo == 'on',
        comando: c.config.siComanda(presa.entita) && disponibile,
        valore: !disponibile
            ? 'Non disponibile'
            : (grezzo == 'on' ? 'Accesa' : 'Spenta'),
        stanza: presa.stanzaId,
      ),
    );
  }
  if (righe.isEmpty) return null;
  final accese = righe.where((r) => r.acceso == true).length;
  return Tessera(
    chiave: 'prese',
    colore: '#475569',
    etichetta: 'Prese',
    valore: '$accese',
    didascalia: accese == 1 ? '1 accesa' : '$accese accese',
    anello: _quota(accese, righe.length),
    attiva: accese > 0,
    righe: righe,
  );
}

/* ─── La musica ─────────────────────────────────────────────────────────── */

Tessera? _media(_Contesto c) {
  final lettori = c.config.lettori.where((l) => c.dentro(l.entita)).toList();
  if (lettori.isEmpty) return null;
  final righe =
      <
        ({
          String nome,
          String entita,
          bool suona,
          String titolo,
          String artista,
        })
      >[];
  for (final lettore in lettori) {
    final letto = c.stato(lettore.entita);
    final grezzo = pulito(letto?.stato).toLowerCase();
    final attributi = letto?.attributi ?? const {};
    righe.add((
      nome: lettore.nome.isNotEmpty ? lettore.nome : c.nome(lettore.entita),
      entita: lettore.entita,
      suona: grezzo == 'playing' || grezzo == 'buffering',
      titolo: pulito(attributi['media_title']),
      artista: pulito(
        attributi['media_artist'] ?? attributi['media_album_artist'],
      ),
    ));
  }
  final suonano = righe.where((r) => r.suona).toList();
  final conIlPosto = suonano.length > 1;
  String cosaSuona(
    ({String nome, String entita, bool suona, String titolo, String artista}) r,
  ) {
    final pezzo = [
      if (r.titolo.isNotEmpty) r.titolo,
      if (r.artista.isNotEmpty) r.artista,
    ].join(' — ');
    return conIlPosto ? '${r.nome}: $pezzo' : pezzo;
  }

  return Tessera(
    chiave: 'media',
    colore: '#8b5cf6',
    etichetta: 'Musica',
    valore: '${suonano.length}',
    didascalia: suonano.isEmpty
        ? 'Nessuno in riproduzione'
        : suonano.map(cosaSuona).join(' · '),
    anello: _quota(suonano.length, righe.length),
    attiva: suonano.isNotEmpty,
    righe: [
      for (final r in righe)
        Riga(
          nome: r.nome,
          entita: r.entita,
          acceso: r.suona,
          valore: r.suona ? cosaSuona(r) : 'Spento',
        ),
    ],
  );
}

/* ─── L'irrigazione ─────────────────────────────────────────────────────── */

final _irrigazioneAttiva = RegExp(r'^(on|true|open|opening|running|attiva)$');

Tessera? _irrigazione(_Contesto c) {
  final irrigazione = c.config.irrigazione;
  if (irrigazione == null) return null;
  final zone = irrigazione.zone
      .where((z) => z.entita.isNotEmpty && c.dentro(z.entita))
      .toList();
  if (zone.isEmpty) return null;
  bool inFunzione(ZonaDiIrrigazione z) =>
      _irrigazioneAttiva.hasMatch(c.testo(z.entita));
  final attive = zone.where(inFunzione).toList();
  final umidita =
      irrigazione.terreno.isNotEmpty && c.dentro(irrigazione.terreno)
      ? c.numeroDi(irrigazione.terreno)
      : null;
  return Tessera(
    chiave: 'irrigazione',
    colore: '#10b981',
    etichetta: 'Irrigazione',
    valore: attive.isNotEmpty
        ? '${attive.length}'
        : umidita == null
        ? '${zone.length}'
        : '${umidita.round()}%',
    didascalia: attive.isNotEmpty
        ? 'zone in funzione'
        : umidita == null
        ? 'zone configurate'
        : 'umidità terreno',
    anello: attive.isNotEmpty ? null : umidita?.round(),
    attiva: attive.isNotEmpty,
    righe: [
      for (final z in zone)
        Riga(
          simbolo: '🌱',
          nome: z.nome.isNotEmpty ? z.nome : z.entita,
          entita: z.entita,
          acceso: inFunzione(z),
          valore: inFunzione(z) ? 'in funzione' : 'ferma',
          comando: c.config.siComanda(z.entita),
        ),
    ],
  );
}

/* ─── Gli avvisi personalizzati ─────────────────────────────────────────── */

/// Le stesse condizioni della plancia web, riga per riga.
bool avvisoAttivo(Avviso avviso, Entita? letto) {
  final grezzo = pulito(letto?.stato);
  final stato = grezzo.toLowerCase();
  final valore = comeNumero(grezzo);
  final soglia = comeNumero(avviso.valore);
  return switch (avviso.condizione) {
    'off' => const [
      'off',
      'closed',
      'false',
      'no',
      '0',
      'unavailable',
      'unknown',
      'idle',
      'standby',
    ].contains(stato),
    'eq' => stato == avviso.valore.toLowerCase(),
    'neq' => stato != avviso.valore.toLowerCase(),
    'gt' => valore != null && soglia != null && valore > soglia,
    'lt' => valore != null && soglia != null && valore < soglia,
    _ => const [
      'on',
      'open',
      'opened',
      'true',
      'yes',
      'home',
      'detected',
      'heat',
      'heating',
      'cool',
      'cooling',
      'playing',
      'active',
      'armed',
      'wet',
      'motion',
      'occupied',
      'running',
    ].contains(stato),
  };
}

List<Tessera> _avvisi(_Contesto c) {
  final tessere = <Tessera>[];
  for (final avviso in c.config.avvisi) {
    final righe = <Riga>[];
    for (final entita in avviso.entita) {
      if (entita.isEmpty || !c.dentro(entita)) continue;
      final letto = c.stato(entita);
      if (letto == null || !avvisoAttivo(avviso, letto)) continue;
      righe.add(
        Riga(
          entita: entita,
          nome: c.nome(entita),
          valore: pulito(letto.stato),
          acceso: true,
        ),
      );
    }
    if (righe.isEmpty) continue;
    tessere.add(
      Tessera(
        chiave: 'custom-${avviso.posto}',
        colore: '#f59e0b',
        etichetta: avviso.nome.isNotEmpty ? avviso.nome : 'Avviso',
        simbolo: avviso.icona.isNotEmpty ? avviso.icona : '⚠️',
        allarme: true,
        valore: '${righe.length}',
        didascalia: righe.first.nome,
        righe: righe,
      ),
    );
  }
  return tessere;
}

/* ─── In evidenza ───────────────────────────────────────────────────────── */

Riga? _rigaInEvidenza(_Contesto c, VoceInEvidenza voce) {
  if (voce.entita.isEmpty || !c.dentro(voce.entita)) return null;
  final simbolo = voce.icona.isNotEmpty ? voce.icona : '⭐';
  final riga = c.rigaDaEntita(voce.entita, simbolo);
  if (riga == null) {
    return Riga(
      simbolo: simbolo,
      nome: voce.nome.isNotEmpty ? voce.nome : c.nome(voce.entita),
      entita: voce.entita,
      valore: '—',
    );
  }
  return voce.nome.isEmpty
      ? riga
      : Riga(
          simbolo: riga.simbolo,
          nome: voce.nome,
          entita: riga.entita,
          valore: riga.valore,
          acceso: riga.acceso,
          grezzo: riga.grezzo,
          daQuando: riga.daQuando,
        );
}

List<Tessera> _evidenze(_Contesto c) {
  final voci = c.config.evidenze;
  if (voci.isEmpty) return const [];
  final tessere = <Tessera>[];
  final insieme = [
    for (final v in voci)
      if (!v.sola)
        if (_rigaInEvidenza(c, v) case final r?) r,
  ];
  if (insieme.isNotEmpty) {
    tessere.add(
      Tessera(
        chiave: 'evidenza',
        colore: '#eab308',
        etichetta: 'In evidenza',
        valore: '${insieme.length}',
        didascalia: insieme
            .map((r) => '${r.nome} ${r.valore}'.trim())
            .join(' · '),
        attiva: insieme.any((r) => r.acceso == true),
        righe: insieme,
      ),
    );
  }
  for (final v in voci) {
    if (!v.sola) continue;
    final riga = _rigaInEvidenza(c, v);
    if (riga == null) continue;
    tessere.add(
      Tessera(
        chiave: 'evidenza-${v.posto}',
        colore: '#eab308',
        etichetta: riga.nome,
        simbolo: riga.simbolo,
        valore: riga.valore,
        didascalia: c.config.stanza(v.stanzaId)?.nome ?? '',
        attiva: riga.acceso == true,
        righe: [riga],
      ),
    );
  }
  return tessere;
}
