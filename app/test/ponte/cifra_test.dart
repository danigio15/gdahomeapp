/// Le prove che le due punte parlano la stessa lingua.
///
/// Qui non si prova «funziona la cifratura»: quella la fanno le librerie, e le
/// fanno meglio. Si prova una cosa sola, che nessuna delle due librerie puo'
/// provare da sola: che `app/lib/ponte/cifra.dart` e `ponte/src/cifra.js`
/// producono **gli stessi byte**.
///
/// I numeri qui sotto li ha stampati il Node. Non sono stati copiati dal Dart
/// e non sono stati «aggiustati finche' passavano»: se un giorno una di queste
/// prove diventa rossa, la risposta non e' cambiare il numero — e' che una
/// delle due punte ha smesso di capire l'altra, e da quel momento l'app non si
/// collega piu' a nessuna casa.
///
/// Il modo di rigenerarli sta in cima al file: e' quindici righe di Node che
/// chiamano `cifra.js` con scalari fissi invece che con del caso.
library;

import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/ponte/cifra.dart';

/* ─── I vettori, come li ha stampati il Node ──────────────────────────────── */

/* I due scalari sono quelli dell'esempio dell'RFC 7748: non hanno niente di
 * speciale se non che chiunque puo' ricontrollarli senza fidarsi di noi. */
const _scalareTelefono =
    '77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a';
const _scalareCasa =
    '5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb';

const _pubblicaTelefono =
    'MCowBQYDK2VuAyEAhSDwCYkwp1R0i33ctD73Wg2/Og0mOBr066SpjqqbTmo=';
const _pubblicaCasa =
    'MCowBQYDK2VuAyEA3p7bfXt9wbTTW2HC7OQ1Nz+DQ8hbeGdNrfx+FG+IK08=';

const _apertura = 'AAECAwQFBgcICQoLDA0ODw==';
const _chiaveDelFilo =
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const _chiaveConFilo =
    '5cb44d084c48418f7bd77c21182baa3e2fb6ac9c3233ec147652043eb44f2ea8';
const _chiaveSenzaFilo =
    '3aa495af127807135cc85804e6482c4ae59748898c21660042fe9bb4b5b52595';

const _testoDalTelefono = '{"type":"auth","access_token":"segno"}';
const _testoDallaCasa = '{"type":"auth_required"}';

const _primaDalTelefono =
    'AAAAAAAAAAAAAAAAGynGINTLFqiq5W8mwDbWVUp8JIKWn60Xcw1BkXU9YJDJlgd67JA5hOygiB2pTO8rZGySCLws';
const _secondaDalTelefono =
    'AAAAAAAAAAAAAAABvzijtiJZTGng7QjWTiXUhW6RK9m1E/mEbxpl3g==';
const _primaDallaCasa =
    'AQAAAAAAAAAAAAAAO5ZYknQ+fBE3tcF/Z0sXBM4eZ6eEB9rWxBWG9OkqEyyI5bG3R186dw==';

void main() {
  group('gli stessi byte del Node', () {
    test('dagli stessi scalari escono le stesse chiavi pubbliche', () async {
      /* Se questa e' rossa, il problema sono i dodici byte dell'involucro
       * SPKI: il Dart maneggia le chiavi nude, il Node le veste. */
      final telefono = await coppiaDalloScalare(
        _daEsadecimale(_scalareTelefono),
      );
      final casa = await coppiaDalloScalare(_daEsadecimale(_scalareCasa));
      expect(telefono.inBase64, _pubblicaTelefono);
      expect(casa.inBase64, _pubblicaCasa);
      expect(telefono.pubblica, hasLength(44));
    });

    test(
      'la chiave di un collegamento è quella che ha calcolato il Node',
      () async {
        final chiave = await _chiaveDelVettore(chiaveDelFilo: _chiaveDelFilo);
        expect(_inEsadecimale(await chiave.extractBytes()), _chiaveConFilo);
      },
    );

    test('e quella dell\'abbinamento, dove il filo non c\'è ancora', () async {
      final chiave = await _chiaveDelVettore();
      expect(_inEsadecimale(await chiave.extractBytes()), _chiaveSenzaFilo);
    });

    test('le due punte arrivano alla stessa chiave partendo da capi opposti', () async {
      /* Il senso di tutto: nessuna delle due ha mandato la chiave all'altra. */
      final telefono = await coppiaDalloScalare(
        _daEsadecimale(_scalareTelefono),
      );
      final casa = await coppiaDalloScalare(_daEsadecimale(_scalareCasa));
      final dalTelefono = await chiaveDiSessione(
        miaPrivata: telefono.privata,
        suaPubblica: casa.pubblica,
        delTelefono: telefono.pubblica,
        dellaCasa: casa.pubblica,
        apertura: base64.decode(_apertura),
        chiaveDelFilo: _chiaveDelFilo,
      );
      final dallaCasa = await chiaveDiSessione(
        miaPrivata: casa.privata,
        suaPubblica: telefono.pubblica,
        delTelefono: telefono.pubblica,
        dellaCasa: casa.pubblica,
        apertura: base64.decode(_apertura),
        chiaveDelFilo: _chiaveDelFilo,
      );
      expect(await dalTelefono.extractBytes(), await dallaCasa.extractBytes());
    });

    test('la casa apre le buste che ha chiuso il telefono del Node', () async {
      final busta = Busta(
        await _chiaveDelVettore(chiaveDelFilo: _chiaveDelFilo),
        io: DaChi.casa,
      );
      expect(await busta.apri(_primaDalTelefono), _testoDalTelefono);
      expect(await busta.apri(_secondaDalTelefono), 'secondo giro');
    });

    test('il telefono apre le buste che ha chiuso la casa del Node', () async {
      final busta = Busta(
        await _chiaveDelVettore(chiaveDelFilo: _chiaveDelFilo),
        io: DaChi.telefono,
      );
      expect(await busta.apri(_primaDallaCasa), _testoDallaCasa);
    });

    test('e le richiude uguali, byte per byte', () async {
      /* Aprirle non basta: AES-GCM e' deterministico a nonce fisso, quindi se
       * il Dart chiude la stessa cosa con lo stesso contatore deve venire
       * fuori esattamente la stessa stringa. Se viene fuori diversa, il Node
       * non la aprira'. */
      final chiave = await _chiaveDelVettore(chiaveDelFilo: _chiaveDelFilo);
      final telefono = Busta(chiave, io: DaChi.telefono);
      expect(await telefono.chiudi(_testoDalTelefono), _primaDalTelefono);
      expect(await telefono.chiudi('secondo giro'), _secondaDalTelefono);

      final casa = Busta(chiave, io: DaChi.casa);
      expect(await casa.chiudi(_testoDallaCasa), _primaDallaCasa);
    });
  });

  group('le buste', () {
    test('una busta grande si apre altrove, e torna uguale', () async {
      /* Sopra la soglia il lavoro va in un altro isolato: il testo deve
       * tornare identico, e i contatori devono andare avanti lo stesso. */
      final chiave = SecretKey(List.filled(32, 7));
      final telefono = Busta(chiave, io: DaChi.telefono);
      final casa = Busta(chiave, io: DaChi.casa);
      final grande = List.generate(
        Busta.sogliaAltrove ~/ 8,
        (i) => 'entità $i, ',
      ).join();
      expect(grande.length, greaterThan(Busta.sogliaAltrove));

      final chiusa = await telefono.chiudi(grande);
      expect(chiusa.length, greaterThan(Busta.sogliaAltrove));
      expect(await casa.apri(chiusa), grande);

      final piccola = await telefono.chiudi('e poi una piccola');
      expect(await casa.apri(piccola), 'e poi una piccola');
      expect(casa.ricevo, 2);
    });

    test('una busta grande toccata non si apre', () async {
      final chiave = SecretKey(List.filled(32, 7));
      final telefono = Busta(chiave, io: DaChi.telefono);
      final casa = Busta(chiave, io: DaChi.casa);
      final chiusa = await telefono.chiudi('x' * (Busta.sogliaAltrove + 100));
      final meta = chiusa.length ~/ 2;
      final toccata =
          '${chiusa.substring(0, meta)}${chiusa[meta] == 'A' ? 'B' : 'A'}${chiusa.substring(meta + 1)}';
      await expectLater(casa.apri(toccata), throwsA(isA<BustaGuasta>()));
    });

    test('vanno avanti e indietro', () async {
      final chiave = SecretKey(List.filled(32, 7));
      final telefono = Busta(chiave, io: DaChi.telefono);
      final casa = Busta(chiave, io: DaChi.casa);

      for (var giro = 0; giro < 3; giro += 1) {
        expect(
          await casa.apri(await telefono.chiudi('vado $giro')),
          'vado $giro',
        );
        expect(
          await telefono.apri(await casa.chiudi('torno $giro')),
          'torno $giro',
        );
      }
    });

    test('rifiutano una busta rigiocata', () async {
      /* Il centralino le vede passare tutte. Se potesse rimandarne una gia'
       * passata e farla accettare, potrebbe far riaccendere una luce, o
       * riaprire una porta. */
      final chiave = SecretKey(List.filled(32, 7));
      final telefono = Busta(chiave, io: DaChi.telefono);
      final casa = Busta(chiave, io: DaChi.casa);

      final busta = await telefono.chiudi('apri la porta');
      expect(await casa.apri(busta), 'apri la porta');
      await expectLater(casa.apri(busta), throwsA(isA<BustaGuasta>()));
    });

    test(
      'rifiutano una busta rimandata indietro a chi l\'ha scritta',
      () async {
        /* Senza la direzione dentro il nonce, il centralino potrebbe rispedire
       * al telefono la busta del telefono, e quello se la aprirebbe come se
       * fosse la risposta della casa. */
        final chiave = SecretKey(List.filled(32, 7));
        final telefono = Busta(chiave, io: DaChi.telefono);
        final suaStessa = await telefono.chiudi('accendi');
        await expectLater(
          telefono.apri(suaStessa),
          throwsA(isA<BustaGuasta>()),
        );
      },
    );

    test('rifiutano una busta toccata per strada', () async {
      final chiave = SecretKey(List.filled(32, 7));
      final telefono = Busta(chiave, io: DaChi.telefono);
      final casa = Busta(chiave, io: DaChi.casa);

      final byte = base64.decode(await telefono.chiudi('spegni tutto'));
      byte[20] ^= 1;
      await expectLater(
        casa.apri(base64.encode(byte)),
        throwsA(isA<BustaGuasta>()),
      );
    });

    test('rifiutano una busta chiusa con un\'altra chiave', () async {
      final telefono = Busta(SecretKey(List.filled(32, 7)), io: DaChi.telefono);
      final casa = Busta(SecretKey(List.filled(32, 9)), io: DaChi.casa);
      await expectLater(
        casa.apri(await telefono.chiudi('ciao')),
        throwsA(isA<BustaGuasta>()),
      );
    });

    test('rifiutano qualcosa che non è nemmeno una busta', () async {
      final casa = Busta(SecretKey(List.filled(32, 7)), io: DaChi.casa);
      for (final spazzatura in ['', 'ciao', 'AAAA', 'non-e-base64!!!']) {
        await expectLater(
          casa.apri(spazzatura),
          throwsA(isA<BustaGuasta>()),
          reason: spazzatura,
        );
      }
    });
  });

  group('la compressione', () {
    final chiave = SecretKey(List.filled(32, 7));

    test('una busta compressa è molto più piccola, e torna uguale', () async {
      final casa = Busta(chiave, io: DaChi.casa, comprime: true);
      final telefono = Busta(chiave, io: DaChi.telefono);
      final testo = _unaCasaGrande();
      expect(testo.length, greaterThan(sogliaDiCompressione));

      final chiusa = await casa.chiudi(testo);
      if (gzipDisponibile) {
        expect(
          chiusa.length,
          lessThan(testo.length ~/ 4),
          reason: '${chiusa.length} caratteri per ${testo.length} di testo',
        );
      } else {
        /* Nel browser non si comprime, nemmeno a chiederlo: la busta e'
           * grande quanto il testo, e si apre lo stesso. */
        expect(
          base64.decode(chiusa).length,
          12 + utf8.encode(testo).length + 16,
        );
      }
      expect(await telefono.apri(chiusa), testo);
      expect(telefono.ricevo, 1);
    });

    test(
      'sotto la soglia non si comprime: una busta piccola resta com\'era',
      () async {
        final casa = Busta(chiave, io: DaChi.casa, comprime: true);
        final telefono = Busta(chiave, io: DaChi.telefono);
        const testo =
            '{"type":"event","event":{"data":{"entity_id":"light.cucina"}}}';

        final chiusa = await casa.chiudi(testo);
        /* Dodici di nonce, il testo com'e', sedici di marchio. */
        expect(
          base64.decode(chiusa).length,
          12 + utf8.encode(testo).length + 16,
        );
        expect(await telefono.apri(chiusa), testo);
      },
    );

    test('chi non ha detto di saper aprire il gzip non lo riceve', () async {
      final casa = Busta(chiave, io: DaChi.casa);
      final telefono = Busta(chiave, io: DaChi.telefono);
      final testo = _unaCasaGrande();

      final chiusa = await casa.chiudi(testo);
      expect(base64.decode(chiusa).length, 12 + utf8.encode(testo).length + 16);
      expect(await telefono.apri(chiusa), testo);
    });

    test('una busta compressa si apre anche da chi non comprime', () async {
      final telefono = Busta(chiave, io: DaChi.telefono, comprime: true);
      final casa = Busta(chiave, io: DaChi.casa);
      final testo = _unaCasaGrande();
      expect(await casa.apri(await telefono.chiudi(testo)), testo);
    });

    test(
      'una busta compressa grande si apre altrove, e torna uguale',
      () async {
        /* Roba che si comprime poco, cosi' anche compressa passa la soglia
       * dell'isolato: e' la strada che fa uno storico di consumi vero. */
        /* Non `1 << 32`: in JavaScript gli spostamenti di bit lavorano a
         * trentadue bit e quello fa zero, e `nextInt(0)` e' un errore. */
        final caso = Random(1);
        final testo = List.generate(
          20000,
          (_) => caso.nextInt(0x40000000).toRadixString(36),
        ).join(' ');
        final casa = Busta(chiave, io: DaChi.casa, comprime: true);
        final telefono = Busta(chiave, io: DaChi.telefono);

        final chiusa = await casa.chiudi(testo);
        expect(chiusa.length, greaterThan(Busta.sogliaAltrove));
        if (gzipDisponibile) expect(chiusa.length, lessThan(testo.length));
        expect(await telefono.apri(chiusa), testo);
      },
    );

    test('un testo che comincia con i caratteri del gzip non si scambia per un gzip', () async {
      /* `1f 8b` in UTF-8 non si scrive: `8b` da solo non e' un carattere. */
      final casa = Busta(chiave, io: DaChi.casa);
      final telefono = Busta(chiave, io: DaChi.telefono);
      const testo = '\u001f\u008bnon sono un gzip';
      expect(await telefono.apri(await casa.chiudi(testo)), testo);
    });

    test(
      'una bomba non si apre: oltre i sedici megabyte si dice di no',
      () async {
        final casa = Busta(chiave, io: DaChi.casa, comprime: true);
        final telefono = Busta(chiave, io: DaChi.telefono);
        /* Sedici megabyte di niente pesano venti chilobyte compressi. */
        final chiusa = await casa.chiudi(' ' * (apertaMassima + 1));
        expect(chiusa.length, lessThan(100000));
        await expectLater(telefono.apri(chiusa), throwsA(isA<BustaGuasta>()));
        expect(telefono.ricevo, 0, reason: 'una busta rifiutata non conta');
      },
      /* Una bomba e' un gzip: senza gzip non si fa, e nel browser non c'e'. */
      skip: gzipDisponibile ? false : 'nel browser non si comprime',
    );
  });

  group('l\'aiutante', () {
    final chiave = SecretKey(List.filled(32, 9));

    test('lo stesso aiutante fa tanti lavori uno dietro l\'altro', () async {
      /* Prima se ne apriva uno nuovo per ogni busta, e durante l\'avvio della
       * plancia sono centinaia di isolati aperti e chiusi in mezzo minuto.
       * Qui: tante buste grandi di fila, tutte giuste, tutte in ordine. */
      final casa = Busta(chiave, io: DaChi.casa, comprime: true);
      final telefono = Busta(chiave, io: DaChi.telefono);
      final testi = [
        for (var i = 0; i < 12; i += 1)
          List.generate(2000, (n) => 'pezzo $i numero $n, ').join(),
      ];

      final chiuse = <String>[];
      for (final uno in testi) {
        chiuse.add(await casa.chiudi(uno));
      }
      for (var i = 0; i < testi.length; i += 1) {
        expect(await telefono.apri(chiuse[i]), testi[i]);
      }
      expect(telefono.ricevo, testi.length);
    });

    test('un lavoro andato storto non porta giù l\'aiutante', () async {
      final casa = Busta(chiave, io: DaChi.casa, comprime: true);
      final telefono = Busta(chiave, io: DaChi.telefono);

      /* Una bomba: si rifiuta, e l\'aiutante resta in piedi. */
      await expectLater(
        telefono.apri(await casa.chiudi(' ' * (apertaMassima + 1))),
        throwsA(isA<BustaGuasta>()),
      );

      /* La busta rifiutata non e' stata contata: la prossima e' ancora la
       * prima, e chi la manda riparte da zero come lei. */
      expect(telefono.ricevo, 0);
      final grande = 'x' * (Busta.sogliaAltrove * 2);
      final dopo = Busta(chiave, io: DaChi.casa, comprime: true);
      expect(await telefono.apri(await dopo.chiudi(grande)), grande);
    }, skip: gzipDisponibile ? false : 'nel browser non si comprime');
  });

  group('l\'apertura', () {
    test('è sedici byte, e non è mai la stessa', () {
      final viste = <String>{};
      for (var giro = 0; giro < 50; giro += 1) {
        final apertura = aperturaNuova();
        expect(apertura, hasLength(16));
        viste.add(base64.encode(apertura));
      }
      expect(viste, hasLength(50));
    });
  });

  group('le chiavi pubbliche', () {
    test('una coppia nuova esce vestita da SPKI', () async {
      final coppia = await coppiaEffimera();
      expect(coppia.pubblica, hasLength(44));
      expect(
        _inEsadecimale(coppia.pubblica.sublist(0, 12)),
        '302a300506032b656e032100',
      );
    });

    test('una chiave con l\'involucro sbagliato non passa', () async {
      final mia = await coppiaEffimera();
      final storta = Uint8List.fromList(
        await coppiaEffimera().then((c) => c.pubblica),
      );
      storta[3] = 0x99;
      await expectLater(
        chiaveDiSessione(
          miaPrivata: mia.privata,
          suaPubblica: storta,
          delTelefono: mia.pubblica,
          dellaCasa: storta,
          apertura: aperturaNuova(),
        ),
        throwsA(isA<ChiaveStorta>()),
      );
    });

    test('una chiave lunga a caso non passa', () async {
      final mia = await coppiaEffimera();
      await expectLater(
        chiaveDiSessione(
          miaPrivata: mia.privata,
          suaPubblica: Uint8List(10),
          delTelefono: mia.pubblica,
          dellaCasa: Uint8List(10),
          apertura: aperturaNuova(),
        ),
        throwsA(isA<ChiaveStorta>()),
      );
    });
  });
}

/* ─── Attrezzi ────────────────────────────────────────────────────────────── */

/// Un `get_states` come lo manda una casa vera: quattrocento entita', tutte
/// fatte allo stesso modo.
String _unaCasaGrande() => jsonEncode({
  'id': 7,
  'type': 'result',
  'success': true,
  'result': [
    for (var i = 0; i < 400; i += 1)
      {
        'entity_id': 'sensor.temperatura_$i',
        'state': '${20 + (i % 7)}',
        'attributes': {
          'unit_of_measurement': '°C',
          'friendly_name': 'Temperatura $i',
          'device_class': 'temperature',
        },
        'last_changed': '2026-09-09T10:00:00.000000+00:00',
        'last_updated': '2026-09-09T10:00:00.000000+00:00',
      },
  ],
});

Future<SecretKey> _chiaveDelVettore({String? chiaveDelFilo}) async {
  final telefono = await coppiaDalloScalare(_daEsadecimale(_scalareTelefono));
  return chiaveDiSessione(
    miaPrivata: telefono.privata,
    suaPubblica: base64.decode(_pubblicaCasa),
    delTelefono: base64.decode(_pubblicaTelefono),
    dellaCasa: base64.decode(_pubblicaCasa),
    apertura: base64.decode(_apertura),
    chiaveDelFilo: chiaveDelFilo,
  );
}

Uint8List _daEsadecimale(String testo) {
  final byte = Uint8List(testo.length ~/ 2);
  for (var i = 0; i < byte.length; i += 1) {
    byte[i] = int.parse(testo.substring(i * 2, i * 2 + 2), radix: 16);
  }
  return byte;
}

String _inEsadecimale(List<int> byte) =>
    byte.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
