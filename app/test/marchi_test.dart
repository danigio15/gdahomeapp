/// Le prove dei marchi delle auto.
///
/// La piu' utile e' l'ultima: **ogni marca dell'elenco deve avere il suo file**
/// dentro il ponte. Un nome in piu' qui, senza il logo di la', e' un riquadro
/// con dentro due lettere in mezzo a trentasei loghi — e nessuno se ne accorge
/// finche' non apre la griglia.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/plancia/marchi.dart';

void main() {
  test('la marca si riconosce comunque la si scriva', () {
    /* Chi l'aveva battuta a mano deve ritrovare la sua: senza accenti, senza
     * maiuscole, con o senza il trattino. */
    expect(marcaDaScritta('Leapmotor')?.id, 'leapmotor');
    expect(marcaDaScritta('leapmotor')?.id, 'leapmotor');
    expect(marcaDaScritta('Škoda')?.id, 'skoda');
    expect(marcaDaScritta('skoda')?.id, 'skoda');
    expect(marcaDaScritta('Citroen')?.id, 'citroen');
    expect(marcaDaScritta('Citroën')?.id, 'citroen');
    expect(marcaDaScritta('alfa romeo')?.id, 'alfa-romeo');
    expect(marcaDaScritta('Alfa-Romeo')?.id, 'alfa-romeo');
    expect(marcaDaScritta('mercedes benz')?.id, 'mercedes-benz');
  });

  test('quello che non e\' una marca non lo diventa', () {
    expect(marcaDaScritta(''), isNull);
    expect(marcaDaScritta('   '), isNull);
    expect(marcaDaScritta('la mia macchina'), isNull);
  });

  test('le iniziali si leggono quando il logo non arriva', () {
    expect(marcaDaScritta('Alfa Romeo')?.iniziali, 'AR');
    expect(marcaDaScritta('BMW')?.iniziali, 'B');
    expect(marcaDaScritta('Mercedes-Benz')?.iniziali, 'MB');
  });

  test('ogni marca ha il suo logo dentro il ponte', () {
    /* Leapmotor e' l'eccezione, ed e' dichiarata: il suo marchio non sta nel
     * pacchetto da cui vengono gli altri, e nella plancia e' disegnato a mano.
     * Qui si disegna uguale, tratto per tratto. */
    final cartella = Directory('../ponte/plancia/brands');
    if (!cartella.existsSync()) return;
    final ceLHa = {
      for (final uno in cartella.listSync())
        uno.uri.pathSegments.last.replaceAll('.svg', ''),
    };
    final senza = [
      for (final una in leMarcheDelleAuto)
        if (una.id != 'leapmotor' && !ceLHa.contains(una.id)) una.id,
    ];
    expect(senza, isEmpty, reason: 'marche senza logo: $senza');

    /* E il contrario: un logo che sta nel ponte e non e' in elenco non lo
     * sceglie nessuno. */
    final tutte = {for (final una in leMarcheDelleAuto) una.id};
    expect(ceLHa.difference(tutte), isEmpty);
  });

  test('le sagome sono le otto della plancia', () {
    expect(leSagomeDellAuto.map((una) => una.id).toList(), [
      'electric',
      'car',
      'sports',
      'hatchback',
      'estate',
      'pickup',
      'convertible',
      'wagon',
    ]);
  });
}
