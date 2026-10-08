"use client";

import MenuRoundedIcon from '@mui/icons-material/MenuRounded';

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
      <div className="border-b border-white/10 bg-[#0A0F1E]/80 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-medium text-white">{t.docsUi.browse}</div>
          <SheetTrigger
            render={
              <Button
                type="button"
                variant="glass"
                size="icon"
                aria-label={t.docsUi.openMenu}
                className="rounded-full border-white/15 bg-white/5 text-white backdrop-blur-xl hover:border-white/30 hover:bg-white/10 hover:text-white"
              />
            }
          >
            <MenuRoundedIcon className="size-4" />
          </SheetTrigger>
        </div>
      </div>
      <SheetPopup
        side="left"
        className="w-[min(100%,20rem)] border-white/10 bg-[#0A0F1E]/95 p-0 text-white backdrop-blur-xl"
        showCloseButton
      >
        <SheetHeader className="border-b border-white/10">
          <SheetTitle className="text-white">{t.docsUi.brandShort}</SheetTitle>
        </SheetHeader>
        <SheetPanel className="p-0">
          <DocsSidebar onNavigate={() => setOpen(false)} />
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}
