import OpenAI from "openai";
import { HttpError } from "./http-error";

// Check for API key availability
if (!process.env.OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY not found in environment variables');
}

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ChatRequest {
  message: string;
  context?: {
    currentPage: string;
    currentPlotId?: string;
    availablePlots: Array<{
      id: string;
      name: string;
      status: string;
    }>;
  };
}

export interface ChatResponse {
  reply: string;
}

export interface AgenticChatResponse {
  type: 'conversation' | 'action';
  message: string;
  action?: {
    type: 'goto_plot' | 'start_simulation' | 'pause_simulation' | 'reset_simulation';
    data?: any;
  };
}

export async function generateChatResponse(message: string, context?: ChatRequest['context']): Promise<AgenticChatResponse> {
  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    throw new HttpError(503, 'OpenAI API key not configured. Please add it in Secrets and retry.');
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are an agentic AI assistant for TerraTwin, a bamboo cultivation management platform. You can help users understand their bamboo plots, answer questions about bamboo farming, sustainability, and perform actions on their behalf.

CURRENT CONTEXT:
- Current page: ${context?.currentPage || 'unknown'}
- Current plot: ${context?.currentPlotId || 'none'}
- Available plots: ${context?.availablePlots?.map(p => `${p.name} (id: ${p.id}, status: ${p.status})`).join(', ') || 'none'}

AVAILABLE ACTIONS:
1. goto_plot: Navigate to a specific plot by name or ID
2. start_simulation: Start the bamboo simulation (only available on plot detail pages)  
3. pause_simulation: Pause the running simulation (only available on plot detail pages)
4. reset_simulation: Reset the simulation to initial state (only available on plot detail pages)

RESPONSE FORMAT:
You must respond with a JSON object in this exact format:

For conversational responses:
{
  "type": "conversation",
  "message": "Your helpful response here"
}

For actions:
{
  "type": "action", 
  "message": "Explaining what action I'm taking",
  "action": {
    "type": "goto_plot|start_simulation|pause_simulation|reset_simulation",
    "data": {"plotId": "id-here", "plotName": "name-here"}
  }
}

IMPORTANT RULES:
- Always return valid JSON
- For goto_plot actions, include both plotId and plotName in the data object
- Only suggest simulation actions when on a plot detail page
- If user asks to go to a plot that doesn't exist, respond conversationally with available options
- Be helpful and explain what you're doing when taking actions
- Keep responses concise but informative`
        },
        {
          role: "user",
          content: message
        }
      ],
      max_completion_tokens: 500
    });

    const content = response.choices[0].message.content || '{"type": "conversation", "message": "I\'m sorry, I couldn\'t generate a response."}';
    
    try {
      const parsed = JSON.parse(content) as AgenticChatResponse;
      
      // Validate the response structure
      if (!parsed.type || !parsed.message) {
        throw new Error('Invalid response structure');
      }
      
      if (parsed.type === 'action' && !parsed.action) {
        throw new Error('Action type response missing action field');
      }
      
      return parsed;
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', parseError);
      console.error('Raw response:', content);
      
      // Fallback to conversational response
      return {
        type: 'conversation',
        message: content.replace(/```json|```/g, '').trim() || "I'm sorry, I had trouble processing that request."
      };
    }
  } catch (error: any) {
    console.error('OpenAI API error:', error);
    
    // Handle specific OpenAI errors with proper HTTP status codes
    if (error.status === 429) {
      throw new HttpError(429, 'AI service is currently busy. Please try again in a few moments.');
    } else if (error.status === 401) {
      throw new HttpError(401, 'AI service authentication failed. Please contact support.');
    } else if (error.status === 403) {
      throw new HttpError(403, 'AI service access denied. Please contact support.');
    } else if (error.code === 'insufficient_quota') {
      throw new HttpError(402, 'AI service quota exceeded. Please try again later.');
    } else if (error.status === 404 || error.code === 'model_not_found') {
      throw new HttpError(503, 'AI model temporarily unavailable. Please try again later.');
    } else {
      throw new HttpError(500, 'AI service is temporarily unavailable. Please try again.');
    }
  }
}