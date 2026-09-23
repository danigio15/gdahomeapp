/* «Di nuovo la mappa non viene riportata, insieme alle scritte rosse sotto» (#29).
 *
 * La scritta rossa era una, e diceva: «Nessuna previsione disponibile per
 * weather.meteonetwork_weather_situazione_a_conegliano_co». Ed era vera —
 * quell'entità è una stazione: dice che tempo fa adesso a Conegliano, i
 * prossimi giorni non li sa, e il guscio le previsioni le chiede come si deve
 * (`weather.get_forecasts`, prima i giorni e poi le ore).
 *
 * Il difetto non è il controllo: è cosa resta scritto a chi legge. Una riga
 * rossa con dentro un `entity_id` dice «è rotto» e non dice né cosa né cosa
 * fare, e chi la trova sotto un riquadro di mappa conclude la cosa più
 * naturale del mondo: che non funzioni niente, mappa compresa. La segnalazione
 * è arrivata così, e il radar in quella casa non c'entrava nulla.
 *
 * La frase la scrive il guscio, che è vendorato: la correzione sta nella
 * tabella dei difetti confermati di `vendor_legacy.py` — così il prossimo
 * aggiornamento dal repository di origine non la riporta indietro — e questa
 * prova tiene ferme le due cose insieme, il guscio di adesso e la tabella che
 * lo rifà.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const guscio = (lingua) =>
  readFile(new URL(`../legacy/dashboard-runtime-${lingua}.js`, import.meta.url), "utf8");

const ricetta = () =>
  readFile(new URL("../../../../scripts/vendor_legacy.py", import.meta.url), "utf8");

test("la riga rossa non c'è più, in nessuno dei due gusci", async () => {
  for (const lingua of ["it", "en"]) {
    const fonte = await guscio(lingua);
    assert.ok(
      !fonte.includes("Nessuna previsione disponibile"),
      `il guscio ${lingua} scrive ancora la riga rossa`,
    );
    assert.ok(!fonte.includes("color:#e11d48; font-weight:800;>"), "il rosso è tornato");
  }
});

test("al suo posto c'è cosa è successo, dove si cambia, e che il radar è un'altra cosa", async () => {
  /* Ogni guscio nella sua lingua: le parole inglesi le rimette il generatore,
   * che è dove stanno tutte le altre del guscio. */
  const italiano = await guscio("it");
  assert.match(italiano, /Questa entità meteo non dà le previsioni/);
  assert.match(italiano, /Configurazione › Sezioni › Meteo/);
  /* La frase che risponde alla segnalazione: il radar non c'entra. */
  assert.match(italiano, /Il radar qui sopra è un[’']altra cosa e funziona per conto suo/u);

  const inglese = await guscio("en");
  assert.match(inglese, /This weather entity has no forecast/);
  assert.match(inglese, /Config › Sections › Weather/);
  assert.match(inglese, /The radar above is a separate thing and works on its own/);
  /* E nessuno dei due parla la lingua dell'altro. */
  assert.ok(!inglese.includes("Questa entità meteo"), "il guscio inglese parla italiano");
  assert.ok(!italiano.includes("This weather entity"), "il guscio italiano parla inglese");
});

test("l'entità di cui si parla resta scritta, che serve a chi segnala", async () => {
  const fonte = await guscio("it");
  /* Due punti diversi, e due modi di sapere di chi si parla: quello che apre
   * le previsioni ha l'entità in mano, quello che le disegna vuote la legge
   * dalla variabile del guscio. L'entita' viene dalla configurazione: si
   * scrive come testo, passando da cdEsc. */
  assert.match(fonte, /\$\{cdEsc\(entityId\)\}<\/code>/);
  assert.match(
    fonte,
    /\$\{cdEsc\(currentWeatherEntity \|\| ""\)\}<\/code>|\$\{cdEsc\(currentWeatherEntity \|\| ''\)\}<\/code>/,
  );
});

test("la tabella del vendor la rifà identica, o il prossimo aggiornamento la perde", async () => {
  const script = await ricetta();
  assert.match(script, /"weather-no-forecast-entity"/);
  assert.match(script, /"weather-no-forecast-empty"/);
  /* La cosa che conta: quello che la tabella scrive è esattamente quello che
   * il guscio ha adesso. Se qualcuno corregge il guscio a mano e si dimentica
   * la tabella, il prossimo vendor riporta la riga rossa — e questa prova
   * diventa rossa prima. */
  const fonte = await guscio("it");
  const scritte = [...script.matchAll(/"""([\s\S]*?)"""/g)].map(([, dentro]) => dentro);
  const nostre = scritte.filter((pezzo) => pezzo.includes("Questa entità meteo"));
  assert.equal(nostre.length, 2, `nella tabella ci sono ${nostre.length} testi nuovi invece di 2`);
  for (const pezzo of nostre) {
    assert.ok(fonte.includes(pezzo), "la tabella scrive un testo che nel guscio non c'è");
  }
});
