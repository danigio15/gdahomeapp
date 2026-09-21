/* «Fare una sezione per i dispositivi di cottura. Mi piacerebbe pilotare la
 * mia friggitrice ad aria della Philips» (#71).
 *
 * La prima metà della risposta è questa, ed è piccola: la friggitrice la
 * plancia la sapeva già DISEGNARE — `appliance-hero-artwork.js` ha il suo
 * disegno da sempre — ma nell'elenco delle cose che si possono scegliere non
 * c'era. Chi ce l'aveva in Home Assistant, in plancia doveva chiamarla
 * «Presa».
 *
 * Qui si tiene fermo il caso suo e la regola che lo conteneva: un disegno che
 * nessuno può scegliere è lavoro buttato, e la volta dopo nessuno se ne
 * accorge. Ogni disegno di apparecchio deve avere la sua voce nell'elenco,
 * oppure stare scritto qui sotto perché è lo stesso apparecchio chiamato in
 * un altro modo.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { HERO_ARTWORK_TYPES } from "../src/core/appliance-hero-artwork.js";
import { LOAD_ICON_CATALOG } from "../src/core/personalization-catalog.js";

const offerti = new Map(LOAD_ICON_CATALOG.map((voce) => [voce.id, voce]));

/* I disegni che una voce ce l'hanno con un altro nome, o che voce non devono
 * averla. Non è una lista di eccezioni tollerate: è la mappa di chi si chiama
 * in due modi, e ogni riga dice quale dei due. */
const LO_STESSO_APPARECCHIO = new Map([
  ["cooktop", "hob"],
  ["robot-vacuum", "vacuum"],
  ["storage-boiler", "boiler"],
  ["television", "tv"],
  /* Il ripiego per quello che non si sa cos'è: una voce «Generico» nell'elenco
   * sarebbe una scelta che non dice niente. */
  ["generic", null],
]);

test("la friggitrice ad aria si può scegliere, e il tostapane con lei", () => {
  for (const id of ["air-fryer", "toaster"]) {
    const voce = offerti.get(id);
    assert.ok(voce, `«${id}» non è fra le cose che si possono scegliere`);
    assert.ok(voce.it && voce.en, `«${id}» non ha un nome nelle due lingue`);
    assert.match(voce.mdi, /^mdi:/);
  }
  assert.equal(offerti.get("air-fryer").it, "Friggitrice ad aria");
  assert.equal(offerti.get("air-fryer").en, "Air fryer");
  /* E si trova cercando come la chiama chi ce l'ha. */
  assert.match(offerti.get("air-fryer").keywords || "", /friggitrice/);
  assert.match(offerti.get("air-fryer").keywords || "", /airfryer/);
});

test("ogni disegno di apparecchio ha la sua voce, o dice con che nome ce l'ha", () => {
  const orfani = HERO_ARTWORK_TYPES.filter((tipo) => {
    if (offerti.has(tipo)) return false;
    if (!LO_STESSO_APPARECCHIO.has(tipo)) return true;
    const altro = LO_STESSO_APPARECCHIO.get(tipo);
    /* E l'altro nome deve esistere davvero: una mappa che punta a una voce
     * cancellata è peggio di nessuna mappa. */
    return altro !== null && !offerti.has(altro);
  });
  assert.deepEqual(
    orfani,
    [],
    `disegni che nessuno può scegliere: ${orfani.join(", ")}`,
  );
});
