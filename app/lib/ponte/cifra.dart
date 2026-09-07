/// La cifratura fra l'app e il ponte.
///
/// Il centralino sta in mezzo e instrada. Deve poter instradare **senza poter
/// leggere**: e' la differenza fra «mi fido di chi lo gestisce» e «non c'e'
/// niente di cui fidarsi», e la seconda e' l'unica che si possa promettere a
/// qualcuno che ci fa passare la propria casa.
///
/// Dall'altra parte del filo c'e' `ponte/src/cifra.js`, che fa le stesse cose
/// con `node:crypto`. Le due implementazioni **devono coincidere byte per
/// byte**: un errore qui non si vede — non esplode niente, semplicemente non
/// si apre piu' niente — quindi ci sono vettori di prova generati dal Node e
/// ricontrollati in `test/ponte/cifra_test.dart`. Se quelli passano, le due
/// punte si capiscono.
///
/// Niente scritto a mano: X25519, HKDF e AES-256-GCM vengono da
/// `package:cryptography`.
library;

import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

/// Il numero di versione viaggia in chiaro nella prima riga.
const int versioneDelProtocollo = 1;

const String _etichettaFilo = 'gdahome/filo/v1';
const String _etichettaAbbinamento = 'gdahome/abbinamento/v1';

/// L'involucro con cui una chiave pubblica X25519 viaggia sul filo.
///
/// Node le esporta in SPKI DER: dodici byte di intestazione fissa e poi i
/// trentadue byte veri. `package:cryptography` le maneggia nude. Questi dodici
/// byte sono tutta la differenza, e sono il posto piu' facile in cui sbagliare
/// senza accorgersene.
final Uint8List _involucroSpki = Uint8List.fromList([
  0x30,
  0x2a,
  0x30,
  0x05,
  0x06,
  0x03,
  0x2b,
  0x65,
  0x6e,
  0x03,
  0x21,
  0x00,
]);

final _x25519 = X25519();
final _gcm = AesGcm.with256bits();
final _hkdf = Hkdf(hmac: Hmac.sha256(), outputLength: 32);

/// Da che parte va un messaggio.
///
/// Sta dentro il nonce, e non e' un vezzo: senza, i due lati che contano da
/// zero userebbero lo stesso nonce con la stessa chiave, e in GCM riusare un
/// nonce non «indebolisce» — rompe.
enum DaChi {
  telefono(0),
  casa(1);

  const DaChi(this.numero);
  final int numero;
}

/// Una coppia effimera: vive quanto un collegamento e poi si butta.
class CoppiaEffimera {
  const CoppiaEffimera({required this.privata, required this.pubblica});

  final SimpleKeyPair privata;

  /// Gia' nell'involucro SPKI, pronta per il filo.
  final Uint8List pubblica;

  String get inBase64 => base64.encode(pubblica);
}

Future<CoppiaEffimera> coppiaEffimera() async {
  final coppia = await _x25519.newKeyPair();
  final pubblica = await coppia.extractPublicKey();
  return CoppiaEffimera(
    privata: coppia,
    pubblica: _vestiSpki(Uint8List.fromList(pubblica.bytes)),
  );
}

/// Solo per le prove: una coppia da uno scalare fisso, per riprodurre i
/// vettori del Node.
Future<CoppiaEffimera> coppiaDalloScalare(List<int> scalare) async {
  final coppia = await _x25519.newKeyPairFromSeed(scalare);
  final pubblica = await coppia.extractPublicKey();
  return CoppiaEffimera(
    privata: coppia,
    pubblica: _vestiSpki(Uint8List.fromList(pubblica.bytes)),
  );
}

Uint8List _vestiSpki(Uint8List nuda) =>
    Uint8List.fromList([..._involucroSpki, ...nuda]);

Uint8List _spogliaSpki(List<int> vestita) {
  if (vestita.length == 32) return Uint8List.fromList(vestita);
  if (vestita.length != 44) {
    throw const ChiaveStorta('una chiave pubblica non e\' fatta cosi\'');
  }
  for (var i = 0; i < _involucroSpki.length; i += 1) {
    if (vestita[i] != _involucroSpki[i]) {
      throw const ChiaveStorta('involucro sbagliato');
    }
  }
  return Uint8List.fromList(vestita.sublist(12));
}

/// La chiave di un collegamento.
///
/// Mescola tre cose, e ognuna copre un buco delle altre:
///
///  - lo **scambio effimero**: chi guarda passare non ricava niente, e chi
///    rubasse le chiavi conservate domani non leggerebbe quello di ieri;
///  - la **chiave del filo**, che le due punte si sono dette all'abbinamento e
///    che al centralino non e' mai passata: chi si mettesse in mezzo per
///    davvero non puo' fabbricarla. Nell'abbinamento non c'e' ancora, e li'
///    quella difesa manca;
///  - l'**apertura**: sedici byte di caso a ogni collegamento, cosi' due
///    collegamenti non riusano mai gli stessi nonce con la stessa chiave.
Future<SecretKey> chiaveDiSessione({
  required SimpleKeyPair miaPrivata,
  required List<int> suaPubblica,
  required List<int> delTelefono,
  required List<int> dellaCasa,
  required List<int> apertura,
  String? chiaveDelFilo,
}) async {
  final comune = await _x25519.sharedSecretKey(
    keyPair: miaPrivata,
    remotePublicKey: SimplePublicKey(
      _spogliaSpki(suaPubblica),
      type: KeyPairType.x25519,
    ),
  );
  final materia = <int>[
    ...await comune.extractBytes(),
    if (chiaveDelFilo != null) ..._daEsadecimale(chiaveDelFilo),
  ];
  /* Le due chiavi pubbliche entrano nel sale in un ordine fisso: cosi' le due
   * punte arrivano alla stessa chiave. */
  final sale = <int>[...apertura, ...delTelefono, ...dellaCasa];
  return _hkdf.deriveKey(
    secretKey: SecretKey(materia),
    nonce: sale,
    info: utf8.encode(
      chiaveDelFilo != null ? _etichettaFilo : _etichettaAbbinamento,
    ),
  );
}

Uint8List aperturaNuova() {
  final caso = Random.secure();
  return Uint8List.fromList(List.generate(16, (_) => caso.nextInt(256)));
}

/// Una busta: cifra e conta.
///
/// Ogni busta ha il suo contatore per direzione, e non torna mai indietro. Se
/// torna indietro, o salta avanti, il messaggio si rifiuta: quello e' un
/// messaggio rigiocato, e in un canale che passa da un terzo va rifiutato
/// senza pensarci.
class Busta {
  Busta(this.chiave, {required DaChi io})
    : mio = io,
      suo = io == DaChi.casa ? DaChi.telefono : DaChi.casa;

  final SecretKey chiave;
  final DaChi mio;
  final DaChi suo;

  int mando = 0;
  int ricevo = 0;

  Uint8List _nonce(DaChi daChi, int contatore) {
    final dodici = Uint8List(12);
    dodici[0] = daChi.numero;
    _scriviOtto(ByteData.view(dodici.buffer), 4, contatore);
    return dodici;
  }

  /* Il contatore sta in otto byte, e si scrive in due meta' da quattro.
   *
   * `setUint64` sarebbe la strada dritta, e sul telefono funziona benissimo.
   * **In un browser no**: Dart compilato in JavaScript non ha interi a
   * sessantaquattro bit, e quell'accessore solleva
   *
   *     Unsupported operation: Uint64 accessor not supported by dart2js
   *
   * a ogni busta, cioe' a ogni messaggio. Non e' un caso raro: e' *sempre*,
   * dal primo messaggio in poi, e l'app nella versione web restava appesa a
   * guardare una rotella senza dire niente a nessuno.
   *
   * Due meta' da trentadue bit, scritte con la divisione e il resto invece che
   * con gli spostamenti di bit, danno gli stessi otto byte su tutti e due —
   * `ByteData` scrive in big-endian, e le due meta' in quest'ordine sono
   * esattamente quello che scriveva `setUint64`. Gli spostamenti di bit no:
   * in JavaScript lavorano a trentadue bit, e `contatore >> 32` darebbe zero.
   */
  static void _scriviOtto(ByteData vista, int da, int valore) {
    vista.setUint32(da, valore ~/ 0x100000000);
    vista.setUint32(da + 4, valore % 0x100000000);
  }

  static int _leggiOtto(ByteData vista, int da) =>
      vista.getUint32(da) * 0x100000000 + vista.getUint32(da + 4);

  Future<String> chiudi(String testo) async {
    final dodici = _nonce(mio, mando);
    final scatola = await _gcm.encrypt(
      utf8.encode(testo),
      secretKey: chiave,
      nonce: dodici,
    );
    mando += 1;
    return base64.encode([
      ...dodici,
      ...scatola.cipherText,
      ...scatola.mac.bytes,
    ]);
  }

  /// Torna il testo, o solleva. Non torna mai `null` per un messaggio guasto:
  /// un messaggio che non si apre su un canale cifrato non e' un inciampo da
  /// ignorare — o e' rotto o e' stato toccato, e in tutti e due i casi si
  /// chiude.
  Future<String> apri(String inBase64) async {
    final Uint8List tutto;
    try {
      tutto = base64.decode(inBase64);
    } catch (_) {
      throw const BustaGuasta('non e\' nemmeno base64');
    }
    if (tutto.length < 12 + 16) throw const BustaGuasta('busta troppo corta');

    final dodici = tutto.sublist(0, 12);
    if (dodici[0] != suo.numero) {
      throw const BustaGuasta('busta dalla direzione sbagliata');
    }
    final contatore = _leggiOtto(
      ByteData.view(Uint8List.fromList(dodici).buffer),
      4,
    );
    if (contatore != ricevo) throw const BustaGuasta('busta fuori ordine');

    try {
      final dentro = await _gcm.decrypt(
        SecretBox(
          tutto.sublist(12, tutto.length - 16),
          nonce: dodici,
          mac: Mac(tutto.sublist(tutto.length - 16)),
        ),
        secretKey: chiave,
      );
      ricevo += 1;
      return utf8.decode(dentro);
    } catch (_) {
      throw const BustaGuasta('la busta non si apre');
    }
  }
}

class BustaGuasta implements Exception {
  const BustaGuasta(this.spiegazione);
  final String spiegazione;
  @override
  String toString() => spiegazione;
}

class ChiaveStorta implements Exception {
  const ChiaveStorta(this.spiegazione);
  final String spiegazione;
  @override
  String toString() => spiegazione;
}

Uint8List _daEsadecimale(String testo) {
  final byte = Uint8List(testo.length ~/ 2);
  for (var i = 0; i < byte.length; i += 1) {
    byte[i] = int.parse(testo.substring(i * 2, i * 2 + 2), radix: 16);
  }
  return byte;
}
