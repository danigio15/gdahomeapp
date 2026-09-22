/* Auto o moto (#75).
 *
 * «Sarebbe carino poter scegliere tra auto e moto.»
 *
 * Queste prove tengono ferme tre cose, e sono le tre che si possono rompere
 * senza accorgersene.
 *
 * La prima: il mezzo NON e' il motore. Sono due campi e si muovono da soli —
 * una moto puo' essere elettrica, a benzina o ibrida, e cambiare l'uno non
 * deve toccare l'altro. Se un giorno qualcuno li fondesse in una tendina
 * sola, qui si vedrebbe subito.
 *
 * La seconda: vuoto vuol dire auto. Ogni veicolo configurato finora non ha
 * questo campo, e deve continuare a essere un'automobile senza che nessuno
 * gli chieda di dichiararlo.
 *
 * La terza: le quattro caselle che una moto non ha si NASCONDONO, non si
 * buttano. Chi prova «Moto» e torna indietro deve ritrovare quello che aveva
 * mappato.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  MEZZI,
  MEZZO_DI_CASA_KEY,
  MEZZO_FIELD,
  VEHICLE_FIELDS,
  eUnaMoto,
  mezzoDelVeicolo,
  mezzoInUso,
  normalizeVehicle,
  siRicarica,
  tipoMotore,
  updateVehicle,
  vaACarburante,
} from "../src/core/vehicle-model.js";
import { disegnoDelCatalogo } from "../src/core/catalogo-disegni.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";

const leggi = (percorso) => readFile(new URL(`../src/${percorso}`, import.meta.url), "utf8");

test("il mezzo: vuoto vuol dire auto, e «moto» e' l'unica altra risposta", () => {
  assert.deepEqual([...MEZZI], ["auto", "moto"]);
  assert.equal(mezzoDelVeicolo("moto"), "moto");
  assert.equal(mezzoDelVeicolo(" MOTO "), "moto");
  assert.equal(mezzoDelVeicolo("auto"), "");
  assert.equal(mezzoDelVeicolo(""), "");
  assert.equal(mezzoDelVeicolo(undefined), "");
  /* Una parola che non e' ne' l'una ne' l'altra non inventa un terzo mezzo. */
  assert.equal(mezzoDelVeicolo("camion"), "");
  assert.equal(eUnaMoto({ [MEZZO_FIELD]: "moto" }), true);
  assert.equal(eUnaMoto({}), false);
  assert.equal(eUnaMoto(null), false);
});

test("il mezzo e il motore sono due campi, e non si toccano", () => {
  /* E' la ragione per cui la scelta esiste: una moto elettrica e una moto a
   * benzina sono tutte e due moto, e un'auto ibrida non e' meno auto. Sei
   * voci in una tendina sola sarebbero due domande travestite da una. */
  const moto = normalizeVehicle({ name: "Zero SR/F", [MEZZO_FIELD]: "moto" });
  assert.equal(eUnaMoto(moto), true);
  assert.equal(moto.tipo, "");
  assert.equal(siRicarica(moto), true);

  const motoABenzina = normalizeVehicle({ name: "Bonneville", [MEZZO_FIELD]: "moto", tipo: "termica" });
  assert.equal(eUnaMoto(motoABenzina), true);
  assert.equal(motoABenzina.tipo, "termica");
  assert.equal(vaACarburante(motoABenzina), true);
  assert.equal(siRicarica(motoABenzina), false);

  const autoIbrida = normalizeVehicle({ name: "Prius", tipo: "ibrida" });
  assert.equal(eUnaMoto(autoIbrida), false);
  assert.equal(autoIbrida.tipo, "ibrida");

  /* Cambiare il mezzo non tocca il motore, e viceversa. */
  const elenco = [normalizeVehicle({ uid: "auto-1", name: "Panda", tipo: "termica" })];
  const [dopoIlMezzo] = updateVehicle(elenco, "auto-1", { [MEZZO_FIELD]: "moto" });
  assert.equal(dopoIlMezzo.tipo, "termica");
  assert.equal(eUnaMoto(dopoIlMezzo), true);
  const [dopoIlMotore] = updateVehicle([dopoIlMezzo], "auto-1", { tipo: "" });
  assert.equal(tipoMotore(dopoIlMotore.tipo), "");
  assert.equal(eUnaMoto(dopoIlMotore), true);
});

test("chi arriva da prima resta un'automobile, senza dichiararlo", () => {
  const vecchia = normalizeVehicle({ name: "Tesla", ov: { "dm.ev_batteria_auto": "sensor.soc" } });
  assert.equal(vecchia[MEZZO_FIELD], "");
  assert.equal(eUnaMoto(vecchia), false);
  /* E il campo sta nell'elenco di cosa un veicolo E': chi un domani riscrive
   * un profilo non se lo perde per strada, com'e' gia' successo a marca,
   * modello e foto. */
  assert.ok(VEHICLE_FIELDS.includes(MEZZO_FIELD));
});

test("chi non ha profili lo dichiara alla plancia, e quella scelta viaggia", () => {
  /* Chi ha una moto sola compila le `dm.ev_*` della plancia e non preme mai
   * «Salva veicolo»: senza una casa la sua scelta sparirebbe. */
  assert.equal(mezzoInUso(null, "moto"), "moto");
  assert.equal(mezzoInUso(null, ""), "");
  /* Con un veicolo comanda il veicolo, perche' in un garage possono starci
   * una moto e un'automobile. */
  assert.equal(mezzoInUso({ [MEZZO_FIELD]: "" }, "moto"), "");
  assert.equal(mezzoInUso({ [MEZZO_FIELD]: "moto" }, ""), "moto");
  assert.ok(CONFIG_KEYS.includes(MEZZO_DI_CASA_KEY));
});

test("la moto ha il suo disegno, ed e' della famiglia", () => {
  const moto = disegnoDelCatalogo("moto", 34);
  assert.ok(moto, "la moto deve stare nel catalogo");
  assert.match(moto, /data-dm-art="moto"/);
  /* Il fondo azzurro e la scocca blu notte: e' quello che la fa somigliare
   * all'auto che le sta accanto nella stessa riga. */
  assert.match(moto, /#e0f2fe/);
  assert.match(moto, /#0f2942/);
  /* Chi la cerca con un altro nome trova la stessa moto — e il documento la
   * chiama col nome canonico, non con quello con cui e' stata cercata: due
   * disegni identici che si dichiarano diversi sarebbero due disegni. */
  for (const parola of ["motorcycle", "motorbike", "scooter"])
    assert.equal(disegnoDelCatalogo(parola, 34), moto, `${parola} deve dare la stessa moto`);
  /* E «auto» e «car» danno l'automobile che c'e' gia', invece di niente. */
  assert.equal(disegnoDelCatalogo("auto", 34), disegnoDelCatalogo("ev", 34));
  assert.equal(disegnoDelCatalogo("car", 34), disegnoDelCatalogo("ev", 34));
  assert.notEqual(disegnoDelCatalogo("auto", 34), moto);
});

test("le quattro caselle che una moto non ha si nascondono, non si buttano", async () => {
  const sorgente = await leggi("sections/auto-o-moto-section.js");
  for (const ref of ["dm.ev_portiere", "dm.ev_finestrini", "dm.ev_bagagliaio", "dm.ev_cofano"])
    assert.ok(sorgente.includes(ref), `${ref} deve stare fra le caselle che una moto non ha`);
  /* Le sole cose che si fanno alla riga sono una classe e basta: niente
   * `remove()`, niente `value = ""`, niente `edSetSlot`. Chi prova «Moto» e
   * torna ad «Auto» ritrova le sue quattro caselle com'erano. */
  const corpo = sorgente.slice(sorgente.indexOf("export function nascondiLeCaselleCheNonHa"));
  const funzione = corpo.slice(0, corpo.indexOf("\n}\n"));
  assert.ok(funzione.includes("classList.toggle"));
  assert.ok(!/\.remove\(\)/.test(funzione), "una casella nascosta non si toglie");
  assert.ok(!/value\s*=/.test(funzione), "una casella nascosta non si svuota");
});

test("il titolo della pagina non dice «Auto» sopra una moto", async () => {
  const sorgente = await leggi("sections/auto-termica-section.js");
  const inizio = sorgente.indexOf("export function titoloDellaPagina");
  assert.ok(inizio > 0);
  const funzione = sorgente.slice(inizio, sorgente.indexOf("\n}\n", inizio));
  /* Le tre combinazioni che esistono davvero: moto elettrica, moto termica e
   * moto ibrida. Un'auto elettrica resta senza titolo suo — tiene quello del
   * guscio, che dice gia' la cosa giusta — ed e' l'unico `null` rimasto. */
  assert.ok(funzione.includes('t("Moto", "Motorcycle")'));
  assert.ok(funzione.includes('t("Moto ibrida", "Hybrid motorcycle")'));
  assert.ok(funzione.includes("mezzoInPagina()"));
  assert.equal((funzione.match(/return null/g) || []).length, 0);
  assert.ok(/:\s*null;/.test(funzione), "solo l'auto elettrica resta senza titolo suo");
});

test("la matita riallinea la scelta al veicolo che apre", async () => {
  /* Trovato guidando la plancia vera, non a tavolino.
   *
   * La matita cambia il veicolo di cui parla la scheda senza passare da un
   * ridisegno: la scelta restava ferma su quella di prima, e aprendo una moto
   * si leggeva «Auto». Non era solo una parola sbagliata — un tocco su quella
   * risposta la SALVAVA sopra quella giusta, e la moto tornava automobile
   * senza che nessuno l'avesse chiesto.
   *
   * Adesso il momento in cui la scheda cambia veicolo lo annuncia chi lo
   * conosce — `setEditingKey`, l'unico posto che lo sa — e chi disegna
   * qualcosa del veicolo si riallinea. Queste due righe tengono insieme
   * l'annuncio e l'ascolto: se uno dei due sparisce, torna il guasto. */
  const ev = await leggi("sections/ev-section.js");
  assert.ok(ev.includes("export const EVENTO_VEICOLO_IN_SCHEDA"));
  const dentro = ev.slice(ev.indexOf("function setEditingKey"));
  const funzione = dentro.slice(0, dentro.indexOf("\n}\n"));
  assert.ok(
    funzione.includes("dispatchEvent?.(new CustomEvent(EVENTO_VEICOLO_IN_SCHEDA"),
    "chi cambia il veicolo della scheda lo deve dire",
  );

  const sezione = await leggi("sections/auto-o-moto-section.js");
  assert.ok(sezione.includes("EVENTO_VEICOLO_IN_SCHEDA"), "e la scelta lo deve ascoltare");
  /* E riallinearsi vuol dire rileggere dal veicolo, non tenersi l'ultima
   * risposta: `dmPer` e' il veicolo di cui la scelta sta parlando, e quando
   * cambia la risposta si riprende da lui. */
  assert.ok(sezione.includes("casella.dataset.dmPer !== chiave"));
});

test("la scelta scrive appena la si tocca, come la tendina del motore", async () => {
  const sorgente = await leggi("sections/auto-o-moto-section.js");
  /* Il tasto verde in fondo alla sezione salva le caselle, non questa scelta:
   * se la scelta aspettasse lui, chi la fa e poi salva la sezione se la
   * vedrebbe buttata via senza che nessuno glielo abbia detto. E' lo stesso
   * guasto gia' visto sul motore (#326), e la stessa correzione. */
  const corpo = sorgente.slice(sorgente.indexOf("export function scriviIlMezzo"));
  const funzione = corpo.slice(0, corpo.indexOf("\n}\n"));
  assert.ok(funzione.includes("writeJsonIfChanged(MEZZO_DI_CASA_KEY"));
  assert.ok(funzione.includes("salvaAuto(updateVehicle("));
  /* E il salvataggio di un veicolo se lo porta dietro, per la stessa strada
   * del motore: si legge dal documento, non dal modulo, cosi' la sezione che
   * salva non importa chi importa lei. */
  const ev = await leggi("sections/ev-section.js");
  assert.ok(ev.includes('doc?.querySelector?.("#ed-body [data-ev-mezzo-riga]")'));
  assert.ok(ev.includes("...mezzo,"));
});
