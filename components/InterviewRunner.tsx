"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";

import { cn } from "@/lib/utils";

interface RunnerProps {
  userName: string;
  userId?: string;
  interviewId: string;
  questions: string[];
}

type SavedMessage = { role: "user" | "assistant"; content: string };

export default function InterviewRunner({ userName, userId, interviewId, questions }: RunnerProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  // Prevent duplicate speaks in React Strict Mode and track asked base questions
  const askedSetRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    // Pre-ask permission to avoid UX hiccups
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      stream.getTracks().forEach((t) => t.stop());
    }).catch(() => {
      toast.error("Microphone permission is required.");
    });
  }, []);

  // Ask the first question and subsequent ones automatically via index change

  const speak = async (text: string) => {
    try {
      setIsSpeaking(true);
      const res = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice: process.env.NEXT_PUBLIC_DEEPGRAM_TTS_VOICE || "aura-2-odysseus-en",
        }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const arrayBuf = await res.arrayBuffer();
      const blob = new Blob([arrayBuf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
        const audio = new Audio(url);
        // Slightly slower playback for a calmer, more natural feel (configurable)
        const envRate = Number(process.env.NEXT_PUBLIC_TTS_PLAYBACK_RATE);
        const desired = isNaN(envRate) ? 1.0 : envRate;
        // clamp to sane range
        audio.playbackRate = Math.max(0.7, Math.min(1.0, desired));
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Audio play failed")); };
        audio.play();
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to play audio");
    } finally {
      setIsSpeaking(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (e: any) {
      toast.error(e?.message || "Failed to start recording");
    }
  };

  const stopRecording = async () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    await new Promise<void>((resolve) => {
      mr.onstop = () => { resolve(); };
      mr.stop();
    });
    setRecording(false);

    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const res = await fetch("/api/speech-to-text", {
      method: "POST",
      headers: { "Content-Type": "audio/webm" },
      body: blob,
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      toast.error(data.error || "Transcription failed");
      return;
    }

    const transcript: string = data.transcript || "";
    const allMessages: SavedMessage[] = [...messages, { role: "user", content: transcript }];
    setMessages(allMessages);

    // Decide next step based on the user's answer (conversational flow)
    await decideNextStep(transcript, allMessages);
  };

  const askCurrentQuestion = async () => {
    const q = questions[currentIndex];
    setMessages((prev) => [...prev, { role: "assistant", content: q }]);
    await speak(q);
    // Automatically start recording after the question has been asked
    if (!recording) await startRecording();
  };

  // Whenever the current question index advances, ask the next question automatically
  useEffect(() => {
    if (!isSpeaking && !recording && questions[currentIndex]) {
      // Guard against duplicate effect runs (e.g., Strict Mode)
      if (askedSetRef.current.has(currentIndex)) return;
      askedSetRef.current.add(currentIndex);
      askCurrentQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // Decide next question or follow-up based on transcript and conversation state
  const decideNextStep = async (latestTranscript: string, allMsgs: SavedMessage[]) => {
    try {
      const baseNext = questions[currentIndex + 1] || null;
      const res = await fetch("/api/next-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMsgs,
          baseQuestion: baseNext,
          remainingCount: Math.max(0, questions.length - (currentIndex + 1)),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || "next-question failed");

      // type: 'followup' | 'base' | 'end'
      if (data.type === "followup" && data.question) {
        // Ask a short contextual follow-up without advancing index
        setMessages((prev) => [...prev, { role: "assistant", content: data.question }]);
        await speak(data.question);
        if (!recording) await startRecording();
        return;
      }

      if (data.type === "base") {
        if (currentIndex + 1 < questions.length) {
          setCurrentIndex((i) => i + 1);
          return;
        }
        // No base left, fall through to end
      }

      // End of conversation or fallback
      await finalizeInterview(allMsgs);
    } catch (e: any) {
      // Fallback to original sequential behavior on failure
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex((i) => i + 1);
      } else {
        await finalizeInterview(allMsgs);
      }
    }
  };

  const finalizeInterview = async (allMessages: SavedMessage[]) => {
    try {
      const res = await fetch("/api/create-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId,
          userId: userId!,
          transcript: allMessages,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push(`/interview/${interviewId}/feedback`);
      } else {
        toast.error(data?.error || "Failed to create feedback");
        router.push("/");
      }
    } catch (e: any) {
      toast.error(e?.message || "Feedback failed");
      router.push("/");
    }
  };

  return (
    <>
      <div className="call-view">
        <div className="card-interviewer">
          <div className="avatar">
            <Image src="/ai-avatar.png" alt="ai" width={65} height={54} className="object-cover" />
            {isSpeaking && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>
        </div>

        <div className="card-border">
          <div className="card-content">
            <Image src="/user-avatar.png" alt="me" width={539} height={539} className="rounded-full object-cover size-[120px]" />
            <h3>{userName}</h3>
          </div>
        </div>
      </div>

      {/* Transcript */}
      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript">
            <p className={cn("transition-opacity duration-500 opacity-0", "animate-fadeIn opacity-100")}>{messages[messages.length - 1].content}</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="w-full flex flex-col items-center gap-3">
        <div className="flex gap-3">
          {!recording ? (
            <button className="btn-primary" onClick={startRecording} disabled={isSpeaking}>
              Start Answer
            </button>
          ) : (
            <button className="btn-disconnect" onClick={stopRecording}>
              Stop Answer
            </button>
          )}
        </div>
      </div>
    </>
  );
}
