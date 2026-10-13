export const datasetURL = new URL("../geojson/ULBI PVJ.geojson", import.meta.url);

// Validasi data asli sebelum diteruskan ke CrootJS.
export async function loadRoute() {
  const response = await fetch(datasetURL);
  if (!response.ok) throw new Error("Dataset gagal dimuat: HTTP " + response.status);
  const original = await response.json();
  if (original?.type !== "FeatureCollection" || !Array.isArray(original.features)) {
    throw new Error("Dataset harus berupa FeatureCollection.");
  }
  const lines = original.features.filter(f => f.geometry?.type === "LineString");
  if (!lines.length) throw new Error("Dataset tidak memiliki LineString.");
  for (const line of lines) {
    const positions = line.geometry.coordinates;
    if (!Array.isArray(positions) || positions.length < 2 ||
        !positions.every(p => Array.isArray(p) && p.length >= 2 &&
          p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)) {
      throw new Error("Koordinat LineString tidak valid.");
    }
  }
  return original;
}

// Panjang geodesik sepanjang koordinat rute, bukan jarak lurus antar tujuan.
export function routeLength(positions) {
  const radians = value => value * Math.PI / 180;
  let metres = 0;
  for (let i = 1; i < positions.length; i++) {
    const [lng1, lat1] = positions[i - 1];
    const [lng2, lat2] = positions[i];
    const a = Math.sin(radians(lat2 - lat1) / 2) ** 2 +
      Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lng2 - lng1) / 2) ** 2;
    metres += 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  }
  return metres;
}

const byId = id => document.getElementById(id);
const controls = ["fit", "origin", "destination", "zoom-in", "zoom-out"];
let mapAPI;
let route;
let start;
let end;

function setActive(id) {
  for (const target of ["fit", "origin", "destination"]) {
    byId(target).classList.toggle("is-active", target === id);
    byId(target).setAttribute("aria-pressed", String(target === id));
  }
}

function fitRoute() {
  const map = byId("map");
  // Kelas CSS menyisakan ruang untuk navigasi.
  map.classList.add("is-fitting");
  const visibleHeight = map.clientHeight;
  mapAPI.fitMap("map", route, 32);
  const view = mapAPI.getMapView("map");
  map.classList.remove("is-fitting");
  mapAPI.setMapView("map", view.center, view.zoom);
  const center = mapAPI.pointToPosition("map", [map.clientWidth / 2, map.clientHeight - visibleHeight / 2]);
  mapAPI.setMapView("map", center, view.zoom);
  setActive("fit");
}

function enableControls(enabled) {
  controls.forEach(id => { byId(id).disabled = !enabled; });
}

async function initialize() {
  enableControls(false);
  byId("map-message").hidden = false;
  byId("retry").hidden = true;
  byId("status").textContent = "Memuat peta dan rute…";
  try {
    // Satu-satunya library eksternal: modul peta CrootJS (termasuk geo.js).
    const [api, data] = await Promise.all([
      import("https://cdn.jsdelivr.net/gh/crootjs/lib@0.0.16/map.min.js"),
      loadRoute()
    ]);
    const parsed = api.parseGeoJSON(data);
    if (!parsed || parsed.features.length !== data.features.length) {
      throw new Error("Dataset mengandung fitur yang tidak valid.");
    }
    mapAPI = api;
    route = data;
    const coordinates = route.features.find(feature => feature.geometry?.type === "LineString").geometry.coordinates;
    start = coordinates[0];
    end = coordinates[coordinates.length - 1];
    mapAPI.createMap("map", { center: start, zoom: 14, zoomControl: false, scrollZoom: true });
    mapAPI.addGeoJSON("map", route, {
      style: { stroke: "#164bb5", strokeWidth: 5, strokeOpacity: 1 },
      popup: () => "Rute ULBI → Paris Van Java"
    });
    for (const [coordinates, label, fill] of [
      [start, "ULBI · Titik awal rute", "#164bb5"],
      [end, "Paris Van Java · Titik akhir rute", "#187563"]
    ]) {
      mapAPI.addGeoJSON("map", { type: "Feature", properties: {}, geometry: { type: "Point", coordinates } }, {
        style: { fill, fillOpacity: 1, stroke: "#ffffff", strokeWidth: 3, radius: 9 },
        popup: () => label
      });
    }
    fitRoute();
    byId("distance").textContent = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(routeLength(coordinates) / 1000) + " km";
    enableControls(true);
    byId("status").textContent = "Peta dan rute siap.";
    byId("map-message").hidden = true;
  } catch (error) {
    console.error("Peta gagal dimuat:", error);
    byId("status").textContent = "Peta belum dapat dimuat. Periksa koneksi internet, lalu coba lagi.";
    byId("retry").hidden = false;
  }
}

byId("fit").addEventListener("click", () => fitRoute());
byId("origin").addEventListener("click", () => { mapAPI.setMapView("map", start, 17); setActive("origin"); });
byId("destination").addEventListener("click", () => { mapAPI.setMapView("map", end, 17); setActive("destination"); });
for (const [id, step] of [["zoom-in", 1], ["zoom-out", -1]]) {
  byId(id).addEventListener("click", () => {
    const view = mapAPI.getMapView("map");
    mapAPI.setMapView("map", view.center, view.zoom + step);
  });
}
byId("legend-toggle").addEventListener("click", () => {
  const open = byId("legend-panel").hidden;
  byId("legend-panel").hidden = !open;
  byId("legend-toggle").setAttribute("aria-expanded", String(open));
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !byId("legend-panel").hidden) {
    byId("legend-panel").hidden = true;
    byId("legend-toggle").setAttribute("aria-expanded", "false");
    byId("legend-toggle").focus();
  }
});
byId("retry").addEventListener("click", () => window.location.reload());
initialize();
