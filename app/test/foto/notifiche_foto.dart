/// Le fotografie della pagina «Notifiche», dell'editor di una notifica
/// personalizzata e del campanello a tutto schermo.
///
/// Non e' una prova: e' un attrezzo per **guardare**, come le altre foto. Si
/// lancia a mano, e la cartella la dice `GDAHOME_FOTO`:
///
/// ```sh
/// cd app && GDAHOME_FOTO=/tmp/foto flutter test --update-goldens test/foto/notifiche_foto.dart
/// ```
library;

import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/entita.dart';
import 'package:gdahome/notifiche/consegna.dart';
import 'package:gdahome/notifiche/le_immagini.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/notifiche/postino.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/campanello.dart';
import 'package:gdahome/schermate/notifica_personalizzata.dart';
import 'package:gdahome/schermate/notifiche.dart';
import 'package:gdahome/vestito/sfondo.dart';
import 'package:gdahome/vestito/tema.dart';

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
  /* Le entita' si scrivono a spaziatura fissa: sul telefono la da' il
   * sistema, qui la si prende dalla macchina se c'e'. */
  final fissa = File('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf');
  if (fissa.existsSync()) {
    await (FontLoader('monospace')..addFont(
          fissa.readAsBytes().then((byte) => byte.buffer.asByteData()),
        ))
        .load();
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

/// Un postino che fa finta di avere Firebase e il permesso: la pagina vera
/// lo chiede, e senza mostrerebbe l'avviso «app senza notifiche».
class _PostinoFinto extends Postino {
  _PostinoFinto(Collegamento collegamento)
    : super(collegamento: collegamento, cassaforte: CassaforteInMemoria());
  @override
  bool get acceso => true;
  @override
  bool get permesse => true;
}

const _io = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

Map<String, dynamic> _statoDiCasa() => {
  'impostazioni': {
    'acceso': true,
    'eventi': <String, bool>{},
    'persone': ['person.uno', 'person.due'],
    'assistente': 'importanti',
    'riepilogo': '20:30',
    'silenzio': {'acceso': true, 'dalle': '23:00', 'alle': '07:00'},
    'soloFuori': false,
    'stile': 'elaborate',
    'su': {
      'riepilogo': {'stile': 'semplice'},
      'elettrodomestici': {
        'stile': 'come-tutte',
        'quali': ['switch.lavatrice', 'switch.lavastoviglie'],
        'soglia': 0.1,
        'suono': 'normale',
        'orari': {'dalle': '07:00', 'alle': '23:00'},
        'come': 'subito',
        'dentro': ['durata', 'kwh', 'costo', 'sole'],
      },
    },
  },
  'registrato': true,
  'intestato': true,
  'centralino': true,
  'persone': [
    {'id': 'person.uno', 'nome': 'Persona 1'},
    {'id': 'person.due', 'nome': 'Persona 2'},
    {'id': 'person.tre', 'nome': 'Persona 3'},
  ],
  'utenti': [
    {'id': _io, 'nome': 'Persona 1'},
    {'id': 'b' * 32, 'nome': 'Persona 2'},
    {'id': 'c' * 32, 'nome': 'Persona 3'},
  ],
  'personalizzate': [
    {
      'id': 'p_000000000001',
      'attiva': true,
      'entita': 'sensor.temperatura_freezer',
      'condizione': 'sopra',
      'valore': '-12 °C',
      'per': 10,
      'titolo': 'Freezer troppo caldo',
      'urgenza': 'normale',
      'chi': [_io, 'b' * 32],
      'nonRipetere': 60,
    },
    {
      'id': 'p_000000000002',
      'attiva': false,
      'entita': 'binary_sensor.cancello',
      'condizione': 'uguale',
      'valore': 'aperto',
      'per': 5,
      'titolo': 'Cancello rimasto aperto',
      'urgenza': 'normale',
      'chi': [_io],
      'nonRipetere': 60,
    },
  ],
  'io': _io,
  'amministra': true,
};

Widget _app(Widget pagina, {required bool scuro}) => MaterialApp(
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
  home: pagina,
);

Future<void> _lasciaFare(WidgetTester tester) async {
  for (var giro = 0; giro < 6; giro += 1) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 200)),
    );
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<(PonteFinto, Collegamento)> _unaCasa() async {
  final ponte = await PonteFinto.alza();
  ponte.notifiche
    ..clear()
    ..addAll(_statoDiCasa());
  ponte.entita = [
    for (final (id, nome) in const [
      ('switch.lavatrice', 'Lavatrice'),
      ('switch.lavastoviglie', 'Lavastoviglie'),
    ])
      {
        'entity_id': id,
        'state': 'off',
        'attributes': {'friendly_name': nome},
        'last_changed': DateTime.now().toUtc().toIso8601String(),
        'last_updated': DateTime.now().toUtc().toIso8601String(),
      },
    {
      'entity_id': 'sensor.temperatura_freezer',
      'state': '-18.4',
      'attributes': {
        'friendly_name': 'Freezer cantina',
        'unit_of_measurement': '°C',
        'device_class': 'temperature',
      },
      'last_changed': DateTime.now().toUtc().toIso8601String(),
      'last_updated': DateTime.now().toUtc().toIso8601String(),
    },
  ];
  final archivio = ArchivioDelleCase(CassaforteInMemoria());
  await archivio.apri();
  await archivio.aggiungi(
    nome: 'Casa',
    segno: segnoBuono,
    identificativo: chiBuono,
    chiave: chiaveBuona,
    inCasa: ponte.indirizzo,
  );
  final mare = await archivio.aggiungi(
    nome: 'Casa al mare',
    segno: 'altro-segno',
    identificativo: 'dm_altro',
    chiave: chiaveBuona,
    inCasa: ponte.indirizzo,
  );
  await archivio.scegli(
    archivio.tutte.firstWhere((una) => una.id != mare.id).id,
  );
  final collegamento = Collegamento(
    archivio: archivio,
    sonda: Sonda(bussa: (dove) async => dove == ponte.indirizzo.salute),
  );
  await collegamento.apri();
  return (ponte, collegamento);
}

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _iCaratteri();
  });

  for (final scuro in const [false, true]) {
    final tinta = scuro ? 'scuro' : 'chiaro';

    testWidgets('la pagina Notifiche, $tinta', (tester) async {
      /* Lunga quanto la pagina: una fotografia sola, da cima a fondo. */
      tester.view.physicalSize = const Size(390 * 3, 2900 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      late PonteFinto ponte;
      late Collegamento collegamento;
      await tester.runAsync(() async {
        (ponte, collegamento) = await _unaCasa();
      });
      await tester.pumpWidget(
        _app(
          SchermataDelleNotifiche(
            collegamento: collegamento,
            postino: _PostinoFinto(collegamento),
            cassaforte: CassaforteInMemoria(),
            nomeDelTelefono: 'iPhone',
          ),
          scuro: scuro,
        ),
      );
      await _lasciaFare(tester);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/01-notifiche-intera-$tinta.png'),
      );
      /* E come la vede un telefono: quattro schermate, dall'alto in basso. */
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      await tester.pumpAndSettle();
      final lista = find.byType(Scrollable).first;
      for (final (i, quanto) in const [0, 700, 700, 900].indexed) {
        if (quanto > 0) {
          await tester.drag(lista, Offset(0, -quanto.toDouble()));
          await tester.pumpAndSettle();
        }
        await expectLater(
          find.byType(MaterialApp),
          matchesGoldenFile(
            '$_cartella/0${i + 2}-notifiche-${i + 1}-$tinta.png',
          ),
        );
      }
      await tester.runAsync(() async {
        await collegamento.chiudi();
        await ponte.spegni();
      });
    });

    testWidgets('il foglio di una voce, $tinta', (tester) async {
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      late PonteFinto ponte;
      late Collegamento collegamento;
      await tester.runAsync(() async {
        (ponte, collegamento) = await _unaCasa();
      });
      await tester.pumpWidget(
        _app(
          SchermataDelleNotifiche(
            collegamento: collegamento,
            postino: _PostinoFinto(collegamento),
            cassaforte: CassaforteInMemoria(),
            nomeDelTelefono: 'iPhone',
          ),
          scuro: scuro,
        ),
      );
      await _lasciaFare(tester);
      await tester.scrollUntilVisible(
        find.text('Elettrodomestico finito'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Elettrodomestico finito'));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/09-foglio-voce-$tinta.png'),
      );
      await tester.runAsync(() async {
        await collegamento.chiudi();
        await ponte.spegni();
      });
    });

    testWidgets('l\'editor di una personalizzata, $tinta', (tester) async {
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      late PonteFinto ponte;
      late Collegamento collegamento;
      await tester.runAsync(() async {
        (ponte, collegamento) = await _unaCasa();
      });
      final adesso = DateTime.now();
      final storia = [
        for (var i = 0; i <= 96; i += 1)
          (
            quando: adesso.subtract(Duration(minutes: 15 * (96 - i))),
            valore:
                -18.6 +
                0.6 * math.sin(i / 7) +
                (i > 55 && i < 70
                    ? 1.6 * math.sin((i - 55) / 14 * math.pi)
                    : 0),
          ),
      ];
      await tester.pumpWidget(
        _app(
          SchermataDellaNotificaPersonalizzata(
            collegamento: collegamento,
            stato: StatoDelleNotifiche.leggi(_statoDiCasa()),
            regola: const NotificaPersonalizzata(
              entita: 'sensor.temperatura_freezer',
              valore: '-12',
              per: 10,
              titolo: 'Freezer troppo caldo',
              chi: [_io, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
            ),
            storiaIniziale: storia,
          ),
          scuro: scuro,
        ),
      );
      await _lasciaFare(tester);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/06-editor-1-$tinta.png'),
      );
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -760));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/07-editor-2-$tinta.png'),
      );
      await tester.runAsync(() async {
        await collegamento.chiudi();
        await ponte.spegni();
      });
    });
  }

  testWidgets('il campanello a tutto schermo', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    late PonteFinto ponte;
    late Collegamento collegamento;
    await tester.runAsync(() async {
      (ponte, collegamento) = await _unaCasa();
    });
    final foto = File(
      Platform.environment['GDAHOME_FOTO_DELLA_PORTA'] ?? '/nessuna',
    );
    final tocco = ToccoDellaNotifica(
      casa: collegamento.casa!.id,
      notifica: NotificaArrivata(
        id: 'n',
        tipo: 'campanello',
        categoria: 'urgenti',
        urgenza: 'urgente',
        titolo: 'Suona il campanello',
        testo: 'Ingresso',
        quando: DateTime(2026, 10, 14, 19, 12),
        scade: DateTime(2100),
        camera: 'camera.ingresso',
        chiamata: true,
        tasti: const [
          TastoDellaNotifica('apri', 'Apri cancello'),
          TastoDellaNotifica('ignora', 'Ignora'),
        ],
      ),
    );
    await tester.pumpWidget(
      _app(
        SchermataDelCampanello(
          tocco: tocco,
          collegamento: collegamento,
          sopraIlBlocco: false,
          fotoIniziale: foto.existsSync() ? foto.readAsBytesSync() : null,
        ),
        scuro: true,
      ),
    );
    await tester.runAsync(() async {
      final immagine = find.byType(Image);
      for (final una in immagine.evaluate()) {
        await precacheImage((una.widget as Image).image, una);
      }
    });
    await tester.pump(const Duration(milliseconds: 300));
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('$_cartella/08-campanello.png'),
    );
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 61));
    await tester.runAsync(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });
  });

  /* Il movimento davanti alle telecamere: «Quali» dopo aver spuntato due
   * telecamere e chiuso la finestra toccando fuori, e «Guarda». */
  for (final scuro in const [false, true]) {
    final tinta = scuro ? 'scuro' : 'chiaro';
    testWidgets('«Quali» del movimento con due telecamere, $tinta', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      Entita una(String id, String nome, [String? classe]) => Entita(
        id: id,
        stato: 'off',
        attributi: {'friendly_name': nome, 'device_class': ?classe},
      );
      const ingresso = 'camera.ds_2cd2143g2_i11111111_101';
      const balcone = 'camera.ds_2cd2143g2_i22222222_101';
      await tester.pumpWidget(
        _app(
          Scaffold(
            body: FoglioDellaVoce(
              evento: 'movimento',
              scelta: const SceltaDellaVoce(quando: 'casa-vuota'),
              stileGenerale: 'semplici',
              entita: [
                una(
                  'binary_sensor.ds_i22222222_motion',
                  'Balcone Motion',
                  'motion',
                ),
                una(ingresso, 'Ingresso'),
                una(
                  'binary_sensor.ds_i11111111_line',
                  'Ingresso Line Crossing',
                  'motion',
                ),
                una(balcone, 'Balcone'),
              ],
              cambia: (_) {},
            ),
          ),
          scuro: scuro,
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('voce-quali')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('quali-$ingresso')));
      await tester.tap(find.byKey(const Key('quali-$balcone')));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/10-quali-scelta-$tinta.png'),
      );
      await tester.tapAt(const Offset(200, 30));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/11-quali-dopo-$tinta.png'),
      );
    });
  }

  testWidgets('«Guarda» apre la telecamera', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    late PonteFinto ponte;
    late Collegamento collegamento;
    await tester.runAsync(() async {
      (ponte, collegamento) = await _unaCasa();
    });
    final foto = File('test/notifiche/porta-di-prova.jpg');
    await tester.pumpWidget(
      _app(
        SchermataDellaTelecamera(
          tocco: ToccoDellaNotifica(
            casa: collegamento.casa!.id,
            tasto: 'guarda',
            notifica: NotificaArrivata(
              id: 'm',
              tipo: 'movimento',
              categoria: 'sicurezza',
              urgenza: 'normale',
              titolo: '📷 Movimento · Balcone',
              testo: '21:59 · casa vuota',
              quando: DateTime(2026, 10, 17, 21, 59),
              scade: DateTime(2100),
              camera: 'camera.ds_2cd2143g2_i22222222_101',
              tasti: const [
                TastoDellaNotifica('guarda', 'Guarda', apre: true),
                TastoDellaNotifica('inserisci', 'Inserisci antifurto'),
              ],
            ),
          ),
          collegamento: collegamento,
          fotoIniziale: foto.readAsBytesSync(),
          adesso: DateTime(2026, 10, 17, 22),
        ),
        scuro: true,
      ),
    );
    await tester.runAsync(() async {
      final immagine = find.byType(Image);
      for (final una in immagine.evaluate()) {
        await precacheImage((una.widget as Image).image, una);
      }
    });
    await tester.pump(const Duration(milliseconds: 300));
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('$_cartella/12-guarda-telecamera.png'),
    );
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.runAsync(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });
  });

  testWidgets("«Guarda» parte dalla foto del momento", (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    late PonteFinto ponte;
    late Collegamento collegamento;
    late Directory cartella;
    final foto = File('test/notifiche/porta-di-prova.jpg').readAsBytesSync();
    await tester.runAsync(() async {
      (ponte, collegamento) = await _unaCasa();
      cartella = Directory.systemTemp.createTempSync('momento-');
      await tieniLImmagine('movimento-21', foto, cartella: cartella);
    });
    await tester.pumpWidget(
      _app(
        SchermataDellaTelecamera(
          tocco: ToccoDellaNotifica(
            casa: collegamento.casa!.id,
            tasto: 'guarda',
            notifica: NotificaArrivata(
              id: 'movimento-21',
              tipo: 'movimento',
              categoria: 'sicurezza',
              urgenza: 'normale',
              titolo: '📷 Movimento · Balcone',
              testo: '19:00 · casa vuota',
              quando: DateTime(2026, 10, 21, 19),
              scade: DateTime(2100),
              camera: 'camera.ds_2cd2143g2_i22222222_101',
              tasti: const [
                TastoDellaNotifica('guarda', 'Guarda', apre: true),
                TastoDellaNotifica('inserisci', 'Inserisci antifurto'),
              ],
            ),
          ),
          collegamento: collegamento,
          cartellaDelleImmagini: cartella,
          adesso: DateTime(2026, 10, 21, 19, 17),
        ),
        scuro: true,
      ),
    );
    for (var giro = 0; giro < 20; giro += 1) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 50)),
      );
      await tester.pump();
      if (find.byKey(const Key('telecamera-foto')).evaluate().isNotEmpty) break;
    }
    await tester.runAsync(() async {
      for (final una in find.byType(Image).evaluate()) {
        await precacheImage((una.widget as Image).image, una);
      }
    });
    await tester.pump(const Duration(milliseconds: 300));
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('$_cartella/13-guarda-foto-del-momento.png'),
    );
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.runAsync(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });
  });
}
