/// Se quest'app e' GdAHome Muro, sul pannello a muro.
///
/// La accende `main_muro.dart`, prima di tutto il resto. Un pannello non e' un
/// telefono: non ha un padrone a cui chiedere «di chi e'?», e il suo chip
/// grafico — un Sonoff NSPanel Pro, Android 8.1 — non regge quello che un
/// telefono di oggi regge. Le poche cose che sul muro vanno diverse guardano
/// qui.
library;

/// Vero in GdAHome Muro. Falso nell'app del telefono, e nelle prove.
bool sulMuro = false;

/// La versione dell'app del pannello, come la scrive la sua costruzione
/// (`--dart-define=VERSIONE=1.19.51-632`, dall'add-on che la porta): quella
/// che la casa deve vedere, non quella dell'app del telefono da cui nasce.
/// Vuota fuori da quella costruzione.
String get versioneSulMuro {
  const detta = String.fromEnvironment('VERSIONE');
  return detta.split('-').first;
}
