/// Le scelte piccole della 1.4.17, e la loro forma.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/plancia/scelte.dart';

void main() {
  group('Assist', () {
    test('si legge come normalizzaAssist', () {
      final a = Assist.da({
        'agent_id': 'conversation.x',
        'language': 'it',
        'voce': true,
      });
      expect(a.agente, 'conversation.x');
      expect(a.lingua, 'it');
      expect(a.voce, isTrue);
      expect(a.tasto, isTrue);
      expect(Assist.da(['no']).daScrivere, {
        'agente': '',
        'lingua': '',
        'voce': false,
        'tasto': true,
      });
    });

    test('acceso: la sezione vince, poi il tasto di prima', () {
      expect(assistAcceso({'assist': false}, {'tasto': true}), isFalse);
      expect(assistAcceso({'assist': true}, {'tasto': false}), isTrue);
      expect(assistAcceso({}, {'tasto': false}), isFalse);
      expect(assistAcceso(null, null), isTrue);
    });
  });

  group('i tasti su misura', () {
    test('senza entita\' o con un dominio sbagliato non e\' un tasto', () {
      expect(normalizzaModoSuMisura({'nome': 'x'}), isNull);
      expect(normalizzaModoSuMisura({'entita': 'sensor.x'}), isNull);
      expect(normalizzaModoSuMisura({'entita': 'select.modi'}), isNull);
    });

    test('lo stato e il valore hanno un ripiego', () {
      final modo = normalizzaModoSuMisura({
        'entita': 'script.inserisci',
        'nome': 'Fuori',
      }, 2);
      expect(modo, {
        'id': 'su-misura-3',
        'nome': 'Fuori',
        'icona': '',
        'entita': 'script.inserisci',
        'opzione': '',
        'stato': 'script.inserisci',
        'valore': '',
      });
      final menu = normalizzaModoSuMisura({
        'entita': 'input_select.modi',
        'opzione': 'Fuori casa',
      });
      expect(menu!['valore'], 'Fuori casa');
      expect(vuoleUnOpzione('input_select.modi'), isTrue);
      expect(vuoleUnOpzione('script.x'), isFalse);
    });
  });

  test('la barra di casa: di serie tutte le voci, e la posta', () {
    final barra = BarraDiCasa.da({
      'voci': {'luci': false},
      'posta': ' binary_sensor.p ',
    });
    expect(barra.voci['luci'], isFalse);
    expect(barra.voci['posta'], isTrue);
    expect(barra.posta, 'binary_sensor.p');
    expect(
      (BarraDiCasa.da(null).daScrivere['voci'] as Map).length,
      vociDellaBarra.length,
    );
  });

  test('le parole nude: l\'orologio e il flusso', () {
    expect(orologioAcceso(null), isTrue);
    expect(orologioAcceso('1'), isTrue);
    expect(orologioAcceso('0'), isFalse);
    expect(flussoInHome(null), isTrue);
    expect(flussoInHome(false), isFalse);
  });

  test('il verso della batteria e il motore', () {
    expect(batteriaGirata(null), isFalse);
    expect(batteriaGirata(true), isTrue);
    expect(batteriaGirata({'girata': 'true'}), isTrue);
    expect(batteriaGirata({'girata': false}), isFalse);
    expect(tipoMotore('Termica'), 'termica');
    expect(tipoMotore('elettrica'), '');
    expect(tipoMotore(null), '');
  });

  test('il grafico: le serie spente come insieme', () {
    expect(
      serieSpente({
        'spente': ['cucina', ' ', 'cucina'],
      }),
      {'cucina'},
    );
    expect(serieSpente(null), isEmpty);
  });
}
