/// Il parcheggio della plancia: un patto fra due programmi, e i nomi contano.
///
/// La plancia sa gia' mettersi a riposo. Dentro Home Assistant, quando si va
/// su un'altra pagina, chi la ospita le scrive addosso un segno — il
/// parcheggio — e lei smette di disegnare: il disegno del guscio, i timer, le
/// animazioni. Il patto sta scritto in due posti, `legacy/host.js` di la' e
/// `sections/shared.js` di qua, ed e' fatto di due nomi.
///
/// Nell'app quel segno non glielo scriveva nessuno. Le altre sezioni si
/// ricevono un `visibile` e si azzittiscono; la plancia restava a pieno ritmo
/// sotto una schermata che non la mostrava. Si vedeva nel video di un tablet:
/// fermate dello schermo anche sulle schermate dell'app, dove la plancia non
/// c'entrava niente — se non che stava ancora lavorando sotto.
///
/// Queste prove tengono i nomi allineati. Un patto fra due programmi si rompe
/// il giorno che uno dei due cambia una lettera, e non se ne accorge nessuno
/// perche' non smette di funzionare: smette di **servire**.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// La plancia non sta dentro `app/`: sta nel ponte, e le prove dell'app
/// girano con la cartella `app/` sotto i piedi.
File _dellaPlancia(String dentro) => File('../ponte/plancia/$dentro');

void main() {
  test('il segno del parcheggio si chiama uguale nei due programmi', () {
    final suoi = _dellaPlancia('src/sections/shared.js').readAsStringSync();
    final ospite = _dellaPlancia('src/legacy/host.js').readAsStringSync();
    final nostro = File('lib/schermate/riquadro/sul_telefono.dart')
        .readAsStringSync();

    const segno = '__DASHBOARDMODERN_PARCHEGGIATA__';
    expect(
      suoi,
      contains(segno),
      reason: 'la plancia non legge piu\' quel segno',
    );
    expect(
      ospite,
      contains(segno),
      reason: 'chi la ospita non lo scrive piu\'',
    );
    expect(
      nostro,
      contains(segno),
      reason: 'l\'app scrive un segno che la plancia non guarda',
    );
  });

  test('e l\'evento pure, o chi la riprende la trova ferma', () {
    final ospite = _dellaPlancia('src/legacy/host.js').readAsStringSync();
    final guscio = _dellaPlancia(
      'src/sections/il-guscio-disegna-quando-serve-section.js',
    ).readAsStringSync();
    final nostro = File('lib/schermate/riquadro/sul_telefono.dart')
        .readAsStringSync();

    const evento = 'dashboardmodern:parcheggio';
    expect(ospite, contains(evento));
    expect(
      guscio,
      contains(evento),
      reason: 'il disegno del guscio non si sveglia piu\' quando la riprendi',
    );
    expect(nostro, contains(evento));
  });

  test('al ritorno si dice anche «rimettiti in pari»', () {
    /* `pageshow` e' il modo con cui la plancia capisce che deve rifare il
       giro: lo manda gia' chi la ospita dentro Home Assistant, e due modi
       diversi di svegliarla sarebbero due modi da tenere allineati. */
    final nostro = File('lib/schermate/riquadro/sul_telefono.dart')
        .readAsStringSync();
    final dove = nostro.indexOf('Future<void> parcheggia(');
    expect(dove, isNot(-1), reason: 'il parcheggio non c\'e\' piu\'');
    final corpo = nostro.substring(dove, nostro.indexOf('\n}', dove));
    expect(corpo, contains('pageshow'));
    /* E solo al ritorno: mandarlo mentre la si parcheggia vorrebbe dire
       svegliarla nello stesso momento in cui le si dice di dormire. */
    expect(corpo, contains('parcheggiata ?'));
  });

  test('nel browser il parcheggio c\'e\', e non fa niente', () {
    /* Le due parti dell'app chiamano le stesse cose: quale delle due abbia
       qualcosa da fare lo decide il file, non chi chiama. Nel browser la
       cornice non disegna quando l'app mostra un'altra schermata, e la scheda
       in secondo piano la plancia se la vede da se'. */
    final web = File('lib/schermate/riquadro/sul_web.dart').readAsStringSync();
    expect(web, contains('Future<void> parcheggia('));
  });
}
