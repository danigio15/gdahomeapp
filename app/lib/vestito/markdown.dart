/// Il markdown che serve a noi, e nient'altro.
///
/// Le note di una versione arrivano da Home Assistant in markdown, e quelle
/// che si leggono piu' spesso sono il `CHANGELOG.md` di gdahome. Guardandolo,
/// usa cinque cose: i titoli (`##`), gli elenchi (`-`), il **grassetto**, il
/// `codice`, e i link. Un pacchetto per il markdown intero sarebbe qualche
/// migliaio di righe per quelle cinque, e una dipendenza in piu' da tenere
/// aggiornata in un'app che quasi non ne ha.
///
/// La regola di questo lettore e' una sola, e vale per tutto: **quello che non
/// sa disegnare non lo butta, lo legge come testo**. Una tabella markdown in
/// un changelog viene fuori con le sue barre verticali e si capisce; un pezzo
/// mangiato no, e chi legge non sa nemmeno che gli manca qualcosa.
library;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

/// Un pezzo di testo, letto dal markdown.
sealed class UnPezzo {
  const UnPezzo();
}

/// `# titolo`, `## titolo`, `### titolo`. Il livello e' quanti cancelletti.
class UnTitolo extends UnPezzo {
  const UnTitolo(this.livello, this.testo);
  final int livello;
  final String testo;
}

/// Una riga di testo normale. Le righe attaccate fanno un paragrafo solo: e'
/// il markdown, dove si va a capo lasciando una riga vuota.
class UnParagrafo extends UnPezzo {
  const UnParagrafo(this.testo);
  final String testo;
}

/// `- una cosa`, o `* una cosa`. Il rientro dice se sta dentro un altro.
class UnPunto extends UnPezzo {
  const UnPunto(this.testo, {this.rientro = 0});
  final String testo;
  final int rientro;
}

/// `---`: una riga che separa.
class UnaRiga extends UnPezzo {
  const UnaRiga();
}

/// Quello che sta fra ``` e ```: si mostra com'e', a spaziatura fissa.
class UnBlocco extends UnPezzo {
  const UnBlocco(this.testo);
  final String testo;
}

final _ilTitolo = RegExp(r'^(#{1,6})\s+(.*)$');
final _ilPunto = RegExp(r'^(\s*)[-*+]\s+(.*)$');
final _laRiga = RegExp(r'^\s*([-*_])\s*\1\s*\1[\s\1]*$');
final _ilRecinto = RegExp(r'^\s*```');

/// Il markdown, letto pezzo per pezzo.
///
/// Non solleva mai e non butta mai niente: al peggio un pezzo esce come
/// paragrafo, che e' come lo si leggerebbe in un blocco di note.
List<UnPezzo> iPezziDi(String markdown) {
  final fuori = <UnPezzo>[];
  final righe = markdown.replaceAll('\r\n', '\n').split('\n');
  final paragrafo = <String>[];

  void chiudiIlParagrafo() {
    if (paragrafo.isEmpty) return;
    fuori.add(UnParagrafo(paragrafo.join(' ').trim()));
    paragrafo.clear();
  }

  var dentroUnBlocco = false;
  final blocco = <String>[];

  for (final riga in righe) {
    if (_ilRecinto.hasMatch(riga)) {
      if (dentroUnBlocco) {
        fuori.add(UnBlocco(blocco.join('\n')));
        blocco.clear();
        dentroUnBlocco = false;
      } else {
        chiudiIlParagrafo();
        dentroUnBlocco = true;
      }
      continue;
    }
    if (dentroUnBlocco) {
      blocco.add(riga);
      continue;
    }
    if (riga.trim().isEmpty) {
      chiudiIlParagrafo();
      continue;
    }
    if (_laRiga.hasMatch(riga)) {
      chiudiIlParagrafo();
      fuori.add(const UnaRiga());
      continue;
    }
    final titolo = _ilTitolo.firstMatch(riga);
    if (titolo != null) {
      chiudiIlParagrafo();
      fuori.add(UnTitolo(titolo[1]!.length, titolo[2]!.trim()));
      continue;
    }
    final punto = _ilPunto.firstMatch(riga);
    if (punto != null) {
      chiudiIlParagrafo();
      /* Due spazi per rientro, come si scrive: tre o quattro contano uno. */
      fuori.add(UnPunto(punto[2]!.trim(), rientro: punto[1]!.length ~/ 2));
      continue;
    }
    paragrafo.add(riga.trim());
  }
  /* Un blocco lasciato aperto — un recinto senza l'altro — non si perde. */
  if (dentroUnBlocco && blocco.isNotEmpty) {
    fuori.add(UnBlocco(blocco.join('\n')));
  }
  chiudiIlParagrafo();
  return fuori;
}

/// I segni dentro una riga: `**grassetto**`, `` `codice` ``, `[testo](dove)`,
/// e il corsivo con un asterisco o un trattino basso.
///
/// Un segno aperto e mai chiuso resta il carattere che e': `**` da solo si
/// legge `**`, e non mangia tutto il resto della riga.
final _iSegni = RegExp(
  r'\*\*(.+?)\*\*'
  r'|`([^`]+)`'
  r'|\[([^\]]+)\]\(([^)\s]+)\)'
  r'|(?<![A-Za-z0-9])[*_](?![\s*_])(.+?)(?<![\s])[*_](?![A-Za-z0-9])',
);

/// I pezzi di una riga, pronti da disegnare.
///
/// [quandoApre] riceve l'indirizzo di un link toccato. Senza, i link si
/// vedono e non si premono: e' quello che serve dove non c'e' niente da
/// aprire.
List<InlineSpan> iSegniDi(
  String riga, {
  required TextStyle base,
  required Color accento,
  required Color fondoDelCodice,
  void Function(String dove)? quandoApre,
}) {
  final fuori = <InlineSpan>[];
  var da = 0;
  for (final trovato in _iSegni.allMatches(riga)) {
    if (trovato.start > da) {
      fuori.add(TextSpan(text: riga.substring(da, trovato.start), style: base));
    }
    if (trovato[1] != null) {
      fuori.add(
        TextSpan(
          text: trovato[1],
          style: base.copyWith(fontWeight: FontWeight.w700),
        ),
      );
    } else if (trovato[2] != null) {
      fuori.add(
        TextSpan(
          text: trovato[2],
          style: base.copyWith(
            fontFamily: 'monospace',
            fontFamilyFallback: aSpaziaturaFissa,
            fontSize: (base.fontSize ?? 14) * 0.92,
            backgroundColor: fondoDelCodice,
          ),
        ),
      );
    } else if (trovato[3] != null) {
      final dove = trovato[4]!;
      fuori.add(
        TextSpan(
          text: trovato[3],
          style: base.copyWith(
            color: accento,
            decoration: quandoApre == null ? null : TextDecoration.underline,
            decorationColor: accento,
          ),
          recognizer: quandoApre == null
              ? null
              : (TapGestureRecognizer()..onTap = () => quandoApre(dove)),
        ),
      );
    } else if (trovato[5] != null) {
      fuori.add(
        TextSpan(
          text: trovato[5],
          style: base.copyWith(fontStyle: FontStyle.italic),
        ),
      );
    }
    da = trovato.end;
  }
  if (da < riga.length) {
    fuori.add(TextSpan(text: riga.substring(da), style: base));
  }
  return fuori;
}

/// I nomi di riserva per la spaziatura fissa.
///
/// «monospace» lo capisce Android, e lo capisce il browser. **iOS no**: li'
/// non e' il nome di nessuna famiglia, e senza una riserva il codice esce col
/// carattere normale — che non e' un guasto, ma un `1.4.32.8` in mezzo a una
/// frase si vede meglio se le cifre stanno tutte larghe uguale. «Menlo» c'e'
/// su iPhone e su Mac, «Courier New» dappertutto.
const aSpaziaturaFissa = ['Menlo', 'Courier New', 'Roboto Mono', 'Courier'];

/// Dal titolo della versione in giu'.
///
/// Home Assistant, quando gli si chiedono le note di un aggiornamento,
/// risponde col changelog **intero**: il nostro comincia con «Cosa cambia,
/// giro per giro» e con quattro righe che spiegano come si leggono i numeri.
/// Chi apre il foglio dopo aver premuto su «1.4.32.7 → 1.4.32.8» non vuole
/// leggere quello: vuole leggere la 1.4.32.8.
///
/// Percio' si cerca il titolo di **quella** versione e si comincia da subito
/// dopo — il titolo non serve, il numero sta gia' scritto in testa al foglio —
/// e quello che c'era prima si lascia fuori. Le versioni di prima restano
/// sotto, in ordine, che e' dove si va a cercarle.
///
/// Se quel titolo non c'e' non si taglia niente: un changelog scritto in un
/// altro modo si legge tutto, dal principio.
String daQuellaVersione(String markdown, String versione) {
  final quale = versione.trim();
  if (quale.isEmpty) return markdown;
  final ilTitoloGiusto = RegExp(
    '^#{1,6}\\s.*(?<![0-9.])${RegExp.escape(quale)}(?![0-9.])',
  );
  final righe = markdown.replaceAll('\r\n', '\n').split('\n');
  for (var quante = 0; quante < righe.length; quante += 1) {
    if (ilTitoloGiusto.hasMatch(righe[quante])) {
      return righe.skip(quante + 1).join('\n').trim();
    }
  }
  return markdown;
}
