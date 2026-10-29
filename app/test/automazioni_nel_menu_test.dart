/// La voce «Automazioni» del menu: dove sta, cosa apre, e com'e' con e senza
/// Premium.
///
/// Prima era una voce spenta fra le Avanzate, che un giorno avrebbe aperto le
/// automazioni di Home Assistant. Adesso apre le nostre — la pagina
/// Automazioni della plancia, a schermo pieno — e sta in testa alle Avanzate,
/// col bollino PREMIUM; senza Premium ha il lucchetto, come la Configurazione
/// e Zigbee.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/schermate/barra.dart';
import 'package:gdahome/schermate/da_parte.dart';
import 'package:gdahome/schermate/menu.dart';
import 'package:gdahome/schermate/riquadro/pagine.dart';
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
          sezioni: vociDellaBarra(chiAmministra: true),
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
  test('sta in testa alle Avanzate, ed e\' pronta', () {
    expect(Sezione.automazioni.gruppo, GruppoDellaBarra.avanzate);
    expect(Sezione.automazioni.pronta, isTrue);
    final avanzate = vociDellaBarra(
      chiAmministra: true,
      conLaConsole: true,
      conIlCruscotto: true,
      conLaGestione: true,
      conZigbee: true,
    ).where((s) => s.gruppo == GruppoDellaBarra.avanzate).toList();
    expect(avanzate.first, Sezione.automazioni);
  });

  test('c\'e\' anche nella webapp: la pagina e\' della plancia', () {
    expect(Sezione.automazioni.soloNellApp, isFalse);
    expect(
      vociDellaBarra(chiAmministra: true, nellApp: false),
      contains(Sezione.automazioni),
    );
  });

  test('Dispositivi, Aiutanti e Automazioni: solo per chi amministra', () {
    /* «Tutte queste cose devono essere visibili e configurabili solo da
     * admin.» Agli altri la voce non c'e' proprio. */
    const sue = [Sezione.dispositivi, Sezione.aiutanti, Sezione.automazioni];
    for (final nellApp in [true, false]) {
      final altri = vociDellaBarra(nellApp: nellApp);
      final suoi = vociDellaBarra(chiAmministra: true, nellApp: nellApp);
      for (final una in sue) {
        expect(
          altri,
          isNot(contains(una)),
          reason: '$una a chi non amministra',
        );
        expect(suoi, contains(una), reason: '$una a chi amministra');
      }
      expect(suoi.length - altri.length, sue.length);
    }
  });

  test('ha il suo disegno, la sveglia con le stelline', () {
    expect(Sezione.automazioni.disegno, 'automazioni');
    expect(disegniDegliOggetti, contains('automazioni'));
    expect(File('assets/oggetti/automazioni.svg').existsSync(), isTrue);
  });

  test('le voci Premium: dispositivi, configurazione, automazioni, zigbee, aiutanti, salute', () {
    expect(Sezione.values.where((s) => s.diPremium).toSet(), {
      Sezione.dispositivi,
      Sezione.configurazione,
      Sezione.automazioni,
      Sezione.zigbee,
      Sezione.aiutanti,
      /* «devi metterle come premium su app questa funzione» */
      Sezione.salute,
    });
    final casa = File('lib/schermate/home.dart').readAsStringSync();
    final bloccate = casa.substring(casa.indexOf('Set<Sezione> get _bloccate'));
    expect(bloccate.substring(0, 300), contains('una.diPremium'));
    expect(casa, contains('PerchePremium.automazioni'));
    expect(casa, contains('PerchePremium.salute'));
  });

  test('apre la pagina della plancia con la sua maniglia, sul telefono e nel browser', () {
    /* Le maniglie e i messaggi stanno in `pagine.dart`, per le tre pagine
     * della plancia a schermo pieno; sul telefono si tirano, nel browser si
     * tirano o si bussa. */
    expect(PaginaDellaPlancia.automazioni.apri, 'gdahomeApriLeAutomazioni');
    expect(
      PaginaDellaPlancia.automazioni.torna,
      'gdahomeTornaDalleAutomazioni',
    );
    expect(
      PaginaDellaPlancia.automazioni.bussaPerAprire,
      'apri-le-automazioni',
    );
    expect(
      PaginaDellaPlancia.automazioni.bussaPerTornare,
      'torna-dalle-automazioni',
    );
    expect(PaginaDellaPlancia.dispositivi.apri, 'gdahomeApriIDispositivi');
    expect(PaginaDellaPlancia.aiutanti.apri, 'gdahomeApriGliAiutanti');
    final telefono = File('lib/schermate/riquadro/sul_telefono.dart')
        .readAsStringSync();
    expect(telefono, contains(r"'!!(window.$maniglia&&window.$maniglia())'"));
    expect(telefono, contains(r"'window.$maniglia&&window.$maniglia()'"));
    final browser = File('lib/schermate/riquadro/sul_web.dart')
        .readAsStringSync();
    expect(browser, contains('_tira(pagina.apri, pagina.bussaPerAprire)'));
    expect(browser, contains('_tira(pagina.torna, pagina.bussaPerTornare)'));
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
    /* Dispositivi, Configurazione, Automazioni, Aiutanti e Salute: Zigbee
     * c'e' solo dove c'e' la rete. */
    expect(find.byKey(const Key('bollino-premium')), findsNWidgets(5));

    final chiusa = GlobalKey<BarraDelleSezioniState>();
    await prova.pumpWidget(
      _conLaBarra(
        chiusa,
        bloccate: {
          for (final una in Sezione.values)
            if (una.diPremium) una,
        },
      ),
    );
    chiusa.currentState!.apri();
    await prova.pumpAndSettle();
    expect(find.byKey(const Key('bollino-premium')), findsNothing);
    expect(find.byIcon(Icons.lock_rounded), findsNWidgets(5));
  });
}
