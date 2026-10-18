/// Ogni elettrodomestico il suo disegno: il forno non e' una lavatrice, e il
/// frigo non e' un termometro.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/vestito/elettrodomestici.dart';

void main() {
  test('dal nome, il tipo giusto', () {
    const attesi = {
      'Forno': 'oven',
      'Lavastoviglie': 'dishwasher',
      'Lavatrice': 'washer',
      'Asciugatrice': 'dryer',
      'Frigorifero': 'fridge',
      'Congelatore': 'fridge',
      'Pompa di calore': 'heat-pump',
      'Condizionatore camera': 'air-conditioner',
      'Clima soggiorno': 'air-conditioner',
      'Boiler': 'boiler',
      'Scaldabagno': 'boiler',
      'Wallbox': 'wallbox',
      'Auto elettrica': 'wallbox',
      'Piano cottura': 'cooktop',
      'Piano a induzione': 'cooktop',
      'Microonde': 'microwave',
      'Pompa piscina': 'pool-pump',
      'Presa studio': 'generic',
      'Qualcosa di strano': 'generic',
    };
    for (final MapEntry(key: nome, value: tipo) in attesi.entries) {
      expect(tipoDellElettrodomestico(nome), tipo, reason: nome);
    }
  });

  test('ogni tipo ha il suo disegno, e sono tutti diversi', () {
    final visti = <String>{};
    for (final tipo in tipiDegliElettrodomestici) {
      final file = File('assets/elettrodomestici/$tipo.svg');
      expect(file.existsSync(), isTrue, reason: tipo);
      expect(visti.add(file.readAsStringSync()), isTrue, reason: tipo);
    }
  });
}
