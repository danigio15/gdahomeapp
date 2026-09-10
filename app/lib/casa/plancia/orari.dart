/// Piu' momenti di irrigazione nella stessa giornata (#325).
///
/// E' il porto della parte scritta di `core/irrigazione-orari.js`: il primo
/// orario resta quello del runtime (`cd_irrigazione.time`, un campo solo, con
/// un padrone solo); gli altri stanno in `orari`, uno per riga, e ognuno porta
/// con se' due cose facoltative — quanti minuti deve durare quella corsa e
/// sotto quale umidita' del terreno ha senso farla.
///
/// La decisione «tocca a questo, adesso» la prende la plancia; qui si scrive
/// solo l'elenco, nella forma che lei sa leggere.
library;

/// L'ora scritta come la scrive un `<input type="time">`: `FORMA_ORARIO`.
final formaDellOrario = RegExp(r'^([01]\d|2[0-3]):([0-5]\d)$');

/// L'orario di sempre, quello che il runtime mette se non c'e' niente.
const orarioPredefinito = '06:30';

/// Quanti minuti al massimo puo' durare una corsa: otto ore non e' una
/// plancia, e mezzo minuto non e' un'irrigazione.
const minutiMassimiDellaCorsa = 480;

/// Quanti minuti sono passati da mezzanotte, o `null` se non e' un'ora.
int? minutiDelGiorno(String? ora) {
  final pezzi = formaDellOrario.firstMatch((ora ?? '').trim());
  if (pezzi == null) return null;
  return int.parse(pezzi.group(1)!) * 60 + int.parse(pezzi.group(2)!);
}

/// Un orario in piu' dell'irrigazione.
class OrarioDellIrrigazione {
  const OrarioDellIrrigazione({this.ora = '', this.minuti, this.seSottoA});

  /// `HH:MM`. Vuota finche' non la si scrive.
  final String ora;

  /// I minuti di questa corsa, per tutte le zone. `null`: comandano le zone.
  final int? minuti;

  /// Parte solo col terreno piu' asciutto di cosi' (%). `null`: sempre.
  final int? seSottoA;

  /// Se l'ora e' un'ora: solo queste la plancia le mette in fila.
  bool get valido => minutiDelGiorno(ora) != null;

  OrarioDellIrrigazione con({String? ora, int? minuti, int? seSottoA}) =>
      OrarioDellIrrigazione(
        ora: ora ?? this.ora,
        minuti: minuti ?? this.minuti,
        seSottoA: seSottoA ?? this.seSottoA,
      );

  /// Senza i minuti, o senza la soglia: `null` non si puo' passare a [con].
  OrarioDellIrrigazione senza({bool minuti = false, bool seSottoA = false}) =>
      OrarioDellIrrigazione(
        ora: ora,
        minuti: minuti ? null : this.minuti,
        seSottoA: seSottoA ? null : this.seSottoA,
      );
}

int? _numero(Object? valore) {
  if (valore == null) return null;
  if (valore is num) return valore.isFinite ? valore.round() : null;
  final testo = '$valore'.trim();
  if (testo.isEmpty) return null;
  return num.tryParse(testo.replaceAll(',', '.'))?.round();
}

/// Gli orari scritti in `cd_irrigazione.orari`, come stanno.
///
/// Si tengono anche le righe senza un'ora valida: sono quelle che uno sta
/// ancora scrivendo, e la plancia fa lo stesso (`orariSalvati` le rilegge
/// tutte, `orariDelProgramma` poi salta quelle che non sono un'ora).
List<OrarioDellIrrigazione> leggiGliOrari(Object? scritto) {
  if (scritto is! List) return const [];
  return [
    for (final riga in scritto)
      if (riga is Map)
        OrarioDellIrrigazione(
          ora: '${riga['ora'] ?? riga['time'] ?? ''}'.trim(),
          minuti: _numero(riga['minuti'] ?? riga['mins']),
          seSottoA: _numero(riga['seSottoA'] ?? riga['soilBelow']),
        )
      else if (riga is String)
        OrarioDellIrrigazione(ora: riga.trim()),
  ];
}

/// L'elenco da scrivere, ripulito come fa `scriviGliOrari`: i minuti fra uno
/// e quattrocentottanta, la soglia fra zero e cento, e le chiavi facoltative
/// solo se ci sono. Vuoto vuol dire «togli la chiave».
List<Map<String, Object>> orariDaScrivere(
  Iterable<OrarioDellIrrigazione> orari,
) => [
  for (final orario in orari)
    {
      'ora': orario.ora.trim(),
      if (orario.minuti != null)
        'minuti': orario.minuti!.clamp(1, minutiMassimiDellaCorsa),
      if (orario.seSottoA != null) 'seSottoA': orario.seSottoA!.clamp(0, 100),
    },
];

/// Solo le ore buone, in ordine di orologio e senza doppioni, col primo
/// orario davanti: e' `orariDelProgramma`, per dire sulla tessera «ogni
/// giorno alle 06:30 · 20:30».
List<String> oreDelProgramma(Map<String, dynamic> irrigazione) {
  final prima = '${irrigazione['time'] ?? ''}'.trim();
  final elenco = <String>[
    minutiDelGiorno(prima) != null ? prima : orarioPredefinito,
  ];
  for (final orario in leggiGliOrari(irrigazione['orari'])) {
    if (orario.valido && !elenco.contains(orario.ora)) elenco.add(orario.ora);
  }
  elenco.sort((a, b) => minutiDelGiorno(a)!.compareTo(minutiDelGiorno(b)!));
  return elenco;
}
