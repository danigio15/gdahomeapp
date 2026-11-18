import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/ponte/abbinamento.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/* «Ho sempre avuto la licenza Base e fino a pochi giorni fa dall'esterno
 * funzionava». Gli add-on di prima della 1.19.0 dicevano «da casa» con una
 * regola larga (una VPN con indirizzi privati, un proxy) e non fermavano
 * nessuno: il loro `da_casa` non si ascolta più. */

http.Client _risponde(Map<String, Object?> corpo) =>
    MockClient((_) async => http.Response(jsonEncode(corpo), 200));

void main() {
  final salute = Uri.parse('https://casa.prova/salute');

  test('un add-on che fa valere Base da sé: il suo «da casa» vale', () async {
    final detto = await Abbinamento.salute(
      salute,
      cliente: _risponde({
        'vivo': true,
        'da_casa': true,
        'base_solo_casa': true,
      }),
    );
    expect(detto.vivo, isTrue);
    expect(detto.daCasa, isTrue);
  });

  test('un add-on di prima: il suo «da casa» non si ascolta', () async {
    final detto = await Abbinamento.salute(
      salute,
      cliente: _risponde({'vivo': true, 'da_casa': true}),
    );
    expect(detto.vivo, isTrue);
    expect(
      detto.daCasa,
      isNull,
      reason: 'vale solo l\'indirizzo di rete locale',
    );
  });
}
