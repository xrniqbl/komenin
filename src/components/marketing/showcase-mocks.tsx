"use client";

import BarChartIcon from '@mui/icons-material/BarChartRounded';
import EventAvailableIcon from '@mui/icons-material/EventAvailableRounded';
import MessageIcon from '@mui/icons-material/MessageRounded';
import SendIcon from '@mui/icons-material/SendRounded';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesomeRounded';
import { Badge } from "@/components/ui/badge";

/**
 * Mockup kartu untuk Product Showcase section.
 * Visual saja — tidak memanggil API.
 */

export function ApprovalQueueCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex h-full flex-col glass rounded-xl p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-electric-500/15">
        <MessageIcon className="h-5 w-5 text-electric-400" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>
      <div className="mt-4 space-y-2">
        <div className="rounded-lg bg-white/5 p-2.5 text-[11px] leading-relaxed text-neutral-300">
          &ldquo;Kak, produk ini ready stock?&rdquo;
        </div>
        <div className="rounded-lg border border-electric-500/20 bg-electric-500/5 p-2.5 text-[11px] leading-relaxed text-neutral-200">
          Ready kak! Stok tersedia di semua varian. Mau saya bantu proses checkout?
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <span className="flex h-7 flex-1 items-center justify-center rounded-md bg-electric-600 text-[11px] font-medium text-white">
          Approve
        </span>
        <span className="flex h-7 flex-1 items-center justify-center rounded-md border border-white/15 text-[11px] text-neutral-300">
          Reject
        </span>
      </div>
    </div>
  );
}

export function CampaignCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex h-full flex-col glass rounded-xl p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-electric-500/15">
        <EventAvailableIcon className="h-5 w-5 text-electric-400" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-neutral-400">Progress</span>
          <span className="font-medium text-electric-300">68%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[68%] rounded-full bg-electric-500" />
        </div>
      </div>
      <div className="mt-4 space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between rounded-md bg-white/5 px-2.5 py-1.5">
          <span className="text-neutral-300">Instagram</span>
          <Badge variant="outline" className="border-white/15 text-[10px] text-neutral-400">
            342 sent
          </Badge>
        </div>
        <div className="flex items-center justify-between rounded-md bg-white/5 px-2.5 py-1.5">
          <span className="text-neutral-300">Threads</span>
          <Badge variant="outline" className="border-white/15 text-[10px] text-neutral-400">
            187 sent
          </Badge>
        </div>
        <div className="flex items-center justify-between rounded-md bg-white/5 px-2.5 py-1.5">
          <span className="text-neutral-300">TikTok</span>
          <Badge variant="outline" className="border-white/15 text-[10px] text-neutral-400">
            96 queued
          </Badge>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsCard({ title, subtitle }: { title: string; subtitle: string }) {
  const bars = [40, 65, 52, 80, 58, 92, 74];
  return (
    <div className="flex h-full flex-col glass rounded-xl p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-electric-500/15">
        <BarChartIcon className="h-5 w-5 text-electric-400" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>
      <div className="mt-4 flex h-20 items-end justify-between gap-1.5">
        {bars.map((height, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-electric-500/70"
            style={{ height: `${height}%`, opacity: 0.4 + (height / 100) * 0.6 }}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-md bg-white/5 px-2 py-1.5">
          <div className="text-sm font-semibold text-white">98.2%</div>
          <div className="text-[10px] text-neutral-500">Reply rate</div>
        </div>
        <div className="rounded-md bg-white/5 px-2 py-1.5">
          <div className="text-sm font-semibold text-white">4.9/5</div>
          <div className="text-[10px] text-neutral-500">Sentiment</div>
        </div>
      </div>
    </div>
  );
}

export function CampaignInputBar({ placeholder }: { placeholder: string }) {
  return (
    <div className="flex items-center gap-2 glass rounded-xl p-2 pl-4">
      <AutoAwesomeIcon className="h-4 w-4 shrink-0 text-electric-400" />
      <span className="flex-1 truncate text-xs text-neutral-500">{placeholder}</span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-electric-600">
        <SendIcon className="h-4 w-4 text-white" />
      </span>
    </div>
  );
}
