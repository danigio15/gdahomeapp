/* Le fasce attorno alla plancia prendono il fondo della plancia, non quello
 * del tema del telefono: «su iPhone c'e' quella barra bianca». Qui si tiene
 * fermo come si legge il colore che la pagina dice, e che la pagina lo dica. */
import 'dart:ui' show Color;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/il_fondo.dart';
import 'package:gdahome/plancia/premesse.dart';

void main() {
  test('il colore si legge come lo scrive getComputedStyle', () {
    expect(coloreDalCss('rgb(11, 18, 32)'), const Color(0xFF0B1220));
    expect(coloreDalCss('rgba(240, 244, 248, 1)'), const Color(0xFFF0F4F8));
    expect(coloreDalCss(' rgb(0,0,0) '), const Color(0xFF000000));
  });

  test('un fondo trasparente non e\' un fondo', () {
    expect(coloreDalCss('rgba(0, 0, 0, 0)'), isNull);
    expect(coloreDalCss('rgba(11, 18, 32, 0.5)'), isNull);
    expect(coloreDalCss('transparent'), isNull);
    expect(coloreDalCss(''), isNull);
    expect(coloreDalCss('#0b1220'), isNull);
  });

  test('la pagina dice il suo fondo sul canale del telefono', () {
    final servita = Premesse().conLePremesse(
      '<html><head></head><body></body></html>',
      ilWebSocket: 'WebSocket',
    );
    expect(servita, contains(ilFondoDellaPlanciaDice));
    expect(
      servita,
      contains('getComputedStyle(document.body).backgroundColor'),
    );
    /* In fondo al corpo, dopo gli stili della plancia. */
    expect(
      servita.indexOf(ilFondoDellaPlanciaDice),
      lessThan(servita.indexOf('</body>')),
    );
  });
}
