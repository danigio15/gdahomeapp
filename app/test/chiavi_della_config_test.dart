/// Il conto delle chiavi, che tiene onesto il documento.
///
/// `docs/CONFIG_COMPLETA.md` dice quante chiavi della Config della plancia la
/// Configurazione dell'app sa leggere e scrivere. Un numero scritto a mano in
/// un documento invecchia il giorno dopo, e invecchia sempre nella stessa
/// direzione: verso l'ottimismo. Questa prova lo conta ogni volta.
///
/// Non prova che una chiave sia gestita **bene**: prova che sia nominata. E'
/// il pavimento, non il soffitto — ma un pavimento che si abbassa da solo lo
/// vede subito qualcuno.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Le chiavi che la plancia sincronizza, da `config-persistence-section.js`,
/// meno le due di servizio (`cd_sync_dirty`, `cd_sync_ts`).
const leChiaviDellaPlancia = <String>[
  'cd_allerte',
  'cd_antifurto_modi',
  'cd_appliances',
  'cd_avvisi_custom',
  'cd_avvisi_icone',
  'cd_avvisi_names_extra',
  'cd_branding',
  'cd_caldaia',
  'cd_calendari',
  'cd_cameras',
  'cd_centrale_scelta',
  'cd_centrali',
  'cd_clima_inverti_card',
  'cd_clima_rapido',
  'cd_clima_rapido_unita',
  'cd_clima_units',
  'cd_costo_kwh',
  'cd_devices',
  'cd_energia_tessere',
  'cd_energy_model',
  'cd_energy_views',
  'cd_entita_mie',
  'cd_entity_overrides',
  'cd_ev_car_active',
  'cd_ev_cars',
  'cd_ev_meta',
  'cd_ev_visual',
  'cd_evidenza',
  'cd_floor_icons',
  'cd_floors',
  'cd_flow_nodes',
  'cd_fumo_rilevato',
  'cd_gruppi_extra',
  'cd_gruppi_removed',
  'cd_hidden_elements',
  'cd_home_blocchi',
  'cd_impianti_termici',
  'cd_irrigazione',
  'cd_lavatrice_programmi',
  'cd_lavatrice_visual',
  'cd_loads',
  'cd_luci',
  'cd_luci_order',
  'cd_luci_room_order',
  'cd_luci_rooms',
  'cd_media_player',
  'cd_meteo_entita_proprie',
  'cd_navbar_mode',
  'cd_navbar_order',
  'cd_people',
  'cd_piscina',
  'cd_porte_conferma',
  'cd_prese',
  'cd_prezzo_immissione',
  'cd_quick_actions',
  'cd_report_devices',
  'cd_rifiuti',
  'cd_robot',
  'cd_scaldabagni',
  'cd_section_names',
  'cd_sections',
  'cd_sections_manual',
  'cd_security_doors',
  'cd_sezioni_mie',
  'cd_slot_labels',
  'cd_solare_scelto',
  'cd_solari',
  'cd_solo_lettura',
  'cd_stanze',
  'cd_stanze_entita',
  'cd_stati_invertiti',
  'cd_subload_groups',
  'cd_subloads_extra',
  'cd_tapparelle',
  'cd_tapparelle_soglia',
  'cd_termico_caldo',
  'cd_text_overrides',
  'cd_todo',
  'cd_umidita_soglia',
  'cd_ups',
  'cd_ups_meta',
  'cd_visual_prefer_image',
  'cd_widgets',
];

/// Quante ne conosce l'app adesso. Sale, non scende: quando sale si cambia
/// questo numero e si cambia il documento, insieme.
const quanteNeConosciamo = 54;

/* Quali chiavi l'app sa configurare **davvero**.
 *
 * E' un elenco scritto a mano, e lo e' apposta. Il conto lo si faceva
 * frugando nei sorgenti: bastava dichiarare quaranta costanti in un file di
 * modello — nomi e basta, senza una schermata dietro — e il numero saltava da
 * quarantadue a ottantatre in un pomeriggio, senza che nessuno potesse
 * configurare niente di piu'. E' esattamente il modo in cui un documento
 * comincia a mentire, e questo conto esiste per impedirlo.
 *
 * Scritto a mano, ogni chiave che entra qui e' una riga che qualcuno ha
 * aggiunto sapendo cosa stava dicendo. E la prova sotto controlla che non sia
 * una promessa: una chiave elencata qui deve comparire nei sorgenti dell'app,
 * o l'elenco cade.
 */
const leChiaviCheSappiamoFare = <String>[
  'cd_allerte',
  'cd_antifurto_modi',
  'cd_appliances',
  'cd_avvisi_custom',
  'cd_branding',
  'cd_caldaia',
  'cd_calendari',
  'cd_cameras',
  'cd_centrale_scelta',
  'cd_centrali',
  'cd_clima_units',
  'cd_costo_kwh',
  'cd_energia_tessere',
  'cd_energy_model',
  'cd_energy_views',
  'cd_entita_mie',
  'cd_entity_overrides',
  'cd_ev_car_active',
  'cd_ev_cars',
  'cd_evidenza',
  'cd_flow_nodes',
  'cd_hidden_elements',
  'cd_home_blocchi',
  'cd_impianti_termici',
  'cd_irrigazione',
  'cd_loads',
  'cd_luci',
  'cd_media_player',
  'cd_navbar_order',
  'cd_people',
  'cd_piscina',
  'cd_porte_conferma',
  'cd_prese',
  'cd_prezzo_immissione',
  'cd_quick_actions',
  'cd_report_devices',
  'cd_robot',
  'cd_scaldabagni',
  'cd_section_names',
  'cd_sections',
  'cd_security_doors',
  'cd_slot_labels',
  'cd_solare_scelto',
  'cd_solari',
  'cd_stanze',
  'cd_subload_groups',
  'cd_subloads_extra',
  'cd_tapparelle',
  'cd_tapparelle_soglia',
  'cd_text_overrides',
  'cd_todo',
  'cd_umidita_soglia',
  'cd_ups',
  'cd_widgets',
];

Set<String> _chiaviNeiSorgenti() {
  final trovate = <String>{};
  final forma = RegExp("'(cd_[a-z0-9_]+)'");
  for (final cosa in Directory('lib').listSync(recursive: true)) {
    if (cosa is! File || !cosa.path.endsWith('.dart')) continue;
    for (final trovato in forma.allMatches(cosa.readAsStringSync())) {
      trovate.add(trovato.group(1)!);
    }
  }
  return trovate;
}

void main() {
  test('le chiavi della plancia sono ottantatre', () {
    expect(leChiaviDellaPlancia.length, 83);
    expect(leChiaviDellaPlancia.toSet().length, 83);
  });

  test('l\'app ne conosce quante dice il documento', () {
    expect(leChiaviCheSappiamoFare.length, quanteNeConosciamo);
    expect(leChiaviCheSappiamoFare.toSet().length, quanteNeConosciamo);
  });

  test('quelle che diciamo di fare sono chiavi della plancia', () {
    for (final chiave in leChiaviCheSappiamoFare) {
      expect(
        leChiaviDellaPlancia,
        contains(chiave),
        reason: '«$chiave» non e\' una chiave che la plancia sincronizza',
      );
    }
  });

  test('e non sono promesse: nei sorgenti ci sono', () {
    final nei = _chiaviNeiSorgenti();
    for (final chiave in leChiaviCheSappiamoFare) {
      expect(
        nei,
        contains(chiave),
        reason: '«$chiave» e\' scritta nell\'elenco e non nel codice',
      );
    }
  });
}
