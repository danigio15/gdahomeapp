/// Le persone della plancia, per la mappa del navigatore.
///
/// «Se ci sono piu' persone nella casa e apro la mappa di gdanav, mi mostra
/// sulla mappa la posizione delle persone della casa.» Quali sono le dice la
/// sezione Persone della plancia (`cd_people` nella configurazione, la stessa
/// che legge `la_vettura.dart` per l'auto): l'entita' di ognuna, il nome, e
/// il sensore dell'indirizzo. Dove stanno lo dice Home Assistant, con
/// `latitude` e `longitude` sulla persona quando il suo tracker ha un GPS.
/// Chi e' nascosta in Home resta fuori anche qui.
library;

import 'dart:convert';

import 'package:gdanav_app/gdanav_app.dart';

import '../../casa/entita.dart';

/// Una persona come la scrive la plancia.
typedef PersonaDellaPlancia = ({String entita, String nome, String indirizzo});

/// Le persone della sezione Persone, dai valori della configurazione.
List<PersonaDellaPlancia> lePersoneDallaPlancia(Map<String, dynamic> valori) {
  Object? elenco = valori['cd_people'];
  if (elenco is String) {
    try {
      elenco = jsonDecode(elenco);
    } catch (_) {
      return const [];
    }
  }
  if (elenco is! List) return const [];
  return [
    for (final p in elenco.whereType<Map<dynamic, dynamic>>())
      if (p['nascosta'] != true && '${p['entity'] ?? ''}'.trim().isNotEmpty)
        (
          entita: '${p['entity']}'.trim(),
          nome: '${p['name'] ?? ''}'.trim(),
          indirizzo: '${p['address'] ?? ''}'.trim(),
        ),
  ];
}

/// Quella persona sulla mappa, o `null` se Home Assistant non dice dove sta.
PersonaSullaMappa? sullaMappa(
  PersonaDellaPlancia p,
  Entita? Function(String id) stato,
) {
  final e = stato(p.entita);
  if (e == null) return null;
  final lat = _numero(e.attributi['latitude']);
  final lon = _numero(e.attributi['longitude']);
  if (lat == null || lon == null) return null;
  final nome = p.nome.isNotEmpty ? p.nome : e.nome;
  return PersonaSullaMappa(
    id: p.entita,
    nome: nome,
    posizione: Punto(lat, lon),
    dove: indirizzoLeggibile(p.indirizzo.isEmpty ? null : stato(p.indirizzo)),
  );
}

/// L'indirizzo come lo scrive la card della plancia (`indirizzoLeggibile` in
/// `person-model.js`): via e numero con la citta', o niente se lo stato non
/// e' un indirizzo (`home`, una zona, delle coordinate).
String indirizzoLeggibile(Entita? e) {
  if (e == null || e.muta) return '';
  if (const {'person', 'device_tracker', 'zone'}.contains(e.dominio)) {
    return '';
  }
  final riga = e.stato.trim();
  if (const {
    'home',
    'not_home',
    'away',
    'casa',
    'fuori casa',
  }.contains(riga.toLowerCase())) {
    return '';
  }
  if (RegExp(r'^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$').hasMatch(riga)) {
    return '';
  }
  String attributo(String nome) => '${e.attributi[nome] ?? ''}'.trim();
  final via = attributo('Thoroughfare');
  final civico = attributo('Sub Thoroughfare');
  final citta = attributo('Locality').isNotEmpty
      ? attributo('Locality')
      : attributo('Sub Administrative Area');
  if (via.isNotEmpty && citta.isNotEmpty) {
    return '$via${civico.isEmpty ? '' : ' $civico'}, $citta';
  }
  var parti = [
    for (final p in riga.split(','))
      if (p.trim().isNotEmpty) p.trim(),
  ];
  final paese = attributo('Country');
  if (parti.length > 1 &&
      paese.isNotEmpty &&
      parti.last.toLowerCase() == paese.toLowerCase()) {
    parti = parti.sublist(0, parti.length - 1);
  } else if (parti.length >= 4 && !RegExp(r'\d').hasMatch(parti.last)) {
    parti = parti.sublist(0, parti.length - 1);
  }
  final pulite = <String>[];
  for (final parte in parti) {
    if (RegExp(r'^\d+[a-z]?(?:/\w+)?$', caseSensitive: false).hasMatch(parte) &&
        pulite.isNotEmpty) {
      pulite[pulite.length - 1] += ' $parte';
      continue;
    }
    final senza = parte
        .replaceFirst(RegExp(r'^\d{4,6}\s+'), '')
        .replaceFirst(RegExp(r'\s+\d{4,6}$'), '')
        .replaceFirst(RegExp(r'\s+[A-Z]{2}$'), '')
        .trim();
    if (senza.isNotEmpty && !RegExp(r'^\d+$').hasMatch(senza)) {
      pulite.add(senza);
    }
  }
  return pulite.take(2).join(', ');
}

double? _numero(Object? v) => switch (v) {
  final num n when n.isFinite => n.toDouble(),
  final String s => double.tryParse(s.trim()),
  _ => null,
};
