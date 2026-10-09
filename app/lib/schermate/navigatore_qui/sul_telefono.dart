/// Il navigatore sul telefono: gdanav, dentro l'app.
///
/// gdanav e' un'app sua — la mappa, la guida, le colonnine, la batteria
/// dell'auto — e qui entra intera, dal suo pacchetto, senza rifarla. Si
/// accende **la prima volta che si apre la sezione**, non all'avvio: chi usa
/// gdahome solo per la casa non accende il GPS, non legge le colonnine e non
/// scarica niente. Da li' in poi resta acceso finche' l'app e' viva, come le
/// altre sezioni: si torna alla plancia e la guida continua a parlare.
///
/// In auto c'e' prima gdanav, e la casa sta dietro un tasto: gdanav si
/// accende anche salendo in macchina, senza aprire la sezione. Solo la
/// gdahome costruita con `GDAHOME_NAVIGATORE=no` ha in auto la casa e basta.
library;

import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:gdanav_app/gdanav_app.dart';

import '../../casa/collegamento.dart';
import '../../licenza/licenza.dart' show GestoreLicenza, licenzeInQuestaApp;
import '../../parole.dart';
import '../../vestito/marchio.dart';
import '../../vestito/pezzi.dart';
import '../../vestito/tema.dart';
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

/// Le persone della plancia sulla mappa di gdanav: le riempie lo stesso filo
/// dell'auto (`le_persone.dart`).
final _persone = GestorePersone();

/// gdanav Premium dentro gdahome: e' compreso in gdahome Premium, e segue la
/// casa in uso (`docs/LICENZE.md`). Lo tiene aggiornato [IlNavigatore], dalla
/// licenza del collegamento; finche' non c'e', vale quello che si sa senza
/// chiedere: dove le licenze non contano — la chiave vuota, o prima
/// dell'iPhone un telefono che non e' un iPhone — tutto e' aperto.
final _premiumOspite = ValueNotifier<bool>(!licenzeInQuestaApp);

/// In auto si guida anche senza Premium, finche' non c'e' una casa abbinata.
///
/// «Se la casa non e' associata ancora non puo' avviarsi il navigatore
/// direttamente su Android Auto.» La navigazione in auto e' di Premium, e
/// Premium e' di una casa: senza casa nessuno lo era, e in macchina restava
/// la pagina «gdahome Premium» al posto della mappa. Adesso il navigatore
/// parte base; da quando c'e' una casa segue il suo abbonamento. Gli extra di
/// Premium restano di Premium ([_premiumOspite]).
///
/// Vale solo quando le case si sono lette e non ce n'e' nessuna: prima di
/// leggerle «nessuna casa» vuol dire «non lo so ancora».
final _guidaSenzaCasa = ValueNotifier<bool>(false);

/// Per le prove: [_guidaSenzaCasa], e chi segue la casa.
@visibleForTesting
ValueListenable<bool> get guidaInAutoSenzaCasa => _guidaSenzaCasa;

@visibleForTesting
void seguiLaCasaPerLaProva(Object chi, Collegamento? casa) =>
    _seguiLaCasa(chi, casa);

@visibleForTesting
void lasciaLaCasaPerLaProva(Object chi) => _lasciaLaCasa(chi);

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

/// Se **adesso** si e' in macchina, con lo schermo dell'auto acceso.
///
/// Serve a una cosa sola, e non e' una cosa da poco: finche' si e' in
/// macchina il filo con la casa **non va a riposo**.
///
/// Dal campo, con la foto dello schermo dell'auto: «i dati batteria non si
/// aggiornano fino a che non apro app dal cellulare». Era vero. La batteria
/// che gdanav mostra in macchina la prende dalla sezione Auto della plancia
/// (`la_vettura.dart`), e quella la riempie il filo con la casa. Il filo
/// pero' si chiude da solo quando l'app non si guarda piu' — e' un risparmio
/// di richieste al centralino, e ha senso col telefono in tasca a casa. In
/// macchina il telefono e' in tasca **apposta**, e quello che si guarda e' lo
/// schermo dell'auto: chiudere li' vuol dire spegnere proprio il dato che si
/// sta guardando.
///
/// Si spegne quando si scende (`IlNavigatoreInAuto.sceso`), e da li' il filo
/// torna a riposare come sempre.
final inMacchina = ValueNotifier<bool>(false);

/* Il filo che tiene [_vettura] al passo con la casa, e il Premium della casa
 * per gdanav: uno per tutta l'app, come la fonte che riempie.
 *
 * Prima li teneva la schermata del navigatore, e in macchina quella
 * schermata puo' non esserci: Android Auto tiene su il processo dell'app, non
 * la parte che disegna. Dal campo: «se non si apre l'app … non legge i dati
 * auto». Adesso li chiedono in due — la schermata e l'auto — e restano accesi
 * finche' almeno uno dei due li vuole. */
IlFiloDellaVettura? _filoDellaVettura;
final _chiLaSegue = <Object>{};
ValueListenable<bool>? _premiumDellaCasa;

void _copiaIlPremium() {
  final premium = _premiumDellaCasa;
  if (premium != null) _premiumOspite.value = premium.value;
  final casa = _filoDellaVettura?.collegamento;
  if (casa != null) {
    _guidaSenzaCasa.value =
        casa.licenza.conosciute && casa.archivio.tutte.isEmpty;
  }
}

GestoreLicenza? _licenzaSeguita;

/// [chi] segue [casa]: l'auto della sua plancia va a gdanav, e il suo
/// Premium pure. Senza una casa, e' come lasciarla.
void _seguiLaCasa(Object chi, Collegamento? casa) {
  if (casa == null) {
    _lasciaLaCasa(chi);
    return;
  }
  _chiLaSegue.add(chi);
  if (identical(_filoDellaVettura?.collegamento, casa)) return;
  _premiumDellaCasa?.removeListener(_copiaIlPremium);
  _premiumDellaCasa = casa.licenza.premiumQui..addListener(_copiaIlPremium);
  /* Anche la licenza intera: una casa abbinata adesso non cambia Premium
   * (resta no finche' la casa non lo dice), ma cambia [_guidaSenzaCasa]. */
  _licenzaSeguita?.removeListener(_copiaIlPremium);
  _licenzaSeguita = casa.licenza..addListener(_copiaIlPremium);
  _filoDellaVettura?.ferma();
  _filoDellaVettura = IlFiloDellaVettura(casa, _vettura, persone: _persone)
    ..avvia();
  _copiaIlPremium();
  _proponiIComandiQuandoRisponde(casa);
}

/* I comandi rapidi per l'auto, la prima volta: appena la casa risponde
 * (`proponiIComandiSeMancano`). Una volta per casa seguita. */
StreamSubscription<void>? _attesaDeiComandi;

void _proponiIComandiQuandoRisponde(Collegamento casa) {
  unawaited(_attesaDeiComandi?.cancel());
  _attesaDeiComandi = null;
  var fatto = false;
  Future<void> prova() async {
    if (fatto || !casa.dentro) return;
    fatto = true;
    unawaited(_attesaDeiComandi?.cancel());
    _attesaDeiComandi = null;
    try {
      await proponiIComandiSeMancano(casa);
    } catch (_) {
      /* Si riprova la prossima volta che si sale in macchina. */
    }
  }

  _attesaDeiComandi = casa.cambiamenti.listen((_) => unawaited(prova()));
  unawaited(prova());
}

/// [chi] non la segue piu': se era l'ultimo, il filo si ferma.
void _lasciaLaCasa(Object chi) {
  if (!_chiLaSegue.remove(chi) || _chiLaSegue.isNotEmpty) return;
  unawaited(_attesaDeiComandi?.cancel());
  _attesaDeiComandi = null;
  _premiumDellaCasa?.removeListener(_copiaIlPremium);
  _premiumDellaCasa = null;
  _licenzaSeguita?.removeListener(_copiaIlPremium);
  _licenzaSeguita = null;
  _filoDellaVettura?.ferma();
  _filoDellaVettura = null;
}

/// Chi segue la casa per conto dell'auto, quando la schermata non c'e'.
const _perLAuto = #auto;

/// Accende gdanav, una volta sola per tutta l'app: dalla sezione del
/// telefono o dall'auto, chi arriva prima.
Future<GdanavApp> accendiIlNavigatore() => _acceso ??= () async {
  return preparaGdanav(
    portachiavi: _portachiavi,
    gdahome: _vettura,
    persone: _persone,
    /* gdanav Premium lo decide gdahome: la casa in uso e' Premium, e gdanav
     * con lei. Niente negozio di gdanav qui dentro: se manca, gdanav dice di
     * prenderlo in gdahome. */
    premiumOspite: _premiumOspite,
    guidaInAutoSenzaPremium: _guidaSenzaCasa,
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
///
/// [apriIlFilo] apre il filo con la casa. E' la cosa che mancava: il filo lo
/// apriva la schermata, e in macchina quella schermata puo' non esserci —
/// Android Auto tiene su il processo dell'app, non la parte che disegna. Da
/// li' i dati dell'auto arrivavano solo aprendo l'app a mano. Lo chiama
/// `main` passando `apriIlFiloConLaCasa`; nelle prove non lo passa nessuno e
/// non succede niente.
///
/// [laCasa] e' la casa da cui gdanav prende l'auto della plancia: aprire il
/// filo non bastava, perche' a leggere l'auto dal filo era ancora la
/// schermata. Adesso la segue anche l'auto, finche' si e' in macchina.
void ascoltaLAuto({
  Future<void> Function()? apriIlFilo,
  Collegamento Function()? laCasa,
}) {
  void inMacchinaAdesso() {
    inMacchina.value = true;
    if (apriIlFilo != null) unawaited(apriIlFilo());
    if (laCasa != null) _seguiLaCasa(_perLAuto, laCasa());
  }

  _auto.setMethodCallHandler((chiamata) async {
    switch (chiamata.method) {
      case 'accendi':
        inMacchinaAdesso();
        unawaited(accendiIlNavigatore());
      case 'sceso':
        inMacchina.value = false;
        _lasciaLaCasa(_perLAuto);
    }
  });
  _conLAuto = () async {
    try {
      final come = await _auto.invokeMapMethod<String, Object?>('comeSta');
      if (come?['inAuto'] == true) {
        inMacchinaAdesso();
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
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _seguiLaCasa(this, widget.collegamento);
  }

  @override
  void didUpdateWidget(IlNavigatore prima) {
    super.didUpdateWidget(prima);
    /* Un'altra casa, un'altra plancia, forse un'altra auto. */
    if (prima.collegamento != widget.collegamento) {
      _seguiLaCasa(this, widget.collegamento);
    } else if (widget.visibile && !prima.visibile) {
      /* Si apre il navigatore: l'auto dev'essere quella di adesso. */
      unawaited(_filoDellaVettura?.rileggi());
    }
  }

  /* Si torna nell'app: l'auto puo' essere cambiata altrove intanto. */
  @override
  void didChangeAppLifecycleState(AppLifecycleState stato) {
    if (stato == AppLifecycleState.resumed) {
      unawaited(_filoDellaVettura?.rileggi());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _lasciaLaCasa(this);
    super.dispose();
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
          /* Accanto al ☰ di gdanav (il suo menu), il marchio di gdahome
           * apre la barra dell'app. */
          menuOspite: widget.menuOspite,
          iconaOspite: const Marchio(lato: 34),
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
                it: 'Crea e scegli i tasti di casa da usare in auto',
                en: 'Create and pick home buttons for the car',
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

/// Mostra una persona della plancia: «Apri in mappa» sulla sua scheda.
///
/// [detto] e' quello che manda la pagina sul canale `gdahomeNavigatore`
/// (`ponte/plancia/src/core/la-persona-nel-navigatore.js`): `{id, nome, lat,
/// lon, indirizzo}` in JSON. Accende gdanav se non c'e' e porta la mappa
/// sulla persona, **senza** calcolare il viaggio: «non deve calcolare il
/// percorso ma deve mostrare dove e' presente sulla mappa». La strada, se
/// serve, la si chiede toccando il suo segnaposto. Torna `false` se il
/// messaggio non porta un punto: allora non c'e' niente da aprire.
Future<bool> portamiDallaPersona(String detto) async {
  final Object? letto;
  try {
    letto = jsonDecode(detto);
  } catch (_) {
    return false;
  }
  if (letto is! Map) return false;
  final lat = letto['lat'];
  final lon = letto['lon'];
  if (lat is! num || lon is! num) return false;
  final nome = '${letto['nome'] ?? ''}'.trim();
  final id = '${letto['id'] ?? ''}'.trim();
  final persona = PersonaSullaMappa(
    id: id.isNotEmpty ? id : nome,
    nome: nome.isEmpty ? inLingua(it: 'Persona', en: 'Person') : nome,
    posizione: Punto(lat.toDouble(), lon.toDouble()),
    dove: '${letto['indirizzo'] ?? ''}'.trim(),
  );
  await accendiIlNavigatore();
  _persone.mostra(persona);
  return true;
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

  /* Il blu di gdanav, e non piu' il celeste scritto a mano: questa tessera e'
   * la porta verso gdanav, ed e' l'ultimo posto che poteva permettersi di
   * essere di un altro azzurro. */
  static const _accento = Colori.bluDiNotte;
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
            color: Colors.transparent,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: scelta
                  ? const BorderSide(color: _accento, width: 2.5)
                  : BorderSide(color: Colors.white.withValues(alpha: 0.10)),
            ),
            clipBehavior: Clip.antiAlias,
            /* Un fondo suo, dal blu della notte a quello del logo: sulla
             * barra chiara salta all'occhio, e su quella scura non ci si
             * confonde. */
            child: Ink(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF1E3A5F), _notte],
                ),
              ),
              child: InkWell(
                onTap: apri,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          /* Il logo di gdanav, quello dell'icona dell'app:
                         * e' lui, e si riconosce da lontano. */
                          ClipRRect(
                            borderRadius: BorderRadius.circular(9),
                            child: Image.asset(
                              logoGdanav,
                              width: 34,
                              height: 34,
                              fit: BoxFit.cover,
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
