/// Il comando dell'auto eseguito senza aprire l'app.
///
/// ── Il buco che questo file chiude ──────────────────────────────────────
///
/// Android Auto tiene su il PROCESSO dell'app — il servizio dell'auto gira li'
/// dentro — ma non la parte Flutter: se l'app e' chiusa, il comando lasciato
/// scritto in macchina restava li' e scadeva. Chi premeva «Cancello» guidando
/// doveva poi prendere il telefono e aprire gdahome, che e' esattamente quello
/// che non si vuole fare in macchina.
///
/// Qui il servizio dell'auto accende un motore Dart **senza schermo** e gli
/// fa eseguire il comando. Il filo con la casa resta uno solo, ed e' questo:
/// il Kotlin dell'auto con la casa continua a non parlare, e non ha di che.
///
/// ── Perche' una ricetta, e non l'azione ─────────────────────────────────
///
/// Senza schermo non c'e' plancia, e senza plancia non c'e' `qaRun`: quello
/// che un'azione rapida VUOL DIRE — quale entita' davvero, quale servizio, che
/// voce mettere in un menu — lo sa la plancia, e rifarlo qui sarebbe una
/// seconda tabella dei servizi che il giorno che si scosta fa partire la cosa
/// sbagliata. Quindi la plancia, mentre e' aperta, lascia scritte le ricette
/// dei tasti che possono partire da soli, e qui si esegue quella.
///
/// Le azioni che una ricetta non ce l'hanno — una conferma da mostrare, un
/// menu da far scegliere, una serratura il cui servizio dipende da com'e'
/// messa adesso — restano come prima: aspettano l'app, e il tasto in macchina
/// lo dice.
library;

import 'dart:async';

import 'package:flutter/services.dart' show MethodChannel;
import 'package:flutter/widgets.dart' show WidgetsFlutterBinding;

import '../casa/archivio_delle_case.dart';
import '../casa/cassaforte.dart';
import '../casa/collegamento.dart';
import '../casa/stato_della_casa.dart';
import '../ponte/errori.dart';
import 'i_comandi.dart';
import 'la_foto.dart';
import 'qui.dart' as auto;

/// Quanto si aspetta il filo prima di lasciar perdere.
///
/// Dodici secondi: aprire il filo vuol dire trovare la casa, la stretta di
/// mano e la cifratura, e su una rete mobile lenta non e' istantaneo. Piu' in
/// la' non ha senso — il comando stesso vale due minuti, e chi ha premuto in
/// macchina e' gia' andato avanti.
const Duration quantoSiAspettaIlFilo = Duration(seconds: 12);

/// Com'e' finita.
enum ComeEFinitaInAuto {
  /// Chiesto a Home Assistant.
  fatto,

  /// Non c'era niente da fare: nessun comando lasciato, o scaduto.
  niente,

  /// Il comando c'era ma non parte da solo: nessuna ricetta. Non e' un
  /// guasto — e' un'azione che vuole qualcuno che guardi.
  aspettaLApp,

  /// La casa non si e' raggiunta.
  senzaCasa,

  /// La casa non e' Premium: in auto la casa non c'e' (`la_licenza.dart`).
  /// Il tasto in macchina l'ha gia' detto; qui non si apre nemmeno il filo.
  senzaPremium,
}

/// Il punto da cui il servizio dell'auto accende il motore Dart.
///
/// Il nome conta: e' quello che il Kotlin passa a `DartEntrypoint`, e va
/// cercato in `lib/main.dart` — per questo li' c'e' una riga che chiama
/// questa. `@pragma('vm:entry-point')` dice al compilatore di non buttarla
/// via: da Dart non la chiama nessuno.
@pragma('vm:entry-point')
Future<void> inAuto() async {
  WidgetsFlutterBinding.ensureInitialized();
  /* Il motore resta acceso finche' Android Auto e' attaccato, e a ogni tasto
   * premuto arriva di qui un colpetto. Accenderne uno per ogni pressione
   * vorrebbe dire far ripartire tutto — macchina virtuale, plugin, cassaforte
   * — per un comando solo, e in macchina i tasti si premono di fila. */
  /* Al colpetto si risponde com'e' finita, come sull'iPhone: «Android dice
   * fatto ma in realta' non fa nulla», dal Wear OS. Il telefono rispondeva
   * «Fatto» all'orologio appena scritto il comando, prima di sapere se era
   * partito. Adesso `IlTramiteDellOrologio.kt` aspetta questa risposta. */
  const canale = MethodChannel(canaleDellAuto);
  canale.setMethodCallHandler(
    (chiamata) async => (await _ilColpetto(chiamata.arguments)).name,
  );
  final com = await eseguiIlComandoDellAuto();
  /* Il comando per cui il motore e' stato acceso: nessun colpetto l'ha
   * portato, e chi l'ha acceso aspetta di sapere com'e' finita. */
  try {
    await canale.invokeMethod<void>('finito', com.name);
  } catch (_) {
    /* Nessuno ascolta: l'auto, che non aspetta niente. */
  }
}

/// Sull'iPhone il motore e' uno solo, quello dell'app, ed e' sempre acceso
/// (CarPlay lo tiene su): il colpetto di `ios/Runner/LaCasaInCarPlay.swift`
/// arriva a lui, e lo sente da qui. La chiama `main`.
///
/// Al colpetto si risponde com'e' finita (`fatto`, `senzaCasa`…): l'Apple
/// Watch lo dice al polso, invece di un «Fatto» detto prima che la casa
/// sentisse (`ios/Runner/LOrologio.swift`).
void ascoltaIlColpetto({Collegamento Function()? laCasaDellApp}) {
  const MethodChannel(canaleDellAuto).setMethodCallHandler((chiamata) async {
    final com = await _ilColpetto(
      chiamata.arguments,
      laCasaDellApp: laCasaDellApp,
    );
    return com.name;
  });
  /* Un comando lasciato mentre questo motore partiva: il colpetto e' arrivato
   * prima che ci fosse chi lo sentiva, ma il file c'e' ancora (lo toglie solo
   * chi lo legge). Vale due minuti, come sempre. */
  if (laCasaDellApp != null) {
    scheduleMicrotask(
      () => unawaited(eseguiIlComandoDellAuto(laCasaDellApp: laCasaDellApp)),
    );
  }
}

/// Chi corregge la fotografia dopo un comando
/// (`aggiornaIDispositiviNellaFoto`): per ogni entita', se e' accesa.
typedef AggiornaLaFoto = Future<void> Function(Map<String, bool> accesi);

/// Quanto si aspetta che Home Assistant dica lo stato nuovo, dopo un comando.
///
/// Otto secondi, e non piu' quattro: non li aspetta piu' nessuno. La conferma
/// al polso parte appena Home Assistant accetta il comando, e lo stato nuovo
/// si aspetta dopo, per conto suo ([_ilSeguito]) — una lampadina lenta ha il
/// tempo di dirlo, e chi ha toccato l'orologio non lo paga.
const Duration quantoSiAspettaLoStato = Duration(seconds: 8);

/// Quanto si lascia a una scena o a uno script per cambiare quello che cambia:
/// non c'e' un'entita' sola di cui aspettare lo stato, e allora si guarda
/// per un po' cosa si muove.
const Duration quantoSiGuardaUnaScena = Duration(milliseconds: 2500);

/// Lo stato di [id] appena diverso da [prima], o `null` se entro [fino] non
/// cambia (un comando che non ha fatto niente, o una casa lenta: la
/// fotografia resta com'era, e la plancia la sistemera').
Future<String?> statoNuovo(
  StatoDellaCasa stato,
  String id,
  String? prima, {
  Duration fino = quantoSiAspettaLoStato,
}) async {
  String? diverso() {
    final adesso = stato[id]?.stato;
    return adesso != null && adesso != prima ? adesso : null;
  }

  if (diverso() case final gia?) return gia;
  try {
    await stato.cambiamenti.firstWhere((_) => diverso() != null).timeout(fino);
  } catch (_) {
    return null;
  }
  return diverso();
}

/// Quanto si aspetta che il filo dia un cenno prima di crederlo morto.
///
/// Tre secondi: su un filo vivo la risposta a una domanda piccola torna in un
/// decimo di secondo da casa e in meno di uno da fuori. Oltre non e' un filo
/// lento, e' un filo che non c'e' piu' — e chi ha toccato l'orologio aspetta.
const Duration quantoSiAspettaUnCenno = Duration(seconds: 3);

/// Quanto si aspetta lo stato di adesso, dopo il si' all'abbonamento.
///
/// Tre secondi, e non uno: da fuori casa il ponte tiene gli eventi **un
/// secondo** e li manda insieme (`ponte/src/ponte.js`, il mucchio), e lo
/// stato di adesso e' un evento. Con un secondo di attesa arrivava un soffio
/// dopo, a tempo scaduto: lo stato «non si sapeva», e la riga al polso non
/// si correggeva.
const Duration quantoSiAspettaLoStatoDiAdesso = Duration(seconds: 3);

/// Lo stato delle entita' di un comando, chiesto apposta per quel comando.
///
/// ── Perche' non lo stato della casa ─────────────────────────────────────
///
/// Lo stato della casa ([Collegamento.stato]) si riempie solo quando qualcuno
/// lo chiede (`serveLaCasa`): un `get_states` da un megabyte e mezzo, e poi
/// ogni cambiamento di ogni entita'. Chi esegue un comando dal polso non l'ha
/// mai chiesto, e quindi leggeva sempre «non lo so».
///
/// Qui si chiede a Home Assistant lo stato di **quelle** entita' e basta
/// (`subscribe_entities` coi loro nomi, come fa gia' il navigatore per i
/// sensori dell'auto): prima com'e' adesso, poi quello che cambia.
///
/// ── Si chiede prima del comando, ma non lo si aspetta ───────────────────
///
/// La domanda parte **prima** del comando e sullo stesso filo: Home Assistant
/// le prende in ordine, quindi lo stato «di adesso» che risponde e' quello di
/// prima del comando, e tutto quello che il comando cambia arriva dopo, come
/// cambiamento. Non serve aspettare la risposta per mandare il comando — e
/// aspettarla costava un secondo intero a ogni tocco da fuori casa.
///
/// Si aspetta solo in due casi: quando lo stato serve a **scegliere** il
/// servizio (una serratura: apri o chiudi?), e quando il filo e' quello
/// dell'app e c'era gia' — col telefono in tasca resta «aperto» in apparenza
/// e morto in realta' (vedi `Filo.sveglia`), e il si' a questa domanda e' la
/// prova che e' vivo. La domanda si puo' rifare; il comando no.
class _Sguardo {
  _Sguardo._();

  /// Comincia a guardare [entita] sul filo di [collegamento]. Torna subito:
  /// chi vuole sapere se il filo ha risposto chiede [vivo].
  factory _Sguardo.su(Collegamento collegamento, List<String> entita) {
    final sguardo = _Sguardo._();
    final filo = collegamento.filo;
    if (filo == null || !filo.dentro) {
      sguardo._cenno.complete(false);
      return sguardo;
    }
    /* Si ascolta nello stesso giro in cui l'abbonamento torna, come fa il
     * navigatore: lo stato di adesso arriva subito dopo il si', e chi si
     * mette in ascolto un attimo dopo lo perde. */
    filo
        .sottoscrivi({'type': 'subscribe_entities', 'entity_ids': entita})
        .then<void>(
          (flusso) {
            final ascolto = flusso.listen(
              sguardo._prendi,
              onError: (Object _) {},
              /* Il filo si e' chiuso: non arrivera' piu' niente, e chi
               * aspetta smette di aspettare. */
              onDone: () {
                if (!sguardo._cambi.isClosed) sguardo._cambi.close();
              },
            );
            if (sguardo._chiuso) {
              unawaited(ascolto.cancel().catchError((Object _) {}));
              return;
            }
            sguardo._ascolto = ascolto;
            if (!sguardo._cenno.isCompleted) sguardo._cenno.complete(true);
          },
          onError: (Object errore) {
            /* Un ponte di prima dice di no, ma lo dice: il filo e' vivo, e
             * lo stato da qui non si sapra'. Tutto il resto e' un filo che
             * non c'e'. */
            sguardo.cieco = errore is ComandoRifiutato;
            if (!sguardo._cenno.isCompleted) {
              sguardo._cenno.complete(sguardo.cieco);
            }
          },
        );
    return sguardo;
  }

  final _prima = <String, String>{};
  final _adesso = <String, String>{};
  final _cambiate = <String>{};
  final _cenno = Completer<bool>();
  final _primo = Completer<void>();
  final _cambi = StreamController<void>.broadcast();
  StreamSubscription<Map<String, dynamic>>? _ascolto;
  bool _chiuso = false;

  /// Il ponte non conosce la domanda: il filo e' vivo, ma lo stato non c'e'.
  bool cieco = false;

  /// Se il filo ha dato un cenno entro [entro]: ha risposto alla domanda, o
  /// ha detto di non conoscerla.
  Future<bool> vivo({Duration entro = quantoSiAspettaUnCenno}) =>
      _cenno.future.timeout(entro, onTimeout: () => false);

  /// Aspetta lo stato di adesso — quello di prima del comando — al piu'
  /// [entro]. Torna comunque: chi chiama guarda poi cosa si sa.
  Future<void> loStatoDiAdesso({
    Duration entro = quantoSiAspettaLoStatoDiAdesso,
  }) async {
    if (!await vivo() || cieco) return;
    await _primo.future.timeout(entro, onTimeout: () {});
  }

  /// Com'era [id] prima del comando, o `null` se non si sa.
  String? prima(String id) => _prima[id];

  /// Com'e' adesso [id], o `null` se non si sa.
  String? adesso(String id) => _adesso[id];

  /// Le entita' che hanno cambiato stato da quando si guarda.
  Set<String> get cambiate => _cambiate;

  /// Se di [id] non c'e' piu' niente da aspettare: e' cambiata, oppure lo
  /// stato di adesso e' arrivato e dice che Home Assistant non la raggiunge,
  /// o che non la conosce proprio.
  bool ferma(String id) =>
      _cambiate.contains(id) ||
      (_primo.isCompleted && (_prima[id] ?? 'unavailable') == 'unavailable');

  /// Aspetta finche' [basta] non e' vero, al piu' [fino].
  Future<void> finche(bool Function() basta, {required Duration fino}) async {
    if (basta() || _cambi.isClosed) return;
    try {
      await _cambi.stream.firstWhere((_) => basta()).timeout(fino);
    } catch (_) {
      /* Il tempo e' finito, o il filo si e' chiuso: vale quello che si sa. */
    }
  }

  /* Un messaggio dell'abbonamento: `a` le entita' con lo stato intero, `c`
   * quello che e' cambiato, `r` quelle che non ci sono piu'. */
  void _prendi(Map<String, dynamic> evento) {
    if (evento['a'] case final Map aggiunte) {
      for (final MapEntry(:key, :value) in aggiunte.entries) {
        if (value is Map && value['s'] is String) {
          final stato = value['s'] as String;
          _prima.putIfAbsent('$key', () => stato);
          _adesso['$key'] = stato;
        }
      }
      if (!_primo.isCompleted) _primo.complete();
    }
    if (evento['c'] case final Map cambiate) {
      for (final MapEntry(:key, :value) in cambiate.entries) {
        final piu = value is Map ? value['+'] : null;
        if (piu is Map && piu['s'] is String) {
          final stato = piu['s'] as String;
          if (_adesso['$key'] != stato) _cambiate.add('$key');
          _adesso['$key'] = stato;
        }
      }
    }
    if (evento['r'] case final List tolte) {
      for (final id in tolte) {
        _adesso.remove('$id');
      }
    }
    if (!_cambi.isClosed) _cambi.add(null);
  }

  Future<void> chiudi() async {
    _chiuso = true;
    await _ascolto?.cancel().catchError((Object _) {});
    _ascolto = null;
    if (!_cambi.isClosed) await _cambi.close();
  }
}

/* I seguiti ancora in corso: vedi [_ilSeguito]. */
final Set<Future<void>> _seguiti = {};

/// Finisce quando sono finiti tutti i seguiti dei comandi gia' partiti: lo
/// stato nuovo arrivato, la fotografia corretta, i fili aperti apposta
/// richiusi. Per le prove, e per chi vuole spegnere tutto con ordine.
Future<void> ilSeguitoDeiComandi() async {
  while (_seguiti.isNotEmpty) {
    await Future.wait(_seguiti.toList());
  }
}

/// Quello che resta da fare dopo che Home Assistant ha accettato il comando,
/// e che chi ha toccato l'orologio non deve aspettare: lo stato nuovo, e la
/// fotografia corretta con quello.
///
/// «Premo e dopo un po' da' il tap di feedback»: la risposta al polso partiva
/// solo dopo aver aspettato lo stato nuovo. Adesso parte appena il comando e'
/// accettato, e questo va avanti da solo: quando lo stato arriva la
/// fotografia si corregge, e chi la porta al polso viene avvisato
/// (`aggiornaIDispositiviNellaFoto`).
///
/// Si scrive com'e' **adesso** per Home Assistant, non «il contrario di
/// prima»: se lo stato nuovo non arriva in tempo la riga resta quella vera,
/// e se la riga era gia' sbagliata prima del comando torna giusta lo stesso.
Future<void> _ilSeguito({
  required _Sguardo sguardo,
  required List<String> comandate,
  required bool diUnaScena,
  required StatoDellaCasa? tutta,
  required String? prima,
  required AggiornaLaFoto aggiornaLaFoto,
  required Future<void> Function() allaFine,
}) async {
  try {
    if (tutta != null && comandate.length == 1) {
      /* Un ponte di prima, e tutta la casa gia' letta per scegliere il
       * servizio: lo stato nuovo arriva da li'. */
      final id = comandate.single;
      final dopo = await statoNuovo(tutta, id, prima);
      if (dopo != null) await aggiornaLaFoto({id: eAccesoPerLaFoto(dopo)});
      return;
    }
    /* Senza un cenno, o con un ponte che la domanda non la conosce, lo stato
     * da qui non arrivera': la fotografia resta com'era. */
    if (!await sguardo.vivo() || sguardo.cieco) return;
    if (diUnaScena) {
      /* Una scena non dice cosa cambia: si guarda per un po', e si scrive
       * quello che si e' mosso. */
      await sguardo.finche(() => false, fino: quantoSiGuardaUnaScena);
      await aggiornaLaFoto({
        for (final id in sguardo.cambiate)
          if (sguardo.adesso(id) case final stato?) id: eAccesoPerLaFoto(stato),
      });
      return;
    }
    await sguardo.finche(
      () => comandate.every(sguardo.ferma),
      fino: quantoSiAspettaLoStato,
    );
    await aggiornaLaFoto({
      for (final id in comandate)
        if (sguardo.adesso(id) case final stato?) id: eAccesoPerLaFoto(stato),
    });
  } catch (_) {
    /* La fotografia resta com'era: la sistemera' la plancia. */
  } finally {
    await sguardo.chiudi();
    await allaFine();
  }
}

/// Il filo [aperto] in piedi, e gli occhi su [guardate]; `null` se la casa
/// non si raggiunge. Non solleva per una casa che non risponde: torna `null`
/// (solo il tempo scaduto passa come [TimeoutException]).
///
/// Il filo dell'app che c'era gia' ([condiviso]) va provato prima di
/// affidargli qualcosa: col telefono in tasca resta «aperto» e non lo e'
/// piu' (vedi `Filo.sveglia`). Se non da' un cenno lo si rifa' da capo, come
/// fa l'app quando torna davanti (`main.dart`, `daRifare`), e si riguarda.
/// Chi chiama non ha ancora mandato niente: non c'e' niente che possa partire
/// due volte.
Future<_Sguardo?> _ilFiloEGliOcchi(
  Collegamento aperto,
  List<String> guardate, {
  required bool condiviso,
}) async {
  if (!aperto.archivio.aperto) await aperto.archivio.apri();
  final cEraGia = condiviso && aperto.dentro && !aperto.aRiposo;
  if (condiviso && aperto.aRiposo) aperto.sveglia();
  /* Su un filo gia' aperto `apri` non fa niente; su uno che dorme o che si
   * sta ricollegando lo rimette in piedi. */
  await aperto.apri().timeout(quantoSiAspettaIlFilo);
  if (!aperto.dentro || aperto.stato == null) return null;
  final occhi = _Sguardo.su(aperto, guardate);
  if (!cEraGia || await occhi.vivo()) return occhi;
  await occhi.chiudi();
  await aperto.apri(forza: true).timeout(quantoSiAspettaIlFilo);
  if (!aperto.dentro || aperto.stato == null) return null;
  return _Sguardo.su(aperto, guardate);
}

/// Cosa chiede il telefono quando l'orologio vuole sapere com'e' la casa
/// adesso: lo stesso colpetto del comando, con questa parola accanto
/// (`IlPonteDellAuto.kt`, `LaCasaInCarPlay.swift`).
const String guardaLoStato = 'stato';

/* Uno sguardo alla volta: l'orologio ne chiede uno ogni tanto, e due di fila
 * sarebbero due fili per la stessa domanda. */
bool _guardaInCorso = false;

/// Com'e' adesso, per Home Assistant, ogni dispositivo che al polso ha una
/// riga: si chiede, e la fotografia si corregge.
///
/// «Il comando arriva, la luce si accende, ma al polso il tasto resta
/// spento.» La fotografia la riscrive la plancia, che pero' guarda la casa
/// solo quando e' aperta sul telefono, e chi esegue un comando, che guarda
/// solo le entita' di quel comando e per qualche secondo. Una lampadina lenta,
/// un telefono che il sistema ferma subito dopo la risposta, una luce accesa
/// dal muro mentre si guarda l'orologio: in tutti questi casi nessuno
/// riscriveva la riga. Adesso l'orologio, finche' e' acceso e dopo ogni
/// comando, chiede questo, e la riga dice la verita' di adesso.
///
/// Si chiede lo stato di **quelle** entita' e basta (`subscribe_entities`,
/// come [_Sguardo]), e il filo si chiude appena arrivato. Quello che Home
/// Assistant non raggiunge (`unavailable`, `unknown`) non si scrive: la riga
/// resta com'era invece di diventare «spenta».
Future<ComeEFinitaInAuto> guardaLaCasaPerIlPolso({
  Collegamento Function()? laCasaDellApp,
  Collegamento Function()? apriLaCasa,
  Future<bool> Function()? premium,
  Future<List<String>> Function()? iDispositivi,
  Future<List<RicettaDellAzione>> Function()? leRicette,
  AggiornaLaFoto? aggiornaLaFoto,
}) async {
  if (_guardaInCorso || _inCorso) return ComeEFinitaInAuto.niente;
  _guardaInCorso = true;
  Collegamento? collegamento;
  _Sguardo? occhi;
  void Function()? lascia;
  final condiviso = laCasaDellApp != null;
  try {
    if (!await (premium ?? auto.laLicenzaDellAuto)()) {
      return ComeEFinitaInAuto.senzaPremium;
    }
    final righe = await (iDispositivi ?? auto.iDispositiviDellaFoto)();
    if (righe.isEmpty) return ComeEFinitaInAuto.niente;
    /* La riga ha il nome scritto nella tessera; lo stato si chiede a quello
     * vero, che e' nella sua ricetta (vedi `aggiornaLeRighe` in [_esegui]). */
    final ricette = await (leRicette ?? auto.leRicetteDelPolso)();
    final vera = <String, String>{
      for (final riga in righe)
        riga: switch (laRicettaDi(riga, ricette)?.leEntita) {
          [final una] => una,
          _ => riga,
        },
    };
    final aperto = collegamento =
        laCasaDellApp?.call() ??
        apriLaCasa?.call() ??
        Collegamento(archivio: ArchivioDelleCase(const CassaforteDelSistema()));
    lascia = aperto.tieniIlFilo();
    occhi = await _ilFiloEGliOcchi(
      aperto,
      vera.values.toSet().toList(),
      condiviso: condiviso,
    );
    if (occhi == null) return ComeEFinitaInAuto.senzaCasa;
    await occhi.loStatoDiAdesso();
    if (occhi.cieco) return ComeEFinitaInAuto.niente;
    const nonSiSa = {'unavailable', 'unknown', ''};
    await (aggiornaLaFoto ?? auto.aggiornaIDispositiviNellaFoto)({
      for (final MapEntry(key: riga, value: entita) in vera.entries)
        if (occhi.adesso(entita) case final stato?
            when !nonSiSa.contains(stato.trim().toLowerCase()))
          riga: eAccesoPerLaFoto(stato),
    });
    return ComeEFinitaInAuto.fatto;
  } on TimeoutException {
    return ComeEFinitaInAuto.senzaCasa;
  } catch (_) {
    return ComeEFinitaInAuto.senzaCasa;
  } finally {
    await occhi?.chiudi();
    final aperto = collegamento;
    if (aperto != null && !condiviso) {
      await aperto.chiudi().catchError((Object _) {});
    }
    lascia?.call();
    _guardaInCorso = false;
  }
}

/// Il colpetto, da chiunque arrivi: [guardaLoStato] vuol dire «com'e' la
/// casa adesso», tutto il resto «esegui il comando lasciato».
Future<ComeEFinitaInAuto> _ilColpetto(
  Object? detto, {
  Collegamento Function()? laCasaDellApp,
}) => detto == guardaLoStato
    ? guardaLaCasaPerIlPolso(laCasaDellApp: laCasaDellApp)
    : eseguiIlComandoDellAuto(laCasaDellApp: laCasaDellApp);

/// Da dove arriva il colpetto. Lo stesso nome sta in `IlPonteDellAuto.kt`: i
/// due capi devono restare la stessa parola, perche' sbagliarli non da'
/// nessun errore — da' un motore acceso che non fa niente.
const String canaleDellAuto = 'gdahome/auto/guarda';

/* Un comando alla volta.
 *
 * Il file si legge e si toglie, e le due cose non sono una sola: due colpetti
 * ravvicinati — due tasti premuti di fila — potrebbero leggere lo stesso file
 * tutt'e due e mandare due volte lo stesso comando. Un cancello aperto due
 * volte e' un cancello richiuso. */
bool _inCorso = false;

/// Prende il comando lasciato dall'auto e lo esegue.
///
/// I pezzi si passano da fuori perche' una prova possa metterci i suoi: qui
/// dentro non c'e' niente da guardare, e una cosa che si puo' provare solo con
/// una macchina vera attaccata e' una cosa che non si prova.
Future<ComeEFinitaInAuto> eseguiIlComandoDellAuto({
  Future<String?> Function()? prendiIlComando,
  Future<List<RicettaDellAzione>> Function()? leRicette,
  Collegamento Function()? apriLaCasa,
  Future<bool> Function()? premium,
  Collegamento Function()? laCasaDellApp,
  AggiornaLaFoto? aggiornaLaFoto,
}) async {
  if (_inCorso) return ComeEFinitaInAuto.niente;
  _inCorso = true;
  try {
    return await _esegui(
      prendiIlComando,
      leRicette,
      apriLaCasa,
      premium,
      laCasaDellApp,
      aggiornaLaFoto ?? auto.aggiornaIDispositiviNellaFoto,
    );
  } finally {
    _inCorso = false;
  }
}

Future<ComeEFinitaInAuto> _esegui(
  Future<String?> Function()? prendiIlComando,
  Future<List<RicettaDellAzione>> Function()? leRicette,
  Collegamento Function()? apriLaCasa,
  Future<bool> Function()? premium,
  Collegamento Function()? laCasaDellApp,
  AggiornaLaFoto aggiornaLaFoto,
) async {
  /* Da dove viene: dal polso si comanda anche col lucchetto acceso (le sue
   * ricette ci sono sempre), dall'auto no. */
  String? segno;
  var dalPolso = false;
  if (prendiIlComando != null) {
    segno = await prendiIlComando();
  } else {
    final lasciato = await auto.prendiIlComandoLasciato();
    segno = lasciato?.id;
    dalPolso = lasciato?.dalPolso ?? false;
  }
  if (segno == null || segno.isEmpty) return ComeEFinitaInAuto.niente;

  final ricetta = laRicettaDi(
    segno,
    await (leRicette ??
        (dalPolso ? auto.leRicetteDelPolso : auto.leRicetteDellAuto))(),
  );
  /* Nessuna ricetta vuol dire «questo tasto vuole qualcuno che guardi», e non
   * «questo tasto e' rotto»: si lascia stare, e l'app quando si apre non lo
   * ritrova — il file del comando e' gia' tolto da chi l'ha letto. Eseguirlo
   * qui a naso vorrebbe dire indovinare un servizio, e dall'altra parte c'e'
   * un cancello. */
  if (ricetta == null) return ComeEFinitaInAuto.aspettaLApp;

  /* In auto la casa e' Premium. Il tasto in macchina lo guarda gia', ma il
   * comando si puo' trovare scritto da prima: lo si guarda di nuovo qui, con
   * lo stesso biglietto (`la_licenza.dart`), e senza Premium il filo non si
   * apre nemmeno. Il comando e' gia' stato tolto, quindi non resta li' a
   * ripartire. */
  if (!await (premium ?? auto.laLicenzaDellAuto)()) {
    return ComeEFinitaInAuto.senzaPremium;
  }

  /* Il filo dell'app, quando l'app e' gia' accesa: nella versione col
   * navigatore in auto lo e' sempre, e quel filo e' gia' aperto — e' quello
   * che porta a gdanav i dati dell'auto. Prima se ne apriva un altro, da
   * capo, in un secondo motore: la casa da ritrovare, la stretta di mano,
   * il centralino, il tutto in dodici secondi. «Se clicco apri cancello non
   * fa nulla, come se il comando non arrivasse.» Quello dell'app non si
   * chiude dopo: e' suo. */
  final condiviso = laCasaDellApp != null;
  Collegamento? collegamento;
  _Sguardo? sguardo;
  void Function()? lascia;
  /* Da quando il comando e' accettato, il filo e lo sguardo sono del seguito:
   * li chiude lui quando ha finito. */
  var alSeguito = false;
  /* Chiude quello che si e' aperto per questo comando. Il motore senza
   * schermo puo' morire subito dopo, ma chiudere il filo e' comunque la cosa
   * giusta: la casa vede una presa che si chiude invece di una che smette di
   * rispondere. Quello dell'app invece resta: e' suo. */
  Future<void> chiudiTutto() async {
    final aperto = collegamento;
    if (aperto != null && !condiviso) {
      await aperto.chiudi().catchError((Object _) {});
    }
    lascia?.call();
  }

  try {
    final aperto = collegamento =
        laCasaDellApp?.call() ??
        apriLaCasa?.call() ??
        Collegamento(archivio: ArchivioDelleCase(const CassaforteDelSistema()));
    /* Finche' il comando e' in viaggio il filo non si rifa' da solo per
     * prendere la strada corta: vedi [Collegamento.tieniIlFilo]. */
    lascia = aperto.tieniIlFilo();
    /* Le entita' del comando. Mai un elenco vuoto: per Home Assistant
     * vorrebbe dire «tutte». */
    final comandate = ricetta.leEntita.isEmpty
        ? [ricetta.entita]
        : ricetta.leEntita;
    /* Una scena e uno script cambiano altre cose, non se stessi: si guardano
     * i dispositivi che al polso hanno una riga. */
    final suo = ricetta.dominio.trim().toLowerCase();
    final diUnaScena = suo == 'scene' || suo == 'script';
    final guardate = <String>{
      ...comandate,
      if (diUnaScena) ...await auto.iDispositiviDellaFoto(),
    }.toList();
    final serveLoStato = ricetta.servizio == secondoLoStato;

    final occhi = sguardo = await _ilFiloEGliOcchi(
      aperto,
      guardate,
      condiviso: condiviso,
    );
    if (occhi == null) return ComeEFinitaInAuto.senzaCasa;
    /* La riga al polso porta il nome dell'entita' com'e' scritto nella
     * tessera; la ricetta quello vero, quando chi configura l'ha rimappata
     * (`resolveEntity` della plancia). Lo stato nuovo di quella vera va
     * scritto anche sulla riga col nome di prima: se no la riga non si
     * trova, e al polso la luce accesa resta «Spenta». */
    final rigaDellaRicetta =
        comandate.length == 1 &&
            !ricetta.id.contains('|') &&
            ricetta.id.contains('.') &&
            ricetta.id != comandate.single
        ? ricetta.id
        : null;
    Future<void> aggiornaLeRighe(Map<String, bool> accesi) => aggiornaLaFoto({
      ...accesi,
      if (rigaDellaRicetta != null && accesi[comandate.single] != null)
        rigaDellaRicetta: accesi[comandate.single]!,
    });
    final unaSola = comandate.length == 1 ? comandate.single : null;
    StatoDellaCasa? tutta;
    String? prima;
    if (serveLoStato) {
      /* Il servizio che dipende da com'e' messa adesso (una serratura, un
       * lettore) si decide con lo stato di adesso in mano: questo si',
       * si aspetta. */
      await occhi.loStatoDiAdesso();
      if (occhi.cieco) {
        /* Un ponte di prima: tutta la casa, che e' l'unico modo. */
        await aperto.serveLaCasa();
        final casa = aperto.stato;
        if (casa != null && casa.pieno) tutta = casa;
      }
      if (unaSola != null) {
        prima = tutta != null ? tutta[unaSola]?.stato : occhi.adesso(unaSola);
      }
    }
    final stato = aperto.stato;
    if (stato == null) return ComeEFinitaInAuto.senzaCasa;
    await stato.comanda(
      serveLoStato
          ? ilServizioDiAdesso(ricetta.dominio, prima)
          : ricetta.servizio,
      ricetta.entita,
      dominio: ricetta.dominioDaChiamare,
      con: ricetta.dati.isEmpty ? null : {...ricetta.dati},
    );
    /* Accettato: da qui la risposta e' «fatto», e non aspetta piu' niente.
     *
     * Quello che si sa gia' si scrive subito — lo stato nuovo di una luce
     * arriva quasi sempre **prima** del si' al comando, e la risposta al
     * polso parte con la riga gia' giusta nella fotografia. Il resto lo fa
     * il seguito. */
    if (!diUnaScena && tutta == null && comandate.every(occhi.ferma)) {
      try {
        await aggiornaLeRighe({
          for (final id in comandate)
            if (occhi.adesso(id) case final adesso?)
              id: eAccesoPerLaFoto(adesso),
        });
      } catch (_) {
        /* Il comando e' andato: una fotografia che non si scrive non lo
         * fa diventare un «la casa non risponde». */
      }
      return ComeEFinitaInAuto.fatto;
    }
    alSeguito = true;
    late final Future<void> seguito;
    seguito = _ilSeguito(
      sguardo: occhi,
      comandate: comandate,
      diUnaScena: diUnaScena,
      tutta: tutta,
      prima: prima,
      aggiornaLaFoto: aggiornaLeRighe,
      allaFine: chiudiTutto,
    ).whenComplete(() => _seguiti.remove(seguito));
    _seguiti.add(seguito);
    return ComeEFinitaInAuto.fatto;
  } on TimeoutException {
    return ComeEFinitaInAuto.senzaCasa;
  } catch (_) {
    /* Il filo caduto, la casa spenta, Home Assistant che dice di no: in
     * macchina non c'e' niente da mostrare e nessuno da disturbare. Il comando
     * e' gia' stato tolto, quindi non si ripete da solo. */
    return ComeEFinitaInAuto.senzaCasa;
  } finally {
    if (!alSeguito) {
      await sguardo?.chiudi();
      await chiudiTutto();
    }
  }
}
