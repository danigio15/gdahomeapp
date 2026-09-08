/// Una luce come la si disegna: cosa sa fare, e come sta adesso.
///
/// E' `lightView` della plancia web. Una luce che regola la luminosita', una
/// che cambia colore, una che e' di fatto un interruttore si configurano
/// uguali: la differenza la dice Home Assistant, con i modi di colore che
/// l'entita' dichiara, ed e' l'unico posto da cui leggerla — una scheda che
/// offre il colore a una lampadina che non ce l'ha e' peggio di una scheda
/// senza.
library;

import '../casa/entita.dart';
import 'numeri.dart';

const _modiDiColore = {'hs', 'xy', 'rgb', 'rgbw', 'rgbww'};
const _modiRegolabili = {
  'brightness',
  'color_temp',
  'hs',
  'xy',
  'rgb',
  'rgbw',
  'rgbww',
  'white',
};

/// Le vecchie bandiere di `supported_features`, per le luci che non
/// dichiarano i modi.
const _vecchiaLuminosita = 1;
const _vecchiaTemperatura = 2;
const _vecchioColore = 16;

const kelvinMinimoDiDifetto = 2000;
const kelvinMassimoDiDifetto = 6535;

class VistaDellaLuce {
  const VistaDellaLuce({
    required this.entita,
    required this.nome,
    required this.stanza,
    required this.disponibile,
    required this.accesa,
    required this.regolabile,
    required this.colorata,
    required this.bianca,
    required this.luminosita,
    required this.rgb,
    required this.kelvin,
    required this.kelvinMinimo,
    required this.kelvinMassimo,
    required this.effetti,
    required this.effetto,
    required this.comandabile,
  });

  final String entita;
  final String nome;
  final String stanza;
  final bool disponibile;
  final bool accesa;

  /// Regola la luminosita'.
  final bool regolabile;

  /// Cambia colore.
  final bool colorata;

  /// Regola la temperatura del bianco.
  final bool bianca;

  /// Da 1 a 100, solo quando e' accesa e regolabile.
  final int? luminosita;
  final List<int>? rgb;
  final int? kelvin;
  final int kelvinMinimo;
  final int kelvinMassimo;
  final List<String> effetti;
  final String effetto;
  final bool comandabile;

  String get dominio => entita.split('.').first;

  /// L'etichetta del tipo: DIMMER, RGB, BIANCO, ON/OFF, SWITCH.
  String get tipo {
    if (dominio != 'light') return 'SWITCH';
    if (colorata) return 'RGB';
    if (bianca) return 'BIANCO';
    if (regolabile) return 'DIMMER';
    return 'ON/OFF';
  }

  /// «ACCESA · 75%», «SPENTA», «NON DISPONIBILE».
  String get stato {
    if (!disponibile) return 'NON DISPONIBILE';
    if (!accesa) return 'SPENTA';
    return luminosita == null ? 'ACCESA' : 'ACCESA · $luminosita%';
  }
}

/// Da 0-255 a 1-100: una luce accesa non e' mai allo zero per cento.
int? luminositaInPercento(Object? grezza) {
  final valore = comeNumero(grezza);
  if (valore == null || valore <= 0) return null;
  final percento = (valore / 255 * 100).round();
  return (percento == 0 ? 1 : percento).clamp(1, 100);
}

VistaDellaLuce vistaDellaLuce(
  String entita,
  Entita? letta, {
  String nome = '',
  String stanza = '',
  bool comandabile = true,
}) {
  final id = pulito(entita);
  final dominio = id.split('.').first;
  final attributi = letta?.attributi ?? const {};
  final statoGrezzo = pulito(letta?.stato).toLowerCase();
  final disponibile =
      letta != null && statoGrezzo != 'unavailable' && statoGrezzo != 'unknown';
  final modi = {
    if (attributi['supported_color_modes'] is List)
      for (final m in attributi['supported_color_modes'] as List)
        if (pulito(m).isNotEmpty) pulito(m).toLowerCase(),
  };
  final bandiere = comeNumero(attributi['supported_features'])?.toInt() ?? 0;
  final luce = dominio == 'light';
  final soloVecchie = luce && modi.isEmpty;

  final regolabile =
      luce &&
      (modi.any(_modiRegolabili.contains) ||
          (soloVecchie &&
              ((bandiere & _vecchiaLuminosita) != 0 ||
                  attributi['brightness'] != null)));
  final colorata =
      luce &&
      (modi.any(_modiDiColore.contains) ||
          (soloVecchie &&
              ((bandiere & _vecchioColore) != 0 ||
                  attributi['rgb_color'] is List)));
  final bianca =
      luce &&
      (modi.contains('color_temp') ||
          (soloVecchie &&
              ((bandiere & _vecchiaTemperatura) != 0 ||
                  attributi['color_temp_kelvin'] != null)));

  var minimo =
      comeNumero(attributi['min_color_temp_kelvin'])?.round() ??
      (comeNumero(attributi['max_mireds']) != null
          ? (1e6 / comeNumero(attributi['max_mireds'])!).round()
          : null) ??
      kelvinMinimoDiDifetto;
  var massimo =
      comeNumero(attributi['max_color_temp_kelvin'])?.round() ??
      (comeNumero(attributi['min_mireds']) != null
          ? (1e6 / comeNumero(attributi['min_mireds'])!).round()
          : null) ??
      kelvinMassimoDiDifetto;
  if (massimo <= minimo) {
    minimo = kelvinMinimoDiDifetto;
    massimo = kelvinMassimoDiDifetto;
  }
  final kelvinLetto =
      comeNumero(attributi['color_temp_kelvin'])?.round() ??
      (comeNumero(attributi['color_temp']) != null
          ? (1e6 / comeNumero(attributi['color_temp'])!).round()
          : null);
  final rgbGrezzo = attributi['rgb_color'];
  final effetti = attributi['effect_list'] is List
      ? [
          for (final e in attributi['effect_list'] as List)
            if (pulito(e).isNotEmpty) pulito(e),
        ]
      : const <String>[];

  return VistaDellaLuce(
    entita: id,
    nome: pulito(nome).isNotEmpty
        ? pulito(nome)
        : (pulito(attributi['friendly_name']).isNotEmpty
              ? pulito(attributi['friendly_name'])
              : id),
    stanza: pulito(stanza),
    disponibile: disponibile,
    accesa: statoGrezzo == 'on',
    regolabile: regolabile,
    colorata: colorata,
    bianca: bianca,
    luminosita: regolabile
        ? luminositaInPercento(attributi['brightness'])
        : null,
    rgb: colorata && rgbGrezzo is List && rgbGrezzo.length >= 3
        ? [
            for (final c in rgbGrezzo.take(3))
              (comeNumero(c) ?? 0).round().clamp(0, 255),
          ]
        : null,
    kelvin: bianca && kelvinLetto != null
        ? kelvinLetto.clamp(minimo, massimo)
        : null,
    kelvinMinimo: minimo,
    kelvinMassimo: massimo,
    effetti: luce ? effetti : const [],
    effetto: pulito(attributi['effect']),
    comandabile: comandabile,
  );
}
