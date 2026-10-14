"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@conecta-agenda/ui";

export function AppDialog({
  children,
  title,
  onClose,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    dialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      role="dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target !== dialog.current) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          dialog.current.close();
      }}
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 text-slate-950 shadow-xl backdrop:bg-slate-950/35 backdrop:backdrop-blur-sm"
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <Button
          autoFocus
          aria-label="Fechar"
          type="button"
          size="sm"
          variant="outline"
          onClick={() => dialog.current?.close()}
        >
          <X aria-hidden="true" className="size-4" />
          Fechar
        </Button>
      </div>
      {children}
    </dialog>
  );
}
