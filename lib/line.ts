import "server-only";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

export async function pushLineMessage(to: string, text: string): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token) {
    console.warn("LINE notification skipped: missing LINE_CHANNEL_ACCESS_TOKEN");
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

/** Notifies the fixed admin recipient (LINE_USER_ID). */
export async function sendLineMessage(text: string): Promise<boolean> {
  const to = process.env.LINE_USER_ID;
  if (!to) {
    console.warn("LINE notification skipped: missing LINE_USER_ID");
    return false;
  }
  return pushLineMessage(to, text);
}
