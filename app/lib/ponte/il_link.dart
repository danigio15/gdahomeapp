/// I link che aprono l'app: `gdahome://collega?invito=…`.
///
/// ## Perche' un link, se c'e' il QR code
///
/// Perche' chi guarda la console di GdAHome lo fa spesso **dallo stesso
/// telefono** che vuole collegare: l'app di Home Assistant aperta li', e il
/// QR a schermo. Un telefono non puo' inquadrare il proprio schermo. Le
/// sedici lettere sotto il QR si copiano e si incollano, ma vanno portate a
/// mano da un'app all'altra; il bottone «Apri GdAHome su questo telefono»
/// della console le porta lui, dentro questo link.
///
/// Dentro c'e' l'invito, e nient'altro: la stessa riga del QR code
/// (`invito.dart`), scritta con `encodeURIComponent`. Niente nomi, niente
/// utenti: quello che il link sa, lo sapeva gia' il QR a schermo.
///
/// ## Un link puo' arrivare da chiunque
///
/// Un QR lo inquadra chi tiene il telefono in mano, davanti alla console. Un
/// link no: lo puo' aprire una pagina qualunque, un messaggio, un'altra app.
/// Per questo un link non abbina **mai** da solo: apre il foglio «Collegare
/// questa casa?» (`schermate/collega_dal_link.dart`), e si abbina solo dopo il
/// si' di chi guarda.
library;

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

import '../parole.dart';
import 'invito.dart';

/// Lo schema dei link dell'app: lo stesso nome che apre ogni invito.
const String schemaDeiLink = 'gdahome';

/// Il link che collega una casa: `gdahome://collega?invito=…`.
const String linkDelCollega = 'collega';

/// Il ritorno dal consenso di WHOOP: `gdahome://whoop?code=…&state=…`
/// (`salute/whoop/collegamento_whoop.dart`).
const String linkDiWhoop = 'whoop';

/// Quello che c'era dentro un link.
sealed class LinkLetto {
  const LinkLetto();
}

/// Un invito buono: si chiede se collegare la casa.
final class InvitoDalLink extends LinkLetto {
  const InvitoDalLink(this.invito);
  final Invito invito;
}

/// Il ritorno da WHOOP: lo controlla e lo usa il collegamento WHOOP, che
/// sa se l'aveva chiesto lui (lo `state`). Qui non si guarda dentro.
final class RitornoDaWhoop extends LinkLetto {
  const RitornoDaWhoop(this.link);
  final Uri link;
}

/// Un link nostro, ma che non si legge: lo si dice, e non si fa niente.
final class LinkIllegibile extends LinkLetto {
  const LinkIllegibile(this.spiegazione);
  final String spiegazione;
}

/// Legge un link arrivato all'app.
///
/// `null` quando il link non e' nostro — un altro schema, l'indirizzo della
/// pagina nella versione web — e allora non si dice niente a nessuno: non era
/// per noi.
LinkLetto? leggiIlLink(Uri link) {
  if (link.scheme.toLowerCase() != schemaDeiLink) return null;

  if (link.host.toLowerCase() == linkDiWhoop) return RitornoDaWhoop(link);

  if (link.host.toLowerCase() != linkDelCollega) {
    return LinkIllegibile(
      inLingua(
        it:
            'Questo link di GdAHome non apre niente in questa versione '
            'dell\'app.',
        en:
            'This GdAHome link doesn\'t open anything in this version of the '
            'app.',
      ),
    );
  }

  /* `queryParameters` decodifica, e su un `%` rotto solleva: un link storto
   * e' un link illegibile, non un'app che cade. */
  String? scritto;
  try {
    scritto = link.queryParameters['invito'];
  } on FormatException {
    scritto = null;
  }
  if (scritto == null || scritto.trim().isEmpty) {
    return LinkIllegibile(
      inLingua(
        it:
            'Questo link non porta nessun invito: genera un QR nuovo nella '
            'console di GdAHome e riprova.',
        en:
            'This link carries no invitation: generate a new QR code in the '
            'GdAHome console and try again.',
      ),
    );
  }

  try {
    return InvitoDalLink(Invito.leggi(scritto));
  } on InvitoIllegibile catch (errore) {
    return LinkIllegibile(errore.spiegazione);
  } on InvitoTroppoNuovo catch (errore) {
    return LinkIllegibile(errore.spiegazione);
  }
}

/// I link che il telefono passa all'app: quello con cui si e' aperta, e quelli
/// che arrivano dopo, ad app aperta.
///
/// `app_links` li da' tutti nello stesso flusso, il primo compreso. Nella
/// versione web niente: li' il «link» e' l'indirizzo della pagina, e non
/// porta inviti.
Stream<Uri> linkDelTelefono() =>
    kIsWeb ? const Stream<Uri>.empty() : AppLinks().uriLinkStream;
