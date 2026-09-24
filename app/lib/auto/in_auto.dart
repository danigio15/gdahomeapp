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
  const MethodChannel(canaleDellAuto).setMethodCallHandler((_) async {
    await eseguiIlComandoDellAuto();
    return null;
  });
  await eseguiIlComandoDellAuto();
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
}) async {
  if (_inCorso) return ComeEFinitaInAuto.niente;
  _inCorso = true;
  try {
    return await _esegui(prendiIlComando, leRicette, apriLaCasa);
  } finally {
    _inCorso = false;
  }
}

Future<ComeEFinitaInAuto> _esegui(
  Future<String?> Function()? prendiIlComando,
  Future<List<RicettaDellAzione>> Function()? leRicette,
  Collegamento Function()? apriLaCasa,
) async {
  final segno = await (prendiIlComando ?? auto.prendiIlComandoDellAuto)();
  if (segno == null || segno.isEmpty) return ComeEFinitaInAuto.niente;

  final ricetta = laRicettaDi(
    segno,
    await (leRicette ?? auto.leRicetteDellAuto)(),
  );
  /* Nessuna ricetta vuol dire «questo tasto vuole qualcuno che guardi», e non
   * «questo tasto e' rotto»: si lascia stare, e l'app quando si apre non lo
   * ritrova — il file del comando e' gia' tolto da chi l'ha letto. Eseguirlo
   * qui a naso vorrebbe dire indovinare un servizio, e dall'altra parte c'e'
   * un cancello. */
  if (ricetta == null) return ComeEFinitaInAuto.aspettaLApp;

  Collegamento? collegamento;
  try {
    collegamento =
        apriLaCasa?.call() ??
        Collegamento(archivio: ArchivioDelleCase(const CassaforteDelSistema()));
    await collegamento.archivio.apri();
    await collegamento.apri().timeout(quantoSiAspettaIlFilo);
    final stato = collegamento.stato;
    if (!collegamento.dentro || stato == null) {
      return ComeEFinitaInAuto.senzaCasa;
    }
    await stato.comanda(
      ricetta.servizio,
      ricetta.entita,
      dominio: ricetta.dominio,
      con: ricetta.dati.isEmpty ? null : {...ricetta.dati},
    );
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
     * di rispondere. */
    if (collegamento != null) {
      await collegamento.chiudi().catchError((Object _) {});
    }
  }
}
