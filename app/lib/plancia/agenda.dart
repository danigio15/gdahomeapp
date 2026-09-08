/// L'agenda: gli impegni dei calendari e le cose da fare.
///
/// Sono due mezze cose che rispondono alla stessa domanda — «cosa mi tocca
/// oggi?» — e per questo stanno in una tessera sola. Il numero grande sono gli
/// impegni che restano oggi, perche' quello risponde a «sono libero stasera?»
/// prima ancora di leggere; la didascalia porta i primi due col titolo,
/// perche' un appuntamento senza titolo non e' un appuntamento.
///
/// Una cosa da fare con una data **e'** un impegno di quel giorno: entra
/// nell'agenda accanto agli appuntamenti, ma non diventa un appuntamento —
/// resta una cosa da spuntare, e al posto dell'ora dice «da fare». Un
/// appuntamento si sposta, una scadenza si fa.
///
/// A differenza di tutto il resto della plancia, questi dati non stanno negli
/// stati: lo stato di un `calendar.*` dice solo acceso o spento, e quello di
/// un `todo.*` solo quante voci restano. Le voci vere si chiedono a Home
/// Assistant coi servizi `calendar.get_events` e `todo.get_items`, che
/// rispondono davvero solo se glielo si chiede con `return_response`.
///
/// Le regole vengono da `calendario-model.js`, `todo-model.js` e dalla tessera
/// in `home-widgets-section.js`.
library;

import 'configurazione.dart';
import 'numeri.dart';
import 'tessere.dart';

/// Quanti giorni avanti si guarda.
const int giorniAvanti = 30;

/* ─── Gli istanti ────────────────────────────────────────────────────────── */

final _soloData = RegExp(r'^\d{4}-\d{2}-\d{2}$');

/// Quando comincia una cosa, e se dura tutto il giorno.
///
/// Home Assistant scrive `2026-09-08` per un giorno intero e un istante ISO
/// per un'ora: la prima forma **e'** «tutto il giorno», e non c'e' bisogno di
/// indovinarlo dalla durata.
({DateTime? quando, bool tuttoIlGiorno}) istanteDi(Object? valore) {
  final testo = pulito(valore);
  if (testo.isEmpty) return (quando: null, tuttoIlGiorno: false);
  if (_soloData.hasMatch(testo)) {
    final pezzi = testo.split('-').map(int.parse).toList();
    return (
      quando: DateTime(pezzi[0], pezzi[1], pezzi[2]),
      tuttoIlGiorno: true,
    );
  }
  final letto = DateTime.tryParse(testo);
  return (quando: letto?.toLocal(), tuttoIlGiorno: false);
}

/// Il giorno di un istante, come chiave: «2026-09-08», nel fuso di chi guarda.
String chiaveDelGiorno(DateTime quando) =>
    '${quando.year.toString().padLeft(4, '0')}-'
    '${quando.month.toString().padLeft(2, '0')}-'
    '${quando.day.toString().padLeft(2, '0')}';

const _mesi = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
];

const _giorniDellaSettimana = [
  'lunedi',
  'martedi',
  'mercoledi',
  'giovedi',
  'venerdi',
  'sabato',
  'domenica',
];

/// Il nome di un giorno: «Oggi», «Domani», e poi la data.
///
/// Dal terzo giorno in poi la parola non c'e' piu' — «dopodomani» in un elenco
/// lungo confonde — e si scrive la data, che e' quello che si cercherebbe su
/// un'agenda di carta.
String etichettaDelGiorno(String giorno, DateTime adesso) {
  if (giorno == chiaveDelGiorno(adesso)) return 'Oggi';
  /* Non «piu' ventiquattro ore»: nel giorno del cambio d'ora ventiquattro ore
   * non sono un giorno, e «Domani» finirebbe per chiamarsi con la sua data. */
  if (giorno == chiaveDelGiorno(ilGiornoDopo(adesso))) return 'Domani';
  final pezzi = giorno.split('-');
  if (pezzi.length != 3) return giorno;
  final quando = DateTime.tryParse('$giorno 00:00:00');
  if (quando == null) return giorno;
  final settimana = _giorniDellaSettimana[quando.weekday - 1];
  return '$settimana ${quando.day} ${_mesi[quando.month - 1]}';
}

/// I giorni si contano come li conta il calendario, non a colpi di ore.
DateTime ilGiornoDopo(DateTime quando) =>
    DateTime(quando.year, quando.month, quando.day + 1);

/// L'ora di un istante: «14:30».
String orarioDi(DateTime quando) =>
    '${quando.hour.toString().padLeft(2, '0')}:'
    '${quando.minute.toString().padLeft(2, '0')}';

/* ─── Gli impegni ────────────────────────────────────────────────────────── */

/// Un appuntamento, come lo racconta Home Assistant.
class Impegno {
  const Impegno({
    required this.entita,
    required this.titolo,
    required this.inizio,
    required this.fine,
    this.descrizione = '',
    this.luogo = '',
    this.tuttoIlGiorno = false,
  });

  final String entita;
  final String titolo;
  final DateTime inizio;
  final DateTime fine;
  final String descrizione;
  final String luogo;
  final bool tuttoIlGiorno;

  String get nome => titolo.isEmpty ? 'Senza titolo' : titolo;

  bool inCorso(DateTime adesso) =>
      !inizio.isAfter(adesso) && fine.isAfter(adesso);

  /// Quando comincia, scritto: «Tutto il giorno» o l'ora.
  String get quando => tuttoIlGiorno ? 'Tutto il giorno' : orarioDi(inizio);
}

/// La risposta di `calendar.get_events`: `response[entita].events`.
///
/// Una risposta storta — servizio mancante, entita' sbagliata — torna elenco
/// vuoto, mai un errore a meta' disegno.
List<Impegno> impegniDallaRisposta(Object? risultato, String entita) {
  final risposta = risultato is Map ? risultato['response'] : null;
  final dentro = risposta is Map ? risposta[entita] : null;
  final eventi = dentro is Map ? dentro['events'] : null;
  if (eventi is! List) return const [];
  return [
    for (final uno in eventi)
      if (uno is Map)
        if (istanteDi(uno['start']) case (
          quando: final inizio?,
          :final tuttoIlGiorno,
        ))
          Impegno(
            entita: entita,
            titolo: pulito(uno['summary']),
            descrizione: pulito(uno['description']),
            luogo: pulito(uno['location']),
            inizio: inizio,
            /* Senza una fine dichiarata l'evento dura quanto il suo inizio:
             * meglio un istante che una durata inventata. */
            fine: istanteDi(uno['end']).quando ?? inizio,
            tuttoIlGiorno: tuttoIlGiorno,
          ),
  ];
}

/// Gli impegni in ordine di inizio.
List<Impegno> ordinaGliImpegni(List<Impegno> impegni) =>
    impegni.toList()..sort((uno, altro) {
      final inizio = uno.inizio.compareTo(altro.inizio);
      return inizio != 0 ? inizio : uno.fine.compareTo(altro.fine);
    });

/// Quelli che restano: i non ancora finiti.
///
/// Un impegno cominciato ma non finito e' il piu' importante di tutti — e'
/// quello dentro cui si sta adesso — e buttarlo perche' «e' passato» vorrebbe
/// dire nascondere la riunione in corso.
List<Impegno> impegniDaQui(List<Impegno> impegni, DateTime adesso) =>
    ordinaGliImpegni(impegni).where((uno) => uno.fine.isAfter(adesso)).toList();

/* ─── Le cose da fare ────────────────────────────────────────────────────── */

/// Una voce di una lista: da fare o gia' spuntata.
class Cosa {
  const Cosa({
    required this.lista,
    required this.uid,
    required this.titolo,
    required this.fatta,
    this.scadenza,
    this.tuttoIlGiorno = false,
  });

  final String lista;
  final String uid;
  final String titolo;
  final bool fatta;
  final DateTime? scadenza;
  final bool tuttoIlGiorno;

  String get nome => titolo.isEmpty ? 'Senza titolo' : titolo;
}

/// La risposta di `todo.get_items`: `response[entita].items`.
List<Cosa> coseDallaRisposta(Object? risultato, String entita) {
  final risposta = risultato is Map ? risultato['response'] : null;
  final dentro = risposta is Map ? risposta[entita] : null;
  final voci = dentro is Map ? dentro['items'] : null;
  if (voci is! List) return const [];
  return [
    for (final una in voci)
      if (una is Map)
        if (pulito(una['summary']).isNotEmpty || pulito(una['uid']).isNotEmpty)
          Cosa(
            lista: entita,
            uid: pulito(una['uid']),
            titolo: pulito(una['summary']),
            fatta: pulito(una['status']).toLowerCase() == 'completed',
            scadenza: istanteDi(una['due']).quando,
            tuttoIlGiorno: istanteDi(una['due']).tuttoIlGiorno,
          ),
  ];
}

List<Cosa> daFare(Iterable<Cosa> cose) =>
    cose.where((una) => !una.fatta).toList();

/* ─── L'agenda messa insieme ─────────────────────────────────────────────── */

/// Una riga dell'agenda: un appuntamento o una scadenza.
class RigaDellAgenda {
  const RigaDellAgenda.impegno(Impegno questo) : impegno = questo, cosa = null;
  const RigaDellAgenda.scadenza(Cosa questa) : impegno = null, cosa = questa;

  final Impegno? impegno;
  final Cosa? cosa;

  bool get eUnaCosa => cosa != null;
  String get nome => impegno?.nome ?? cosa!.nome;
  DateTime get inizio => impegno?.inizio ?? cosa!.scadenza!;

  /// Al posto dell'ora, una scadenza dice cos'e': una cosa da fare, non un
  /// appuntamento a cui presentarsi.
  String get quando => impegno?.quando ?? 'Da fare';
}

/// Un giorno dell'agenda, con dentro le sue righe.
class GiornoDellAgenda {
  const GiornoDellAgenda(this.giorno, this.righe);

  final String giorno;
  final List<RigaDellAgenda> righe;
}

/// Le cose scadute e quelle a venire, giorno per giorno.
///
/// Quello che e' scaduto esce dai giorni e va in un gruppo suo, in cima: una
/// cosa da fare di martedi' scorso non appartiene a martedi' scorso — nessuno
/// scorre indietro per trovarla — appartiene ad adesso, ed e' proprio la riga
/// per cui si apre l'agenda.
({List<RigaDellAgenda> inRitardo, List<GiornoDellAgenda> giorni})
agendaPerGiorno(List<Impegno> impegni, List<Cosa> cose, DateTime adesso) {
  final oggi = chiaveDelGiorno(adesso);
  final giorni = <String, List<RigaDellAgenda>>{};
  void metti(String giorno, RigaDellAgenda riga) =>
      giorni.putIfAbsent(giorno, () => []).add(riga);

  for (final uno in impegniDaQui(impegni, adesso)) {
    /* Un impegno di piu' giorni sta nel giorno in cui comincia, non in tutti
     * quelli che attraversa: ripeterlo farebbe cinque righe uguali per una
     * vacanza sola. Quello in corso cominciato ieri fa eccezione, e va oggi:
     * e' li' che lo si cerca. */
    metti(
      uno.inizio.isBefore(adesso) ? oggi : chiaveDelGiorno(uno.inizio),
      RigaDellAgenda.impegno(uno),
    );
  }

  final inRitardo = <RigaDellAgenda>[];
  for (final una in daFare(cose)) {
    final scadenza = una.scadenza;
    if (scadenza == null) continue;
    final giorno = chiaveDelGiorno(scadenza);
    if (giorno.compareTo(oggi) < 0) {
      inRitardo.add(RigaDellAgenda.scadenza(una));
    } else {
      metti(giorno, RigaDellAgenda.scadenza(una));
    }
  }

  final ordinati = giorni.keys.toList()..sort();
  return (
    inRitardo: inRitardo
      ..sort((una, altra) => una.inizio.compareTo(altra.inizio)),
    giorni: [
      for (final giorno in ordinati)
        GiornoDellAgenda(
          giorno,
          giorni[giorno]!..sort((una, altra) {
            final quando = una.inizio.compareTo(altra.inizio);
            return quando != 0 ? quando : una.nome.compareTo(altra.nome);
          }),
        ),
    ],
  );
}

/// Quando si sta guardando, quando si conta.
enum QuandoConta { oggi, domani, avanti, mai }

/// Quanti impegni restano, e di quale giorno.
///
/// Oggi se ce n'e' oggi, se no domani, se no quello che resta: «diciotto» non
/// dice se stasera si e' liberi, «2 oggi» si'. E a oggi vuoto si guarda avanti
/// invece di dire «non lo so».
({int quante, QuandoConta quando}) contoDellAgenda(
  List<Impegno> impegni,
  List<Cosa> cose,
  DateTime adesso,
) {
  final oggi = chiaveDelGiorno(adesso);
  final domani = chiaveDelGiorno(ilGiornoDopo(adesso));
  final restano = impegniDaQui(impegni, adesso);
  final scadenze = [
    for (final una in daFare(cose))
      if (una.scadenza != null) una,
  ];

  /* Un impegno cominciato ieri e ancora in corso e' di oggi: e' adesso che
   * riguarda chi guarda. E le scadenze passate pure — e' oggi che vanno
   * fatte, non il giorno in cui sono scadute. */
  final diOggi =
      restano
          .where(
            (uno) => chiaveDelGiorno(uno.inizio) == oggi || uno.inCorso(adesso),
          )
          .length +
      scadenze
          .where((una) => chiaveDelGiorno(una.scadenza!).compareTo(oggi) <= 0)
          .length;
  if (diOggi > 0) return (quante: diOggi, quando: QuandoConta.oggi);

  final diDomani =
      restano.where((uno) => chiaveDelGiorno(uno.inizio) == domani).length +
      scadenze.where((una) => chiaveDelGiorno(una.scadenza!) == domani).length;
  if (diDomani > 0) return (quante: diDomani, quando: QuandoConta.domani);

  final avanti =
      restano.length +
      scadenze
          .where((una) => chiaveDelGiorno(una.scadenza!).compareTo(oggi) > 0)
          .length;
  return avanti > 0
      ? (quante: avanti, quando: QuandoConta.avanti)
      : (quante: 0, quando: QuandoConta.mai);
}

/* ─── La tessera ─────────────────────────────────────────────────────────── */

/// La tessera dell'Agenda, o niente quando non c'e' ne' un calendario ne' una
/// lista da guardare.
Tessera? tesseraDellAgenda(
  ConfigurazioneDellaPlancia config,
  List<Impegno> impegni,
  List<Cosa> cose, {
  required DateTime adesso,
  bool inArrivo = false,
}) {
  final calendari = config.calendari
      .where((uno) => config.widget.dentro(uno.entita))
      .toList();
  final liste = config.liste
      .where((una) => config.widget.dentro(una.entita))
      .toList();
  if (calendari.isEmpty && liste.isEmpty) return null;

  final restano = impegniDaQui(impegni, adesso);
  final primi = restano.take(2).toList();
  final aperte = daFare(cose).length;
  final conto = contoDellAgenda(impegni, cose, adesso);
  final oggi = chiaveDelGiorno(adesso);

  /* Un impegno nella didascalia: quando comincia e come si chiama. Il giorno
   * si scrive solo se non e' oggi — «Oggi 20:00» davanti a ogni riga sarebbe
   * una parola ripetuta che non distingue niente. */
  String scritto(Impegno uno) {
    if (uno.inCorso(adesso)) return 'Adesso · ${uno.nome}';
    final giorno = chiaveDelGiorno(uno.inizio);
    final ora = uno.tuttoIlGiorno ? '' : orarioDi(uno.inizio);
    final dove = giorno == oggi
        ? ora
        : '${etichettaDelGiorno(giorno, adesso)}${ora.isEmpty ? '' : ' $ora'}';
    return dove.isEmpty ? uno.nome : '$dove · ${uno.nome}';
  }

  final pezzi = <String>[
    if (calendari.isNotEmpty)
      primi.isEmpty
          ? (inArrivo ? 'Sto guardando…' : 'Niente in programma')
          : primi.map(scritto).join('  ·  '),
    if (liste.isNotEmpty) aperte > 0 ? '$aperte da fare' : 'Tutto fatto',
  ];

  final valore = calendari.isEmpty
      ? '$aperte'
      : switch (conto.quando) {
          QuandoConta.oggi => '${conto.quante} oggi',
          QuandoConta.domani => '${conto.quante} domani',
          QuandoConta.avanti => '${conto.quante} in arrivo',
          /* Il trattino resta per quando non c'e' davvero niente: li' e' vero. */
          QuandoConta.mai => '—',
        };

  return Tessera(
    chiave: 'agenda',
    colore: '#6366f1',
    etichetta: 'Agenda',
    valore: valore,
    didascalia: pezzi.where((p) => p.isNotEmpty).join('  ·  '),
    /* Nessun anello: mescolare la percentuale di cose spuntate con gli
     * appuntamenti darebbe un cerchio che non risponde a niente. */
    attiva: primi.any((uno) => uno.inCorso(adesso)) || aperte > 0,
    righe: [
      for (final uno in restano.take(6))
        Riga(
          entita: uno.entita,
          nome: uno.nome,
          simbolo: '📅',
          valore: chiaveDelGiorno(uno.inizio) == oggi
              ? uno.quando
              : '${etichettaDelGiorno(chiaveDelGiorno(uno.inizio), adesso)}'
                    '${uno.tuttoIlGiorno ? '' : ' ${orarioDi(uno.inizio)}'}',
          acceso: uno.inCorso(adesso),
        ),
      for (final una in daFare(cose).take(6))
        Riga(
          entita: una.lista,
          nome: una.nome,
          simbolo: '✅',
          valore: una.scadenza == null
              ? 'Da fare'
              : etichettaDelGiorno(chiaveDelGiorno(una.scadenza!), adesso),
          acceso: true,
        ),
    ],
  );
}
