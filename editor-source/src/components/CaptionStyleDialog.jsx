import { useEffect, useId, useRef, useState } from "react";
import "./CaptionStyleDialog.css";

export function CaptionStyleDialog({ t, onSave, onCancel, returnFocusRef }) {
  const [name, setName] = useState(() => t("captionStyleUntitled"));
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const returnFocusTarget = returnFocusRef?.current;
    dialog.showModal();
    inputRef.current?.select();
    return () => {
      dialog.close();
      returnFocusTarget?.focus();
    };
  }, [returnFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      className="caption-style-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <form onSubmit={(event) => {
        event.preventDefault();
        const trimmedName = name.trim();
        if (trimmedName) onSave(trimmedName);
      }}>
        <label id={titleId} htmlFor={`${titleId}-name`}>{t("captionStyleNamePrompt")}</label>
        <input
          ref={inputRef}
          id={`${titleId}-name`}
          autoFocus
          autoComplete="off"
          maxLength={120}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <footer>
          <button type="button" onClick={onCancel}>{t("cancel")}</button>
          <button type="submit" disabled={!name.trim()}>{t("captionSaveAsStyle")}</button>
        </footer>
      </form>
    </dialog>
  );
}
