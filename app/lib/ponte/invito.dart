/// L'invito: quello che c'e' scritto dentro il QR code.
///
/// ## Perche' non solo il codice
///
/// Perche' il codice da solo non basta a **trovare** la casa. Un'app che ha il
/// codice e basta puo' cercarla in un posto solo: il centralino con cui e'
/// stata costruita. Se quella casa ne chiama un altro — perche' chi l'ha
/// installata ne ha messo uno suo nelle opzioni dell'add-on — le due meta' non
/// si incontrano, e quello che si vede e' un'app che dice «non trovo la casa»
/// senza nessun modo di capire perche'.
///
/// Nel QR code invece c'e' tutto: il codice, **quale** centralino chiama
/// questa casa, e su quali indirizzi la si trova stando sul Wi-Fi. Chi
/// inquadra non sa niente di tutto questo e non deve saperlo.
///
/// ## L'altra meta' vive in un altro mondo
///
/// Questa riga la scrive `ponte/src/invito.js`, in Node, e non c'e' nessun
/// compilatore che tenga insieme le due. Le tiene insieme una cosa sola: gli
/// **stessi vettori** scritti a mano nelle prove di tutte e due. Se un giorno
/// divergono, una delle due prove diventa rossa prima che qualcuno inquadri un
/// QR code che non si apre.
library;

import '../parole.dart';
import 'indirizzo.dart';

const String _nome = 'gdahome';

/// La piu' nuova che questa app sa leggere.
const int _versione = 1;

const String _separatore = '|';

/// Non e' un invito: e' un'altra cosa, o e' rotto.
class InvitoIllegibile implements Exception {
  const InvitoIllegibile(this.spiegazione);
  final String spiegazione;

  @override
  String toString() => spiegazione;
}

/// E' un invito, ma di un ponte piu' nuovo di questa app.
///
/// Merita un tipo suo perche' merita una strada sua: «non ti capisco» manda a
/// controllare il codice, «sei vecchia» manda ad aggiornare l'app. Indovinare
/// quale delle due sia tocca a noi, non a chi guarda lo schermo.
class InvitoTroppoNuovo implements Exception {
  const InvitoTroppoNuovo(this.spiegazione);
  final String spiegazione;

  @override
  String toString() => spiegazione;
}

class Invito {
  const Invito({
    required this.codice,
    this.centralino,
    this.indirizzi = const [],
  });

  /// Il codice di abbinamento, com'e' stato fabbricato.
  final String codice;

  /// A quale centralino chiama questa casa. `null` quando la casa non ne ha
  /// nessuno: si entra solo da dentro, ed e' una scelta legittima.
  final IndirizzoDelCentralino? centralino;

  /// Dove si trova questa casa sulla rete di casa.
  final List<IndirizzoDelPonte> indirizzi;

  /// Legge quello che ha trovato il lettore di QR code.
  ///
  /// Solleva invece di tornare `null`: qui non si sta guardando qualcuno che
  /// scrive in una casella: si sta guardando un QR code gia' letto, e se non
  /// e' quello che ci si aspetta chi inquadra deve sentirselo dire — e
  /// sentirsi dire **quale** delle due cose e' andata storta.
  static Invito leggi(String scritto) {
    final pezzi = scritto.trim().split(_separatore);

    if (pezzi.isEmpty || pezzi[0].trim().toLowerCase() != _nome) {
      throw InvitoIllegibile(
        inLingua(
          it: 'Questo non è un codice di gdahome.',
          en: 'This isn\'t a gdahome code.',
        ),
      );
    }

    final quale = pezzi.length > 1 ? int.tryParse(pezzi[1].trim()) : null;
    if (quale == null || quale < 1) {
      throw InvitoIllegibile(
        inLingua(
          it: 'Questo non è un codice di gdahome.',
          en: 'This isn\'t a gdahome code.',
        ),
      );
    }
    if (quale > _versione) {
      throw InvitoTroppoNuovo(
        inLingua(
          it:
              'Questo codice viene da un ponte più nuovo di questa app: '
              'aggiorna l\'app.',
          en:
              'This code comes from an add-on newer than this app: update the '
              'app.',
        ),
      );
    }

    final codice = pezzi.length > 2 ? pezzi[2].trim() : '';
    if (codice.isEmpty) {
      throw InvitoIllegibile(
        inLingua(
          it: 'Questo codice è incompleto.',
          en: 'This code is incomplete.',
        ),
      );
    }

    return Invito(
      codice: codice,
      /* Un indirizzo che non si legge non fa fallire l'abbinamento: si tiene
       * quello che c'e'. Un invito senza centralino funziona lo stesso in
       * casa, e uno senza indirizzi funziona lo stesso dal centralino. */
      centralino: IndirizzoDelCentralino.leggi(
        pezzi.length > 3 ? pezzi[3] : null,
      ),
      indirizzi: [
        for (final scritto in (pezzi.length > 4 ? pezzi[4] : '').split(','))
          if (IndirizzoDelPonte.leggi(scritto) case final letto?) letto,
      ],
    );
  }
}
