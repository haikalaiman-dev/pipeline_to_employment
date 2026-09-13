import ReactMarkdown from "react-markdown";

export function MarkdownView({ markdown }: { markdown: string }) {
  return (
    <div className="md text-sm leading-6">
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </div>
  );
}
