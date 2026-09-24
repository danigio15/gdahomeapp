/// Cosa entra nella fotografia della casa che l'app lascia ad Android Auto.
///
/// La plancia gira in un riquadro ed e' una pagina web: gli stati di casa ce
/// li ha lei, in mano, aggiornati. Il servizio dell'auto vive nello stesso
/// processo dell'app, ma l'app puo' essere chiusa — chi sale in macchina
/// accende Android Auto, non gdahome — e aprire da li' un secondo collegamento
/// verso la casa vorrebbe dire una seconda copia delle chiavi: due posti che
/// sanno entrare, e il giorno che si scostano nessuno sa quale ha ragione.
///
/// Quindi la plancia manda poche righe da un canale suo, e qui si scrivono in
/// un file che l'auto legge. Il formato e come si prova stanno accanto al
/// codice che lo legge: `android/app/src/main/kotlin/.../auto/COME_SI_PROVA.md`.
///
/// ── Chi mette il nome della casa ────────────────────────────────────────
///
/// La plancia sa di essere una plancia: non sa di quale delle case dell'app
/// e'. Il nome lo mette qui l'app, che quella risposta ce l'ha, e per questo
/// la fotografia che arriva dalla pagina il nome non ce l'ha.
///
/// ── Niente di segreto ───────────────────────────────────────────────────
///
/// Quello che entra in questo file e' quello che si legge guidando: due o tre
/// numeri dell'energia, i nomi di chi c'e' in casa, i nomi dei tasti. Non ci
/// passano ne' indirizzi, ne' chiavi, ne' stati di sensori, e quello che arriva
/// dalla pagina non si copia come viene: si rilegge campo per campo e si lascia
/// fuori tutto il resto. Un campo nuovo, un giorno, dovra' essere scritto qui
/// per arrivare in macchina — ed e' voluto.
library;

import 'dart:convert';

/// Il file che l'auto legge: la cartella privata dell'app.
///
/// `getApplicationSupportDirectory()` su Android e' `context.getFilesDir()`,
/// che e' dove il Kotlin dell'auto va a leggere. I due nomi devono restare la
/// stessa cosa: sono i due capi dello stesso file.
const String nomeDelFile = 'gdahome-auto.json';

/// Quante ne entrano, per non scrivere un file grande per niente. Sono le
/// stesse dell'altra parte: tre misure, sei tasti.
const int misureAlMassimo = 3;
const int azioniAlMassimo = 6;

/// Quanti dispositivi entrano nella griglia. Sei, come i tasti: e' quello che
/// l'auto mostra in una schermata.
const int dispositiviAlMassimo = 6;

/// Quante ricette si tengono in tutto.
///
/// Dodici e non sei: adesso ne arrivano di due specie nello stesso elenco — i
/// tasti rapidi e i dispositivi — e un tetto da sei le tagliava a meta'. Chi
/// le taglia non se ne accorge: in macchina si preme un cancello e non succede
/// niente, perche' la sua ricetta era la settima.
const int ricetteAlMassimo = azioniAlMassimo + dispositiviAlMassimo;

/// Quanto lungo puo' essere un nome che arriva dalla pagina. In auto uno
/// lungo viene tagliato dal modello di Android comunque.
const int _quantoLungo = 64;

/// Oltre questo il messaggio non e' una fotografia: e' qualcos'altro, e non si
/// prova nemmeno a leggerlo.
const int _quantoGrande = 64 * 1024;

String _pulito(Object? valore, {int fino = _quantoLungo}) {
  final scritto = valore is String ? valore.trim() : '';
  return scritto.length <= fino ? scritto : scritto.substring(0, fino);
}

List<Map<String, Object?>> _elenco(Object? dal) =>
    dal is List ? dal.whereType<Map<String, Object?>>().toList() : const [];

/// La fotografia da scrivere, o `null` se quello che e' arrivato non lo e'.
///
/// Non solleva mai: il messaggio arriva da una pagina, e una pagina che si
/// sbaglia non deve poter fermare l'app. Un `null` vuol dire «non scrivo», e
/// l'auto continua a leggere quella di prima finche' non invecchia — che e'
/// meglio di un file mezzo scritto, e molto meglio di un'eccezione.
String? laFotoDaScrivere(
  String detto, {
  required String casa,
  bool daSola = true,
  int? adesso,
}) {
  if (detto.isEmpty || detto.length > _quantoGrande) return null;
  final letto = _prova(detto);
  if (letto is! Map<String, Object?>) return null;

  final misure = <Map<String, String>>[];
  for (final riga in _elenco(letto['fotovoltaico'])) {
    if (misure.length >= misureAlMassimo) break;
    final nome = _pulito(riga['nome']);
    final valore = _pulito(riga['valore']);
    if (nome.isEmpty || valore.isEmpty) continue;
    misure.add({'nome': nome, 'valore': valore});
  }

  /* I dispositivi di casa: quello che in macchina si guarda e si preme. Sono
   * la ragione per cui questa fotografia esiste, e stanno per primi. */
  final dispositivi = <Map<String, Object>>[];
  for (final riga in _elenco(letto['dispositivi'])) {
    if (dispositivi.length >= dispositiviAlMassimo) break;
    final id = _pulito(riga['id'], fino: _quantoLungo * 2);
    final nome = _pulito(riga['nome']);
    if (id.isEmpty || nome.isEmpty) continue;
    dispositivi.add({
      'id': id,
      'nome': nome,
      'genere': _pulito(riga['genere'], fino: 16),
      'acceso': riga['acceso'] == true,
      'stato': _pulito(riga['stato']),
    });
  }

  final persone = <Map<String, Object>>[];
  for (final riga in _elenco(letto['persone'])) {
    final nome = _pulito(riga['nome']);
    if (nome.isEmpty) continue;
    persone.add({'nome': nome, 'inCasa': riga['inCasa'] == true});
  }

  final azioni = <Map<String, Object>>[];
  for (final riga in _elenco(letto['azioni'])) {
    if (azioni.length >= azioniAlMassimo) break;
    final id = _pulito(riga['id'], fino: _quantoLungo * 2);
    final nome = _pulito(riga['nome']);
    if (id.isEmpty || nome.isEmpty) continue;
    azioni.add({
      'id': id,
      'nome': nome,
      'segno': _pulito(riga['segno'], fino: 8),
      /* Se parte da sola a schermo spento. Lo dicono in due: la plancia, che
       * sa cos'e' l'azione, e questo telefono, che sa se c'e' il lucchetto —
       * col lucchetto acceso non parte niente senza che l'app sia stata
       * aperta, ed e' il senso del lucchetto. Il tasto in macchina lo scrive,
       * perche' «e' partito» su una cosa che parte fra mezz'ora e' la bugia
       * peggiore che possa dire un cruscotto. */
      'subito': daSola && riga['subito'] == true,
    });
  }

  /* Senza niente da mostrare non si scrive: un file vuoto farebbe credere
   * all'auto di avere una fotografia quando non ce l'ha, e chi guarda non
   * avrebbe modo di accorgersene. */
  if (dispositivi.isEmpty &&
      misure.isEmpty &&
      persone.isEmpty &&
      azioni.isEmpty) {
    return null;
  }

  /* Il momento lo dice la pagina, che e' quella che ha guardato gli stati. Se
   * non l'ha detto — o ha detto una cosa che non e' un momento — vale adesso:
   * meglio una fotografia che invecchia dal momento in cui e' arrivata che
   * una che sembra nuova per sempre. */
  final quando = letto['quando'];
  return jsonEncode({
    'casa': _pulito(casa),
    'quando': quando is int && quando > 0
        ? quando
        : (adesso ?? DateTime.now().millisecondsSinceEpoch),
    'dispositivi': dispositivi,
    'fotovoltaico': misure,
    'persone': persone,
    'azioni': azioni,
  });
}

Object? _prova(String detto) {
  try {
    return jsonDecode(detto);
  } catch (_) {
    return null;
  }
}

/// Il file in cui l'auto lascia scritto cosa e' stato premuto.
///
/// Il servizio dell'auto con la casa non parla: non ha il filo e non ha le
/// chiavi, e dargliele vorrebbe dire due posti che sanno entrare in casa.
/// Scrive cosa e' stato premuto, e lo esegue l'app.
const String nomeDelComando = 'gdahome-auto-comando.json';

/// Quanto vale un comando. Due minuti.
///
/// «Apri il cancello» premuto in macchina e' una cosa che si vuole ADESSO: se
/// l'app lo trova un'ora dopo — il telefono in tasca, l'app mai riaperta — non
/// e' piu' quello che uno voleva, ed eseguirlo vorrebbe dire aprire il cancello
/// a casa vuota senza che nessuno l'abbia chiesto in quel momento. Scaduto si
/// butta, e non si fa niente: e' il verso giusto in cui sbagliare.
const int quantoValeIlComandoMs = 2 * 60 * 1000;

/// Il segno del tasto che l'auto ha chiesto, o `null` se non c'e' da premere.
///
/// Non solleva mai: un file mezzo scritto, un JSON storto, un momento che non
/// e' un momento valgono tutti «non premere». Un comando che non si capisce non
/// si indovina — dall'altra parte c'e' un cancello.
String? ilComandoDellAuto(String detto, {required int adesso}) {
  if (detto.isEmpty || detto.length > 4096) return null;
  final letto = _prova(detto);
  if (letto is! Map<String, Object?>) return null;
  final id = _pulito(letto['azione'], fino: _quantoLungo * 2);
  if (id.isEmpty) return null;
  final quando = letto['quando'];
  /* Senza un momento non si esegue: un comando che non dice quando e' stato
   * premuto non si puo' far scadere, e uno che non scade prima o poi parte al
   * momento sbagliato. */
  if (quando is! int || quando <= 0) return null;
  if (adesso - quando > quantoValeIlComandoMs) return null;
  /* E uno scritto nel futuro non e' un comando: e' un orologio che e' andato
   * avanti, o qualcosa che non torna. */
  if (quando - adesso > quantoValeIlComandoMs) return null;
  return id;
}

/// Il file in cui l'app tiene le ricette dei tasti.
///
/// **Non e' quello che legge l'auto.** Nel file dell'auto ci vanno i nomi, e
/// nomi e basta: un cruscotto in macchina non ha niente da farsene di
/// `switch.cancello_ingresso`. Qui invece c'e' quello che serve a eseguire, e
/// lo legge solo l'app — la cartella e' privata dell'app, e nessun'altra la
/// apre.
const String nomeDelleRicette = 'gdahome-auto-ricette.json';

/// Cosa fa un tasto, quando puo' farlo da solo.
class RicettaDellAzione {
  const RicettaDellAzione({
    required this.id,
    required this.dominio,
    required this.servizio,
    required this.entita,
    this.dati = const {},
  });

  /// Lo stesso segno che sta nella fotografia: «3|Cancello».
  final String id;
  final String dominio;
  final String servizio;
  final String entita;

  /// Quello che il servizio vuole oltre all'entita' — la voce di un menu.
  final Map<String, Object?> dati;

  Map<String, Object?> get comeSiScrive => {
    'id': id,
    'dominio': dominio,
    'servizio': servizio,
    'entita': entita,
    if (dati.isNotEmpty) 'dati': dati,
  };
}

/// Le ricette che stanno dentro quello che la plancia ha mandato.
///
/// Si rileggono campo per campo come tutto il resto: quello che arriva da una
/// pagina non si copia come viene, e qui dentro c'e' il nome di un servizio che
/// poi si chiama davvero. Non solleva mai.
List<RicettaDellAzione> leRicetteDaScrivere(String detto) {
  if (detto.isEmpty || detto.length > _quantoGrande) return const [];
  final letto = _prova(detto);
  if (letto is! Map<String, Object?>) return const [];
  final fuori = <RicettaDellAzione>[];
  for (final riga in _elenco(letto['ricette'])) {
    if (fuori.length >= ricetteAlMassimo) break;
    final id = _pulito(riga['id'], fino: _quantoLungo * 2);
    final dominio = _pulito(riga['dominio'], fino: 48);
    final servizio = _pulito(riga['servizio'], fino: 48);
    final entita = _pulito(riga['entita'], fino: _quantoLungo * 2);
    if (id.isEmpty ||
        dominio.isEmpty ||
        servizio.isEmpty ||
        !entita.contains('.')) {
      continue;
    }
    /* Una voce sola, e una stringa: e' l'unico dato che un'azione rapida porta
     * oltre all'entita'. Quello che non e' scritto qui non arriva a Home
     * Assistant, ed e' voluto. */
    final dati = riga['dati'];
    final voce = dati is Map ? _pulito(dati['option']) : '';
    fuori.add(
      RicettaDellAzione(
        id: id,
        dominio: dominio,
        servizio: servizio,
        entita: entita,
        dati: voce.isEmpty ? const {} : {'option': voce},
      ),
    );
  }
  return fuori;
}

/// Come si scrivono sul disco, tutte insieme.
String leRicetteScritte(List<RicettaDellAzione> ricette) => jsonEncode({
  'ricette': [for (final una in ricette) una.comeSiScrive],
});

/// La ricetta di questo segno, fra quelle scritte. `null` se non c'e': il
/// tasto premuto in macchina non e' uno di quelli che partono da soli, o
/// l'elenco e' cambiato da quando la fotografia e' partita.
RicettaDellAzione? laRicettaDi(String id, List<RicettaDellAzione> ricette) {
  final quale = id.trim();
  if (quale.isEmpty) return null;
  for (final una in ricette) {
    if (una.id == quale) return una;
  }
  return null;
}
