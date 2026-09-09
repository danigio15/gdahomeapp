/// La Home: cosa mette in mostra la prima pagina, e in che ordine.
///
/// Sette chiavi che dicono tutte la stessa cosa da angolature diverse — cosa
/// si vede appena si apre la plancia — piu' le liste che le tessere leggono:
/// i lettori, la raccolta, i calendari, le liste della spesa, le persone, le
/// entita' messe li' a mano.
library;

String _pulito(dynamic valore) => '${valore ?? ''}'.trim();

List<Map<String, dynamic>> _righe(dynamic letto) => letto is List
    ? [
        for (final uno in letto)
          if (uno is Map) Map<String, dynamic>.from(uno),
      ]
    : const [];

/* ── i blocchi della Home, nel loro ordine ────────────────────────────────*/

const chiaveDeiBlocchi = 'cd_home_blocchi';

/// I quattro blocchi, nell'ordine di serie.
const blocchiDellaHome = <(String, String)>[
  ('persone', 'Le persone'),
  ('widget', 'Le tessere'),
  ('azioni', 'Le azioni rapide'),
  ('dispositivi', 'I dispositivi'),
];

/// L'ordine da usare, ripulito da quello salvato.
///
/// Regge tre cose che capitano davvero: un blocco scritto due volte, un nome
/// che non esiste piu' (una versione che toglie un blocco), e un blocco
/// **nuovo** che nella configurazione salvata non c'e' ancora — quello va in
/// coda al suo posto di serie, non perso e non messo per primo.
List<String> ordineDeiBlocchi(dynamic salvato) {
  final noti = {for (final (nome, _) in blocchiDellaHome) nome};
  final fila = <String>[];
  if (salvato is List) {
    for (final voce in salvato) {
      final nome = _pulito(voce);
      if (noti.contains(nome) && !fila.contains(nome)) fila.add(nome);
    }
  }
  for (final (nome, _) in blocchiDellaHome) {
    if (!fila.contains(nome)) fila.add(nome);
  }
  return fila;
}

/* ── le tessere ───────────────────────────────────────────────────────────*/

const chiaveDelleTessereDellaHome = 'cd_widgets';

/// Quando una tessera si stringe: mai, da sola, sempre.
const modiDelCompatto = ['mai', 'auto', 'sempre'];

/// Le preferenze delle tessere della Home.
///
/// `nascoste` sono le tessere che non si vogliono vedere, `ordine` quello in
/// cui stanno, `escluse` le **entita'** che restano fuori dalle tessere — ogni
/// tessera legge tutta la configurazione della sua sezione, e questa e' la
/// parola in contrario. `sorgenti` dice, per una tessera che riassume, quale
/// entita' mettere in primo piano invece della media.
class LeTessere {
  LeTessere({
    List<String>? nascoste,
    List<String>? ordine,
    List<String>? escluse,
    this.compatto = 'auto',
    Map<String, String>? sorgenti,
  }) : nascoste = nascoste ?? [],
       ordine = ordine ?? [],
       escluse = escluse ?? [],
       sorgenti = sorgenti ?? {};

  factory LeTessere.da(dynamic letto) {
    final dato = letto is Map
        ? Map<String, dynamic>.from(letto)
        : <String, dynamic>{};
    List<String> elenco(String chiave) => [
      for (final uno in (dato[chiave] as List? ?? const []))
        if (_pulito(uno).isNotEmpty) _pulito(uno),
    ];
    final compatto = _pulito(dato['compatto']);
    return LeTessere(
      nascoste: elenco('hidden'),
      ordine: elenco('order').toSet().toList(),
      escluse: elenco('excluded'),
      compatto: modiDelCompatto.contains(compatto) ? compatto : 'auto',
      sorgenti: {
        if (dato['sorgenti'] is Map)
          for (final voce in (dato['sorgenti'] as Map).entries)
            if (_pulito(voce.key).isNotEmpty && _pulito(voce.value).isNotEmpty)
              _pulito(voce.key): _pulito(voce.value),
      },
    );
  }

  final List<String> nascoste;
  final List<String> ordine;
  final List<String> escluse;
  String compatto;
  final Map<String, String> sorgenti;

  bool siVede(String quale) => !nascoste.contains(quale);

  void mostra(String quale, bool acceso) {
    nascoste.remove(quale);
    if (!acceso) nascoste.add(quale);
  }

  Map<String, dynamic> get daScrivere => {
    if (nascoste.isNotEmpty) 'hidden': nascoste,
    if (ordine.isNotEmpty) 'order': ordine,
    if (escluse.isNotEmpty) 'excluded': escluse,
    if (compatto != 'auto') 'compatto': compatto,
    if (sorgenti.isNotEmpty) 'sorgenti': sorgenti,
  };
}

/* ── quello che si tiene d'occhio dalla Home ──────────────────────────────*/

/// «Sensori sparsi che si vogliono tenere d'occhio dalla Home senza dar loro
/// una sezione intera.»
const chiaveDellEvidenza = 'cd_evidenza';

/// Le entita' messe in una sezione a mano, col loro nome e il loro disegno.
const chiaveDelleEntitaMie = 'cd_entita_mie';

/// Quante ne stanno in una sezione. Oltre non e' piu' «qualche entita' mia»:
/// e' una sezione, e per quella ce n'e' un'altra.
const massimoPerSezione = 12;

/// Le pagine intere fatte da chi usa la plancia.
const chiaveDelleSezioniMie = 'cd_sezioni_mie';

/// Una voce con entita', nome e disegno: la forma che hanno quasi tutte le
/// liste della Home. Senza entita' non e' una voce.
Map<String, String>? leggiUnaVoce(dynamic letto, int quale, String prefisso) {
  final dato = letto is Map
      ? Map<String, dynamic>.from(letto)
      : <String, dynamic>{};
  final entita = _pulito(dato['entity'] ?? dato['entity_id']);
  if (entita.isEmpty) return null;
  return {
    'id': _pulito(dato['id']).isNotEmpty
        ? _pulito(dato['id'])
        : '$prefisso-${quale + 1}',
    'entity': entita,
    'nome': _pulito(dato['nome'] ?? dato['name']),
    'icona': _pulito(dato['icona'] ?? dato['icon']),
    if (dato.containsKey('sezione') || dato.containsKey('tab'))
      'sezione': _pulito(dato['sezione'] ?? dato['tab']),
    if (dato.containsKey('colore')) 'colore': _pulito(dato['colore']),
  };
}

List<Map<String, String>> leggiLeVoci(dynamic letto, String prefisso) => [
  for (final (quale, uno) in _righe(letto).indexed)
    if (leggiUnaVoce(uno, quale, prefisso) case final voce?) voce,
];

/// Le voci da salvare: quelle vuote non si scrivono.
List<Map<String, dynamic>> vociDaScrivere(List<Map<String, String>> quali) => [
  for (final una in quali)
    {
      for (final voce in una.entries)
        if (voce.value.trim().isNotEmpty) voce.key: voce.value.trim(),
    },
];

/* ── i lettori, i calendari, le liste ─────────────────────────────────────*/

const chiaveDeiLettori = 'cd_media_player';
const chiaveDeiCalendari = 'cd_calendari';
const chiaveDelleListe = 'cd_todo';
const chiaveDellePersone = 'cd_people';

/* ── la raccolta ──────────────────────────────────────────────────────────*/

const chiaveDeiRifiuti = 'cd_rifiuti';

/// Dodici materiali sono gia' piu' di quanti ne separi qualunque comune, e una
/// pagina che scorre all'infinito non aiuta.
const massimoDeiRifiuti = 12;

/// I materiali che si conoscono, ciascuno col suo colore e il suo simbolo:
/// sono i colori dei bidoni, quelli che uno ha gia' in testa.
const materialiDeiRifiuti = <(String, String, String)>[
  ('plastica', '🧴', '#eab308'),
  ('carta', '📦', '#3b82f6'),
  ('vetro', '🍾', '#22c55e'),
  ('organico', '🍎', '#a16207'),
  ('indifferenziato', '🗑️', '#64748b'),
  ('metalli', '🥫', '#94a3b8'),
  ('verde', '🌿', '#16a34a'),
  ('ingombranti', '🛋️', '#8b5cf6'),
  ('oli', '🛢️', '#f97316'),
  ('pannolini', '🧷', '#ec4899'),
  ('altro', '♻️', '#0ea5e9'),
];

/// La raccolta: il calendario da cui nasce, e le righe.
({String calendario, List<Map<String, dynamic>> righe}) leggiLaRaccolta(
  dynamic letto,
) {
  final dato = letto is Map
      ? Map<String, dynamic>.from(letto)
      : <String, dynamic>{};
  final righe = _righe(dato['righe'] ?? dato['rows'])
      .take(massimoDeiRifiuti)
      .toList();
  return (calendario: _pulito(dato['calendario']), righe: righe);
}

/* ── i sensori girati ─────────────────────────────────────────────────────*/

/// Le aperture il cui sensore dice il contrario: chiuso quando e' aperta.
///
/// Capita, e non e' colpa di nessuno: un contatto magnetico montato al
/// contrario e' un contatto montato al contrario. Il `null` resta `null` — un
/// sensore muto non diventa una finestra chiusa per il solo fatto d'essere
/// girato.
const chiaveDeiVersi = 'cd_stati_invertiti';

Set<String> leggiIVersi(dynamic letto) => {
  if (letto is List)
    for (final uno in letto)
      if (_pulito(uno).isNotEmpty) _pulito(uno),
};

/* ── il resto delle chiavi di casa ────────────────────────────────────────*/

/// La barra in fondo: sempre visibile, o a scomparsa con la maniglia.
///
/// «E' una scelta della plancia, non del dispositivo che l'ha fatta: chi la
/// mette ferma sul telefono se la ritrova ferma anche sul computer.»
const chiaveDellaBarra = 'cd_navbar_mode';

/// Chi guarda e basta: la plancia si vede, ma non si comanda.
const chiaveDelSoloLettura = 'cd_solo_lettura';

/// I nomi delle pagine, cambiati.
const chiaveDeiNomiDelleSezioni = 'cd_section_names';

/// Le pagine accese o spente a mano, invece che da sole quando c'e' qualcosa
/// dentro.
const chiaveDelleSezioniAMano = 'cd_sections_manual';

/// I pezzi della plancia che si sono fatti sparire.
const chiaveDeiNascosti = 'cd_hidden_elements';

/// Le parole della plancia, riscritte.
const chiaveDeiTesti = 'cd_text_overrides';

/// I nomi delle caselle, riscritti.
const chiaveDelleEtichette = 'cd_slot_labels';

/// Il meteo: quello di casa invece di quello del servizio.
const chiaveDelMeteoProprio = 'cd_meteo_entita_proprie';

/// I disegni degli avvisi, e i nomi in piu'.
const chiaveDeiDisegniDegliAvvisi = 'cd_avvisi_icone';
const chiaveDeiNomiDegliAvvisi = 'cd_avvisi_names_extra';

/// I gruppi di luci aggiunti a mano, e quelli tolti.
///
/// «Di luci» nel nome non e' pedanteria: `chiaveDeiGruppi` senza altro c'e'
/// gia', ed e' quella dei sottocarichi dell'energia. Due costanti con lo
/// stesso nome in due file stanno buone finche' nessuno le importa insieme.
const chiaveDeiGruppiDiLuci = 'cd_gruppi_extra';
const chiaveDeiGruppiDiLuciTolti = 'cd_gruppi_removed';

/// L'ordine delle luci, le loro stanze, e l'ordine delle stanze.
const chiaveDellOrdineDelleLuci = 'cd_luci_order';
const chiaveDelleStanzeDelleLuci = 'cd_luci_rooms';
const chiaveDellOrdineDelleStanze = 'cd_luci_room_order';

/// I piani della casa, e i loro disegni.
const chiaveDeiPiani = 'cd_floors';
const chiaveDeiDisegniDeiPiani = 'cd_floor_icons';

/// Le entita' assegnate a una stanza.
const chiaveDelleEntitaDelleStanze = 'cd_stanze_entita';

/// Il clima: la scheda al contrario, e il tasto rapido.
const chiaveDelClimaAlContrario = 'cd_clima_inverti_card';
const chiaveDelClimaRapido = 'cd_clima_rapido';
const chiaveDelClimaRapidoPerUnita = 'cd_clima_rapido_unita';

/// La lavatrice: i suoi programmi, e il suo ritratto.
const chiaveDeiProgrammi = 'cd_lavatrice_programmi';
const chiaveDelRitrattoDellaLavatrice = 'cd_lavatrice_visual';

/// Quando c'e' sia una foto sia un disegno, quale vince.
const chiaveDellaFotoPrimaDelDisegno = 'cd_visual_prefer_image';

/// L'auto: i suoi dati in piu', e il suo ritratto.
const chiaveDeiDatiDellAuto = 'cd_ev_meta';
const chiaveDelRitrattoDellAuto = 'cd_ev_visual';

/// La continuita': i dati in piu' di ogni gruppo.
const chiaveDeiDatiDellaContinuita = 'cd_ups_meta';

/// Il fumo: quando conta come rilevato.
const chiaveDelFumo = 'cd_fumo_rilevato';

/// I dispositivi della plancia storica, e le voci del Report di una volta.
const chiaveDeiDispositivi = 'cd_devices';
const chiaveDelReportDiUnaVolta = 'cd_report_devices';

/* ── il tasto rapido del clima ────────────────────────────────────────────*/

/// Le modalita' di Home Assistant, meno «off»: il tasto serve ad accendere, e
/// spegnere lo fa gia' premendolo una seconda volta.
const modiDelClima = <(String, String)>[
  ('cool', 'Raffredda'),
  ('heat', 'Riscalda'),
  ('heat_cool', 'Automatico caldo/freddo'),
  ('auto', 'Automatico'),
  ('dry', 'Deumidifica'),
  ('fan_only', 'Solo ventola'),
];

/// Quello che la plancia ha sempre fatto: resta il comportamento di chi non
/// apre mai la configurazione.
const climaDiSerie = (modo: 'cool', gradi: 26.0, ventola: 'auto');

/// Sotto i cinque gradi e sopra i trentacinque non c'e' un condizionatore che
/// obbedisca: e' un numero digitato male, non una scelta.
const gradiMinimi = 5.0;
const gradiMassimi = 35.0;

/// Il tasto rapido, ripulito.
///
/// Una casella lasciata vuota vuol dire «non toccare»: chi ha un condizionatore
/// senza ventola non deve ricevere una chiamata che quel condizionatore non sa
/// eseguire, e chi la temperatura la tiene dal termostato non vuole che il
/// tasto gliela riscriva. Per questo i gradi possono essere `null`, che non e'
/// «zero gradi».
({String modo, double? gradi, String ventola}) leggiIlClimaRapido(
  dynamic letto,
) {
  final dato = letto is Map
      ? Map<String, dynamic>.from(letto)
      : <String, dynamic>{};
  final modo = _pulito(dato['mode']).toLowerCase();
  final scritto = _pulito(dato['temperature']);
  final quanti = double.tryParse(scritto.replaceAll(',', '.'));
  return (
    modo: modiDelClima.any((uno) => uno.$1 == modo) ? modo : climaDiSerie.modo,
    gradi: scritto.isEmpty
        ? null
        : (quanti == null || !quanti.isFinite
              ? climaDiSerie.gradi
              : ((quanti * 2).round() / 2).clamp(gradiMinimi, gradiMassimi)),
    ventola: _pulito(dato['fan']),
  );
}

Map<String, dynamic> climaRapidoDaScrivere(
  ({String modo, double? gradi, String ventola}) quale,
) => {
  'mode': quale.modo,
  if (quale.gradi != null) 'temperature': quale.gradi,
  if (quale.ventola.isNotEmpty) 'fan': quale.ventola,
};
