/// Piu' di uno: l'elenco e la sua scelta.
///
/// E' il modello che sbloccava tutte insieme le auto, gli impianti solari, le
/// centrali, gli scaldabagni, gli impianti termici e la continuita'. Le prove
/// stanno sui casi che rompono: la scelta che punta a una voce tolta, il
/// profilo scritto quando ce n'era una sola, la mappatura che deve restare
/// dentro la voce e non nella casa.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/plancia/piu_di_uno.dart';

void main() {
  group('l\'elenco', () {
    test('legge le voci e la scelta', () {
      final quali = Elenco.da(
        leAuto,
        elenco: [
          {'name': 'Leapmotor B10'},
          {'name': 'Zoe'},
        ],
        scelta: 1,
      );
      expect(quali.voci.length, 2);
      expect(quali.quellaScelta!.nome, 'Zoe');
    });

    test('una sola, com\'era prima, vale come elenco di uno', () {
      /* Chi aveva configurato quando l'auto era una sola non deve perderla. */
      final quali = Elenco.da(leAuto, elenco: {'name': 'La mia'}, scelta: null);
      expect(quali.voci.single.nome, 'La mia');
      expect(quali.scelta, 0);
    });

    test('una scelta che punta a una voce che non c\'e\' prende la prima', () {
      /* Meglio della pagina vuota che non dice perche'. */
      final quali = Elenco.da(
        leAuto,
        elenco: [
          {'name': 'Una'},
        ],
        scelta: 7,
      );
      expect(quali.scelta, 0);
    });

    test('senza voci non c\'e\' scelta', () {
      final quali = Elenco.da(leAuto, elenco: const [], scelta: 0);
      expect(quali.scelta, -1);
      expect(quali.quellaScelta, isNull);
    });

    test('la prima che si aggiunge diventa quella scelta', () {
      final quali = Elenco.da(leAuto, elenco: const [], scelta: null)
        ..aggiungi(Voce.nuova('Prima'));
      expect(quali.scelta, 0);
    });

    test('togliendo quella scelta si passa alla prima', () {
      final quali = Elenco.da(
        leAuto,
        elenco: [
          {'name': 'Una'},
          {'name': 'Due'},
        ],
        scelta: 1,
      )..togli(1);
      expect(quali.voci.single.nome, 'Una');
      expect(quali.scelta, 0);
    });

    test('togliendone una prima, la scelta si sposta con lei', () {
      final quali = Elenco.da(
        leAuto,
        elenco: [
          {'name': 'Una'},
          {'name': 'Due'},
          {'name': 'Tre'},
        ],
        scelta: 2,
      )..togli(0);
      expect(quali.quellaScelta!.nome, 'Tre');
    });

    test('togliendo l\'ultima non resta scelta', () {
      final quali = Elenco.da(
        leAuto,
        elenco: [
          {'name': 'Una'},
        ],
        scelta: 0,
      )..togli(0);
      expect(quali.scelta, -1);
    });

    test('spostandole, la scelta resta sulla stessa', () {
      final quali = Elenco.da(
        leAuto,
        elenco: [
          {'name': 'Una'},
          {'name': 'Due'},
        ],
        scelta: 1,
      )..sposta(1, -1);
      expect(quali.quellaScelta!.nome, 'Due');
      expect(quali.scelta, 0);
    });
  });

  group('come si scrive la scelta', () {
    test('le auto la scrivono col numero', () {
      final quali = Elenco.da(
        leAuto,
        elenco: [
          {'name': 'Una'},
          {'name': 'Due'},
        ],
        scelta: 1,
      );
      expect(quali.sceltaDaScrivere, 1);
    });

    test('gli impianti solari la scrivono col nome', () {
      final quali = Elenco.da(
        gliImpiantiSolari,
        elenco: [
          {'id': 'tetto', 'name': 'Tetto'},
          {'id': 'garage', 'name': 'Garage'},
        ],
        scelta: 'garage',
      );
      expect(quali.quellaScelta!.nome, 'Garage');
      expect(quali.sceltaDaScrivere, 'garage');
    });

    test('chi non ha una scelta non ne scrive nessuna', () {
      final quali = Elenco.da(
        gliScaldabagni,
        elenco: [
          {'name': 'Bagno'},
        ],
        scelta: null,
      );
      expect(quali.sceltaDaScrivere, isNull);
    });

    test('senza voci la scelta si azzera', () {
      final quali = Elenco.da(leAuto, elenco: const [], scelta: 3);
      expect(quali.sceltaDaScrivere, -1);
    });
  });

  group('una voce', () {
    test('tiene la sua mappatura dentro di se\'', () {
      /* E' il punto di tutto: le caselle sono di quell'auto, non della casa,
       * ed e' per questo che cambiando auto cambia tutta la pagina. */
      final una = Voce.nuova('Leapmotor')
        ..caselle = {'dm.ev_batteria_auto': 'sensor.b10_batteria'};
      expect(una.dentro['ov'], {'dm.ev_batteria_auto': 'sensor.b10_batteria'});
      expect(una.caselle.length, 1);
    });

    test('svuotare la mappatura toglie la chiave', () {
      final una = Voce({
        'name': 'X',
        'ov': {'dm.ev_autonomia': 'sensor.km'},
      })..caselle = const {};
      expect(una.dentro.containsKey('ov'), isFalse);
    });

    test('tiene le due foto separate', () {
      final una = Voce.nuova('Zoe')
        ..foto = '/local/zoe.png'
        ..fotoAttaccata = '/local/zoe_spina.png';
      expect(una.foto, '/local/zoe.png');
      expect(una.fotoAttaccata, '/local/zoe_spina.png');
    });

    test('quello che non conosciamo si tiene', () {
      /* Un profilo scritto da una versione piu' nuova della plancia non deve
       * perdere pezzi passando dall'app. */
      final una = Voce({'name': 'X', 'qualcosa_di_nuovo': 42})
        ..metti('brand', 'Leapmotor');
      expect(una.dentro['qualcosa_di_nuovo'], 42);
      expect(una.marca, 'Leapmotor');
    });

    test('marca e modello stanno in una riga', () {
      expect(
        Voce({'name': 'X', 'brand': 'Leapmotor', 'model': 'B10'}).sotto,
        'Leapmotor · B10',
      );
      expect(Voce({'name': 'X'}).sotto, '');
    });
  });

  group('le caselle di una famiglia', () {
    test('sono quelle col suo prefisso', () {
      final quali = caselleDellaFamiglia(leAuto, [
        'dm.ev_batteria_auto',
        'dm.ev_autonomia',
        'dm.energy_potenza_batteria',
      ]);
      expect(quali, ['dm.ev_batteria_auto', 'dm.ev_autonomia']);
    });

    test('chi non ne ha non ne prende', () {
      expect(caselleDellaFamiglia(leCentrali, ['dm.ev_autonomia']), isEmpty);
    });
  });
}
