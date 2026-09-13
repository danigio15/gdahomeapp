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
    expect(pannello.titolo, 'gdahome');
    expect(pannello.profilo, 'primary');
    expect(pannello.istanza, '');
    expect(pannello.primario, isFalse);
    expect(pannello.varianti, isEmpty);
    expect(pannello.pagina('it'), 'dashboard.html');
  });

  test('la plancia del ponte si legge com\'e\', con i difetti giusti', () {
    final dalPonte = leggiLaPlanciaDelPonte(PonteFinto.planciaNelPonte())!;
    expect(dalPonte.base, '/dashboardmodern_static/ponte1234');
    expect(dalPonte.istanza, 'gdahome');
    expect(dalPonte.profilo, 'primary');
    expect(dalPonte.primario, isTrue);
    expect(dalPonte.percorso, 'gdahome');
    expect(dalPonte.pagina('it'), 'dashboard.html');
    expect(dalPonte.pagina('en'), 'dashboard-en.html');

    expect(leggiLaPlanciaDelPonte(null), isNull);
    expect(leggiLaPlanciaDelPonte({'base': '/altrove/x'}), isNull);
    final scarna = leggiLaPlanciaDelPonte({
      'base': '/dashboardmodern_static/x/',
    })!;
    expect(scarna.base, '/dashboardmodern_static/x');
    expect(scarna.titolo, 'gdahome');
    expect(scarna.varianti, isEmpty);
  });

  test(
    'dal filo: prima il ponte, e solo se non ce l\'ha Home Assistant',
    () async {
      final ponte = await PonteFinto.alza();
      final filo = Filo.fisso(
        indirizzo: ponte.indirizzo,
        segno: segnoBuono,
        chi: chiBuono,
        chiave: chiaveBuona,
      );
      await filo.apri();

      /* Il ponte ce l'ha: si prende quella, e get_panels non si chiede. */
      expect(
        (await trovaLaPlancia(filo))!.base,
        '/dashboardmodern_static/ponte1234',
      );
      expect(
        ponte.arrivati.where((uno) => uno['type'] == 'ponte/plancia'),
        hasLength(1),
      );
      expect(
        ponte.arrivati.where((uno) => uno['type'] == 'get_panels'),
        isEmpty,
      );

      /* Un ponte senza plancia: si guarda in Home Assistant. */
      ponte.planciaDelPonte = null;
      expect(
        (await trovaLaPlancia(filo))!.base,
        '/dashboardmodern_static/abc123',
      );
      expect(
        ponte.arrivati.where((uno) => uno['type'] == 'get_panels'),
        hasLength(1),
      );

      /* Ne' l'uno ne' l'altra. */
      ponte.pannelli = null;
      expect(await trovaLaPlancia(filo), isNull);

      await filo.chiudi();
      await ponte.spegni();
    },
  );

  test('l\'elenco delle plance viaggia con la plancia', () {
    /* Un ponte di ieri non lo manda: allora di plancia ce n'e' una, com'e'
     * sempre stato, e il selettore non si vede. */
    final sola = leggiLaPlanciaDelPonte(PonteFinto.planciaNelPonte())!;
    expect(sola.plance, isEmpty);
    expect(sola.piuDiUna, isFalse);

    final due = leggiLaPlanciaDelPonte({
      ...PonteFinto.planciaNelPonte(),
      'plance': [
        {
          'profilo': 'primary',
          'titolo': 'DashboardModern',
          'istanza': 'gdahome',
          'primaria': true,
        },
        {
          'profilo': 'casa-al-mare',
          'titolo': 'Casa al mare',
          'istanza': 'gdahome-casa-al-mare',
          'primaria': false,
        },
        /* Roba che non e' una plancia si butta, invece di farne una senza
         * nome che nel selettore comparirebbe come una riga vuota. */
        {'titolo': 'senza profilo'},
        'boh',
      ],
    })!;
    expect(due.piuDiUna, isTrue);
    expect(due.plance.map((una) => una.profilo), ['primary', 'casa-al-mare']);
    expect(due.plance.last.titolo, 'Casa al mare');
    expect(due.plance.last.istanza, 'gdahome-casa-al-mare');
    expect(due.plance.last.primaria, isFalse);
    expect(due.plance.first.primaria, isTrue);

    /* I difetti: senza titolo si mostra il nome del cassetto — brutto e
     * leggibile — e senza istanza si tiene quella di sempre. */
    final scarna = UnaPlancia.daJson({'profilo': 'x'})!;
    expect(scarna.titolo, 'x');
    expect(scarna.istanza, 'gdahome');
    expect(scarna.primaria, isFalse);
    expect(UnaPlancia.daJson({'profilo': ''}), isNull);
    expect(UnaPlancia.daJson(null), isNull);
  });

  test(
    'si chiede una plancia in particolare, e se non c\'e\' si torna alla prima',
    () async {
      final ponte = await PonteFinto.alza();
      ponte.unaPlanciaInPiu('Casa al mare');
      final filo = Filo.fisso(
        indirizzo: ponte.indirizzo,
        segno: segnoBuono,
        chi: chiBuono,
        chiave: chiaveBuona,
      );
      await filo.apri();

      /* Senza chiedere niente: la prima, che e' la risposta di sempre. E
     * l'elenco arriva insieme, senza una seconda domanda sul filo. */
      final prima = (await trovaLaPlancia(filo))!;
      expect(prima.profilo, 'primary');
      expect(prima.primario, isTrue);
      expect(prima.plance, hasLength(2));

      /* Quella scelta. */
      final mare = (await trovaLaPlancia(filo, profilo: 'casa-al-mare'))!;
      expect(mare.profilo, 'casa-al-mare');
      expect(mare.istanza, 'gdahome-casa-al-mare');
      expect(mare.titolo, 'Casa al mare');
      expect(mare.primario, isFalse);

      /* Tolta da un altro telefono: non e' un guasto, e non e' una schermata
     * vuota. Si richiede senza profilo, e si apre quella di sempre. */
      ponte.plance.removeWhere((una) => una['profilo'] == 'casa-al-mare');
      ponte.arrivati.clear();
      final tornata = (await trovaLaPlancia(filo, profilo: 'casa-al-mare'))!;
      expect(tornata.profilo, 'primary');
      expect(
        ponte.arrivati
            .where((uno) => uno['type'] == 'ponte/plancia')
            .map((uno) => uno['profilo']),
        ['casa-al-mare', null],
      );
      /* E non si e' andati a chiedere a Home Assistant: la plancia c'era. */
      expect(
        ponte.arrivati.where((uno) => uno['type'] == 'get_panels'),
        isEmpty,
      );

      await filo.chiudi();
      await ponte.spegni();
    },
  );
}
