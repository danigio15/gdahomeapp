/// Il vestito dell'app: colori, carattere, forme. In un posto solo.
///
/// Prima l'app vestiva il Material di difetto con un seme azzurro qualunque:
/// funzionava, e sembrava un esempio. Qui ci sono le scelte, e sono poche
/// apposta:
///
///  - **blu notte** come colore primo — serio, e non e' l'azzurro che hanno
///    tutte le app di domotica;
///  - **ambra** come accento — e' il colore di una luce accesa, e in una casa
///    e' quello che si guarda;
///  - **Inter** per quello che si legge e **Oswald** per i numeri grandi: sono
///    i caratteri della plancia, non due che gli somigliano;
///  - schede a angoli morbidi, senza ombre dure; le ombre in un'app di casa
///    fanno scaffalatura.
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

  /// L'azzurro della plancia: e' il colore che dice «premi qui».
  static const accento = Color(0xFF0EA5E9);

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
          primary: Colori.accento,
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
          primary: Color(0xFF38BDF8),
          onPrimary: Color(0xFF04283A),
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

  final testi = base.textTheme.copyWith(
    displaySmall: base.textTheme.displaySmall?.copyWith(
      fontWeight: FontWeight.w600,
      letterSpacing: -1,
    ),
    headlineMedium: base.textTheme.headlineMedium?.copyWith(
      fontWeight: FontWeight.w600,
      letterSpacing: -0.6,
    ),
    headlineSmall: base.textTheme.headlineSmall?.copyWith(
      fontWeight: FontWeight.w600,
      letterSpacing: -0.4,
    ),
    titleLarge: base.textTheme.titleLarge?.copyWith(
      fontWeight: FontWeight.w600,
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
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: testi.labelLarge?.copyWith(fontSize: 16),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
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
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: colori.surfaceContainerLowest,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: colori.outlineVariant),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: colori.outlineVariant),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
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
