/// Il WHOOP senza rete: la fonte riconosciuta nei campioni di Salute, le
/// risposte dell'API lette e trasformate in misure, e le due strade unite.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/salute/il_corpo.dart';
import 'package:gdahome/salute/lettore_qui/sul_telefono.dart' show tipiDi;
import 'package:gdahome/salute/whoop/whoop.dart';

import 'whoop_finto.dart';

DatiWhoop _iDati() => DatiWhoop.dalleRisposte(
  preso: mattinaWhoop,
  recuperi: recuperiFinti(),
  cicli: cicliFinti(),
  sonni: sonniFinti(),
  allenamenti: allenamentiFinti(),
);

void main() {
  group('senza configurazione: la fonte nei campioni', () {
    test('«WHOOP» si riconosce dal nome o dal pacchetto', () {
      expect(Fonte.daOrigine('WHOOP'), Fonte.whoop);
      expect(Fonte.daOrigine('com.whoop.android'), Fonte.whoop);
      expect(Fonte.daOrigine('Whoop', 'com.whoop.iphone'), Fonte.whoop);
      expect(Fonte.daOrigine('Apple Watch', 'com.apple.health'), isNull);
      expect(Fonte.daOrigine('com.sec.android.app.shealth'), isNull);
      expect(Fonte.daOrigine(null), isNull);
    });

    test("l'ultimo valore si porta dietro la sua fonte", () {
      final ultimo = lUltimo([
        Campione(
          60,
          DateTime(2026, 11, 2, 7),
          DateTime(2026, 11, 2, 7),
          fonte: null,
        ),
        Campione(
          54,
          DateTime(2026, 11, 3, 6),
          DateTime(2026, 11, 3, 6),
          fonte: Fonte.whoop,
        ),
      ]);
      expect(ultimo!.valore, 54);
      expect(ultimo.fonte, Fonte.whoop);
    });

    test('la notte e\' «da WHOOP» solo se l\'ha scritta tutta lui', () {
      final adesso = DateTime(2026, 11, 3, 9);
      Campione tratto(int da, int a, Fonte? fonte) => Campione(
        1,
        DateTime(2026, 11, 2, 23).add(Duration(hours: da)),
        DateTime(2026, 11, 2, 23).add(Duration(hours: a)),
        fonte: fonte,
      );
      final dalWhoop = ilSonnoDiStanotte([
        tratto(0, 3, Fonte.whoop),
        tratto(3, 7, Fonte.whoop),
      ], adesso);
      expect(dalWhoop!.valore, 7 * 60);
      expect(dalWhoop.fonte, Fonte.whoop);
      final mista = ilSonnoDiStanotte([
        tratto(0, 3, Fonte.whoop),
        tratto(3, 7, null),
      ], adesso);
      expect(mista!.fonte, isNull);
    });

    test('recupero e sforzo si vedono solo col WHOOP collegato', () {
      for (final iPhone in [true, false]) {
        expect(siPuoLeggere(MisuraDelCorpo.recupero, iPhone: iPhone), isFalse);
        expect(
          siPuoLeggere(MisuraDelCorpo.sforzo, iPhone: iPhone, whoop: true),
          isTrue,
        );
      }
      expect(
        siPuoLeggere(MisuraDelCorpo.temperaturaPelle, iPhone: false),
        isFalse,
      );
      expect(
        siPuoLeggere(
          MisuraDelCorpo.temperaturaPelle,
          iPhone: false,
          whoop: true,
        ),
        isTrue,
      );
    });

    test(
      'su Android l\'HRV e il respiro aspettano la dichiarazione del negozio',
      () {
        /* I due permessi di Health Connect non sono nel manifesto finche' il
       * Play Console non ha la dichiarazione che li comprende: l'app non li
       * chiede, e li mostra solo se arrivano dal WHOOP collegato. */
        for (final m in [MisuraDelCorpo.hrv, MisuraDelCorpo.respiro]) {
          expect(siPuoLeggere(m, iPhone: true), isTrue);
          expect(siPuoLeggere(m, iPhone: false), isFalse);
          expect(siPuoLeggere(m, iPhone: false, whoop: true), isTrue);
          expect(tipiDi(m, iPhone: false), isEmpty);
          expect(tipiDi(m, iPhone: true), isNotEmpty);
        }
        final manifesto = File('android/app/src/main/AndroidManifest.xml')
            .readAsStringSync();
        final chiesti = RegExp(
          r'<uses-permission[^>]*android\.permission\.health\.(\w+)',
        ).allMatches(manifesto).map((m) => m.group(1)).toSet();
        expect(chiesti, isNot(contains('READ_HEART_RATE_VARIABILITY')));
        expect(chiesti, isNot(contains('READ_RESPIRATORY_RATE')));
      },
    );

    test('su iPhone recupero e sforzo non svegliano nessuno', () {
      expect(
        daOsservareSuIPhone({MisuraDelCorpo.recupero, MisuraDelCorpo.sforzo}),
        isEmpty,
      );
      expect(daOsservareSuIPhone({MisuraDelCorpo.hrv}), {
        'HKQuantityTypeIdentifierHeartRate',
      });
    });
  });

  group("l'API WHOOP letta", () {
    test('recupero, sforzo, notte e allenamenti', () {
      final dati = _iDati();
      expect(dati.recuperi, hasLength(7));
      final r = dati.recupero!;
      expect(r.percento, 78);
      expect(r.zona, ZonaDelRecupero.verde);
      expect(r.hrv, closeTo(48.2, .001));
      expect(r.battitoRiposo, 54);
      expect(dati.sforzo!.sforzo, 12.4);
      expect(dati.sforzo!.fine, isNull);
      expect(dati.sforzo!.kcal, closeTo(9800 / 4.184, .01));
      /* Il pisolino non e' la notte; l'allenamento ancora da calcolare non
       * c'e'. */
      final notte = dati.sonno!;
      expect(notte.dormiti, 230 + 95 + 115);
      expect(notte.prestazione, 88);
      expect(notte.respiro, 14.6);
      expect(dati.allenamenti.single.sport, 'running');
      expect(dati.allenamenti.single.sforzo, 9.8);
    });

    test('le zone: verde da 67, gialla da 34, rossa sotto', () {
      expect(ZonaDelRecupero.di(67), ZonaDelRecupero.verde);
      expect(ZonaDelRecupero.di(66), ZonaDelRecupero.gialla);
      expect(ZonaDelRecupero.di(34), ZonaDelRecupero.gialla);
      expect(ZonaDelRecupero.di(33), ZonaDelRecupero.rossa);
    });

    test('un record storto o non calcolato non diventa un numero', () {
      final dati = DatiWhoop.dalleRisposte(
        preso: mattinaWhoop,
        recuperi: {
          'records': [
            {'score_state': 'PENDING_SCORE', 'created_at': '2026-11-03'},
            {
              'score_state': 'SCORED',
              'created_at': '2026-11-03T06:00:00Z',
              'score': {'recovery_score': '78'},
            },
            {
              'score_state': 'SCORED',
              'created_at': '2026-11-03T06:00:00Z',
              'score': {'recovery_score': 140},
            },
          ],
        },
        cicli: 'non e\' json',
        sonni: null,
        allenamenti: {'records': 'no'},
      );
      expect(dati.recupero, isNull);
      expect(dati.sforzo, isNull);
      expect(dati.sonno, isNull);
      expect(dati.allenamenti, isEmpty);
      expect(dati.perLaSalute(), isEmpty);
    });

    test('le misure della Salute, tutte «da WHOOP»', () {
      final misure = _iDati().perLaSalute();
      expect(misure.keys, {
        MisuraDelCorpo.recupero,
        MisuraDelCorpo.hrv,
        MisuraDelCorpo.battitoRiposo,
        MisuraDelCorpo.ossigeno,
        MisuraDelCorpo.temperaturaPelle,
        MisuraDelCorpo.sforzo,
        MisuraDelCorpo.sonno,
        MisuraDelCorpo.respiro,
      });
      expect(misure.values.map((l) => l.fonte).toSet(), {Fonte.whoop});
      expect(misure[MisuraDelCorpo.recupero]!.valore, 78);
      expect(misure[MisuraDelCorpo.sonno]!.valore, 440);
      /* Lo sforzo del ciclo in corso vale «adesso». */
      expect(misure[MisuraDelCorpo.sforzo]!.quando, mattinaWhoop);
      /* E la casa le accetta come le altre. */
      final perIlPonteOra = perIlPonte(misure, misure.keys.toSet());
      expect(perIlPonteOra['recupero'], {
        'valore': 78.0,
        'quando': '2026-11-03T06:40:00.000Z',
      });
    });

    test('nel portachiavi e ritorno, uguali', () {
      final dati = _iDati();
      final riletti = DatiWhoop.daJson(dati.inJson())!;
      expect(riletti.inJson(), dati.inJson());
      expect(riletti.sonno!.dormiti, dati.sonno!.dormiti);
    });
  });

  group('le due strade insieme', () {
    test('per ogni misura la piu\' nuova; a pari merito il WHOOP', () {
      final ieri = DateTime(2026, 11, 2, 7);
      final oggi = DateTime(2026, 11, 3, 7);
      final unite = unisciColWhoop(
        {
          MisuraDelCorpo.passi: Lettura(4200, oggi),
          MisuraDelCorpo.battitoRiposo: Lettura(57, oggi),
          MisuraDelCorpo.hrv: Lettura(40, oggi),
        },
        {
          MisuraDelCorpo.battitoRiposo: Lettura(54, ieri, fonte: Fonte.whoop),
          MisuraDelCorpo.hrv: Lettura(48, oggi, fonte: Fonte.whoop),
          MisuraDelCorpo.recupero: Lettura(78, oggi, fonte: Fonte.whoop),
          MisuraDelCorpo.sforzo: Lettura(12, oggi, fonte: Fonte.whoop),
        },
        {
          MisuraDelCorpo.passi,
          MisuraDelCorpo.battitoRiposo,
          MisuraDelCorpo.hrv,
          MisuraDelCorpo.recupero,
        },
      );
      expect(unite[MisuraDelCorpo.passi]!.valore, 4200);
      expect(unite[MisuraDelCorpo.battitoRiposo]!.valore, 57);
      expect(unite[MisuraDelCorpo.hrv]!.fonte, Fonte.whoop);
      expect(unite[MisuraDelCorpo.recupero]!.valore, 78);
      /* Lo sforzo non era scelto: non va. */
      expect(unite.containsKey(MisuraDelCorpo.sforzo), isFalse);
    });

    test('le schede: senza niente del WHOOP non ci sono', () {
      final quadro = QuadroWhoop.da(null, {
        MisuraDelCorpo.battitoRiposo: Lettura(57, mattinaWhoop),
        MisuraDelCorpo.sonno: Lettura(420, mattinaWhoop),
      });
      expect(quadro.daMostrare, isFalse);
    });

    test(
      "le schede senza account: quello che l'app WHOOP scrive in Salute",
      () {
        final quadro = QuadroWhoop.da(null, {
          MisuraDelCorpo.battitoRiposo: Lettura(
            55,
            mattinaWhoop,
            fonte: Fonte.whoop,
          ),
          MisuraDelCorpo.hrv: Lettura(46, mattinaWhoop, fonte: Fonte.whoop),
          MisuraDelCorpo.sonno: Lettura(431, mattinaWhoop, fonte: Fonte.whoop),
        });
        expect(quadro.daMostrare, isTrue);
        expect(quadro.recupero, isNull);
        expect(quadro.sforzo, isNull);
        expect(quadro.sonnoDaSalute!.valore, 431);
        expect(quadro.hrv!.valore, 46);
      },
    );

    test("le schede con l'account: recupero, sforzo, notte con le fasi", () {
      final quadro = QuadroWhoop.da(_iDati(), const {});
      expect(quadro.recupero!.percento, 78);
      expect(quadro.settimana, hasLength(7));
      expect(quadro.sforzo!.sforzo, 12.4);
      expect(quadro.allenamento!.sport, 'running');
      expect(quadro.sonno!.prestazione, 88);
      expect(quadro.sonnoDaSalute, isNull);
      expect(quadro.battitoRiposo!.valore, 54);
    });
  });
}
