import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";

interface Props extends Omit<ButtonProps, "onClick"> {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => unknown;
  destructive?: boolean;
  /** Require typing this word to confirm (for emergency actions). */
  typeToConfirm?: string;
}

export function ConfirmButton({ title, description, confirmLabel = "Confirm", onConfirm, destructive, typeToConfirm, children, ...btn }: Props) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); setTyped(""); }}>
      <AlertDialogTrigger asChild>
        <Button {...btn}>{children}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-border bg-popover">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display uppercase tracking-wide">{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {typeToConfirm && (
          <div className="space-y-1">
            <div className="label-caps">Type {typeToConfirm} to confirm</div>
            <input autoFocus className="field" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || (!!typeToConfirm && typed.trim().toUpperCase() !== typeToConfirm.toUpperCase())}
            className={destructive ? "bg-program text-program-foreground hover:bg-program/85" : undefined}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await onConfirm();
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
