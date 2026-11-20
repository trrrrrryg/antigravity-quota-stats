---
name: quota-stats
description: Check Antigravity local usage statistics (sessions, messages, net & cached tokens, active days, peak hours, per-model breakdown, and daily heatmap) and open the Quota & Usage Stats sidecar panel. Use when the user invokes /quota-stats or asks to inspect their Antigravity usage or quota card.
---

# Quota & Usage Stats

When the user asks to inspect their Antigravity usage stats, subscription quota config, or open the panel:

1. Point them to the **Quota & Usage Stats** card directly above the **设置** button at the bottom of the left sidebar (clicking it opens the interactive stats & heatmap popover).
2. You can also surface a clickable pill link to the sidecar auxiliary pane: `[Quota & Usage Stats](sidecar://antigravity-quota-stats/quota_bar/)`, and link `[antigravity-quota-stats](customization://antigravity-quota-stats)` to toggle or manage the plugin.
3. If the sidebar card does not appear immediately after launch, ensure Antigravity was launched with `--remote-debugging-port=9222` (the auxiliary pane still works anytime).
