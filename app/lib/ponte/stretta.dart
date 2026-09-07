/// La stretta di mano, e da li' in poi si parla cifrato.
///
/// Fra il telefono e la casa c'e' sempre qualcuno: il centralino quando si e'
/// fuori, la rete di casa quando si e' dentro. Nessuno dei due deve poter
/// leggere. Il centralino perche' e' il punto: instrada e non capisce, ed e'
/// la differenza fra «mi fido di chi lo gestisce» e «non c'e' niente di cui
/// fidarsi». La rete di casa perche' non e' cifrata, e chi ci sta sopra non
/// deve poter fare piu' di chi sta sul centralino.
///
/// Percio' la strada e' **una sola**: si passa sempre di qui. Nessuna
/// scorciatoia in chiaro «tanto siamo in casa», che poi e' quella che resta
/// accesa per sbaglio.
///
/// ─── Come va ──────────────────────────────────────────────────────────────
///
/// Un messaggio per parte, in chiaro. E' l'unico pezzo che il centralino vede,
/// e non c'e' niente dentro che gli serva.
///
///     telefono → casa   {v:1, chi:"dm_…", apertura:"…", mia:"…"}   telefono noto
///     telefono → casa   {v:1, abbina:true, apertura:"…", mia:"…"}  telefono nuovo
///     casa → telefono   {v:1, pronto:true, mia:"…"}
///     casa → telefono   {v:1, no:"…"}                              e basta
///     casa → telefono   {v:1, no:"…", riabbina:true}               non ti conosco piu'
///
/// Dall'altra parte c'e' `ponte/src/portiere.js`, e le due descrizioni devono
/// restare la stessa descrizione.
library;

import 'dart:async';
import 'dart:convert';

import 'package:cryptography/cryptography.dart';

import 'cifra.dart';
import 'errori.dart';
import 'presa.dart';

/// Quanto si aspetta che la casa risponda alla presentazione.
const Duration attesaDellaStretta = Duration(seconds: 15);

/// Stringe la mano e torna una presa che cifra da sola.
///
/// Con [chi] e [chiaveDelFilo] e' un telefono gia' abbinato che torna. Senza,
/// e' un telefono nuovo che si sta abbinando: li' la chiave del filo non c'e'
/// ancora — e' proprio quella che sta per ricevere — e la stretta di mano
/// difende da chi *guarda* ma non da chi si mette in mezzo per davvero. E'
/// scritto in `ponte/src/cifra.js`, e vale la pena saperlo invece di
/// scoprirlo.
Future<Presa> stringiLaMano(
  Presa sotto, {
  String? chi,
  String? chiaveDelFilo,
  Duration entro = attesaDellaStretta,
}) async {
  final mia = await coppiaEffimera();
  final apertura = aperturaNuova();
  final cifrata = PresaCifrata._(sotto);

  cifrata._ascolta(
    laPrima: (detto) async {
      if (detto['v'] != versioneDelProtocollo) {
        throw const StrettaRifiutata(
          'questa casa parla una lingua che non conosco: aggiorna il ponte, o l\'app',
        );
      }
      final no = detto['no'];
      if (no is String) {
        /* Una bandierina e non una frase: il telefono ci *fa* qualcosa —
         * smette di riprovare e manda l'utente a riabbinare — e farlo
         * dipendere dal testo vorrebbe dire romperlo il giorno che qualcuno
         * riscrive la frase. */
        throw detto['riabbina'] == true
            ? SegnoRifiutato(no)
            : StrettaRifiutata(no);
      }
      final sua = detto['mia'];
      if (detto['pronto'] != true || sua is! String) {
        throw const StrettaRifiutata('la casa non ha stretto la mano');
      }

      return chiaveDiSessione(
        miaPrivata: mia.privata,
        suaPubblica: base64.decode(sua),
        delTelefono: mia.pubblica,
        dellaCasa: base64.decode(sua),
        apertura: apertura,
        chiaveDelFilo: chiaveDelFilo,
      );
    },
  );

  sotto.manda(
    jsonEncode({
      'v': versioneDelProtocollo,
      if (chi != null) 'chi': chi else 'abbina': true,
      'apertura': base64.encode(apertura),
      'mia': mia.inBase64,
    }),
  );

  await cifrata._pronta.future.timeout(
    entro,
    onTimeout: () => throw const PonteIrraggiungibile(
      'la casa non ha risposto alla stretta di mano',
    ),
  );
  return cifrata;
}

/// Una presa qualunque, per chi ci parla sopra. Sotto, ogni messaggio e' una
/// busta.
class PresaCifrata implements Presa {
  PresaCifrata._(this._sotto);

  final Presa _sotto;
  final _uscita = StreamController<String>();
  final _pronta = Completer<void>();

  Busta? _busta;

  /* Segnato **subito**, non quando la chiave e' pronta.
   *
   * Ricavare la chiave e' asincrono, e la casa manda `auth_required` appena
   * dopo la risposta alla stretta di mano: senza questa bandierina, quel
   * secondo messaggio arriverebbe mentre la chiave e' ancora in cottura, e
   * verrebbe scambiato per un'altra stretta di mano. Sembra un caso di scuola
   * e invece succede a ogni collegamento. */
  bool _laStrettaEPresa = false;
  bool _chiusa = false;

  /* Cifrare e decifrare sono operazioni asincrone, e il contatore dentro la
   * busta non perdona: due messaggi imbustati insieme uscirebbero con i numeri
   * scambiati, e dall'altra parte il secondo verrebbe rifiutato come rigiocato.
   * Percio' si fa una coda: uno alla volta, nell'ordine in cui sono arrivati. */
  Future<void> _codaInUscita = Future<void>.value();
  Future<void> _codaInEntrata = Future<void>.value();

  @override
  Stream<String> get messaggi => _uscita.stream;

  void _ascolta({
    required Future<SecretKey> Function(Map<String, dynamic>) laPrima,
  }) {
    _sotto.messaggi.listen(
      (testo) {
        if (!_laStrettaEPresa) {
          _laStrettaEPresa = true;
          _laStretta(testo, laPrima);
          return;
        }
        _codaInEntrata = _codaInEntrata.then((_) => _apri(testo));
      },
      /* La fine si mette **in fondo alla coda**, non davanti.
       *
       * Aprire una busta e' asincrono; chiudere un socket non lo e'. Il ponte
       * dice `auth_invalid` e chiude subito dopo, e senza questo la chiusura
       * sorpasserebbe il messaggio: chi aspetta si vedrebbe arrivare «il filo
       * si e' chiuso» invece di «quel segno non vale piu'», e riproverebbe
       * per sempre invece di mandare l'utente a riabbinare. */
      onError: (Object errore) {
        _codaInEntrata = _codaInEntrata.then(
          (_) => _finita(FiloCaduto(_leggibile(errore))),
        );
      },
      onDone: () {
        _codaInEntrata = _codaInEntrata.then(
          (_) => _finita(const FiloCaduto('il filo si e\' chiuso')),
        );
      },
      cancelOnError: false,
    );
  }

  void _laStretta(
    String testo,
    Future<SecretKey> Function(Map<String, dynamic>) laPrima,
  ) {
    _codaInEntrata = _codaInEntrata.then((_) async {
      if (_busta != null || _chiusa) return;
      try {
        final letto = jsonDecode(testo);
        if (letto is! Map<String, dynamic>) {
          throw const StrettaRifiutata(
            'la casa ha risposto qualcosa che non e\' una risposta',
          );
        }
        _busta = Busta(await laPrima(letto), io: DaChi.telefono);
        if (!_pronta.isCompleted) _pronta.complete();
      } on FormatException {
        _fallisci(
          const StrettaRifiutata(
            'la casa ha risposto qualcosa che non e\' una risposta',
          ),
        );
      } catch (errore) {
        _fallisci(
          errore is ErroreDelPonte
              ? errore
              : StrettaRifiutata(_leggibile(errore)),
        );
      }
    });
  }

  Future<void> _apri(String testo) async {
    if (_chiusa) return;
    try {
      final dentro = await _busta!.apri(testo);
      if (!_uscita.isClosed) _uscita.add(dentro);
    } on BustaGuasta catch (errore) {
      /* Su un canale che passa da un terzo, un messaggio che non si apre o e'
       * rotto o e' stato toccato: in tutti e due i casi andare avanti sarebbe
       * peggio che fermarsi. */
      _finita(FiloCaduto('il filo e\' stato toccato: ${errore.spiegazione}'));
    }
  }

  @override
  void manda(String testo) {
    _codaInUscita = _codaInUscita.then((_) async {
      final busta = _busta;
      if (_chiusa || busta == null) return;
      try {
        _sotto.manda(await busta.chiudi(testo));
      } catch (errore) {
        _finita(FiloCaduto(_leggibile(errore)));
      }
    });
  }

  @override
  Future<void> chiudi() async {
    _chiusa = true;
    if (!_uscita.isClosed) await _uscita.close();
    await _sotto.chiudi();
  }

  void _fallisci(ErroreDelPonte errore) {
    if (!_pronta.isCompleted) _pronta.completeError(errore);
    _finita(errore);
  }

  void _finita(ErroreDelPonte errore) {
    if (_chiusa) return;
    _chiusa = true;
    if (!_pronta.isCompleted) _pronta.completeError(errore);
    if (!_uscita.isClosed) {
      _uscita.addError(errore);
      _uscita.close();
    }
    unawaited(_sotto.chiudi());
  }
}

String _leggibile(Object errore) =>
    errore is ErroreDelPonte ? errore.spiegazione : errore.toString();
