/* La bozza di un'anteprima modificabile (#379).
 *
 * «In ogni sezione del config un'anteprima, e in quell'anteprima si spostano
 * a piacimento le cose; quando si salvano vanno nella plancia modificate.»
 *
 * Quello che si muove nell'anteprima non si scrive subito: sta in una bozza,
 * e la plancia cambia solo con «Salva». Qui ci sono i conti della bozza —
 * spostare, accendere e spegnere, capire se e' diversa da quella salvata —
 * senza niente di pagina, cosi' si provano senza un browser.
 *
 * Una bozza e' `{ ordine: [chiavi], nascoste: [chiavi] }`: l'elenco intero
 * nell'ordine voluto, e quali di quelle non si vedono.
 */

const pulita = (lista) => [
  ...new Set((Array.isArray(lista) ? lista : []).map(String).filter(Boolean)),
];

/** Una bozza nuova, copiata da una scelta salvata. */
export function bozzaDa(scelta = {}) {
  const ordine = pulita(scelta.ordine);
  const dentro = new Set(ordine);
  return { ordine, nascoste: pulita(scelta.nascoste).filter((chiave) => dentro.has(chiave)) };
}

/** La bozza con la voce in posizione `da` portata in `a`. */
export function spostaNellaBozza(bozza, da, a) {
  const ordine = [...bozza.ordine];
  if (!Number.isInteger(da) || !Number.isInteger(a) || da === a || !ordine[da]) return bozza;
  const [presa] = ordine.splice(da, 1);
  ordine.splice(Math.max(0, Math.min(a, ordine.length)), 0, presa);
  return { ...bozza, ordine };
}

/** Lo spostamento fatto fra le sole voci che l'anteprima mostra: le altre —
 * quelle che in questo momento non hanno niente da mostrare — tengono il loro
 * posto, e la presa va dove sta la voce su cui e' caduta. */
export function spostaFraLeVisibili(bozza, visibili, da, a) {
  const presa = visibili[da];
  const arrivo = visibili[a];
  if (!presa || !arrivo || presa === arrivo) return bozza;
  return spostaNellaBozza(bozza, bozza.ordine.indexOf(presa), bozza.ordine.indexOf(arrivo));
}

/** La bozza con la voce accesa se era spenta, e spenta se era accesa. */
export function alternaNellaBozza(bozza, chiave) {
  if (!bozza.ordine.includes(chiave)) return bozza;
  const nascoste = new Set(bozza.nascoste);
  if (nascoste.has(chiave)) nascoste.delete(chiave);
  else nascoste.add(chiave);
  return { ...bozza, nascoste: bozza.ordine.filter((voce) => nascoste.has(voce)) };
}

/** Se la bozza dice qualcosa di diverso dalla scelta salvata. L'ordine delle
 * nascoste non conta: conta quali sono. */
export function bozzaCambiata(bozza, salvata) {
  if (!bozza) return false;
  const prima = bozzaDa(salvata);
  if (bozza.ordine.length !== prima.ordine.length) return true;
  if (bozza.ordine.some((chiave, i) => chiave !== prima.ordine[i])) return true;
  const nascostePrima = new Set(prima.nascoste);
  return (
    bozza.nascoste.length !== nascostePrima.size ||
    bozza.nascoste.some((chiave) => !nascostePrima.has(chiave))
  );
}

/** La bozza riallineata a un elenco che e' cambiato mentre la si teneva in
 * mano — una voce nuova nata, una tolta: le nuove vanno dove sono nell'elenco
 * vero, quelle sparite escono. */
export function bozzaRiallineata(bozza, salvata) {
  const vero = bozzaDa(salvata);
  const esiste = new Set(vero.ordine);
  const ordine = bozza.ordine.filter((chiave) => esiste.has(chiave));
  vero.ordine.forEach((chiave, i) => {
    if (ordine.includes(chiave)) return;
    ordine.splice(Math.min(i, ordine.length), 0, chiave);
  });
  return { ordine, nascoste: bozza.nascoste.filter((chiave) => esiste.has(chiave)) };
}
