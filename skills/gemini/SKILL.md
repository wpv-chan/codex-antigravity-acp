---
name: gemini
description: Ask Gemini 4 Carbon High through the Antigravity MCP. Use for a leading /Gemini or $gemini request, a natural-language invitation such as “让 Gemini 看看” or “你和 Gemini 一起探讨”, or a follow-up to Gemini's reply. Questions about setting up Gemini or this shortcut can be answered by Codex.
---

# Gemini

Call the `discuss` tool on the `antigravity` MCP server. For a leading `/Gemini` (case-insensitive) or `$gemini`, use the text after the shortcut as the question. A selected Gemini skill and a natural-language invitation use the same tool. Preserve the user's wording, code and constraints. Add the relevant context for references such as “这个方案”. If the user supplied only the shortcut and there is no clear topic, ask what they want to discuss.

Start a new topic with `question` alone. For a follow-up, pass the `discussion_id` returned for that topic in this chat, even when the user switches between the shortcut and natural language.

For a direct question, give Gemini's reply in the user's requested format and credit Gemini where the format permits. For a joint review, form an independent Codex assessment and give Gemini the same facts and constraints in a neutral question. Compare the conclusions. Follow up on a disagreement when resolving it could change the recommendation.

If the tool fails, report the actual failure. Attribute an answer to Gemini only after a successful tool call.
