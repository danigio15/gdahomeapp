/* La Salute dal telefono: l'app legge Apple Salute o Health Connect e il
 * ponte scrive i sensori. Solo telefoni intestati, ognuno le sue, nulla nel
 * registro, spegnere e' togliere. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  IlCorpoDalTelefono,
  SALUTE_MISURE,
  SALUTE_SPEGNI,
  SALUTE_STATO,
  misurePulite,
  radiceDelTelefono,
} from "../src/il-corpo-dal-telefono.js";

const ADESSO = Date.parse("2026-10-29T10:00:00Z");

function prepara({ telefoni = ["tel-marco", "tel-giulia"] } = {}) {
  const chiamate = [];
  const righe = [];
  const casa = {
    async api(metodo, percorso, corpo) {
      chiamate.push({ metodo, percorso, corpo });
      return {};
    },
  };
  const registro = {
    info: (r) => righe.push(r),
    attenzione: (r) => righe.push(r),
    errore: (r) => righe.push(r),
  };
  const dispositivi = { elenco: () => telefoni.map((id) => ({ id })) };
  const cartella = mkdtempSync(join(tmpdir(), "corpo-"));
  const corpo = new IlCorpoDalTelefono({
    cartella,
    casa,
    dispositivi,
    registro,
    adesso: () => ADESSO,
  });
  return { corpo, chiamate, righe, cartella };
}

const MARCO = { id: "tel-marco", utente: "marco", proprietario: "Marco" };
const MISURE = {
  passi: { valore: 7842, quando: "2026-10-29T09:40:00Z" },
  battito: { valore: 72, quando: "2026-10-29T09:38:00Z" },
  peso: { valore: 78.4, quando: "2026-10-28T07:05:00Z" },
  sonno: { valore: 452, quando: "2026-10-29T06:30:00Z" },
  sistolica: { valore: 124, quando: "2026-10-28T20:10:00Z" },
  diastolica: { valore: 81, quando: "2026-10-28T20:10:00Z" },
};

test("le misure di un telefono intestato diventano sensori col nome della persona", async () => {
  const { corpo, chiamate, righe, cartella } = prepara();
  const r = await corpo.rispondi(
    { id: 1, type: SALUTE_MISURE, persona: "Marco", misure: MISURE },
    { dispositivo: MARCO },
  );
  assert.equal(r.success, true);
  assert.deepEqual(r.result.scritte.sort(), Object.keys(MISURE).sort());
  const radice = radiceDelTelefono("tel-marco");
  const passi = chiamate.find((c) => c.percorso === `states/sensor.${radice}_passi`);
  assert.equal(passi.metodo, "POST");
  assert.equal(passi.corpo.state, "7842");
  assert.equal(passi.corpo.attributes.friendly_name, "Marco Steps");
  assert.equal(passi.corpo.attributes.state_class, "total_increasing");
  assert.equal(passi.corpo.attributes.misurato_il, "2026-10-29T09:40:00.000Z");
  const peso = chiamate.find((c) => c.percorso === `states/sensor.${radice}_peso`);
  assert.equal(peso.corpo.attributes.device_class, "weight");
  assert.equal(peso.corpo.attributes.unit_of_measurement, "kg");
  /* Nel registro: quante, mai cosa ne' di chi. */
  assert.deepEqual(righe, ["salute: arrivate 6 misure da un telefono"]);
  assert.ok(!righe.join(" ").includes("Marco") && !righe.join(" ").includes("7842"));
  /* Il file lo legge solo il ponte. */
  assert.equal(statSync(join(cartella, "il-corpo.json")).mode & 0o777, 0o600);
  assert.ok(readFileSync(join(cartella, "il-corpo.json"), "utf8").includes("tel-marco"));
});

test("un telefono senza utente, o senza filo, non scrive niente", async () => {
  const { corpo, chiamate } = prepara();
  for (const dispositivo of [null, { id: "tel-x", utente: "" }, { id: "", utente: "marco" }]) {
    const r = await corpo.rispondi({ id: 2, type: SALUTE_MISURE, misure: MISURE }, { dispositivo });
    assert.equal(r.success, false);
    assert.equal(r.error.code, "unauthorized");
  }
  assert.equal(chiamate.length, 0);
});

test("ognuno le sue: Giulia non tocca i sensori di Marco", async () => {
  const { corpo, chiamate } = prepara();
  await corpo.rispondi(
    { id: 1, type: SALUTE_MISURE, persona: "Marco", misure: MISURE },
    { dispositivo: MARCO },
  );
  chiamate.length = 0;
  const giulia = { id: "tel-giulia", utente: "giulia" };
  await corpo.rispondi({ id: 2, type: SALUTE_SPEGNI }, { dispositivo: giulia });
  assert.equal(chiamate.length, 0);
  const stato = await corpo.rispondi({ id: 3, type: SALUTE_STATO }, { dispositivo: giulia });
  assert.deepEqual(stato.result, {
    acceso: false,
    premium: true,
    persona: "",
    misure: [],
    aggiornato: 0,
  });
  const mio = await corpo.rispondi({ id: 4, type: SALUTE_STATO }, { dispositivo: MARCO });
  assert.equal(mio.result.acceso, true);
  assert.equal(mio.result.persona, "Marco");
});

test("valori fuori misura, del futuro o vecchi si buttano", () => {
  const pulite = misurePulite(
    {
      passi: { valore: -3, quando: ADESSO },
      battito: { valore: 900, quando: ADESSO },
      peso: { valore: 70, quando: ADESSO + 86_400_000 },
      sonno: { valore: 400, quando: ADESSO - 90 * 86_400_000 },
      ossigeno: { valore: "97", quando: ADESSO },
      inventata: { valore: 1, quando: ADESSO },
    },
    ADESSO,
  );
  assert.deepEqual(Object.keys(pulite), ["ossigeno"]);
});

test("spegnere cancella i sensori da Home Assistant e le misure dal disco", async () => {
  const { corpo, chiamate } = prepara();
  await corpo.rispondi({ id: 1, type: SALUTE_MISURE, misure: MISURE }, { dispositivo: MARCO });
  chiamate.length = 0;
  const r = await corpo.rispondi({ id: 2, type: SALUTE_SPEGNI }, { dispositivo: MARCO });
  assert.equal(r.result.spento, true);
  assert.ok(chiamate.length > 0 && chiamate.every((c) => c.metodo === "DELETE"));
  assert.deepEqual(corpo.telefoni, {});
});

test("una misura tolta dalle scelte sparisce; senza nome si usa il proprietario", async () => {
  const { corpo, chiamate } = prepara();
  await corpo.rispondi({ id: 1, type: SALUTE_MISURE, misure: MISURE }, { dispositivo: MARCO });
  chiamate.length = 0;
  const { sonno, ...senzaSonno } = MISURE;
  await corpo.rispondi({ id: 2, type: SALUTE_MISURE, misure: senzaSonno }, { dispositivo: MARCO });
  const radice = radiceDelTelefono("tel-marco");
  assert.ok(
    chiamate.some((c) => c.metodo === "DELETE" && c.percorso === `states/sensor.${radice}_sonno`),
  );
  assert.equal(
    chiamate.find((c) => c.metodo === "POST").corpo.attributes.friendly_name.split(" ")[0],
    "Marco",
  );
});

test("il giro dei dieci minuti riscrive, e chi non e' piu' della casa perde le sue misure", async () => {
  const { corpo, chiamate } = prepara({ telefoni: ["tel-marco"] });
  await corpo.rispondi({ id: 1, type: SALUTE_MISURE, misure: MISURE }, { dispositivo: MARCO });
  await corpo.rispondi(
    { id: 2, type: SALUTE_MISURE, misure: MISURE },
    { dispositivo: { id: "tel-vecchio", utente: "ospite" } },
  );
  chiamate.length = 0;
  await corpo.rimettiGliStati();
  const vecchio = radiceDelTelefono("tel-vecchio");
  assert.ok(chiamate.some((c) => c.metodo === "DELETE" && c.percorso.includes(vecchio)));
  assert.ok(
    chiamate.some(
      (c) => c.metodo === "POST" && c.percorso.includes(radiceDelTelefono("tel-marco")),
    ),
  );
  assert.deepEqual(Object.keys(corpo.telefoni), ["tel-marco"]);
});

test("e' di GdAHome Premium: senza, niente misure; spegnere si puo' sempre", async () => {
  const { corpo, chiamate } = prepara();
  await corpo.rispondi({ id: 1, type: SALUTE_MISURE, misure: MISURE }, { dispositivo: MARCO });
  corpo.licenze = { attive: true, premium: false };
  chiamate.length = 0;
  const r = await corpo.rispondi(
    { id: 2, type: SALUTE_MISURE, misure: MISURE },
    { dispositivo: MARCO },
  );
  assert.equal(r.success, false);
  assert.equal(r.error.code, "premium-richiesto");
  /* Il giro dei dieci minuti non riscrive. */
  await corpo.rimettiGliStati();
  assert.equal(chiamate.length, 0);
  const stato = await corpo.rispondi({ id: 3, type: SALUTE_STATO }, { dispositivo: MARCO });
  assert.equal(stato.result.premium, false);
  const spento = await corpo.rispondi({ id: 4, type: SALUTE_SPEGNI }, { dispositivo: MARCO });
  assert.equal(spento.result.spento, true);
  assert.ok(chiamate.length > 0 && chiamate.every((c) => c.metodo === "DELETE"));
  /* Col Premium attivo si scrive di nuovo. */
  corpo.licenze = { attive: true, premium: true };
  const ok = await corpo.rispondi(
    { id: 5, type: SALUTE_MISURE, misure: MISURE },
    { dispositivo: MARCO },
  );
  assert.equal(ok.success, true);
});
