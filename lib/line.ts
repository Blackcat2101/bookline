import "server-only";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

export async function sendLineMessage(text: string): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_USER_ID;

  if (!token || !to) {
    console.warn("LINE notification skipped: missing LINE env vars");
    return false;
  }

  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to,
        messages: [{ type: "text", text }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`LINE push failed (${res.status}): ${body}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Failed to send LINE notification:", err);
    return false;
  }
}
