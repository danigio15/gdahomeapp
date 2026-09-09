/// Il numero piu' alto mai distribuito, e il prossimo.
///
/// La regola e' una sola, e vale per gli impianti dell'energia come per le
/// auto: **un identificativo non si riusa mai**. Guardare solo quelli vivi non
/// basta — chi cancella l'ultimo e ne aggiunge un altro si ritroverebbe lo
/// stesso numero, e con esso quello che apparteneva al cancellato: i carichi e
/// la tariffa di un impianto che non c'e' piu', le foto di un'auto che non c'e'
/// piu'. Per questo il segno resta scritto anche quando chi l'ha alzato se n'e'
/// andato.
///
/// Puro: entrano un elenco e un oggetto, esce un numero. E' `segnoPiuAlto` di
/// `core/segno-progressivo.js`, che nella plancia sta in un modulo suo proprio
/// perche' era scritta due volte e due copie della stessa regola prima o poi
/// divergono — e quando divergono si perdono i dati di qualcuno.
library;

/// Il numero piu' alto fra quelli in uso e quello annotato.
///
/// [elenco] gli elementi vivi, [metadata] dove il segno resta scritto,
/// [prefisso] la parte fissa dell'identificativo, [identificativo] come si
/// estrae l'id da un elemento, [campoSegno] la chiave del segno nei metadata,
/// [minimo] da dove parte il conto.
int segnoPiuAlto<T>({
  List<T> elenco = const [],
  Map<String, dynamic> metadata = const {},
  String prefisso = '',
  required String? Function(T voce) identificativo,
  String campoSegno = 'seq',
  int minimo = 0,
}) {
  final forma = RegExp('^${RegExp.escape(prefisso)}-(\\d+)\$');
  var daiVivi = minimo;
  for (final voce in elenco) {
    final trovato = forma.firstMatch((identificativo(voce) ?? '').trim());
    if (trovato == null) continue;
    final numero = int.tryParse(trovato.group(1) ?? '') ?? minimo;
    if (numero > daiVivi) daiVivi = numero;
  }
  final scritto = switch (metadata[campoSegno]) {
    final int quanto => quanto,
    final double quanto when quanto.isFinite => quanto.toInt(),
    final String quanto => int.tryParse(quanto.trim()) ?? minimo,
    _ => minimo,
  };
  return [daiVivi, scritto, minimo].reduce((a, b) => a > b ? a : b);
}

/// L'identificativo che sta per nascere: il segno piu' alto, piu' uno.
String prossimoIdentificativo<T>({
  List<T> elenco = const [],
  Map<String, dynamic> metadata = const {},
  String prefisso = '',
  required String? Function(T voce) identificativo,
  String campoSegno = 'seq',
  int minimo = 0,
}) =>
    '$prefisso-${segnoPiuAlto(elenco: elenco, metadata: metadata, prefisso: prefisso, identificativo: identificativo, campoSegno: campoSegno, minimo: minimo) + 1}';
