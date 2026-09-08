/// Come la configurazione della plancia torna in casa.
///
/// E' il gemello di `lettura.dart`, e passa dalla stessa strada: un comando di
/// Home Assistant — `dashboardmodern/config/set` — che il ponte inoltra senza
/// guardarci dentro.
///
/// Due cose vanno sapute prima di usarlo, perche' sbagliarle si paga caro.
///
/// **L'archivio non aggiorna: sostituisce.** Quello che si manda diventa tutto
/// quello che c'e': una chiave non mandata e' una chiave cancellata. Per
/// cambiarne una sola bisogna rimandarle tutte, e rimandarle **identiche** a
/// come sono arrivate — non ricostruite. Ci pensa `scattoCon`, che tiene le
/// chiavi grezze e ci mette dentro solo quelle che si toccano.
///
/// **Chi scrive per ultimo non vince: chi scrive per primo vince.** Si manda
/// la revisione che si e' letta; se in mezzo qualcuno ha salvato dalla
/// dashboard, la casa risponde «conflict» e non scrive niente. Meglio dire
/// «qualcuno ha cambiato, riguarda» che sovrascrivere in silenzio il lavoro di
/// un altro.
library;

import '../ponte/filo.dart';
import 'configurazione.dart';
import 'numeri.dart';

/// Il comando, come lo registra l'integrazione.
const comandoDelSalvataggio = 'dashboardmodern/config/set';

/// Com'e' finita.
enum EsitoDelSalvataggio {
  /// Scritta.
  salvata,

  /// Era gia' cosi': nessuna revisione nuova.
  invariata,

  /// Qualcun altro ha salvato nel frattempo. Non e' stato scritto niente.
  scavalcata,

  /// La casa ha rifiutato uno scatto vuoto sopra una plancia configurata.
  /// E' la rete di sicurezza contro la cancellazione per sbaglio.
  rifiutataPerchePresumibilmenteVuota,
}

/// Il risultato: com'e' finita, e la configurazione che adesso c'e' in casa.
class Salvataggio {
  const Salvataggio(this.esito, this.adesso);

  final EsitoDelSalvataggio esito;

  /// Quello che la casa ha in mano dopo la scrittura — che dopo un conflitto
  /// e' il lavoro dell'altro, non il nostro.
  final ConfigurazioneDellaPlancia adesso;

  bool get andata =>
      esito == EsitoDelSalvataggio.salvata ||
      esito == EsitoDelSalvataggio.invariata;
}

/// Salva la configurazione con dentro `cambiamenti`.
///
/// Le chiavi vanno passate gia' scritte come vanno scritte — quasi sempre
/// JSON; una chiave con valore vuoto si toglie.
Future<Salvataggio> salvaLaConfigurazione(
  Filo filo,
  ConfigurazioneDellaPlancia configurazione, {
  required Map<String, String> cambiamenti,
  DateTime? adesso,
}) async {
  final risposta = await filo.risultato({
    'type': comandoDelSalvataggio,
    if (configurazione.profilo.isNotEmpty) 'profile': configurazione.profilo,
    'snapshot': {
      'values': configurazione.scattoCon(cambiamenti),
      'updated_at': (adesso ?? DateTime.now()).millisecondsSinceEpoch,
    },
    'expected_revision': configurazione.revisione,
  });
  return leggiLEsito(risposta);
}

/// Cosa ha risposto la casa. A parte perche' e' la sola cosa qui dentro che si
/// possa provare senza una casa.
Salvataggio leggiLEsito(Object? risposta) {
  final detto = risposta is Map ? pulito(risposta['status']) : '';
  final esito = switch (detto) {
    'saved' => EsitoDelSalvataggio.salvata,
    'unchanged' => EsitoDelSalvataggio.invariata,
    'conflict' => EsitoDelSalvataggio.scavalcata,
    'refused-empty' => EsitoDelSalvataggio.rifiutataPerchePresumibilmenteVuota,
    /* Una casa che risponde qualcosa che non conosciamo non e' una casa che ha
     * salvato: si tratta come un conflitto, cioe' si va a rileggere. */
    _ => EsitoDelSalvataggio.scavalcata,
  };
  return Salvataggio(
    esito,
    ConfigurazioneDellaPlancia.dallaRisposta(risposta),
  );
}
