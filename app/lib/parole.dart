/// Le parole dell'app, nelle lingue che parla.
///
/// ## Come si scrive una frase
///
/// Ogni frase che si legge a schermo si scrive in tutte le lingue, sul posto:
///
/// ```dart
/// Text(inLingua(it: 'Colleghiamo la casa', en: 'Let\'s connect your home'))
/// ```
///
/// **Sul posto, e non in un elenco di nomi.** Un elenco vorrebbe dire
/// inventare cinquecento nomi — `colleghiamoLaCasa`, `mancaIlCodice` — e
/// leggere il programma diventerebbe inseguire quei nomi in un altro file. Qui
/// la frase resta dove si usa, in tutte le lingue, e il programma si legge
/// come si leggeva prima.
///
/// **E il compilatore non lascia dimenticare niente:** tutte e due le lingue
/// sono obbligatorie. Una frase senza la sua traduzione non compila — che e'
/// l'opposto di come vanno di solito queste cose, dove la traduzione che manca
/// esce nella lingua sbagliata e nessuno se ne accorge per mesi.
///
/// Per rileggerle tutte insieme — che e' l'unico modo di accorgersi di un
/// inglese storto — c'e' `node strumenti/le-parole.mjs`: le stampa in due
/// colonne, e dice quante sono.
///
/// ## Una lingua nuova
///
/// Si aggiunge a [Lingua], si aggiunge il suo parametro a [inLingua] — e le
/// frasi che ancora non ce l'hanno escono in inglese, che e' meglio di una
/// casella vuota. `strumenti/le-parole.mjs` dice quante ne mancano.
///
/// ## Le parole del mestiere, sempre le stesse
///
/// Un glossario non e' un vezzo: la stessa cosa chiamata in due modi in due
/// schermate diverse fa credere che siano due cose.
///
/// | italiano | inglese |
/// |---|---|
/// | la plancia | the dashboard |
/// | l'add-on (il ponte) | the add-on |
/// | il centralino | the relay |
/// | il filo | the connection |
/// | abbinare | to pair |
/// | il QR code | the QR code |
/// | una segnalazione | a report |
/// | l'assistenza | support |
/// | in casa / da fuori | at home / away |
/// | le lettere del codice | the code letters |
library;

/// Le lingue che l'app parla.
///
/// L'inglese non e' li' per riempire: la plancia di DashboardModern ce l'ha
/// gia', in un file suo (`dashboard-en.html`), e un'app italiana che serve una
/// plancia inglese — o il contrario — sarebbe peggio di un'app in una lingua
/// sola. Le due cose vanno insieme, e il codice qui sotto e' lo stesso che
/// sceglie la pagina della plancia (vedi `plancia/pannello.dart`).
enum Lingua {
  italiano('it'),
  inglese('en');

  const Lingua(this.codice);

  /// Come la chiama il telefono, e come la chiama la plancia.
  final String codice;
}

/// La lingua di adesso.
///
/// Si decide una volta all'avvio, dalla lingua del telefono, e cambia solo se
/// la cambia chi ha il telefono in mano (`main.dart`, `didChangeLocales`).
///
/// E' un valore globale, e non una cosa che si legge dall'albero dei widget,
/// per un motivo: le frasi non stanno tutte dentro una schermata. «il filo si
/// e' chiuso» la scrive il filo, che di schermi non sa niente e un
/// `BuildContext` non ce l'ha; la pagina che dice «questa plancia non e' tua»
/// la compone un server dentro l'app. Una cosa sola, raggiungibile da
/// dappertutto, e chi disegna si ridisegna quando cambia.
Lingua laLingua = Lingua.italiano;

/// La frase giusta per la lingua di adesso.
String inLingua({required String it, required String en}) => switch (laLingua) {
  Lingua.italiano => it,
  Lingua.inglese => en,
};

/// Quale delle nostre lingue, per un telefono che chiede queste.
///
/// Si guardano **tutte** quelle che il telefono chiede, in ordine: chi ha
/// messo spagnolo e poi italiano ha detto che l'italiano gli va bene, e
/// mandarlo in inglese sarebbe scegliere la sua terza scelta. Chi non chiede
/// nessuna lingua che parliamo va in inglese, che e' la lingua con cui si
/// arriva piu' lontano — ed e' la stessa regola della plancia.
///
/// Prende i **codici** — «it», «en» — e non i `Locale` di Flutter, perche'
/// questo file lo legge anche chi Flutter non ce l'ha: il servitore del
/// collaudo e' un programma Dart e basta, e `dart:ui` li' non esiste. Chi
/// chiama fa la traduzione, ed e' una riga (`main.dart`).
Lingua linguaPer(List<String> quelleDelTelefono) {
  for (final quale in quelleDelTelefono) {
    for (final nostra in Lingua.values) {
      if (quale == nostra.codice) return nostra;
    }
  }
  return Lingua.inglese;
}

/// «1 volta», «2 volte» — «1 time», «2 times».
///
/// «1 volte» e' la cosa che tradisce un'app: il numero lo mette un contatore, la
/// parola non la mette nessuno. Qui stanno insieme, una volta per tutte.
String volte(int quante) => quante == 1
    ? inLingua(it: '$quante volta', en: '$quante time')
    : inLingua(it: '$quante volte', en: '$quante times');
