import { CheckCircle2, CircleDashed, Globe, Phone, Power, Trash2, Zap } from "lucide-react";
import { ChannelIcon } from "@/components/crm/ChannelIcon";
import {
  addChannelConnection,
  addLeadSource,
  deleteChannelConnection,
  testChannelConnection,
  toggleChannelConnection,
} from "@/app/crm/settings/actions";
import { CHANNEL_LABEL, type Channel } from "@/types/db";

export type ConnectionRow = {
  id: string | null; // null = WhatsApp from .env
  channel: Channel;
  kind: "messaging" | "leads";
  label: string | null;
  account_id: string;
  enabled: boolean;
};

const mask = (id: string) => (id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id);

export function ChannelsSection({
  connections,
  isAdmin,
  siteUrl,
  webhookReady,
}: {
  connections: ConnectionRow[];
  isAdmin: boolean;
  siteUrl: string;
  webhookReady: boolean;
}) {
  const messaging = connections.filter((c) => c.kind === "messaging");
  const leadSources = connections.filter((c) => c.kind === "leads");

  return (
    <section id="channels" className="card scroll-mt-6 p-5">
      <h2 className="font-display text-base font-bold">Channels</h2>
      <p className="mt-1 text-sm text-slate-500">Every connected channel drops its chats and leads into the Omnichannel Inbox.</p>

      <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200">
        <li className="flex items-center gap-3 px-4 py-3">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-white">
            <Globe className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Website chat &amp; booking form</p>
            <p className="text-xs text-slate-500">Built in. Visitors chat from the bubble on your website.</p>
          </div>
          <Status on />
        </li>
        <li className="flex items-center gap-3 px-4 py-3">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-600 text-white">
            <Phone className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Phone calls &amp; walk-ins</p>
            <p className="text-xs text-slate-500">Log them with the + button in the Inbox or “Add lead” in the Pipeline.</p>
          </div>
          <Status on />
        </li>
        {messaging.map((c) => (
          <ConnectionItem key={c.id ?? `env-${c.account_id}`} c={c} isAdmin={isAdmin} detail={`ID ${mask(c.account_id)}`} />
        ))}
        {leadSources.map((c) => (
          <ConnectionItem
            key={c.id}
            c={c}
            isAdmin={isAdmin}
            detail={isAdmin ? `${siteUrl}/api/webhooks/leads?key=${c.account_id}` : "Lead webhook"}
            copyable={isAdmin}
          />
        ))}
      </ul>

      {isAdmin && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <form action={addChannelConnection} className="space-y-2 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-ink">Connect WhatsApp, Instagram or Facebook</p>
            <p className="text-xs text-slate-500">
              From the Meta app: WhatsApp → Phone number ID + system user token; Facebook → Page ID + Page token; Instagram → Instagram
              account ID + token.
            </p>
            <select name="channel" className="crm-input" defaultValue="whatsapp">
              {(["whatsapp", "instagram", "facebook"] as Channel[]).map((ch) => (
                <option key={ch} value={ch}>
                  {CHANNEL_LABEL[ch]}
                </option>
              ))}
            </select>
            <input name="label" placeholder="Name (e.g. Main WhatsApp, @rumidental)" className="crm-input" />
            <input name="account_id" required inputMode="numeric" placeholder="Phone number ID / Page ID / Instagram ID" className="crm-input" />
            <input name="access_token" required type="password" autoComplete="off" placeholder="Access token" className="crm-input" />
            <button className="crm-btn w-full">Add channel</button>
          </form>

          <form action={addLeadSource} className="space-y-2 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-ink">Add a lead source (Google, TikTok, other forms)</p>
            <p className="text-xs text-slate-500">
              Creates a private webhook URL. Paste it in Google Ads lead form → Webhook, or in Zapier / Make for TikTok lead forms.
            </p>
            <select name="channel" className="crm-input" defaultValue="google">
              {(["google", "tiktok", "facebook", "instagram", "website"] as Channel[]).map((ch) => (
                <option key={ch} value={ch}>
                  {CHANNEL_LABEL[ch]}
                </option>
              ))}
            </select>
            <input name="label" required placeholder="Name shown on leads (e.g. Google Ads form)" className="crm-input" />
            <button className="crm-btn w-full">
              <Zap className="h-4 w-4" /> Create lead webhook
            </button>
          </form>
        </div>
      )}

      <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
        <p className="font-semibold text-slate-700">Webhooks to paste in the Meta app (developer)</p>
        <p className="mt-2">WhatsApp → Configuration → Callback URL (subscribe: messages)</p>
        <Code>{siteUrl}/api/webhooks/whatsapp</Code>
        <p className="mt-2">Messenger and Instagram → Webhooks (subscribe: messages, messaging_postbacks; leadgen for lead forms)</p>
        <Code>{siteUrl}/api/webhooks/meta</Code>
        <p className={webhookReady ? "mt-2 text-emerald-700" : "mt-2 text-amber-700"}>
          {webhookReady
            ? "META_APP_SECRET and META_WEBHOOK_VERIFY_TOKEN are set."
            : "Set META_APP_SECRET and META_WEBHOOK_VERIFY_TOKEN in .env first (see README)."}
        </p>
      </div>
    </section>
  );
}

function ConnectionItem({ c, isAdmin, detail, copyable }: { c: ConnectionRow; isAdmin: boolean; detail: string; copyable?: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <ChannelIcon channel={c.channel} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {c.label || CHANNEL_LABEL[c.channel]}
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
            {c.kind === "leads" ? `${CHANNEL_LABEL[c.channel]} leads` : CHANNEL_LABEL[c.channel]}
          </span>
        </p>
        {copyable ? (
          <input readOnly value={detail} className="mt-1 w-full rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600 ring-1 ring-slate-200" aria-label="Webhook URL" />
        ) : (
          <p className="text-xs text-slate-500">{detail}</p>
        )}
      </div>
      <Status on={c.enabled} />
      {isAdmin && c.id && (
        <div className="flex items-center gap-1">
          {c.kind === "messaging" && (
            <form action={testChannelConnection.bind(null, c.id)}>
              <button className="crm-btn-outline px-2.5 py-1 text-xs">Test</button>
            </form>
          )}
          <form action={toggleChannelConnection.bind(null, c.id, !c.enabled)}>
            <button className="crm-btn-outline px-2.5" aria-label={c.enabled ? "Disable" : "Enable"} title={c.enabled ? "Disable" : "Enable"}>
              <Power className="h-4 w-4" />
            </button>
          </form>
          <form action={deleteChannelConnection.bind(null, c.id)}>
            <button className="crm-btn-outline px-2.5 hover:border-red-300 hover:text-red-600" aria-label="Remove" title="Remove">
              <Trash2 className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
      {!c.id && <span className="text-[11px] text-slate-400">from .env</span>}
    </li>
  );
}

function Status({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
      <CheckCircle2 className="h-4 w-4" /> Live
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
      <CircleDashed className="h-4 w-4" /> Off
    </span>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="mt-1 block break-all rounded bg-white px-2 py-1.5 text-[11px] text-ink ring-1 ring-slate-200">{children}</code>;
}
