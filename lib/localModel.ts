type TextGeneratorFn = (
  inputs: unknown,
  options?: Record<string, unknown>
) => Promise<Array<{ generated_text?: unknown }>>;

let generatorPromise: Promise<TextGeneratorFn> | null = null;
let isModelReady = false;
let isModelLoading = false;

export function getLocalModelStatus() {
  return {
    isReady: isModelReady,
    isLoading: isModelLoading,
    modelName: "SmolLM2-135M-Instruct (Local ONNX)",
  };
}

async function getGenerator() {
  if (generatorPromise) return generatorPromise;

  isModelLoading = true;
  generatorPromise = (async () => {
    try {
      const { pipeline, env } = await import("@huggingface/transformers");

      // Configure transformers environment for efficient local execution
      env.allowLocalModels = true;

      const generator = await pipeline(
        "text-generation",
        "HuggingFaceTB/SmolLM2-135M-Instruct",
        {
          dtype: "q4",
        }
      );

      isModelReady = true;
      isModelLoading = false;
      return generator as unknown as TextGeneratorFn;
    } catch (err) {
      isModelLoading = false;
      generatorPromise = null;
      throw err;
    }
  })();

  return generatorPromise;
}

export interface LocalChatInput {
  message: string;
  history?: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  maxTokens?: number;
}

function cleanGeneratedReply(raw: string): string {
  let text = raw.trim();

  // Strip special tokens and chat artifacts
  text = text.replace(/<\|[a-z_]+\|>/gi, "");
  text = text.replace(/^assistant:\s*/i, "");
  text = text.replace(/^ashura:\s*/i, "");
  text = text.replace(/^raone:\s*/i, "");

  // If text stops abruptly mid-sentence (no terminal punctuation), trim back to last complete sentence
  const sentenceTerminators = [".", "!", "?", "```"];
  const lastIndex = Math.max(...sentenceTerminators.map((t) => text.lastIndexOf(t)));

  if (lastIndex > 25 && lastIndex < text.length - 1) {
    // If it's a code block that didn't close, close it
    const codeBlockCount = (text.slice(0, lastIndex + 1).match(/```/g) || []).length;
    if (codeBlockCount % 2 !== 0) {
      text = text.slice(0, lastIndex + 1) + "\n```";
    } else {
      text = text.slice(0, lastIndex + 1);
    }
  }

  return text.trim();
}

export async function generateLocalAIResponse(input: LocalChatInput): Promise<string> {
  const generator = await getGenerator();

  const systemMessage =
    input.systemPrompt ||
    "You are ASHURA (Autonomous Situational High-Utility Responsive Assistant), a capable, intelligent AI desktop assistant running on Windows. Provide direct, helpful, polite, and accurate responses. Speak naturally in 1 to 3 clear sentences.";

  const formattedMessages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemMessage },
  ];

  if (input.history && input.history.length > 0) {
    for (const h of input.history.slice(-4)) {
      formattedMessages.push({ role: h.role, content: h.content });
    }
  }

  formattedMessages.push({ role: "user", content: input.message });

  try {
    const maxTokens = input.maxTokens || 180;
    const output = await generator(formattedMessages, {
      max_new_tokens: maxTokens,
      temperature: 0.6,
      top_p: 0.9,
      repetition_penalty: 1.18,
      do_sample: true,
    });

    if (Array.isArray(output) && output.length > 0) {
      const generated = output[0]?.generated_text;
      if (Array.isArray(generated)) {
        const lastMsg = generated[generated.length - 1];
        if (lastMsg && lastMsg.role === "assistant" && typeof lastMsg.content === "string") {
          return cleanGeneratedReply(lastMsg.content);
        }
      } else if (typeof generated === "string") {
        return cleanGeneratedReply(generated);
      }
    }

    return "I am ASHURA, your Windows desktop AI assistant. Ready for your command.";
  } catch (err) {
    console.error("Local model generation error:", err);
    return "I am standing by on Windows. How can I assist you?";
  }
}
