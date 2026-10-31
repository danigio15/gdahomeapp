import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/licenza/conto_della_casa.dart';

void main() {
  test('il conto della casa e\' lo stesso che calcola il quadro', () async {
    /* Lo stesso numero sta in quadro/test/le-licenze.test.js
     * (CONTO_DI_PROVA). */
    expect(
      await contoDellaCasa('casa_00000000000000000000000000000000'),
      '5fdf9e6e-8349-4c1e-ab88-5760c721977f',
    );
    expect(await contoDellaCasa(''), isNull);
    expect(await contoDellaCasa(null), isNull);
  });
}
