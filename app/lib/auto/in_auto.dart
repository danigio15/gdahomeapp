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
    (_) async => (await eseguiIlComandoDellAuto()).name,
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
  const MethodChannel(canaleDellAuto).setMethodCallHandler((_) async {
    final com = await eseguiIlComandoDellAuto(laCasaDellApp: laCasaDellApp);
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

/// Chi corregge la fotografia dopo un comando (`aggiornaIlDispositivoNellaFoto`).
typedef AggiornaLaFoto = Future<void> Function(
  String entita, {
  required bool acceso,
});

/// Quanto si aspetta che Home Assistant dica lo stato nuovo, dopo un comando.
const Duration quantoSiAspettaLoStato = Duration(seconds: 4);

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

/// Lo stato delle entita' di un comando, chiesto apposta per quel comando.
///
/// ── Perche' non lo stato della casa ─────────────────────────────────────
///
/// Lo stato della casa ([Collegamento.stato]) si riempie solo quando qualcuno
/// lo chiede (`serveLaCasa`): un `get_states` da un megabyte e mezzo, e poi
/// ogni cambiamento di ogni entita'. Chi esegue un comando dal polso non l'ha
/// mai chiesto, e quindi leggeva sempre «non lo so»: una serratura chiusa
/// riceveva «chiudi» invece di «apri» (`secondo_lo_stato`), e dopo il comando
/// si aspettavano quattro secondi uno stato nuovo che non poteva arrivare —
/// «vengono comandati ma non cambiano stato», e la risposta al polso in
/// ritardo per niente.
///
/// Qui si chiede a Home Assistant lo stato di **quelle** entita' e basta
/// (`subscribe_entities` coi loro nomi, come fa gia' il navigatore per i
/// sensori dell'auto): prima com'e' adesso, poi quello che cambia.
///
/// ── E perche' prima del comando ─────────────────────────────────────────
///
/// Perche' e' anche il modo di sapere che il filo e' vivo. Quello dell'app,
/// col telefono in tasca, resta «aperto» in apparenza e morto in realta'
/// (vedi `Filo.sveglia`): un comando mandato li' non arriva a nessuno e non
/// torna indietro. Questa domanda si puo' rifare; il comando no — un cancello
/// aperto due volte e' un cancello richiuso.
class _Sguardo {
  final _stati = <String, String>{};
  final _cambi = StreamController<void>.broadcast();
  StreamSubscription<Map<String, dynamic>>? _ascolto;

  /* Un ponte di prima, che `subscribe_entities` non lo lascia passare: se lo
   * stato serve davvero, tutta la casa. */
  StatoDellaCasa? _tutta;

  /// Com'e' adesso [id], o `null` se non si sa.
  String? adesso(String id) => _tutta != null ? _tutta![id]?.stato : _stati[id];

  /// Lo stato di [id] appena diverso da [prima]; `null` se non cambia entro
  /// [fino], o se non c'e' modo di saperlo.
  Future<String?> dopo(
    String id,
    String? prima, {
    Duration fino = quantoSiAspettaLoStato,
  }) async {
    /* Senza sapere com'era non si riconosce il cambiamento; e quello che
     * Home Assistant non raggiunge non cambiera'. */
    if (prima == null || prima == 'unavailable') return null;
    if (_tutta case final casa?) return statoNuovo(casa, id, prima, fino: fino);
    if (_ascolto == null) return null;
    String? diverso() {
      final adesso = _stati[id];
      return adesso != null && adesso != prima ? adesso : null;
    }

    if (diverso() case final gia?) return gia;
    try {
      await _cambi.stream.firstWhere((_) => diverso() != null).timeout(fino);
    } catch (_) {
      return null;
    }
    return diverso();
  }

  /* Un messaggio dell'abbonamento: `a` le entita' con lo stato intero, `c`
   * quello che e' cambiato, `r` quelle che non ci sono piu'. */
  void _prendi(Map<String, dynamic> evento) {
    if (evento['a'] case final Map aggiunte) {
      for (final MapEntry(:key, :value) in aggiunte.entries) {
        if (value is Map && value['s'] is String) {
          _stati['$key'] = value['s'] as String;
        }
      }
    }
    if (evento['c'] case final Map cambiate) {
      for (final MapEntry(:key, :value) in cambiate.entries) {
        final piu = value is Map ? value['+'] : null;
        if (piu is Map && piu['s'] is String) {
          _stati['$key'] = piu['s'] as String;
        }
      }
    }
    if (evento['r'] case final List tolte) {
      for (final id in tolte) {
        _stati.remove('$id');
      }
    }
    if (!_cambi.isClosed) _cambi.add(null);
  }

  Future<void> chiudi() async {
    await _ascolto?.cancel().catchError((Object _) {});
    _ascolto = null;
    if (!_cambi.isClosed) await _cambi.close();
  }
}

/// Guarda [entita] sul filo di [collegamento]. `null` se il filo non ha dato
/// nessun cenno: e' morto, e chi chiama decide se rifarlo.
Future<_Sguardo?> _guarda(
  Collegamento collegamento,
  List<String> entita, {
  required bool serveLoStato,
}) async {
  final filo = collegamento.filo;
  if (filo == null || !filo.dentro) return null;
  final sguardo = _Sguardo();
  final primo = Completer<void>();
  /* Si ascolta nello stesso giro in cui l'abbonamento torna, come fa il
   * navigatore: lo stato di adesso arriva subito dopo il si', e chi si mette
   * in ascolto un attimo dopo lo perde. */
  final abbonamento = filo
      .sottoscrivi({'type': 'subscribe_entities', 'entity_ids': entita})
      .then<void>((flusso) {
        sguardo._ascolto = flusso.listen((evento) {
          sguardo._prendi(evento);
          if (!primo.isCompleted) primo.complete();
        }, onError: (Object _) {});
      });
  try {
    await abbonamento.timeout(quantoSiAspettaUnCenno);
    /* Se lo stato di adesso non arriva il filo e' vivo lo stesso — ha appena
     * risposto — e si va avanti senza. */
    await primo.future.timeout(const Duration(seconds: 1), onTimeout: () {});
    return sguardo;
  } on ComandoRifiutato {
    /* Un ponte di prima: dice di no, ma lo dice — il filo e' vivo. */
    if (serveLoStato) {
      await collegamento.serveLaCasa();
      final casa = collegamento.stato;
      if (casa != null && casa.pieno) sguardo._tutta = casa;
    }
    return sguardo;
  } on TimeoutException {
    /* Se il si' arriva dopo, l'abbonamento non resta li' per nessuno. */
    unawaited(
      abbonamento.then<void>(
        (_) => sguardo.chiudi(),
        onError: (Object _) => sguardo.chiudi(),
      ),
    );
    return null;
  } catch (_) {
    await sguardo.chiudi();
    return null;
  }
}

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
      aggiornaLaFoto ?? auto.aggiornaIlDispositivoNellaFoto,
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
  try {
    collegamento =
        laCasaDellApp?.call() ??
        apriLaCasa?.call() ??
        Collegamento(archivio: ArchivioDelleCase(const CassaforteDelSistema()));
    if (!collegamento.archivio.aperto) await collegamento.archivio.apri();
    if (condiviso && collegamento.aRiposo) collegamento.sveglia();
    /* Su un filo gia' aperto `apri` non fa niente; su uno che dorme o che si
     * sta ricollegando lo rimette in piedi. */
    await collegamento.apri().timeout(quantoSiAspettaIlFilo);
    if (!collegamento.dentro || collegamento.stato == null) {
      return ComeEFinitaInAuto.senzaCasa;
    }
    /* Lo stato di adesso delle entita' del comando, che e' anche la prova
     * che il filo e' vivo: vedi [_Sguardo]. Mai un elenco vuoto: per Home
     * Assistant vorrebbe dire «tutte». */
    final entita = ricetta.leEntita.isEmpty
        ? [ricetta.entita]
        : ricetta.leEntita;
    final serveLoStato = ricetta.servizio == secondoLoStato;
    sguardo = await _guarda(collegamento, entita, serveLoStato: serveLoStato);
    if (sguardo == null && condiviso) {
      /* Il filo dell'app non ha dato un cenno: col telefono in tasca resta
       * «aperto» e non lo e' piu', e `apri` qui sopra gli ha creduto. Si
       * rifa' da capo, come fa l'app quando torna davanti (`main.dart`,
       * `daRifare`), e si riguarda. Il comando non e' ancora partito: non
       * c'e' niente che possa partire due volte. */
      await collegamento.apri(forza: true).timeout(quantoSiAspettaIlFilo);
      if (!collegamento.dentro || collegamento.stato == null) {
        return ComeEFinitaInAuto.senzaCasa;
      }
      sguardo = await _guarda(collegamento, entita, serveLoStato: serveLoStato);
    }
    final stato = collegamento.stato;
    if (stato == null) return ComeEFinitaInAuto.senzaCasa;
    /* Senza sguardo (il filo appena rifatto non ha risposto alla domanda in
     * tempo, o non la capisce) il comando parte lo stesso, come ha sempre
     * fatto: la domanda serve a comandare meglio, non a decidere se
     * comandare. Se il filo non c'e' davvero lo dira' il comando. */
    final unaSola = entita.length == 1 ? entita.single : null;
    final prima = unaSola == null ? null : sguardo?.adesso(unaSola);
    /* Il servizio che dipende da com'e' messa adesso (una serratura, un
     * lettore) si decide qui, con lo stato di adesso in mano. */
    final servizio = serveLoStato
        ? ilServizioDiAdesso(ricetta.dominio, prima)
        : ricetta.servizio;
    await stato.comanda(
      servizio,
      ricetta.entita,
      dominio: ricetta.dominioDaChiamare,
      con: ricetta.dati.isEmpty ? null : {...ricetta.dati},
    );
    /* «Vengono comandati ma non cambiano stato»: al polso la riga restava com'era,
     * perche' la fotografia la riscrive solo la plancia aperta. Lo stato nuovo
     * lo dice Home Assistant, e qui si aspetta — poco — e si corregge. Un
     * gruppo di luci ne porta tante: lo sistemera' la plancia. */
    if (unaSola != null) {
      final dopo = await sguardo?.dopo(unaSola, prima);
      if (dopo != null) {
        await aggiornaLaFoto(unaSola, acceso: eAccesoPerLaFoto(dopo));
      }
    }
    return ComeEFinitaInAuto.fatto;
  } on TimeoutException {
    return ComeEFinitaInAuto.senzaCasa;
  } catch (_) {
    /* Il filo caduto, la casa spenta, Home Assistant che dice di no: in
     * macchina non c'e' niente da mostrare e nessuno da disturbare. Il comando
     * e' gia' stato tolto, quindi non si ripete da solo. */
    return ComeEFinitaInAuto.senzaCasa;
  } finally {
    await sguardo?.chiudi();
    /* Il motore muore subito dopo, ma chiudere il filo e' comunque la cosa
     * giusta: la casa vede una presa che si chiude invece di una che smette
     * di rispondere. Quello dell'app invece resta: e' suo. */
    if (collegamento != null && !condiviso) {
      await collegamento.chiudi().catchError((Object _) {});
    }
  }
}
