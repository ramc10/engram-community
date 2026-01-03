# LM Studio Setup Guide for Engram

This guide explains how to set up **LM Studio** with Engram to use local, free AI models for memory enrichment instead of paid APIs from OpenAI or Anthropic.

## Why Use LM Studio?

- **100% Free**: No API costs, unlimited usage
- **Privacy**: All processing happens locally on your machine
- **Offline**: Works without internet connection
- **Fast**: Small models (1-3B parameters) run quickly on modern hardware
- **No API Keys**: No need to sign up for external services

## Prerequisites

- **RAM**: At least 8GB (16GB recommended)
- **Storage**: 2-10GB for model files
- **OS**: macOS, Windows, or Linux

## Step 1: Install LM Studio

1. **Download LM Studio**:
   - Visit [https://lmstudio.ai/](https://lmstudio.ai/)
   - Download the version for your operating system
   - Install and launch the application

2. **Initial Setup**:
   - Open LM Studio
   - You'll see the Model Explorer on the first launch

## Step 2: Download a Recommended Model

For Engram, we recommend small, fast models optimized for structured output:

### Recommended Models (in order of preference):

1. **Llama 3.2 3B Instruct** ⭐ (Best balance)
   - Search: `llama-3.2-3b-instruct`
   - Download: `bartowski/Llama-3.2-3B-Instruct-GGUF`
   - Quantization: `Q4_K_M` (best quality/speed balance)
   - Size: ~2GB
   - Speed: Very fast on CPU

2. **Llama 3.2 1B Instruct** (Fastest)
   - Search: `llama-3.2-1b-instruct`
   - Download: `bartowski/Llama-3.2-1B-Instruct-GGUF`
   - Quantization: `Q4_K_M`
   - Size: ~0.8GB
   - Speed: Extremely fast, good for low-end hardware

3. **Phi-3 Mini** (Alternative)
   - Search: `phi-3-mini`
   - Download: `microsoft/Phi-3-mini-4k-instruct-gguf`
   - Quantization: `Q4_K_M`
   - Size: ~2.4GB

4. **Qwen 2.5 3B Instruct** (Alternative)
   - Search: `qwen2.5-3b-instruct`
   - Download: `Qwen/Qwen2.5-3B-Instruct-GGUF`
   - Quantization: `Q4_K_M`
   - Size: ~2GB

### Download Instructions:

1. In LM Studio, click the **🔍 Search** tab
2. Type the model name (e.g., `llama-3.2-3b-instruct`)
3. Find the GGUF version from the recommended author
4. Click **Download** on the `Q4_K_M` quantization
5. Wait for download to complete (may take a few minutes)

## Step 3: Start the Local Server

1. **Load Model**:
   - Click the **💬 Chat** tab in LM Studio
   - Select your downloaded model from the dropdown at the top
   - Wait for it to load (you'll see "Model loaded" message)

2. **Start Server**:
   - Click the **↔️ Developer** tab
   - Or use the menu: **Developer → Start Server**
   - The server will start on `http://localhost:1234`
   - You should see: "Server running on port 1234"

3. **Keep LM Studio Running**:
   - ⚠️ **Important**: Keep LM Studio open while using Engram
   - The local server must be running for enrichment to work
   - You can minimize it to the background

## Step 4: Configure Engram

1. **Open Engram Extension**:
   - Click the Engram icon in your browser toolbar
   - Go to **⚙️ Settings**

2. **Configure memA (Memory Intelligence)**:
   - Find the **memA** section
   - Toggle **Enable memA** to ON

3. **Select Provider**:
   - **LLM Provider**: Select `Local (LM Studio / Ollama) - Free!`
   - **Model**: Select the model you downloaded (e.g., `Llama 3.2 3B Instruct`)
   - **Local Endpoint**: Should be `http://localhost:1234` (default)

4. **Optional Settings**:
   - **Link Detection**: Toggle ON to find connections between memories (Phase 2)
   - **Batch Size**: Leave at `5` (processes 5 memories at a time)

## Step 5: Test It Out

1. **Visit an AI Chat Platform**:
   - Go to [ChatGPT](https://chatgpt.com), [Claude](https://claude.ai), or [Perplexity](https://www.perplexity.ai)

2. **Have a Conversation**:
   - Ask any question and get a response
   - Engram will automatically capture the conversation

3. **Check Enrichment**:
   - Open Engram popup → **Memories** tab
   - You should see your conversation saved
   - After a few seconds, the memory will be enriched with:
     - **Keywords**: Key concepts extracted from the conversation
     - **Tags**: Categorical labels
     - **Context**: One-sentence summary

4. **Verify in LM Studio**:
   - Switch to LM Studio
   - Check the **Logs** tab
   - You should see API requests coming from Engram

## Troubleshooting

### Issue: "Please set a local endpoint first"

**Solution**: Make sure you've entered a valid endpoint:
- Default for LM Studio: `http://localhost:1234`
- Default for Ollama: `http://localhost:11434`

### Issue: "Local model API error (500)"

**Possible causes**:
1. **Model not loaded**: Go to LM Studio Chat tab and load a model
2. **Server not running**: Start the server in Developer tab
3. **Wrong endpoint**: Check the port number matches

### Issue: Enrichment takes too long

**Solutions**:
1. **Use a smaller model**: Try Llama 3.2 1B instead of 3B
2. **Reduce batch size**: Set to 1-3 instead of 5
3. **Check CPU usage**: Close other heavy applications

### Issue: LM Studio says "Port already in use"

**Solution**: Another application is using port 1234
1. In LM Studio settings, change the port (e.g., to 1235)
2. Update Engram's Local Endpoint to match: `http://localhost:1235`

### Issue: Enrichment not generating valid JSON

**Solution**: Some models struggle with JSON output
1. Try a different model (Llama 3.2 is most reliable)
2. Check LM Studio logs for the actual response
3. The service will automatically retry failed enrichments

## Using Ollama Instead of LM Studio

Ollama is a command-line alternative to LM Studio:

1. **Install Ollama**:
   ```bash
   # macOS/Linux
   curl -fsSL https://ollama.ai/install.sh | sh

   # Windows: Download from https://ollama.ai
   ```

2. **Pull a Model**:
   ```bash
   ollama pull llama3.2:3b-instruct
   ```

3. **Start Ollama**:
   ```bash
   ollama serve
   ```

4. **Configure Engram**:
   - Provider: `Local (LM Studio / Ollama) - Free!`
   - Endpoint: `http://localhost:11434`
   - Model: `llama3.2:3b-instruct`

## Performance Benchmarks

Based on M1 MacBook Pro (16GB RAM):

| Model | Size | Speed | Quality | Recommended For |
|-------|------|-------|---------|-----------------|
| Llama 3.2 1B | 0.8GB | ~50 tokens/s | Good | Low-end hardware, speed priority |
| Llama 3.2 3B | 2GB | ~30 tokens/s | Excellent | **Best overall choice** |
| Phi-3 Mini | 2.4GB | ~25 tokens/s | Very Good | Alternative option |
| Qwen 2.5 3B | 2GB | ~28 tokens/s | Very Good | Alternative option |

*Note: Performance varies by hardware. GPU acceleration significantly improves speed.*

## Cost Comparison

### Cloud APIs (per 1,000 memories enriched):
- **OpenAI GPT-4o-mini**: ~$0.50
- **Anthropic Claude Haiku**: ~$0.75

### Local Models (LM Studio):
- **Any model**: **$0.00** ✨
- Only cost is electricity (~$0.01 for 1,000 memories)

## Advanced Configuration

### Custom Model Names

If you're using a model not in the dropdown:
1. Select **Model**: `Custom Model`
2. Enter the exact model name as it appears in LM Studio

### Multiple Instances

You can run multiple LM Studio instances on different ports:
1. Start first instance on port 1234 (enrichment)
2. Start second instance on port 1235 (link detection)
3. Configure accordingly in Engram

### GPU Acceleration

For faster processing:
1. LM Studio automatically uses GPU if available
2. Check **Settings → Hardware** in LM Studio
3. Enable GPU acceleration for NVIDIA/AMD/Metal GPUs

## Best Practices

1. **Start LM Studio First**: Always launch LM Studio before using Engram enrichment
2. **Keep It Running**: Don't close LM Studio while enrichment is active
3. **Background Processing**: Enrichment happens in the background, you can keep browsing
4. **Batch Processing**: Engram processes memories in batches to avoid overwhelming your system
5. **Monitor Performance**: Check LM Studio logs to see response times

## FAQ

**Q: Do I need internet for this to work?**
A: No! Once you've downloaded the model, everything runs offline.

**Q: Will this slow down my computer?**
A: Small models (1-3B) have minimal impact. Larger models may slow older machines.

**Q: Can I use this with OpenAI/Anthropic too?**
A: Yes! You can switch providers anytime in settings.

**Q: What happens if LM Studio crashes?**
A: Engram will queue memories and retry enrichment when the server is back.

**Q: Is my data sent anywhere?**
A: No! All processing happens locally. Your conversations never leave your machine.

## Need Help?

- **LM Studio Discord**: [https://discord.gg/lmstudio](https://discord.gg/lmstudio)
- **Engram Issues**: [GitHub Issues](https://github.com/arthurwolf/engram/issues)
- **Documentation**: Check the main README for more features

---

**Happy enriching! 🚀**

Your memories are now being enhanced by AI running entirely on your machine, for free, forever.
