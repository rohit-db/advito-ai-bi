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
          <h1 className={`${compact ? "text-sm" : "text-lg"} font-bold text-gray-900 mt-3 mb-1`}>{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className={`${compact ? "text-xs font-bold" : "text-base font-bold"} text-gray-900 mt-3 mb-1`}>{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className={`${base} font-semibold text-gray-800 mt-2 mb-0.5`}>{children}</h3>
        ),
        p: ({ children }) => (
          <p className={`${base} text-gray-800 leading-relaxed mb-2`}>{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className={`list-disc list-inside ${base} text-gray-800 mb-2 space-y-0.5`}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className={`list-decimal list-inside ${base} text-gray-800 mb-2 space-y-0.5`}>{children}</ol>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full text-xs border border-gray-200 rounded">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-gray-50 font-semibold">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-2 py-1 text-left border-b border-gray-200 whitespace-nowrap">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-2 py-1 border-b border-gray-100 whitespace-nowrap">{children}</td>
        ),
        code: ({ children, className }) => {
          const isInline = !className;
          return isInline ? (
            <code className="bg-gray-100 text-gray-800 text-xs px-1 py-0.5 rounded">{children}</code>
          ) : (
            <pre className="bg-gray-50 text-xs p-2 rounded-md overflow-x-auto my-2">
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
