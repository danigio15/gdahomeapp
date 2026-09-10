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

  /* Le caselle di una scheda, controllate contro **il suo** modello.
   *
   * Il controllo qui sotto — «la parola compare da qualche parte nella
   * plancia» — e' un pavimento troppo basso, e si e' visto: `temp`, `battery`,
   * `load`, `status` compaiono tutte, in altri file e per altre cose, e
   * intanto la temperatura di uno scaldabagno finiva in `temp` mentre
   * `normalizeScaldabagni` legge `temperatura`, e le tre caselle di un gruppo
   * di continuita' finivano in `battery`/`load`/`status` mentre
   * `normalizzaUps` legge `batteria`/`carico`/`stato`. Si riempivano, si
   * salvavano, e la scheda restava vuota.
   *
   * Qui ogni scheda si controlla contro il file che ne dichiara la forma. La
   * tabella e' scritta a mano ed e' giusto cosi': dice, riga per riga, dove
   * sta la verita' di quella scheda.
   */
  const modelli = <String, String>{
    'Scaldabagni': '../ponte/plancia/src/core/scaldabagno-model.js',
    'Continuita\'': '../ponte/plancia/src/core/ups-model.js',
    'Robot': '../ponte/plancia/src/core/robot-model.js',
    'Quadro avvisi': '../ponte/plancia/src/sections/home-widgets-section.js',
  };

  test('le caselle di una scheda le legge il suo modello', () {
    final voci = File('lib/schermate/configurazione/voci.dart')
        .readAsStringSync();
    /* Le voci stanno in uno `switch` sul titolo: ognuna va da dove comincia
     * la sua riga fino a dove comincia la prossima.
     *
     * `split` non serve: in Dart non restituisce i gruppi catturati, quindi i
     * titoli si perderebbero per strada e la tabella qui sopra non troverebbe
     * piu' niente — cioe' la prova passerebbe sempre. */
    final teste = RegExp(r"\n  '((?:[^'\\]|\\.)*)' =>")
        .allMatches(voci)
        .toList();
    final campiPerVoce = <String, List<String>>{};
    for (final (quale, testa) in teste.indexed) {
      final fino = quale + 1 < teste.length
          ? teste[quale + 1].start
          : voci.length;
      final corpo = voci.substring(testa.end, fino);
      campiPerVoce[testa.group(1)!.replaceAll("\\'", "'")] = [
        for (final trovato in RegExp(
          r"Campo(?:DellApparecchio|DellaVoce)?\(\s*'([a-zA-Z_][a-zA-Z_0-9]*)'",
        ).allMatches(corpo))
          trovato.group(1)!,
      ];
    }
    /* Se un giorno una voce cambiasse titolo, la tabella non troverebbe piu'
     * niente e il controllo passerebbe sempre. Meglio che cada qui. */
    for (final titolo in modelli.keys) {
      expect(
        campiPerVoce[titolo],
        isNotNull,
        reason: 'nessuna voce si chiama piu\' «$titolo»',
      );
      expect(campiPerVoce[titolo], isNotEmpty, reason: titolo);
    }

    final fuori = <String>[];
    for (final voce in modelli.entries) {
      final modello = File(voce.value).readAsStringSync();
      for (final campo in campiPerVoce[voce.key]!) {
        /* Il nome intero, non un pezzo di un altro: cercando «temp» come
         * sottostringa lo si trova dentro `.temperatura`, e la prova che
         * doveva accorgersi proprio di quello passava contenta. */
        if (RegExp('[.\'"]${RegExp.escape(campo)}\\b').hasMatch(modello)) {
          continue;
        }
        fuori.add('${voce.key}: «$campo» non sta in ${voce.value}');
      }
    }
    expect(fuori..sort(), isEmpty, reason: fuori.join('; '));
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

  /* E la **forma** di una chiave, che e' il terzo modo di scollegarsi.
   *
   * Non basta che i campi ci siano: conta se una chiave tiene un elenco o un
   * oggetto. `cd_impianti_termici` sembrava una famiglia come le auto e non lo
   * e' — tiene tre si'/no, «cosa c'e' nel locale caldaia» — e l'app ci
   * scriveva un elenco: `normalizzaScelta` scarta un Array, quindi la scelta
   * fatta dal browser spariva al primo salvataggio dall'app.
   * `cd_fumo_rilevato` era il contrario: un elenco letto come mappa, e il
   * registro dei rilevatori che hanno suonato risultava sempre vuoto.
   *
   * La forma la dichiara la plancia stessa, nel valore di ripiego che passa a
   * `readJson`: `[]` vuol dire elenco, `{}` oggetto. Qui si controlla che l'app
   * non legga con l'attrezzo dell'altra forma.
   */
  test('e ogni chiave ha la forma che la plancia le da\'', () {
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
    final elenchi = <String>{};
    final oggetti = <String>{};
    final forma = RegExp(r'readJson\(\s*"(cd_[a-z0-9_]+)"\s*,\s*(\[\]|\{\})');
    for (final trovato in forma.allMatches(plancia.toString())) {
      (trovato.group(2) == '[]' ? elenchi : oggetti).add(trovato.group(1)!);
    }
    expect(elenchi.length + oggetti.length, greaterThan(10));

    final app = _iSorgentiDellApp();
    /* Il nome che la costante ha in Dart, quando ce l'ha: si legge la chiave
     * per nome piu' spesso che per stringa. */
    String? costanteDi(String chiave) {
      final trovata = RegExp("const (\\w+) = '${RegExp.escape(chiave)}';")
          .firstMatch(app);
      return trovata?.group(1);
    }

    final sbagliate = <String>[];
    for (final (quali, attrezzoSbagliato, comEChiamato) in [
      (elenchi, 'mappa', 'un elenco letto come mappa'),
      (oggetti, 'oggetti', 'un oggetto letto come elenco'),
    ]) {
      for (final chiave in quali) {
        /* Una chiave puo' essere letta in tutte e due le forme dalla plancia
         * — `cd_stanze` lo e' — e allora non c'e' niente da dire. */
        if (elenchi.contains(chiave) && oggetti.contains(chiave)) continue;
        for (final come in [("'$chiave'"), costanteDi(chiave)]) {
          if (come == null) continue;
          if (app.contains('scatto.$attrezzoSbagliato($come)')) {
            sbagliate.add('$chiave: $comEChiamato');
          }
        }
      }
    }
    expect(sbagliate..sort(), isEmpty, reason: sbagliate.join('; '));

    /* `cd_impianti_termici` non passa dal controllo qui sopra — la plancia lo
     * legge con `readJson(CHIAVE_IMPIANTI, null)`, e `null` non dice che forma
     * abbia — ma e' proprio quello che si era scollegato, quindi si dice a
     * mano. Tre si'/no, non un elenco: se un giorno tornasse a essere una
     * famiglia come le auto, la scelta fatta dal browser sparirebbe di nuovo
     * al primo salvataggio dall'app. */
    expect(
      app.contains("chiave: 'cd_impianti_termici'"),
      isFalse,
      reason:
          'cd_impianti_termici tiene tre si\'/no («cosa c\'e\' nel locale '
          'caldaia»), non un elenco di impianti: normalizzaScelta scarta un '
          'Array e la scelta si perde',
    );
  });
}
