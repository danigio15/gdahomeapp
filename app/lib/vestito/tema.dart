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
///  - **Outfit** come carattere, incorporato: geometrico, pulito, caldo;
///  - schede a angoli morbidi, senza ombre dure; le ombre in un'app di casa
///    fanno scaffalatura.
///
/// Tutto il resto lo ricava il tema da qui. Nessuna schermata mette un colore
/// di suo: se lo fa, e' un errore da correggere qui e non li'.
library;

import 'package:flutter/material.dart';

/// I colori del marchio.
abstract final class Colori {
  static const notte = Color(0xFF0C1B36);
  static const notteChiara = Color(0xFF1A3A6E);
  static const ambra = Color(0xFFF5B942);
  static const ambraScura = Color(0xFFB8781A);
  static const bene = Color(0xFF2E9E68);
  static const male = Color(0xFFD64545);
}

ThemeData temaChiaro() => _tema(Brightness.light);
ThemeData temaScuro() => _tema(Brightness.dark);

ThemeData _tema(Brightness luce) {
  final chiaro = luce == Brightness.light;

  final colori = chiaro
      ? const ColorScheme(
          brightness: Brightness.light,
          primary: Colori.notte,
          onPrimary: Colors.white,
          primaryContainer: Color(0xFFE2E9F6),
          onPrimaryContainer: Colori.notte,
          secondary: Colori.ambraScura,
          onSecondary: Colors.white,
          secondaryContainer: Color(0xFFFFF0CF),
          onSecondaryContainer: Color(0xFF5C3F07),
          tertiary: Colori.bene,
          onTertiary: Colors.white,
          tertiaryContainer: Color(0xFFDDF3E7),
          onTertiaryContainer: Color(0xFF0F4A2E),
          error: Colori.male,
          onError: Colors.white,
          errorContainer: Color(0xFFFBE3E3),
          onErrorContainer: Color(0xFF6B1B1B),
          surface: Color(0xFFF4F6FA),
          onSurface: Color(0xFF15213A),
          surfaceContainerLowest: Colors.white,
          surfaceContainerLow: Color(0xFFF9FAFD),
          surfaceContainer: Color(0xFFEDF0F6),
          surfaceContainerHigh: Color(0xFFE5E9F1),
          surfaceContainerHighest: Color(0xFFDDE2EC),
          onSurfaceVariant: Color(0xFF5C6A84),
          outline: Color(0xFFC6CFDD),
          outlineVariant: Color(0xFFE3E8F0),
          inverseSurface: Colori.notte,
          onInverseSurface: Colors.white,
          inversePrimary: Color(0xFFAFC8F5),
          shadow: Colors.black,
          scrim: Colors.black,
        )
      : const ColorScheme(
          brightness: Brightness.dark,
          primary: Color(0xFFB4CCF7),
          onPrimary: Colori.notte,
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
          surface: Color(0xFF0A1220),
          onSurface: Color(0xFFE8EDF6),
          surfaceContainerLowest: Color(0xFF121D33),
          surfaceContainerLow: Color(0xFF0F182B),
          surfaceContainer: Color(0xFF17243D),
          surfaceContainerHigh: Color(0xFF1D2C48),
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
    fontFamily: 'Outfit',
    scaffoldBackgroundColor: colori.surface,
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
      backgroundColor: colori.surface,
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
