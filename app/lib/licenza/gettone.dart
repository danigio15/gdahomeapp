/// Il gettone di una licenza: quello che il quadro firma e gli altri
/// controllano.
///
/// Il contratto sta in `docs/LICENZE.md`, sezione «Il gettone»:
///
/// ```
/// gettone = base64url(payload JSON) + "." + base64url(firma Ed25519)
/// firma   = Ed25519(chiave privata del quadro, byte ASCII del primo pezzo)
/// ```
///
/// Il controllo e' in due tempi, e non per pigrizia. La **firma** si controlla
/// una volta ([leggiIlGettone]), perche' costa: e' crittografia, e in Dart e'
/// asincrona. Il **tempo** invece si guarda ogni volta che qualcuno chiede
/// ([Gettone.vale]), perche' un gettone buono stamattina puo' essere scaduto
/// stasera, e chi disegna un lucchetto non puo' aspettare un `Future`.
library;

import 'dart:convert';

import 'package:cryptography/cryptography.dart';

import 'chiave.dart';

/// Quanto al massimo un gettone vale dopo che e' stato emesso: 8 giorni.
///
/// Lo dice il contratto, ed e' il quadro a rispettarlo. Qui si controlla lo
/// stesso: un gettone che promette di valere un anno non l'ha firmato il
/// quadro che conosciamo, o l'ha firmato sbagliando — e in tutti e due i casi
/// non lo si prende per buono.
const Duration validitaMassimaDelGettone = Duration(days: 8);

class Gettone {
  const Gettone({
    required this.grezzo,
    required this.app,
    required this.soggetto,
    required this.licenza,
    required this.origine,
    required this.scade,
    required this.fino,
    required this.emesso,
    this.prova = false,
  });

  /// Un abbonamento nei giorni di prova gratuita (`"prova": true` nel
  /// gettone, che il quadro mette solo quando e' vero).
  final bool prova;

  /// Il gettone com'e' arrivato: si ricorda questo, non i pezzi.
  final String grezzo;

  /// `gdahome` oppure `gdanav`.
  final String app;

  /// Di chi e': `casa_…` oppure `tel_…`.
  final String soggetto;

  /// L'identificativo della licenza nel quadro, `lic_…`.
  final String licenza;

  /// `negozio`, `regalo` oppure `installatore`.
  final String origine;

  /// Quando finisce la licenza. `null` vuol dire per sempre.
  final DateTime? scade;

  /// Quando smette di valere **questo** gettone: la casa lo rinnova prima.
  final DateTime fino;

  final DateTime emesso;

  /// Se vale adesso, per questo soggetto e per questa app.
  ///
  /// Le regole del contratto: `sog` e' quello atteso, `fino > adesso`,
  /// `scade == null || scade > adesso`; e un gettone `gdahome` vale anche per
  /// gdanav, che dentro gdahome Premium e' compreso.
  ///
  /// [soggetto] `null` vuol dire che la casa non ha detto come si chiama al
  /// centralino — una casa che il centralino non ce l'ha: allora basta che
  /// il gettone sia di **una casa**. Arriva comunque dal filo cifrato con
  /// quella casa, e non da un posto qualunque.
  bool vale({String? soggetto, String app = 'gdahome', DateTime? adesso}) {
    final ora = adesso ?? DateTime.now();
    if (soggetto != null && soggetto.isNotEmpty) {
      if (this.soggetto != soggetto) return false;
    } else if (!this.soggetto.startsWith('casa_')) {
      return false;
    }
    if (this.app != app && this.app != 'gdahome') return false;
    if (!fino.isAfter(ora)) return false;
    final scade = this.scade;
    if (scade != null && !scade.isAfter(ora)) return false;
    return true;
  }

  @override
  String toString() =>
      'Gettone($app, $soggetto, $origine, scade: $scade, fino: $fino)';
}

/// Apre un gettone e ne controlla la firma e la forma. `null` se non vale.
///
/// Non guarda il tempo ne' il soggetto: quelli li guarda [Gettone.vale], ogni
/// volta. Con la chiave vuota — com'e' di serie — nessun gettone vale.
///
/// [chiave] si passa nelle prove; di solito e' [chiavePubblicaLicenze].
Future<Gettone?> leggiIlGettone(String? grezzo, {String? chiave}) async {
  final pubblica = chiave ?? chiavePubblicaLicenze;
  if (grezzo == null || grezzo.isEmpty || pubblica.isEmpty) return null;
  final pezzi = grezzo.split('.');
  if (pezzi.length != 2 || pezzi[0].isEmpty || pezzi[1].isEmpty) return null;
  try {
    final chiaveInByte = _daBase64Url(pubblica);
    final firma = _daBase64Url(pezzi[1]);
    if (chiaveInByte.length != 32 || firma.length != 64) return null;
    final buona = await Ed25519().verify(
      ascii.encode(pezzi[0]),
      signature: Signature(
        firma,
        publicKey: SimplePublicKey(chiaveInByte, type: KeyPairType.ed25519),
      ),
    );
    if (!buona) return null;
    final detto = jsonDecode(utf8.decode(_daBase64Url(pezzi[0])));
    if (detto is! Map) return null;
    if (detto['v'] != 1) return null;
    final app = detto['app'];
    final soggetto = detto['sog'];
    final fino = detto['fino'];
    final emesso = detto['emesso'];
    final scade = detto['scade'];
    if (app is! String || soggetto is! String) return null;
    if (fino is! num || emesso is! num) return null;
    if (scade != null && scade is! num) return null;
    final finoIl = DateTime.fromMillisecondsSinceEpoch(fino.toInt());
    final emessoIl = DateTime.fromMillisecondsSinceEpoch(emesso.toInt());
    /* Un minuto di tolleranza: gli orologi non sono tutti uguali. */
    if (finoIl.difference(emessoIl) >
        validitaMassimaDelGettone + const Duration(minutes: 1)) {
      return null;
    }
    return Gettone(
      grezzo: grezzo,
      app: app,
      soggetto: soggetto,
      licenza: detto['lic'] is String ? detto['lic'] as String : '',
      origine: detto['origine'] is String ? detto['origine'] as String : '',
      scade: scade == null
          ? null
          : DateTime.fromMillisecondsSinceEpoch((scade as num).toInt()),
      fino: finoIl,
      emesso: emessoIl,
      prova: detto['prova'] == true,
    );
  } catch (_) {
    /* Base64 storto, JSON storto, una chiave che non e' una chiave: non vale,
     * e basta. Un gettone rotto non deve rompere l'app. */
    return null;
  }
}

List<int> _daBase64Url(String testo) =>
    base64Url.decode(base64Url.normalize(testo.trim()));
