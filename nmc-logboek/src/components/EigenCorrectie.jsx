import { useEffect, useState, useRef } from "react";
import { getCorrigeerbaar } from "../api.js";

const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Toont de eigen, zojuist opgeslagen invoer zolang die nog gecorrigeerd mag
// worden. De resterende tijd komt van de server (databaseklok); hier wordt
// alleen lokaal afgeteld voor de weergave — de server beslist bij het opslaan.
export default function EigenCorrectie({ onStart, verversToken }) {
  const [info, setInfo] = useState(null);
  const [resterend, setResterend] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    let afgebroken = false;
    getCorrigeerbaar()
      .then(data => {
        if (afgebroken) return;
        setInfo(data);
        setResterend(data?.resterend_seconden ?? 0);
      })
      .catch(() => {});
    return () => { afgebroken = true; };
  }, [verversToken]);

  useEffect(() => {
    if (!info || resterend <= 0) return;
    timer.current = setInterval(() => {
      setResterend(v => {
        if (v <= 1) {
          clearInterval(timer.current);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(timer.current);
  }, [info]);

  if (!info) return null;

  const tijdstip = String(info.opgeslagen || "").slice(11, 16);
  const verstreken = resterend <= 0;

  return (
    <div className={`correctie-blok${verstreken ? " verstreken" : ""}`}>
      <div className="correctie-kop">✏ Uw invoer van {info.datum}</div>
      <div className="correctie-regel">
        {info.shift || "—"}{tijdstip ? ` · opgeslagen ${tijdstip}` : ""}
      </div>
      {verstreken ? (
        <div className="correctie-regel">
          Het correctievenster is verstreken — vraag de chef om de aanpassing te doen.
        </div>
      ) : (
        <>
          <div className="correctie-regel">
            Nog <strong>{mmss(resterend)}</strong> om zelf te corrigeren.
          </div>
          <button type="button" className="btn btn-correctie" onClick={() => onStart(info.entry)}>
            Corrigeren
          </button>
        </>
      )}
    </div>
  );
}
