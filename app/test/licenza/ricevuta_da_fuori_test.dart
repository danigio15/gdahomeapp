/// La ricevuta di chi compra fuori casa, portata dal centralino.
///
/// La firma e' la stessa della casa: il vettore qui sotto sta uguale in
/// `ponte/test/ricevuta-da-fuori.test.js`. Se cambia da una parte, una delle
/// due prove cade.
library;

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/licenza/ricevuta_da_fuori.dart';
import 'package:gdahome/ponte/indirizzo.dart';

const _casa = 'casa_0123456789abcdef0123456789abcdef';
const _chi = 'dm_0123456789abcdef';
const _chiave =
    '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
const _adesso = 1760000000000;
const _firmaDelVettore = 'kPMUsCuWIslki3PWUUhD13AreHc879BRMMogvYqCRZQ';

final _centralino = IndirizzoDelCentralino.leggi(
  'wss://centralino.esempio.it',
)!;

Future<EsitoDellaRicevuta> _porta(ConsegnaAlCentralino consegna) =>
    portaLaRicevutaDaFuori(
      centralino: _centralino,
      casa: _casa,
      chi: _chi,
      chiaveDelFilo: _chiave,
      piattaforma: 'ios',
      prodotto: 'gdahome_premium_mensile',
      ricevuta: '2000000123456789',
      adesso: () => DateTime.fromMillisecondsSinceEpoch(_adesso),
      consegna: consegna,
    );

void main() {
  test('la firma del vettore è quella che controlla la casa', () async {
    expect(
      await firmaDellaRicevuta(
        chiaveDelFilo: _chiave,
        casa: _casa,
        chi: _chi,
        quando: _adesso,
        app: 'gdahome',
        piattaforma: 'ios',
        prodotto: 'gdahome_premium_mensile',
        ricevuta: '2000000123456789',
      ),
      _firmaDelVettore,
    );
  });

  test('si consegna al centralino della casa, col corpo firmato', () async {
    Uri? dove;
    Object? corpo;
    final esito = await _porta((d, c) async {
      dove = d;
      corpo = jsonDecode(c);
      return (
        200,
        jsonEncode({
          'gdahome': {'attiva': true},
          'gettoni': {'gdahome': 'payload.firma'},
        }),
      );
    });
    expect(dove.toString(), 'https://centralino.esempio.it/licenza/$_casa');
    expect(corpo, {
      'v': 1,
      'chi': _chi,
      'quando': _adesso,
      'app': 'gdahome',
      'piattaforma': 'ios',
      'prodotto': 'gdahome_premium_mensile',
      'ricevuta': '2000000123456789',
      'firma': _firmaDelVettore,
    });
    expect(esito.arrivata, isTrue);
    expect(esito.rifiutataDalNegozio, isFalse);
    expect((esito.detto! as Map)['gettoni'], {'gdahome': 'payload.firma'});
  });

  test('il no del negozio è definitivo; quelli della strada no', () async {
    final noDelNegozio = await _porta(
      (_, _) async => (402, '{"errore":"ricevuta-non-valida"}'),
    );
    expect(noDelNegozio.rifiutataDalNegozio, isTrue);
    expect(noDelNegozio.arrivata, isFalse);

    for (final stato in [403, 426, 429, 503, 504]) {
      final esito = await _porta((_, _) async => (stato, '{"errore":"x"}'));
      expect(esito.arrivata, isFalse, reason: '$stato');
      expect(esito.rifiutataDalNegozio, isFalse, reason: '$stato');
    }

    /* Niente rete: non solleva, dice 0. */
    final senzaRete = await _porta((_, _) async => throw Exception('rete'));
    expect(senzaRete.stato, 0);
    expect(senzaRete.arrivata, isFalse);
  });
}
