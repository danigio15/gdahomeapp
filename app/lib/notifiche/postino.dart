/// Il postino: chi riceve le notifiche sul telefono, e chi le mostra.
///
/// ## Il viaggio di una notifica
///
/// ```
///  la casa ──busta──► centralino ──► Firebase ──► questo telefono
///                                                  │
///             Android: arriva solo la busta ───────┤ (anche ad app chiusa:
///             la apre [quandoArrivaDaChiusa],      │  Android sveglia un
///             e la mostra come notifica locale     │  servizio Dart)
///                                                  │
///             iPhone: arriva «gdahome: nuova ──────┘
///             notifica»; la busta si apre quando
///             la si tocca, e l'app mostra cosa c'era
/// ```
///
/// Sull'iPhone il testo vero si potrebbe mostrare subito solo con
/// un'estensione nativa (Notification Service Extension) che apra la busta
/// prima che il sistema la mostri: e' scritto in `docs/NOTIFICHE.md` perche'
/// oggi non c'e'.
///
/// ## Il permesso
///
/// Non si chiede all'avvio a freddo. Si chiede dopo aver detto perche'
/// ([chiediConUnaSpiegazione]), la prima volta che si entra in una casa o
/// quando si accende l'interruttore nella pagina «Notifiche».
///
/// ## Il gettone
///
/// Firebase da' a questo telefono un gettone, e lo cambia quando vuole. Si
/// dice a ogni casa sul suo filo — cifrato, col segno del telefono — appena ci
/// si entra, e di nuovo quando cambia.
library;

import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../casa/archivio_delle_case.dart';
import '../casa/cassaforte.dart';
import '../casa/collegamento.dart';
import '../parole.dart';
import 'chiavi_per_l_iphone.dart';
import 'consegna.dart';
import 'firebase_qui.dart';
import 'modello.dart';
import 'notifiche.dart';

/// Quello che si legge quando la busta non si apre: la stessa frase che vede
/// Apple, e che non dice niente a nessuno.
String get fraseDiRiserva =>
    inLingua(it: 'gdahome: nuova notifica', en: 'gdahome: new notification');

final FlutterLocalNotificationsPlugin _locali =
    FlutterLocalNotificationsPlugin();

/// La categoria dell'iPhone per le notifiche coi tasti: i tasti li porta la
/// notifica, e su iOS una categoria ne dichiara al piu' quattro con nomi
/// fissi. Si dichiara una categoria per ogni combinazione che la casa manda.
const _categorieDellIphone = <String, List<(String, String, String)>>{
  'gdahome_guarda': [('guarda', 'Guarda', 'View')],
  'gdahome_spegni': [
    ('spegni', 'Spegni', 'Turn off'),
    ('piu-tardi', 'Più tardi', 'Later'),
  ],
  'gdahome_inserisci': [
    ('inserisci', 'Inserisci', 'Arm'),
    ('piu-tardi', 'Più tardi', 'Later'),
  ],
  'gdahome_campanello': [
    ('apri', 'Apri cancello', 'Open gate'),
    ('ignora', 'Ignora', 'Ignore'),
  ],
  'gdahome_chiudi': [('chiudi', 'Chiudi', 'Close')],
};

String? _categoriaPer(List<TastoDellaNotifica> tasti) {
  final ids = tasti.map((uno) => uno.id).toSet();
  for (final MapEntry(:key, :value) in _categorieDellIphone.entries) {
    if (value.every((uno) => ids.contains(uno.$1)) &&
        ids.every((id) => value.any((uno) => uno.$1 == id))) {
      return key;
    }
  }
  if (ids.contains('apri')) return 'gdahome_campanello';
  if (ids.contains('guarda')) return 'gdahome_guarda';
  return null;
}

Future<void> _iCanali() async {
  final android = _locali
      .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin
      >();
  if (android == null) return;
  await android.createNotificationChannel(
    AndroidNotificationChannel(
      CanaleDelleNotifiche.urgenti.id,
      inLingua(it: 'Urgenti', en: 'Urgent'),
      description: inLingua(
        it: 'Antifurto, allagamento, fumo, gas, campanello',
        en: 'Alarm, water leak, smoke, gas, doorbell',
      ),
      importance: Importance.max,
      playSound: true,
      enableVibration: true,
    ),
  );
  await android.createNotificationChannel(
    AndroidNotificationChannel(
      CanaleDelleNotifiche.normali.id,
      inLingua(it: 'Casa', en: 'Home'),
      description: inLingua(
        it: 'Sicurezza, elettrodomestici, persone, personalizzate',
        en: 'Security, appliances, people, custom',
      ),
      importance: Importance.high,
    ),
  );
  await android.createNotificationChannel(
    AndroidNotificationChannel(
      CanaleDelleNotifiche.manutenzione.id,
      inLingua(it: 'Manutenzione', en: 'Maintenance'),
      description: inLingua(
        it: 'Il riepilogo della sera e i suggerimenti',
        en: 'The evening summary and suggestions',
      ),
      importance: Importance.low,
      playSound: false,
      enableVibration: false,
    ),
  );
}

InitializationSettings _impostazioniLocali() => InitializationSettings(
  android: const AndroidInitializationSettings('@mipmap/ic_launcher'),
  iOS: DarwinInitializationSettings(
    /* Il permesso lo chiede Firebase, dopo la spiegazione: qui no. */
    requestAlertPermission: false,
    requestSoundPermission: false,
    requestBadgePermission: false,
    notificationCategories: [
      for (final MapEntry(:key, :value) in _categorieDellIphone.entries)
        DarwinNotificationCategory(
          key,
          actions: [
            for (final (id, it, en) in value)
              DarwinNotificationAction.plain(
                id,
                inLingua(it: it, en: en),
                /* Si apre l'app: e' dall'app, col filo e il suo segno, che
                 * il tasto arriva alla casa. Col telefono bloccato iOS
                 * chiede prima di sbloccarlo. */
                options: {DarwinNotificationActionOption.foreground},
              ),
          ],
        ),
    ],
  ),
);

/// Mostra una notifica gia' aperta, come notifica del telefono.
Future<void> mostra(NotificaDaMostrare quale) async {
  final notifica = quale.notifica;
  final canale = quale.canale;
  final tasti = quale.tasti;
  await _locali.show(
    id: quale.numero,
    title: notifica.titolo,
    body: notifica.testo.isEmpty ? quale.casa.nome : notifica.testo,
    payload: quale.daPortare,
    notificationDetails: NotificationDetails(
      android: AndroidNotificationDetails(
        canale.id,
        switch (canale) {
          CanaleDelleNotifiche.urgenti => inLingua(it: 'Urgenti', en: 'Urgent'),
          CanaleDelleNotifiche.normali => inLingua(it: 'Casa', en: 'Home'),
          CanaleDelleNotifiche.manutenzione => inLingua(
            it: 'Manutenzione',
            en: 'Maintenance',
          ),
        },
        importance: switch (canale) {
          CanaleDelleNotifiche.urgenti => Importance.max,
          CanaleDelleNotifiche.normali => Importance.high,
          CanaleDelleNotifiche.manutenzione => Importance.low,
        },
        priority: notifica.urgente ? Priority.max : Priority.high,
        subText: quale.casa.nome,
        groupKey: 'gdahome_${quale.casa.id}',
        when: notifica.quando.millisecondsSinceEpoch,
        /* Il campanello come una chiamata: una notifica che suona e si vede
         * in cima, e toccata apre la telecamera a tutto schermo. A schermo
         * intero da solo, col telefono bloccato, no: serve il permesso
         * `USE_FULL_SCREEN_INTENT`, che per ora l'app non chiede
         * (`AndroidManifest.xml`). Dura un minuto: un campanello di dieci
         * minuti fa non e' piu' un campanello. */
        category: notifica.chiamata
            ? AndroidNotificationCategory.call
            : (notifica.urgente ? AndroidNotificationCategory.alarm : null),
        timeoutAfter: notifica.chiamata ? 60 * 1000 : null,
        styleInformation: BigTextStyleInformation(notifica.testo),
        actions: [
          for (final tasto in tasti)
            AndroidNotificationAction(
              tasto.id,
              tasto.etichetta,
              /* Il tasto apre l'app, e l'app lo porta alla casa sul suo filo,
               * col suo segno. Col telefono bloccato Android chiede prima di
               * sbloccarlo: «Apri cancello» non si preme dalla tasca. */
              showsUserInterface: true,
              cancelNotification: true,
            ),
        ],
      ),
      iOS: DarwinNotificationDetails(
        threadIdentifier: 'gdahome_${quale.casa.id}',
        categoryIdentifier: _categoriaPer(tasti),
        interruptionLevel: notifica.urgente
            ? InterruptionLevel.timeSensitive
            : InterruptionLevel.active,
        presentSound: canale != CanaleDelleNotifiche.manutenzione,
      ),
    ),
  );
}

/// Apre e mostra quello che e' arrivato. Se e' nostro ma non si apre — una
/// casa tolta, una chiave cambiata — si mostra la frase di riserva: meglio
/// «qualcosa e' successo» che niente.
Future<NotificaDaMostrare?> apriEMostra(
  Map<String, dynamic> dati,
  Cassaforte cassaforte,
) async {
  if (!eUnaNostraSpinta(dati)) return null;
  final archivio = ArchivioDelleCase(cassaforte);
  await archivio.apri();
  final aperta = await apriQuellaArrivata(dati, archivio.tutte);
  if (aperta == null) {
    await _locali.show(
      id: (dati['b'] as String).hashCode & 0x7fffffff,
      title: fraseDiRiserva,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          CanaleDelleNotifiche.normali.id,
          inLingua(it: 'Casa', en: 'Home'),
        ),
      ),
    );
    return null;
  }
  if (!await NotificheViste(cassaforte).segna(aperta.notifica.id)) return null;
  await mostra(aperta);
  return aperta;
}

/// Ad app chiusa (Android): Android sveglia un pezzo di Dart solo per questo.
@pragma('vm:entry-point')
Future<void> quandoArrivaDaChiusa(RemoteMessage messaggio) async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(options: opzioniDiFirebase());
  } catch (_) {
    /* Gia' acceso, o non c'e': la busta si apre lo stesso. */
  }
  await _locali.initialize(settings: _impostazioniLocali());
  await apriEMostra(messaggio.data, const CassaforteDelSistema());
}

/// Il postino dell'app aperta.
class Postino extends ChangeNotifier {
  Postino({required this.collegamento, Cassaforte? cassaforte})
    : cassaforte = cassaforte ?? const CassaforteDelSistema();

  /// Quello acceso, se c'e'. Nel browser e nelle prove non c'e'.
  static Postino? istanza;

  final Collegamento collegamento;
  final Cassaforte cassaforte;

  bool _acceso = false;

  /// Se Firebase c'e': senza i file del progetto, l'app gira senza notifiche.
  bool get acceso => _acceso;

  String? _gettone;
  AuthorizationStatus _permesso = AuthorizationStatus.notDetermined;

  /// Se il telefono le notifiche le lascia mostrare.
  bool get permesse =>
      _permesso == AuthorizationStatus.authorized ||
      _permesso == AuthorizationStatus.provisional;

  bool get daChiedere => _permesso == AuthorizationStatus.notDetermined;

  /// Le case a cui si e' gia' detto questo gettone, in questa vita dell'app.
  final Map<String, String> _detto = {};

  final _tocchi = StreamController<ToccoDellaNotifica>.broadcast();
  final List<ToccoDellaNotifica> _inSospeso = [];

  /// I tocchi sulle notifiche, e le notifiche arrivate ad app aperta che
  /// vanno mostrate subito (il campanello).
  Stream<ToccoDellaNotifica> get tocchi => _tocchi.stream;

  /// Quelli arrivati prima che qualcuno ascoltasse: l'app aperta da una
  /// notifica.
  List<ToccoDellaNotifica> prendiInSospeso() {
    final tutti = List.of(_inSospeso);
    _inSospeso.clear();
    return tutti;
  }

  void _tocca(ToccoDellaNotifica tocco) {
    if (_tocchi.hasListener) {
      _tocchi.add(tocco);
    } else {
      _inSospeso.add(tocco);
    }
  }

  StreamSubscription<void>? _ascolto;

  Future<void> accendi() async {
    if (_acceso || !firebaseCiPuoEssere()) return;
    try {
      await Firebase.initializeApp(options: opzioniDiFirebase());
    } catch (_) {
      /* Senza `google-services.json` (Android) o senza i campi del progetto
       * (iPhone): niente notifiche, e nient'altro di diverso. */
      return;
    }
    _acceso = true;
    istanza = this;
    FirebaseMessaging.onBackgroundMessage(quandoArrivaDaChiusa);
    await _locali.initialize(
      settings: _impostazioniLocali(),
      onDidReceiveNotificationResponse: (risposta) {
        final tocco = ToccoDellaNotifica.daPortato(
          risposta.payload,
          tasto: risposta.actionId,
        );
        if (tocco != null) _tocca(tocco);
      },
    );
    await _iCanali();
    final messaggi = FirebaseMessaging.instance;
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      /* Ad app aperta la frase di riserva non si mostra: la busta si apre
       * qui, e si mostra quello che c'e' dentro. */
      await messaggi.setForegroundNotificationPresentationOptions(
        alert: false,
        badge: false,
        sound: false,
      );
    }
    FirebaseMessaging.onMessage.listen(_arrivataAdAppAperta);
    FirebaseMessaging.onMessageOpenedApp.listen(_toccataSullIphone);
    final iniziale = await messaggi.getInitialMessage();
    if (iniziale != null) unawaited(_toccataSullIphone(iniziale));
    final lancio = await _locali.getNotificationAppLaunchDetails();
    final risposta = lancio?.notificationResponse;
    if (lancio?.didNotificationLaunchApp == true && risposta != null) {
      final tocco = ToccoDellaNotifica.daPortato(
        risposta.payload,
        tasto: risposta.actionId,
      );
      if (tocco != null) _tocca(tocco);
    }
    messaggi.onTokenRefresh.listen((nuovo) {
      _gettone = nuovo;
      _detto.clear();
      unawaited(diloAllaCasa());
    });
    _permesso = (await messaggi.getNotificationSettings()).authorizationStatus;
    if (permesse) await _prendiIlGettone();
    _ascolto = collegamento.cambiamenti.listen((_) {
      unawaited(diloAllaCasa());
      /* Le chiavi solo quando cambia la casa, non a ogni luce che si accende. */
      final casa =
          '${collegamento.casa?.id}|${collegamento.casa?.identificativo}';
      if (casa != _casaDelleChiavi) {
        _casaDelleChiavi = casa;
        unawaited(_chiaviAllEstensione());
      }
    });
    notifyListeners();
    unawaited(diloAllaCasa());
    unawaited(_chiaviAllEstensione());
  }

  String? _casaDelleChiavi;

  /// Sull'iPhone: le chiavi delle notifiche all'estensione che apre le buste
  /// prima che si vedano (`chiavi_per_l_iphone.dart`). Si rifa' quando
  /// cambiano le case: una abbinata adesso, una tolta.
  Future<void> _chiaviAllEstensione() async {
    if (defaultTargetPlatform != TargetPlatform.iOS) return;
    final archivio = ArchivioDelleCase(cassaforte);
    await archivio.apri();
    await lasciaLeChiaviAllEstensione(archivio.tutte);
  }

  Future<void> _prendiIlGettone() async {
    try {
      _gettone = await FirebaseMessaging.instance.getToken();
    } catch (_) {
      /* Sull'iPhone il gettone arriva dopo quello di Apple: ci si riprova
       * al prossimo ingresso in una casa. */
    }
  }

  /// Chiede il permesso al sistema. Va chiamata **dopo** aver detto perche':
  /// vedi [chiediConUnaSpiegazione].
  Future<bool> chiediIlPermesso() async {
    if (!_acceso) return false;
    final detto = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    _permesso = detto.authorizationStatus;
    if (permesse) {
      await _prendiIlGettone();
      await diloAllaCasa();
    }
    notifyListeners();
    return permesse;
  }

  /// La prima volta, una riga che dice cosa arrivera' e perche' si chiede.
  /// Si chiede una volta sola: chi dice «Non ora» le trova nella pagina
  /// «Notifiche».
  Future<void> chiediSeServe(BuildContext context) async {
    if (!_acceso || !daChiedere) return;
    if (await cassaforte.leggi('notifiche_chiesto') == 'si') return;
    await cassaforte.scrivi('notifiche_chiesto', 'si');
    if (!context.mounted) return;
    await chiediConUnaSpiegazione(context);
  }

  Future<bool> chiediConUnaSpiegazione(BuildContext context) async {
    if (!_acceso) return false;
    if (permesse) return true;
    final si = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      builder: (contesto) => const _LaSpiegazione(),
    );
    if (si != true) return false;
    return chiediIlPermesso();
  }

  /// Dice alla casa aperta adesso dove mandare le notifiche, se non gliel'ha
  /// gia' detto.
  Future<void> diloAllaCasa({bool forza = false}) async {
    final gettone = _gettone;
    final casa = collegamento.casa;
    final filo = collegamento.filo;
    if (!_acceso || gettone == null || casa == null || filo == null) return;
    if (!filo.dentro || (!forza && _detto[casa.id] == gettone)) return;
    _detto[casa.id] = gettone;
    try {
      final stato = await Notifiche(filo).registra(
        gettone: gettone,
        piattaforma: defaultTargetPlatform == TargetPlatform.iOS
            ? 'ios'
            : 'android',
        lingua: inLingua(it: 'it', en: 'en'),
      );
      await CopiaDelleNotifiche(cassaforte).scrivi(casa.id, stato);
    } catch (_) {
      /* Un ponte di prima non conosce le notifiche: si riprova alla
       * prossima apertura, non adesso. */
    }
  }

  /// Non mandarle piu' a questo telefono, da questa casa.
  Future<void> nonDirloPiu() async {
    final casa = collegamento.casa;
    if (casa != null) _detto.remove(casa.id);
  }

  Future<void> _arrivataAdAppAperta(RemoteMessage messaggio) async {
    final aperta = await apriEMostra(messaggio.data, cassaforte);
    /* Il campanello ad app aperta non aspetta un tocco: si apre subito. */
    if (aperta != null && aperta.notifica.chiamata && !aperta.scaduta) {
      _tocca(
        ToccoDellaNotifica(casa: aperta.casa.id, notifica: aperta.notifica),
      );
    }
  }

  /// Sull'iPhone si tocca la frase di riserva: la busta si apre adesso.
  Future<void> _toccataSullIphone(RemoteMessage messaggio) async {
    final archivio = ArchivioDelleCase(cassaforte);
    await archivio.apri();
    final aperta = await apriQuellaArrivata(messaggio.data, archivio.tutte);
    if (aperta == null) return;
    _tocca(ToccoDellaNotifica(casa: aperta.casa.id, notifica: aperta.notifica));
  }

  /// Un tasto premuto: si porta alla casa di quella notifica, sul suo filo.
  /// Se la casa aperta e' un'altra, ci si sposta.
  Future<void> premi(ToccoDellaNotifica tocco, String tasto) async {
    if (collegamento.casa?.id != tocco.casa) {
      if (collegamento.archivio.quella(tocco.casa) == null) return;
      await collegamento.archivio.scegli(tocco.casa);
      await collegamento.apri(forza: true);
    }
    for (var volta = 0; volta < 40; volta += 1) {
      final filo = collegamento.filo;
      if (filo != null && filo.dentro && collegamento.casa?.id == tocco.casa) {
        await Notifiche(filo).premi(tocco.notifica.id, tasto);
        return;
      }
      await Future<void>.delayed(const Duration(milliseconds: 500));
    }
    throw StateError(
      inLingua(
        it: 'la casa non risponde: riprova fra poco',
        en: 'the home isn\'t answering: try again shortly',
      ),
    );
  }

  @override
  void dispose() {
    _ascolto?.cancel();
    _tocchi.close();
    if (istanza == this) istanza = null;
    super.dispose();
  }
}

/// Perche' si chiede il permesso: tre righe, prima della finestra del
/// sistema.
class _LaSpiegazione extends StatelessWidget {
  const _LaSpiegazione();

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    final colori = Theme.of(context).colorScheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              inLingua(it: 'Le notifiche di casa', en: 'Home notifications'),
              style: testi.titleLarge,
            ),
            const SizedBox(height: 10),
            Text(
              inLingua(
                it:
                    'L\'antifurto che scatta, il campanello, la lavatrice che '
                    'ha finito: te lo dice la casa, anche ad app chiusa. '
                    'Partono già cifrate dalla tua casa e si aprono solo su '
                    'questo telefono. Scegli tu quali, casa per casa.',
                en:
                    'The alarm going off, the doorbell, the washing machine '
                    'finishing: your home tells you, even with the app '
                    'closed. They leave your home already encrypted and only '
                    'open on this phone. You pick which ones, home by home.',
              ),
              style: testi.bodyMedium?.copyWith(color: colori.onSurfaceVariant),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(false),
                    child: Text(inLingua(it: 'Non ora', en: 'Not now')),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: () => Navigator.of(context).pop(true),
                    child: Text(inLingua(it: 'Attiva', en: 'Turn on')),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
