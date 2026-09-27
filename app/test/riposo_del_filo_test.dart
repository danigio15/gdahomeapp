/// Quando il filo si chiude perché nessuno sta guardando.
///
/// Segnalato da chi usa gdahome dal browser: «mentre sei nella plancia ogni
/// tanto va in caricamento». Nel browser la plancia è un `iframe`, e toccarla
/// toglie il fuoco alla pagina che la ospita: Flutter dice `inactive`, che è
/// la stessa parola di una telefonata sul telefono. Contandolo come «se n'è
/// andata», dopo mezzo minuto dentro la plancia il filo si chiudeva — e
/// l'app, sopra una plancia che funzionava, scriveva «sto cercando la casa».
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/casa/impostazioni.dart';
import 'package:gdahome/main.dart';
import 'package:gdahome/schermate/navigatore_qui/qui.dart' as navigatore;

/// Un collegamento che segna quante volte lo si è mandato a riposo.
class _CollegamentoSpia extends Collegamento {
  _CollegamentoSpia()
    : super(archivio: ArchivioDelleCase(CassaforteInMemoria()));

  int riposi = 0;
  int svegliate = 0;

  @override
  Future<void> riposa() async => riposi += 1;

  @override
  void sveglia() => svegliate += 1;
}

void main() {
  test('solo «non si vede più» chiude il filo', () {
    // Il fuoco perso non basta: sul web lo perde anche chi sta toccando la
    // plancia dentro il riquadro.
    expect(nonSiGuardaPiu(AppLifecycleState.inactive), isFalse);
    expect(nonSiGuardaPiu(AppLifecycleState.resumed), isFalse);

    expect(nonSiGuardaPiu(AppLifecycleState.hidden), isTrue);
    expect(nonSiGuardaPiu(AppLifecycleState.paused), isTrue);
    expect(nonSiGuardaPiu(AppLifecycleState.detached), isTrue);
  });

  testWidgets('nella plancia il filo resta aperto', (tester) async {
    final collegamento = _CollegamentoSpia();
    final impostazioni = Impostazioni(
      sulTelefono: true,
      android: true,
      dispensa: DispensaInMemoria(),
    );
    await impostazioni.carica();
    await tester.pumpWidget(
      MaterialApp(
        home: Portone(
          cassaforte: CassaforteInMemoria(),
          collegamento: collegamento,
          impostazioni: impostazioni,
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Si tocca la plancia: il fuoco passa all'`iframe`. Passa mezzo minuto
    // buono — e anche il doppio — e il filo non si tocca.
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await tester.pump(quantoSiAspettaPrimaDiRiposare * 2);
    expect(collegamento.riposi, 0);

    // La scheda finisce dietro le altre: lì sì. Non subito, però — chi guarda
    // un messaggio e torna non deve rifare la strada da capo.
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    await tester.pump(quantoSiAspettaPrimaDiRiposare ~/ 2);
    expect(collegamento.riposi, 0);
    await tester.pump(quantoSiAspettaPrimaDiRiposare);
    expect(collegamento.riposi, 1);

    // E tornando si risveglia. Ci si passa da `inactive`: `dart:ui` non
    // ammette il salto da «nascosta» a «davanti», e il sistema lo fa fare.
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    expect(collegamento.svegliate, greaterThan(0));
  });

  testWidgets('in macchina il filo non va a riposo', (tester) async {
    /* Dal campo, con la foto dello schermo dell'auto: «i dati batteria non si
     * aggiornano fino a che non apro app dal cellulare».
     *
     * La batteria che gdanav mostra in macchina la prende dalla sezione Auto
     * della plancia, e quella la riempie questo filo. Il filo si chiude da
     * solo quando l'app non si guarda più — e col telefono in tasca e Android
     * Auto acceso l'app non si guarda mai: il numero restava quello di prima
     * di partire, e aprire l'app sul telefono era la sveglia. */
    final collegamento = _CollegamentoSpia();
    final impostazioni = Impostazioni(
      sulTelefono: true,
      android: true,
      dispensa: DispensaInMemoria(),
    );
    await impostazioni.carica();
    addTearDown(() => navigatore.inMacchina.value = false);
    await tester.pumpWidget(
      MaterialApp(
        home: Portone(
          cassaforte: CassaforteInMemoria(),
          collegamento: collegamento,
          impostazioni: impostazioni,
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Il telefono va in tasca e si sale in macchina.
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    navigatore.inMacchina.value = true;
    await tester.pump(quantoSiAspettaPrimaDiRiposare * 3);
    expect(
      collegamento.riposi,
      0,
      reason: 'in macchina lo schermo dell\'auto sta guardando',
    );
    expect(
      collegamento.svegliate,
      greaterThan(0),
      reason: 'e se il filo dormiva già, salendo si sveglia',
    );

    // Si scende, col telefono ancora in tasca: da lì il conto riparte.
    navigatore.inMacchina.value = false;
    await tester.pump(quantoSiAspettaPrimaDiRiposare ~/ 2);
    expect(collegamento.riposi, 0);
    await tester.pump(quantoSiAspettaPrimaDiRiposare);
    expect(collegamento.riposi, 1);
  });
}
