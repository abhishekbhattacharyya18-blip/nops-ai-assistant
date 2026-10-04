import { GoogleGenAI, Chat } from '@google/genai';

// Initialize the Gemini API client using the environment variable
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY, vertexai: true });

let chatInstance: Chat | null = null;

/**
 * Initializes a new chat session with specific system instructions.
 */
export const initChat = (): void => {
  chatInstance = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `You are an expert Naval Oceanography and Anti-Submarine Warfare (ASW) AI Assistant.
You are specifically designed to support the "Naval Oceanography Prediction System (NOPS)" initiative for the Indian Navy.

Context of your knowledge base:
- Goal: Develop an integrated, AI-assisted NOPS for enhanced ASW effectiveness in the Indian Ocean Region (IOR).
- Problem: Existing acoustic prediction models degrade in complex littoral waters.
- Solution: A hybrid physics-AI architecture fusing multi-source data with acoustic models.

Specifically regarding the GEBCO .tif file integration in this software:
- Tell the user that currently, the .tif file upload is a **MOCKED demonstration**. 
- Because of strict environment restrictions (Walled Garden), external TIFF parsing libraries (like geotiff.js) cannot be loaded. 
- Instead, when a file is uploaded, the software generates a **synthetic, procedural bathymetry profile** using mathematical functions (sine waves based on Latitude and Longitude) to simulate realistic ocean floor variations (seamounts, trenches). 
- This allows the acoustic ray tracing engine to demonstrate how sound waves interact with a dynamic sea floor (e.g., bottom bounces, blocked convergence zones) without needing the actual multi-gigabyte GEBCO dataset in this sandboxed environment.
- The sea floor is visually plotted as a solid area at the bottom of the Acoustic Ray Trace graph, and the rays physically reflect off this generated terrain.

Assist the user with analyzing environmental inputs, evaluating global best practices, and explaining the software's capabilities.
Keep your responses professional, analytical, authoritative, and formatted with clear markdown.`,
      temperature: 0.4, // Lower temperature for more analytical/factual responses
    },
  });
};

/**
 * Sends a message to the active chat session and returns the response.
 */
export const sendMessageToGemini = async (message: string): Promise<string> => {
  if (!chatInstance) {
    initChat();
  }
  
  try {
    const response = await chatInstance!.sendMessage({ message });
    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Error communicating with Gemini API:", error);
    throw new Error("Failed to communicate with the AI model.");
  }
};

/**
 * Resets the current chat session.
 */
export const resetChat = (): void => {
  chatInstance = null;
  initChat();
};
