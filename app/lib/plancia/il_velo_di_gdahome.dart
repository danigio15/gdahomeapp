/// Il velo d'avvio della plancia col marchio di gdahome, dentro l'app.
///
/// «Quando si carica la prima volta l'app esce il logo DashboardModern.» Il
/// velo d'avvio della plancia — il primo pezzo della pagina, col logo e una
/// parola sotto — nasce col marchio di serie. Il ponte lo cambia quando
/// serve lui la pagina (`ponte/src/marchio.js`); ma la pagina che arriva
/// direttamente da Home Assistant no, e al primo avvio era quella che si
/// vedeva. Qui l'app fa lo stesso cambio prima di mostrarla: il logo di
/// gdahome (la stessa immagine del ponte, `ponte/marchio/gdahome-velo.webp`)
/// e la parola scelta da chi ha montato l'impianto, o «gdahome».
///
/// Solo se il velo e' ancora quello di serie: una pagina gia' rivestita dal
/// ponte — magari col logo di chi ha installato — resta com'e'.
library;

/// Il logo del velo, in WebP.
const String logoDelVelo =
    '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';

final _immagine = RegExp(
  r'(<div id="cd-boot-overlay"><img src=")data:[^"]*(")',
);
const _parolaDiSerie = '<b>DashboardModern</b>';

/// La [pagina] col velo di gdahome, e la parola [velo] se c'e'.
String colVeloDiGdahome(String pagina, {String velo = ''}) {
  if (!pagina.contains(_parolaDiSerie)) return pagina;
  final parola = velo.replaceAll(RegExp('[<>&]'), '').trim();
  return pagina
      .replaceFirstMapped(
        _immagine,
        (m) => '${m[1]}data:image/webp;base64,$logoDelVelo${m[2]}',
      )
      .replaceFirst(
        _parolaDiSerie,
        '<b>${parola.isEmpty ? 'gdahome' : parola}</b>',
      );
}
