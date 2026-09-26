/// Le prove dei comandi rapidi in auto: cosa si puo' scegliere, come si
/// scrive, e che il tasto premuto in macchina trovi la sua ricetta.
library;

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/auto/i_comandi.dart';
import 'package:gdahome/auto/la_foto.dart';
import 'package:gdahome/casa/entita.dart';
import 'package:gdahome/schermate/comandi_in_auto.dart';

Entita e(String id, {String stato = 'off', String? nome, String? classe}) =>
    Entita(
      id: id,
      stato: stato,
      attributi: {'friendly_name': ?nome, 'device_class': ?classe},
    );

void main() {
  final casa = [
    e('cover.cancello', nome: 'Cancello', classe: 'gate', stato: 'closed'),
    e('cover.box', nome: 'Box', classe: 'garage', stato: 'closed'),
    e('scene.arrivo', nome: 'Arrivo a casa'),
    e('light.ingresso', nome: 'Luci ingresso'),
    e('lock.porta', nome: 'Porta di casa', stato: 'locked'),
    e('sensor.temperatura', nome: 'Temperatura', stato: '21'),
    e('alarm_control_panel.casa', nome: 'Allarme', stato: 'armed_away'),
    e('switch.muta', nome: 'Muta', stato: 'unavailable'),
  ];

  test('si possono scegliere le cose che si premono, e solo quelle', () {
    final comandi = iComandiDellaCasa(casa);
    final id = comandi.map((c) => c.ricetta.entita).toSet();
    expect(id, {
      'cover.cancello',
      'cover.box',
      'scene.arrivo',
      'light.ingresso',
      'lock.porta',
    }, reason: 'niente sensori, niente allarme (vuole un codice), niente muti');
    final cancello = comandi.firstWhere((c) => c.nome == 'Cancello');
    expect(cancello.genere, GenereDelComando.varco);
    expect(cancello.ricetta.servizio, 'toggle');
    expect(cancello.provenienza, 'Cancello');
    final porta = comandi.firstWhere((c) => c.nome == 'Porta di casa');
    expect(porta.ricetta.servizio, 'unlock');
    expect(porta.conferma, isTrue, reason: 'una serratura chiede conferma');
    expect(
      comandi.firstWhere((c) => c.nome == 'Arrivo a casa').ricetta.servizio,
      'turn_on',
    );
  });

  test('la prima volta: azioni della plancia, cancello e garage', () {
    final azione = ComandoRapido(
      id: '3|Irrigazione',
      nome: 'Irrigazione',
      genere: GenereDelComando.azione,
      provenienza: 'Azione rapida',
      ricetta: const RicettaDellAzione(
        id: '3|Irrigazione',
        dominio: 'script',
        servizio: 'turn_on',
        entita: 'script.irriga',
      ),
    );
    final primi = iPrimiComandi(
      azioni: [azione],
      dellaCasa: iComandiDellaCasa(casa),
    );
    expect(primi.comandi.map((c) => c.nome), [
      'Irrigazione',
      'Cancello',
      'Box',
    ]);
    expect(primi.quelloDellArrivo?.nome, 'Cancello');
  });

  test('scritti e riletti sono gli stessi, e sono al massimo dodici', () {
    final tanti = [
      for (var i = 0; i < 14; i++) comandoPer(e('light.l$i', nome: 'Luce $i'))!,
    ];
    final scritti = IComandiScelti(
      comandi: tanti,
      allArrivo: tanti.first.id,
    ).comeSiScrive;
    final letti = IComandiScelti.leggi(scritti);
    expect(letti.comandi.length, comandiAlMassimo);
    expect(letti.comandi.first.nome, 'Luce 0');
    expect(letti.allArrivo, tanti.first.id);
    /* Il servizio dell'auto legge gli stessi campi: nome, genere, conferma. */
    final grezzo = jsonDecode(scritti) as Map;
    final primo = (grezzo['comandi'] as List).first as Map;
    expect(primo['nome'], 'Luce 0');
    expect(primo['genere'], 'luce');
    expect(grezzo['arrivo'], tanti.first.id);
  });

  test('un file rotto o un arrivo che non c\'è non rompono niente', () {
    expect(IComandiScelti.leggi('non e json').comandi, isEmpty);
    final senza = IComandiScelti.leggi(
      jsonEncode({
        'comandi': [
          {'id': 'x', 'nome': 'X', 'servizio': 'toggle', 'entita': 'light.x'},
        ],
        'arrivo': 'sparito',
      }),
    );
    expect(senza.comandi.single.nome, 'X');
    expect(senza.allArrivo, isNull);
  });

  test('il tasto premuto in macchina trova la ricetta del comando', () {
    final scelti = IComandiScelti(comandi: [comandoPer(casa.first)!]);
    final ricetta = laRicettaDi('c|cover.cancello|toggle', scelti.ricette);
    expect(ricetta?.entita, 'cover.cancello');
    expect(ricetta?.servizio, 'toggle');
  });

  test('le azioni rapide della plancia, solo quelle che partono da sole', () {
    final foto = jsonEncode({
      'azioni': [
        {'id': '1|Cancello', 'nome': 'Cancello', 'subito': true},
        {'id': '2|Guarda', 'nome': 'Guarda le telecamere', 'subito': false},
      ],
    });
    final azioni = leAzioniDellaPlancia(foto, const [
      RicettaDellAzione(
        id: '1|Cancello',
        dominio: 'cover',
        servizio: 'toggle',
        entita: 'cover.cancello',
      ),
    ]);
    expect(azioni.map((a) => a.nome), ['Cancello']);
  });

  testWidgets('la schermata: si toglie, si aggiunge, si sceglie l\'arrivo', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    IComandiScelti? scritti;
    final dellaCasa = iComandiDellaCasa(casa);
    await tester.pumpWidget(
      MaterialApp(
        home: ComandiInAuto(
          leggi: () async => IComandiScelti(
            comandi: [dellaCasa.firstWhere((c) => c.nome == 'Cancello')],
          ),
          scrivi: (s) async {
            scritti = s;
            return true;
          },
          azioni: () async => const AzioniDellaPlancia([]),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('1 / $comandiAlMassimo'), findsOneWidget);
    expect(find.text('Cancello'), findsWidgets);

    /* Si toglie. */
    await tester.tap(find.byTooltip('Togli'));
    await tester.pumpAndSettle();
    expect(scritti?.comandi, isEmpty);
    expect(find.text('0 / $comandiAlMassimo'), findsOneWidget);
  });

  testWidgets('si crea un comando: dispositivo, cosa fa, nome, conferma', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    IComandiScelti? scritti;
    await tester.pumpWidget(
      MaterialApp(
        home: ComandiInAuto(
          leggi: () async => const IComandiScelti(),
          scrivi: (s) async {
            scritti = s;
            return true;
          },
          azioni: () async => const AzioniDellaPlancia([]),
          entita: casa,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Crea un comando'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Box').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Chiudi'));
    await tester.enterText(find.byType(TextField).last, 'Chiudi il box');
    await tester.tap(find.text('Aggiungi in auto'));
    await tester.pumpAndSettle();
    final c = scritti!.comandi.single;
    expect(c.nome, 'Chiudi il box');
    expect(c.ricetta.servizio, 'close_cover');
    expect(c.ricetta.entita, 'cover.box');
    expect(c.provenienza, 'Creato da te');
  });

  test('le azioni della plancia arrivano tutte, dalla configurazione', () {
    final lette = leAzioniDellaConfigurazione({
      'cd_quick_actions': jsonEncode([
        for (var i = 0; i < 8; i++) {'name': 'Luce $i', 'entity': 'light.l$i'},
        {'name': 'Porta', 'entity': 'lock.vecchia', 'confirm': 'Sicuro?'},
        {
          'name': 'Giardino',
          'type': 'luci_group',
          'lights': ['light.a', 'light.b'],
        },
        {'name': 'Lettore', 'entity': 'media_player.sala'},
        {'name': 'Modo', 'entity': 'select.modo', 'option': 'Cinema'},
        {'name': 'Modo libero', 'entity': 'select.modo'},
        {'name': 'Tutte le luci', 'type': 'builtin'},
      ]),
      'cd_entity_overrides': jsonEncode({'lock.vecchia': 'lock.porta'}),
    });
    expect(lette.comandi, hasLength(12), reason: 'non piu\' solo sei');
    final porta = lette.comandi.firstWhere((c) => c.nome == 'Porta');
    expect(porta.ricetta.entita, 'lock.porta', reason: 'la sostituzione');
    expect(porta.ricetta.servizio, secondoLoStato);
    expect(porta.conferma, isTrue);
    final giardino = lette.comandi.firstWhere((c) => c.nome == 'Giardino');
    expect(giardino.ricetta.entita, 'light.a,light.b');
    final modo = lette.comandi.firstWhere((c) => c.nome == 'Modo');
    expect(modo.ricetta.dati, {'option': 'Cinema'});
    expect(lette.soloNellaPlancia.map((f) => f.nome), [
      'Modo libero',
      'Tutte le luci',
    ]);
  });

  test('la distanza dell\'arrivo si sceglie, e si ricorda', () {
    final c = comandoPer(casa.first)!;
    final scelti = IComandiScelti(comandi: [c], allArrivo: c.id, metri: 200);
    final letti = IComandiScelti.leggi(scelti.comeSiScrive);
    expect(letti.metri, 200);
    expect(letti.senzaArrivo().metri, 200);
    expect(IComandiScelti.leggi('{"comandi":[]}').metri, metriDiSolito);
    expect(IComandiScelti.leggi('{"metri":99999}').metri, metriDiSolito);
    expect(laDistanza(300), '300 m');
    expect(laDistanza(1000), '1 km');
    expect(laDistanza(1500), '1,5 km');
  });

  testWidgets('la distanza si sceglie sotto il comando dell\'arrivo', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    IComandiScelti? scritti;
    final cancello = comandoPer(casa.first)!;
    await tester.pumpWidget(
      MaterialApp(
        home: ComandiInAuto(
          leggi: () async =>
              IComandiScelti(comandi: [cancello], allArrivo: cancello.id),
          scrivi: (s) async {
            scritti = s;
            return true;
          },
          azioni: () async => const AzioniDellaPlancia([]),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('200 m'),
      200,
      scrollable: find
          .descendant(
            of: find.byType(CustomScrollView),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.tap(find.text('200 m'));
    await tester.pumpAndSettle();
    expect(scritti?.metri, 200);
    expect(scritti?.allArrivo, cancello.id);
  });

  test('il servizio della serratura e del lettore si decide premendo', () {
    expect(ilServizioDiAdesso('lock', 'locked'), 'unlock');
    expect(ilServizioDiAdesso('lock', 'unlocked'), 'lock');
    expect(ilServizioDiAdesso('media_player', 'off'), 'turn_on');
    expect(ilServizioDiAdesso('media_player', 'playing'), 'media_play_pause');
  });

  test('cosa si puo\' fare, per chi crea un comando', () {
    final box = casa.firstWhere((x) => x.id == 'cover.box');
    expect(cosaSiPuoFare(box).map((c) => c.servizio), [
      'toggle',
      'open_cover',
      'close_cover',
    ]);
    expect(
      siPuoComandare(casa.firstWhere((x) => x.dominio == 'sensor')),
      isFalse,
    );
    final fatto = comandoFatto(
      entita: box,
      nome: '',
      servizio: 'open_cover',
      conferma: true,
    );
    expect(fatto.nome, 'Box');
    expect(fatto.conferma, isTrue);
    expect(
      IComandiScelti.leggi(IComandiScelti(comandi: [fatto]).comeSiScrive)
          .comandi
          .single
          .ricetta
          .servizio,
      'open_cover',
    );
  });
}
