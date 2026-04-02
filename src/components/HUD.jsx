export default function HUD({ data }) {
  if (!data) return null;
  const { score, bombs, bombMax, planeHP, planeMaxHP, airportHP, airportMaxHP, zoom, nozzleAngle } = data;
  const hpPct = Math.max(0, planeHP / planeMaxHP * 100);
  const apPct = Math.max(0, airportHP / airportMaxHP * 100);

  return (
    <div className="hud">
      <div>Score: {score}</div>
      <div>
        Bombs: {bombs} / {bombMax}
        {bombs === 0 && <span style={{ color: '#f44', fontWeight: 'bold' }}> RELOAD! Land on runway!</span>}
      </div>
      <div>
        Plane HP: <span className="bar-bg"><span className="bar-fill" style={{
          width: hpPct + '%',
          background: planeHP > 50 ? '#4f4' : planeHP > 25 ? '#fa0' : '#f44'
        }} /></span>
      </div>
      <div>
        Airport HP: <span className="bar-bg"><span className="bar-fill" style={{
          width: apPct + '%',
          background: airportHP > 100 ? '#48f' : airportHP > 50 ? '#fa0' : '#f44'
        }} /></span>
      </div>
      <div>Zoom: {zoom.toFixed(1)}x &nbsp; Nozzle: {nozzleAngle}°</div>
    </div>
  );
}
