export async function sendNetworthDataToChatGPT(
  promptText: string,
  networthData: unknown,
  userApiKey?: string
): Promise<string> {
  const apiKey = userApiKey?.trim() || (import.meta as any).env?.VITE_CHATGPT_API_KEY;
  const model = (import.meta as any).env?.VITE_CHATGPT_MODEL ?? 'gpt-4o-mini';
  const baseUrl = (import.meta as any).env?.VITE_CHATGPT_API_BASE_URL ?? 'https://api.openai.com';

  if (!apiKey) {
    throw new Error('ChatGPT API key is not configured. Enter your API key or set VITE_CHATGPT_API_KEY in your environment.');
  }

  const requestBody = {
    model,
    messages: [
      {
        role: 'system',
        content:
          "You are a professional financial analyst assistant. Answer the user's query concisely and clearly using the portfolio data provided. Use short paragraphs or bullet points. Avoid unnecessary filler sentences. Keep the response focused and under 300 words unless more detail is clearly needed.",
      },
      {
        role: 'user',
        content: `Portfolio data:\n${JSON.stringify(networthData, null, 2)}\n\nUser query:\n${promptText}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 2048,
  };

  const url = `${baseUrl}/v1/chat/completions`;
  const maxAttempts = Number((import.meta as any).env?.VITE_CHATGPT_MAX_RETRIES ?? 4);
  const baseDelayMs = Number((import.meta as any).env?.VITE_CHATGPT_RETRY_BASE_MS ?? 800);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const json = await response.json();
      const content = json?.choices?.[0]?.message?.content;
      return typeof content === 'string' ? content : JSON.stringify(json, null, 2);
    }

    const responseBody = await response.text();
    let parsedError: any = null;
    try {
      parsedError = JSON.parse(responseBody);
    } catch {
      parsedError = null;
    }

    const apiMessage = parsedError?.error?.message ?? responseBody;
    const isQuotaExceeded = response.status === 429 && /quota|rate.?limit/i.test(apiMessage);

    if (isQuotaExceeded) {
      throw new Error(
        `ChatGPT quota exceeded for model ${model}. Your current key has no available quota. Enable billing or use a different API key, then try again.`
      );
    }

    const isRetriable = response.status === 503 || response.status >= 500 || (response.status === 429 && !isQuotaExceeded);
    lastError = new Error(`ChatGPT request failed: ${response.status} ${response.statusText} - ${apiMessage}`);

    if (!isRetriable || attempt === maxAttempts) {
      break;
    }

    const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`${lastError?.message ?? 'ChatGPT request failed.'}\nPlease retry in a few moments.`);
}
