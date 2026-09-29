/// «Mappa rete zigbee non si carica.»
///
/// Dal tablet, da fuori casa, su una rete vera da 74 dispositivi: «La mappa non
/// c'è ancora — Home Assistant non ha risposto in tempo».
///
/// Era falso due volte. Home Assistant stava rispondendo, e chi aveva smesso di
/// aspettare era l'app: la mappa si chiedeva senza dire quanto si e' disposti
/// ad aspettare, quindi cadeva sull'attesa di serie del filo — venti secondi,
/// giusta per ogni altro comando, che sono domande a cui si risponde subito.
/// Il ponte invece la mappa la aspetta **novanta** secondi, perche' il
/// coordinatore chiede a un ripetitore alla volta e su una rete grossa il giro
/// dei vicini ci mette un minuto buono.
///
/// Venti contro novanta: l'app mollava mentre il ponte stava ancora lavorando.
///
/// Questa prova tiene fermo il rapporto fra i due numeri leggendoli **dai due
/// file veri**, non ricopiandoli: se domani qualcuno allunga l'attesa del ponte
/// e si dimentica dell'app, il guasto torna identico e in silenzio. Qui invece
/// diventa rossa.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/zigbee.dart';

/// I novanta secondi del ponte, letti da `ponte/src/zigbee.js`.
Duration _attesaDelPonte() {
  final sorgente = File('../ponte/src/zigbee.js').readAsStringSync();
  final trovato = RegExp(r'ATTESA_DELLA_MAPPA\s*=\s*([\d_]+)')
      .firstMatch(sorgente);
  expect(
    trovato,
    isNotNull,
    reason:
        'in ponte/src/zigbee.js non c\'e\' piu\' ATTESA_DELLA_MAPPA: '
        'se e\' stata rinominata, qui va aggiornato il modo di leggerla',
  );
  return Duration(
    milliseconds: int.parse(trovato!.group(1)!.replaceAll('_', '')),
  );
}

void main() {
  test('la mappa si aspetta piu\' a lungo di quanto la aspetti il ponte', () {
    final delPonte = _attesaDelPonte();
    expect(delPonte, const Duration(seconds: 90));
    expect(
      attesaDellaMappa,
      greaterThan(delPonte),
      reason:
          'l\'app deve smettere di ascoltare DOPO il ponte, non prima: chi '
          'decide quando arrendersi dev\'essere chi sa quanto ci vuole',
    );
  });

  test('e piu\' a lungo dell\'attesa di serie, che e\' quella del guasto', () {
    /* Venti secondi: l'attesa che aveva prima, e che bastava a far scrivere
     * «Home Assistant non ha risposto in tempo» su una rete grossa. */
    expect(attesaDellaMappa, greaterThan(const Duration(seconds: 20)));
  });
}
