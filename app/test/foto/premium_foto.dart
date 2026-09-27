/// Le fotografie di gdahome Premium: la pagina, e i lucchetti dove stanno.
///
/// Non e' una prova: e' un attrezzo per **guardare**, come `menu_foto.dart`.
/// Il nome non finisce in `_test.dart`, e `flutter test` da solo non lo
/// prende. Si lancia a mano:
///
/// ```sh
/// cd app && flutter test --update-goldens test/foto/premium_foto.dart
/// ```
///
/// Le fotografie finiscono in `/home/user/render/gdahome-app/` (o dove dice
/// `GDAHOME_FOTO`), fuori dalla repository: non c'e' niente da confrontare.
///
/// Tutte con la **chiave di prova** delle licenze iniettata, perche' con la
/// chiave vuota — com'e' di serie — i lucchetti non ci sono proprio.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/casa/impostazioni.dart';
import 'package:gdahome/casa/la_guardia.dart';
import 'package:gdahome/licenza/licenza.dart';
import 'package:gdahome/plancia/servitore_qui/qui.dart';
import 'package:gdahome/ponte/filo.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/barra.dart';
import 'package:gdahome/schermate/da_parte.dart';
import 'package:gdahome/schermate/le_case.dart';
import 'package:gdahome/schermate/menu.dart';
import 'package:gdahome/schermate/plancia_vera.dart';
import 'package:gdahome/schermate/premium.dart';
import 'package:gdahome/vestito/sfondo.dart';
import 'package:gdahome/vestito/tema.dart';

import '../licenza/gettoni_di_prova.dart';
import '../ponte/ponte_finto.dart';

final _cartella =
    Platform.environment['GDAHOME_FOTO'] ?? '/home/user/render/gdahome-app';

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
      carica.addFont(
        file.readAsBytes().then((byte) => byte.buffer.asByteData()),
      );
    }
    await carica.load();
  }
  /* Le icone di Material, dalla cartella dell'SDK: flutter_tester non le ha,
   * e senza escono quadratini. */
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

/// La plancia vera non c'e' qui: un servitore che non si accende.
class _SenzaPlancia extends FabbricaDellaPlancia {
  @override
  Future<ServitoreDiQuestoSistema?> servitore(
    Filo? Function() filo, {
    String lingua = 'it',
  }) async => null;
}

Widget _lApp(Widget home) => MaterialApp(
  debugShowCheckedModeBanner: false,
  theme: temaChiaro(),
  darkTheme: temaScuro(),
  themeMode: ThemeMode.light,
  locale: const Locale('it'),
  supportedLocales: const [Locale('it'), Locale('en')],
  localizationsDelegates: const [
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  builder: (context, schermata) =>
      SfondoVivo(child: schermata ?? const SizedBox.shrink()),
  home: home,
);

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _iCaratteri();
  });

  const telefono = Size(390, 844);

  void quantoGrande(WidgetTester tester) {
    tester.view.physicalSize = Size(telefono.width * 3, telefono.height * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
  }

  Future<void> passa(WidgetTester tester, [int quanti = 30]) async {
    for (var i = 0; i < quanti; i += 1) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  Future<void> scatta(WidgetTester tester, String nome) => expectLater(
    find.byType(MaterialApp),
    matchesGoldenFile('$_cartella/$nome.png'),
  );

  /// Una casa senza filo: basta per la pagina Premium, che la casa non la
  /// chiama se non c'e'. Abbinata «alla vecchia», cosi' `apri` non bussa.
  Future<Collegamento> casaSenzaFilo(
    WidgetTester tester, {
    String? gettone,
  }) async {
    late Collegamento collegamento;
    await tester.runAsync(() async {
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.apri();
      final casa = await archivio.aggiungi(
        nome: 'Casa al lago',
        segno: 'segno',
        casaAlCentralino: casaDiProva,
        inCasa: IndirizzoDelPonte.leggi('192.168.1.50'),
      );
      await archivio.segnaIlGettone(casa.id, gettone ?? '');
      collegamento = Collegamento(
        archivio: archivio,
        licenza: GestoreLicenza(chiave: chiaveDiProva),
      );
      await collegamento.apri();
    });
    addTearDown(() => tester.runAsync(collegamento.chiudi));
    return collegamento;
  }

  testWidgets('la pagina Premium, da una casa Base', (tester) async {
    quantoGrande(tester);
    final collegamento = await casaSenzaFilo(tester);
    await tester.pumpWidget(
      _lApp(SchermataPremium(collegamento: collegamento, sulWeb: false)),
    );
    await passa(tester);
    await scatta(tester, 'premium-base');
  });

  testWidgets('la pagina Premium, da una casa Premium', (tester) async {
    quantoGrande(tester);
    late String gettone;
    await tester.runAsync(() async {
      gettone = await firmaUnGettone(
        origine: 'regalo',
        scade: DateTime(2027, 3, 12),
      );
    });
    final collegamento = await casaSenzaFilo(tester, gettone: gettone);
    expect(collegamento.licenza.premium, isTrue);
    await tester.pumpWidget(
      _lApp(SchermataPremium(collegamento: collegamento, sulWeb: false)),
    );
    await passa(tester);
    await scatta(tester, 'premium-attivo');
  });

  testWidgets('la pagina Premium nella webapp', (tester) async {
    quantoGrande(tester);
    final collegamento = await casaSenzaFilo(tester);
    await tester.pumpWidget(
      _lApp(SchermataPremium(collegamento: collegamento, sulWeb: true)),
    );
    await passa(tester);
    await scatta(tester, 'premium-web');
  });

  testWidgets('le case: la seconda col lucchetto, e dove porta', (
    tester,
  ) async {
    quantoGrande(tester);
    final collegamento = await casaSenzaFilo(tester);
    await tester.pumpWidget(
      _lApp(
        LeCase(
          collegamento: collegamento,
          aggiungiUnaCasa: () {},
          impostazioni: Impostazioni(
            sulTelefono: true,
            android: true,
            dispensa: DispensaInMemoria(),
          ),
          guardia: const NessunaGuardia(),
        ),
      ),
    );
    await passa(tester);
    await scatta(tester, 'le-case-seconda-col-lucchetto');
    await tester.tap(find.byType(FloatingActionButton));
    await passa(tester);
    await scatta(tester, 'premium-per-una-casa-in-piu');
  });

  testWidgets('fuori casa senza Premium', (tester) async {
    quantoGrande(tester);
    late Collegamento collegamento;
    await tester.runAsync(() async {
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.apri();
      final casa = await archivio.aggiungi(
        nome: 'Casa al lago',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        casaAlCentralino: casaDiProva,
        centralino: IndirizzoDelCentralino.leggi('wss://centralino.esempio.it'),
        inCasa: IndirizzoDelPonte.leggi('192.168.1.50'),
      );
      await archivio.segnaIlGettone(casa.id, '');
      collegamento = Collegamento(
        archivio: archivio,
        /* Nessuno risponde: si e' fuori casa. */
        sonda: Sonda(
          attesa: const Duration(milliseconds: 100),
          bussa: (_) async => false,
        ),
        licenza: GestoreLicenza(chiave: chiaveDiProva),
      );
      await collegamento.apri();
    });
    addTearDown(() => tester.runAsync(collegamento.chiudi));
    expect(collegamento.fuoriCasaSenzaPremium, isTrue);
    await tester.pumpWidget(
      _lApp(
        Scaffold(
          body: SafeArea(
            child: PlanciaVera(
              collegamento: collegamento,
              fabbrica: _SenzaPlancia(),
              impostazioni: Impostazioni(
                sulTelefono: true,
                android: true,
                dispensa: DispensaInMemoria(),
              ),
              vaiAlleCase: () {},
            ),
          ),
        ),
      ),
    );
    await passa(tester);
    await scatta(tester, 'fuori-casa-serve-premium');
  });

  testWidgets('il menu coi lucchetti, e le plance col lucchetto', (
    tester,
  ) async {
    quantoGrande(tester);
    late Collegamento collegamento;
    late PonteFinto ponte;
    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
      ponte.licenza = {
        'gdahome': {'attiva': false, 'scade': null, 'origine': null},
        'gettoni': <String, String>{},
      };
      ponte.unaPlanciaInPiu('Al mare', profilo: 'mare');
      ponte.unaPlanciaInPiu('Ufficio', profilo: 'ufficio');
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.apri();
      await archivio.aggiungi(
        nome: 'Casa al lago',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        casaAlCentralino: casaDiProva,
        inCasa: ponte.indirizzo,
      );
      collegamento = Collegamento(
        archivio: archivio,
        sonda: Sonda(
          attesa: const Duration(milliseconds: 300),
          bussa: (dove) async => dove == ponte.indirizzo.salute,
        ),
        licenza: GestoreLicenza(chiave: chiaveDiProva),
      );
      await collegamento.apri();
      final fine = DateTime.now().add(const Duration(seconds: 5));
      while ((!collegamento.pannelloLetto ||
              archivio.attiva?.gettone == null) &&
          DateTime.now().isBefore(fine)) {
        await Future<void>.delayed(const Duration(milliseconds: 20));
      }
    });
    addTearDown(
      () => tester.runAsync(() async {
        await collegamento.chiudi();
        await ponte.spegni();
      }),
    );
    expect(collegamento.plance, hasLength(3));
    expect(collegamento.licenza.premium, isFalse);

    final chiave = GlobalKey<BarraDelleSezioniState>();
    await tester.pumpWidget(
      _lApp(
        Scaffold(
          body: Stack(
            children: [
              BarraDelleSezioni(
                key: chiave,
                sezioni: vociDellaBarra(conZigbee: true, conPremium: true),
                bloccate: const {Sezione.configurazione, Sezione.zigbee},
                aperta: Sezione.plancia,
                vai: (_) {},
                vaiAlleCase: () {},
                collegamento: collegamento,
                daParte: const LaPlanciaDaParte(),
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pump();
    chiave.currentState!.apri();
    await passa(tester, 40);
    await scatta(tester, 'menu-con-i-lucchetti');

    await tester.tap(find.byIcon(Icons.unfold_more_rounded));
    await passa(tester, 20);
    await scatta(tester, 'plance-col-lucchetto');
  });
}
