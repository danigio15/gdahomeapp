/// Le prove dell'indirizzo.
///
/// Sembrano prove su una funzione stupida, e invece sono prove su **la prima
/// schermata che vede un utente**: se qui si sbaglia, l'app non parte e la
/// colpa sembra del ponte.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/ponte/indirizzo.dart';

void main() {
  test('il solo nome della casa prende la porta dell\'add-on', () {
    final letto = IndirizzoDelPonte.leggi('192.168.1.50')!;
    expect(letto.casa, '192.168.1.50');
    expect(letto.porta, 8098);
    expect(letto.sicuro, isFalse);
    expect(letto.filo.toString(), 'ws://192.168.1.50:8098/casa');
    expect(letto.salute.toString(), 'http://192.168.1.50:8098/salute');
  });

  test('in chiaro ci si abbina solo con quello che sta in casa', () {
    /* L'abbinamento in chiaro verso un indirizzo pubblico passerebbe per reti
     * che non sono nostre. In cifrato invece va bene dappertutto. */
    for (final inCasa in [
      '192.168.1.50',
      '10.0.0.4:8098',
      '172.16.0.9',
      '172.31.255.1',
      '169.254.10.20',
      '127.0.0.1',
      'localhost',
      'homeassistant',
      'homeassistant.local',
      'casa.home.arpa',
    ]) {
      expect(
        IndirizzoDelPonte.leggi(inCasa)!.siPuoAbbinare,
        isTrue,
        reason: inCasa,
      );
    }
    for (final fuori in [
      'casa.esempio.it',
      '8.8.8.8',
      '172.32.0.1',
      '192.169.1.1',
      '100.64.0.1',
      '3232235777',
    ]) {
      expect(
        IndirizzoDelPonte.leggi(fuori)!.siPuoAbbinare,
        isFalse,
        reason: fuori,
      );
      expect(
        IndirizzoDelPonte.leggi('https://$fuori')!.siPuoAbbinare,
        isTrue,
        reason: 'https://$fuori',
      );
    }
  });

  test('un centralino in chiaro si segue solo se sta in casa', () {
    expect(IndirizzoDelCentralino.leggi('ws://centralino.esempio.it'), isNull);
    expect(IndirizzoDelCentralino.leggi('http://203.0.113.9:8080'), isNull);
    expect(
      IndirizzoDelCentralino.leggi('ws://127.0.0.1:8787'),
      const IndirizzoDelCentralino(
        casa: '127.0.0.1',
        porta: 8787,
        sicuro: false,
      ),
    );
    expect(
      IndirizzoDelCentralino.leggi('centralino.esempio.it')!.sicuro,
      isTrue,
    );
  });

  test('i quattro modi in cui la gente lo scrive danno la stessa cosa', () {
    const atteso = IndirizzoDelPonte(casa: 'casa.esempio.it');
    for (final scritto in [
      'casa.esempio.it',
      'casa.esempio.it:8098',
      'http://casa.esempio.it',
      '  http://casa.esempio.it/  ',
      'ws://casa.esempio.it:8098/casa',
      'CASA.ESEMPIO.IT',
    ]) {
      expect(IndirizzoDelPonte.leggi(scritto), atteso, reason: scritto);
    }
  });

  test('con https la porta diventa la 443, non quella dell\'add-on', () {
    /* Chi scrive `https` sta passando da un proxy inverso o dall'accesso
     * remoto: dietro c'e' la 443, e la porta dell'add-on non c'entra piu'. */
    final letto = IndirizzoDelPonte.leggi('https://casa.esempio.it')!;
    expect(letto.porta, 443);
    expect(letto.sicuro, isTrue);
    expect(letto.filo.toString(), 'wss://casa.esempio.it:443/casa');
  });

  test('una porta scritta apposta vince sempre', () {
    expect(
      IndirizzoDelPonte.leggi('https://casa.esempio.it:8443')!.porta,
      8443,
    );
    expect(IndirizzoDelPonte.leggi('192.168.1.50:9000')!.porta, 9000);
  });

  test('quello che non è un indirizzo torna null invece di sollevare', () {
    for (final scritto in [
      '',
      '   ',
      ':8098',
      'casa esempio',
      'http://',
      'ftp://casa.esempio.it',
      '192.168.1.50:0',
      '192.168.1.50:99999',
      '192.168.1.50:ottomilanovantotto',
      'casa@esempio.it',
    ]) {
      expect(IndirizzoDelPonte.leggi(scritto), isNull, reason: '«$scritto»');
    }
  });

  test('rivisto dall\'utente, la porta solita non si scrive', () {
    expect(
      IndirizzoDelPonte.leggi('192.168.1.50').toString(),
      'http://192.168.1.50',
    );
    expect(
      IndirizzoDelPonte.leggi('192.168.1.50:9000').toString(),
      'http://192.168.1.50:9000',
    );
    expect(
      IndirizzoDelPonte.leggi('https://casa.esempio.it').toString(),
      'https://casa.esempio.it',
    );
  });
}
