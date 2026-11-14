/// «Il menu laterale fa un glitch, e' come se caricasse due volte.»
///
/// Segnalato con un video su Android (GdAHome 1.19.3): toccati i tre trattini
/// della plancia, il menu compariva **di colpo** — la chiusura invece
/// scivolava — e subito dopo sembrava sparire e ricomparire, con la tessera di
/// GdANav e le mattonelle che si ridisegnavano.
///
/// Qui si prova quello che c'era sotto, una cosa per prova:
///
///  - l'entrata e l'uscita sono **la stessa animazione**, una lo specchio
///    dell'altra, e partono piano: un primo fotogramma in ritardo non si
///    mangia meta' della strada;
///  - il menu e' **pronto prima** di aprirsi, e mentre entra non si rifa':
///    prima si costruiva da zero proprio al primo fotogramma, e poi di nuovo a
///    ogni fotogramma dell'animazione;
///  - la casa (l'elenco delle plance) si richiede **una volta**, a menu fermo:
///    la risposta fa ridisegnare tutta l'app, e a meta' animazione era il menu
///    che si rifaceva mentre entrava;
///  - lo stesso tocco detto due volte **apre una volta sola**;
///  - e la plancia — composta dal sistema — non esce piu' dalla scena appena
///    il menu e' aperto: la striscia scoperta a destra cambiava sotto gli
///    occhi. Esce solo se l'elenco lo si fa scorrere, che e' il motivo per cui
///    esce.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/schermate/barra.dart';
import 'package:gdahome/schermate/da_parte.dart';
import 'package:gdahome/schermate/menu.dart';
import 'package:gdahome/vestito/oggetti.dart';

/// Una casa che non si collega a niente, e conta quante volte le si chiede
/// di rileggere le plance.
class _Casa extends Collegamento {
  _Casa() : super(archivio: ArchivioDelleCase(CassaforteInMemoria()));

  int riletture = 0;

  @override
  Future<void> rileggiLaPlancia() async => riletture += 1;
}

class _DaParteFinta extends LaPlanciaDaParte {
  final List<bool> coperta = [];

  @override
  void siFaDaParte(bool si) {}

  @override
  void copertaDelTutto(bool si) => coperta.add(si);
}

const _laTessera = Key('tessera');

/// Larghezza dello schermo delle prove: il pannello e' largo questo meno la
/// striscia di pagina (44).
const double _schermo = 400;
const double _largo = _schermo - 44;

Future<(GlobalKey<BarraDelleSezioniState>, _Casa, _DaParteFinta)> _monta(
  WidgetTester prova,
) async {
  prova.view.physicalSize = const Size(_schermo, 800);
  prova.view.devicePixelRatio = 1;
  addTearDown(prova.view.reset);
  final chiave = GlobalKey<BarraDelleSezioniState>();
  final casa = _Casa();
  final daParte = _DaParteFinta();
  await prova.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Stack(
          children: [
            BarraDelleSezioni(
              key: chiave,
              sezioni: vociDellaBarra(),
              aperta: Sezione.plancia,
              vai: (_) {},
              vaiAlleCase: () {},
              collegamento: casa,
              sopraLaPlancia: true,
              daParte: daParte,
              tessera: const SizedBox(key: _laTessera, height: 150),
            ),
          ],
        ),
      ),
    ),
  );
  return (chiave, casa, daParte);
}

/// Dov'e' il pannello: il bordo sinistro della casella per cercare.
double _dove(WidgetTester prova) => prova.getTopLeft(find.byType(TextField)).dx;

void main() {
  testWidgets('entra con la stessa animazione con cui esce, e parte piano', (
    prova,
  ) async {
    final (chiave, _, _) = await _monta(prova);
    const passi = [50, 100, 150, 200, 250];

    chiave.currentState!.apri();
    await prova.pump();
    await prova.pump(const Duration(milliseconds: 16));
    final primo = _dove(prova);
    final entrata = <double>[];
    var trascorso = 16;
    for (final quando in passi) {
      await prova.pump(Duration(milliseconds: quando - trascorso));
      trascorso = quando;
      entrata.add(_dove(prova));
    }
    await prova.pumpAndSettle();
    /* Da qui in poi, quanto e' entrato: 0 fuori, 1 al suo posto. */
    final alSuoPosto = _dove(prova);
    double quanto(double dove) => 1 + (dove - alSuoPosto) / _largo;

    chiave.currentState!.chiudi();
    await prova.pump();
    final uscita = <double>[];
    trascorso = 0;
    for (final quando in passi) {
      await prova.pump(Duration(milliseconds: quando - trascorso));
      trascorso = quando;
      uscita.add(_dove(prova));
    }
    await prova.pumpAndSettle();

    expect(
      quanto(primo),
      lessThan(0.05),
      reason:
          'al primo fotogramma il pannello deve essersi appena mosso: '
          'se no basta un fotogramma in ritardo e compare di colpo',
    );
    /* L'uscita e' l'entrata girata al contrario: dove l'entrata e' a 50 ms
     * dalla partenza, l'uscita e' a 50 ms dalla fine — i passi sono messi a
     * specchio attorno a meta' corsa. */
    for (var i = 0; i < passi.length; i += 1) {
      final allIndietro = quanto(entrata[passi.length - 1 - i]);
      expect(
        quanto(uscita[i]),
        closeTo(allIndietro, 0.02),
        reason:
            'a ${passi[i]} ms dall\'inizio della chiusura il pannello '
            '(${quanto(uscita[i]).toStringAsFixed(2)}) dev\'essere dove '
            'l\'apertura era a ${passi[i]} ms dalla fine '
            '(${allIndietro.toStringAsFixed(2)})',
      );
    }
  });

  testWidgets('è pronto prima di aprirsi, e mentre entra non si rifà', (
    prova,
  ) async {
    final (chiave, _, _) = await _monta(prova);

    /* Chiuso c'e' gia', fuori scena: non si legge e non si tocca. */
    expect(
      find.text(Sezione.aggiornamenti.titolo, skipOffstage: false),
      findsOneWidget,
      reason: 'il menu deve essere pronto prima di aprirsi',
    );
    expect(
      find.text(Sezione.aggiornamenti.titolo),
      findsNothing,
      reason: 'chiuso, il menu non si legge sopra la pagina',
    );

    var rifatte = 0;
    debugOnRebuildDirtyWidget = (elemento, _) {
      if (elemento.widget is Oggetto) rifatte += 1;
    };
    addTearDown(() => debugOnRebuildDirtyWidget = null);

    final altezze = <double>{};
    chiave.currentState!.apri();
    for (var i = 0; i < 30; i += 1) {
      await prova.pump(const Duration(milliseconds: 16));
      altezze.add(
        prova.getSize(find.byKey(_laTessera, skipOffstage: false)).height,
      );
    }
    await prova.pumpAndSettle();

    expect(
      rifatte,
      0,
      reason: 'le mattonelle si rifacevano a ogni fotogramma dell\'apertura',
    );
    expect(altezze, {150}, reason: 'niente salti di altezza mentre entra');
  });

  testWidgets('la casa si richiede una volta, a menu fermo', (prova) async {
    final (chiave, casa, _) = await _monta(prova);

    chiave.currentState!.apri();
    await prova.pump();
    await prova.pump(const Duration(milliseconds: 100));
    expect(
      casa.riletture,
      0,
      reason: 'la risposta ridisegna l\'app: non mentre il menu entra',
    );
    await prova.pumpAndSettle();
    expect(casa.riletture, 1);
  });

  testWidgets('lo stesso tocco detto due volte apre una volta sola', (
    prova,
  ) async {
    final (chiave, casa, _) = await _monta(prova);

    /* Due «gdahome:menu» uno dietro l'altro. */
    chiave.currentState!.apri();
    await prova.pump(const Duration(milliseconds: 30));
    chiave.currentState!.apri();
    await prova.pumpAndSettle();
    expect(casa.riletture, 1);

    /* E un doppione che arriva dopo che il menu si e' cominciato a
     * chiudere — aperto, toccata la striscia a destra, e il secondo messaggio
     * arriva solo adesso — non lo riapre. */
    chiave.currentState!.chiudi();
    await prova.pumpAndSettle(const Duration(milliseconds: 100));
    await prova.pump(const Duration(seconds: 1));
    expect(chiave.currentState!.aperta, isFalse);

    chiave.currentState!.apri();
    await prova.pump(const Duration(milliseconds: 200));
    chiave.currentState!.chiudi();
    await prova.pump(const Duration(milliseconds: 100));
    chiave.currentState!.apri();
    await prova.pumpAndSettle();
    expect(
      chiave.currentState!.aperta,
      isFalse,
      reason: 'un doppione ravvicinato non riapre il menu che si chiude',
    );

    /* Passato il momento, chi lo chiede lo riapre. */
    await prova.pump(const Duration(seconds: 1));
    chiave.currentState!.apri();
    await prova.pumpAndSettle();
    expect(chiave.currentState!.aperta, isTrue);
  });

  testWidgets('la plancia esce di scena solo se si fa scorrere il menu', (
    prova,
  ) async {
    final (chiave, _, daParte) = await _monta(prova);

    chiave.currentState!.apri();
    await prova.pumpAndSettle();
    expect(
      daParte.coperta,
      isEmpty,
      reason: 'appena aperto, la striscia di plancia non deve cambiare',
    );

    await prova.drag(
      find.text(Sezione.configurazione.titolo),
      const Offset(0, -200),
    );
    await prova.pumpAndSettle();
    expect(daParte.coperta, [true]);

    chiave.currentState!.chiudi();
    await prova.pumpAndSettle();
    expect(daParte.coperta, [true, false]);
  });
}
