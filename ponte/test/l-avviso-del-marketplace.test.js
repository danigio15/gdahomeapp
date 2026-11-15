/* L'avviso del Marketplace, accettato anche per GdAHome: da una persona.
 *
 * «Dalla pagina Aggiornamenti dell'app Power Flow Card Plus non si
 * installa.» Da Home Assistant 2026.11 `update.install` guarda che l'avviso
 * l'abbia accettato l'utente che chiama, e dall'app chiama il ponte. Qui una
 * Home Assistant finta fa come la vera: `marketplace/info` dice
 * `warning_accepted` per chi chiede, `marketplace/warning/accept` lo salva, e
 * `update.install` rifiuta finche' l'utente del ponte non ha accettato.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Aggiornamenti } from "../src/aggiornamenti.js";
import { RispostaNegativa } from "../src/casa.js";
import { Commissioni } from "../src/commissioni.js";
import { perche } from "../src/dogana.js";
import {
  AvvisoDelMarketplace,
  LA_PAGINA_UFFICIALE,
  ilTestoDellAvviso,
} from "../src/l-avviso-del-marketplace.js";

const CHI_DI_PROVA = "c0ffee00c0ffee00c0ffee00c0ffee00";
const QUELLA_VERA =
  "Open the Marketplace and read the warning first, installing and updating work once it is accepted.";
const LA_SCHEDA = {
  entity_id: "update.power_flow_card_plus_update",
  state: "on",
  attributes: {
    supported_features: 1,
    title: "Power Flow Card Plus",
    installed_version: "v0.6.2-beta.1",
    latest_version: "v0.6.2-beta.2",
  },
};

function unRegistro() {
  const righe = [];
  return {
    righe,
    info: (riga) => righe.push(riga),
    attenzione: (riga) => righe.push(riga),
    errore: (riga) => righe.push(riga),
  };
}

/* La Home Assistant finta: l'utente del ponte (il Supervisor) e' uno solo, e
 * la sua accettazione sta in `accettato`. */
function casaFinta({ conIlMarketplace = true } = {}) {
  const stato = { accettato: false, chieste: [] };
  stato.chiedi = async (comando) => {
    stato.chieste.push(comando);
    if (comando.type === "get_states") return [LA_SCHEDA];
    if (comando.type.startsWith("marketplace/") && !conIlMarketplace)
      throw new RispostaNegativa("unknown_command", "Unknown command.");
    if (comando.type === "marketplace/info")
      return { stage: "running", version: "2026.11.0", warning_accepted: stato.accettato };
    if (comando.type === "marketplace/warning/accept") {
      stato.accettato = true;
      return null;
    }
    if (comando.type === "call_service" && comando.service === "install") {
      if (!stato.accettato) {
        const no = new RispostaNegativa("home_assistant_error", QUELLA_VERA);
        no.chiave = "warning_not_accepted";
        throw no;
      }
      return null;
    }
    return null;
  };
  return stato;
}

function commissioniPer(casa, registro = unRegistro()) {
  return new Commissioni({
    casa,
    registro,
    aggiornamenti: new Aggiornamenti({ casa, registro }),
    utenti: { elenco: async () => [{ id: CHI_DI_PROVA, nome: "Daniele", amministratore: true }] },
  });
}

const DA_CHI_AMMINISTRA = { chiChiede: CHI_DI_PROVA, puoAmministrare: true, dalTelefono: true };
const installa = { id: 1, type: "ponte/aggiornamenti/installa", entity_id: LA_SCHEDA.entity_id };

test("il testo dell'avviso: l'originale di Home Assistant, e l'italiano fedele", () => {
  const en = ilTestoDellAvviso("en");
  assert.equal(en.titolo, "Before you install from the Marketplace");
  assert.equal(en.rischi.length, 4);
  assert.equal(en.attenzione.length, 3);
  const it = ilTestoDellAvviso("it");
  assert.equal(it.titolo, "Prima di installare dal Marketplace");
  assert.equal(it.rischi.length, en.rischi.length);
  assert.equal(it.attenzione.length, en.attenzione.length);
  assert.match(
    LA_PAGINA_UFFICIALE,
    /^https:\/\/www\.home-assistant\.io\/integrations\/marketplace$/,
  );
});

test("dall'app: il no, l'avviso letto, il consenso, e poi l'installazione passa", async () => {
  const casa = casaFinta();
  const registro = unRegistro();
  const commissioni = commissioniPer(casa, registro);

  /* 1. Il no del Marketplace arriva con la sua chiave, per l'app. */
  const primo = await commissioni.rispondi(installa, DA_CHI_AMMINISTRA);
  assert.equal(primo.success, false);
  assert.equal(primo.error.translation_key, "warning_not_accepted");
  assert.match(primo.error.message, /accettarlo per GdAHome/);

  /* 2. L'avviso si legge: non accettato, col testo. Nessun consenso dato. */
  const avviso = await commissioni.rispondi(
    { id: 2, type: "ponte/marketplace/avviso", lingua: "it" },
    DA_CHI_AMMINISTRA,
  );
  assert.equal(avviso.success, true);
  assert.equal(avviso.result.disponibile, true);
  assert.equal(avviso.result.accettato, false);
  assert.equal(avviso.result.testo.titolo, "Prima di installare dal Marketplace");
  assert.equal(avviso.result.pagina, LA_PAGINA_UFFICIALE);
  assert.equal(
    casa.chieste.some((una) => una.type === "marketplace/warning/accept"),
    false,
  );

  /* 3. Senza «ho letto» non si accetta niente. */
  const senza = await commissioni.rispondi(
    { id: 3, type: "ponte/marketplace/accetta" },
    DA_CHI_AMMINISTRA,
  );
  assert.equal(senza.success, false);
  assert.equal(senza.error.code, "serve_il_consenso");
  const conUnFalso = await commissioni.rispondi(
    { id: 4, type: "ponte/marketplace/accetta", ho_letto: "true" },
    DA_CHI_AMMINISTRA,
  );
  assert.equal(conUnFalso.error.code, "serve_il_consenso");
  assert.equal(casa.accettato, false);

  /* 4. La persona ha letto e preme il tasto. */
  const si = await commissioni.rispondi(
    { id: 5, type: "ponte/marketplace/accetta", ho_letto: true },
    DA_CHI_AMMINISTRA,
  );
  assert.equal(si.success, true);
  assert.equal(si.result.accettato, true);
  assert.equal(casa.chieste.filter((una) => una.type === "marketplace/warning/accept").length, 1);
  /* Nel registro: chi, da dove, quando. */
  const riga = registro.righe.find((una) => /avviso del Marketplace accettato/.test(una));
  assert.ok(riga, registro.righe.join("\n"));
  assert.match(riga, /Daniele \(c0ffee00/);
  assert.match(riga, /dall'app/);
  assert.match(riga, /\d{4}-\d\d-\d\dT\d\d:\d\d/);

  /* 5. E adesso l'installazione dall'app passa. */
  const dopo = await commissioni.rispondi({ ...installa, id: 6 }, DA_CHI_AMMINISTRA);
  assert.equal(dopo.success, true, JSON.stringify(dopo));
  assert.equal(dopo.result.avviato, true);
});

test("installare non accetta l'avviso da solo, nemmeno riprovando", async () => {
  const casa = casaFinta();
  const commissioni = commissioniPer(casa);
  for (let volta = 0; volta < 3; volta += 1) {
    const detto = await commissioni.rispondi({ ...installa, id: volta }, DA_CHI_AMMINISTRA);
    assert.equal(detto.success, false);
  }
  await commissioni.rispondi({ id: 9, type: "ponte/marketplace/avviso" }, DA_CHI_AMMINISTRA);
  assert.equal(
    casa.chieste.some((una) => una.type === "marketplace/warning/accept"),
    false,
  );
  assert.equal(casa.accettato, false);
});

test("chi non amministra non legge e non accetta", async () => {
  const casa = casaFinta();
  const commissioni = commissioniPer(casa);
  for (const detto of [
    { id: 1, type: "ponte/marketplace/avviso" },
    { id: 2, type: "ponte/marketplace/accetta", ho_letto: true },
  ]) {
    const risposta = await commissioni.rispondi(detto, {
      chiChiede: CHI_DI_PROVA,
      puoAmministrare: false,
    });
    assert.equal(risposta.success, false);
    assert.equal(risposta.error.code, "unauthorized");
  }
  assert.equal(casa.chieste.length, 0);
});

test("dalla plancia nel registro c'e' scritto plancia", async () => {
  const casa = casaFinta();
  const registro = unRegistro();
  const commissioni = commissioniPer(casa, registro);
  const si = await commissioni.rispondi(
    { id: 1, type: "ponte/marketplace/accetta", ho_letto: true },
    { chiChiede: CHI_DI_PROVA, puoAmministrare: true },
  );
  assert.equal(si.success, true);
  assert.ok(registro.righe.some((una) => /dalla plancia/.test(una)));
});

test("una casa senza Marketplace lo dice, e non con «non conosco»", async () => {
  const casa = casaFinta({ conIlMarketplace: false });
  const commissioni = commissioniPer(casa);
  const avviso = await commissioni.rispondi(
    { id: 1, type: "ponte/marketplace/avviso" },
    DA_CHI_AMMINISTRA,
  );
  assert.equal(avviso.success, true);
  assert.equal(avviso.result.disponibile, false);
  const accetta = await commissioni.rispondi(
    { id: 2, type: "ponte/marketplace/accetta", ho_letto: true },
    DA_CHI_AMMINISTRA,
  );
  assert.equal(accetta.success, false);
  assert.equal(accetta.error.code, "marketplace_assente");
});

test("l'avviso da solo: accetta solo con hoLetto vero", async () => {
  const casa = casaFinta();
  const avviso = new AvvisoDelMarketplace({ casa, registro: unRegistro(), adesso: () => 0 });
  await assert.rejects(() => avviso.accetta({}), { code: "serve_il_consenso" });
  await assert.rejects(() => avviso.accetta({ hoLetto: 1 }), { code: "serve_il_consenso" });
  assert.equal(casa.accettato, false);
  const fatto = await avviso.accetta({ hoLetto: true, chi: "x" });
  assert.deepEqual(fatto, { accettato: true, quando: "1970-01-01T00:00:00.000Z" });
});

test("la dogana: i comandi del Marketplace non passano dalla pagina ne' dal telefono", () => {
  for (const detto of [
    { type: "marketplace/warning/accept" },
    { type: "Marketplace/Warning/Accept".toLowerCase() },
    { type: " marketplace/warning/accept " },
    { type: "marketplace/info" },
    { type: "marketplace/repository/install", repository: "123" },
    { type: "marketplace/repositories/add", repository: "qualcuno/qualcosa" },
  ]) {
    assert.ok(perche(detto, { amministra: true }), JSON.stringify(detto));
    assert.ok(perche(detto, { amministra: false }), JSON.stringify(detto));
  }
  /* Gli aggiornamenti restano: sono un servizio, `update.install`. */
  assert.equal(
    perche(
      {
        type: "call_service",
        domain: "update",
        service: "install",
        service_data: { entity_id: LA_SCHEDA.entity_id },
      },
      { amministra: true },
    ),
    null,
  );
});
