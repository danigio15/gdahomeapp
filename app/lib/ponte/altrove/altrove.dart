/// Lavoro pesante fatto **altrove**, non sul filo che disegna lo schermo.
///
/// Decifrare un megabyte di plancia o leggere un `get_states` da mille
/// entita' sono cose da qualche decimo di secondo su un telefono, e fatte sul
/// filo principale sono decimi di secondo in cui lo schermo e' fermo. Con una
/// casa vera — dove ogni riconnessione riscarica tutto — l'app andava a
/// scatti fino a non servire.
///
/// Sul telefono e nelle prove il lavoro va in un altro isolato di Dart; nel
/// browser un altro isolato non c'e', e si fa qui, come prima. Chi chiama
/// non lo sa: e' l'import condizionale a scegliere, quando si costruisce.
library;

export 'qui.dart' if (dart.library.io) 'isolato.dart';
