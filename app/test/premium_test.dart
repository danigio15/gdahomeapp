/// La pagina Premium: i due piani da scegliere, un solo bottone, il codice
/// regalo, la webapp. Fatta come quella di gdanav.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/licenza/licenza.dart';
import 'package:gdahome/licenza/negozio.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/schermate/premium.dart';
import 'package:gdahome/vestito/tema.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import 'licenza/gettoni_di_prova.dart';

/// Un negozio finto che si ricorda cosa si e' comprato, e che consegna gli
/// acquisti quando glielo si dice ([consegna]).
class _NegozioFinto implements NegozioGdahome {
  _NegozioFinto({this.giorni = 14});

  final int giorni;
  final comprati = <String>[];
  var ripristinati = 0;

  /// Quelli che il negozio dice rimasti a meta', all'avvio.
  List<PurchaseDetails> rimasti = const [];
  final _acquisti = StreamController<List<PurchaseDetails>>.broadcast();

  void consegna(PurchaseDetails acquisto) => _acquisti.add([acquisto]);

  @override
  String get piattaforma => 'android';
  @override
  String get nome => 'Play Store';
  @override
  Future<bool> disponibile() async => true;
  @override
  Future<List<PianoGdahome>> piani() async => [
    PianoGdahome(id: pianoMensile, prezzo: '4,99 €', giorniProva: giorni),
    PianoGdahome(id: pianoAnnuale, prezzo: '49,99 €', giorniProva: giorni),
  ];
  @override
  Stream<List<PurchaseDetails>> get acquisti => _acquisti.stream;
  @override
  Future<void> compra(String piano) async => comprati.add(piano);
  @override
  Future<void> ripristina() async => ripristinati += 1;
  @override
  Future<void> completa(PurchaseDetails acquisto) async {}
  @override
  Future<List<PurchaseDetails>> rimastiAMeta() async => rimasti;
}

/// Un'altra casa, «Casa al mare», Premium con un abbonamento.
const _altraCasa = 'casa_ffffffffffffffffffffffffffffffff';

void main() {
  Future<Collegamento> casaSenzaFilo(
    WidgetTester tester, {
    String? gettone,
    bool addonVecchio = false,
    bool conUnAltraAbbonata = false,
  }) async {
    late Collegamento collegamento;
    await tester.runAsync(() async {
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.apri();
      if (conUnAltraAbbonata) {
        final mare = await archivio.aggiungi(
          nome: 'Casa al mare',
          segno: 'segno-mare',
          casaAlCentralino: _altraCasa,
          inCasa: IndirizzoDelPonte.leggi('192.168.2.50'),
        );
        await archivio.segnaIlGettone(
          mare.id,
          await firmaUnGettone(sog: _altraCasa, origine: 'negozio'),
        );
      }
      final casa = await archivio.aggiungi(
        nome: 'Casa al lago',
        segno: 'segno',
        casaAlCentralino: casaDiProva,
        inCasa: IndirizzoDelPonte.leggi('192.168.1.50'),
      );
      if (addonVecchio) {
        await archivio.segnaSenzaLicenze(casa.id);
      } else {
        await archivio.segnaIlGettone(casa.id, gettone ?? '');
      }
      await archivio.scegli(casa.id);
      collegamento = Collegamento(
        archivio: archivio,
        licenza: GestoreLicenza(chiave: chiaveDiProva),
      );
      await collegamento.apri();
    });
    addTearDown(() => tester.runAsync(collegamento.chiudi));
    return collegamento;
  }

  Future<void> mostra(WidgetTester tester, Widget pagina) async {
    tester.view.physicalSize = const Size(390 * 3, 1600 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(theme: temaChiaro(), home: pagina));
    await tester.pump();
  }

  Future<GestoreDegliAcquisti> acquistiCon(
    WidgetTester tester,
    _NegozioFinto negozio, {
    PortaLaRicevuta? porta,
  }) async {
    final acquisti = GestoreDegliAcquisti(
      negozio: negozio,
      porta:
          porta ??
          ({
            required piattaforma,
            required prodotto,
            required ricevuta,
          }) async {},
    );
    await tester.runAsync(acquisti.avvia);
    return acquisti;
  }

  FilledButton ilBottone(WidgetTester tester) =>
      tester.widget<FilledButton>(find.byKey(const Key('compra-premium')));

  testWidgets('senza negozio: prezzi di listino, bottone spento', (
    tester,
  ) async {
    final collegamento = await casaSenzaFilo(tester);
    await mostra(
      tester,
      SchermataPremium(
        collegamento: collegamento,
        sulWeb: false,
        siCompraQui: true,
      ),
    );
    expect(find.text('Premium'), findsOneWidget);
    expect(find.text('gdahome Premium'), findsOneWidget);
    expect(find.textContaining('14 giorni di prova gratuita'), findsOneWidget);
    expect(find.text('Più plance e più case'), findsOneWidget);
    expect(find.textContaining('Gratis per tutti'), findsOneWidget);
    expect(find.text('49,99 €/anno'), findsOneWidget);
    expect(find.text('4,99 €/mese'), findsOneWidget);
    expect(find.text('Risparmi il 17%'), findsOneWidget);
    expect(ilBottone(tester).onPressed, isNull);
    expect(find.byKey(const Key('negozio-assente')), findsOneWidget);
    expect(find.text('Privacy'), findsOneWidget);
    expect(find.text('Termini d\'uso'), findsOneWidget);
  });

  testWidgets('col negozio: si sceglie il piano e si compra quello', (
    tester,
  ) async {
    final collegamento = await casaSenzaFilo(tester);
    final negozio = _NegozioFinto();
    final acquisti = await acquistiCon(tester, negozio);
    await mostra(
      tester,
      SchermataPremium(
        collegamento: collegamento,
        acquisti: acquisti,
        sulWeb: false,
        siCompraQui: true,
      ),
    );
    expect(find.text('Prova gratis per 14 giorni'), findsOneWidget);
    expect(
      find.textContaining('Poi 49,99 €/anno, rinnovo automatico'),
      findsOneWidget,
    );
    expect(find.textContaining('dal Play Store'), findsOneWidget);

    /* L'annuale e' scelto da subito. */
    await tester.tap(find.byKey(const Key('compra-premium')));
    await tester.pump();
    expect(negozio.comprati, [pianoAnnuale]);

    /* Si tocca il mensile: la nota cambia, e si compra quello. */
    acquisti.inCorso = false;
    await tester.tap(find.byKey(const Key('piano-$pianoMensile')));
    await tester.pump();
    expect(find.textContaining('Poi 4,99 €/mese'), findsOneWidget);
    await tester.tap(find.byKey(const Key('compra-premium')));
    await tester.pump();
    expect(negozio.comprati, [pianoAnnuale, pianoMensile]);

    /* Mentre compra, il bottone gira e non si tocca. */
    expect(ilBottone(tester).onPressed, isNull);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    /* Finito (qui a mano); toccare un piano ridisegna la pagina. */
    acquisti.inCorso = false;
    await tester.tap(find.byKey(const Key('piano-$pianoAnnuale')));
    await tester.pump();

    /* «Ripristina abbonamento» prima dice cosa succede: con Annulla non
     * succede niente. */
    await tester.tap(find.text('Ripristina abbonamento'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('conferma-ripristino')), findsOneWidget);
    expect(find.text('Ripristinare l\'abbonamento qui?'), findsOneWidget);
    expect(find.textContaining('una casa alla volta'), findsOneWidget);
    expect(find.textContaining('passa a «Casa al lago»'), findsOneWidget);
    await tester.tap(find.text('Annulla'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('conferma-ripristino')), findsNothing);
    expect(negozio.ripristinati, 0);

    await tester.tap(find.text('Ripristina abbonamento'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('ripristina-qui')));
    await tester.pumpAndSettle();
    expect(negozio.ripristinati, 1);
  });

  testWidgets(
    '«Ripristina» dice il nome dell\'altra casa che ha l\'abbonamento',
    (tester) async {
      final collegamento = await casaSenzaFilo(
        tester,
        conUnAltraAbbonata: true,
      );
      final negozio = _NegozioFinto();
      final acquisti = await acquistiCon(tester, negozio);
      await mostra(
        tester,
        SchermataPremium(
          collegamento: collegamento,
          acquisti: acquisti,
          sulWeb: false,
        ),
      );
      /* La casa aperta e' quella al lago, Base: si compra o si ripristina. */
      expect(find.byKey(const Key('compra-premium')), findsOneWidget);
      await tester.tap(find.byKey(const Key('ripristina-abbonamento')));
      await tester.pumpAndSettle();
      expect(
        find.textContaining(
          '«Casa al mare» oggi è Premium con un abbonamento: se è lo stesso, '
          'passa a «Casa al lago» e «Casa al mare» torna Base.',
        ),
        findsOneWidget,
      );
      await tester.tap(find.byKey(const Key('ripristina-qui')));
      await tester.pumpAndSettle();
      expect(negozio.ripristinati, 1);
    },
  );

  testWidgets('la prova gia\' usata: «Abbonati a», e della prova niente', (
    tester,
  ) async {
    final collegamento = await casaSenzaFilo(tester);
    final acquisti = await acquistiCon(tester, _NegozioFinto(giorni: 0));
    await mostra(
      tester,
      SchermataPremium(
        collegamento: collegamento,
        acquisti: acquisti,
        sulWeb: false,
        siCompraQui: true,
      ),
    );
    expect(find.text('Abbonati a 49,99 €/anno'), findsOneWidget);
    expect(find.textContaining('prova'), findsNothing);
  });

  testWidgets('da un lucchetto, il perche\' sta in cima', (tester) async {
    final collegamento = await casaSenzaFilo(tester);
    await mostra(
      tester,
      SchermataPremium(
        collegamento: collegamento,
        perche: PerchePremium.unAltraCasa,
        sulWeb: false,
      ),
    );
    expect(find.byKey(const Key('perche-premium')), findsOneWidget);
    expect(find.text(PerchePremium.unAltraCasa), findsOneWidget);
  });

  testWidgets('il codice regalo: il foglio, l\'errore, Annulla', (
    tester,
  ) async {
    final collegamento = await casaSenzaFilo(tester);
    await mostra(
      tester,
      SchermataPremium(collegamento: collegamento, sulWeb: false),
    );
    await tester.tap(find.byKey(const Key('codice-regalo')));
    await tester.pumpAndSettle();
    expect(find.text('Codice regalo'), findsOneWidget);
    await tester.enterText(
      find.byKey(const Key('campo-codice')),
      'GDA-ABCD-EFGH-JKMN',
    );
    /* Senza filo la casa non risponde: il foglio lo dice e resta aperto. */
    await tester.runAsync(() async {
      await tester.tap(find.byKey(const Key('riscatta-codice')));
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pump();
    expect(find.text('Codice regalo'), findsOneWidget);
    final campo = tester.widget<TextField>(
      find.byKey(const Key('campo-codice')),
    );
    expect(campo.decoration?.errorText, isNotNull);
    await tester.tap(find.text('Annulla'));
    await tester.pumpAndSettle();
    expect(find.text('Codice regalo'), findsNothing);
  });

  testWidgets('nella webapp: niente bottone per comprare, il codice sì', (
    tester,
  ) async {
    final collegamento = await casaSenzaFilo(tester);
    await mostra(
      tester,
      SchermataPremium(collegamento: collegamento, sulWeb: true),
    );
    expect(find.byKey(const Key('compra-premium')), findsNothing);
    expect(find.text('Ripristina abbonamento'), findsNothing);
    expect(find.byKey(const Key('premium-sul-web')), findsOneWidget);
    expect(find.textContaining('iPhone o Android'), findsOneWidget);
    expect(find.byKey(const Key('codice-regalo')), findsOneWidget);
    expect(find.textContaining('Android Auto e CarPlay'), findsOneWidget);
  });

  testWidgets('con Premium: fino a quando e da dove, senza piani', (
    tester,
  ) async {
    late String gettone;
    await tester.runAsync(() async {
      gettone = await firmaUnGettone(
        origine: 'regalo',
        scade: DateTime(2027, 3, 12),
      );
    });
    final collegamento = await casaSenzaFilo(tester, gettone: gettone);
    await mostra(
      tester,
      SchermataPremium(collegamento: collegamento, sulWeb: false),
    );
    expect(
      find.textContaining('Premium è attivo fino al 12 marzo 2027 · regalo'),
      findsOneWidget,
    );
    expect(find.byKey(const Key('compra-premium')), findsNothing);
    expect(find.byKey(const Key('piano-$pianoAnnuale')), findsNothing);
    expect(find.byKey(const Key('codice-regalo')), findsOneWidget);
  });

  testWidgets(
    'un abbonamento scrive la fine del periodo pagato, non quella col margine',
    (tester) async {
      late String gettone;
      await tester.runAsync(() async {
        gettone = await firmaUnGettone(
          origine: 'negozio',
          scade: DateTime(2027, 3, 15),
          pagato: DateTime(2027, 3, 12),
        );
      });
      final collegamento = await casaSenzaFilo(tester, gettone: gettone);
      await mostra(
        tester,
        SchermataPremium(collegamento: collegamento, sulWeb: false),
      );
      expect(
        find.textContaining(
          'Premium è attivo fino al 12 marzo 2027 · abbonamento',
        ),
        findsOneWidget,
      );
      expect(find.textContaining('15 marzo'), findsNothing);
    },
  );

  testWidgets(
    'nei giorni del margine del rinnovo: attivo, e nessuna data già passata',
    (tester) async {
      late String gettone;
      await tester.runAsync(() async {
        final ieri = DateTime.now().subtract(const Duration(days: 1));
        gettone = await firmaUnGettone(
          origine: 'negozio',
          pagato: ieri,
          scade: ieri.add(const Duration(days: 3)),
        );
      });
      final collegamento = await casaSenzaFilo(tester, gettone: gettone);
      await mostra(
        tester,
        SchermataPremium(collegamento: collegamento, sulWeb: false),
      );
      expect(
        find.textContaining('Premium è attivo · abbonamento.'),
        findsOneWidget,
      );
      expect(find.textContaining('fino al'), findsNothing);
      expect(find.byKey(const Key('compra-premium')), findsNothing);
    },
  );

  testWidgets('durante la prova: «Prova gratuita fino al»', (tester) async {
    late String gettone;
    await tester.runAsync(() async {
      gettone = await firmaUnGettone(
        origine: 'negozio',
        prova: true,
        scade: DateTime(2027, 3, 12),
      );
    });
    final collegamento = await casaSenzaFilo(tester, gettone: gettone);
    await mostra(
      tester,
      SchermataPremium(collegamento: collegamento, sulWeb: false),
    );
    expect(
      find.textContaining('Prova gratuita fino al 12 marzo 2027'),
      findsOneWidget,
    );
  });

  testWidgets('su iPhone: CarPlay e l\'App Store', (tester) async {
    final collegamento = await casaSenzaFilo(tester);
    await mostra(
      tester,
      SchermataPremium(collegamento: collegamento, sulWeb: false),
    );
    expect(find.textContaining('CarPlay'), findsOneWidget);
    expect(find.textContaining('Android Auto'), findsNothing);
    expect(find.textContaining('L\'App Store non risponde'), findsOneWidget);
    /* E niente codice regalo: per l'App Store aprire una funzione con un
     * codice nostro e' una «chiave di licenza» (regola 3.1.1), e l'app che lo
     * fa torna indietro dalla revisione. Il codice si riscatta in Home
     * Assistant o dal browser, e il Premium arriva anche qui. */
    expect(find.byKey(const Key('codice-regalo')), findsNothing);
    expect(find.textContaining('codice'), findsNothing);
    /* I due link che l'App Store vuole accanto all'abbonamento restano. */
    expect(find.text('Privacy'), findsOneWidget);
    expect(find.text('Termini d\'uso'), findsOneWidget);
    expect(find.text('Ripristina abbonamento'), findsOneWidget);
  }, variant: TargetPlatformVariant.only(TargetPlatform.iOS));

  testWidgets('su Android si compra dal Play Store, e il codice regalo resta', (
    tester,
  ) async {
    final collegamento = await casaSenzaFilo(tester);
    final acquisti = await acquistiCon(tester, _NegozioFinto());
    await mostra(
      tester,
      SchermataPremium(
        collegamento: collegamento,
        acquisti: acquisti,
        sulWeb: false,
      ),
    );
    expect(find.text('Prova gratis per 14 giorni'), findsOneWidget);
    expect(ilBottone(tester).onPressed, isNotNull);
    expect(find.textContaining('14 giorni di prova gratuita'), findsOneWidget);
    expect(
      find.textContaining('Disdici quando vuoi dal Play Store'),
      findsOneWidget,
    );
    expect(find.text('Ripristina abbonamento'), findsOneWidget);
    expect(find.text('Privacy'), findsOneWidget);
    expect(find.text('Termini d\'uso'), findsOneWidget);
    expect(find.byKey(const Key('codice-regalo')), findsOneWidget);
    expect(find.textContaining('Android Auto'), findsOneWidget);
    expect(find.textContaining('CarPlay'), findsNothing);
    expect(find.textContaining('non è ancora disponibile'), findsNothing);
  }, variant: TargetPlatformVariant.only(TargetPlatform.android));

  testWidgets(
    'con l\'add-on vecchio non si compra: si aggiorna, e si ricontrolla',
    (tester) async {
      final collegamento = await casaSenzaFilo(tester, addonVecchio: true);
      await mostra(
        tester,
        SchermataPremium(collegamento: collegamento, sulWeb: false),
      );
      expect(find.byKey(const Key('premium-addon-vecchio')), findsOneWidget);
      expect(find.text('Aggiorna prima l\'add-on gdahome'), findsOneWidget);
      expect(find.byKey(const Key('compra-premium')), findsNothing);
      /* Un codice regalo li' non arriverebbe a nessuno: non si propone. */
      expect(find.byKey(const Key('codice-regalo')), findsNothing);

      /* La casa di questa prova non si raggiunge: il tasto lo dice, invece di
     * non fare niente. */
      await tester.runAsync(() async {
        await tester.tap(find.byKey(const Key('premium-controlla')));
        await Future<void>.delayed(const Duration(milliseconds: 200));
      });
      await tester.pump();
      expect(find.textContaining('non risponde adesso'), findsOneWidget);
    },
    variant: TargetPlatformVariant.only(TargetPlatform.iOS),
  );

  testWidgets('pagato, e la casa non risponde: «Acquisto completato»', (
    tester,
  ) async {
    final collegamento = await casaSenzaFilo(tester);
    final negozio = _NegozioFinto();
    final acquisti = await acquistiCon(
      tester,
      negozio,
      porta: ({required piattaforma, required prodotto, required ricevuta}) =>
          throw const LicenzaRifiutata(
            'La casa non è collegata adesso.',
            definitiva: false,
          ),
    );
    await mostra(
      tester,
      SchermataPremium(
        collegamento: collegamento,
        acquisti: acquisti,
        sulWeb: false,
      ),
    );
    expect(find.byKey(const Key('compra-premium')), findsOneWidget);

    await tester.runAsync(() async {
      negozio.consegna(
        PurchaseDetails(
          purchaseID: '2000000123456789',
          productID: 'gdahome_premium_mensile',
          verificationData: PurchaseVerificationData(
            localVerificationData: '',
            serverVerificationData: '',
            source: 'app_store',
          ),
          transactionDate: '0',
          status: PurchaseStatus.purchased,
        ),
      );
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pump();

    /* Niente rosso e niente bottone: chi ha pagato non deve pagare due
     * volte, e l'abbonamento arriva alla casa quando risponde. */
    expect(acquisti.ceUnaRicevutaInSospeso, isTrue);
    expect(acquisti.errore, isNull);
    expect(find.byKey(const Key('ricevuta-in-attesa')), findsOneWidget);
    expect(find.text('Acquisto completato'), findsOneWidget);
    expect(find.textContaining('«Casa al lago» non risponde'), findsOneWidget);
    expect(find.byKey(const Key('compra-premium')), findsNothing);
  }, variant: TargetPlatformVariant.only(TargetPlatform.iOS));
}
