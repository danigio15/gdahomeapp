/* Le tessere che si nascondono quando e' tutto spento (#355).
 *
 * «Widget come elettrodomestici o luci o prese potrebbero avere un'opzione
 * che si auto nascondono? Tipo quando nessun elettrodomestico e' in moto il
 * widget non si vede, recuperando spazio.»
 *
 * Una tessera delle Luci con scritto «0» dice una cosa vera ma che non serve:
 * e' spento tutto, che e' il caso normale. Chi lo chiede la vuole vedere solo
 * quando ha qualcosa da dire, come le tessere degli avvisi. L'opzione e' per
 * tessera e sta spenta finche' non la si accende: chi non tocca niente vede la
 * Home di sempre.
 *
 * Poi l'UPS: «si potrebbe aggiungere anche alla schermata UPS». Per lui
 * «acceso» vuol dire che c'e' qualcosa da sapere: un gruppo che va a batteria
 * o non risponde, o la batteria sotto la soglia. A rete presente e tutto in
 * ordine la tessera non dice niente che non si sappia gia'.
 *
 * Qui non c'e' DOM: entra il modello della tessera, esce se va mostrata.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** Le tessere che sanno dire «e' tutto spento». */
export const TESSERE_A_SCOMPARSA = Object.freeze(["luci", "prese", "elettrodomestici", "ups"]);

const AMMESSE = new Set(TESSERE_A_SCOMPARSA);

/** La lista salvata, ripulita: solo tessere che sanno nascondersi, una volta. */
export function soloAcceseValide(lista) {
  const fuori = [];
  for (const voce of Array.isArray(lista) ? lista : []) {
    const chiave = pulito(voce);
    if (AMMESSE.has(chiave) && !fuori.includes(chiave)) fuori.push(chiave);
  }
  return fuori;
}

/* C'e' qualcosa acceso, o in funzione?
 *
 * Gli elettrodomestici contano quelli che stanno lavorando (`running`): uno
 * fermo con la presa accesa non e' «in moto». Luci e prese contano quelle
 * accese. Un modello che non si capisce si tiene: nel dubbio una tessera si
 * mostra, perche' sparire per sbaglio e' peggio che restare. */
export function qualcosaAcceso(modello) {
  if (!modello || typeof modello !== "object") return true;
  const chiave = pulito(modello.key);
  if (chiave === "elettrodomestici")
    return Array.isArray(modello.running) ? modello.running.length > 0 : true;
  /* L'UPS ha qualcosa da dire quando un gruppo non e' in rete — a batteria,
   * o senza risposta — o quando c'e' l'allarme. Senza gruppi letti non si sa:
   * si mostra. */
  if (chiave === "ups") {
    if (!Array.isArray(modello.gruppi) || !modello.gruppi.length) return true;
    if (modello.alert === true) return true;
    return modello.gruppi.some((gruppo) => gruppo?.lettura?.rete !== true);
  }
  if (Array.isArray(modello.on)) return modello.on.length > 0;
  return true;
}

/** Se una tessera va mostrata, con la lista di quelle «solo se acceso». */
export function tesseraDaMostrare(modello, soloAccese = []) {
  const chiave = pulito(modello?.key);
  if (!soloAccese.includes(chiave)) return true;
  return qualcosaAcceso(modello);
}
