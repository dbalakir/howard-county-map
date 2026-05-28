import L from 'leaflet';
import './style.css';

const ZONE_COLORS = {
  'VERY LOW DENSITY RESIDENTIAL': '#c7e9b4',
  'LOW DENSITY RESIDENTIAL':      '#7fcdbb',
  'MEDIUM DENSITY RESIDENTIAL':   '#41b6c4',
  'HIGH DENSITY RESIDENTIAL':     '#2c7fb8',
  'COMMERCIAL':                   '#f4a460',
  'INDUSTRIAL':                   '#a855a0',
  'MIXED USE':                    '#f4d03f',
  'OTHER':                        '#d5d8dc',
};

const map = L.map('map').setView([39.287, -76.938], 11);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19,
}).addTo(map);

function makeIcon(p) {
  let color, border;
  if (p.restricted) {
    color = '#8b5cf6'; border = '#6d28d9';
  } else if (p.vacant) {
    color = '#27ae60'; border = '#1a7a45';
  } else {
    color = '#e67e22'; border = '#b85c00';
  }
  return L.divIcon({
    className: '',
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid ${border};opacity:0.88"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -8],
  });
}

function fmt$(n) {
  return '$' + n.toLocaleString();
}

function buildPopup(p) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`;
  const pricePerAcre = p.acres > 0 ? Math.round(p.land_value / p.acres) : 0;
  const restrictedBadge = p.restricted
    ? '<span style="color:#8b5cf6;font-weight:bold"> ⚠ Subdivision Restricted</span>'
    : '';

  return `
    <b><a href="${mapsUrl}" target="_blank" rel="noopener">${p.address}</a></b>${restrictedBadge}<br>
    <hr style="margin:4px 0">
    <b>Lot:</b> ${p.sqft.toLocaleString()} sqft &nbsp;(${p.acres.toFixed(2)} ac)<br>
    <b>Zoning:</b> ${p.zoning_district} — ${p.zone_category}<br>
    <b>SDAT use:</b> ${p.zoning_use}<br>
    <hr style="margin:4px 0">
    <b>Total assessed:</b> ${fmt$(p.total_value)}<br>
    <b>Land value:</b> ${fmt$(p.land_value)} &nbsp;(${fmt$(pricePerAcre)}/ac)<br>
    <b>Improvement:</b> ${fmt$(p.improvement_value)}<br>
    <hr style="margin:4px 0">
    <b>Water:</b> ${p.water}<br>
    <b>Sewer:</b> ${p.sewer}
  `.trim();
}

// --- Lot type legend ---
const lotLegend = L.control({ position: 'bottomright' });
lotLegend.onAdd = () => {
  const div = L.DomUtil.create('div', 'legend');
  div.innerHTML = `<b>Lot type</b><br>
    <span class="legend-dot" style="background:#27ae60;border:2px solid #1a7a45"></span>Vacant<br>
    <span class="legend-dot" style="background:#e67e22;border:2px solid #b85c00"></span>Improved<br>
    <span class="legend-dot" style="background:#8b5cf6;border:2px solid #6d28d9"></span>Restricted zone`;
  return div;
};
lotLegend.addTo(map);

// --- Zoning legend ---
const zoneLegend = L.control({ position: 'bottomleft' });
zoneLegend.onAdd = () => {
  const div = L.DomUtil.create('div', 'legend');
  div.innerHTML = '<b>Zoning</b><br>' +
    Object.entries(ZONE_COLORS).map(([label, color]) =>
      `<span class="legend-swatch" style="background:${color}"></span>${label.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}`
    ).join('<br>');
  return div;
};

// --- Zoning overlay ---
let zoningLayer = null;
let zoningData = null;

function buildZoningLayer() {
  return L.geoJSON(zoningData, {
    style: f => {
      const color = ZONE_COLORS[f.properties.GENZONE] ?? '#cccccc';
      return { fillColor: color, fillOpacity: 0.35, color, weight: 1, opacity: 0.6 };
    },
    onEachFeature: (f, layer) => {
      const acres = f.properties.ACRES ? f.properties.ACRES.toFixed(0) : '?';
      layer.bindTooltip(`<b>${f.properties.GENZONE}</b><br>${acres} acres`, { sticky: true });
    },
  });
}

function setZoningVisible(on) {
  if (on) {
    if (!zoningLayer) zoningLayer = buildZoningLayer();
    zoningLayer.addTo(map);
    zoningLayer.bringToBack();
    zoneLegend.addTo(map);
  } else {
    if (zoningLayer) map.removeLayer(zoningLayer);
    map.removeControl(zoneLegend);
  }
}

fetch('/data/zoning.geojson')
  .then(r => r.json())
  .then(data => {
    zoningData = data;
    document.getElementById('zoningToggle').addEventListener('change', e => setZoningVisible(e.target.checked));
  });

// --- Lots ---
const markers = L.layerGroup().addTo(map);

function getFilters() {
  return {
    minAcres: parseFloat(document.getElementById('acreFilter').value),
    type: document.getElementById('typeFilter').value,
    district: document.getElementById('districtFilter').value,
    hideRestricted: document.getElementById('hideRestricted').checked,
  };
}

function refresh(data) {
  const { minAcres, type, district, hideRestricted } = getFilters();
  document.getElementById('acreVal').textContent = minAcres;
  markers.clearLayers();
  let count = 0;
  data.features.forEach(f => {
    const p = f.properties;
    if (p.acres < minAcres) return;
    if (type === 'vacant' && !p.vacant) return;
    if (type === 'improved' && p.vacant) return;
    if (hideRestricted && p.restricted) return;
    if (district !== 'all' && p.zoning_district !== district) return;
    const [lon, lat] = f.geometry.coordinates;
    L.marker([lat, lon], { icon: makeIcon(p) })
      .bindPopup(buildPopup(p), { maxWidth: 320 })
      .addTo(markers);
    count++;
  });
  document.getElementById('visCount').textContent = count;
}

function populateDistrictFilter(data) {
  const districts = [...new Set(
    data.features.map(f => f.properties.zoning_district).filter(d => d && d !== 'UNKNOWN')
  )].sort();
  const sel = document.getElementById('districtFilter');
  districts.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    sel.appendChild(opt);
  });
}

fetch('/data/lots.geojson')
  .then(r => r.json())
  .then(data => {
    populateDistrictFilter(data);
    refresh(data);
    document.getElementById('acreFilter').addEventListener('input', () => refresh(data));
    document.getElementById('typeFilter').addEventListener('change', () => refresh(data));
    document.getElementById('districtFilter').addEventListener('change', () => refresh(data));
    document.getElementById('hideRestricted').addEventListener('change', () => refresh(data));
  });
