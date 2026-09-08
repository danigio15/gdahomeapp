/// Le sezioni dell'app: le voci della barra.
///
/// La home e' la plancia, e basta: quella di DashboardModern, la vera, che
/// gira dentro l'app com'e'. Le sue pagine — le luci, il clima, l'energia, la
/// configurazione — stanno dentro di lei, nella sua barra, e qui non si
/// ripetono. Quello che sta qui e' il resto: i comandi che in Home Assistant
/// stanno nascosti, e che l'app aggiunge.
///
/// Le voci che non ci sono ancora restano nell'elenco, spente: si sa dove sta
/// andando l'app, e non ci si chiede se manchi un pezzo.
library;

/// Le sezioni dell'app: le voci del menu.
enum Sezione {
  plancia('Plancia', 'home', pronta: true),
  dispositivi('Dispositivi', 'widget', pronta: true),
  aiutanti('Aiutanti', 'impostazioni'),
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
