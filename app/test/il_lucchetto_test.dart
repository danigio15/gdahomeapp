/// La scheda «Il lucchetto»: cosa si vede, e cosa succede accendendo (#54).
///
/// La prova che conta di più è la prima: **accendere il lucchetto lo fa
/// provare subito**. Un interruttore che si accende e basta è un interruttore
/// che si scopre rotto alla prossima apertura dell'app — col telefono in mano,
/// davanti a un'app che non si apre, e nessuna voglia di capire perché.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/casa/il_lucchetto.dart';
import 'package:gdahome/casa/impostazioni.dart';
import 'package:gdahome/casa/la_guardia.dart';
import 'package:gdahome/schermate/il_lucchetto.dart';
import 'package:gdahome/vestito/tema.dart';

/// Una guardia che risponde quello che le si dice.
class _GuardiaFinta implements LaGuardia {
  Set<ComeRiconosce> sa = const {ComeRiconosce.volto, ComeRiconosce.impronta};
  bool ceUnaGuardia = true;
  ComeEAndata risponde = ComeEAndata.si;

  /// Le domande fatte, con il perché di ognuna: è quello che si prova.
  final chieste = <String>[];

  @override
  Future<CosaSaFareIlTelefono> cosaSaFare() async =>
      CosaSaFareIlTelefono(sa: sa, ceUnaGuardiaDelSistema: ceUnaGuardia);

  @override
  Future<ComeEAndata> chiedi({required String perche}) async {
    chieste.add(perche);
    return risponde;
  }
}

void main() {
  late Impostazioni impostazioni;
  late _GuardiaFinta guardia;

  setUp(() async {
    impostazioni = Impostazioni(
      sulTelefono: true,
      android: true,
      dispensa: DispensaInMemoria(),
    );
    await impostazioni.carica();
    guardia = _GuardiaFinta();
  });

  Future<void> apri(WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: temaChiaro(),
        home: SchermataDelLucchetto(
          impostazioni: impostazioni,
          guardia: guardia,
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  /// Scorre fino a una riga e poi la preme.
  ///
  /// La scheda è un elenco che scorre, e quello che sta sotto la piega una
  /// `ListView` non lo costruisce nemmeno: cercarlo lì fallisce con «zero
  /// widget», che sembra un pezzo che manca e invece è un pezzo che non si
  /// vede.
  Future<void> fino(WidgetTester tester, Finder cosa) async {
    await tester.scrollUntilVisible(
      cosa,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
  }

  testWidgets('si apre spenta, e dice cosa sa fare il telefono', (
    tester,
  ) async {
    await apri(tester);
    expect(find.text('Chiedilo quando apro l\'app'), findsOneWidget);
    expect(find.text('Volto'), findsOneWidget);
    expect(find.text('Impronta'), findsOneWidget);
    expect(find.text('Questo telefono ce l\'ha'), findsNWidgets(2));
    expect(impostazioni.lucchetto.allAvvio, isFalse);
  });

  testWidgets('quello che il telefono non ha è grigio e fermo', (tester) async {
    /* Acceso su una cosa che non esiste sarebbe una preferenza che non
     * succede, e chi la accende crederebbe di aver fatto qualcosa. */
    guardia.sa = {ComeRiconosce.impronta};
    await apri(tester);
    expect(find.text('Questo telefono non ce l\'ha'), findsOneWidget);
    final volto = tester.widget<SwitchListTile>(
      find.widgetWithText(SwitchListTile, 'Volto'),
    );
    expect(volto.onChanged, isNull);
    expect(volto.value, isFalse);
  });

  testWidgets('accendere il lucchetto lo fa provare subito', (tester) async {
    await apri(tester);
    await tester.tap(find.text('Chiedilo quando apro l\'app'));
    await tester.pumpAndSettle();

    expect(guardia.chieste, hasLength(1));
    expect(guardia.chieste.first, contains('aprire gdahome'));
    expect(impostazioni.lucchetto.allAvvio, isTrue);
    /* E con lui si accendono i due momenti suggeriti: sono le due cose che da
     * un telefono trovato aperto non si disfano. */
    expect(impostazioni.lucchetto.prima, {
      PrimaDi.ilCruscotto,
      PrimaDi.togliereUnaCasa,
    });
  });

  testWidgets('e se la prova non passa, non si accende niente', (tester) async {
    /* È il caso per cui questa prova esiste: senza, si accendeva un lucchetto
     * che non si sarebbe mai più aperto. */
    guardia.risponde = ComeEAndata.no;
    await apri(tester);
    await tester.tap(find.text('Chiedilo quando apro l\'app'));
    await tester.pumpAndSettle();

    expect(guardia.chieste, hasLength(1));
    expect(impostazioni.lucchetto.allAvvio, isFalse);
  });

  testWidgets('col lucchetto già acceso non si riprova a ogni levetta', (
    tester,
  ) async {
    /* La prova serve a non chiudersi fuori la prima volta. Da lì in poi il
     * lucchetto è già stato aperto, e rifarlo a ogni interruttore sarebbe una
     * richiesta di sistema per ogni tocco. */
    await impostazioni.metti(lucchetto: const IlLucchetto(allAvvio: true));
    await apri(tester);
    await tester.tap(find.text('Anche quando ci torno'));
    await tester.pumpAndSettle();

    expect(guardia.chieste, isEmpty);
    expect(impostazioni.lucchetto.alRitorno, isTrue);
  });

  testWidgets('spegnere un lucchetto acceso lo chiede', (tester) async {
    /* Prima si spegneva con una levetta, senza chiedere niente: chi trovava
     * il telefono aperto lo toglieva, e alla prossima apertura l'app era
     * sua. */
    await impostazioni.metti(lucchetto: const IlLucchetto(allAvvio: true));
    await apri(tester);
    await tester.tap(find.text('Chiedilo quando apro l\'app'));
    await tester.pumpAndSettle();
    expect(guardia.chieste, hasLength(1));
    expect(impostazioni.lucchetto.allAvvio, isFalse);
  });

  testWidgets('e se non si passa, resta acceso', (tester) async {
    guardia.risponde = ComeEAndata.no;
    await impostazioni.metti(
      lucchetto: const IlLucchetto(
        allAvvio: true,
        prima: {PrimaDi.ilCruscotto},
      ),
    );
    await apri(tester);
    await tester.tap(find.text('Chiedilo quando apro l\'app'));
    await tester.pumpAndSettle();
    expect(impostazioni.lucchetto.allAvvio, isTrue);

    /* Lo stesso per il volto e l'impronta: spenti tutti e due, il lucchetto
     * non avrebbe piu' con cosa chiedere. */
    await tester.tap(find.text('Volto'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Impronta'));
    await tester.pumpAndSettle();
    expect(impostazioni.lucchetto.acceso, isTrue);
    expect(guardia.chieste, isNotEmpty);
  });

  testWidgets(
    'un telefono che non sa piu\' rispondere il lucchetto lo toglie',
    (tester) async {
      /* E' il caso in cui l'app all'apertura entra lo stesso: un lucchetto che
     * non si puo' ne' aprire ne' togliere si cura solo disinstallando. */
      guardia.risponde = ComeEAndata.nonSaFarlo;
      await impostazioni.metti(lucchetto: const IlLucchetto(allAvvio: true));
      await apri(tester);
      await tester.tap(find.text('Chiedilo quando apro l\'app'));
      await tester.pumpAndSettle();
      expect(impostazioni.lucchetto.allAvvio, isFalse);
    },
  );

  testWidgets('su un telefono senza guardia la scheda lo dice, e basta', (
    tester,
  ) async {
    guardia
      ..sa = {}
      ..ceUnaGuardia = false;
    await apri(tester);
    expect(find.text('Questo telefono non ha una guardia'), findsOneWidget);
    /* E nessun interruttore: offrire un lucchetto che non si può mettere
     * vorrebbe dire una preferenza che non succede. */
    expect(find.byType(SwitchListTile), findsNothing);
  });

  testWidgets('i tre momenti ci sono, e due sono accesi di serie', (
    tester,
  ) async {
    await apri(tester);
    await fino(tester, find.text('Aprire il cruscotto e la gestione'));
    expect(find.text('Aprire il cruscotto e la gestione'), findsOneWidget);
    expect(find.text('Comandare dalla scheda Dispositivi'), findsOneWidget);
    expect(find.text('Togliere una casa dall\'app'), findsOneWidget);
    /* Spenti finché il lucchetto è spento: appena installata l'app non deve
     * chiedere niente davanti a niente. */
    expect(impostazioni.lucchetto.prima, isEmpty);
  });

  testWidgets('la promessa è scritta, e dice anche cosa NON copre', (
    tester,
  ) async {
    /* È l'informazione che decide se uno quell'interruttore lo accende o no, e
     * la seconda metà — porte e cancelli passano dal PIN dell'azione — è la
     * promessa che non va fatta per sbaglio. */
    await apri(tester);
    await fino(tester, find.textContaining('non escono di lì'));
    expect(find.textContaining('non escono di lì'), findsOneWidget);
    expect(find.textContaining('PIN dell\'azione'), findsOneWidget);
  });

  testWidgets('quello che si accende resta scritto', (tester) async {
    await apri(tester);
    await tester.tap(find.text('Chiedilo quando apro l\'app'));
    await tester.pumpAndSettle();
    /* Riletto da capo, come farebbe l'app riaprendosi. */
    final tornato = IlLucchetto.daQuelloCheCEra(
      impostazioni.lucchetto.comeSiScrive,
    );
    expect(tornato.allAvvio, isTrue);
  });
}
