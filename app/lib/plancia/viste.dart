/// Le viste: uno stato di Home Assistant letto come lo legge una persona.
///
/// Una `media_player.salone` in `playing` con dentro venti attributi non dice
/// niente da sola. Qui diventa «sta suonando *Nuvole bianche*, volume 34,
/// il tasto avanti c'e' e quello indietro no» — e da li' una scheda si
/// disegna senza sapere niente di Home Assistant.
///
/// Cosa un apparecchio **sa fare** non si indovina dal nome: sta in
/// `supported_features`, una maschera di bit. Un tasto che non corrisponde a
/// un bit e' un tasto che non fa niente, e non deve esistere: premerlo e non
/// veder succedere nulla e' peggio che non trovarlo.
library;

import '../casa/entita.dart';
import 'configurazione.dart';
import 'numeri.dart';

bool _ha(Entita? letto, int bit) {
  final maschera = comeNumero(letto?.attributi['supported_features'])?.toInt();
  return maschera != null && (maschera & bit) == bit;
}

/* ─── Chi suona ──────────────────────────────────────────────────────────── */

/// I bit di `media_player`, come li definisce Home Assistant.
class _Musica {
  static const pausa = 1;
  static const volume = 4;
  static const muto = 8;
  static const indietro = 16;
  static const avanti = 32;
  static const accende = 128;
  static const spegne = 256;
  static const suona = 16384;
  static const sorgente = 2048;
}

class VistaDelLettore {
  const VistaDelLettore({
    required this.entita,
    required this.nome,
    required this.stanzaId,
    required this.stato,
    required this.titolo,
    required this.artista,
    required this.album,
    required this.copertina,
    required this.volume,
    required this.muto,
    required this.sorgente,
    required this.sorgenti,
    required this.puoPausa,
    required this.puoAvanti,
    required this.puoIndietro,
    required this.puoVolume,
    required this.puoMuto,
    required this.puoAccendere,
    required this.puoSorgente,
  });

  final String entita;
  final String nome;
  final String stanzaId;

  /// Lo stato grezzo: `playing`, `paused`, `idle`, `off`, `unavailable`.
  final String stato;
  final String titolo;
  final String artista;
  final String album;

  /// L'indirizzo della copertina, quando Home Assistant ne pubblica uno.
  final String copertina;

  /// Da 0 a 100, o `null` quando questo apparecchio non ha un volume.
  final int? volume;
  final bool muto;
  final String sorgente;
  final List<String> sorgenti;
  final bool puoPausa;
  final bool puoAvanti;
  final bool puoIndietro;
  final bool puoVolume;
  final bool puoMuto;
  final bool puoAccendere;
  final bool puoSorgente;

  bool get suona => stato == 'playing' || stato == 'buffering';
  bool get inPausa => stato == 'paused';
  bool get spento => stato == 'off' || stato == 'standby';
  bool get disponibile => stato != 'unavailable' && stato.isNotEmpty;

  /// Cosa sta suonando, in una riga: «Nuvole bianche — Ludovico Einaudi».
  String get cosaSuona => [
    if (titolo.isNotEmpty) titolo,
    if (artista.isNotEmpty) artista,
  ].join(' — ');

  /// La parola dello stato, per chi non ha niente in riproduzione.
  String get parola => switch (stato) {
    'playing' || 'buffering' => 'In riproduzione',
    'paused' => 'In pausa',
    'idle' => 'Fermo',
    'off' || 'standby' => 'Spento',
    'unavailable' => 'Non raggiungibile',
    _ => 'Sconosciuto',
  };
}

VistaDelLettore vistaDelLettore(Lettore lettore, Entita? letto) {
  final attributi = letto?.attributi ?? const {};
  final volume = comeNumero(attributi['volume_level']);
  return VistaDelLettore(
    entita: lettore.entita,
    nome: lettore.nome.isNotEmpty
        ? lettore.nome
        : pulito(attributi['friendly_name']).isNotEmpty
        ? pulito(attributi['friendly_name'])
        : lettore.entita.split('.').last.replaceAll('_', ' '),
    stanzaId: lettore.stanzaId,
    stato: pulito(letto?.stato).toLowerCase(),
    titolo: pulito(attributi['media_title']),
    artista: pulito(
      attributi['media_artist'] ?? attributi['media_album_artist'],
    ),
    album: pulito(attributi['media_album_name']),
    copertina: pulito(attributi['entity_picture']),
    volume: volume == null ? null : (volume * 100).round().clamp(0, 100),
    muto: attributi['is_volume_muted'] == true,
    sorgente: pulito(attributi['source']),
    sorgenti: [
      for (final una in (attributi['source_list'] as List?) ?? const [])
        if (pulito(una).isNotEmpty) pulito(una),
    ],
    puoPausa: _ha(letto, _Musica.pausa) || _ha(letto, _Musica.suona),
    puoAvanti: _ha(letto, _Musica.avanti),
    puoIndietro: _ha(letto, _Musica.indietro),
    puoVolume: _ha(letto, _Musica.volume) && volume != null,
    puoMuto: _ha(letto, _Musica.muto),
    puoAccendere: _ha(letto, _Musica.accende) || _ha(letto, _Musica.spegne),
    puoSorgente: _ha(letto, _Musica.sorgente),
  );
}

/* ─── Chi pulisce ────────────────────────────────────────────────────────── */

/// I bit di `vacuum`.
class _Aspirapolvere {
  static const pausa = 4;
  static const ferma = 8;
  static const allaBase = 16;
  static const potenza = 32;
  static const trova = 128;
  static const parte = 8192;
}

/// Come si chiamano gli stati di un robot, in italiano.
const parolaDelRobot = {
  'cleaning': 'Sta pulendo',
  'mowing': 'Sta tagliando',
  'returning': 'Torna alla base',
  'docked': 'Alla base',
  'idle': 'In attesa',
  'paused': 'In pausa',
  'error': 'Errore',
  'unavailable': 'Non raggiungibile',
  'unknown': 'Sconosciuto',
};

class VistaDelRobot {
  const VistaDelRobot({
    required this.entita,
    required this.nome,
    required this.stanzaId,
    required this.stato,
    required this.batteria,
    required this.potenza,
    required this.potenze,
    required this.errore,
    required this.puoPartire,
    required this.puoPausa,
    required this.puoFermarsi,
    required this.puoTornare,
    required this.puoFarsiTrovare,
    required this.puoPotenza,
  });

  final String entita;
  final String nome;
  final String stanzaId;
  final String stato;
  final num? batteria;
  final String potenza;
  final List<String> potenze;
  final String errore;
  final bool puoPartire;
  final bool puoPausa;
  final bool puoFermarsi;
  final bool puoTornare;
  final bool puoFarsiTrovare;
  final bool puoPotenza;

  bool get alLavoro => stato == 'cleaning' || stato == 'mowing';
  bool get allaBase => stato == 'docked';
  bool get inCarica => allaBase && batteria != null && batteria! < 100;
  bool get inErrore => stato == 'error';
  String get parola => parolaDelRobot[stato] ?? 'Sconosciuto';
}

VistaDelRobot vistaDelRobot(Robot robot, Entita? letto, Entita? batteriaSua) {
  final attributi = letto?.attributi ?? const {};
  final grezzo = pulito(letto?.stato).toLowerCase();
  return VistaDelRobot(
    entita: robot.entita,
    nome: robot.nome.isNotEmpty
        ? robot.nome
        : pulito(attributi['friendly_name']).isNotEmpty
        ? pulito(attributi['friendly_name'])
        : robot.entita.split('.').last.replaceAll('_', ' '),
    stanzaId: robot.stanzaId,
    stato: letto == null
        ? 'unavailable'
        : parolaDelRobot.containsKey(grezzo)
        ? grezzo
        : 'unknown',
    /* La batteria puo' stare su un sensore suo — molti robot la pubblicano
     * cosi' — e allora quella comanda: e' la piu' precisa delle due. */
    batteria:
        comeNumero(batteriaSua?.stato) ??
        comeNumero(attributi['battery_level']),
    potenza: pulito(attributi['fan_speed']),
    potenze: [
      for (final una in (attributi['fan_speed_list'] as List?) ?? const [])
        if (pulito(una).isNotEmpty) pulito(una),
    ],
    errore: pulito(attributi['error']),
    puoPartire: _ha(letto, _Aspirapolvere.parte),
    puoPausa: _ha(letto, _Aspirapolvere.pausa),
    puoFermarsi: _ha(letto, _Aspirapolvere.ferma),
    puoTornare: _ha(letto, _Aspirapolvere.allaBase),
    puoFarsiTrovare: _ha(letto, _Aspirapolvere.trova),
    puoPotenza: _ha(letto, _Aspirapolvere.potenza),
  );
}

/* ─── La centrale antifurto ──────────────────────────────────────────────── */

/// Un modo di inserimento, col servizio che lo chiede.
class ModoDellAllarme {
  const ModoDellAllarme(
    this.modo,
    this.bit,
    this.servizio,
    this.stato,
    this.nome,
  );

  final String modo;
  final int bit;
  final String servizio;
  final String stato;
  final String nome;
}

/// I modi, dal piu' vicino a casa al piu' lontano. Il disinserimento non e'
/// uno di questi — c'e' sempre, e sta in fondo.
const modiDellAllarme = [
  ModoDellAllarme('home', 1, 'alarm_arm_home', 'armed_home', 'In casa'),
  ModoDellAllarme('away', 2, 'alarm_arm_away', 'armed_away', 'Fuori'),
  ModoDellAllarme('night', 4, 'alarm_arm_night', 'armed_night', 'Notte'),
  ModoDellAllarme(
    'vacation',
    32,
    'alarm_arm_vacation',
    'armed_vacation',
    'Vacanza',
  ),
  ModoDellAllarme(
    'custom',
    16,
    'alarm_arm_custom_bypass',
    'armed_custom_bypass',
    'Parziale',
  ),
];

const disinserimento = ModoDellAllarme(
  'disarm',
  0,
  'alarm_disarm',
  'disarmed',
  'Sblocca',
);

/// Quando la centrale non dichiara niente si tengono i due inserimenti che la
/// plancia ha sempre avuto: meglio un tasto in piu' che una pagina senza tasti.
const _senzaDichiarazione = ['away', 'night'];

/// I tasti da disegnare per questa centrale: quello che accetta, piu' lo
/// sblocco, che accetta sempre.
List<ModoDellAllarme> modiAccettati(Entita? centrale) {
  final maschera = comeNumero(centrale?.attributi['supported_features'])
      ?.toInt();
  final inserimenti = maschera == null || maschera == 0
      ? modiDellAllarme
            .where((uno) => _senzaDichiarazione.contains(uno.modo))
            .toList()
      : modiDellAllarme
            .where((uno) => (maschera & uno.bit) == uno.bit)
            .toList();
  return [...inserimenti, disinserimento];
}

/// Il tasto acceso adesso.
///
/// Se la centrale e' in `armed_home` ma il tasto «In casa» non c'e' — perche'
/// non lo dichiara — si accende «Fuori», che e' il piu' vicino, invece di
/// lasciare la fila spenta.
String modoAcceso(String? stato, List<ModoDellAllarme> disponibili) {
  final valore = pulito(stato).toLowerCase();
  if (valore.isEmpty) return '';
  if (valore == disinserimento.stato) return disinserimento.modo;
  final esatto = modiDellAllarme
      .where((uno) => uno.stato == valore)
      .firstOrNull;
  if (esatto == null) return '';
  final disegnati = disponibili.map((uno) => uno.modo).toSet();
  if (disegnati.contains(esatto.modo)) return esatto.modo;
  if (esatto.modo != 'away' && disegnati.contains('away')) return 'away';
  return '';
}

/// Se il tastierino deve comparire prima di chiamare questo servizio.
///
/// Senza `code_format` un codice non esiste, e chiederlo sarebbe teatro:
/// un PIN che nessuno verifica non protegge niente.
bool serveIlCodice(Entita? centrale, String servizio) {
  final formato = pulito(centrale?.attributi['code_format']).toLowerCase();
  if (formato.isEmpty || formato == 'none' || formato == 'null') return false;
  if (servizio == disinserimento.servizio) return true;
  return centrale?.attributi['code_arm_required'] != false;
}

/// Se il codice e' fatto di sole cifre: il tastierino si disegna di
/// conseguenza, invece di aprire una tastiera intera per quattro numeri.
bool codiceDiSoleCifre(Entita? centrale) =>
    pulito(centrale?.attributi['code_format']).toLowerCase() == 'number';

/// Come sta la centrale, detto in italiano.
String parolaDellAllarme(String? stato) =>
    switch (pulito(stato).toLowerCase()) {
      'disarmed' => 'Disinserito',
      'armed_home' => 'Inserito in casa',
      'armed_away' => 'Inserito',
      'armed_night' => 'Inserito notte',
      'armed_vacation' => 'Inserito vacanza',
      'armed_custom_bypass' => 'Inserito parziale',
      'arming' => 'Si sta inserendo',
      'pending' => 'In attesa',
      'triggered' => 'Allarme!',
      'unavailable' => 'Non raggiungibile',
      _ => 'Sconosciuto',
    };

/* ─── Le porte ───────────────────────────────────────────────────────────── */

class VistaDellaPorta {
  const VistaDellaPorta({
    required this.entita,
    required this.nome,
    required this.icona,
    required this.stato,
    required this.dominio,
  });

  final String entita;
  final String nome;
  final String icona;
  final String stato;
  final String dominio;

  bool get aperta =>
      stato == 'on' ||
      stato == 'open' ||
      stato == 'unlocked' ||
      stato == 'opening';
  bool get disponibile => stato != 'unavailable' && stato.isNotEmpty;

  /// Una serratura si dice chiusa o aperta; un cancello, aperto o chiuso.
  String get parola => switch (stato) {
    'locked' => 'Chiusa',
    'unlocked' => 'Aperta',
    'locking' => 'Si sta chiudendo',
    'unlocking' => 'Si sta aprendo',
    'open' || 'on' => 'Aperta',
    'closed' || 'off' => 'Chiusa',
    'opening' => 'Si sta aprendo',
    'closing' => 'Si sta chiudendo',
    'unavailable' => 'Non raggiungibile',
    _ => 'Sconosciuto',
  };

  /// Cosa si puo' premere: una serratura si apre e si chiude, un cancello e
  /// un pulsante si premono e basta.
  bool get siApreESiChiude => dominio == 'lock' || dominio == 'cover';
}

VistaDellaPorta vistaDellaPorta(Porta porta, Entita? letto) => VistaDellaPorta(
  entita: porta.entita,
  nome: porta.nome.isNotEmpty
      ? porta.nome
      : pulito(letto?.attributi['friendly_name']).isNotEmpty
      ? pulito(letto?.attributi['friendly_name'])
      : porta.entita.split('.').last.replaceAll('_', ' '),
  icona: porta.icona,
  stato: pulito(letto?.stato).toLowerCase(),
  dominio: porta.entita.split('.').first,
);
