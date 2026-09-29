/// Quando il filo si chiude perché nessuno sta guardando.
///
/// Segnalato da chi usa gdahome dal browser: «mentre sei nella plancia ogni
/// tanto va in caricamento». Nel browser la plancia è un `iframe`, e toccarla
/// toglie il fuoco alla pagina che la ospita: Flutter dice `inactive`, che è
/// la stessa parola di una telefonata sul telefono. Contandolo come «se n'è
/// andata», dopo mezzo minuto dentro la plancia il filo si chiudeva — e
/// l'app, sopra una plancia che funzionava, scriveva «sto cercando la casa».
library;

import 'dart:io';

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
  int aperture = 0;

  @override
  Future<void> riposa() async => riposi += 1;

  @override
  void sveglia() => svegliate += 1;

  /* Si conta e si lascia fare: e' `apri` a segnare che il filo e' avviato, e
   * senza quel segno chi lo apre due volte lo rifarebbe. Con l'archivio vuoto
   * non c'e' nessuna casa da raggiungere, quindi non si va in rete. */
  @override
  Future<void> apri({bool forza = false}) async {
    aperture += 1;
    await super.apri(forza: forza);
  }
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

  test('il filo lo apre anche chi non ha uno schermo: la macchina', () async {
    /* «I dati auto arrivano solo dopo aver aperto l'app sullo smartphone, e
     * se si chiude non si vedono più.»
     *
     * Il filo lo apriva la schermata, nel suo `initState`. In macchina quella
     * schermata può non esserci: Android Auto tiene su il PROCESSO dell'app —
     * il servizio dell'auto gira lì dentro — ma non la parte che disegna, e
     * sta scritto nero su bianco in `auto/in_auto.dart`, che esiste proprio
     * per questo. Il motore partiva, `main` girava, e il filo non lo apriva
     * nessuno: la batteria che gdanav mostra in macchina restava quella di
     * prima di partire, e la sveglia era l'app aperta a mano.
     *
     * Questa prova non disegna niente apposta: è il caso della macchina. */
    final filo = _CollegamentoSpia();
    await apriIlFiloConLaCasa(filo);
    expect(filo.archivio.aperto, isTrue, reason: 'prima si apre l\'archivio');
    expect(filo.aperture, 1, reason: 'poi la casa attiva');
    expect(
      filo.svegliate,
      0,
      reason: 'aprire non e\' bussare: un filo appena aperto e\' gia\' sveglio',
    );
  });

  test('aprirlo due volte non lo rifà', () async {
    /* In macchina lo apre il servizio dell'auto; poi, se l'app si apre
     * davvero, ci prova anche la schermata. Un filo che funziona non si butta
     * giù e non si rifà. */
    final filo = _CollegamentoSpia();
    await apriIlFiloConLaCasa(filo);
    await apriIlFiloConLaCasa(filo);
    expect(filo.aperture, 1);
  });

  test('e chi sale in macchina lo apre, per tutt\'e due le strade', () {
    /* Questa legge il sorgente, e non e' pigrizia: toccare davvero
     * `ascoltaLAuto` vuol dire far partire gdanav — il navigatore, il GPS, le
     * mappe — dentro una prova che non ha nessun telefono sotto. Quello che
     * conta e' che il filo si apra da tutt'e due le porte, e le porte sono
     * due perche' la macchina puo' arrivare prima del Dart: il colpetto
     * «accendi», e la domanda «comeSta» che il Dart fa da se' appena parte.
     * La terza riga e' quella che le lega a `main`. */
    final ponte = File('lib/schermate/navigatore_qui/sul_telefono.dart')
        .readAsStringSync();
    final dentro = ponte.substring(ponte.indexOf('void ascoltaLAuto('));
    expect(
      RegExp(r'inMacchinaAdesso\(\);').allMatches(dentro).length,
      2,
      reason: 'il colpetto «accendi» e la domanda «comeSta»',
    );
    expect(
      dentro,
      contains('if (apriIlFilo != null) unawaited(apriIlFilo());'),
    );
    /* E aprirlo non basta: l'auto della plancia dal filo la leggeva la
     * schermata del navigatore, che in macchina puo' non esserci. La segue
     * anche l'auto, e la lascia quando si scende. */
    expect(
      dentro,
      contains('if (laCasa != null) _seguiLaCasa(_perLAuto, laCasa());'),
    );
    expect(dentro, contains('_lasciaLaCasa(_perLAuto);'));
    final main = File('lib/main.dart').readAsStringSync();
    final chiamata = main.substring(main.indexOf('navigatore.ascoltaLAuto('));
    expect(
      chiamata.substring(0, chiamata.indexOf(');')),
      allOf(
        contains('apriIlFilo: apriIlFiloConLaCasa'),
        contains('laCasa: ilFiloConLaCasa'),
      ),
      reason: 'senza questa riga la macchina non sa come aprirlo',
    );
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
