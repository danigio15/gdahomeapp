/// Il navigatore sul telefono: gdanav, dentro l'app.
///
/// gdanav e' un'app sua — la mappa, la guida, le colonnine, la batteria
/// dell'auto — e qui entra intera, dal suo pacchetto, senza rifarla. Si
/// accende **la prima volta che si apre la sezione**, non all'avvio: chi usa
/// gdahome solo per la casa non accende il GPS, non legge le colonnine e non
/// scarica niente. Da li' in poi resta acceso finche' l'app e' viva, come le
/// altre sezioni: si torna alla plancia e la guida continua a parlare.
library;

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:gdanav_app/gdanav_app.dart';

import '../../parole.dart';
import '../../vestito/pezzi.dart';

/// Il portachiavi di gdanav: un altro scomparto da quello della casa.
///
/// Dentro ci sono l'abbinamento di gdanav col suo Home Assistant, l'auto
/// scelta, i luoghi. Nello stesso scomparto dei segni della casa le chiavi di
/// due app si pesterebbero i piedi, e cancellare l'una potrebbe portarsi via
/// l'altra.
const _portachiavi = FlutterSecureStorage(
  aOptions: AndroidOptions(storageNamespace: 'gdanav'),
  iOptions: IOSOptions(
    accountName: 'gdanav',
    accessibility: KeychainAccessibility.first_unlock_this_device,
  ),
);

/* Uno per tutta l'app, e non uno per schermata: la guida, la posizione e le
 * segnalazioni sono cose che stanno accese, e due copie parlerebbero in due. */
Future<GdanavApp>? _acceso;

class IlNavigatore extends StatefulWidget {
  const IlNavigatore({
    super.key,
    required this.visibile,
    required this.navigatore,
  });

  /// Se la sezione e' quella aperta: finche' non lo e' mai stata, gdanav
  /// resta spento.
  final bool visibile;

  /// Il navigatore di gdanav: la home lo guarda per il tasto Indietro, che
  /// chiude prima le schermate di gdanav e poi il resto.
  final GlobalKey<NavigatorState> navigatore;

  @override
  State<IlNavigatore> createState() => _IlNavigatoreState();
}

class _IlNavigatoreState extends State<IlNavigatore> {
  @override
  Widget build(BuildContext context) {
    if (!widget.visibile && _acceso == null) return const SizedBox.shrink();
    final acceso = _acceso ??= preparaGdanav(
      portachiavi: _portachiavi,
      /* Android Auto e' di gdahome: in macchina si vede la casa. Lo schermo
       * dell'auto di gdanav resta nell'app gdanav. */
      conLAuto: false,
    );
    return FutureBuilder<GdanavApp>(
      future: acceso,
      builder: (context, stato) {
        if (stato.hasError) {
          return StatoVuoto(
            icona: Icons.wrong_location_rounded,
            titolo: inLingua(
              it: 'Il navigatore non si è acceso',
              en: 'The navigator didn\'t start',
            ),
            sotto: '${stato.error}',
            /* Si riprova da capo: quello che non si e' acceso non resta
             * appeso. */
            azione: FilledButton.icon(
              onPressed: () => setState(() => _acceso = null),
              icon: const Icon(Icons.refresh_rounded),
              label: Text(inLingua(it: 'Riprova', en: 'Try again')),
            ),
          );
        }
        final app = stato.data;
        if (app == null) {
          return const Center(child: CircularProgressIndicator());
        }
        return GdanavDentro(app: app, navigatore: widget.navigatore);
      },
    );
  }
}
