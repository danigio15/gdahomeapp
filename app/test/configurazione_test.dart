/// L'alberatura non deve perdere pezzi per strada.
///
/// La Config della plancia e' fatta di diciannove schede. Se un giorno se ne
/// aggiunge una la' e qui non arriva, chi configura dall'app si trova una
/// cosa in meno e non ha modo di saperlo: nell'app quella scheda semplicemente
/// non esiste. Questa prova e' il campanello.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/schermate/acquisti/catalogo.dart';
import 'package:gdahome/schermate/configurazione/albero.dart';
import 'package:gdahome/schermate/menu.dart';

void main() {
  group("l'alberatura della configurazione", () {
    test('copre tutte le schede della Config della plancia', () {
      final coperte = <String>{
        for (final famiglia in albero)
          for (final voce in famiglia.voci)
            if (voce.da != null) voce.da!,
      };
      final mancanti = schedeDellaPlancia.difference(coperte);
      expect(
        mancanti,
        isEmpty,
        reason:
            'la plancia ha queste schede e l\'app no: ${mancanti.join(', ')}',
      );
    });

    test('non si inventa schede che nella plancia non ci sono', () {
      /* `sost` non sta nella fila in cima all'editor — si arriva da dentro —
       * ma esiste: e' l'unica ammessa oltre l'elenco. */
      const ammesse = {...schedeDellaPlancia, 'sost'};
      for (final famiglia in albero) {
        for (final voce in famiglia.voci) {
          if (voce.da == null) continue;
          expect(
            ammesse,
            contains(voce.da),
            reason: '«${voce.titolo}» dice di venire da ${voce.da}',
          );
        }
      }
    });

    test('ogni voce dell\'app e\' marcata come tale', () {
      for (final famiglia in albero) {
        for (final voce in famiglia.voci) {
          final dallaPlancia = voce.viene == Provenienza.dallaPlancia;
          expect(
            dallaPlancia,
            voce.da != null,
            reason:
                '«${voce.titolo}»: o viene dalla plancia e dice da quale '
                'scheda, o e\' dell\'app e non lo dice',
          );
        }
      }
    });

    test('i disegni ci sono davvero', () {
      final nomi = <String>[
        for (final famiglia in albero)
          for (final voce in famiglia.voci) voce.disegno,
        for (final quale in [
          casaCompleta,
          casaCompletaAlMese,
          ...singoli,
          ...senzaNegozio,
        ])
          quale.disegno,
        for (final sezione in Sezione.values)
          if (sezione != Sezione.dispositivi) sezione.disegno,
      ];
      for (final nome in nomi.toSet()) {
        expect(
          File('assets/oggetti/$nome.svg').existsSync(),
          isTrue,
          reason: 'manca assets/oggetti/$nome.svg',
        );
      }
    });

    test('nessun titolo doppio', () {
      final visti = <String>{};
      for (final famiglia in albero) {
        for (final voce in famiglia.voci) {
          expect(visti.add(voce.titolo), isTrue, reason: voce.titolo);
        }
      }
    });
  });

  group('il catalogo degli acquisti', () {
    test('il pacchetto costa meno della somma dei singoli', () {
      final somma = singoli.fold<double>(0, (t, q) => t + (q.prezzo ?? 0));
      expect(casaCompleta.prezzo, lessThan(somma));
    });

    test('ogni voce ha una chiave di diritto', () {
      for (final quale in [
        casaCompleta,
        casaCompletaAlMese,
        ...singoli,
        ...senzaNegozio,
      ]) {
        expect(quale.chiave, matches(RegExp(r'^(app|plancia|casa)\.[a-z]+$')));
      }
    });

    test('quello che si prende senza negozio non ha prezzo', () {
      for (final quale in senzaNegozio) {
        expect(quale.modo, Modo.gratis);
        expect(quale.prezzo, isNull);
        expect(quale.prezzoScritto, 'gratis');
      }
    });

    test('i prezzi si scrivono con la virgola e l\'euro', () {
      expect(casaCompleta.prezzoScritto, '19,99 € una volta');
      expect(casaCompletaAlMese.prezzoScritto, '1,99 € al mese');
    });
  });
}
