import { useState, useRef, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import ReactMarkdown from 'react-markdown'
import {
  Send, Upload, ImagePlus, Download,
  X, CheckCircle, AlertCircle, Zap
} from 'lucide-react'
import clsx from 'clsx'

const MATERIAL_CHIPS = [
  { label: 'Banner',         icon: '\uD83D\uDDBC\uFE0F', prompt: 'Crie um banner' },
  { label: 'Post Instagram', icon: '\uD83D\uDCF8', prompt: 'Crie um post Instagram' },
  { label: 'Stories',        icon: '\uD83D\uDCF1', prompt: 'Crie uma sequ\u00eancia de Stories' },
  { label: 'Ficha T\u00e9cnica',  icon: '\uD83D\uDCC4', prompt: 'Crie uma ficha t\u00e9cnica' },
  { label: 'E-mail',         icon: '\u2709\uFE0F',  prompt: 'Crie um e-mail marketing' },
  { label: 'LinkedIn',       icon: '\uD83D\uDCBC', prompt: 'Crie um carrossel LinkedIn' },
  { label: 'Google Ads',     icon: '\uD83C\uDFAF', prompt: 'Crie an\u00fancios Google Ads' },
  { label: 'Meta Ads',       icon: '\uD83D\uDCE3', prompt: 'Crie an\u00fancios Meta Ads' },
  { label: 'Landing Page',   icon: '\uD83C\uDF10', prompt: 'Crie uma landing page' },
  { label: 'WhatsApp',       icon: '\uD83D\uDCAC', prompt: 'Crie um script WhatsApp' },
]

const FORMAT_ICON = { png: '\uD83D\uDDBC\uFE0F', pdf: '\uD83D\uDCC4', html: '\uD83C\uDF10', txt: '\uD83D\uDCDD' }

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-brand-blue animate-pulse-dot"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  )
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={clsx('flex gap-3 animate-slide-up', isUser && 'flex-row-reverse')}>
      <div className={clsx(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
        isUser ? 'bg-brand-orange text-white' : 'bg-brand-dark text-white'
      )}>
        {isUser ? 'V' : 'B'}
      </div>

      <div className={clsx(
        'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
        isUser
          ? 'bg-brand-dark text-white rounded-tr-sm'
          : 'bg-white text-brand-text rounded-tl-sm border border-slate-100'
      )}>
        {msg.imagePreview && (
          <img src={msg.imagePreview} alt="refer\u00eancia" className="w-full max-w-xs rounded-lg mb-2 object-cover" />
        )}

        {msg.typing ? <TypingDots /> : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
              code: ({ children }) => <code className="bg-slate-100 text-brand-blue rounded px-1 text-xs">{children}</code>,
              pre: ({ children }) => <pre className="bg-slate-100 rounded-lg p-3 overflow-x-auto text-xs mt-2">{children}</pre>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}

        {msg.files && msg.files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {msg.files.map((f, i) => (
              <a
                key={i}
                href={`/api/download?path=${encodeURIComponent(f.path)}`}
                download
                className="flex items-center gap-1.5 bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-dark text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
              >
                <span>{FORMAT_ICON[f.format] || '\uD83D\uDCC1'}</span>
                <span>{f.name}</span>
                <Download className="w-3 h-3" />
              </a>
            ))}
          </div>
        )}

        {msg.previews && msg.previews.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`preview ${i + 1}`}
            className="mt-3 w-full rounded-xl border border-slate-200 shadow-md object-contain max-h-64"
          />
        ))}
      </div>
    </div>
  )
}

function UploadReferencia({ onUpload }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [descricao, setDescricao] = useState('')
  const [tipo, setTipo] = useState('banner')
  const [status, setStatus] = useState(null)
  const [msg, setMsg] = useState('')

  const onDrop = useCallback(accepted => {
    if (!accepted.length) return
    const f = accepted[0]
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
  })

  const handleSubmit = async () => {
    if (!file) return
    setStatus('loading')
    const form = new FormData()
    form.append('file', file)
    form.append('material_type', tipo)
    form.append('description', descricao)
    try {
      const res = await fetch('/api/referencias/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Erro no upload')
      setStatus('ok')
      setMsg(`Refer\u00eancia "${data.title}" salva no Obsidian \u2713`)
      onUpload && onUpload(data)
      setTimeout(() => { setOpen(false); setStatus(null); setFile(null); setPreview(null); setDescricao('') }, 2200)
    } catch (e) {
      setStatus('error')
      setMsg(e.message)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-blue transition-colors"
        title="Enviar refer\u00eancia visual"
      >
        <ImagePlus className="w-4 h-4" />
        <span className="hidden sm:inline">Refer\u00eancia</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-brand-dark">Enviar refer\u00eancia visual</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>

            <div
              {...getRootProps()}
              className={clsx(
                'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors mb-4',
                isDragActive ? 'border-brand-blue bg-brand-blue/5' : 'border-slate-200 hover:border-brand-blue/60'
              )}
            >
              <input {...getInputProps()} />
              {preview ? (
                <img src={preview} alt="preview" className="max-h-40 mx-auto rounded-lg object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Upload className="w-8 h-8" />
                  <p className="text-sm">Arraste uma imagem ou clique para selecionar</p>
                  <p className="text-xs">PNG, JPG, WEBP</p>
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de material</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
              >
                {['banner','instagram','stories','ficha tecnica','email','linkedin','landing page','card','proposta','google ads','meta ads'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Notas sobre o layout (opcional)</label>
              <textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Ex: fundo claro, produto centralizado, CTA em laranja..."
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
              />
            </div>

            {status === 'ok'    && <p className="flex items-center gap-2 text-green-600 text-sm mb-3"><CheckCircle className="w-4 h-4" />{msg}</p>}
            {status === 'error' && <p className="flex items-center gap-2 text-red-500 text-sm mb-3"><AlertCircle className="w-4 h-4" />{msg}</p>}

            <button
              onClick={handleSubmit}
              disabled={!file || status === 'loading'}
              className="w-full bg-brand-dark text-white font-semibold py-2.5 rounded-xl hover:bg-brand-blue transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? 'Analisando e salvando...' : 'Salvar no Obsidian'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Sidebar({ referencias, contexto, onContexto }) {
  return (
    <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-slate-100 h-full">
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-brand-blue" />
          <span className="text-xl font-black text-brand-dark tracking-tight">BriefFlow</span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">Acelerando a ci\u00eancia da vida</p>
      </div>

      <div className="px-4 py-4 border-b border-slate-100">
        <label className="block text-xs font-semibold text-slate-500 mb-2">Contexto do produto/campanha</label>
        <textarea
          value={contexto}
          onChange={e => onContexto(e.target.value)}
          placeholder="Cole aqui nome, specs, p\u00fablico-alvo, oferta..."
          rows={4}
          className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/40 text-brand-text"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-xs font-semibold text-slate-500 mb-3">Refer\u00eancias visuais ({referencias.length})</p>
        {referencias.length === 0 ? (
          <p className="text-xs text-slate-300 text-center mt-8">Nenhuma refer\u00eancia salva ainda.<br />Use o bot\u00e3o \u2795 para enviar.</p>
        ) : (
          <div className="space-y-3">
            {referencias.map((r, i) => (
              <div key={i} className="rounded-xl border border-slate-100 overflow-hidden bg-brand-light/50">
                {r.preview && <img src={r.preview} alt={r.title} className="w-full h-24 object-cover" />}
                <div className="p-2">
                  <p className="text-xs font-semibold text-brand-dark truncate">{r.title}</p>
                  <p className="text-xs text-slate-400 truncate">{r.material_type}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '\uD83D\uDC4B Ol\u00e1! Sou o **BriefFlow**, seu agente de marketing premium.\n\nPasse o contexto do produto na lateral e use os atalhos abaixo para gerar materiais \u2014 ou simplesmente converse comigo!',
    }
  ])
  const [input, setInput]       = useState('')
  const [contexto, setContexto] = useState('')
  const [loading, setLoading]   = useState(false)
  const [referencias, setReferencias] = useState([])
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMsg = (role, content, extras = {}) =>
    setMessages(prev => [...prev, { role, content, ...extras }])

  const sendMessage = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    addMsg('user', msg)
    setLoading(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '', typing: true, _id: 'typing' }])
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, contexto }),
      })
      const data = await res.json()
      setMessages(prev => prev.filter(m => m._id !== 'typing'))
      if (!res.ok) throw new Error(data.detail || 'Erro na API')
      addMsg('assistant', data.response, {
        files: data.files || [],
        previews: data.previews || [],
        provider: data.provider,
      })
    } catch (e) {
      setMessages(prev => prev.filter(m => m._id !== 'typing'))
      addMsg('assistant', `\u26A0\uFE0F **Erro:** ${e.message}`)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleUpload = (data) => {
    setReferencias(prev => [
      { title: data.title, material_type: data.material_type, preview: data.preview_url },
      ...prev,
    ])
    addMsg('assistant', `\u2705 Refer\u00eancia visual **"${data.title}"** salva no vault do Obsidian! Vou us\u00e1-la nas pr\u00f3ximas gera\u00e7\u00f5es de *${data.material_type}*.`)
  }

  return (
    <div className="flex h-full bg-brand-light">
      <Sidebar referencias={referencias} contexto={contexto} onContexto={setContexto} />

      <div className="flex flex-col flex-1 min-w-0 h-full">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100 shadow-sm">
          <Zap className="w-5 h-5 text-brand-blue" />
          <span className="text-lg font-black text-brand-dark">BriefFlow</span>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {MATERIAL_CHIPS.map(chip => (
            <button
              key={chip.label}
              onClick={() => sendMessage(chip.prompt)}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-600 hover:border-brand-blue hover:text-brand-blue px-3 py-1.5 rounded-full transition-colors shadow-sm"
            >
              <span>{chip.icon}</span>
              <span>{chip.label}</span>
            </button>
          ))}
        </div>

        <div className="px-4 pb-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md flex items-end gap-2 px-4 py-3 focus-within:ring-2 focus-within:ring-brand-blue/30 focus-within:border-brand-blue transition-all">
            <UploadReferencia onUpload={handleUpload} />

            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
              rows={1}
              className="flex-1 resize-none text-sm text-brand-text placeholder:text-slate-400 focus:outline-none max-h-36 overflow-y-auto bg-transparent leading-relaxed"
            />

            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-brand-dark hover:bg-brand-blue disabled:bg-slate-200 text-white flex items-center justify-center transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-center text-xs text-slate-300 mt-2">BriefFlow \u2014 Acelerando a ci\u00eancia da vida</p>
        </div>
      </div>
    </div>
  )
}
