/// I disegni degli elettrodomestici: gli stessi della plancia.
///
/// Sulla plancia ogni elettrodomestico ha il suo disegno, scelto dal nome o
/// dal tipo (`ponte/plancia/src/core/appliance-artwork.js`,
/// `canonicalArtworkType` e `applianceArtwork`). Qui ci sono **quelli**,
/// copiati uno per file in `assets/elettrodomestici/` — il forno e' il forno
/// della plancia, il frigo il suo frigo — e la stessa regola per riconoscerli
/// dal nome. In piu' ci sono la pompa di calore, che la plancia non
/// distingue e che in «Chi ha consumato di piu'» e' quasi sempre la prima, e
/// la pompa della piscina. Li usa anche la scheda delle notifiche
/// (`lib/notifiche/scheda.dart`): la lavastoviglie che ha finito ha la faccia
/// della lavastoviglie.
///
/// Un nome che non si riconosce prende la presa generica, mai il disegno di
/// un'altra cosa.
library;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Il tipo di un elettrodomestico dal suo nome, come lo riconosce la
/// plancia; `generic` se non si sa.
String tipoDellElettrodomestico(String nome) {
  final t = nome.toLowerCase();
  bool c(String regola) => RegExp(regola).hasMatch(t);
  /* La pompa di calore prima di tutto: «pompa di calore clima» e' lei, non
   * un condizionatore. */
  if (c(r'pompa\s*di\s*calore|heat[_ -]?pump|\bpdc\b')) return 'heat-pump';
  if (c('microonde|microwave')) return 'microwave';
  if (c('forno|oven|stove')) return 'oven';
  if (c('frigo|fridge|refriger|freezer|congelatore')) return 'fridge';
  if (c(r'accumulo|puffer|storage[_ -]?(?:boiler|tank)')) {
    return 'storage-boiler';
  }
  if (c(r'friggitrice|air[_ -]?fryer|airfryer')) return 'air-fryer';
  if (c(r'scaldabagno|boiler|water[_ -]?heater')) return 'boiler';
  /* La lavastoviglie prima della lavatrice: «dishwasher» finisce in
   * «washer». */
  if (c('lavastoviglie|dishwasher')) return 'dishwasher';
  if (c(r'lavatrice|washing[_ -]?machine|washer')) return 'washer';
  if (c(r'asciugatrice|tumble[_ -]?dryer|dryer')) return 'dryer';
  if (c(r'piano[_ -]?cottura|induzione|cooktop|\bhob\b')) return 'cooktop';
  if (c(r'televis|\btv\b|monitor')) return 'television';
  if (c(r'cappa|\bhood\b|extractor')) return 'hood';
  if (c(r'ferro|\biron\b')) return 'iron';
  if (c('robot|roomba')) return 'robot-vacuum';
  if (c('aspirapolvere|vacuum')) return 'vacuum';
  if (c(
    r'wallbox|colonnina|charging[_ -]?station|stazione[_ -]?di[_ -]?ricarica|'
    r'ricarica[_ -]?(?:auto|vettura|ev)|(?:ev|car|auto|vettura)[_ -]?charg|'
    r'^auto\b|\bauto elettrica\b',
  )) {
    return 'wallbox';
  }
  if (c(r'condizionatore|air[_ -]?condition|\bsplit\b|clima')) {
    return 'air-conditioner';
  }
  if (c(r'ventilatore|\bfan\b')) return 'fan';
  if (c('caffe|caffè|coffee')) return 'coffee';
  if (c('tostapane|toaster')) return 'toaster';
  if (c('bollitore|kettle')) return 'kettle';
  /* La pompa della piscina: come la pompa di calore, la plancia non la
   * distingue. */
  if (c('piscin|pool')) return 'pool-pump';
  return 'generic';
}

/// I tipi che hanno un disegno.
const tipiDegliElettrodomestici = {
  'heat-pump',
  'oven',
  'microwave',
  'fridge',
  'storage-boiler',
  'air-fryer',
  'boiler',
  'washer',
  'dryer',
  'dishwasher',
  'cooktop',
  'television',
  'hood',
  'iron',
  'vacuum',
  'robot-vacuum',
  'air-conditioner',
  'fan',
  'coffee',
  'toaster',
  'kettle',
  'wallbox',
  'pool-pump',
  'generic',
};

/// Il tipo di un elettrodomestico da quello che dice la casa: [tipo] se e'
/// uno dei [tipiDegliElettrodomestici], altrimenti lo si riconosce da [tipo]
/// e dal [nome] insieme — un ponte di prima manda `lavatrice` o `altro`, e
/// `altro` vuol dire che a decidere e' il nome.
String tipoDisegnabile(String? tipo, String nome) {
  final detto = (tipo ?? '').trim();
  if (detto != 'generic' && tipiDegliElettrodomestici.contains(detto)) {
    return detto;
  }
  return tipoDellElettrodomestico('$detto $nome');
}

/// Il disegno di un elettrodomestico, dal suo tipo.
class Elettrodomestico extends StatelessWidget {
  const Elettrodomestico(this.tipo, {super.key, this.lato = 24});

  /// Uno dei [tipiDegliElettrodomestici]; uno che non c'e' e' `generic`.
  final String tipo;
  final double lato;

  @override
  Widget build(BuildContext context) {
    final quale = tipiDegliElettrodomestici.contains(tipo) ? tipo : 'generic';
    return SvgPicture.asset(
      'assets/elettrodomestici/$quale.svg',
      width: lato,
      height: lato,
      placeholderBuilder: (_) => SizedBox(width: lato, height: lato),
    );
  }
}
