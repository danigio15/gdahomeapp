/// Le prove del pannello: trovare la plancia in quello che risponde
/// `get_panels`.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/pannello.dart';
import 'package:gdahome/ponte/filo.dart';

import '../ponte/ponte_finto.dart';

void main() {
  test('si trova il pannello della plancia, con tutto quello che serve', () {
    final pannello = leggiIPannelli(PonteFinto.pannelliConLaPlancia());
    expect(pannello, isNotNull);
    expect(pannello!.percorso, 'dashboardmodern');
    expect(pannello.base, '/dashboardmodern_static/abc123');
    expect(pannello.istanza, 'e1');
    expect(pannello.profilo, 'primary');
    expect(pannello.primario, isTrue);
    expect(pannello.titolo, 'DashboardModern');
    expect(pannello.varianti, ['dashboard-en.html', 'dashboard.html']);
  });

  test('la pagina si sceglie per lingua, e l\'italiano c\'e\' sempre', () {
    final pannello = leggiIPannelli(PonteFinto.pannelliConLaPlancia())!;
    expect(pannello.pagina('it'), 'dashboard.html');
    expect(pannello.pagina('en'), 'dashboard-en.html');
    /* Una lingua che non c'e' va sull'inglese, se c'e'. */
    expect(pannello.pagina('de'), 'dashboard-en.html');
    expect(
      pannello.percorsoDellaPagina('it'),
      '/dashboardmodern_static/abc123/legacy/dashboard.html',
    );

    final soloItaliano = PannelloDellaPlancia(
      percorso: 'dashboardmodern',
      titolo: 'x',
      base: '/dashboardmodern_static/x',
      istanza: '',
      profilo: 'primary',
      primario: true,
      varianti: const ['dashboard.html'],
    );
    expect(soloItaliano.pagina('en'), 'dashboard.html');
    expect(soloItaliano.pagina('de'), 'dashboard.html');
  });

  test('una casa senza DashboardModern non ha quel pannello', () {
    expect(
      leggiIPannelli({
        'lovelace': {'config': null},
      }),
      isNull,
    );
    expect(leggiIPannelli(null), isNull);
    expect(leggiIPannelli('boh'), isNull);
    expect(leggiIPannelli(<String, dynamic>{}), isNull);
    /* Un pannello personalizzato qualunque non e' la plancia. */
    expect(
      leggiIPannelli({
        'altro': {
          'component_name': 'custom',
          'config': {'static_base': '/altro_static/1'},
        },
      }),
      isNull,
    );
  });

  test('con piu\' plance si prende la principale', () {
    final due = {
      'dashboardmodern-mare': {
        'url_path': 'dashboardmodern-mare',
        'config': {
          'static_base': '/dashboardmodern_static/v/',
          'instance_id': 'mare',
          'config_profile': 'mare',
          'primary': false,
          'title': 'Al mare',
          'legacy_variants': ['dashboard.html'],
        },
      },
      'dashboardmodern': {
        'url_path': 'dashboardmodern',
        'config': {
          'static_base': '/dashboardmodern_static/v',
          'instance_id': 'casa',
          'config_profile': 'primary',
          'primary': true,
          'title': 'Casa',
          'legacy_variants': ['dashboard.html'],
        },
      },
    };
    final scelto = leggiIPannelli(due)!;
    expect(scelto.istanza, 'casa');
    expect(scelto.primario, isTrue);

    /* Senza nessuna marcata come principale vince quella col percorso
     * storico; e la barra in fondo alla base si toglie. */
    (due['dashboardmodern']!['config'] as Map)['primary'] = false;
    expect(leggiIPannelli(due)!.istanza, 'casa');
    expect(leggiIPannelli(due)!.base, '/dashboardmodern_static/v');
  });

  test('quello che manca ha un difetto ragionevole', () {
    final pannello = leggiIPannelli({
      'dashboardmodern': {
        'config': {'static_base': '/dashboardmodern_static/v'},
      },
    })!;
    expect(pannello.percorso, 'dashboardmodern');
    expect(pannello.titolo, 'DashboardModern');
    expect(pannello.profilo, 'primary');
    expect(pannello.istanza, '');
    expect(pannello.primario, isFalse);
    expect(pannello.varianti, isEmpty);
    expect(pannello.pagina('it'), 'dashboard.html');
  });

  test('dal filo: si chiede get_panels e si legge la risposta', () async {
    final ponte = await PonteFinto.alza();
    final filo = Filo.fisso(
      indirizzo: ponte.indirizzo,
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
    );
    await filo.apri();

    expect(
      (await trovaLaPlancia(filo))!.base,
      '/dashboardmodern_static/abc123',
    );
    expect(
      ponte.arrivati.where((uno) => uno['type'] == 'get_panels'),
      hasLength(1),
    );

    ponte.pannelli = null;
    expect(await trovaLaPlancia(filo), isNull);

    await filo.chiudi();
    await ponte.spegni();
  });
}
