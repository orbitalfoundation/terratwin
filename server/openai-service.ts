import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  reply: string;
}

export async function generateChatResponse(message: string): Promise<string> {
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
      max_tokens: 500
    });

    return response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
  } catch (error: any) {
    console.error('OpenAI API error:', error);
    
    // Handle specific OpenAI errors with user-friendly messages
    if (error.status === 429) {
      throw new Error('AI service is currently busy. Please try again in a few moments.');
    } else if (error.status === 401) {
      throw new Error('AI service authentication failed. Please contact support.');
    } else if (error.status === 403) {
      throw new Error('AI service access denied. Please contact support.');
    } else if (error.code === 'insufficient_quota') {
      throw new Error('AI service quota exceeded. Please try again later.');
    } else {
      throw new Error('AI service is temporarily unavailable. Please try again.');
    }
  }
}