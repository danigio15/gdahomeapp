/// Le fotografie della pagina Premium **mentre arriva**: dal menu aperto
/// sopra l'Assistenza, come la si apre nell'app.
///
/// Non e' una prova: e' un attrezzo per **guardare**, come
/// `premium_foto.dart`. Il nome non finisce in `_test.dart`, e `flutter test`
/// da solo non lo prende. Si lancia a mano:
///
/// ```sh
/// cd app && flutter test --update-goldens test/foto/premium_transizione_foto.dart
/// ```
///
/// Le fotografie finiscono in `/home/user/render/gdahome-app/` (o dove dice
/// `GDAHOME_FOTO`), fuori dalla repository.
///
/// Per ogni sistema (`android`, `ios`) e ogni tema (`chiaro`, `scuro`) tre
/// scatti: a un quarto della corsa, a meta', e a pagina ferma. Il guasto si
/// vedeva proprio nel mezzo: la pagina che arrivava non aveva un fondo suo, e
/// sotto di lei si leggeva quella di prima, spostata di lato.
library;

import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/licenza/licenza.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/schermate/assistenza.dart';
import 'package:gdahome/schermate/barra.dart';
import 'package:gdahome/schermate/menu.dart';
import 'package:gdahome/schermate/premium.dart';
import 'package:gdahome/vestito/sfondo.dart';
import 'package:gdahome/vestito/tema.dart';

import '../licenza/gettoni_di_prova.dart';

final _cartella =
    Platform.environment['GDAHOME_FOTO'] ?? '/home/user/render/gdahome-app';

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
  final radice = Platform.environment['FLUTTER_ROOT'] ?? '/opt/sdk/flutter';
  final icone = File(
    '$radice/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf',
  );
  if (icone.existsSync()) {
    await (FontLoader('MaterialIcons')..addFont(
          icone.readAsBytes().then((byte) => byte.buffer.asByteData()),
        ))
        .load();
  }
}

final _sistemi = TargetPlatformVariant(const {
  TargetPlatform.android,
  TargetPlatform.iOS,
});

String get _sistema =>
    defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _iCaratteri();
  });

  const telefono = Size(390, 844);

  Future<Collegamento> casaPremium(WidgetTester tester) async {
    late Collegamento collegamento;
    await tester.runAsync(() async {
      final gettone = await firmaUnGettone(origine: 'regalo', perSempre: true);
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.apri();
      final casa = await archivio.aggiungi(
        nome: 'Casa',
        segno: 'segno',
        casaAlCentralino: casaDiProva,
        inCasa: IndirizzoDelPonte.leggi('192.168.1.50'),
      );
      await archivio.segnaIlGettone(casa.id, gettone);
      collegamento = Collegamento(
        archivio: archivio,
        licenza: GestoreLicenza(chiave: chiaveDiProva),
      );
      await collegamento.apri();
    });
    addTearDown(() => tester.runAsync(collegamento.chiudi));
    return collegamento;
  }

  for (final scuro in [false, true]) {
    final tema = scuro ? 'scuro' : 'chiaro';
    testWidgets('la pagina Premium mentre arriva, $tema', (tester) async {
      tester.view.physicalSize = Size(telefono.width * 2, telefono.height * 2);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      final collegamento = await casaPremium(tester);
      final menu = GlobalKey<BarraDelleSezioniState>();

      /* Come in `main.dart`: i due temi, e il fondo sotto tutto. Sopra, la
       * home con l'Assistenza aperta e il menu che le scivola sopra; la voce
       * «GdAHome Premium» apre la pagina come fa `home.dart`. */
      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: temaChiaro(),
          darkTheme: temaScuro(),
          themeMode: scuro ? ThemeMode.dark : ThemeMode.light,
          locale: const Locale('it'),
          supportedLocales: const [Locale('it'), Locale('en')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          builder: (context, schermata) =>
              SfondoVivo(child: schermata ?? const SizedBox.shrink()),
          home: Builder(
            builder: (context) => Scaffold(
              appBar: AppBar(title: Text(Sezione.assistenza.titolo)),
              body: Stack(
                children: [
                  SchermataDellAssistenza(
                    collegamento: collegamento,
                    diagnostica: () => const {},
                  ),
                  BarraDelleSezioni(
                    key: menu,
                    sezioni: vociDellaBarra(conPremium: true, conZigbee: true),
                    aperta: Sezione.assistenza,
                    vai: (dove) {
                      if (dove == Sezione.premium) {
                        apriLaPaginaPremium(context, collegamento);
                      }
                    },
                    vaiAlleCase: () {},
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      menu.currentState!.apri();
      for (var i = 0; i < 20; i += 1) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      final voce = find.text(Sezione.premium.titolo).last;
      await tester.ensureVisible(voce);
      await tester.pump(const Duration(milliseconds: 300));
      await tester.tap(voce);
      await tester.pump();

      Future<void> scatta(String quando) => expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/transizione-$_sistema-$tema-$quando.png'),
      );

      await tester.pump(const Duration(milliseconds: 120));
      await scatta('1-inizio');
      await tester.pump(const Duration(milliseconds: 130));
      await scatta('2-meta');
      for (var i = 0; i < 30; i += 1) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      await scatta('3-fine');
      /* Il menu ha un timer che lo richiude da solo: si lascia scadere. */
      await tester.pump(const Duration(seconds: 10));
    }, variant: _sistemi);
  }
}
