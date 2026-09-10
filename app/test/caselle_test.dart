/// Nessun gruppo di caselle resta fuori dall'app.
///
/// La Config della plancia, nella scheda «Sezioni», mostra **tutti** i gruppi
/// di `CD_SLOTS`: sette accordion, centodue caselle, e chi apre il browser le
/// riempie tutte. Nell'app se ne raggiungevano cinque — Home, Sicurezza,
/// MiniPC dalle caselle, l'auto e il solare dai profili — e quarantotto
/// caselle non avevano nessuna schermata che le mostrasse: l'Energia intera e
/// la lavatrice della Home.
///
/// Non era una svista che si vedeva: il menu era pieno di voci, l'Energia
/// c'era, e chi la apriva trovava il modello — che ne copre ventiquattro su
/// trentasei. Le altre dodici semplicemente non esistevano da nessuna parte,
/// e l'unico modo di accorgersene era andarle a cercare.
///
/// Questa prova e' il campanello: se la plancia aggiunge un gruppo, o se
/// qualcuno stacca una voce, il conto non torna e si sa subito.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/plancia/caselle.dart';
import 'package:gdahome/schermate/configurazione/pezzi.dart';

/// Come si arriva a un gruppo di caselle, dai sorgenti della schermata delle
/// voci: `sezione:` e' la schermata delle caselle, `sezioneDelleCaselle:` e'
/// il profilo di un'auto o di un impianto solare, che le sue caselle se le
/// porta dentro.
Set<String> _iGruppiRaggiungibili() {
  final testo = File('lib/schermate/configurazione/voci.dart')
      .readAsStringSync();
  final forma = RegExp("(?:sezione|sezioneDelleCaselle): '([a-z]+)'");
  return {for (final trovato in forma.allMatches(testo)) trovato.group(1)!};
}

void main() {
  final tutte = daJson(File('assets/plancia/caselle.json').readAsStringSync());

  group('le caselle della plancia', () {
    test('sono sette gruppi e centodue caselle', () {
      expect(tutte.keys, hasLength(7));
      final quante = tutte.values.fold(0, (t, s) => t + s.caselle.length);
      expect(quante, 102);
    });

    test('ogni gruppo si raggiunge dalla Configurazione', () {
      final raggiungibili = _iGruppiRaggiungibili();
      final fuori = tutte.keys.toSet().difference(raggiungibili);
      expect(
        fuori,
        isEmpty,
        reason:
            'questi gruppi di caselle nella plancia si riempiono e nell\'app '
            'no: ${fuori.join(', ')}',
      );
    });

    test('e non ne raggiunge di inventati', () {
      for (final quale in _iGruppiRaggiungibili()) {
        expect(
          tutte.keys,
          contains(quale),
          reason: '«$quale» non e\' un gruppo di CD_SLOTS',
        );
      }
    });

    /* Le dodici che il modello dell'energia non copre. Se un giorno
     * `ENERGY_SLOT_MAP` le prendesse anche lei, questa prova cade e si toglie
     * l'elenco: e' li' per dire perche' la voce «Le caselle dell'Energia»
     * esiste accanto a «Energia», non per congelare un numero. */
    test('l\'Energia ha caselle che il modello non ha', () {
      final nelModello = File('lib/casa/plancia/energia.dart')
          .readAsStringSync();
      final fuoriDalModello = [
        for (final una in tutte['energy']!.caselle)
          if (!nelModello.contains("'${una.chiave}'")) una.chiave,
      ];
      expect(fuoriDalModello, hasLength(12));
      expect(fuoriDalModello, contains('dm.energy_potenza_condizionatori'));
      expect(fuoriDalModello, contains('dm.energy_stato_rete'));
    });
  });

  /* Il nome di una casella si riscrive, come nella plancia.
   *
   * Li' l'etichetta e' un campo di testo sopra ogni riga, e quello che ci si
   * scrive finisce in `cd_slot_labels`. Chi ha due tetti chiama «Potenza
   * tetto sud» quella che di serie e' «Potenza fotovoltaico (W)», e se
   * dall'app la ritrova col nome vecchio ha due configurazioni che parlano di
   * due case diverse.
   */
  /* Il campo dentro il riquadro, non quello sotto: l'etichetta del campo che
   * sta dietro e' la stessa parola, e cercarla per testo ne trova due. */
  final nelRiquadro = find.descendant(
    of: find.byType(AlertDialog),
    matching: find.byType(TextField),
  );

  group('il nome di una casella', () {
    Widget campo(void Function(String) rinomina) => MaterialApp(
      home: Scaffold(
        body: CampoDiEntita(
          etichetta: 'Potenza fotovoltaico (W)',
          valore: '',
          chiave: 'dm.energy_potenza_fotovoltaico',
          cambiato: (_) {},
          collegamento: Collegamento(
            archivio: ArchivioDelleCase(CassaforteInMemoria()),
          ),
          rinomina: rinomina,
        ),
      ),
    );

    testWidgets('si riscrive dalla matita', (prova) async {
      String? scritto;
      await prova.pumpWidget(campo((nome) => scritto = nome));
      await prova.tap(find.byIcon(Icons.drive_file_rename_outline_rounded));
      await prova.pumpAndSettle();

      await prova.enterText(nelRiquadro, 'Potenza tetto sud');
      await prova.tap(find.text('Va bene'));
      await prova.pumpAndSettle();
      expect(scritto, 'Potenza tetto sud');
    });

    testWidgets('svuotarlo vuol dire «rimettilo com\'era»', (prova) async {
      String? scritto;
      await prova.pumpWidget(campo((nome) => scritto = nome));
      await prova.tap(find.byIcon(Icons.drive_file_rename_outline_rounded));
      await prova.pumpAndSettle();

      await prova.enterText(nelRiquadro, '   ');
      await prova.tap(find.text('Va bene'));
      await prova.pumpAndSettle();
      expect(scritto, '');
    });

    testWidgets('«Lascia stare» non tocca niente', (prova) async {
      String? scritto;
      await prova.pumpWidget(campo((nome) => scritto = nome));
      await prova.tap(find.byIcon(Icons.drive_file_rename_outline_rounded));
      await prova.pumpAndSettle();

      await prova.tap(find.text('Lascia stare'));
      await prova.pumpAndSettle();
      expect(scritto, isNull);
    });

    testWidgets('senza il gancio la matita non c\'e\'', (prova) async {
      await prova.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CampoDiEntita(
              etichetta: 'Entita\'',
              valore: '',
              cambiato: (_) {},
              collegamento: Collegamento(
                archivio: ArchivioDelleCase(CassaforteInMemoria()),
              ),
            ),
          ),
        ),
      );
      expect(
        find.byIcon(Icons.drive_file_rename_outline_rounded),
        findsNothing,
      );
    });
  });
}
