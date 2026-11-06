import { useState, type ReactElement } from "react";
import type { OpenException } from "./types";

export function ExceptionRow({
  exception,
}: {
  exception: OpenException;
}): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <li className={`wh-exception wh-exception--${exception.severity}`}>
      <div className="wh-exception__head">
        <span className="wh-exception__severity">{exception.severity}</span>
        <span className="wh-exception__where">
          {exception.siteCode} / {exception.pathId}
        </span>
      </div>
      <p className="wh-exception__summary">{exception.summary}</p>
      {exception.evidence.length > 0 && (
        <>
          <button
            type="button"
            className="wh-exception__toggle"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide evidence" : `Evidence (${exception.evidence.length})`}
          </button>
          {open && (
            <ul className="wh-exception__evidence">
              {exception.evidence.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
}
