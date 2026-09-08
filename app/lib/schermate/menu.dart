/// Le sezioni dell'app, e quali di loro ha davvero questa casa.
///
/// La home e' la plancia, e basta. Quello che si vede aprendo l'app e' la casa
/// come la si e' disegnata in DashboardModern — non un elenco di entita', non
/// delle tessere con dei numeri. Tutto il resto si raggiunge dalla **barra**
/// (`barra.dart`), che si chiama dal basso come la dock della plancia web.
///
/// Qui ci sono solo due cose, e nessuna disegna niente:
///
///  - l'elenco delle sezioni, col loro nome, il loro disegno e se sono
///    pronte. Quelle che non ci sono ancora restano nell'elenco, spente: si sa
///    dove sta andando l'app, e non ci si chiede se manchi un pezzo;
///  - quali sezioni **questa** casa ha davvero. Una sezione senza niente
///    dentro non compare, come nella barra della plancia web: chi non ha una
///    piscina non deve vedere la voce Piscina.
library;

import '../plancia/configurazione.dart';
import '../plancia/energia.dart';
import '../plancia/tessere.dart';

/// Le sezioni dell'app: le voci del menu.
enum Sezione {
  plancia('Home', 'home', pronta: true, dellaPlancia: true),
  stanze(
    'Stanze',
    'stanze',
    pronta: true,
    dellaPlancia: true,
  ),
  luci('Luci', 'luci', pronta: true, dellaPlancia: true),
  clima('Clima', 'clima', pronta: true, dellaPlancia: true),
  temperatura(
    'Temperatura',
    'temperatura',
    pronta: true,
    dellaPlancia: true,
  ),
  finestre('Finestre', 'tapparelle', pronta: true, dellaPlancia: true),
  agenda('Agenda', 'agenda', pronta: true, dellaPlancia: true),
  sicurezza(
    'Sicurezza',
    'sicurezza',
    pronta: true,
    dellaPlancia: true,
  ),
  prese('Prese', 'prese', pronta: true, dellaPlancia: true),
  musica('Musica', 'media', pronta: true, dellaPlancia: true),
  robot('Robot', 'robot', pronta: true, dellaPlancia: true),
  energia('Energia', 'energia', pronta: true, dellaPlancia: true),
  elettrodomestici(
    'Elettrodomestici',
    'elettrodomestici',
    pronta: true,
    dellaPlancia: true,
  ),
  continuita(
    'Continuità',
    'ups',
    pronta: true,
    dellaPlancia: true,
  ),
  minipc('MiniPC', 'minipc', pronta: true, dellaPlancia: true),
  dispositivi(
    'Dispositivi',
    'widget',
    pronta: true,
  ),
  aiutanti('Aiutanti', 'impostazioni'),
  zigbee('Zigbee', 'runtime'),
  automazioni('Automazioni', 'azioni');

  const Sezione(
    this.titolo,
    this.disegno, {
    this.pronta = false,
    this.dellaPlancia = false,
  });

  final String titolo;

  /// Il disegno della sezione: lo stesso della plancia, per nome. Vedi
  /// `vestito/oggetti.dart`.
  final String disegno;

  /// `false` finche' quel blocco non e' scritto: la voce si vede, spenta.
  final bool pronta;

  /// Una pagina della plancia di DashboardModern: compare solo se in quella
  /// casa c'e' qualcosa da mostrarci.
  final bool dellaPlancia;
}

/// Le pagine della plancia che questa casa ha davvero: una sezione senza
/// niente dentro non sta nella barra, come nella plancia web.
List<Sezione> sezioniDellaPlancia(ConfigurazioneDellaPlancia? config) {
  if (config == null || !config.configurata) return const [Sezione.plancia];
  return [
    Sezione.plancia,
    if (config.stanze.isNotEmpty) Sezione.stanze,
    if (config.gruppiDiLuci().isNotEmpty) Sezione.luci,
    if (config.unitaClima.isNotEmpty) Sezione.clima,
    if (config.stanze.any((s) => s.temperatura.isNotEmpty)) Sezione.temperatura,
    if (config.coperture.isNotEmpty) Sezione.finestre,
    if (config.calendari.isNotEmpty || config.liste.isNotEmpty) Sezione.agenda,
    if (config.entita(riferimentoDellaCentrale) != null ||
        config.porte.isNotEmpty ||
        config.telecamere.isNotEmpty)
      Sezione.sicurezza,
    if (config.prese.isNotEmpty) Sezione.prese,
    if (config.lettori.isNotEmpty) Sezione.musica,
    if (config.robot.any((r) => r.entita.isNotEmpty)) Sezione.robot,
    if (config.impianti.any((i) => i.posto == 0 || i.configurato) ||
        carichiDellEnergia(config).isNotEmpty)
      Sezione.energia,
    if (config.elettrodomestici.any((e) => e.abilitato))
      Sezione.elettrodomestici,
    if (config.ups.isNotEmpty) Sezione.continuita,
    if (config.caselle.keys.any((c) => c.startsWith('dm.server_')))
      Sezione.minipc,
  ];
}
