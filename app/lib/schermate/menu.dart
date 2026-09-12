/// Le sezioni dell'app: le voci della barra.
///
/// La home e' la plancia, e basta: quella di DashboardModern, la vera, che
/// gira dentro l'app com'e'. Le sue pagine — le luci, il clima, l'energia —
/// stanno dentro di lei, nella sua barra, e qui non si ripetono.
///
/// Con una sola eccezione, ed e' voluta: la **Configurazione**. Nella plancia
/// si apre da dentro la plancia, e la configurazione della casa e' una cosa
/// dell'app, non di una delle sue schermate: esce da li' e diventa una voce
/// del menu.
///
/// Esce la **porta**, non la Config. La voce del menu apre quella della
/// dashboard — la stessa, com'e', con le sue schede e il suo cercatore — e
/// non una copia rifatta in Flutter: una copia sarebbe un'altra grafica e un
/// altro posto dove le cose stanno, e non sarebbe mai la stessa. Vedi
/// `plancia/premesse.dart`.
///
/// La Config della plancia e' la sua **pagina**, non solo il suo editor:
/// dentro ci stanno anche il Tema, la Tavolozza e la Barra di navigazione, che
/// la dashboard tiene per questo dispositivo e dichiara tali. Quelle non si
/// rifanno: si aprono.
///
/// E **Come va l'app**, che dell'app parla davvero: i fotogrammi, il filo con
/// la casa, il ritardo dei dati, e i due interruttori che pesano sul riquadro
/// — la plancia leggera e la composizione ibrida. Sono cose dell'app, non
/// della plancia, e nella plancia non ci sono perche' non ci possono essere.
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
  comeVaLApp('Come va l\'app', 'minipc', pronta: true),
  acquisti('Acquisti', 'evidenza', pronta: true),
  segnalazioni('Segnalazioni', 'segnalazioni', pronta: true),
  assistenza('Assistenza', 'assistenza', pronta: true),
  /* La coda di chi risponde. Non e' una voce come le altre: compare **in una
   * casa sola al mondo**, quella che nelle opzioni del ponte ha la chiave
   * della console. Chi la voce ce l'ha lo decide il ponte, non l'app — vedi
   * `vociDellaBarra`. */
  console('Console', 'avvisi', pronta: true),
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
