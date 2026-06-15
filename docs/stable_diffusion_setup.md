# Guia de Instalação — Stable Diffusion + BriefFlow

## O que é o AUTOMATIC1111?

É a interface mais usada para Stable Diffusion local. Roda 100% offline, tem API REST
e gera imagens de alta qualidade de produtos para banners e cards.

---

## 1. Pré-requisitos

| Requisito | Mínimo | Recomendado |
|---|---|---|
| GPU | NVIDIA 4GB VRAM | NVIDIA 8GB+ |
| RAM | 8 GB | 16 GB |
| Espaço em disco | 5 GB | 10 GB |
| Python | 3.10+ | 3.10.x |

> **Sem GPU (CPU only):** Funciona, mas geração demora 3–5 min/imagem.
> Adicione `--use-cpu all --no-half` nos argumentos de inicialização.

---

## 2. Instalação no Windows

```powershell
# 1. Baixe e extraia o AUTOMATIC1111
# https://github.com/AUTOMATIC1111/stable-diffusion-webui/releases
# Ou use o instalador one-click:
# https://github.com/AUTOMATIC1111/stable-diffusion-webui#installation-and-running

# 2. Baixe um modelo (checkpoint)
# Coloque na pasta: stable-diffusion-webui\models\Stable-diffusion\
# Modelo recomendado para produtos: RealisticVision v5.1
# Download: https://civitai.com/models/4201/realistic-vision-v60-b1

# 3. Inicie com API habilitada
.\webui-user.bat
# Edite webui-user.bat e adicione na linha COMMANDLINE_ARGS:
# --api --listen --xformers
```

### webui-user.bat (linha a editar):
```bat
set COMMANDLINE_ARGS=--api --listen --xformers
```

> Para CPU sem GPU:
> ```bat
> set COMMANDLINE_ARGS=--api --listen --use-cpu all --no-half --precision full
> ```

---

## 3. Verificar se está funcionando

Apois iniciar, teste no navegador:
- Interface: http://localhost:7860
- API docs: http://localhost:7860/docs

Ou via PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:7860/sdapi/v1/options" -Method GET
```

---

## 4. Configurar no BriefFlow

No arquivo `.env` do BriefFlow:

```env
# Stable Diffusion
SD_ENABLED=true
SD_BASE_URL=http://127.0.0.1:7860
SD_TIMEOUT=120
```

---

## 5. Modelos recomendados para produtos de laboratório

| Modelo | Estilo | Link |
|---|---|---|
| **Realistic Vision v5.1** | Fotorrealista, ótimo para produtos | [Civitai](https://civitai.com/models/4201) |
| **DreamShaper v8** | Semi-realista, renders clean | [Civitai](https://civitai.com/models/4384) |
| **SDXL Base 1.0** | Alta qualidade geral | [HuggingFace](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0) |

---

## 6. Fluxo dentro do BriefFlow

```
Usuário pede banner
        ↓
LLM gera HTML com placeholder {{SD_IMAGE}}
        ↓
image_gen.py chama SD local (POST /sdapi/v1/txt2img)
        ↓
Recebe imagem base64
        ↓
injetar_imagem_no_html() substitui {{SD_IMAGE}} pela data URI
        ↓
Playwright renderiza HTML → captura PNG final
        ↓
Chat exibe o banner com imagem real do produto
```

---

## 7. Sem GPU? Use CPU mode

Sem placa de vídeo dedicada, a geração demora mas funciona:

```bat
set COMMANDLINE_ARGS=--api --listen --use-cpu all --no-half --precision full
```

Para agilizar, reduza os steps no `.env`:
```env
# Não há variável direta, mas você pode editar src/image_gen.py:
# DEFAULT_PARAMS["steps"] = 10  # mais rápido, menor qualidade
```
