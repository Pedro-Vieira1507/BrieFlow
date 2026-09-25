import { ImagePlus, Plus, Sparkles, Trash2 } from "lucide-react";
import type { ChangeEvent } from "react";
import {
  CHANNEL_IDS,
  CHANNELS,
  type SocialAttachment,
  type SocialBrief,
} from "@/lib/socialClient";
export function ChannelIcon({ channel }: { channel: keyof typeof CHANNELS }) {
  const c = CHANNELS[channel];
  return (
    <span
      className={`social-channel-icon channel-${channel}`}
      aria-hidden="true"
    >
      {c.monogram}
    </span>
  );
}
export function BriefEditor({
  brief,
  attachments,
  onChange,
  onAttachments,
  onUpload,
  busy,
  onGenerate,
  onSave,
}: {
  brief: SocialBrief;
  attachments: SocialAttachment[];
  onChange: (b: SocialBrief) => void;
  onAttachments: (m: SocialAttachment[]) => void;
  onUpload: (files: FileList) => void;
  busy: boolean;
  onGenerate: () => void;
  onSave: () => void;
}) {
  const field = (
    key: keyof Omit<SocialBrief, "channels">,
    label: string,
    placeholder: string,
    multiline = false,
    required = false,
  ) => (
    <label className="social-field" key={key}>
      <span>
        {label}
        {required && <small> *</small>}
      </span>
      {multiline ? (
        <textarea
          maxLength={8000}
          value={brief[key]}
          onChange={(e) => onChange({ ...brief, [key]: e.target.value })}
          placeholder={placeholder}
          rows={key === "facts" ? 5 : 3}
        />
      ) : (
        <input
          maxLength={8000}
          value={brief[key]}
          onChange={(e) => onChange({ ...brief, [key]: e.target.value })}
          placeholder={placeholder}
        />
      )}
    </label>
  );
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) onUpload(event.target.files);
    event.target.value = "";
  };
  return (
    <div className="social-brief-layout">
      <div className="social-brief-main">
        <section className="social-panel">
          <div className="social-section-heading">
            <span className="social-step">01</span>
            <div>
              <h2>Conte a sua ideia</h2>
              <p>
                Um bom briefing é o ponto de partida para seis conversas
                diferentes.
              </p>
            </div>
          </div>
          <div className="social-fields-grid">
            {field(
              "name",
              "Nome da campanha",
              "Ex.: Lançamento da coleção de primavera",
              false,
              true,
            )}
            {field("brand", "Marca", "Qual é o nome da marca?", false, true)}
          </div>
          {field(
            "product",
            "Produto, serviço ou campanha",
            "O que você quer apresentar? Descreva o produto e o contexto.",
            true,
            true,
          )}
          <div className="social-fields-grid">
            <label className="social-field">
              <span>Objetivo</span>
              <select
                value={brief.objective}
                onChange={(e) =>
                  onChange({ ...brief, objective: e.target.value })
                }
              >
                {[
                  "Apresentar um produto",
                  "Gerar conversas",
                  "Educar a audiência",
                  "Levar visitas ao site",
                  "Divulgar um evento",
                  "Construir autoridade",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            {field(
              "audience",
              "Público",
              "Com quem a marca está falando?",
              false,
              true,
            )}
          </div>
          {field(
            "facts",
            "Informações confirmadas",
            "Diferenciais reais, especificações, disponibilidade, preços e condições. A IA não deve completar fatos que você não informou.",
            true,
            true,
          )}
          <div className="social-fields-grid">
            {field("cta", "Ação desejada", "Ex.: Conhecer a coleção")}
            {field(
              "link",
              "Link de destino (opcional)",
              "https://sua-marca.com/colecao",
            )}
          </div>
          <details className="social-details">
            <summary>
              Tom da marca e cuidados editoriais <Plus size={15} />
            </summary>
            <div className="social-fields-grid">
              {field(
                "voice",
                "Personalidade da marca",
                "Ex.: Próxima, objetiva, sem exageros",
                true,
              )}
              {field(
                "restrictions",
                "O que evitar ou esclarecer",
                "Termos proibidos, avisos obrigatórios e limitações",
                true,
              )}
            </div>
          </details>
        </section>
        <section className="social-panel">
          <div className="social-section-heading">
            <span className="social-step">02</span>
            <div>
              <h2>Traga a sua mídia</h2>
              <p>
                A IA escreve. Você fornece as fotos e os vídeos prontos para
                publicar.
              </p>
            </div>
          </div>
          <label className={`social-upload ${busy ? "is-disabled" : ""}`}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4"
              multiple
              disabled={busy || attachments.length >= 12}
              onChange={upload}
            />
            <span className="social-upload-icon">
              <ImagePlus size={23} />
            </span>
            <strong>Anexar foto do produto ou da campanha</strong>
            <span>
              JPEG, PNG, WebP ou MP4 · até 25 MB por arquivo · máximo 12
            </span>
            <small>Preencha os campos obrigatórios antes de anexar.</small>
          </label>
          {attachments.map((m) => (
            <div className="social-attachment" key={m.id}>
              <ImagePlus size={19} />
              <div>
                <strong>{m.name}</strong>
                <small>
                  {(m.size / 1024 / 1024).toFixed(1)} MB
                  {m.duration ? ` · ${Math.round(m.duration)}s` : ""}
                </small>
                <input
                  aria-label={`Descrição de ${m.name}`}
                  maxLength={2000}
                  value={m.description}
                  placeholder="Descreva o que aparece na mídia para orientar a IA"
                  onChange={(e) =>
                    onAttachments(
                      attachments.map((a) =>
                        a.id === m.id
                          ? { ...a, description: e.target.value }
                          : a,
                      ),
                    )
                  }
                />
              </div>
              <button
                type="button"
                className="social-icon-button"
                aria-label={`Remover ${m.name} do briefing`}
                onClick={() =>
                  onAttachments(attachments.filter((a) => a.id !== m.id))
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <p className="social-help">
            Os anexos ficam privados. Apenas a mídia escolhida para um post será
            enviada à rede após a sua confirmação. A IA usa a descrição escrita,
            não analisa a imagem automaticamente.
          </p>
        </section>
        <section className="social-panel">
          <div className="social-section-heading">
            <span className="social-step">03</span>
            <div>
              <h2>Escolha onde a conversa acontece</h2>
              <p>
                Cada rede recebe um texto próprio, com sua cultura e seu ritmo.
              </p>
            </div>
          </div>
          <div className="social-channel-grid">
            {CHANNEL_IDS.map((channel) => {
              const c = CHANNELS[channel],
                selected = brief.channels.includes(channel);
              return (
                <button
                  type="button"
                  key={channel}
                  className={`social-channel-choice ${selected ? "selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() =>
                    onChange({
                      ...brief,
                      channels: selected
                        ? brief.channels.filter((id) => id !== channel)
                        : [...brief.channels, channel],
                    })
                  }
                >
                  <ChannelIcon channel={channel} />
                  <strong>{c.name}</strong>
                  <span>{c.voice}</span>
                  <small>{c.cadence}</small>
                  <span className="social-choice-check" aria-hidden>
                    {selected ? "✓" : "+"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <div className="social-form-actions">
          <button
            className="social-button secondary"
            disabled={busy}
            onClick={onSave}
          >
            Salvar briefing
          </button>
          <button
            className="social-button primary"
            disabled={busy || !brief.channels.length}
            onClick={onGenerate}
          >
            <Sparkles size={17} />
            {busy ? "Trabalhando…" : "Gerar textos por rede"}
          </button>
        </div>
      </div>
      <aside className="social-brief-aside">
        <div className="social-sticky">
          <span className="social-eyebrow">UM BRIEFING. MÚLTIPLAS VOZES.</span>
          <h3>
            A mesma ideia.
            <br />
            <em>Outro jeito de contar.</em>
          </h3>
          <p>
            Não é copiar e colar. É encontrar o melhor ângulo da sua mensagem em
            cada comunidade.
          </p>
          <div className="social-mini-strategy">
            {brief.channels.map((channel) => (
              <div key={channel}>
                <ChannelIcon channel={channel} />
                <div>
                  <strong>{CHANNELS[channel].name}</strong>
                  <span>{CHANNELS[channel].density} densidade de texto</span>
                </div>
              </div>
            ))}
          </div>
          <div className="social-note">
            <Sparkles size={17} />
            <p>
              2 créditos por texto gerado. Revise os fatos antes de publicar. As
              cadências são o ponto de partida da sua estratégia, não uma
              garantia de desempenho.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
