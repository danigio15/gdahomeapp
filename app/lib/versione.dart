/// Il numero di questa app, quello che si legge nel negozio.
///
/// **Lo scrive `strumenti/versione.mjs`**, insieme al manifesto dell'add-on e
/// al `pubspec`: a mano non si tocca, e una prova tiene ferma la regola che
/// siano lo stesso numero (`ponte/test/marchio.test.js`).
///
/// Il `pubspec` lo legge chi costruisce, non l'app che gira. Per rileggerlo
/// da dentro servirebbe un pacchetto in piu' — uno che chieda al sistema che
/// pacchetto e' — e per un numero non vale la pena: qui c'e', e si vede in
/// «Come va l'app» e nella riga in fondo alle schermate.
library;

/// Come si chiama: e' la versione della plancia che l'app ha dentro.
const String versioneDiQuestApp = "1.5.6";

/// Il numero di costruzione, quello che vogliono i negozi.
const int costruzioneDiQuestApp = 1050602;

/// Come si scrive per chi legge: `1.4.30 (104301)`.
const String numeroDiQuestApp = "1.5.6 (1050602)";
