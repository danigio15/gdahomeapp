/// Le sezioni dell'app: le voci della barra.
///
/// La home e' la plancia, e basta: quella di DashboardModern, la vera, che
/// gira dentro l'app com'e'. Le sue pagine — le luci, il clima, l'energia —
/// stanno dentro di lei, nella sua barra, e qui non si ripetono.
///
/// Con una sola eccezione, ed e' voluta: la **Configurazione**. Nella plancia
/// si apre da dentro la plancia, un riquadro sopra la pagina con diciannove
/// schede in fila orizzontale; su un telefono quella fila non ci sta, e
/// soprattutto la configurazione della casa e' una cosa dell'app, non di una
/// delle sue schermate. Esce da li' e diventa una voce del menu, con dentro
/// la stessa alberatura (vedi `configurazione/albero.dart`).
///
/// Il resto e' quello che in Home Assistant sta nascosto, e che l'app
/// aggiunge. Le voci che non ci sono ancora restano nell'elenco, spente: si
/// sa dove sta andando l'app, e non ci si chiede se manchi un pezzo.
library;

/// Le sezioni dell'app: le voci del menu.
enum Sezione {
  plancia('Plancia', 'home', pronta: true),
  dispositivi('Dispositivi', 'widget', pronta: true),
  configurazione('Configurazione', 'impostazioni', pronta: true),
  acquisti('Acquisti', 'evidenza', pronta: true),
  segnalazioni('Segnalazioni', 'segnalazioni', pronta: true),
  assistenza('Assistenza', 'assistenza', pronta: true),
  aiutanti('Aiutanti', 'mie'),
  zigbee('Zigbee', 'runtime'),
  automazioni('Automazioni', 'azioni');

  const Sezione(this.titolo, this.disegno, {this.pronta = false});

  final String titolo;

  /// Il disegno della sezione: lo stesso della plancia, per nome. Vedi
  /// `vestito/oggetti.dart`.
  final String disegno;

  /// `false` finche' quel blocco non e' scritto: la voce si vede, spenta.
  final bool pronta;
}
