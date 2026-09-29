/* «Ora le telecamere se vado nel dettaglio si vedono regolarmente ma nella
 * sezione Sicurezza dove c'è l'anteprima non si visualizzano» (#164).
 *
 * La 1.8.0 aveva insegnato al popup ad aspettare le capacità di Home Assistant
 * e a scegliere il WebRTC. Il muro della Sicurezza pero' al video ci andava
 * solo per le telecamere messe «dal vivo»: tutte le altre vivevano di
 * istantanee. Una Ring `…_live_view` un'istantanea non la da': il proxy
 * risponde con un errore, e la tessera restava su «in attesa del fotogramma»
 * per sempre, riprovando la stessa foto ogni quattro secondi.
 *
 * Adesso, quando la foto non arriva, la tessera prova la strada che Home
 * Assistant dichiara — muta, come la live della tessera.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [{ id: "c1", name: "Seminterrato", entity: "camera.cam_seminterrato_live_view" }],
    appliances: [],
    loads: [],
    climate: [],
    ev: [],
    covers: [],
    lights: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
  },
  visibility: { security: true },
};

test("una telecamera senza istantanea prova il video anche nel muro", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  /* La Ring: il proxy dei fotogrammi non ha niente da dare. */
  await page.route("**/api/camera_proxy/**", (route) => route.fulfill({ status: 500, body: "" }));

  /* Un ponte finto che risponde come Home Assistant: la telecamera sa solo il
   * WebRTC. Si segna tutto quello che gli viene chiesto. */
  await page.addInitScript(() => {
    window.__DOMANDE__ = [];
    class PonteFinto extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(grezzo) {
        const messaggio = JSON.parse(grezzo);
        if (messaggio.type === "auth") return;
        window.__DOMANDE__.push(messaggio.type);
        let risultato = null;
        if (messaggio.type === "get_states") risultato = [];
        else if (messaggio.type === "frontend/get_user_data") risultato = { value: null };
        else if (messaggio.type === "camera/capabilities")
          risultato = { frontend_stream_types: ["web_rtc"] };
        else if (messaggio.type === "camera/webrtc/get_client_config")
          risultato = { configuration: { iceServers: [] } };
        else if (messaggio.type === "call_service") risultato = {};
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({
              id: messaggio.id,
              type: "result",
              success: true,
              result: risultato,
            }),
          }),
        );
      }
      close() {
        this.readyState = 3;
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
    window.WebSocket = PonteFinto;
  });

  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60_000,
  });
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    stati["camera.cam_seminterrato_live_view"] = {
      entity_id: "camera.cam_seminterrato_live_view",
      state: "idle",
      attributes: {
        friendly_name: "Seminterrato",
        supported_features: 2,
        entity_picture: "/api/camera_proxy/camera.cam_seminterrato_live_view?token=prova",
      },
    };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-security")?.classList.add("active");
    window.renderSecurity?.();
  });

  const tessera = page.locator("#cam-grid .dm-cam img").first();
  await expect(tessera).toHaveCount(1, { timeout: 20_000 });

  /* Il muro chiede i fotogrammi, la foto cade, e allora la tessera prova il
   * video: parte l'offerta WebRTC, la stessa che fa il popup. Col codice di
   * prima si riprovava la foto per sempre e l'offerta non partiva mai. */
  await expect
    .poll(
      async () => {
        await page.evaluate(() => window.refreshCameras?.());
        return page.evaluate(() =>
          window.__DOMANDE__.some((tipo) => /^camera\/(webrtc\/offer|web_rtc_offer)$/.test(tipo)),
        );
      },
      { timeout: 45_000, intervals: [1_000, 2_000, 4_000] },
    )
    .toBe(true);
});
