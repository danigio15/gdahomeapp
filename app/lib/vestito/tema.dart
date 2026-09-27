/// Il vestito dell'app: colori, carattere, forme. In un posto solo.
///
/// Prima l'app vestiva il Material di difetto con un seme azzurro qualunque:
/// funzionava, e sembrava un esempio. Qui ci sono le scelte.
///
/// ## Lo stesso vestito di gdanav
///
/// «Per il menu e per tutte le pagine dell'app non puoi prendere spunto da
/// gdanav, cosi' da renderle uguali visto che sono dello stesso produttore?»
///
/// Si', e la strada e' questa: **quello che due app dello stesso produttore
/// hanno in comune sta nel tema, non nelle schermate**. Cambiare qui arriva a
/// tutte le pagine insieme, e nessuna puo' restare indietro.
///
/// Quello che gdahome ha preso da `gdanav/packages/gdanav_app/lib/tema.dart`,
/// e che era diverso:
///
///  - il **blu**. Era il celeste `#0EA5E9`, quello che hanno tutte le app di
///    domotica; adesso e' il `#2563EB` di gdanav, con lo stesso primario
///    chiaro e lo stesso scuro. E' la cosa che si riconosce da lontano, prima
///    di leggere una parola;
///  - le **forme**: schede a diciotto, caselle a quattordici, fogli che salgono
///    a ventotto con la loro maniglia, tasti bordati a quattordici;
///  - le **caselle senza filo intorno**: piene e basta, come in gdanav. Il
///    filo grigio faceva modulo da compilare;
///  - l'**ombra**: due strati, larga e morbida, un po' piu' marcata di prima —
///    e' il [Vetro] di gdanav, ed e' quella che fa galleggiare le schede
///    invece di incollarle al fondo;
///  - i **titoli** piu' grassi e piu' stretti (w700, spaziatura negativa).
///
/// Quello che gdahome si tiene, perche' e' suo e in gdanav non c'e':
///
///  - l'**ambra** come accento — e' il colore di una luce accesa, e in una
///    casa e' quello che si guarda;
///  - **Inter** per quello che si legge e **Oswald** per i numeri grandi: sono
///    i caratteri della plancia, e la plancia e' una pagina web che quei
///    caratteri se li porta dietro;
///  - il **fondo vivo** con le due macchie che si muovono piano: gdanav sotto
///    ha una mappa, qui sotto non c'e' niente, e un grigio piatto e' la cosa
///    che fa sembrare vecchia un'app.
///
/// Tutto il resto lo ricava il tema da qui. Nessuna schermata mette un colore
/// di suo: se lo fa, e' un errore da correggere qui e non li'.
library;

import 'package:flutter/material.dart';

/// I colori del marchio.
abstract final class Colori {
  static const notte = Color(0xFF0F172A);
  static const notteChiara = Color(0xFF1E293B);
  static const ambra = Color(0xFFF59E0B);
  static const ambraScura = Color(0xFFB45309);
  static const bene = Color(0xFF16A34A);
  static const male = Color(0xFFE11D48);

  /// Il blu di gdanav: e' il colore che dice «premi qui», ed e' lo stesso
  /// nelle due app.
  ///
  /// Era il celeste `#0EA5E9` della plancia. La plancia se lo tiene — e' una
  /// pagina web col suo foglio di stile — ma l'app che la ospita si veste come
  /// l'altra app dello stesso produttore, che e' quello che si riconosce
  /// quando si hanno tutte e due sul telefono.
  static const accento = Color(0xFF2563EB);

  /// Il primario vero, per chiaro e scuro. Sono i due numeri che gdanav scrive
  /// in `temaGdanav`, copiati e non somigliati: due blu vicini sono peggio di
  /// due blu diversi.
  static const blu = Color(0xFF1D4ED8);
  static const bluDiNotte = Color(0xFF7FB2FF);

  /// L'ombra delle schede, in due strati. E' quella del [Vetro] di gdanav.
  ///
  /// Due strati e non uno: quello largo stacca dal fondo, quello corto
  /// appoggia. Con uno solo la scheda o galleggia senza posarsi o e' incollata.
  static List<BoxShadow> ombra({required bool scuro}) => [
    BoxShadow(
      color: Colors.black.withValues(alpha: scuro ? 0.42 : 0.14),
      blurRadius: 18,
      offset: const Offset(0, 6),
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: scuro ? 0.24 : 0.08),
      blurRadius: 3,
      offset: const Offset(0, 1),
    ),
  ];

  /// Il fondo scolpito, e le due macchie che ci galleggiano sopra.
  ///
  /// Un grigio piatto e' la cosa che fa sembrare vecchia un'app: non e' un
  /// colore, e' l'assenza di una scelta. Qui sotto invece c'e' un fondo appena
  /// azzurrino con due aloni sfocati che si muovono pianissimo — verde da una
  /// parte, celeste dall'altra — e le schede bianche ci galleggiano sopra.
  static const fondo = Color(0xFFF0F4F8);
  static const alone1 = Color(0xFFDCFCE7);
  static const alone2 = Color(0xFFE0F2FE);

  static const fondoScuro = Color(0xFF080F1C);
  static const aloneScuro1 = Color(0xFF10321F);
  static const aloneScuro2 = Color(0xFF0C2B44);
}

/// Il carattere dei numeri: Oswald, stretto e alto.
///
/// Sulla plancia i numeri non sono scritti col carattere del testo: hanno il
/// loro, condensato, e sono la prima cosa che si vede di una tessera. Qui c'e'
/// una sola funzione perche' quella scelta stia in un posto solo.
TextStyle carattereDelNumero({
  required double corpo,
  FontWeight peso = FontWeight.w200,
  Color? colore,
  double spaziatura = -0.02,
}) => TextStyle(
  fontFamily: 'Oswald',
  fontSize: corpo,
  fontWeight: peso,
  height: 1,
  letterSpacing: corpo * spaziatura,
  color: colore,
  fontFeatures: const [FontFeature.tabularFigures()],
);

ThemeData temaChiaro() => _tema(Brightness.light);
ThemeData temaScuro() => _tema(Brightness.dark);

ThemeData _tema(Brightness luce) {
  final chiaro = luce == Brightness.light;

  final colori = chiaro
      ? const ColorScheme(
          brightness: Brightness.light,
          primary: Colori.blu,
          onPrimary: Colors.white,
          primaryContainer: Color(0xFFE0F2FE),
          onPrimaryContainer: Color(0xFF075985),
          secondary: Colori.ambraScura,
          onSecondary: Colors.white,
          secondaryContainer: Color(0xFFFEF3C7),
          onSecondaryContainer: Color(0xFF78350F),
          tertiary: Colori.bene,
          onTertiary: Colors.white,
          tertiaryContainer: Color(0xFFDDF3E7),
          onTertiaryContainer: Color(0xFF0F4A2E),
          error: Colori.male,
          onError: Colors.white,
          errorContainer: Color(0xFFFBE3E3),
          onErrorContainer: Color(0xFF6B1B1B),
          surface: Colori.fondo,
          onSurface: Color(0xFF0F172A),
          surfaceContainerLowest: Colors.white,
          surfaceContainerLow: Color(0xFFF8FAFC),
          surfaceContainer: Color(0xFFF1F5F9),
          surfaceContainerHigh: Color(0xFFE9EEF4),
          surfaceContainerHighest: Color(0xFFE2E8F0),
          onSurfaceVariant: Color(0xFF64748B),
          outline: Color(0xFFCBD5E1),
          outlineVariant: Color(0xFFE8EDF3),
          inverseSurface: Colori.notte,
          onInverseSurface: Colors.white,
          inversePrimary: Color(0xFFAFC8F5),
          shadow: Colors.black,
          scrim: Colors.black,
        )
      : const ColorScheme(
          brightness: Brightness.dark,
          primary: Colori.bluDiNotte,
          onPrimary: Color(0xFF07203F),
          primaryContainer: Color(0xFF1F3A66),
          onPrimaryContainer: Color(0xFFDCE7FA),
          secondary: Colori.ambra,
          onSecondary: Color(0xFF3B2800),
          secondaryContainer: Color(0xFF4A3510),
          onSecondaryContainer: Color(0xFFFFE2A6),
          tertiary: Color(0xFF7BD3A5),
          onTertiary: Color(0xFF063B22),
          tertiaryContainer: Color(0xFF15503A),
          onTertiaryContainer: Color(0xFFCDEFDD),
          error: Color(0xFFF08A8A),
          onError: Color(0xFF4A0F0F),
          errorContainer: Color(0xFF5E2222),
          onErrorContainer: Color(0xFFFFDADA),
          surface: Colori.fondoScuro,
          onSurface: Color(0xFFE8EDF6),
          surfaceContainerLowest: Color(0xFF111C2F),
          surfaceContainerLow: Color(0xFF0D1626),
          surfaceContainer: Color(0xFF16223A),
          surfaceContainerHigh: Color(0xFF1C2A45),
          surfaceContainerHighest: Color(0xFF243553),
          onSurfaceVariant: Color(0xFFA5B2C8),
          outline: Color(0xFF3A4C6E),
          outlineVariant: Color(0xFF24314D),
          inverseSurface: Color(0xFFE8EDF6),
          onInverseSurface: Colori.notte,
          inversePrimary: Colori.notte,
          shadow: Colors.black,
          scrim: Colors.black,
        );

  final base = ThemeData(
    useMaterial3: true,
    colorScheme: colori,
    brightness: luce,
    fontFamily: 'Inter',
    /* Il fondo lo dipinge `SfondoVivo`, sotto tutto: le schermate ci
     * galleggiano sopra, e non c'e' un grigio piatto da nessuna parte. */
    scaffoldBackgroundColor: Colors.transparent,
  );

  /* I pesi e le spaziature di gdanav: titoli a settecento e un filo piu'
   * stretti. Erano a seicento, e accanto a gdanav si leggevano come un'altra
   * app. */
  final testi = base.textTheme.copyWith(
    displaySmall: base.textTheme.displaySmall?.copyWith(
      fontWeight: FontWeight.w700,
      letterSpacing: -1,
    ),
    headlineMedium: base.textTheme.headlineMedium?.copyWith(
      fontWeight: FontWeight.w700,
      letterSpacing: -0.5,
    ),
    headlineSmall: base.textTheme.headlineSmall?.copyWith(
      fontWeight: FontWeight.w700,
      letterSpacing: -0.3,
    ),
    titleLarge: base.textTheme.titleLarge?.copyWith(
      fontWeight: FontWeight.w700,
      letterSpacing: -0.2,
    ),
    titleMedium: base.textTheme.titleMedium?.copyWith(
      fontWeight: FontWeight.w600,
    ),
    labelLarge: base.textTheme.labelLarge?.copyWith(
      fontWeight: FontWeight.w600,
    ),
  );

  return base.copyWith(
    textTheme: testi,
    appBarTheme: AppBarTheme(
      /* Trasparente come il resto: sotto ci passa il fondo vivo. */
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: testi.titleLarge?.copyWith(color: colori.onSurface),
      iconTheme: IconThemeData(color: colori.onSurface),
    ),
    cardTheme: CardThemeData(
      color: colori.surfaceContainerLowest,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
    ),
    /* I fogli che salgono: ventotto in cima e la maniglia, come in gdanav.
     * Qui non erano vestiti affatto — uscivano col Material di difetto, che
     * accanto all'altra app si vede subito. */
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: colori.surfaceContainerLowest,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: testi.labelLarge?.copyWith(fontSize: 16),
      ),
    ),
    /* Bordato: quarantotto e quattordici, come in gdanav. Pieno e bordato
     * hanno misure diverse apposta — il pieno e' quello che si preme, e si
     * vede che e' piu' grosso. */
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        side: BorderSide(color: colori.outline),
        textStyle: testi.labelLarge?.copyWith(fontSize: 16),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: testi.labelLarge,
      ),
    ),
    /* Le caselle: **piene e senza filo intorno**, a quattordici, come in
     * gdanav. Il filo grigio su un fondo pieno non separa niente — il pieno lo
     * fa gia' — e faceva modulo da compilare. Il filo torna solo su quella in
     * cui si sta scrivendo, ed e' blu: li' dice qualcosa. */
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: colori.surfaceContainer,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: colori.primary, width: 1.6),
      ),
      labelStyle: TextStyle(color: colori.onSurfaceVariant),
      helperStyle: TextStyle(color: colori.onSurfaceVariant),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (stati) => stati.contains(WidgetState.selected)
            ? Colors.white
            : colori.onSurfaceVariant,
      ),
      trackColor: WidgetStateProperty.resolveWith(
        (stati) => stati.contains(WidgetState.selected)
            ? Colori.ambra
            : colori.surfaceContainerHighest,
      ),
      trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
    ),
    listTileTheme: ListTileThemeData(
      contentPadding: const EdgeInsets.symmetric(horizontal: 20),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      iconColor: colori.onSurfaceVariant,
    ),
    dividerTheme: DividerThemeData(color: colori.outlineVariant, space: 1),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      backgroundColor: colori.inverseSurface,
      contentTextStyle: testi.bodyMedium?.copyWith(
        color: colori.onInverseSurface,
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: colori.surfaceContainerLowest,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: colori.primary,
      foregroundColor: colori.onPrimary,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
    ),
    expansionTileTheme: const ExpansionTileThemeData(
      shape: Border(),
      collapsedShape: Border(),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: colori.primary,
      linearTrackColor: colori.surfaceContainerHigh,
    ),
    splashFactory: InkSparkle.splashFactory,
  );
}
