/// Le fotografie di «Da Home Assistant» nella pagina Notifiche: la sezione,
/// e il foglio di un'automazione, con Premium e in Base.
///
/// Non e' una prova: e' un attrezzo per **guardare**, come le altre foto. Si
/// lancia a mano, e la cartella la dice `GDAHOME_FOTO`:
///
/// ```sh
/// cd app && GDAHOME_FOTO=/tmp/foto flutter test --update-goldens test/foto/da_home_assistant_foto.dart
/// ```
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/notifiche.dart';
import 'package:gdahome/vestito/sfondo.dart';
import 'package:gdahome/vestito/tema.dart';

import '../notifiche/da_home_assistant_di_prova.dart';
import '../ponte/ponte_finto.dart';

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
  /* Le entita' delle personalizzate si scrivono a spaziatura fissa: sul
   * telefono la da' il sistema, qui la si prende dalla macchina (senza,
   * il test le disegna a quadratini neri). */
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

Widget _app(Widget pagina, {bool scuro = false}) => MaterialApp(
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

Future<(PonteFinto, Collegamento)> _unaCasa({required bool premium}) async {
  final ponte = await PonteFinto.alza();
  ponte.notifiche
    ..['registrato'] = true
    ..['premium'] = premium
    ..['personalizzate'] = [
      {
        'id': 'p_000000000001',
        'attiva': true,
        'entita': 'sensor.freezer_cantina',
        'condizione': 'sopra',
        'valore': '-12 °C',
        'per': 10,
        'titolo': 'Freezer sopra −12 °C',
        'urgenza': 'normale',
        'chi': ['a' * 32],
        'nonRipetere': 60,
      },
    ];
  ponte.daHomeAssistant = datiDaHomeAssistant(premium: premium);
  final archivio = ArchivioDelleCase(CassaforteInMemoria());
  await archivio.apri();
  await archivio.aggiungi(
    nome: 'Casa',
    segno: segnoBuono,
    identificativo: chiBuono,
    chiave: chiaveBuona,
    inCasa: ponte.indirizzo,
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

  for (final (premium, scuro) in const [
    (true, false),
    (false, false),
    (true, true),
  ]) {
    final quale = '${premium ? 'premium' : 'base'}${scuro ? '-scuro' : ''}';

    testWidgets('la sezione, $quale', (tester) async {
      tester.view.physicalSize = const Size(412 * 3, 2050 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      late PonteFinto ponte;
      late Collegamento collegamento;
      await tester.runAsync(() async {
        (ponte, collegamento) = await _unaCasa(premium: premium);
      });
      await tester.pumpWidget(
        _app(
          SchermataDelleNotifiche(
            collegamento: collegamento,
            cassaforte: CassaforteInMemoria(),
            nomeDelTelefono: 'telefono',
          ),
          scuro: scuro,
        ),
      );
      await _lasciaFare(tester);
      final sezione = find.byKey(const Key('sezione-da-home-assistant'));
      await tester.scrollUntilVisible(
        sezione,
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.runAsync(
        () => Scrollable.ensureVisible(
          tester.element(find.text('Notifiche personalizzate')),
        ),
      );
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/1-sezione-$quale.png'),
      );
      await tester.runAsync(() async {
        await collegamento.chiudi();
        await ponte.spegni();
      });
    });

    testWidgets('il foglio, $quale', (tester) async {
      tester.view.physicalSize = const Size(412 * 3, 915 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final dati = NotificheDaHomeAssistant.leggi(
        datiDaHomeAssistant(premium: premium),
      );
      final riga = dati.automazioni.firstWhere(
        (una) =>
            una.alias ==
            (premium ? 'Lavatrice finita' : 'Allarme: movimento in giardino'),
      );
      await tester.pumpWidget(
        _app(
          Builder(
            builder: (context) => Scaffold(
              appBar: AppBar(title: const Text('Notifiche')),
              body: Center(
                child: FilledButton(
                  onPressed: () => showModalBottomSheet<void>(
                    context: context,
                    isScrollControlled: true,
                    showDragHandle: true,
                    builder: (_) => FoglioDaHomeAssistant(
                      riga: riga,
                      dati: dati,
                      premium: premium,
                      silenzio: const OreDiSilenzio(),
                      adesso: DateTime(2026, 10, 18, 18, 40),
                      cambia: (_) async => riga,
                      spiegaIlPremium: () {},
                    ),
                  ),
                  child: const Text('apri'),
                ),
              ),
            ),
          ),
          scuro: scuro,
        ),
      );
      await tester.tap(find.text('apri'));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/2-foglio-$quale.png'),
      );
    });
  }
}
