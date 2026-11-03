/// Le scene della pagina Salute per le prove e le fotografie: l'iPhone di
/// Marco la sera del 3 novembre, con le misure di oggi e di qualche giorno fa.
library;

import 'package:gdahome/salute/il_corpo.dart';

final seraDel3Novembre = DateTime(2026, 11, 3, 20);

final tutteDiMarco = <MisuraDelCorpo, Lettura>{
  MisuraDelCorpo.passi: Lettura(1949, seraDel3Novembre),
  MisuraDelCorpo.battito: Lettura(73, DateTime(2026, 11, 1, 22, 4)),
  MisuraDelCorpo.battitoRiposo: Lettura(69, DateTime(2026, 10, 31, 7)),
  MisuraDelCorpo.peso: Lettura(81.4, DateTime(2026, 10, 28, 7, 5)),
  MisuraDelCorpo.grasso: Lettura(19.2, DateTime(2026, 10, 28, 7, 5)),
  MisuraDelCorpo.sistolica: Lettura(124, DateTime(2026, 11, 2, 20, 10)),
  MisuraDelCorpo.diastolica: Lettura(79, DateTime(2026, 11, 2, 20, 10)),
  MisuraDelCorpo.ossigeno: Lettura(97, DateTime(2026, 11, 2, 6)),
  MisuraDelCorpo.sonno: Lettura(452, DateTime(2026, 11, 3, 6, 30)),
};

/// Senza bilancia e senza misuratore: peso, grasso e pressione non ci sono.
final senzaBilancia = {
  for (final e in tutteDiMarco.entries)
    if (!{
      MisuraDelCorpo.peso,
      MisuraDelCorpo.grasso,
      MisuraDelCorpo.sistolica,
      MisuraDelCorpo.diastolica,
    }.contains(e.key))
      e.key: e.value,
};

const tutteLeScelte = {
  MisuraDelCorpo.passi,
  MisuraDelCorpo.battito,
  MisuraDelCorpo.battitoRiposo,
  MisuraDelCorpo.peso,
  MisuraDelCorpo.grasso,
  MisuraDelCorpo.sistolica,
  MisuraDelCorpo.diastolica,
  MisuraDelCorpo.ossigeno,
  MisuraDelCorpo.sonno,
};
