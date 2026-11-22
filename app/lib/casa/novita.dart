/// Le novità dell'app, lette dal suo `CHANGELOG.md`.
///
/// «Cosa è cambiato? Non ci sto più dietro.» Le novità c'erano gia', scritte
/// bene e versione per versione, in `app/CHANGELOG.md`: le leggeva chi apriva
/// la release su GitHub, cioe' quasi nessuno di quelli che l'app la usano.
/// Adesso le legge l'app, e le fa vedere lei: una scheda breve la prima volta
/// che si apre dopo un aggiornamento, e una pagina in «Impostazioni app».
///
/// ## Perche' il file stesso, e non una copia
///
/// Il `CHANGELOG.md` entra nel pacchetto dell'app com'e' (`pubspec.yaml`,
/// fra gli `assets`). Una copia in un file Dart, scritta da uno strumento,
/// andrebbe rigenerata ogni volta che le note cambiano — e le note si
/// scrivono spesso **dopo** aver alzato il numero, a rilascio quasi fatto: la
/// copia resterebbe indietro proprio sulla versione che conta. Il file
/// invece e' quello, e quello che legge la release e' quello che legge l'app.
///
/// Niente Flutter qui dentro: si prova senza uno schermo.
library;

/// Un punto delle note: `- **Titolo**: frase`.
class UnaNovita {
  const UnaNovita({required this.titolo, required this.frase});

  /// Quello in grassetto, senza gli asterischi. Vuoto se il punto non ce l'ha:
  /// allora tutto il punto e' [frase].
  final String titolo;

  /// Il resto, su una riga sola: le righe a capo del markdown si rimettono
  /// insieme. Puo' avere i suoi segni (`codice`, **grassetto**), che disegna
  /// chi la mostra.
  final String frase;

  @override
  bool operator ==(Object other) =>
      other is UnaNovita && other.titolo == titolo && other.frase == frase;

  @override
  int get hashCode => Object.hash(titolo, frase);

  @override
  String toString() => titolo.isEmpty ? frase : '**$titolo**: $frase';
}

/// Le note di una versione: il suo `## 1.19.25`, e i punti sotto.
class LeNoteDiUnaVersione {
  const LeNoteDiUnaVersione({required this.versione, required this.punti});

  final String versione;
  final List<UnaNovita> punti;

  @override
  String toString() => '$versione: $punti';
}

/// Un titolo di versione: `## 1.19.25`, e niente altro sulla riga.
final _ilTitolo = RegExp(r'^##\s+v?(\d+(?:\.\d+){1,3})\s*$');

/// Un titolo di qualunque altro livello o forma: chiude la versione aperta.
final _unTitolo = RegExp(r'^#{1,6}\s');

/// Un punto: `- `, `* ` o `+ `, col suo rientro.
final _ilPunto = RegExp(r'^(\s*)[-*+]\s+(.*)$');

/// Il titolo in grassetto in testa al punto, con i due punti dopo (dentro o
/// fuori dal grassetto: `**Titolo**:` e `**Titolo:**` si scrivono tutti e due).
final _ilGrassetto = RegExp(r'^\*\*(.+?)\*\*\s*(?::|—|–|-)?\s*(.*)$');

/// Le note di tutte le versioni, dalla piu' nuova, come stanno nel file.
///
/// Si prende solo quello che sta sotto un `## numero`: la premessa del file
/// («Cosa cambia nell'app GdAHome», le quattro righe su app e add-on) non e'
/// una novita'. Dentro una versione:
///
///  - ogni punto e' una [UnaNovita], col titolo in grassetto se c'e';
///  - le righe che continuano un punto (rientrate, o attaccate sotto) si
///    rimettono sulla sua riga;
///  - un paragrafo che non e' un punto diventa un punto senza titolo: quello
///    che non si sa disegnare non si butta, si legge come testo (la stessa
///    regola di `vestito/markdown.dart`);
///  - una versione senza punti non c'e': una scheda vuota non si mostra.
///
/// Non solleva mai: un file storto da' meno note, non un'app che non parte.
List<LeNoteDiUnaVersione> leNoteDelChangelog(String markdown) {
  final fuori = <LeNoteDiUnaVersione>[];
  String? versione;
  final punti = <UnaNovita>[];
  final pezzo = <String>[];

  void chiudiIlPunto() {
    if (pezzo.isEmpty) return;
    final testo = pezzo.join(' ').replaceAll(RegExp(r'\s+'), ' ').trim();
    pezzo.clear();
    if (testo.isEmpty) return;
    final grassetto = _ilGrassetto.firstMatch(testo);
    if (grassetto != null && grassetto[2]!.trim().isNotEmpty) {
      var titolo = grassetto[1]!.trim();
      /* `**Titolo:**`: i due punti stavano dentro il grassetto. */
      if (titolo.endsWith(':')) {
        titolo = titolo.substring(0, titolo.length - 1).trim();
      }
      punti.add(UnaNovita(titolo: titolo, frase: grassetto[2]!.trim()));
    } else {
      punti.add(UnaNovita(titolo: '', frase: testo));
    }
  }

  void chiudiLaVersione() {
    chiudiIlPunto();
    if (versione != null && punti.isNotEmpty) {
      fuori.add(
        LeNoteDiUnaVersione(
          versione: versione!,
          punti: List.unmodifiable(punti),
        ),
      );
    }
    punti.clear();
    versione = null;
  }

  for (final riga in markdown.replaceAll('\r\n', '\n').split('\n')) {
    final titolo = _ilTitolo.firstMatch(riga);
    if (titolo != null) {
      chiudiLaVersione();
      versione = titolo[1];
      continue;
    }
    if (_unTitolo.hasMatch(riga)) {
      chiudiLaVersione();
      continue;
    }
    if (versione == null) continue;
    if (riga.trim().isEmpty) {
      chiudiIlPunto();
      continue;
    }
    final punto = _ilPunto.firstMatch(riga);
    if (punto != null) {
      chiudiIlPunto();
      pezzo.add(punto[2]!);
      continue;
    }
    /* Una riga che continua quella di sopra, o l'inizio di un paragrafo. */
    pezzo.add(riga.trim());
  }
  chiudiLaVersione();
  return fuori;
}

/// I numeri di una versione: `1.19.25` → `[1, 19, 25]`. Quello che non e' un
/// numero vale zero.
List<int> _iNumeri(String versione) => [
  for (final uno in versione.trim().replaceFirst(RegExp('^v'), '').split('.'))
    int.tryParse(uno) ?? 0,
];

/// Quale viene prima: negativo se [a] e' piu' vecchia di [b], zero se sono la
/// stessa, positivo se e' piu' nuova. Per numeri, non per lettere: la 1.19.9
/// viene prima della 1.19.10.
int confrontaLeVersioni(String a, String b) {
  final da = _iNumeri(a);
  final db = _iNumeri(b);
  for (var quale = 0; quale < da.length || quale < db.length; quale += 1) {
    final x = quale < da.length ? da[quale] : 0;
    final y = quale < db.length ? db[quale] : 0;
    if (x != y) return x < y ? -1 : 1;
  }
  return 0;
}

/// Quello che la scheda dell'apertura deve far vedere.
class LeNovitaDaMostrare {
  const LeNovitaDaMostrare({required this.note, required this.saltate});

  /// Le note della versione di adesso.
  final LeNoteDiUnaVersione note;

  /// Le versioni con le note che stanno fra quella vista l'ultima volta e
  /// questa: chi ne ha saltata qualcuna trova il link «Versioni precedenti».
  final int saltate;
}

/// Se, aprendo l'app, c'e' una scheda delle novita' da far vedere.
///
/// [vista] e' l'ultima versione di cui si sono viste le novita' (dalle
/// impostazioni); `null` vuol dire che l'app non l'ha mai scritta, cioe' che
/// veniamo da una versione di prima di questa scheda — l'installazione nuova
/// l'ha gia' scritta chi apre l'app, prima di arrivare qui.
///
/// Niente scheda quando la versione e' la stessa, quando si torna indietro
/// (un'app piu' vecchia di quella vista), e quando le note di questa versione
/// non ci sono: una scheda con le novita' di un'altra versione direbbe una
/// cosa falsa.
LeNovitaDaMostrare? cosaMostrareAllApertura({
  required String? vista,
  required String adesso,
  required List<LeNoteDiUnaVersione> note,
}) {
  if (adesso.trim().isEmpty) return null;
  if (vista != null && confrontaLeVersioni(vista, adesso) >= 0) return null;
  LeNoteDiUnaVersione? queste;
  var saltate = 0;
  for (final una in note) {
    final rispetto = confrontaLeVersioni(una.versione, adesso);
    if (rispetto == 0) {
      queste ??= una;
    } else if (rispetto < 0 &&
        vista != null &&
        confrontaLeVersioni(una.versione, vista) > 0) {
      saltate += 1;
    }
  }
  if (queste == null) return null;
  return LeNovitaDaMostrare(note: queste, saltate: saltate);
}

/// Le note da far vedere nella pagina «Novità»: quelle fino a questa
/// versione, dalla piu' nuova. Una versione scritta nel file ma non ancora
/// uscita non si annuncia.
List<LeNoteDiUnaVersione> leNoteFinoA(
  String adesso,
  List<LeNoteDiUnaVersione> note,
) => [
  for (final una in note)
    if (adesso.trim().isEmpty || confrontaLeVersioni(una.versione, adesso) <= 0)
      una,
];
