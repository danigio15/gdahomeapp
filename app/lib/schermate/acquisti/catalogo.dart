/// Il catalogo: tutto quello che si puo' comprare, e cosa e' gratis.
///
/// E' una **bozza**, e sta scritta in un posto solo apposta: la stessa lista
/// la legge la schermata dell'app, la scheda «Acquisti» della console
/// dell'add-on e `docs/ACQUISTI.md`. Tre posti che dicono tre prezzi diversi
/// e' il modo piu' rapido di perdere la fiducia di chi paga.
///
/// Le regole che hanno deciso la forma, in ordine:
///
///  1. **Quello che serve a vedere e comandare la propria casa non si paga.**
///     Mai. Compreso l'accesso da fuori: costa zero tenerlo in piedi, ed e'
///     il motivo per cui l'app esiste.
///  2. **Si paga per casa, non per telefono.** Chi compra lo vede sul
///     telefono, sul tablet in cucina e su quello di sua moglie. Un acquisto
///     per famiglia.
///  3. **Il limite si sente al secondo dispositivo**, non al primo: quando
///     l'app ha gia' dimostrato di valere. Il primo di ogni cosa e' gratis
///     davvero, non una vetrina.
library;

/// Quanto costa una cosa, e come si paga.
enum Modo {
  /// Si paga una volta e resta.
  unaTantum,

  /// Ogni mese, e si disdice quando si vuole.
  alMese,

  /// Non si paga.
  gratis,
}

/// Una voce del catalogo.
class Acquisto {
  const Acquisto(
    this.titolo,
    this.sotto, {
    required this.chiave,
    required this.disegno,
    this.prezzo,
    this.modo = Modo.unaTantum,
    this.consigliato = false,
  });

  final String titolo;
  final String sotto;

  /// La chiave del diritto, quella che il centralino firma e il ponte
  /// verifica. `casa.completa` le accende tutte.
  final String chiave;

  final String disegno;

  /// In euro. `null` quando e' gratis.
  final double? prezzo;
  final Modo modo;

  /// Quello che si consiglia: uno solo, e si vede.
  final bool consigliato;

  String get prezzoScritto => switch (modo) {
    Modo.gratis => 'gratis',
    Modo.alMese => '${_soldi(prezzo)} al mese',
    Modo.unaTantum => '${_soldi(prezzo)} una volta',
  };

  /// Il prezzo da solo, senza il «una volta» o «al mese»: sta nella colonna
  /// dei prezzi, e ogni volta si legge quello.
  String get soldi => modo == Modo.gratis ? 'gratis' : _soldi(prezzo);

  /// Ogni quanto: la riga piccola sotto il prezzo.
  String get quandoSiPaga => switch (modo) {
    Modo.gratis => '',
    Modo.alMese => 'al mese',
    Modo.unaTantum => 'una volta',
  };
}

String _soldi(double? quanto) => quanto == null
    ? '—'
    : '${quanto.toStringAsFixed(2).replaceAll('.', ',')} €';

/// Quello che resta gratis per sempre, scritto per esteso.
///
/// Sta nel catalogo e non in una nota a pie' di pagina: chi apre questa
/// schermata deve leggere per primo cosa **non** deve comprare.
const sempreGratis = <String>[
  'La plancia intera, con tutte le sue pagine',
  'Comandare la casa da fuori, dal centralino',
  'Piu\' case sullo stesso telefono',
  'L\'elenco dei dispositivi, e comandarli',
  'Le segnalazioni e la chat di assistenza',
  'Un dispositivo collegato: un elettrodomestico, un\'auto o un robot',
  'Una telecamera nella plancia',
  'L\'energia di adesso: quanto produci e quanto consumi',
  'Tre aiutanti, un\'automazione, un dispositivo Zigbee',
];

/// Il pacchetto: uno solo, e apre tutto.
const casaCompleta = Acquisto(
  'Casa completa',
  'Toglie tutti i limiti, per sempre e per tutta la casa. Comprende anche '
      'la precedenza nelle risposte alle segnalazioni.',
  chiave: 'casa.completa',
  disegno: 'home',
  prezzo: 19.99,
  consigliato: true,
);

/// Lo stesso pacchetto, per chi preferisce provare a mesi.
const casaCompletaAlMese = Acquisto(
  'Casa completa, a mesi',
  'Le stesse cose, si disdice quando si vuole.',
  chiave: 'casa.completa',
  disegno: 'home',
  prezzo: 1.99,
  modo: Modo.alMese,
);

/// I singoli, per chi vuole una cosa sola.
///
/// Messi insieme costano piu' del pacchetto, ed e' voluto: chi ne prende due
/// deve accorgersi da se' che gli conviene l'altro. Se si decide di venderne
/// uno solo, il primo e' quello dei dispositivi — e' quello che si sente.
const singoli = <Acquisto>[
  Acquisto(
    'Dispositivi senza limite',
    'Elettrodomestici, auto elettriche e robot: quanti ne hai.',
    chiave: 'app.dispositivi',
    disegno: 'elettrodomestici',
    prezzo: 6.99,
  ),
  Acquisto(
    'Energia completa',
    'Report, analisi per dispositivo, confronti nel tempo.',
    chiave: 'plancia.energia',
    disegno: 'energia',
    prezzo: 6.99,
  ),
  Acquisto(
    'Telecamere senza limite',
    'Tutte le telecamere di casa nella plancia, non una.',
    chiave: 'plancia.telecamere',
    disegno: 'telecamere',
    prezzo: 4.99,
  ),
  Acquisto(
    'Zigbee senza limite',
    'Abbina quanti dispositivi Zigbee vuoi, ZHA o Zigbee2MQTT.',
    chiave: 'app.zigbee',
    disegno: 'runtime',
    prezzo: 6.99,
  ),
  Acquisto(
    'Automazioni senza limite',
    'Il mago delle automazioni, senza il tetto di una.',
    chiave: 'app.automazioni',
    disegno: 'azioni',
    prezzo: 6.99,
  ),
  Acquisto(
    'Aiutanti senza limite',
    'Interruttori, numeri, testi, orari: quanti ne servono.',
    chiave: 'app.aiutanti',
    disegno: 'impostazioni',
    prezzo: 3.99,
  ),
];

/// I modi di avere le stesse cose senza pagare i negozi.
const senzaNegozio = <Acquisto>[
  Acquisto(
    'La prova di quattordici giorni',
    'Al primo abbinamento tutto e\' acceso per due settimane, senza carta e '
        'senza chiedere niente. Serve a vedere cosa si perde.',
    chiave: 'casa.completa',
    disegno: 'agenda',
    modo: Modo.gratis,
  ),
  Acquisto(
    'Un codice di sblocco',
    'Se hai un codice — da chi ti ha installato la casa, da una fiera, da '
        'noi — si batte qui e vale subito.',
    chiave: 'casa.completa',
    disegno: 'mie',
    modo: Modo.gratis,
  ),
  Acquisto(
    'Chiedere lo sblocco',
    'Se collaudi l\'app, se ci aiuti, o se hai un motivo: si chiede da qui '
        'e la richiesta arriva a chi puo\' concederlo.',
    chiave: 'casa.completa',
    disegno: 'segnalazioni',
    modo: Modo.gratis,
  ),
];
