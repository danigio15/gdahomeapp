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
///     telefono → casa   {v:1, chi:"dm_…", apertura:"…", mia:"…", gzip:true}   telefono noto
///     telefono → casa   {v:1, abbina:2, apertura:"…", mia:"…"}              telefono nuovo
///     casa → telefono   {v:1, pronto:true, mia:"…", gzip:true, mucchio:true}
///     casa → telefono   {v:1, no:"…"}                              e basta
///     casa → telefono   {v:1, no:"…", riabbina:true}               non ti conosco
///     casa → telefono   {v:1, no:"…", motivo:"…"}                  l'abbinamento non parte
///
/// **Il `riabbina` in chiaro non e' una sentenza.** E' in chiaro, e chi sta
/// in mezzo — il centralino, o chi risponde all'indirizzo di casa — lo puo'
/// scrivere uguale. Se bastasse quello a spegnere il filo per sempre, bastava
/// una riga per staccare un telefono da una casa. Percio' qui diventa
/// [RifiutoNonFirmato]: un intoppo, detto con parole che fanno pensare a un
/// telefono staccato, e il filo continua a riprovare. La sentenza vera — il
/// telefono e' stato staccato dalla console — arriva **dentro il cifrato**,
/// dove la puo' scrivere solo chi ha la chiave del filo: e' `auth_invalid`,
/// e la legge `filo.dart`. Il ponte la manda cosi' quando della chiave di un
/// telefono staccato ha ancora memoria; quando non ce l'ha, resta il no in
/// chiaro, e l'app dice «forse» invece di cancellare.
///
/// **L'abbinamento** (`abbina: 2`) fa la chiave con lo scambio effimero **e**
/// col codice, e dopo il `pronto` il telefono manda la conferma — le due
/// chiavi pubbliche, dentro una busta chiusa con quella chiave. La casa
/// consegna segno e chiave del filo solo se la conferma si apre: vuol dire
/// che il codice qui e la' e' lo stesso, e che nessuno si e' messo in mezzo.
/// Se non si apre, la casa lo dice in chiaro (`{v:1, no:"…", motivo:"codice"}`)
/// — non c'e' una chiave in comune con cui dirlo — ed e' l'unica riga in
/// chiaro che si ascolta dopo la stretta. Vedi `ponte/src/portiere.js`.
///
/// `gzip: true` dice «so aprire una busta compressa»: chi manda comprime solo
/// se l'altro l'ha detto, e chi non lo dice — un ponte vecchio, l'app nel
/// browser — riceve e manda tutto com'era. Vedi `cifra.dart`.
///
/// `mucchio: true` dice «so spacchettare un mucchio di eventi»: il ponte, da
/// fuori casa, li manda insieme invece di uno per uno. Vedi `filo.dart` e
/// `ponte/src/ponte.js`.
///
/// Dall'altra parte c'e' `ponte/src/portiere.js`, e le due descrizioni devono
/// restare la stessa descrizione.
library;

import 'dart:async';
import 'dart:collection';
import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

import '../parole.dart';
import 'cifra.dart';
import 'errori.dart';
import 'presa.dart';

/// Quanto si aspetta che la casa risponda alla presentazione.
const Duration attesaDellaStretta = Duration(seconds: 15);

/// Quanto puo' essere grande un pezzo di busta.
///
/// La prima cosa che l'app chiede e' `get_states`: **tutta la casa in un
/// messaggio solo**, che su una casa vera sono due o tre megabyte. Dal
/// centralino non passa — le funzioni sulla nuvola hanno un tetto di un
/// megabyte per messaggio, e non e' un'impostazione — quindi le buste grandi
/// si spezzano.
///
/// Un pezzo comincia con `|`, l'ultimo no: chi riceve accumula finche' non
/// arriva quello senza. Il segno sta **fuori** dalla busta, quindi chi sta in
/// mezzo puo' al massimo rovinare l'impacchettamento — e allora la busta non
/// si apre, che e' esattamente quello che deve succedere. E `|` in base64 non
/// c'e': una busta intera non comincera' mai con quello.
const int pezzoMassimo = 512 * 1024;

/// Oltre questo, chi manda non sta mandando la casa: sta riempiendo la nostra
/// memoria.
const int interoMassimo = 16 * 1024 * 1024;

/// Stringe la mano e torna una presa che cifra da sola.
///
/// Con [chi] e [chiaveDelFilo] e' un telefono gia' abbinato che torna. Con
/// [codice] e' un telefono nuovo che si sta abbinando: la chiave del filo non
/// c'e' ancora — e' proprio quella che sta per ricevere — e al suo posto la
/// chiave si fa col codice. Chi sta in mezzo, senza il codice, arriva a
/// un'altra chiave. Dopo la stretta, chi si abbina manda la conferma: vedi
/// `abbinamento.dart`.
Future<PresaCifrata> stringiLaMano(
  Presa sotto, {
  String? chi,
  String? chiaveDelFilo,
  String? codice,
  Duration entro = attesaDellaStretta,
}) async {
  final perAbbinarsi = codice != null;
  final mia = await coppiaEffimera();
  final apertura = aperturaNuova();
  final cifrata = PresaCifrata._(
    sotto,
    miaPubblica: mia.inBase64,
    perAbbinarsi: perAbbinarsi,
  );

  cifrata._ascolta(
    laPrima: (detto) async {
      if (detto['v'] != versioneDelProtocollo) {
        throw const StrettaRifiutata(
          'questa casa parla una lingua che non conosco: aggiorna gdahome, o l\'app',
        );
      }
      final no = detto['no'];
      if (no is String) {
        /* Una bandierina e non una frase: il telefono ci *fa* qualcosa, e
         * farlo dipendere dal testo vorrebbe dire romperlo il giorno che
         * qualcuno riscrive la frase. */
        if (perAbbinarsi) throw rifiutoDellAbbinamento(detto, no);
        throw detto['riabbina'] == true
            ? RifiutoNonFirmato(
                inLingua(
                  it:
                      'la casa dice di non conoscere più questo telefono. Se '
                      'l\'hai staccato dalla console, riabbinalo; se no, '
                      'riprovo da solo',
                  en:
                      'your home says it no longer knows this phone. If you '
                      'removed it from the console, pair it again; otherwise '
                      'I\'ll keep trying',
                ),
              )
            : StrettaRifiutata(no);
      }
      final sua = detto['mia'];
      if (detto['pronto'] != true || sua is! String) {
        throw const StrettaRifiutata('la casa non ha stretto la mano');
      }
      cifrata._suaPubblica = sua;

      return chiaveDiSessione(
        miaPrivata: mia.privata,
        suaPubblica: base64.decode(sua),
        delTelefono: mia.pubblica,
        dellaCasa: base64.decode(sua),
        apertura: apertura,
        chiaveDelFilo: perAbbinarsi ? null : chiaveDelFilo,
        codice: codice,
      );
    },
  );

  sotto.manda(
    jsonEncode({
      'v': versioneDelProtocollo,
      if (perAbbinarsi) 'abbina': versioneDellAbbinamento else 'chi': chi,
      'apertura': base64.encode(apertura),
      'mia': mia.inBase64,
      /* Sul telefono si'; nel browser no, e non lo si dice. Abbinandosi
       * nemmeno: passano il segno e la chiave, e per quattro righe non serve
       * a niente. */
      if (gzipDisponibile && !perAbbinarsi) 'gzip': true,
      /* Un mucchio di eventi in un messaggio solo: qui si sa spacchettare, e
       * si dice sempre — nel browser come sul telefono. Il ponte lo fa solo
       * passando dal centralino, che e' dove ogni messaggio e' una richiesta
       * contata; in casa manda come prima. Vedi `ponte/src/ponte.js`. */
      'mucchio': true,
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

/// Il no della casa a chi si stava abbinando, come cosa sua.
///
/// `motivo` lo dice il ponte apposta per questo (vedi
/// `ponte/src/portiere.js`). Un `riabbina` invece, a chi si sta abbinando, lo
/// dice solo un ponte di prima di questa stretta di mano: non sa cosa sia
/// `abbina: 2`, e lo prende per un telefono che non conosce.
ErroreDelPonte rifiutoDellAbbinamento(Map<String, dynamic> detto, String no) {
  switch (detto['motivo']) {
    case 'codice':
    case 'nessuno':
      return CodiceRifiutato(no);
    case 'tentativi':
      return TroppiTentativi(no);
    case 'telefoni':
      return TroppiDispositivi(no);
    case 'aggiorna':
      return StrettaRifiutata(no);
  }
  if (detto['riabbina'] == true) {
    return StrettaRifiutata(
      inLingua(
        it:
            'gdahome su questa casa è di una versione vecchia: aggiornalo in '
            'Home Assistant, poi riprova',
        en:
            'gdahome on this home is an old version: update it in Home '
            'Assistant, then try again',
      ),
    );
  }
  return StrettaRifiutata(no);
}

/// Una presa qualunque, per chi ci parla sopra. Sotto, ogni messaggio e' una
/// busta.
class PresaCifrata implements PresaAperta {
  PresaCifrata._(
    this._sotto, {
    required this.miaPubblica,
    this.perAbbinarsi = false,
  });

  final Presa _sotto;

  /// La chiave pubblica effimera di qua, in base64, com'e' andata sul filo.
  final String miaPubblica;

  /// Quella della casa, come e' arrivata nel `pronto`.
  String? get suaPubblica => _suaPubblica;
  String? _suaPubblica;

  /// Se questa e' la presa di un abbinamento. Li', dopo la stretta, si
  /// ascolta anche una riga in chiaro: il no a una conferma che non si e'
  /// aperta.
  final bool perAbbinarsi;
  final _uscita = StreamController<Uint8List>();
  final _pronta = Completer<void>();

  Busta? _busta;

  /* I pezzi di una busta grande, mentre arrivano. */
  final StringBuffer _pezzi = StringBuffer();

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
   * Percio' si fa una coda: uno alla volta, nell'ordine in cui sono arrivati.
   *
   * In uscita e' una fila che si svuota da se', non una catena di `then`:
   * una catena riparte nella zona della promessa gia' compiuta, che puo'
   * essere un'altra da quella di chi manda — nelle prove col tempo finto il
   * messaggio restava fermo finche' non girava il tempo vero. */
  final _daMandare = Queue<String>();
  bool _mandando = false;
  Future<void> _codaInEntrata = Future<void>.value();

  /* Quanto passa sul filo davvero, in caratteri di busta: e' quello che la
   * compressione fa calare, e in diagnostica si mette accanto a quanto e'
   * arrivato una volta aperto. */
  int _caratteriArrivati = 0;
  int _caratteriMandati = 0;

  /// I caratteri arrivati sul filo, buste comprese, da quando e' aperta.
  int get caratteriArrivati => _caratteriArrivati;

  /// I caratteri mandati sul filo, buste comprese, da quando e' aperta.
  int get caratteriMandati => _caratteriMandati;

  /// Se quello che si manda si comprime: la casa ha detto di saper aprire il
  /// gzip, e qui lo si sa chiudere.
  bool get comprime => _busta?.comprime ?? false;

  @override
  Stream<Uint8List> get messaggi => _uscita.stream;

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
          (_) => _finita(const FiloCaduto('il filo si è chiuso')),
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
            'la casa ha risposto qualcosa che non è una risposta',
          );
        }
        _busta = Busta(
          await laPrima(letto),
          io: DaChi.telefono,
          comprime: gzipDisponibile && letto['gzip'] == true,
        );
        if (!_pronta.isCompleted) _pronta.complete();
      } on FormatException {
        _fallisci(
          const StrettaRifiutata(
            'la casa ha risposto qualcosa che non è una risposta',
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
    _caratteriArrivati += testo.length;

    /* Una busta non comincia mai con una graffa — in base64 non c'e' — e
     * una riga che comincia cosi', abbinandosi, e' il no della casa a una
     * conferma che non si e' aperta. In chiaro, e quindi buono solo per
     * fermarsi: non porta niente, e fermarsi e' comunque quello che si fa. */
    if (perAbbinarsi && testo.startsWith('{')) {
      Object? letto;
      try {
        letto = jsonDecode(testo);
      } catch (_) {
        letto = null;
      }
      final no = letto is Map<String, dynamic> ? letto['no'] : null;
      _finita(
        no is String
            ? rifiutoDellAbbinamento(letto as Map<String, dynamic>, no)
            : const FiloCaduto('la casa ha risposto qualcosa che non capisco'),
      );
      return;
    }

    if (testo.startsWith('|')) {
      _pezzi.write(testo.substring(1));
      if (_pezzi.length > interoMassimo) {
        _pezzi.clear();
        _finita(
          const FiloCaduto('la casa ha mandato qualcosa di troppo grande'),
        );
      }
      return;
    }

    final String intero;
    if (_pezzi.isEmpty) {
      intero = testo;
    } else {
      _pezzi.write(testo);
      intero = _pezzi.toString();
      _pezzi.clear();
    }

    try {
      /* `apriByte` e non `apri`: quello che c'e' dentro resta byte, e lo
       * legge dai byte chi sta sopra. Farne una stringa qui vorrebbe dire
       * allocarla nell'isolato che decifra e copiarla in questo — fra isolati
       * le stringhe si copiano, i byte si trasferiscono — per poi buttarla
       * subito dopo. */
      final dentro = await _busta!.apriByte(intero);
      if (!_uscita.isClosed) _uscita.add(dentro);
    } on BustaGuasta catch (errore) {
      /* Su un canale che passa da un terzo, un messaggio che non si apre o e'
       * rotto o e' stato toccato: in tutti e due i casi andare avanti sarebbe
       * peggio che fermarsi. */
      _finita(FiloCaduto('il filo è stato toccato: ${errore.spiegazione}'));
    } catch (errore) {
      /* Qualunque altra cosa: si chiude, e si dice cosa.
       *
       * Prima qui si prendeva solo `BustaGuasta`, e tutto il resto finiva
       * nella coda dei messaggi in entrata — dove non lo guardava nessuno. Il
       * filo restava aperto e muto, e chi guardava lo schermo vedeva una
       * rotella per venticinque secondi e poi «il ponte non risponde», che di
       * quello che era successo non diceva niente.
       *
       * E' successo davvero, e per un motivo che nessuno avrebbe indovinato:
       * nella versione web l'aritmetica a sessantaquattro bit dei contatori
       * non esiste, e ogni busta scoppiava. Un errore ingoiato costa piu' di
       * quello che nasconde. */
      _finita(FiloCaduto(_leggibile(errore)));
    }
  }

  @override
  void manda(String testo) {
    _daMandare.add(testo);
    if (!_mandando) unawaited(_svuota());
  }

  Future<void> _svuota() async {
    _mandando = true;
    try {
      while (_daMandare.isNotEmpty) {
        final testo = _daMandare.removeFirst();
        final busta = _busta;
        /* Prima della stretta di mano non c'e' con che imbustare: quello che
         * si manda adesso si perde, come prima. */
        if (_chiusa || busta == null) continue;
        try {
          final chiusa = await busta.chiudi(testo);
          _caratteriMandati += chiusa.length;
          if (chiusa.length <= pezzoMassimo) {
            _sotto.manda(chiusa);
            continue;
          }
          for (var da = 0; da < chiusa.length; da += pezzoMassimo) {
            final fino = da + pezzoMassimo;
            final pezzo = chiusa.substring(da, fino.clamp(0, chiusa.length));
            _sotto.manda(fino >= chiusa.length ? pezzo : '|$pezzo');
          }
        } catch (errore) {
          _finita(FiloCaduto(_leggibile(errore)));
          return;
        }
      }
    } finally {
      _mandando = false;
    }
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
