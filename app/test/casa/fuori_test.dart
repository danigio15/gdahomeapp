/// Le prove di quello che si apre fuori dall'app, e di a chi si da' una
/// chiave.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/fuori.dart';

void main() {
  test('fuori si aprono solo pagine: http e https, con una casa', () {
    expect(siApreFuori(Uri.parse('https://github.com/x')), isTrue);
    expect(siApreFuori(Uri.parse('http://esempio.it/')), isTrue);
    /* Gli altri schemi chiedono al telefono di fare qualcosa, non di
     * mostrare una pagina: da un link in una nota non si fanno. */
    for (final no in [
      'intent://scan/#Intent;scheme=zxing;end',
      'file:///etc/hosts',
      'javascript:alert(1)',
      'tel:+390000000',
      'sms:+390000000',
      'market://details?id=x',
      'data:text/html,<b>x</b>',
      'https:///senza-casa',
      '/solo/un/percorso',
    ]) {
      expect(siApreFuori(Uri.parse(no)), isFalse, reason: no);
    }
  });

  test('il codice va solo a un quadro in https, o al proprio computer', () {
    expect(eUnQuadroSicuro(Uri.parse('https://quadro.gdahome.org/')), isTrue);
    expect(eUnQuadroSicuro(Uri.parse('http://quadro.gdahome.org/')), isFalse);
    expect(eUnQuadroSicuro(Uri.parse('http://192.168.1.2:8080/')), isFalse);
    expect(eUnQuadroSicuro(Uri.parse('http://localhost:8080/')), isTrue);
    expect(eUnQuadroSicuro(Uri.parse('http://127.0.0.1:8080/')), isTrue);
    expect(eUnQuadroSicuro(Uri.parse('http://[::1]:8080/')), isTrue);
    expect(eUnQuadroSicuro(Uri.parse('ftp://quadro.gdahome.org/')), isFalse);
  });

  test(
    'PayPal e\' un pagamento fuori dal negozio, e su iPhone non si apre',
    () {
      /* Il «Sostieni il progetto» della plancia, com'e' scritto li'. */
      expect(
        eUnPagamentoFuori(
          Uri.parse('https://www.paypal.com/paypalme/giovannidaniello15'),
        ),
        isTrue,
      );
      expect(eUnPagamentoFuori(Uri.parse('https://paypal.me/x')), isTrue);
      expect(eUnPagamentoFuori(Uri.parse('https://WWW.PayPal.com/x')), isTrue);
      /* Un nome che finisce come PayPal non e' PayPal, e il resto passa. */
      expect(eUnPagamentoFuori(Uri.parse('https://nopaypal.com/x')), isFalse);
      expect(eUnPagamentoFuori(Uri.parse('https://www.windy.com/')), isFalse);
      expect(eUnPagamentoFuori(Uri.parse('https://github.com/x')), isFalse);
    },
  );

  test('dentro la plancia si tiene solo il riquadro di Windy', () {
    expect(
      eUnaCorniceAmmessa(
        Uri.parse(
          'https://embed.windy.com/embed.html?type=map&lat=45.46&lon=9.19&zoom=8',
        ),
      ),
      isTrue,
    );
    for (final no in [
      'http://embed.windy.com/embed.html',
      'https://www.windy.com/?45.46,9.19,8',
      'https://embed.windy.com.esempio.org/embed.html',
      'https://esempio.org/embed.html',
      'https://embed.windy.com:8443/embed.html',
      'https://qualcuno@embed.windy.com/embed.html',
      'javascript:alert(1)',
      'about:blank',
    ]) {
      expect(eUnaCorniceAmmessa(Uri.parse(no)), isFalse, reason: no);
    }
  });

  group('il telefono stesso non si apre mai nel browser', () {
    test('localhost, 127.x e ::1 sono del telefono; il resto no', () {
      for (final si in [
        'http://127.0.0.1:0/dashboardmodern_static/x/legacy/dashboard.html',
        'http://127.0.0.1:43117/',
        'http://127.0.0.2/',
        'http://localhost:8080/',
        'http://LOCALHOST/',
        'http://[::1]:43117/',
      ]) {
        expect(eDelTelefono(Uri.parse(si)), isTrue, reason: si);
      }
      for (final no in [
        'https://github.com/x',
        'http://192.168.1.10:8123/',
        'https://embed.windy.com/x',
        'http://128.0.0.1/',
      ]) {
        expect(eDelTelefono(Uri.parse(no)), isFalse, reason: no);
      }
    });

    /* «Mi è arrivata la notifica del movimento delle telecamere, mi ha
     * aperto una pagina web»: Safari su 127.0.0.1, «porta rete limitata».
     * La pagina servita era sulla 43117; il riquadro chiedeva la stessa
     * plancia con la porta zero, rifatta mentre il sistema aveva chiuso la
     * porta, e quello che non era «di casa» finiva nel browser. */
    const servita = 'http://127.0.0.1:43117';
    bool diCasa(String indirizzo) => indirizzo.startsWith(servita);

    test('la pagina servita: si va', () {
      expect(
        laStradaDelRiquadro(
          '$servita/dashboardmodern_static/x/legacy/dashboard.html?k=1',
          paginaIntera: true,
          siPuoAndare: diCasa,
        ),
        StradaDelRiquadro.vai,
      );
    });

    test('la stessa plancia con un\'altra porta, o la porta zero: si riapre '
        'la pagina vera, mai nel browser', () {
      for (final vecchia in [
        'http://127.0.0.1:0/dashboardmodern_static/x/legacy/dashboard.html',
        'http://127.0.0.1:43118/dashboardmodern_static/x/legacy/dashboard.html',
        'http://localhost:43117/',
      ]) {
        expect(
          laStradaDelRiquadro(vecchia, paginaIntera: true, siPuoAndare: diCasa),
          StradaDelRiquadro.riapri,
          reason: vecchia,
        );
        expect(
          laStradaDelRiquadro(
            vecchia,
            paginaIntera: false,
            siPuoAndare: diCasa,
          ),
          StradaDelRiquadro.resta,
          reason: 'un riquadro interno: si ferma e basta',
        );
      }
    });

    test('i collegamenti veri escono ancora; Windy resta cornice', () {
      expect(
        laStradaDelRiquadro(
          'https://www.paypal.com/donate',
          paginaIntera: true,
          siPuoAndare: diCasa,
        ),
        StradaDelRiquadro.fuori,
      );
      expect(
        laStradaDelRiquadro(
          'https://embed.windy.com/embed2.html?lat=1',
          paginaIntera: false,
          siPuoAndare: diCasa,
        ),
        StradaDelRiquadro.vai,
      );
      expect(
        laStradaDelRiquadro(
          'https://embed.windy.com/embed2.html?lat=1',
          paginaIntera: true,
          siPuoAndare: diCasa,
        ),
        StradaDelRiquadro.fuori,
      );
    });
  });
}
