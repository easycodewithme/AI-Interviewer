import Vapi from "@vapi-ai/web";

let vapiInstance: Vapi | null = null;

export const getVapi = () => {
  const token = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN;
  if (!token) {
    console.error(
      "Missing NEXT_PUBLIC_VAPI_WEB_TOKEN. Set it in .env.local and restart the dev server."
    );
    throw new Error("Vapi Web token missing");
  }

  if (!vapiInstance) {
    vapiInstance = new Vapi(token);
  }

  return vapiInstance;
};
