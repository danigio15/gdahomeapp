/// Il «conto» di una casa nei negozi: quello che l'app mette nell'acquisto
/// (`appAccountToken` sull'App Store, `obfuscatedAccountId` su Google Play)
/// e che il negozio poi ridice al quadro.
///
/// Serve a legare l'acquisto alla casa per cui si e' comprato: chi conosce il
/// numero di un acquisto altrui non se lo porta sulla sua casa finche' quella
/// giusta c'e' (`quadro/src/licenze.js`, `contoDellaCasa`). E' un'impronta
/// dell'id della casa a forma di UUID, perche' Apple vuole un UUID: dal conto
/// non si risale alla casa. Il quadro lo calcola allo stesso modo, byte per
/// byte.
library;

import 'dart:convert';

import 'package:cryptography/cryptography.dart';

Future<String?> contoDellaCasa(String? casa) async {
  final id = casa?.trim() ?? '';
  if (id.isEmpty) return null;
  final h = (await Sha256().hash(utf8.encode('gdahome-conto:$id'))).bytes
      .toList();
  h[6] = (h[6] & 0x0f) | 0x40;
  h[8] = (h[8] & 0x3f) | 0x80;
  final x = h.take(16).map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${x.substring(0, 8)}-${x.substring(8, 12)}-${x.substring(12, 16)}-'
      '${x.substring(16, 20)}-${x.substring(20)}';
}
