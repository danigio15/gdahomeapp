/// La voce «Automazioni» del menu: dove sta, cosa apre, e com'e' con e senza
/// Premium.
///
/// Prima era una voce spenta fra le Avanzate, che un giorno avrebbe aperto le
/// automazioni di Home Assistant. Adesso apre le nostre — la pagina
/// Automazioni della plancia, a schermo pieno — e sta nella Casa accanto a
/// «Configurazione plancia», col bollino PREMIUM; senza Premium ha il
/// lucchetto, come la Configurazione e Zigbee.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/schermate/barra.dart';
import 'package:gdahome/schermate/da_parte.dart';
import 'package:gdahome/schermate/menu.dart';
import 'package:gdahome/vestito/oggetti.dart';

class _DaParteFinta extends LaPlanciaDaParte {
  @override
  void siFaDaParte(bool si) {}
}

Widget _conLaBarra(
  GlobalKey<BarraDelleSezioniState> chiave, {
  Set<Sezione> bloccate = const {},
}) => MaterialApp(
  home: Scaffold(
    body: Stack(
      children: [
        BarraDelleSezioni(
          key: chiave,
          sezioni: vociDellaBarra(),
          aperta: Sezione.plancia,
          vai: (_) {},
          vaiAlleCase: () {},
          sopraLaPlancia: true,
          daParte: _DaParteFinta(),
          bloccate: bloccate,
        ),
      ],
    ),
  ),
);

void main() {
  test(
    'sta nella Casa, subito dopo «Configurazione plancia», ed e\' pronta',
    () {
      expect(Sezione.automazioni.gruppo, GruppoDellaBarra.casa);
      expect(Sezione.automazioni.pronta, isTrue);
      final voci = vociDellaBarra();
      expect(
        voci.indexOf(Sezione.automazioni),
        voci.indexOf(Sezione.configurazione) + 1,
      );
    },
  );

  test('c\'e\' anche nella webapp: la pagina e\' della plancia', () {
    expect(Sezione.automazioni.soloNellApp, isFalse);
    expect(vociDellaBarra(nellApp: false), contains(Sezione.automazioni));
  });

  test('ha il suo disegno, la sveglia con le stelline', () {
    expect(Sezione.automazioni.disegno, 'automazioni');
    expect(disegniDegliOggetti, contains('automazioni'));
    expect(File('assets/oggetti/automazioni.svg').existsSync(), isTrue);
  });

  test('senza Premium la voce ha il lucchetto, come la Configurazione', () {
    final casa = File('lib/schermate/home.dart').readAsStringSync();
    final bloccate = casa.substring(casa.indexOf('Set<Sezione> get _bloccate'));
    expect(
      bloccate.substring(0, 500),
      matches(RegExp(r'Sezione\.automazioni\b')),
    );
    expect(casa, contains('PerchePremium.automazioni'));
  });

  test('apre la pagina della plancia con la sua maniglia, sul telefono e nel browser', () {
    final telefono = File('lib/schermate/riquadro/sul_telefono.dart')
        .readAsStringSync();
    expect(telefono, contains('window.gdahomeApriLeAutomazioni'));
    expect(telefono, contains('window.gdahomeTornaDalleAutomazioni'));
    final browser = File('lib/schermate/riquadro/sul_web.dart')
        .readAsStringSync();
    expect(browser, contains("'apri-le-automazioni'"));
    expect(browser, contains("'torna-dalle-automazioni'"));
  });

  testWidgets('col Premium porta il bollino, senza il lucchetto', (
    prova,
  ) async {
    prova.view.physicalSize = const Size(420, 2400);
    prova.view.devicePixelRatio = 1;
    addTearDown(prova.view.reset);
    final chiave = GlobalKey<BarraDelleSezioniState>();
    await prova.pumpWidget(_conLaBarra(chiave));
    chiave.currentState!.apri();
    await prova.pumpAndSettle();
    expect(find.byKey(const Key('bollino-premium')), findsOneWidget);

    final chiusa = GlobalKey<BarraDelleSezioniState>();
    await prova.pumpWidget(
      _conLaBarra(chiusa, bloccate: const {Sezione.automazioni}),
    );
    chiusa.currentState!.apri();
    await prova.pumpAndSettle();
    expect(find.byKey(const Key('bollino-premium')), findsNothing);
    expect(find.byIcon(Icons.lock_rounded), findsOneWidget);
  });
}
