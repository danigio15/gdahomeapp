/// Il lettore del markdown, provato riga per riga.
///
/// Un lettore scritto in casa ha un rischio solo, e non e' che disegni male:
/// e' che **mangi** qualcosa. Un titolo che non riconosce diventa un paragrafo
/// e si legge comunque; un `**` che non chiude, se il conto e' sbagliato, si
/// porta via mezza riga e chi legge non sa nemmeno cosa gli manca. Percio' le
/// prove guardano due cose: che i cinque segni di un changelog vengano fuori
/// per quello che sono, e che tutto il resto **resti**.
library;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/vestito/markdown.dart';

/// Il testo di tutti i pezzi, in fila: serve a dire che non si e' perso niente.
String _tuttoIlTesto(List<UnPezzo> pezzi) => pezzi
    .map(
      (uno) => switch (uno) {
        UnTitolo(:final testo) => testo,
        UnParagrafo(:final testo) => testo,
        UnPunto(:final testo) => testo,
        UnBlocco(:final testo) => testo,
        UnaRiga() => '',
      },
    )
    .join('\n');

/// Il testo dei segni di una riga, in fila.
String _tuttiISegni(List<InlineSpan> segni) =>
    segni.map((uno) => (uno as TextSpan).text ?? '').join();

const _base = TextStyle(fontSize: 14);

List<InlineSpan> _segni(
  String riga, {
  void Function(String dove)? quandoApre,
}) => iSegniDi(
  riga,
  base: _base,
  accento: const Color(0xFF0000FF),
  fondoDelCodice: const Color(0xFFEEEEEE),
  quandoApre: quandoApre,
);

void main() {
  group('i pezzi', () {
    test('un titolo e\' un titolo, col suo livello', () {
      final pezzi = iPezziDi('# uno\n\n## due\n\n### tre\n\n###### sei');
      expect(pezzi.map((uno) => (uno as UnTitolo).livello), [1, 2, 3, 6]);
      expect(pezzi.map((uno) => (uno as UnTitolo).testo), [
        'uno',
        'due',
        'tre',
        'sei',
      ]);
    });

    test('sette cancelletti non sono un titolo: sono testo', () {
      final pezzi = iPezziDi('####### sette');
      expect(pezzi.single, isA<UnParagrafo>());
      expect((pezzi.single as UnParagrafo).testo, '####### sette');
    });

    test('un cancelletto senza spazio non e\' un titolo', () {
      /* «#1» in un changelog e' il numero di una segnalazione, non un titolo. */
      final pezzi = iPezziDi('#139 la sezione segnalazioni');
      expect(pezzi.single, isA<UnParagrafo>());
    });

    test('le righe attaccate fanno un paragrafo solo', () {
      final pezzi = iPezziDi('la prima riga\ne la seconda\ne la terza');
      expect(pezzi.single, isA<UnParagrafo>());
      expect(
        (pezzi.single as UnParagrafo).testo,
        'la prima riga e la seconda e la terza',
      );
    });

    test('una riga vuota chiude il paragrafo e ne apre un altro', () {
      final pezzi = iPezziDi('uno\n\ndue');
      expect(pezzi.length, 2);
      expect((pezzi[0] as UnParagrafo).testo, 'uno');
      expect((pezzi[1] as UnParagrafo).testo, 'due');
    });

    test('un elenco: ogni punto per se\', col trattino tolto', () {
      final pezzi = iPezziDi('- uno\n- due\n* tre\n+ quattro');
      expect(pezzi.length, 4);
      expect(pezzi.map((uno) => (uno as UnPunto).testo), [
        'uno',
        'due',
        'tre',
        'quattro',
      ]);
      expect(pezzi.every((uno) => (uno as UnPunto).rientro == 0), isTrue);
    });

    test('un punto dentro un altro si ricorda quanto sta dentro', () {
      final pezzi = iPezziDi('- fuori\n  - dentro\n    - piu\' dentro');
      expect(pezzi.map((uno) => (uno as UnPunto).rientro), [0, 1, 2]);
    });

    test('tre o quattro spazi contano un rientro solo', () {
      /* Chi scrive il markdown rientra di due, di tre o di quattro: sono lo
       * stesso livello, e vanno a finire nello stesso posto. */
      final pezzi = iPezziDi('- fuori\n   - tre spazi\n    - quattro');
      expect(pezzi.map((uno) => (uno as UnPunto).rientro), [0, 1, 2]);
    });

    test('un elenco attaccato a un paragrafo non ci finisce dentro', () {
      final pezzi = iPezziDi('quello che segue:\n- uno\n- due');
      expect(pezzi.length, 3);
      expect(pezzi[0], isA<UnParagrafo>());
      expect(pezzi[1], isA<UnPunto>());
      expect(pezzi[2], isA<UnPunto>());
    });

    test('tre trattini sono una riga che separa', () {
      final pezzi = iPezziDi('sopra\n\n---\n\nsotto');
      expect(pezzi.length, 3);
      expect(pezzi[1], isA<UnaRiga>());
    });

    test('tre asterischi e tre trattini bassi pure', () {
      expect(iPezziDi('***').single, isA<UnaRiga>());
      expect(iPezziDi('___').single, isA<UnaRiga>());
      expect(iPezziDi('- - -').single, isA<UnaRiga>());
    });

    test('un blocco fra i recinti esce com\'e\', riga per riga', () {
      final pezzi = iPezziDi(
        'prima\n\n```\nnode strumenti/versione.mjs 1.4.32.8\n  due righe\n```\n\ndopo',
      );
      expect(pezzi.length, 3);
      expect(
        (pezzi[1] as UnBlocco).testo,
        'node strumenti/versione.mjs 1.4.32.8\n  due righe',
      );
    });

    test('dentro un blocco niente e\' un segno: resta testo', () {
      final pezzi = iPezziDi('```\n# non e\' un titolo\n- ne\' un punto\n```');
      expect(
        (pezzi.single as UnBlocco).testo,
        '# non e\' un titolo\n- ne\' un punto',
      );
    });

    test('il recinto con la lingua scritta accanto vale uguale', () {
      final pezzi = iPezziDi('```yaml\nversion: 1.4.32.8\n```');
      expect((pezzi.single as UnBlocco).testo, 'version: 1.4.32.8');
    });

    test('un blocco lasciato aperto non si perde', () {
      /* Le note di una versione le scrive una persona: un recinto senza
       * l'altro capita, e quello che segue va letto comunque. */
      final pezzi = iPezziDi('prima\n\n```\nqualcosa\nancora');
      expect(pezzi.length, 2);
      expect((pezzi[1] as UnBlocco).testo, 'qualcosa\nancora');
    });

    test('niente markdown: un paragrafo e nient\'altro', () {
      final pezzi = iPezziDi('Sistemate due cose.');
      expect(pezzi.single, isA<UnParagrafo>());
    });

    test('un testo vuoto non da\' nessun pezzo', () {
      expect(iPezziDi(''), isEmpty);
      expect(iPezziDi('\n\n   \n'), isEmpty);
    });

    test('i capoccapo di Windows non lasciano segni', () {
      final pezzi = iPezziDi('## due\r\n\r\nuna riga\r\n');
      expect(pezzi.length, 2);
      expect((pezzi[0] as UnTitolo).testo, 'due');
      expect((pezzi[1] as UnParagrafo).testo, 'una riga');
    });

    test('il CHANGELOG vero si legge, e non ne manca un pezzo', () {
      final tutto = iPezziDi('''
# Cosa cambia, giro per giro

Questo e' quello che Home Assistant fa vedere.

## 1.4.32.8

**Il firewall dell'ufficio.**

- la prima cosa
- la seconda, con `del codice`

```
un blocco
```
''');
      expect(tutto.whereType<UnTitolo>().length, 2);
      expect(tutto.whereType<UnPunto>().length, 2);
      expect(tutto.whereType<UnBlocco>().length, 1);
      expect(_tuttoIlTesto(tutto), contains('firewall'));
      expect(_tuttoIlTesto(tutto), contains('un blocco'));
    });
  });

  group('da quella versione', () {
    const tutto = '''
# Cosa cambia, giro per giro

Questo spiega come si leggono i numeri.

## 1.4.32.8

La cosa nuova.

## 1.4.32.7

La cosa di prima.
''';

    test('si comincia dopo il titolo della versione che si installa', () {
      final da = daQuellaVersione(tutto, '1.4.32.8');
      expect(da, startsWith('La cosa nuova.'));
      /* Le versioni di prima restano sotto: e' dove si va a cercarle. */
      expect(da, contains('## 1.4.32.7'));
      /* E il preambolo del file resta fuori. */
      expect(da, isNot(contains('giro per giro')));
    });

    test('il titolo non si ripete: il numero sta in testa al foglio', () {
      expect(daQuellaVersione(tutto, '1.4.32.8'), isNot(startsWith('#')));
    });

    test('una versione che non c\'e\' non taglia niente', () {
      expect(daQuellaVersione(tutto, '9.9.9.9'), tutto);
    });

    test('senza versione non taglia niente', () {
      expect(daQuellaVersione(tutto, ''), tutto);
      expect(daQuellaVersione(tutto, '   '), tutto);
    });

    test('un numero piu\' lungo non passa per quello corto', () {
      /* «1.4.32.8» non deve trovare «1.4.32.80», che e' un'altra versione. */
      const con80 =
          '## 1.4.32.80\n\nquella lunga\n\n## 1.4.32.8\n\nquella corta';
      expect(daQuellaVersione(con80, '1.4.32.8'), 'quella corta');
    });

    test('un titolo che dice anche altro va bene uguale', () {
      const scritto = '## 1.4.32.8 — il firewall\n\nil racconto';
      expect(daQuellaVersione(scritto, '1.4.32.8'), 'il racconto');
    });

    test('un numero dentro una frase non e\' un titolo', () {
      const scritto = 'la 1.4.32.8 esce oggi\n\n## 1.4.32.8\n\nil racconto';
      expect(daQuellaVersione(scritto, '1.4.32.8'), 'il racconto');
    });

    test('un cancelletto senza spazio non e\' un titolo nemmeno qui', () {
      const scritto = '#1.4.32.8\n\nil racconto';
      expect(daQuellaVersione(scritto, '1.4.32.8'), scritto);
    });

    test('quello che resta si legge, e sono i pezzi giusti', () {
      final pezzi = iPezziDi(daQuellaVersione(tutto, '1.4.32.8'));
      expect(pezzi.first, isA<UnParagrafo>());
      expect((pezzi.first as UnParagrafo).testo, 'La cosa nuova.');
      expect(pezzi.whereType<UnTitolo>().length, 1);
    });
  });

  group('i segni', () {
    test('il grassetto e\' grassetto, e le stelline sparite', () {
      final segni = _segni('prima **grosso** dopo');
      expect(_tuttiISegni(segni), 'prima grosso dopo');
      final grosso = segni.firstWhere(
        (uno) => (uno as TextSpan).text == 'grosso',
      );
      expect((grosso as TextSpan).style?.fontWeight, FontWeight.w700);
    });

    test('il codice ha il suo fondo e la sua spaziatura fissa', () {
      final segni = _segni('digita `tramite-gettone` e vedi');
      expect(_tuttiISegni(segni), 'digita tramite-gettone e vedi');
      final codice = segni.firstWhere(
        (uno) => (uno as TextSpan).text == 'tramite-gettone',
      );
      expect((codice as TextSpan).style?.fontFamily, 'monospace');
      expect(codice.style?.backgroundColor, const Color(0xFFEEEEEE));
    });

    test('il corsivo con un asterisco o un trattino basso', () {
      expect(_tuttiISegni(_segni('*piano*')), 'piano');
      expect(_tuttiISegni(_segni('_piano_')), 'piano');
      expect(
        (_segni('*piano*').single as TextSpan).style?.fontStyle,
        FontStyle.italic,
      );
    });

    test('un trattino basso in mezzo a una parola non e\' corsivo', () {
      /* `porta_l_app` e `un_nome_cosi` si scrivono, e non sono in corsivo. */
      expect(
        _tuttiISegni(_segni('il file porta_l_app.yml')),
        'il file porta_l_app.yml',
      );
      expect(
        _segni('il file porta_l_app.yml').every(
          (uno) => (uno as TextSpan).style?.fontStyle != FontStyle.italic,
        ),
        isTrue,
      );
    });

    test('un link si vede col suo testo, non col suo indirizzo', () {
      final segni = _segni('vedi [il changelog](https://gdahome.org/note)');
      expect(_tuttiISegni(segni), 'vedi il changelog');
    });

    test('senza niente da aprire, un link non si preme', () {
      final segni = _segni('vedi [qui](https://gdahome.org)');
      final link = segni.last as TextSpan;
      expect(link.recognizer, isNull);
      expect(link.style?.decoration, isNull);
    });

    test('con qualcosa da aprire, toccarlo da\' l\'indirizzo', () {
      String? aperto;
      final segni = _segni(
        'vedi [qui](https://gdahome.org/note)',
        quandoApre: (dove) => aperto = dove,
      );
      final link = segni.last as TextSpan;
      expect(link.style?.decoration, TextDecoration.underline);
      (link.recognizer! as TapGestureRecognizer).onTap!();
      expect(aperto, 'https://gdahome.org/note');
    });

    test('piu\' segni nella stessa riga, ognuno al suo posto', () {
      final segni = _segni('**uno** e `due` e [tre](https://qui)');
      expect(_tuttiISegni(segni), 'uno e due e tre');
    });

    test('un grassetto aperto e mai chiuso resta quello che e\'', () {
      /* Questo e' il guasto che conta: se il conto sbaglia, ** si porta via
       * tutto il resto della riga e chi legge non lo sa. */
      expect(
        _tuttiISegni(_segni('due stelline ** e poi del testo')),
        'due stelline ** e poi del testo',
      );
    });

    test('un codice aperto e mai chiuso resta un apostrofo inverso', () {
      expect(_tuttiISegni(_segni('un apice ` e poi')), 'un apice ` e poi');
    });

    test('una parentesi quadra senza l\'indirizzo resta com\'e\'', () {
      expect(_tuttiISegni(_segni('[non un link] qui')), '[non un link] qui');
    });

    test('una riga senza nessun segno esce intera, in un pezzo', () {
      final segni = _segni('una riga normale');
      expect(segni.single, isA<TextSpan>());
      expect((segni.single as TextSpan).text, 'una riga normale');
    });

    test('una riga vuota non da\' nessun segno', () {
      expect(_segni(''), isEmpty);
    });

    test('quello che sta prima e dopo un segno non si perde', () {
      expect(_tuttiISegni(_segni('a **b** c `d` e')), 'a b c d e');
    });
  });
}
