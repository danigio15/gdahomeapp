/// Le prove delle premesse: quello che si aggiunge alla pagina della plancia
/// prima di servirla.
///
/// Non si tocca un file della dashboard — il ponte li ricontrolla uno per uno
/// e una plancia con un file cambiato si direbbe modificata — quindi tutto
/// quello che gdahome aggiunge sta qui, e qui si guarda.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/pannello.dart';
import 'package:gdahome/plancia/premesse.dart';

const _pagina =
    '<!DOCTYPE html><html lang="it"><head><title>x</title></head>'
    '<body>la plancia</body></html>';

Premesse _premesse() => Premesse(
  pannello: const PannelloDellaPlancia(
    percorso: 'dashboardmodern',
    titolo: 'DashboardModern',
    base: '/dashboardmodern_static/abc123',
    istanza: 'e1',
    profilo: 'primary',
    primario: true,
    varianti: ['dashboard.html'],
  ),
);

void main() {
  test('in testa ci va quello che la plancia deve sapere', () {
    final servita = _premesse().conLePremesse(
      _pagina,
      ilWebSocket: 'WebSocket',
    );
    final dopoLaTesta = servita.indexOf('<head>') + '<head>'.length;
    expect(
      servita.substring(dopoLaTesta),
      startsWith('<script>window.__DASHBOARDMODERN_HOSTED__=true;'),
    );
    expect(servita, contains('window.__GDAHOME__=true;'));
    expect(servita, contains('la plancia'));
  });

  test('la tenda sulla barra si alza comunque, e solo se serve', () {
    /* La plancia scopre la barra dentro un `requestAnimationFrame`, e in un
     * riquadro che non si sta disegnando quel fotogramma non arriva mai: la
     * barra resterebbe invisibile per sempre. Succede ogni volta che la pagina
     * si carica mentre si guarda un'altra sezione dell'app. */
    final servita = _premesse().conLePremesse(
      _pagina,
      ilWebSocket: 'WebSocket',
    );
    expect(servita, contains(Premesse.laTendaSiAlzaComunque));

    /* Il segno lo mette **solo se non c'e' gia'**: quando la plancia ce la fa
     * da sola, questo non deve toccare niente. */
    expect(
      Premesse.laTendaSiAlzaComunque,
      contains('if(!radice||radice.getAttribute("data-dm-barra"))return;'),
    );
    expect(
      Premesse.laTendaSiAlzaComunque,
      contains('radice.setAttribute("data-dm-barra","pronta");'),
    );

    /* E dopo cinque secondi, non prima: la plancia da sola ce ne mette al
     * massimo quattro — 2500 di attesa piu' 1500 se la forma cambia sotto le
     * mani — e chi arriva dopo non le toglie niente. */
    expect(Premesse.laTendaSiAlzaComunque, contains('setTimeout(alza,5000)'));

    /* Un timer e nient'altro: un fotogramma o un sorvegliante qui sarebbero
     * la stessa trappola da cui si sta uscendo. */
    expect(
      Premesse.laTendaSiAlzaComunque,
      isNot(contains('requestAnimationFrame')),
    );
    expect(Premesse.laTendaSiAlzaComunque, isNot(contains('MutationObserver')));
  });

  test('la porta della Config si tira da dentro o si bussa da fuori', () {
    /* Nel browser l'app chiama la funzione dentro il riquadro, e una funzione
     * dentro un riquadro si chiama solo dalla stessa origine. Dove la plancia
     * arriva da un'altra porta — il collaudo, e un domani magari non solo lui
     * — il browser blocca la chiamata e il tasto sembra rotto. Allora c'e'
     * anche la porta che le origini le attraversa. */
    expect(
      Premesse.laConfigFuoriDallaPlancia,
      contains('window.gdahomeApriLaConfig=function()'),
    );
    expect(
      Premesse.laConfigFuoriDallaPlancia,
      contains('addEventListener("message"'),
    );
    expect(
      Premesse.laConfigFuoriDallaPlancia,
      contains('detto.gdahome==="apri-la-config"'),
    );
    expect(
      Premesse.laConfigFuoriDallaPlancia,
      contains('detto.gdahome==="torna-dalla-config"'),
    );
    /* E si accetta solo da chi ospita il riquadro: un ordine che arriva da
     * un'altra pagina qualunque non apre niente. */
    expect(
      Premesse.laConfigFuoriDallaPlancia,
      contains('evento.source!==window.parent'),
    );
  });

  test('quello che va in fondo sta in fondo, e nell\'ordine giusto', () {
    /* Le misure e la porta della Config perdono se stanno in testa: la plancia
     * scrive con `!important`, e fra due della stessa forza vince l'ultimo che
     * si legge. */
    final servita = _premesse().conLePremesse(
      _pagina,
      ilWebSocket: 'WebSocket',
    );
    final corpo = servita.indexOf('la plancia');
    final misure = servita.indexOf('gdahome-misure');
    final config = servita.indexOf('gdahome-config-fuori');
    final tenda = servita.indexOf('setTimeout(alza,5000)');
    expect(corpo, lessThan(misure));
    expect(misure, lessThan(config));
    expect(config, lessThan(tenda));
    expect(servita.indexOf('</body>'), greaterThan(tenda));
  });
}
