import { z } from "zod";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

const decisionSchema = z.union([
  z.object({ type: z.literal("followup"), question: z.string().min(3).max(200) }),
  z.object({ type: z.literal("base") }),
  z.object({ type: z.literal("end") }),
]);

export async function POST(request: Request) {
  try {
    const { messages, baseQuestion, remainingCount } = await request.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { success: false, error: "Missing conversation messages" },
        { status: 400 }
      );
    }

    const formattedTranscript = messages
      .map((m: { role: string; content: string }) => `- ${m.role}: ${m.content}\n`)
      .join("");

    const prompt = `You are deciding what the interviewer should do next in a live mock interview.
Conversation so far (latest at bottom):\n${formattedTranscript}

Base next question (optional): ${baseQuestion ?? "<none>"}
Remaining base questions count: ${typeof remainingCount === "number" ? remainingCount : "unknown"}

Rules:
- If the candidate's latest answer is unclear, brief, or invites deeper probing, respond with a short natural follow-up question that refers to their answer. Keep it concise (about 6-15 words). Do not repeat earlier questions, do not narrate, just ask the follow-up.
- Otherwise, if a base next question exists and is appropriate, choose type="base" to proceed to it. Do not include the base question text in your output for this case.
- If there are no remaining base questions and no follow-up is needed, choose type="end".
- Output MUST strictly match the provided JSON schema.`;

    const { object } = await generateObject({
      model: google("gemini-2.0-flash-001"),
      schema: decisionSchema,
      prompt,
      system:
        "You are a helpful interviewing copilot that decides whether to ask a short follow-up, proceed to the next base question, or end the interview. Keep follow-ups short and contextual.",
    });

    return Response.json({ success: true, ...object }, { status: 200 });
  } catch (e: any) {
    console.error("/api/next-question error:", e);
    return Response.json({ success: false, error: String(e) }, { status: 500 });
  }
}
