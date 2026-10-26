export const datasetURL = new URL("../geojson/ULBI PVJ.geojson", import.meta.url);

// Validasi data asli sebelum diteruskan ke CrootJS.
export async function loadRoute(fetchRoute = fetch) {
  const response = await fetchRoute(datasetURL);
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

