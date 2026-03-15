import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('css', css)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('python', python)
hljs.registerLanguage('typescript', typescript)

interface MarkdownCodeBlockProps {
  readonly code: string
  readonly className?: string
}

const extractLanguage = (className: string | undefined): string => {
  if (!className) {
    return 'text'
  }

  const match = className.match(/language-([\w-]+)/)
  return match?.[1] ?? 'text'
}

export const MarkdownCodeBlock = ({ code, className }: MarkdownCodeBlockProps) => {
  const [isCopied, setIsCopied] = useState(false)
  const language = extractLanguage(className)

  const highlightedCode = useMemo(() => {
    if (language === 'text') {
      return hljs.highlightAuto(code).value
    }

    if (hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value
    }

    return hljs.highlightAuto(code).value
  }, [code, language])

  const copyCode = async () => {
    if (!navigator.clipboard) {
      return
    }

    await navigator.clipboard.writeText(code)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 900)
  }

  return (
    <div className="message-markdown__code-block">
      <div className="message-markdown__code-meta">
        <span className="message-markdown__code-lang">{language}</span>
        <button
          type="button"
          className="message-markdown__code-copy"
          aria-label="Copy code block"
          onClick={() => {
            void copyCode()
          }}
        >
          {isCopied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <pre className="message-markdown__pre">
        <code
          className={className}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>
    </div>
  )
}
