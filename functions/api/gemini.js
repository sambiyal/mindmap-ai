const MINDMAP_SYSTEM_PROMPT = `
  You are a strict research assistant and mind map generator.
  
  CRITICAL INSTRUCTION: 
  You must answer ONLY using the provided "Source Material/Context". 
  Do NOT use outside knowledge, general internet knowledge, or training data to fill in gaps.
  
  RULES:
  1. Search the "Source Material" for the answer.
  2. If the answer is present, formulate the response based ONLY on that text.
  3. If the answer is NOT in the "Source Material", explicitly state: "The provided source document does not contain information about [topic]." and do not generate a mind map for that specific missing part.
  
  You MUST return a valid JSON object with exactly two keys:
  1. "text": A natural language answer derived STRICTLY from the source.
  2. "mindMap": A hierarchical object for visualization.
     The "mindMap" object must have:
     - "id": string (unique)
     - "label": string (display text)
     - "type": "root" | "child" | "code"
     - "children": array of node objects (recursive structure).
  
  MIND MAP STYLE GUIDE:
  - **Concepts**: Keep labels short (max 3-4 words).
  - **Commands/Code**: 
    - When identifying commands, tools, or syntax from the text, you MUST copy the command string EXACTLY as it appears in the source.
    - **VERBATIM COPYING IS REQUIRED FOR COMMANDS.** Do not fix typos, do not shorten, do not change flags.
    - Set the node "type" to "code".
    - Structure: Create a specific branch for the tool (e.g., "Rubeus"), then a child node of type "code" with the full command string found in the text.
`;

export async function onRequestPost(context) {
  // 1. Get the API Key from Cloudflare Environment Variables
  const apiKey = context.env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server-side configuration error: Missing API Key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // 2. Get the user's request data
    const requestData = await context.request.json();

    // 3. Determine which model to use
    const model = requestData.model || 'gemini-2.5-flash-preview-09-2025';
    
    // Clean up the payload before sending to Google (remove custom fields like 'model')
    const { model: _, ...googlePayload } = requestData;

    // 4. Inject System Instructions (Only for Text Generation Model)
    // We do NOT inject this for TTS models as it might confuse the audio generation.
    if (model === 'gemini-2.5-flash-preview-09-2025') {
       googlePayload.systemInstruction = {
          parts: [{ text: MINDMAP_SYSTEM_PROMPT }]
       };
    }

    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // 5. Call Google Gemini from the Cloudflare Server
    const googleResponse = await fetch(googleUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(googlePayload),
    });

    const data = await googleResponse.json();

    // 6. Return the result to the frontend
    return new Response(JSON.stringify(data), {
      status: googleResponse.status,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to process request", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}