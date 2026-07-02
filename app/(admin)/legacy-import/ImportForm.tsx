"use client";

import { useActionState } from "react";
import { type ImportState, importAction } from "./actions";

const HEADER = "donorName,donorEmail,amountUsd,designationType,targetSlug,occurredAt,note";

export function ImportForm() {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(importAction, {});

  return (
    <form action={formAction} className="mt-6 grid gap-3">
      <p className="text-xs text-black/50">Columns: <code>{HEADER}</code>. amountUsd in dollars; designationType GENERAL/STUDENT/PROJECT; targetSlug for student/project.</p>
      <textarea name="csv" rows={8} required placeholder={`${HEADER}\nAlice Alum,alice@x.test,25,GENERAL,,2020-03-01,`} className="w-full rounded border border-black/15 p-3 font-mono text-xs" />
      <div className="flex gap-2">
        <button type="submit" name="mode" value="dryrun" disabled={pending} className="rounded border border-black/20 px-4 py-2 text-sm font-semibold hover:bg-black/5 disabled:opacity-50">Dry run</button>
        <button type="submit" name="mode" value="commit" disabled={pending} className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85 disabled:opacity-50">Commit import</button>
      </div>

      {state.error && <p className="rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">{state.error}</p>}

      {state.preview && (
        <div className="rounded border border-black/10 p-4 text-sm">
          <p><strong>Dry run</strong> — {state.preview.validCount} valid, {state.preview.errorCount} error(s), {state.preview.totalRows} rows. Nothing was written.</p>
          {state.preview.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-red-800">{state.preview.errors.map((e) => <li key={e.row}>Row {e.row}: {e.message}</li>)}</ul>
          )}
        </div>
      )}

      {state.result && (
        <div className="rounded border border-green-600/30 bg-green-50 p-4 text-sm text-green-900">
          <p><strong>Committed</strong> — imported {state.result.imported}, skipped {state.result.skipped}.</p>
          {state.result.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5">{state.result.errors.map((e) => <li key={e.row}>Row {e.row}: {e.message}</li>)}</ul>
          )}
        </div>
      )}
    </form>
  );
}
