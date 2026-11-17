/// Le fotografie dell'attesa (`schermate/caricamento.dart`), fotogramma per
/// fotogramma.
///
/// Non e' una prova: e' un attrezzo per **guardare**, come `premium_foto.dart`.
/// Il nome non finisce in `_test.dart`, e `flutter test` da solo non lo
/// prende. Si lancia a mano:
///
/// ```sh
/// cd app && GDAHOME_FOTO=/una/cartella flutter test test/foto/caricamento_foto.dart
/// ```
///
/// Escono, in `GDAHOME_FOTO` (di serie `/home/user/render/gdahome-app/`,
/// fuori dalla repository):
///
///  - `caricamento-<telefono|tablet>-<chiaro|scuro>-<momento>.png`: i
///    fotogrammi chiave — il primo, a meta' dell'entrata, pieno, la riga dopo
///    qualche secondo, l'uscita verso la plancia;
///  - `caricamento-<...>-fermo.png`: con «riduci animazioni»;
///  - `prima-<telefono|tablet>-<chiaro|scuro>.png`: com'era, per confronto
///    (il velo della plancia, che era quello che si vedeva piu' a lungo);
///  - `fotogrammi/<telefono|tablet>-<chiaro|scuro>/NNN.png`: venti al secondo,
///    per farne un filmato (`ffmpeg`).
///
/// Il nome della casa e' inventato: «Casa Rossi».
library;

import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/schermate/caricamento.dart';
import 'package:gdahome/vestito/marchio.dart';
import 'package:gdahome/vestito/tema.dart';

final _cartella =
    Platform.environment['GDAHOME_FOTO'] ?? '/home/user/render/gdahome-app';

const _nome = 'Casa Rossi';

Future<void> _iCaratteri() async {
  const famiglie = {
    'Inter': ['400', '500', '600', '700', '800', '900'],
  };
  for (final famiglia in famiglie.entries) {
    final carica = FontLoader(famiglia.key);
    for (final peso in famiglia.value) {
      final file = File('assets/carattere/${famiglia.key}-$peso.ttf');
      if (!file.existsSync()) continue;
      carica.addFont(
        file.readAsBytes().then((byte) => byte.buffer.asByteData()),
      );
    }
    await carica.load();
  }
}

/// Dove si guarda: un telefono in piedi e un tablet a muro, sdraiato.
const _schermi = {
  'telefono': (lato: Size(390, 844), densita: 3.0, filmato: 2.0),
  'tablet': (lato: Size(1280, 800), densita: 1.5, filmato: 1.0),
};

/// Una plancia finta, sotto l'attesa, per vedere l'uscita.
class _PlanciaSotto extends StatelessWidget {
  const _PlanciaSotto({required this.scuro});
  final bool scuro;

  @override
  Widget build(BuildContext context) {
    final fondo = scuro ? const Color(0xFF0B1220) : const Color(0xFFE8EDF3);
    final tessera = scuro ? const Color(0xFF16213A) : Colors.white;
    final testo = scuro ? const Color(0xFFE2E8F0) : const Color(0xFF0F172A);
    return ColoredBox(
      color: fondo,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Casa Rossi',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  color: testo,
                ),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: GridView.count(
                  crossAxisCount: 3,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    for (var i = 0; i < 12; i += 1)
                      DecoratedBox(
                        decoration: BoxDecoration(
                          color: tessera,
                          borderRadius: BorderRadius.circular(18),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Com'era: il velo della plancia (`#cd-boot-overlay` in `dashboard.html`),
/// ridisegnato con le sue misure — il marchio a 76, il nome, la rotella
/// azzurra, «Caricamento…».
class _ComeEraPrima extends StatelessWidget {
  const _ComeEraPrima({required this.scuro});
  final bool scuro;

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: scuro ? const Color(0xFF0B1220) : const Color(0xFFE8EDF3),
    child: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Marchio(lato: 76),
          const SizedBox(height: 14),
          Text(
            _nome.toUpperCase(),
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 15,
              letterSpacing: 1.35,
              fontWeight: FontWeight.w900,
              color: scuro ? const Color(0xFFE2E8F0) : const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 14),
          const SizedBox.square(
            dimension: 46,
            child: CustomPaint(painter: _RotellaDiPrima()),
          ),
          const SizedBox(height: 14),
          const Text(
            'Caricamento…',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: Color(0xFF64748B),
            ),
          ),
        ],
      ),
    ),
  );
}

class _RotellaDiPrima extends CustomPainter {
  const _RotellaDiPrima();
  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = (size.shortestSide - 4) / 2;
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4;
    canvas.drawCircle(c, r, p..color = const Color(0x380EA5E9));
    canvas.drawArc(
      Rect.fromCircle(center: c, radius: r),
      math.pi / 4,
      math.pi / 2,
      false,
      p..color = const Color(0xFF0EA5E9),
    );
  }

  @override
  bool shouldRepaint(_RotellaDiPrima oldDelegate) => false;
}

/// Il banco: la plancia finta sotto, l'attesa sopra, che se ne va quando
/// [su] diventa falso.
Widget _banco({
  required GlobalKey cornice,
  required bool scuro,
  required bool su,
  bool fermo = false,
  Widget? alPosto,
}) {
  return RepaintBoundary(
    key: cornice,
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: temaChiaro(),
      darkTheme: temaScuro(),
      themeMode: scuro ? ThemeMode.dark : ThemeMode.light,
      builder: (context, figlio) => MediaQuery(
        data: MediaQuery.of(context).copyWith(disableAnimations: fermo),
        child: figlio!,
      ),
      home: Scaffold(
        body:
            alPosto ??
            Stack(
              fit: StackFit.expand,
              children: [
                _PlanciaSotto(scuro: scuro),
                UscitaDelCaricamento(
                  su: su,
                  child: const CaricamentoDellaPlancia(
                    fase: FaseDelCaricamento.apro,
                    nome: _nome,
                  ),
                ),
              ],
            ),
      ),
    ),
  );
}

Future<void> _scatta(
  WidgetTester tester,
  GlobalKey cornice,
  String file,
  double densita,
) async {
  final quadro =
      cornice.currentContext!.findRenderObject()! as RenderRepaintBoundary;
  final byte = await tester.runAsync(() async {
    final immagine = await quadro.toImage(pixelRatio: densita);
    final png = await immagine.toByteData(format: ui.ImageByteFormat.png);
    immagine.dispose();
    return png!.buffer.asUint8List();
  });
  File(file)
    ..parent.createSync(recursive: true)
    ..writeAsBytesSync(byte!);
}

/// Il marchio e' un'immagine: si decodifica fuori dal tempo finto.
Future<void> _leImmagini(WidgetTester tester) async {
  await tester.runAsync(() async {
    for (final elemento in find.byType(Image).evaluate()) {
      final immagine = elemento.widget as Image;
      await precacheImage(immagine.image, elemento);
    }
    await Future<void>.delayed(const Duration(milliseconds: 200));
  });
  await tester.pump();
}

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _iCaratteri();
  });

  for (final schermo in _schermi.entries) {
    for (final scuro in [false, true]) {
      final luce = scuro ? 'scuro' : 'chiaro';
      final dove = '${schermo.key}-$luce';

      testWidgets('l\'attesa, $dove', (tester) async {
        final lato = schermo.value.lato;
        tester.view.physicalSize = lato * 2;
        tester.view.devicePixelRatio = 2;
        addTearDown(tester.view.reset);
        final cornice = GlobalKey();

        /* Prima: com'era. */
        await tester.pumpWidget(
          _banco(
            cornice: cornice,
            scuro: scuro,
            su: true,
            alPosto: _ComeEraPrima(scuro: scuro),
          ),
        );
        await _leImmagini(tester);
        await tester.pump(const Duration(seconds: 1));
        await _scatta(
          tester,
          cornice,
          '$_cartella/prima-$dove.png',
          schermo.value.densita,
        );

        /* L'attesa ferma, con «riduci animazioni». */
        ripartiLAttesa();
        await tester.pumpWidget(
          _banco(cornice: cornice, scuro: scuro, su: true, fermo: true),
        );
        await _leImmagini(tester);
        await tester.pump(const Duration(milliseconds: 600));
        await _scatta(
          tester,
          cornice,
          '$_cartella/caricamento-$dove-fermo.png',
          schermo.value.densita,
        );
        await tester.pumpWidget(const SizedBox());
        await tester.pump(const Duration(seconds: 1));

        /* L'attesa vera, dal primo fotogramma. Il marchio si decodifica
         * prima, in un'attesa che poi si butta: da li' e' in memoria. */
        await tester.pumpWidget(
          _banco(cornice: cornice, scuro: scuro, su: true),
        );
        await _leImmagini(tester);
        await tester.pumpWidget(const SizedBox());
        await tester.pump(const Duration(seconds: 1));
        ripartiLAttesa();
        await tester.pumpWidget(
          _banco(cornice: cornice, scuro: scuro, su: true),
        );

        /* Trenta fotogrammi al secondo, per quattro secondi e due decimi;
         * i fotogrammi chiave nei momenti dello spettacolo. */
        const chiave = {
          0: '0-inizio',
          9: '1-la-g-si-scrive',
          19: '2-la-d-e-la-a',
          27: '3-iniziali-scritte',
          33: '4-si-fondono',
          39: '5-lampo',
          48: '6-finestre',
          75: '7-pieno',
          96: '8-mi-collego',
        };
        const passo = Duration(microseconds: 33333);
        var n = 0;
        Future<void> fotogramma() => _scatta(
          tester,
          cornice,
          '$_cartella/fotogrammi/$dove/${(n++).toString().padLeft(3, '0')}.png',
          schermo.value.filmato,
        );
        for (var i = 0; i <= 126; i += 1) {
          if (i > 0) await tester.pump(passo);
          if (chiave.containsKey(i)) {
            await _scatta(
              tester,
              cornice,
              '$_cartella/caricamento-$dove-${chiave[i]}.png',
              schermo.value.densita,
            );
          }
          await fotogramma();
        }

        /* E se ne va: la plancia arriva, e l'attesa si apre in un cerchio. */
        await tester.pumpWidget(
          _banco(cornice: cornice, scuro: scuro, su: false),
        );
        await fotogramma();
        for (var i = 1; i <= 24; i += 1) {
          await tester.pump(passo);
          if (i == 7) {
            await _scatta(
              tester,
              cornice,
              '$_cartella/caricamento-$dove-9-uscita.png',
              schermo.value.densita,
            );
          }
          await fotogramma();
        }
        await _scatta(
          tester,
          cornice,
          '$_cartella/caricamento-$dove-10-plancia.png',
          schermo.value.densita,
        );
        expect(find.byType(CaricamentoDellaPlancia), findsNothing);

        /* E se l'attesa dura: torna su (una pagina che si ricarica) e si
         * aspetta fino a «Quasi pronto…». */
        await tester.pumpWidget(
          _banco(cornice: cornice, scuro: scuro, su: true),
        );
        await tester.pump();
        for (var i = 0; i < 30; i += 1) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        await _scatta(
          tester,
          cornice,
          '$_cartella/caricamento-$dove-11-quasi-pronto.png',
          schermo.value.densita,
        );
        await tester.pumpWidget(const SizedBox());
        await tester.pump(const Duration(seconds: 1));
      });
    }
  }
}
