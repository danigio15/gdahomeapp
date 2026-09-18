/// I disegni delle sezioni: quelli che l'app mostra nel menu.
///
/// Sono gli stessi della plancia, uno per file in `assets/oggetti`, e questa
/// prova tiene ferme le due cose che si romperebbero **in silenzio**.
///
/// La prima: una voce nuova del menu con un nome che non ha il suo file. Non
/// si accorge nessuno — `SvgPicture.asset` non protesta, e al posto del
/// disegno resta il vuoto della stessa misura, che è quello che abbiamo messo
/// di proposito perché un buco non sposti la riga. Nel menu si vedrebbe una
/// voce col nome e senza faccia.
///
/// La seconda: un disegno che chiede una sfumatura che non dichiara. Sulla
/// plancia le sfumature stavano anche in un foglio unico in cima alla pagina,
/// e un disegno poteva appoggiarsi a quello; nell'app ogni disegno è un file
/// per conto suo e non c'è nessun foglio a cui appoggiarsi. Un nome che manca
/// vuol dire una figura trasparente — ed è esattamente il difetto che
/// sull'iPhone lasciava vuote le icone della barra, dove il disegno cercava le
/// sfumature fuori da sé.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

final RegExp _chiede = RegExp(r'url\(#([A-Za-z0-9_-]+)\)');
final RegExp _richiama = RegExp(
  r'<use[^>]*?(?:xlink:)?href="#([A-Za-z0-9_-]+)',
);
final RegExp _dichiara = RegExp(r'\bid="([A-Za-z0-9_-]+)"');

List<File> _iDisegni() =>
    Directory('assets/oggetti')
        .listSync()
        .whereType<File>()
        .where((uno) => uno.path.endsWith('.svg'))
        .toList()
      ..sort((a, b) => a.path.compareTo(b.path));

void main() {
  test('ogni voce del menu ha il suo disegno', () {
    final menu = File('lib/schermate/menu.dart').readAsStringSync();
    /* Le voci dell'enum, col nome del disegno fra parentesi:
       `plancia('home', pronta: true),`. */
    final voci = RegExp(
      r"^  ([a-zA-Z]+)\('([a-z0-9]+)'",
      multiLine: true,
    ).allMatches(menu);
    expect(voci.length, greaterThan(8), reason: 'poche voci trovate nel menu');
    final senzaDisegno = <String>[];
    for (final voce in voci) {
      final file = File('assets/oggetti/${voce.group(2)}.svg');
      if (!file.existsSync()) {
        senzaDisegno.add('${voce.group(1)} → ${voce.group(2)}.svg');
      }
    }
    expect(
      senzaDisegno,
      isEmpty,
      reason: 'questa voce mostrerebbe il nome senza la faccia: il disegno non c\'è',
    );
  });

  test('ogni disegno dichiara le sfumature che chiede', () {
    final disegni = _iDisegni();
    expect(disegni.length, greaterThan(40));
    var riferimenti = 0;
    final fuori = <String>[];
    for (final file in disegni) {
      final dentro = file.readAsStringSync();
      final dichiarati = _dichiara
          .allMatches(dentro)
          .map((uno) => uno.group(1))
          .toSet();
      final chiesti = <String?>{
        ..._chiede.allMatches(dentro).map((uno) => uno.group(1)),
        ..._richiama.allMatches(dentro).map((uno) => uno.group(1)),
      };
      riferimenti += chiesti.length;
      for (final quale in chiesti) {
        if (!dichiarati.contains(quale)) {
          fuori.add('${file.uri.pathSegments.last} → $quale');
        }
      }
    }
    expect(riferimenti, greaterThan(40), reason: 'pochi riferimenti trovati');
    expect(
      fuori,
      isEmpty,
      reason:
          'questo disegno chiede una sfumatura che non dichiara: nell\'app non '
          'c\'è nessun foglio a cui appoggiarsi, e la figura resterebbe '
          'trasparente',
    );
  });

  test('i disegni li porta il pacchetto', () {
    /* Se la cartella non è dichiarata, i file ci sono nella repository e non
       sul telefono: le icone si vedrebbero soltanto a chi sviluppa. */
    final pubspec = File('pubspec.yaml').readAsStringSync();
    expect(pubspec, contains('- assets/oggetti/'));
  });
}
