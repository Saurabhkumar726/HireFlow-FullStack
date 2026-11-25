using Microsoft.Extensions.AI;

namespace HireFlow.Api.Services
{
    public class FallbackChatClient : IChatClient
    {
        public ChatClientMetadata Metadata => new("FallbackChatClient");

        public Task<ChatResponse> GetResponseAsync(
            IEnumerable<ChatMessage> chatMessages,
            ChatOptions? options = null,
            CancellationToken cancellationToken = default)
        {
            var userMessage = chatMessages.LastOrDefault(m => m.Role == ChatRole.User)?.Text ?? string.Empty;
            var responseText = "I am HireFlow's AI Copilot. How can I assist you with jobs, applications, or hiring trends?";
            return Task.FromResult(new ChatResponse(new ChatMessage(ChatRole.Assistant, responseText)));
        }

        public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
            IEnumerable<ChatMessage> chatMessages,
            ChatOptions? options = null,
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            yield return new ChatResponseUpdate(ChatRole.Assistant, "I am HireFlow's AI Copilot.");
            await Task.CompletedTask;
        }

        public object? GetService(Type serviceType, object? serviceKey = null)
        {
            return serviceType == typeof(FallbackChatClient) ? this : null;
        }

        public void Dispose()
        {
        }
    }
}
