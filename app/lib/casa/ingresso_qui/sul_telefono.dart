/// Sul telefono: nessun ingress, nessuna console da aprire.
///
/// L'app sul telefono la console di gdahome non la puo' aprire, e non deve:
/// quella sta dentro Home Assistant, dietro la sua autenticazione. Chi ha il
/// telefono in mano la barra laterale ce l'ha davanti su un altro schermo, ed
/// e' esattamente quello che gli si dice.
library;

/// No: qui l'app non la serve nessun add-on.
bool get dentroHomeAssistant => false;

/// Non c'e' niente da aprire, e chiamarla non fa niente.
Future<void> apriLaConsole() async {}
