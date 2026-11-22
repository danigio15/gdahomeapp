/// Le fotografie delle novità: la scheda che compare dopo un aggiornamento
/// (telefono chiaro e scuro, tablet chiaro e scuro) e la pagina «Novità» di
/// Impostazioni app, con la voce che ci porta.
///
/// Non e' una prova: e' un attrezzo per **guardare**, come
/// `il_benvenuto_foto.dart`. Le note sono quelle vere, del `CHANGELOG.md`
/// dell'app; la casa sotto la scheda e' finta, qualche scheda col fondo
/// dell'app, perche' la scheda si guarda sopra qualcosa e non sul vuoto.
///
/// ```sh
/// cd app && GDAHOME_FOTO=/tmp/foto flutter test --update-goldens test/foto/novita_foto.dart
/// ```
library;

import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/casa/impostazioni.dart';
import 'package:gdahome/casa/la_guardia.dart';
import 'package:gdahome/casa/novita.dart';
import 'package:gdahome/schermate/impostazioni_app.dart';
import 'package:gdahome/schermate/novita.dart';
import 'package:gdahome/versione.dart';
import 'package:gdahome/vestito/pezzi.dart';
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
  /* Le icone: dal Flutter che sta facendo girare le prove, se non lo dice
   * l'ambiente (flutter_tester sta in `bin/cache/artifacts/engine/…`). */
  final radice =
      Platform.environment['FLUTTER_ROOT'] ??
      File(Platform.resolvedExecutable)
          .parent
          .parent
          .parent
          .parent
          .parent
          .parent
          .path;
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

/// Una casa finta sotto la scheda: tre schede col fondo dell'app.
class _LaCasaSotto extends StatelessWidget {
  const _LaCasaSotto();

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    Widget tessera(IconData icona, String nome, String quanto) => Scheda(
      child: Row(
        children: [
          Cerchietto(icona: icona),
          const SizedBox(width: 12),
          Expanded(child: Text(nome, style: testi.titleSmall)),
          Text(quanto, style: carattereDelNumero(corpo: 26)),
        ],
      ),
    );
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Casa', style: testi.headlineSmall),
            const SizedBox(height: 16),
            tessera(Icons.thermostat_rounded, 'Soggiorno', '21,5°'),
            const SizedBox(height: 12),
            tessera(Icons.lightbulb_rounded, 'Luci accese', '3'),
            const SizedBox(height: 12),
            tessera(Icons.bolt_rounded, 'Consumo adesso', '0,8 kW'),
            const SizedBox(height: 12),
            tessera(Icons.water_drop_rounded, 'Umidità', '48%'),
          ],
        ),
      ),
    );
  }
}

void main() {
  setUpAll(_iCaratteri);

  /* Le misure in punti, e due pixel per punto. */
  const schermi = {'telefono': Size(390, 844), 'tablet': Size(1180, 820)};

  late List<LeNoteDiUnaVersione> note;
  setUpAll(() async {
    note = leNoteDelChangelog(await File('CHANGELOG.md').readAsString());
  });

  for (final scuro in [false, true]) {
    final tinta = scuro ? 'scuro' : 'chiaro';
    for (final schermo in schermi.entries) {
      testWidgets('la scheda, ${schermo.key}, $tinta', (tester) async {
        tester.view.physicalSize = schermo.value * 2;
        tester.view.devicePixelRatio = 2;
        addTearDown(tester.view.reset);
        await tester.pumpWidget(
          MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: scuro ? temaScuro() : temaChiaro(),
            builder: (context, schermata) =>
                SfondoVivo(child: schermata ?? const SizedBox.shrink()),
            home: const _LaCasaSotto(),
          ),
        );
        /* Chi ha saltato una versione: c'e' anche il link. */
        final precedente = note
            .firstWhere(
              (una) =>
                  confrontaLeVersioni(una.versione, versioneDiQuestApp) < 0,
            )
            .versione;
        final cosa = cosaMostrareAllApertura(
          vista: note
              .where((una) => confrontaLeVersioni(una.versione, precedente) < 0)
              .first
              .versione,
          adesso: versioneDiQuestApp,
          note: note,
        )!;
        unawaited(
          apriLaSchedaDelleNovita(
            tester.element(find.byType(_LaCasaSotto)),
            cosa: cosa,
            versioniPrecedenti: () {},
          ),
        );
        await tester.pump();
        await tester.pump(const Duration(seconds: 1));
        await expectLater(
          find.byType(MaterialApp),
          matchesGoldenFile('$_cartella/novita-${schermo.key}-$tinta.png'),
        );
      });
    }

    testWidgets('la pagina «Novità», telefono, $tinta', (tester) async {
      tester.view.physicalSize = schermi['telefono']! * 2;
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      final impostazioni = Impostazioni(
        sulTelefono: true,
        android: true,
        dispensa: DispensaInMemoria(),
      );
      await impostazioni.carica();
      /* Sincrono: una lettura vera nel tempo finto della prova non finisce. */
      final testo = File('CHANGELOG.md').readAsStringSync();
      final novita = LeNovitaDellApp(
        impostazioni: impostazioni,
        note: () async => testo,
      );
      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: scuro ? temaScuro() : temaChiaro(),
          builder: (context, schermata) =>
              SfondoVivo(child: schermata ?? const SizedBox.shrink()),
          home: SchermataDelleImpostazioniDellApp(
            impostazioni: impostazioni,
            guardia: const NessunaGuardia(),
            novita: novita,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/novita-impostazioni-$tinta.png'),
      );
      await tester.tap(find.byKey(const Key('impostazioni-novita')));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/novita-pagina-$tinta.png'),
      );
    });
  }
}
