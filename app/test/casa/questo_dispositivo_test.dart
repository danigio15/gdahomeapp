/// Come si chiama questo dispositivo, e cos'e'.
///
/// Serve per una cosa sola, e si e' vista in casa: nell'elenco «Telefoni
/// abbinati» c'erano quattro righe della stessa persona — l'app e il browser
/// tre volte — e dicevano tutte `localhost` o `Telefono`, sistema
/// `sconosciuto`. Per capire quale togliere si andava a tentativi.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/questo_dispositivo.dart';

void main() {
  group('il nome di un telefono', () {
    test('se il telefono ne dice uno vero, si tiene quello', () {
      expect(
        nomeDelTelefono(detto: 'iPhone di Giovanni', sistema: 'ios'),
        'iPhone di Giovanni',
      );
      expect(
        nomeDelTelefono(detto: 'Pixel-di-casa', sistema: 'android'),
        'Pixel-di-casa',
      );
    });

    test('«localhost» non è un nome: Android risponde così a tutti', () {
      /* Non e' un difetto nostro, e' quello che Android risponde a chi gli
       * chiede come si chiama. Ed e' peggio di nessun nome, perche' sembra
       * un nome. */
      expect(
        nomeDelTelefono(detto: 'localhost', sistema: 'android'),
        'Telefono Android',
      );
      expect(nomeDelTelefono(detto: 'localhost', sistema: 'ios'), 'iPhone');
      expect(
        nomeDelTelefono(detto: 'LOCALHOST', sistema: 'android'),
        'Telefono Android',
        reason: 'e non conta come lo scrive',
      );
    });

    test('e nemmeno il vuoto, o il nome del sistema', () {
      expect(
        nomeDelTelefono(detto: '', sistema: 'android'),
        'Telefono Android',
      );
      expect(nomeDelTelefono(detto: '   ', sistema: 'ios'), 'iPhone');
      expect(
        nomeDelTelefono(detto: 'android', sistema: 'android'),
        'Telefono Android',
      );
      expect(nomeDelTelefono(detto: 'unknown', sistema: ''), 'Telefono');
    });
  });

  group('il nome di un browser', () {
    test('Safari su un Mac', () {
      expect(
        nomeDalBrowser(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 '
          '(KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        ),
        'Safari su Mac',
      );
    });

    test('Safari su un iPhone', () {
      expect(
        nomeDalBrowser(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
          'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 '
          'Safari/604.1',
        ),
        'Safari su iPhone',
      );
    });

    test('Chrome su Android', () {
      expect(
        nomeDalBrowser(
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 '
          '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        ),
        'Chrome su Android',
        reason: 'Android prima di Linux: nel biglietto ci sono tutti e due',
      );
    });

    test('Chrome non diventa Safari, ed Edge non diventa Chrome', () {
      /* L'ordine e' tutto: Chrome nel suo biglietto scrive anche «Safari», ed
       * Edge scrive anche «Chrome». Chi guarda la prima parola che trova
       * sbaglia tutti e due. */
      expect(
        nomeDalBrowser(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ),
        'Chrome su Windows',
      );
      expect(
        nomeDalBrowser(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        ),
        'Edge su Windows',
      );
    });

    test('Firefox, e Firefox su iPhone che si chiama in un altro modo', () {
      expect(
        nomeDalBrowser(
          'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
        ),
        'Firefox su Linux',
      );
      expect(
        nomeDalBrowser(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
          'AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/121.0 Mobile/15E148 Safari/605.1.15',
        ),
        'Firefox su iPhone',
      );
    });

    test('quando non si capisce, si dice «Browser» e non si inventa', () {
      expect(nomeDalBrowser(''), 'Browser');
      expect(nomeDalBrowser('   '), 'Browser');
      expect(nomeDalBrowser('qualcosa che non somiglia a niente'), 'Browser');
    });
  });

  group('il modello', () {
    test('un Samsung dal codice di fabbrica al nome in vendita', () {
      final s24 = modelloDaAndroid(
        produttore: 'samsung',
        modello: 'SM-S928B',
        versione: '15',
      );
      expect(s24.marca, 'Samsung');
      expect(s24.modello, 'Galaxy S24 Ultra');
      expect(s24.versione, '15');
      /* La lettera del paese non conta. */
      expect(
        modelloDaAndroid(produttore: 'samsung', modello: 'SM-X710N').modello,
        'Galaxy Tab S9',
      );
      /* Uno che non si conosce resta col suo codice. */
      expect(
        modelloDaAndroid(produttore: 'samsung', modello: 'SM-Z999X').modello,
        'SM-Z999X',
      );
    });

    test('chi scrive gia\' il nome lo tiene, senza ripetere la marca', () {
      expect(
        modelloDaAndroid(produttore: 'Google', modello: 'Pixel 9 Pro').modello,
        'Pixel 9 Pro',
      );
      final xiaomi = modelloDaAndroid(
        produttore: 'Xiaomi',
        modello: 'Xiaomi 14',
      );
      expect(xiaomi.marca, 'Xiaomi');
      expect(xiaomi.modello, '14');
      expect(marcaLeggibile('oneplus'), 'OnePlus');
      expect(marcaLeggibile('fairphone'), 'Fairphone');
    });

    test('un iPhone dal suo codice, e uno nuovo dice almeno che cos\'e\'', () {
      expect(nomeDellIPhone('iPhone16,1'), 'iPhone 15 Pro');
      expect(nomeDellIPhone('iPhone17,5'), 'iPhone 16e');
      expect(nomeDellIPhone('iPad16,6'), 'iPad Pro 13"');
      expect(nomeDellIPhone('iPhone99,9'), 'iPhone');
      expect(nomeDellIPhone('iPad99,9'), 'iPad');
      final ios = modelloDaIos(codice: 'iPhone17,1', versione: '18.1');
      expect(ios.marca, 'Apple');
      expect(ios.modello, 'iPhone 16 Pro');
      expect(ios.perLaCasa(), {
        'marca': 'Apple',
        'modello': 'iPhone 16 Pro',
        'versione': '18.1',
      });
    });

    test('il nome all\'abbinamento: il modello, o quello di prima', () {
      const pixel = IlModello(marca: 'Google', modello: 'Pixel 9');
      expect(nomeConIlModello(pixel, 'Telefono Android'), 'Pixel 9');
      expect(nomeConIlModello(null, 'Telefono Android'), 'Telefono Android');
      expect(const IlModello(marca: '', modello: '').perLaCasa(), isEmpty);
    });
  });

  group('di chi è il telefono', () {
    test('una riga sola, senza caratteri strani, al più 30 caratteri', () {
      expect(proprietarioPulito('  Persona   1 \n'), 'Persona 1');
      expect(proprietarioPulito('Pers\u0000ona'), 'Persona');
      expect(proprietarioPulito('x' * 80).length, 30);
      expect(proprietarioPulito('   '), '');
    });
  });
}
