export async function sendNetworthDataToGemini(
  promptText: string,
  networthData: unknown,
  userApiKey?: string
): Promise<string> {
  const apiKey = userApiKey?.trim() || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  const model = (import.meta as any).env?.VITE_GEMINI_MODEL ?? 'gemma-3-4b-it';
  const apiVersion = (import.meta as any).env?.VITE_GEMINI_API_VERSION ?? 'v1beta';
  // Always call Gemini directly — the API supports browser CORS in both dev and production.
  const baseUrl = (import.meta as any).env?.VITE_GEMINI_API_BASE_URL ?? 'https://generativelanguage.googleapis.com';

  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Enter your API key or set VITE_GEMINI_API_KEY in your environment.');
  }

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `You are a professional financial analyst assistant. Answer the user's query concisely and clearly using the portfolio data provided. Use short paragraphs or bullet points. Avoid unnecessary filler sentences. Keep the response focused and under 300 words unless more detail is clearly needed.\n\nPortfolio data:\n${JSON.stringify(networthData, null, 2)}\n\nUser query:\n${promptText}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  };

  const url = `${baseUrl}/${apiVersion}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const maxAttempts = Number((import.meta as any).env?.VITE_GEMINI_MAX_RETRIES ?? 4);
  const baseDelayMs = Number((import.meta as any).env?.VITE_GEMINI_RETRY_BASE_MS ?? 800);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const json = await response.json();
      const candidates = Array.isArray(json?.candidates) ? json.candidates : [];
      const fullText = candidates
        .flatMap((candidate: any) => (Array.isArray(candidate?.content?.parts) ? candidate.content.parts : []))
        .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
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
    const apiStatus = parsedError?.error?.status ?? '';
    const isQuotaExceeded =
      response.status === 429 &&
      (apiStatus === 'RESOURCE_EXHAUSTED' || /quota exceeded|limit:\s*0/i.test(apiMessage));

    if (isQuotaExceeded) {
      throw new Error(
        `Gemini quota exceeded for model ${model}. Your current key/project has no available quota for this model. ` +
          `Enable billing or use a key/project with active Gemini quota, then try again.`
      );
    }

    const retryInfo = Array.isArray(parsedError?.error?.details)
      ? parsedError.error.details.find((d: any) => d?.['@type'] === 'type.googleapis.com/google.rpc.RetryInfo')
      : null;
    const retryDelayRaw = typeof retryInfo?.retryDelay === 'string' ? retryInfo.retryDelay : '';
    const retryDelaySeconds = Number.parseInt(retryDelayRaw, 10);

    const isRetriable = response.status === 503 || response.status >= 500 || (response.status === 429 && !isQuotaExceeded);
    lastError = new Error(`Gemini request failed: ${response.status} ${response.statusText} - ${apiMessage}`);

    if (!isRetriable || attempt === maxAttempts) {
      break;
    }

    const delayMs = Number.isFinite(retryDelaySeconds)
      ? Math.max(baseDelayMs, retryDelaySeconds * 1000)
      : baseDelayMs * Math.pow(2, attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(
    `${lastError?.message ?? 'Gemini request failed.'}\nPlease retry in a few moments.`
  );
}
