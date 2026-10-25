/* Un server Proxmox come lo racconta l'integrazione Proxmox VE 4.0.2 (HACS):
 * un nodo «pve», una VM, due container, due dischi, uno storage. I nomi dei
 * dispositivi e le chiavi di traduzione sono quelli che l'integrazione crea
 * (`device_info` e le descrizioni dei sensori); i valori quelli delle foto
 * del pannello di Home Assistant: CPU 14,6%, memoria 20,34 GB usata su 27,22,
 * 118 aggiornamenti da fare, 2 container e 1 VM accesi.
 *
 * Lo usano le prove del modello e quelle nel browser. Contiene anche le due
 * righe morte di un'installazione di prima (`pve_*`, senza dispositivo).
 */

const ENTRY = "01JPROXMOX";

export const DISPOSITIVI = [
  {
    id: "dev-node",
    name: "Node pve",
    model: "Intel(R) N100",
    integration: "proxmoxve",
    integrations: ["proxmoxve"],
  },
  {
    id: "dev-qemu100",
    name: "QEMU homeassistant (100)",
    model: "QEMU",
    integration: "proxmoxve",
    integrations: ["proxmoxve"],
  },
  {
    id: "dev-lxc101",
    name: "LXC cloudflared (101)",
    model: "LXC",
    integration: "proxmoxve",
    integrations: ["proxmoxve"],
  },
  {
    id: "dev-lxc102",
    name: "LXC docker-frigate (102)",
    model: "LXC",
    integration: "proxmoxve",
    integrations: ["proxmoxve"],
  },
  {
    id: "dev-disk1",
    name: "Disk pve: CT1000P3PSSD8",
    model: "NVME CT1000P3PSSD8 ",
    integration: "proxmoxve",
    integrations: ["proxmoxve"],
  },
  {
    id: "dev-disk2",
    name: "Disk pve: WD BLACK SN850X 1000GB",
    model: "SSD WD BLACK SN850X 1000GB ",
    integration: "proxmoxve",
    integrations: ["proxmoxve"],
  },
  {
    id: "dev-storage",
    name: "local-lvm",
    model: "Storage",
    integration: "proxmoxve",
    integrations: ["proxmoxve"],
  },
  {
    id: "dev-lavatrice",
    name: "Lavatrice",
    model: "WM",
    integration: "hon",
    integrations: ["hon"],
  },
];

const riga = (device_id, entity_id, translation_key) => ({
  entity_id,
  device_id,
  platform: "proxmoxve",
  translation_key,
});

export const ENTITA = {
  "dev-node": [
    riga("dev-node", "binary_sensor.node_pve_status", "status"),
    riga("dev-node", "binary_sensor.node_pve_updates_packages", "update_avail"),
    riga("dev-node", "sensor.node_pve_cpu_used", "cpu_used"),
    riga("dev-node", "sensor.node_pve_memory_used_percentage", "memory_used_perc"),
    riga("dev-node", "sensor.node_pve_memory_used", "memory_used"),
    riga("dev-node", "sensor.node_pve_memory_free", "memory_free"),
    riga("dev-node", "sensor.node_pve_memory_total", "memory_total"),
    riga("dev-node", "sensor.node_pve_disk_used_percentage", "disk_used_perc"),
    riga("dev-node", "sensor.node_pve_disk_used", "disk_used"),
    riga("dev-node", "sensor.node_pve_disk_total", "disk_total"),
    riga("dev-node", "sensor.node_pve_swap_used_percentage", "swap_used_perc"),
    riga("dev-node", "sensor.node_pve_last_boot", "uptime"),
    riga("dev-node", "sensor.node_pve_virtual_machines_running", "qemu_on"),
    riga("dev-node", "sensor.node_pve_containers_running", "lxc_on"),
    riga("dev-node", "sensor.node_pve_total_updates", "updates_total"),
    riga("dev-node", "button.node_pve_reboot", "reboot"),
    riga("dev-node", "button.node_pve_shutdown", "shutdown"),
    riga("dev-node", "button.node_pve_start_all", "start_all"),
    riga("dev-node", "button.node_pve_stop_all", "stop_all"),
  ],
  "dev-qemu100": [
    riga("dev-qemu100", "binary_sensor.qemu_homeassistant_100_status", "status"),
    riga("dev-qemu100", "binary_sensor.qemu_homeassistant_100_health", "health"),
    riga("dev-qemu100", "sensor.qemu_homeassistant_100_node", "node"),
    riga("dev-qemu100", "sensor.qemu_homeassistant_100_status", "status_raw"),
    riga("dev-qemu100", "sensor.qemu_homeassistant_100_cpu_used", "cpu_used"),
    riga("dev-qemu100", "sensor.qemu_homeassistant_100_memory_used_percentage", "memory_used_perc"),
    riga("dev-qemu100", "sensor.qemu_homeassistant_100_memory_used", "memory_used"),
    riga("dev-qemu100", "sensor.qemu_homeassistant_100_disk_used_percentage", "disk_used_perc"),
    riga("dev-qemu100", "sensor.qemu_homeassistant_100_network_in", "network_in"),
    riga("dev-qemu100", "sensor.qemu_homeassistant_100_network_out", "network_out"),
    riga("dev-qemu100", "sensor.qemu_homeassistant_100_last_boot", "uptime"),
    riga("dev-qemu100", "button.qemu_homeassistant_100_reboot", "reboot"),
    riga("dev-qemu100", "button.qemu_homeassistant_100_shutdown", "shutdown"),
    riga("dev-qemu100", "button.qemu_homeassistant_100_start", "start"),
    riga("dev-qemu100", "button.qemu_homeassistant_100_stop", "stop"),
  ],
  "dev-lxc101": [
    riga("dev-lxc101", "binary_sensor.lxc_cloudflared_101_status", "status"),
    /* Il sensore «Node» dei container non ha la chiave di traduzione. */
    riga("dev-lxc101", "sensor.lxc_cloudflared_101_node", ""),
    riga("dev-lxc101", "sensor.lxc_cloudflared_101_cpu_used", "cpu_used"),
    riga("dev-lxc101", "sensor.lxc_cloudflared_101_memory_used_percentage", "memory_used_perc"),
    riga("dev-lxc101", "sensor.lxc_cloudflared_101_memory_used", "memory_used"),
    riga("dev-lxc101", "sensor.lxc_cloudflared_101_disk_used_percentage", "disk_used_perc"),
    riga("dev-lxc101", "sensor.lxc_cloudflared_101_last_boot", "uptime"),
    riga("dev-lxc101", "button.lxc_cloudflared_101_start", "start"),
    riga("dev-lxc101", "button.lxc_cloudflared_101_shutdown", "shutdown"),
    riga("dev-lxc101", "button.lxc_cloudflared_101_reboot", "reboot"),
  ],
  "dev-lxc102": [
    riga("dev-lxc102", "binary_sensor.lxc_docker_frigate_102_status", "status"),
    riga("dev-lxc102", "sensor.lxc_docker_frigate_102_node", ""),
    riga("dev-lxc102", "sensor.lxc_docker_frigate_102_cpu_used", "cpu_used"),
    riga("dev-lxc102", "sensor.lxc_docker_frigate_102_memory_used_percentage", "memory_used_perc"),
    riga("dev-lxc102", "sensor.lxc_docker_frigate_102_memory_used", "memory_used"),
    riga("dev-lxc102", "sensor.lxc_docker_frigate_102_disk_used_percentage", "disk_used_perc"),
    riga("dev-lxc102", "sensor.lxc_docker_frigate_102_last_boot", "uptime"),
    riga("dev-lxc102", "button.lxc_docker_frigate_102_start", "start"),
    riga("dev-lxc102", "button.lxc_docker_frigate_102_shutdown", "shutdown"),
  ],
  "dev-disk1": [
    riga("dev-disk1", "binary_sensor.disk_pve_ct1000p3pssd8_health", "health"),
    riga("dev-disk1", "sensor.disk_pve_ct1000p3pssd8_temperature", "temperature"),
    riga("dev-disk1", "sensor.disk_pve_ct1000p3pssd8_life_left", "life_left"),
    riga("dev-disk1", "sensor.disk_pve_ct1000p3pssd8_power_on_hours", "power_hours"),
  ],
  "dev-disk2": [
    riga("dev-disk2", "binary_sensor.disk_pve_wd_black_health", "health"),
    riga("dev-disk2", "sensor.disk_pve_wd_black_temperature", "temperature"),
    riga("dev-disk2", "sensor.disk_pve_wd_black_disk_wearout", "disk_wearout"),
  ],
  "dev-storage": [
    riga("dev-storage", "sensor.local_lvm_node", "node"),
    riga("dev-storage", "sensor.local_lvm_disk_used_percentage", "disk_used_perc"),
    riga("dev-storage", "sensor.local_lvm_disk_used", "disk_used"),
    riga("dev-storage", "sensor.local_lvm_disk_total", "disk_total"),
  ],
};

const s = (state, attributes = {}) => ({ state: String(state), attributes });
const giorniFa = (adesso, giorni) => new Date(adesso - giorni * 86_400_000).toISOString();

/** Gli stati di quel momento. `adesso` serve agli ultimi avvii. */
export function stati(adesso = Date.parse("2026-10-25T11:05:00Z")) {
  return {
    "binary_sensor.node_pve_status": s("on", { device_class: "running" }),
    "binary_sensor.node_pve_updates_packages": s("on", { device_class: "update" }),
    "sensor.node_pve_cpu_used": s(14.6, { unit_of_measurement: "%" }),
    "sensor.node_pve_memory_used_percentage": s(60.95, { unit_of_measurement: "%" }),
    "sensor.node_pve_memory_used": s(20.34, { unit_of_measurement: "GB" }),
    "sensor.node_pve_memory_free": s(6.88, { unit_of_measurement: "GB" }),
    "sensor.node_pve_memory_total": s(33.37, { unit_of_measurement: "GB" }),
    "sensor.node_pve_disk_used_percentage": s(33.3, { unit_of_measurement: "%" }),
    "sensor.node_pve_disk_used": s(31.2, { unit_of_measurement: "GB" }),
    "sensor.node_pve_disk_total": s(93.9, { unit_of_measurement: "GB" }),
    "sensor.node_pve_swap_used_percentage": s(4.1, { unit_of_measurement: "%" }),
    "sensor.node_pve_last_boot": s(giorniFa(adesso, 21.3), { device_class: "timestamp" }),
    "sensor.node_pve_virtual_machines_running": s(1, { qemu_on_list: ["homeassistant (100)"] }),
    "sensor.node_pve_containers_running": s(2, {
      lxc_on_list: ["cloudflared (101)", "docker-frigate (102)"],
    }),
    "sensor.node_pve_total_updates": s(118, {
      updates_list: [
        "proxmox-ve 8.4.0",
        "pve-manager 8.4.14",
        "pve-kernel-6.8 6.8.12-15",
        "qemu-server 8.4.4",
        "libpve-common-perl 8.3.4",
        "openssl 3.0.17-1",
      ],
    }),
    "button.node_pve_reboot": s("unknown"),
    "button.node_pve_shutdown": s("unknown"),
    "button.node_pve_start_all": s("unknown"),
    "button.node_pve_stop_all": s("unknown"),

    "binary_sensor.qemu_homeassistant_100_status": s("on", { device_class: "running" }),
    "binary_sensor.qemu_homeassistant_100_health": s("off", { device_class: "problem" }),
    "sensor.qemu_homeassistant_100_node": s("pve"),
    "sensor.qemu_homeassistant_100_status": s("running"),
    "sensor.qemu_homeassistant_100_cpu_used": s(8.2, { unit_of_measurement: "%" }),
    "sensor.qemu_homeassistant_100_memory_used_percentage": s(71.4, { unit_of_measurement: "%" }),
    "sensor.qemu_homeassistant_100_memory_used": s(5.71, { unit_of_measurement: "GB" }),
    "sensor.qemu_homeassistant_100_disk_used_percentage": s(41.8, { unit_of_measurement: "%" }),
    "sensor.qemu_homeassistant_100_network_in": s(1834.2, { unit_of_measurement: "MB" }),
    "sensor.qemu_homeassistant_100_network_out": s(912.6, { unit_of_measurement: "MB" }),
    "sensor.qemu_homeassistant_100_last_boot": s(giorniFa(adesso, 6.2), {
      device_class: "timestamp",
    }),
    "button.qemu_homeassistant_100_reboot": s("unknown"),
    "button.qemu_homeassistant_100_shutdown": s("unknown"),
    "button.qemu_homeassistant_100_start": s("unknown"),
    "button.qemu_homeassistant_100_stop": s("unknown"),

    "binary_sensor.lxc_cloudflared_101_status": s("on", { device_class: "running" }),
    "sensor.lxc_cloudflared_101_node": s("pve"),
    "sensor.lxc_cloudflared_101_cpu_used": s(0.4, { unit_of_measurement: "%" }),
    "sensor.lxc_cloudflared_101_memory_used_percentage": s(12.3, { unit_of_measurement: "%" }),
    "sensor.lxc_cloudflared_101_memory_used": s(0.06, { unit_of_measurement: "GB" }),
    "sensor.lxc_cloudflared_101_disk_used_percentage": s(22.0, { unit_of_measurement: "%" }),
    "sensor.lxc_cloudflared_101_last_boot": s(giorniFa(adesso, 21.2), {
      device_class: "timestamp",
    }),
    "button.lxc_cloudflared_101_start": s("unknown"),
    "button.lxc_cloudflared_101_shutdown": s("unknown"),
    "button.lxc_cloudflared_101_reboot": s("unknown"),

    "binary_sensor.lxc_docker_frigate_102_status": s("on", { device_class: "running" }),
    "sensor.lxc_docker_frigate_102_node": s("pve"),
    "sensor.lxc_docker_frigate_102_cpu_used": s(37.9, { unit_of_measurement: "%" }),
    "sensor.lxc_docker_frigate_102_memory_used_percentage": s(83.5, { unit_of_measurement: "%" }),
    "sensor.lxc_docker_frigate_102_memory_used": s(6.68, { unit_of_measurement: "GB" }),
    "sensor.lxc_docker_frigate_102_disk_used_percentage": s(92.4, { unit_of_measurement: "%" }),
    "sensor.lxc_docker_frigate_102_last_boot": s(giorniFa(adesso, 2.5), {
      device_class: "timestamp",
    }),
    "button.lxc_docker_frigate_102_start": s("unknown"),
    "button.lxc_docker_frigate_102_shutdown": s("unknown"),

    "binary_sensor.disk_pve_ct1000p3pssd8_health": s("off", { device_class: "problem" }),
    "sensor.disk_pve_ct1000p3pssd8_temperature": s(41, { unit_of_measurement: "°C" }),
    "sensor.disk_pve_ct1000p3pssd8_life_left": s(97, { unit_of_measurement: "%" }),
    "sensor.disk_pve_ct1000p3pssd8_power_on_hours": s(6412, { unit_of_measurement: "h" }),
    "binary_sensor.disk_pve_wd_black_health": s("off", { device_class: "problem" }),
    "sensor.disk_pve_wd_black_temperature": s(38, { unit_of_measurement: "°C" }),
    "sensor.disk_pve_wd_black_disk_wearout": s(2, { unit_of_measurement: "%" }),

    "sensor.local_lvm_node": s("pve"),
    "sensor.local_lvm_disk_used_percentage": s(47.6, { unit_of_measurement: "%" }),
    "sensor.local_lvm_disk_used": s(395.2, { unit_of_measurement: "GB" }),
    "sensor.local_lvm_disk_total": s(830.1, { unit_of_measurement: "GB" }),

    /* Le righe morte dell'integrazione di prima. */
    "binary_sensor.pve_cloudflared": s("unavailable", { device_class: "running" }),
    "binary_sensor.pve_homeassistant": s("unavailable", { device_class: "running" }),
  };
}

export const MORTE = ["binary_sensor.pve_cloudflared", "binary_sensor.pve_homeassistant"];
export { ENTRY };
