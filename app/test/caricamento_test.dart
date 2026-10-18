/// L'attesa della plancia e' una sola (schermate/caricamento.dart).
///
/// All'avvio si vedevano tre attese diverse: una rotella sola, «Casa · da
/// fuori · Apro la plancia…», e il velo della plancia dentro la pagina. Qui
/// si tiene fermo che l'app disegna lo stesso velo della plancia — e che le
/// sue misure sono ancora quelle scritte in `dashboard.html`: se cambia una
/// delle due, il passaggio torna a vedersi.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/schermate/caricamento.dart';
import 'package:gdahome/vestito/marchio.dart';

Widget _dentro(Widget figlio, {Brightness luce = Brightness.light}) =>
    MaterialApp(
      theme: ThemeData(brightness: luce),
      home: Scaffold(body: figlio),
    );

void main() {
  testWidgets('l\'attesa dell\'app ha il marchio di GdAHome, la rotella e '
      '«Caricamento…»: niente «DASHBOARDMODERN», niente «da fuori»', (
    tester,
  ) async {
    await tester.pumpWidget(
      _dentro(const CaricamentoDellaPlancia(fase: FaseDelCaricamento.apro)),
    );
    expect(find.text('DASHBOARDMODERN'), findsNothing);
    expect(find.byType(Marchio), findsOneWidget);
    expect(find.text('Caricamento…'), findsOneWidget);
    expect(find.byType(RotellaDellaPlancia), findsOneWidget);
    expect(find.byType(Image), findsOneWidget);
    expect(find.textContaining('da fuori'), findsNothing);
    expect(find.textContaining('plancia…'), findsNothing);
    /* Le misure del velo della plancia. */
    expect(tester.getSize(find.byType(Image)), const Size(76, 76));
    expect(
      tester.getSize(find.byType(RotellaDellaPlancia)),
      const Size(46, 46),
    );
  });

  testWidgets('il fondo e\' quello della plancia, chiaro e scuro', (
    tester,
  ) async {
    Color fondo() => tester
        .widget<ColoredBox>(
          find.descendant(
            of: find.byType(CaricamentoDellaPlancia),
            matching: find.byType(ColoredBox),
          ),
        )
        .color;
    await tester.pumpWidget(_dentro(const CaricamentoDellaPlancia()));
    expect(fondo(), const Color(0xFFE8EDF3));
    await tester.pumpWidget(
      _dentro(const CaricamentoDellaPlancia(), luce: Brightness.dark),
    );
    /* Il tema dell'app cambia sfumando: si aspetta che arrivi. */
    await tester.pump(const Duration(seconds: 1));
    expect(fondo(), const Color(0xFF0B1220));
  });

  testWidgets('sta al centro della pagina, non dello schermo: quello che '
      'resta sotto (i tasti di Android) si toglie', (tester) async {
    await tester.pumpWidget(
      _dentro(const CaricamentoDellaPlancia(inFondo: 48)),
    );
    final schermo = tester.getSize(find.byType(CaricamentoDellaPlancia));
    final rotella = tester.getCenter(find.byType(RotellaDellaPlancia));
    final senza = tester.getCenter(find.byType(Column));
    expect(senza.dy, closeTo((schermo.height - 48) / 2, 1));
    expect(rotella.dx, closeTo(schermo.width / 2, 0.5));
  });

  test('le misure sono ancora quelle del velo di dashboard.html', () {
    final pagina = File('../ponte/plancia/legacy/dashboard.html');
    if (!pagina.existsSync()) return;
    final testo = pagina.readAsStringSync();
    expect(testo, contains('#cd-boot-overlay{'));
    expect(testo, contains('background:#e8edf3'));
    expect(
      testo,
      contains('html[data-theme="dark"] #cd-boot-overlay{background:#0b1220}'),
    );
    expect(
      testo,
      contains(
        '#cd-boot-overlay img{width:76px;height:76px;border-radius:20px}',
      ),
    );
    expect(
      testo,
      contains('font-size:15px;letter-spacing:.09em;color:#0f172a'),
    );
    expect(
      testo,
      contains(
        '#cd-boot-overlay small{font-size:11.5px;color:#64748b;font-weight:700}',
      ),
    );
    expect(
      testo,
      contains(
        'width:38px;height:38px;border:4px solid rgba(14,165,233,.22);'
        'border-top-color:#0ea5e9;border-radius:50%;animation:cdBootSpin .8s',
      ),
    );
    expect(testo, contains('gap:14px'));
  });
}
