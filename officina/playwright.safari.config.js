/* Le prove della testata sul motore di Safari, a misura di iPhone e di iPad.
 *
 * «Se vado su Luci e Porte sparisce la parte sopra», solo su iPhone e iPad:
 * Chromium non lo fa, e le prove di tutti i giorni girano li'. Questo giro
 * prende solo le prove della testata e le fa girare su WebKit, coi due
 * apparecchi su cui e' stato visto. Lo lancia «La testata su Safari». */
import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config.js";

export default defineConfig({
  ...base,
  retries: 0,
  testMatch: /la-testata-torna-da-luci-e-porte\.spec\.js/,
  projects: [
    { name: "webkit-iphone", timeout: 180_000, use: { ...devices["iPhone 14"] } },
    { name: "webkit-ipad", timeout: 180_000, use: { ...devices["iPad Pro 11"], browserName: "webkit" } },
  ],
});
