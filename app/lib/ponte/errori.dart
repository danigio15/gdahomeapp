/// Quello che puo' andare storto fra l'app e il ponte.
///
/// Sono tipi distinti e non un errore solo con dentro un testo, perche' le
/// schermate ci devono fare cose diverse: un codice sbagliato si ribatte, un
/// ponte irraggiungibile si riprova, un segno non piu' valido vuol dire
/// riabbinare da capo e non ha senso riprovare nemmeno una volta.
library;

sealed class ErroreDelPonte implements Exception {
  const ErroreDelPonte(this.spiegazione);
  final String spiegazione;

  @override
  String toString() => spiegazione;
}

/// Il ponte non risponde: rete, indirizzo sbagliato, add-on spento.
class PonteIrraggiungibile extends ErroreDelPonte {
  const PonteIrraggiungibile(super.spiegazione);
}

/// Il codice di abbinamento non e' quello, o e' scaduto.
class CodiceRifiutato extends ErroreDelPonte {
  const CodiceRifiutato(super.spiegazione);
}

/// Troppi tentativi di abbinamento: bisogna aspettare.
class TroppiTentativi extends ErroreDelPonte {
  const TroppiTentativi(super.spiegazione);
}

/// La casa ha gia' il numero massimo di telefoni abbinati.
class TroppiDispositivi extends ErroreDelPonte {
  const TroppiDispositivi(super.spiegazione);
}

/// Il segno non vale piu': staccato dalla console, o mai stato valido.
/// L'unica cosa da fare e' riabbinare.
class SegnoRifiutato extends ErroreDelPonte {
  const SegnoRifiutato(super.spiegazione);
}

/// La casa non ha stretto la mano.
///
/// E' una cosa diversa da un segno rifiutato: li' non si e' arrivati nemmeno a
/// dire chi si e'. Quasi sempre vuol dire che le due punte parlano due lingue
/// diverse — un ponte vecchio, o un'app vecchia — e la cura e' aggiornare una
/// delle due, non riabbinare.
class StrettaRifiutata extends ErroreDelPonte {
  const StrettaRifiutata(super.spiegazione);
}

/// Home Assistant ha risposto «no» a un comando.
class ComandoRifiutato extends ErroreDelPonte {
  const ComandoRifiutato(super.spiegazione, {this.codice});
  final String? codice;
}

/// Il filo si e' chiuso mentre si aspettava una risposta.
class FiloCaduto extends ErroreDelPonte {
  const FiloCaduto(super.spiegazione);
}
