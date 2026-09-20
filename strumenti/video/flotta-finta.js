/* La flotta finta: quindici impianti, per fotografare il quadro vero.
 *
 * E' il gemello di `casa-finta.js`. Quello inventa **una casa** perche' la
 * plancia abbia qualcosa da mostrare; questo inventa **le case di un
 * installatore** perche' il quadro abbia qualcosa da guardare. In tutti e due
 * i casi la pagina fotografata e' quella vera — qui `quadro/console/` — e
 * l'unica cosa finta e' quello che ci scorre dentro.
 *
 * Nessuna di queste righe e' un pezzo del prodotto, e non deve diventarlo: il
 * cruscotto vero riceve questi numeri da `ponte/src/rapporto.js`, uno al
 * minuto (`quadro_ogni`, di serie 1), da case vere.
 *
 * **I numeri sono quelli che il rapporto manda davvero**, con i nomi che hanno
 * la' dentro: cambiarne uno qui per far venire meglio una fotografia
 * vorrebbe dire fotografare un quadro che non esiste. I nomi delle case
 * invece sono inventati — quelli veri sono clienti di qualcuno.
 *
 * Gli stati sono tre, e ci sono tutti e tre apposta: una fotografia di
 * quindici case tutte verdi non fa vedere a cosa serve il quadro.
 */

/** Le versioni del momento: quelle che una casa aggiornata ha addosso. */
const OGGI = {
  ponte: "1.5.9",
  plancia: "1.5.9",
  ha: "2026.9.1",
  supervisor: "2026.08.3",
  sistema: "Home Assistant OS 14.2",
};

/* Gli add-on che si trovano in una casa qualunque: quelli di Home Assistant
   piu' il nostro. I nomi sono nomi di prodotti — e' quello che il rapporto
   manda, e non dice niente di chi ci abita. */
const ADDON = [
  "gdahome",
  "Mosquitto broker",
  "File editor",
  "Terminal & SSH",
  "Samba share",
  "Z-Wave JS",
  "ESPHome",
  "Zigbee2MQTT",
];

const gliAddon = ({ quanti = 8, fermi = 0, spentiAMano = 0 } = {}) => {
  const elenco = ADDON.slice(0, quanti).map((nome) => ({
    nome,
    su: true,
    allAvvio: true,
    aggiornabile: false,
  }));
  /* Chi si e' fermato da solo si prende dal fondo: il primo della fila e'
     `gdahome`, e un rapporto arriva proprio perche' quello gira. */
  for (let i = 0; i < fermi; i += 1) {
    const uno = elenco[elenco.length - 1 - i];
    if (uno) Object.assign(uno, { su: false, allAvvio: true });
  }
  for (let i = 0; i < spentiAMano; i += 1) {
    const uno = elenco[elenco.length - 1 - fermi - i];
    if (uno) Object.assign(uno, { su: false, allAvvio: false });
  }
  return {
    quanti: elenco.length,
    accesi: elenco.filter((uno) => uno.su).length,
    spentiCheDovrebbero: fermi,
    elenco,
  };
};

const laRete = ({
  internet = true,
  wifi = false,
  segnale = null,
  sorvegliate = 3,
  giu = 0,
} = {}) => ({
  internet,
  schede: [
    {
      nome: "eth0",
      tipo: "ethernet",
      su: !wifi,
      principale: !wifi,
      ip: wifi ? "" : "192.168.1.50",
    },
    {
      nome: "wlan0",
      tipo: "wifi",
      su: wifi,
      principale: wifi,
      ip: wifi ? "192.168.1.77" : "",
      segnale: wifi ? segnale : null,
    },
  ],
  sorvegliate: { quante: sorvegliate, giu },
});

/* Un aggiornamento in attesa, come lo manda il ponte: nome e salto di
   versione, **mai l'entita'** — `update.camera_di_marco_termostato` direbbe
   chi abita in quella casa e in quale stanza. */
const aggiornamento = (nome, da, a, come = {}) => ({
  nome,
  da,
  a,
  nostra: come.nostra === true,
  installabile: come.installabile !== false,
  stacca: come.stacca === true,
  marchio: come.marchio ?? "",
  cosaCambia: come.cosaCambia ?? "",
  note: "",
});

const iConti = (elenco) => ({
  quanti: elenco.length,
  ha: elenco.some((uno) => /home.?assistant/i.test(uno.nome)),
  gdahome: elenco.some((uno) => uno.nostra),
  addon: elenco.filter(
    (uno) => uno.installabile && !uno.nostra && !/home.?assistant/i.test(uno.nome),
  ).length,
  firmware: elenco.filter((uno) => !uno.installabile).length,
  elenco,
});

/**
 * Una casa, con i suoi numeri.
 *
 * Quello che non si dice qui si mette da se' sui valori di una casa in ordine:
 * scrivere quindici volte gli stessi dodici campi vorrebbe dire quindici
 * posti in cui sbagliarne uno.
 */
const casa = (nome, matricola, come = {}) => ({
  nome,
  matricola,
  /* Da quanti giorni e' installata. Serve alla striscia: un giorno in cui
     questa casa non esisteva non si giudica. */
  da: come.da ?? 120,
  /* Da quanti minuti non parla. Sopra i tre rapporti saltati la casa e' offline —
     e quello che si legge nella sua scheda e' vecchio di altrettanto. */
  taceDa: come.taceDa ?? 0,
  /* I buchi nella striscia dei quattordici giorni: quanti giorni fa, e quanto
     grossi. `1` giorno intero muto, `0.4` una mattinata. */
  buchi: come.buchi ?? [],
  rapporto: {
    ogni: 1,
    ...OGGI,
    ...(come.versioni ?? {}),
    /* Il secondo interruttore, e sta a chi ci abita: di serie e' spento, e
       nelle case di questa flotta lo e' quasi sempre. */
    manutenzione: come.manutenzione === true,
    macchina: {
      scheda: "ODROID-N2+",
      cpu: 12,
      ram: 38,
      disco: 46,
      discoLiberi: 17.2,
      temperatura: 46,
      discoVita: 11,
      accesaDa: 41,
      ...(come.macchina ?? {}),
    },
    rete: laRete(come.rete),
    addon: gliAddon(come.addon),
    aggiornamenti: iConti(come.aggiornamenti ?? []),
    plance: { quante: 3, configurate: 3, ...(come.plance ?? {}) },
    telefoni: { abbinati: 2, visti7gg: 2, ...(come.telefoni ?? {}) },
    fuori: { acceso: true, filo: true, daGiorni: 41, ...(come.fuori ?? {}) },
    entita: {
      totali: 214,
      giu: 0,
      dispositivi: 0,
      nomi: [],
      ...(come.entita ?? {}),
    },
    batterie: { scariche: 0, piuBassa: 62, ...(come.batterie ?? {}) },
    backup: { giorniFa: 2, ...(come.backup ?? {}) },
    registro: { errori24h: 0, ...(come.registro ?? {}) },
  },
});

/* ── La flotta ─────────────────────────────────────────────────────────────
 *
 * Quindici case: una offline, tre da guardare, undici a posto. E' la
 * proporzione di una giornata normale — se fossero meta' rosse, la fotografia
 * racconterebbe un installatore che ha sbagliato mestiere.
 */
export const FLOTTA = [
  /* Quella che si apre nella fotografia: ha addosso, insieme, le tre cose che
     il quadro sa dire e un cruscotto dentro casa non direbbe — tre dispositivi
     che non rispondono con i loro nomi, due aggiornamenti col salto di
     versione, e un disco a meta' vita. */
  casa("Bianchi — via Po 4", "casa_a3f19c74e05b2d8890fa4c1e6b73d052", {
    da: 412,
    buchi: [{ giorniFa: 6, quanto: 0.35 }],
    manutenzione: true,
    versioni: { ha: "2026.8.4", supervisor: "2026.08.3" },
    macchina: {
      scheda: "ODROID-N2+",
      cpu: 21,
      ram: 44,
      disco: 61,
      discoLiberi: 9.4,
      temperatura: 58,
      discoVita: 47,
      accesaDa: 96,
    },
    entita: {
      totali: 238,
      giu: 7,
      dispositivi: 3,
      nomi: ["Termostato bagno", "Presa garage", "Sensore porta cantina"],
    },
    batterie: { scariche: 0, piuBassa: 34 },
    backup: { giorniFa: 1 },
    aggiornamenti: [
      aggiornamento("Home Assistant Core", "2026.8.4", "2026.9.1", {
        stacca: true,
        cosaCambia: "Correzioni di sicurezza e la solita tornata di integrazioni.",
      }),
      aggiornamento("Zigbee2MQTT", "2.6.1", "2.7.0", {
        marchio: "zigbee2mqtt",
        cosaCambia: "Supporto a una manciata di dispositivi nuovi.",
      }),
    ],
  }),

  /* Quella offline: tace da tre giorni, e quello che si legge nella sua scheda e'
     vecchio di tre giorni. Il quadro lo dice con quelle parole. */
  casa("Palestra Tonic — Cologno", "casa_71cd3a6e884b09f25de4a1c7b3608e14", {
    da: 233,
    taceDa: 3 * 24 * 60,
    buchi: [
      { giorniFa: 0, quanto: 1 },
      { giorniFa: 1, quanto: 1 },
      { giorniFa: 2, quanto: 0.8 },
    ],
    macchina: {
      scheda: "ODROID-M1",
      cpu: 9,
      ram: 31,
      disco: 38,
      discoLiberi: 22.6,
      temperatura: 44,
      discoVita: 6,
      accesaDa: 12,
    },
    rete: { internet: true, sorvegliate: 2, giu: 0 },
  }),

  /* Un add-on che si e' fermato da solo. Nessuno spegne un add-on lasciandogli
     l'avvio automatico: quello li' si e' fermato. */
  casa("Conti — via Adige 9", "casa_5b8e01c7d94a2f6301be7c85a2d4f093", {
    da: 88,
    addon: { quanti: 7, fermi: 1 },
    batterie: { scariche: 2, piuBassa: 11 },
    backup: { giorniFa: 9 },
    macchina: {
      scheda: "NUC i3",
      cpu: 17,
      ram: 52,
      disco: 44,
      discoLiberi: 128.3,
      temperatura: 51,
      discoVita: null,
      accesaDa: 205,
    },
  }),

  /* La casa in cui il router non risponde: l'apparato sorvegliato giu' e' meta'
     delle telefonate, e qui si vede prima che squilli il telefono. */
  casa("Moretti — via Emilia 44", "casa_9d2c4b1f8073ae65c1f0942db35e78a1", {
    da: 61,
    rete: { internet: true, wifi: true, segnale: 38, sorvegliate: 4, giu: 1 },
    registro: { errori24h: 3 },
    macchina: {
      scheda: "Raspberry Pi 5",
      cpu: 34,
      ram: 61,
      disco: 71,
      discoLiberi: 6.1,
      temperatura: 64,
      discoVita: 72,
      accesaDa: 19,
    },
    telefoni: { abbinati: 1, visti7gg: 1 },
    /* Un firmware non si installa da se': nella flotta si vede contato, e
       senza tasto. Un tasto li' sarebbe una promessa che non si mantiene. */
    aggiornamenti: [
      aggiornamento("Shelly 1PM Gen3", "1.4.4", "1.5.0", {
        installabile: false,
        marchio: "shelly",
      }),
    ],
  }),

  /* Le undici in ordine. Cambiano le schede, i conti e le abitudini: undici
     righe identiche si vedono che sono finte. */
  casa("Rossi — via Verdi 12", "casa_2f7a91c3e5b84d0672ac1e93f4b5d806", { da: 520 }),
  casa("Villa Marta — Segrate", "casa_c41d7e6b09385af21d74be0c53917a82", { da: 140 }),
  casa("Studio Ferrari — Tortona", "casa_e07b35a9c1d24f6810bc93e7a5d20f4c", {
    da: 96,
    macchina: {
      scheda: "NUC i5",
      cpu: 8,
      ram: 29,
      disco: 33,
      discoLiberi: 201.4,
      temperatura: 42,
      discoVita: null,
      accesaDa: 74,
    },
    telefoni: { abbinati: 4, visti7gg: 3 },
    entita: { totali: 341, giu: 0, dispositivi: 0, nomi: [] },
  }),
  casa("B&B Le Ortensie", "casa_18ac5f0b2e97d34615c8fa0723be94d1", {
    da: 275,
    plance: { quante: 5, configurate: 5 },
    telefoni: { abbinati: 6, visti7gg: 5 },
    macchina: {
      scheda: "ODROID-N2+",
      cpu: 16,
      ram: 41,
      disco: 52,
      discoLiberi: 14.8,
      temperatura: 49,
      discoVita: 23,
      accesaDa: 63,
    },
    manutenzione: true,
    aggiornamenti: [
      aggiornamento("ESPHome", "2026.8.1", "2026.9.0", {
        marchio: "esphome",
        cosaCambia: "Due schede nuove e una correzione sul Wi-Fi.",
      }),
    ],
  }),
  casa("Gallo — via Mazzini 3", "casa_6e9042bd7c135af8021e6b4c93da57f0", {
    da: 47,
    buchi: [{ giorniFa: 9, quanto: 0.5 }],
  }),
  casa("Ufficio Neri — Lambrate", "casa_bd37096e4a1c852f0e7b3d1946ca82f5", {
    da: 310,
    macchina: {
      scheda: "NUC i7",
      cpu: 11,
      ram: 34,
      disco: 28,
      discoLiberi: 340.7,
      temperatura: 39,
      discoVita: null,
      accesaDa: 151,
    },
    plance: { quante: 2, configurate: 2 },
    /* La manutenzione qui e' chiusa, e nella flotta si legge perche': non e'
       un guasto, e' una scelta di chi ci abita. */
    aggiornamenti: [aggiornamento("Samba share", "12.3.2", "12.4.0", { marchio: "samba" })],
  }),
  casa("Casa Marini — Brugherio", "casa_43fa8c7150e2b96d8f04c7a2e15b3069", { da: 173 }),
  casa("Lodi — via Trento 7", "casa_a7e35c0918fb246d503e9c1b7a84f2d6", {
    da: 29,
    macchina: {
      scheda: "ODROID-M1",
      cpu: 13,
      ram: 36,
      disco: 41,
      discoLiberi: 19.9,
      temperatura: 47,
      discoVita: 4,
      accesaDa: 29,
    },
    manutenzione: true,
    aggiornamenti: [aggiornamento("Z-Wave JS", "1.9.2", "1.10.0", { marchio: "zwavejs" })],
  }),
  casa("Ricci — via Manzoni 21", "casa_0c58d7b3e91a46f2708b5ce3419da62f", {
    da: 205,
    aggiornamenti: [aggiornamento("Mosquitto broker", "6.5.1", "6.6.0", { marchio: "mosquitto" })],
  }),
  casa("Sala — via Lecco 5", "casa_ef1294b07a3d8c6520bf4e17d9a3608b", { da: 66 }),
  casa("Greco — via Novara 2", "casa_7b4a0e3d5f19c286d0a47b3e6c159f82", {
    da: 12,
    telefoni: { abbinati: 3, visti7gg: 3 },
    macchina: {
      scheda: "ODROID-N2+",
      cpu: 10,
      ram: 33,
      disco: 22,
      discoLiberi: 24.1,
      temperatura: 43,
      discoVita: 2,
      accesaDa: 12,
    },
  }),
];

/* I codici generati e non ancora incollati: vivono un giorno, e nella pagina
   «Abbina» si vedono in attesa. Contano come impianti, se no venti codici in
   un minuto sono venti case oltre il limite il giorno dopo. */
export const INVITI = ["Dotti — via Como 8", "cantiere Ferraris"];

/** L'installatore di cui si fotografa il quadro. */
export const INSTALLATORE = { nome: "Impianti Rossi", soglia: 40 };
