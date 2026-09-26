/// I comandi rapidi in auto: quelli dietro il tasto con la casa, sulla mappa
/// del navigatore, in Android Auto (e in CarPlay, quando ci sara').
///
/// Li sceglie chi guida, sul telefono (`schermate/comandi_in_auto.dart`): fino
/// a sei, nell'ordine in cui li vuole sullo schermo dell'auto. Si scelgono fra
/// le azioni rapide della plancia e le cose di casa che si premono — una
/// scena, uno script, il cancello, una luce.
///
/// Ogni comando porta con se' la sua **ricetta** (dominio, servizio, entita'):
/// in macchina non c'e' tempo di chiedere niente a nessuno, e il tasto premuto
/// la ritrova scritta nel file ([nomeDeiComandi]) e la esegue con lo stesso
/// giro dei tasti di sempre (`in_auto.dart`). Il file lo legge anche il
/// servizio dell'auto, per disegnare la griglia (`IComandiInAuto.kt`): i due
/// capi devono restare d'accordo sui nomi dei campi.
library;

import 'dart:convert';

import '../casa/entita.dart';
import 'la_foto.dart';

/// Il file dei comandi, accanto a quelli della fotografia per l'auto.
const String nomeDeiComandi = 'gdahome-auto-comandi.json';

/// Quanti se ne possono scegliere. Lo schermo dell'auto ne mostra quanti ne
/// stanno nella sua griglia — sei su tutte, di piu' sugli schermi grandi —
/// nell'ordine scelto: i primi sei sono quelli che si vedono sempre.
const int comandiAlMassimo = 12;

/// Quanti se ne vedono in auto su qualunque schermo.
const int comandiSempreInVista = 6;

/// Il servizio che si decide al momento di premere, guardando com'e' messa
/// l'entita' adesso: una serratura chiusa si apre e una aperta si chiude, un
/// lettore spento si accende e uno acceso va in pausa. Scritto prima, quel
/// servizio chiuderebbe una porta che intanto qualcuno ha aperto.
const String secondoLoStato = 'secondo_lo_stato';

/// Il servizio vero di [secondoLoStato], dallo stato di adesso.
String ilServizioDiAdesso(String dominio, String? stato) {
  final s = (stato ?? '').toLowerCase();
  return switch (dominio) {
    'lock' => s == 'locked' ? 'unlock' : 'lock',
    'media_player' =>
      const {'off', 'standby', 'unavailable', 'unknown', ''}.contains(s)
          ? 'turn_on'
          : 'media_play_pause',
    'cover' =>
      const {'open', 'opening'}.contains(s) ? 'close_cover' : 'open_cover',
    _ => 'toggle',
  };
}

/// Che cosa e', per il disegno sullo schermo dell'auto. Lo stesso nome sta in
/// `IComandiInAuto.kt`.
enum GenereDelComando { varco, porta, luce, presa, scena, serratura, azione }

class ComandoRapido {
  const ComandoRapido({
    required this.id,
    required this.nome,
    required this.genere,
    required this.ricetta,
    this.conferma = false,
    this.provenienza = '',
  });

  /// «c|cover.cancello|toggle»: lo stesso segno che il tasto lascia scritto.
  final String id;
  final String nome;
  final GenereDelComando genere;
  final RicettaDellAzione ricetta;

  /// Se in auto si chiede prima «sei sicuro?»: una serratura che si apre
  /// non si apre per un tocco sbagliato.
  final bool conferma;

  /// Da dove viene, in parole: «Azione rapida», «Scena», «Cancello»…
  final String provenienza;

  /// Cosa fa davvero — su quale entita', con quale servizio e quale voce —
  /// per riconoscere due comandi uguali venuti da posti diversi.
  String get impronta =>
      '${ricetta.entita}|${ricetta.servizio}|${ricetta.dati['option'] ?? ''}';

  /// Lo stesso comando con un altro nome, o con o senza conferma.
  ComandoRapido cambiato({String? nome, bool? conferma}) => ComandoRapido(
    id: id,
    nome: nome == null || nome.trim().isEmpty ? this.nome : nome.trim(),
    genere: genere,
    ricetta: ricetta,
    conferma: conferma ?? this.conferma,
    provenienza: provenienza,
  );

  Map<String, Object?> get comeSiScrive => {
    'id': id,
    'nome': nome,
    'genere': genere.name,
    if (conferma) 'conferma': true,
    if (provenienza.isNotEmpty) 'provenienza': provenienza,
    'dominio': ricetta.dominio,
    'servizio': ricetta.servizio,
    'entita': ricetta.entita,
    if (ricetta.dati.isNotEmpty) 'dati': ricetta.dati,
  };

  static ComandoRapido? leggi(Object? grezzo) {
    if (grezzo is! Map) return null;
    String testo(String chiave) =>
        grezzo[chiave] is String ? (grezzo[chiave] as String).trim() : '';
    final id = testo('id');
    final nome = testo('nome');
    final dominio = testo('dominio');
    final servizio = testo('servizio');
    final entita = testo('entita');
    if (id.isEmpty || nome.isEmpty || servizio.isEmpty || entita.isEmpty) {
      return null;
    }
    final dati = grezzo['dati'];
    return ComandoRapido(
      id: id,
      nome: nome,
      genere:
          GenereDelComando.values
              .where((g) => g.name == testo('genere'))
              .firstOrNull ??
          GenereDelComando.azione,
      conferma: grezzo['conferma'] == true,
      provenienza: testo('provenienza'),
      ricetta: RicettaDellAzione(
        id: id,
        dominio: dominio,
        servizio: servizio,
        entita: entita,
        dati: dati is Map ? Map<String, Object?>.from(dati) : const {},
      ),
    );
  }
}

/// Quelli scelti, e quale proporre arrivando a casa.
/// A quanti metri da Casa si propone il comando dell'arrivo, se non si e'
/// scelto altro.
const int metriDiSolito = 500;

/// Le distanze fra cui si sceglie: da un cancello in fondo al vialetto a
/// uno che si apre piano e va chiamato prima.
const List<int> metriFraCuiScegliere = [
  100,
  200,
  300,
  500,
  800,
  1000,
  1500,
  2000,
];

class IComandiScelti {
  const IComandiScelti({
    this.comandi = const [],
    this.allArrivo,
    this.metri = metriDiSolito,
  });

  final List<ComandoRapido> comandi;

  /// L'id del comando da proporre quando si arriva a casa (a 500 m), o
  /// `null` se non si propone niente.
  final String? allArrivo;

  /// A quanti metri da Casa si propone il comando dell'arrivo.
  final int metri;

  ComandoRapido? get quelloDellArrivo =>
      comandi.where((c) => c.id == allArrivo).firstOrNull;

  String get comeSiScrive => jsonEncode({
    'comandi': [for (final c in comandi.take(comandiAlMassimo)) c.comeSiScrive],
    'arrivo': ?allArrivo,
    'metri': metri,
  });

  static IComandiScelti leggi(String detto) {
    try {
      final letto = jsonDecode(detto);
      if (letto is! Map) return const IComandiScelti();
      final elenco = letto['comandi'];
      final comandi = [
        if (elenco is List)
          for (final riga in elenco) ?ComandoRapido.leggi(riga),
      ].take(comandiAlMassimo).toList();
      final arrivo = letto['arrivo'];
      final metri = letto['metri'];
      return IComandiScelti(
        metri: metri is int && metri >= 50 && metri <= 5000
            ? metri
            : metriDiSolito,
        comandi: comandi,
        allArrivo: arrivo is String && comandi.any((c) => c.id == arrivo)
            ? arrivo
            : null,
      );
    } on FormatException {
      return const IComandiScelti();
    }
  }

  /// Le ricette, per chi esegue il tasto premuto in macchina.
  List<RicettaDellAzione> get ricette => [for (final c in comandi) c.ricetta];

  IComandiScelti con({
    List<ComandoRapido>? comandi,
    String? allArrivo,
    int? metri,
  }) => IComandiScelti(
    comandi: comandi ?? this.comandi,
    allArrivo: allArrivo ?? this.allArrivo,
    metri: metri ?? this.metri,
  );

  IComandiScelti senzaArrivo() =>
      IComandiScelti(comandi: comandi, metri: metri);
}

/// Cosa si puo' mettere fra i comandi di questa casa, dalle sue entita'.
///
/// Le cose che si **premono**: una scena, uno script, un cancello o una
/// tapparella, una serratura, una luce, una presa, un pulsante. Niente
/// sensori (non si premono) e niente allarme (vuole un codice, e un codice
/// in macchina non si scrive).
List<ComandoRapido> iComandiDellaCasa(Iterable<Entita> entita) {
  final fuori = <ComandoRapido>[];
  for (final e in entita) {
    if (e.muta) continue;
    final c = comandoPer(e);
    if (c != null) fuori.add(c);
  }
  fuori.sort((a, b) {
    final g = a.genere.index.compareTo(b.genere.index);
    return g != 0 ? g : a.nome.toLowerCase().compareTo(b.nome.toLowerCase());
  });
  return fuori;
}

/// Il comando che fa quello che ci si aspetta da un tocco su questa entita'.
ComandoRapido? comandoPer(Entita e) {
  final classe = '${e.attributi['device_class'] ?? ''}';
  ComandoRapido fai(
    String servizio,
    GenereDelComando genere,
    String provenienza, {
    bool conferma = false,
  }) => ComandoRapido(
    id: 'c|${e.id}|$servizio',
    nome: e.nome,
    genere: genere,
    conferma: conferma,
    provenienza: provenienza,
    ricetta: RicettaDellAzione(
      id: 'c|${e.id}|$servizio',
      dominio: e.dominio,
      servizio: servizio,
      entita: e.id,
    ),
  );
  return switch (e.dominio) {
    'scene' => fai('turn_on', GenereDelComando.scena, 'Scena'),
    'script' => fai('turn_on', GenereDelComando.scena, 'Script'),
    'cover' => switch (classe) {
      'gate' => fai('toggle', GenereDelComando.varco, 'Cancello'),
      'garage' => fai('toggle', GenereDelComando.porta, 'Garage'),
      'door' => fai('toggle', GenereDelComando.porta, 'Porta'),
      _ => fai('toggle', GenereDelComando.varco, 'Tapparella'),
    },
    'lock' => fai(
      'unlock',
      GenereDelComando.serratura,
      'Serratura',
      conferma: true,
    ),
    'light' => fai('toggle', GenereDelComando.luce, 'Luce'),
    'switch' => fai('toggle', GenereDelComando.presa, 'Presa'),
    'input_boolean' => fai('toggle', GenereDelComando.presa, 'Interruttore'),
    'button' => fai('press', GenereDelComando.azione, 'Pulsante'),
    _ => null,
  };
}

/// Le azioni rapide della plancia, come l'auto le ha gia': dalla fotografia
/// e dalle sue ricette. Solo quelle che partono da sole (hanno una ricetta):
/// le altre vogliono qualcuno che guardi, e in macchina non c'e'.
List<ComandoRapido> leAzioniDellaPlancia(
  String fotografia,
  List<RicettaDellAzione> ricette,
) {
  try {
    final letto = jsonDecode(fotografia);
    if (letto is! Map || letto['azioni'] is! List) return const [];
    return [
      for (final riga in letto['azioni'] as List)
        if (riga is Map &&
            riga['id'] is String &&
            riga['nome'] is String &&
            laRicettaDi(riga['id'] as String, ricette) != null)
          ComandoRapido(
            id: riga['id'] as String,
            nome: (riga['nome'] as String).trim(),
            genere: GenereDelComando.azione,
            provenienza: 'Azione rapida',
            ricetta: laRicettaDi(riga['id'] as String, ricette)!,
          ),
    ];
  } on FormatException {
    return const [];
  }
}

/// Quello proposto la prima volta: le azioni rapide della plancia, poi il
/// cancello e il garage — le cose che si premono arrivando. Fino a sei.
IComandiScelti iPrimiComandi({
  required List<ComandoRapido> azioni,
  required List<ComandoRapido> dellaCasa,
}) {
  final fatti = {for (final a in azioni) a.impronta};
  final scelti = <ComandoRapido>[
    ...azioni,
    /* Il cancello che e' gia' un'azione rapida non si mette due volte. */
    ...dellaCasa.where(
      (c) =>
          !fatti.contains(c.impronta) &&
          (c.genere == GenereDelComando.varco && c.provenienza == 'Cancello' ||
              c.genere == GenereDelComando.porta && c.provenienza == 'Garage'),
    ),
  ].take(comandiAlMassimo).toList();
  /* Il cancello, che venga dalla plancia o dalla casa. */
  final arrivo =
      scelti.where((c) => c.provenienza == 'Cancello').firstOrNull ??
      scelti
          .where(
            (c) =>
                c.genere == GenereDelComando.varco &&
                c.ricetta.dominio == 'cover',
          )
          .firstOrNull;
  return IComandiScelti(comandi: scelti, allArrivo: arrivo?.id);
}

/// Le azioni rapide della plancia, **tutte**, lette dalla sua configurazione
/// (`cd_quick_actions`, con le sostituzioni di `cd_entity_overrides`): le
/// stesse, nello stesso ordine, dei tasti in Home.
///
/// Prima arrivavano dalla fotografia lasciata all'auto, che ne tiene sei e
/// solo quelle che partono senza nessuno che guardi: chi ne aveva nove ne
/// trovava cinque. Qui entrano anche quelle con la domanda di conferma (in
/// auto la fa lo schermo dell'auto), le serrature e i lettori (il servizio si
/// decide premendo, [secondoLoStato]) e i gruppi di luci. Restano fuori, con
/// il perche' in [AzioniDellaPlancia.soloNellaPlancia], quelle che aprono un
/// pannello della plancia e i menu senza una voce fissata.
AzioniDellaPlancia leAzioniDellaConfigurazione(
  Map<String, dynamic> valori, {
  Entita? Function(String id)? entita,
}) {
  Object? json(Object? v) {
    if (v is String) {
      try {
        return jsonDecode(v);
      } on FormatException {
        return null;
      }
    }
    return v;
  }

  String testo(Object? v) => v is String ? v.trim() : '';
  final elenco = json(valori['cd_quick_actions']);
  final sostituzioni = json(valori['cd_entity_overrides']);
  String vera(String id) {
    if (sostituzioni is Map) {
      final altra = sostituzioni[id];
      if (altra is String && altra.contains('.')) return altra.trim();
    }
    return id;
  }

  final comandi = <ComandoRapido>[];
  final fuori = <({String nome, String perche})>[];
  if (elenco is! List) return AzioniDellaPlancia(comandi, fuori);
  for (final grezza in elenco) {
    if (grezza is! Map) continue;
    final nome = testo(grezza['name']);
    if (nome.isEmpty) continue;
    final tipo = testo(grezza['type']).toLowerCase();
    final conferma = testo(grezza['confirm']).isNotEmpty;
    if (tipo == 'builtin') {
      fuori.add((nome: nome, perche: 'Apre un pannello della plancia'));
      continue;
    }
    if (tipo == 'luci_group') {
      final luci = [
        for (final l
            in grezza['lights'] is List ? grezza['lights'] as List : [])
          if (l is String && l.contains('.')) vera(l.trim()),
      ];
      if (luci.isEmpty) {
        fuori.add((nome: nome, perche: 'Il gruppo non ha luci'));
        continue;
      }
      final id = 'q|$nome|${luci.join(',')}';
      comandi.add(
        ComandoRapido(
          id: id,
          nome: nome,
          genere: GenereDelComando.luce,
          conferma: conferma,
          provenienza: 'Gruppo di ${luci.length} luci',
          ricetta: RicettaDellAzione(
            id: id,
            dominio: 'light',
            servizio: 'toggle',
            entita: luci.join(','),
          ),
        ),
      );
      continue;
    }
    final scritta = testo(grezza['entity']);
    if (!scritta.contains('.')) {
      fuori.add((nome: nome, perche: 'Senza un dispositivo'));
      continue;
    }
    final id0 = vera(scritta);
    final dominio = tipo == 'script'
        ? 'script'
        : tipo == 'scene'
        ? 'scene'
        : id0.split('.').first.toLowerCase();
    final voce = testo(grezza['option']);
    if ((dominio == 'select' || dominio == 'input_select') && voce.isEmpty) {
      fuori.add((nome: nome, perche: 'Chiede di scegliere una voce'));
      continue;
    }
    final servizio = switch (dominio) {
      'button' || 'input_button' => 'press',
      'scene' || 'script' => 'turn_on',
      'select' || 'input_select' => 'select_option',
      'lock' || 'media_player' => secondoLoStato,
      _ => 'toggle',
    };
    final e = entita?.call(id0);
    final genere = e == null
        ? _genereDelDominio(dominio, '')
        : comandoPer(e)?.genere ??
              _genereDelDominio(
                dominio,
                '${e.attributi['device_class'] ?? ''}',
              );
    final id = 'q|$nome|$id0';
    comandi.add(
      ComandoRapido(
        id: id,
        nome: nome,
        genere: genere,
        /* Una serratura in macchina chiede sempre conferma. */
        conferma: conferma || dominio == 'lock',
        provenienza: 'Azione rapida',
        ricetta: RicettaDellAzione(
          id: id,
          dominio: dominio,
          servizio: servizio,
          entita: id0,
          dati: voce.isEmpty ? const {} : {'option': voce},
        ),
      ),
    );
  }
  return AzioniDellaPlancia(comandi, fuori);
}

GenereDelComando _genereDelDominio(String dominio, String classe) =>
    switch (dominio) {
      'scene' || 'script' => GenereDelComando.scena,
      'cover' when classe == 'garage' || classe == 'door' =>
        GenereDelComando.porta,
      'cover' => GenereDelComando.varco,
      'lock' => GenereDelComando.serratura,
      'light' => GenereDelComando.luce,
      'switch' || 'input_boolean' || 'fan' => GenereDelComando.presa,
      _ => GenereDelComando.azione,
    };

/// Le azioni rapide della plancia: quelle che vanno in auto, e quelle che
/// restano nella plancia col perche'.
class AzioniDellaPlancia {
  const AzioniDellaPlancia(this.comandi, [this.soloNellaPlancia = const []]);

  final List<ComandoRapido> comandi;
  final List<({String nome, String perche})> soloNellaPlancia;
}

/// Cosa si puo' fare con questa entita', per chi crea un comando suo: le
/// scelte, in parole, col servizio che chiamano.
List<({String titolo, String servizio, Map<String, Object?> dati})>
cosaSiPuoFare(Entita e) {
  final d = e.dominio;
  final voci = e.attributi['options'];
  return switch (d) {
    'scene' || 'script' => [(titolo: 'Attiva', servizio: 'turn_on', dati: {})],
    'button' ||
    'input_button' => [(titolo: 'Premi', servizio: 'press', dati: {})],
    'cover' => [
      (titolo: 'Apri o chiudi', servizio: 'toggle', dati: {}),
      (titolo: 'Apri', servizio: 'open_cover', dati: {}),
      (titolo: 'Chiudi', servizio: 'close_cover', dati: {}),
    ],
    'lock' => [
      (titolo: 'Apri o chiudi', servizio: secondoLoStato, dati: {}),
      (titolo: 'Apri', servizio: 'unlock', dati: {}),
      (titolo: 'Chiudi', servizio: 'lock', dati: {}),
    ],
    'light' || 'switch' || 'input_boolean' || 'fan' => [
      (titolo: 'Accendi o spegni', servizio: 'toggle', dati: {}),
      (titolo: 'Accendi', servizio: 'turn_on', dati: {}),
      (titolo: 'Spegni', servizio: 'turn_off', dati: {}),
    ],
    'media_player' => [
      (titolo: 'Play o pausa', servizio: secondoLoStato, dati: {}),
      (titolo: 'Spegni', servizio: 'turn_off', dati: {}),
    ],
    'select' || 'input_select' => [
      if (voci is List)
        for (final v in voci)
          if (v is String)
            (titolo: v, servizio: 'select_option', dati: {'option': v}),
    ],
    _ => const [],
  };
}

/// Le entita' con cui si puo' creare un comando.
bool siPuoComandare(Entita e) => !e.muta && cosaSiPuoFare(e).isNotEmpty;

/// Un comando creato da chi guida: questa entita', questa cosa da fare, con
/// il nome che vuole.
ComandoRapido comandoFatto({
  required Entita entita,
  required String nome,
  required String servizio,
  Map<String, Object?> dati = const {},
  required bool conferma,
}) {
  final voce = dati['option'];
  final id = 'm|${entita.id}|$servizio${voce is String ? '|$voce' : ''}';
  final classe = '${entita.attributi['device_class'] ?? ''}';
  return ComandoRapido(
    id: id,
    nome: nome.trim().isEmpty ? entita.nome : nome.trim(),
    genere:
        comandoPer(entita)?.genere ?? _genereDelDominio(entita.dominio, classe),
    conferma: conferma,
    provenienza: 'Creato da te',
    ricetta: RicettaDellAzione(
      id: id,
      dominio: entita.dominio,
      servizio: servizio,
      entita: entita.id,
      dati: dati,
    ),
  );
}
