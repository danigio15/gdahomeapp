/// Chi abita la casa, e cosa se ne mostra.
///
/// Home Assistant conosce gia' le persone: `person.*` dice in che zona si
/// trovano, da quanto tempo, e spesso porta con se' la batteria del telefono.
/// Qui si decide soltanto come quelle informazioni diventano una card — e'
/// `personViewModel` della plancia web, con le stesse tre situazioni: a casa,
/// fuori, o in una zona con un nome.
library;

import '../casa/entita.dart';
import 'configurazione.dart';
import 'numeri.dart';
import 'tessere.dart' show Leggi;

/// Dove sta una persona: a casa, fuori, o in una zona che ha un nome.
enum Presenza { casa, fuori, zona }

/// Quanto tempo e' passato, a misura di card: l'unita' piu' grande che
/// abbia almeno valore 1. I secondi non si mostrano — «adesso» dice di piu'.
class DaQuanto {
  const DaQuanto(this.unita, this.valore);

  /// `adesso`, `minuti`, `ore`, `giorni`.
  final String unita;
  final int valore;

  static DaQuanto? da(DateTime? quando, DateTime adesso) {
    if (quando == null) return null;
    final minuti = adesso.difference(quando).inMinutes;
    if (minuti < 1) return const DaQuanto('adesso', 0);
    if (minuti < 60) return DaQuanto('minuti', minuti);
    final ore = minuti ~/ 60;
    if (ore < 24) return DaQuanto('ore', ore);
    return DaQuanto('giorni', ore ~/ 24);
  }

  /// «9 min fa», «2 h fa», «3 g fa», «adesso».
  String get testo => switch (unita) {
    'adesso' => 'adesso',
    'minuti' => '$valore min fa',
    'ore' => '$valore h fa',
    _ => '$valore g fa',
  };
}

class VistaDellaPersona {
  const VistaDellaPersona({
    required this.id,
    required this.nome,
    required this.iniziali,
    required this.presenza,
    required this.nota,
    required this.zona,
    required this.batteria,
    required this.inCarica,
    required this.orologio,
    required this.distanza,
    required this.unitaDellaDistanza,
    required this.viaggio,
    required this.direzione,
    required this.indirizzo,
    required this.attivita,
    required this.wifi,
    required this.daQuanto,
    required this.colore,
    required this.emoji,
    required this.foto,
    required this.faccia,
  });

  final String id;
  final String nome;
  final String iniziali;
  final Presenza presenza;

  /// `false` quando Home Assistant non sa dov'e': l'entita' manca o tace.
  final bool nota;

  /// Il nome della zona, come lo scrive Home Assistant, quando e' una zona.
  final String zona;
  final num? batteria;
  final bool inCarica;
  final num? orologio;
  final num? distanza;
  final String unitaDellaDistanza;
  final int? viaggio;

  /// `towards`, `away`, o niente.
  final String direzione;
  final String indirizzo;
  final String attivita;
  final String wifi;
  final DaQuanto? daQuanto;
  final String colore;
  final String emoji;
  final String foto;

  /// Il ritratto scelto: persona, capelli, carnagione, abito. Vuoto quando
  /// non ne e' stato scelto uno.
  final Map<String, Object?> faccia;

  bool get conLaFaccia => faccia.isNotEmpty;

  bool get batteriaBassa => batteria != null && batteria! <= 20;
  bool get orologioBasso => orologio != null && orologio! <= 20;

  /// L'etichetta della pastiglia: «Casa», «Fuori», o il nome del posto.
  String get etichettaDellaZona => switch (presenza) {
    Presenza.casa => 'Casa',
    Presenza.fuori => 'Fuori',
    Presenza.zona => zona,
  };
}

const _statiFuori = {'not_home', 'unknown', 'unavailable', 'none', ''};
const _statiInCarica = {'charging', 'full', 'ac', 'usb', 'wireless', 'dock'};
const _statiMancanti = {
  '',
  'unknown',
  'unavailable',
  'none',
  'not set',
  'not_set',
  'off',
  '<not connected>',
};

num? _percentuale(Object? valore) {
  return comeNumero(valore)?.clamp(0, 100);
}

String _leggibile(Entita? letto) {
  final valore = pulito(letto?.stato);
  return _statiMancanti.contains(valore.toLowerCase()) ? '' : valore;
}

/// Le iniziali: due lettere del nome, come le rubriche dei telefoni.
String iniziali(String nome) {
  final parole = pulito(nome)
      .split(RegExp(r'\s+'))
      .where((p) => p.isNotEmpty)
      .toList();
  if (parole.isEmpty) return '?';
  return parole.take(2).map((p) => p[0].toUpperCase()).join();
}

bool inCarica(Object? stato) => _statiInCarica.contains(
  pulito(stato).toLowerCase().replaceAll(RegExp(r'\s+'), '_'),
);

VistaDellaPersona vistaDellaPersona(
  Persona persona,
  Leggi leggi, {
  DateTime? adesso,
}) {
  final ora = adesso ?? DateTime.now();
  final letto = persona.entita.isEmpty ? null : leggi(persona.entita);
  final grezzo = pulito(letto?.stato);
  final presenza = grezzo.toLowerCase() == 'home'
      ? Presenza.casa
      : _statiFuori.contains(grezzo.toLowerCase())
      ? Presenza.fuori
      : Presenza.zona;
  final nota =
      letto != null &&
      !const ['unknown', 'unavailable', ''].contains(grezzo.toLowerCase());

  /* Da dove viene la batteria, in ordine di fiducia: il sensore dichiarato,
   * poi quello che l'entita' della persona sa gia'. */
  num? batteria;
  if (persona.batteria.isNotEmpty) {
    batteria = _percentuale(leggi(persona.batteria)?.stato);
  } else {
    batteria = _percentuale(letto?.attributi['battery_level']);
    if (batteria == null) {
      final sorgente = pulito(letto?.attributi['source']);
      if (sorgente.isNotEmpty) {
        batteria = _percentuale(leggi(sorgente)?.attributi['battery_level']);
      }
    }
  }

  final avatarScelto = persona.conLaFaccia || persona.emoji.isNotEmpty;
  final foto = persona.foto.isNotEmpty
      ? persona.foto
      : (avatarScelto ? '' : pulito(letto?.attributi['entity_picture']));
  final fuori = nota && presenza != Presenza.casa;

  num? distanza;
  var unitaDellaDistanza = 'km';
  if (fuori && persona.distanza.isNotEmpty) {
    final lettoDistanza = leggi(persona.distanza);
    final valore = comeNumero(_leggibile(lettoDistanza));
    if (valore != null && valore >= 0) {
      final unita = pulito(lettoDistanza?.attributi['unit_of_measurement']);
      if (unita == 'm' && valore >= 1000) {
        distanza = (valore / 100).round() / 10;
      } else if (unita == 'm') {
        distanza = valore.round();
        unitaDellaDistanza = 'm';
      } else {
        distanza = (valore * 10).round() / 10;
        unitaDellaDistanza = unita.isEmpty ? 'km' : unita;
      }
    }
  }

  int? viaggio;
  if (fuori && persona.viaggio.isNotEmpty) {
    final valore = comeNumero(_leggibile(leggi(persona.viaggio)));
    if (valore != null && valore >= 0) viaggio = valore.round();
  }

  var direzione = '';
  if (fuori && persona.direzione.isNotEmpty) {
    final valore = pulito(leggi(persona.direzione)?.stato).toLowerCase();
    direzione = valore == 'towards'
        ? 'towards'
        : valore == 'away_from'
        ? 'away'
        : '';
  }

  var attivita = '';
  if (fuori && persona.attivita.isNotEmpty) {
    final valore = pulito(leggi(persona.attivita)?.stato)
        .toLowerCase()
        .replaceAll(RegExp(r'\s+'), '_');
    for (final (chiave, nomi) in const [
      ('automotive', ['automotive', 'in_vehicle', 'driving']),
      ('cycling', ['cycling', 'on_bicycle']),
      ('running', ['running']),
      ('walking', ['walking', 'on_foot']),
      ('still', ['still', 'stationary']),
    ]) {
      if (nomi.contains(valore)) attivita = chiave;
    }
  }

  final nome = persona.nome.isNotEmpty
      ? persona.nome
      : (pulito(letto?.attributi['friendly_name']).isNotEmpty
            ? pulito(letto?.attributi['friendly_name'])
            : persona.entita);
  return VistaDellaPersona(
    id: persona.id,
    nome: nome,
    iniziali: iniziali(
      persona.nome.isNotEmpty
          ? persona.nome
          : pulito(letto?.attributi['friendly_name']),
    ),
    presenza: presenza,
    nota: nota,
    zona: presenza == Presenza.zona ? grezzo : '',
    batteria: batteria,
    inCarica:
        persona.statoBatteria.isNotEmpty &&
        inCarica(leggi(persona.statoBatteria)?.stato),
    orologio: persona.orologio.isEmpty
        ? null
        : _percentuale(leggi(persona.orologio)?.stato),
    distanza: distanza,
    unitaDellaDistanza: unitaDellaDistanza,
    viaggio: viaggio,
    direzione: direzione,
    indirizzo: fuori && persona.indirizzo.isNotEmpty
        ? _leggibile(leggi(persona.indirizzo))
        : '',
    attivita: attivita,
    wifi: persona.wifi.isEmpty ? '' : _leggibile(leggi(persona.wifi)),
    daQuanto: nota ? DaQuanto.da(letto.cambiataIl, ora) : null,
    colore: persona.colore,
    emoji: persona.emoji,
    foto: foto,
    faccia: persona.faccia,
  );
}

/// Le persone da mostrare in Home, gia' decise: quelle non nascoste.
List<VistaDellaPersona> personeDellaHome(
  ConfigurazioneDellaPlancia config,
  Leggi leggi, {
  DateTime? adesso,
}) => [
  for (final persona in config.persone)
    if (!persona.nascosta) vistaDellaPersona(persona, leggi, adesso: adesso),
];
