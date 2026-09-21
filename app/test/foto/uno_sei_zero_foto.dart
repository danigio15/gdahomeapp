/// Le fotografie delle schermate nuove della 1.6.0.
///
/// Non è una prova: è un attrezzo per **guardare**, come `menu_foto.dart`.
/// Per questo il nome non finisce in `_test.dart` — `flutter test` da solo non
/// lo prende, e non fa rosso il workflow per un carattere disegnato mezzo
/// punto più in là. Si lancia a mano:
///
/// ```sh
/// cd app && flutter test --update-goldens test/foto/uno_sei_zero_foto.dart
/// ```
///
/// Le fotografie finiscono in `collaudo/foto/1.6.0/`, che la repository non
/// tiene: non c'è niente da confrontare e niente che possa diventare rosso.
///
/// Dentro ci sono le due cose nuove dell'app: l'abbinamento Zigbee, dal tasto
/// al nome, e il lucchetto — il velo del riconoscimento e la sua scheda.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/casa/il_lucchetto.dart';
import 'package:gdahome/casa/impostazioni.dart';
import 'package:gdahome/casa/la_guardia.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/il_lucchetto.dart';
import 'package:gdahome/schermate/riconoscimento.dart';
import 'package:gdahome/vestito/sfondo.dart';
import 'package:gdahome/schermate/zigbee.dart';
import 'package:gdahome/vestito/tema.dart';

import '../ponte/ponte_finto.dart';

/// I caratteri veri dell'app, dal disco: senza, la fotografia esce col
/// carattere di riserva e non racconta l'app che esiste.
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

/// Una guardia che dice di sì e sa fare tutto: serve a far vedere la scheda
/// com'è su un telefono che il volto e l'impronta ce li ha.
class _GuardiaFinta implements LaGuardia {
  const _GuardiaFinta();

  @override
  Future<CosaSaFareIlTelefono> cosaSaFare() async => const CosaSaFareIlTelefono(
    sa: {ComeRiconosce.volto, ComeRiconosce.impronta},
    ceUnaGuardiaDelSistema: true,
  );

  @override
  Future<ComeEAndata> chiedi({required String perche}) async => ComeEAndata.si;
}

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _iCaratteri();
  });

  const telefono = Size(390, 844);

  void quantoGrande(WidgetTester tester, {bool scuro = false}) {
    tester.view.physicalSize = Size(telefono.width * 3, telefono.height * 3);
    tester.view.devicePixelRatio = 3;
    tester.platformDispatcher.platformBrightnessTestValue = scuro
        ? Brightness.dark
        : Brightness.light;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
  }

  Widget vestita(Widget dentro, {bool scuro = false}) => MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: temaChiaro(),
    darkTheme: temaScuro(),
    themeMode: scuro ? ThemeMode.dark : ThemeMode.light,
    home: SfondoVivo(child: dentro),
  );

  /// Un attimo di tempo **vero**, e poi si ridisegna.
  ///
  /// Serve al marchio: `Image.asset` decodifica il file in un'altra corsia, e
  /// dentro `testWidgets` il tempo è finto — lo scatto usciva col buco al
  /// posto del logo. Non è un guasto dell'app: è che qui l'orologio non gira
  /// se non glielo si dice.
  Future<void> ilMarchioSiCarica(WidgetTester tester) async {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 250)),
    );
    await tester.pump();
  }

  Future<void> scatta(WidgetTester tester, String dove) async {
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../../../collaudo/foto/1.6.0/$dove.png'),
    );
  }

  /* ─── Il lucchetto ─────────────────────────────────────────────────────── */

  testWidgets('il velo del riconoscimento', (tester) async {
    quantoGrande(tester);
    await tester.pumpWidget(
      vestita(
        Scaffold(
          body: IlVeloDelRiconoscimento(
            conCosa: const {ComeRiconosce.volto, ComeRiconosce.impronta},
            casa: 'Villa Rosa',
            quandoRiprova: () {},
          ),
        ),
      ),
    );
    /* A passi e non con `pumpAndSettle`: i due riquadri pulsano per sempre —
     * è quello che devono fare — e «aspetta che tutto si fermi» lì non
     * finisce mai. */
    for (var giro = 0; giro < 12; giro += 1) {
      await tester.pump(const Duration(milliseconds: 60));
    }
    await ilMarchioSiCarica(tester);
    await scatta(tester, 'lucchetto-velo');
  });

  testWidgets('la scheda del lucchetto, spenta', (tester) async {
    quantoGrande(tester);
    final impostazioni = Impostazioni(
      sulTelefono: true,
      android: true,
      dispensa: DispensaInMemoria(),
    );
    await impostazioni.carica();
    await tester.pumpWidget(
      vestita(
        SchermataDelLucchetto(
          impostazioni: impostazioni,
          guardia: const _GuardiaFinta(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await scatta(tester, 'lucchetto-scheda');
  });

  testWidgets('la scheda del lucchetto, acceso', (tester) async {
    quantoGrande(tester);
    final impostazioni = Impostazioni(
      sulTelefono: true,
      android: true,
      dispensa: DispensaInMemoria(),
    );
    await impostazioni.carica();
    await impostazioni.metti(
      lucchetto: const IlLucchetto(
        allAvvio: true,
        alRitorno: true,
        prima: IlLucchetto.daAccendereLaPrimaVolta,
      ),
    );
    await tester.pumpWidget(
      vestita(
        SchermataDelLucchetto(
          impostazioni: impostazioni,
          guardia: const _GuardiaFinta(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    /* Scorsa in fondo: i tre momenti e la promessa stanno sotto la piega, e
     * sono la metà che spiega cosa il lucchetto NON copre. */
    await tester.drag(find.byType(ListView), const Offset(0, -420));
    await tester.pumpAndSettle();
    await scatta(tester, 'lucchetto-scheda-sotto');
  });

  testWidgets('il foglietto prima di togliere una casa', (tester) async {
    quantoGrande(tester);
    await tester.pumpWidget(
      vestita(
        Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: FilledButton(
                onPressed: () => ilFoglietto(
                  context,
                  quale: PrimaDi.togliereUnaCasa,
                  conCosa: const {ComeRiconosce.volto, ComeRiconosce.impronta},
                  chiedi: () async => ComeEAndata.no,
                  cosa: 'Villa Rosa',
                ),
                child: const Text('apri'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.tap(find.text('apri'));
    for (var giro = 0; giro < 12; giro += 1) {
      await tester.pump(const Duration(milliseconds: 60));
    }
    await scatta(tester, 'lucchetto-foglietto');
  });

  /* ─── Zigbee ───────────────────────────────────────────────────────────── */
  //
  // Qui si fa girare il giro VERO, contro il ponte finto: si apre la rete, si
  // fa entrare un dispositivo, gli si dà un nome. Disegnare i quattro passi a
  // mano sarebbe più corto e racconterebbe un'altra app — questi scatti sono
  // la schermata che c'è, presa nei quattro momenti in cui ci si passa.

  Future<Collegamento> unaCasa(WidgetTester tester, PonteFinto ponte) async {
    late Collegamento collegamento;
    await tester.runAsync(() async {
      ponte.laReteZigbee = 'z2m';
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.aggiungi(
        nome: 'Villa Rosa',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: ponte.indirizzo,
      );
      collegamento = Collegamento(
        archivio: archivio,
        sonda: Sonda(bussa: (dove) async => dove == ponte.indirizzo.salute),
      );
      await collegamento.apri();
    });
    return collegamento;
  }

  Future<void> respira(WidgetTester tester, {int volte = 3}) async {
    for (var volta = 0; volta < volte; volta += 1) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 250)),
      );
      for (var giro = 0; giro < 8; giro += 1) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    }
  }

  Future<void> premi(WidgetTester tester, String cosa) async {
    await tester.ensureVisible(find.text(cosa));
    await tester.pump();
    await tester.tap(find.text(cosa));
  }

  testWidgets('Zigbee: i quattro passi', (tester) async {
    quantoGrande(tester);
    /* Nel tempo **vero**: alzare un server è rete vera, e dentro `testWidgets`
     * il tempo è finto — chiamato qui fuori questo non torna mai, e la prova
     * resta appesa fino a che non scade. */
    late PonteFinto ponte;
    await tester.runAsync(() async => ponte = await PonteFinto.alza());
    final collegamento = await unaCasa(tester, ponte);
    addTearDown(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });

    await tester.pumpWidget(
      vestita(
        Scaffold(
          body: SchermataZigbee(
            collegamento: collegamento,
            visibile: true,
            quandoVaMessoNellaPlancia: (_) {},
          ),
        ),
      ),
    );
    await tester.pump();
    await respira(tester);
    await ilMarchioSiCarica(tester);
    await scatta(tester, 'zigbee-1-porta');

    await premi(tester, 'Apri la rete');
    await respira(tester);
    await scatta(tester, 'zigbee-2-attesa');

    ponte.entratiInZigbee.add({
      'id': 'dev-1',
      'nome': 'TRADFRI bulb E27 CWS 806lm',
      'marca': 'IKEA',
      'modello': 'TRADFRI bulb E27',
      'tramite': 'mqtt',
      'entita': [
        {'entity': 'light.tradfri_bulb', 'classe': '', 'categoria': ''},
      ],
    });
    await respira(tester, volte: 6);
    await tester.enterText(find.byType(TextField), 'Lampadario cucina');
    await tester.pump();
    await scatta(tester, 'zigbee-3-nome');

    await premi(tester, 'Chiamalo così');
    await respira(tester);
    await scatta(tester, 'zigbee-4-fatto');
  });
}
