using Alife.DbMigrator;
using System.Text;

namespace Alife.Tests.Unit.Events;

public sealed class EventInstancePurgeTests
{
    [Theory]
    [InlineData("nvarchar")]
    [InlineData("varchar")]
    [InlineData("nchar")]
    [InlineData("char")]
    [InlineData("ntext")]
    [InlineData("text")]
    public void Soft_reference_scan_includes_all_sql_text_types(string typeName)
    {
        Assert.True(EventInstancePurge.IsReferenceScannableTextType(typeName));
    }

    [Theory]
    [InlineData("uniqueidentifier")]
    [InlineData("varbinary")]
    [InlineData("int")]
    [InlineData("datetime2")]
    public void Soft_reference_text_scan_excludes_non_text_types(string typeName)
    {
        Assert.False(EventInstancePurge.IsReferenceScannableTextType(typeName));
    }

    [Fact]
    public void File_manifest_hash_is_order_independent_and_binds_recovery_destination()
    {
        var first = File("b/key.pdf", "run-42", 12, "etag-a");
        var second = File("a/key.pdf", "run-42", 24, null);

        var forward = EventInstancePurge.CalculateFileManifestHash([first, second]);
        var reverse = EventInstancePurge.CalculateFileManifestHash([second, first]);
        var otherRun = EventInstancePurge.CalculateFileManifestHash([File("b/key.pdf", "run-43", 12, "etag-a"), second]);

        Assert.Equal(forward, reverse);
        Assert.NotEqual(forward, otherRun);
        Assert.Matches("^[0-9a-f]{64}$", forward);
    }

    [Fact]
    public void Shared_files_do_not_enter_the_remote_delete_manifest()
    {
        var exclusive = File("event/exclusive.jpg", "run-42", 10, null);
        var shared = File("event/shared.jpg", "run-42", 10, null) with { Disposition = "unlink-only" };

        Assert.Equal(
            EventInstancePurge.CalculateFileManifestHash([exclusive]),
            EventInstancePurge.CalculateFileManifestHash([shared, exclusive]));
    }

    [Theory]
    [InlineData("/absolute.jpg")]
    [InlineData("folder/../escape.jpg")]
    [InlineData("folder\\escape.jpg")]
    [InlineData("quarantine/already-private.jpg")]
    public void Recovery_key_rejects_unsafe_source_keys(string objectKey)
    {
        Assert.Throws<InvalidOperationException>(() =>
            EventInstancePurge.BuildRecoveryKey("run-42", "cloudflare-r2", "ccalc", objectKey));
    }

    [Fact]
    public void Recovery_key_rejects_ascii_control_characters()
    {
        foreach (var objectKey in new[] { "event/control\u0001.pdf", "event/control\u007f.pdf" })
        {
            Assert.Throws<InvalidOperationException>(() =>
                EventInstancePurge.BuildRecoveryKey("run-42", "cloudflare-r2", "ccalc", objectKey));
        }
    }

    [Theory]
    [InlineData("event/question?.pdf")]
    [InlineData("event/star*.pdf")]
    [InlineData("event/bracket[1].pdf")]
    public void Recovery_key_accepts_exact_keys_with_glob_characters(string objectKey)
    {
        var recoveryKey = EventInstancePurge.BuildRecoveryKey("run-42", "cloudflare-r2", "ccalc", objectKey);

        Assert.StartsWith("quarantine/event-reset/run-42/", recoveryKey, StringComparison.Ordinal);
    }

    [Fact]
    public void Recovery_key_rejects_source_keys_over_the_utf8_limit()
    {
        var multibyteObjectKey = new string('\u754c', 400);

        Assert.True(multibyteObjectKey.Length < 1024);
        Assert.Throws<InvalidOperationException>(() =>
            EventInstancePurge.BuildRecoveryKey("run-42", "cloudflare-r2", "ccalc", multibyteObjectKey));
    }

    [Fact]
    public void Recovery_key_rejects_generated_keys_over_the_utf8_limit()
    {
        var objectKey = new string('x', 970);

        Assert.Throws<InvalidOperationException>(() =>
            EventInstancePurge.BuildRecoveryKey("run-42", "cloudflare-r2", "ccalc", objectKey));
    }

    [Fact]
    public void Recovery_key_reserves_space_for_the_metadata_sidecar()
    {
        const string runId = "run-42";
        var recoveryPrefixBytes = Encoding.UTF8.GetByteCount($"quarantine/event-reset/{runId}/") + 64 + 1;
        var objectKey = new string('x', 1024 - recoveryPrefixBytes);

        Assert.Throws<InvalidOperationException>(() =>
            EventInstancePurge.BuildRecoveryKey(runId, "cloudflare-r2", "ccalc", objectKey));
    }

    private static EventInstancePurge.FileEvidence File(string objectKey, string runId, long size, string? etag)
    {
        var recoveryKey = EventInstancePurge.BuildRecoveryKey(runId, "cloudflare-r2", "ccalc", objectKey);
        return new(Guid.NewGuid(), "cloudflare-r2", "ccalc", objectKey, recoveryKey, size, etag, "event", Guid.NewGuid(), "delete-after-sql", true);
    }
}
