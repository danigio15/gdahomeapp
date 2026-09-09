/// Le prove del modello dell'energia: le caselle, e soprattutto **piu' di un
/// impianto**, che e' la cosa che l'utente ha chiesto per nome.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/plancia/energia.dart';

void main() {
  group('le caselle', () {
    test('sono tutte e trentaquattro, comprese le cinque del freddo', () {
      expect(caselleDellEnergia.length, 34);
      expect(
        caselleDellEnergia.keys
            .where((uno) => uno.startsWith('cooling.'))
            .length,
        5,
      );
      expect(
        caselleDellEnergia['solar.power'],
        'dm.energy_potenza_fotovoltaico',
      );
      expect(caselleDellEnergia['house.total_energy'], 'dm.core_043');
    });

    test('ogni casella dei gruppi ha la sua voce fra i gruppi', () {
      final daiGruppi = <String>{
        for (final gruppo in gruppiDellEnergia)
          for (final (campo, _) in gruppo.caselle) gruppo.percorsoDi(campo),
      };
      expect(daiGruppi, caselleDellEnergia.keys.toSet());
    });
  });

  group('un impianto solo', () {
    test('chi non ha mai visto la schermata ne ha comunque uno', () {
      final impianti = elencoDegliImpianti({
        'solar': {'power': 'sensor.pv'},
      });
      expect(impianti.length, 1);
      expect(impianti.first.id, primoImpianto);
      expect(impianti.first.configurato, isTrue);
    });

    test('vuoto non e\' configurato ma resta l\'unico da disegnare', () {
      final configurati = impiantiConfigurati(<String, dynamic>{});
      expect(configurati.length, 1);
      expect(configurati.first.$2.configurato, isFalse);
    });

    test('le sue chiavi di runtime restano quelle di sempre', () {
      final uno = Impianto.da({'id': primoImpianto});
      expect(chiaveDellImpianto('cd_costo_kwh', uno, 0), 'cd_costo_kwh');
    });
  });

  group('piu\' impianti', () {
    ModelloDellEnergia conDue() {
      final modello = ModelloDellEnergia.da({
        'solar': {'power': 'sensor.pv_uno'},
        'metadata': {'qualcosa': 'di mio'},
      });
      final elenco = modello.impianti;
      elenco.add(Impianto.nuovo(elenco, nome: 'Casa di sopra'));
      modello.mettiGliImpianti(elenco);
      return modello;
    }

    test('il primo non si sposta: resta al primo livello', () {
      final modello = conDue();
      expect(modello.dentro['solar'], {'power': 'sensor.pv_uno'});
      expect(modello.dentro['id'], primoImpianto);
      expect((modello.dentro['plants'] as List).length, 1);
    });

    test('il secondo ha un id suo, che non e\' il suo nome', () {
      final modello = conDue();
      final secondo = modello.impianti[1];
      expect(secondo.id, 'impianto-2');
      expect(secondo.nome, 'Casa di sopra');
    });

    test('rinominare non tocca l\'id', () {
      final modello = conDue();
      final elenco = modello.impianti;
      elenco[1].nome = 'Casa Donato';
      modello.mettiGliImpianti(elenco);
      expect(modello.impianti[1].id, 'impianto-2');
      expect(modello.impianti[1].nome, 'Casa Donato');
    });

    test('un id cancellato non torna mai buono', () {
      final modello = conDue();
      // Si cancella il secondo…
      modello.mettiGliImpianti([modello.impianti.first]);
      expect(modello.impianti.length, 1);
      // …e il prossimo e' il terzo, non di nuovo il secondo.
      final elenco = modello.impianti;
      elenco.add(
        Impianto.nuovo(elenco, metadata: modello.impianti.first.metadata),
      );
      modello.mettiGliImpianti(elenco);
      expect(modello.impianti[1].id, 'impianto-3');
    });

    test('quello che non si conosce resta dov\'e\'', () {
      final modello = ModelloDellEnergia.da({
        'solar': {'power': 'sensor.pv'},
        'una_chiave_futura': 42,
      });
      modello.mettiGliImpianti(modello.impianti);
      expect(modello.dentro['una_chiave_futura'], 42);
    });

    test('una configurazione scritta gia\' come elenco non perde il primo', () {
      final impianti = elencoDegliImpianti([
        {
          'id': primoImpianto,
          'solar': {'power': 'sensor.a'},
        },
        {
          'id': 'impianto-2',
          'solar': {'power': 'sensor.b'},
        },
      ]);
      expect(impianti.length, 2);
      expect(impianti.first.dentro['solar'], {'power': 'sensor.a'});
    });

    test('ognuno ha le sue caselle, e non si mescolano', () {
      final modello = conDue();
      final elenco = modello.impianti;
      modello.mettiLaCasella(
        'solar.power',
        'sensor.pv_due',
        impianto: elenco[1],
      );
      modello.mettiGliImpianti(elenco);
      expect(
        modello.casella('solar.power', impianto: modello.impianti[0]),
        'sensor.pv_uno',
      );
      expect(
        modello.casella('solar.power', impianto: modello.impianti[1]),
        'sensor.pv_due',
      );
    });

    test('il raffreddamento e\' della casa, non dell\'impianto', () {
      final modello = conDue();
      modello.mettiLaCasella(
        'cooling.fan_power',
        'sensor.ventola',
        impianto: modello.impianti[1],
      );
      // Scritto sul secondo impianto, si legge dal primo livello: la ventola
      // dell'inverter e' una sola.
      expect(modello.dentro['cooling'], {'fan_power': 'sensor.ventola'});
      expect(
        modello.casella('cooling.fan_power', impianto: modello.impianti[0]),
        'sensor.ventola',
      );
    });

    test('gli altri hanno le loro chiavi di runtime', () {
      final modello = conDue();
      expect(
        chiaveDellImpianto('cd_costo_kwh', modello.impianti[1], 1),
        'cd_costo_kwh_impianto-2',
      );
    });

    test('si sceglie quello che si guarda, o il primo', () {
      final modello = conDue();
      expect(
        scegliLImpianto(modello.impianti, 'impianto-2')?.nome,
        'Casa di sopra',
      );
      expect(scegliLImpianto(modello.impianti, 'chissa')?.id, primoImpianto);
      expect(scegliLImpianto(const [], 'niente'), isNull);
    });
  });

  group('il resto del modello', () {
    test('svuotare una casella la toglie davvero', () {
      final modello = ModelloDellEnergia.da({
        'solar': {'power': 'sensor.pv'},
      });
      modello.mettiLaCasella(
        'solar.power',
        '',
        impianto: modello.impianti.first,
      );
      final elenco = modello.impianti;
      modello.mettiGliImpianti(elenco);
      expect((modello.dentro['solar'] as Map).containsKey('power'), isFalse);
      // I quattro gruppi restano, anche vuoti: e' come li scrive la plancia.
      expect(modello.dentro.containsKey('solar'), isTrue);
    });

    test('il prezzo puo\' essere un\'entita\'', () {
      final modello = ModelloDellEnergia.da(<String, dynamic>{});
      modello.entitaDelPrezzo = 'sensor.pun';
      expect(modello.dentro['rates'], {'import_entity': 'sensor.pun'});
      modello.entitaDelPrezzo = '  ';
      expect(modello.dentro.containsKey('rates'), isFalse);
    });

    test('quante caselle sono piene, per impianto', () {
      final modello = ModelloDellEnergia.da({
        'solar': {'power': 'sensor.pv', 'daily_energy': 'sensor.oggi'},
      });
      expect(modello.quante(modello.impianti.first), (2, 34));
    });

    test('come si vede in Home: la somma, se non si dice altro', () {
      expect(comeSiVedeLEnergia(null), tesseraSomma);
      expect(comeSiVedeLEnergia('una-per-impianto'), tesseraPerImpianto);
      expect(comeSiVedeLEnergia('altro'), tesseraSomma);
    });
  });

  group('i carichi appartengono a un impianto', () {
    test('senza campo sono del primo, e nessuno li tocca', () {
      final uno = <String, dynamic>{'id': 'carico-1'};
      expect(
        caricoDellImpianto(uno, Impianto.da({'id': primoImpianto}), 0),
        isTrue,
      );
      expect(
        caricoDellImpianto(uno, Impianto.da({'id': 'impianto-2'}), 1),
        isFalse,
      );
    });

    test('cancellare un impianto porta via i suoi carichi', () {
      final carichi = [
        <String, dynamic>{'id': 'a'},
        <String, dynamic>{'id': 'b', 'plant': 'impianto-2'},
      ];
      final restano = senzaICarichiDellImpianto(carichi, 'impianto-2');
      expect(restano.map((uno) => uno['id']), ['a']);
    });

    test('cancellare il primo non porta via niente', () {
      final carichi = [
        <String, dynamic>{'id': 'a'},
      ];
      expect(senzaICarichiDellImpianto(carichi, primoImpianto).length, 1);
    });
  });

  proveDellaProiezione();
}

/* Le prove della proiezione stanno in fondo perche' sono la parte che tiene
 * insieme i due posti in cui una configurazione dell'energia vive. */
void proveDellaProiezione() {
  group('la proiezione', () {
    test('una casella scritta finisce fra le sostituzioni', () {
      final fuori = proiezioneDellEnergia({
        'solar': {'power': 'sensor.pv'},
      }, {});
      expect(fuori['dm.energy_potenza_fotovoltaico'], 'sensor.pv');
    });

    test('una casella svuotata sparisce anche di la\'', () {
      final fuori = proiezioneDellEnergia(
        {'solar': <String, dynamic>{}},
        {'dm.energy_potenza_fotovoltaico': 'sensor.vecchio'},
      );
      expect(fuori.containsKey('dm.energy_potenza_fotovoltaico'), isFalse);
    });

    test('quello che non e\' dell\'energia non si tocca', () {
      final fuori = proiezioneDellEnergia({}, {'dm.core_001': 'light.salotto'});
      expect(fuori['dm.core_001'], 'light.salotto');
    });

    test('il contatore totale fa da oggi, mese e anno', () {
      final fuori = proiezioneDellEnergia({
        'solar': {'total_energy': 'sensor.totale'},
      }, {});
      expect(fuori['dm.core_046'], 'sensor.totale');
    });

    test('ma un periodo scritto a mano vince', () {
      final fuori = proiezioneDellEnergia({
        'solar': {
          'total_energy': 'sensor.totale',
          'daily_energy': 'sensor.oggi',
          'monthly_energy': 'sensor.mese',
          'annual_energy': 'sensor.anno',
        },
      }, {});
      expect(fuori['dm.energy_produzione_solare_oggi'], 'sensor.oggi');
      // Tutti e tre i periodi ci sono: il totale non deve piu' sostituirli.
      expect(fuori.containsKey('dm.core_046'), isFalse);
    });

    test('con un periodo solo scritto il totale resta a coprire gli altri', () {
      final fuori = proiezioneDellEnergia({
        'solar': {
          'total_energy': 'sensor.totale',
          'daily_energy': 'sensor.oggi',
        },
      }, {});
      expect(fuori['dm.core_046'], 'sensor.totale');
      expect(fuori['dm.energy_produzione_solare_oggi'], 'sensor.oggi');
    });

    test('il raffreddamento passa dritto', () {
      final fuori = proiezioneDellEnergia({
        'cooling': {'fan_power': 'sensor.ventola'},
      }, {});
      expect(fuori['dm.energy_potenza_ventola_inverter'], 'sensor.ventola');
    });
  });
}
