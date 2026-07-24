"use client";

import { MenuIcon } from "lucide-react";
import * as React from "react";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function DocsMobileNav() {
  const [open, setOpen] = React.useState(false);
  const { t } = useLocale();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="border-b md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-medium">{t.docsUi.browse}</div>
          <SheetTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t.docsUi.openMenu}
              />
            }
          >
            <MenuIcon className="size-4" />
          </SheetTrigger>
        </div>
      </div>
      <SheetPopup side="left" className="w-[min(100%,20rem)] p-0" showCloseButton>
        <SheetHeader className="border-b">
          <SheetTitle>{t.docsUi.brandShort}</SheetTitle>
        </SheetHeader>
        <SheetPanel className="p-0">
          <DocsSidebar onNavigate={() => setOpen(false)} />
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}
