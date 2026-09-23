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
  /* E il carattere che chiedono le figure del ponte.
   *
   * La mappa della rete e' un SVG e dentro dice
   * `font-family="system-ui, -apple-system, …"` — una fila di nomi, come si
   * scrive sul web: prendi il primo che trovi.
   *
   * `flutter_svg` pero' quella fila non la legge come una fila: la prende
   * **tutta intera** come se fosse il nome di un carattere solo, e un
   * carattere che si chiama cosi' non esiste da nessuna parte. Sul telefono
   * non e' un guaio — non trovandolo si ripiega sul carattere di sistema, e i
   * nomi si leggono — ma in una prova si ripiega su quello finto, che disegna
   * ogni lettera come un rettangolo pieno: i nomi dei dispositivi uscivano
   * come barrette nere.
   *
   * Non e' un guasto della mappa: e' che qui il carattere di sistema non c'e'.
   * Gli si da' l'Inter dell'app con quel nome lungo, e lo scatto torna a
   * raccontare quello che si vede in mano. */
  const comeChiedeIlPonte =
      'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  final suo = File('assets/carattere/Inter-600.ttf');
  if (suo.existsSync()) {
    await (FontLoader(
      comeChiedeIlPonte,
    )..addFont(suo.readAsBytes().then((b) => b.buffer.asByteData()))).load();
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

/// Una rete come quella di una casa vera: l'antenna, tre ripetitori a
/// corrente, e sei cose a batteria in fondo ai rami.
///
/// Sono gli stessi dispositivi che disegna la mappa qui accanto
/// (`la-rete-di-casa.svg`): elenco e mappa devono raccontare la stessa casa,
/// se no lo scatto mostra due case diverse.
final _inRete = <Map<String, Object?>>[
  {
    'id': '0x0000',
    'nome': 'Antenna',
    'marca': 'Nabu Casa',
    'modello': 'SkyConnect',
    'tipo': 'coordinatore',
    'potenza': 'rete',
    'dispositivo': 'dev-antenna',
  },
  {
    'id': '0x1a2b',
    'nome': 'Presa cucina',
    'marca': 'Xiaomi',
    'modello': 'ZNCZ12LM',
    'tipo': 'router',
    'potenza': 'rete',
    'dispositivo': 'dev-presa-cucina',
  },
  {
    'id': '0x3c4d',
    'nome': 'Lampadario salotto',
    'marca': 'IKEA',
    'modello': 'TRADFRI bulb E27',
    'tipo': 'router',
    'potenza': 'rete',
    'dispositivo': 'dev-lampadario',
  },
  {
    'id': '0x5e6f',
    'nome': 'Presa garage',
    'marca': 'Shelly',
    'modello': 'Plug S',
    'tipo': 'router',
    'potenza': 'rete',
    'dispositivo': 'dev-presa-garage',
  },
  {
    'id': '0x7a8b',
    'nome': 'Porta ingresso',
    'marca': 'Aqara',
    'modello': 'MCCGQ11LM',
    'tipo': 'terminale',
    'potenza': 'batteria',
    'dispositivo': 'dev-porta',
  },
  {
    'id': '0x9c0d',
    'nome': 'Finestra cucina',
    'marca': 'Aqara',
    'modello': 'MCCGQ11LM',
    'tipo': 'terminale',
    'potenza': 'batteria',
    'dispositivo': 'dev-finestra',
  },
  {
    'id': '0xaab1',
    'nome': 'Termostato salotto',
    'marca': 'Moes',
    'modello': 'BRT-100',
    'tipo': 'terminale',
    'potenza': 'batteria',
    'dispositivo': 'dev-termostato',
  },
  {
    'id': '0xbbc2',
    'nome': 'Movimento corridoio',
    'marca': 'Sonoff',
    'modello': 'SNZB-03',
    'tipo': 'terminale',
    'potenza': 'batteria',
    'dispositivo': 'dev-movimento',
  },
  {
    'id': '0xccd3',
    'nome': 'Basculante garage',
    'marca': 'Aqara',
    'modello': 'MCCGQ11LM',
    'tipo': 'terminale',
    'potenza': 'batteria',
    'dispositivo': 'dev-basculante',
  },
  {
    'id': '0xdde4',
    'nome': 'Perdita lavanderia',
    'marca': 'Aqara',
    'modello': 'SJCGQ11LM',
    'tipo': 'terminale',
    'potenza': 'batteria',
    'dispositivo': 'dev-perdita',
  },
];

/// La mappa come la disegna **il ponte**, non una figura rifatta qui.
///
/// Il file lo scrive il disegnatore vero — `ponte/src/mappa-zigbee.js` — sui
/// dispositivi qui sopra. Rifarla a mano in Dart vorrebbe dire fotografare una
/// mappa che nell'app non si vede mai.
String _laMappa() => File('test/foto/la-rete-di-casa.svg').readAsStringSync();

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
      ponte.laReteZigbee = 'zigbee2mqtt';
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

  /* ─── Zigbee: chi c'e' gia', la sua scheda, la mappa (#128) ────────────── */
  //
  // «Voglio vedere elenco completo dei dispositivi e poterli eliminare e
  // eventualmente associare dispositivi gia' esistenti nella plancia. Crea
  // inoltre la possibilita' di mostrare la mappa di collegamento.»
  //
  // Anche qui non si disegna niente a mano: si apre la sezione con una rete
  // gia' popolata e si preme dove preme una persona.

  testWidgets('Zigbee: chi c\'è già, la scheda e la mappa', (tester) async {
    quantoGrande(tester);
    late PonteFinto ponte;
    await tester.runAsync(() async => ponte = await PonteFinto.alza());
    ponte.inReteZigbee.addAll(_inRete);
    ponte.mappaZigbee = _laMappa();
    /* Le entita' del dispositivo che si apre: sono quelle che fanno decidere
     * al foglietto «Dove lo metto?» in che sezione va. */
    ponte.entitaDelDispositivoZigbee['dev-porta'] = [
      {
        'entity': 'binary_sensor.porta_ingresso',
        'classe': 'door',
        'categoria': '',
      },
      {
        'entity': 'sensor.porta_ingresso_battery',
        'classe': 'battery',
        'categoria': 'diagnostic',
      },
    ];
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
    /* Scorsa fin sotto il tasto: l'elenco sta li', e in cima si vedrebbe solo
     * la porta dell'abbinamento che e' gia' nello scatto 1. */
    await tester.drag(find.byType(ListView), const Offset(0, -330));
    await tester.pumpAndSettle();
    await scatta(tester, 'zigbee-5-elenco');

    await premi(tester, 'Porta ingresso');
    await tester.pumpAndSettle();
    await respira(tester);
    await scatta(tester, 'zigbee-6-scheda');

    await premi(tester, 'Togli dalla rete');
    await tester.pumpAndSettle();
    await scatta(tester, 'zigbee-7-togli');

    await premi(tester, 'Lascia stare');
    await tester.pumpAndSettle();
    /* Indietro dalla scheda, e poi la mappa. */
    await tester.pageBack();
    await tester.pumpAndSettle();
    await premi(tester, 'Guarda la rete');
    /* A passi di tempo **vero** e non con `pumpAndSettle`: dentro una prova
     * l'orologio lo muoviamo noi, e «aspetta che si fermi tutto» lo sposta
     * avanti a manciate — passando il tempo che l'app si da' per avere la
     * mappa. Lo scatto usciva con «Home Assistant non ha risposto in tempo»
     * su una rete che aveva risposto benissimo. */
    await respira(tester, volte: 6);
    await scatta(tester, 'zigbee-8-mappa');
  });
}
