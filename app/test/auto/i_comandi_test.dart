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

  test('scritti e riletti sono gli stessi, e sono al massimo sei', () {
    final tanti = [
      for (var i = 0; i < 9; i++) comandoPer(e('light.l$i', nome: 'Luce $i'))!,
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
          azioni: () async => const [],
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('1 di 6 scelti'), findsOneWidget);
    expect(find.text('Cancello'), findsWidgets);

    /* Senza casa collegata non c'e' altro da aggiungere; si toglie. */
    await tester.tap(find.byType(Switch).first);
    await tester.pumpAndSettle();
    expect(scritti?.comandi, isEmpty);
    expect(find.text('0 di 6 scelti'), findsOneWidget);
  });
}
