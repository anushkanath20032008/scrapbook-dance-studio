import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/** A pop-up in the console's window style, so adding or editing is always in front of the owner. */
export function ConsoleDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="console-dialog p-0 border-0 bg-transparent shadow-none max-w-xl max-h-[92vh] overflow-y-auto"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="window">
          <div className="window-bar chrome-font">{title}</div>
          <div className="window-inner">{children}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
