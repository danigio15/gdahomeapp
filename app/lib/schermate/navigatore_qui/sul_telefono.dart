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

import '../../casa/collegamento.dart';
import '../../parole.dart';
import '../../vestito/pezzi.dart';
import '../comandi_in_auto.dart';
import 'la_vettura.dart';

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

/// La fonte «gdahome» di gdanav: l'auto della sezione Auto della plancia,
/// coi dati in tempo reale dalla casa. Una sola, come gdanav; la riempie
/// `IlFiloDellaVettura`, finche' la home c'e' (`la_vettura.dart`).
final _vettura = SorgenteGdahome();

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
    gdahome: _vettura,
    /* Niente Premium nell'app unita: tutto sbloccato, niente negozio. I
     * pagamenti si decidono prima del rilascio. */
    senzaPremium: true,
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
    this.collegamento,
    this.menuOspite,
    this.apriIlMenu,
  });

  /// Il menu di gdahome: lo apre il tasto in alto a sinistra di gdanav, come
  /// i tre trattini della plancia.
  final VoidCallback? menuOspite;

  /// Per aprire le impostazioni di gdanav da fuori (la tessera della barra).
  final ValueNotifier<bool>? apriIlMenu;

  /// La casa di adesso: da li' l'auto della plancia arriva a gdanav, anche
  /// con la sezione chiusa (e gdanav la trova pronta quando si accende).
  final Collegamento? collegamento;

  /// Se la sezione e' quella aperta: finche' non lo e' mai stata, gdanav
  /// resta spento.
  final bool visibile;

  /// Il navigatore di gdanav: la home lo guarda per il tasto Indietro, che
  /// chiude prima le schermate di gdanav e poi il resto.
  final GlobalKey<NavigatorState> navigatore;

  @override
  State<IlNavigatore> createState() => _IlNavigatoreState();
}

class _IlNavigatoreState extends State<IlNavigatore>
    with WidgetsBindingObserver {
  IlFiloDellaVettura? _filo;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _seguiLaCasa();
  }

  @override
  void didUpdateWidget(IlNavigatore prima) {
    super.didUpdateWidget(prima);
    /* Un'altra casa, un'altra plancia, forse un'altra auto. */
    if (prima.collegamento != widget.collegamento) {
      _seguiLaCasa();
    } else if (widget.visibile && !prima.visibile) {
      /* Si apre il navigatore: l'auto dev'essere quella di adesso. */
      unawaited(_filo?.rileggi());
    }
  }

  /* Si torna nell'app: l'auto puo' essere cambiata altrove intanto. */
  @override
  void didChangeAppLifecycleState(AppLifecycleState stato) {
    if (stato == AppLifecycleState.resumed) unawaited(_filo?.rileggi());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _filo?.ferma();
    super.dispose();
  }

  void _seguiLaCasa() {
    _filo?.ferma();
    _filo = switch (widget.collegamento) {
      final c? => IlFiloDellaVettura(c, _vettura)..avvia(),
      null => null,
    };
  }

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
        return GdanavDentro(
          app: app,
          navigatore: widget.navigatore,
          menuOspite: widget.menuOspite,
          apriIlMenu: widget.apriIlMenu,
          /* I comandi di casa per l'auto si scelgono dal menu del
           * navigatore: e' li' che si pensa all'auto. La schermata e' di
           * gdahome, col suo vestito, sopra tutto. */
          vociOspite: [
            VoceOspite(
              icona: Icons.bolt_rounded,
              titolo: inLingua(
                it: 'Comandi rapidi in auto',
                en: 'Quick commands in car',
              ),
              sotto: inLingua(
                it: 'Il tasto con la casa, sulla mappa in auto',
                en: 'The home button on the car map',
              ),
              apri: () => Navigator.of(context, rootNavigator: true).push(
                MaterialPageRoute<void>(
                  builder: (_) =>
                      ComandiInAuto(collegamento: widget.collegamento),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Porta a Casa (o al Lavoro), dalla tessera della barra: accende gdanav se
/// non c'e', e se il posto e' stato scelto calcola il viaggio. Se non e'
/// stato scelto, basta aprire il navigatore: li' lo si imposta.
Future<void> portamiA({required bool casa}) async {
  final app = await accendiIlNavigatore();
  final luoghi = app.luoghi;
  final dove = casa ? luoghi?.casa : luoghi?.lavoro;
  if (dove == null) return;
  await luoghi?.usato(dove.luogo);
  await app.viaggio.vaiA(dove.luogo);
}

/// La tessera di gdanav in testa alla barra di gdahome: viva.
///
/// Dice l'auto della plancia — batteria, nome, autonomia — coi dati che la
/// casa manda in tempo reale, e ha i due viaggi di tutti i giorni a un tocco.
/// Toccata apre il navigatore; il tasto a destra apre le sue impostazioni.
///
/// [fonte] e' per le fotografie e le prove: di solito e' la fonte gdahome
/// dell'app, quella che riempie `IlFiloDellaVettura`.
Widget? laTesseraDelNavigatore({
  required bool scelta,
  required VoidCallback apri,
  required VoidCallback impostazioni,
  SorgenteGdahome? fonte,
}) => _LaTessera(
  scelta: scelta,
  apri: apri,
  impostazioni: impostazioni,
  fonte: fonte ?? _vettura,
);

class _LaTessera extends StatelessWidget {
  const _LaTessera({
    required this.scelta,
    required this.apri,
    required this.impostazioni,
    required this.fonte,
  });

  final bool scelta;
  final VoidCallback apri;
  final VoidCallback impostazioni;
  final SorgenteGdahome fonte;

  static const _notte = Color(0xFF0F172A);
  static const _accento = Color(0xFF0EA5E9);
  static const _verde = Color(0xFF4ADE80);

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: fonte,
      builder: (context, _) {
        final auto = fonte.auto;
        final ultima = fonte.ultima;
        final km = ultima?.autonomiaKm;
        final sotto = auto == null
            ? inLingua(it: 'Tocca per navigare', en: 'Tap to navigate')
            : [auto.etichetta, if (km != null) '${km.round()} km'].join(' · ');
        return Padding(
          padding: const EdgeInsets.fromLTRB(10, 8, 10, 2),
          child: Material(
            color: _notte,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: scelta
                  ? const BorderSide(color: _accento, width: 2.5)
                  : BorderSide.none,
            ),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: apri,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            color: _accento,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            Icons.navigation_rounded,
                            size: 18,
                            color: _notte,
                          ),
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text(
                            'GDANAV',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1,
                            ),
                          ),
                        ),
                        IconButton(
                          tooltip: inLingua(
                            it: 'Impostazioni del navigatore',
                            en: 'Navigator settings',
                          ),
                          onPressed: impostazioni,
                          style: IconButton.styleFrom(
                            backgroundColor: Colors.white.withValues(
                              alpha: 0.1,
                            ),
                            minimumSize: const Size(34, 34),
                            fixedSize: const Size(34, 34),
                            padding: EdgeInsets.zero,
                          ),
                          icon: const Icon(
                            Icons.tune_rounded,
                            size: 18,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (ultima != null) ...[
                          Text(
                            '${ultima.batteria.round()}%',
                            style: const TextStyle(
                              fontFamily: 'Oswald',
                              fontSize: 28,
                              height: 1,
                              fontWeight: FontWeight.w700,
                              color: _verde,
                            ),
                          ),
                          const SizedBox(width: 8),
                        ],
                        Expanded(
                          child: Text(
                            sotto,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: _Viaggio(
                            icona: Icons.home_rounded,
                            testo: inLingua(it: 'A casa', en: 'Home'),
                            quando: () {
                              apri();
                              unawaited(portamiA(casa: true));
                            },
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: _Viaggio(
                            icona: Icons.work_rounded,
                            testo: inLingua(it: 'Al lavoro', en: 'Work'),
                            quando: () {
                              apri();
                              unawaited(portamiA(casa: false));
                            },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Viaggio extends StatelessWidget {
  const _Viaggio({
    required this.icona,
    required this.testo,
    required this.quando,
  });

  final IconData icona;
  final String testo;
  final VoidCallback quando;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: quando,
        child: SizedBox(
          height: 32,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icona, size: 14, color: Colors.white),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  testo,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
