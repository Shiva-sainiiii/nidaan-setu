/** Very light animated background: three soft colour fields drifting slowly + faint dot grid (CSS only). */
export function Ambient() {
  return (
    <div className="ambient" aria-hidden="true">
      <span className="blob b1" />
      <span className="blob b2" />
      <span className="blob b3" />
    </div>
  );
}
