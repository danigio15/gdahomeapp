/// Dove porta il tocco su una notifica.
///
/// «Queste cose che escono in basso non mi piacciono proprio, rivedile.» Una
/// notifica toccata non apre piu' un foglio dal basso col titolo e basta: va
/// dove sta la cosa di cui parla. L'antifurto alla pagina Sicurezza della
/// plancia, una porta ai Varchi, il movimento alla sua telecamera, la
/// lavatrice agli Elettrodomestici, il blackout all'Energia, un viaggio al
/// navigatore. Dove non c'e' un posto — o la casa adesso non risponde — si
/// apre la pagina della notifica (`schermate/la_notifica.dart`).
///
/// La casa lo dice dentro la busta (`apri`, `ponte/src/notifiche.js`); da un
/// ponte di prima lo si ricava dal tipo, con le stesse regole.
///
/// Niente Flutter qui dentro: e' la parte che si prova.
library;

import '../parole.dart';
import 'modello.dart';

/// Un posto dell'app dove una notifica puo' portare.
enum PostoDellaNotifica {
  /// Una pagina della plancia, per linguetta ([linguette]).
  plancia,

  /// La telecamera di [DoveApre.entita], dal vivo.
  telecamera,

  /// «La tua giornata».
  giornata,

  /// Il navigatore (gdanav), coi viaggi pianificati.
  navigatore,

  /// Il negozio da cui si aggiorna l'app: «aggiorna l'app»
  /// (`ponte/src/ultime-dell-app.js`).
  negozio,

  /// La pagina della notifica, nell'app: nessun posto suo.
  pagina,
}

/// Dove porta una notifica: il posto, e per la plancia le linguette da
/// provare in ordine (ogni plancia ha le sue: quella che c'e' vince).
class DoveApre {
  const DoveApre(this.posto, {this.linguette = const [], this.entita});

  final PostoDellaNotifica posto;
  final List<String> linguette;
  final String? entita;

  @override
  String toString() => '$posto ${linguette.join('|')} ${entita ?? ''}';
}

/// La sezione di un tipo, per un ponte che `apri` non lo manda: le stesse
/// parole di `SEZIONE_DI` in `ponte/src/notifiche.js`.
const Map<String, String> sezioneDelTipo = {
  'antifurto': 'sicurezza',
  'allarmi': 'sicurezza',
  'inserimenti': 'sicurezza',
  'uscito': 'sicurezza',
  'aperture': 'varchi',
  'movimento': 'telecamera',
  'campanello': 'telecamera',
  'elettrodomestici': 'elettrodomestici',
  'frigo': 'sensore',
  'animali': 'animali',
  'personalizzata': 'sensore',
  'pioggia': 'meteo',
  'arrivi': 'persone',
  'suggerimenti': 'assistente',
  'riepilogo': 'giornata',
  'blackout': 'energia',
  'viaggi': 'viaggi',
  'ha_notify': 'plancia',
  'aggiorna_app': 'negozio',
};

/// Le linguette della plancia di ogni sezione, nell'ordine in cui si
/// cercano. Una sezione senza linguette (il sensore del frigo,
/// l'assistente) apre la pagina della notifica.
const Map<String, List<String>> linguetteDellaSezione = {
  'sicurezza': ['security'],
  'varchi': ['varchi', 'aperture', 'security'],
  'elettrodomestici': ['appliances-main'],
  'energia': ['energy'],
  'persone': ['persone'],
  'meteo': ['meteo', 'home'],
  'animali': ['animali'],
  'plancia': ['home'],
};

/// Dove porta il tocco su questa notifica.
DoveApre doveApre(NotificaArrivata notifica) {
  final detta = notifica.apri;
  final sezione = detta?.sezione ?? sezioneDelTipo[notifica.tipo];
  final entita = detta?.entita ?? notifica.entita;
  if (notifica.apreLaGiornata || sezione == 'giornata') {
    return const DoveApre(PostoDellaNotifica.giornata);
  }
  if (sezione == 'telecamera') {
    /* La telecamera si apre solo se la notifica ne porta una: il ponte la
     * mette solo a chi la vede. */
    final camera = notifica.camera ?? detta?.entita;
    if (camera != null && camera.startsWith('camera.')) {
      return DoveApre(PostoDellaNotifica.telecamera, entita: camera);
    }
    return DoveApre(
      PostoDellaNotifica.plancia,
      linguette: linguetteDellaSezione['sicurezza']!,
      entita: entita,
    );
  }
  if (sezione == 'viaggi') return const DoveApre(PostoDellaNotifica.navigatore);
  if (sezione == 'negozio') return const DoveApre(PostoDellaNotifica.negozio);
  final linguette = linguetteDellaSezione[sezione];
  if (linguette == null) {
    return DoveApre(PostoDellaNotifica.pagina, entita: entita);
  }
  return DoveApre(
    PostoDellaNotifica.plancia,
    linguette: linguette,
    entita: entita,
  );
}

/// Le parole del tasto che dalla pagina della notifica porta al suo posto:
/// «Guarda dal vivo», «Apri Sicurezza»… `null` dove un posto non c'e'.
String? etichettaDelPosto(DoveApre dove) {
  switch (dove.posto) {
    case PostoDellaNotifica.telecamera:
      return inLingua(it: 'Guarda dal vivo', en: 'Watch live');
    case PostoDellaNotifica.giornata:
      return inLingua(it: 'Apri la tua giornata', en: 'Open your day');
    case PostoDellaNotifica.navigatore:
      return inLingua(it: 'Apri i viaggi', en: 'Open trips');
    case PostoDellaNotifica.negozio:
      return inLingua(it: "Aggiorna l'app", en: 'Update the app');
    case PostoDellaNotifica.pagina:
      return null;
    case PostoDellaNotifica.plancia:
      final prima = dove.linguette.isEmpty ? '' : dove.linguette.first;
      final (it, en) = switch (prima) {
        'security' => ('Sicurezza', 'Security'),
        'varchi' => ('Varchi', 'Openings'),
        'appliances-main' => ('Elettrodomestici', 'Appliances'),
        'energy' => ('Energia', 'Energy'),
        'persone' => ('Persone', 'People'),
        'meteo' => ('Meteo', 'Weather'),
        'animali' => ('Animali', 'Pets'),
        _ => ('la plancia', 'the dashboard'),
      };
      return inLingua(it: 'Apri $it', en: 'Open $en');
  }
}
