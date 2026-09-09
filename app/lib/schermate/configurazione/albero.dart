/// L'alberatura della configurazione: la stessa della plancia, in Dart.
///
/// Non e' un'alberatura inventata. E' quella che la plancia ha gia' — le
/// schede in cima all'editor di DashboardModern, lette dalla versione 1.4.15
/// (`frontend/legacy/dashboard-runtime-it.js`, la fila `.ed-tabs`, piu' la
/// scheda Prese che i moduli aggiungono da soli in `modules-entry.js`) —
/// riscritta qui voce per voce, con gli stessi nomi e nello stesso ordine di
/// senso. Chi ha configurato la dashboard nel browser deve ritrovare le sue
/// cose dove le lasciate, con lo stesso nome.
///
/// Cambia una cosa sola, ed e' il motivo per cui il file esiste: nella plancia
/// le diciannove schede stanno tutte in fila, una striscia orizzontale da
/// scorrere al buio. Su un telefono quella fila non ci sta. Qui le stesse
/// diciannove diventano **cinque famiglie**, che e' come uno le direbbe a
/// voce: la casa, le pagine, le cose di casa, gli avvisi, la manutenzione.
/// Nessuna voce si perde e nessuna si inventa — si raggruppano e basta.
///
/// Le due famiglie in fondo — chi puo' entrare, e l'app — nella plancia non
/// ci sono: la prima perche' una pagina web non sa chi la guarda, la seconda
/// perche' riguarda il telefono e non la casa.
library;

/// Da dove viene una voce.
enum Provenienza {
  /// Sta gia' nella Config della plancia: stessa scheda, stessi campi, e
  /// scrive le stesse chiavi sul ponte. Quello che cambia e' dove si apre.
  dallaPlancia,

  /// Non c'e' nella plancia: e' roba dell'app.
  dellApp,
}

/// Una voce dell'alberatura: una foglia, quella che si apre.
class Voce {
  const Voce(
    this.titolo,
    this.sotto, {
    required this.disegno,
    this.da,
    this.viene = Provenienza.dallaPlancia,
    this.pronta = false,
  });

  /// Come si chiama, e la riga sotto che dice cosa ci si trova.
  final String titolo;
  final String sotto;

  /// Il disegno, lo stesso della plancia. Vedi `vestito/oggetti.dart`.
  final String disegno;

  /// La scheda della Config da cui viene, col nome che ha nel codice della
  /// plancia (`visib`, `sez0`, `tapp`…). Serve a chi legge il codice per
  /// ritrovare l'originale, e alle prove per verificare che non manchi nulla.
  final String? da;

  final Provenienza viene;

  /// `false` finche' quella schermata non e' scritta: la voce si vede lo
  /// stesso, spenta, cosi' si sa dove sta andando l'app.
  final bool pronta;
}

/// Un gruppo di voci: il titolo che le tiene insieme.
class Famiglia {
  const Famiglia(this.titolo, this.sotto, this.voci);

  final String titolo;
  final String sotto;
  final List<Voce> voci;
}

/// L'alberatura intera.
const albero = <Famiglia>[
  Famiglia('La casa', 'Come si chiama, cosa si vede, com\'e\' fatta', [
    Voce(
      'Generali',
      'Nome della dashboard, sottotitolo, chi puo\' comandare',
      disegno: 'impostazioni',
      da: 'visib',
      pronta: true,
    ),
    Voce(
      'Le sezioni',
      'Quali pagine si vedono: Home, Energia, Auto, Solare, Clima, '
          'Temperatura, Sicurezza, MiniPC',
      disegno: 'evidenza',
      da: 'visib',
      pronta: true,
    ),
    Voce(
      'L\'ordine della barra',
      'In che fila stanno le pagine, in fondo alla plancia',
      disegno: 'mie',
      da: 'visib',
      pronta: true,
    ),
    Voce(
      'Le stanze',
      'Le stanze della casa, con la loro temperatura e la loro umidita\'',
      disegno: 'stanze',
      da: 'stanze',
      pronta: true,
    ),
  ]),
  Famiglia('Le pagine', 'Cosa mostra ognuna delle pagine della plancia', [
    Voce(
      'Home',
      'Le tessere della prima pagina: meteo, evidenza, azioni rapide, avvisi',
      disegno: 'home',
      da: 'sez0',
      pronta: true,
    ),
    Voce(
      'Energia',
      'Fotovoltaico, consumi, carichi e il Report Analisi',
      disegno: 'energia',
      da: 'sez1',
      pronta: true,
    ),
    Voce(
      'Auto elettrica',
      'Entita\' dell\'auto e della wallbox, e i profili se le auto sono piu\' di una',
      disegno: 'ev',
      da: 'sez2',
      pronta: true,
    ),
    Voce(
      'Solare termico',
      'Il boiler solare',
      disegno: 'solare',
      da: 'sez3',
      pronta: true,
    ),
    Voce(
      'Sicurezza',
      'Telecamere e allarme',
      disegno: 'sicurezza',
      da: 'sez4',
      pronta: true,
    ),
    Voce(
      'MiniPC',
      'Il monitoraggio del server',
      disegno: 'minipc',
      da: 'sez6',
      pronta: true,
    ),
    Voce(
      'Temperatura',
      'Temperature e umidita\', stanza per stanza',
      disegno: 'temperatura',
      da: 'sez7',
      pronta: true,
    ),
    Voce(
      'Azioni rapide',
      'I bottoni della Home: cosa fanno e in che ordine stanno',
      disegno: 'azioni',
      da: 'sez8',
      pronta: true,
    ),
    Voce(
      'Clima',
      'Condizionatori e riscaldamento',
      disegno: 'clima',
      da: 'sez9',
      pronta: true,
    ),
  ]),
  Famiglia('Le cose di casa', 'Quello che si accende, si apre e si comanda', [
    Voce(
      'Luci',
      'Le luci, coi loro nomi e le loro stanze',
      disegno: 'luci',
      da: 'luci',
      pronta: true,
    ),
    Voce(
      'Prese',
      'Le prese comandate',
      disegno: 'prese',
      da: 'prese',
      pronta: true,
    ),
    Voce(
      'Finestre',
      'Tapparelle, tende e finestre',
      disegno: 'tapparelle',
      da: 'tapp',
      pronta: true,
    ),
    Voce(
      'Elettrodomestici',
      'Lavastoviglie, lavatrice, forno, stufa: quali ci sono e cosa dicono',
      disegno: 'elettrodomestici',
      da: 'appliances',
      pronta: true,
    ),
    Voce(
      'Piscina',
      'Sensori, pompa e filtrazione automatica',
      disegno: 'piscina',
      da: 'pool',
      pronta: true,
    ),
    Voce(
      'Irrigazione',
      'Le zone e i loro tempi',
      disegno: 'irrigazione',
      da: 'irr',
      pronta: true,
    ),
  ]),
  Famiglia(
    'Piu\' di uno',
    'Quello di cui la plancia tiene un elenco, e non uno solo',
    [
      Voce(
        'Centrali d\'allarme',
        'Le centrali di casa, e quale comanda la pagina Sicurezza',
        disegno: 'sicurezza',
        da: 'sez4',
        pronta: true,
      ),
      Voce(
        'Scaldabagni',
        'Gli scaldabagni, uno per bagno se serve',
        disegno: 'scaldabagno',
        da: 'sez3',
        pronta: true,
      ),
      Voce(
        'Impianti termici',
        'Caldaie e pompe di calore',
        disegno: 'caldaia',
        da: 'sez9',
        pronta: true,
      ),
      Voce(
        'Continuita\'',
        'I gruppi di continuita\'',
        disegno: 'minipc',
        da: 'sez6',
        pronta: true,
      ),
    ],
  ),
  Famiglia('Gli avvisi', 'Quando la casa deve farsi sentire', [
    Voce(
      'Quadro avvisi',
      'Cosa fa comparire un avviso, e con che parole',
      disegno: 'avvisi',
      da: 'avvisi',
      pronta: true,
    ),
  ]),
  Famiglia('Manutenzione', 'Quando qualcosa non torna', [
    Voce(
      'Autorilevamento',
      'Guarda tutte le entita\' di Home Assistant e compila da solo luci, '
          'clima, stanze e telecamere',
      disegno: 'backup',
      da: 'visib',
    ),
    Voce(
      'Sostituzioni',
      'Hai cambiato una presa o un sensore: qui si sostituisce ovunque compaia',
      disegno: 'custom',
      da: 'sost',
      pronta: true,
    ),
    Voce(
      'Runtime',
      'La diagnosi della plancia: versione, sincronizzazione, sezioni',
      disegno: 'runtime',
      da: 'runtime',
      pronta: true,
    ),
    Voce(
      'Riporta tutto com\'era',
      'Rimette la configurazione dell\'ultimo salvataggio, o la azzera',
      disegno: 'allerte',
      da: 'visib',
      pronta: true,
    ),
  ]),
  Famiglia(
    'Chi puo\' entrare',
    'Le persone e i telefoni. Nella plancia non c\'e\': una pagina web non sa chi la guarda',
    [
      Voce(
        'Le persone',
        'Chi usa questa casa. Un telefono puo\' anche non avere una persona: '
            'e\' il caso di adesso, e resta quello di serie',
        disegno: 'persone',
        viene: Provenienza.dellApp,
      ),
      Voce(
        'I telefoni abbinati',
        'Quali telefoni sono entrati, quando, e da dove passano',
        disegno: 'mie',
        viene: Provenienza.dellApp,
      ),
      Voce(
        'Chi comanda la configurazione',
        'Di serie chi ha abbinato per primo. Gli altri guardano e comandano, '
            'ma non riscrivono la plancia agli altri',
        disegno: 'sicurezza',
        viene: Provenienza.dellApp,
      ),
    ],
  ),
  Famiglia('L\'app', 'Il telefono, non la casa', [
    Voce(
      'Tema della plancia',
      'Chiaro, scuro, o come il telefono. Vale solo su questo dispositivo: '
          'il tablet in cucina puo\' stare sullo scuro e il telefono no',
      disegno: 'evidenza',
      viene: Provenienza.dellApp,
      pronta: true,
    ),
    Voce(
      'Barra della plancia',
      'La fila in fondo alla plancia: sempre visibile, o a scomparsa. Anche '
          'questa e\' di questo dispositivo',
      disegno: 'mie',
      viene: Provenienza.dellApp,
      pronta: true,
    ),
    Voce(
      'Plancia leggera',
      'Spegne le sfocature della plancia sui telefoni lenti. Di serie e\' spenta: '
          'le animazioni restano',
      disegno: 'runtime',
      viene: Provenienza.dellApp,
      pronta: true,
    ),
    Voce(
      'Come va l\'app',
      'Quanto ci mette a disegnare, quanto passa sul filo, dove sta perdendo tempo',
      disegno: 'minipc',
      viene: Provenienza.dellApp,
      pronta: true,
    ),
    Voce(
      'Acquisti',
      'Cosa e\' acceso su questa casa, e cosa si puo\' sbloccare',
      disegno: 'evidenza',
      viene: Provenienza.dellApp,
    ),
  ]),
];

/// Quante voci ci sono in tutto.
int get quanteVoci => albero.fold(0, (somma, f) => somma + f.voci.length);

/// Quante vengono dalla Config della plancia.
///
/// E' il numero che si scrive a chi legge — «le stesse diciannove voci» — e
/// non `quanteVoci`, che conta anche quelle che l'app aggiunge di suo: dire
/// «trenta» a chi ne ha viste diciannove nel browser lo manda a cercare le
/// undici che non trova.
int get quanteDallaPlancia => albero.fold(
  0,
  (somma, f) =>
      somma + f.voci.where((v) => v.viene == Provenienza.dallaPlancia).length,
);

/// Le schede della Config della plancia che quest'albero replica.
///
/// E' l'elenco vero, letto dalla 1.4.15: se un giorno la plancia ne aggiunge
/// una, la prova se ne accorge prima di noi.
const schedeDellaPlancia = <String>{
  'visib',
  'sez0',
  'sez1',
  'sez2',
  'sez3',
  'sez4',
  'sez6',
  'sez7',
  'sez8',
  'sez9',
  'pool',
  'irr',
  'tapp',
  'stanze',
  'luci',
  'prese',
  'appliances',
  'avvisi',
  'runtime',
};
