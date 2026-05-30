// ---- Map with street + satellite base layers ----
const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '© OpenStreetMap'
});
const satellite = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, attribution: 'Esri World Imagery'
});

const map = L.map('map', { center: [50, 15], zoom: 5, layers: [street], worldCopyJump: true });
L.control.layers({ 'Карта': street, 'Спутник': satellite }, null, { position: 'topright' }).addTo(map);

const statusEl = document.getElementById('status');
const infoEl = document.getElementById('info');

// ---- plane marker icon (SVG rotated by heading) ----
function planeIcon(track, selected) {
  return L.divIcon({
    className: '', iconSize: [26, 26], iconAnchor: [13, 13],
    html: `<svg class="plane-ico${selected ? ' sel' : ''}" width="26" height="26" viewBox="0 0 24 24"
      style="transform:rotate(${track || 0}deg)" fill="${selected ? '#2f81f7' : '#ffd23f'}">
      <path d="M12 2l2 7 7 3-7 1-2 8-2-8-7-1 7-3z"/></svg>`
  });
}

const markers = new Map();   // icao24 -> marker
let selected = null;         // icao24 of selected plane
let routeLayer = null;       // path + airport markers

function fmt(n, d = 0) { return n == null ? '—' : Number(n).toFixed(d); }

// ---- live aircraft polling within current map bounds ----
async function refresh() {
  const b = map.getBounds();
  const url = `/api/states?lamin=${b.getSouth()}&lomin=${b.getWest()}&lamax=${b.getNorth()}&lomax=${b.getEast()}`;
  try {
    const r = await fetch(url);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    const seen = new Set();
    for (const s of d.states) {
      seen.add(s.icao24);
      let m = markers.get(s.icao24);
      const sel = s.icao24 === selected;
      if (m) {
        m.setLatLng([s.latitude, s.longitude]); m.state = s;
        if (m._t !== s.true_track || m._s !== sel) { m.setIcon(planeIcon(s.true_track, sel)); m._t = s.true_track; m._s = sel; }
      } else {
        m = L.marker([s.latitude, s.longitude], { icon: planeIcon(s.true_track, sel) }).addTo(map);
        m.state = s; m._t = s.true_track; m._s = sel;
        m.on('click', () => selectPlane(s.icao24));
        markers.set(s.icao24, m);
      }
    }
    for (const [id, m] of markers) if (!seen.has(id)) { map.removeLayer(m); markers.delete(id); }
    statusEl.textContent = `В кадре: ${d.count} бортов · обновлено ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    statusEl.innerHTML = `<span class="err">Ошибка данных: ${e.message}</span>`;
  }
}

// ---- highlight only the affected markers (cheap at world scale) ----
function setSelected(icao24) {
  const prev = markers.get(selected);
  if (prev) { prev.setIcon(planeIcon(prev.state.true_track, false)); prev._s = false; }
  selected = icao24;
  const cur = markers.get(icao24);
  if (cur) { cur.setIcon(planeIcon(cur.state.true_track, true)); cur._s = true; }
}

// ---- click a live plane: load route + aircraft details ----
async function selectPlane(icao24) {
  setSelected(icao24);
  const m = markers.get(icao24);
  if (!m) return;
  const s = m.state;
  statusEl.textContent = 'Загрузка маршрута…';
  const [routeRes, acRes] = await Promise.all([
    s.callsign ? fetch('/api/route?flight=' + encodeURIComponent(s.callsign)).then(r => r.json()) : null,
    fetch('/api/aircraft?icao24=' + s.icao24).then(r => r.json())
  ]);
  const fr = routeRes && routeRes.response && routeRes.response.flightroute;
  const ac = acRes && acRes.response && acRes.response.aircraft;
  render(s, fr, ac);
  drawRoute(fr, s);
  statusEl.textContent = 'Маршрут показан.';
}

// ---- draw origin → current position → destination ----
function drawRoute(fr, s) {
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  if (!fr || !fr.origin || !fr.destination) return;
  const o = [fr.origin.latitude, fr.origin.longitude];
  const d = [fr.destination.latitude, fr.destination.longitude];
  const g = L.layerGroup();
  // flown part (origin -> current) solid, remaining (current -> dest) dashed
  if (s && s.latitude != null) {
    L.polyline([o, [s.latitude, s.longitude]], { color: '#2f81f7', weight: 3 }).addTo(g);
    L.polyline([[s.latitude, s.longitude], d], { color: '#2f81f7', weight: 3, dashArray: '6 8', opacity: .7 }).addTo(g);
  } else {
    L.polyline([o, d], { color: '#2f81f7', weight: 3, dashArray: '6 8' }).addTo(g);
  }
  const dot = (ll, label) => L.circleMarker(ll, { radius: 6, color: '#fff', weight: 2, fillColor: '#2f81f7', fillOpacity: 1 })
    .bindTooltip(label, { permanent: true, direction: 'top', className: 'ap-tip' });
  dot(o, fr.origin.iata_code || fr.origin.icao_code).addTo(g);
  dot(d, fr.destination.iata_code || fr.destination.icao_code).addTo(g);
  routeLayer = g.addTo(map);
  map.fitBounds(L.latLngBounds([o, d, s && s.latitude != null ? [s.latitude, s.longitude] : o]).pad(0.2));
}

// ---- render the info panel ----
function render(s, fr, ac) {
  let html = '';
  if (fr) {
    const ap = (a) => `<div class="ap"><div class="code">${a.iata_code || a.icao_code || '?'}</div>
      <div class="name">${a.municipality || a.name || ''}</div></div>`;
    html += `<div class="card">
      <div class="ttl">${fr.airline ? fr.airline.name : ''} · ${fr.callsign_iata || fr.callsign}</div>
      <div class="route">${ap(fr.origin)}<div class="arrow">✈ →</div>${ap(fr.destination)}</div>
      <div class="row"><span>Откуда</span><b>${fr.origin.name}, ${fr.origin.country_name}</b></div>
      <div class="row"><span>Куда</span><b>${fr.destination.name}, ${fr.destination.country_name}</b></div>
    </div>`;
  } else {
    html += `<div class="card"><span class="err">Маршрут не найден для ${s.callsign || 'этого борта'}.</span></div>`;
  }
  html += `<div class="card">
    <div class="ttl">Борт ${s.callsign || s.icao24}</div>
    ${ac ? `<div class="row"><span>Тип</span><b>${ac.type} (${ac.icao_type})</b></div>
            <div class="row"><span>Регистрация</span><b>${ac.registration || '—'}</b></div>
            <div class="row"><span>Владелец</span><b>${ac.registered_owner || '—'}</b></div>` : ''}
    <div class="row"><span>Страна борта</span><b>${s.origin_country}</b></div>
    <div class="row"><span>Высота</span><b>${fmt(s.baro_altitude)} м</b></div>
    <div class="row"><span>Скорость</span><b>${fmt(s.velocity ? s.velocity * 3.6 : null)} км/ч</b></div>
    <div class="row"><span>Курс</span><b>${fmt(s.true_track)}°</b></div>
    <div class="row"><span>На земле</span><b>${s.on_ground ? 'да' : 'нет'}</b></div>
    <div class="row"><span>ICAO24</span><b>${s.icao24}</b></div>
  </div>`;
  infoEl.innerHTML = html;
}

// ---- search by flight number (SU2173 / AFL2173) ----
document.getElementById('searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const flight = document.getElementById('flightInput').value.trim();
  if (!flight) return;
  statusEl.textContent = 'Поиск рейса ' + flight + '…';
  infoEl.innerHTML = '';
  try {
    const d = await fetch('/api/find?flight=' + encodeURIComponent(flight)).then(r => r.json());
    if (d.error) throw new Error(d.error);
    if (!d.flightroute && !d.state) {
      infoEl.innerHTML = `<div class="card"><span class="err">Рейс «${flight}» не найден.</span></div>`;
      statusEl.textContent = 'Ничего не найдено.';
      return;
    }
    const s = d.state;
    if (s) setSelected(s.icao24);
    render(s || { callsign: flight, icao24: '', origin_country: '—' }, d.flightroute, d.aircraft);
    drawRoute(d.flightroute, s);
    statusEl.textContent = s
      ? `Рейс ${flight} в воздухе — позиция показана.`
      : `Маршрут ${flight} показан (борт сейчас не в эфире).`;
  } catch (err) {
    infoEl.innerHTML = `<div class="card"><span class="err">Ошибка: ${err.message}</span></div>`;
    statusEl.textContent = 'Ошибка поиска.';
  }
});

refresh();
setInterval(refresh, 12000);
map.on('moveend', refresh);
