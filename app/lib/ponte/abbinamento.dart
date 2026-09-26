/// L'abbinamento: un QR code inquadrato, e basta.
///
/// E' la sola volta in cui l'utente fa qualcosa. Il QR code sta nella scheda
/// del ponte dentro Home Assistant, dove lo vede solo chi in Home Assistant e'
/// gia' entrato; chi non puo' inquadrarlo trova sotto le stesse cose in
/// lettere, e le batte.
///
/// **Quello che qui dentro non si chiede mai** vale la pena scriverlo, perche'
/// e' una decisione e non un caso: le credenziali di Home Assistant. Non un
/// gettone, non una password, non un indirizzo di posta. Chi installa un'app
/// di terzi e si sente chiedere le chiavi di casa fa benissimo a chiuderla, e
/// noi non gliele chiediamo. Tutto quello che serve nasce dentro Home
/// Assistant e ne esce una volta sola, in due pezzi che valgono solo per
/// questo telefono e che si possono staccare con un bottone.
///
/// Da quell'unica risposta l'app impara **tutto il resto**: come si chiama
/// questo telefono per il ponte, la chiave con cui cifrare, come si chiama
/// quella casa al centralino, quale centralino, e su quali indirizzi la si
/// trova stando in casa. L'utente non batte nessun indirizzo, e non deve
/// andarlo a cercare nel router.
library;

import 'dart:async';
import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:http/http.dart' as http;

import '../parole.dart';
import 'errori.dart';
import 'indirizzo.dart';
import 'invito.dart';
import 'cifra.dart' show codicePulito;
import 'presa.dart';
import 'stretta.dart';

export 'cifra.dart' show codicePulito;

/// Quanto si aspetta il ponte prima di dire che non c'e'.
const Duration _attesa = Duration(seconds: 12);

/// Quanto si aspetta la risposta al codice, dentro il filo cifrato.
const Duration _attesaDelCodice = Duration(seconds: 20);

/// Quanto si sta a cercare quale degli indirizzi di casa risponde davvero.
const Duration _attesaDegliIndirizzi = Duration(seconds: 2);

/// Quello che si riceve abbinandosi. Esce dal ponte **una volta sola**: da
/// quel momento non c'e' nessuna strada per rileggerlo, quindi chi chiama lo
/// mette via subito nel portachiavi.
class Abbinato {
  const Abbinato({
    required this.segno,
    required this.chiave,
    required this.identificativo,
    required this.nomeDelDispositivo,
    this.casaAlCentralino,
    this.centralino,
    this.indirizzi = const [],
  });

  /// Fa entrare. Il ponte ne tiene solo l'impronta.
  final String segno;

  /// Cifra il filo. Al centralino non passa mai.
  final String chiave;

  /// Come questo telefono si chiama per il ponte — `dm_…`.
  final String identificativo;

  final String nomeDelDispositivo;

  /// Come la casa si chiama al centralino — `casa_…`.
  final String? casaAlCentralino;

  /// A quale centralino chiama questa casa.
  final IndirizzoDelCentralino? centralino;

  /// Dove si trova questa casa sulla rete locale.
  final List<IndirizzoDelPonte> indirizzi;

  /* Ne' il segno ne' la chiave compaiono: `toString` finisce nei registri. */
  @override
  String toString() => 'Abbinato($nomeDelDispositivo, $identificativo)';
}

/// Com'e' andata a finire, e da dove si e' entrati.
///
/// Le due cose viaggiano insieme perche' chi ha chiamato ha bisogno di tutte e
/// due: quello che la casa ha detto, e **da quale delle sue porte** si e'
/// entrati — che e' quello che l'app si segna per la volta dopo.
class Entrata {
  const Entrata(this.abbinato, {this.daDentro});

  final Abbinato abbinato;

  /// L'indirizzo di casa che ha risposto, quando si e' entrati da li'.
  /// `null` vuol dire che si e' passati dal centralino.
  final IndirizzoDelPonte? daDentro;
}

class Abbinamento {
  const Abbinamento._();

  /// Abbina con quello che c'era scritto nel QR code.
  ///
  /// Il QR code dice **due** strade per la stessa casa, e quale delle due sia
  /// quella buona dipende da dove si sta in questo momento: sul divano si va
  /// dritti, dalla stazione si passa dal centralino. Non lo si chiede a chi
  /// guarda lo schermo — non lo saprebbe dire, e non dovrebbe: si bussa agli
  /// indirizzi di casa, e se risponde qualcuno vuol dire che si e' in casa.
  ///
  /// Dritti e' meglio quando si puo': sono i millesimi contro i decimi, e
  /// soprattutto non ha bisogno che internet ci sia.
  static Future<Entrata> conLInvito(
    Invito invito, {
    required String nome,
    required String sistema,
    IndirizzoDelCentralino? centralinoDiRipiego,
    ApriLaPresa? apri,
    Future<bool> Function(Uri)? bussa,
  }) async {
    /* Solo gli indirizzi da cui ci si puo' abbinare: un indirizzo in chiaro
     * fuori casa non si prova nemmeno, e si passa dal centralino. */
    final inCasa = await qualeRisponde([
      for (final dove in invito.indirizzi)
        if (dove.siPuoAbbinare) dove,
    ], bussa: bussa);
    if (inCasa != null) {
      return Entrata(
        await chiedi(
          dove: inCasa,
          codice: invito.codice,
          nome: nome,
          sistema: sistema,
          apri: apri,
        ),
        daDentro: inCasa,
      );
    }

    /* Il centralino del QR code vince su quello con cui l'app e' stata
     * costruita: e' quello che quella casa chiama davvero. Il nostro resta
     * come ripiego per i QR code che non lo dicono. */
    final centralino = invito.centralino ?? centralinoDiRipiego;
    if (centralino == null) {
      throw PonteIrraggiungibile(
        inLingua(
          it:
              'questo codice non dice da dove si entra, e questa app non ha '
              'un centralino a cui chiedere',
          en:
              'this code doesn\'t say where to get in, and this app has no '
              'relay to ask',
        ),
      );
    }
    return Entrata(
      await colCodice(
        centralino: centralino,
        codice: invito.codice,
        nome: nome,
        sistema: sistema,
        apri: apri,
      ),
    );
  }

  /// Abbina passando dal centralino: **l'utente batte solo il codice**.
  ///
  /// Il centralino instrada sull'**impronta** del codice, non sul codice: la
  /// casa gliel'ha data quando la console ha fabbricato il codice, e il
  /// codice li' non passa mai. Chi sta in mezzo vede una stringa esadecimale
  /// da cui non si torna indietro, e byte cifrati.
  static Future<Abbinato> colCodice({
    required IndirizzoDelCentralino centralino,
    required String codice,
    required String nome,
    required String sistema,
    ApriLaPresa? apri,
  }) async {
    final pulito = _codiceBuono(codice);
    if (!centralino.sicuro && !eInCasa(centralino.casa)) {
      throw PonteIrraggiungibile(_soloInCasa);
    }
    return _sulFilo(
      centralino.abbinamento(await impronta(pulito)),
      codice: pulito,
      nome: nome,
      sistema: sistema,
      apri: apri,
    );
  }

  /// Abbina bussando dritto al ponte, quando si sa dove sta.
  ///
  /// Serve a chi il centralino non ce l'ha — l'add-on lo lascia vuoto, e va
  /// benissimo per chi la casa la guarda dal divano — e a chi vuole abbinare
  /// senza far passare niente da fuori.
  ///
  /// Passa dal filo, come tutto il resto, e con la stessa stretta di mano
  /// legata al codice che si fa dal centralino. Una volta era una POST in
  /// chiaro, con il segno e la chiave nella risposta: sulla rete di casa li
  /// leggeva chiunque ci fosse sopra, e chi rispondeva al posto del ponte se
  /// li prendeva. Adesso chi sta sulla rete di casa vede quello che vede il
  /// centralino, cioe' niente.
  static Future<Abbinato> chiedi({
    required IndirizzoDelPonte dove,
    required String codice,
    required String nome,
    required String sistema,
    ApriLaPresa? apri,
  }) async {
    final pulito = _codiceBuono(codice);
    if (!dove.siPuoAbbinare) throw PonteIrraggiungibile(_soloInCasa);
    return _sulFilo(
      dove.filo,
      codice: pulito,
      nome: nome,
      sistema: sistema,
      apri: apri,
    );
  }

  static String get _soloInCasa => inLingua(
    it:
        'in chiaro ci si abbina solo dentro casa: questo indirizzo è fuori. '
        'Usa l\'indirizzo di casa, o uno che cominci con https',
    en:
        'pairing without encryption only works inside the home: this address '
        'is outside. Use the home address, or one starting with https',
  );

  static String _codiceBuono(String codice) {
    final pulito = codicePulito(codice);
    if (pulito.length < 4) {
      throw CodiceRifiutato(
        inLingua(
          it: 'questo codice è troppo corto',
          en: 'this code is too short',
        ),
      );
    }
    return pulito;
  }

  /* Il giro intero, uguale da tutte e due le strade: si apre il filo, si
   * stringe la mano col codice, si conferma, e si aspetta l'«ecco». */
  static Future<Abbinato> _sulFilo(
    Uri dove, {
    required String codice,
    required String nome,
    required String sistema,
    ApriLaPresa? apri,
  }) async {
    final Presa sotto;
    try {
      sotto = await (apri ?? PresaSuWebSocket.apri)(dove);
    } catch (errore) {
      throw PonteIrraggiungibile(_leggibile(errore));
    }

    PresaCifrata? cifrata;
    try {
      cifrata = await stringiLaMano(sotto, codice: codice);
      /* Il codice non viaggia: sta gia' dentro la chiave. Quello che si manda
       * e' la conferma — le due chiavi pubbliche come le ha viste questo
       * telefono, in una busta chiusa con la chiave del codice. La casa la
       * apre solo se il codice e' lo stesso, e solo allora risponde con il
       * segno e la chiave. */
      final risposta = _laPrimaRisposta(cifrata);
      cifrata.manda(
        jsonEncode({
          't': 'conferma',
          'telefono': cifrata.miaPubblica,
          'casa': cifrata.suaPubblica,
          'nome': nome,
          'sistema': sistema,
        }),
      );
      return _leggiLEcco(
        await risposta.timeout(
          _attesaDelCodice,
          onTimeout: () => throw const PonteIrraggiungibile(
            'la casa non ha risposto al codice',
          ),
        ),
      );
    } on ErroreDelPonte {
      rethrow;
    } catch (errore) {
      throw PonteIrraggiungibile(_leggibile(errore));
    } finally {
      /* Un filo di abbinamento serve a una cosa sola e poi si chiude: il
       * telefono torna dalla porta normale, col segno appena avuto. */
      await (cifrata?.chiudi() ?? sotto.chiudi());
    }
  }

  /// C'e' qualcuno e risponde?
  ///
  /// Vale sia per il ponte sia per il centralino: tutti e due hanno un
  /// `/salute` che dice `{"vivo":true}`, ed e' apposta — chi cerca da dove si
  /// entra li chiede tutti allo stesso modo, senza sapere chi sono.
  static Future<bool> cePonte(Uri salute, {http.Client? cliente}) async {
    final suo = cliente == null;
    final chi = cliente ?? http.Client();
    try {
      final risposta = await chi.get(salute).timeout(_attesa);
      if (risposta.statusCode != 200) return false;
      return _leggi(risposta.body)['vivo'] == true;
    } catch (_) {
      return false;
    } finally {
      if (suo) chi.close();
    }
  }

  /// Quale degli indirizzi di casa risponde davvero, adesso.
  ///
  /// Il ponte ne dice fino a quattro — una macchina puo' avere due schede di
  /// rete — e provarli tutti a ogni apertura dell'app costerebbe un'attesa a
  /// vuoto. Qui se ne tiene uno, e si sceglie quello che risponde: se si sta
  /// abbinando da fuori non risponde nessuno, e allora si tiene il primo, che
  /// e' meglio di niente per quando si torna a casa.
  static Future<IndirizzoDelPonte?> qualeIndirizzo(
    List<IndirizzoDelPonte> indirizzi, {
    Future<bool> Function(Uri)? bussa,
  }) async {
    if (indirizzi.isEmpty) return null;
    /* Uno solo non c'e' niente da scegliere, e la bussata sarebbe un'attesa
     * pagata per niente: quando non si e' in casa non risponde, e si
     * tornerebbe comunque a questo. */
    if (indirizzi.length == 1) return indirizzi.first;
    return await qualeRisponde(indirizzi, bussa: bussa) ?? indirizzi.first;
  }

  /// Quale risponde, oppure **nessuno**.
  ///
  /// La differenza con `qualeIndirizzo` e' tutta in quel «nessuno», e non e'
  /// una sfumatura: qui il silenzio e' una risposta. Vuol dire «non sei in
  /// casa», ed e' quello che fa scegliere fra andare dritti e passare dal
  /// centralino.
  static Future<IndirizzoDelPonte?> qualeRisponde(
    List<IndirizzoDelPonte> indirizzi, {
    Future<bool> Function(Uri)? bussa,
  }) async {
    if (indirizzi.isEmpty) return null;
    final chiedi = bussa ?? ((Uri dove) => cePonte(dove));

    final vincitore = Completer<IndirizzoDelPonte?>();
    var quantiNo = 0;
    for (final dove in indirizzi) {
      unawaited(
        chiedi(dove.salute).then(
          (ha) {
            if (vincitore.isCompleted) return;
            if (ha) {
              vincitore.complete(dove);
              return;
            }
            quantiNo += 1;
            if (quantiNo == indirizzi.length) vincitore.complete(null);
          },
          onError: (Object _) {
            quantiNo += 1;
            if (quantiNo == indirizzi.length && !vincitore.isCompleted) {
              vincitore.complete(null);
            }
          },
        ),
      );
    }
    return vincitore.future.timeout(
      _attesaDegliIndirizzi,
      onTimeout: () => null,
    );
  }

  /* ─── Leggere quello che dice la casa ────────────────────────────────── */

  /* Dai byte al JSON in un colpo, senza la stringa in mezzo. */
  static final _daByte = const Utf8Decoder().fuse(const JsonDecoder());

  static Future<Map<String, dynamic>> _laPrimaRisposta(PresaAperta cifrata) {
    final detta = Completer<Map<String, dynamic>>();
    cifrata.messaggi.listen(
      (byte) {
        if (detta.isCompleted) return;
        final letto = _daByte.convert(byte);
        detta.complete(letto is Map<String, dynamic> ? letto : const {});
      },
      onError: (Object errore) {
        if (!detta.isCompleted) detta.completeError(errore);
      },
      onDone: () {
        if (!detta.isCompleted) {
          detta.completeError(
            const PonteIrraggiungibile('la casa ha chiuso senza rispondere'),
          );
        }
      },
    );
    return detta.future;
  }

  static Abbinato _leggiLEcco(Map<String, dynamic> detto) {
    if (detto['t'] == 'no') {
      final perche = detto['perche'] as String? ?? 'non ha funzionato';
      /* Il ponte dice il perche' con una parola apposta, `motivo`. */
      if (detto['motivo'] is String) {
        throw rifiutoDellAbbinamento(detto, perche);
      }
      /* Un ponte che il motivo non lo dice lo dice solo a parole, e allora
       * ci si appoggia al testo. */
      if (perche.contains('troppi tentativi')) throw TroppiTentativi(perche);
      if (perche.contains('telefoni')) throw TroppiDispositivi(perche);
      throw CodiceRifiutato(perche);
    }
    if (detto['t'] != 'ecco') {
      throw const PonteIrraggiungibile(
        'la casa ha risposto qualcosa che non capisco',
      );
    }
    return _daJson(detto);
  }

  static Abbinato _daJson(Map<String, dynamic> corpo) {
    final segno = corpo['segno'];
    final chiave = corpo['chiave'];
    final dispositivo = corpo['dispositivo'];
    if (segno is! String || segno.isEmpty) {
      throw const PonteIrraggiungibile('gdahome ha risposto senza segno');
    }
    if (chiave is! String || chiave.isEmpty) {
      throw const PonteIrraggiungibile(
        'questo ponte è di una versione vecchia: aggiornalo in Home Assistant',
      );
    }
    final identificativo = dispositivo is Map ? dispositivo['id'] : null;
    if (identificativo is! String || identificativo.isEmpty) {
      throw const PonteIrraggiungibile(
        'gdahome ha risposto senza dire chi siamo',
      );
    }

    final ritorno = corpo['ritorno'];
    final detto = ritorno is Map<String, dynamic>
        ? ritorno
        : const <String, dynamic>{};
    return Abbinato(
      segno: segno,
      chiave: chiave,
      identificativo: identificativo,
      nomeDelDispositivo:
          (dispositivo is Map ? dispositivo['nome'] as String? : null) ??
          'questo telefono',
      casaAlCentralino: detto['casa'] as String?,
      centralino: IndirizzoDelCentralino.leggi(detto['centralino'] as String?),
      indirizzi: [
        for (final scritto
            in (detto['indirizzi'] as List<dynamic>? ?? const []))
          if (IndirizzoDelPonte.leggi('$scritto') case final letto?) letto,
      ],
    );
  }

  static Map<String, dynamic> _leggi(String corpo) {
    try {
      final letto = jsonDecode(corpo);
      return letto is Map<String, dynamic> ? letto : const {};
    } catch (_) {
      return const {};
    }
  }
}

/// L'impronta di un codice: quello che si dice al centralino al posto suo.
///
/// La stessa che calcola il ponte in `ponte/src/segreti.js` — SHA-256 in
/// esadecimale minuscolo. Se le due divergessero, il centralino non
/// instraderebbe piu' nessun abbinamento.
Future<String> impronta(String codice) async {
  final fatta = await Sha256().hash(utf8.encode(codice));
  return fatta.bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
}

String _leggibile(Object errore) {
  if (errore is ErroreDelPonte) return errore.spiegazione;
  final testo = errore.toString();
  if (testo.contains('TimeoutException')) return 'non ha risposto in tempo';
  if (testo.contains('Failed host lookup')) {
    return 'questo indirizzo non esiste';
  }
  if (testo.contains('Connection refused')) {
    return 'non risponde su questa porta';
  }
  return 'non riesco a raggiungere la casa';
}
