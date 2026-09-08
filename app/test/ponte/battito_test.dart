/// Il filo che muore senza cadere.
///
/// E' il guasto che nessuna prova vede, se i fili si chiudono per bene: fra il
/// telefono e la casa ci sono un router e spesso un centralino, e una
/// corrispondenza di rete che nessuno usa sparisce dopo qualche minuto senza
/// che nessuno dei due capi riceva niente. Qui la casa non chiude e non
/// risponde: tace. L'app deve accorgersene da sola e ricominciare, invece di
/// restare a mostrare dati vecchi credendosi collegata.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/ponte/filo.dart';

import 'ponte_finto.dart';

Filo _unFilo(PonteFinto ponte) => Filo.fisso(
  indirizzo: ponte.indirizzo,
  segno: segnoBuono,
  chi: chiBuono,
  chiave: chiaveBuona,
  /* Tempi da prova: si aspettano millesimi, non minuti. */
  battito: const Duration(milliseconds: 40),
  silenzioMassimo: const Duration(milliseconds: 130),
  attesaMassima: const Duration(milliseconds: 60),
);

Future<void> _respira(int quanti) =>
    Future<void>.delayed(Duration(milliseconds: quanti));

void main() {
  test('una casa che risponde ai colpetti tiene il filo su', () async {
    final ponte = await PonteFinto.alza();
    final filo = _unFilo(ponte);
    await filo.apri();

    await _respira(300);

    expect(filo.dentro, isTrue, reason: 'il filo doveva restare su');
    expect(ponte.collegamenti, 1, reason: 'non c\'era niente da ribussare');
    final colpetti = ponte.arrivati.where((m) => m['type'] == 'ping').length;
    expect(colpetti, greaterThanOrEqualTo(3));

    await filo.chiudi();
    await ponte.spegni();
  });

  test('una casa che tace, senza chiudere niente, fa ribussare', () async {
    final ponte = await PonteFinto.alza();
    final filo = _unFilo(ponte);
    await filo.apri();
    expect(filo.dentro, isTrue);

    /* Prima risponde — cosi' si sa che quella casa saprebbe farlo — e poi
     * tace, come farebbe un router che ha buttato via la sua riga. Non chiude
     * niente: e' tutto il punto. */
    await _respira(120);
    ponte.muto = true;
    await _respira(400);

    expect(
      ponte.collegamenti,
      greaterThan(1),
      reason: 'il filo morto doveva essere chiuso e ribussato',
    );

    await filo.chiudi();
    await ponte.spegni();
  });

  test('una casa che non risponde ai colpetti non si butta giu\'', () async {
    /* Home Assistant a `ping` risponde da sempre, ma una casa che non lo
     * facesse non e' una casa morta: buttare giu' un filo che funziona
     * sarebbe peggio del guasto che si sta cercando di prevenire. */
    final ponte = await PonteFinto.alza();
    ponte.muto = true;
    final filo = _unFilo(ponte);
    await filo.apri();

    await _respira(400);

    expect(filo.dentro, isTrue, reason: 'il filo doveva restare su');
    expect(ponte.collegamenti, 1, reason: 'non si doveva ribussare');

    await filo.chiudi();
    await ponte.spegni();
  });
}
