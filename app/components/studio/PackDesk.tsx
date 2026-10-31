import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { IconArrowLeft, IconDownload } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fieldHint,
  fieldLabel,
  normalizeCardValue,
  parsePalette,
  type PackCard,
} from "@shared/pack";

interface ExportPreview {
  filename: string;
  html: string;
  signature: string;
}

function cardSignature(cards: PackCard[]): string {
  return cards.map((card) => `${card.id}:${card.status}:${card.value}`).join("|");
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PackDesk({ packId }: { packId: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  const packQuery = useActionQuery("get-pack", { id: packId });
  const eventsQuery = useActionQuery("list-pack-events", { id: packId, limit: 40 });
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const pack = packQuery.data;
  const signature = pack ? cardSignature(pack.cards) : "";

  useEffect(() => {
    setPreview((current) => {
      if (!current || current.signature === signature) return current;
      return null;
    });
  }, [signature]);

  const exportPack = useActionMutation("export-pack", {
    onSuccess: (result) => {
      setPreview({
        filename: result.filename,
        html: result.html,
        signature,
      });
    },
    onError: (error) => {
      toast.error(actionErrorMessage(error) ?? t("studio.exportFailed"));
    },
  });

  if (packQuery.isPending) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_18rem]" aria-hidden="true">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-36 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (packQuery.isError || !pack) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
        <p className="text-sm text-muted-foreground">{t("studio.unavailable")}</p>
        <Link to="/studio" className="text-sm underline">
          {t("studio.back")}
        </Link>
      </div>
    );
  }

  const download = () => {
    if (!preview) return;
    const blob = new Blob([preview.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = preview.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/studio"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="size-4" strokeWidth={1.8} />
          {t("studio.back")}
        </Link>
        <p className="text-sm text-muted-foreground" role="status">
          {t("studio.approvedCount", { approved: pack.approvedCount })}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-3">
          {pack.cards.map((card) => (
            <CardRow
              key={card.id}
              packId={packId}
              card={card}
              onSaved={() => {
                void queryClient.invalidateQueries({ queryKey: ["action", "get-pack"] });
                void queryClient.invalidateQueries({
                  queryKey: ["action", "list-pack-events"],
                });
              }}
            />
          ))}
        </div>

        <aside className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:sticky lg:top-4 lg:self-start">
          <h2 className="text-sm font-medium">{t("studio.logTitle")}</h2>
          {eventsQuery.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : eventsQuery.data && eventsQuery.data.events.length > 0 ? (
            <ol className="flex max-h-[32rem] flex-col gap-3 overflow-auto">
              {eventsQuery.data.events.map((event) => (
                <li key={event.id} className="text-sm">
                  <div className="text-xs text-muted-foreground">
                    <time dateTime={event.createdAt}>{formatWhen(event.createdAt)}</time>
                    {" · "}
                    {event.action}
                  </div>
                  <p>{event.summary}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">{t("studio.logEmpty")}</p>
          )}
        </aside>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">{t("studio.exportHint")}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={exportPack.isPending}
            onClick={() => exportPack.mutate({ id: packId })}
          >
            {exportPack.isPending ? t("studio.exporting") : t("studio.exportPage")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              sendToAgentChat({
                message:
                  "Revise only the level3 card on this pack. Make the goal more specific and playful, call edit-card, then call get-pack and tell me the new level3 text and that it is draft again.",
                context: JSON.stringify({ packId }),
                submit: true,
                openSidebar: true,
              });
            }}
          >
            {t("studio.reviseLevel")}
          </Button>
          {preview ? (
            <Button type="button" variant="outline" onClick={download}>
              <IconDownload className="size-4" strokeWidth={1.8} />
              {t("studio.download")}
            </Button>
          ) : null}
        </div>
        {preview ? (
          <iframe
            title={t("studio.previewTitle")}
            sandbox=""
            srcDoc={preview.html}
            className="h-96 w-full rounded-lg border border-border bg-background"
          />
        ) : null}
      </div>
    </div>
  );
}

function CardRow({
  packId,
  card,
  onSaved,
}: {
  packId: string;
  card: PackCard;
  onSaved: () => void;
}) {
  const t = useT();
  const [value, setValue] = useState(card.value);

  useEffect(() => {
    setValue(card.value);
  }, [card.value]);

  const normalized = normalizeCardValue(card.field, value);
  const dirty = !normalized.ok || normalized.value !== card.value;
  const palette = card.field === "palette" ? parsePalette(card.value) : null;

  const edit = useActionMutation("edit-card", {
    onSuccess: () => onSaved(),
    onError: (error) => {
      toast.error(actionErrorMessage(error) ?? t("studio.editFailed"));
    },
  });
  const approve = useActionMutation("approve-card", {
    onSuccess: () => onSaved(),
    onError: (error) => {
      toast.error(actionErrorMessage(error) ?? t("studio.approveFailed"));
    },
  });

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!dirty || edit.isPending) return;
        edit.mutate({ id: packId, cardId: card.id, value });
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">{fieldLabel(card.field)}</h2>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {dirty ? t("studio.unsaved") : card.status === "approved" ? t("studio.approved") : t("studio.draft")}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={card.field.startsWith("level") ? 3 : 2}
        maxLength={500}
        aria-label={fieldLabel(card.field)}
        className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <p className="text-xs text-muted-foreground">{fieldHint(card.field)}</p>
      {palette?.ok ? (
        <div className="flex gap-2" aria-hidden="true">
          {palette.colors.map((color) => (
            <span
              key={color}
              className="size-6 rounded-full border border-border"
              style={{ background: color }}
            />
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={!dirty || edit.isPending}>
          {edit.isPending ? t("studio.saving") : t("studio.save")}
        </Button>
        <Button
          type="button"
          disabled={dirty || card.status === "approved" || approve.isPending}
          onClick={() => approve.mutate({ id: packId, cardId: card.id })}
        >
          {approve.isPending ? t("studio.approving") : t("studio.approve")}
        </Button>
      </div>
    </form>
  );
}
