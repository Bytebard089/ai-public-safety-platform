"""
Inbound Telegram bot — the piece that was previously claimed but not built.

Previously, main.py only had an outbound /alert endpoint (the server
pushing a message out). This is the actual "citizen forwards a suspicious
message and gets a reply" flow: a real bot that listens for incoming
messages via long polling (no public webhook URL or server needed, which
is what makes this genuinely free and easy to run for a demo).

Run: python3 telegram_bot.py
Requires TELEGRAM_BOT_TOKEN in the environment (free, from @BotFather).
This process is separate from the FastAPI server — run both side by side
for the full demo.
"""

import os

from telegram import Update
from telegram.ext import Application, MessageHandler, ContextTypes, filters

from detector import analyze

VERDICT_EMOJI = {"low": "🟢", "medium": "🟠", "high": "🔴"}


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = update.message.text
    if not text:
        return

    result = analyze(text)
    emoji = VERDICT_EMOJI.get(result.verdict, "⚪")

    reply = (
        f"{emoji} Risk: {result.verdict.upper()} ({result.score}/100)\n\n"
        f"{result.reason}\n"
    )
    if result.verdict != "low":
        reply += (
            "\nIf this is a real call in progress:\n"
            "1. Do not share any OTP or make any payment.\n"
            "2. Disconnect the call.\n"
            "3. Report at cybercrime.gov.in or call 1930.\n"
        )
    await update.message.reply_text(reply)


def main():
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        raise SystemExit("Set TELEGRAM_BOT_TOKEN in your environment first (free, from @BotFather).")

    app = Application.builder().token(token).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    print("Scam Shield Telegram bot running (polling). Forward a message to it to test.")
    app.run_polling()


if __name__ == "__main__":
    main()
