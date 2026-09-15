/// Le prove della cucitura senza un trasporto sotto, e dell'attesa del filo.
///
/// La cucitura vive in due posti: sul telefono sotto un WebSocket vero
/// (`servitore_test.dart` la prova cosi'), e nel browser fra due pagine, dove
/// un WebSocket non c'e'. Le regole che questo file tiene ferme sono quelle
/// che nel browser si sono viste sbagliate:
///
///  - `auth_ok` si dice **quando il filo e' dentro**, non quando c'e'. Un filo
///    che sta ancora bussando non e' un filo, e la plancia che ci crede chiede
///    gli stati e si trova la porta chiusa: pallino verde un istante, poi
///    rosso, e da capo ogni cinque secondi;
///  - una cucitura si puo' **abbandonare** senza dire niente alla pagina.
///    Serve quando la pagina di prima non c'e' piu' e al suo posto ce n'e' una
///    nuova: dirle di chiudere vorrebbe dire chiudere il WebSocket di quella
///    nuova, che nel browser vive nello stesso posto.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/cucitura.dart';
import 'package:gdahome/ponte/filo.dart';

import '../ponte/ponte_finto.dart';

/// Una pagina finta: tiene quello che le arriva, e si ricorda se le e' stato
/// detto di chiudere.
class _PaginaFinta implements VersoLaPagina {
  final arrivati = <Map<String, dynamic>>[];
  bool chiusa = false;

  @override
  bool get aperta => !chiusa;

  @override
  void manda(Uint8List byte) =>
      arrivati.add(jsonDecode(utf8.decode(byte)) as Map<String, dynamic>);

  @override
  Future<void> chiudi() async => chiusa = true;
}

void main() {
  late PonteFinto ponte;
  late Filo filo;

  setUp(() async {
    ponte = await PonteFinto.alza();
    filo = Filo.fisso(
      indirizzo: ponte.indirizzo,
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
      attesaMassima: const Duration(milliseconds: 80),
    );
  });

  tearDown(() async {
    await filo.chiudi();
    await ponte.spegni();
  });

  test('il filo pronto è quello dentro, e senza filo si smette', () async {
    /* Nessun filo: si aspetta quel poco e si dice che non c'e' verso. */
    expect(
      await filoPronto(() => null, entro: const Duration(milliseconds: 120)),
      isNull,
    );

    /* Un filo che c'e' ma non e' ancora dentro **non** e' pronto: e' il caso
     * della pagina che si apre mentre l'app sta ancora bussando, ed e' quello
     * che faceva dire `auth_ok` a vuoto. */
    expect(filo.dentro, isFalse);
    expect(
      await filoPronto(() => filo, entro: const Duration(milliseconds: 120)),
      isNull,
    );

    /* Aperto, e' lui. */
    await filo.apri();
    expect(await filoPronto(() => filo), same(filo));
  });

  test('il filo arriva dopo, e la cucitura lo aspetta', () async {
    final pagina = _PaginaFinta();
    final cucitura = Cucitura(pagina, () => filoPronto(() => filo));
    unawaited(cucitura.avvia());
    /* Il filo non c'e' ancora: niente `auth_ok`, e niente detto alla pagina.
     * Prima qui arrivava `auth_ok` subito. */
    await Future<void>.delayed(const Duration(milliseconds: 150));
    expect(pagina.arrivati, isEmpty);
    expect(pagina.chiusa, isFalse);

    await filo.apri();
    await _finoA(() => pagina.arrivati.isNotEmpty);
    expect(pagina.arrivati.single['type'], 'auth_ok');

    await cucitura.chiudi();
    expect(pagina.chiusa, isTrue);
  });

  test('abbandonare non dice niente alla pagina', () async {
    await filo.apri();
    final pagina = _PaginaFinta();
    final cucitura = Cucitura(pagina, () => filoPronto(() => filo));
    final finita = cucitura.avvia();
    await _finoA(() => pagina.arrivati.isNotEmpty);
    expect(pagina.arrivati.single['type'], 'auth_ok');

    /* Si abbandona: la cucitura e' finita — chi aspettava `avvia()` lo sa —
     * e alla pagina non e' stato detto niente. Nel browser quel «chiudi»
     * andrebbe a tutti i riquadri, cioe' anche a quello nuovo che ha appena
     * preso il posto di questo. */
    await cucitura.abbandona();
    await finita.timeout(const Duration(seconds: 2));
    expect(pagina.chiusa, isFalse);
    expect(pagina.arrivati, hasLength(1));

    /* E non instrada piu' niente: un messaggio della pagina vecchia, arrivato
     * in ritardo, non deve finire sul filo con i numeri di nessuno. */
    final prima = ponte.arrivati.length;
    await cucitura.dallaPagina(jsonEncode({'id': 9, 'type': 'get_states'}));
    await Future<void>.delayed(const Duration(milliseconds: 100));
    expect(ponte.arrivati.length, prima);
  });
}

Future<void> _finoA(
  bool Function() condizione, {
  Duration entro = const Duration(seconds: 5),
}) async {
  final fine = DateTime.now().add(entro);
  while (DateTime.now().isBefore(fine)) {
    if (condizione()) return;
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
  throw StateError('l\'attesa è scaduta');
}
