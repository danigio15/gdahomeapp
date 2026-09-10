/// Le prove delle foto: da quale cartella arrivano.
///
/// Ce ne sono due, e la differenza conta. Quella del **ponte** e' dove finisce
/// quello che si carica dall'app. Quella di **Home Assistant** — `config/www`,
/// che la plancia chiama `/local/…` — e' dove chi ha una casa da qualche anno
/// tiene le foto delle auto, i loghi e gli sfondi: si guarda e non si tocca.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/plancia/foto.dart';

void main() {
  test('senza «roots» c\'e\' solo la cartella del ponte', () {
    /* Un add-on vecchio non sa niente di due cartelle. La maschera deve
     * comportarsi come si e' sempre comportata, non offrire un tasto che
     * porterebbe a un errore. */
    final letto = leggiLaCartella({
      'path': '',
      'available': true,
      'folders': const [],
      'images': const [
        {
          'name': 'auto.png',
          'path': 'auto.png',
          'url': '/dashboardmodern_static/www/auto.png',
        },
      ],
    });
    expect(letto.radice, RadiceDelleFoto.ilPonte);
    expect(letto.quali, {RadiceDelleFoto.ilPonte});
    expect(letto.foto.single.indirizzo, '/dashboardmodern_static/www/auto.png');
  });

  test('quando c\'e\' anche quella di Home Assistant si sa, e si dice', () {
    final letto = leggiLaCartella({
      'path': '',
      'root': 'casa',
      'roots': const {'ponte': false, 'casa': true},
      'available': true,
      'folders': const [
        {'name': 'auto', 'path': 'auto'},
      ],
      'images': const [
        {
          'name': 'sfondo.png',
          'path': 'sfondo.png',
          'url': '/local/sfondo.png',
        },
      ],
    });
    expect(letto.radice, RadiceDelleFoto.laCasa);
    expect(letto.quali, {RadiceDelleFoto.ilPonte, RadiceDelleFoto.laCasa});
    expect(letto.cartelle.single.nome, 'auto');
    /* L'indirizzo e' quello vero di Home Assistant: e' l'unico modo perche' la
     * stessa configurazione mostri la stessa foto nella plancia dentro Home
     * Assistant **e** nella plancia dentro l'app. */
    expect(letto.foto.single.indirizzo, '/local/sfondo.png');
  });

  test('nella cartella di Home Assistant non si scrive', () {
    expect(RadiceDelleFoto.ilPonte.ciSiScrive, isTrue);
    expect(RadiceDelleFoto.laCasa.ciSiScrive, isFalse);
  });

  test('una risposta storta lascia la maschera vuota, non la fa cadere', () {
    /* L'elenco arriva da fuori: una risposta strana deve dare una cartella
     * vuota, non un'eccezione dentro il disegno. */
    expect(leggiLaCartella(null).foto, isEmpty);
    expect(leggiLaCartella('ciao').cE, isFalse);
    expect(leggiLaCartella({'images': 'non un elenco'}).foto, isEmpty);
  });
}
