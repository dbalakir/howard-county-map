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

const map = L.map('map', { maxZoom: 22 }).setView([39.287, -76.938], 11);
window._map = map;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 22,
  maxNativeZoom: 19,
}).addTo(map);

function makeIcon(p) {
  let color, border, size;
  if (p.for_sale) {
    color = '#e53935'; border = '#b71c1c'; size = 14;
  } else if (p.restricted) {
    color = '#8b5cf6'; border = '#6d28d9'; size = 12;
  } else if (p.near_metro) {
    color = '#0288d1'; border = '#01579b'; size = 12;
  } else {
    color = '#e67e22'; border = '#b85c00'; size = 12;
  }
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;box-sizing:border-box;border-radius:50%;background:${color};border:2px solid ${border};opacity:0.92"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -8],
  });
}

function fmt$(n) {
  if (!n && n !== 0) return '—';
  return '$' + Number(n).toLocaleString();
}

function sdatUrl(acctId) {
  if (!acctId || acctId.length < 6) return null;
  return `https://sdat.dat.maryland.gov/RealProperty/Pages/viewdetails.aspx` +
    `?County=${acctId.slice(0,2)}&SearchType=ACCT&District=${acctId.slice(2,4)}&AccountNumber=${acctId.slice(4)}`;
}

function fmtSaleDate(raw) {
  if (!raw) return '—';
  const [y, m, d] = raw.split('.');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m,10)-1] || m} ${parseInt(d,10)}, ${y}`;
}

// ── Compact popup with expand button ─────────────────────────────────────────

function buildPopup(p) {
  const owner1 = (p.owner  || '').trim();
  const owner2 = (p.owner2 || '').trim();
  const ownerLine = owner1
    ? `<b>Owner:</b> ${owner1}${owner2 ? ' &amp; ' + owner2 : ''}<br>`
    : '';
  const pricePerAcre = p.acres > 0 ? Math.round(p.land_value / p.acres) : 0;
  const safeP = JSON.stringify(p).replace(/\\/g, '\\\\').replace(/"/g, '&quot;');

  return `
    <b>${p.address}</b><br>
    ${ownerLine}
    <hr style="margin:4px 0">
    <b>Lot:</b> ${p.sqft.toLocaleString()} sqft (${p.acres.toFixed(2)} ac)<br>
    <b>Zoning:</b> ${p.zoning_district} — ${p.zone_category}<br>
    <hr style="margin:4px 0">
    <b>Land value:</b> ${fmt$(p.land_value)} &nbsp;(${fmt$(pricePerAcre)}/ac)<br>
    <b>Improvement:</b> ${fmt$(p.improvement_value)}<br>
    <button class="popup-expand-btn" onclick="openModal(JSON.parse(this.dataset.p))" data-p="${safeP}">
      View full details →
    </button>
  `.trim();
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function openModal(p) {
  const modal = document.getElementById('lot-modal');

  document.getElementById('modal-address').textContent = p.address;
  const badges = document.getElementById('modal-badges');
  badges.innerHTML = [
    p.vacant     ? '<span class="modal-badge badge-vacant">Vacant lot</span>'             : '<span class="modal-badge badge-improved">Improved</span>',
    p.restricted ? '<span class="modal-badge badge-restricted">⚠ Restricted zone</span>' : '',
    p.for_sale   ? '<span class="modal-badge badge-forsale">● For sale</span>'            : '',
    p.near_metro ? '<span class="modal-badge badge-metro">◎ Near utility</span>'          : '',
  ].join('');

  const owner1 = (p.owner  || '').trim();
  const owner2 = (p.owner2 || '').trim();
  const ownerAddr = [p.owner_addr, p.owner_city, p.owner_zip ? `MD ${p.owner_zip}` : '']
    .map(s => (s || '').trim()).filter(Boolean).join(', ');

  const pricePerAcre  = p.acres > 0 ? Math.round(p.land_value / p.acres) : 0;
  const sdat          = sdatUrl(p.acct_id);
  const mapsUrl       = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`;
  const lastSalePrice = p.last_sale_price ? fmt$(parseInt(p.last_sale_price, 10)) : '—';
  const hasSale       = p.last_sale_date || p.last_sale_price;

  let mlsHtml = '';
  if (p.for_sale) {
    const statusLabel = p.mls_status === 'ACT' ? 'Active' : 'Under Contract';
    const statusColor = p.mls_status === 'ACT' ? '#dc2626' : '#d97706';
    mlsHtml = `
      <div class="modal-section">
        <div class="modal-section-title">MLS Listing</div>
        <div class="modal-grid">
          <div class="modal-field"><span class="modal-field-label">Status</span>
            <span class="modal-field-value" style="color:${statusColor};font-weight:700">● ${statusLabel}</span></div>
          <div class="modal-field"><span class="modal-field-label">List price</span>
            <span class="modal-field-value big">${p.list_price}</span></div>
          <div class="modal-field"><span class="modal-field-label">MLS #</span>
            <span class="modal-field-value">${p.mls_number || '—'}</span></div>
          <div class="modal-field"><span class="modal-field-label">Date</span>
            <span class="modal-field-value">${p.status_date || '—'}</span></div>
          ${p.beds ? `
          <div class="modal-field"><span class="modal-field-label">Beds / Baths</span>
            <span class="modal-field-value">${p.beds} bd / ${p.baths} ba</span></div>
          <div class="modal-field"><span class="modal-field-label">Office</span>
            <span class="modal-field-value">${p.list_office || '—'}</span></div>` : ''}
        </div>
      </div>`;
  }

  document.getElementById('modal-body').innerHTML = `
    <div class="modal-section">
      <div class="modal-section-title">Owner</div>
      ${owner1
        ? `<div class="modal-owner-name">${owner1}${owner2 ? ' &amp; ' + owner2 : ''}</div>
           ${ownerAddr ? `<div class="modal-owner-addr">${ownerAddr}</div>` : ''}`
        : `<div style="color:#94a3b8;font-size:13px">Owner record not matched</div>`}
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Property</div>
      <div class="modal-grid">
        <div class="modal-field"><span class="modal-field-label">Lot size</span>
          <span class="modal-field-value big">${p.acres.toFixed(2)} ac</span></div>
        <div class="modal-field"><span class="modal-field-label">Square feet</span>
          <span class="modal-field-value big">${p.sqft.toLocaleString()}</span></div>
        <div class="modal-field"><span class="modal-field-label">Zoning district</span>
          <span class="modal-field-value">${p.zoning_district || '—'}</span></div>
        <div class="modal-field"><span class="modal-field-label">Zone category</span>
          <span class="modal-field-value">${p.zone_category || '—'}</span></div>
        <div class="modal-field"><span class="modal-field-label">SDAT land use</span>
          <span class="modal-field-value">${p.zoning_use || '—'}</span></div>
        <div class="modal-field"><span class="modal-field-label">SDAT account</span>
          <span class="modal-field-value">${p.acct_id || '—'}</span></div>
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Financials</div>
      <div class="modal-grid-3">
        <div class="modal-field"><span class="modal-field-label">Total assessed</span>
          <span class="modal-field-value big">${fmt$(p.total_value)}</span></div>
        <div class="modal-field"><span class="modal-field-label">Land value</span>
          <span class="modal-field-value big">${fmt$(p.land_value)}</span></div>
        <div class="modal-field"><span class="modal-field-label">Improvement</span>
          <span class="modal-field-value big">${fmt$(p.improvement_value)}</span></div>
        <div class="modal-field"><span class="modal-field-label">Price / acre</span>
          <span class="modal-field-value">${fmt$(pricePerAcre)}</span></div>
        <div class="modal-field"><span class="modal-field-label">Water</span>
          <span class="modal-field-value">${p.water || '—'}</span></div>
        <div class="modal-field"><span class="modal-field-label">Sewer</span>
          <span class="modal-field-value">${p.sewer || '—'}</span></div>
      </div>
    </div>

    ${hasSale ? `
    <div class="modal-section">
      <div class="modal-section-title">Last recorded sale</div>
      <div class="modal-grid">
        <div class="modal-field"><span class="modal-field-label">Sale date</span>
          <span class="modal-field-value big">${fmtSaleDate(p.last_sale_date)}</span></div>
        <div class="modal-field"><span class="modal-field-label">Sale price</span>
          <span class="modal-field-value big">${lastSalePrice}</span></div>
        <div class="modal-field"><span class="modal-field-label">Sold by</span>
          <span class="modal-field-value">${p.last_seller || '—'}</span></div>
        <div class="modal-field"><span class="modal-field-label">Deed reference</span>
          <span class="modal-field-value">${p.deed_liber && p.deed_folio
            ? `Liber ${p.deed_liber} / Folio ${p.deed_folio}` : '—'}</span></div>
      </div>
    </div>` : ''}

    ${mlsHtml}

    <div class="modal-actions">
      <a class="modal-btn modal-btn-primary" href="${mapsUrl}" target="_blank" rel="noopener">⌖ Google Maps</a>
      ${sdat ? `<a class="modal-btn modal-btn-secondary" href="${sdat}" target="_blank" rel="noopener">SDAT record ↗</a>` : ''}
    </div>
  `;

  modal.classList.add('open');
}

function closeModal() {
  document.getElementById('lot-modal').classList.remove('open');
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-backdrop').addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

window.openModal = openModal;

// --- Lot type legend ---
const lotLegend = L.control({ position: 'bottomright' });
lotLegend.onAdd = () => {
  const div = L.DomUtil.create('div', 'legend');
  div.innerHTML = `<b>Lot type</b><br>
    <span class="legend-dot" style="background:#e53935;border:2px solid #b71c1c;width:14px;height:14px"></span>For sale (MLS)<br>
    <span class="legend-dot" style="background:#e67e22;border:2px solid #b85c00"></span>Connected lot<br>
    <span class="legend-dot" style="background:#8b5cf6;border:2px solid #6d28d9"></span>Restricted zone<br>
    <span class="legend-dot" style="background:#0288d1;border:2px solid #01579b"></span>Near utility (¼ mi)<br>
    <span style="display:inline-block;width:24px;height:0;border-top:2px dashed #2980b9;margin-right:6px;vertical-align:middle;opacity:0.8"></span>Public Water &amp; Sewer Area`;
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

// --- Howard County WMS base ---
const HC_WMS = '/wms';

const parcelLayer = L.tileLayer.wms(HC_WMS, {
  layers: 'general:Property_Public_NoName',
  format: 'image/png',
  transparent: true,
  version: '1.1.1',
  opacity: 0.5,
  minZoom: 14,
  maxZoom: 22,
  maxNativeZoom: 18,
}).addTo(map);

const floodLayer = L.tileLayer.wms(HC_WMS, {
  layers: 'general:Floodplain_HoCo',
  format: 'image/png',
  transparent: true,
  version: '1.1.1',
  opacity: 0.5,
});

document.getElementById('parcelToggle').addEventListener('change', e => {
  if (e.target.checked) parcelLayer.addTo(map);
  else map.removeLayer(parcelLayer);
});

document.getElementById('floodToggle').addEventListener('change', e => {
  if (e.target.checked) floodLayer.addTo(map);
  else map.removeLayer(floodLayer);
});

// --- Parks, Open Space & Easements WMS layers ---
const wmsDefaults = { format: 'image/png', transparent: true, version: '1.1.1', opacity: 0.7, maxZoom: 22, maxNativeZoom: 18 };

const parkLayers = {
  forestCoverToggle:    L.tileLayer.wms(HC_WMS, { ...wmsDefaults, layers: 'general:Forest_Cover' }),
  forestEasementToggle: L.tileLayer.wms(HC_WMS, { ...wmsDefaults, layers: 'general:Forest_Conservation_Easements' }),
  hocoOpenSpaceToggle:  L.tileLayer.wms(HC_WMS, { ...wmsDefaults, layers: 'general:Open_Space_Natural_Resource' }),
  hocoParksToggle:      L.tileLayer.wms(HC_WMS, { ...wmsDefaults, layers: 'general:Parks' }),
  nonHocoParksToggle:   L.tileLayer.wms(HC_WMS, { ...wmsDefaults, layers: 'general:Open_Space_Other' }),
  preservationToggle:   L.tileLayer.wms(HC_WMS, { ...wmsDefaults, layers: 'general:Preservation_Easements' }),
};

Object.entries(parkLayers).forEach(([id, layer]) => {
  document.getElementById(id).addEventListener('change', e => {
    if (e.target.checked) layer.addTo(map);
    else map.removeLayer(layer);
  });
});

// --- Environmental Constraints WMS layers ---
const constraintLayers = {
  femaFloodToggle:           L.tileLayer.wms(HC_WMS, { ...wmsDefaults, layers: 'general:Floodplain',                      opacity: 0.5  }),
  streamsToggle:             L.tileLayer.wms(HC_WMS, { ...wmsDefaults, layers: 'general:Stream_Centerline_Buffer',        opacity: 0.65 }),
  sensitiveSpeciesToggle:    L.tileLayer.wms(HC_WMS, { ...wmsDefaults, layers: 'general:MD_SensitiveSpeciesReviewAreas',  opacity: 0.5  }),
  greenInfraToggle:          L.tileLayer.wms(HC_WMS, { ...wmsDefaults, layers: 'general:Green_Infrastructure_Network',    opacity: 0.6  }),
  forestInteriorToggle:      L.tileLayer.wms(HC_WMS, { ...wmsDefaults, layers: 'general:GI_Forest_Interior_75acs',        opacity: 0.6  }),
};

// --- Development Controls WMS layers ---
const devControlLayers = {
  growthTiersToggle:       L.tileLayer.wms(HC_WMS, { ...wmsDefaults, layers: 'general:GrowthTiers',        opacity: 0.45 }),
  historicDistrictsToggle: L.tileLayer.wms(HC_WMS, { ...wmsDefaults, layers: 'general:Historic_Districts', opacity: 0.65 }),
  countyOwnedLandToggle:   L.tileLayer.wms(HC_WMS, { ...wmsDefaults, layers: 'general:County_Owned_Land',  opacity: 0.55 }),
  landUseToggle:           L.tileLayer.wms(HC_WMS, { ...wmsDefaults, layers: 'general:Land_Use',           opacity: 0.5  }),
};

[...Object.entries(constraintLayers), ...Object.entries(devControlLayers)].forEach(([id, layer]) => {
  document.getElementById(id).addEventListener('change', e => {
    if (e.target.checked) layer.addTo(map);
    else map.removeLayer(layer);
  });
});

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

// --- Metro District overlay ---
let metroLayer = null;

fetch('/data/metro_district.geojson')
  .then(r => r.json())
  .then(data => {
    metroLayer = L.geoJSON(data, {
      style: {
        fillColor: '#2980b9',
        fillOpacity: 0.12,
        color: '#2980b9',
        weight: 2,
        opacity: 0.7,
        dashArray: '5 4',
      },
    });
    document.getElementById('metroToggle').addEventListener('change', e => {
      if (e.target.checked) { metroLayer.addTo(map); metroLayer.bringToBack(); }
      else map.removeLayer(metroLayer);
    });
  });

// --- Lots ---
const markers = L.layerGroup().addTo(map);

function getFilters() {
  return {
    minAcres: parseFloat(document.getElementById('acreFilter').value),
    type: document.getElementById('typeFilter').value,
    district: document.getElementById('districtFilter').value,
    hideRestricted: document.getElementById('hideRestricted').checked,
    forSaleOnly: document.getElementById('forSaleOnly').checked,
    hideNearMetro: document.getElementById('hideNearMetro').checked,
    ownerSearch: document.getElementById('ownerSearch').value.trim().toUpperCase(),
  };
}

function refresh(data) {
  const { minAcres, type, district, hideRestricted, forSaleOnly, hideNearMetro, ownerSearch } = getFilters();
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
    if (forSaleOnly && !p.for_sale) return;
    if (hideNearMetro && p.near_metro) return;
    if (ownerSearch) {
      const combined = ((p.owner || '') + ' ' + (p.owner2 || '')).toUpperCase();
      if (!combined.includes(ownerSearch)) return;
    }
    const [lon, lat] = f.geometry.coordinates;
    L.marker([lat, lon], { icon: makeIcon(p) })
      .bindPopup(buildPopup(p), { maxWidth: 320 })
      .on('click', () => highlightParcel(lon, lat))
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

// --- Parcel highlight on click ---

function pointInPolygon(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function polygonContains(polygonRings, lng, lat) {
  if (!pointInPolygon(lng, lat, polygonRings[0])) return false;
  for (let i = 1; i < polygonRings.length; i++) {
    if (pointInPolygon(lng, lat, polygonRings[i])) return false;
  }
  return true;
}

function featureContains(feature, lng, lat) {
  const g = feature.geometry;
  if (g.type === 'Polygon') return polygonContains(g.coordinates, lng, lat);
  return g.coordinates.some(rings => polygonContains(rings, lng, lat));
}

let highlightLayer = null;

async function highlightParcel(lng, lat) {
  if (highlightLayer) { map.removeLayer(highlightLayer); highlightLayer = null; }

  const d = 0.0004;
  const params = new URLSearchParams({
    service: 'WFS', version: '1.0.0', request: 'GetFeature',
    typeName: 'general:Property_Public_NoName',
    outputFormat: 'application/json',
    maxFeatures: '20',
    srsName: 'EPSG:4326',
    bbox: `${lng - d},${lat - d},${lng + d},${lat + d},EPSG:4326`,
  });

  try {
    const resp = await fetch(`/wfs?${params}`);
    const data = await resp.json();
    const hit = data.features?.find(f => featureContains(f, lng, lat))
              ?? data.features?.[0];
    if (!hit) return;

    // For MultiPolygon, only draw the sub-polygon(s) that contain the click point,
    // not the entire feature (which may include disconnected parcels for the same owner).
    let geom = hit;
    if (hit.geometry.type === 'MultiPolygon') {
      const matching = hit.geometry.coordinates.filter(rings => polygonContains(rings, lng, lat));
      if (matching.length > 0 && matching.length < hit.geometry.coordinates.length) {
        geom = {
          ...hit,
          geometry: matching.length === 1
            ? { type: 'Polygon', coordinates: matching[0] }
            : { type: 'MultiPolygon', coordinates: matching },
        };
      }
    }

    highlightLayer = L.geoJSON(geom, {
      style: {
        color: '#f59e0b',
        weight: 3,
        opacity: 1,
        fillColor: '#fbbf24',
        fillOpacity: 0.25,
      },
    }).addTo(map);
    highlightLayer.bringToFront();
  } catch (_) {}
}

// Highlight on bare map click (outside markers)
map.on('click', e => highlightParcel(e.latlng.lng, e.latlng.lat));

Promise.all([
  fetch('/data/lots.geojson').then(r => r.json()),
  fetch('/data/mls.json').then(r => r.json()).catch(() => []),
]).then(([data, mlsData]) => {
  const mlsByAddress = new Map(mlsData.map(m => [m.address, m]));
  data.features.forEach(f => {
    const mls = mlsByAddress.get(f.properties.address);
    if (mls) Object.assign(f.properties, mls);
  });
  populateDistrictFilter(data);
  refresh(data);
  document.getElementById('acreFilter').addEventListener('input', () => refresh(data));
  document.getElementById('typeFilter').addEventListener('change', () => refresh(data));
  document.getElementById('districtFilter').addEventListener('change', () => refresh(data));
  document.getElementById('hideRestricted').addEventListener('change', () => refresh(data));
  document.getElementById('forSaleOnly').addEventListener('change', () => refresh(data));
  document.getElementById('hideNearMetro').addEventListener('change', () => refresh(data));
  document.getElementById('ownerSearch').addEventListener('input', () => refresh(data));
});
