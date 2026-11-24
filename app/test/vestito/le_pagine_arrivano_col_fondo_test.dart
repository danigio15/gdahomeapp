/// Le pagine che si aprono arrivano **col loro fondo**, non trasparenti.
///
/// «La pagina Premium si disegna in modo strano», con una fotografia
/// dall'iPhone: a meta' del passaggio la pagina nuova non aveva un fondo suo
/// — le schermate sono trasparenti, il fondo lo dipinge `SfondoVivo` una volta
/// sola sotto il navigatore — e sotto di lei si leggeva quella di prima,
/// spostata di lato: il titolo «Assistenza» sotto «Premium», le mattonelle del
/// menu sotto le schede.
///
/// Qui la pagina Premium si apre davvero, dall'Assistenza, col tema dell'app
/// e sull'iPhone a 390×844, e la si guarda **nel mezzo** del passaggio:
///
///  - la pagina che arriva sta su un fondo pieno, del colore del tema, e quel
///    fondo si muove con lei (sta dentro il navigatore, non sotto);
///  - sull'iPhone, dove le due pagine si sovrappongono, si vede quel fondo, e
///    non la pagina di prima che ci passa sotto;
///  - il passaggio resta quello del sistema (sull'iPhone quello che si
///    riprende col dito dal bordo), e nella pagina Premium non ci sono `Hero`
///    che volerebbero da una pagina all'altra.
library;

import 'dart:ui' as ui;

import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/schermate/premium.dart';
import 'package:gdahome/vestito/sfondo.dart';
import 'package:gdahome/vestito/tema.dart';

/// La pagina di prima: un'«Assistenza» trasparente come tutte, con un
/// riquadro rosso pieno che la copre. Il rosso e' il colore che non deve
/// trasparire da sotto la pagina nuova.
const _rosso = Color(0xFFFF0000);

class _Assistenza extends StatelessWidget {
  const _Assistenza({required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Assistenza')),
    body: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: ColoredBox(key: const Key('il-rosso'), color: _rosso),
        ),
        TextButton(
          onPressed: () => apriLaPaginaPremium(context, collegamento),
          child: const Text('Apri Premium'),
        ),
      ],
    ),
  );
}

void main() {
  final schermo = GlobalKey();

  Future<Collegamento> unaCasa(WidgetTester tester) async {
    late Collegamento collegamento;
    await tester.runAsync(() async {
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.apri();
      collegamento = Collegamento(archivio: archivio);
    });
    return collegamento;
  }

  /// Apre Premium e si ferma a [dopo] dall'inizio del passaggio.
  Future<void> apriEFermati(
    WidgetTester tester, {
    required bool scuro,
    Duration dopo = const Duration(milliseconds: 200),
  }) async {
    tester.view.physicalSize = const Size(390 * 2, 844 * 2);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final collegamento = await unaCasa(tester);
    await tester.pumpWidget(
      RepaintBoundary(
        key: schermo,
        child: MaterialApp(
          theme: temaChiaro(),
          darkTheme: temaScuro(),
          themeMode: scuro ? ThemeMode.dark : ThemeMode.light,
          builder: (context, schermata) =>
              SfondoVivo(child: schermata ?? const SizedBox.shrink()),
          home: _Assistenza(collegamento: collegamento),
        ),
      ),
    );
    await tester.tap(find.text('Apri Premium'));
    await tester.pump();
    await tester.pump(dopo);
    expect(find.byType(SchermataPremium), findsOneWidget);
    /* Davvero a meta': la pagina di prima c'e' ancora. */
    expect(find.byKey(const Key('il-rosso')), findsOneWidget);
  }

  /// Il fondo pieno che porta con se' la pagina che arriva: il primo
  /// `ColoredBox` sopra di lei, dentro il navigatore.
  ColoredBox ilFondoDellaPagina(WidgetTester tester) {
    final fondi = tester.widgetList<ColoredBox>(
      find.descendant(
        of: find.byType(Overlay).first,
        matching: find.ancestor(
          of: find.byType(SchermataPremium),
          matching: find.byType(ColoredBox),
        ),
      ),
    );
    expect(fondi, isNotEmpty, reason: 'la pagina arriva senza fondo');
    return fondi.last;
  }

  for (final scuro in [false, true]) {
    final tema = scuro ? 'al buio' : 'al chiaro';
    testWidgets('la pagina che arriva ha il suo fondo, $tema', (tester) async {
      await apriEFermati(tester, scuro: scuro);
      final fondo = ilFondoDellaPagina(tester);
      expect(fondo.color, scuro ? Colori.fondoScuro : Colori.fondo);
      expect(fondo.color.a, 1.0);
      /* Il passaggio e' ancora quello del sistema. */
      if (defaultTargetPlatform == TargetPlatform.iOS) {
        expect(find.byType(CupertinoPageTransition), findsWidgets);
      }
      /* Niente che voli da una pagina all'altra. */
      expect(
        find.descendant(
          of: find.byType(SchermataPremium),
          matching: find.byType(Hero),
        ),
        findsNothing,
      );
      await tester.pumpAndSettle();
    }, variant: TargetPlatformVariant.only(TargetPlatform.iOS));

    testWidgets('anche su Android, $tema', (tester) async {
      await apriEFermati(tester, scuro: scuro);
      expect(
        ilFondoDellaPagina(tester).color,
        scuro ? Colori.fondoScuro : Colori.fondo,
      );
      await tester.pumpAndSettle();
    }, variant: TargetPlatformVariant.only(TargetPlatform.android));
  }

  testWidgets('sull\'iPhone, a meta\' passaggio, sotto Premium non si legge '
      'la pagina di prima', (tester) async {
    await apriEFermati(
      tester,
      scuro: false,
      dopo: const Duration(milliseconds: 150),
    );

    /* Dove le due pagine si sovrappongono: tra il bordo sinistro della nuova,
     * che entra da destra, e il bordo destro del rosso, che scivola a
     * sinistra. Mezz'altezza, fuori dalle schede della pagina Premium: nel
     * margine a sinistra, dove sotto c'e' solo il fondo. */
    final sinistraDellaNuova = tester
        .getTopLeft(find.byType(SchermataPremium))
        .dx;
    final destraDelRosso = tester
        .getTopRight(find.byKey(const Key('il-rosso')))
        .dx;
    expect(
      sinistraDellaNuova + 10,
      lessThan(destraDelRosso),
      reason: 'le due pagine dovrebbero sovrapporsi',
    );
    final x = sinistraDellaNuova + 6;
    final y = 844 / 2;

    late ui.Color colore;
    await tester.runAsync(() async {
      final quadro =
          schermo.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final immagine = await quadro.toImage(pixelRatio: 2);
      final byte = (await immagine.toByteData())!;
      final i = ((y * 2).round() * immagine.width + (x * 2).round()) * 4;
      colore = ui.Color.fromARGB(
        byte.getUint8(i + 3),
        byte.getUint8(i),
        byte.getUint8(i + 1),
        byte.getUint8(i + 2),
      );
      immagine.dispose();
    });
    /* Il fondo, al piu' un filo piu' scuro per l'ombra del bordo che il
     * passaggio dell'iPhone disegna: mai il rosso di sotto. */
    expect(colore.r, lessThan(0.97), reason: 'traspare il rosso: $colore');
    expect((colore.r - colore.g).abs(), lessThan(0.06), reason: '$colore');
    await tester.pumpAndSettle();
  }, variant: TargetPlatformVariant.only(TargetPlatform.iOS));
}
