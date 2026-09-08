/// I comandi della plancia: quello che si preme, tradotto per Home Assistant.
///
/// Sono i servizi veri di Home Assistant — `light.turn_on` con
/// `brightness_pct`, `climate.set_temperature`, `cover.set_cover_position` —
/// scritti una volta sola, cosi' la pagina Luci e la pagina Stanze accendono
/// una luce nello stesso identico modo. Niente qui guarda lo schermo.
library;

import '../casa/stato_della_casa.dart';

class Comandi {
  const Comandi(this._casa);
  final StatoDellaCasa _casa;

  Future<void> accendi(String entita) => _casa.comanda('turn_on', entita);
  Future<void> spegni(String entita) => _casa.comanda('turn_off', entita);
  Future<void> inverti(String entita) => _casa.comanda('toggle', entita);

  /// La luminosita' in percento: zero spegne, il resto accende a quel punto.
  Future<void> luminosita(String entita, int percento) {
    final quanto = percento.clamp(0, 100);
    if (quanto == 0) return spegni(entita);
    return _casa.comanda('turn_on', entita, con: {'brightness_pct': quanto});
  }

  Future<void> bianco(String entita, int kelvin) =>
      _casa.comanda('turn_on', entita, con: {'color_temp_kelvin': kelvin});

  Future<void> colore(String entita, List<int> rgb) =>
      _casa.comanda('turn_on', entita, con: {'rgb_color': rgb});

  Future<void> effetto(String entita, String nome) =>
      _casa.comanda('turn_on', entita, con: {'effect': nome});

  /* ─── Il clima ─────────────────────────────────────────────────────────── */

  Future<void> obiettivo(String entita, num gradi) =>
      _casa.comanda('set_temperature', entita, con: {'temperature': gradi});

  Future<void> modoDelClima(String entita, String modo) =>
      _casa.comanda('set_hvac_mode', entita, con: {'hvac_mode': modo});

  Future<void> ventola(String entita, String modo) =>
      _casa.comanda('set_fan_mode', entita, con: {'fan_mode': modo});

  /* ─── Le coperture ─────────────────────────────────────────────────────── */

  Future<void> apri(String entita) => _casa.comanda('open_cover', entita);
  Future<void> chiudi(String entita) => _casa.comanda('close_cover', entita);
  Future<void> ferma(String entita) => _casa.comanda('stop_cover', entita);

  Future<void> posizione(String entita, int percento) => _casa.comanda(
    'set_cover_position',
    entita,
    con: {'position': percento.clamp(0, 100)},
  );
}
