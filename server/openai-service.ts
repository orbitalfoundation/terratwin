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
}

export interface ChatResponse {
  reply: string;
}

export async function generateChatResponse(message: string): Promise<string> {
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
          content: "You are a helpful AI assistant for TerraTwin, a bamboo cultivation management platform. You can help users understand their bamboo plots, answer questions about bamboo farming, sustainability, and provide general assistance. Keep responses concise and helpful."
        },
        {
          role: "user",
          content: message
        }
      ],
      max_completion_tokens: 500
    });

    return response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
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