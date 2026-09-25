/// Le fotografie dell'unione con gdanav: com'e' l'app oggi e come sara'.
///
/// Non e' una prova, come `aggiornamenti_foto.dart`: e' un attrezzo per
/// guardare. Si lancia a mano:
///
/// ```sh
/// cd app && flutter test --update-goldens test/foto/unione_foto.dart
/// ```
///
/// e le fotografie finiscono in `collaudo/foto/unione/`, che la repository
/// non tiene. Le schermate sono quelle vere — la barra, i caratteri, i
/// disegni, gdanav — tranne due cose che sul banco non ci sono: la plancia,
/// che e' una pagina web e qui e' la sua fotografia (`docs/immagini`), e la
/// mappa, che e' nativa e qui e' un disegno di strade.
library;

import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;
import 'dart:ui' show AccessibilityFeatures;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show EventChannel, FontLoader;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/barra.dart';
import 'package:gdahome/schermate/comandi_in_auto.dart';
import 'package:gdahome/schermate/menu.dart';
import 'package:gdahome/schermate/navigatore_qui/qui.dart';
import 'package:gdahome/vestito/tema.dart';
import 'package:gdanav_app/gdanav_app.dart';
import 'package:gdanav_app/schermate/fonte_gdahome.dart';
import 'package:gdanav_app/stato/archivio.dart';
import 'package:gdanav_app/stato/gestore_auto.dart';
import 'package:gdanav_app/stato/gestore_consumo.dart';
import 'package:gdanav_app/stato/gestore_guida.dart';
import 'package:gdanav_app/stato/gestore_posizione.dart';
import 'package:gdanav_app/stato/gestore_viaggio.dart';
import 'package:gdanav_app/stato/voce.dart';
import 'package:gdanav_app/tema.dart';

import '../ponte/ponte_finto.dart';

class _SenzaMovimento implements AccessibilityFeatures {
  const _SenzaMovimento();
  @override
  bool get accessibleNavigation => false;
  @override
  bool get boldText => false;
  @override
  bool get disableAnimations => true;
  @override
  bool get highContrast => false;
  @override
  bool get invertColors => false;
  @override
  bool get onOffSwitchLabels => false;
  @override
  bool get reduceMotion => true;
  @override
  bool get autoPlayAnimatedImages => false;
  @override
  bool get autoPlayVideos => false;
  @override
  bool get deterministicCursor => false;
  @override
  bool get supportsAnnounce => false;
}

Future<void> _iCaratteri() async {
  final famiglie = {
    'Inter': ['400', '500', '600', '700', '800', '900'],
    'Oswald': ['200', '400', '700'],
  };
  for (final famiglia in famiglie.entries) {
    final carica = FontLoader(famiglia.key);
    for (final peso in famiglia.value) {
      carica.addFont(
        File('assets/carattere/${famiglia.key}-$peso.ttf')
            .readAsBytes()
            .then((b) => b.buffer.asByteData()),
      );
    }
    await carica.load();
  }
  final radice = Platform.environment['FLUTTER_ROOT'] ?? '';
  /* gdanav scrive in Roboto, come Android: quello del motore di Flutter. */
  final roboto = FontLoader('Roboto');
  for (final nome in ['Roboto-Regular', 'Roboto-Medium']) {
    final f = File(
      '$radice/engine/src/flutter/txt/third_party/fonts/$nome.ttf',
    );
    if (f.existsSync()) {
      roboto.addFont(f.readAsBytes().then((b) => b.buffer.asByteData()));
    }
  }
  await roboto.load();
  final icone = File(
    '$radice/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf',
  );
  if (icone.existsSync()) {
    await (FontLoader(
      'MaterialIcons',
    )..addFont(icone.readAsBytes().then((b) => b.buffer.asByteData()))).load();
  }
}

class _VoceZitta implements Voce {
  @override
  Future<void> parla(String frase) async {}
  @override
  Future<void> zitta() async {}
}

/* ── La mappa: un disegno di strade al posto di quella nativa ────────── */

class _Strade extends CustomPainter {
  const _Strade();

  @override
  void paint(Canvas tela, Size s) {
    tela.drawRect(Offset.zero & s, Paint()..color = const Color(0xFFEDF1F4));
    final verde = Paint()..color = const Color(0xFFD5EDDC);
    tela.drawRRect(
      RRect.fromLTRBR(40, 380, 170, 470, const Radius.circular(14)),
      verde,
    );
    tela.drawRRect(
      RRect.fromLTRBR(250, 560, 370, 650, const Radius.circular(14)),
      verde,
    );
    final acqua = Paint()..color = const Color(0xFFCFE3F3);
    tela.drawPath(
      Path()
        ..moveTo(0, 700)
        ..quadraticBezierTo(180, 660, s.width, 740)
        ..lineTo(s.width, 790)
        ..quadraticBezierTo(180, 710, 0, 750)
        ..close(),
      acqua,
    );
    void strada(List<Offset> p, double w, [Color c = Colors.white]) {
      final path = Path()..moveTo(p.first.dx, p.first.dy);
      for (final q in p.skip(1)) {
        path.lineTo(q.dx, q.dy);
      }
      tela.drawPath(
        path,
        Paint()
          ..color = c
          ..style = PaintingStyle.stroke
          ..strokeWidth = w
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round,
      );
    }

    strada([const Offset(-20, 330), Offset(s.width + 20, 280)], 20);
    strada([const Offset(90, -20), const Offset(150, 900)], 14);
    strada([const Offset(300, -20), const Offset(255, 900)], 12);
    strada([const Offset(-20, 560), Offset(s.width + 20, 600)], 10);
    strada([const Offset(-20, 180), Offset(s.width + 20, 210)], 8);
    strada(
      const [
        Offset(140, 640),
        Offset(128, 520),
        Offset(200, 510),
        Offset(262, 520),
        Offset(270, 420),
        Offset(282, 300),
        Offset(296, 210),
      ],
      7,
      const Color(0xFF1E88E5),
    );
    tela.drawCircle(
      const Offset(296, 210),
      9,
      Paint()..color = const Color(0xFFE53935),
    );
    tela.drawCircle(const Offset(140, 640), 13, Paint()..color = Colors.white);
    tela.drawPath(
      Path()
        ..moveTo(140, 630)
        ..lineTo(148, 650)
        ..lineTo(140, 645)
        ..lineTo(132, 650)
        ..close(),
      Paint()..color = const Color(0xFF1E88E5),
    );
  }

  @override
  bool shouldRepaint(_Strade vecchio) => false;
}

/* ── gdanav vero, coi gestori veri e la mappa disegnata ──────────────── */

Future<GdanavApp> _gdanav(WidgetTester tester, SorgenteGdahome? casa) async {
  FlutterSecureStorage.setMockInitialValues({});
  /* Android Auto sul banco non c'e': collegato ma zitto. */
  tester.binding.defaultBinaryMessenger.setMockStreamHandler(
    const EventChannel('gdanav/auto'),
    MockStreamHandler.inline(onListen: (_, _) {}),
  );
  final archivio = Archivio();
  final auto = GestoreAuto(archivio: archivio, gdahome: casa);
  await tester.runAsync(auto.avvia);
  final consumo = GestoreConsumo(archivio);
  await tester.runAsync(() => consumo.carica(auto.veicolo.id));
  final viaggio = GestoreViaggio(
    archivio: archivio,
    auto: auto,
    consumo: consumo,
    posizione: () async => null,
  );
  final guida = GestoreGuida(
    viaggio: viaggio,
    auto: auto,
    posizioni: () => const Stream.empty(),
    voce: _VoceZitta(),
    consumo: consumo,
  );
  final posizione = GestorePosizione(
    archivio: archivio,
    letture: () => const Stream.empty(),
  );
  await tester.runAsync(posizione.carica);
  return GdanavApp(
    archivio: archivio,
    auto: auto,
    viaggio: viaggio,
    guida: guida,
    posizione: posizione,
    consumo: consumo,
    mappa: (_, _) => const CustomPaint(painter: _Strade(), size: Size.infinite),
  );
}

SorgenteGdahome _laZoe() => SorgenteGdahome()
  ..descrivi(
    const AutoDiGdahome(
      nome: 'La Zoe',
      marca: 'Renault',
      modello: 'Zoe R135',
      kwh: 52,
    ),
  )
  ..collegamento(true)
  ..manda(
    StatoAuto(
      sorgente: TipoSorgente.gdahome,
      letto: DateTime.now(),
      batteria: 72,
      autonomiaKm: 250,
      inCarica: false,
      temperaturaEsternaC: 19,
    ),
  );

/* ── La plancia: la sua fotografia ───────────────────────────────────── */

const _laPlancia = '../docs/immagini/1-la-plancia.png';

/* Decodificata una volta, all'inizio, nel tempo vero: dentro una prova il
 * tempo e' finto e un'immagine da disco non arriverebbe mai. */
late ui.Image _plancia;

Widget _sfondo() => Positioned.fill(
  child: RawImage(
    image: _plancia,
    fit: BoxFit.cover,
    alignment: Alignment.topCenter,
  ),
);

/* ── Le fotografie ───────────────────────────────────────────────────── */

void main() {
  late PonteFinto ponte;
  late Collegamento collegamento;

  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _iCaratteri();
    final codec = await ui.instantiateImageCodec(
      File(_laPlancia).readAsBytesSync(),
    );
    _plancia = (await codec.getNextFrame()).image;
  });

  Future<void> unaCasa(WidgetTester tester) async {
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const _SenzaMovimento();
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.aggiungi(
        nome: 'Casa',
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
    addTearDown(() async {
      await tester.runAsync(() async {
        await collegamento.chiudi();
        await ponte.spegni();
      });
    });
  }

  Future<void> laFoto(WidgetTester tester, String nome) async {
    /* Le immagini da disco arrivano nel tempo vero. */
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 400)),
    );
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    await expectLater(
      find.byKey(const ValueKey('foto')),
      matchesGoldenFile('../../../collaudo/foto/unione/$nome.png'),
    );
  }

  Widget telefono(Widget dentro, {ThemeData? tema}) => MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: tema ?? temaChiaro(),
    home: RepaintBoundary(key: const ValueKey('foto'), child: dentro),
  );

  testWidgets('oggi: il menu di gdahome', (tester) async {
    await unaCasa(tester);
    final chiave = GlobalKey<BarraDelleSezioniState>();
    await tester.pumpWidget(
      telefono(
        Scaffold(
          body: Stack(
            children: [
              _sfondo(),
              BarraDelleSezioni(
                key: chiave,
                /* Come su main: senza il navigatore. */
                sezioni: vociDellaBarra(conZigbee: true)
                    .where((s) => s != Sezione.navigatore)
                    .toList(),
                aperta: Sezione.plancia,
                vai: (_) {},
                vaiAlleCase: () {},
                collegamento: collegamento,
                daAggiornare: 2,
                sopraLaPlancia: true,
              ),
            ],
          ),
        ),
      ),
    );
    chiave.currentState!.apri();
    await laFoto(tester, 'oggi-menu');
  });

  /// La barra vera, aperta, con la tessera vera di gdanav.
  Widget laBarra({required bool sulNavigatore}) {
    final chiave = GlobalKey<BarraDelleSezioniState>();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => chiave.currentState?.apri(),
    );
    return BarraDelleSezioni(
      key: chiave,
      sezioni: vociDellaBarra(conZigbee: true),
      aperta: sulNavigatore ? Sezione.navigatore : Sezione.plancia,
      vai: (_) {},
      vaiAlleCase: () {},
      collegamento: collegamento,
      daAggiornare: 2,
      sopraLaPlancia: !sulNavigatore,
      tessera: laTesseraDelNavigatore(
        scelta: sulNavigatore,
        apri: () {},
        impostazioni: () {},
        fonte: _laZoe(),
      ),
    );
  }

  testWidgets('domani: il menu ridisegnato, con gdanav', (tester) async {
    await unaCasa(tester);
    await tester.pumpWidget(
      telefono(
        Scaffold(
          body: Stack(children: [_sfondo(), laBarra(sulNavigatore: false)]),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await laFoto(tester, 'domani-menu');
  });

  testWidgets('oggi: gdanav da solo', (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    tester.view.padding = const FakeViewPadding(top: 141, bottom: 60);
    final app = await _gdanav(tester, null);
    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: temaGdanav(Brightness.light),
        home: RepaintBoundary(
          key: const ValueKey('foto'),
          child: app.schermata(),
        ),
      ),
    );
    await laFoto(tester, 'oggi-gdanav');
  });

  testWidgets('domani: gdanav dentro gdahome, con l\'auto della plancia', (
    tester,
  ) async {
    await unaCasa(tester);
    tester.view.padding = const FakeViewPadding(top: 141, bottom: 60);
    final app = await _gdanav(tester, _laZoe());
    /* A tutto schermo, come la plancia: il ☰ di gdanav apre la barra di
     * gdahome, come fanno i tre trattini della plancia. */
    await tester.pumpWidget(telefono(Scaffold(body: GdanavDentro(app: app))));
    await laFoto(tester, 'domani-gdanav');
  });

  testWidgets('domani: la barra di gdahome aperta sopra gdanav', (
    tester,
  ) async {
    await unaCasa(tester);
    tester.view.padding = const FakeViewPadding(top: 141, bottom: 60);
    final app = await _gdanav(tester, _laZoe());
    await tester.pumpWidget(
      telefono(
        Scaffold(
          body: Stack(
            children: [
              Positioned.fill(child: GdanavDentro(app: app)),
              laBarra(sulNavigatore: true),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await laFoto(tester, 'domani-gdanav-menu');
  });

  testWidgets('domani: la fonte gdahome, dentro gdanav', (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final app = await _gdanav(tester, _laZoe());
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 100)),
    );
    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: temaGdanav(Brightness.light),
        home: RepaintBoundary(
          key: const ValueKey('foto'),
          child: Scaffold(
            body: SafeArea(child: FonteGdahome(gestore: app.auto)),
          ),
        ),
      ),
    );
    await laFoto(tester, 'domani-gdanav-fonte');
  });

  testWidgets('domani: i comandi rapidi in auto', (tester) async {
    await unaCasa(tester);
    ponte.entita = [
      _ent('cover.cancello', 'Cancello', classe: 'gate', stato: 'closed'),
      _ent('cover.box', 'Garage', classe: 'garage', stato: 'closed'),
      _ent('scene.arrivo', 'Arrivo a casa', stato: 'scening'),
      _ent('scene.buonanotte', 'Buonanotte', stato: 'scening'),
      _ent('light.ingresso', 'Luci ingresso'),
      _ent('lock.porta', 'Porta di casa', stato: 'locked'),
      _ent('switch.irrigazione', 'Irrigazione giardino'),
    ];
    await tester.runAsync(() async {
      await collegamento.chiudi();
      await collegamento.apri();
      await collegamento.serveLaCasa();
    });
    await tester.pumpWidget(
      telefono(
        ComandiInAuto(
          collegamento: collegamento,
          leggi: () async => null,
          scrivi: (_) async => true,
          azioni: () async => const [],
        ),
      ),
    );
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 500)),
    );
    await tester.pumpAndSettle();
    await laFoto(tester, 'domani-comandi');
  });
}

Map<String, dynamic> _ent(
  String id,
  String nome, {
  String stato = 'off',
  String? classe,
}) => {
  ...PonteFinto.unaEntita(id, stato, nome: nome),
  'attributes': {'friendly_name': nome, 'device_class': ?classe},
};
