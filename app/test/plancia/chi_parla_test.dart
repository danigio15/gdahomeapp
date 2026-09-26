/// Chi puo' parlare col servitore del browser: le regole, e il WebSocket
/// finto che le rispetta dall'altra parte.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/chi_parla.dart';

const _mia = 'https://gdahome.example';

void main() {
  test('il WebSocket si ascolta solo dal riquadro, e sulla nostra origine', () {
    for (final che in ['gdahome/ws-apri', 'gdahome/ws-su']) {
      expect(
        siAscolta(che: che, chi: DaChi.riquadro, origine: _mia, mia: _mia),
        isTrue,
        reason: che,
      );
      /* Una finestra qualunque — chi ha aperto l'app, una scheda aperta da
       * lei — con la nostra origine o no: non parla con la casa. */
      expect(
        siAscolta(che: che, chi: DaChi.altro, origine: _mia, mia: _mia),
        isFalse,
        reason: che,
      );
      expect(
        siAscolta(
          che: che,
          chi: DaChi.riquadro,
          origine: 'https://altrove.example',
          mia: _mia,
        ),
        isFalse,
        reason: che,
      );
      /* E il service worker il WebSocket non lo apre. */
      expect(
        siAscolta(che: che, chi: DaChi.lavoratore, origine: _mia, mia: _mia),
        isFalse,
        reason: che,
      );
    }
  });

  test('le domande dei file si ascoltano solo dal service worker', () {
    expect(
      siAscolta(
        che: 'gdahome/chiedi',
        chi: DaChi.lavoratore,
        origine: _mia,
        mia: _mia,
      ),
      isTrue,
    );
    expect(
      siAscolta(
        che: 'gdahome/chiedi',
        chi: DaChi.riquadro,
        origine: _mia,
        mia: _mia,
      ),
      isFalse,
    );
    expect(
      siAscolta(
        che: 'gdahome/chiedi',
        chi: DaChi.altro,
        origine: _mia,
        mia: _mia,
      ),
      isFalse,
    );
  });

  test('un\'origine opaca non vale, e nemmeno un messaggio sconosciuto', () {
    expect(
      siAscolta(
        che: 'gdahome/ws-su',
        chi: DaChi.riquadro,
        origine: 'null',
        mia: 'null',
      ),
      isFalse,
    );
    expect(
      siAscolta(
        che: 'qualcos-altro',
        chi: DaChi.riquadro,
        origine: _mia,
        mia: _mia,
      ),
      isFalse,
    );
  });

  test(
    'il WebSocket finto parla solo con chi lo ospita, e sulla sua origine',
    () {
      /* Prima mandava a `"*"` e ascoltava chiunque: una pagina che ospitasse
     * il riquadro, o che gli scrivesse da fuori, poteva recitare la casa. */
      expect(ilWebSocketDelRiquadro, isNot(contains('"*"')));
      expect(ilWebSocketDelRiquadro, contains('var mia=location.origin;'));
      expect(
        ilWebSocketDelRiquadro,
        contains('parent.postMessage({che:"gdahome/ws-apri"},mia)'),
      );
      expect(
        ilWebSocketDelRiquadro,
        contains('if(evento.source!==parent||evento.origin!==mia)return;'),
      );
    },
  );
}
