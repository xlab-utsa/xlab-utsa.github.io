import ReactMarkdown from "react-markdown";

import { cn } from "@/lib/utils";

// Renders markdown body text (Post.body, ResearchTheme.longDescription) safely, no
// dangerouslySetInnerHTML. Typography comes from the `.prose-content` rules in
// globals.css rather than @tailwindcss/typography — the content here is plain
// CommonMark (headings/lists/bold/links), not worth a whole plugin dependency for.
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("prose-content", className)}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
