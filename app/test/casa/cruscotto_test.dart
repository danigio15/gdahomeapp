/// Le prove del cruscotto di chi installa, viste dall'app.
///
/// Sono la gemella di quelle della console, e provano la stessa domanda —
/// `ponte/quadro/stato` — che risponde a due cose in una: **dove** si aprono
/// il cruscotto e la gestione, e **con che codice**.
///
/// Il codice e' la parte che, sbagliata, non si vede subito. Sta nella scheda
/// dell'add-on — e' quello che fa esistere la voce — e dentro Home Assistant
/// la pagina non lo richiede: gliela passa la tessera. Nell'app se lo faceva
/// ribattere, perche' l'app aveva solo l'indirizzo: due volte lo stesso
/// codice, e la seconda e' quella che fa pensare che la prima sia andata
/// storta.
///
/// Qui, e non in una prova di schermate: non c'e' niente da disegnare, e una
/// prova che apre un filo vero in tempo vero non ha le corse di una che gira
/// nel tempo finto di un widget.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/cruscotto.dart';
import 'package:gdahome/ponte/filo.dart';

import '../ponte/ponte_finto.dart';

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
    );
    await filo.apri();
  });

  tearDown(() async {
    await filo.chiudi();
    await ponte.spegni();
  });

  test('in una casa qualunque il cruscotto non c\'è', () async {
    final detto = await IlCruscotto(filo).dove();
    expect(detto.cruscotto, '');
    expect(detto.gestione, '');
    expect(detto.chiave, '');
    expect(detto.chiaveGestione, '');
  });

  test('da chi installa esce l\'indirizzo, e il codice che lo apre', () async {
    ponte.lInstallatore = true;
    ponte.ilCodiceDelCruscotto = 'codice-del-cruscotto';

    final detto = await IlCruscotto(filo).dove();
    expect(detto.cruscotto, 'https://quadro.gdahome.org/console/');
    expect(detto.chiave, 'codice-del-cruscotto');
  });

  test('dove il ponte il codice non lo dà, si batte a mano', () async {
    /* E' il caso di chi non amministra quella casa: il ponte vero il codice
     * lo manda **solo** a chi amministra, perche' in Home Assistant quella
     * voce e' riservata a chi amministra e di là c'è l'elenco dei clienti di
     * qualcuno. La voce resta, il codice si ribatte: com'era prima, e non è
     * un guasto. */
    ponte.lInstallatore = true;
    ponte.ilCodiceDelCruscotto = '';

    final detto = await IlCruscotto(filo).dove();
    expect(detto.cruscotto, 'https://quadro.gdahome.org/console/');
    expect(detto.chiave, '');
  });

  test('un codice senza la sua porta non si tiene', () async {
    /* Senza l'indirizzo quel codice non apre niente, e portarselo dietro
     * sarebbe tenerlo in giro per niente. */
    ponte.lInstallatore = false;
    ponte.ilCodiceDelCruscotto = 'un-codice-che-non-apre-niente';

    final detto = await IlCruscotto(filo).dove();
    expect(detto.cruscotto, '');
    expect(detto.chiave, '');
  });
}
