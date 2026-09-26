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
}
