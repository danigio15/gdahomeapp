/// La configurazione della plancia, come la scrive DashboardModern.
///
/// Sta dentro Home Assistant, nell'archivio condiviso dell'integrazione, e
/// arriva con `dashboardmodern/config/get`: un profilo, una revisione, e un
/// mucchio di chiavi con dentro del testo JSON — le stesse chiavi che la
/// plancia web tiene nel `localStorage` del browser. Qui si legge quel mucchio
/// e se ne fa un oggetto con dei nomi: le stanze, le luci, il clima, le
/// persone, le azioni rapide, le tessere nascoste.
///
/// Tre cose da sapere, perche' sono quelle che la plancia web fa e che qui si
/// rifanno uguali:
///
///  - la copia canonica sta in `dm_dashboard_state` (`sections` e
///    `visibility`), ma all'avvio **le chiavi legacy dettano** — `cd_stanze`,
///    `cd_clima_units`, `cd_tapparelle`… — tranne le luci, la cui forma legacy
///    (`{entita: nome}`) perde la stanza;
///  - le caselle dell'editor (`cd_entity_overrides`) mappano un riferimento
///    `dm.qualcosa` a un'entita': e' cosi' che il meteo, l'antifurto, l'auto e
///    il solare termico sanno quale entita' leggere;
///  - una plancia senza niente dentro **non e' configurata**, e la Home lo dice
///    invece di mostrare tessere vuote.
///
/// Niente Flutter e niente rete qui: si prova con un JSON.
library;

import 'dart:convert';

import 'numeri.dart';

/// Le sezioni canoniche e la chiave legacy che le porta.
const Map<String, String> chiaviDelleSezioni = {
  'rooms': 'cd_stanze',
  'cameras': 'cd_cameras',
  'appliances': 'cd_appliances',
  'loads': 'cd_loads',
  'lights': 'cd_luci',
  'climate': 'cd_clima_units',
  'ev': 'cd_ev_cars',
  'covers': 'cd_tapparelle',
  'pool': 'cd_piscina',
  'irrigation': 'cd_irrigazione',
  'robots': 'cd_robot',
  'sockets': 'cd_prese',
  'energy': 'cd_energy_model',
  'energyLoads': 'cd_energy_loads',
  'entityOverrides': 'cd_entity_overrides',
};

/// I blocchi della Home, nell'ordine di serie.
const List<String> blocchiDellaHome = [
  'persone',
  'widget',
  'azioni',
  'dispositivi',
];

class ConfigurazioneDellaPlancia {
  ConfigurazioneDellaPlancia._(
    this._valori, {
    this._grezzi = const {},
    this.revisione = 0,
    this.profilo = '',
  }) : _sezioni = _leggiLeSezioni(_valori);

  /// Una plancia che non c'e': nessuna chiave, niente configurato.
  static final vuota = ConfigurazioneDellaPlancia._(const {});

  /// Da quello che risponde `dashboardmodern/config/get`.
  static ConfigurazioneDellaPlancia dallaRisposta(Object? risposta) {
    if (risposta is! Map) return vuota;
    final foto = risposta['snapshot'];
    if (foto is! Map) return vuota;
    final valori = foto['values'];
    return ConfigurazioneDellaPlancia.daiValori(
      valori is Map ? valori : const {},
      revisione: (foto['revision'] as num?)?.toInt() ?? 0,
      profilo: pulito(risposta['profile']),
    );
  }

  /// Dalle chiavi dell'archivio: ogni valore e' un testo, quasi sempre JSON.
  static ConfigurazioneDellaPlancia daiValori(
    Map<Object?, Object?> valori, {
    int revisione = 0,
    String profilo = '',
  }) {
    final letti = <String, Object?>{};
    final grezzi = <String, String>{};
    for (final voce in valori.entries) {
      final chiave = pulito(voce.key);
      if (chiave.isEmpty) continue;
      letti[chiave] = _decodifica(voce.value);
      grezzi[chiave] = pulito(voce.value);
    }
    return ConfigurazioneDellaPlancia._(
      letti,
      grezzi: grezzi,
      revisione: revisione,
      profilo: profilo,
    );
  }

  final Map<String, Object?> _valori;

  /* Le chiavi come sono arrivate, testo per testo.
   *
   * Servono per **riscrivere**. L'archivio non aggiorna le chiavi che gli
   * mandi: sostituisce l'intero scatto con quello che riceve, e una chiave che
   * non c'e' nel messaggio non c'e' piu' nemmeno in casa. Quindi per cambiare
   * una cosa sola bisogna rimandare anche tutte le altre — e rimandarle
   * **identiche**, non ricostruite: quello che l'app non sa leggere lo
   * riscriverebbe sbagliato, e una plancia si perderebbe pezzi ogni volta che
   * dal telefono si tocca un interruttore di configurazione. */
  final Map<String, String> _grezzi;

  /// I cambiamenti che rimettono una sezione, canonica e legacy.
  ///
  /// Una sezione sta scritta in due posti: la copia canonica dentro
  /// `dm_dashboard_state.sections`, e — per quasi tutte — una chiave vecchia
  /// tutta sua, tipo `cd_prese`. La plancia le tiene allineate, e chi ne
  /// scrive una sola lascia l'altra a dire il contrario: la lettura sceglie la
  /// canonica quando non e' vuota, quindi svuotare solo quella farebbe
  /// **ricomparire** la roba vecchia.
  ///
  /// Del `dm_dashboard_state` si tiene tutto il resto com'era: dentro ci sono
  /// anche cose che quest'app non legge, e riscriverlo da zero vorrebbe dire
  /// buttarle via.
  Map<String, String> cambiaLaSezione(String sezione, Object? contenuto) {
    final stato = _valori['dm_dashboard_state'];
    final fuori = <String, Object?>{
      if (stato is Map) ...{for (final v in stato.entries) pulito(v.key): v.value},
    };
    final sezioni = <String, Object?>{
      if (fuori['sections'] is Map)
        ...{
          for (final v in (fuori['sections'] as Map).entries)
            pulito(v.key): v.value,
        },
    };
    sezioni[sezione] = contenuto;
    fuori['sections'] = sezioni;
    final cambiamenti = <String, String>{
      'dm_dashboard_state': jsonEncode(fuori),
    };
    final vecchia = chiaviDelleSezioni[sezione];
    if (vecchia != null) cambiamenti[vecchia] = jsonEncode(contenuto);
    return cambiamenti;
  }

  /// Lo scatto da rimandare in casa, con dentro i cambiamenti.
  ///
  /// Le chiavi che si toccano vanno passate gia' scritte come vanno scritte
  /// (quasi sempre JSON); una chiave con valore vuoto si toglie.
  Map<String, String> scattoCon(Map<String, String> cambiamenti) {
    final fuori = Map<String, String>.from(_grezzi);
    for (final voce in cambiamenti.entries) {
      if (voce.value.isEmpty) {
        fuori.remove(voce.key);
      } else {
        fuori[voce.key] = voce.value;
      }
    }
    return fuori;
  }
  final Map<String, Object?> _sezioni;
  final int revisione;
  final String profilo;

  /* ─── Le chiavi, grezze ─────────────────────────────────────────────────── */

  /// Il valore di una chiave, gia' decodificato.
  Object? grezzo(String chiave) => _valori[chiave];

  /// La sezione canonica, con la chiave legacy sopra quando c'e'.
  Object? sezione(String nome) => _sezioni[nome];

  bool get cE => _valori.isNotEmpty;

  /// Se qualcuno ha configurato qualcosa: e' `planciaConfigurata()` della
  /// plancia web. Finche' non c'e' niente, la Home non mostra tessere.
  bool get configurata {
    for (final nome in const [
      'rooms',
      'cameras',
      'appliances',
      'loads',
      'lights',
      'climate',
      'ev',
      'covers',
      'pool',
      'irrigation',
      'energy',
      'sockets',
      'robots',
      'entityOverrides',
    ]) {
      final valore = _sezioni[nome];
      if (valore == null) continue;
      if (nome == 'entityOverrides') {
        if (valore is Map &&
            valore.values.any((v) => pulito(v).contains('.'))) {
          return true;
        }
        continue;
      }
      if (nome == 'rooms') {
        if (valore is List &&
            valore.any(
              (s) =>
                  s is Map &&
                  (pulito(s['name']).isNotEmpty || pulito(s['id']).isNotEmpty),
            )) {
          return true;
        }
        continue;
      }
      if (_haDatiConfigurati(nome, valore)) return true;
    }
    for (final chiave in const [
      'cd_avvisi_custom',
      'cd_todo',
      'cd_evidenza',
      'cd_security_doors',
      'cd_prese',
    ]) {
      final valore = _valori[chiave];
      if (valore is List
          ? valore.isNotEmpty
          : valore is Map && valore.isNotEmpty) {
        return true;
      }
    }
    final luci = _valori['cd_luci'];
    return luci is Map && luci.isNotEmpty;
  }

  /* ─── Le stanze ─────────────────────────────────────────────────────────── */

  List<Stanza> get stanze {
    final grezze = _sezioni['rooms'];
    if (grezze is! List) return const [];
    final stanze = <Stanza>[];
    var posto = 0;
    for (final una in grezze) {
      if (una is! Map) continue;
      stanze.add(Stanza._(una, posto));
      posto += 1;
    }
    stanze.sort((a, b) => a.ordine.compareTo(b.ordine));
    return stanze;
  }

  Stanza? stanza(String idONome) {
    final cercato = pulito(idONome);
    if (cercato.isEmpty) return null;
    for (final una in stanze) {
      if (una.id == cercato || una.nome == cercato) return una;
    }
    return null;
  }

  /// La stanza di un'entita' detta a mano, da `cd_stanze_entita`.
  String? stanzaDellEntita(String entita) {
    final mappa = _valori['cd_stanze_entita'];
    if (mappa is! Map) return null;
    final id = pulito(mappa[entita]);
    return id.isEmpty ? null : id;
  }

  /* ─── Le luci ───────────────────────────────────────────────────────────── */

  /// Le luci raggruppate per stanza, come le raggruppa la pagina Luci.
  ///
  /// La forma legacy — `cd_luci` con `{entita: nome}` e `cd_luci_rooms` con
  /// `{entita: stanza}` — e' quella che la plancia web legge per i gruppi;
  /// quando non c'e', si leggono le luci canoniche, che la stanza ce l'hanno
  /// addosso. Le stanze vengono nell'ordine della sezione Stanze; quelle
  /// senza stanza in fondo, sotto «Altre zone».
  List<GruppoDiLuci> gruppiDiLuci() {
    final mappa = _valori['cd_luci'];
    final assegnazioni = _valori['cd_luci_rooms'];
    final ordineDentro = _valori['cd_luci_order'];
    final nomi = <String, String>{};
    final stanzaDi = <String, String>{};
    final elenco = <String>[];

    if (mappa is Map && mappa.isNotEmpty) {
      for (final voce in mappa.entries) {
        final id = pulito(voce.key);
        if (!id.contains('.')) continue;
        elenco.add(id);
        nomi[id] = pulito(voce.value);
        if (assegnazioni is Map) stanzaDi[id] = pulito(assegnazioni[id]);
      }
    } else {
      final canoniche = _sezioni['lights'];
      if (canoniche is List) {
        for (final una in canoniche) {
          if (una is! Map) continue;
          final id = pulito(
            una['entity'] ??
                (una['entities'] is List && (una['entities'] as List).isNotEmpty
                    ? (una['entities'] as List).first
                    : ''),
          );
          if (!id.contains('.')) continue;
          elenco.add(id);
          nomi[id] = pulito(una['name']);
          stanzaDi[id] = pulito(una['room_id'] ?? una['room']);
        }
      }
    }
    if (elenco.isEmpty) return const [];

    final tutte = stanze;
    String etichetta(String riferimento) {
      final trovata = stanza(riferimento);
      if (trovata != null) return trovata.nome;
      return riferimento.isEmpty ? 'Altre zone' : riferimento;
    }

    final gruppi = <String, List<String>>{};
    for (final id in elenco) {
      gruppi.putIfAbsent(etichetta(stanzaDi[id] ?? ''), () => []).add(id);
    }
    int posto(String nome) {
      final indice = tutte.indexWhere((s) => s.nome == nome);
      return indice < 0
          ? tutte.length + (nome == 'Altre zone' ? 1 : 0)
          : indice;
    }

    final nomiStanze = gruppi.keys.toList();
    final prima = List.of(nomiStanze);
    nomiStanze.sort((a, b) {
      final per = posto(a).compareTo(posto(b));
      return per != 0 ? per : prima.indexOf(a).compareTo(prima.indexOf(b));
    });
    return [
      for (final nome in nomiStanze)
        GruppoDiLuci._(
          stanza: nome,
          stanzaId:
              tutte.where((s) => s.nome == nome).map((s) => s.id).firstOrNull ??
              '',
          entita: _inOrdine(
            gruppi[nome]!,
            ordineDentro is Map ? ordineDentro[nome] : null,
          ),
          nomi: {for (final id in gruppi[nome]!) id: nomi[id] ?? ''},
        ),
    ];
  }

  static List<String> _inOrdine(List<String> attuali, Object? salvato) {
    final scelto = salvato is List
        ? salvato.map(pulito).where(attuali.contains).toList()
        : <String>[];
    return [...scelto, ...attuali.where((id) => !scelto.contains(id))];
  }

  /* ─── Le altre sezioni ──────────────────────────────────────────────────── */

  List<UnitaClima> get unitaClima {
    final grezze = _sezioni['climate'];
    if (grezze is! List) return const [];
    return [
      for (final una in grezze)
        if (una is Map && _entitaDi(una).isNotEmpty) UnitaClima._(una),
    ];
  }

  List<Copertura> get coperture {
    final grezze = _sezioni['covers'];
    if (grezze is! List) return const [];
    return [
      for (final una in grezze)
        if (una is Map) Copertura._(una),
    ];
  }

  List<Elettrodomestico> get elettrodomestici {
    final grezzi = _sezioni['appliances'];
    if (grezzi is! List) return const [];
    return [
      for (final uno in grezzi)
        if (uno is Map) Elettrodomestico._(uno),
    ];
  }

  /// I calendari scelti, da `cd_calendari`.
  List<CalendarioScelto> get calendari {
    final grezzi = grezzo('cd_calendari');
    if (grezzi is! List) return const [];
    return [
      for (final (posto, uno) in grezzi.indexed)
        if (uno is Map)
          if (CalendarioScelto._(uno, posto) case final riga)
            if (riga.entita.startsWith('calendar.')) riga,
    ];
  }

  /// Le liste di cose da fare, da `cd_todo`.
  List<ListaDiCose> get liste {
    final grezze = grezzo('cd_todo');
    if (grezze is! List) return const [];
    return [
      for (final (posto, una) in grezze.indexed)
        if (una is Map)
          if (ListaDiCose._(una, posto) case final riga)
            if (riga.entita.startsWith('todo.')) riga,
    ];
  }

  /// Gli scaldabagni, dalla loro chiave. Una riga senza nemmeno una casella
  /// non e' uno scaldabagno a meta': e' una riga vuota.
  List<Scaldabagno> get scaldabagni {
    final grezzi = grezzo('cd_scaldabagni');
    if (grezzi is! List) return const [];
    return [
      for (final (posto, uno) in grezzi.indexed)
        if (uno is Map)
          if (Scaldabagno._(uno, posto) case final riga)
            if (riga.caselle.isNotEmpty) riga,
    ];
  }

  /// Le caldaie di casa, che possono essere piu' d'una: chi ne ha due — due
  /// appartamenti uniti — scrive una lista, chi ne ha una la ritrova dov'era.
  List<Caldaia> get caldaie {
    final grezze = grezzo('cd_caldaia');
    final elenco = grezze is List
        ? grezze
        : grezze is Map
        ? [grezze]
        : const [];
    return [
      for (final (posto, una) in elenco.indexed)
        if (una is Map)
          if (Caldaia._(una, posto) case final riga)
            if (riga.caselle.isNotEmpty) riga,
    ];
  }

  List<Telecamera> get telecamere {
    final grezze = _sezioni['cameras'];
    if (grezze is! List) return const [];
    return [
      for (final una in grezze)
        if (una is Map && pulito(una['entity']).isNotEmpty) Telecamera._(una),
    ];
  }

  List<Vettura> get vetture {
    final grezze = _sezioni['ev'];
    final elenco = grezze is List
        ? grezze
        : grezze is Map
        ? [grezze]
        : const [];
    return [
      for (final una in elenco)
        if (una is Map) Vettura._(una),
    ];
  }

  /// Gli impianti dell'energia: il primo, e gli altri in `plants`.
  List<Impianto> get impianti {
    final grezzo = _sezioni['energy'];
    if (grezzo is List) {
      return [
        for (var i = 0; i < grezzo.length; i += 1)
          if (grezzo[i] is Map) Impianto._(grezzo[i] as Map, i),
      ];
    }
    if (grezzo is! Map) return const [];
    final altri = grezzo['plants'];
    return [
      Impianto._(grezzo, 0),
      if (altri is List)
        for (var i = 0; i < altri.length; i += 1)
          if (altri[i] is Map) Impianto._(altri[i] as Map, i + 1),
    ];
  }

  Piscina? get piscina {
    final grezza = _sezioni['pool'];
    if (grezza is! Map || grezza.isEmpty) return null;
    return Piscina._(grezza);
  }

  Irrigazione? get irrigazione {
    final grezza = _sezioni['irrigation'];
    if (grezza is! Map || grezza.isEmpty) return null;
    return Irrigazione._(grezza);
  }

  List<Robot> get robot {
    final canonici = _sezioni['robots'];
    final grezzi = canonici is List && canonici.isNotEmpty
        ? canonici
        : _valori['cd_robot'];
    final elenco = grezzi is List
        ? grezzi
        : grezzi is Map
        ? [grezzi]
        : const [];
    final visti = <String>{};
    final robot = <Robot>[];
    var posto = 0;
    for (final uno in elenco) {
      if (uno is! Map) continue;
      final letto = Robot._(uno, posto);
      posto += 1;
      if (letto.entita.isNotEmpty && !visti.add(letto.entita)) continue;
      robot.add(letto);
    }
    return robot;
  }

  List<Presa> get prese {
    final canoniche = _sezioni['sockets'];
    final grezze = canoniche is List && canoniche.isNotEmpty
        ? canoniche
        : _valori['cd_prese'];
    if (grezze is! List) return const [];
    final prese = <Presa>[];
    var posto = 0;
    for (final una in grezze) {
      if (una is! Map) continue;
      prese.add(Presa._(una, posto));
      posto += 1;
    }
    prese.sort((a, b) => a.ordine.compareTo(b.ordine));
    return prese;
  }

  /// Le caselle dell'editor: riferimento `dm.…` → entita'.
  Map<String, String> get caselle {
    final grezze = _sezioni['entityOverrides'];
    if (grezze is! Map) return const {};
    return {
      for (final voce in grezze.entries)
        if (pulito(voce.value).isNotEmpty) pulito(voce.key): pulito(voce.value),
    };
  }

  /// L'entita' dietro un riferimento, o `null` se la casella e' vuota.
  ///
  /// E' `resolveEntity` della plancia web: un riferimento che non e' mappato
  /// non e' un'entita', e non lo si finge.
  String? entita(String riferimento) {
    final trovata = pulito(caselle[riferimento]);
    return trovata.contains('.') ? trovata : null;
  }

  /* ─── Le chiavi che la Home legge da sole ──────────────────────────────── */

  List<Persona> get persone {
    final grezze = _valori['cd_people'];
    if (grezze is! List) return const [];
    final usati = <String>{};
    final persone = <Persona>[];
    for (final una in grezze) {
      if (una is! Map) continue;
      final nome = pulito(una['name']);
      final entita = pulito(una['entity']);
      if (nome.isEmpty && entita.isEmpty) continue;
      final seme = pulito(una['id']).isNotEmpty
          ? pulito(una['id'])
          : 'person-${_slug(nome.isNotEmpty ? nome : entita.split('.').last)}';
      var id = seme;
      for (var n = 2; usati.contains(id); n += 1) {
        id = '$seme-$n';
      }
      usati.add(id);
      persone.add(Persona._(una, id, persone.length));
    }
    return persone;
  }

  List<AzioneRapida> get azioniRapide {
    final grezze = _valori['cd_quick_actions'];
    if (grezze is! List) return const [];
    return [
      for (final una in grezze)
        if (una is Map) AzioneRapida._(una),
    ];
  }

  List<Avviso> get avvisi {
    final grezzi = _valori['cd_avvisi_custom'];
    if (grezzi is! List) return const [];
    return [
      for (var i = 0; i < grezzi.length; i += 1)
        if (grezzi[i] is Map) Avviso._(grezzi[i] as Map, i),
    ];
  }

  List<VoceInEvidenza> get evidenze {
    final grezze = _valori['cd_evidenza'];
    if (grezze is! List) return const [];
    return [
      for (var i = 0; i < grezze.length; i += 1)
        if (grezze[i] is Map) VoceInEvidenza._(grezze[i] as Map, i),
    ];
  }

  List<Porta> get porte {
    final grezze = _valori['cd_security_doors'];
    if (grezze is! List) return const [];
    final dellePrese = prese.map((p) => p.entita).toSet();
    return [
      for (final una in grezze)
        if (una is Map &&
            pulito(una['entity']).isNotEmpty &&
            !dellePrese.contains(pulito(una['entity'])))
          Porta._(una),
    ];
  }

  List<Lettore> get lettori {
    final grezzi = _valori['cd_media_player'];
    if (grezzi is! List) return const [];
    return [
      for (var i = 0; i < grezzi.length; i += 1)
        if (grezzi[i] is Map && pulito((grezzi[i] as Map)['entity']).isNotEmpty)
          Lettore._(grezzi[i] as Map, i),
    ];
  }

  /// I gruppi di continuita': uno solo scritto come oggetto, o un elenco.
  List<Ups> get ups {
    final grezzo = _valori['cd_ups'];
    final elenco = grezzo is List
        ? grezzo
        : grezzo is Map && grezzo.isNotEmpty
        ? [grezzo]
        : const [];
    final gruppi = <Ups>[];
    for (var i = 0; i < elenco.length; i += 1) {
      final uno = elenco[i];
      if (uno is! Map) continue;
      final letto = Ups._(uno, i);
      if (letto.nome.isNotEmpty || letto.entita.isNotEmpty) gruppi.add(letto);
    }
    return gruppi;
  }

  /// Le entita' che si guardano e basta.
  Set<String> get soloLettura {
    final mappa = _valori['cd_solo_lettura'];
    if (mappa is Map) {
      return {
        for (final v in mappa.entries)
          if (v.value == true) pulito(v.key),
      };
    }
    if (mappa is List) return {for (final v in mappa) pulito(v)};
    return const {};
  }

  bool siComanda(String entita) => !soloLettura.contains(entita);

  /// Le preferenze delle tessere (`cd_widgets`): nascoste, ordine, entita'
  /// tenute fuori, sorgente scelta al posto della media.
  PreferenzeDeiWidget get widget =>
      PreferenzeDeiWidget._(_valori['cd_widgets']);

  /// L'ordine dei blocchi della Home, ripulito da quello salvato.
  List<String> get ordineDeiBlocchi {
    final salvato = _valori['cd_home_blocchi'];
    final fila = <String>[];
    if (salvato is List) {
      for (final voce in salvato) {
        final nome = pulito(voce);
        if (blocchiDellaHome.contains(nome) && !fila.contains(nome)) {
          fila.add(nome);
        }
      }
    }
    for (final nome in blocchiDellaHome) {
      if (!fila.contains(nome)) fila.add(nome);
    }
    return fila;
  }

  /// Il titolo scelto per la plancia (`cd_branding.title`), se c'e'.
  String get titolo {
    final marchio = _valori['cd_branding'];
    return marchio is Map ? pulito(marchio['title']) : '';
  }

  /// Come si vede l'energia in Home con piu' impianti: la somma, o una
  /// tessera per impianto.
  bool get unaTesseraPerImpianto =>
      pulito(_valori['cd_energia_tessere']) == 'una-per-impianto';

  /// Quali sezioni sono visibili nella barra (`cd_sections`).
  Map<String, bool> get visibilita {
    final grezza =
        _valori['cd_sections'] ??
        (_valori['dm_dashboard_state'] is Map
            ? (_valori['dm_dashboard_state'] as Map)['visibility']
            : null);
    if (grezza is! Map) return const {};
    return {for (final v in grezza.entries) pulito(v.key): v.value == true};
  }

  /* ─── Dentro ────────────────────────────────────────────────────────────── */

  static Object? _decodifica(Object? valore) {
    if (valore is! String) return valore;
    final testo = valore.trim();
    if (testo.isEmpty) return '';
    try {
      return jsonDecode(testo);
    } on FormatException {
      return valore;
    }
  }

  static Map<String, Object?> _leggiLeSezioni(Map<String, Object?> valori) {
    final sezioni = <String, Object?>{};
    final canonico = valori['dm_dashboard_state'];
    if (canonico is Map) {
      final dentro = canonico['sections'];
      if (dentro is Map) {
        for (final voce in dentro.entries) {
          sezioni[pulito(voce.key)] = voce.value;
        }
      }
    }
    /* All'avvio le chiavi legacy dettano, tranne le luci. */
    for (final voce in chiaviDelleSezioni.entries) {
      if (voce.key == 'lights') continue;
      final legacy = valori[voce.value];
      if (legacy != null) sezioni[voce.key] = legacy;
    }
    return sezioni;
  }

  static bool _configurata(Object? valore) => valore is String
      ? valore.trim().contains('.')
      : valore == true || (valore is num && valore != 0);

  static bool _haDatiConfigurati(String sezione, Object? valore) {
    if (sezione == 'rooms' && valore is List) {
      return valore.any(
        (s) => s is Map && (_configurata(s['temp']) || _configurata(s['hum'])),
      );
    }
    if (valore is List) {
      return valore.any((voce) {
        if (voce is! Map || voce['enabled'] == false) return false;
        if (pulito(voce['name']).isNotEmpty) return true;
        return voce.entries.any((e) {
          final chiave = pulito(e.key);
          if (!RegExp('entit|entity|entities|profile').hasMatch(chiave)) {
            return false;
          }
          final v = e.value;
          return v is List ? v.any(_configurata) : _configurata(v);
        });
      });
    }
    if (valore is! Map) return false;
    if (sezione == 'irrigation') {
      final zone = valore['zones'];
      return (zone is List &&
              zone.any((z) => z is Map && _configurata(z['entity']))) ||
          _configurata(valore['rainEnt']) ||
          _configurata(valore['weatherEnt']);
    }
    if (sezione == 'pool') {
      return const [
        'tempEnt',
        'phEnt',
        'clEnt',
        'pumpEnt',
        'heatEnt',
        'lightEnt',
      ].any((k) => _configurata(valore[k]));
    }
    return valore.entries.any((e) {
      final chiave = pulito(e.key);
      if (chiave == 'metadata') return false;
      final v = e.value;
      if (v is Map || v is List) return _haDatiConfigurati(sezione, v);
      return RegExp(
            'ent|power|energy|soc|camera|alarm',
            caseSensitive: false,
          ).hasMatch(chiave) &&
          _configurata(v);
    });
  }
}

String _slug(String testo) => testo
    .toLowerCase()
    .replaceAll(RegExp('[^a-z0-9]+'), '-')
    .replaceAll(RegExp(r'^-|-$'), '');

String _entitaDi(Map voce) {
  final diretta = pulito(voce['entity'] ?? voce['entity_id']);
  if (diretta.isNotEmpty) return diretta;
  final elenco = voce['entities'];
  return elenco is List && elenco.isNotEmpty ? pulito(elenco.first) : '';
}

/* ─── Le cose configurate ───────────────────────────────────────────────── */

class Stanza {
  Stanza._(Map grezza, int posto)
    : id = pulito(grezza['id'] ?? grezza['room_id']),
      nome = pulito(grezza['name']),
      icona = pulito(grezza['icon']),
      piano = pulito(grezza['floor']),
      temperatura = pulito(grezza['temp'] ?? grezza['temperature_entity']),
      umidita = pulito(grezza['hum'] ?? grezza['humidity_entity']),
      ordine = (comeNumero(grezza['order']) ?? posto).toInt();

  final String id;
  final String nome;
  final String icona;
  final String piano;

  /// L'entita' della temperatura e quella dell'umidita', quando la stanza
  /// misura.
  final String temperatura;
  final String umidita;
  final int ordine;

  @override
  String toString() => 'Stanza($nome)';
}

class GruppoDiLuci {
  GruppoDiLuci._({
    required this.stanza,
    required this.stanzaId,
    required this.entita,
    required this.nomi,
  });
  final String stanza;
  final String stanzaId;
  final List<String> entita;
  final Map<String, String> nomi;

  /// Il nome scelto per una luce, o la coda dell'identificativo.
  String nome(String id) {
    final scelto = pulito(nomi[id]);
    if (scelto.isNotEmpty) return scelto;
    return id.split('.').last.replaceAll('_', ' ');
  }
}

class UnitaClima {
  UnitaClima._(Map grezza)
    : entita = _entitaDi(grezza),
      nome = pulito(grezza['name']),
      stanzaId = pulito(grezza['room_id'] ?? grezza['room']),
      tipo = tipoDiClima(grezza['type']);

  final String entita;
  final String nome;
  final String stanzaId;

  /// `clima`, `termo` o `pompa`: cosa e' la macchina, non cosa sta facendo.
  final String tipo;

  static String tipoDiClima(Object? valore) {
    final parola = pulito(valore).toLowerCase();
    if (const [
      'termo',
      'termostato',
      'thermostat',
      'heat',
      'heating',
      'caldo',
    ].contains(parola)) {
      return 'termo';
    }
    if (const [
      'pompa',
      'pompa_di_calore',
      'heat_pump',
      'heatpump',
      'heat_cool',
      'both',
      'entrambi',
      'dual',
    ].contains(parola)) {
      return 'pompa';
    }
    return 'clima';
  }
}

class Copertura {
  Copertura._(this.grezza)
    : id = pulito(grezza['id']),
      entita = _entitaDi(grezza),
      nome = pulito(grezza['name']),
      stanzaId = pulito(grezza['room_id'] ?? grezza['room']),
      contatto = pulito(
        grezza['contact'] ??
            grezza['contact_entity'] ??
            grezza['window_entity'],
      ),
      inferriata = pulito(
        grezza['grate'] ?? grezza['inferriata'] ?? grezza['grate_entity'],
      ),
      invertita =
          grezza['inverted'] == true ||
          grezza['invertita'] == true ||
          grezza['reverse'] == true;

  final Map grezza;
  final String id;
  final String entita;
  final String nome;
  final String stanzaId;

  /// Il contatto sull'anta, e quello sull'inferriata, quando ci sono.
  final String contatto;
  final String inferriata;
  final bool invertita;

  /// Una finestra senza motori: solo un contatto.
  bool get soloFinestra =>
      entita.isEmpty && (contatto.isNotEmpty || inferriata.isNotEmpty);
}

class Elettrodomestico {
  Elettrodomestico._(this.grezzo)
    : id = pulito(grezzo['id']),
      nome = pulito(grezzo['name']),
      tipo = pulito(
        grezzo['device_type'] ?? grezzo['visual_key'] ?? grezzo['type'],
      ),
      stanzaId = pulito(grezzo['room_id'] ?? grezzo['room']),
      controllo = pulito(grezzo['control_entity'] ?? grezzo['switch_entity']),
      potenza = pulito(grezzo['power_entity'] ?? grezzo['power']),
      statoEntita = pulito(grezzo['state_entity'] ?? grezzo['status_entity']),
      energiaOggi = pulito(grezzo['daily_energy_entity']),
      rimanente = pulito(grezzo['remaining_entity']),
      sogliaAvvio = comeNumero(grezzo['threshold_run']) ?? 5,
      sogliaAttesa = comeNumero(grezzo['threshold_standby']) ?? 1,
      ritardoDiFine = comeNumero(grezzo['off_delay_minutes']) ?? 0,
      abilitato = grezzo['enabled'] != false,
      entita = grezzo['entities'] is List
          ? [for (final e in grezzo['entities'] as List) pulito(e)]
          : const [];

  final Map grezzo;
  final String id;
  final String nome;
  final String tipo;
  final String stanzaId;
  final String controllo;
  final String potenza;
  final String statoEntita;
  final String energiaOggi;
  final String rimanente;
  final num sogliaAvvio;
  final num sogliaAttesa;
  final num ritardoDiFine;
  final bool abilitato;
  final List<String> entita;

  /// La prima entita' che lo rappresenta: serve all'interruttore «nel widget».
  String get prima => potenza.isNotEmpty ? potenza : _entitaDi(grezzo);
}

class Telecamera {
  Telecamera._(Map grezza)
    : id = pulito(grezza['id']),
      nome = pulito(grezza['name']),
      entita = pulito(grezza['entity']),
      stanzaId = pulito(grezza['room_id'] ?? grezza['room']);
  final String id;
  final String nome;
  final String entita;
  final String stanzaId;
}

class Vettura {
  Vettura._(Map grezza)
    : id = pulito(grezza['id']),
      nome = pulito(grezza['name']),
      modello = pulito(grezza['model']),
      marca = pulito(grezza['brand']),
      tipo = pulito(grezza['tipo']),
      caselle = _mappaDiTesti(grezza['ov'] ?? grezza['overrides']);
  final String id;
  final String nome;
  final String modello;
  final String marca;

  /// `termica` per l'auto a benzina; vuoto o altro per l'elettrica.
  final String tipo;

  /// La mappatura di questa vettura: riferimento `dm.ev_…` → entita'.
  final Map<String, String> caselle;
}

Map<String, String> _mappaDiTesti(Object? grezza) => grezza is Map
    ? {
        for (final v in grezza.entries)
          if (pulito(v.value).isNotEmpty) pulito(v.key): pulito(v.value),
      }
    : const {};

class Impianto {
  Impianto._(Map grezzo, this.posto)
    : id = pulito(grezzo['id']).isNotEmpty
          ? pulito(grezzo['id'])
          : (posto == 0 ? 'impianto' : 'impianto-${posto + 1}'),
      nome = pulito(grezzo['name']),
      casa = _mappaDiTesti(grezzo['house']),
      rete = _mappaDiTesti(grezzo['grid']),
      solare = _mappaDiTesti(grezzo['solar']),
      batteria = _mappaDiTesti(grezzo['battery']);

  final int posto;
  final String id;
  final String nome;
  final Map<String, String> casa;
  final Map<String, String> rete;
  final Map<String, String> solare;
  final Map<String, String> batteria;

  bool get configurato => [
    casa,
    rete,
    solare,
    batteria,
  ].any((g) => g.values.any((v) => v.isNotEmpty));

  String etichetta([String ripiego = 'Impianto']) =>
      nome.isNotEmpty ? nome : (posto == 0 ? ripiego : '$ripiego ${posto + 1}');
}

class Piscina {
  Piscina._(this.grezza);
  final Map grezza;

  /// Le vasche: la prima e' la configurazione stessa, le altre stanno in
  /// `pools` accanto.
  List<Map> get vasche => [
    grezza,
    if (grezza['pools'] is List)
      for (final v in grezza['pools'] as List)
        if (v is Map) v,
  ];
}

class ZonaDiIrrigazione {
  ZonaDiIrrigazione._(Map grezza)
    : id = pulito(grezza['id']),
      nome = pulito(grezza['name']),
      entita = pulito(grezza['entity']),
      minuti = comeNumero(grezza['mins'])?.toInt() ?? 0;
  final String id;
  final String nome;
  final String entita;
  final int minuti;
}

class Irrigazione {
  Irrigazione._(Map grezza)
    : zone = grezza['zones'] is List
          ? [
              for (final z in grezza['zones'] as List)
                if (z is Map) ZonaDiIrrigazione._(z),
            ]
          : const [],
      pioggia = pulito(grezza['rainEnt']),
      meteo = pulito(grezza['weatherEnt']),
      terreno = pulito(grezza['soilEnt'] ?? grezza['soil_entity']);
  final List<ZonaDiIrrigazione> zone;
  final String pioggia;
  final String meteo;
  final String terreno;
}

class Robot {
  Robot._(Map grezzo, int posto)
    : id = pulito(grezzo['id']).isNotEmpty
          ? pulito(grezzo['id'])
          : 'robot-${posto + 1}',
      nome = pulito(grezzo['name']),
      entita = _entitaDi(grezzo),
      batteria = pulito(
        grezzo['battery'] ??
            grezzo['battery_entity'] ??
            grezzo['batteryEntity'],
      ),
      stanzaId = pulito(grezzo['room'] ?? grezzo['room_id']);
  final String id;
  final String nome;
  final String entita;
  final String batteria;
  final String stanzaId;
}

class Presa {
  Presa._(Map grezza, int posto)
    : entita = pulito(
        grezza['entity'] ?? grezza['entita'] ?? grezza['entity_id'],
      ),
      nome = pulito(grezza['name'] ?? grezza['nome']),
      icona = pulito(grezza['icon']).isNotEmpty ? pulito(grezza['icon']) : '🔌',
      stanzaId = pulito(
        grezza['room_id'] ?? grezza['roomId'] ?? grezza['room'],
      ),
      ordine = comeNumero(grezza['order'])?.toInt() ?? posto;
  final String entita;
  final String nome;
  final String icona;
  final String stanzaId;
  final int ordine;

  String get etichetta =>
      nome.isNotEmpty ? nome : entita.split('.').last.replaceAll('_', ' ');
}

class Persona {
  Persona._(Map grezza, this.id, int posto)
    : nome = pulito(grezza['name']),
      entita = pulito(grezza['entity']),
      foto = pulito(grezza['photo']),
      batteria = pulito(grezza['battery']),
      statoBatteria = pulito(grezza['batteryState']),
      orologio = pulito(grezza['watch']),
      distanza = pulito(grezza['distance']),
      viaggio = pulito(grezza['travel']),
      indirizzo = pulito(grezza['address']),
      attivita = pulito(grezza['activity']),
      wifi = pulito(grezza['wifi']),
      direzione = pulito(grezza['direction']),
      nascosta = grezza['nascosta'] == true,
      colore = _coloreDellAvatar(grezza['avatar'], posto),
      emoji = grezza['avatar'] is Map
          ? pulito((grezza['avatar'] as Map)['emoji'])
          : '',
      conLaFaccia =
          grezza['avatar'] is Map && (grezza['avatar'] as Map)['face'] is Map;

  final String id;
  final String nome;
  final String entita;
  final String foto;
  final String batteria;
  final String statoBatteria;
  final String orologio;
  final String distanza;
  final String viaggio;
  final String indirizzo;
  final String attivita;
  final String wifi;
  final String direzione;
  final bool nascosta;

  /// Il colore dell'avatar, sempre uno di quelli della plancia.
  final String colore;
  final String emoji;
  final bool conLaFaccia;

  static const coloriDellAvatar = [
    '#0ea5e9',
    '#6366f1',
    '#a855f7',
    '#ec4899',
    '#f43f5e',
    '#f59e0b',
    '#16a34a',
    '#14b8a6',
    '#64748b',
  ];

  static String _coloreDellAvatar(Object? avatar, int posto) {
    final scelto = avatar is Map ? pulito(avatar['color']) : '';
    if (coloriDellAvatar.contains(scelto)) return scelto;
    return coloriDellAvatar[posto % coloriDellAvatar.length];
  }
}

class AzioneRapida {
  AzioneRapida._(Map grezza)
    : tipo = pulito(grezza['type']),
      incorporata = pulito(grezza['builtin']),
      nome = pulito(grezza['name']),
      icona = pulito(grezza['icon']),
      colore = pulito(grezza['color']),
      entita = pulito(grezza['entity']),
      conferma = pulito(grezza['confirm']),
      luci = grezza['lights'] is List
          ? [for (final l in grezza['lights'] as List) pulito(l)]
          : const [];

  /// `builtin`, `toggle`, `script`, `scene` o `luci_group`.
  final String tipo;
  final String incorporata;
  final String nome;
  final String icona;
  final String colore;
  final String entita;
  final String conferma;
  final List<String> luci;
}

class Avviso {
  Avviso._(Map grezzo, this.posto)
    : nome = pulito(grezzo['name']),
      icona = pulito(grezzo['icon']),
      condizione = pulito(grezzo['cond']),
      valore = pulito(grezzo['value']),
      entita = grezzo['entities'] is List
          ? [for (final e in grezzo['entities'] as List) pulito(e)]
          : pulito(grezzo['entity']).isNotEmpty
          ? [pulito(grezzo['entity'])]
          : const [];
  final int posto;
  final String nome;
  final String icona;
  final String condizione;
  final String valore;
  final List<String> entita;
}

class VoceInEvidenza {
  VoceInEvidenza._(Map grezza, this.posto)
    : nome = pulito(grezza['name']),
      icona = pulito(grezza['icon']),
      entita = pulito(grezza['entity']),
      stanzaId = pulito(grezza['room_id']),
      sola = const [true, 'true', 1, '1'].contains(grezza['sola']);
  final int posto;
  final String nome;
  final String icona;
  final String entita;
  final String stanzaId;
  final bool sola;
}

class Porta {
  Porta._(Map grezza)
    : id = pulito(grezza['id']),
      nome = pulito(grezza['name']),
      entita = pulito(grezza['entity']),
      icona = pulito(grezza['icon']);
  final String id;
  final String nome;
  final String entita;
  final String icona;
}

class Lettore {
  Lettore._(Map grezzo, int posto)
    : id = pulito(grezzo['id']).isNotEmpty
          ? pulito(grezzo['id'])
          : 'lettore-${posto + 1}',
      entita = pulito(grezzo['entity']),
      nome = pulito(grezzo['nome'] ?? grezzo['name']),
      icona = pulito(grezzo['icona'] ?? grezzo['icon']),
      stanzaId = pulito(grezzo['room_id']);
  final String id;
  final String entita;
  final String nome;
  final String icona;
  final String stanzaId;
}

class Ups {
  Ups._(Map grezzo, int posto)
    : uid = pulito(grezzo['uid']).isNotEmpty
          ? pulito(grezzo['uid'])
          : 'ups-${posto + 1}',
      nome = pulito(grezzo['name']),
      stato = pulito(grezzo['stato']),
      rete = pulito(grezzo['rete']),
      batteria = pulito(grezzo['batteria']),
      carico = pulito(grezzo['carico']),
      autonomia = pulito(grezzo['autonomia']),
      tensione = pulito(grezzo['tensione']),
      potenza = pulito(grezzo['potenza']),
      temperatura = pulito(grezzo['temperatura']),
      invertita = grezzo['invertita'] == true || grezzo['invertita'] == 'on';
  final String uid;
  final String nome;
  final String stato;
  final String rete;
  final String batteria;
  final String carico;
  final String autonomia;
  final String tensione;
  final String potenza;
  final String temperatura;
  final bool invertita;

  List<String> get entita => [
    stato,
    rete,
    batteria,
    carico,
    autonomia,
    tensione,
    potenza,
    temperatura,
  ].where((e) => e.isNotEmpty).toList();
}

/// Un calendario scelto per l'agenda.
class CalendarioScelto {
  CalendarioScelto._(Map grezzo, int posto)
    : id = pulito(grezzo['id']).isNotEmpty
          ? pulito(grezzo['id'])
          : 'calendario-${posto + 1}',
      entita = pulito(grezzo['entity']).isNotEmpty
          ? pulito(grezzo['entity'])
          : pulito(grezzo['entity_id']),
      nome = pulito(grezzo['name']);

  final String id;
  final String entita;
  final String nome;
}

/// Una lista di cose da fare.
class ListaDiCose {
  ListaDiCose._(Map grezzo, int posto)
    : id = pulito(grezzo['id']).isNotEmpty
          ? pulito(grezzo['id'])
          : 'todo-${posto + 1}',
      entita = pulito(grezzo['entity']).isNotEmpty
          ? pulito(grezzo['entity'])
          : pulito(grezzo['entity_id']),
      nome = pulito(grezzo['name']);

  final String id;
  final String entita;
  final String nome;
}

/// Uno scaldabagno, come sta scritto in `cd_scaldabagni`.
class Scaldabagno {
  Scaldabagno._(Map grezzo, int posto)
    : id = pulito(grezzo['id']).isNotEmpty
          ? pulito(grezzo['id'])
          : 'scaldabagno-${posto + 1}',
      nome = pulito(grezzo['name']),
      stanzaId = pulito(grezzo['room']).isNotEmpty
          ? pulito(grezzo['room'])
          : pulito(grezzo['room_id']),
      /* L'entita' intera di Home Assistant, quando c'e': si porta dietro
       * stato, temperatura e obiettivo tutti insieme. */
      entita = pulito(grezzo['entity']).isNotEmpty
          ? pulito(grezzo['entity'])
          : pulito(grezzo['entity_id']),
      interruttore = pulito(grezzo['interruttore']).isNotEmpty
          ? pulito(grezzo['interruttore'])
          : pulito(grezzo['switch']),
      temperatura = pulito(grezzo['temperatura']).isNotEmpty
          ? pulito(grezzo['temperatura'])
          : pulito(grezzo['temperature']),
      obiettivo = pulito(grezzo['obiettivo']).isNotEmpty
          ? pulito(grezzo['obiettivo'])
          : pulito(grezzo['target']),
      potenza = pulito(grezzo['potenza']).isNotEmpty
          ? pulito(grezzo['potenza'])
          : pulito(grezzo['power']),
      energia = pulito(grezzo['energia']).isNotEmpty
          ? pulito(grezzo['energia'])
          : pulito(grezzo['energy']);

  final String id;
  final String nome;
  final String stanzaId;
  final String entita;
  final String interruttore;
  final String temperatura;
  final String obiettivo;
  final String potenza;
  final String energia;

  List<String> get caselle => [
    entita,
    interruttore,
    temperatura,
    obiettivo,
    potenza,
    energia,
  ].where((e) => e.isNotEmpty).toList();
}

/// Una caldaia, come sta scritta in `cd_caldaia`.
class Caldaia {
  Caldaia._(Map grezzo, int posto)
    : id = pulito(grezzo['id']).isNotEmpty
          ? pulito(grezzo['id'])
          : 'caldaia-${posto + 1}',
      nome = pulito(grezzo['name']),
      stato = pulito(grezzo['stato']),
      fiamma = pulito(grezzo['fiamma']),
      interruttore = pulito(grezzo['interruttore']),
      valvola = pulito(grezzo['valvola']),
      valvola2 = pulito(grezzo['valvola2']),
      mandata = pulito(grezzo['mandata']),
      ritorno = pulito(grezzo['ritorno']),
      acquaCalda = pulito(grezzo['acquaCalda']),
      pressione = pulito(grezzo['pressione']),
      modulazione = pulito(grezzo['modulazione']),
      /* Cosa c'e' all'altro capo del tubo: chi ha una caldaia che serve solo
       * l'accumulo sanitario non deve vederci un termosifone che non ha. */
      uscita = pulito(grezzo['uscita']).toLowerCase() == 'boiler'
          ? 'boiler'
          : 'radiatori';

  final String id;
  final String nome;
  final String stato;
  final String fiamma;
  final String interruttore;
  final String valvola;
  final String valvola2;
  final String mandata;
  final String ritorno;
  final String acquaCalda;
  final String pressione;
  final String modulazione;
  final String uscita;

  List<String> get caselle => [
    stato,
    fiamma,
    interruttore,
    valvola,
    valvola2,
    mandata,
    ritorno,
    acquaCalda,
    pressione,
    modulazione,
  ].where((e) => e.isNotEmpty).toList();
}

class PreferenzeDeiWidget {
  PreferenzeDeiWidget._(Object? grezze)
    : nascoste = _nascoste(grezze),
      ordine = _ordine(grezze),
      escluse = grezze is Map && grezze['excluded'] is List
          ? {for (final e in grezze['excluded'] as List) pulito(e)}
          : const {},
      sorgenti = grezze is Map ? _mappaDiTesti(grezze['sorgenti']) : const {},
      compatto =
          grezze is Map &&
              const [
                'mai',
                'auto',
                'sempre',
              ].contains(pulito(grezze['compatto']))
          ? pulito(grezze['compatto'])
          : 'auto';

  final Set<String> nascoste;
  final List<String> ordine;
  final Set<String> escluse;
  final Map<String, String> sorgenti;
  final String compatto;

  /// L'entita' entra nella tessera, salvo che l'interruttore non l'abbia
  /// tenuta fuori.
  bool dentro(String entita) => entita.isEmpty || !escluse.contains(entita);

  static const _rinominate = {'todo': 'agenda', 'calendario': 'agenda'};

  static Set<String> _nascoste(Object? grezze) {
    if (grezze is! Map || grezze['hidden'] is! List) return const {};
    final dentro = {for (final v in grezze['hidden'] as List) pulito(v)}
      ..remove('');
    final fuori = Set.of(dentro)..removeAll(_rinominate.keys);
    if (_rinominate.keys.every(dentro.contains)) fuori.add('agenda');
    return fuori;
  }

  static List<String> _ordine(Object? grezze) {
    if (grezze is! Map || grezze['order'] is! List) return const [];
    final fila = <String>[];
    for (final v in grezze['order'] as List) {
      final nome = _rinominate[pulito(v)] ?? pulito(v);
      if (nome.isNotEmpty && !fila.contains(nome)) fila.add(nome);
    }
    return fila;
  }
}
