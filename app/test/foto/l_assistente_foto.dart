/// Le fotografie delle notifiche dell'assistente di casa, una per una, come
/// le mostra la pagina della notifica toccata (`la_notifica.dart`): quelle
/// che ci sono e quelle proposte, coi loro tasti. Nessun nome di persona.
///
/// Non e' una prova: e' un attrezzo per **guardare**. Si lancia a mano, e la
/// cartella la dice `GDAHOME_FOTO`:
///
/// ```sh
/// cd app && GDAHOME_FOTO=/tmp/foto flutter test --update-goldens test/foto/l_assistente_foto.dart
/// ```
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/notifiche/consegna.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/schermate/la_notifica.dart';
import 'package:gdahome/vestito/sfondo.dart';
import 'package:gdahome/vestito/tema.dart';

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
  /* Una pagina sotto, come nell'app: la freccia per tornare c'e'. */
  home: const Scaffold(),
  onGenerateRoute: (_) => MaterialPageRoute<void>(builder: (_) => pagina),
  initialRoute: '/notifica',
);

final _adesso = DateTime(2026, 10, 18, 22, 10);

const _voci = <(String, String, String, List<String>)>[
  (
    '00-pappa',
    '🍽️ È ora della pappa di Micio',
    'L\'ultima 12 h fa',
    ['Ha mangiato', 'Guarda'],
  ),
  (
    '01-luci',
    '💡 Nessuno in casa da 1 h',
    'Accese: Cucina, Soggiorno. Le spengo?',
    ['Spegni le 2 luci', 'Restano così', 'Più tardi'],
  ),
  (
    '02-clima',
    '🌡️ Clima acceso con la casa vuota',
    'Soggiorno, Camera · da 40 min. Lo spengo?',
    ['Spegni', 'Più tardi'],
  ),
  (
    '03-musica',
    '🎵 Soggiorno suona con la casa vuota',
    'Da 35 min. La fermo?',
    ['Ferma', 'Più tardi'],
  ),
  (
    '04-antifurto',
    '🛡️ Siete usciti e l\'antifurto è spento',
    'Nessuno in casa da 10 min. Lo inserisco?',
    ['Inserisci fuori casa', 'Va bene così'],
  ),
  (
    '05-serratura',
    '🔓 Ingresso non chiuso a chiave',
    'Nessuno in casa da 15 min. La chiudo?',
    ['Chiudi a chiave', 'Più tardi'],
  ),
  (
    '06-garage',
    '🚗 Garage aperto di notte',
    'Aperto da 25 min. Lo chiudo?',
    ['Chiudi', 'Va bene stanotte'],
  ),
  (
    '07-finestre',
    '🪟 Finestre aperte con la casa vuota',
    'Camera, Bagno · da 30 min. Da qui non si chiudono.',
    ['Guarda', 'Va bene così'],
  ),
  (
    '08-finestra-clima',
    '❄️ Finestra aperta col clima acceso',
    'Soggiorno · 23 °C. Spengo il clima finché è aperta?',
    ['Spegni il clima', 'Va bene così'],
  ),
  (
    '09-notte-luci',
    '🌙 Luci accese di notte dove non c\'è nessuno',
    'Taverna, Garage · da 1 h. Le spengo?',
    ['Spegni', 'Restano così'],
  ),
  (
    '10-sole-lavatrice',
    '☀️ C\'è sole: è il momento della lavatrice',
    '3,2 kW dai pannelli e la rete a zero. La avvio?',
    ['Avvia', 'Più tardi'],
  ),
  (
    '11-sole-auto',
    '⚡ Tanto sole e l\'auto non carica',
    '3,8 kW in più dai pannelli. Avvio la ricarica?',
    ['Ricarica col sole', 'Più tardi'],
  ),
  (
    '12-rete-alta',
    '📈 La rete tira troppo',
    '5,8 kW: forno e lavastoviglie. Metto in pausa la lavastoviglie?',
    ['Pausa lavastoviglie', 'Va bene così'],
  ),
  (
    '13-rifiuti',
    '🗑️ Domani ritirano la plastica',
    'Stasera va messa fuori.',
    ['Fatto', 'Ricordamelo dopo'],
  ),
  (
    '14-appuntamento',
    '📅 Fra 30 minuti: un appuntamento',
    'Dal calendario di casa, alle 18:30.',
    ['Guarda', 'Ok'],
  ),
  (
    '15-comfort',
    '🥵 Camera: 28 °C',
    'Qualcuno è in casa. Accendo il clima?',
    ['Accendi il clima', 'Va bene così'],
  ),
  (
    '16-aria',
    '💨 Aria da cambiare in Soggiorno',
    'CO₂ 1.450 ppm. Accendo la ventilazione?',
    ['Accendi la ventilazione', 'Va bene così'],
  ),
  (
    '17-non-rispondono',
    '📡 2 dispositivi non rispondono',
    'Sensore cantina, Presa studio · da 6 h.',
    ['Guarda', 'Va bene così'],
  ),
  (
    '18-aggiornamenti',
    '⬆️ 4 aggiornamenti in attesa',
    'Home Assistant, 2 integrazioni, 1 dispositivo.',
    ['Guarda', 'Più tardi'],
  ),
];

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _iCaratteri();
  });

  for (final (file, titolo, testo, tasti) in _voci) {
    testWidgets('assistente: $file', (tester) async {
      tester.view.physicalSize = const Size(390, 600) * 3;
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        _app(
          SchermataDellaNotifica(
            tocco: ToccoDellaNotifica(
              casa: 'casa',
              notifica: NotificaArrivata(
                id: file,
                tipo: file == '00-pappa' ? 'animali' : 'suggerimenti',
                categoria: file == '00-pappa' ? 'casa' : 'assistente',
                urgenza: 'bassa',
                titolo: titolo,
                testo: testo,
                quando: DateTime(2026, 10, 18, 22, 4),
                scade: DateTime(2100),
                tasti: [
                  for (final (i, t) in tasti.indexed)
                    TastoDellaNotifica('t$i', t, apre: t == 'Guarda'),
                ],
              ),
            ),
            nomeDellaCasa: 'Casa di prova',
            adesso: _adesso,
          ),
          scuro: false,
        ),
      );
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/$file.png'),
      );
    });
  }
}
