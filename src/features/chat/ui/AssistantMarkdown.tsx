import Markdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

interface AssistantMarkdownProps {
  readonly content: string
}

export const AssistantMarkdown = ({ content }: AssistantMarkdownProps) => (
  <div className="message-inline message-markdown">
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        code(props) {
          const { className, children, ...rest } = props
          return (
            <code className={className ?? 'message-markdown__inline-code'} {...rest}>
              {children}
            </code>
          )
        },
        pre(props) {
          return <pre className="message-markdown__pre" {...props} />
        },
        a(props) {
          return <a target="_blank" rel="noreferrer" {...props} />
        },
      }}
    >
      {content}
    </Markdown>
  </div>
)
