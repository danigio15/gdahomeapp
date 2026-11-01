/* Dove sta la plancia che sta girando: l'indirizzo fino alla cartella che
 * contiene `legacy/`, `src/` e `pacco/`.
 *
 * «Questo DWG non si legge», dal telefono: il motore dei DWG, pdf.js e il
 * modello degli arredi si chiedevano a `/dashboardmodern_static/legacy/…`,
 * senza l'impronta. Home Assistant lo serve anche cosi'; il ponte no — lui
 * serve solo `/dashboardmodern_static/<impronta>/legacy/…`, e il resto e' un
 * 404. Qui l'impronta, se c'e', resta. */
export function cartellaDellaPlancia(qui) {
  const m = /^(.*\/dashboardmodern_static\/(?:[^/?#]+\/)?)(?:legacy|src|pacco)\//.exec(
    String(qui || ""),
  );
  return m ? m[1] : null;
}

/* Un file di `legacy/vendor/`, dalla plancia che sta girando; `riserva`
 * quando l'indirizzo non e' quello di una plancia servita (le prove). */
export function daiVendor(qui, percorso, riserva) {
  const cartella = cartellaDellaPlancia(qui);
  return cartella ? `${cartella}legacy/vendor/${percorso}` : riserva;
}
