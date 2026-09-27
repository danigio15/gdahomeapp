/// Il giorno dei pagamenti: l'app sotto la versione minima si ferma.
///
/// Si provano i tre pezzi: quello che l'app sa della minima (e che ricorda
/// senza rete), la pagina che la copre, e il «no» della casa nella stretta di
/// mano — con il numero che l'app le dice.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/aggiornamento_obbligatorio.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/ponte/errori.dart';
import 'package:gdahome/ponte/presa.dart';
import 'package:gdahome/ponte/stretta.dart';
import 'package:gdahome/versione.dart';

import 'ponte/ponte_finto.dart';

const _questa = 1061100;

VersioneMinima _una({
  required FutureOr<int?> Function() chiedi,
  Dispensa? dispensa,
  bool attiva = true,
}) => VersioneMinima(
  questa: _questa,
  chiedi: () async => chiedi(),
  dispensa: dispensa ?? DispensaInMemoria(),
  attiva: attiva,
);

void main() {
  group('quello che l\'app sa della minima', () {
    test('a zero non si ferma niente', () async {
      final versione = _una(chiedi: () => 0);
      await versione.parti();
      expect(versione.minima, 0);
      expect(versione.bloccata, isFalse);
      versione.dispose();
    });

    test('sopra questa si ferma; alla pari o sotto no', () async {
      for (final (minima, ferma) in [
        (_questa + 1, true),
        (_questa, false),
        (_questa - 1, false),
      ]) {
        final versione = _una(chiedi: () => minima);
        await versione.parti();
        expect(versione.bloccata, ferma, reason: '$minima');
        versione.dispose();
      }
    });

    test('la minima si ricorda: senza rete non si riapre', () async {
      final dispensa = DispensaInMemoria();
      final prima = _una(chiedi: () => _questa + 100, dispensa: dispensa);
      await prima.parti();
      expect(prima.bloccata, isTrue);
      prima.dispose();

      /* Un'altra accensione, senza rete: la risposta non arriva. */
      final dopo = _una(chiedi: () => null, dispensa: dispensa);
      await dopo.parti();
      expect(dopo.minima, _questa + 100);
      expect(dopo.bloccata, isTrue);

      /* E il centralino che torna a zero la riapre. */
      final riaperta = _una(chiedi: () => 0, dispensa: dispensa);
      await riaperta.parti();
      expect(riaperta.bloccata, isFalse);
      dopo.dispose();
      riaperta.dispose();
    });

    test(
      'spenta — nel browser, nelle prove — non chiede e non ferma',
      () async {
        var chiesto = 0;
        final versione = _una(
          chiedi: () {
            chiesto += 1;
            return _questa + 1;
          },
          attiva: false,
        );
        await versione.parti();
        await versione.chiedi();
        versione.laCasaHaDettoDiNo(_questa + 1);
        expect(chiesto, 0);
        expect(versione.bloccata, isFalse);
        versione.dispose();
      },
    );

    test('nelle prove, di serie, e\' spenta', () {
      expect(siControllaDaSe, isFalse);
      expect(laVersioneMinima.attiva, isFalse);
    });

    test('il no della casa ferma subito, e la sua minima si ricorda', () async {
      final dispensa = DispensaInMemoria();
      final versione = _una(chiedi: () => null, dispensa: dispensa);
      await versione.parti();
      expect(versione.bloccata, isFalse);

      /* Senza minima: per questa volta. */
      versione.laCasaHaDettoDiNo(null);
      expect(versione.bloccata, isTrue);
      expect(versione.minima, 0);

      /* Con la minima: si ricorda come quella del centralino. */
      versione.laCasaHaDettoDiNo(_questa + 5);
      await Future<void>.delayed(Duration.zero);
      final dopo = _una(chiedi: () => null, dispensa: dispensa);
      await dopo.parti();
      expect(dopo.minima, _questa + 5);
      expect(dopo.bloccata, isTrue);
      versione.dispose();
      dopo.dispose();
    });

    test('la risposta di /versioni si legge per gdahome, e solo un intero', () {
      expect(
        minimaDa({
          'gdahome': {'minima': 1070000},
        }),
        1070000,
      );
      for (final no in <Object?>[
        null,
        'x',
        {'gdahome': 3},
        {
          'gdahome': {'minima': '1070000'},
        },
        {
          'gdahome': {'minima': -1},
        },
        {
          'gdanav': {'minima': 1},
        },
      ]) {
        expect(minimaDa(no), isNull, reason: '$no');
      }
    });

    test('i negozi: il Play Store di gdahome, e l\'App Store', () {
      expect(
        indirizzoNelPlayStore.toString(),
        'market://details?id=com.gdahome.gdahome',
      );
      expect(
        paginaDelPlayStore.toString(),
        'https://play.google.com/store/apps/details?id=com.gdahome.gdahome',
      );
      expect(indirizzoNellAppStore.scheme, 'https');
      expect(indirizzoNellAppStore.host, 'apps.apple.com');
    });
  });

  group('la pagina', () {
    Widget lApp(VersioneMinima versione, {Future<void> Function()? apri}) =>
        MaterialApp(
          home: const Scaffold(body: Text('la casa')),
          builder: (context, schermata) => AggiornamentoObbligatorio(
            versione: versione,
            apri: apri,
            child: schermata ?? const SizedBox.shrink(),
          ),
        );

    testWidgets('sotto la minima copre tutto, e il bottone porta al negozio', (
      tester,
    ) async {
      final versione = _una(chiedi: () => _questa + 1);
      await tester.runAsync(versione.parti);
      var aperto = 0;
      await tester.pumpWidget(lApp(versione, apri: () async => aperto += 1));
      await tester.pump();

      expect(find.text('C\'è una versione nuova di gdahome'), findsOneWidget);
      expect(find.textContaining('Aggiornala per continuare'), findsOneWidget);
      expect(find.text('la casa'), findsNothing);
      await tester.tap(find.byType(FilledButton));
      expect(aperto, 1);
      versione.dispose();
    });

    testWidgets('alla pari si vede l\'app, e tornando davanti si richiede', (
      tester,
    ) async {
      var risposta = _questa;
      var chiesto = 0;
      final versione = _una(
        chiedi: () {
          chiesto += 1;
          return risposta;
        },
      );
      await tester.runAsync(versione.parti);
      await tester.pumpWidget(lApp(versione));
      expect(find.text('la casa'), findsOneWidget);
      expect(find.byType(PaginaAggiornala), findsNothing);
      expect(chiesto, 1);

      /* Il giorno dei pagamenti arriva mentre l'app e' in tasca. */
      risposta = _questa + 1;
      await tester.runAsync(() async {
        tester.binding.handleAppLifecycleStateChanged(
          AppLifecycleState.resumed,
        );
        await Future<void>.delayed(const Duration(milliseconds: 20));
      });
      await tester.pump();
      expect(chiesto, 2);
      expect(find.byType(PaginaAggiornala), findsOneWidget);
      versione.dispose();
    });
  });

  group('la stretta di mano', () {
    late PonteFinto ponte;
    setUp(() async => ponte = await PonteFinto.alza());
    tearDown(() async {
      quandoLaCasaDiceAggiorna = null;
      await ponte.spegni();
    });

    test('l\'app dice alla casa che numero e\'', () async {
      final presa = await PresaSuWebSocket.apri(ponte.indirizzo.filo);
      final cifrata = await stringiLaMano(
        presa,
        chi: chiBuono,
        chiaveDelFilo: chiaveBuona,
      );
      expect(ponte.strette.single['app'], costruzioneDiQuestApp);
      /* Chiudere aspetta chi ascolta: qui nessuno, e allora si ascolta. */
      cifrata.messaggi.listen((_) {}, onError: (Object _) {});
      await cifrata.chiudi();
    });

    test('la casa con la minima sopra rifiuta con aggiorna-l-app', () async {
      ponte.versioneMinima = costruzioneDiQuestApp + 1;
      int? detta;
      var avvisata = false;
      quandoLaCasaDiceAggiorna = (minima) {
        avvisata = true;
        detta = minima;
      };
      final presa = await PresaSuWebSocket.apri(ponte.indirizzo.filo);
      await expectLater(
        stringiLaMano(presa, chi: chiBuono, chiaveDelFilo: chiaveBuona),
        throwsA(
          isA<AppDaAggiornare>().having(
            (errore) => errore.minima,
            'minima',
            costruzioneDiQuestApp + 1,
          ),
        ),
      );
      expect(avvisata, isTrue);
      expect(detta, costruzioneDiQuestApp + 1);
    });

    test('anche abbinandosi', () async {
      ponte
        ..versioneMinima = costruzioneDiQuestApp + 1
        ..codiceVivo = 'ABCDEFGHJKMNPQRS';
      final presa = await PresaSuWebSocket.apri(ponte.indirizzo.filo);
      await expectLater(
        stringiLaMano(presa, codice: 'ABCDEFGHJKMNPQRS'),
        throwsA(isA<AppDaAggiornare>()),
      );
    });

    test('alla pari si entra', () async {
      ponte.versioneMinima = costruzioneDiQuestApp;
      final presa = await PresaSuWebSocket.apri(ponte.indirizzo.filo);
      final cifrata = await stringiLaMano(
        presa,
        chi: chiBuono,
        chiaveDelFilo: chiaveBuona,
      );
      /* Chiudere aspetta chi ascolta: qui nessuno, e allora si ascolta. */
      cifrata.messaggi.listen((_) {}, onError: (Object _) {});
      await cifrata.chiudi();
    });
  });
}
