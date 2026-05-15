export async function sendNetworthDataToClaude(
  promptText: string,
  networthData: unknown,
  userApiKey?: string
): Promise<string> {
  const apiKey = userApiKey?.trim() || (import.meta as any).env?.VITE_CLAUDE_API_KEY;
  const model = (import.meta as any).env?.VITE_CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';
  const baseUrl = (import.meta as any).env?.VITE_CLAUDE_API_BASE_URL ?? '/api/claude';

  if (!apiKey) {
    throw new Error('Claude API key is not configured. Enter your API key or set VITE_CLAUDE_API_KEY in your environment.');
  }

  const requestBody = {
    model,
    max_tokens: 2048,
    system:
      "You are a professional financial analyst assistant. Answer the user's query concisely and clearly using the portfolio data provided. Use short paragraphs or bullet points. Avoid unnecessary filler sentences. Keep the response focused and under 300 words unless more detail is clearly needed.",
    messages: [
      {
        role: 'user',
        content: `Portfolio data:\n${JSON.stringify(networthData, null, 2)}\n\nUser query:\n${promptText}`,
      },
    ],
  };

  const url = `${baseUrl}/v1/messages`;
  const maxAttempts = Number((import.meta as any).env?.VITE_CLAUDE_MAX_RETRIES ?? 4);
  const baseDelayMs = Number((import.meta as any).env?.VITE_CLAUDE_RETRY_BASE_MS ?? 800);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const json = await response.json();
      const content = Array.isArray(json?.content) ? json.content : [];
      const fullText = content
        .filter((block: any) => block?.type === 'text')
        .map((block: any) => block.text as string)
        .filter(Boolean)
        .join('\n\n');
      return fullText || JSON.stringify(json, null, 2);
    }

    const responseBody = await response.text();
    let parsedError: any = null;
    try {
      parsedError = JSON.parse(responseBody);
    } catch {
      parsedError = null;
    }

    const apiMessage = parsedError?.error?.message ?? responseBody;
    const isQuotaExceeded = response.status === 429 && /rate.?limit|quota/i.test(apiMessage);

    if (isQuotaExceeded) {
      throw new Error(
        `Claude quota exceeded for model ${model}. Your current key has no available quota. Please check your usage limits and try again.`
      );
    }

    const isRetriable = response.status === 503 || response.status >= 500 || (response.status === 429 && !isQuotaExceeded);
    lastError = new Error(`Claude request failed: ${response.status} ${response.statusText} - ${apiMessage}`);

    if (!isRetriable || attempt === maxAttempts) {
      break;
    }

    const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`${lastError?.message ?? 'Claude request failed.'}\nPlease retry in a few moments.`);
}
