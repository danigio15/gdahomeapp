/// Il campanello che mancava: nessun campo della Config resta fuori dall'app.
///
/// Le due volte che la Configurazione dell'app si e' scollegata da quella
/// della dashboard non si sono viste guardando l'app: si sono viste perche'
/// qualcuno, in casa sua, ha aperto una scheda e ha trovato meno di quello che
/// aveva nel browser. La griglia delle marche, le caselle dell'Energia, il
/// contatto dell'inferriata, i minuti di una zona d'irrigazione. Ogni volta lo
/// stesso difetto, e ogni volta nessuno se ne poteva accorgere prima.
///
/// Questa prova lo rende meccanico. Legge gli editor della plancia — quelli
/// veri, dentro l'add-on — e tira fuori **il nome di ogni casella che
/// salvano**. Se un nome non compare da nessuna parte nei sorgenti dell'app,
/// vuol dire che dall'app quella casella non si puo' riempire, e la prova
/// cade dicendo quale.
///
/// Non prova che la casella sia gestita **bene**: prova che sia nominata. E'
/// il pavimento, non il soffitto — ma un pavimento che si abbassa da solo lo
/// vede subito qualcuno.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Gli editor della plancia, dentro l'add-on.
const _dovStannoGliEditor = '../ponte/plancia/src/sections';

/// I nomi che non sono caselle della configurazione.
///
/// `input` e' il campo di ricerca del selettore dei disegni: sta dentro
/// `icon-engine-section.js`, non finisce in nessuna chiave `cd_`, e l'app non
/// ha motivo di nominarlo.
const _nonSonoCaselle = {'input'};

/// Ogni casella che un editor della plancia salva.
///
/// Le due forme in cui gli editor scrivono: `campo: …getElementById("ed-…")`
/// per le schede battute a mano, e le coppie `["ed-…", "campo"]` per quelle
/// che ciclano su un elenco.
Set<String> _leCaselleDellaPlancia() {
  final trovate = <String>{};
  final diritta = RegExp(r'(\w+):\s*[^,\n]*getElementById\("ed-[a-z0-9-]+"\)');
  final aCoppie = RegExp(r'\["ed-[a-z0-9-]+",\s*"(\w+)"\]');
  for (final cosa in Directory(_dovStannoGliEditor).listSync()) {
    if (cosa is! File || !cosa.path.endsWith('.js')) continue;
    final testo = cosa.readAsStringSync();
    for (final trovato in diritta.allMatches(testo)) {
      trovate.add(trovato.group(1)!);
    }
    for (final trovato in aCoppie.allMatches(testo)) {
      trovate.add(trovato.group(1)!);
    }
  }
  return trovate.difference(_nonSonoCaselle);
}

/// Tutti i sorgenti dell'app, in un pezzo solo.
String _iSorgentiDellApp() {
  final tutto = StringBuffer();
  for (final cosa in Directory('lib').listSync(recursive: true)) {
    if (cosa is File && cosa.path.endsWith('.dart')) {
      tutto.write(cosa.readAsStringSync());
    }
  }
  return tutto.toString();
}

void main() {
  test('gli editor della plancia si leggono', () {
    /* Se un giorno la cartella cambiasse posto, questa prova comincerebbe a
     * passare sempre — zero caselle da controllare, nessun errore — ed e'
     * il modo in cui un campanello smette di suonare senza che nessuno lo
     * sappia. Meglio che cada qui. */
    expect(
      Directory(_dovStannoGliEditor).existsSync(),
      isTrue,
      reason:
          'gli editor della plancia non stanno piu\' in '
          '$_dovStannoGliEditor',
    );
    expect(_leCaselleDellaPlancia().length, greaterThan(15));
  });

  test('nessuna casella della plancia resta fuori dall\'app', () {
    final sorgenti = _iSorgentiDellApp();
    final fuori = [
      for (final casella in _leCaselleDellaPlancia())
        if (!sorgenti.contains("'$casella'") &&
            !sorgenti.contains('"$casella"'))
          casella,
    ]..sort();
    expect(
      fuori,
      isEmpty,
      reason:
          'queste caselle nella dashboard si riempiono e nell\'app no: '
          '${fuori.join(', ')}',
    );
  });

  /* E il contrario: una casella che l'app scrive e la plancia non legge.
   *
   * E' il difetto piu' cattivo dei due, perche' non si vede nemmeno
   * confrontando le due schermate: la casella nell'app c'e', si riempie, si
   * salva senza un errore, e non fa niente. E' successo due volte —
   * `contact_out` al posto di `inferriata`, `min` al posto di `mins` — e tutte
   * e due le volte l'ha trovata qualcuno che si chiedeva perche' la sua
   * configurazione non avesse effetto. */
  test('e nessuna casella dell\'app finisce in un posto che nessuno legge', () {
    final plancia = StringBuffer();
    for (final dove in [
      '../ponte/plancia/src/core',
      '../ponte/plancia/src/sections',
    ]) {
      for (final cosa in Directory(dove).listSync()) {
        if (cosa is File && cosa.path.endsWith('.js')) {
          plancia.write(cosa.readAsStringSync());
        }
      }
    }
    final testo = plancia.toString();
    final dichiarate = <String>{};
    final forma = RegExp(
      r"Campo(?:DellApparecchio|DellaVoce)?\(\s*'([a-zA-Z_][a-zA-Z_0-9]*)'",
    );
    for (final cosa in Directory('lib/schermate/configurazione').listSync()) {
      if (cosa is! File || !cosa.path.endsWith('.dart')) continue;
      for (final trovato in forma.allMatches(cosa.readAsStringSync())) {
        dichiarate.add(trovato.group(1)!);
      }
    }
    expect(dichiarate.length, greaterThan(20));
    final orfane = [
      for (final campo in dichiarate)
        if (!testo.contains("'$campo'") &&
            !testo.contains('"$campo"') &&
            !testo.contains('.$campo') &&
            !RegExp('\\b$campo\\s*:').hasMatch(testo))
          campo,
    ]..sort();
    expect(
      orfane,
      isEmpty,
      reason:
          'l\'app scrive queste caselle e nella plancia non le legge nessuno: '
          '${orfane.join(', ')}',
    );
  });
}
