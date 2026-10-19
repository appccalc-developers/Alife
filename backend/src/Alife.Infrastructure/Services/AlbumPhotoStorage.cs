using System.Net.Http.Headers;
using Alife.Application.Albums;
using Alife.Application.FileAssets.Services;
using Microsoft.Extensions.Configuration;

namespace Alife.Infrastructure.Services;

public sealed class AlbumPhotoStorage(HttpClient client, IConfiguration configuration) : IAlbumPhotoStorage
{
    public Task UploadAsync(FileStorageProviderOptions provider, string key, AlbumPhotoContent content, CancellationToken ct)
        => SendAsync(provider, key, HttpMethod.Put, content, ct);
    public Task DeleteAsync(FileStorageProviderOptions provider, string key, CancellationToken ct)
        => SendAsync(provider, key, HttpMethod.Delete, null, ct);

    private HttpRequestMessage Request(FileStorageProviderOptions provider, string key, HttpMethod method)
    {
        var secret = configuration["FileAssets:ImageApiAdminSecret"];
        if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(provider.UploadApiBaseUrl))
            throw new InvalidOperationException("Album photo storage is not configured.");
        var encoded = string.Join("/", key.Split('/').Select(Uri.EscapeDataString));
        var request = new HttpRequestMessage(method, $"{provider.UploadApiBaseUrl.TrimEnd('/')}/api/admin/album-photos/{encoded}");
        request.Headers.Add("x-alife-file-admin-secret", secret);
        return request;
    }

    private async Task SendAsync(FileStorageProviderOptions provider, string key, HttpMethod method, AlbumPhotoContent? content, CancellationToken ct)
    {
        using var request = Request(provider, key, method);
        if (content is not null)
        {
            request.Content = new ByteArrayContent(content.Bytes);
            request.Content.Headers.ContentType = new MediaTypeHeaderValue(content.ContentType);
        }
        using var response = await client.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
    }

    public async Task<AlbumPhotoDownload> ReadAsync(FileStorageProviderOptions provider, string key, CancellationToken ct)
    {
        using var request = Request(provider, key, HttpMethod.Get);
        var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        try
        {
            response.EnsureSuccessStatusCode();
            var stream = await response.Content.ReadAsStreamAsync(ct);
            return new(new ResponseStream(stream, response), response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream");
        }
        catch { response.Dispose(); throw; }
    }

    // MVC owns the returned stream. Disposing it must release the HTTP response,
    // including on a cancelled client read; historical large files stay streamed.
    private sealed class ResponseStream(Stream inner, HttpResponseMessage response) : Stream
    {
        public override bool CanRead => inner.CanRead;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override int Read(byte[] buffer, int offset, int count) => inner.Read(buffer, offset, count);
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken ct = default) => inner.ReadAsync(buffer, ct);
        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken ct) => inner.ReadAsync(buffer, offset, count, ct);
        public override void Flush() => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        protected override void Dispose(bool disposing) { if (disposing) { inner.Dispose(); response.Dispose(); } base.Dispose(disposing); }
        public override async ValueTask DisposeAsync() { await inner.DisposeAsync(); response.Dispose(); GC.SuppressFinalize(this); }
    }
}
