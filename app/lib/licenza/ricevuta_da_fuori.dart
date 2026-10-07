/// La ricevuta di chi compra fuori casa, portata dal centralino.
///
/// Di solito la ricevuta del negozio va alla casa sul filo cifrato
/// (`ponte/licenza/negozio`). Ma chi compra fuori casa lo fa proprio perche'
/// da fuori la casa non gli si apre: con la chiave delle licenze il centralino
/// chiude i telefoni delle case Base, e un filo su cui mandarla non c'e'.
/// Allora la si consegna al centralino (`POST /licenza/<casa>`), che la gira
/// alla casa sul filo di lei e rimanda la sua risposta
/// (`centralino/src/ricevute.js`).
///
/// Al centralino passa in chiaro, e chiunque potrebbe bussare a quella porta
/// col nome della casa. Per questo la ricevuta parte **firmata** con la chiave
/// del filo, che conoscono solo questo telefono e la casa: la casa controlla
/// la firma, e solo una ricevuta di un suo telefono va al quadro
/// (`ponte/src/ricevuta-da-fuori.js`, che fa la stessa firma).
///
///     corpo = {v: 1, chi, quando, app, piattaforma, prodotto, ricevuta, firma}
///     chiave = HKDF-SHA256(chiave del filo, sale = "casa_…", info = etichetta, 32 byte)
///     firma  = base64url(HMAC-SHA256(chiave, JSON di
///              [etichetta, casa, chi, quando, app, piattaforma, prodotto, ricevuta]))
///
/// La stessa strada porta anche un **codice regalo**: chi lo ha in mano fuori
/// casa, con la casa Base, il filo non ce l'ha, ed e' proprio il momento in
/// cui gli serve. Il corpo ha `regalo` al posto della ricevuta, e la firma ha
/// un'etichetta sua:
///
///     corpo = {v: 1, chi, quando, regalo, firma}
///     firma = base64url(HMAC-SHA256(chiave, JSON di
///             [etichetta del regalo, casa, chi, quando, regalo]))
library;

import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:http/http.dart' as http;

import '../ponte/indirizzo.dart';

/// Il nome di questa firma: sta nella chiave e nel testo firmato, cosi' una
/// firma fatta per qualcos'altro li' non vale. Lo stesso del ponte.
const etichettaDellaRicevuta = 'gdahome/ricevuta/v1';

/// Il nome della firma di un codice regalo portato dal centralino. Lo stesso
/// del ponte.
const etichettaDelRegalo = 'gdahome/regalo/v1';

/// Quanto si aspetta il centralino: lui aspetta la casa un minuto, e la casa
/// il quadro, che chiede al negozio.
const attesaDelCentralino = Duration(seconds: 75);

/// Chi consegna il corpo al centralino: `(stato, corpo)` della risposta.
/// Nelle prove e' finto.
typedef ConsegnaAlCentralino = Future<(int, String)> Function(
  Uri dove,
  String corpo,
);

/// Com'e' andata la ricevuta portata dal centralino.
class EsitoDellaRicevuta {
  const EsitoDellaRicevuta(this.stato, this.detto);

  /// Lo stato HTTP: quello della casa, o quello del centralino se alla casa
  /// non e' arrivata (`503`, `504`, `426`, `429`). `0`: la strada non c'era.
  final int stato;

  /// Il corpo, letto: con `200` la licenza della casa com'e' dopo la
  /// ricevuta, `{gdahome, gdanav, gettoni}`; se no `{errore}`.
  final Object? detto;

  /// La casa l'ha avuta, e il quadro ha detto di si'.
  bool get arrivata => stato == 200;

  /// Il negozio ha detto che la ricevuta non vale: non c'e' niente da
  /// riprovare.
  bool get rifiutataDalNegozio => stato == 402;
}

/// La firma di una ricevuta, come la controlla la casa.
Future<String> firmaDellaRicevuta({
  required String chiaveDelFilo,
  required String casa,
  required String chi,
  required int quando,
  required String app,
  required String piattaforma,
  required String prodotto,
  required String ricevuta,
}) => _firmata(etichettaDellaRicevuta, chiaveDelFilo, casa, [
  chi,
  quando,
  app,
  piattaforma,
  prodotto,
  ricevuta,
]);

/// La firma di un codice regalo, come la controlla la casa.
Future<String> firmaDelRegalo({
  required String chiaveDelFilo,
  required String casa,
  required String chi,
  required int quando,
  required String regalo,
}) => _firmata(etichettaDelRegalo, chiaveDelFilo, casa, [chi, quando, regalo]);

/// La chiave si ricava per etichetta e per casa, e il testo firmato comincia
/// con la stessa etichetta: una firma fatta per una cosa non vale per l'altra.
Future<String> _firmata(
  String etichetta,
  String chiaveDelFilo,
  String casa,
  List<Object> campi,
) async {
  final chiave = await Hkdf(hmac: Hmac.sha256(), outputLength: 32).deriveKey(
    secretKey: SecretKey(_daEsadecimale(chiaveDelFilo)),
    nonce: utf8.encode(casa),
    info: utf8.encode(etichetta),
  );
  final testo = jsonEncode([etichetta, casa, ...campi]);
  final firma = await Hmac.sha256().calculateMac(
    utf8.encode(testo),
    secretKey: chiave,
  );
  return base64Url.encode(firma.bytes).replaceAll('=', '');
}

/// Porta la ricevuta alla casa passando dal centralino. Non solleva: com'e'
/// andata lo dice l'[EsitoDellaRicevuta].
Future<EsitoDellaRicevuta> portaLaRicevutaDaFuori({
  required IndirizzoDelCentralino centralino,
  required String casa,
  required String chi,
  required String chiaveDelFilo,
  required String piattaforma,
  required String prodotto,
  required String ricevuta,
  DateTime Function() adesso = DateTime.now,
  ConsegnaAlCentralino? consegna,
}) async {
  try {
    final quando = adesso().millisecondsSinceEpoch;
    final corpo = jsonEncode({
      'v': 1,
      'chi': chi,
      'quando': quando,
      'app': 'gdahome',
      'piattaforma': piattaforma,
      'prodotto': prodotto,
      'ricevuta': ricevuta,
      'firma': await firmaDellaRicevuta(
        chiaveDelFilo: chiaveDelFilo,
        casa: casa,
        chi: chi,
        quando: quando,
        app: 'gdahome',
        piattaforma: piattaforma,
        prodotto: prodotto,
        ricevuta: ricevuta,
      ),
    });
    final (stato, detto) = await (consegna ?? _consegna)(
      centralino.ricevuta(casa),
      corpo,
    );
    Object? letto;
    try {
      letto = jsonDecode(detto);
    } catch (_) {
      letto = null;
    }
    return EsitoDellaRicevuta(stato, letto);
  } catch (_) {
    /* Niente rete, un centralino che non risponde, una chiave che non si
     * legge: la ricevuta resta al negozio e si riprova. */
    return const EsitoDellaRicevuta(0, null);
  }
}

/// Porta un codice regalo alla casa passando dal centralino. Non solleva:
/// com'e' andata lo dice l'[EsitoDellaRicevuta], coi no della casa — `409`
/// gia' usato, `404` inesistente — come li dice lei.
Future<EsitoDellaRicevuta> portaIlRegaloDaFuori({
  required IndirizzoDelCentralino centralino,
  required String casa,
  required String chi,
  required String chiaveDelFilo,
  required String regalo,
  DateTime Function() adesso = DateTime.now,
  ConsegnaAlCentralino? consegna,
}) async {
  try {
    final quando = adesso().millisecondsSinceEpoch;
    final corpo = jsonEncode({
      'v': 1,
      'chi': chi,
      'quando': quando,
      'regalo': regalo,
      'firma': await firmaDelRegalo(
        chiaveDelFilo: chiaveDelFilo,
        casa: casa,
        chi: chi,
        quando: quando,
        regalo: regalo,
      ),
    });
    final (stato, detto) = await (consegna ?? _consegna)(
      centralino.ricevuta(casa),
      corpo,
    );
    Object? letto;
    try {
      letto = jsonDecode(detto);
    } catch (_) {
      letto = null;
    }
    return EsitoDellaRicevuta(stato, letto);
  } catch (_) {
    return const EsitoDellaRicevuta(0, null);
  }
}

Future<(int, String)> _consegna(Uri dove, String corpo) async {
  final risposta = await http
      .post(
        dove,
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
        },
        body: corpo,
      )
      .timeout(attesaDelCentralino);
  return (risposta.statusCode, risposta.body);
}

Uint8List _daEsadecimale(String testo) {
  if (testo.length.isOdd || !RegExp(r'^[0-9a-fA-F]*$').hasMatch(testo)) {
    throw const FormatException('la chiave del filo non è esadecimale');
  }
  return Uint8List.fromList([
    for (var i = 0; i < testo.length; i += 2)
      int.parse(testo.substring(i, i + 2), radix: 16),
  ]);
}
