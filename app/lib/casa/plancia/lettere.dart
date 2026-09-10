/// Le lettere senza accenti.
///
/// Serve in due posti in cui bisogna confrontare due parole scritte da persone
/// diverse: l'area di Home Assistant contro la stanza della plancia, e il nome
/// di una persona contro il suo identificativo. «Salotto» e «Salottò» sono la
/// stessa stanza, e «Niccolò» deve diventare `niccolo`, non `niccol`.
///
/// Nella plancia questo lo fa `String.prototype.normalize("NFKD")`, che scompone
/// una lettera accentata in lettera piu' segno e lascia buttare via il segno.
/// **Dart quella funzione non ce l'ha**: non c'e' la normalizzazione Unicode
/// nella libreria di serie, e la sola espressione regolare che toglie i segni
/// non trova niente da togliere — perche' senza scomporre, «ò» e' un carattere
/// solo e non due.
///
/// Allora la tavola sta qui, scritta. Copre il latino accentato che si usa in
/// Europa; quello che non copre passa oltre e diventa un trattino, che e'
/// esattamente quello che faceva prima — ma per «ò» adesso non succede piu'.
library;

const _tavola = <String, String>{
  'à': 'a',
  'á': 'a',
  'â': 'a',
  'ã': 'a',
  'ä': 'a',
  'å': 'a',
  'ā': 'a',
  'ă': 'a',
  'ą': 'a',
  'è': 'e',
  'é': 'e',
  'ê': 'e',
  'ë': 'e',
  'ē': 'e',
  'ĕ': 'e',
  'ė': 'e',
  'ę': 'e',
  'ě': 'e',
  'ì': 'i',
  'í': 'i',
  'î': 'i',
  'ï': 'i',
  'ī': 'i',
  'ĭ': 'i',
  'į': 'i',
  'ı': 'i',
  'ò': 'o',
  'ó': 'o',
  'ô': 'o',
  'õ': 'o',
  'ö': 'o',
  'ø': 'o',
  'ō': 'o',
  'ŏ': 'o',
  'ő': 'o',
  'ù': 'u',
  'ú': 'u',
  'û': 'u',
  'ü': 'u',
  'ū': 'u',
  'ŭ': 'u',
  'ů': 'u',
  'ű': 'u',
  'ų': 'u',
  'ý': 'y',
  'ÿ': 'y',
  'ñ': 'n',
  'ń': 'n',
  'ň': 'n',
  'ņ': 'n',
  'ç': 'c',
  'ć': 'c',
  'č': 'c',
  'ĉ': 'c',
  'ċ': 'c',
  'ş': 's',
  'ś': 's',
  'š': 's',
  'ș': 's',
  'ţ': 't',
  'ť': 't',
  'ț': 't',
  'ž': 'z',
  'ź': 'z',
  'ż': 'z',
  'ğ': 'g',
  'ĝ': 'g',
  'ġ': 'g',
  'ģ': 'g',
  'ř': 'r',
  'ŕ': 'r',
  'ł': 'l',
  'ĺ': 'l',
  'ľ': 'l',
  'đ': 'd',
  'ď': 'd',
  'ß': 'ss',
  'æ': 'ae',
  'œ': 'oe',
};

/// I segni che restano appiccicati a una lettera quando qualcuno **ha** gia'
/// scomposto: arrivano da fuori, e vanno via lo stesso.
final _segni = RegExp('[̀-ͯ]');

/// La stessa parola, senza accenti e in minuscolo.
String senzaAccenti(String parola) {
  final basso = parola.toLowerCase().replaceAll(_segni, '');
  final fuori = StringBuffer();
  for (final lettera in basso.split('')) {
    fuori.write(_tavola[lettera] ?? lettera);
  }
  return fuori.toString();
}
