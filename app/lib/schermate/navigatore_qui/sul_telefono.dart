/// Il navigatore sul telefono: gdanav, dentro l'app.
///
/// gdanav e' un'app sua — la mappa, la guida, le colonnine, la batteria
/// dell'auto — e qui entra intera, dal suo pacchetto, senza rifarla. Si
/// accende **la prima volta che si apre la sezione**, non all'avvio: chi usa
/// gdahome solo per la casa non accende il GPS, non legge le colonnine e non
/// scarica niente. Da li' in poi resta acceso finche' l'app e' viva, come le
/// altre sezioni: si torna alla plancia e la guida continua a parlare.
///
/// In auto, nella gdahome di sempre, c'e' la casa. Nella versione col
/// navigatore in auto (`GDAHOME_NAVIGATORE=si`, da provare nel test interno
/// di gdanav) c'e' prima gdanav, e la casa sta dietro un tasto: li' gdanav
/// si accende anche salendo in macchina, senza aprire la sezione.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

/// Il filo col servizio dell'auto, nella versione col navigatore in auto
/// (`android/app/src/main/kotlin/.../auto/IlNavigatoreInAuto.kt`).
const _auto = MethodChannel('gdahome/navigatore');

/* Se lo schermo dell'auto e' quello di gdanav. Nella gdahome di sempre il
 * filo dall'altra parte non c'e' (`MissingPluginException`), e gdanav non
 * parla all'auto: in macchina c'e' la casa. */
Future<bool> _conLAuto = Future.value(false);

/// Accende gdanav, una volta sola per tutta l'app: dalla sezione del
/// telefono o dall'auto, chi arriva prima.
Future<GdanavApp> accendiIlNavigatore() => _acceso ??= () async {
  return preparaGdanav(
    portachiavi: _portachiavi,
    /* Lo schermo dell'auto di gdanav si accende solo nella versione col
     * navigatore in auto; nella gdahome di sempre Android Auto e' la casa. */
    conLAuto: await _conLAuto,
  );
}();

/// Si mette in ascolto dell'auto: la chiama `main`, sul telefono.
///
/// Salendo in macchina il servizio dell'auto chiede di accendere gdanav anche
/// se sul telefono la sezione non si e' mai aperta; e se la macchina e'
/// arrivata prima che il Dart fosse pronto a sentirlo, glielo si domanda qui.
void ascoltaLAuto() {
  _auto.setMethodCallHandler((chiamata) async {
    if (chiamata.method == 'accendi') unawaited(accendiIlNavigatore());
  });
  _conLAuto = () async {
    try {
      final come = await _auto.invokeMapMethod<String, Object?>('comeSta');
      if (come?['inAuto'] == true) {
        scheduleMicrotask(() => unawaited(accendiIlNavigatore()));
      }
      return true;
    } on MissingPluginException {
      return false;
    } catch (_) {
      return false;
    }
  }();
}

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
    final acceso = accendiIlNavigatore();
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
