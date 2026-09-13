import { OpenNewWindow } from "iconoir-react";
import { fileUrl } from "@/lib/api";
import { Empty } from "./empty";

export function PdfViewer({ path, title }: { path: string | null | undefined; title: string }) {
  if (!path) return <Empty message={`${title}: no PDF yet`} />;
  const url = fileUrl(path);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{title}</span>
        <a className="inline-flex items-center gap-1 text-muted-foreground hover:underline" href={url} target="_blank" rel="noreferrer">
          open <OpenNewWindow className="size-3.5" aria-hidden />
        </a>
      </div>
      <iframe title={title} src={url} className="h-[70dvh] w-full rounded-md border bg-white" />
    </div>
  );
}
