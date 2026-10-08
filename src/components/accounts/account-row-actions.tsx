"use client";

import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toastManager } from "@/components/ui/toast";
import { rotateAccountIp, runAccountHealthCheck } from "@/server/accounts";

export function AccountRowActions({ accountId }: { accountId: string }) {
  const [pending, startTransition] = useTransition();

  function runAction(kind: "probe" | "rotate") {
    startTransition(async () => {
      try {
        if (kind === "probe") {
          await runAccountHealthCheck(accountId);
          toastManager.add({
            title: "Health probe queued",
            description: "Account health check started.",
            type: "success",
          });
          return;
        }
        await rotateAccountIp(accountId);
        toastManager.add({
          title: "IP rotation requested",
          description: "Proxy rotation has been scheduled.",
          type: "success",
        });
      } catch (error) {
        toastManager.add({
          title: kind === "probe" ? "Probe failed" : "Rotation failed",
          description: error instanceof Error ? error.message : "Action failed",
          type: "error",
        });
      }
    });
  }

  return (
    <div className="flex justify-end">
      <Menu>
        <Tooltip>
          <TooltipTrigger
            render={
              <MenuTrigger
                disabled={pending}
                className="inline-flex"
                render={
                  <Button
                    variant="glass"
                    size="icon-sm"
                    disabled={pending}
                    aria-label="Account actions"
                  />
                }
              />
            }
          >
            {pending ? <Spinner className="size-4" /> : <MoreHorizRoundedIcon className="size-4" />}
          </TooltipTrigger>
          <TooltipPopup>Account actions</TooltipPopup>
        </Tooltip>
        <MenuPopup align="end">
          <MenuItem disabled={pending} onClick={() => runAction("probe")}>
            Probe health
          </MenuItem>
          <MenuItem disabled={pending} onClick={() => runAction("rotate")}>
            Rotate IP
          </MenuItem>
        </MenuPopup>
      </Menu>
    </div>
  );
}
