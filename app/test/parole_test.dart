/// Le parole che cambiano col numero.
///
/// Una prova di due righe per una cosa di una riga, e ci sta: «1 volte» non
/// l'ha scritto nessuno a mano, l'ha composto un contatore, ed e' il genere di
/// sbaglio che nessuno rilegge piu' — si vede solo a schermo, nel momento in
/// cui quel numero fa uno.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/parole.dart';

void main() {
  test('una volta e\' una, e le altre sono volte', () {
    expect(volte(1), '1 volta');
    expect(volte(0), '0 volte');
    expect(volte(2), '2 volte');
    expect(volte(31), '31 volte');
  });
}
