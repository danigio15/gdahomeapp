/// Le case doppie: la stessa casa scritta piu' volte nell'archivio.
///
/// «Escono piu' case associate, e ogni volta mi dice che manca Premium
/// all'improvviso.» Due strade portavano allo stesso elenco con la stessa casa
/// tre volte:
///
///  - **lo stesso `id` copiato**: l'archivio si apriva due o tre volte insieme
///    — l'avvio dell'app, l'auto che si collega, un comando da Android Auto —
///    e ogni apertura aggiungeva tutte le case a un elenco svuotato una volta
///    sola. Al primo salvataggio le copie finivano sul disco e ci restavano;
///  - **la stessa casa riabbinata**: ogni abbinamento faceva una casa nuova,
///    con un `id` nuovo, anche quando era la casa di prima.
///
/// E non era solo brutto da vedere: il gettone nuovo finiva sulla prima copia
/// e la licenza leggeva l'ultima, con quello vecchio. La casa aperta
/// risultava Base, e dopo otto giorni anche le altre.
///
/// Qui le copie si fondono in una: prima per `id`, poi per `casaAlCentralino`
/// — il `casa_…` che la casa si da' una volta sola e non cambia. Il gettone
/// che resta e' il piu' nuovo.
library;

import 'dart:convert';

import 'casa_conosciuta.dart';

/// Le case senza doppioni, nell'ordine in cui comparivano, e chi e' andato
/// dentro chi: `id` tolto → `id` rimasto. Vuoto se non c'era niente da
/// fondere.
///
/// [ancheLaStessaCasa] a `false` fonde solo le copie con lo stesso `id`: e'
/// quello che serve alla licenza, che le case le tiene per `id` e le riceve
/// dall'archivio gia' fuse.
({List<CasaConosciuta> case_, Map<String, String> fuse}) fondiLeCopie(
  Iterable<CasaConosciuta> tutte, {
  bool ancheLaStessaCasa = true,
}) {
  final fuse = <String, String>{};

  /* Prima lo stesso `id`: sono la stessa casa con le stesse chiavi, copiata.
   * Quello che puo' essere diverso e' quello che si e' scritto dopo — il
   * gettone su una copia sola — e si prende il piu' nuovo. */
  final perId = <String, List<CasaConosciuta>>{};
  for (final una in tutte) {
    perId.putIfAbsent(una.id, () => []).add(una);
  }
  final unaPerId = [
    for (final copie in perId.values)
      copie.length == 1 ? copie.first : _stessoId(copie),
  ];
  if (!ancheLaStessaCasa) return (case_: unaPerId, fuse: fuse);

  /* Poi la stessa casa abbinata due volte: `id` diversi, stesso `casa_…`.
   * L'ultima abbinata ha le chiavi buone — e' quella con cui la casa la
   * conosce adesso — e la prima ha il nome e la plancia che si erano scelti. */
  final perCasa = <String, List<CasaConosciuta>>{};
  final ordine = <Object>[];
  for (final una in unaPerId) {
    final casa = una.casaAlCentralino;
    if (casa == null || casa.isEmpty) {
      ordine.add(una);
      continue;
    }
    final gia = perCasa[casa];
    if (gia == null) {
      perCasa[casa] = [una];
      ordine.add(casa);
    } else {
      gia.add(una);
    }
  }
  final case_ = <CasaConosciuta>[];
  for (final uno in ordine) {
    if (uno is CasaConosciuta) {
      case_.add(uno);
      continue;
    }
    final copie = perCasa[uno]!;
    if (copie.length == 1) {
      case_.add(copie.first);
      continue;
    }
    final fusa = _riabbinata(copie);
    for (final copia in copie) {
      if (copia.id != fusa.id) fuse[copia.id] = fusa.id;
    }
    case_.add(fusa);
  }
  return (case_: case_, fuse: fuse);
}

/// Quando e' stato emesso un gettone, senza controllarne la firma: serve
/// solo a scegliere il piu' nuovo fra due copie della stessa casa. La firma
/// la guarda la licenza, dopo. `null` se non si legge.
DateTime? emessoDelGettone(String? gettone) {
  if (gettone == null || gettone.isEmpty) return null;
  final punto = gettone.indexOf('.');
  if (punto <= 0) return null;
  try {
    final detto = jsonDecode(
      utf8.decode(
        base64Url.decode(base64Url.normalize(gettone.substring(0, punto))),
      ),
    );
    final emesso = detto is Map ? detto['emesso'] : null;
    return emesso is num
        ? DateTime.fromMillisecondsSinceEpoch(emesso.toInt())
        : null;
  } catch (_) {
    return null;
  }
}

/// Il gettone da tenere fra quelli di piu' copie: il piu' nuovo che si
/// legge; altrimenti il primo detto, anche vuoto («chiesto, e non ne ha»),
/// che vale piu' di «mai chiesto».
String? _ilGettone(Iterable<String?> gettoni) {
  String? nuovo;
  DateTime? quando;
  for (final uno in gettoni) {
    final emesso = emessoDelGettone(uno);
    if (emesso != null && (quando == null || emesso.isAfter(quando))) {
      quando = emesso;
      nuovo = uno;
    }
  }
  return nuovo ?? gettoni.firstWhere((uno) => uno != null, orElse: () => null);
}

String? _ilPiuNuovo(Iterable<String?> gettoni) {
  String? nuovo;
  DateTime? quando;
  for (final uno in gettoni) {
    final emesso = emessoDelGettone(uno);
    if (emesso != null && (quando == null || emesso.isAfter(quando))) {
      quando = emesso;
      nuovo = uno;
    }
  }
  return nuovo;
}

CasaConosciuta _conIGettoni(
  CasaConosciuta base,
  List<CasaConosciuta> copie, {
  required bool legata,
}) {
  final gettone = _ilGettone(copie.map((una) => una.gettone));
  final premium = _ilPiuNuovo(copie.map((una) => una.gettonePremium));
  /* Un gettone vero vuol dire che la casa le licenze le sa tenere. */
  final conLicenze = emessoDelGettone(gettone) != null;
  return CasaConosciuta(
    id: base.id,
    nome: base.nome,
    segno: base.segno,
    identificativo: base.identificativo,
    chiave: base.chiave,
    casaAlCentralino: base.casaAlCentralino,
    centralino: base.centralino,
    inCasa: base.inCasa,
    daFuoriCasa: base.daFuoriCasa,
    ultimoApprodo: base.ultimoApprodo,
    plancia: base.plancia,
    gettone: gettone,
    gettonePremium: premium ?? base.gettonePremium,
    senzaLicenze: conLicenze ? false : base.senzaLicenze,
    legata: legata,
    vecchioIdentificativo: base.vecchioIdentificativo,
    vecchioSegno: base.vecchioSegno,
  );
}

/* Le copie con lo stesso `id`: stesse chiavi, quindi il legame vale se l'ha
 * visto una qualunque. */
CasaConosciuta _stessoId(List<CasaConosciuta> copie) =>
    _conIGettoni(copie.first, copie, legata: copie.any((una) => una.legata));

/* La stessa casa abbinata piu' volte: le chiavi e le strade dell'ultima, il
 * nome e la plancia della prima. Il telefono di prima, se la casa lo tiene
 * ancora, si fa staccare alla prossima connessione (`vecchio…`). */
CasaConosciuta _riabbinata(List<CasaConosciuta> copie) {
  final prima = copie.first;
  final ultima = copie.last;
  final staccare = copie
      .where(
        (una) =>
            una.identificativo != null &&
            una.identificativo!.isNotEmpty &&
            una.identificativo != ultima.identificativo,
      )
      .toList();
  final fusa = _conIGettoni(
    CasaConosciuta(
      id: prima.id,
      nome: prima.nome,
      segno: ultima.segno,
      identificativo: ultima.identificativo,
      chiave: ultima.chiave,
      casaAlCentralino: ultima.casaAlCentralino,
      centralino: ultima.centralino ?? prima.centralino,
      inCasa: ultima.inCasa ?? prima.inCasa,
      daFuoriCasa: ultima.daFuoriCasa ?? prima.daFuoriCasa,
      ultimoApprodo: ultima.ultimoApprodo,
      plancia: prima.plancia,
      senzaLicenze: ultima.senzaLicenze,
      vecchioIdentificativo: staccare.isEmpty
          ? ultima.vecchioIdentificativo
          : staccare.last.identificativo,
      vecchioSegno: staccare.isEmpty
          ? ultima.vecchioSegno
          : staccare.last.segno,
    ),
    copie,
    /* Il legame e' della chiave: quella dell'ultima. */
    legata: ultima.legata,
  );
  return fusa;
}
