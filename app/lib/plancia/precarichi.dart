/// La lista della spesa della plancia: i file che la pagina vuole subito.
///
/// `dashboard.html` porta trecentocinquantaquattro righe
/// `<link rel="modulepreload" href="…">`. Per un browser sono un **consiglio**
/// — «prenditi avanti questo modulo, dopo qualcuno lo importera'» — e per il
/// servitore sono qualcosa di piu': leggendole sa **prima del browser** quali
/// file gli verranno chiesti.
///
/// Serve a una cosa sola, e da fuori casa e' quella che si vede. Dentro casa
/// la plancia si apre subito: i file stanno su una rete locale, e un giro non
/// si sente. Fuori casa ogni giro passa dal centralino, e a freddo — dopo ogni
/// aggiornamento, perche' l'impronta nel percorso cambia e il deposito
/// ricomincia da zero — la pagina ne fa trecentosettantanove. Misurato con un
/// browser vero e ottanta millesimi di giro: sei secondi, di cui cinque di
/// andate e ritorni. Non sono i byte: sono i giri.
///
/// Conoscendo l'elenco prima, i file si chiedono al ponte **in pacchi** — fino
/// a quaranta per commissione, `ponte/http-molti` — mentre il browser sta
/// ancora leggendo l'intestazione della pagina. Trecentosettantanove giri
/// diventano nove.
///
/// Qui dentro non c'e' niente che vada in rete: si legge una pagina e si torna
/// un elenco. E' scritto a parte perche' e' la stessa cosa sul telefono e nel
/// browser, e perche' cosi' si prova senza accendere nulla.
library;

/// Le righe da leggere, e l'indirizzo dentro la riga.
final _unPrecarico = RegExp(
  r'<link\b[^>]*\brel="modulepreload"[^>]*>',
  caseSensitive: false,
);
final _ilSuoIndirizzo = RegExp(r'\bhref="([^"]+)"', caseSensitive: false);

/// La cartella della plancia: di qui non si esce.
const _laPlancia = '/dashboardmodern_static/';

/// Quanti file ci stanno in un pacco. E' il limite del ponte
/// (`IN_UN_PACCO` in `ponte/src/commissioni.js`): chiederne quarantuno e'
/// ricevere un no per tutti e quarantuno.
const inUnPacco = 40;

/// Quanti pacchi si tengono sul filo insieme.
///
/// Tutti in una volta sarebbero nove commissioni e un giro solo, e sarebbe il
/// piu' veloce sulla carta; sarebbero anche cinque megabyte di risposte in
/// volo, che su un telefono sono memoria vera. Quattro bastano a tenere il
/// filo pieno, e i primi file arrivano prima — che e' quello che serve, perche'
/// la pagina li apre in ordine.
const pacchiInsieme = 4;

/// I file che la pagina dice di volere subito, come percorsi interi.
///
/// [cartella] e' la cartella della pagina — `/dashboardmodern_static/<impronta>/legacy`
/// — e gli indirizzi della pagina sono relativi a quella: `../src/core/x.js`
/// diventa `/dashboardmodern_static/<impronta>/src/core/x.js`.
///
/// Quello che non si capisce si lascia fuori, e non e' un guasto: un file in
/// meno nel pacco e' un file che si chiede come si e' sempre chiesto. Restano
/// fuori gli indirizzi con un altro schema (`https://…`), quelli che escono
/// dalla cartella della plancia, e i doppioni. L'**ordine** e' quello della
/// pagina, e conta: i primi moduli sono i primi che la plancia apre.
List<String> iPrecarichiDellaPagina(String pagina, {required String cartella}) {
  final dentro = cartella.endsWith('/') ? cartella : '$cartella/';
  if (!dentro.startsWith(_laPlancia)) return const <String>[];
  final base = Uri(path: dentro);
  final fuori = <String>[];
  final visti = <String>{};
  for (final riga in _unPrecarico.allMatches(pagina)) {
    final indirizzo = _ilSuoIndirizzo.firstMatch(riga[0]!)?[1];
    if (indirizzo == null || indirizzo.isEmpty) continue;
    final Uri quale;
    try {
      quale = Uri.parse(indirizzo);
    } on FormatException {
      continue;
    }
    /* Un indirizzo con uno schema o un altro nome di macchina non e' un file
     * della plancia, e non lo si va a prendere. */
    if (quale.hasScheme || quale.hasAuthority) continue;
    final percorso = base.resolveUri(quale).path;
    if (!percorso.startsWith(_laPlancia)) continue;
    if (!visti.add(percorso)) continue;
    fuori.add(percorso);
  }
  return fuori;
}

/// L'elenco diviso in pacchi da [inUnPacco], nell'ordine in cui stava.
List<List<String>> aPacchi(List<String> quali, {int quanti = inUnPacco}) {
  if (quanti < 1) {
    return quali.isEmpty ? const <List<String>>[] : [List.of(quali)];
  }
  final fuori = <List<String>>[];
  for (var da = 0; da < quali.length; da += quanti) {
    fuori.add(
      quali.sublist(
        da,
        da + quanti > quali.length ? quali.length : da + quanti,
      ),
    );
  }
  return fuori;
}

/// La cartella di un percorso: `/a/b/c.html` → `/a/b`.
String laCartellaDi(String percorso) {
  final taglio = percorso.lastIndexOf('/');
  return taglio <= 0 ? '/' : percorso.substring(0, taglio);
}
