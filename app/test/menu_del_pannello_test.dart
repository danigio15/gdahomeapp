/// Sul pannello a muro il menu non e' quello del telefono: la plancia, le
/// notifiche (il campanello) e il gruppo «Pannello» con Wi-Fi, Schermo, Suono,
/// Zigbee e Informazioni. Sul telefono quelle voci non ci sono.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/schermate/barra.dart';
import 'package:gdahome/schermate/menu.dart';

void main() {
  test('sul pannello: plancia, notifiche e le impostazioni del pannello', () {
    final voci = vociDellaBarra(
      sulMuro: true,
      chiAmministra: true,
      conZigbee: true,
    );
    expect(voci, [
      Sezione.plancia,
      Sezione.notifiche,
      Sezione.wifiDelPannello,
      Sezione.schermoDelPannello,
      Sezione.suonoDelPannello,
      Sezione.zigbeeDelPannello,
      Sezione.ilPannello,
    ]);
    expect(
      voci.where((v) => v.gruppo == GruppoDellaBarra.pannello),
      hasLength(5),
    );
  });

  test('sul telefono le voci del pannello non ci sono', () {
    final voci = vociDellaBarra(chiAmministra: true, conZigbee: true);
    expect(voci.where((v) => v.soloSulMuro), isEmpty);
    expect(voci, contains(Sezione.zigbee));
  });
}
