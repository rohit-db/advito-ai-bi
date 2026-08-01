import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
  compact?: boolean;
}

export default function MarkdownContent({ content, compact }: MarkdownContentProps) {
  const base = compact ? "text-xs" : "text-sm";

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className={`${compact ? "text-sm" : "text-lg"} font-semibold text-foreground mt-3 mb-1`}>{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className={`${compact ? "text-xs font-semibold" : "text-base font-semibold"} text-foreground mt-3 mb-1`}>{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className={`${base} font-semibold text-foreground mt-2 mb-0.5`}>{children}</h3>
        ),
        p: ({ children }) => (
          <p className={`${base} text-muted-foreground leading-relaxed mb-2`}>{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className={`list-disc list-inside ${base} text-muted-foreground mb-2 space-y-0.5`}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className={`list-decimal list-inside ${base} text-muted-foreground mb-2 space-y-0.5`}>{children}</ol>
        ),
        li: ({ children }) => (
          <li className="marker:text-muted-foreground">{children}</li>
        ),
        a: ({ children, href }) => (
          <a href={href} className="text-primary hover:text-blue-700 underline">{children}</a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full text-xs border border-border rounded">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-secondary font-semibold text-muted-foreground">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-2 py-1 text-left border-b border-border whitespace-nowrap text-muted-foreground">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-2 py-1 border-b border-border whitespace-nowrap text-muted-foreground">{children}</td>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground">{children}</blockquote>
        ),
        code: ({ children, className }) => {
          const isInline = !className;
          return isInline ? (
            <code className="font-mono bg-secondary text-foreground text-xs px-1 py-0.5 rounded">{children}</code>
          ) : (
            <pre className="font-mono bg-secondary text-foreground text-xs p-2 rounded-md overflow-x-auto my-2">
              <code>{children}</code>
            </pre>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
