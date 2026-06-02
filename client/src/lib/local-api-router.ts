import { localBackend } from './local-storage-backend';
import { cesiumKey } from './config';
import type { InsertPlot } from '@shared/schema';

export const GROQ_KEY_STORAGE_KEY = 'terratwin_groq_key';

const GROQ_SYSTEM_PROMPT = `You are an agentic AI assistant for TerraTwin, a bamboo cultivation management platform. You help users understand their bamboo plots, answer questions about bamboo farming, sustainability, and perform actions on their behalf.

AVAILABLE ACTIONS:
1. goto_plot: Navigate to a specific plot by name or ID
2. start_simulation: Start the bamboo growth simulation (only on plot detail pages)
3. pause_simulation: Pause the running simulation
4. reset_simulation: Reset the simulation to initial state

RESPONSE FORMAT — always respond with valid JSON:

Conversational: {"type": "conversation", "message": "your response"}
Action: {"type": "action", "message": "what I'm doing", "action": {"type": "goto_plot|start_simulation|pause_simulation|reset_simulation", "data": {"plotId": "id", "plotName": "name"}}}

Keep responses concise and helpful.`;

function makeResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function localChat(body: { message: string; context?: any }): Promise<Response> {
  const groqKey = localStorage.getItem(GROQ_KEY_STORAGE_KEY);

  if (!groqKey) {
    return makeResponse({
      type: 'conversation',
      message: 'AI chat is in demo mode. To enable full AI responses, click the key icon in the chat header and enter a free Groq API key from console.groq.com — it takes about 30 seconds to get one.',
    });
  }

  try {
    const ctx = body.context;
    const contextSuffix = ctx
      ? `\n\nCurrent page: ${ctx.currentPage}\nAvailable plots: ${ctx.availablePlots?.map((p: any) => `${p.name} (id: ${p.id}, status: ${p.status})`).join(', ') || 'none'}`
      : '';

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: GROQ_SYSTEM_PROMPT + contextSuffix },
          { role: 'user', content: body.message },
        ],
        max_tokens: 500,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return makeResponse({
        type: 'conversation',
        message: `Groq API error (${resp.status}). ${errText.includes('invalid_api_key') ? 'Invalid API key — update it in chat settings.' : 'Please try again.'}`,
      });
    }

    const data = await resp.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';

    try {
      return makeResponse(JSON.parse(content));
    } catch {
      return makeResponse({ type: 'conversation', message: content });
    }
  } catch {
    return makeResponse({
      type: 'conversation',
      message: 'Could not reach Groq API. Check your internet connection or try again.',
    });
  }
}

export async function localApiRouter(method: string, url: string, body?: unknown): Promise<Response> {
  const path = url.split('?')[0];

  // Plots collection
  if (path === '/api/plots') {
    if (method === 'GET') return makeResponse(await localBackend.getAllPlots());
    if (method === 'POST') return makeResponse(await localBackend.createPlot(body as InsertPlot), 201);
  }

  // Individual plot
  const plotMatch = path.match(/^\/api\/plots\/([^/]+)$/);
  if (plotMatch) {
    const id = plotMatch[1];
    if (method === 'GET') {
      const plot = await localBackend.getPlot(id);
      return plot ? makeResponse(plot) : makeResponse({ message: 'Not found' }, 404);
    }
    if (method === 'PATCH' || method === 'PUT') {
      const updated = await localBackend.updatePlot(id, body as Partial<InsertPlot>);
      return updated ? makeResponse(updated) : makeResponse({ message: 'Not found' }, 404);
    }
    if (method === 'DELETE') {
      const ok = await localBackend.deletePlot(id);
      return makeResponse({ success: ok }, ok ? 200 : 404);
    }
  }

  // Cesium key
  if (method === 'GET' && path === '/api/cesium-key') {
    return makeResponse({ key: cesiumKey });
  }

  // AI chat — Groq in browser or polite stub
  if (method === 'POST' && path === '/api/chat') {
    return localChat(body as { message: string; context?: any });
  }

  // TTS — return 503 so use-story falls back to Web Speech API
  if (method === 'POST' && path === '/api/tts') {
    return makeResponse({ useWebSpeech: true }, 503);
  }

  // Debug logging — silently drop
  if (method === 'POST' && path === '/api/debug-log') {
    return makeResponse({ ok: true });
  }

  return makeResponse({ message: 'Not found' }, 404);
}
