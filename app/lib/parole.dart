/// Le parole che cambiano col numero.
///
/// «1 volte» è la cosa che tradisce un'app: il numero lo mette un contatore, la
/// parola non la mette nessuno. Qui stanno insieme, una volta per tutte.
///
/// Sta alla radice e non sotto `vestito/` perché non è una cosa
/// dell'apparenza: la chiedono anche pezzi che di schermo non sanno niente —
/// il filo scrive la sua riga del traffico, e quella riga si legge in
/// «Come va l'app» e finisce dentro una segnalazione.
library;

/// «1 volta», «2 volte».
String volte(int quante) => quante == 1 ? '$quante volta' : '$quante volte';
