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

/// Quanti ne stanno sullo schermo dell'auto: una griglia di sei si legge in
/// un colpo d'occhio, di piu' vuol dire scorrere guidando.
const int comandiAlMassimo = 6;

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
class IComandiScelti {
  const IComandiScelti({this.comandi = const [], this.allArrivo});

  final List<ComandoRapido> comandi;

  /// L'id del comando da proporre quando si arriva a casa (a 500 m), o
  /// `null` se non si propone niente.
  final String? allArrivo;

  ComandoRapido? get quelloDellArrivo =>
      comandi.where((c) => c.id == allArrivo).firstOrNull;

  String get comeSiScrive => jsonEncode({
    'comandi': [for (final c in comandi.take(comandiAlMassimo)) c.comeSiScrive],
    'arrivo': ?allArrivo,
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
      return IComandiScelti(
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

  IComandiScelti con({List<ComandoRapido>? comandi, String? allArrivo}) =>
      IComandiScelti(
        comandi: comandi ?? this.comandi,
        allArrivo: allArrivo ?? this.allArrivo,
      );

  IComandiScelti senzaArrivo() => IComandiScelti(comandi: comandi);
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
  final scelti = <ComandoRapido>[
    ...azioni,
    ...dellaCasa.where(
      (c) =>
          c.genere == GenereDelComando.varco && c.provenienza == 'Cancello' ||
          c.genere == GenereDelComando.porta && c.provenienza == 'Garage',
    ),
  ].take(comandiAlMassimo).toList();
  final arrivo = scelti.where((c) => c.provenienza == 'Cancello').firstOrNull;
  return IComandiScelti(comandi: scelti, allArrivo: arrivo?.id);
}
