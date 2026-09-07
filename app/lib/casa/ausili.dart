/// Due cose piccole che servono in piu' posti.
library;

import 'dart:math';

/// Un identificativo che non si ripete. Non e' un segreto: serve solo a
/// distinguere due case che si chiamano tutte e due «Casa».
String identificativoNuovo() {
  final caso = Random();
  final cifre = List.generate(
    8,
    (_) => caso.nextInt(256).toRadixString(16).padLeft(2, '0'),
  );
  return 'casa_${cifre.join()}';
}

/// Un nome scritto da una persona, ridotto a qualcosa che sta su una riga.
String nomePulito(
  String scritto, {
  required String quandoVuoto,
  int massimo = 40,
}) {
  final pulito = scritto.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (pulito.isEmpty) return quandoVuoto;
  return pulito.length <= massimo ? pulito : pulito.substring(0, massimo);
}
