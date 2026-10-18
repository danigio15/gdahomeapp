/// «La notifica della lavastoviglie ha l'icona della lavatrice.»
///
/// In testa alla scheda di un ciclo c'e' il disegno dell'elettrodomestico che
/// ha finito — quello del suo tipo, lo stesso della plancia — e non piu' il
/// cestello della sezione per tutti.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/notifiche/scheda.dart';

import 'schede_di_prova.dart';

Map<String, dynamic> _ciclo(String nome, [String? tipo]) =>
    {...schedeDiProva['ciclo']!, 'n': nome, 'i': tipo}
      ..removeWhere((_, valore) => valore == null);

void main() {
  test('la lavastoviglie ha la sua faccia, non quella della lavatrice', () {
    final lavastoviglie = disegnoDelCiclo(
      _ciclo('Lavastoviglie', 'dishwasher'),
    );
    final lavatrice = disegnoDelCiclo(_ciclo('Lavatrice', 'washer'));
    expect(lavastoviglie, 'elettrodomestici/dishwasher');
    expect(lavatrice, 'elettrodomestici/washer');
    expect(lavastoviglie, isNot(lavatrice));
  });

  test('il tipo che manda la casa vince sul nome', () {
    expect(disegnoDelCiclo(_ciclo('Cucina', 'oven')), 'elettrodomestici/oven');
    expect(
      disegnoDelCiclo(_ciclo('Lavatrice', 'air-conditioner')),
      'elettrodomestici/air-conditioner',
    );
  });

  test('un ponte di prima: le parole italiane, o niente, e decide il nome', () {
    expect(
      disegnoDelCiclo(_ciclo('Lavastoviglie', 'lavastoviglie')),
      'elettrodomestici/dishwasher',
    );
    expect(
      disegnoDelCiclo(_ciclo('Asciugatrice', 'asciugatrice')),
      'elettrodomestici/dryer',
    );
    expect(disegnoDelCiclo(_ciclo('Forno', 'altro')), 'elettrodomestici/oven');
    expect(
      disegnoDelCiclo(_ciclo('Lavastoviglie')),
      'elettrodomestici/dishwasher',
    );
  });

  test('quello che non si sa prende la presa generica', () {
    expect(
      disegnoDelCiclo(_ciclo('Presa studio', 'generic')),
      'elettrodomestici/generic',
    );
    expect(
      disegnoDelCiclo(_ciclo('Qualcosa', 'un-tipo-che-non-esiste')),
      'elettrodomestici/generic',
    );
    expect(disegnoDelCiclo({'t': 'ciclo'}), 'elettrodomestici/generic');
  });

  testWidgets('disegnate davvero: la lavastoviglie e la lavatrice non sono '
      'lo stesso disegno', (tester) async {
    Future<DisegnoDellaNotifica> disegna(String nome, String tipo) async =>
        (await tester.runAsync(
          () => disegnaLaNotifica(
            scheda: _ciclo(nome, tipo),
            attesa: const Duration(seconds: 30),
          ),
        ))!;
    final lavastoviglie = await disegna('Lavastoviglie', 'dishwasher');
    final lavatrice = await disegna('Lavatrice', 'washer');
    final presa = await disegna('Presa studio', 'generic');
    // L'icona piccola e' solo il disegno: e' li' che si vede la differenza.
    expect(lavastoviglie.icona, isNotNull);
    expect(lavatrice.icona, isNotNull);
    expect(presa.icona, isNotNull);
    expect(lavastoviglie.icona, isNot(equals(lavatrice.icona)));
    expect(presa.icona, isNot(equals(lavatrice.icona)));
    expect(presa.icona, isNot(equals(lavastoviglie.icona)));
  });
}
