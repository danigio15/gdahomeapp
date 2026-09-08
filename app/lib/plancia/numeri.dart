/// I numeri come si scrivono sulla plancia.
///
/// Virgola decimale e punto delle migliaia — «21,8°», «1.240 W», «7,66 kW» —
/// come li scrive la plancia web con `toLocaleString('it-IT')`. Sono le
/// stesse cifre nello stesso ordine: chi confronta le due plance non deve
/// trovare «21.8» da una parte e «21,8» dall'altra.
library;

/// Il numero con tante cifre dopo la virgola, o «—» quando non c'e'.
String numero(num? valore, {int cifre = 1}) {
  if (valore == null || !valore.isFinite) return '—';
  final scritto = valore.toStringAsFixed(cifre);
  final negativo = scritto.startsWith('-');
  final pulito = negativo ? scritto.substring(1) : scritto;
  final parti = pulito.split('.');
  final intero = parti[0];
  final decimali = parti.length > 1 ? parti[1] : '';
  final aGruppi = StringBuffer();
  for (var i = 0; i < intero.length; i += 1) {
    if (i > 0 && (intero.length - i) % 3 == 0) aGruppi.write('.');
    aGruppi.write(intero[i]);
  }
  return '${negativo ? '-' : ''}$aGruppi${decimali.isEmpty ? '' : ',$decimali'}';
}

/// Watt leggibili: sotto il migliaio il numero intero, sopra i chilowatt
/// con due decimali. «1.240 W» non sta in una tessera, «1,24 kW» si'.
String watt(num? valore) {
  if (valore == null || !valore.isFinite) return '—';
  if (valore.abs() >= 1000) return '${numero(valore / 1000, cifre: 2)} kW';
  return '${numero(valore, cifre: 0)} W';
}

/// Un numero letto da uno stato di Home Assistant, o `null` se non lo e'.
num? comeNumero(Object? valore) {
  if (valore is num) return valore.isFinite ? valore : null;
  if (valore is! String) return null;
  final letto = num.tryParse(valore.trim().replaceAll(',', '.'));
  return letto != null && letto.isFinite ? letto : null;
}

/// Un testo ripulito: `null`, spazi e numeri diventano una stringa senza
/// spazi intorno. E' il `clean` della plancia web.
String pulito(Object? valore) => valore == null ? '' : '$valore'.trim();
