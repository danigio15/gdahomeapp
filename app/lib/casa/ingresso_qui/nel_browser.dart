/// Nel browser: se ci ha messo qui l'add-on, e come si torna alla console.
library;

import 'package:web/web.dart' as web;

/// Da dove si riconosce l'ingress di Home Assistant.
///
/// E' l'indirizzo che il Supervisor mette davanti a tutto quello che un add-on
/// serve: `/api/hassio_ingress/<un gettone>/…`. Il gettone cambia a ogni
/// sessione e non si puo' sapere; il pezzo davanti no, e basta lui.
const String _ingress = '/api/hassio_ingress/';

/// Se questa copia dell'app la sta servendo l'add-on, dentro Home Assistant.
///
/// `Uri.base` nel browser e' l'indirizzo della pagina. Sotto l'ingress l'app
/// sta in `…/app/`, e la console — quella che fabbrica il QR code — sta un
/// piano sopra.
bool get dentroHomeAssistant => Uri.base.path.contains(_ingress);

/// La console, vista da qui: un piano sopra.
///
/// Si risolve **relativo** e non si scrive a mano, perche' davanti c'e' il
/// gettone dell'ingress e quello non lo conosce nessuno qui dentro.
Uri get doveStaLaConsole => Uri.base.resolve('../');

/// Ci si va, **in questa scheda**.
///
/// Nella stessa e non in una nuova, per lo stesso motivo per cui la console
/// apre l'app nella stessa: la sessione dell'ingress la tiene viva la pagina
/// di Home Assistant, e una scheda a parte dopo qualche minuto prende «401».
Future<void> apriLaConsole() async {
  if (!dentroHomeAssistant) return;
  web.window.location.assign(doveStaLaConsole.toString());
}
