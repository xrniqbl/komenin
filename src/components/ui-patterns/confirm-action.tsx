"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ConfirmActionProps = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  disabled?: boolean;
  trigger: React.ReactElement;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmAction({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  disabled,
  trigger,
  onConfirm,
}: ConfirmActionProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger} disabled={disabled} />
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="glass" disabled={pending} />}>
            {cancelLabel}
          </AlertDialogClose>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await onConfirm();
                setOpen(false);
              });
            }}
          >
            {pending ? "Working..." : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
