/// Chi chiede davvero il volto e l'impronta: il sistema del telefono.
///
/// Sta dietro un'interfaccia per una ragione sola, ed e' la stessa di
/// `Dispensa` e di `Sonda`: nelle prove non c'e' nessun telefono a cui
/// chiedere, e una regola che si puo' provare solo con un dito vero e' una
/// regola che non si prova.
///
/// Di la' c'e' `local_auth`, che parla con BiometricPrompt su Android e con
/// LocalAuthentication su iOS. Da qui si vede una domanda e una risposta.
///
/// ─── Cosa NON passa di qui ────────────────────────────────────────────────
///
/// Il volto e l'impronta. Restano nel coprocessore del telefono — Secure
/// Enclave, TEE — e quello che torna e' un `true` o un `false`. Non c'e'
/// niente da cifrare e niente da mandare, perche' non c'e' niente che esca.
library;

import 'package:flutter/services.dart';
import 'package:local_auth/error_codes.dart' as male;
import 'package:local_auth/local_auth.dart';

import '../parole.dart';
import 'il_lucchetto.dart';

/// Com'e' andata la domanda.
enum ComeEAndata {
  /// Riconosciuto: si passa.
  si,

  /// Non riconosciuto, o chi guarda ha annullato. Si puo' riprovare.
  no,

  /// Il telefono non sa proprio rispondere: niente lettore, niente registrato,
  /// nessun codice di sblocco. Non e' un no da riprovare.
  nonSaFarlo,
}

/// La guardia del telefono.
abstract interface class LaGuardia {
  /// Cosa sa fare questo telefono, adesso.
  ///
  /// Si richiede ogni volta: un'impronta si cancella dalle impostazioni del
  /// sistema, un volto si registra stasera, e tenerselo a mente vorrebbe dire
  /// un'app che offre una cosa che il telefono non ha piu'.
  Future<CosaSaFareIlTelefono> cosaSaFare();

  /// Chiede, e aspetta.
  ///
  /// [perche] e' la riga che il sistema scrive nella sua finestra: la legge
  /// chi ha il telefono in mano, e deve dire **cosa sta per succedere**, non
  /// «autenticati».
  Future<ComeEAndata> chiedi({required String perche});
}

/// La guardia vera, quella del sistema.
class LaGuardiaDelTelefono implements LaGuardia {
  LaGuardiaDelTelefono([LocalAuthentication? sistema])
    : _sistema = sistema ?? LocalAuthentication();

  final LocalAuthentication _sistema;

  @override
  Future<CosaSaFareIlTelefono> cosaSaFare() async {
    try {
      /* Due domande diverse, e servono tutte e due: `isDeviceSupported` dice
       * se il telefono ha una guardia — anche solo il codice di sblocco — e
       * `getAvailableBiometrics` dice cosa c'e' registrato adesso. Un telefono
       * col lettore ma senza impronte registrate risponde si' alla prima e
       * niente alla seconda, ed e' esattamente il caso in cui si puo' mettere
       * il lucchetto ma non si puo' offrire l'impronta. */
      final ceUnaGuardia = await _sistema.isDeviceSupported();
      if (!ceUnaGuardia) return CosaSaFareIlTelefono.niente;
      final quali = await _sistema.getAvailableBiometrics();
      return CosaSaFareIlTelefono(
        sa: {
          if (quali.contains(BiometricType.face) ||
              quali.contains(BiometricType.strong))
            ComeRiconosce.volto,
          if (quali.contains(BiometricType.fingerprint) ||
              quali.contains(BiometricType.strong))
            ComeRiconosce.impronta,
        },
        ceUnaGuardiaDelSistema: true,
      );
    } catch (_) {
      /* Tutto, e non solo `PlatformException`: dove il pezzo di sistema non e'
       * registrato — una build vecchia, una piattaforma senza — quello che
       * arriva e' una `MissingPluginException`, che non e' una
       * `PlatformException` e passava di qui senza essere presa. Una guardia
       * che solleva all'avvio porta giu' l'app **prima** che si apra: e' il
       * guasto peggiore che questo file possa fare, ed e' l'opposto di quello
       * per cui esiste.
       *
       * Un sistema che non risponde vale come un telefono che non sa farlo: il
       * lucchetto non si mette, e l'app si apre. */
      return CosaSaFareIlTelefono.niente;
    }
  }

  @override
  Future<ComeEAndata> chiedi({required String perche}) async {
    try {
      final passato = await _sistema.authenticate(
        localizedReason: perche,
        options: const AuthenticationOptions(
          /* Il codice del telefono va bene: e' la strada di chi ha il volto
           * sporco di farina, e senza sarebbe un'app che non si apre fino a
           * che non ci si lava le mani. */
          biometricOnly: false,
          /* La finestra resta li' mentre il telefono va in tasca e torna:
           * senza, ogni passaggio in background e' un tentativo fallito. */
          stickyAuth: true,
        ),
      );
      return passato ? ComeEAndata.si : ComeEAndata.no;
    } on PlatformException catch (colpa) {
      /* I tre casi in cui non e' un «no» da riprovare: il telefono non ce
       * l'ha, non e' registrato niente, o non c'e' nemmeno un codice di
       * sblocco. Riproporre «Riprova» li' vorrebbe dire un tasto che non
       * portera' mai da nessuna parte. */
      if (colpa.code == male.notAvailable ||
          colpa.code == male.notEnrolled ||
          colpa.code == male.passcodeNotSet) {
        return ComeEAndata.nonSaFarlo;
      }
      return ComeEAndata.no;
    } catch (_) {
      /* E il pezzo di sistema che non c'e': non e' un no, e' un telefono che
       * non sa farlo. Vedi sopra. */
      return ComeEAndata.nonSaFarlo;
    }
  }
}

/// Le parole che il sistema scrive nella sua finestra.
///
/// Una per momento, e dicono **cosa sta per succedere**: «autenticati» non
/// dice niente a nessuno, e chi lo legge non sa se sta per aprire l'app o per
/// cancellare una casa.
String perche(PrimaDi? quale) => switch (quale) {
  null => inLingua(it: 'Per aprire gdahome', en: 'To open gdahome'),
  PrimaDi.ilCruscotto => inLingua(
    it: 'Per aprire il cruscotto degli impianti',
    en: 'To open the fleet dashboard',
  ),
  PrimaDi.iComandi => inLingua(
    it: 'Per comandare questo dispositivo',
    en: 'To control this device',
  ),
  PrimaDi.togliereUnaCasa => inLingua(
    it: 'Per togliere questa casa dall\'app',
    en: 'To remove this home from the app',
  ),
};

/// Una guardia che non c'e': nel browser, e dove `local_auth` non arriva.
///
/// Dice «non so fare niente», e con quella risposta il lucchetto non si mette
/// e l'app si apre com'e' sempre stata.
class NessunaGuardia implements LaGuardia {
  const NessunaGuardia();

  @override
  Future<CosaSaFareIlTelefono> cosaSaFare() async =>
      CosaSaFareIlTelefono.niente;

  @override
  Future<ComeEAndata> chiedi({required String perche}) async =>
      ComeEAndata.nonSaFarlo;
}
