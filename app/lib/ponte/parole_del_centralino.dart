/// Quello che dice il centralino quando chiude un filo, detto a chi guarda.
///
/// Chiudere un WebSocket permette di dire **perche'**, e quel perche' e' la
/// cosa piu' preziosa che passa di li': «questa casa adesso non e' collegata»
/// vale mille volte «il filo si e' chiuso», che e' quello che si leggeva
/// prima e che non dice niente a nessuno.
///
/// Solo che il centralino parla corto e parla una lingua sola — la sua, quella
/// del programma — perche' quelle frasi sono nate per finire in un registro,
/// non davanti a una persona. Qui diventano frasi da leggere: nella lingua di
/// chi guarda, e con dentro la parola «centralino», che e' l'informazione vera
/// — **dove** si e' fermata la strada. «Casa non collegata», da solo, chi lo
/// legge lo prende per «l'app non trova la casa», e va a controllare il
/// telefono: il telefono non c'entra niente.
///
/// Quello che non si riconosce passa com'era. Un centralino piu' nuovo di
/// questa app puo' dire cose che qui non ci sono, e ripeterle com'e' e' sempre
/// meglio che inventarne una traduzione.
library;

import '../parole.dart';

/// La frase del centralino, in parole nostre.
String inParoleNostre(String detto) {
  final nudo = detto.trim().toLowerCase();
  return switch (nudo) {
    'casa non collegata' => inLingua(
      it: 'la tua casa non è collegata al centralino',
      en: 'your home is not connected to the relay',
    ),
    "la casa si e' scollegata" || 'la casa si è scollegata' => inLingua(
      it: 'la tua casa si è scollegata dal centralino',
      en: 'your home disconnected from the relay',
    ),
    'nessun abbinamento in corso' => inLingua(
      it: 'nessun abbinamento in corso sul centralino',
      en: 'no pairing under way on the relay',
    ),
    'troppi telefoni su questa casa' => inLingua(
      it: 'troppi telefoni su questa casa',
      en: 'too many phones on this home',
    ),
    _ => detto.trim(),
  };
}
