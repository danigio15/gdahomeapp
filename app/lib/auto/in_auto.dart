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
    final stato = collegamento.stato;
    if (!collegamento.dentro || stato == null) {
      return ComeEFinitaInAuto.senzaCasa;
    }
    /* Il servizio che dipende da com'e' messa adesso (una serratura, un
     * lettore) si decide qui, con lo stato di adesso in mano. */
    final servizio = ricetta.servizio == secondoLoStato
        ? ilServizioDiAdesso(ricetta.dominio, stato[ricetta.entita]?.stato)
        : ricetta.servizio;
    final prima = stato[ricetta.entita]?.stato;
    await stato.comanda(
      servizio,
      ricetta.entita,
      dominio: ricetta.dominio,
      con: ricetta.dati.isEmpty ? null : {...ricetta.dati},
    );
    /* «Vengono comandati ma non cambiano stato»: al polso la riga restava com'era,
     * perche' la fotografia la riscrive solo la plancia aperta. Lo stato nuovo
     * lo dice Home Assistant, e qui si aspetta — poco — e si corregge. Un
     * gruppo di luci ne porta tante: lo sistemera' la plancia. */
    if (!ricetta.entita.contains(',')) {
      final dopo = await statoNuovo(stato, ricetta.entita, prima);
      if (dopo != null) {
        await aggiornaLaFoto(ricetta.entita, acceso: eAccesoPerLaFoto(dopo));
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
    /* Il motore muore subito dopo, ma chiudere il filo e' comunque la cosa
     * giusta: la casa vede una presa che si chiude invece di una che smette
     * di rispondere. Quello dell'app invece resta: e' suo. */
    if (collegamento != null && !condiviso) {
      await collegamento.chiudi().catchError((Object _) {});
    }
  }
}
