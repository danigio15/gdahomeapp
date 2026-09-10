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

import '../misure/lavori.dart';
import 'altrove/altrove.dart';
import 'compressione/compressione.dart' as compressione;

export 'compressione/compressione.dart' show gzipDisponibile;

/// Il numero di versione viaggia in chiaro nella prima riga.
const int versioneDelProtocollo = 1;

/// Da quanti caratteri in su una busta si comprime, se l'altra punta sa
/// aprirla. Sotto, un evento compresso non e' piu' piccolo: e' solo piu'
/// lento. Vedi `compressione/compressione.dart`.
const int sogliaDiCompressione = 1024;

/// Oltre questo, dentro una busta non c'e' la casa: c'e' una bomba. E' lo
/// stesso tetto di un messaggio intero a pezzi, `interoMassimo` in
/// `stretta.dart`.
const int apertaMassima = 16 * 1024 * 1024;

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
  Busta(this.chiave, {required DaChi io, bool comprime = false})
    : mio = io,
      suo = io == DaChi.casa ? DaChi.telefono : DaChi.casa,
      /* Nel browser il gzip non c'e', e chiedere di comprimere li' non e'
       * un ordine da eseguire ma una cosa da non fare: la prima busta sopra
       * la soglia farebbe saltare tutto con un `UnsupportedError`. La
       * stretta di mano gia' non lo chiede (`gzipDisponibile && gzip`); qui
       * lo si tiene fermo anche per chi costruisce una busta a mano. */
      comprime = comprime && compressione.gzipDisponibile;

  final SecretKey chiave;
  final DaChi mio;
  final DaChi suo;

  /// Se le buste che si chiudono qui si comprimono: l'altra punta ha detto
  /// nella stretta di mano di saper aprire il gzip. Aprirle, le buste
  /// compresse, lo si sa sempre — dove c'e' `dart:io` — e si riconoscono da
  /// sole, dai due byte con cui comincia un gzip.
  final bool comprime;

  int mando = 0;
  int ricevo = 0;

  /// Da quanti caratteri in su una busta si apre e si chiude **altrove**, in
  /// un isolato a parte, invece che sul filo che disegna lo schermo.
  ///
  /// Sotto, il costo di spedire il lavoro e' piu' del lavoro: un evento da
  /// un chilobyte si apre in meno di un millesimo. Sopra, e' un file della
  /// plancia, un `get_states`, una storia di consumi: roba da decimi di
  /// secondo su un telefono, che sul filo principale sono scatti.
  ///
  /// Si misura sul filo, cioe' compressa: una risposta da duecento chilobyte
  /// di storico arriva in venti, e quei venti si aprono qui — decifrare e
  /// scompattare, insieme, un paio di millesimi.
  static const int sogliaAltrove = 8 * 1024;

  Uint8List? _chiaveByte;

  Future<Uint8List> _byteDellaChiave() async =>
      _chiaveByte ??= Uint8List.fromList(await chiave.extractBytes());

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
    final daComprimere = comprime && testo.length >= sogliaDiCompressione;
    final String chiusa;
    if (testo.length < sogliaAltrove) {
      chiusa = await Lavori.io.conto(
        'buste chiuse qui',
        () => _chiudiDavvero(chiave, dodici, testo, daComprimere),
      );
    } else {
      final byte = await _byteDellaChiave();
      chiusa = await Lavori.io.conto(
        'buste chiuse altrove',
        () => altrove(
          () => _chiudiDavvero(SecretKey(byte), dodici, testo, daComprimere),
        ),
      );
    }
    mando += 1;
    return chiusa;
  }

  /* Il lavoro vero, scritto in modo da poter partire per un altro isolato:
   * prende byte e testo, non `this`. */
  static Future<String> _chiudiDavvero(
    SecretKey chiave,
    Uint8List dodici,
    String testo,
    bool daComprimere,
  ) async {
    List<int> dentro = utf8.encode(testo);
    if (daComprimere) dentro = compressione.comprimi(dentro);
    final scatola = await AesGcm.with256bits().encrypt(
      dentro,
      secretKey: chiave,
      nonce: dodici,
    );
    final cifrato = scatola.cipherText;
    final marchio = scatola.mac.bytes;
    /* Un solo blocco di byte, non una lista di numeri: un allegato da
     * cinque megabyte messo insieme un numero alla volta era un secondo di
     * niente. */
    final tutto = Uint8List(dodici.length + cifrato.length + marchio.length)
      ..setRange(0, dodici.length, dodici)
      ..setRange(dodici.length, dodici.length + cifrato.length, cifrato)
      ..setRange(
        dodici.length + cifrato.length,
        dodici.length + cifrato.length + marchio.length,
        marchio,
      );
    return base64.encode(tutto);
  }

  /// Torna il testo, o solleva. Non torna mai `null` per un messaggio guasto:
  /// un messaggio che non si apre su un canale cifrato non e' un inciampo da
  /// ignorare — o e' rotto o e' stato toccato, e in tutti e due i casi si
  /// chiude.
  Future<String> apri(String inBase64) async {
    /* La testa — i dodici byte del nonce — sono i primi sedici caratteri, e
     * si leggono da soli: la direzione e il contatore si controllano qui,
     * prima di spedire il grosso altrove. */
    if (inBase64.length < 16) throw const BustaGuasta('busta troppo corta');
    final Uint8List dodici;
    try {
      dodici = base64.decode(inBase64.substring(0, 16));
    } catch (_) {
      throw const BustaGuasta('non e\' nemmeno base64');
    }
    if (dodici[0] != suo.numero) {
      throw const BustaGuasta('busta dalla direzione sbagliata');
    }
    final contatore = _leggiOtto(
      ByteData.view(Uint8List.fromList(dodici).buffer),
      4,
    );
    if (contatore != ricevo) throw const BustaGuasta('busta fuori ordine');

    final String dentro;
    try {
      if (inBase64.length < sogliaAltrove) {
        dentro = await Lavori.io.conto(
          'buste aperte qui',
          () => _apriDavvero(chiave, inBase64),
        );
      } else {
        final byte = await _byteDellaChiave();
        dentro = await Lavori.io.conto(
          'buste aperte altrove',
          () => altrove(() => _apriDavvero(SecretKey(byte), inBase64)),
        );
      }
    } on BustaGuasta {
      rethrow;
    } catch (_) {
      throw const BustaGuasta('la busta non si apre');
    }
    ricevo += 1;
    return dentro;
  }

  static Future<String> _apriDavvero(SecretKey chiave, String inBase64) async {
    final Uint8List tutto;
    try {
      tutto = base64.decode(inBase64);
    } catch (_) {
      throw const BustaGuasta('non e\' nemmeno base64');
    }
    if (tutto.length < 12 + 16) throw const BustaGuasta('busta troppo corta');
    final dodici = tutto.sublist(0, 12);
    var dentro = await AesGcm.with256bits().decrypt(
      SecretBox(
        tutto.sublist(12, tutto.length - 16),
        nonce: dodici,
        mac: Mac(tutto.sublist(tutto.length - 16)),
      ),
      secretKey: chiave,
    );
    /* Il marchio ha gia' detto che e' roba nostra: se dentro c'e' un gzip —
     * comincia con `1f 8b`, e un testo in UTF-8 non comincia mai cosi',
     * perche' `8b` da solo non e' un carattere — si scompatta, con un
     * tetto. */
    if (dentro.length >= 2 && dentro[0] == 0x1f && dentro[1] == 0x8b) {
      try {
        dentro = compressione.scompatta(dentro, massimo: apertaMassima);
      } catch (_) {
        throw const BustaGuasta('la busta compressa non si apre');
      }
    }
    return utf8.decode(dentro);
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
