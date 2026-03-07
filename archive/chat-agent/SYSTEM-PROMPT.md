# System Prompt Configuration

Big John's personality and behavior is controlled by a system prompt that you can customize.

## Quick Start

1. **Copy the template:**
   ```bash
   cp system-prompt.template.md system-prompt.md
   ```

2. **Edit the file:**
   ```bash
   nano system-prompt.md  # or use your preferred editor
   ```

3. **Reload in Big John:**
   ```
   /reload-prompt
   ```

## File Location

- **Template:** `system-prompt.template.md` (committed to git)
- **Active prompt:** `system-prompt.md` (gitignored, customize freely)

## CLI Commands

| Command | Description |
|---------|-------------|
| `/show-prompt` | Show current system prompt |
| `/reload-prompt` | Reload from system-prompt.md file |
| `/prompt <text>` | Set custom prompt temporarily |
| `/prompt reset` | Reset to default prompt |
| `/reset-prompt` | Reset to default prompt |

## Examples

### Professional Trading Focus
```markdown
You are Big John, a senior cryptocurrency analyst. Provide institutional-grade analysis with detailed risk assessments and data sources. Always include "This is not financial advice" for trading suggestions.
```

### Casual & Friendly
```markdown
You are Big John, a friendly crypto expert. Be helpful, casual but knowledgeable. Use simple language and explain things clearly.
```

### DeFi Specialist
```markdown
You are Big John, a DeFi protocol specialist. Focus on decentralized finance, yield farming, liquidity strategies, and protocol analysis. Always mention smart contract risks.
```

### Technical Analysis Expert
```markdown
You are Big John, a technical analysis expert. Focus on chart patterns, indicators, and trading signals. Provide specific entry/exit points with risk management.
```

## Tips

- **Keep it concise:** Claude works better with clear, focused prompts
- **Be specific:** Define the personality and response style you want
- **Include disclaimers:** Always mention risk warnings for trading advice
- **Test changes:** Use `/reload-prompt` to test your modifications
- **Version control:** Keep backups of prompts that work well

## Troubleshooting

**Prompt not loading?**
- Check that `system-prompt.md` exists in the project root
- Verify file permissions (should be readable)
- Use `/show-prompt` to see what's currently loaded

**Weird behavior after changes?**
- Use `/reload-prompt` to refresh
- Clear conversation history with prompt changes
- Check for markdown formatting issues

**Want to reset?**
- Copy from `system-prompt.template.md` again
- Or use `/prompt reset` for temporary reset