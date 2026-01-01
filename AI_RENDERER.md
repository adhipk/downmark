# AI Renderer

The AI Renderer uses Large Language Models (LLMs) to intelligently refine and improve extracted content from web pages.

## How It Works

1. **Extracts content** using standard boilerplate removal
2. **Converts to Markdown** using Pandoc
3. **Refines with AI** - The LLM cleans up formatting, removes remaining boilerplate, fixes broken syntax, and improves readability
4. **Converts back to HTML** for display

## Configuration

### Environment Variables

Set one of the following API keys:

```bash
# For Anthropic Claude
export ANTHROPIC_API_KEY="your-api-key-here"

# For OpenAI
export OPENAI_API_KEY="your-api-key-here"
```

### Optional Configuration

```bash
# Enable the AI renderer (default: false)
export AI_RENDERER_ENABLED="true"

# Set the model to use (default: claude-3-5-haiku-20241022)
export AI_RENDERER_MODEL="claude-3-5-haiku-20241022"

# For OpenAI, set:
# export AI_RENDERER_MODEL="gpt-4o-mini"
# export AI_RENDERER_ENDPOINT="https://api.openai.com/v1/chat/completions"

# For Anthropic (default)
# export AI_RENDERER_ENDPOINT="https://api.anthropic.com/v1/messages"
```

## Usage

### Enable AI Renderer for a Specific URL

There are two ways to use the AI renderer:

#### Method 1: Use the `/ai/` prefix (Recommended)

Simply add `/ai/` before the URL:

```bash
# Via browser - much cleaner!
http://localhost:3000/ai/https://example.com

# All links within the page will also use AI renderer
# Navigate to a Wikipedia article with AI
http://localhost:3000/ai/https://en.wikipedia.org/wiki/Artificial_intelligence
```

#### Method 2: Use query parameter

Add `?renderer=ai` to the URL:

```bash
# Via browser
http://localhost:3000/https://example.com?renderer=ai

# Via API
curl "http://localhost:3000/render?q=https://example.com&renderer=ai"
```

### Navigation Behavior

When using `/ai/` prefix:
- ✅ All clicked links stay in AI mode
- ✅ Form submissions stay in AI mode
- ✅ Back/forward navigation preserves AI mode
- ✅ URL bar clearly shows you're in AI mode

This creates a seamless "AI browsing" experience!

### Check Available Renderers

The AI renderer will be registered on startup if configured correctly. Check the server logs:

```
[Server] Discovering renderers...
[RendererRegistry] Registered: wikipedia (*.wikipedia.org, wikipedia.org)
[RendererRegistry] Registered: ai ()
[Server] Renderer discovery complete.
```

## Benefits

- **Cleaner output**: AI removes subtle boilerplate that regex patterns miss
- **Better formatting**: Fixes broken markdown syntax and improves heading hierarchy
- **Smart extraction**: Understands context to distinguish content from navigation
- **Flexible**: Works with any webpage, no need for site-specific patterns

## Limitations

- **Cost**: Each page requires an API call (though Haiku is very affordable)
- **Latency**: ~2-5 seconds additional processing time
- **API dependency**: Requires internet connection and API availability
- **No automatic pattern matching**: Must be explicitly enabled with `?renderer=ai`

## Fallback Behavior

If the AI renderer is enabled but:
- No API key is set → Falls back to Pandoc-only output
- API call fails → Falls back to Pandoc-only output
- Invalid model specified → Falls back to Pandoc-only output

The renderer will always return content, even if AI refinement fails.

## Example .env File

```bash
# AI Renderer Configuration
AI_RENDERER_ENABLED=true
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Use a different model
# AI_RENDERER_MODEL=claude-3-5-sonnet-20241022

# Optional: Use OpenAI instead
# OPENAI_API_KEY=sk-...
# AI_RENDERER_MODEL=gpt-4o-mini
# AI_RENDERER_ENDPOINT=https://api.openai.com/v1/chat/completions
```

## Cost Estimate

Using Claude 3.5 Haiku (default):
- Input: $0.80 per million tokens
- Output: $4.00 per million tokens
- Average page: ~2,000 input tokens, ~1,500 output tokens
- **Cost per page**: ~$0.008 (less than a penny)

Using GPT-4o Mini:
- Input: $0.15 per million tokens
- Output: $0.60 per million tokens
- **Cost per page**: ~$0.001 (fraction of a penny)

## Recommended Models

### For Best Quality
- `claude-3-5-sonnet-20241022` - Best quality, higher cost (~$0.03/page)
- `gpt-4o` - Excellent quality, moderate cost (~$0.015/page)

### For Best Value (Recommended)
- `claude-3-5-haiku-20241022` - Great quality, very low cost (~$0.008/page) ⭐
- `gpt-4o-mini` - Good quality, lowest cost (~$0.001/page)

## Future Enhancements

Potential improvements:
- Cache AI-refined content to avoid re-processing
- Stream AI responses for faster perceived performance
- Support local LLMs (Ollama, LM Studio)
- Fine-tune prompts per content type
- Add structured extraction for specific data types
