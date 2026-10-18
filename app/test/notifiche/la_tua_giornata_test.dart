/// «La tua giornata»: la risposta del ponte letta con pazienza, le sezioni
/// che ci sono solo coi loro numeri, il `premium-richiesto` di una casa Base,
/// e i tasti del riepilogo della sera.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/notifiche/giornata.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/ponte/errori.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/la_tua_giornata.dart';
import 'package:gdahome/schermate/premium.dart';

import '../ponte/ponte_finto.dart';
import 'giornata_di_prova.dart';

Future<Collegamento> _casaCollegata(PonteFinto ponte) async {
  final archivio = ArchivioDelleCase(CassaforteInMemoria());
  await archivio.apri();
  await archivio.aggiungi(
    nome: 'Casa mia',
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
  return collegamento;
}

/// Solo l'energia: niente clima, niente auto, niente acqua calda.
const _soloEnergia = {
  'giornata': {
    'd': '2026-10-18',
    'sole': 18.4,
    'casa': 11.6,
    'presi': 3.1,
    'ceduti': 4.8,
    'quotaInCasa': 0.74,
    'euroRete': 0.52,
    'risparmio': 2.41,
    'picco': 4.9,
    'piccoIl': '13:10',
    'p': [0, 0, 10, 40, 49, 30, 5, 0],
    'c': [4, 5, 8, 9, 12, 20, 14, 6],
  },
  'conSole': true,
  'clima': null,
  'riscaldamento': null,
  'solareTermico': null,
  'auto': null,
  'acqua': null,
  'eventi': null,
  'conti': null,
  'mese': null,
  'confronto': null,
  'daSistemare': null,
  'inBreve': null,
};

Widget _inUnaPagina(Widget dentro) => MaterialApp(
  home: Scaffold(body: SingleChildScrollView(child: dentro)),
);

void main() {
  group('la risposta del ponte', () {
    test('si legge tutta, coi numeri gia\' in kWh', () {
      final g = GiornataDellaCasa.leggi(giornataDiProva);
      expect(g.vuota, isFalse);
      expect(g.energia!.sole, 18.4);
      expect(g.energia!.prodotta[13], closeTo(4.9, 1e-9));
      expect(g.piu.first.nome, 'Pompa di calore');
      expect(g.clima!.stanze, hasLength(3));
      expect(g.solareTermico!.pompaDa, '09:05');
      expect(g.auto.single.viaggi, hasLength(3));
      expect(g.auto.single.kmStimati, isTrue);
      expect(g.inBreve, hasLength(4));
      expect(g.batteria!.stasera, 62);
    });

    test('vuota, o fatta male, non solleva e non mostra niente', () {
      expect(GiornataDellaCasa.leggi({'giornata': null}).vuota, isTrue);
      expect(GiornataDellaCasa.leggi(null).vuota, isTrue);
      final strana = GiornataDellaCasa.leggi({
        'giornata': 'non una mappa',
        'clima': {'stanze': 'nessuna'},
        'auto': [3, 'x'],
        'eventi': [
          {'ora': 'adesso', 'testo': 'senza ora'},
        ],
        'batteria': {'stasera': 'tanta'},
        'inBreve': [
          {'icona': 'sole'},
        ],
      });
      expect(strana.vuota, isTrue);
    });

    test('la batteria di un ponte di prima e\' un numero solo', () {
      final g = GiornataDellaCasa.leggi({'batteria': 58});
      expect(g.batteria!.stasera, 58);
      expect(g.batteria!.caricata, isNull);
    });
  });

  group('le sezioni', () {
    testWidgets('senza i loro numeri, le sezioni non ci sono', (tester) async {
      await tester.pumpWidget(
        _inUnaPagina(
          PaginaDellaGiornata(
            giornata: GiornataDellaCasa.leggi(_soloEnergia),
            tuttaLunga: true,
          ),
        ),
      );
      expect(find.byKey(const Key('sezione-testa')), findsOneWidget);
      expect(find.byKey(const Key('sezione-ora-per-ora')), findsOneWidget);
      expect(find.byKey(const Key('sezione-soldi')), findsOneWidget);
      for (final assente in [
        'sezione-in-breve',
        'sezione-consumi',
        'sezione-batteria',
        'sezione-temperature',
        'sezione-riscaldamento',
        'sezione-solare-termico',
        'sezione-auto-0',
        'sezione-acqua',
        'sezione-casa',
        'sezione-domani',
        'sezione-da-sistemare',
      ]) {
        expect(find.byKey(Key(assente)), findsNothing, reason: assente);
      }
      /* E nemmeno i titoli dei loro gruppi. */
      expect(find.text('CLIMA DI CASA'), findsNothing);
      expect(find.text('ACQUA CALDA'), findsNothing);
      expect(find.text('AUTO E CONSUMI'), findsNothing);
      expect(find.text('ENERGIA'), findsOneWidget);
      /* Dal ponte di prima il confronto si fa col sole di ieri: qui non
       * c'e', e allora niente. */
      expect(find.byKey(const Key('sezione-confronto')), findsNothing);
    });

    testWidgets('con tutto, ci sono tutte, nell\'ordine del disegno', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(412 * 3, 9000 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        _inUnaPagina(
          PaginaDellaGiornata(
            giornata: GiornataDellaCasa.leggi(giornataDiProva),
            tuttaLunga: true,
          ),
        ),
      );
      final ordine = [
        'sezione-testa',
        'sezione-in-breve',
        'sezione-ora-per-ora',
        'sezione-consumi',
        'sezione-soldi',
        'sezione-batteria',
        'sezione-temperature',
        'sezione-riscaldamento',
        'sezione-solare-termico',
        'sezione-auto-0',
        'sezione-acqua',
        'sezione-casa',
        'sezione-confronto',
        'sezione-domani',
        'sezione-da-sistemare',
      ];
      var prima = -1.0;
      for (final chiave in ordine) {
        final trovata = find.byKey(Key(chiave));
        expect(trovata, findsOneWidget, reason: chiave);
        final y = tester.getTopLeft(trovata).dy;
        expect(y, greaterThan(prima), reason: '$chiave fuori posto');
        prima = y;
      }
      expect(tester.takeException(), isNull);
      /* I km stimati si scrivono col «circa». */
      expect(find.text('≈ 82 km'), findsOneWidget);
      /* Il record del mese, in parole. */
      expect(find.text('Il giorno più solare di ottobre'), findsOneWidget);
    });

    testWidgets('i km misurati si scrivono senza «≈»', (tester) async {
      await tester.pumpWidget(
        _inUnaPagina(
          PaginaDellaGiornata(
            giornata: GiornataDellaCasa.leggi({
              'auto': [
                {'nome': 'Auto', 'km': 40, 'usatiKwh': 7.0},
              ],
            }),
            tuttaLunga: true,
          ),
        ),
      );
      expect(find.text('40 km'), findsOneWidget);
      expect(find.textContaining('≈'), findsNothing);
    });

    testWidgets('niente calore preso se il ponte non lo sa', (tester) async {
      await tester.pumpWidget(
        _inUnaPagina(
          PaginaDellaGiornata(
            giornata: GiornataDellaCasa.leggi({
              'solareTermico': {
                'collettore': {'max': 70, 'maxAlle': '13:00'},
                'bollitore': {'max': 55, 'maxAlle': '15:00'},
                'caloreKwh': null,
                'euro': null,
              },
            }),
            tuttaLunga: true,
          ),
        ),
      );
      expect(find.byKey(const Key('sezione-solare-termico')), findsOneWidget);
      expect(find.text('CALORE PRESO'), findsNothing);
      expect(find.text('BOLLITORE'), findsOneWidget);
    });
  });

  group('premium-richiesto', () {
    testWidgets('la pagina spiega, e dice che si compra solo dagli store', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: SchermataDellaGiornata(
            chiedi: () async => throw const PremiumRichiesto('Base'),
          ),
        ),
      );
      await tester.pump();
      expect(find.byKey(const Key('spiegazione-premium')), findsOneWidget);
      expect(find.byKey(const Key('premium-solo-dagli-store')), findsOneWidget);
      expect(find.text(PerchePremium.giornata), findsOneWidget);
      expect(find.byKey(const Key('sezione-testa')), findsNothing);
    });

    testWidgets('con la giornata, la pagina la mostra', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: SchermataDellaGiornata(
            chiedi: () async => GiornataDellaCasa.leggi(_soloEnergia),
          ),
        ),
      );
      await tester.pump();
      expect(find.byKey(const Key('sezione-testa')), findsOneWidget);
      expect(find.byKey(const Key('spiegazione-premium')), findsNothing);
    });

    testWidgets('dal ponte vero: Base e\' un PremiumRichiesto, Premium i '
        'numeri', (tester) async {
      late PonteFinto ponte;
      late Collegamento collegamento;
      await tester.runAsync(() async {
        ponte = await PonteFinto.alza();
        collegamento = await _casaCollegata(ponte);
      });
      ponte.giornataPremium = false;
      final no = await tester.runAsync(() async {
        try {
          await chiediLaGiornata(collegamento.filo!);
          return null;
        } catch (errore) {
          return errore;
        }
      });
      expect(no, isA<PremiumRichiesto>());
      ponte
        ..giornataPremium = true
        ..giornata = Map<String, dynamic>.from(giornataDiProva);
      final si = await tester.runAsync(
        () => chiediLaGiornata(collegamento.filo!),
      );
      expect(si!.energia!.sole, 18.4);
      expect(
        ponte.chieste.map((una) => una['type']),
        contains('ponte/energia/giornata'),
      );
      await tester.runAsync(() async {
        await collegamento.chiudi();
        await ponte.spegni();
      });
    });
  });

  group('i tasti del riepilogo', () {
    Map<String, dynamic> riepilogo(List<Map<String, dynamic>> azioni) => {
      'v': 1,
      'id': 'r1',
      'tipo': 'riepilogo',
      'cat': 'manutenzione',
      'titolo': 'La tua giornata · 18,4 kWh dal sole',
      'testo': '',
      'quando': 0,
      'scade': 1,
      'azioni': azioni,
    };

    test('«Apri la giornata» e «OK», anche da un ponte di prima', () {
      for (final azioni in [
        [
          {'id': 'giornata', 'etichetta': 'Apri la giornata', 'apre': true},
          {'id': 'ok', 'etichetta': 'OK'},
        ],
        [
          {'id': 'energia', 'etichetta': 'Apri Energia', 'apre': true},
        ],
      ]) {
        final letta = NotificaArrivata.leggi(riepilogo(azioni))!;
        expect(letta.tasti.map((t) => t.id), ['giornata', 'ok']);
        expect(letta.tasti.first.apre, isTrue);
        expect(letta.tasti.last.chiude, isTrue);
        expect(letta.apreLaGiornata, isTrue);
      }
    });

    test('il riepilogo di Base («Batterie da cambiare») resta semplice', () {
      final letta = NotificaArrivata.leggi({
        ...riepilogo(const []),
        'titolo': '🔋 Batterie da cambiare',
        'sempre': true,
      })!;
      expect(letta.tasti, isEmpty);
      expect(letta.apreLaGiornata, isFalse);
      expect(letta.elaborata, isFalse);
    });
  });
}
