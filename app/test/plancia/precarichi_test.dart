/// La lista della spesa della plancia.
///
/// Quello che queste prove tengono fermo e' una cosa sola: **l'elenco che si
/// legge dalla pagina e' quello che la pagina chiedera' davvero**. Un file in
/// meno non fa danno — si chiede come si e' sempre chiesto — ma un percorso
/// sbagliato e' un giro sul filo buttato, e un percorso che esce dalla
/// cartella della plancia e' una domanda che il ponte rifiuta.
///
/// La prova che conta piu' delle altre e' l'ultima: l'elenco si legge dalla
/// **pagina vera**, quella che serve il ponte, e i percorsi che ne vengono
/// devono essere quelli che la pagina chiede.
library;

import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/precarichi.dart';

const _cartella = '/dashboardmodern_static/a521678057b7d342/legacy';

String _unaPagina(List<String> quali) => [
  '<!doctype html><html><head>',
  ...quali.map((q) => '<link rel="modulepreload" href="$q">'),
  '<script type="module" src="./modules-entry.js"></script>',
  '</head><body></body></html>',
].join('\n');

void main() {
  test('gli indirizzi relativi diventano percorsi interi', () {
    final quali = iPrecarichiDellaPagina(
      _unaPagina([
        '../src/core/i18n.js',
        './modules-entry.js',
        '../src/sections/luci.js',
      ]),
      cartella: _cartella,
    );
    expect(quali, [
      '/dashboardmodern_static/a521678057b7d342/src/core/i18n.js',
      '/dashboardmodern_static/a521678057b7d342/legacy/modules-entry.js',
      '/dashboardmodern_static/a521678057b7d342/src/sections/luci.js',
    ]);
  });

  test('l\'ordine e\' quello della pagina, e conta', () {
    /* I primi moduli sono i primi che la plancia apre: riordinarli vorrebbe
     * dire mandare avanti i pacchi sbagliati. */
    final quali = iPrecarichiDellaPagina(
      _unaPagina(['../src/z.js', '../src/a.js', '../src/m.js']),
      cartella: _cartella,
    );
    expect(quali.map((q) => q.split('/').last), ['z.js', 'a.js', 'm.js']);
  });

  test('un doppione si chiede una volta', () {
    final quali = iPrecarichiDellaPagina(
      _unaPagina(['../src/a.js', './../src/a.js', '../src/a.js']),
      cartella: _cartella,
    );
    expect(quali, ['/dashboardmodern_static/a521678057b7d342/src/a.js']);
  });

  test('quello che esce dalla plancia si lascia fuori', () {
    /* Un `..` di troppo, e un indirizzo che va da un\'altra parte: il ponte li
     * rifiuterebbe, e il pacco andrebbe perso per tutti i file che ci stanno
     * dentro. */
    final quali = iPrecarichiDellaPagina(
      _unaPagina([
        '../../../etc/passwd',
        'https://altrove.example/x.js',
        '//altrove.example/y.js',
        '/dashboardmodern_staticX/z.js',
        '../src/buono.js',
      ]),
      cartella: _cartella,
    );
    expect(quali, ['/dashboardmodern_static/a521678057b7d342/src/buono.js']);
  });

  test('una pagina senza precarichi da\' un elenco vuoto, e non un guasto', () {
    expect(
      iPrecarichiDellaPagina(
        '<html><body>ciao</body></html>',
        cartella: _cartella,
      ),
      isEmpty,
    );
    expect(iPrecarichiDellaPagina('', cartella: _cartella), isEmpty);
  });

  test('una cartella che non e\' quella della plancia non si legge', () {
    /* Se un giorno la pagina arrivasse da un altro posto, l\'elenco non e\'
     * piu' fatto di file della plancia: meglio non chiedere niente che
     * chiedere quaranta cose sbagliate. */
    expect(
      iPrecarichiDellaPagina(
        _unaPagina(['../src/a.js']),
        cartella: '/altrove/legacy',
      ),
      isEmpty,
    );
  });

  test('i pacchi sono da quaranta, nell\'ordine in cui stavano', () {
    final cento = List.generate(100, (i) => '/dashboardmodern_static/x/$i.js');
    final pacchi = aPacchi(cento);
    expect(pacchi.length, 3);
    expect(pacchi[0].length, 40);
    expect(pacchi[1].length, 40);
    expect(pacchi[2].length, 20);
    expect(pacchi.expand((p) => p).toList(), cento);
  });

  test('un elenco vuoto non fa nessun pacco', () {
    expect(aPacchi(const <String>[]), isEmpty);
  });

  test('la cartella di un percorso', () {
    expect(laCartellaDi('/a/b/c.html'), '/a/b');
    expect(laCartellaDi('/c.html'), '/');
    expect(laCartellaDi('c.html'), '/');
  });

  test('la cartella che li contiene tutti', () {
    /* E' dove si guarda cosa c'e' gia' sul disco, una volta sola: la plancia
     * con la sua impronta, e non tutte quelle di prima di ogni
     * aggiornamento. */
    expect(
      laCartellaComune([
        '/dashboardmodern_static/abc/src/core/uno.js',
        '/dashboardmodern_static/abc/src/sections/due.js',
        '/dashboardmodern_static/abc/legacy/modules-entry.js',
      ]),
      '/dashboardmodern_static/abc',
    );
    expect(laCartellaComune(['/a/b/c.js']), '/a/b');
    /* Un nome che comincia allo stesso modo non e' la stessa cartella. */
    expect(laCartellaComune(['/a/bc/x.js', '/a/b/y.js']), '/a');
    expect(laCartellaComune(['/x.js', '/a/b/y.js']), '/');
    expect(laCartellaComune(const <String>[]), '/');
  });

  group('i pacchi viaggiano in una finestra, non a gruppi', () {
    /// Un lavoro che finisce quando lo dice la prova.
    ({
      List<String> partiti,
      Map<String, Completer<void>> finisci,
      Future<void> Function(String) lavora,
    })
    lavoriAMano() {
      final partiti = <String>[];
      final finisci = <String, Completer<void>>{};
      return (
        partiti: partiti,
        finisci: finisci,
        lavora: (String quale) {
          partiti.add(quale);
          return (finisci[quale] = Completer<void>()).future;
        },
      );
    }

    test('appena uno finisce ne parte un altro, senza aspettare il più '
        'lento', () async {
      /* Prima si andava a gruppi di quattro: il quinto partiva quando erano
       * finiti tutti e quattro i primi, e un pacco lento lasciava vuoti gli
       * altri tre posti. */
      final a = lavoriAMano();
      final tutti = aFinestra(['1', '2', '3', '4', '5', '6'], a.lavora);
      await Future<void>.delayed(Duration.zero);
      expect(a.partiti, ['1', '2', '3', '4'], reason: 'quattro in volo');

      /* Il primo e' lento; il secondo finisce, e il suo posto non aspetta. */
      a.finisci['2']!.complete();
      await Future<void>.delayed(Duration.zero);
      expect(a.partiti, ['1', '2', '3', '4', '5']);

      a.finisci['3']!.complete();
      await Future<void>.delayed(Duration.zero);
      expect(a.partiti, ['1', '2', '3', '4', '5', '6']);

      var finito = false;
      unawaited(tutti.then((_) => finito = true));
      for (final quale in ['4', '5', '6']) {
        a.finisci[quale]!.complete();
      }
      await Future<void>.delayed(Duration.zero);
      expect(finito, isFalse, reason: 'il primo è ancora in volo');
      a.finisci['1']!.complete();
      await tutti;
    });

    test('mai più di quanti se ne chiedono insieme', () async {
      var inVolo = 0;
      var alMassimo = 0;
      await aFinestra(List.generate(20, (i) => i), (i) async {
        inVolo += 1;
        if (inVolo > alMassimo) alMassimo = inVolo;
        await Future<void>.delayed(Duration(milliseconds: 1 + i % 3));
        inVolo -= 1;
      });
      expect(alMassimo, pacchiInsieme);
    });

    test('uno che va storto non ferma gli altri, e si sa in fondo', () async {
      final fatti = <int>[];
      await expectLater(
        aFinestra([1, 2, 3, 4, 5, 6], (i) async {
          if (i == 1) throw StateError('il primo non è arrivato');
          fatti.add(i);
        }, quanti: 2),
        throwsA(isA<StateError>()),
      );
      expect(fatti, [2, 3, 4, 5, 6]);
    });

    test('un elenco vuoto non fa niente', () async {
      var chiamato = false;
      await aFinestra(const <int>[], (_) async => chiamato = true);
      expect(chiamato, isFalse);
    });
  });

  test('la pagina vera: i percorsi sono quelli dei file che ci sono', () {
    /* Non una pagina finta: quella della plancia dentro l\'add-on. Ogni
     * percorso che ne viene deve corrispondere a un file che esiste — se no e'
     * un giro sul filo per un 404. */
    final plancia = Directory('${Directory.current.parent.path}/ponte/plancia');
    final pagina = File('${plancia.path}/legacy/dashboard.html');
    if (!pagina.existsSync()) {
      markTestSkipped('senza plancia non c\'e\' niente da leggere');
      return;
    }
    final base = '/dashboardmodern_static/finta';
    final quali = iPrecarichiDellaPagina(
      pagina.readAsStringSync(),
      cartella: '$base/legacy',
    );
    expect(
      quali.length,
      greaterThan(300),
      reason: 'la pagina precarica i suoi moduli',
    );

    final mancanti = <String>[];
    for (final quale in quali) {
      final relativo = quale.substring(base.length);
      if (!File('${plancia.path}$relativo').existsSync()) {
        mancanti.add(relativo);
      }
    }
    expect(mancanti, isEmpty, reason: 'questi percorsi non sono file');
  });
}
