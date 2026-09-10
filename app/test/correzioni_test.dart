/// Varchi, presenza, macchine, batterie: la stessa forma per quattro schede.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/entita.dart';
import 'package:gdahome/casa/plancia/correzioni.dart';

Entita _b(
  String id,
  String classe, {
  String stato = 'off',
  String unita = '',
}) => Entita(
  id: id,
  stato: stato,
  attributi: {
    if (classe.isNotEmpty) 'device_class': classe,
    if (unita.isNotEmpty) 'unit_of_measurement': unita,
  },
);

void main() {
  group('varchi e presenza', () {
    test('si legge come normalizzaVarchi: ripulita, senza doppioni', () {
      final scelte = Correzioni.da({
        'escluse': [
          'binary_sensor.frigo',
          ' binary_sensor.frigo ',
          'nonentita',
        ],
        'aggiunte': ['binary_sensor.porta'],
        'nomi': {
          'binary_sensor.porta': ' Porta cantina ',
          'x': 'y',
          'binary_sensor.v': '',
        },
      });
      expect(scelte.escluse, ['binary_sensor.frigo']);
      expect(scelte.aggiunte, ['binary_sensor.porta']);
      expect(scelte.nomi, {'binary_sensor.porta': 'Porta cantina'});
      expect(Correzioni.da('roba').daScrivere, {
        'escluse': [],
        'aggiunte': [],
        'nomi': {},
      });
    });

    test('aggiungere, togliere, rimettere: i tre gesti della scheda', () {
      final scelte = Correzioni.da(null);
      scelte.aggiungi('binary_sensor.porta');
      scelte.aggiungi('binary_sensor.porta');
      expect(scelte.aggiunte, ['binary_sensor.porta']);
      scelte.togli('binary_sensor.porta');
      expect(scelte.aggiunte, isEmpty);
      expect(scelte.escluse, ['binary_sensor.porta']);
      scelte.rimetti('binary_sensor.porta');
      expect(scelte.escluse, isEmpty);
      scelte.chiama('binary_sensor.porta', 'Cantina');
      scelte.chiama('binary_sensor.porta', '  ');
      expect(scelte.nomi, isEmpty);
    });

    test('cosa conta: le rilevate meno le escluse, piu\' le aggiunte', () {
      final casa = [
        _b('binary_sensor.porta', 'door', stato: 'on'),
        _b('binary_sensor.finestra', 'window'),
        _b('binary_sensor.frigo', 'door'),
        _b('binary_sensor.movimento', 'motion'),
        _b('binary_sensor.strano', ''),
      ];
      final scelte = Correzioni.da({
        'escluse': ['binary_sensor.frigo'],
        'aggiunte': ['binary_sensor.strano', 'binary_sensor.assente'],
      });
      final varchi = entitaCheContano(casa, scelte, rilevata: eUnVarco);
      expect(varchi.map((una) => una.id), [
        'binary_sensor.porta',
        'binary_sensor.finestra',
        'binary_sensor.strano',
        'binary_sensor.assente',
      ]);
      expect(varchi.last.muta, isTrue);
      final presenza = entitaCheContano(
        casa,
        Correzioni.da(null),
        rilevata: eUnRilevatore,
      );
      expect(presenza.map((una) => una.id), ['binary_sensor.movimento']);
    });

    test('i disegni', () {
      expect(disegnoDelVarco('window'), '🪟');
      expect(disegnoDelVarco('boh'), '🚪');
      expect(disegnoDelRilevatore('occupancy'), '🧍');
      expect(disegnoDelRilevatore('motion'), '🏃');
    });
  });

  group('le macchine', () {
    test('si legge come normalizzaMacchine', () {
      final scelte = Macchine.da({
        'integrazioni': ['proxmoxve', 'fritz', 'proxmoxve', ''],
        'escluse': ['binary_sensor.x'],
        'aggiunte': {
          'binary_sensor.a': 'rete',
          'binary_sensor.b': 'boh',
          'x': 'macchine',
        },
        'nomi': {'binary_sensor.a': 'Router'},
      });
      expect(scelte.integrazioni, ['fritz', 'proxmoxve']);
      expect(scelte.aggiunte, {'binary_sensor.a': 'rete'});
      expect(scelte.nomi, {'binary_sensor.a': 'Router'});
      expect(scelte.daScrivere.keys, [
        'integrazioni',
        'escluse',
        'aggiunte',
        'nomi',
      ]);
    });

    test('le candidate: running e connectivity, e nient\'altro', () {
      expect(famigliaCandidata(_b('binary_sensor.pve', 'running')), 'macchine');
      expect(
        famigliaCandidata(_b('binary_sensor.ripetitore', 'connectivity')),
        'rete',
      );
      expect(famigliaCandidata(_b('binary_sensor.porta', 'door')), '');
      expect(famigliaCandidata(_b('sensor.pve', 'running')), '');
    });

    test('i gesti', () {
      final scelte = Macchine.da(null);
      scelte.scegliIntegrazione('proxmoxve', true);
      scelte.scegliIntegrazione('fritz', true);
      scelte.scegliIntegrazione('proxmoxve', false);
      expect(scelte.integrazioni, ['fritz']);
      scelte.aggiungi('binary_sensor.x', 'rete');
      scelte.aggiungi('binary_sensor.y', 'boh');
      expect(scelte.aggiunte, {'binary_sensor.x': 'rete'});
      scelte.togli('binary_sensor.x');
      expect(scelte.aggiunte, isEmpty);
      expect(scelte.escluse, ['binary_sensor.x']);
    });
  });

  group('le batterie', () {
    test('la soglia: da uno a novanta, venti di serie', () {
      expect(sogliaDelleBatterie(null), 20);
      expect(sogliaDelleBatterie({'soglia': '35'}), 35);
      expect(sogliaDelleBatterie({'soglia': 250}), 90);
      expect(sogliaDelleBatterie({'soglia': 0}), 1);
      expect(sogliaDelleBatterie({'soglia': 'x'}), 20);
    });

    test('cosa e\' una batteria: percentuale marcata battery', () {
      expect(
        eUnaBatteria(_b('sensor.a', 'battery', unita: '%', stato: '40')),
        isTrue,
      );
      expect(
        eUnaBatteria(_b('binary_sensor.a', 'battery', stato: 'on')),
        isFalse,
      );
      expect(eUnaBatteria(_b('sensor.a', 'battery', unita: 'V')), isFalse);
      expect(
        livelloDellaBatteria(
          _b('sensor.a', 'battery', unita: '%', stato: '40'),
        ),
        40,
      );
      expect(
        livelloDellaBatteria(
          _b('sensor.a', 'battery', unita: '%', stato: 'unknown'),
        ),
        isNull,
      );
    });
  });
}
