/* Il server Proxmox, per intero.
 *
 * Dal campo: «proxmox non lo aggiunge correttamente: o lo aggiungi come
 * macchina e mi fai vedere tutti i dati, o lo aggiungi come nodi e mi fai
 * vedere tutti i dati», e poi «mi devi far vedere più cose per il nodo
 * principale, anche aggiornamenti da fare».
 *
 * Le fasce delle macchine guardano un sensore per riga: acceso o spento. Per
 * Proxmox e' poco, e anche sbagliato: il nodo — la macchina vera — non
 * compariva, i container si, e accanto restavano le righe morte di
 * un'integrazione di prima («pve_cloudflared · non risponde»).
 *
 * Qui si legge il server come lo racconta l'integrazione Proxmox VE
 * (`proxmoxve`, anche quella di HACS che sostituisce quella di Home
 * Assistant): un DISPOSITIVO per nodo, uno per ogni VM e container, uno per
 * disco e per storage. Chi e' chi lo dice il nome che l'integrazione gli da'
 * — «Node pve», «QEMU homeassistant (100)», «LXC cloudflared (101)», «Disk
 * pve: …» — e il modello. Cosa dice ogni entita' lo dice la sua chiave di
 * traduzione (`cpu_used`, `memory_used_perc`, `updates_total`…), che non
 * cambia con la lingua e nemmeno se uno rinomina l'entita'.
 *
 * Il modello non chiede niente: riceve i dispositivi, le loro entita' e gli
 * stati, e restituisce i nodi con dentro tutto. Si prova a tavolino.
 */

export const DOMINIO_PROXMOX = "proxmoxve";

const clean = (valore) => String(valore ?? "").trim();
const MUTI = new Set(["unavailable", "unknown", "none", ""]);

const numero = (stato) => {
  const s = clean(stato?.state);
  if (MUTI.has(s.toLowerCase())) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Se il dispositivo e' di Proxmox. */
export function eProxmox(dispositivo) {
  const domini = Array.isArray(dispositivo?.integrations)
    ? dispositivo.integrations.map(clean)
    : [clean(dispositivo?.integration)];
  return domini.includes(DOMINIO_PROXMOX);
}

/* Le chiavi che l'integrazione da' alle entita' di un nodo: se ce n'e' una,
 * e' un nodo anche se qualcuno l'ha rinominato. */
const CHIAVI_DEL_NODO = new Set([
  "qemu_on",
  "lxc_on",
  "updates_total",
  "update_avail",
  "start_all",
]);

/**
 * Che cos'e' un dispositivo di Proxmox: `"nodo"`, `"qemu"`, `"lxc"`,
 * `"disco"`, `"storage"` o `""`.
 */
export function tipoDelDispositivo(dispositivo, entita = []) {
  const nome = clean(dispositivo?.name);
  const modello = clean(dispositivo?.model).toUpperCase();
  if (/^QEMU\s/i.test(nome) || modello === "QEMU") return "qemu";
  if (/^LXC\s/i.test(nome) || modello === "LXC") return "lxc";
  if (/^Disk\s/i.test(nome)) return "disco";
  if (modello === "STORAGE" || /^Storage\s/i.test(nome)) return "storage";
  if (/^ZFS\s/i.test(nome)) return "storage";
  if (/^Node\s/i.test(nome)) return "nodo";
  if ((entita || []).some((e) => CHIAVI_DEL_NODO.has(clean(e?.translation_key)))) return "nodo";
  return "";
}

/* Le entita' di un dispositivo per chiave di traduzione. Quando la chiave
 * manca (il sensore «Node» dei container non ce l'ha) si guarda come finisce
 * il suo nome d'oggetto. */
function perChiave(entita = []) {
  const mappa = new Map();
  for (const e of entita || []) {
    if (!e || e.disabled) continue;
    const id = clean(e.entity_id);
    if (!id.includes(".")) continue;
    const dominio = id.split(".")[0];
    let chiave = clean(e.translation_key);
    if (!chiave && /_node$/.test(id)) chiave = "node";
    if (!chiave) continue;
    /* La stessa chiave vale per un sensore e un pulsante («reboot»,
     * «shutdown»): si tiene distinta per dominio. */
    const k = dominio === "button" ? `tasto:${chiave}` : chiave;
    if (!mappa.has(k)) mappa.set(k, id);
  }
  return mappa;
}

/* Un valore letto, con la sua unita' come la dice Home Assistant. */
function lettura(mappa, chiave, states) {
  const id = mappa.get(chiave);
  if (!id) return null;
  const stato = states?.[id];
  if (!stato) return null;
  return {
    entity: id,
    valore: numero(stato),
    testo: clean(stato.state),
    unita: clean(stato.attributes?.unit_of_measurement),
    attributi: stato.attributes || {},
    muto: MUTI.has(clean(stato.state).toLowerCase()),
  };
}

const percento = (l) => (l && l.valore != null ? Math.max(0, Math.min(100, l.valore)) : null);

/* Acceso, spento o non risponde, da un `binary_sensor` di stato. */
function statoDi(l) {
  if (!l || l.muto) return "";
  return l.testo === "on" ? "su" : "giu";
}

/* Da quando e' acceso: l'integrazione da' l'ora dell'ultimo avvio. */
function avvioDi(l) {
  if (!l || l.muto) return "";
  const quando = Date.parse(l.testo);
  return Number.isFinite(quando) ? new Date(quando).toISOString() : "";
}

/* I tasti che ci sono davvero, e basta. */
function tasti(mappa, chiavi) {
  const fuori = {};
  for (const chiave of chiavi) {
    const id = mappa.get(`tasto:${chiave}`);
    if (id) fuori[chiave] = id;
  }
  return fuori;
}

/* L'elenco dei pacchetti da aggiornare: l'integrazione lo mette in un
 * attributo del conto, come testo o come elenco. */
function pacchettiDa(l) {
  const grezzo = l?.attributi?.updates_list;
  const elenco = Array.isArray(grezzo)
    ? grezzo
    : typeof grezzo === "string"
      ? grezzo.split(/[\n,]+/)
      : [];
  return elenco.map(clean).filter(Boolean).slice(0, 200);
}

function nomeDelNodo(dispositivo) {
  return clean(dispositivo?.name).replace(/^Node\s+/i, "") || clean(dispositivo?.name);
}

/* «QEMU homeassistant (100)» → {nome: "homeassistant", vmid: "100"}. */
function nomeDelGuest(dispositivo) {
  const nome = clean(dispositivo?.name);
  const m = /^(?:QEMU|LXC)\s+(.*?)\s*\((\d+)\)\s*$/i.exec(nome);
  if (m) return { nome: m[1], vmid: m[2] };
  return { nome: nome.replace(/^(?:QEMU|LXC)\s+/i, ""), vmid: "" };
}

/* «Disk pve: CT1000P3PSSD8» → nodo «pve», nome «CT1000P3PSSD8». */
function nomeDelDisco(dispositivo) {
  const nome = clean(dispositivo?.name);
  const m = /^Disk\s+([^:]+):\s*(.*)$/i.exec(nome);
  return m ? { nodo: m[1].trim(), nome: m[2].trim() } : { nodo: "", nome };
}

/**
 * Il server Proxmox: i nodi, ognuno con le sue VM, i suoi container, i suoi
 * dischi e i suoi storage.
 *
 * `dispositivi` sono quelli del catalogo; `entita` per ogni dispositivo le sue
 * righe (`entity_id`, `translation_key`); `states` gli stati di adesso. Un
 * dispositivo di cui non si sanno ancora le entita' entra lo stesso col nome,
 * e i numeri arrivano quando arrivano.
 */
export function serverProxmox({ dispositivi = [], entita = {}, states = {} } = {}) {
  const nodi = [];
  const guest = [];
  const dischi = [];
  const storage = [];
  for (const dispositivo of dispositivi || []) {
    if (!eProxmox(dispositivo) || dispositivo.disabled) continue;
    const sue = entita?.[clean(dispositivo.id)] || [];
    const tipo = tipoDelDispositivo(dispositivo, sue);
    const m = perChiave(sue);
    const l = (chiave) => lettura(m, chiave, states);
    const ids = sue.map((e) => clean(e?.entity_id)).filter(Boolean);
    if (tipo === "nodo") {
      const conto = l("updates_total");
      const ci = l("update_avail");
      const quanti = conto?.valore ?? null;
      nodi.push({
        id: clean(dispositivo.id),
        nome: nomeDelNodo(dispositivo),
        processore: clean(dispositivo.model),
        stato: statoDi(l("status")),
        cpu: percento(l("cpu_used")),
        memoria: {
          perc: percento(l("memory_used_perc")),
          usata: l("memory_used"),
          libera: l("memory_free"),
          totale: l("memory_total"),
        },
        disco: {
          perc: percento(l("disk_used_perc")),
          usato: l("disk_used"),
          totale: l("disk_total"),
        },
        swap: percento(l("swap_used_perc")),
        avvio: avvioDi(l("uptime")),
        vmAccese: l("qemu_on")?.valore ?? null,
        ctAccesi: l("lxc_on")?.valore ?? null,
        aggiornamenti: {
          quanti,
          ci: quanti != null ? quanti > 0 : ci ? ci.testo === "on" : null,
          pacchetti: pacchettiDa(conto),
        },
        tasti: tasti(m, ["start_all", "stop_all", "reboot", "shutdown"]),
        entita: ids,
        guest: [],
        dischi: [],
        storage: [],
      });
    } else if (tipo === "qemu" || tipo === "lxc") {
      const { nome, vmid } = nomeDelGuest(dispositivo);
      const salute = l("health");
      guest.push({
        id: clean(dispositivo.id),
        tipo,
        nome,
        vmid,
        nodo: clean(l("node")?.testo),
        stato: statoDi(l("status")),
        dettaglio: clean(l("status_raw")?.testo),
        problema: salute && !salute.muto ? salute.testo === "on" : false,
        cpu: percento(l("cpu_used")),
        memoria: { perc: percento(l("memory_used_perc")), usata: l("memory_used") },
        disco: { perc: percento(l("disk_used_perc")), usato: l("disk_used") },
        reteIn: l("network_in"),
        reteOut: l("network_out"),
        avvio: avvioDi(l("uptime")),
        tasti: tasti(m, ["start", "shutdown", "stop", "reboot"]),
        entita: ids,
      });
    } else if (tipo === "disco") {
      const { nodo, nome } = nomeDelDisco(dispositivo);
      const salute = l("health");
      dischi.push({
        id: clean(dispositivo.id),
        nodo,
        nome,
        modello: clean(dispositivo.model),
        /* «health» e' un sensore di problema: acceso vuol dire guasto. */
        sano: salute && !salute.muto ? salute.testo !== "on" : null,
        temperatura: l("temperature")?.valore ?? l("temperature_air")?.valore ?? null,
        vita:
          l("life_left")?.valore ??
          (l("disk_wearout")?.valore != null ? 100 - l("disk_wearout").valore : null),
        ore: l("power_hours")?.valore ?? null,
        entita: ids,
      });
    } else if (tipo === "storage") {
      storage.push({
        id: clean(dispositivo.id),
        nodo: clean(l("node")?.testo),
        nome: clean(dispositivo.name).replace(/^(Storage|ZFS)\s+/i, ""),
        perc: percento(l("disk_used_perc")) ?? percento(l("zfs_used_perc")),
        usato: l("disk_used") || l("zfs_used"),
        totale: l("disk_total") || l("zfs_total"),
        entita: ids,
      });
    }
  }
  nodi.sort((a, b) => a.nome.localeCompare(b.nome));
  /* Ognuno al suo nodo; chi non lo dice va al primo, che con un nodo solo
   * — il caso di quasi tutti — e' quello giusto. */
  const doveVa = (nome) => nodi.find((n) => n.nome === nome) || nodi[0];
  for (const g of guest) doveVa(g.nodo)?.guest.push(g);
  for (const d of dischi) doveVa(d.nodo)?.dischi.push(d);
  for (const s of storage) doveVa(s.nodo)?.storage.push(s);
  const peso = (g) => (g.stato === "su" ? 0 : g.stato === "giu" ? 1 : 2);
  for (const n of nodi) {
    n.guest.sort(
      (a, b) =>
        peso(a) - peso(b) ||
        Number(a.vmid || 0) - Number(b.vmid || 0) ||
        a.nome.localeCompare(b.nome),
    );
    n.dischi.sort((a, b) => a.nome.localeCompare(b.nome));
    n.storage.sort((a, b) => a.nome.localeCompare(b.nome));
  }
  /* Senza nodi — un'integrazione senza permessi sul nodo — le VM restano
   * comunque da qualche parte: in un nodo senza nome. */
  if (!nodi.length && guest.length)
    return {
      nodi: [
        {
          id: "",
          nome: "",
          processore: "",
          stato: "",
          cpu: null,
          memoria: { perc: null },
          disco: { perc: null },
          swap: null,
          avvio: "",
          vmAccese: null,
          ctAccesi: null,
          aggiornamenti: { quanti: null, ci: null, pacchetti: [] },
          tasti: {},
          entita: [],
          guest,
          dischi,
          storage,
        },
      ],
    };
  return { nodi };
}

/** Tutte le entita' che il pannello di Proxmox racconta: le fasce delle
 * macchine non le ripetono. */
export function entitaRaccontate(server) {
  const fuori = new Set();
  for (const n of server?.nodi || []) {
    for (const id of n.entita) fuori.add(id);
    for (const parte of [n.guest, n.dischi, n.storage])
      for (const x of parte) for (const id of x.entita) fuori.add(id);
  }
  return fuori;
}

/* Una quantita' con la sua unita', come la scrive Home Assistant: 20,34 GB. */
export function quantita(l, lingua = "it") {
  if (!l || l.valore == null) return "";
  const cifre = Math.abs(l.valore) >= 100 ? 0 : Math.abs(l.valore) >= 10 ? 1 : 2;
  const testo = l.valore.toLocaleString(lingua, { maximumFractionDigits: cifre });
  return l.unita ? `${testo} ${l.unita}` : testo;
}
