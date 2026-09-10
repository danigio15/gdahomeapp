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

/// Le chiavi che la plancia sincronizza: `CONFIG_KEYS` di
/// `core/chiavi-di-configurazione.js`, revisione 41 (plancia 1.4.17).
///
/// Sono centotre': cento `cd_` e tre `dm_`. Le tre `dm_` non sono schermate:
/// `dm_dashboard_state` e' il blocco di stato del guscio vecchio,
/// `dm_schema_version` la versione dello schema — il ponte le porta da un
/// dispositivo all'altro senza aprirle — e `dm_campi_scelti` e' il segno che
/// l'app mette dentro `metadata` di un carico quando le sue caselle sono
/// state scelte a mano. La prova sotto lo dice: si contano, ma non si
/// promettono.
const leChiaviDellaPlancia = <String>[
  'cd_allag_rilevato',
  'cd_allerte',
  'cd_animali',
  'cd_antifurto_modi',
  'cd_antifurto_su_misura',
  'cd_appliances',
  'cd_assist',
  'cd_avvisi_custom',
  'cd_avvisi_icone',
  'cd_avvisi_names_extra',
  'cd_barra_casa',
  'cd_batteria_verso',
  'cd_batterie',
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
  'cd_ev_motore',
  'cd_ev_visual',
  'cd_evidenza',
  'cd_floor_icons',
  'cd_floors',
  'cd_flow_nodes',
  'cd_flusso_home',
  'cd_fumo_rilevato',
  'cd_grafico_stanze',
  'cd_gruppi_extra',
  'cd_gruppi_removed',
  'cd_hidden_elements',
  'cd_home_blocchi',
  'cd_impianti_termici',
  'cd_irrigazione',
  'cd_lavatrice_programmi',
  'cd_lavatrice_visual',
  'cd_lingua',
  'cd_loads',
  'cd_luci',
  'cd_luci_order',
  'cd_luci_room_order',
  'cd_luci_rooms',
  'cd_macchine',
  'cd_media_player',
  'cd_meteo_entita_proprie',
  'cd_navbar_mode',
  'cd_navbar_order',
  'cd_orologio',
  'cd_people',
  'cd_piscina',
  'cd_porte_conferma',
  'cd_prese',
  'cd_presenza',
  'cd_prezzo_immissione',
  'cd_quick_actions',
  'cd_radar_meteo',
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
  'cd_varchi',
  'cd_visual_prefer_image',
  'cd_vmc',
  'cd_widgets',
  'dm_campi_scelti',
  'dm_dashboard_state',
  'dm_schema_version',
];

/// Quante ne conosce l'app adesso. Sale, non scende: quando sale si cambia
/// questo numero e si cambia il documento, insieme.
///
/// Centouno su centotre': mancano `dm_dashboard_state` e `dm_schema_version`,
/// che non sono schermate — il ponte le porta da un dispositivo all'altro
/// senza aprirle — e `dm_campi_scelti` c'e' perche' l'app lo scrive dentro
/// `metadata` di ogni carico e apparecchio che salva.
const quanteNeConosciamo = 101;

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
  'cd_allag_rilevato',
  'cd_allerte',
  'cd_animali',
  'cd_antifurto_modi',
  'cd_antifurto_su_misura',
  'cd_appliances',
  'cd_assist',
  'cd_avvisi_custom',
  'cd_avvisi_icone',
  'cd_avvisi_names_extra',
  'cd_barra_casa',
  'cd_batteria_verso',
  'cd_batterie',
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
  'cd_ev_motore',
  'cd_ev_visual',
  'cd_evidenza',
  'cd_floor_icons',
  'cd_floors',
  'cd_flow_nodes',
  'cd_flusso_home',
  'cd_fumo_rilevato',
  'cd_grafico_stanze',
  'cd_gruppi_extra',
  'cd_gruppi_removed',
  'cd_hidden_elements',
  'cd_home_blocchi',
  'cd_impianti_termici',
  'cd_irrigazione',
  'cd_lavatrice_programmi',
  'cd_lavatrice_visual',
  'cd_lingua',
  'cd_loads',
  'cd_luci',
  'cd_luci_order',
  'cd_luci_room_order',
  'cd_luci_rooms',
  'cd_macchine',
  'cd_media_player',
  'cd_meteo_entita_proprie',
  'cd_navbar_mode',
  'cd_navbar_order',
  'cd_orologio',
  'cd_people',
  'cd_piscina',
  'cd_porte_conferma',
  'cd_prese',
  'cd_presenza',
  'cd_prezzo_immissione',
  'cd_quick_actions',
  'cd_radar_meteo',
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
  'cd_varchi',
  'cd_visual_prefer_image',
  'cd_vmc',
  'cd_widgets',
  'dm_campi_scelti',
];

Set<String> _chiaviNeiSorgenti() {
  final trovate = <String>{};
  final forma = RegExp("'((?:cd|dm)_[a-z0-9_]+)'");
  for (final cosa in Directory('lib').listSync(recursive: true)) {
    if (cosa is! File || !cosa.path.endsWith('.dart')) continue;
    for (final trovato in forma.allMatches(cosa.readAsStringSync())) {
      trovate.add(trovato.group(1)!);
    }
  }
  return trovate;
}

void main() {
  test('le chiavi della plancia sono centotre\'', () {
    expect(leChiaviDellaPlancia.length, 103);
    expect(leChiaviDellaPlancia.toSet().length, 103);
  });

  /* E sono **quelle** della plancia vendorizzata, non una copia a mano.
   *
   * La copia a mano e' esattamente quello che era rimasto indietro: sei giri
   * di verifica contro una plancia 1.4.11 mentre la dashboard era alla
   * 1.4.17, con diciassette chiavi in piu'. Da qui in poi la lista di sopra
   * si confronta col file della plancia dentro l'add-on, e se la plancia
   * cambia la prova cade prima di noi. */
  test('e sono quelle di chiavi-di-configurazione.js', () {
    final registro = File(
      '../ponte/plancia/src/core/chiavi-di-configurazione.js',
    ).readAsStringSync();
    final blocco = RegExp(r'CONFIG_KEYS = Object\.freeze\(\[([\s\S]*?)\]\);')
        .firstMatch(registro);
    expect(blocco, isNotNull, reason: 'CONFIG_KEYS non si trova piu\'');
    final dellaPlancia = {
      for (final trovato in RegExp(
        r'^\s*"([a-z_]+)",?\s*$',
        multiLine: true,
      ).allMatches(blocco!.group(1)!))
        trovato.group(1)!,
    };
    expect(
      leChiaviDellaPlancia.toSet().difference(dellaPlancia),
      isEmpty,
      reason: 'chiavi che la plancia non ha piu\'',
    );
    expect(
      dellaPlancia.difference(leChiaviDellaPlancia.toSet()),
      isEmpty,
      reason: 'chiavi nuove della plancia che qui mancano',
    );
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

  /* E non basta che ci siano: qualcuno deve usarle.
   *
   * `cd_report_devices` era dichiarata in `casa/plancia/home.dart` e nessuna
   * schermata la apriva: il conto qui sotto la dava per coperta perche' il
   * nome nei sorgenti compariva — compariva nella riga che lo dichiara. E' lo
   * stesso difetto che il commento sopra descrive («bastava dichiarare
   * quaranta costanti in un file di modello, nomi e basta, senza una
   * schermata dietro»), succedeva davvero su una chiave, e la prova non se ne
   * accorgeva.
   *
   * Adesso una chiave deve comparire **fuori** dal file che la dichiara. Non
   * prova che la schermata sia raggiungibile — quello lo fa
   * `configurazione_test.dart` — ma una costante sola in fondo a un file di
   * modello non passa piu'.
   */
  test('e non sono dichiarazioni sole: qualcuno le usa', () {
    /* Tutti i sorgenti in un pezzo, meno le righe che dichiarano le
     * costanti: quelle ci sono sempre, e sono proprio quello che non conta. */
    final costanti = <String, String>{};
    final tutto = StringBuffer();
    for (final cosa in Directory('lib').listSync(recursive: true)) {
      if (cosa is! File || !cosa.path.endsWith('.dart')) continue;
      final testo = cosa.readAsStringSync();
      for (final trovato in RegExp(
        r"const (\w+) = '((?:cd|dm)_[a-z0-9_]+)';",
      ).allMatches(testo)) {
        costanti[trovato.group(1)!] = trovato.group(2)!;
      }
      tutto.write(testo);
    }
    var senzaLeDichiarazioni = tutto.toString();
    for (final voce in costanti.entries) {
      senzaLeDichiarazioni = senzaLeDichiarazioni.replaceAll(
        "const ${voce.key} = '${voce.value}';",
        '',
      );
    }

    /* Come si chiama, in Dart, la costante di questa chiave — se ce l'ha. */
    final nomeDi = {for (final voce in costanti.entries) voce.value: voce.key};
    final sole = [
      for (final chiave in leChiaviCheSappiamoFare)
        if (!senzaLeDichiarazioni.contains("'$chiave'") &&
            !(nomeDi[chiave] != null &&
                RegExp('\\b${RegExp.escape(nomeDi[chiave]!)}\\b')
                    .hasMatch(senzaLeDichiarazioni)))
          chiave,
    ]..sort();
    expect(
      sole,
      isEmpty,
      reason:
          'queste chiavi stanno solo nella riga che le dichiara: nessuna '
          'schermata le apre — ${sole.join(', ')}',
    );
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
