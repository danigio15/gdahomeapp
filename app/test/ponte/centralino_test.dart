/// Le prove del centralino di difetto.
///
/// Sembra una costante e non c'e' niente da provare. Invece qui c'e' gia'
/// stato un difetto che ha fatto perdere un pomeriggio, e non si vedeva da
/// nessuna parte: il pacchetto usciva **senza centralino pur avendone uno**, e
/// la differenza si scopriva solo installandolo, in strada, quando l'app
/// chiedeva un indirizzo di casa che chi e' fuori non puo' usare.
///
/// La causa: `--dart-define=CENTRALINO=` — vuoto ma definito. `fromEnvironment`
/// usa il proprio difetto solo quando la chiave **non e' stata definita
/// affatto**, e una casella lasciata vuota in un workflow la definisce
/// benissimo. Vuoto vuol dire «non detto», e adesso lo vuol dire anche qui.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/ponte/centralino.dart';
import 'package:gdahome/ponte/indirizzo.dart';

/// Cosa e' stato detto alla compilazione. Vuoto quando non e' stato detto
/// niente, che e' il caso normale — e quello in cui girano le prove.
const String _detto = String.fromEnvironment('CENTRALINO');

void main() {
  test('senza dire niente si usa quello scritto nel codice', () {
    /* La prova vale quando nessuno ha detto niente. Chi compila con un
     * centralino suo — `--dart-define=CENTRALINO=…` — sta provando un'altra
     * cosa, e questa prova non ha niente da dirgli. */
    if (_detto.isNotEmpty) {
      markTestSkipped('qui e\' stato detto «$_detto»');
      return;
    }
    expect(
      centralinoDiDifetto,
      IndirizzoDelCentralino.leggi(centralinoDiDifettoScritto),
      reason: 'un vuoto detto alla compilazione non deve cancellare il difetto',
    );
  });

  test('l\'app si abbina col solo codice quando un centralino c\'e\'', () {
    expect(siAbbinaColSoloCodice, centralinoDiDifetto != null);
    expect(
      siAbbinaColSoloCodice,
      centralinoDiDifettoScritto.isNotEmpty || _detto.isNotEmpty,
      reason: 'o e\' scritto nel codice, o e\' stato detto alla compilazione',
    );
  });

  test('quello scritto nel codice si legge come un indirizzo', () {
    /* Se un giorno ci finisse dentro qualcosa che non e' un indirizzo, l'app
     * si comporterebbe come se il centralino non ci fosse — cioe' chiederebbe
     * l'indirizzo di casa — senza dire niente a nessuno. */
    if (centralinoDiDifettoScritto.isEmpty) return;
    expect(
      IndirizzoDelCentralino.leggi(centralinoDiDifettoScritto),
      isNotNull,
      reason: '«$centralinoDiDifettoScritto» non si legge come un indirizzo',
    );
  });
}
