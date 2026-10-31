import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { IconCards } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export function PackList() {
  const t = useT();
  const navigate = useNavigate();
  const [theme, setTheme] = useState("");
  const packs = useActionQuery("list-packs", { limit: 50 });
  const draft = useActionMutation("draft-pack", {
    onSuccess: (result) => {
      navigate(`/studio/${result.id}`);
    },
    onError: (error) => {
      toast.error(actionErrorMessage(error) ?? t("studio.draftFailed"));
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <form
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const next = theme.trim();
          if (!next || draft.isPending) return;
          draft.mutate({ theme: next });
        }}
      >
        <Label htmlFor="pack-theme">{t("studio.themeLabel")}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="pack-theme"
            value={theme}
            maxLength={80}
            placeholder={t("studio.themePlaceholder")}
            onChange={(event) => setTheme(event.target.value)}
            required
          />
          <Button type="submit" disabled={draft.isPending || theme.trim().length === 0}>
            <IconCards className="size-4" strokeWidth={1.8} />
            {draft.isPending ? t("studio.drafting") : t("studio.draftCards")}
          </Button>
        </div>
      </form>

      {packs.isPending ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : packs.isError ? (
        <p className="text-sm text-muted-foreground">{t("studio.listFailed")}</p>
      ) : packs.data && packs.data.packs.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {packs.data.packs.map((pack) => (
            <li key={pack.id}>
              <Link
                to={`/studio/${pack.id}`}
                className="flex items-baseline justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-accent"
              >
                <span className="truncate font-medium">{pack.title}</span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {t("studio.approvedCount", { approved: pack.approvedCount })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("studio.empty")}</p>
      )}
    </div>
  );
}
