/// Le fotografie di **tutte le pagine dell'app**, chiaro e scuro.
///
/// «Per il menu e per tutte le pagine dell'app non puoi prendere spunto da
/// gdanav, cosi' da renderle uguali visto che sono dello stesso produttore?»
///
/// Questo e' l'attrezzo con cui si guarda se e' successo davvero. Il vestito
/// sta in un posto solo (`vestito/tema.dart`), ma una pagina puo' sempre
/// mettersi un colore o una misura per conto suo, e l'unico modo di
/// accorgersene e' vederle tutte una accanto all'altra.
///
/// Non e' una prova: e' un attrezzo per **guardare**, come `menu_foto.dart` e
/// `aggiornamenti_foto.dart`. Per questo il nome non finisce in `_test.dart` —
/// `flutter test` da solo non lo prende, e non fa rosso il workflow per un
/// carattere disegnato mezzo punto piu' in la'. Si lancia a mano:
///
/// ```sh
/// cd app && flutter test --update-goldens test/foto/le_pagine_foto.dart
/// ```
///
/// Le fotografie finiscono in `collaudo/foto/pagine/`, che la repository non
/// tiene (`collaudo/.gitignore`): non c'e' niente da confrontare e niente che
/// possa diventare rosso.
///
/// ## Cosa si guarda
///
/// Le quattro cose che gdahome ha preso da gdanav, e che si vedono solo
/// mettendo due pagine vicine:
///
///  - il **blu** e' lo stesso in tutte le pagine (`#1D4ED8` al chiaro,
///    `#7FB2FF` al buio), e non e' rimasto indietro un celeste da qualche
///    parte;
///  - le **caselle** sono piene e senza filo intorno;
///  - i **titoli di sezione** sono righe normali, non maiuscoletto spaziato;
///  - le **schede** hanno l'ombra a due strati e nessun bordo.
///
/// ## La casa del banco
///
/// E' un `PonteFinto` vero, quello del collaudo: la casa risponde, le entita'
/// ci sono, i dispositivi Zigbee pure. Una pagina fotografata a vuoto racconta
/// lo stato vuoto e non la pagina.
library;

import 'dart:io';
import 'dart:ui' show AccessibilityFeatures;

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
import 'package:gdahome/schermate/aggiungi_casa.dart';
import 'package:gdahome/schermate/assistenza.dart';
import 'package:gdahome/schermate/diagnostica.dart';
import 'package:gdahome/schermate/dispositivi.dart';
import 'package:gdahome/schermate/impostazioni_app.dart';
import 'package:gdahome/schermate/le_case.dart';
import 'package:gdahome/schermate/segnalazioni.dart';
import 'package:gdahome/schermate/zigbee.dart';
import 'package:gdahome/vestito/quanto_e_largo.dart';
import 'package:gdahome/vestito/sfondo.dart';
import 'package:gdahome/vestito/tema.dart';

import '../ponte/ponte_finto.dart';

/// Un telefono che ha chiesto meno movimento: il fondo dell'app respira per
/// sempre, e aspettare che tutto si fermi non finirebbe mai.
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

/// La guardia del telefono, finta: qui non si sblocca niente davvero, ma la
/// schermata del lucchetto senza di lei disegna «questo telefono non sa
/// riconoscerti», che e' un'altra pagina.
class _GuardiaFinta implements LaGuardia {
  @override
  Future<CosaSaFareIlTelefono> cosaSaFare() async => const CosaSaFareIlTelefono(
    sa: {ComeRiconosce.volto, ComeRiconosce.impronta},
    ceUnaGuardiaDelSistema: true,
  );

  @override
  Future<ComeEAndata> chiedi({required String perche}) async => ComeEAndata.si;
}

/// I caratteri veri dell'app, dal disco. Senza, la fotografia esce col
/// carattere di riserva, e guardare il vestito con un carattere che non e'
/// quello non serve a niente.
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
  await (FontLoader('MaterialIcons')
        ..addFont(icone.readAsBytes().then((byte) => byte.buffer.asByteData())))
      .load();
}

void main() {
  late PonteFinto ponte;
  late Collegamento collegamento;
  late Impostazioni impostazioni;

  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _iCaratteri();
  });

  setUp(() {
    TestWidgetsFlutterBinding
            .instance
            .platformDispatcher
            .accessibilityFeaturesTestValue =
        const _SenzaMovimento();
  });

  tearDown(() {
    TestWidgetsFlutterBinding.instance.platformDispatcher
        .clearAccessibilityFeaturesTestValue();
  });

  /// Un telefono: la misura su cui queste pagine si guardano davvero.
  const telefono = Size(390, 844);

  void quantoGrande(WidgetTester tester, {required bool scuro}) {
    tester.view.physicalSize = Size(telefono.width * 3, telefono.height * 3);
    tester.view.devicePixelRatio = 3;
    tester.platformDispatcher.platformBrightnessTestValue = scuro
        ? Brightness.dark
        : Brightness.light;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
  }

  /// Una casa collegata a un ponte finto, come nel collaudo — **e con
  /// qualcosa dentro**.
  ///
  /// Una pagina fotografata su una casa vuota disegna lo stato vuoto, che e'
  /// un'altra pagina: «Casa vuota — Home Assistant non ha nessuna entita' da
  /// mostrare». Qui dentro c'e' abbastanza per far disegnare a ogni schermata
  /// quello che disegna davvero.
  Future<void> unaCasa(WidgetTester tester) async {
    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
      ponte.entita = [
        PonteFinto.unaEntita('light.cucina', 'on', nome: 'Luce cucina'),
        PonteFinto.unaEntita('light.salotto', 'off', nome: 'Luce salotto'),
        PonteFinto.unaEntita('switch.presa_studio', 'on', nome: 'Presa studio'),
        PonteFinto.unaEntita(
          'binary_sensor.porta_ingresso',
          'off',
          nome: 'Porta ingresso',
          tipo: 'door',
        ),
        PonteFinto.unaEntita(
          'sensor.temperatura_salotto',
          '21.4',
          nome: 'Temperatura salotto',
          tipo: 'temperature',
          unita: '°C',
        ),
        PonteFinto.unaEntita(
          'sensor.consumo_casa',
          '842',
          nome: 'Consumo casa',
          tipo: 'power',
          unita: 'W',
        ),
        PonteFinto.unaEntita(
          'cover.tapparella_camera',
          'open',
          nome: 'Tapparella camera',
        ),
      ];
      /* Una rete Zigbee con dentro tre cose: l'antenna, un router e un
       * terminale a batteria. Sono i tre casi che quella pagina disegna. */
      ponte.laReteZigbee = 'zha';
      ponte.inReteZigbee
        ..clear()
        ..addAll([
          {
            'id': '0x00',
            'nome': 'Antenna',
            'marca': 'Nabu Casa',
            'modello': 'SkyConnect',
            'tipo': 'coordinatore',
            'potenza': 'rete',
            'dispositivo': 'dev-antenna',
          },
          {
            'id': '0x01',
            'nome': 'Presa cucina',
            'marca': 'Xiaomi',
            'modello': 'ZNCZ12LM',
            'tipo': 'router',
            'potenza': 'rete',
            'dispositivo': 'dev-presa',
          },
          {
            'id': '0x02',
            'nome': 'Porta ingresso',
            'marca': 'Aqara',
            'modello': 'MCCGQ11LM',
            'tipo': 'terminale',
            'potenza': 'batteria',
            'dispositivo': 'dev-porta',
          },
        ]);
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.aggiungi(
        nome: 'Casa di Giovanni',
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
      impostazioni = Impostazioni(
        sulTelefono: true,
        android: true,
        dispensa: DispensaInMemoria(),
      );
      await impostazioni.carica();
    });
    addTearDown(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });
  }

  /// Un momento di tempo vero, e poi si ridisegna: la prima lettura di una
  /// pagina passa dal filo, che e' rete vera.
  Future<void> respira(WidgetTester tester) async {
    for (var volta = 0; volta < 2; volta += 1) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 250)),
      );
      for (var giro = 0; giro < 8; giro += 1) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    }
  }

  /// La pagina, vestita come la veste l'app: i due temi, il fondo vivo sotto
  /// tutto, e `QuantoCiSta` intorno come l'ha la home.
  Widget laPagina(Widget dentro, {required bool scuro}) => MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: temaChiaro(),
    darkTheme: temaScuro(),
    /* Nell'app non c'e' nessun `themeMode`: vale quello di sistema. Sotto le
     * prove pero' la luminosita' finta non arriva a `MaterialApp`, e la
     * fotografia uscirebbe col tema chiaro e il testo del tema scuro sopra. */
    themeMode: scuro ? ThemeMode.dark : ThemeMode.light,
    /* Il `Material` trasparente e' l'antenato che le caselle di testo
     * pretendono: nell'app glielo da' lo `Scaffold` della home, e una pagina
     * che qui esce col rosso «No Material widget found» non e' rotta — e'
     * fotografata senza la sua cornice. Trasparente perche' il fondo lo
     * dipinge `SfondoVivo`, come in `main.dart`. */
    home: SfondoVivo(
      child: QuantoCiSta(
        child: Material(type: MaterialType.transparency, child: dentro),
      ),
    ),
  );

  Future<void> scatta(
    WidgetTester tester,
    String come,
    Widget dentro, {
    required bool scuro,
  }) async {
    quantoGrande(tester, scuro: scuro);
    await tester.pumpWidget(laPagina(dentro, scuro: scuro));
    await respira(tester);
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../../../collaudo/foto/pagine/$come.png'),
    );
  }

  /// Le pagine, una per una. Ognuna si fotografa al chiaro e al buio: il
  /// vestito e' fatto di due, e uno solo dei due non dice se l'altro tiene.
  final pagine = <String, Widget Function()>{
    'le-case': () => LeCase(
      collegamento: collegamento,
      aggiungiUnaCasa: () {},
      impostazioni: impostazioni,
      guardia: _GuardiaFinta(),
    ),
    'dispositivi': () => Dispositivi(collegamento: collegamento),
    'diagnostica': () => SchermataDellaDiagnostica(
      collegamento: collegamento,
      impostazioni: impostazioni,
    ),
    'assistenza': () => SchermataDellAssistenza(
      collegamento: collegamento,
      diagnostica: () => const {'app': '1.6.11', 'casa': 'in casa'},
      impostazioni: impostazioni,
    ),
    /* «Impostazioni app»: la voce nuova del menu, e dentro la sicurezza che
     * stava sotto il catenaccio in cima a «Le tue case». */
    'impostazioni-app': () => SchermataDelleImpostazioniDellApp(
      impostazioni: impostazioni,
      guardia: _GuardiaFinta(),
    ),
    'segnalazioni': () => SchermataDelleSegnalazioni(
      collegamento: collegamento,
      diagnostica: () => const {'app': '1.6.11'},
    ),
    'zigbee': () => SchermataZigbee(collegamento: collegamento, visibile: true),
    'aggiungi-casa': () => AggiungiCasa(
      archivio: ArchivioDelleCase(CassaforteInMemoria()),
      quandoFatto: (_) {},
    ),
  };

  for (final pagina in pagine.entries) {
    for (final scuro in [false, true]) {
      testWidgets('${pagina.key}${scuro ? ' al buio' : ''}', (tester) async {
        await unaCasa(tester);
        await scatta(
          tester,
          '${pagina.key}${scuro ? '-scuro' : ''}',
          pagina.value(),
          scuro: scuro,
        );
      });
    }
  }
}
