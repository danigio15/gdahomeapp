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
      final telefono = await coppiaDalloScalare(_daEsadecimale(_scalareTelefono));
      final casa = await coppiaDalloScalare(_daEsadecimale(_scalareCasa));
      expect(telefono.inBase64, _pubblicaTelefono);
      expect(casa.inBase64, _pubblicaCasa);
      expect(telefono.pubblica, hasLength(44));
    });

    test('la chiave di un collegamento e\' quella che ha calcolato il Node',
        () async {
      final chiave = await _chiaveDelVettore(chiaveDelFilo: _chiaveDelFilo);
      expect(_inEsadecimale(await chiave.extractBytes()), _chiaveConFilo);
    });

    test('e quella dell\'abbinamento, dove il filo non c\'e\' ancora',
        () async {
      final chiave = await _chiaveDelVettore();
      expect(_inEsadecimale(await chiave.extractBytes()), _chiaveSenzaFilo);
    });

    test('le due punte arrivano alla stessa chiave partendo da capi opposti',
        () async {
      /* Il senso di tutto: nessuna delle due ha mandato la chiave all'altra. */
      final telefono = await coppiaDalloScalare(_daEsadecimale(_scalareTelefono));
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
      final busta = Busta(await _chiaveDelVettore(chiaveDelFilo: _chiaveDelFilo),
          io: DaChi.casa);
      expect(await busta.apri(_primaDalTelefono), _testoDalTelefono);
      expect(await busta.apri(_secondaDalTelefono), 'secondo giro');
    });

    test('il telefono apre le buste che ha chiuso la casa del Node', () async {
      final busta = Busta(await _chiaveDelVettore(chiaveDelFilo: _chiaveDelFilo),
          io: DaChi.telefono);
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
    test('vanno avanti e indietro', () async {
      final chiave = SecretKey(List.filled(32, 7));
      final telefono = Busta(chiave, io: DaChi.telefono);
      final casa = Busta(chiave, io: DaChi.casa);

      for (var giro = 0; giro < 3; giro += 1) {
        expect(await casa.apri(await telefono.chiudi('vado $giro')), 'vado $giro');
        expect(await telefono.apri(await casa.chiudi('torno $giro')),
            'torno $giro');
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

    test('rifiutano una busta rimandata indietro a chi l\'ha scritta',
        () async {
      /* Senza la direzione dentro il nonce, il centralino potrebbe rispedire
       * al telefono la busta del telefono, e quello se la aprirebbe come se
       * fosse la risposta della casa. */
      final chiave = SecretKey(List.filled(32, 7));
      final telefono = Busta(chiave, io: DaChi.telefono);
      final suaStessa = await telefono.chiudi('accendi');
      await expectLater(
          telefono.apri(suaStessa), throwsA(isA<BustaGuasta>()));
    });

    test('rifiutano una busta toccata per strada', () async {
      final chiave = SecretKey(List.filled(32, 7));
      final telefono = Busta(chiave, io: DaChi.telefono);
      final casa = Busta(chiave, io: DaChi.casa);

      final byte = base64.decode(await telefono.chiudi('spegni tutto'));
      byte[20] ^= 1;
      await expectLater(
          casa.apri(base64.encode(byte)), throwsA(isA<BustaGuasta>()));
    });

    test('rifiutano una busta chiusa con un\'altra chiave', () async {
      final telefono = Busta(SecretKey(List.filled(32, 7)), io: DaChi.telefono);
      final casa = Busta(SecretKey(List.filled(32, 9)), io: DaChi.casa);
      await expectLater(
          casa.apri(await telefono.chiudi('ciao')), throwsA(isA<BustaGuasta>()));
    });

    test('rifiutano qualcosa che non e\' nemmeno una busta', () async {
      final casa = Busta(SecretKey(List.filled(32, 7)), io: DaChi.casa);
      for (final spazzatura in ['', 'ciao', 'AAAA', 'non-e-base64!!!']) {
        await expectLater(casa.apri(spazzatura), throwsA(isA<BustaGuasta>()),
            reason: spazzatura);
      }
    });
  });

  group('l\'apertura', () {
    test('e\' sedici byte, e non e\' mai la stessa', () {
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
      expect(_inEsadecimale(coppia.pubblica.sublist(0, 12)),
          '302a300506032b656e032100');
    });

    test('una chiave con l\'involucro sbagliato non passa', () async {
      final mia = await coppiaEffimera();
      final storta = Uint8List.fromList(await coppiaEffimera().then((c) => c.pubblica));
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
