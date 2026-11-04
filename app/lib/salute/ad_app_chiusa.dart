/// La salute ad app chiusa: il telefono sveglia l'app, l'app manda.
///
/// «I dati arrivano solo quando apro l'app.» Era cosi': il postino
/// (`postino_della_salute.dart`) manda quando il filo si apre e ogni quarto
/// d'ora con l'app davanti. Adesso manda anche quando l'app non c'e':
///
/// - **sull'iPhone** la sveglia la da' Salute stessa. L'app osserva i tipi
///   che contano (`daOsservareSuIPhone`): quando ne arriva uno nuovo — i
///   passi della mattina, la notte appena finita, la pesata — iOS sveglia
///   l'app, al piu' una volta l'ora per tipo, e la tiene sveglia il tempo di
///   leggere e mandare (`ios/Runner/LaSaluteAdAppChiusa.swift`). I tempi li
///   decide iOS: con la batteria scarica, o col risparmio energetico, aspetta.
/// - **su Android** la sveglia e' un lavoro di WorkManager ogni mezz'ora,
///   solo con la rete (`LaSaluteAdAppChiusa.kt`). Health Connect vuole un
///   permesso a parte per leggere ad app chiusa
///   (`chiediIlPermessoDaChiusa`): senza, la lettura torna vuota e non si
///   manda niente — resta l'invio ad app aperta.
///
/// La strada verso casa e' quella di sempre: il filo cifrato, dentro casa o
/// dal centralino. Il quarto d'ora vale anche qui, cosi' le richieste al
/// centralino non crescono: al massimo quattro all'ora, ed e' raro.
///
/// **Telefono bloccato.** Sull'iPhone i dati di Salute sono cifrati finche'
/// il telefono resta bloccato: la sveglia arriva, ma leggere non si puo'. Lo
/// dice il telefono stesso (`leggibile`), e allora non si apre nemmeno il
/// filo: si aspetta la prossima sveglia, che a telefono sbloccato arriva.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../casa/collegamento.dart';
import 'il_corpo.dart';
import 'postino_della_salute.dart';

/// Il canale con la parte nativa. Lo stesso nome sta in
/// `LaSaluteAdAppChiusa.swift` e `LaSaluteAdAppChiusa.kt`: sbagliarlo non da'
/// errori, da' una sveglia che suona e nessuno che risponde.
const canaleDellaSveglia = 'gdahome/salute/sveglia';

/// Quanto si aspetta la casa ad app chiusa. iOS concede una trentina di
/// secondi per sveglia, e la parte nativa chiude comunque a 25: aprire il
/// filo e mandare deve stare dentro, con margine.
const quantoSiAspettaLaCasa = Duration(seconds: 18);

/// Una sveglia: legge e manda, se e' il caso. Torna com'e' andata.
///
/// I pezzi si passano da fuori perche' le prove ci mettano i loro.
/// - [laCasa]: il collegamento da usare;
/// - [condiviso]: e' quello dell'app (che non si chiude: al piu' torna a
///   riposo, se l'app non si guarda — [puoRiposare]); altrimenti e' suo, e si
///   chiude alla fine (il motore senza schermo di Android);
/// - [leggibile]: se Salute si lascia leggere adesso (telefono sbloccato).
Future<ComeEAndataDaChiusa> svegliaDellaSalute({
  required PostinoDellaSalute postino,
  required Collegamento Function() laCasa,
  bool condiviso = true,
  bool leggibile = true,
  bool Function()? puoRiposare,
  Duration entro = quantoSiAspettaLaCasa,
}) async {
  final scelte = await postino.carica();
  if (!scelte.acceso || !scelte.adAppChiusa) return ComeEAndataDaChiusa.spenta;
  /* Prima di tutto il resto: una sveglia dentro il quarto d'ora — dall'ultimo
   * invio o dall'ultimo tentativo, andato bene o male — non costa niente, ne'
   * alla batteria ne' al centralino. */
  if (postino.prestoDaChiusa) return ComeEAndataDaChiusa.presto;
  if (!leggibile) return ComeEAndataDaChiusa.bloccato;
  Collegamento? collegamento;
  try {
    /* Il filo si apre solo dopo aver letto qualcosa da mandare
     * ([PostinoDellaSalute.mandaDaChiusaAprendo]). */
    return await postino
        .mandaDaChiusaAprendo(() async {
          final casa = collegamento = laCasa();
          if (!casa.archivio.aperto) await casa.archivio.apri();
          if (condiviso && casa.aRiposo) casa.sveglia();
          /* Su un filo gia' aperto `apri` non fa niente; su uno che dorme o
           * che si sta ricollegando lo rimette in piedi. */
          await casa.apri().timeout(entro);
          return casa.filo;
        })
        .timeout(entro * 2);
  } on TimeoutException {
    return ComeEAndataDaChiusa.senzaCasa;
  } catch (_) {
    return ComeEAndataDaChiusa.senzaCasa;
  } finally {
    final casa = collegamento;
    if (casa != null) {
      if (!condiviso) {
        await casa.chiudi().catchError((Object _) {});
      } else if (puoRiposare?.call() ?? false) {
        /* Il filo dell'app torna a riposo, come quando l'app si lascia: da
         * fuori casa ogni messaggio della casa e' una richiesta al
         * centralino, e nessuno sta guardando. Al ritorno dell'app si
         * risveglia da solo (`main.dart`). */
        await casa.riposa().catchError((Object _) {});
      }
    }
  }
}

/// Cosa dire alla parte nativa: osservare questi tipi (iPhone) o accendere
/// il giro (Android), oppure spegnere tutto. `null` per spegnere.
///
/// Si osserva solo con la salute accesa, l'invio ad app chiusa acceso e il
/// telefono che lo permette ([puoLeggere], `LettoreDellaSalute.puoLeggereDaChiusa`):
/// su Android chi ha negato la lettura in background non deve pagare un
/// motore acceso ogni mezz'ora per leggere niente. Il Premium della casa no:
/// all'avvio la licenza non si sa ancora, e spegnere le sveglie per un «non
/// lo so» vorrebbe dire perderle. Senza Premium la casa dice di no, e le
/// sveglie si fanno rade ([dopoUnNo]).
List<String>? cosaOsservare(
  ScelteDellaSalute scelte, {
  bool puoLeggere = true,
}) {
  if (!scelte.acceso || !scelte.adAppChiusa || !puoLeggere) return null;
  final tipi = daOsservareSuIPhone(scelte.misure).toList()..sort();
  return tipi;
}

/// La sveglia dell'app vera: il canale, e la parte nativa tenuta al passo
/// con le scelte.
class SvegliaDellaSalute {
  SvegliaDellaSalute({
    required this.postino,
    required this.laCasa,
    this.condiviso = true,
    this.puoRiposare,
    MethodChannel? canale,
  }) : _canale = canale ?? const MethodChannel(canaleDellaSveglia);

  final PostinoDellaSalute postino;
  final Collegamento Function() laCasa;
  final bool condiviso;
  final bool Function()? puoRiposare;
  final MethodChannel _canale;

  StreamSubscription<void>? _ascolto;
  String? _detto;

  /// Ascolta le sveglie, e tiene la parte nativa al passo con le scelte.
  void accendi() {
    _canale.setMethodCallHandler(_risposta);
    _ascolto?.cancel();
    _ascolto = postino.cambiamenti.listen((_) => unawaited(_allinea()));
    unawaited(_allinea());
    /* «Ci sono»: le sveglie arrivate mentre il Dart partiva aspettavano
     * questo (sull'iPhone l'app svegliata da Salute parte da zero). */
    unawaited(_chiama('pronto'));
  }

  void spegni() {
    _ascolto?.cancel();
    _ascolto = null;
  }

  Future<Object?> _risposta(MethodCall chiamata) async {
    if (chiamata.method != 'sveglia') return null;
    final argomenti = chiamata.arguments;
    final leggibile = argomenti is Map ? argomenti['leggibile'] != false : true;
    final come = await svegliaDellaSalute(
      postino: postino,
      laCasa: laCasa,
      condiviso: condiviso,
      leggibile: leggibile,
      puoRiposare: puoRiposare,
    );
    return come.name;
  }

  Future<void> _allinea() async {
    final scelte = await postino.carica();
    var puoLeggere = false;
    if (scelte.acceso && scelte.adAppChiusa) {
      try {
        puoLeggere = await postino.lettore.puoLeggereDaChiusa();
      } catch (_) {}
    }
    final tipi = cosaOsservare(scelte, puoLeggere: puoLeggere);
    final detto = tipi == null ? '' : tipi.join(',');
    if (detto == _detto) return;
    _detto = detto;
    final ok = tipi == null
        ? await _chiama('spegni')
        : await _chiama('osserva', {'tipi': tipi});
    /* Non arrivato: si ridice al prossimo cambiamento. */
    if (!ok) _detto = null;
  }

  Future<bool> _chiama(String metodo, [Object? argomenti]) async {
    try {
      await _canale.invokeMethod<void>(metodo, argomenti);
      return true;
    } on MissingPluginException {
      /* Il browser, le prove: nessuna parte nativa. */
      return true;
    } catch (e) {
      debugPrint('salute ad app chiusa: $metodo non arrivato: $e');
      return false;
    }
  }
}
