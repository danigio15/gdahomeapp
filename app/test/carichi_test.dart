/// Le prove dei carichi: i cerchi, i loro elettrodomestici, e la regola per cui
/// salvare un impianto non puo' cancellare i carichi dell'altro.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/plancia/carichi.dart';
import 'package:gdahome/casa/plancia/energia.dart';

Map<String, dynamic> carico(
  String id, {
  String nome = '',
  String potenza = '',
  String impianto = '',
  int ordine = 0,
  Map<String, dynamic>? metadata,
}) => {
  'id': id,
  if (nome.isNotEmpty) 'name': nome,
  if (potenza.isNotEmpty) 'power_entity': potenza,
  if (impianto.isNotEmpty) 'plant': impianto,
  'order': ordine,
  if (metadata != null) 'metadata': metadata,
};

void main() {
  group('leggere', () {
    test('un carico diventa un cerchio, col suo colore di serie', () {
      final modello = modelloDeiCarichi(
        carichi: [carico('cuc', nome: 'Cucina', potenza: 'sensor.cucina')],
      );
      expect(modello.length, 1);
      expect(modello.first.nome, 'Cucina');
      expect(modello.first.icona, '🔌');
      expect(modello.first.colore, tavolozza.first);
      expect(modello.first.visibile, isTrue);
    });

    test('i cerchi escono in ordine, e non piu\' di otto', () {
      final modello = modelloDeiCarichi(
        carichi: [
          for (var quale = 10; quale > 0; quale -= 1)
            carico('c$quale', nome: 'Carico $quale', ordine: quale),
        ],
      );
      expect(modello.length, massimoDeiCarichi);
      expect(modello.first.nome, 'Carico 1');
    });

    test('le voci del report manuale non sono cerchi', () {
      final modello = modelloDeiCarichi(
        carichi: [
          {'id': 'r', 'name': 'Riga', 'category': 'manual-report'},
        ],
      );
      expect(modello, isEmpty);
    });

    test('un elettrodomestico non e\' un cerchio: sta dentro il suo', () {
      final modello = modelloDeiCarichi(
        carichi: [
          carico('cuc', nome: 'Cucina', metadata: {'flow_group': 'cucina'}),
          carico(
            'forno',
            nome: 'Forno',
            potenza: 'sensor.forno',
            metadata: {'beta27_subload_group': 'cucina'},
          ),
        ],
      );
      expect(modello.length, 1);
      expect(modello.first.figli.length, 1);
      expect(modello.first.figli.first.nome, 'Forno');
      expect(modello.first.figli.first.potenza, 'sensor.forno');
    });

    test(
      'gli elettrodomestici della loro sezione si mostrano, non si possiedono',
      () {
        final modello = modelloDeiCarichi(
          carichi: [
            carico('cuc', nome: 'Cucina', metadata: {'flow_group': 'cucina'}),
          ],
          elettrodomestici: [
            {
              'id': 'lavatrice',
              'name': 'Lavatrice',
              'metadata': {'beta27_subload_group': 'cucina'},
            },
          ],
        );
        expect(modello.first.figli.single.daDove, 'appliance');
        expect(modello.first.figli.single.altrui, isTrue);
      },
    );

    test('le righe storiche della finestrella si leggono una volta sola', () {
      final modello = modelloDeiCarichi(
        carichi: [
          carico('cuc', nome: 'Cucina', metadata: {'flow_group': 'cucina'}),
        ],
        sottocarichi: {
          'cucina': [
            {'id': 'frigo', 'name': 'Frigo', 'pwrLive': 'sensor.frigo'},
          ],
        },
      );
      expect(modello.first.figli.single.nome, 'Frigo');
      expect(modello.first.figli.single.potenza, 'sensor.frigo');
    });

    test('la casella storica rinomina il cerchio che c\'era gia\'', () {
      final modello = modelloDeiCarichi(
        carichi: [carico('c1', nome: 'Carico 1')],
        nodi: {
          'boiler': {'name': 'Boiler', 'color': '#fff', 'pwr': 'sensor.b'},
        },
      );
      expect(modello.first.nome, 'Boiler');
      expect(modello.first.colore, '#fff');
      expect(modello.first.potenza, 'sensor.b');
    });

    test('con due impianti la casella storica non vale piu\'', () {
      expect(specchioDeiCerchi({'boiler': {}}, 2), isNull);
      expect(specchioDeiCerchi({'boiler': {}}), isNotNull);
    });
  });

  group('un impianto per volta', () {
    final tutti = [
      carico('c1', nome: 'Sotto', potenza: 'sensor.sotto'),
      carico(
        'c1b',
        nome: 'Sopra',
        potenza: 'sensor.sopra',
        impianto: 'impianto-2',
      ),
    ];

    test('si vedono solo i cerchi del suo', () {
      final primo = modelloDeiCarichi(
        carichi: tutti,
        impianto: Impianto.da({'id': primoImpianto}),
      );
      expect(primo.map((uno) => uno.nome), ['Sotto']);
      final secondo = modelloDeiCarichi(
        carichi: tutti,
        impianto: Impianto.da({'id': 'impianto-2'}),
        quale: 1,
      );
      expect(secondo.map((uno) => uno.nome), ['Sopra']);
    });

    test('salvare uno non cancella i carichi dell\'altro', () {
      final modello = modelloDeiCarichi(
        carichi: tutti,
        impianto: Impianto.da({'id': primoImpianto}),
      );
      modello.first.nome = 'Sotto rinominato';
      final scritto = carichiDaScrivere(modello, prima: tutti, impianto: '');
      final nomi = scritto.carichi.map((uno) => uno['name']).toList();
      expect(nomi, contains('Sotto rinominato'));
      expect(nomi, contains('Sopra'));
    });

    test('un id che l\'altro impianto usa gia\' si rinomina', () {
      final altri = [carico('carico-1', nome: 'Suo', impianto: 'impianto-2')];
      final modello = [caricoVuoto(const [])];
      expect(modello.first.id, 'carico-1');
      final scritto = carichiDaScrivere(modello, prima: altri, impianto: '');
      final mio = scritto.carichi.firstWhere(
        (uno) => uno['name'] == 'Carico 1',
      );
      expect(mio['id'], 'impianto-carico-1');
    });

    test('un cerchio nuovo nasce nell\'impianto che si sta guardando', () {
      expect(
        caricoVuoto(const [], impianto: 'impianto-2').impianto,
        'impianto-2',
      );
    });
  });

  group('scrivere', () {
    test('escono le quattro chiavi, e lo specchio ha cinque caselle', () {
      final modello = [
        for (var quale = 0; quale < 6; quale += 1) caricoVuoto([]),
      ];
      // Ogni carico vuoto nasce guardando il modello: qui si numerano a mano.
      final veri = <Carico>[];
      for (var quale = 0; quale < 6; quale += 1) {
        veri.add(caricoVuoto(veri));
      }
      final scritto = carichiDaScrivere(veri);
      expect(modello.length, 6);
      expect(scritto.carichi.length, 6);
      expect(scritto.gruppi.length, 6);
      expect(scritto.nodi.keys.toSet(), caselleStoriche.toSet());
    });

    test('lo specchio delle entita\' si rifa\' da capo', () {
      final uno = caricoVuoto(const [])
        ..potenza = 'sensor.p'
        ..totale = 'sensor.t';
      final scritto = carichiDaScrivere([uno]);
      final riga = scritto.carichi.single;
      expect(riga['entities'], ['sensor.p', 'sensor.t']);
      expect(riga['entity'], 'sensor.p');
    });

    test('svuotare una casella la svuota davvero', () {
      final prima = [
        carico('carico-1', nome: 'Uno', potenza: 'sensor.vecchio'),
      ];
      final modello = modelloDeiCarichi(carichi: prima);
      modello.first.potenza = '';
      final scritto = carichiDaScrivere(modello, prima: prima);
      expect(scritto.carichi.single['power_entity'], '');
      expect(scritto.carichi.single['entities'], isEmpty);
    });

    test('il segno dice a chi indovina che qui non c\'e\' da indovinare', () {
      final scritto = carichiDaScrivere([caricoVuoto(const [])]);
      expect(scritto.carichi.single['metadata'][campiScelti], isTrue);
      expect(scritto.carichi.single['metadata']['beta27_subload_group'], '');
    });

    test('i figli si scrivono come carichi, marcati col gruppo', () {
      final uno = caricoVuoto(const []);
      uno.figli.add(sottocaricoVuoto(uno)..potenza = 'sensor.forno');
      final scritto = carichiDaScrivere([uno]);
      expect(scritto.carichi.length, 2);
      final figlio = scritto.carichi[1];
      expect(figlio['metadata']['beta27_subload_group'], uno.gruppo);
      expect(figlio['show_in_dashboard'], isFalse);
      expect(scritto.sottocarichi[uno.gruppo], hasLength(1));
    });

    test('un elettrodomestico di un\'altra sezione non si riscrive qui', () {
      final modello = modelloDeiCarichi(
        carichi: [
          carico('cuc', nome: 'Cucina', metadata: {'flow_group': 'cucina'}),
        ],
        elettrodomestici: [
          {
            'id': 'lav',
            'name': 'Lavatrice',
            'metadata': {'beta27_subload_group': 'cucina'},
          },
        ],
      );
      final scritto = carichiDaScrivere(modello);
      expect(scritto.carichi.length, 1);
      // Nello specchio si vede lo stesso: la finestrella lo deve trovare.
      expect(scritto.sottocarichi['cucina'], hasLength(1));
    });

    test('quello che questa maschera non gestisce si riporta', () {
      final prima = [
        {
          'id': 'carico-1',
          'name': 'Uno',
          'report_options': {'soglia': 3},
        },
      ];
      final modello = modelloDeiCarichi(carichi: prima);
      final scritto = carichiDaScrivere(modello, prima: prima);
      expect(scritto.carichi.single['report_options'], {'soglia': 3});
    });

    test('le voci del report manuale sopravvivono', () {
      final prima = [
        {'id': 'r', 'name': 'Riga', 'category': 'manual-report'},
      ];
      final scritto = carichiDaScrivere(const [], prima: prima);
      expect(scritto.carichi.single['id'], 'r');
    });

    test(
      'rinominare il carico rinomina il gruppo, e i figli restano dentro',
      () {
        final uno = caricoVuoto(const []);
        uno.figli.add(sottocaricoVuoto(uno));
        final scritto = carichiDaScrivere([uno]);
        expect(scritto.gruppi.single['id'], uno.id);
        expect(scritto.sottocarichi.keys.single, uno.id);
      },
    );
  });

  group('cosa si legge sotto la scheda', () {
    test('un cerchio senza sensore e con dentro roba e\' la loro somma', () {
      final uno = caricoVuoto(const []);
      uno.figli.add(sottocaricoVuoto(uno));
      expect(uno.riassunto, 'somma di 1 dispositivo');
      expect(uno.avvisi, isEmpty);
    });

    test('un cerchio vuoto lo dice', () {
      expect(caricoVuoto(const []).riassunto, 'nessuna entita\'');
      expect(caricoVuoto(const []).avvisi.single, contains('resta vuoto'));
    });

    test('un contatore senza potenza avvisa della vista Istantaneo', () {
      final uno = caricoVuoto(const [])..totale = 'sensor.t';
      expect(uno.riassunto, 'contatore totale');
      expect(uno.avvisi.single, contains('Istantaneo'));
    });

    test('una potenza senza contatori avvisa di Giorno e Mese', () {
      final uno = caricoVuoto(const [])..potenza = 'sensor.p';
      expect(uno.avvisi.single, contains('Giorno e Mese'));
    });
  });

  test('spostare un carico rifa\' l\'ordine', () {
    final elenco = <Carico>[];
    for (var quale = 0; quale < 3; quale += 1) {
      elenco.add(caricoVuoto(elenco));
    }
    final dopo = spostaIlCarico(elenco, elenco[2].id, -1);
    expect(dopo.map((uno) => uno.ordine), [0, 1, 2]);
    expect(dopo[1].id, elenco[2].id);
    // Fuori dai bordi non si muove niente.
    expect(spostaIlCarico(dopo, dopo.first.id, -1).first.id, dopo.first.id);
  });

  proveDelReport();
}

/* Il Report non ha un elenco suo: si ricava da carichi ed elettrodomestici, e
 * questi due campi sono l'unico modo di dirgli qualcosa. */
void proveDelReport() {
  group('il Report', () {
    test('di serie un carico ci compare', () {
      expect(caricoVuoto(const []).nelReport, isTrue);
      final scritto = carichiDaScrivere([caricoVuoto(const [])]);
      expect(scritto.carichi.single['show_in_report'], isTrue);
    });

    test('toglierlo si scrive, e si rilegge', () {
      final uno = caricoVuoto(const [])..nelReport = false;
      final scritto = carichiDaScrivere([uno]);
      expect(scritto.carichi.single['show_in_report'], isFalse);
      expect(
        modelloDeiCarichi(carichi: scritto.carichi).single.nelReport,
        isFalse,
      );
    });

    test('nel Report puo\' chiamarsi diversamente', () {
      final uno = caricoVuoto(const [])
        ..nome = 'Cucina'
        ..nomeNelReport = 'Piano cottura';
      final scritto = carichiDaScrivere([uno]);
      expect(scritto.carichi.single['report_label'], 'Piano cottura');
      final riletto = modelloDeiCarichi(carichi: scritto.carichi).single;
      expect(riletto.nome, 'Cucina');
      expect(riletto.nomeNelReport, 'Piano cottura');
    });

    test('l\'ordine nel Report segue quello dei cerchi', () {
      final elenco = <Carico>[];
      for (var quale = 0; quale < 3; quale += 1) {
        elenco.add(caricoVuoto(elenco));
      }
      final scritto = carichiDaScrivere(elenco);
      expect(scritto.carichi.map((uno) => uno['report_order']), [0, 1, 2]);
    });
  });
}
