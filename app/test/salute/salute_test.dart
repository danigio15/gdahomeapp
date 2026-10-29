/// La Salute dal telefono: cosa si legge, cosa va alla casa, e quando.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/salute/il_corpo.dart';
import 'package:gdahome/salute/postino_della_salute.dart';

import 'finti.dart';

void main() {
  group('il corpo', () {
    test('il sonno di stanotte: i tratti sovrapposti si contano una volta', () {
      final adesso = DateTime(2026, 10, 29, 10);
      final tratti = [
        /* L'orologio e l'iPhone, la stessa notte. */
        Campione(0, DateTime(2026, 10, 28, 23, 30), DateTime(2026, 10, 29, 3)),
        Campione(
          0,
          DateTime(2026, 10, 29, 2, 30),
          DateTime(2026, 10, 29, 6, 30),
        ),
        /* Il pisolino di ieri pomeriggio non e' stanotte. */
        Campione(0, DateTime(2026, 10, 28, 14), DateTime(2026, 10, 28, 15)),
      ];
      final sonno = ilSonnoDiStanotte(tratti, adesso)!;
      expect(sonno.valore, 7 * 60);
      expect(sonno.quando, DateTime(2026, 10, 29, 6, 30));
      expect(ilSonnoDiStanotte(const [], adesso), isNull);
    });

    test(
      'le percentuali di Apple sono frazioni, quelle di Health Connect no',
      () {
        expect(comePercentuale(0.97), closeTo(97, 0.001));
        expect(comePercentuale(97), 97);
      },
    );

    test('al ponte solo le misure scelte e lette', () {
      final lette = {
        MisuraDelCorpo.passi: Lettura(7842, DateTime.utc(2026, 10, 29, 9, 40)),
        MisuraDelCorpo.peso: Lettura(78.44, DateTime.utc(2026, 10, 28, 7, 5)),
      };
      expect(perIlPonte(lette, {MisuraDelCorpo.passi}), {
        'passi': {'valore': 7842.0, 'quando': '2026-10-29T09:40:00.000Z'},
      });
      expect(
        (perIlPonte(lette, {MisuraDelCorpo.peso})['peso'] as Map)['valore'],
        78.4,
      );
    });

    test(
      'le scelte si scrivono e si rileggono, e un file storto vale niente',
      () {
        final scelte = ScelteDellaSalute(
          acceso: true,
          persona: '  Marco <b> ',
          misure: {MisuraDelCorpo.passi, MisuraDelCorpo.sonno},
          ultimoInvio: DateTime(2026, 10, 29, 9),
        );
        final riletta = ScelteDellaSalute.daQuelloCheCEra(scelte.comeSiScrive);
        expect(riletta.acceso, isTrue);
        expect(riletta.persona, 'Marco b');
        expect(riletta.misure, {MisuraDelCorpo.passi, MisuraDelCorpo.sonno});
        expect(riletta.ultimoInvio, DateTime(2026, 10, 29, 9));
        expect(ScelteDellaSalute.daQuelloCheCEra('{storto').acceso, isFalse);
        expect(ScelteDellaSalute.daQuelloCheCEra(null).misure, misureDiSerie);
      },
    );
  });

  group('il postino', () {
    late LettoreFinto lettore;
    late FiloFinto filo;
    late DateTime adesso;
    late PostinoDellaSalute postino;

    setUp(() {
      lettore = LettoreFinto();
      filo = FiloFinto();
      adesso = LettoreFinto.adesso;
      postino = PostinoDellaSalute(
        lettore: lettore,
        dispensa: DispensaInMemoria(),
        adesso: () => adesso,
      );
    });

    test('spento non legge e non manda niente', () async {
      await postino.forseManda(filo);
      expect(lettore.letture, 0);
      expect(filo.mandati, isEmpty);
    });

    test('acceso chiede il permesso e manda subito, col nome', () async {
      final ok = await postino.accendi(
        filo,
        const ScelteDellaSalute(persona: 'Marco'),
      );
      expect(ok, isTrue);
      expect(lettore.chiesti.single, misureDiSerie);
      final mandato = filo.mandati.single;
      expect(mandato['type'], 'ponte/salute/misure');
      expect(mandato['persona'], 'Marco');
      expect((mandato['misure'] as Map).keys.toSet(), {
        'passi',
        'battito',
        'battitoRiposo',
        'peso',
        'sistolica',
        'diastolica',
        'sonno',
      });
      expect(postino.scelte.acceso, isTrue);
      expect(postino.scelte.ultimoInvio, adesso);
    });

    test('senza permesso resta spento', () async {
      lettore.permesso = false;
      expect(await postino.accendi(filo, const ScelteDellaSalute()), isFalse);
      expect(postino.scelte.acceso, isFalse);
      expect(filo.mandati, isEmpty);
    });

    test('al massimo ogni quarto d\'ora, e solo col filo aperto', () async {
      await postino.accendi(filo, const ScelteDellaSalute());
      await postino.forseManda(filo);
      expect(filo.mandati, hasLength(1));
      adesso = adesso.add(const Duration(minutes: 16));
      filo.aperto = false;
      await postino.forseManda(filo);
      expect(filo.mandati, hasLength(1));
      filo.aperto = true;
      await postino.forseManda(filo);
      expect(filo.mandati, hasLength(2));
    });

    test(
      'una misura in piu\' chiede il permesso per quella, e manda',
      () async {
        await postino.accendi(filo, const ScelteDellaSalute());
        await postino.cambia(
          filo,
          postino.scelte.con(
            misure: {...misureDiSerie, MisuraDelCorpo.ossigeno},
          ),
        );
        expect(lettore.chiesti.last, {MisuraDelCorpo.ossigeno});
        expect(
          (filo.mandati.last['misure'] as Map).containsKey('ossigeno'),
          isTrue,
        );
      },
    );

    test(
      'spento lo dice alla casa, anche se la prima volta il filo era giu\'',
      () async {
        await postino.accendi(filo, const ScelteDellaSalute());
        filo.aperto = false;
        await postino.spegni(filo);
        expect(
          filo.mandati.where((m) => m['type'] == 'ponte/salute/spegni'),
          isEmpty,
        );
        filo.aperto = true;
        await postino.forseManda(filo);
        expect(filo.mandati.last['type'], 'ponte/salute/spegni');
        expect(postino.scelte.acceso, isFalse);
      },
    );

    test('senza Premium non legge e non manda, ma spegnere arriva', () async {
      await postino.accendi(filo, const ScelteDellaSalute());
      postino.sbloccata = () => false;
      adesso = adesso.add(const Duration(hours: 1));
      final prima = lettore.letture;
      await postino.forseManda(filo);
      expect(await postino.manda(filo, subito: true), isNull);
      expect(lettore.letture, prima);
      await postino.spegni(filo);
      expect(filo.mandati.last['type'], 'ponte/salute/spegni');
    });
  });
}
