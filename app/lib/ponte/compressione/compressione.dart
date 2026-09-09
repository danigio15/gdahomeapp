/// La compressione dentro la busta: gzip **prima** di cifrare.
///
/// Quello che passa sul filo e' quasi tutto JSON di Home Assistant: un
/// `get_states` da un megabyte e mezzo, trecento risposte di storico da
/// decine di chilobyte l'una. E' testo che si ripete — gli stessi nomi di
/// campo, gli stessi identificativi, le stesse date — e compresso pesa
/// cinque, otto volte meno. Comprimere *dopo* aver cifrato non servirebbe a
/// niente: i byte cifrati non si distinguono dal caso, e il caso non si
/// comprime. Quindi si comprime prima, dentro la busta, e chi sta in mezzo
/// vede solo buste piu' piccole.
///
/// Non e' una versione nuova del protocollo: ognuna delle due punte dice
/// nella stretta di mano se **sa aprire** una busta compressa (`gzip: true`),
/// e chi manda comprime solo se l'altro l'ha detto. Dall'altra parte c'e'
/// `ponte/src/cifra.js`, e la regola e' la stessa.
///
/// Sul telefono il gzip lo fa `dart:io`, cioe' la zlib del sistema: un
/// megabyte si scompatta in qualche millesimo. Nel browser `dart:io` non c'e',
/// e l'app non dice di saperlo aprire: riceve tutto com'era, come prima. E'
/// l'import condizionale a scegliere, quando si costruisce.
library;

export 'qui.dart' if (dart.library.io) 'con_io.dart';
