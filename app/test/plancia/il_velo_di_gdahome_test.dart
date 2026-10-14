import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/il_velo_di_gdahome.dart';

/// Il velo d'avvio della plancia: dentro l'app mai col marchio di serie.
void main() {
  const diSerie =
      '<body><div id="cd-boot-overlay"><img src="data:image/png;base64,AAAA" alt=""><b>DashboardModern</b><i></i></div>';

  test('il velo di serie diventa quello di gdahome: logo e parola', () {
    final fatto = colVeloDiGdahome(diSerie);
    expect(fatto, isNot(contains('DashboardModern')));
    expect(fatto, contains('<b>gdahome</b>'));
    expect(fatto, contains('<img src="data:image/webp;base64,$logoDelVelo"'));
    expect(fatto, isNot(contains('base64,AAAA')));
  });

  test('con la parola scelta da chi ha montato l\'impianto, quella', () {
    expect(
      colVeloDiGdahome(diSerie, velo: 'Casa <Rossi>'),
      contains('<b>Casa Rossi</b>'),
    );
  });

  test('una pagina gia\' rivestita dal ponte resta com\'e\', col suo logo', () {
    const rivestita =
        '<div id="cd-boot-overlay"><img src="data:image/png;base64,LOGODELSUO" alt=""><b>Rossi impianti</b>';
    expect(colVeloDiGdahome(rivestita), rivestita);
  });

  test('il logo e\' lo stesso del ponte', () {
    final delPonte = File('../ponte/marchio/gdahome-velo.webp');
    if (!delPonte.existsSync()) return;
    expect(logoDelVelo, isNotEmpty);
    expect(
      Uri.parse('data:image/webp;base64,$logoDelVelo').data!.contentAsBytes(),
      delPonte.readAsBytesSync(),
    );
  });

  test('la pagina della plancia ha ancora il velo come lo si cerca qui', () {
    final pagina = File('../ponte/plancia/legacy/dashboard.html');
    if (!pagina.existsSync()) return;
    final fatto = colVeloDiGdahome(pagina.readAsStringSync());
    expect(fatto, isNot(contains('<b>DashboardModern</b>')));
    expect(
      fatto,
      contains(
        '<div id="cd-boot-overlay"><img src="data:image/webp;base64,$logoDelVelo"',
      ),
    );
  });
}
