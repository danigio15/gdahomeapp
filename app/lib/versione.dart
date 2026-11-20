/// Il numero di questa app, quello che si legge nel negozio.
///
/// **Lo scrive `strumenti/versione.mjs --app`**, insieme al `pubspec`: a mano
/// non si tocca, e una prova tiene ferma la regola che dicano lo stesso
/// numero (`ponte/test/marchio.test.js`). L'add-on ha un numero suo.
///
/// Il `pubspec` lo legge chi costruisce, non l'app che gira. Per rileggerlo
/// da dentro servirebbe un pacchetto in piu' — uno che chieda al sistema che
/// pacchetto e' — e per un numero non vale la pena: qui c'e', e si vede in
/// «Come va l'app» e nella riga in fondo alle schermate.
library;

/// Come si chiama: la versione dell'app (l'add-on ha la sua).
const String versioneDiQuestApp = "1.19.19";

/// Il numero di costruzione, quello che vogliono i negozi.
const int costruzioneDiQuestApp = 1191900;

/// Come si scrive per chi legge: `1.4.30 (104301)`.
const String numeroDiQuestApp = "1.19.19 (1191900)";
