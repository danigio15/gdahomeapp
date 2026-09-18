/// Quando il centralino dice che la casa non c'è, lo si legge subito.
///
/// La segnalazione: «in locale se premo apri da browser resta bloccato non si
/// apre poi esce così» — e la fotografia mostrava venticinque secondi di
/// rotella e poi «Non trovo la casa · gdahome in casa non risponde».
///
/// Quella frase è la **nostra** scadenza, e dice una cosa che non è successa.
/// Il centralino aveva risposto benissimo: aveva accettato il filo e l'aveva
/// chiuso subito dicendo «casa non collegata», cioè che l'add-on in casa non
/// gli è attaccato. Quella risposta c'era dopo un secondo, e restava
/// nell'attesa: chi guardava lo schermo aspettava venticinque secondi per
/// leggere un'altra cosa, e andava a cercare il difetto nel telefono.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/parole.dart';
import 'package:gdahome/ponte/errori.dart';
import 'package:gdahome/ponte/filo.dart';
import 'package:gdahome/ponte/parole_del_centralino.dart';

import 'ponte_finto.dart';

void main() {
  late PonteFinto ponte;

  setUp(() async {
    laLingua = Lingua.italiano;
    ponte = await PonteFinto.alza();
  });
  tearDown(() async {
    laLingua = Lingua.italiano;
    await ponte.spegni();
  });

  Filo filoCon() => Filo.fisso(
    indirizzo: ponte.indirizzo,
    segno: segnoBuono,
    chi: chiBuono,
    chiave: chiaveBuona,
    attesaMassima: const Duration(milliseconds: 80),
  );

  test(
    'chi aspetta di entrare legge il perché, e non la nostra scadenza',
    () async {
      ponte.chiudeSubitoDicendo = 'casa non collegata';
      final filo = filoCon();

      /* La scadenza è larga apposta: se l'attesa si sciogliesse solo lì, questa
     * prova durerebbe due secondi e la risposta sarebbe quella sbagliata. */
      await expectLater(
        filo.apri(entro: const Duration(seconds: 2)),
        throwsA(
          isA<ErroreDelPonte>().having(
            (uno) => uno.spiegazione,
            'spiegazione',
            'la tua casa non è collegata al centralino',
          ),
        ),
      );

      expect(filo.dentro, isFalse);
      await filo.chiudi();
    },
  );

  test('e la risposta arriva appena il centralino chiude', () async {
    ponte.chiudeSubitoDicendo = 'casa non collegata';
    final filo = filoCon();
    final cronometro = Stopwatch()..start();

    await filo
        .apri(entro: const Duration(seconds: 5))
        .then<void>(
          (_) => fail('non doveva entrare'),
          onError: (Object _) => cronometro.stop(),
        );

    expect(
      cronometro.elapsed,
      lessThan(const Duration(seconds: 2)),
      reason: 'non si aspetta la scadenza per dire una cosa già saputa',
    );
    await filo.chiudi();
  });

  test(
    'i tentativi vanno avanti: una casa che si riattacca entra da sola',
    () async {
      ponte.chiudeSubitoDicendo = 'casa non collegata';
      final filo = filoCon();

      await expectLater(
        filo.apri(entro: const Duration(seconds: 2)),
        throwsA(isA<ErroreDelPonte>()),
      );
      final finQui = ponte.collegamenti;

      /* La casa torna: da qui in poi il centralino la passa. */
      ponte.chiudeSubitoDicendo = null;
      await Future<void>.delayed(const Duration(milliseconds: 600));

      expect(ponte.collegamenti, greaterThan(finQui));
      expect(filo.dentro, isTrue, reason: 'si è ripreso da sé');
      await filo.chiudi();
    },
  );

  test('la caduta resta scritta in diagnostica, in parole nostre', () async {
    ponte.chiudeSubitoDicendo = 'casa non collegata';
    final filo = filoCon();

    await filo
        .apri(entro: const Duration(seconds: 2))
        .catchError((Object _) {});

    expect(
      filo.ultimeCadute.first,
      'la tua casa non è collegata al centralino',
    );
    await filo.chiudi();
  });

  group('le parole del centralino', () {
    test('quelle che si conoscono diventano frasi', () {
      expect(
        inParoleNostre('casa non collegata'),
        'la tua casa non è collegata al centralino',
      );
      expect(
        inParoleNostre("la casa si e' scollegata"),
        'la tua casa si è scollegata dal centralino',
      );
      laLingua = Lingua.inglese;
      expect(
        inParoleNostre('casa non collegata'),
        'your home is not connected to the relay',
      );
    });

    test('quelle che non si conoscono passano come sono', () {
      /* Un centralino più nuovo di questa app può dire cose che qui non ci
       * sono: ripeterle è sempre meglio che inventarne una traduzione. */
      expect(
        inParoleNostre('una cosa che non sappiamo'),
        'una cosa che non sappiamo',
      );
      expect(inParoleNostre('  spazi intorno  '), 'spazi intorno');
    });
  });
}
