import type { ProviderConfig, Provider } from '@shared/types'

/**
 * AI provider configurations and model listings.
 * Single source of truth for all supported providers.
 */
export const providerConfigs: ProviderConfig[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    placeholder: 'sk-ant-...',
    pattern: /^sk-ant-/,
    models: [
      { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', desc: 'Latest Balanced (Recommended)', price: '$3/$15' },
      { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', desc: 'Latest Top Performance', price: '$15/$75' },
      { id: 'anthropic/claude-haiku-4-5', name: 'Claude Haiku 4.5', desc: 'Fast & Affordable', price: '$0.80/$4' }
    ]
  },
  {
    id: 'google',
    label: 'Google',
    placeholder: 'AIza...',
    pattern: /^AIza/,
    models: [
      { id: 'google/gemini-3-flash', name: 'Gemini 3 Flash', desc: 'Latest Fast (Recommended)', price: '$0.15/$0.60' },
      { id: 'google/gemini-3-pro', name: 'Gemini 3 Pro', desc: 'Latest High Performance', price: '$1.25/$5' }
    ]
  },
  {
    id: 'openai',
    label: 'OpenAI',
    placeholder: 'sk-...',
    pattern: /^sk-(?!ant-)/,
    models: [
      { id: 'openai/gpt-5.5', name: 'GPT-5.5', desc: 'Latest Top Performance (Recommended)', price: '$2.50/$15' },
      { id: 'openai/gpt-5.5-mini', name: 'GPT-5.5 Mini', desc: 'Fast & Affordable', price: '$0.75/$4.50' }
    ],
    oauthModels: [
      { id: 'openai-codex/gpt-5.5', name: 'GPT-5.5', desc: 'Latest Coding (Recommended)', price: 'Subscription' }
    ],
    authMethods: ['api-key', 'oauth']
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    placeholder: 'sk-...',
    pattern: /^sk-/,
    models: [
      { id: 'minimax/MiniMax-M3.0', name: 'MiniMax M3.0', desc: 'Latest (Recommended)', price: '$0.30/$1.2' }
    ]
  },
  {
    id: 'glm',
    label: 'Z.AI',
    placeholder: 'API key',
    pattern: /^.{8,}$/,
    models: [
      { id: 'zai/glm-5.5', name: 'GLM-5.5', desc: 'Latest Top Performance (Recommended)', price: '$1/$3.2' }
    ]
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    placeholder: 'sk-...',
    pattern: /^sk-/,
    models: [
      { id: 'deepseek/deepseek-chat', name: 'deepseek-v4-flash', desc: 'Latest (Recommended)', price: '$0.27/$0.40' }
    ]
  },
  {
    id: 'ollama',
    label: 'Ollama',
    placeholder: '',
    pattern: /^$/,
    models: [
      { id: 'ollama/llama-4', name: 'Llama 4', desc: 'General Purpose (Recommended)', price: 'Free' },
      { id: 'ollama/qwen3', name: 'Qwen 3', desc: 'High Performance', price: 'Free' }
    ]
  }
]

export const providerMeta: Record<Provider, { name: string; consoleUrl: string }> = {
  google: { name: 'Google Gemini', consoleUrl: 'https://aistudio.google.com/apikey' },
  openai: { name: 'OpenAI', consoleUrl: 'https://platform.openai.com/api-keys' },
  anthropic: { name: 'Anthropic', consoleUrl: 'https://console.anthropic.com/settings/keys' },
  minimax: { name: 'MiniMax', consoleUrl: 'https://platform.minimax.io/user-center/basic-information/interface-key' },
  glm: { name: 'Z.AI (智谱)', consoleUrl: 'https://z.ai/manage-apikey/apikey-list' },
  deepseek: { name: 'DeepSeek', consoleUrl: 'https://platform.deepseek.com/api_keys' },
  ollama: { name: 'Ollama', consoleUrl: 'https://ollama.com/download' }
}

export const providerOrder: Provider[] = ['google', 'openai', 'anthropic', 'deepseek', 'minimax', 'glm', 'ollama']
export const domesticProviderOrder: Provider[] = ['deepseek', 'minimax', 'glm', 'ollama']
