import type { ReactNode } from 'react'
import Markdown from 'react-markdown'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { MarkdownCodeBlock } from './MarkdownCodeBlock'

interface AssistantMarkdownProps {
  readonly content: string
}

const markdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  attributes: {
    ...defaultSchema.attributes,
    th: [...((defaultSchema.attributes?.th as string[] | undefined) ?? []), 'align'],
    td: [...((defaultSchema.attributes?.td as string[] | undefined) ?? []), 'align'],
  },
}

export const AssistantMarkdown = ({ content }: AssistantMarkdownProps) => (
  <div className="message-markdown">
    <Markdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeSanitize, markdownSanitizeSchema], rehypeKatex]}
      components={{
        code(props: {
          readonly className?: string
          readonly children?: ReactNode
          readonly inline?: boolean
        }) {
          const { className, children, inline, ...rest } = props
          const codeText = String(children ?? '').replace(/\n$/, '')

          if (!inline) {
            return <MarkdownCodeBlock code={codeText} className={className} />
          }

          return (
            <code className={className ?? 'message-markdown__inline-code'} {...rest}>
              {children}
            </code>
          )
        },
        a(props) {
          return <a target="_blank" rel="noreferrer" {...props} />
        },
        pre(props) {
          return <>{props.children}</>
        },
      }}
    >
      {content}
    </Markdown>
  </div>
)
