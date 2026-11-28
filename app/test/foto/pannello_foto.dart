/// Le fotografie del menu del pannello a muro e delle sue pagine.
///
/// Come le altre di questa cartella non e' una prova: e' un attrezzo per
/// guardare, e il nome non finisce in `_test.dart`. Si lancia a mano:
///
/// ```sh
/// cd app && flutter test --update-goldens test/foto/pannello_foto.dart
/// ```
///
/// Il menu e' quello **vero** (`BarraDelleSezioni` con le voci del pannello,
/// `vociDellaBarra(sulMuro: true)`), e le pagine sono quelle vere
/// (`SchermataDelPannello`), con Android finto sul canale `gdahome/pannello`:
/// la rete, il segnale e la luminosita' di un NSPanel in casa.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/schermate/barra.dart';
import 'package:gdahome/schermate/da_parte.dart';
import 'package:gdahome/schermate/il_pannello.dart';
import 'package:gdahome/schermate/menu.dart';
import 'package:gdahome/vestito/quanto_e_largo.dart';
import 'package:gdahome/vestito/sfondo.dart';
import 'package:gdahome/vestito/tema.dart';

Future<void> _iCaratteri() async {
  const famiglie = {
    'Inter': ['400', '500', '600', '700', '800', '900'],
    'Oswald': ['200', '400', '700'],
  };
  for (final famiglia in famiglie.entries) {
    final carica = FontLoader(famiglia.key);
    for (final peso in famiglia.value) {
      final file = File('assets/carattere/${famiglia.key}-$peso.ttf');
      if (!file.existsSync()) continue;
      carica.addFont(file.readAsBytes().then((b) => b.buffer.asByteData()));
    }
    await carica.load();
  }
  final radice = Platform.environment['FLUTTER_ROOT'];
  if (radice == null || radice.isEmpty) return;
  final icone = File(
    '$radice/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf',
  );
  if (!icone.existsSync()) return;
  await (FontLoader(
    'MaterialIcons',
  )..addFont(icone.readAsBytes().then((b) => b.buffer.asByteData()))).load();
}

const _android = <String, Object?>{
  'ssid': 'Casadaniello',
  'collegato': true,
  'segnale': -50,
  'velocita': 72,
  'ip': '192.168.1.100',
  'luminosita': 178,
  'automatica': false,
  'puoScrivere': true,
  'volume': 6,
  'volumeMassimo': 15,
  'modello': 'NSPanel Pro 120',
  'produttore': 'SONOFF',
  'android': '8.1.0',
};

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _iCaratteri();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(const MethodChannel('gdahome/pannello'), (
          chiamata,
        ) async {
          if (chiamata.method == 'stato') return _android;
          return true;
        });
  });

  Collegamento laCasa() =>
      Collegamento(archivio: ArchivioDelleCase(CassaforteInMemoria()));

  void misura(WidgetTester tester, Size schermo) {
    tester.view.physicalSize = schermo * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
  }

  Widget conIlTema(Widget dentro) => MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: temaChiaro(),
    darkTheme: temaScuro(),
    themeMode: ThemeMode.light,
    home: SfondoVivo(child: dentro),
  );

  Future<void> passi(WidgetTester tester, [int quanti = 40]) async {
    for (var i = 0; i < quanti; i += 1) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  Future<void> ilMenu(WidgetTester tester, Size schermo, String nome) async {
    misura(tester, schermo);
    final chiave = GlobalKey<BarraDelleSezioniState>();
    await tester.pumpWidget(
      conIlTema(
        Scaffold(
          body: Stack(
            children: [
              BarraDelleSezioni(
                key: chiave,
                sezioni: vociDellaBarra(sulMuro: true),
                aperta: Sezione.plancia,
                vai: (_) {},
                vaiAlleCase: () {},
                collegamento: laCasa(),
                daAggiornare: 0,
                daParte: const LaPlanciaDaParte(),
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pump();
    chiave.currentState!.apri();
    await passi(tester);
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../../../collaudo/foto/pannello/$nome.png'),
    );
  }

  Future<void> laPagina(
    WidgetTester tester,
    Size schermo,
    Sezione parte,
    String nome,
  ) async {
    misura(tester, schermo);
    await tester.pumpWidget(
      conIlTema(
        /* Com'e' nell'app: la pagina in mezzo, larga quanto si legge
         * (`QuantoCiSta`, come la mette la home). */
        Scaffold(
          body: SafeArea(
            child: QuantoCiSta(
              child: SchermataDelPannello(
                collegamento: laCasa(),
                parte: parte,
                visibile: true,
              ),
            ),
          ),
        ),
      ),
    );
    await passi(tester, 20);
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../../../collaudo/foto/pannello/$nome.png'),
    );
  }

  const nspanel120 = Size(1280, 800);
  const nspanel86 = Size(480, 480);

  testWidgets(
    'il menu, NSPanel Pro 120',
    (t) => ilMenu(t, nspanel120, 'menu-120'),
  );
  testWidgets(
    'il menu, NSPanel Pro 86',
    (t) => ilMenu(t, nspanel86, 'menu-86'),
  );
  testWidgets(
    'Wi-Fi',
    (t) => laPagina(t, nspanel120, Sezione.wifiDelPannello, 'wifi-120'),
  );
  testWidgets(
    'Schermo',
    (t) => laPagina(t, nspanel120, Sezione.schermoDelPannello, 'schermo-120'),
  );
  testWidgets(
    'Suono',
    (t) => laPagina(t, nspanel120, Sezione.suonoDelPannello, 'suono-120'),
  );
  testWidgets(
    'Informazioni',
    (t) => laPagina(t, nspanel120, Sezione.ilPannello, 'informazioni-120'),
  );
  testWidgets(
    'Schermo, 86',
    (t) => laPagina(t, nspanel86, Sezione.schermoDelPannello, 'schermo-86'),
  );
}
