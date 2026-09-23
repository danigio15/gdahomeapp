/// Che la mappa della rete, nell'app, si veda per davvero.
///
/// Non «c'è il tag giusto»: che ESCANO I PIXEL. È una prova nata da un guaio
/// vero — la mappa arrivava con le icone dei dispositivi dentro ogni anello,
/// nel browser si vedevano, e sul telefono no: `flutter_svg` gli `<svg>`
/// annidati non li disegna, e restavano anelli vuoti. Nessuna prova se ne era
/// accorta perché tutte guardavano il testo dell'SVG, e il testo era giusto.
///
/// Qui invece l'SVG si disegna davvero e si contano i colori: se un domani
/// qualcuno rimette una forma che questo disegnatore non sa fare, gli anelli
/// tornano vuoti e questa prova diventa rossa.
library;

import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';

/// La mappa come la disegna il ponte: la scrive `ponte/src/mappa-zigbee.js`
/// sui dispositivi di `test/foto/uno_sei_zero_foto.dart`. Si rifà con quel
/// disegnatore, non a mano.
const _dove = 'test/foto/la-rete-di-casa.svg';

/// Quanti pixel di ogni colore, disegnando l'SVG grande [lato].
Future<Map<int, int>> _iColori(String svg, {int lato = 900}) async {
  final info = await vg.loadPicture(SvgStringLoader(svg), null);
  final immagine = info.picture.toImageSync(lato, lato);
  final byte = await immagine.toByteData(format: ui.ImageByteFormat.rawRgba);
  final conta = <int, int>{};
  for (var i = 0; i < byte!.lengthInBytes; i += 4) {
    final colore =
        (byte.getUint8(i) << 16) |
        (byte.getUint8(i + 1) << 8) |
        byte.getUint8(i + 2);
    conta[colore] = (conta[colore] ?? 0) + 1;
  }
  return conta;
}

void main() {
  late String mappa;

  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    mappa = File(_dove).readAsStringSync();
  });

  test('la mappa del ponte si disegna, e non è una tela vuota', () async {
    final colori = await _iColori(mappa);
    /* Il fondo chiaro c'è, e non è l'unica cosa che c'è. */
    expect(colori[0xf8fafc], isNotNull, reason: 'manca il fondo della mappa');
    expect(colori.length, greaterThan(20), reason: 'una tela quasi vuota');
  });

  test(
    'dentro gli anelli ci sono i disegni dei dispositivi, non il vuoto',
    () async {
      final colori = await _iColori(mappa);
      /* I disegni del catalogo hanno un fondo azzurrino e il loro colore: sono
     * tinte che negli anelli, nei fili e nelle scritte non compaiono. Se le
     * icone non vengono disegnate, questi pixel sono zero — ed è esattamente
     * quello che succedeva sul telefono. */
      final delCatalogo = colori[0xe0f2fe] ?? 0;
      expect(
        delCatalogo,
        greaterThan(500),
        reason: 'gli anelli sono vuoti: i disegni dei dispositivi non escono',
      );
    },
  );

  test('un «svg» dentro l\'altro non si vede: è il guaio da cui nasce questa prova', () async {
    const annidato =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">'
        '<rect width="100" height="100" fill="#ffffff"/>'
        '<svg x="10" y="10" width="80" height="80" viewBox="0 0 24 24">'
        '<circle cx="12" cy="12" r="10" fill="#e0f2fe"/></svg></svg>';
    const nelGruppo =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">'
        '<rect width="100" height="100" fill="#ffffff"/>'
        '<g transform="translate(10 10) scale(3.3333)">'
        '<circle cx="12" cy="12" r="10" fill="#e0f2fe"/></g></svg>';
    expect((await _iColori(annidato, lato: 100))[0xe0f2fe] ?? 0, 0);
    expect(
      (await _iColori(nelGruppo, lato: 100))[0xe0f2fe] ?? 0,
      greaterThan(500),
    );
  });
}
