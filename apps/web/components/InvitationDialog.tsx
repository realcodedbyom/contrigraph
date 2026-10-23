"use client";
import { useRef, useState } from "react";
import { Field, Modal } from "./WorkspaceUI";

export default function InvitationDialog({
  memberName,
  code,
  busy,
  error,
  close,
  retry,
}: {
  memberName: string;
  code: string;
  busy: boolean;
  error: string;
  close: () => void;
  retry: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setCopyError("");
    } catch {
      input.current?.focus();
      input.current?.select();
      setCopyError(
        "Automatic copying is unavailable. Copy the selected code manually.",
      );
    }
  }
  return (
    <Modal title={`Invite ${memberName}`} close={close}>
      <div className="cg-form">
        <p>
          Share this single-use code privately with your teammate. They can sign
          in and choose <strong>Join with invitation</strong> to join this
          project.
        </p>
        {busy && <p role="status">Preparing the invitation…</p>}
        {error && (
          <div className="cg-alert" role="alert">
            <p>{error}</p>
            <button type="button" onClick={retry} disabled={busy}>
              Try again
            </button>
          </div>
        )}
        {code && (
          <>
            <Field label="Invitation code">
              <input
                ref={input}
                value={code}
                readOnly
                autoComplete="off"
                spellCheck={false}
                onFocus={(e) => e.currentTarget.select()}
              />
            </Field>
            <button type="button" className="cg-primary" onClick={copy}>
              {copied ? "Copied" : "Copy invitation code"}
            </button>
            <p role="status" aria-live="polite">
              {copyError ||
                (copied
                  ? "Code copied. Share it only with the intended teammate."
                  : "Generating a new invitation for this teammate replaces the previous code.")}
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
