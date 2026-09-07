/// Una casa che l'app conosce.
///
/// «Casa» qui vuol dire una istanza di Home Assistant col suo ponte davanti:
/// la propria, quella dei genitori, quella al mare. L'app ne tiene piu' di una
/// e si passa dall'una all'altra senza riabbinare niente, perche' ognuna ha il
/// suo segno.
///
/// **Due indirizzi, una casa sola.** E' il punto di questa classe. La stessa
/// istanza si raggiunge in un modo quando si e' dentro casa — l'indirizzo di
/// rete locale, veloce e che non esce da li' — e in un altro quando si e'
/// fuori. Non sono due case: e' la stessa, vista da due parti. Chi usa l'app
/// non deve saperlo e non deve toccare niente quando esce dal portone.
library;

import '../ponte/indirizzo.dart';

/// Da dove si e' entrati, l'ultima volta che ha funzionato.
enum DaDove {
  /// Dall'indirizzo di rete locale: si e' in casa.
  daDentro,

  /// Dall'indirizzo pubblico: si e' fuori.
  daFuori,
}

class CasaConosciuta {
  const CasaConosciuta({
    required this.id,
    required this.nome,
    required this.segno,
    this.inCasa,
    this.daFuoriCasa,
    this.ultimoApprodo,
  });

  /// Identificativo interno, mai mostrato.
  final String id;

  /// Come la chiama l'utente: «Casa», «Dai miei», «Al mare».
  final String nome;

  /// Il segno del ponte. Non esce mai da qui verso lo schermo o il registro.
  final String segno;

  /// L'indirizzo che funziona quando si e' dentro casa.
  final IndirizzoDelPonte? inCasa;

  /// L'indirizzo che funziona da fuori: un dominio con un proxy davanti,
  /// l'accesso remoto di Home Assistant, o l'indirizzo dentro una VPN.
  final IndirizzoDelPonte? daFuoriCasa;

  /// Da dove si e' entrati l'ultima volta. Si prova prima quello: nove volte
  /// su dieci il telefono e' dove era ieri.
  final DaDove? ultimoApprodo;

  /// Gli indirizzi che questa casa conosce, nell'ordine in cui conviene
  /// provarli.
  ///
  /// L'ultimo che ha funzionato per primo. Non e' un'ottimizzazione da poco:
  /// provare per primo un indirizzo di rete locale mentre si e' fuori vuol
  /// dire aspettare che scada un tentativo verso un indirizzo che non esiste,
  /// e succede a ogni apertura dell'app.
  List<({DaDove da, IndirizzoDelPonte dove})> approdi() {
    final tutti = <({DaDove da, IndirizzoDelPonte dove})>[
      if (inCasa != null) (da: DaDove.daDentro, dove: inCasa!),
      if (daFuoriCasa != null) (da: DaDove.daFuori, dove: daFuoriCasa!),
    ];
    if (ultimoApprodo == null || tutti.length < 2) return tutti;
    tutti.sort((uno, altro) {
      if (uno.da == ultimoApprodo) return -1;
      if (altro.da == ultimoApprodo) return 1;
      return 0;
    });
    return tutti;
  }

  bool get raggiungibile => inCasa != null || daFuoriCasa != null;

  /// Una casa senza l'indirizzo di fuori funziona solo sotto il proprio
  /// Wi-Fi. E' una cosa che vale la pena dire a chi la sta aggiungendo,
  /// invece di lasciargliela scoprire in stazione.
  bool get soloInCasa => inCasa != null && daFuoriCasa == null;

  CasaConosciuta con({
    String? nome,
    String? segno,
    IndirizzoDelPonte? inCasa,
    IndirizzoDelPonte? daFuoriCasa,
    DaDove? ultimoApprodo,
    bool togliInCasa = false,
    bool togliDaFuori = false,
  }) => CasaConosciuta(
    id: id,
    nome: nome ?? this.nome,
    segno: segno ?? this.segno,
    inCasa: togliInCasa ? null : (inCasa ?? this.inCasa),
    daFuoriCasa: togliDaFuori ? null : (daFuoriCasa ?? this.daFuoriCasa),
    ultimoApprodo: ultimoApprodo ?? this.ultimoApprodo,
  );

  Map<String, dynamic> inJson() => {
    'id': id,
    'nome': nome,
    'segno': segno,
    if (inCasa != null) 'in_casa': inCasa.toString(),
    if (daFuoriCasa != null) 'da_fuori': daFuoriCasa.toString(),
    if (ultimoApprodo != null) 'ultimo_approdo': ultimoApprodo!.name,
  };

  /// Torna `null` quando quello che c'e' scritto non e' una casa: un archivio
  /// rovinato non deve impedire all'app di aprirsi con le altre.
  static CasaConosciuta? daJson(Object? grezza) {
    if (grezza is! Map) return null;
    final id = grezza['id'];
    final nome = grezza['nome'];
    final segno = grezza['segno'];
    if (id is! String || nome is! String || segno is! String) return null;
    if (id.isEmpty || segno.isEmpty) return null;
    return CasaConosciuta(
      id: id,
      nome: nome,
      segno: segno,
      inCasa: IndirizzoDelPonte.leggi(grezza['in_casa'] as String? ?? ''),
      daFuoriCasa: IndirizzoDelPonte.leggi(grezza['da_fuori'] as String? ?? ''),
      ultimoApprodo: switch (grezza['ultimo_approdo']) {
        'daDentro' => DaDove.daDentro,
        'daFuori' => DaDove.daFuori,
        _ => null,
      },
    );
  }

  /* Il segno non compare: `toString` finisce nei registri e nelle segnalazioni
   * di errore, e li' non ci va. */
  @override
  String toString() =>
      'CasaConosciuta($nome, in casa: $inCasa, da fuori: $daFuoriCasa)';
}
