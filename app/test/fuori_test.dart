/// Le prove di chi resta fuori dalle tessere, il porto di
/// `core/fuori-dai-widget.js`.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/plancia/fuori.dart';

void main() {
  group('una voce', () {
    test('nuda, o con la tessera davanti', () {
      expect(leggiLaVoce('light.cucina'), (
        tessera: '',
        entita: 'light.cucina',
      ));
      expect(leggiLaVoce(' varchi|binary_sensor.porta '), (
        tessera: 'varchi',
        entita: 'binary_sensor.porta',
      ));
      expect(leggiLaVoce(''), isNull);
      expect(leggiLaVoce('|light.cucina'), isNull);
      expect(leggiLaVoce('varchi|'), isNull);
      expect(scriviLaVoce('', 'light.cucina'), 'light.cucina');
      expect(scriviLaVoce('luci', ' light.cucina '), 'luci|light.cucina');
      expect(scriviLaVoce('luci', ''), '');
    });
  });

  group('le escluse di una tessera', () {
    const elenco = [
      'light.tutte',
      'varchi|binary_sensor.finestra',
      'sicurezza|cover.cancello',
      '',
    ];

    test('sono le nude e le sue, non quelle delle altre', () {
      expect(escluseDellaTessera(elenco, 'varchi'), {
        'light.tutte',
        'binary_sensor.finestra',
      });
      expect(escluseDellaTessera(elenco, 'tapparelle'), {'light.tutte'});
      expect(escluseDellaTessera(elenco), {'light.tutte'});
      expect(eFuori(elenco, 'varchi', 'binary_sensor.finestra'), isTrue);
      expect(eFuori(elenco, 'tapparelle', 'binary_sensor.finestra'), isFalse);
    });

    test('le porte leggono anche le voci scritte ai tempi della sicurezza', () {
      expect(escluseDellaTessera(elenco, 'porte'), {
        'light.tutte',
        'cover.cancello',
      });
    });
  });

  group('togliere e rimettere', () {
    test('togliere scrive la voce con la tessera, una volta sola', () {
      final dopo = togliDallaTessera(const [], 'luci', 'light.cucina');
      expect(dopo, ['luci|light.cucina']);
      expect(togliDallaTessera(dopo, 'luci', 'light.cucina'), dopo);
      /* Gia' fuori da tutte: non si aggiunge niente. */
      expect(
        togliDallaTessera(const ['light.cucina'], 'luci', 'light.cucina'),
        ['light.cucina'],
      );
      expect(togliDallaTessera(const [], '', 'light.cucina'), ['light.cucina']);
      expect(togliDallaTessera(const ['x'], 'luci', ''), ['x']);
    });

    test('rimettere toglie la sua voce e quella nuda, non quelle altrui', () {
      const elenco = [
        'light.cucina',
        'luci|light.cucina',
        'varchi|light.cucina',
        'luci|light.sala',
      ];
      expect(rimettiNellaTessera(elenco, 'luci', 'light.cucina'), [
        'varchi|light.cucina',
        'luci|light.sala',
      ]);
      /* Senza tessera si rimette dentro dappertutto. */
      expect(rimettiNellaTessera(elenco, '', 'light.cucina'), [
        'luci|light.sala',
      ]);
    });

    test('rimettere nelle porte porta via anche la voce della sicurezza', () {
      expect(
        rimettiNellaTessera(
          const [
            'sicurezza|cover.cancello',
            'porte|cover.cancello',
            'sicurezza|alarm_control_panel.casa',
          ],
          'porte',
          'cover.cancello',
        ),
        ['sicurezza|alarm_control_panel.casa'],
      );
    });
  });

  group('le tessere delle linguette', () {
    test('sono quelle di fuori-dai-widget.js', () {
      final sorgente = File('../ponte/plancia/src/core/fuori-dai-widget.js')
          .readAsStringSync();
      Map<String, String> tabella(String nome) {
        final da = sorgente.indexOf('export const $nome');
        final blocco = sorgente.substring(da, sorgente.indexOf('});', da));
        return {
          for (final trovato in RegExp(
            r'^\s*([a-z0-9]+): "([a-z]+)",',
            multiLine: true,
          ).allMatches(blocco))
            trovato.group(1)!: trovato.group(2)!,
        };
      }

      expect(tesserePerScheda, tabella('TESSERE_PER_SCHEDA'));
      expect({
        for (final voce in tesserePerBlocco.entries) '${voce.key}': voce.value,
      }, tabella('TESSERE_PER_BLOCCO'));
      expect(tesseraDellaScheda('doors'), 'porte');
      expect(tesseraDellaScheda('avvisi'), '');
      expect(tesseraDelBlocco(9), 'clima');
      expect(tesseraDelBlocco(0), '');
      /* E i nomi di prima. */
      expect(
        sorgente,
        contains('NOMI_DI_PRIMA = Object.freeze({ porte: ["sicurezza"] })'),
      );
    });
  });
}
