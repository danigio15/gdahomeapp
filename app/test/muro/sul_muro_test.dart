/// Sul pannello a muro la plancia sta ferma nel modo leggero.
///
/// Un NSPanel Pro ha Android 8.1 e un chip grafico piccolo: coi vetri sfocati
/// e la composizione ibrida andava a scatti, e i comandi arrivavano tardi.
/// Le impostazioni scritte prima — anche quelle di serie di un telefono — non
/// lo rimettono com'era.
library;

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/casa/impostazioni.dart';

void main() {
  test('sul muro: plancia leggera, niente composizione ibrida', () async {
    final dispensa = DispensaInMemoria();
    await dispensa.scrivi(
      jsonEncode({'plancia_leggera': false, 'composizione_ibrida': true}),
    );
    final muro = Impostazioni(
      sulTelefono: true,
      android: true,
      pannelloAMuro: true,
      dispensa: dispensa,
    );
    await muro.carica();
    expect(muro.planciaLeggera, isTrue);
    expect(muro.composizioneIbrida, isFalse);
    expect(muro.pannelloAMuro, isTrue);
  });

  test('sul telefono resta come prima', () async {
    final telefono = Impostazioni(
      sulTelefono: true,
      android: true,
      dispensa: DispensaInMemoria(),
    );
    await telefono.carica();
    expect(telefono.planciaLeggera, isFalse);
    expect(telefono.composizioneIbrida, isTrue);
    expect(telefono.pannelloAMuro, isFalse);
  });
}
